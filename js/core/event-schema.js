(function (root, factory) {
    const schema = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = schema;
    }

    root.EventSchema = schema;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const CURRENT_SCHEMA_VERSION = 1;
    const V2_SCHEMA_VERSION = 2;

    const V2_EVENT_MODEL_KEYS = Object.freeze([
        "schema_version",
        "id",
        "event_type",
        "plan",
        "status",
        "template",
        "identity",
        "schedule",
        "location",
        "theme",
        "sections",
        "modules",
        "media",
        "metadata"
    ]);

    const V2_EVENT_STATUSES = Object.freeze([
        "draft",
        "ready_for_preview",
        "in_review",
        "changes_requested",
        "approved",
        "published",
        "archived"
    ]);

    const V2_EVENT_TYPES = Object.freeze([
        "wedding",
        "wedding-civil",
        "birthday",
        "corporate",
        "other"
    ]);

    const EVENT_MODEL_KEYS = [
        "schema_version",
        "event",
        "template",
        "sections",
        "theme",
        "media",
        "music",
        "location",
        "rsvp",
        "branding"
    ];

    const INITIAL_SECTION_TYPES = [
        "hero",
        "event-info",
        "location",
        "rsvp",
        "closing",
        "countdown",
        "media-closing"
    ];

    const FUTURE_SECTION_TYPES = [
        "gallery",
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
        V2_SCHEMA_VERSION,
        V2_EVENT_MODEL_KEYS,
        V2_EVENT_STATUSES,
        V2_EVENT_TYPES,
        EVENT_MODEL_KEYS,
        INITIAL_SECTION_TYPES,
        FUTURE_SECTION_TYPES,
        LEGACY_SECTION_MAP
    };
});
