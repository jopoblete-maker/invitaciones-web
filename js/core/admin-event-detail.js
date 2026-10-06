(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.AdminEventDetail = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const workflowLabel = (status) => ({ draft: "Borrador", in_review: "En revisión", approved: "Aprobado",
        changes_requested: "Cambios solicitados", archived: "Archivado" }[status] || "Workflow no disponible");
    function buildViewModel({ state, summary, action, actionDisabled = false, contentMessage = "" }) {
        const working = state.versions.find((version) => version.versionId === state.currentWorkingVersionId);
        return {
            eventId: state.eventId,
            title: summary.title, type: summary.type, dateLabel: summary.dateLabel, template: summary.template,
            sourceLabel: summary.source === "working" ? "Datos de trabajo" : summary.source === "published" ? "Datos publicados" : "Sin snapshot descriptivo",
            eventStatus: state.eventStatus === "active" ? "Activo" : state.eventStatus === "archived" ? "Archivado" : "Estado no disponible",
            workflow: state.currentWorkingVersionId ? workflowLabel(working?.workflowStatus) : "Sin versión de trabajo",
            publication: state.publishedVersionId ? "Publicado: hay una versión publicada vigente" : "Sin publicación",
            contentMessage,
            action: action ? { eventId: action.eventId, versionId: action.versionId, versionNumber: action.versionNumber,
                kind: action.kind, expectedStatus: action.expectedStatus, targetStatus: action.targetStatus,
                label: action.kind === "submit" ? "Enviar a revisión" : action.label } : null,
            actionDisabled,
            versions: state.versions.map((version) => {
                const published = version.versionId === state.publishedVersionId;
                const current = version.versionId === state.currentWorkingVersionId;
                return { number: version.versionNumber, id: version.versionId, workflow: workflowLabel(version.workflowStatus),
                    createdAt: version.createdAt, publishedAt: version.publishedAt,
                    badges: [published && "PUBLICADA VIGENTE", current && "EN TRABAJO", !published && !current && "HISTÓRICA",
                        version.publishedAt && !published && "PUBLICADA ANTERIORMENTE"].filter(Boolean) };
            })
        };
    }
    function createDetail({ document, onAction }) {
        const element = (tag, text, className) => {
            const node = document.createElement(tag);
            if (text !== undefined) node.textContent = String(text);
            if (className) node.className = className;
            return node;
        };
        const date = (value) => {
            if (!value) return "No disponible";
            const parsed = new Date(value);
            return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("es-AR") : "No disponible";
        };
        function render(model) {
            const header = document.getElementById("eventDetailSummary");
            const badges = element("div", undefined, "event-detail-badges");
            badges.append(element("span", model.eventStatus, "event-detail-badge"), element("span", model.workflow, "event-detail-badge"));
            header.replaceChildren(element("h2", model.title), element("p", `${model.type} · ${model.dateLabel}`, "event-detail-subtitle"), badges,
                element("p", `Template: ${model.template}`, "event-detail-meta"), element("p", `ID: ${model.eventId}`, "event-detail-meta"),
                element("p", model.sourceLabel, "event-detail-source"));
            const versions = document.getElementById("eventDetailVersions");
            versions.replaceChildren();
            model.versions.forEach((version) => {
                const item = element("li", undefined, "editorial-version");
                const roles = element("div", undefined, "event-detail-badges");
                version.badges.forEach((badge) => roles.append(element("span", badge, "event-detail-badge")));
                item.append(element("h3", `Versión ${version.number}`), roles,
                    element("p", `Workflow: ${version.workflow}`), element("p", `Creada: ${date(version.createdAt)}`));
                if (version.publishedAt) item.append(element("p", `Publicada: ${date(version.publishedAt)}`));
                const technical = element("details");
                technical.append(element("summary", "Datos técnicos"), element("p", `UUID: ${version.id}`));
                item.append(technical); versions.append(item);
            });
            if (!model.versions.length) versions.append(element("li", "El evento no tiene versiones."));
            const workflow = document.getElementById("eventDetailWorkflow");
            workflow.replaceChildren(element("p", `Trabajo: ${model.workflow}`), element("p", model.publication));
            if (model.action) {
                const button = element("button", model.action.label, "btn-submit editorial-workflow-action");
                button.type = "button";
                button.disabled = model.actionDisabled;
                button.addEventListener("click", () => onAction(model.action, button));
                workflow.append(button);
            } else workflow.append(element("p", "No hay una transición editorial disponible para este estado.", "event-detail-meta"));
            document.getElementById("eventDetailContentStatus").textContent = model.contentMessage;
        }
        return { render, clear() {
            ["eventDetailSummary", "eventDetailVersions", "eventDetailWorkflow"].forEach((id) => document.getElementById(id).replaceChildren());
            document.getElementById("eventDetailContentStatus").textContent = "";
        } };
    }
    return { buildViewModel, createDetail, workflowLabel };
});
