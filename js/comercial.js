(function (root, factory) {
    const api = factory(typeof module === "object" && module.exports ? require("./core/commercial-contact") : root.CommercialContact);
    if (typeof module === "object" && module.exports) module.exports = api;
    root.CommercialUI = api;
    if (root.document) root.document.addEventListener("DOMContentLoaded", () => api.init(root.document));
})(typeof globalThis !== "undefined" ? globalThis : this, function (Contact) {
    "use strict";
    let sequence = 0;
    function element(document, tag, className, text) {
        const node = document.createElement(tag);
        node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function createRequestActions(document, request) {
        const root = element(document, "div", "commercial-actions");
        const link = element(document, "a", "commercial-button", request.templateSlug ? "Solicitar esta plantilla" : "Consultar por WhatsApp");
        link.href = request.href; link.target = "_blank"; link.rel = "noopener noreferrer";
        const status = element(document, "p", "commercial-copy-status");
        status.setAttribute("role", "status");
        link.addEventListener("click", () => {
            status.textContent = `Solicitud preparada: ${request.selectionLabel}. Se abre WhatsApp; el envío lo confirmás vos.`;
            const selection = document.getElementById("catalogSelection");
            if (selection) selection.textContent = `Plantilla seleccionada: ${request.selectionLabel}.`;
        });
        const details = element(document, "details", "commercial-fallback");
        details.append(element(document, "summary", "", "¿No podés abrir WhatsApp?"));
        const id = `commercial-request-${++sequence}`;
        const label = element(document, "label", "commercial-field-label", "Número comercial");
        label.htmlFor = id + "-phone";
        const phone = element(document, "input", "commercial-field");
        phone.id = label.htmlFor; phone.type = "text"; phone.readOnly = true; phone.value = request.displayPhone;
        const messageLabel = element(document, "label", "commercial-field-label", "Mensaje preparado");
        messageLabel.htmlFor = id + "-message";
        const message = element(document, "textarea", "commercial-field");
        message.id = messageLabel.htmlFor; message.readOnly = true; message.rows = 5; message.value = request.message;
        function copyButton(text, value, field, copied) {
            const button = element(document, "button", "commercial-copy", text);
            button.type = "button";
            button.addEventListener("click", async () => {
                try {
                    const clipboard = document.defaultView?.navigator?.clipboard;
                    if (!clipboard || typeof clipboard.writeText !== "function") throw new Error();
                    await clipboard.writeText(value);
                    status.textContent = copied;
                } catch (_) {
                    field.focus(); field.select();
                    status.textContent = "El texto quedó seleccionado. Copialo con el menú de tu dispositivo o con Ctrl+C.";
                }
            });
            return button;
        }
        details.append(label, phone, copyButton("Copiar número", request.phone, phone, "Número copiado."),
            messageLabel, message, copyButton("Copiar mensaje", request.message, message, "Mensaje copiado."));
        root.append(link, details, status);
        return root;
    }
    function init(document) {
        const request = Contact.generalRequest();
        document.querySelectorAll("[data-commercial-link]").forEach(link => {
            link.href = request.href; link.target = "_blank"; link.rel = "noopener noreferrer";
        });
        document.querySelectorAll("[data-commercial-general]").forEach(root => {
            root.replaceChildren(createRequestActions(document, request));
        });
    }
    return { createRequestActions, init };
});
