(function (root, factory) {
    const node = typeof module === "object" && module.exports;
    const api = factory(node ? require("./admin-event-create-builder") : root.AdminEventCreateBuilder);
    if (node) module.exports = api;
    root.AdminEventCreate = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Builder) {
    const IDS = { title: "createTitle", eventId: "createEventId", eventType: "createType",
        templateSlug: "createTemplate", plan: "createPlan", date: "createDate", address: "createAddress" };
    const TYPE_LABELS = { wedding: "Boda", "wedding-civil": "Boda civil", birthday: "Cumpleaños", other: "Otro", corporate: "Corporativo" };
    const PLAN_LABELS = { esencial: "Esencial", premium: "Premium", "experiencia-ia": "Experiencia IA" };
    function createView({ document, onSubmit, onCancel, onCheck, onOpen }) {
        const el = id => document.getElementById(id);
        const fields = Object.fromEntries(Object.entries(IDS).map(([key, id]) => [key, el(id)]));
        let manualId = false;
        let locked = false;
        let sending = false;
        function options(select, values, placeholder) {
            const selected = select.value;
            select.replaceChildren();
            for (const value of [{ value: "", label: placeholder }, ...values]) {
                const option = document.createElement("option");
                option.value = value.value; option.textContent = value.label; select.append(option);
            }
            select.value = values.some(value => value.value === selected) ? selected : "";
        }
        function templates() {
            options(fields.templateSlug, Builder.templatesFor(fields.eventType.value)
                .map(template => ({ value: template.slug, label: template.name })), "Seleccionar plantilla");
        }
        fields.title.addEventListener("input", () => {
            if (!manualId) fields.eventId.value = Builder.suggestId(fields.title.value);
        });
        fields.eventId.addEventListener("input", () => { manualId = true; });
        fields.eventType.addEventListener("change", templates);
        el("eventCreateForm").addEventListener("submit", event => {
            event.preventDefault();
            if (!locked) onSubmit(read());
        });
        el("createCancel").addEventListener("click", () => { if (!sending) onCancel(); });
        el("createCheck").addEventListener("click", onCheck);
        el("createOpen").addEventListener("click", onOpen);
        function read() { return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value])); }
        function update({ message = "", pending = false, blocked = false, check = false, open = false } = {}) {
            locked = pending || blocked;
            sending = pending;
            Object.values(fields).forEach(field => { field.disabled = pending; });
            el("createSubmit").disabled = locked;
            el("createCancel").disabled = pending;
            el("createCheck").hidden = !check; el("createCheck").disabled = pending;
            el("createOpen").hidden = !open; el("createOpen").disabled = pending;
            el("createStatus").textContent = message;
        }
        function clearErrors() { Object.values(fields).forEach(field => field.removeAttribute("aria-invalid")); }
        function showErrors(errors) {
            clearErrors();
            Object.keys(errors).forEach(key => fields[key]?.setAttribute("aria-invalid", "true"));
            update({ message: Object.values(errors).join(" ") });
            fields[Object.keys(errors)[0]]?.focus();
        }
        function reset() {
            Object.values(fields).forEach(field => { field.value = ""; }); manualId = false;
            options(fields.eventType, Builder.types().map(type => ({ value: type, label: TYPE_LABELS[type] || type })), "Seleccionar tipo");
            options(fields.plan, Builder.plans().map(plan => ({ value: plan.slug, label: PLAN_LABELS[plan.slug] || plan.slug })), "Seleccionar plan");
            templates(); clearErrors(); update();
        }
        reset();
        return { read, update, reset, showErrors, clearErrors, focus: () => fields.title.focus() };
    }
    return { createView };
});
