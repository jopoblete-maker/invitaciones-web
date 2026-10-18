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
    return Object.freeze({ CONTACT, generalRequest, templateRequest });
});
