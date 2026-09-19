(function (root, factory) {
    const calendarActions = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = calendarActions;
    }

    root.CalendarActions = calendarActions;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function getCalendarDetails(event) {
        if (!event.fechaEvento) return null;

        const start = parseEventDate(event.fechaEvento, event.horarioTexto);
        if (!start) return null;

        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
        const title = event.nombre || "Invitación Digital";
        const location = getLocationText(event);
        const dates = `${formatCalendarDate(start)}/${formatCalendarDate(end)}`;
        const googleParams = new URLSearchParams({
            action: "TEMPLATE",
            text: title,
            dates,
            location,
            details: event.subtitulo || ""
        });

        return {
            title,
            location,
            start,
            end,
            googleUrl: `https://calendar.google.com/calendar/render?${googleParams}`
        };
    }

    function getLocationText(event) {
        return [event.lugarNombre, event.lugarDireccion].filter(Boolean).join(" - ");
    }

    function parseEventDate(dateValue, timeText) {
        const dateMatch = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!dateMatch) return null;

        const timeMatch = String(timeText || "").match(/(\d{1,2})(?::(\d{2}))?/);
        const hours = timeMatch ? Number(timeMatch[1]) : 12;
        const minutes = timeMatch?.[2] ? Number(timeMatch[2]) : 0;
        if (hours > 23 || minutes > 59) return null;

        return new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), hours, minutes);
    }

    function formatCalendarDate(date) {
        const parts = [
            date.getUTCFullYear(),
            String(date.getUTCMonth() + 1).padStart(2, "0"),
            String(date.getUTCDate()).padStart(2, "0")
        ];
        return `${parts.join("")}T${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}00Z`;
    }

    return {
        getCalendarDetails,
        parseEventDate,
        formatCalendarDate
    };
});
