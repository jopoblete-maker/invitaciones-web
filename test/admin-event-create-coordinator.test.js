"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Summary = require("../js/core/admin-event-summary");
const Dashboard = require("../js/core/admin-dashboard");
const Workflow = require("../js/core/admin-editorial-workflow");
const Editor = require("../js/core/admin-event-editor");
const EditorialClient = require("../js/core/admin-editorial-client");
const Detail = require("../js/core/admin-event-detail");
const source = fs.readFileSync(path.join(__dirname, "..", "js", "admin.js"), "utf8");
function element(tag) {
    return { tag, id: tag, dataset: {}, value: "", textContent: "", children: [], listeners: {}, hidden: false, disabled: false,
        attributes: {}, classList: { add() {}, remove() {} }, append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; }, addEventListener(type, listener) { this.listeners[type] = listener; },
        setAttribute(name, value) { this.attributes[name] = value; if (name === "hidden") this.hidden = true; }, removeAttribute(name) { delete this.attributes[name]; }, focus(options) { this.focusOptions = options; }, reset() {} };
}
function harness(client) {
    const elements = new Map();
    let ready;
    const document = { addEventListener(_type, listener) { ready = listener; }, createElement: element,
        getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); }, querySelectorAll() { return []; } };
    const opened = [];
    const context = vm.createContext({ document, console, URL, Object,
        Option: function (label, value) { return { textContent: label, value }; },
        AdminEventSummary: Summary, AdminDashboard: Dashboard, AdminEventDetail: Detail, AdminEditorialWorkflow: Workflow, AdminEventEditor: Editor,
        AdminEventCreate: require("../js/core/admin-event-create"), AdminEventCreateBuilder: require("../js/core/admin-event-create-builder"),
        AdminEditorialClient: { ...EditorialClient, createAdminEditorialClient: () => client },
        window: { location: { origin: "http://synthetic.local" }, open(...args) { opened.push(args); }, confirm() { return true; } } });
    vm.runInContext(source, context);
    ready();
    function login() {
        document.getElementById("loginPassword").value = "synthetic-memory-credential";
        document.getElementById("authForm").listeners.submit({ preventDefault() {} });
    }
    login();
    return { context, document, opened, login, read: (expression) => vm.runInContext(expression, context) };
}
const Builder = require('../js/core/admin-event-create-builder');
const Plans = require('../js/core/plan-registry');
const input = {eventId:'synthetic-new', title:'Cumpleaños de José',eventType:'birthday',templateSlug:'cumple-clasico',plan:'esencial',date:'2028-02-29',address:''};
const snapshot = Builder.build(input).content;
const state = {eventId:input.eventId,eventStatus:'active',currentWorkingVersionId:'work',publishedVersionId:null,
    versions:[{versionId:'work',versionNumber:1,workflowStatus:'draft'}]};
function setup(overrides={}) {
    let posts=0;
    const client={
        async createEvent(){posts++;return {eventId:input.eventId,versionId:'work',versionNumber:1,workflowStatus:'draft'};},
        async getEditorialState(){return state;},
        async getVersion(){return {eventId:input.eventId,versionId:'work',workflowStatus:'draft',versionNumber:1,content:snapshot};},
        async listEvents(){return {events:[],nextCursor:null};},
        async createVersion(){throw new Error('Must not create a second version');},
        async publishVersion(){throw new Error('Must not publish');},
        async transitionWorkflow(){throw new Error('Must not advance workflow');},
        ...overrides
    };
    const h=harness(client);
    h.document.activeElement=h.document.getElementById('newEventButton');
    h.document.getElementById('newEventButton').listeners.click();
    return {...h,posts:()=>posts, submit:()=>h.context.submitNewEvent(input)};
}
const coded=(status,code)=>Object.assign(new Error('sensitive remote error'),{status,code});
(async()=>{
    const h=setup();
    const el=id=>h.document.getElementById(id);
    assert.equal(el('createPlan').value,'');
    assert.deepStrictEqual(el('createPlan').children.slice(1).map(option=>option.value),Plans.list().map(plan=>plan.slug));
    assert.deepStrictEqual(el('createPlan').children.map(option=>option.textContent),
        ['Seleccionar plan', 'Esencial', 'Premium', 'Experiencia IA']);
    for (const option of el('createPlan').children.slice(1)) {
        el('createPlan').value = option.value;
        assert.equal(h.read('adminEventCreate.read().plan'), option.value);
        assert.equal(Builder.build({...input, plan: option.value}).content.plan, option.value);
    }
    el('createPlan').value = '';
    assert(!el('createType').children.some(option=>option.value==='corporate'));
    el('createTitle').value='Cumpleaños de José';el('createTitle').listeners.input();
    assert.equal(el('createEventId').value,'cumpleanos-de-jose');
    el('createEventId').value='manual';el('createEventId').listeners.input();
    el('createTitle').value='Otro título';el('createTitle').listeners.input();assert.equal(el('createEventId').value,'manual');
    el('createType').value='wedding';el('createType').listeners.change();
    el('createTemplate').value='boda-vertical';el('createType').value='wedding-civil';el('createType').listeners.change();
    assert.equal(el('createTemplate').value,'boda-vertical');
    el('createType').value='birthday';el('createType').listeners.change();assert.equal(el('createTemplate').value,'');
    await h.context.submitNewEvent({...input,plan:''});assert.equal(h.posts(),0);
    assert.equal(el('createPlan').attributes['aria-invalid'],'true');
    assert(!el('createStatus').textContent.includes('sensitive'));
    h.read('dashboardNextCursor = "opaque-cursor"');
    await h.submit();assert.equal(h.posts(),1);
    assert.equal(h.read('dashboardEvents.length'),1);
    assert.equal(h.read('dashboardEvents[0].summary.title'),input.title);
    assert.equal(h.read('dashboardNextCursor'),'opaque-cursor');
    assert.equal(el('editorialDetail').hidden,false);
    await h.context.returnToDashboard();
    assert.equal(el('newEventButton').focusOptions.preventScroll,true);
    const filtered=setup();filtered.document.getElementById('dashboardStatusFilter').value='archived';
    await filtered.submit();assert.equal(filtered.read('dashboardEvents.length'),0);
    assert.equal(filtered.document.getElementById('editorialDetail').hidden,false);
    for (const [status,code] of [[409,'EVENT_ALREADY_EXISTS'],[422,'INVALID_EVENT'],[429,'RATE_LIMITED'],[503,'RATE_LIMIT_UNAVAILABLE']]) {
        const failed=setup({async createEvent(){throw coded(status,code);}});
        await failed.submit();assert.equal(failed.read('createPending'),false);
        assert(!failed.document.getElementById('createStatus').textContent.includes('sensitive'));
        assert.equal(failed.document.getElementById('createSubmit').disabled,false);
        if(status===409){
            assert.equal(failed.document.getElementById('createOpen').hidden,true);
            await failed.context.checkNewEvent();
            assert.equal(failed.document.getElementById('createOpen').hidden,false);
            assert.equal(failed.document.getElementById('createStatus').textContent,'Se encontró un evento con este ID.');
        }
    }
    for (const status of [401,403]) {
        const auth=setup({async createEvent(){throw coded(status,'ACCESS');}});
        await auth.submit();assert.equal(auth.read('administrativePassword'),'');
        assert.equal(auth.document.getElementById('adminForm').hidden,true);
    }
    for (const code of ['TIMEOUT','NETWORK_ERROR','INVALID_RESPONSE']) {
        const uncertain=setup({async createEvent(){throw coded(undefined,code);}});
        await uncertain.submit();assert.equal(uncertain.read('createRecovery'),'uncertain');
        assert.equal(uncertain.document.getElementById('createSubmit').disabled,true);
        await uncertain.context.checkNewEvent();assert.equal(uncertain.read('createRecovery'),'found');
        uncertain.document.getElementById('createCancel').listeners.click();
        assert.equal(uncertain.read('createAttempt'),null);assert.equal(uncertain.document.getElementById('adminDashboard').hidden,false);
    }
    let reads=0;
    const notFound=setup({async createEvent(){throw coded(undefined,'TIMEOUT');},async getEditorialState(){reads++;throw coded(404,'EVENT_NOT_FOUND');}});
    await notFound.submit();await notFound.context.checkNewEvent();
    assert.equal(reads,1);assert.equal(notFound.read('createRecovery'),'retry');assert.equal(notFound.document.getElementById('createSubmit').disabled,false);
    const offline=setup({async createEvent(){throw coded(undefined,'NETWORK_ERROR');},async getEditorialState(){throw coded(500,'SERVER_ERROR');}});
    await offline.submit();await offline.context.checkNewEvent();assert.equal(offline.read('createRecovery'),'uncertain');
    const postRead=setup({async getEditorialState(){throw coded(500,'SERVER_ERROR');}});
    await postRead.submit();assert.equal(postRead.posts(),1);
    assert.equal(postRead.document.getElementById('createStatus').textContent,'Evento creado; no se pudo cargar el detalle.');
    await postRead.submit();assert.equal(postRead.posts(),1);
    let resolve;
    const wait=new Promise(done=>{resolve=done;});
    let count=0;
    const delayed=setup({async createEvent(){count++;await wait;return {};} });
    const running=delayed.submit();await delayed.submit();assert.equal(count,1);
    assert.equal(delayed.document.getElementById('createSubmit').disabled,true);
    delayed.context.resetForAuthentication('');delayed.login();
    resolve();await running;
    assert.equal(delayed.read('dashboardEvents.length'),0);assert.equal(delayed.read('createAttempt'),null);
    assert.equal(delayed.document.getElementById('editorialDetail').hidden,true);
    console.log('event creation view and coordinator tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
