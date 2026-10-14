(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.AdminEventSummary = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const text = (value) => typeof value === "string" ? value.trim() : "";
    function validDate(value) {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
        const parsed = new Date(`${value}T00:00:00Z`);
        return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
    }
    function descriptive(content) {
        return content && [1, 2].includes(content.schema_version)
            && typeof content === "object" && !Array.isArray(content);
    }
    function project({ working, published } = {}) {
        const source = descriptive(working) ? "working" : descriptive(published) ? "published" : "none";
        const content = source === "working" ? working : source === "published" ? published : null;
        const v2 = content?.schema_version === 2;
        const date = validDate(v2 ? content?.schedule?.date : content?.event?.date);
        return {
            source,
            title: text(v2 ? content?.identity?.title : content?.event?.title) || "Sin título",
            type: text(v2 ? content?.event_type : content?.event?.type) || "Tipo no disponible",
            template: text(content?.template?.slug) || "Template no disponible",
            date,
            dateLabel: date ? date.split("-").reverse().join("/") : "Fecha no disponible",
            timezone: v2 ? text(content?.schedule?.timezone) : ""
        };
    }
    function isUpcoming(summary, now = new Date()) {
        if (!summary?.date) return false;
        let today;
        try {
            const parts = new Intl.DateTimeFormat("en-US", {
                timeZone: summary.timezone || "America/Argentina/Buenos_Aires",
                year: "numeric", month: "2-digit", day: "2-digit"
            }).formatToParts(now);
            const part = (type) => parts.find((entry) => entry.type === type).value;
            today = `${part("year")}-${part("month")}-${part("day")}`;
        } catch (_) { return false; }
        // A date-only snapshot does not assert a future time within today.
        return summary.date > today;
    }
    function stateKey(state) {
        return JSON.stringify([state.eventId, state.eventStatus, state.currentWorkingVersionId, state.publishedVersionId,
            (Array.isArray(state.versions) ? state.versions : []).map(v => [v.versionId, v.versionNumber, v.workflowStatus, v.publishedAt])]);
    }
    function describeSnapshot(state, version) {
        const matches = (Array.isArray(state.versions) ? state.versions : []).filter(v => v.versionId === version?.versionId);
        const content = version?.content;
        if (matches.length !== 1 || version.eventId !== state.eventId || content?.id !== state.eventId
            || version.versionNumber !== matches[0].versionNumber || version.workflowStatus !== matches[0].workflowStatus
            || ![state.currentWorkingVersionId, state.publishedVersionId].includes(version.versionId)) return null;
        return { eventId: state.eventId, versionId: version.versionId, stateKey: stateKey(state),
            schemaVersion: content.schema_version, templateSlug: content.template?.slug,
            premium: Array.isArray(content.sections) && content.sections.some(s => ["gallery", "dress-code", "gifts", "collaborative-album"].includes(s?.type)),
            sections: Array.isArray(content.sections) ? content.sections.map(s => ({ id: s?.id, type: s?.type, order: s?.order, enabled: s?.enabled })) : null };
    }
    function editorial({ state, summary, snapshotFacts, templateKnown = false, premiumTemplate = false }) {
        const unknown = "No verificado";
        const rows = Array.isArray(state.versions) ? state.versions : [];
        const find = id => {
            const matches = rows.filter(v => id && v.versionId === id);
            return matches.length === 1 && Number.isSafeInteger(matches[0].versionNumber)
                && matches[0].versionNumber > 0 && ["draft", "in_review", "approved"].includes(matches[0].workflowStatus) ? matches[0] : null;
        };
        const versionLabel = id => {
            if (id === null) return "Ninguna";
            const row = find(id);
            return row ? `Versión ${row.versionNumber} · ${row.versionId} · ${row.workflowStatus}` : unknown;
        };
        const selectedId = summary.source === "working" ? state.currentWorkingVersionId
            : summary.source === "published" ? state.publishedVersionId : null;
        const pointersConflict = Boolean(state.currentWorkingVersionId && state.currentWorkingVersionId === state.publishedVersionId);
        const verified = Boolean(selectedId && snapshotFacts?.eventId === state.eventId
            && snapshotFacts.versionId === selectedId && snapshotFacts.stateKey === stateKey(state) && find(selectedId)
            && [1, 2].includes(snapshotFacts.schemaVersion) && !pointersConflict);
        const candidateVerified = verified && selectedId === state.currentWorkingVersionId;
        const warnings = [];
        if (pointersConflict) warnings.push("No verificado: punteros de trabajo y publicación contradictorios.");
        if (!verified) warnings.push("No verificado: snapshot ausente, contradictorio o desactualizado.");
        if (!templateKnown || !verified) warnings.push("No verificado: plantilla del snapshot.");
        if (state.eventStatus !== "active") warnings.push("Evento inactivo o estado no verificado.");
        const sections = candidateVerified ? snapshotFacts.sections : null;
        const validSections = Array.isArray(sections) && sections.length > 0
            && sections.every(s => typeof s.id === "string" && s.id.trim() && typeof s.type === "string" && s.type.trim()
                && Number.isFinite(s.order) && typeof s.enabled === "boolean")
            && new Set(sections.map(s => s.id)).size === sections.length
            && new Set(sections.map(s => s.order)).size === sections.length;
        if (!validSections) warnings.push("No verificado: cantidad y orden de secciones de la candidata.");
        const working = find(state.currentWorkingVersionId), published = find(state.publishedVersionId);
        const publishedValid = Boolean(!pointersConflict && published && published.workflowStatus === "approved"
            && typeof published.publishedAt === "string" && Number.isFinite(Date.parse(published.publishedAt)));
        const publicationLabel = state.publishedVersionId === null ? "Ninguna" : publishedValid ? versionLabel(state.publishedVersionId) : unknown;
        if (state.currentWorkingVersionId !== null && !working) warnings.push("No verificado: puntero de trabajo.");
        if (state.publishedVersionId !== null && !publishedValid) warnings.push("No verificado: versión publicada.");
        if (working && working.workflowStatus !== "approved") warnings.push("La versión de trabajo todavía no está aprobada.");
        if (verified && (snapshotFacts.premium || premiumTemplate)) warnings.push("Requiere autorización del contenido exacto. No verificada desde este panel");
        const ordered = validSections ? [...sections].sort((a, b) => a.order - b.order) : [];
        return {
            event: typeof state.eventId === "string" && state.eventId ? state.eventId : unknown,
            template: verified && templateKnown ? snapshotFacts.templateSlug : unknown,
            candidate: state.currentWorkingVersionId === null ? "Ninguna versión de trabajo" : pointersConflict ? unknown : versionLabel(state.currentWorkingVersionId),
            candidateContent: candidateVerified ? "Snapshot asociado a la candidata" : unknown,
            published: publicationLabel, working: pointersConflict ? unknown : versionLabel(state.currentWorkingVersionId),
            replaced: working ? publicationLabel : state.currentWorkingVersionId === null ? "No corresponde: sin candidata de trabajo" : unknown,
            sectionCount: validSections ? String(sections.length) : unknown,
            sectionOrder: ordered.map((s, index) => `${index + 1}. ${s.id} (${s.type}) · orden ${s.order}${s.enabled ? "" : " · deshabilitada"}`),
            warnings
        };
    }
    return { project, validDate, isUpcoming, stateKey, describeSnapshot, editorial };
});
