(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.PremiumSectionRenderers = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
    const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
    function text(value, max) {
        return typeof value === "string" && value.trim() && !/[\u0000-\u001f\u007f-\u009f]/.test(value)
            && Array.from(value.trim()).length <= max ? value : "";
    }
    function ready(section, type, context) {
        return object(section) && section.type === type && (section.enabled === undefined || section.enabled === true) && object(section.data)
            && context && typeof context.escapeHtml === "function" && typeof context.escapeAttr === "function";
    }
    function heading(data, context) {
        const title = text(data.title, 120);
        return title ? `<h2>${context.escapeHtml(title)}</h2>` : "";
    }
    function wrap(type, content) {
        return `<section class="wedding-section premium-section premium-${type}" data-section-type="${type}"><div class="wedding-content">${content}</div></section>`;
    }
    function allowed(policy, url) {
        if (typeof url !== "string" || url !== url.trim() || !/^https:\/\//i.test(url)
            || /[\u0000-\u001f\u007f-\u009f\\]/.test(url)) return false;
        try { return Boolean(policy && typeof policy.isAllowed === "function" && policy.isAllowed(url)); }
        catch (_) { return false; }
    }
    function safeSource(src, context) {
        if (typeof src !== "string" || src !== src.trim() || /[\u0000-\u001f\u007f-\u009f<>\\]/.test(src)) return false;
        if (src.startsWith("/assets/")) {
            return !src.includes("..") && !/[?#%]/.test(src) && /\.(?:jpe?g|png|webp|avif)$/i.test(src)
                && Array.isArray(context.approvedLocalSources) && context.approvedLocalSources.includes(src);
        }
        return allowed(context.imagePolicy, src);
    }
    function renderGallery(section, context = {}) {
        if (!ready(section, "gallery", context)) return "";
        const { data } = section;
        if (!Array.isArray(data.items) || !data.items.length || data.items.length > 20) return "";
        const ids = new Set();
        const figures = data.items.map(item => {
            if (!object(item) || typeof item.media_id !== "string" || ids.has(item.media_id)
                || !Array.isArray(context.authorizedMediaIds) || !context.authorizedMediaIds.includes(item.media_id)
                || !object(context.mediaItems) || !own(context.mediaItems, item.media_id)) return "";
            const media = context.mediaItems[item.media_id];
            const alt = text(item.alt, 240);
            if (!object(media) || media.type !== "image" || typeof media.src !== "string"
                || !own(item, "src") || item.src !== media.src || !safeSource(item.src, context) || !alt) return "";
            ids.add(item.media_id);
            const caption = text(item.caption, 300);
            return `<figure><img src="${context.escapeAttr(item.src)}" alt="${context.escapeAttr(alt)}" loading="lazy" decoding="async">${caption ? `<figcaption>${context.escapeHtml(caption)}</figcaption>` : ""}</figure>`;
        }).filter(Boolean).join("");
        return figures ? wrap("gallery", heading(data, context) + `<div class="premium-gallery-items">${figures}</div>`) : "";
    }
    function renderDressCode(section, context = {}) {
        if (!ready(section, "dress-code", context)) return "";
        const { data } = section;
        const description = text(data.description, 1000);
        if (!description) return "";
        const colors = Array.isArray(data.reserved_colors) && data.reserved_colors.length <= 8
            ? data.reserved_colors.map(entry => {
                if (!object(entry)) return "";
                const color = text(entry.color, 40), reserved = text(entry.reserved_for, 120);
                return color && reserved ? `<li>${context.escapeHtml(color)} — reservado para ${context.escapeHtml(reserved)}</li>` : "";
            }).filter(Boolean).join("") : "";
        return wrap("dress-code", heading(data, context) + `<p>${context.escapeHtml(description)}</p>${colors ? `<ul>${colors}</ul>` : ""}`);
    }
    function renderGifts(section, context = {}) {
        if (!ready(section, "gifts", context) || !object(context.authorizedGiftData)) return "";
        const { data } = section;
        const approved = key => own(context.authorizedGiftData, key) && data[key] === context.authorizedGiftData[key];
        const message = approved("message") ? text(data.message, 1000) : "";
        const copy = section.config?.allow_copy === true;
        const details = [
            ["alias", "Alias", /^[A-Za-z0-9.-]{6,20}$/],
            ["cbu", "CBU", /^\d{22}$/]
        ].map(([key, label, pattern]) => {
            const value = approved(key) && typeof data[key] === "string" && pattern.test(data[key]) ? data[key] : "";
            if (!value) return "";
            return `<div class="premium-gift-field"><dt>${label}</dt><dd><span class="premium-gift-value">${context.escapeHtml(value)}</span>${copy ? `<button type="button" class="premium-gift-copy" aria-label="Copiar ${label}">Copiar ${label}</button>` : ""}</dd></div>`;
        }).filter(Boolean).join("");
        if (!message && !details) return "";
        return wrap("gifts", (approved("title") ? heading(data, context) : "") + (message ? `<p>${context.escapeHtml(message)}</p>` : "")
            + (details ? `<dl>${details}</dl>` : "") + (copy && details ? '<p class="premium-gift-status" role="status" aria-live="polite"></p>' : ""));
    }
    function renderCollaborativeAlbum(section, context = {}) {
        if (!ready(section, "collaborative-album", context) || !allowed(context.albumPolicy, section.data.url)) return "";
        const { data } = section;
        const label = text(data.button_label, 60) || "Abrir carpeta";
        const description = text(data.description, 600);
        return wrap("collaborative-album", heading(data, context)
            + (description ? `<p>${context.escapeHtml(description)}</p>` : "")
            + `<a href="${context.escapeAttr(data.url)}" target="_blank" rel="noopener noreferrer">${context.escapeHtml(label)} <span>(abre en otra pestaña)</span></a>`);
    }
    return { renderGallery, renderDressCode, renderGifts, renderCollaborativeAlbum };
});
