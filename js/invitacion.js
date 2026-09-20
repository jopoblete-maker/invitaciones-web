const ICONS = {
    calendar: '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h2v3H7V2Zm8 0h2v3h-2V2ZM4 5h16a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 6v9h16v-9H4Zm0-2h16V7H4v2Z"/></svg>',
    map: '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m15 19-6-2.1-5 1.95V5l5-2 6 2.1L20 3.15V17l-5 2Zm-1-2.35V6.85l-4-1.4v9.8l4 1.4Zm2-.05 2-.78V6.08l-2 .78v9.74ZM6 15.92l2-.78V5.4l-2 .78v9.74Z"/></svg>',
    whatsapp: '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.56 2 2.1 6.35 2.1 11.7c0 1.9.57 3.72 1.63 5.31L2 22l5.18-1.62a10.16 10.16 0 0 0 4.86 1.24c5.48 0 9.94-4.35 9.94-9.7S17.52 2 12.04 2Zm0 17.86c-1.54 0-3.03-.42-4.33-1.22l-.31-.19-3.06.96 1-2.9-.21-.32a7.86 7.86 0 0 1-1.28-4.29c0-4.38 3.67-7.94 8.19-7.94 4.51 0 8.18 3.56 8.18 7.94 0 4.39-3.67 7.96-8.18 7.96Zm4.48-5.95c-.24-.12-1.43-.69-1.65-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.02-.37-1.94-1.17-.72-.64-1.2-1.42-1.34-1.66-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.27-.74-1.74-.2-.45-.39-.39-.54-.4h-.46c-.16 0-.42.06-.64.3-.22.24-.84.81-.84 1.97s.86 2.29.98 2.45c.12.16 1.7 2.53 4.1 3.55.57.25 1.02.39 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.43-.57 1.63-1.12.2-.55.2-1.03.14-1.12-.06-.1-.22-.16-.46-.28Z"/></svg>',
    music: '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 18V5l12-2v13h-2V7.35l-8 1.33V18a3 3 0 1 1-2 0Z"/></svg>',
};

const DETAIL_ICONS = {
    calendar: "M7 2h2v3H7V2Zm8 0h2v3h-2V2ZM4 5h16a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 6v9h16v-9H4Zm0-2h16V7H4v2Z",
    clock: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm1 5h-2v6l5 3 .95-1.61L13 12.05V7Z",
    pin: "M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z",
    home: "M12 3 3 10.5l1.28 1.54L6 10.6V21h5v-6h2v6h5V10.6l1.72 1.44L21 10.5 12 3Z"
};

const FONT_FAMILIES = {
    playfair: '"Playfair Display", serif',
    montserrat: '"Montserrat", sans-serif',
    "great-vibes": '"Great Vibes", cursive',
    cinzel: '"Cinzel", serif',
    "dancing-script": '"Dancing Script", cursive',
    "alex-brush": '"Alex Brush", cursive',
    "cormorant-garamond": '"Cormorant Garamond", serif',
    poppins: '"Poppins", sans-serif',
    pacifico: '"Pacifico", cursive',
    "bebas-neue": '"Bebas Neue", sans-serif',
    "monsieur-la-doulaise": '"Monsieur La Doulaise", cursive',
    "pinyon-script": '"Pinyon Script", cursive',
    "bodoni-moda": '"Bodoni Moda", serif',
    prata: '"Prata", serif'
};

let carouselTimers = [];
const templateStylesheetLoads = new WeakMap();

document.addEventListener("DOMContentLoaded", initInvitation);

async function initInvitation() {
    const source = InvitationDataSource.selectInvitationSource(
        window.location.search,
        window.location.hostname
    );

    if (source.mode === "missing") {
        renderState("ID de invitación no especificado.");
        return;
    }
    if (source.privatePreview) {
        InvitationDataSource.showPrivatePreviewBadge(document);
    }

    try {
        const data = await InvitationDataSource.loadInvitationSource(source, fetch);
        const event = EventNormalizer.normalizeEvent(data, { fontFamilies: FONT_FAMILIES });
        const templateConfig = TemplateRegistry.resolveTemplate(event.template.slug || event.template_slug);
        const themeName = inferTheme(event, source.eventId, templateConfig);

        applyTemplateConfig(templateConfig);
        await loadTemplateStylesheet(templateConfig);
        applyTheme(themeName, event.fontFamily, event.estilos);
        renderInvitation(event, templateConfig);
        hideLoader();
    } catch (error) {
        console.error(error);
        renderState(source.privatePreview
            ? "Vista previa no disponible"
            : "Invitación no encontrada");
    }
}

function loadTemplateStylesheet(templateConfig) {
    const href = templateConfig.stylesheet;
    if (!href) {
        return Promise.reject(new Error("El template no define un stylesheet."));
    }

    let link = document.getElementById("template-stylesheet");

    if (!link) {
        link = document.createElement("link");
        link.id = "template-stylesheet";
        link.rel = "stylesheet";
        document.head.appendChild(link);
    }

    const currentHref = link.getAttribute("href");
    const pendingLoad = templateStylesheetLoads.get(link);
    if (pendingLoad?.href === href) return pendingLoad.promise;

    if (currentHref === href && (link.dataset.loadedHref === href || link.sheet)) {
        link.dataset.loadedHref = href;
        return Promise.resolve(link);
    }

    pendingLoad?.cancel();

    let resolveLoad;
    let rejectLoad;
    const promise = new Promise((resolve, reject) => {
        resolveLoad = resolve;
        rejectLoad = reject;
    });
    const load = { href, promise, cancel: null };

    const cleanup = () => {
        link.removeEventListener("load", handleLoad);
        link.removeEventListener("error", handleError);
        if (templateStylesheetLoads.get(link) === load) {
            templateStylesheetLoads.delete(link);
        }
    };
    const handleLoad = () => {
        cleanup();
        link.dataset.loadedHref = href;
        resolveLoad(link);
    };
    const handleError = () => {
        cleanup();
        if (link.dataset.loadedHref === href) delete link.dataset.loadedHref;
        rejectLoad(new Error(`No se pudo cargar el stylesheet del template ${templateConfig.slug || "seleccionado"}.`));
    };

    load.cancel = () => {
        cleanup();
        rejectLoad(new Error("La carga del stylesheet fue reemplazada por otro template."));
    };
    templateStylesheetLoads.set(link, load);
    link.addEventListener("load", handleLoad);
    link.addEventListener("error", handleError);

    try {
        if (currentHref !== href) delete link.dataset.loadedHref;
        link.setAttribute("href", href);
    } catch (error) {
        cleanup();
        rejectLoad(error);
    }

    return promise;
}

function applyTemplateConfig(templateConfig) {
    document.body.dataset.template = templateConfig.slug;
    document.body.dataset.templateLayout = templateConfig.layout;
    getApp().dataset.templateLayout = templateConfig.layout;
    getApp().classList.toggle("invitation-dashboard", templateConfig.layout !== "vertical");
    getApp().classList.toggle("invitation-vertical", templateConfig.layout === "vertical");
    getApp().classList.add(templateConfig.className);
}

function applyAudioButtonPosition(config) {
    const root = document.documentElement;
    root.style.setProperty("--audio-top", config.verticalEdge === "top" ? `${config.verticalOffset}%` : "auto");
    root.style.setProperty("--audio-bottom", config.verticalEdge === "bottom" ? `${config.verticalOffset}%` : "auto");
    root.style.setProperty("--audio-left", config.horizontalEdge === "left" ? `${config.horizontalOffset}%` : "auto");
    root.style.setProperty("--audio-right", config.horizontalEdge === "right" ? `${config.horizontalOffset}%` : "auto");
}

function inferTheme(data, id, templateConfig = {}) {
    const raw = `${data.tema || ""} ${id || ""} ${data.nombre || ""} ${data.subtitulo || ""}`.toLowerCase();

    if (data.tema && ThemeRegistry.resolveTheme(data.tema, { fallback: false })) return data.tema;
    if (templateConfig.defaultTheme && ThemeRegistry.resolveTheme(templateConfig.defaultTheme, { fallback: false })) {
        return templateConfig.defaultTheme;
    }
    if (raw.includes("frozen") || raw.includes("nieve")) return "frozen";
    if (raw.includes("pesca") || raw.includes("pesc")) return "pesca";
    if (raw.includes("boda") || raw.includes("casamiento") || raw.includes("elegante")) return "elegante";
    if (raw.includes("minimalista") || raw.includes("minimal")) return "minimalista";
    if (raw.includes("fiesta") || raw.includes("cumple")) return "fiesta";

    return ThemeRegistry.DEFAULT_THEME_SLUG;
}

function applyTheme(themeName, fontFamily, styles = {}) {
    const theme = ThemeRegistry.resolveTheme(themeName).tokens;
    const root = document.documentElement;

    document.body.dataset.theme = themeName;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.primary);

    root.style.setProperty("--primary-color", theme.primary);
    root.style.setProperty("--secondary-color", theme.secondary);
    root.style.setProperty("--accent-color", theme.accent);
    root.style.setProperty("--text-color", normalizeColor(styles.colorTexto, theme.text));
    root.style.setProperty("--canvas-background", normalizeColor(styles.colorFondo, theme.secondary));
    root.style.setProperty("--muted-color", theme.muted);
    root.style.setProperty("--surface-color", theme.surface);
    root.style.setProperty("--surface-strong", theme.surfaceStrong);
    root.style.setProperty("--surface-soft", theme.surfaceSoft);
    root.style.setProperty("--line-color", theme.line);
    root.style.setProperty("--shadow-color", theme.shadow);
    root.style.setProperty("--button-gradient", theme.button);
    root.style.setProperty("--bg-image", theme.background);
    root.style.setProperty("--font-heading", theme.heading);
    root.style.setProperty("--font-body", theme.body);
    root.style.setProperty("--font-primary", fontFamily || FONT_FAMILIES.playfair);
    root.style.setProperty("--title-shadow-color", normalizeColor(styles.colorSombra, "#000000"));
    root.style.setProperty("--decorative-border-color", normalizeColor(styles.colorBordeDecorativo, theme.primary));
}

function normalizeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}

function renderInvitation(event, templateConfig) {
    document.title = event.nombre ? `Invitación de ${event.nombre}` : "Invitación Digital";

    const renderableSections = SectionRenderer.getRenderableSections(event.sections, {
        warn: (message) => console.warn(message)
    });
    const context = {
        event,
        renderers: {
            hero: renderHero,
            eventInfo: renderEventInfoPage,
            location: renderLocationPage,
            rsvp: renderConfirmationPage,
            closing: renderClosingPage,
            countdown: Countdown.renderPage,
            mediaClosing: renderMediaClosingPage
        },
        templateConfig,
        renderBrochureNavigation: (pageCount) => templateConfig.layout === "vertical" ? "" : renderBrochureNavigation(pageCount),
        getSectionImage: (section, pageIndex) => getSectionImage(event, section, pageIndex),
        warn: (message) => console.warn(message)
    };

    const html = [
        SectionRenderer.renderSections(renderableSections, context).join(""),
        renderBranding(event)
    ].filter(Boolean).join("");

    getApp().innerHTML = html;
    document.querySelectorAll(".wedding-section").forEach((page, index) => {
        const section = renderableSections[index];
        const config = getSectionLayoutConfig(event, section, index);
        const image = getSectionImage(event, section, index);
        if (image && !shouldRenderContainedMedia(section)) page.style.setProperty("--page-image", `url("${image}")`);
        page.style.setProperty("--page-position", config.objectPosition);
        page.style.setProperty("--page-scale", config.scale);
        page.style.setProperty("--content-offset-y", `${config.offsetY}%`);
        page.style.setProperty("--content-scale", config.contentScale === "small" ? "0.88" : config.contentScale === "large" ? "1.08" : "1");
        page.classList.add(`layout-align-${config.align}`, `layout-scale-${config.contentScale}`);
    });
    setupMusic(event.multimedia.audios, event.multimedia.audioPlayMode);
    applyAudioButtonPosition(event.layoutConfig.audioButton);
    setupBrochureNavigation();
    setupLocationActions();
    Rsvp.setupConfirmation();
    setupBranding();
    Countdown.clearTimers();
    Countdown.setupSections();
    Countdown.startLegacy(event.fechaEvento);
}

function getSectionImage(event, section, pageIndex) {
    const sectionData = section?.data || {};
    const byLayer = {
        capa1: event.multimedia.capas.portada,
        capa2: event.multimedia.capas.encuentro,
        capa3: event.multimedia.capas.confirmacion
    };
    const byType = {
        hero: event.multimedia.capas.portada,
        "event-info": event.multimedia.capas.encuentro,
        location: event.multimedia.capas.encuentro,
        rsvp: event.multimedia.capas.confirmacion,
        closing: event.multimedia.capas.confirmacion
    };

    return sectionData.backgroundImage
        || sectionData.image
        || byLayer[sectionData.legacyLayer]
        || byType[section?.type]
        || [event.multimedia.capas.portada, event.multimedia.capas.encuentro, event.multimedia.capas.confirmacion][Math.min(pageIndex, 2)]
        || "";
}

function getSectionLayoutConfig(event, section, pageIndex) {
    const layer = section?.data?.legacyLayer || `capa${Math.min(pageIndex + 1, 3)}`;
    return event.layoutConfig[layer] || event.layoutConfig.capa3 || event.layoutConfig.capa2 || event.layoutConfig.capa1;
}

function renderHero(section, context) {
    const event = context.event;
    const image = context.getSectionImage(section, context.pageIndex);
    const inlineMedia = shouldRenderContainedMedia(section);

    return `
        <section id="capa-1" class="wedding-section wedding-section--cover hero-section${inlineMedia ? " wedding-section--media-contained" : ""}" data-section-type="${escapeAttr(section.type)}">
            ${image && inlineMedia ? renderSectionMedia(section, image, context) : ""}
            ${image && !inlineMedia ? `<div class="bg-image-wrapper" aria-hidden="true"><img src="${escapeAttr(image)}" alt="" ${renderImageLoadingAttrs(context)}></div>` : ""}
            ${!inlineMedia ? `<div class="bg-overlay" aria-hidden="true"></div>` : ""}
            ${shouldRenderSectionCopy(section) ? renderHeroCopy(section, event) : ""}
            <div class="hero-footer">${context.renderBrochureNavigation(context.pageCount)}</div>
            <button class="hero-action hero-music-action" type="button" data-audio-trigger>
                ${ICONS.music}<span>Música</span>
            </button>
        </section>
    `;
}

function renderHeroCopy(section, event) {
    const data = section?.data || {};
    const subtitle = firstSectionValue(data.subtitle, event.subtitulo);
    const title = firstSectionValue(data.title, event.nombre);
    const dateText = firstSectionValue(data.dateText, event.fechaTexto);
    const message = firstSectionValue(data.message, data.text);
    const content = [
        subtitle ? `<p class="hero-subtitle">${escapeHtml(subtitle)}</p>` : "",
        title ? `<h1 class="title cover-names">${escapeHtml(title)}</h1>` : "",
        dateText ? `<p class="hero-date">${escapeHtml(dateText)}</p>` : "",
        message ? `<p class="page-message hero-note">${escapeHtml(message)}</p>` : ""
    ].filter(Boolean).join("");

    return content ? `<div class="wedding-content hero-copy">${content}</div>` : "";
}

function renderEventInfoPage(section, context) {
    const event = context.event;
    const data = section?.data || {};
    const image = context.getSectionImage(section, context.pageIndex);
    const inlineMedia = shouldRenderContainedMedia(section);
    const locationText = firstSectionValue(data.locationText, data.place, getLocationText(event));
    const addressText = firstSectionValue(data.address, event.lugarDireccion, event.location?.address, locationText);
    const cityText = firstSectionValue(data.city, event.lugarCiudad, event.location?.city);
    const message = data.showMessage === false ? "" : firstSectionValue(data.message);

    return `
        <section class="wedding-section wedding-section--location${inlineMedia ? " wedding-section--media-contained" : ""}" data-section-type="${escapeAttr(section.type)}">
            <div class="wedding-content">
                ${image && inlineMedia ? renderSectionMedia(section, image, context) : ""}
                ${message ? `<p class="page-message">${escapeHtml(message)}</p>` : ""}
                ${renderDetailsList([
                    renderDetail("calendar", "Fecha", firstSectionValue(data.dateText, event.fechaTexto)),
                    renderDetail("clock", "Horario", firstSectionValue(data.timeText, event.horarioTexto)),
                    renderAddressDetail(addressText, cityText)
                ])}
            </div>
            ${context.renderBrochureNavigation(context.pageCount)}
        </section>
    `;
}

function renderLocationPage(section, context) {
    const event = context.event;
    const data = section?.data || {};
    const hasEventInfo = hasEventInfoDetails(event);
    const locationText = firstSectionValue(data.locationText, data.place, getLocationText(event));
    const addressText = firstSectionValue(data.address, event.lugarDireccion, locationText);
    const cityText = firstSectionValue(data.city, event.lugarCiudad, event.location?.city);
    const message = firstSectionValue(data.message, hasEventInfoMessage(event) ? "" : event.mensaje);
    const timeText = firstSectionValue(data.timeText, event.horarioTexto);
    const calendar = renderCalendarActions(event);

    return `
        <section class="wedding-section wedding-section--location" data-section-type="${escapeAttr(section.type)}">
            <div class="wedding-content">
                ${message ? `<p class="page-message">${escapeHtml(message)}</p>` : ""}
                ${hasEventInfo
                    ? ""
                    : renderDetailsList([
                        renderDetail("clock", "Horario", timeText),
                        renderDetail("pin", "Lugar", locationText)
                    ])}
                ${event.googleMapsUrl ? `
                    <div class="actions">
                        <button class="button" type="button" data-map-url="${escapeAttr(event.googleMapsUrl)}">
                            ${ICONS.map} Cómo Llegar
                        </button>
                    </div>
                ` : ""}
                ${calendar}
            </div>
            ${context.renderBrochureNavigation(context.pageCount)}
        </section>
    `;
}

function renderAddressDetail(address, city) {
    if (!address && !city) return "";

    return `
        <div class="detail-row detail-row--address">
            <svg class="detail-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="${DETAIL_ICONS.pin}"></path>
            </svg>
            <div>
                <p class="detail-label">Dirección</p>
                ${address ? `<p class="detail-value">${escapeHtml(address)}</p>` : ""}
                ${city ? `<p class="detail-value detail-value--secondary">${escapeHtml(city)}</p>` : ""}
            </div>
        </div>
    `;
}

function renderConfirmationPage(section, context) {
    const event = context.event;
    const content = [
        context.templateConfig.layout === "vertical" ? "" : event.fechaEvento ? Countdown.renderLegacyContent() : "",
        Rsvp.renderContent(event, {
            normalizePhone: normalizeWhatsAppPhone,
            escapeHtml,
            whatsappIcon: ICONS.whatsapp
        })
    ].filter(Boolean).join("");

    return `
        <section class="wedding-section wedding-section--confirmation" data-section-type="${escapeAttr(section.type)}">
            <div class="wedding-content">${content}</div>
            ${context.renderBrochureNavigation(context.pageCount)}
        </section>
    `;
}

function renderClosingPage(section, context) {
    const data = section?.data || {};
    const image = context.getSectionImage(section, context.pageIndex);
    const inlineMedia = shouldRenderContainedMedia(section);
    const content = [
        image && inlineMedia ? renderSectionMedia(section, image, context) : "",
        data.title ? `<h2 class="section-title">${escapeHtml(data.title)}</h2>` : "",
        data.message ? `<p class="page-message">${escapeHtml(data.message)}</p>` : "",
        data.names ? `<p class="hero-date closing-names">${escapeHtml(data.names)}</p>` : ""
    ].filter(Boolean).join("");

    return `
        <section class="wedding-section wedding-section--confirmation${inlineMedia ? " wedding-section--media-contained" : ""}" data-section-type="${escapeAttr(section.type)}">
            <div class="wedding-content">${content}</div>
            ${context.renderBrochureNavigation(context.pageCount)}
        </section>
    `;
}

function renderMediaClosingPage(section, context) {
    const data = section?.data || {};
    const src = firstSectionValue(data.src, data.image);
    const alt = firstSectionValue(data.alt, data.imageAlt);
    if (!src) return "";

    return `
        <section class="wedding-section wedding-section--media-closing" data-section-type="${escapeAttr(section.type)}">
            <figure class="media-closing-media">
                <img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" ${renderImageLoadingAttrs(context)}>
            </figure>
        </section>
    `;
}

function renderBrochureNavigation(pageCount = 3) {
    if (pageCount <= 1) return "";
    const dots = Array.from({ length: pageCount }, (_, index) => {
        const label = index === 0 ? "Portada" : `Página ${index + 1}`;
        return `<button type="button" class="brochure-dot${index === 0 ? " is-active" : ""}" data-page-target="${index}" aria-label="${label}"></button>`;
    }).join("");

    return `
        <nav class="brochure-dots" aria-label="Páginas de la invitación">
            ${dots}
        </nav>
    `;
}

function renderBranding(event) {
    const branding = event?.branding || {};
    if (branding.enabled !== true) return "";

    const badgeText = firstSectionValue(branding.badgeText, branding.brandName);
    if (!badgeText) return "";

    const panelId = "brandingPanel";
    const whatsappUrl = buildBrandingWhatsappUrl(branding, event);
    const portfolioUrl = safeExternalUrl(branding.portfolioUrl);
    const instagramUrl = safeExternalUrl(branding.instagramUrl);
    const actions = [
        whatsappUrl ? `<a class="branding-link" href="${escapeAttr(whatsappUrl)}" target="_blank" rel="noopener noreferrer">Ped&iacute; la tuya por WhatsApp</a>` : "",
        portfolioUrl ? `<a class="branding-link" href="${escapeAttr(portfolioUrl)}" target="_blank" rel="noopener noreferrer">Portfolio</a>` : "",
        instagramUrl ? `<a class="branding-link" href="${escapeAttr(instagramUrl)}" target="_blank" rel="noopener noreferrer">Instagram</a>` : ""
    ].filter(Boolean).join("");

    return `
        <aside class="branding-widget" data-branding-widget>
            <div class="branding-panel" id="${panelId}" role="dialog" aria-label="${escapeAttr(firstSectionValue(branding.brandName, "YCOR Digital"))}" hidden>
                <button class="branding-close" type="button" aria-label="Cerrar" data-branding-close>&times;</button>
                ${branding.cta ? `<p class="branding-cta">${escapeHtml(branding.cta)}</p>` : ""}
                ${branding.brandName ? `<p class="branding-name">${escapeHtml(branding.brandName)}</p>` : ""}
                ${branding.serviceText ? `<p class="branding-service">${escapeHtml(branding.serviceText)}</p>` : ""}
                ${actions ? `<div class="branding-actions">${actions}</div>` : ""}
            </div>
            <button class="branding-badge" type="button" aria-expanded="false" aria-controls="${panelId}" data-branding-toggle>
                ${escapeHtml(badgeText)}
            </button>
        </aside>
    `;
}

function setupBranding() {
    const widget = document.querySelector("[data-branding-widget]");
    if (!widget) return;

    const toggle = widget.querySelector("[data-branding-toggle]");
    const panel = widget.querySelector(".branding-panel");
    const close = widget.querySelector("[data-branding-close]");
    if (!toggle || !panel || !close) return;

    const setOpen = (open) => {
        panel.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        widget.classList.toggle("is-open", open);
        if (open) close.focus();
    };

    toggle.addEventListener("click", () => setOpen(panel.hidden));
    close.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.hidden) setOpen(false);
    });
    document.addEventListener("pointerdown", (event) => {
        if (!panel.hidden && !widget.contains(event.target)) setOpen(false);
    });
}

function buildBrandingWhatsappUrl(branding, event) {
    const phone = normalizeWhatsAppPhone(branding?.whatsapp);
    if (!phone) return "";

    const message = firstSectionValue(branding.whatsappMessage) || buildBrandingWhatsappMessage(event);
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildBrandingWhatsappMessage(event) {
    const label = getEventDisplayLabel(event);
    const suffix = label ? ` de ${label}` : "";
    return `Hola, vi la invitaci\u00f3n${suffix} y me gustar\u00eda cotizar una invitaci\u00f3n para mi evento.`;
}

function getEventDisplayLabel(event) {
    return firstSectionValue(event?.event?.title, event?.nombre, event?.event?.name, event?.subtitulo);
}

function safeExternalUrl(value) {
    return isValidHttpUrl(value) ? value.trim() : "";
}

function firstSectionValue(...values) {
    const value = values.find((item) => typeof item === "string" && item.trim());
    return value ? value.trim() : "";
}

function shouldRenderContainedMedia(section) {
    const data = section?.data || {};
    return firstSectionValue(data.mediaLayout, data.imageLayout) === "contained";
}

function shouldRenderSectionCopy(section) {
    return section?.data?.showCopy !== false;
}

function renderSectionMedia(section, image, context) {
    const data = section?.data || {};
    const alt = firstSectionValue(data.imageAlt, data.alt);
    return `
        <figure class="section-media">
            <img src="${escapeAttr(image)}" alt="${escapeAttr(alt)}" ${renderImageLoadingAttrs(context)}>
        </figure>
    `;
}

function renderImageLoadingAttrs(context) {
    const isPriorityImage = context?.pageIndex === 0;
    const attrs = [
        `loading="${isPriorityImage ? "eager" : "lazy"}"`,
        'decoding="async"'
    ];

    if (isPriorityImage) attrs.push('fetchpriority="high"');

    return attrs.join(" ");
}

function hasEventInfoMessage(event) {
    return Array.isArray(event.sections) && event.sections.some((section) => {
        if (!section || section.enabled === false || section.type !== "event-info") return false;
        const data = section.data || {};
        return Boolean(firstSectionValue(data.message, data.text));
    });
}

function hasEventInfoDetails(event) {
    return Array.isArray(event.sections) && event.sections.some((section) => {
        if (!section || section.enabled === false || section.type !== "event-info") return false;
        const data = section.data || {};
        return Boolean(firstSectionValue(data.dateText, data.timeText, data.locationText, data.place));
    });
}

function renderDetailsList(items) {
    const content = items.filter(Boolean).join("");
    return content ? `<div class="details-section">${content}</div>` : "";
}

function setupBrochureNavigation() {
    const brochure = getApp();
    const pages = Array.from(brochure.querySelectorAll(".wedding-section"));
    let dots = Array.from(brochure.querySelectorAll(".brochure-dot"));
    if (!pages.length) return;

    dots.forEach((dot) => {
        if (!pages[Number(dot.dataset.pageTarget)]) dot.remove();
    });
    dots = Array.from(brochure.querySelectorAll(".brochure-dot"));

    const setActivePage = (index) => {
        dots.forEach((dot) => dot.classList.toggle("is-active", Number(dot.dataset.pageTarget) === index));
    };

    dots.forEach((dot) => dot.addEventListener("click", () => {
        pages[Number(dot.dataset.pageTarget)]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }));

    const observer = new IntersectionObserver((entries) => {
        const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
        if (visible) setActivePage(pages.indexOf(visible.target));
    }, { root: brochure, threshold: [0.55, 0.8] });

    pages.forEach((page) => observer.observe(page));
}

function renderCalendarActions(event) {
    const details = CalendarActions.getCalendarDetails(event);
    if (!details) return "";

    return `
        <div class="calendar-actions">
            <a class="button" href="${escapeAttr(details.googleUrl)}" target="_blank" rel="noopener noreferrer">
                ${ICONS.calendar}
                Agendar Evento
            </a>
        </div>
    `;
}

function getLocationText(event) {
    return [event.lugarNombre, event.lugarDireccion].filter(Boolean).join(" - ");
}

function setupLocationActions() {
    document.querySelectorAll("[data-map-url]").forEach((button) => {
        button.addEventListener("click", () => {
            const url = button.dataset.mapUrl;
            if (isValidHttpUrl(url)) window.open(url, "_blank", "noopener,noreferrer");
        });
    });
}

function isValidHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

function renderDetail(icon, label, value) {
    if (!value) return "";

    return `
        <div class="detail-row">
            <svg class="detail-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="${DETAIL_ICONS[icon]}"></path>
            </svg>
            <div>
                <p class="detail-label">${escapeHtml(label)}</p>
                <p class="detail-value">${escapeHtml(value)}</p>
            </div>
        </div>
    `;
}

function setupCarousel() {
    carouselTimers.forEach((timer) => clearInterval(timer));
    carouselTimers = [];

    document.querySelectorAll("[data-carousel]").forEach((carousel) => {
        const track = carousel.querySelector(".carousel-track");
        const slides = Array.from(carousel.querySelectorAll(".carousel-slide"));
        const dots = Array.from(carousel.querySelectorAll(".carousel-dot"));
        const prev = carousel.querySelector("[data-carousel-prev]");
        const next = carousel.querySelector("[data-carousel-next]");
        const autoplayDelay = 2000;
        let current = 0;
        let startX = 0;
        let autoplayTimer = null;
        let isMousePaused = false;
        let isTouchPaused = false;

        const goTo = (index) => {
            current = (index + slides.length) % slides.length;
            track.style.transform = `translateX(-${current * 100}%)`;
            dots.forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === current));
        };

        const stopAutoplay = () => {
            if (!autoplayTimer) return;
            clearInterval(autoplayTimer);
            carouselTimers = carouselTimers.filter((timer) => timer !== autoplayTimer);
            autoplayTimer = null;
            carousel.classList.add("is-paused");
        };

        const startAutoplay = () => {
            if (autoplayTimer || slides.length <= 1) return;
            if (isMousePaused || isTouchPaused) return;
            carousel.classList.remove("is-paused");
            autoplayTimer = setInterval(() => goTo(current + 1), autoplayDelay);
            carouselTimers.push(autoplayTimer);
        };

        const restartAutoplay = () => {
            stopAutoplay();
            startAutoplay();
        };

        const pauseFromMouse = () => {
            isMousePaused = true;
            stopAutoplay();
        };
        const resumeFromMouse = (event) => {
            if (event.relatedTarget && carousel.contains(event.relatedTarget)) return;
            isMousePaused = false;
            startAutoplay();
        };
        const pauseFromTouch = () => {
            isTouchPaused = true;
            stopAutoplay();
        };
        const resumeFromTouch = () => {
            isTouchPaused = false;
            startAutoplay();
        };

        prev?.addEventListener("click", () => {
            goTo(current - 1);
            restartAutoplay();
        });
        next?.addEventListener("click", () => {
            goTo(current + 1);
            restartAutoplay();
        });
        dots.forEach((dot) => dot.addEventListener("click", () => {
            goTo(Number(dot.dataset.slide));
            restartAutoplay();
        }));

        carousel.addEventListener("mouseenter", pauseFromMouse);
        carousel.addEventListener("mouseleave", () => {
            isMousePaused = false;
            startAutoplay();
        });
        carousel.addEventListener("mouseover", pauseFromMouse);
        carousel.addEventListener("mouseout", resumeFromMouse);
        carousel.addEventListener("touchstart", pauseFromTouch, { passive: true });
        carousel.addEventListener("touchend", resumeFromTouch);
        carousel.addEventListener("touchcancel", resumeFromTouch);

        track.addEventListener("pointerdown", (event) => {
            startX = event.clientX;
            track.setPointerCapture(event.pointerId);
            stopAutoplay();
        });
        track.addEventListener("pointerup", (event) => {
            const delta = event.clientX - startX;
            if (Math.abs(delta) > 45) goTo(current + (delta < 0 ? 1 : -1));
            startAutoplay();
        });

        startAutoplay();
    });
}

function normalizeWhatsAppPhone(value) {
    let phone = String(value || "").replace(/\D/g, "");
    if (!phone) return "";

    if (phone.startsWith("0")) phone = phone.slice(1);
    if (!phone.startsWith("549")) phone = `549${phone}`;

    return phone;
}

function setupMusic(tracks, playMode) {
    const widget = document.getElementById("audioWidget");
    const button = document.getElementById("btnMusic");
    const audio = document.getElementById("bgMusic");
    const selector = document.getElementById("audioTrackSelector");

    if (!widget || !button || !audio || !selector) return;

    if (!tracks.length) {
        widget.classList.add("is-hidden");
        document.querySelectorAll("[data-audio-trigger]").forEach((trigger) => trigger.remove());
        audio.removeAttribute("src");
        setMusicButtonPlaying(button, false);
        return;
    }

    let currentTrack = 0;
    let clearFirstInteractionActivation = () => { };
    audio.loop = false;
    audio.preload = "none";
    selector.innerHTML = tracks.map((track, index) => `<option value="${index}">${escapeHtml(track.name || `Pista ${index + 1}`)}</option>`).join("");
    selector.hidden = playMode === "playlist" || tracks.length === 1;
    widget.classList.remove("is-hidden");

    const loadTrack = (index, shouldPlay = false) => {
        currentTrack = (index + tracks.length) % tracks.length;
        selector.value = String(currentTrack);
        audio.src = tracks[currentTrack].src;
        if (shouldPlay) requestAudioPlay(audio);
    };

    const armFirstInteractionActivation = () => {
        if (!audio.paused) return;

        clearFirstInteractionActivation();
        const activate = (event) => {
            if (isAudioControlEvent(event)) return;

            clearFirstInteractionActivation();
            requestAudioPlay(audio);
        };
        const options = { capture: true, passive: true };

        document.addEventListener("pointerdown", activate, options);
        document.addEventListener("touchstart", activate, options);
        document.addEventListener("click", activate, options);
        clearFirstInteractionActivation = () => {
            document.removeEventListener("pointerdown", activate, options);
            document.removeEventListener("touchstart", activate, options);
            document.removeEventListener("click", activate, options);
            clearFirstInteractionActivation = () => { };
        };
    };

    audio.onplay = () => {
        clearFirstInteractionActivation();
        setMusicButtonPlaying(button, true);
    };
    audio.onpause = () => setMusicButtonPlaying(button, false);
    loadTrack(0);
    selector.onchange = () => loadTrack(Number(selector.value), !audio.paused);
    button.onclick = () => {
        clearFirstInteractionActivation();
        toggleMusic(audio, button);
    };
    document.querySelectorAll("[data-audio-trigger]").forEach((trigger) => {
        trigger.onclick = () => button.click();
    });
    audio.onended = () => {
        if (playMode !== "playlist" || tracks.length < 2) {
            setMusicButtonPlaying(button, false);
            return;
        }
        loadTrack(currentTrack + 1, true);
    };
    requestAudioPlay(audio, armFirstInteractionActivation);
}

function toggleMusic(audio) {
    if (audio.paused) {
        requestAudioPlay(audio);
        return;
    }

    audio.pause();
}

function requestAudioPlay(audio, onBlocked) {
    let playRequest;
    try {
        playRequest = audio.play();
    } catch {
        if (typeof onBlocked === "function") onBlocked();
        return null;
    }

    if (playRequest && typeof playRequest.catch === "function") {
        playRequest.catch(() => {
            if (typeof onBlocked === "function") onBlocked();
        });
    }
    return playRequest;
}

function setMusicButtonPlaying(button, isPlaying) {
    button.classList.toggle("is-paused", !isPlaying);
    button.setAttribute("aria-label", isPlaying ? "Pausar música" : "Reproducir música");
}

function isAudioControlEvent(event) {
    return Boolean(event.target?.closest?.("#audioWidget, [data-audio-trigger]"));
}

function renderState(message) {
    getApp().innerHTML = `
        <section class="state-panel">
            <p>${escapeHtml(message)}</p>
        </section>
    `;
    hideLoader();
}

function hideLoader() {
    const loader = document.getElementById("loadingOverlay");
    if (!loader) return;

    loader.classList.add("is-hidden");
    const removeLoader = () => loader.remove();
    loader.addEventListener("transitionend", removeLoader, { once: true });
    window.setTimeout(removeLoader, 750);
}

function getApp() {
    return document.getElementById("app");
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
}
