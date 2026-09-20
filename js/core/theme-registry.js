(function (root, factory) {
    const registry = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = registry;
    }

    root.ThemeRegistry = registry;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const DEFAULT_THEME_SLUG = "fiesta";
    const RUNTIME_TOKEN_KEYS = Object.freeze([
        "primary", "secondary", "accent", "text", "muted", "surface", "surfaceStrong",
        "surfaceSoft", "line", "shadow", "heading", "body", "button", "background"
    ]);

    const THEMES = deepFreeze({
        elegante: theme("elegante", {
            primary: "#b88746", secondary: "#f7efe2", accent: "#2f1f16", text: "#241b16", muted: "#765d4c",
            surface: "rgba(255, 249, 240, 0.78)", surfaceStrong: "rgba(255, 252, 246, 0.9)", surfaceSoft: "rgba(255, 255, 255, 0.26)",
            line: "rgba(255, 255, 255, 0.48)", shadow: "rgba(48, 29, 15, 0.2)", heading: '"Playfair Display", Georgia, serif', body: '"Lato", Arial, sans-serif',
            button: "linear-gradient(135deg, #d8b36f 0%, #8e642b 100%)",
            background: "linear-gradient(135deg, rgba(50, 30, 17, 0.18), rgba(250, 236, 212, 0.58)), url('https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=85')"
        }),
        frozen: theme("frozen", {
            primary: "#6aaed6", secondary: "#e8f8ff", accent: "#134b72", text: "#12344d", muted: "#56839c",
            surface: "rgba(239, 250, 255, 0.76)", surfaceStrong: "rgba(250, 254, 255, 0.9)", surfaceSoft: "rgba(255, 255, 255, 0.28)",
            line: "rgba(255, 255, 255, 0.62)", shadow: "rgba(31, 91, 124, 0.18)", heading: '"Mountains of Christmas", cursive', body: '"Quicksand", Arial, sans-serif',
            button: "linear-gradient(135deg, #9fe2ff 0%, #4d9fcd 100%)",
            background: "linear-gradient(135deg, rgba(232, 250, 255, 0.7), rgba(83, 154, 198, 0.3)), url('https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=1800&q=85')"
        }),
        pesca: theme("pesca", {
            primary: "#2f8f92", secondary: "#edf7ee", accent: "#173e3b", text: "#17312f", muted: "#54706b",
            surface: "rgba(243, 250, 238, 0.76)", surfaceStrong: "rgba(249, 253, 245, 0.9)", surfaceSoft: "rgba(255, 255, 255, 0.24)",
            line: "rgba(255, 255, 255, 0.46)", shadow: "rgba(12, 48, 46, 0.2)", heading: '"Playfair Display", Georgia, serif', body: '"Quicksand", Arial, sans-serif',
            button: "linear-gradient(135deg, #75b867 0%, #1f777b 100%)",
            background: "linear-gradient(135deg, rgba(17, 58, 55, 0.15), rgba(227, 245, 224, 0.5)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=85')"
        }),
        minimalista: theme("minimalista", {
            primary: "#466a8d", secondary: "#edf4f8", accent: "#172b3d", text: "#142434", muted: "#64798b",
            surface: "rgba(246, 250, 253, 0.78)", surfaceStrong: "rgba(252, 254, 255, 0.9)", surfaceSoft: "rgba(255, 255, 255, 0.28)",
            line: "rgba(255, 255, 255, 0.54)", shadow: "rgba(25, 50, 72, 0.14)", heading: '"Playfair Display", Georgia, serif', body: '"Lato", Arial, sans-serif',
            button: "linear-gradient(135deg, #6f93b2 0%, #244966 100%)",
            background: "linear-gradient(135deg, rgba(240, 248, 252, 0.72), rgba(83, 113, 139, 0.18)), url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=85')"
        }),
        fiesta: theme("fiesta", {
            primary: "#d95f8a", secondary: "#fff0f4", accent: "#6d2147", text: "#432235", muted: "#95647a",
            surface: "rgba(255, 244, 249, 0.76)", surfaceStrong: "rgba(255, 250, 252, 0.9)", surfaceSoft: "rgba(255, 255, 255, 0.28)",
            line: "rgba(255, 255, 255, 0.52)", shadow: "rgba(168, 61, 103, 0.18)", heading: '"Mountains of Christmas", cursive', body: '"Quicksand", Arial, sans-serif',
            button: "linear-gradient(135deg, #f59bc3 0%, #d84683 100%)",
            background: "linear-gradient(135deg, rgba(255, 239, 247, 0.72), rgba(255, 177, 209, 0.34)), url('https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1800&q=85')"
        }),
        vintage: theme("vintage", {
            primary: "#a36f47", secondary: "#f0dfc3", accent: "#4e3025", text: "#493229", muted: "#866653",
            surface: "rgba(250, 240, 218, 0.8)", surfaceStrong: "rgba(255, 247, 230, 0.92)", surfaceSoft: "rgba(255, 255, 255, 0.25)",
            line: "rgba(126, 83, 54, 0.28)", shadow: "rgba(78, 48, 37, 0.2)", heading: '"Cormorant Garamond", serif', body: '"Lato", sans-serif',
            button: "linear-gradient(135deg, #c09261 0%, #835333 100%)",
            background: "linear-gradient(135deg, rgba(96, 57, 35, 0.12), rgba(245, 225, 190, 0.52)), url('https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1800&q=85')"
        }),
        "dorado-premium": theme("dorado-premium", {
            primary: "#c89b3c", secondary: "#fff8e7", accent: "#46351b", text: "#45351e", muted: "#8d7546",
            surface: "rgba(255, 250, 235, 0.82)", surfaceStrong: "rgba(255, 253, 244, 0.94)", surfaceSoft: "rgba(255, 255, 255, 0.32)",
            line: "rgba(200, 155, 60, 0.34)", shadow: "rgba(109, 76, 20, 0.2)", heading: '"Cinzel", serif', body: '"Montserrat", sans-serif',
            button: "linear-gradient(135deg, #e7c66b 0%, #a97819 100%)",
            background: "linear-gradient(135deg, rgba(255, 246, 211, 0.68), rgba(201, 153, 53, 0.2)), url('https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1800&q=85')"
        }),
        tropical: theme("tropical", {
            primary: "#0d9488", secondary: "#e5fff5", accent: "#075e54", text: "#16443d", muted: "#4f8175",
            surface: "rgba(239, 255, 247, 0.78)", surfaceStrong: "rgba(248, 255, 251, 0.92)", surfaceSoft: "rgba(255, 255, 255, 0.28)",
            line: "rgba(13, 148, 136, 0.25)", shadow: "rgba(4, 87, 78, 0.2)", heading: '"Poppins", sans-serif', body: '"Quicksand", sans-serif',
            button: "linear-gradient(135deg, #f5c84b 0%, #0d9488 100%)",
            background: "linear-gradient(135deg, rgba(226, 255, 241, 0.5), rgba(4, 120, 110, 0.2)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=85')"
        }),
        botanico: theme("botanico", {
            primary: "#4f8a5b", secondary: "#edf7e8", accent: "#244b31", text: "#294534", muted: "#66806a",
            surface: "rgba(244, 251, 237, 0.8)", surfaceStrong: "rgba(251, 255, 247, 0.94)", surfaceSoft: "rgba(255, 255, 255, 0.3)",
            line: "rgba(79, 138, 91, 0.28)", shadow: "rgba(34, 77, 43, 0.18)", heading: '"Cormorant Garamond", serif', body: '"Poppins", sans-serif',
            button: "linear-gradient(135deg, #91b96e 0%, #39704a 100%)",
            background: "linear-gradient(135deg, rgba(239, 250, 231, 0.58), rgba(64, 112, 72, 0.2)), url('https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1800&q=85')"
        }),
        "infantil-pastel": theme("infantil-pastel", {
            primary: "#d88fb2", secondary: "#fff2f7", accent: "#70445c", text: "#634656", muted: "#a57b91",
            surface: "rgba(255, 247, 251, 0.84)", surfaceStrong: "rgba(255, 252, 254, 0.95)", surfaceSoft: "rgba(255, 255, 255, 0.34)",
            line: "rgba(216, 143, 178, 0.3)", shadow: "rgba(112, 68, 92, 0.16)", heading: '"Dancing Script", cursive', body: '"Poppins", sans-serif',
            button: "linear-gradient(135deg, #f5b9d0 0%, #c875a0 100%)",
            background: "linear-gradient(135deg, rgba(255, 243, 249, 0.7), rgba(245, 190, 211, 0.35)), url('https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1800&q=85')"
        }),
        mistico: theme("mistico", {
            primary: "#a855f7", secondary: "#17152d", accent: "#f5e9ff", text: "#f2eaff", muted: "#c6b9e0",
            surface: "rgba(24, 21, 52, 0.78)", surfaceStrong: "rgba(35, 29, 70, 0.9)", surfaceSoft: "rgba(168, 85, 247, 0.12)",
            line: "rgba(192, 132, 252, 0.28)", shadow: "rgba(16, 10, 40, 0.45)", heading: '"Cinzel", serif', body: '"Montserrat", sans-serif',
            button: "linear-gradient(135deg, #22d3ee 0%, #9333ea 100%)",
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.72), rgba(88, 28, 135, 0.42)), url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1800&q=85')"
        }),
        urbano: theme("urbano", {
            primary: "#22d3ee", secondary: "#111827", accent: "#f8fafc", text: "#e2e8f0", muted: "#94a3b8",
            surface: "rgba(17, 24, 39, 0.82)", surfaceStrong: "rgba(31, 41, 55, 0.92)", surfaceSoft: "rgba(34, 211, 238, 0.1)",
            line: "rgba(34, 211, 238, 0.3)", shadow: "rgba(2, 6, 23, 0.5)", heading: '"Bebas Neue", sans-serif', body: '"Montserrat", sans-serif',
            button: "linear-gradient(135deg, #f43f5e 0%, #06b6d4 100%)",
            background: "linear-gradient(135deg, rgba(17, 24, 39, 0.7), rgba(8, 145, 178, 0.28)), url('https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1800&q=85')"
        }),
        "infantil-dinamico": theme("infantil-dinamico", {
            primary: "#f97316", secondary: "#fff7ed", accent: "#164e63", text: "#164e63", muted: "#55758a",
            surface: "rgba(255, 250, 239, 0.82)", surfaceStrong: "rgba(255, 253, 247, 0.94)", surfaceSoft: "rgba(255, 255, 255, 0.32)",
            line: "rgba(249, 115, 22, 0.28)", shadow: "rgba(22, 78, 99, 0.2)", heading: '"Bebas Neue", sans-serif', body: '"Poppins", sans-serif',
            button: "linear-gradient(135deg, #facc15 0%, #f97316 100%)",
            background: "linear-gradient(135deg, rgba(255, 247, 218, 0.62), rgba(14, 165, 233, 0.2)), url('https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1800&q=85')"
        }),
        romantico: theme("romantico", {
            primary: "#d86b91", secondary: "#fff3f6", accent: "#71334d", text: "#633c4d", muted: "#a87588",
            surface: "rgba(255, 247, 249, 0.82)", surfaceStrong: "rgba(255, 252, 253, 0.95)", surfaceSoft: "rgba(255, 255, 255, 0.34)",
            line: "rgba(216, 107, 145, 0.3)", shadow: "rgba(113, 51, 77, 0.18)", heading: '"Great Vibes", cursive', body: '"Lato", sans-serif',
            button: "linear-gradient(135deg, #f2a8bd 0%, #c8547d 100%)",
            background: "linear-gradient(135deg, rgba(255, 241, 246, 0.64), rgba(216, 107, 145, 0.2)), url('https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1800&q=85')"
        }),
        corporativo: theme("corporativo", {
            primary: "#1677b7", secondary: "#eef7fc", accent: "#123b5d", text: "#183b55", muted: "#658198",
            surface: "rgba(246, 251, 254, 0.86)", surfaceStrong: "rgba(253, 254, 255, 0.96)", surfaceSoft: "rgba(255, 255, 255, 0.38)",
            line: "rgba(22, 119, 183, 0.25)", shadow: "rgba(18, 59, 93, 0.18)", heading: '"Montserrat", sans-serif', body: '"Poppins", sans-serif',
            button: "linear-gradient(135deg, #38bdf8 0%, #155e95 100%)",
            background: "linear-gradient(135deg, rgba(239, 248, 253, 0.72), rgba(22, 119, 183, 0.16)), url('https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=85')"
        })
    });

    const LEGACY_ALIASES = Object.freeze({ minimal: "minimalista" });
    const LEGACY_THEMES = deepFreeze({
        infantil: {
            slug: "infantil",
            status: "legacy",
            tokenKeys: RUNTIME_TOKEN_KEYS,
            tokens: {
                primary: "#df5f95", secondary: "#fff0f6", accent: "#7a2d52", text: "#4a2637", muted: "#9b6278",
                surface: "rgba(255, 244, 249, 0.76)", surfaceStrong: "rgba(255, 250, 252, 0.9)", surfaceSoft: "rgba(255, 255, 255, 0.28)",
                line: "rgba(255, 255, 255, 0.52)", shadow: "rgba(168, 61, 103, 0.18)", heading: '"Mountains of Christmas", cursive', body: '"Quicksand", Arial, sans-serif',
                button: "linear-gradient(135deg, #f59bc3 0%, #d84683 100%)",
                background: "linear-gradient(135deg, rgba(255, 239, 247, 0.72), rgba(255, 177, 209, 0.34)), url('https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1800&q=85')"
            }
        }
    });

    function theme(slug, tokens) {
        return { slug, status: "active", tokenKeys: RUNTIME_TOKEN_KEYS, tokens };
    }

    function deepFreeze(value) {
        if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
        Object.values(value).forEach(deepFreeze);
        return Object.freeze(value);
    }

    function normalizeSlug(slug) {
        return String(slug || "").trim();
    }

    function hasTheme(slug) {
        return Object.prototype.hasOwnProperty.call(THEMES, normalizeSlug(slug));
    }

    function getTheme(slug) {
        return THEMES[normalizeSlug(slug)];
    }

    function listThemes() {
        return Object.values(THEMES);
    }

    function resolveTheme(slug, options = {}) {
        const normalized = normalizeSlug(slug);
        const canonical = getTheme(normalized);
        if (canonical) return canonical;

        const aliasTarget = LEGACY_ALIASES[normalized];
        if (aliasTarget) return getTheme(aliasTarget);
        if (Object.prototype.hasOwnProperty.call(LEGACY_THEMES, normalized)) return LEGACY_THEMES[normalized];

        return options.fallback === false ? undefined : getTheme(DEFAULT_THEME_SLUG);
    }

    return {
        DEFAULT_THEME_SLUG,
        RUNTIME_TOKEN_KEYS,
        THEMES,
        LEGACY_ALIASES,
        hasTheme,
        getTheme,
        listThemes,
        resolveTheme,
        has: hasTheme,
        get: getTheme,
        list: listThemes
    };
});
