(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.PremiumSectionValidator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const TYPES = ["gallery", "dress-code", "gifts", "collaborative-album"];
    const object = value => value !== null && typeof value === "object" && !Array.isArray(value)
        && [Object.prototype, null].includes(Object.getPrototypeOf(value));
    const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
    const controls = /[\u0000-\u001f\u007f-\u009f]/;
    function validateSection(section, { mediaItems = {}, authorizedMediaIds = [], albumPolicy, imagePolicy } = {}) {
        const errors = [];
        const fail = path => errors.push(`${path}: invalid premium section data.`);
        if (!object(section) || !TYPES.includes(section.type)) return { valid: false, errors: ["Invalid premium section."] };
        const keys = (value, allowed, path) => {
            if (!object(value)) { fail(path); return false; }
            if (Object.keys(value).some(key => !allowed.includes(key))) fail(path);
            return true;
        };
        const text = (value, max, path, required = false) => {
            if (value === undefined && !required) return;
            if (typeof value !== "string" || controls.test(value) || /[<>]/.test(value)
                || !value.trim() || Array.from(value.trim()).length > max) fail(path);
        };
        keys(section, ["id", "type", "enabled", "order", "data", "config"], "section");
        text(section.id, Infinity, "section.id", true);
        if (section.enabled !== undefined && typeof section.enabled !== "boolean") fail("section.enabled");
        if (typeof section.order !== "number" || !Number.isFinite(section.order)) fail("section.order");
        const dataKeys = {
            gallery: ["title", "items"], "dress-code": ["title", "description", "reserved_colors"],
            gifts: ["title", "message", "alias", "cbu"], "collaborative-album": ["title", "description", "url", "button_label"]
        };
        if (!keys(section.data, dataKeys[section.type], "data")) return { valid: false, errors };
        const data = section.data;
        if (section.config !== undefined) {
            if (keys(section.config, section.type === "gifts" ? ["allow_copy"] : [], "config")
                && own(section.config, "allow_copy") && typeof section.config.allow_copy !== "boolean") fail("config.allow_copy");
        }
        text(data.title, 120, "data.title");
        if (section.type === "gallery") {
            if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 20) fail("data.items");
            else {
                const ids = new Set();
                data.items.forEach((item, index) => {
                    const path = `data.items[${index}]`;
                    if (!keys(item, ["media_id", "alt", "caption"], path)) return;
                    text(item.media_id, Infinity, `${path}.media_id`, true);
                    text(item.alt, 240, `${path}.alt`, true); text(item.caption, 300, `${path}.caption`);
                    const id = item.media_id;
                    if (typeof id !== "string" || id !== id.trim() || ids.has(id)) fail(`${path}.media_id`);
                    ids.add(id);
                    const media = object(mediaItems) && own(mediaItems, id) ? mediaItems[id] : null;
                    // Authorization is a trusted caller input, never a self-declared snapshot flag.
                    if (!Array.isArray(authorizedMediaIds) || !authorizedMediaIds.includes(id)
                        || !object(media) || typeof media.src !== "string"
                        || media.type !== "image") fail(`${path}.media_id`);
                    if (object(media) && typeof media.src === "string"
                        && !safeImageSource(media.src, imagePolicy)) fail(`${path}.media_id`);
                });
            }
        } else if (section.type === "dress-code") {
            text(data.description, 1000, "data.description", true);
            if (data.reserved_colors !== undefined) {
                if (!Array.isArray(data.reserved_colors) || data.reserved_colors.length > 8) fail("data.reserved_colors");
                else data.reserved_colors.forEach((entry, index) => {
                    const path = `data.reserved_colors[${index}]`;
                    if (!keys(entry, ["color", "reserved_for"], path)) return;
                    text(entry.color, 40, `${path}.color`, true); text(entry.reserved_for, 120, `${path}.reserved_for`, true);
                });
            }
        } else if (section.type === "gifts") {
            text(data.message, 1000, "data.message");
            if (!["message", "alias", "cbu"].some(key => typeof data[key] === "string" && data[key].trim())) fail("data");
            if (data.alias !== undefined && (typeof data.alias !== "string" || controls.test(data.alias)
                || !/^[A-Za-z0-9.-]{6,20}$/.test(data.alias.trim()))) fail("data.alias");
            if (data.cbu !== undefined && (typeof data.cbu !== "string" || controls.test(data.cbu)
                || !/^\d{22}$/.test(data.cbu.trim()))) fail("data.cbu");
        } else {
            text(data.description, 600, "data.description"); text(data.button_label, 60, "data.button_label");
            if (!albumPolicy || typeof albumPolicy.isAllowed !== "function" || !albumPolicy.isAllowed(data.url)) fail("data.url");
        }
        return { valid: errors.length === 0, errors };
    }
    function safeImageSource(value, imagePolicy) {
        if (controls.test(value) || /\\|[<>]/.test(value)) return false;
        if (value.startsWith("/assets/") && !value.includes("..") && !/[?#%]/.test(value)) return /\.(?:jpe?g|png|webp|avif)$/i.test(value);
        try { return Boolean(imagePolicy && imagePolicy.isAllowed(value)); }
        catch (_) { return false; }
    }
    return { validateSection };
});
