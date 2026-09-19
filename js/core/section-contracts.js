(function (root, factory) {
    const contracts = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = contracts;
    }

    root.SectionContracts = contracts;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const SECTION_CONTRACTS = createRegistry({
        hero: {
            type: "hero",
            allowedDataKeys: ["title", "subtitle", "dateText", "message", "text", "image", "imageAlt", "alt", "backgroundImage"],
            allowedConfigKeys: ["mediaLayout", "imageLayout", "showCopy"]
        },
        "event-info": {
            type: "event-info",
            allowedDataKeys: ["dateText", "timeText", "locationText", "place", "address", "city", "message", "image", "imageAlt", "alt", "backgroundImage"],
            allowedConfigKeys: ["mediaLayout", "imageLayout", "showMessage"]
        },
        location: {
            type: "location",
            allowedDataKeys: ["name", "locationText", "place", "address", "city", "message", "timeText"],
            allowedConfigKeys: []
        },
        rsvp: {
            type: "rsvp",
            allowedDataKeys: [],
            allowedConfigKeys: []
        },
        closing: {
            type: "closing",
            allowedDataKeys: ["title", "message", "names", "image", "imageAlt", "alt", "backgroundImage"],
            allowedConfigKeys: ["mediaLayout", "imageLayout"]
        },
        countdown: {
            type: "countdown",
            allowedDataKeys: ["targetDateTime", "target", "dateTime", "eyebrow", "footer", "completedMessage"],
            allowedConfigKeys: []
        },
        "media-closing": {
            type: "media-closing",
            allowedDataKeys: ["src", "image", "alt", "imageAlt"],
            allowedConfigKeys: []
        }
    });

    function createRegistry(source) {
        return Object.freeze(Object.fromEntries(Object.entries(source).map(([type, contract]) => [
            type,
            Object.freeze({
                ...contract,
                allowedDataKeys: Object.freeze([...contract.allowedDataKeys]),
                allowedConfigKeys: Object.freeze([...contract.allowedConfigKeys])
            })
        ])));
    }

    function normalizeType(type) {
        return String(type || "").trim();
    }

    function has(type) {
        return Object.prototype.hasOwnProperty.call(SECTION_CONTRACTS, normalizeType(type));
    }

    function get(type) {
        return SECTION_CONTRACTS[normalizeType(type)];
    }

    function list() {
        return Object.values(SECTION_CONTRACTS);
    }

    return {
        SECTION_CONTRACTS,
        has,
        get,
        list
    };
});
