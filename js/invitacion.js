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
            "linear-gradient(135deg, rgba(50, 30, 17, 0.18), rgba(250, 236, 212, 0.58)), url('https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=85')"
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
            "linear-gradient(135deg, rgba(232, 250, 255, 0.7), rgba(83, 154, 198, 0.3)), url('https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=1800&q=85')"
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
            "linear-gradient(135deg, rgba(17, 58, 55, 0.15), rgba(227, 245, 224, 0.5)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=85')"
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
            "linear-gradient(135deg, rgba(240, 248, 252, 0.72), rgba(83, 113, 139, 0.18)), url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=85')"
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
            "linear-gradient(135deg, rgba(240, 248, 252, 0.72), rgba(83, 113, 139, 0.18)), url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=85')"
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
            "linear-gradient(135deg, rgba(255, 239, 247, 0.72), rgba(255, 177, 209, 0.34)), url('https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1800&q=85')"
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
            "linear-gradient(135deg, rgba(255, 239, 247, 0.72), rgba(255, 177, 209, 0.34)), url('https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1800&q=85')"
    },
    vintage: {
        primary: "#a36f47", secondary: "#f0dfc3", accent: "#4e3025", text: "#493229", muted: "#866653",
        surface: "rgba(250, 240, 218, 0.8)", surfaceStrong: "rgba(255, 247, 230, 0.92)", surfaceSoft: "rgba(255, 255, 255, 0.25)",
        line: "rgba(126, 83, 54, 0.28)", shadow: "rgba(78, 48, 37, 0.2)", heading: '"Cormorant Garamond", serif', body: '"Lato", sans-serif',
        button: "linear-gradient(135deg, #c09261 0%, #835333 100%)",
        background: "linear-gradient(135deg, rgba(96, 57, 35, 0.12), rgba(245, 225, 190, 0.52)), url('https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1800&q=85')"
    },
    "dorado-premium": {
        primary: "#c89b3c", secondary: "#fff8e7", accent: "#46351b", text: "#45351e", muted: "#8d7546",
        surface: "rgba(255, 250, 235, 0.82)", surfaceStrong: "rgba(255, 253, 244, 0.94)", surfaceSoft: "rgba(255, 255, 255, 0.32)",
        line: "rgba(200, 155, 60, 0.34)", shadow: "rgba(109, 76, 20, 0.2)", heading: '"Cinzel", serif', body: '"Montserrat", sans-serif',
        button: "linear-gradient(135deg, #e7c66b 0%, #a97819 100%)",
        background: "linear-gradient(135deg, rgba(255, 246, 211, 0.68), rgba(201, 153, 53, 0.2)), url('https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1800&q=85')"
    },
    tropical: {
        primary: "#0d9488", secondary: "#e5fff5", accent: "#075e54", text: "#16443d", muted: "#4f8175",
        surface: "rgba(239, 255, 247, 0.78)", surfaceStrong: "rgba(248, 255, 251, 0.92)", surfaceSoft: "rgba(255, 255, 255, 0.28)",
        line: "rgba(13, 148, 136, 0.25)", shadow: "rgba(4, 87, 78, 0.2)", heading: '"Poppins", sans-serif', body: '"Quicksand", sans-serif',
        button: "linear-gradient(135deg, #f5c84b 0%, #0d9488 100%)",
        background: "linear-gradient(135deg, rgba(226, 255, 241, 0.5), rgba(4, 120, 110, 0.2)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=85')"
    },
    botanico: {
        primary: "#4f8a5b", secondary: "#edf7e8", accent: "#244b31", text: "#294534", muted: "#66806a",
        surface: "rgba(244, 251, 237, 0.8)", surfaceStrong: "rgba(251, 255, 247, 0.94)", surfaceSoft: "rgba(255, 255, 255, 0.3)",
        line: "rgba(79, 138, 91, 0.28)", shadow: "rgba(34, 77, 43, 0.18)", heading: '"Cormorant Garamond", serif', body: '"Poppins", sans-serif',
        button: "linear-gradient(135deg, #91b96e 0%, #39704a 100%)",
        background: "linear-gradient(135deg, rgba(239, 250, 231, 0.58), rgba(64, 112, 72, 0.2)), url('https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1800&q=85')"
    },
    "infantil-pastel": {
        primary: "#d88fb2", secondary: "#fff2f7", accent: "#70445c", text: "#634656", muted: "#a57b91",
        surface: "rgba(255, 247, 251, 0.84)", surfaceStrong: "rgba(255, 252, 254, 0.95)", surfaceSoft: "rgba(255, 255, 255, 0.34)",
        line: "rgba(216, 143, 178, 0.3)", shadow: "rgba(112, 68, 92, 0.16)", heading: '"Dancing Script", cursive', body: '"Poppins", sans-serif',
        button: "linear-gradient(135deg, #f5b9d0 0%, #c875a0 100%)",
        background: "linear-gradient(135deg, rgba(255, 243, 249, 0.7), rgba(245, 190, 211, 0.35)), url('https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1800&q=85')"
    },
    mistico: {
        primary: "#a855f7", secondary: "#17152d", accent: "#f5e9ff", text: "#f2eaff", muted: "#c6b9e0",
        surface: "rgba(24, 21, 52, 0.78)", surfaceStrong: "rgba(35, 29, 70, 0.9)", surfaceSoft: "rgba(168, 85, 247, 0.12)",
        line: "rgba(192, 132, 252, 0.28)", shadow: "rgba(16, 10, 40, 0.45)", heading: '"Cinzel", serif', body: '"Montserrat", sans-serif',
        button: "linear-gradient(135deg, #22d3ee 0%, #9333ea 100%)",
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.72), rgba(88, 28, 135, 0.42)), url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1800&q=85')"
    },
    urbano: {
        primary: "#22d3ee", secondary: "#111827", accent: "#f8fafc", text: "#e2e8f0", muted: "#94a3b8",
        surface: "rgba(17, 24, 39, 0.82)", surfaceStrong: "rgba(31, 41, 55, 0.92)", surfaceSoft: "rgba(34, 211, 238, 0.1)",
        line: "rgba(34, 211, 238, 0.3)", shadow: "rgba(2, 6, 23, 0.5)", heading: '"Bebas Neue", sans-serif', body: '"Montserrat", sans-serif',
        button: "linear-gradient(135deg, #f43f5e 0%, #06b6d4 100%)",
        background: "linear-gradient(135deg, rgba(17, 24, 39, 0.7), rgba(8, 145, 178, 0.28)), url('https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1800&q=85')"
    },
    "infantil-dinamico": {
        primary: "#f97316", secondary: "#fff7ed", accent: "#164e63", text: "#164e63", muted: "#55758a",
        surface: "rgba(255, 250, 239, 0.82)", surfaceStrong: "rgba(255, 253, 247, 0.94)", surfaceSoft: "rgba(255, 255, 255, 0.32)",
        line: "rgba(249, 115, 22, 0.28)", shadow: "rgba(22, 78, 99, 0.2)", heading: '"Bebas Neue", sans-serif', body: '"Poppins", sans-serif',
        button: "linear-gradient(135deg, #facc15 0%, #f97316 100%)",
        background: "linear-gradient(135deg, rgba(255, 247, 218, 0.62), rgba(14, 165, 233, 0.2)), url('https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1800&q=85')"
    },
    romantico: {
        primary: "#d86b91", secondary: "#fff3f6", accent: "#71334d", text: "#633c4d", muted: "#a87588",
        surface: "rgba(255, 247, 249, 0.82)", surfaceStrong: "rgba(255, 252, 253, 0.95)", surfaceSoft: "rgba(255, 255, 255, 0.34)",
        line: "rgba(216, 107, 145, 0.3)", shadow: "rgba(113, 51, 77, 0.18)", heading: '"Great Vibes", cursive', body: '"Lato", sans-serif',
        button: "linear-gradient(135deg, #f2a8bd 0%, #c8547d 100%)",
        background: "linear-gradient(135deg, rgba(255, 241, 246, 0.64), rgba(216, 107, 145, 0.2)), url('https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1800&q=85')"
    },
    corporativo: {
        primary: "#1677b7", secondary: "#eef7fc", accent: "#123b5d", text: "#183b55", muted: "#658198",
        surface: "rgba(246, 251, 254, 0.86)", surfaceStrong: "rgba(253, 254, 255, 0.96)", surfaceSoft: "rgba(255, 255, 255, 0.38)",
        line: "rgba(22, 119, 183, 0.25)", shadow: "rgba(18, 59, 93, 0.18)", heading: '"Montserrat", sans-serif', body: '"Poppins", sans-serif',
        button: "linear-gradient(135deg, #38bdf8 0%, #155e95 100%)",
        background: "linear-gradient(135deg, rgba(239, 248, 253, 0.72), rgba(22, 119, 183, 0.16)), url('https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=85')"
    }
};

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

let countdownTimer = null;
let carouselTimers = [];

document.addEventListener("DOMContentLoaded", initInvitation);

async function initInvitation() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const devFixture = params.get("devFixture");

    if (!id && !devFixture) {
        renderState("ID de invitación no especificado.");
        return;
    }

    try {
        const data = devFixture
            ? await loadLocalPreviewFixture(devFixture)
            : await fetchEventById(id);
        const event = EventNormalizer.normalizeEvent(data, { fontFamilies: FONT_FAMILIES });
        const templateConfig = TemplateRegistry.resolveTemplate(event.template.slug || event.template_slug);
        const themeName = inferTheme(event, id, templateConfig);

        applyTemplateConfig(templateConfig);
        loadTemplateStylesheet(templateConfig);
        applyTheme(themeName, event.fontFamily, event.estilos);
        renderInvitation(event, templateConfig);
        hideLoader();
    } catch (error) {
        console.error(error);
        renderState("Invitación no encontrada");
    }
}

function loadTemplateStylesheet(templateConfig) {
    const href = templateConfig.stylesheet;
    let link = document.getElementById("template-stylesheet");

    if (!link) {
        link = document.createElement("link");
        link.id = "template-stylesheet";
        link.rel = "stylesheet";
        document.head.appendChild(link);
    }

    if (link.getAttribute("href") !== href) {
        link.setAttribute("href", href);
    }
}

async function fetchEventById(id) {
    const response = await fetch(`/api/eventos/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error("Invitación no encontrada");
    return response.json();
}

async function loadLocalPreviewFixture(name) {
    if (!isLocalPreviewHost()) {
        throw new Error("Preview local no disponible en este entorno.");
    }

    if (name !== "boda-civil-esencial") {
        throw new Error("Fixture de preview no permitido.");
    }

    const response = await fetch(`/__dev-fixtures/${encodeURIComponent(name)}.fixture.json`, {
        cache: "no-store"
    });
    if (!response.ok) throw new Error("Fixture de preview no encontrado.");
    return response.json();
}

function isLocalPreviewHost() {
    return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
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

    if (data.tema && THEMES[data.tema]) return data.tema;
    if (templateConfig.defaultTheme && THEMES[templateConfig.defaultTheme]) return templateConfig.defaultTheme;
    if (raw.includes("frozen") || raw.includes("nieve")) return "frozen";
    if (raw.includes("pesca") || raw.includes("pesc")) return "pesca";
    if (raw.includes("boda") || raw.includes("casamiento") || raw.includes("elegante")) return "elegante";
    if (raw.includes("minimalista") || raw.includes("minimal")) return "minimalista";
    if (raw.includes("fiesta") || raw.includes("cumple")) return "fiesta";

    return "fiesta";
}

function applyTheme(themeName, fontFamily, styles = {}) {
    const theme = THEMES[themeName] || THEMES.fiesta;
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
            closing: renderClosingPage
        },
        templateConfig,
        renderBrochureNavigation: (pageCount) => templateConfig.layout === "vertical" ? "" : renderBrochureNavigation(pageCount),
        getSectionImage: (section, pageIndex) => getSectionImage(event, section, pageIndex),
        warn: (message) => console.warn(message)
    };

    const html = SectionRenderer.renderSections(renderableSections, context).join("");

    getApp().innerHTML = html;
    document.querySelectorAll(".wedding-section").forEach((page, index) => {
        const section = renderableSections[index];
        const config = getSectionLayoutConfig(event, section, index);
        const image = getSectionImage(event, section, index);
        if (image) page.style.setProperty("--page-image", `url("${image}")`);
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
    setupRsvpConfirmation();
    startCountdown(event.fechaEvento);
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

    return `
        <section id="capa-1" class="wedding-section wedding-section--cover hero-section" data-section-type="${escapeAttr(section.type)}">
            ${image ? `<div class="bg-image-wrapper" aria-hidden="true"><img src="${escapeAttr(image)}" alt=""></div>` : ""}
            <div class="bg-overlay" aria-hidden="true"></div>
            ${renderHeroCopy(section, event)}
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
    const locationText = firstSectionValue(data.locationText, data.place, getLocationText(event));

    return `
        <section class="wedding-section wedding-section--location" data-section-type="${escapeAttr(section.type)}">
            <div class="wedding-content">
                ${data.message ? `<p class="page-message">${escapeHtml(data.message)}</p>` : ""}
                ${renderDetailsList([
                    renderDetail("calendar", "Fecha", firstSectionValue(data.dateText, event.fechaTexto)),
                    renderDetail("clock", "Horario", firstSectionValue(data.timeText, event.horarioTexto)),
                    renderDetail("pin", "Lugar", locationText)
                ])}
            </div>
            ${context.renderBrochureNavigation(context.pageCount)}
        </section>
    `;
}

function renderLocationPage(section, context) {
    const event = context.event;
    const data = section?.data || {};
    const locationText = firstSectionValue(data.locationText, data.place, getLocationText(event));
    const message = firstSectionValue(data.message, event.mensaje);
    const timeText = firstSectionValue(data.timeText, event.horarioTexto);
    const calendar = renderCalendarActions(event);

    return `
        <section class="wedding-section wedding-section--location" data-section-type="${escapeAttr(section.type)}">
            <div class="wedding-content">
                ${message ? `<p class="page-message">${escapeHtml(message)}</p>` : ""}
                ${renderDetailsList([
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

function renderConfirmationPage(section, context) {
    const event = context.event;
    const content = [
        context.templateConfig.layout === "vertical" ? "" : event.fechaEvento ? renderCountdownContent() : "",
        renderRsvpContent(event)
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
    const content = [
        data.title ? `<h2 class="section-title">${escapeHtml(data.title)}</h2>` : "",
        data.message ? `<p class="page-message">${escapeHtml(data.message)}</p>` : "",
        data.names ? `<p class="hero-date closing-names">${escapeHtml(data.names)}</p>` : ""
    ].filter(Boolean).join("");

    return `
        <section class="wedding-section wedding-section--confirmation" data-section-type="${escapeAttr(section.type)}">
            <div class="wedding-content">${content}</div>
            ${context.renderBrochureNavigation(context.pageCount)}
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

function firstSectionValue(...values) {
    const value = values.find((item) => typeof item === "string" && item.trim());
    return value ? value.trim() : "";
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
    const details = getCalendarDetails(event);
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

function renderCountdownContent() {
    return `
        <div class="countdown" id="countdown">
            <div class="time-card"><span id="dias">00</span><label>Días</label></div>
            <div class="time-card"><span id="horas">00</span><label>Hs</label></div>
            <div class="time-card"><span id="minutos">00</span><label>Min</label></div>
            <div class="time-card"><span id="segundos">00</span><label>Seg</label></div>
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

function renderRsvp(event) {
    return `
        <section class="invitation-section">
            ${renderRsvpContent(event)}
        </section>
    `;
}

function renderRsvpContent(event) {
    const contacts = event.contactosRSVP
        .map((contact) => ({ ...contact, telefono: normalizeWhatsAppPhone(contact.telefono) }))
        .filter((contact) => contact.telefono);
    if (!contacts.length) return "";

    const buttons = contacts
        .map((contact) => {
            const label = contact.nombre ? `Confirmar con ${escapeHtml(contact.nombre)}` : "Confirmar asistencia";
            return `
                <a class="button rsvp-button" href="https://wa.me/${contact.telefono}" data-phone="${contact.telefono}" target="_blank" rel="noopener noreferrer">
                    ${ICONS.whatsapp}
                    ${label}
                </a>
            `;
        })
        .join("");

    return `
        <div class="rsvp-block">
            ${event.confirmacionLimite ? `<p class="detail-value">Hasta el ${escapeHtml(event.confirmacionLimite)}</p>` : ""}
            <div class="actions">${buttons}</div>
        </div>
    `;
}

function setupRsvpConfirmation() {
    document.querySelectorAll(".rsvp-button").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            const text = "Confirmo mi asistencia al evento.";
            const url = `https://wa.me/${button.dataset.phone}?text=${encodeURIComponent(text)}`;
            window.open(url, "_blank", "noopener,noreferrer");
        });
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
        return;
    }

    let currentTrack = 0;
    audio.loop = false;
    selector.innerHTML = tracks.map((track, index) => `<option value="${index}">${escapeHtml(track.name || `Pista ${index + 1}`)}</option>`).join("");
    selector.hidden = playMode === "playlist" || tracks.length === 1;
    widget.classList.remove("is-hidden");

    const loadTrack = (index, shouldPlay = false) => {
        currentTrack = (index + tracks.length) % tracks.length;
        selector.value = String(currentTrack);
        audio.src = tracks[currentTrack].src;
        if (shouldPlay) audio.play().catch(() => { });
    };

    loadTrack(0);
    selector.onchange = () => loadTrack(Number(selector.value), !audio.paused);
    button.onclick = () => toggleMusic(audio, button);
    document.querySelectorAll("[data-audio-trigger]").forEach((trigger) => {
        trigger.onclick = () => button.click();
    });
    audio.onended = () => {
        if (playMode !== "playlist" || tracks.length < 2) {
            button.classList.add("is-paused");
            return;
        }
        loadTrack(currentTrack + 1, true);
    };
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

    const video = loader.querySelector("video");
    if (video) {
        video.pause();
        video.removeAttribute("src");
        video.querySelectorAll("source").forEach((source) => source.removeAttribute("src"));
        video.load();
    }

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
