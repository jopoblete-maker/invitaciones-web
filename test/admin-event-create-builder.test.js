const assert = require('node:assert/strict');
const Builder = require('../js/core/admin-event-create-builder');
const Plans = require('../js/core/plan-registry');
const Templates = require('../js/core/template-registry');
const Validator = require('../js/core/event-validator');
const input = { eventId: 'synthetic-new-event', title: 'Cumpleaños de José', eventType: 'birthday',
    templateSlug: 'cumple-clasico', plan: 'esencial', date: '2028-02-29', address: '' };
assert.equal(Builder.suggestId(input.title), 'cumpleanos-de-jose');
assert.equal(Builder.suggestId('  ¡Niña & JOÃO!  '), 'nina-joao');
assert.equal(Builder.suggestId('🌸 !!!'), '');
assert.equal(Builder.suggestId(''), '');
assert.deepEqual(Builder.plans(), Plans.list());
assert(!Builder.types().includes('corporate'));
for (const type of Builder.types()) {
    for (const template of Builder.templatesFor(type)) {
        for (const plan of Plans.list()) {
            const built = Builder.build({ ...input, eventType: type, templateSlug: template.slug, plan: plan.slug });
            assert.equal(built.valid, true);
            assert.equal(Validator.validateEventForPersistence(built.content).valid, true);
            assert.equal(built.content.plan, plan.slug);
            assert.equal(built.content.status, 'draft');
            assert.deepEqual(built.content.modules, {}); assert.deepEqual(built.content.media, {});
            assert.equal(built.content.identity.title, built.content.sections[0].data.title);
            for (const absent of ['location', 'theme', 'metadata', 'rsvp', 'closing']) assert(!(absent in built.content));
            assert.deepEqual(built.content.schedule, {date: input.date});
        }
    }
}
for (const [key, value] of [['plan',''], ['plan','unknown'], ['title',''], ['eventId','Bad ID'],
    ['eventType','corporate'], ['templateSlug','boda-vertical'], ['date','2027-02-29'], ['date','2026-13-01'], ['date','']]) {
    const result = Builder.build({...input,[key]:value});
    assert.equal(result.valid,false); assert(result.errors[key]);
}
const withLocation = Builder.build({...input,address:'  Calle 1  '}).content;
assert.deepEqual(withLocation.location, {address:'Calle 1'});
assert.deepEqual(withLocation.sections[1], {id:'location',type:'location',enabled:true,order:20,
    data:{address:'Calle 1'},config:{show_maps:false,show_calendar:false}});
assert.equal(Builder.templatesFor('birthday')[0].slug, Templates.getTemplate('cumple-clasico').slug);
assert.equal(input.address,'');
// Exercise the actual browser dependency order without Node's require fallback.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../admin.html'), 'utf8');
const browser = vm.createContext({ URL, Intl });
for (const match of html.matchAll(/<script src="(js\/core\/[^\"]+)"/g)) {
    vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',match[1]),'utf8'), browser);
}
assert.equal(browser.AdminEventCreateBuilder.build(input).valid,true);
for (const id of ['createTitle','createEventId','createType','createTemplate','createPlan','createDate']) {
    assert(html.includes(`for="${id}"`));
    assert(new RegExp(`<(?:input|select)[^>]*id="${id}"[^>]*required`).test(html));
}
assert(html.includes('id="createStatus" role="status" aria-live="polite"'));
const creationMarkup = html.slice(html.indexOf('<section id="adminEventCreate"'), html.indexOf('<section id="editorialDetail"'));
for (const text of ['Título *', 'Datos básicos', 'Fecha y ubicación', 'Dirección (opcional)',
    'Inicia una invitación en borrador. No se publicará automáticamente.',
    'Minúsculas, números y guiones. Podrás editar la sugerencia antes de crear.']) {
    assert(creationMarkup.includes(text), `Missing UTF-8 text: ${text}`);
}
assert(!creationMarkup.includes('?'));
assert(!creationMarkup.includes('\uFFFD'));
console.log('event creation builder tests passed');
