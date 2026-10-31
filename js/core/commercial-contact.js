(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.CommercialContact = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    const CONTACT = Object.freeze({ phone: "5491157339281", displayPhone: "+54 9 11 5733-9281" });
    function request(message, selectionLabel, templateSlug = null) {
        return Object.freeze({ ...CONTACT, message, selectionLabel, templateSlug,
            href: `https://wa.me/${CONTACT.phone}?text=${encodeURIComponent(message)}` });
    }
    function generalRequest() {
        return request("Hola, equipo YCOR. Quiero solicitar una invitación digital para mi evento. Me gustaría conocer las plantillas y cómo continuar.", "Consulta sobre invitaciones digitales");
    }
    function templateRequest(slug, registry) {
        if (typeof slug !== "string") throw new TypeError("Plantilla no disponible.");
        const template = registry?.getTemplate?.(slug);
        const catalog = template?.catalog;
        if (!template || template.slug !== slug || template.status !== "active" || !catalog
            || typeof catalog.variant?.name !== "string" || !catalog.variant.name.trim()) {
            throw new TypeError("Plantilla no disponible.");
        }
        const name = catalog.displayName || template.name;
        if (typeof name !== "string" || !name.trim()) throw new TypeError("Plantilla no disponible.");
        const label = `${name} · ${catalog.variant.name}`;
        return request(`Hola, equipo YCOR. Quiero solicitar una invitación digital utilizando la plantilla ${name}, variante ${catalog.variant.name}, para mi evento. Me gustaría conocer cómo continuar. Referencia: ${template.slug}.`, label, template.slug);
    }
    function sampleRequest(id, manifest) {
        const sample = typeof id === "string" ? manifest?.getSample?.(id) : null;
        if (!sample || sample.id !== id || id !== "muestra-" + sample.number
            || !/^(0[1-9]|10|12|13|14|17|18|19|20|21|22|23|24|25)$/.test(sample.number)
            || typeof sample.name !== "string" || !sample.name.trim()) throw new TypeError("Muestra no disponible.");
        const label = "Invitación " + sample.number + " — " + sample.name;
        return Object.freeze({ ...request("Hola, equipo YCOR. Quiero solicitar la invitación " + sample.number + " — " + sample.name
            + ". Referencia: " + sample.id + ". Me gustaría conocer cómo continuar.", label),
            sampleId: sample.id, actionLabel: "Solicitar esta invitación" });
    }
    return Object.freeze({ CONTACT, generalRequest, templateRequest, sampleRequest });
});
