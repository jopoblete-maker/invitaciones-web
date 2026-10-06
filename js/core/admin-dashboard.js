(function (root, factory) {
    const api = factory(typeof module === "object" && module.exports
        ? require("./admin-event-summary") : root.AdminEventSummary);
    if (typeof module === "object" && module.exports) module.exports = api;
    root.AdminDashboard = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Summary) {
    const WORKFLOW = { draft: "En borrador", in_review: "En revisión", approved: "Aprobado", published: "Publicado" };
    const workflow = (event) => event.currentWorkingVersionId
        ? event.workingVersion?.workflowStatus || "unknown" : "none";
    function mergeEvents(previous, incoming) {
        const map = new Map(previous.map((event) => [event.eventId, event]));
        incoming.forEach((event) => map.set(event.eventId, event));
        return [...map.values()];
    }
    function metrics(events, now) {
        const active = events.filter((event) => event.eventStatus === "active");
        return {
            active: active.length,
            draft: active.filter((event) => workflow(event) === "draft").length,
            review: active.filter((event) => workflow(event) === "in_review").length,
            published: active.filter((event) => Boolean(event.publishedVersionId)).length,
            upcoming: active.filter((event) => Summary.isUpcoming(event.summary, now)).length
        };
    }
    function filterEvents(events, filters = {}) {
        const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const query = normalize(filters.text).trim();
        return events.filter((event) => (!filters.status || event.eventStatus === filters.status)
            && (!filters.workflow || workflow(event) === filters.workflow)
            && normalize([event.eventId, event.summary?.title, event.summary?.type, event.summary?.template].join(" ")).includes(query));
    }
    function canPreview(event) {
        return event.eventStatus === "active" && Boolean(event.currentWorkingVersionId || event.publishedVersionId);
    }
    function createDashboard({ document, onManage, onPreview, onLoadMore }) {
        let state = { events: [], nextCursor: null, loading: false, message: "Carga los eventos para comenzar." };
        const filters = { text: "", status: "", workflow: "" };
        const element = (tag, copy, className) => {
            const node = document.createElement(tag);
            if (copy !== undefined) node.textContent = String(copy);
            if (className) node.className = className;
            return node;
        };
        function render() {
            const totals = metrics(state.events);
            const cards = document.getElementById("dashboardMetrics");
            cards.replaceChildren();
            [["active", "Eventos activos"], ["draft", "En borrador"], ["review", "En revisión"],
                ["published", "Publicados"], ["upcoming", "Próximos eventos"]].forEach(([key, label]) => {
                const card = element("div", undefined, "dashboard-metric");
                card.append(element("span", label), element("strong", totals[key]));
                cards.append(card);
            });
            const rows = document.getElementById("dashboardRows");
            rows.replaceChildren();
            const visible = filterEvents(state.events, filters);
            visible.forEach((event) => {
                const summary = event.summary || Summary.project();
                const row = element("tr");
                const name = element("td");
                name.append(element("strong", summary.title), element("small", event.eventId));
                name.append(element("small", summary.source === "working" ? "Datos de trabajo"
                    : summary.source === "published" ? "Datos publicados" : "Sin snapshot descriptivo"));
                const type = element("td");
                type.append(element("span", summary.type), element("small", summary.template));
                const versions = element("td");
                const number = (metadata, pointer) => metadata?.versionNumber ? `v${metadata.versionNumber}` : pointer ? "Asignada" : "—";
                versions.append(element("span", `Trabajo: ${number(event.workingVersion, event.currentWorkingVersionId)}`),
                    element("small", `Publicada: ${number(event.publishedVersion, event.publishedVersionId)}`));
                const actions = element("td", undefined, "dashboard-actions");
                const manage = element("button", "Gestionar");
                manage.type = "button";
                manage.addEventListener("click", () => onManage(event.eventId));
                const preview = element("button", "Vista previa");
                preview.type = "button";
                preview.disabled = state.loading || !canPreview(event);
                preview.title = canPreview(event) ? "Solicitar vista previa temporal" : "Vista previa no disponible: evento archivado o sin versión";
                preview.addEventListener("click", () => onPreview(event.eventId));
                actions.append(manage, preview);
                if (!canPreview(event)) actions.append(element("small", "Vista previa no disponible"));
                row.append(name, type, element("td", summary.dateLabel),
                    element("td", event.eventStatus === "active" ? "Activo" : event.eventStatus === "archived" ? "Archivado" : "Estado no disponible"),
                    element("td", WORKFLOW[workflow(event)] || (workflow(event) === "none" ? "Sin working" : "Workflow no disponible")), versions, actions);
                rows.append(row);
            });
            if (!visible.length) {
                const cell = element("td", state.loading ? "Cargando eventos…" : "No hay eventos para mostrar con estos filtros.");
                cell.colSpan = 7;
                const row = element("tr"); row.append(cell); rows.append(row);
            }
            document.getElementById("dashboardCount").textContent = `${visible.length} visibles · ${state.events.length} cargados`;
            document.getElementById("dashboardStatus").textContent = state.message;
            const more = document.getElementById("dashboardLoadMore");
            more.hidden = !state.nextCursor;
            more.disabled = state.loading;
            document.getElementById("loadEditorialEvents").disabled = state.loading;
        }
        [["dashboardSearch", "text", "input"], ["dashboardStatusFilter", "status", "change"],
            ["dashboardWorkflowFilter", "workflow", "change"]].forEach(([id, key, type]) => {
            document.getElementById(id).addEventListener(type, (event) => { filters[key] = event.target.value; render(); });
        });
        document.getElementById("dashboardLoadMore").addEventListener("click", () => {
            if (!state.loading && state.nextCursor) onLoadMore();
        });
        return {
            update(next) { state = { ...state, ...next }; render(); },
            reset() {
                Object.keys(filters).forEach((key) => { filters[key] = ""; });
                ["dashboardSearch", "dashboardStatusFilter", "dashboardWorkflowFilter"].forEach((id) => { document.getElementById(id).value = ""; });
                state = { events: [], nextCursor: null, loading: false, message: "Carga los eventos para comenzar." }; render();
            }
        };
    }
    return { mergeEvents, metrics, filterEvents, workflow, canPreview, createDashboard };
});
