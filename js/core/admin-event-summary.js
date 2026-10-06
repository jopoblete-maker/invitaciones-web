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
    return { project, validDate, isUpcoming };
});
