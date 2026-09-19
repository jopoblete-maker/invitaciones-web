(function (root, factory) {
    const rsvp = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = rsvp;
    }

    root.Rsvp = rsvp;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function render(event, dependencies) {
        return `
        <section class="invitation-section">
            ${renderContent(event, dependencies)}
        </section>
    `;
    }

    function renderContent(event, dependencies) {
        const { normalizePhone, escapeHtml, whatsappIcon } = dependencies;
        const contacts = event.contactosRSVP
            .map((contact) => ({ ...contact, telefono: normalizePhone(contact.telefono) }))
            .filter((contact) => contact.telefono);
        if (!contacts.length) return "";

        const buttons = contacts
            .map((contact) => {
                const label = contact.nombre ? `Confirmar con ${escapeHtml(contact.nombre)}` : "Confirmar asistencia";
                return `
                <a class="button rsvp-button" href="https://wa.me/${contact.telefono}" data-phone="${contact.telefono}" target="_blank" rel="noopener noreferrer">
                    ${whatsappIcon}
                    ${label}
                </a>
            `;
            })
            .join("");

        return `
        <div class="rsvp-block">
            ${event.confirmacionLimite ? `<p class="detail-value">Hasta el ${escapeHtml(event.confirmacionLimite)}</p>` : ""}
            <div class="actions">${buttons}</div>
        </div>
    `;
    }

    function setupConfirmation() {
        document.querySelectorAll(".rsvp-button").forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                const text = "Confirmo mi asistencia al evento.";
                const url = `https://wa.me/${button.dataset.phone}?text=${encodeURIComponent(text)}`;
                window.open(url, "_blank", "noopener,noreferrer");
            });
        });
    }

    return {
        render,
        renderContent,
        setupConfirmation
    };
});
