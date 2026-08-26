const THEMES = {
    elegante: {
        primary: "#b88746",
        secondary: "#f7efe2",
        accent: "#2f1f16",
        text: "#241b16",
        muted: "#765d4c",
        surface: "rgba(255, 249, 240, 0.78)",
        surfaceStrong: "rgba(255, 252, 246, 0.9)",
        surfaceSoft: "rgba(255, 255, 255, 0.26)",
        line: "rgba(255, 255, 255, 0.48)",
        shadow: "rgba(48, 29, 15, 0.2)",
        heading: '"Playfair Display", Georgia, serif',
        body: '"Lato", Arial, sans-serif',
        button: "linear-gradient(135deg, #d8b36f 0%, #8e642b 100%)",
        background:
            "linear-gradient(135deg, rgba(50, 30, 17, 0.18), rgba(250, 236, 212, 0.58)), url('https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=85')",
        watermark:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><g fill="none" stroke="#8e642b" stroke-width="5" stroke-linecap="round"><path d="M91 26c23 25 47 39 76 42-23 17-37 38-41 66-21-18-44-28-70-30 21-20 32-45 35-78Z"/><path d="M58 102c-19 14-31 31-37 52 22-9 42-10 62-3-10-16-18-31-25-49Z"/></g></svg>'
    },
    frozen: {
        primary: "#6aaed6",
        secondary: "#e8f8ff",
        accent: "#134b72",
        text: "#12344d",
        muted: "#56839c",
        surface: "rgba(239, 250, 255, 0.76)",
        surfaceStrong: "rgba(250, 254, 255, 0.9)",
        surfaceSoft: "rgba(255, 255, 255, 0.28)",
        line: "rgba(255, 255, 255, 0.62)",
        shadow: "rgba(31, 91, 124, 0.18)",
        heading: '"Mountains of Christmas", cursive',
        body: '"Quicksand", Arial, sans-serif',
        button: "linear-gradient(135deg, #9fe2ff 0%, #4d9fcd 100%)",
        background:
            "linear-gradient(135deg, rgba(232, 250, 255, 0.7), rgba(83, 154, 198, 0.3)), url('https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=1800&q=85')",
        watermark:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><g fill="none" stroke="#4d9fcd" stroke-width="5" stroke-linecap="round"><path d="M90 14v152M14 90h152M36 36l108 108M144 36 36 144"/><path d="m90 14 16 24M90 14 74 38M90 166l16-24M90 166l-16-24M14 90l24-16M14 90l24 16M166 90l-24-16M166 90l-24 16"/></g></svg>'
    },
    pesca: {
        primary: "#2f8f92",
        secondary: "#edf7ee",
        accent: "#173e3b",
        text: "#17312f",
        muted: "#54706b",
        surface: "rgba(243, 250, 238, 0.76)",
        surfaceStrong: "rgba(249, 253, 245, 0.9)",
        surfaceSoft: "rgba(255, 255, 255, 0.24)",
        line: "rgba(255, 255, 255, 0.46)",
        shadow: "rgba(12, 48, 46, 0.2)",
        heading: '"Playfair Display", Georgia, serif',
        body: '"Quicksand", Arial, sans-serif',
        button: "linear-gradient(135deg, #75b867 0%, #1f777b 100%)",
        background:
            "linear-gradient(135deg, rgba(17, 58, 55, 0.15), rgba(227, 245, 224, 0.5)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=85')",
        watermark:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><g fill="none" stroke="#1f777b" stroke-width="5" stroke-linecap="round"><path d="M39 143C96 113 128 72 141 20"/><path d="M141 20c15 16 20 38 8 57"/><path d="M62 132c-16 1-28-6-36-20 16-7 31-5 43 7"/><path d="M42 112c10 0 18 8 18 18"/></g></svg>'
    },
    minimal: {
        primary: "#466a8d",
        secondary: "#edf4f8",
        accent: "#172b3d",
        text: "#142434",
        muted: "#64798b",
        surface: "rgba(246, 250, 253, 0.78)",
        surfaceStrong: "rgba(252, 254, 255, 0.9)",
        surfaceSoft: "rgba(255, 255, 255, 0.28)",
        line: "rgba(255, 255, 255, 0.54)",
        shadow: "rgba(25, 50, 72, 0.14)",
        heading: '"Playfair Display", Georgia, serif',
        body: '"Lato", Arial, sans-serif',
        button: "linear-gradient(135deg, #6f93b2 0%, #244966 100%)",
        background:
            "linear-gradient(135deg, rgba(240, 248, 252, 0.72), rgba(83, 113, 139, 0.18)), url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=85')",
        watermark:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><g fill="none" stroke="#244966" stroke-width="5" stroke-linecap="round"><path d="M32 118c34-6 54-24 61-54 16 24 35 37 57 40-28 13-45 31-50 55-16-22-39-35-68-41Z"/><path d="M39 53h102"/></g></svg>'
    },
    minimalista: {
        primary: "#466a8d",
        secondary: "#edf4f8",
        accent: "#172b3d",
        text: "#142434",
        muted: "#64798b",
        surface: "rgba(246, 250, 253, 0.78)",
        surfaceStrong: "rgba(252, 254, 255, 0.9)",
        surfaceSoft: "rgba(255, 255, 255, 0.28)",
        line: "rgba(255, 255, 255, 0.54)",
        shadow: "rgba(25, 50, 72, 0.14)",
        heading: '"Playfair Display", Georgia, serif',
        body: '"Lato", Arial, sans-serif',
        button: "linear-gradient(135deg, #6f93b2 0%, #244966 100%)",
        background:
            "linear-gradient(135deg, rgba(240, 248, 252, 0.72), rgba(83, 113, 139, 0.18)), url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=85')",
        watermark:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><g fill="none" stroke="#244966" stroke-width="5" stroke-linecap="round"><path d="M32 118c34-6 54-24 61-54 16 24 35 37 57 40-28 13-45 31-50 55-16-22-39-35-68-41Z"/><path d="M39 53h102"/></g></svg>'
    },
    fiesta: {
        primary: "#d95f8a",
        secondary: "#fff0f4",
        accent: "#6d2147",
        text: "#432235",
        muted: "#95647a",
        surface: "rgba(255, 244, 249, 0.76)",
        surfaceStrong: "rgba(255, 250, 252, 0.9)",
        surfaceSoft: "rgba(255, 255, 255, 0.28)",
        line: "rgba(255, 255, 255, 0.52)",
        shadow: "rgba(168, 61, 103, 0.18)",
        heading: '"Mountains of Christmas", cursive',
        body: '"Quicksand", Arial, sans-serif',
        button: "linear-gradient(135deg, #f59bc3 0%, #d84683 100%)",
        background:
            "linear-gradient(135deg, rgba(255, 239, 247, 0.72), rgba(255, 177, 209, 0.34)), url('https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1800&q=85')",
        watermark:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><g fill="none" stroke="#d84683" stroke-width="5" stroke-linecap="round"><path d="M90 39c12-23 52-20 58 8 8 38-42 70-58 88-16-18-66-50-58-88 6-28 46-31 58-8Z"/><path d="M44 133c23 13 69 14 92 0"/></g></svg>'
    },
    infantil: {
        primary: "#df5f95",
        secondary: "#fff0f6",
        accent: "#7a2d52",
        text: "#4a2637",
        muted: "#9b6278",
        surface: "rgba(255, 244, 249, 0.76)",
        surfaceStrong: "rgba(255, 250, 252, 0.9)",
        surfaceSoft: "rgba(255, 255, 255, 0.28)",
        line: "rgba(255, 255, 255, 0.52)",
        shadow: "rgba(168, 61, 103, 0.18)",
        heading: '"Mountains of Christmas", cursive',
        body: '"Quicksand", Arial, sans-serif',
        button: "linear-gradient(135deg, #f59bc3 0%, #d84683 100%)",
        background:
            "linear-gradient(135deg, rgba(255, 239, 247, 0.72), rgba(255, 177, 209, 0.34)), url('https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1800&q=85')",
        watermark:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><g fill="none" stroke="#d84683" stroke-width="5" stroke-linecap="round"><path d="M90 39c12-23 52-20 58 8 8 38-42 70-58 88-16-18-66-50-58-88 6-28 46-31 58-8Z"/><path d="M44 133c23 13 69 14 92 0"/></g></svg>'
    }
};

const ICONS = {
    calendar: '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h2v3H7V2Zm8 0h2v3h-2V2ZM4 5h16a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 6v9h16v-9H4Zm0-2h16V7H4v2Z"/></svg>',
    map: '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m15 19-6-2.1-5 1.95V5l5-2 6 2.1L20 3.15V17l-5 2Zm-1-2.35V6.85l-4-1.4v9.8l4 1.4Zm2-.05 2-.78V6.08l-2 .78v9.74ZM6 15.92l2-.78V5.4l-2 .78v9.74Z"/></svg>',
    whatsapp: '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.56 2 2.1 6.35 2.1 11.7c0 1.9.57 3.72 1.63 5.31L2 22l5.18-1.62a10.16 10.16 0 0 0 4.86 1.24c5.48 0 9.94-4.35 9.94-9.7S17.52 2 12.04 2Zm0 17.86c-1.54 0-3.03-.42-4.33-1.22l-.31-.19-3.06.96 1-2.9-.21-.32a7.86 7.86 0 0 1-1.28-4.29c0-4.38 3.67-7.94 8.19-7.94 4.51 0 8.18 3.56 8.18 7.94 0 4.39-3.67 7.96-8.18 7.96Zm4.48-5.95c-.24-.12-1.43-.69-1.65-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.02-.37-1.94-1.17-.72-.64-1.2-1.42-1.34-1.66-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.27-.74-1.74-.2-.45-.39-.39-.54-.4h-.46c-.16 0-.42.06-.64.3-.22.24-.84.81-.84 1.97s.86 2.29.98 2.45c.12.16 1.7 2.53 4.1 3.55.57.25 1.02.39 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.43-.57 1.63-1.12.2-.55.2-1.03.14-1.12-.06-.1-.22-.16-.46-.28Z"/></svg>'
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
    "bebas-neue": '"Bebas Neue", sans-serif'
};

let countdownTimer = null;
let carouselTimers = [];

document.addEventListener("DOMContentLoaded", initInvitation);

async function initInvitation() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
        renderState("ID de invitación no especificado.");
        return;
    }

    try {
        const response = await fetch(`/api/eventos/${encodeURIComponent(id)}`);
        if (!response.ok) throw new Error("Invitación no encontrada");

        const data = await response.json();
        const themeName = inferTheme(data, id);
        const event = normalizeEvent(data);

        applyTheme(themeName, event.fontFamily);
        renderInvitation(event);
        hideLoader();
    } catch (error) {
        console.error(error);
        renderState("Invitación no encontrada");
    }
}

function normalizeEvent(data) {
    const multimedia = data.multimedia || {};

    return {
        nombre: data.nombre || "",
        subtitulo: data.subtitulo || "Celebración",
        fontFamily: FONT_FAMILIES[data.fontFamily || data.fuente] || FONT_FAMILIES.playfair,
        fechaEvento: data.fechaEvento || data.fecha || "",
        fechaTexto: data.fechaTexto || data.fecha || "",
        horarioTexto: data.horarioTexto || data.horario || "",
        lugarNombre: data.lugarNombre || data.lugar || "",
        lugarDireccion: data.lugarDireccion || data.direccion || "",
        googleMapsUrl: data.googleMapsUrl || data.linkMaps || "",
        googleCalendarUrl: data.googleCalendarUrl || "",
        confirmacionLimite: data.confirmacionLimite || "",
        estilos: data.estilos || {},
        contactosRSVP: data.contactosRSVP || legacyContacts(data.confirmacion),
        multimedia: {
            personajeHeader: multimedia.personajeHeader || "",
            personajeSeparador: multimedia.personajeSeparador || "",
            galeria: Array.isArray(multimedia.galeria) ? multimedia.galeria : [],
            musica: multimedia.musica || data.musica || "",
            marcaAgua: multimedia.marcaAgua || ""
        }
    };
}

function inferTheme(data, id) {
    const raw = `${data.tema || ""} ${id || ""} ${data.nombre || ""} ${data.subtitulo || ""}`.toLowerCase();

    if (data.tema && THEMES[data.tema]) return data.tema;
    if (raw.includes("frozen") || raw.includes("nieve")) return "frozen";
    if (raw.includes("pesca") || raw.includes("pesc")) return "pesca";
    if (raw.includes("boda") || raw.includes("casamiento") || raw.includes("elegante")) return "elegante";
    if (raw.includes("minimalista") || raw.includes("minimal")) return "minimalista";
    if (raw.includes("fiesta") || raw.includes("cumple")) return "fiesta";

    return "fiesta";
}

function applyTheme(themeName, fontFamily) {
    const theme = THEMES[themeName] || THEMES.fiesta;
    const root = document.documentElement;

    document.body.dataset.theme = themeName;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.primary);

    root.style.setProperty("--primary-color", theme.primary);
    root.style.setProperty("--secondary-color", theme.secondary);
    root.style.setProperty("--accent-color", theme.accent);
    root.style.setProperty("--text-color", theme.text);
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
    root.style.setProperty("--watermark-image", `url("data:image/svg+xml,${encodeURIComponent(theme.watermark)}")`);
}

function renderInvitation(event) {
    document.title = event.nombre ? `Invitación de ${event.nombre}` : "Invitación Digital";

    const html = [
        renderHero(event),
        renderDetails(event),
        renderSeparator(event.multimedia.personajeSeparador),
        renderCountdown(),
        renderGallery(event.multimedia.galeria),
        renderRsvp(event),
        renderWatermarkAnchor(event, "watermark-end")
    ].join("");

    getApp().innerHTML = html;
    setupMusic(event.multimedia.musica);
    setupCarousel();
    startCountdown(event.fechaEvento);
}

function renderHero(event) {
    const flyerClass = event.estilos.efectoFlyer === false ? "" : "hero-media-frame--glow";

    return `
        <section class="invitation-section hero-section">
            ${renderWatermark(event, "watermark-start")}
            ${event.multimedia.personajeHeader ? `
                <div class="hero-media-frame ${flyerClass}">
                    <img class="hero-media" src="${escapeAttr(event.multimedia.personajeHeader)}" alt="">
                </div>
            ` : ""}
            <p class="eyebrow">${escapeHtml(event.subtitulo)}</p>
            <h1 class="title">${escapeHtml(event.nombre)}</h1>
            ${event.googleCalendarUrl ? `
                <div class="actions">
                    <a class="button" href="${escapeAttr(event.googleCalendarUrl)}" target="_blank" rel="noopener noreferrer">
                        ${ICONS.calendar}
                        Agendar evento
                    </a>
                </div>
            ` : ""}
        </section>
    `;
}

function renderDetails(event) {
    return `
        <section class="invitation-section details-section">
            ${renderWatermark(event, "watermark-middle")}
            ${renderDetail("calendar", "Fecha", event.fechaTexto)}
            ${renderDetail("clock", "Horario", event.horarioTexto)}
            ${renderDetail("pin", "Lugar", event.lugarNombre)}
            ${renderDetail("home", "Dirección", event.lugarDireccion)}
            ${event.googleMapsUrl ? `
                <div class="actions">
                    <a class="button" href="${escapeAttr(event.googleMapsUrl)}" target="_blank" rel="noopener noreferrer">
                        ${ICONS.map}
                        Cómo llegar
                    </a>
                </div>
            ` : ""}
        </section>
    `;
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

function renderWatermark(event, position) {
    if (!event.multimedia.marcaAgua) return "";

    return `<img class="watermark ${position}" src="${escapeAttr(event.multimedia.marcaAgua)}" alt="" aria-hidden="true">`;
}

function renderWatermarkAnchor(event, position) {
    if (!event.multimedia.marcaAgua) return "";

    return `<div class="watermark-anchor"><img class="watermark ${position}" src="${escapeAttr(event.multimedia.marcaAgua)}" alt="" aria-hidden="true"></div>`;
}

function renderSeparator(src) {
    if (!src) return "";

    return `
        <section class="invitation-section">
            <img class="separator-media" src="${escapeAttr(src)}" alt="">
        </section>
    `;
}

function renderCountdown() {
    return `
        <section class="invitation-section">
            <p class="eyebrow">Cuenta regresiva</p>
            <h2 class="section-title">Faltan</h2>
            <div class="countdown" id="countdown">
                <div class="time-card"><span id="dias">00</span><label>Días</label></div>
                <div class="time-card"><span id="horas">00</span><label>Hs</label></div>
                <div class="time-card"><span id="minutos">00</span><label>Min</label></div>
                <div class="time-card"><span id="segundos">00</span><label>Seg</label></div>
            </div>
        </section>
    `;
}

function renderGallery(images) {
    if (!images.length) return "";

    if (images.length === 1) {
        return `
            <section class="invitation-section">
                <p class="eyebrow">Recuerdos</p>
                <h2 class="section-title">Galería</h2>
                <div class="gallery">
                    <img src="${escapeAttr(images[0])}" alt="Foto de la invitación" loading="lazy">
                </div>
            </section>
        `;
    }

    const items = images
        .map((src, index) => `
            <figure class="carousel-slide" aria-label="Foto ${index + 1} de ${images.length}">
                <img src="${escapeAttr(src)}" alt="Foto de la invitación" loading="lazy">
            </figure>
        `)
        .join("");
    const dots = images
        .map((_, index) => `
            <button class="carousel-dot${index === 0 ? " is-active" : ""}" type="button" data-slide="${index}" aria-label="Ver foto ${index + 1}"></button>
        `)
        .join("");

    return `
        <section class="invitation-section">
            <p class="eyebrow">Recuerdos</p>
            <h2 class="section-title">Galería</h2>
            <div class="carousel" data-carousel>
                <div class="carousel-viewport">
                    <div class="carousel-track">${items}</div>
                </div>
                <button class="carousel-control prev" type="button" data-carousel-prev aria-label="Foto anterior">
                    <span aria-hidden="true">‹</span>
                </button>
                <button class="carousel-control next" type="button" data-carousel-next aria-label="Foto siguiente">
                    <span aria-hidden="true">›</span>
                </button>
                <div class="carousel-dots">${dots}</div>
            </div>
        </section>
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

function renderRsvp(event) {
    const contacts = event.contactosRSVP
        .map((contact) => ({ ...contact, telefono: normalizeWhatsAppPhone(contact.telefono) }))
        .filter((contact) => contact.telefono);
    if (!contacts.length) return "";

    const buttons = contacts
        .map((contact) => {
            const message = encodeURIComponent(`Hola ${contact.nombre || ""}, confirmo mi asistencia al evento de ${event.nombre}.`);

            return `
                <a class="button" href="https://api.whatsapp.com/send?phone=${contact.telefono}&text=${message}" target="_blank" rel="noopener noreferrer">
                    ${ICONS.whatsapp}
                    Confirmar con ${escapeHtml(contact.nombre || "contacto")}
                </a>
            `;
        })
        .join("");

    return `
        <section class="invitation-section">
            <p class="eyebrow">Asistencia</p>
            <h2 class="section-title">Confirmar</h2>
            ${event.confirmacionLimite ? `<p class="detail-value">Hasta el ${escapeHtml(event.confirmacionLimite)}</p>` : ""}
            <div class="actions">${buttons}</div>
        </section>
    `;
}

function normalizeWhatsAppPhone(value) {
    let phone = String(value || "").replace(/\D/g, "");
    if (!phone) return "";

    if (phone.startsWith("0")) phone = phone.slice(1);
    if (!phone.startsWith("549")) phone = `549${phone}`;

    return phone;
}

function setupMusic(src) {
    const button = document.getElementById("btnMusic");
    const audio = document.getElementById("bgMusic");

    if (!button || !audio) return;

    if (!src) {
        button.classList.add("is-hidden");
        audio.removeAttribute("src");
        return;
    }

    audio.src = src;
    button.classList.remove("is-hidden");
    button.onclick = () => toggleMusic(audio, button);
}

function toggleMusic(audio, button) {
    if (audio.paused) {
        audio.play();
        button.classList.remove("is-paused");
        button.setAttribute("aria-label", "Pausar música");
        return;
    }

    audio.pause();
    button.classList.add("is-paused");
    button.setAttribute("aria-label", "Reproducir música");
}

function startCountdown(dateValue) {
    const target = new Date(dateValue).getTime();
    if (Number.isNaN(target)) return;

    clearInterval(countdownTimer);

    const update = () => {
        const diff = target - Date.now();

        if (diff <= 0) {
            const countdown = document.getElementById("countdown");
            if (countdown) {
                countdown.innerHTML = '<div class="time-card" style="grid-column: 1 / -1;"><span>Hoy</span><label>Es el día</label></div>';
            }
            clearInterval(countdownTimer);
            return;
        }

        setCountdownText("dias", Math.floor(diff / (1000 * 60 * 60 * 24)));
        setCountdownText("horas", Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
        setCountdownText("minutos", Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
        setCountdownText("segundos", Math.floor((diff % (1000 * 60)) / 1000));
    };

    update();
    countdownTimer = setInterval(update, 1000);
}

function setCountdownText(id, value) {
    const element = document.getElementById(id);
    if (element) element.innerText = String(value).padStart(2, "0");
}

function legacyContacts(confirmacion) {
    if (!confirmacion) return [];

    return [
        { nombre: confirmacion.nombre1, telefono: confirmacion.tel1 },
        { nombre: confirmacion.nombre2, telefono: confirmacion.tel2 }
    ].filter((contact) => contact.telefono);
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
    loader.addEventListener("transitionend", () => loader.remove(), { once: true });
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
