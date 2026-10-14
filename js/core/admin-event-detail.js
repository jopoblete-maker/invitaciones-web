(function (root, factory) {
    const api = factory(typeof module === "object" && module.exports ? require("./template-registry") : root.TemplateRegistry);
    if (typeof module === "object" && module.exports) module.exports = api;
    root.AdminEventDetail = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Templates) {
    // Presentation only: these facts never grant access or enable controls.
    function capabilities({ state, summary, action, actionDisabled, snapshotFacts, editorModel }) {
        const sourceId = summary.source === "working" ? state.currentWorkingVersionId
            : summary.source === "published" ? state.publishedVersionId : null;
        const verified = Boolean(sourceId && snapshotFacts?.eventId === state.eventId
            && snapshotFacts.versionId === sourceId && state.versions.some(v => v.versionId === sourceId));
        const template = verified ? Templates?.getTemplate(snapshotFacts.templateSlug) : null;
        const premium = verified && (snapshotFacts.premium === true || template?.slug === "boda-fiesta-premium");
        const known = Boolean(verified && template);
        const working = state.versions.find(v => v.versionId === state.currentWorkingVersionId);
        const editorReady = known && snapshotFacts.schemaVersion === 2 && state.eventStatus === "active"
            && working?.workflowStatus === "draft" && editorModel?.eligible === true
            && editorModel.eventId === state.eventId && editorModel.versionId === state.currentWorkingVersionId
            && Object.values(editorModel.fields || {}).some(field => field.blocked === false);
        const requirement = premium ? "Requiere autorización premium del contenido exacto; no verificada en el panel."
            : !known ? "No verificada: falta un snapshot asociado o una plantilla registrada." : null;
        return [
            { label: "Estado e historial", status: "Disponible: consulta editorial existente." },
            { label: "Edición de textos", status: !known ? requirement : !editorReady
                ? "No disponible: requiere un borrador V2 vigente con campos editables."
                : requirement || "Disponible en el editor actual; el servidor revalida al guardar." },
            { label: "Transición editorial", status: state.eventStatus !== "active" || !action || action.eventId !== state.eventId
                || action.versionId !== state.currentWorkingVersionId || action.expectedStatus !== working?.workflowStatus
                ? "No disponible en el estado actual."
                : actionDisabled ? "Temporalmente bloqueada: recargar estado o finalizar la operación pendiente."
                    : requirement || `Disponible en el panel: ${action.label}. El servidor verifica las precondiciones.` },
            { label: "Vista previa temporal", status: state.eventStatus !== "active" || !sourceId
                ? "No disponible: evento inactivo o sin versión."
                : "No verificada: la solicitud existente requiere configuración del servidor y validación del contenido." },
            { label: "Biblioteca multimedia", status: "No implementada en el panel actual." },
            { label: "Gestión RSVP Managed", status: "No implementada en este panel; el backend existente no implica habilitación del evento." },
            { label: "Límites comerciales del plan", status: "No verificados: el registro de planes mantiene límites pendientes." }
        ];
    }
    const workflowLabel = (status) => ({ draft: "Borrador", in_review: "En revisión", approved: "Aprobado",
        changes_requested: "Cambios solicitados", archived: "Archivado" }[status] || "Workflow no disponible");
    function buildViewModel({ state, summary, action, actionDisabled = false, contentMessage = "", snapshotFacts, editorModel }) {
        const working = state.versions.find((version) => version.versionId === state.currentWorkingVersionId);
        return {
            eventId: state.eventId,
            title: summary.title, type: summary.type, dateLabel: summary.dateLabel, template: summary.template,
            sourceLabel: summary.source === "working" ? "Datos de trabajo" : summary.source === "published" ? "Datos publicados" : "Sin snapshot descriptivo",
            eventStatus: state.eventStatus === "active" ? "Activo" : state.eventStatus === "archived" ? "Archivado" : "Estado no disponible",
            workflow: state.currentWorkingVersionId ? workflowLabel(working?.workflowStatus) : "Sin versión de trabajo",
            publication: state.publishedVersionId ? "Publicado: hay una versión publicada vigente" : "Sin publicación",
            contentMessage,
            capabilities: capabilities({ state, summary, action, actionDisabled, snapshotFacts, editorModel }),
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
            const capabilityList = document.getElementById("eventDetailCapabilities");
            if (capabilityList) {
                capabilityList.replaceChildren();
                (model.capabilities || []).forEach(item => capabilityList.append(element("li", `${item.label}: ${item.status}`)));
            }
        }
        return { render, clear() {
            ["eventDetailSummary", "eventDetailVersions", "eventDetailWorkflow"].forEach((id) => document.getElementById(id).replaceChildren());
            document.getElementById("eventDetailContentStatus").textContent = "";
            document.getElementById("eventDetailCapabilities")?.replaceChildren();
        } };
    }
    return { buildViewModel, createDetail, workflowLabel };
});
