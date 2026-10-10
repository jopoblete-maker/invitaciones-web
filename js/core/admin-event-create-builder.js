(function (root, factory) {
    const node = typeof module === "object" && module.exports;
    const api = factory(node ? require("./event-schema") : root.EventSchema,
        node ? require("./template-registry") : root.TemplateRegistry,
        node ? require("./plan-registry") : root.PlanRegistry,
        node ? require("./event-validator") : root.EventValidator);
    if (node) module.exports = api;
    root.AdminEventCreateBuilder = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Schema, Templates, Plans, Validator) {
    const clean = value => typeof value === "string" ? value.trim() : "";
    function suggestId(title) {
        return clean(title).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }
    function templatesFor(type) {
        return Templates.listTemplates().filter(template => template.status === "active"
            && template.supportedEventTypes.includes(type));
    }
    function types() { return Schema.V2_EVENT_TYPES.filter(type => templatesFor(type).length); }
    function build(input = {}) {
        const values = Object.fromEntries(["eventId", "title", "eventType", "templateSlug", "plan", "date", "address"]
            .map(key => [key, clean(input[key])]));
        const errors = {};
        if (!values.title) errors.title = "Ingresa un título.";
        if (!Templates.isValidEventId(values.eventId)) errors.eventId = "Usa minúsculas, números y guiones entre palabras.";
        if (!types().includes(values.eventType)) errors.eventType = "Selecciona un tipo disponible.";
        if (!templatesFor(values.eventType).some(template => template.slug === values.templateSlug)) errors.templateSlug = "Selecciona una plantilla compatible.";
        if (!values.plan || !Plans.has(values.plan)) errors.plan = "Selecciona un plan.";
        const content = {
            schema_version: Schema.V2_SCHEMA_VERSION, id: values.eventId, event_type: values.eventType,
            plan: values.plan, status: "draft", template: { slug: values.templateSlug },
            identity: { title: values.title }, schedule: { date: values.date },
            sections: [{ id: "hero", type: "hero", enabled: true, order: 10,
                data: { title: values.title, dateText: values.date } }], modules: {}, media: {}
        };
        if (values.address) {
            content.location = { address: values.address };
            content.sections.push({ id: "location", type: "location", enabled: true, order: 20,
                data: { address: values.address }, config: { show_maps: false, show_calendar: false } });
        }
        const validation = Validator.validateEventForPersistence(content);
        if (validation.errors.some(error => error.includes("schedule.date"))) errors.date = "Ingresa una fecha válida (AAAA-MM-DD).";
        if (!validation.valid && !Object.keys(errors).length) errors.form = "Los datos no forman un evento válido.";
        return Object.keys(errors).length ? { valid: false, errors } : { valid: true, content };
    }
    return { suggestId, templatesFor, types, plans: () => Plans.list(), build };
});
