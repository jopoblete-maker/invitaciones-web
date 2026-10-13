"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createEventVersionEditorialService } = require("../js/core/event-version-editorial-service");
const { createAuthorizationProvider } = require("../backend/premium/authorization-provider");
const { canonicalContentDigest } = require("../backend/premium/canonical-content-digest");
const validator = require("../js/core/event-validator");

function snapshot() {
    return {
        schema_version: 2, id: "synthetic-premium", event_type: "wedding", plan: "premium",
        status: "draft", template: { slug: "boda-fiesta-premium" },
        identity: { title: "Synthetic invitation" }, schedule: { date: "2026-12-05" },
        modules: {}, media: { items: { photo: { type: "image", src: "/assets/synthetic/photo.webp" } } },
        sections: [
            { id: "hero", type: "hero", enabled: true, order: 1, data: {} },
            { id: "gallery", type: "gallery", enabled: false, order: 2,
                data: { items: [{ media_id: "photo", alt: "Synthetic photograph" }] } },
            { id: "dress", type: "dress-code", enabled: true, order: 3, data: { description: "Formal" } },
            { id: "gifts", type: "gifts", enabled: true, order: 4,
                data: { title: "Gifts", message: "Synthetic message", alias: "alias.demo", cbu: "0".repeat(22) },
                config: { allow_copy: true } },
            { id: "album", type: "collaborative-album", enabled: true, order: 5,
                data: { url: "https://album.example.com/synthetic" } }
        ]
    };
}

function approval(content) {
    return { entries: [{ revision: 1, manifest: {
        eventId: content.id, templateSlug: content.template.slug,
        canonicalDigest: canonicalContentDigest(content), status: "approved",
        media: { photo: { ...content.media.items.photo } },
        gifts: { gifts: { ...content.sections.find(s => s.type === "gifts").data } },
        albumUrls: [content.sections.find(s => s.type === "collaborative-album").data.url]
    } }] };
}

function harness(configuration, stateOverride) {
    const calls = [];
    const adapter = Object.fromEntries(["createEvent", "createVersion", "transitionWorkflow", "publishVersion", "rollbackVersion"]
        .map(method => [method, async args => { calls.push({ method, args }); return { ok: true }; }]));
    const provider = configuration && createAuthorizationProvider(configuration);
    const dependencies = configuration ? { getAuthorizationState: stateOverride || (() => ({ provider, revision: 1 })) } : {};
    return { calls, service: createEventVersionEditorialService(adapter, dependencies), provider };
}

async function rejected(h, content, eventId = content.id, extra = {}) {
    for (const method of ["createEvent", "createVersion"]) {
        let error;
        try { await h.service[method]({ eventId, content, expectedWorkingVersionId: null, ...extra }); }
        catch (caught) { error = caught; }
        assert(error, "Rejection required before any adapter call");
        assert(["INVALID_EVENT", "PREMIUM_AUTHORIZATION_DENIED"].includes(error.code));
        const output = JSON.stringify({ message: error.message, details: error.details });
        assert(!output.includes("alias.demo") && !output.includes("0".repeat(22)));
        assert(!output.includes("canonicalDigest") && !output.includes(".dev/"));
        assert.equal(h.calls.length, 0);
    }
}

(async () => {
    const content = snapshot(), configuration = approval(content);
    const before = JSON.stringify({ content, configuration });
    const h = harness(configuration);
    assert.equal(validator.validateEventForPersistence(content).valid, false);
    await h.service.createEvent({ eventId: content.id, content });
    await h.service.createVersion({ eventId: content.id, content, expectedWorkingVersionId: null });
    assert.equal(h.calls.length, 2);
    for (const call of h.calls) {
        assert.deepEqual(call.args.content, content);
        assert.notEqual(call.args.content, content);
        assert(Object.isFrozen(call.args.content.sections[1].data.items));
        assert(!Object.hasOwn(call.args.content.sections[1].data.items[0], "src"));
        assert(!Object.hasOwn(call.args, "provider") && !Object.hasOwn(call.args, "presentation"));
    }
    assert.equal(JSON.stringify({ content, configuration }), before);
    content.sections[1].data.items[0].alt = "Changed after write";
    assert.equal(h.calls[0].args.content.sections[1].data.items[0].alt, "Synthetic photograph");

    await rejected(harness(), snapshot(), "synthetic-premium", {
        getAuthorizationState: () => ({ provider: h.provider, revision: 1 }),
        premiumOptions: { albumPolicy: { isAllowed: () => true } }, provider: h.provider
    });
    await rejected(harness(configuration), snapshot(), "other-event");
    for (const mutate of [
        c => { c.id = "other-event"; }, c => { c.template.slug = "boda-vertical"; },
        c => { c.identity.title = "Unapproved change"; },
        c => { c.media.items.photo.src = "/assets/synthetic/other.webp"; },
        c => { c.sections[1].data.items[0].media_id = "other-photo"; },
        c => { c.sections[4].data.url = "https://album.example.com/other"; },
        c => { c.metadata = { permissions: { approved: true } }; }
    ]) { const changed = snapshot(); mutate(changed); await rejected(harness(configuration), changed, "synthetic-premium"); }
    for (const field of ["title", "message", "alias", "cbu"]) {
        const cfg = approval(snapshot()); delete cfg.entries[0].manifest.gifts.gifts[field];
        await rejected(harness(cfg), snapshot());
    }
    for (const mutate of [
        m => { m.status = "revoked"; }, m => { m.eventId = "other-event"; },
        m => { m.templateSlug = "other-template"; }, m => { m.canonicalDigest = "b".repeat(64); },
        m => { m.expiresAt = "2000-01-01T00:00:00Z"; }
    ]) { const cfg = approval(snapshot()); mutate(cfg.entries[0].manifest); await rejected(harness(cfg), snapshot()); }
    await rejected(harness(configuration, () => ({ provider: h.provider, revision: 2 })), snapshot());
    await rejected(harness(configuration, () => { throw new Error("Private failure"); }), snapshot());

    // Even private approval cannot bypass the full template/event validator.
    for (const mutate of [c => { c.schedule.date = "not-a-date"; },
        c => { c.template.slug = "boda-vertical"; },
        c => { c.sections[1].data.items[0].src = "/assets/synthetic/photo.webp"; },
        c => { c.sections[2].id = c.sections[1].id; }]) {
        const invalid = snapshot(); mutate(invalid); await rejected(harness(approval(invalid)), invalid);
    }
    let reads = 0;
    const replaced = harness(configuration, () => ({ provider: ++reads < 3 ? h.provider : createAuthorizationProvider(), revision: 1 }));
    await rejected(replaced, snapshot());
    let effects = 0;
    const accessor = Object.defineProperty(snapshot(), "sections", { get() { effects++; }, enumerable: true });
    const proxy = new Proxy(snapshot(), { get() { effects++; }, ownKeys() { effects++; } });
    for (const invalid of [accessor, proxy]) await rejected(harness(configuration), invalid, "synthetic-premium");
    assert.equal(effects, 0);

    // Existing non-premium V2, V1 and legacy keep their original payload identity.
    const ordinary = harness();
    const civil = { schema_version: 2, id: "synthetic-civil", event_type: "wedding-civil", plan: "esencial",
        status: "draft", template: { slug: "boda-civil-esencial" }, identity: { title: "Synthetic civil" },
        schedule: { date: "2026-12-05" }, modules: {}, media: { items: {} },
        sections: [{ id: "hero", type: "hero", enabled: true, order: 1, data: {} }] };
    const v1 = { schema_version: 1, event: {}, template: { slug: "boda-civil-esencial" },
        sections: [{ id: "hero", type: "hero", enabled: true, order: 1, data: {} }] };
    for (const value of [civil, v1, { nombre: "Synthetic legacy" }]) {
        await ordinary.service.createEvent({ eventId: value.id || "synthetic-legacy", content: value });
        assert.equal(ordinary.calls.at(-1).args.content, value);
    }
    const downgraded = snapshot(); downgraded.schema_version = 1;
    await rejected(harness(configuration), downgraded);

    // Portable/browser factory cannot activate the private Node integration.
    const sandbox = { EventValidator: validator };
    vm.runInNewContext(fs.readFileSync(require.resolve("../js/core/event-version-editorial-service"), "utf8"), sandbox);
    let browserWrites = 0;
    const adapter = Object.fromEntries(["createEvent", "createVersion", "transitionWorkflow", "publishVersion", "rollbackVersion"]
        .map(method => [method, () => { browserWrites++; }]));
    const browserService = sandbox.EventVersionEditorialService.createEventVersionEditorialService(adapter,
        { getAuthorizationState: () => ({ provider: h.provider, revision: 1 }) });
    assert.throws(() => browserService.createEvent({ eventId: "synthetic-premium", content: snapshot() }),
        error => error.code === "PREMIUM_AUTHORIZATION_DENIED");
    assert.equal(browserWrites, 0);
    console.log("editorial premium authorization tests passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
