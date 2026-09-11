(function (root, factory) {
    const schema = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = schema;
    }

    root.EventSchema = schema;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const CURRENT_SCHEMA_VERSION = 1;

    const EVENT_MODEL_KEYS = [
        "schema_version",
        "event",
        "template",
        "sections",
        "theme",
        "media",
        "music",
        "location",
        "rsvp"
    ];

    const INITIAL_SECTION_TYPES = [
        "hero",
        "event-info",
        "location",
        "rsvp",
        "closing"
    ];

    const FUTURE_SECTION_TYPES = [
        "gallery",
        "countdown",
        "dress-code",
        "gifts",
        "timeline",
        "collaborative-album",
        "messages",
        "assistant"
    ];

    const LEGACY_SECTION_MAP = [
        { id: "legacy-capa-1", type: "hero", order: 10 },
        { id: "legacy-capa-2", type: "location", order: 20 },
        { id: "legacy-capa-3", type: "rsvp", order: 30 }
    ];

    return {
        CURRENT_SCHEMA_VERSION,
        EVENT_MODEL_KEYS,
        INITIAL_SECTION_TYPES,
        FUTURE_SECTION_TYPES,
        LEGACY_SECTION_MAP
    };
});
