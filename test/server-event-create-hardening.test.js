const assert = require('node:assert/strict');
const Module = require('node:module');
const express = require('express');
const { createEventEditorialApiClient } = require('../scripts/event-editorial-api-client');

const secret = 'hardening-test-secret';
const origin = 'http://localhost:3000';
let app;
let consumes = 0;
let creates = 0;
let versions = 0;
let mode = 'allowed';
let creationError;
const supabase = {
    from() { return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null }) }; },
    async rpc(name) {
        if (name === 'consume_admin_rate_limit') {
            consumes++;
            if (mode === 'offline') return { error: { message: secret } };
            return { data: [{ allowed: mode !== 'limited', retry_after_seconds: 7, current_count: 1 }] };
        }
        if (name === 'create_versioned_event') {
            creates++;
            if (creationError) return { error: { message: creationError, details: secret } };
            return { data: [{ event_id: 'test-event', version_id: '11111111-1111-4111-8111-111111111111', version_number: 1, workflow_status: 'draft' }] };
        }
        if (name === 'create_event_version_audited') {
            versions++;
            return { data: [{ version_id: '11111111-1111-4111-8111-111111111111', version_number: 2 }] };
        }
        throw new Error('Unexpected RPC ' + name);
    }
};
const savedEnv = { ...process.env };
Object.assign(process.env, { ADMIN_PASSWORD: secret, ADMIN_ALLOWED_ORIGINS: origin, SUPABASE_URL: 'https://example.test', SUPABASE_KEY: 'mock', ADMIN_RATE_LIMIT_MAX_REQUESTS: '20', ADMIN_RATE_LIMIT_WINDOW_SECONDS: '60' });
const load = Module._load;
Module._load = function (name, parent, main) {
    if (name === '@supabase/supabase-js') return { createClient: () => supabase };
    if (name === 'express') {
        const wrapper = () => { app = express(); app.listen = () => {}; return app; };
        Object.assign(wrapper, express); return wrapper;
    }
    return load.call(this, name, parent, main);
};
try { require('../server'); } finally { Module._load = load; process.env = savedEnv; }

(async () => {
    const server = require('node:http').createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const logs = [];
    const logError = console.error;
    console.error = (...args) => logs.push(args);
    const content = { schema_version: 1, event: {}, template: { slug: 'boda-vertical' }, sections: [{ id: 'hero', type: 'hero', enabled: true, order: 1, data: {} }] };
    const payload = JSON.stringify({ eventId: 'test-event', content });
    async function request({ headers = {}, body = payload } = {}) {
        const response = await fetch(baseUrl + '/api/admin/eventos', { method: 'POST', headers, body });
        const result = await response.json();
        assert(!JSON.stringify(result).includes(secret));
        return { status: response.status, body: result, retry: response.headers.get('retry-after') };
    }
    const headers = { Origin: origin, 'X-Admin-Password': secret, 'Content-Type': 'application/json' };
    try {
        for (const denied of [
            { 'X-Admin-Password': secret },
            { ...headers, Origin: 'https://evil.test' },
            { ...headers, Origin: 'https://evil.test', Referer: origin + '/admin.html' },
            { ...headers, Origin: undefined, Referer: 'https://evil.test/admin.html' },
            { ...headers, 'X-Admin-Password': 'wrong' },
            { Origin: origin, 'Content-Type': 'application/json' }
        ]) {
            const clean = Object.fromEntries(Object.entries(denied).filter(([, value]) => value !== undefined));
            const result = await request({ headers: clean, body: '{' + secret });
            assert.equal(result.status, clean.Origin === origin && clean['X-Admin-Password'] !== secret ? 401 : 403);
        }
        assert.equal((await request({ headers: {Origin: origin}, body: 'x'.repeat(12 * 1024 * 1024 + 1) })).status, 401);
        assert.equal(consumes, 0); assert.equal(creates, 0);
        const created = await request({ headers: {...headers, 'Content-Type': 'application/json; charset=utf-8'} });
        assert.equal(created.status, 201); assert.equal(created.body.versionNumber, 1); assert.equal(created.body.workflowStatus, 'draft');
        assert.equal(consumes, 1); assert.equal(creates, 1);
        const referer = { ...headers, Referer: origin + '/admin.html' }; delete referer.Origin;
        assert.equal((await request({ headers: referer })).status, 201);
        const beforeInvalidBodies = creates;
        for (const type of [null, 'text/plain', 'application/jsonp']) {
            const h = { ...headers }; if (type === null) delete h['Content-Type']; else h['Content-Type'] = type;
            assert.equal((await request({ headers: h })).status, 415);
        }
        assert.equal((await request({ headers, body: '{"secret":"' + secret })).status, 400);
        assert.equal((await request({ headers, body: '"' + 'x'.repeat(12 * 1024 * 1024) + '"' })).status, 413);
        assert.equal(creates, beforeInvalidBodies);
        assert.equal((await request({ headers, body: JSON.stringify({ eventId: 'test-event', content: { schema_version: 999 } }) })).status, 422);
        assert.equal((await request({ headers, body: JSON.stringify({ eventId: 'Invalid ID', content }) })).status, 400);
        assert.equal((await request({ headers, body: JSON.stringify({ eventId: 'test-event', content: { ...content, id: 'different' } }) })).status, 422);
        for (const snapshot of [{}, require('./fixtures/event-v2-complete.json')]) {
            const value = { ...snapshot, id: 'test-event' };
            assert.equal((await request({ headers, body: JSON.stringify({ eventId: 'test-event', content: value }) })).status, 201);
        }
        assert.equal((await request({headers, body: JSON.stringify({eventId:'test-event', content:{id:'test-event', media:{image:'data:image/png;base64,' + 'A'.repeat(1024 * 1024)}}})})).status, 201);
        creationError = 'EVENT_ALREADY_EXISTS';
        const collision = await request({ headers }); assert.equal(collision.status, 409); assert.equal(collision.body.error.code, creationError);
        creationError = undefined;
        const previousCreates = creates;
        mode = 'limited'; const limited = await request({ headers }); assert.equal(limited.status, 429); assert.equal(limited.retry, '7');
        mode = 'offline'; assert.equal((await request({ headers })).status, 503);
        assert.equal(creates, previousCreates);
        mode = 'allowed';
        const client = createEventEditorialApiClient({ baseUrl: origin, adminPassword: secret, fetchImpl: (url, options) => fetch(url.replace(origin, baseUrl), options) });
        const before = consumes;
        await client.createEvent('test-event', content);
        await client.createVersion('test-event', { content, expectedWorkingVersionId: null });
        assert.equal(consumes - before, 2); assert.equal(versions, 1);
        assert.equal(logs.length, 0);
        console.log('creation hardening HTTP and CLI tests passed');
    } finally {
        console.error = logError;
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
