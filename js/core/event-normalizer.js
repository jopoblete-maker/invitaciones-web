(function (root, factory) {
    const schema = typeof require === "function"
        ? require("./event-schema")
        : root.EventSchema;
    const normalizer = factory(schema);

    if (typeof module === "object" && module.exports) {
        module.exports = normalizer;
    }

    root.EventNormalizer = normalizer;
})(typeof globalThis !== "undefined" ? globalThis : this, function (schema) {
    const CURRENT_SCHEMA_VERSION = schema?.CURRENT_SCHEMA_VERSION || 1;
    const LEGACY_SECTION_MAP = schema?.LEGACY_SECTION_MAP || [
        { id: "legacy-capa-1", type: "hero", order: 10 },
        { id: "legacy-capa-2", type: "location", order: 20 },
        { id: "legacy-capa-3", type: "rsvp", order: 30 }
    ];

    const DEFAULT_FONT_FAMILY = '"Playfair Display", serif';

    function normalizeEvent(rawEvent, options = {}) {
        const data = isPlainObject(rawEvent) ? rawEvent : {};
        const normalized = hasNewSchema(data)
            ? normalizeNewSchema(data, options)
            : normalizeLegacyEvent(data, options);

        return {
            ...normalized,
            schema_version: normalized.schema_version || CURRENT_SCHEMA_VERSION,
            sections: normalizeSections(normalized.sections)
        };
    }

    function hasNewSchema(data) {
        return Boolean(data.schema_version && Array.isArray(data.sections));
    }

    function normalizeLegacyEvent(data, options) {
        const multimedia = isPlainObject(data.multimedia) ? data.multimedia : {};
        const capas = isPlainObject(multimedia.capas) ? multimedia.capas : {};
        const media = {
            capas: {
                portada: firstString(capas.portada, multimedia.personajeHeader, multimedia.galeria?.[0]),
                encuentro: firstString(capas.encuentro, multimedia.personajeSeparador, multimedia.galeria?.[1]),
                confirmacion: firstString(capas.confirmacion, multimedia.fondoVentana3, multimedia.galeria?.[2])
            },
            personajeHeader: firstString(multimedia.personajeHeader),
            personajeSeparador: firstString(multimedia.personajeSeparador),
            fondoVentana3: firstString(multimedia.fondoVentana3),
            galeria: Array.isArray(multimedia.galeria) ? multimedia.galeria : []
        };
        const music = normalizeMusic({
            tracks: multimedia.audios || data.audios,
            source: multimedia.musica || data.musica,
            playMode: multimedia.audioPlayMode || data.audioPlayMode
        });
        const location = normalizeLocation({
            name: data.lugarNombre || data.lugar,
            address: data.lugarDireccion || data.direccion,
            mapsUrl: data.googleMapsUrl || data.linkMaps
        });
        const rsvp = normalizeRsvp({
            deadline: data.confirmacionLimite,
            contacts: data.contactosRSVP || contactsFromConfirmation(data.confirmacion)
        });
        const templateSlug = firstString(data.template?.slug, data.template_slug, data.datos?.template_slug);
        const eventType = firstString(data.event?.type, data.tipo, data.type);

        return buildRendererShape(data, options, {
            schema_version: data.schema_version,
            event: {
                type: eventType,
                title: firstString(data.nombre),
                subtitle: firstString(data.subtitulo),
                message: firstString(data.mensaje, data.bendicion, data.dedicatoria),
                date: firstString(data.fechaEvento, data.fecha),
                dateText: firstString(data.fechaTexto, data.fecha),
                timeText: firstString(data.horarioTexto, data.horario)
            },
            template: { slug: templateSlug },
            theme: normalizeTheme(data.theme || data.tema, data.estilos),
            media,
            music,
            location,
            rsvp,
            sections: legacySections(media, location, rsvp, data)
        });
    }

    function normalizeNewSchema(data, options) {
        const event = isPlainObject(data.event) ? data.event : {};
        const template = isPlainObject(data.template) ? data.template : {};
        const theme = normalizeTheme(data.theme, data.estilos);
        const media = normalizeMedia(data.media || data.multimedia);
        const music = normalizeMusic(data.music || data.multimedia || {});
        const location = normalizeLocation(data.location || {});
        const rsvp = normalizeRsvp(data.rsvp || {});

        return buildRendererShape(data, options, {
            event: {
                type: firstString(event.type),
                title: firstString(event.title, event.name, data.nombre),
                subtitle: firstString(event.subtitle, data.subtitulo),
                message: firstString(event.message, data.mensaje),
                date: firstString(event.date, event.dateTime, data.fechaEvento, data.fecha),
                dateText: firstString(event.dateText, event.displayDate, data.fechaTexto),
                timeText: firstString(event.timeText, event.displayTime, data.horarioTexto)
            },
            template: { slug: firstString(template.slug, data.template_slug, data.datos?.template_slug) },
            theme,
            media,
            music,
            location,
            rsvp,
            sections: data.sections
        });
    }

    function buildRendererShape(data, options, model) {
        const fontFamilies = options.fontFamilies || {};
        const fontKey = data.fontFamily || data.fuente || model.theme?.fontFamily;
        const templateSlug = model.template.slug || "";
        const eventType = model.event.type || "";

        return {
            schema_version: model.schema_version,
            event: {
                type: eventType,
                title: model.event.title,
                subtitle: model.event.subtitle,
                message: model.event.message,
                date: model.event.date,
                dateText: model.event.dateText,
                timeText: model.event.timeText
            },
            template: { slug: templateSlug },
            theme: model.theme,
            media: model.media,
            music: model.music,
            location: model.location,
            rsvp: model.rsvp,
            sections: model.sections,
            nombre: model.event.title,
            datos: isPlainObject(data.datos) ? data.datos : {},
            template_slug: templateSlug,
            subtitulo: model.event.subtitle,
            mensaje: model.event.message,
            fontFamily: fontFamilies[fontKey] || fontKey || DEFAULT_FONT_FAMILY,
            fechaEvento: model.event.date,
            fechaTexto: model.event.dateText,
            horarioTexto: model.event.timeText,
            lugarNombre: model.location.name,
            lugarDireccion: model.location.address,
            googleMapsUrl: model.location.mapsUrl,
            googleCalendarUrl: firstString(data.googleCalendarUrl, model.location.calendarUrl),
            audioPlayMode: model.music.playMode,
            confirmacionLimite: model.rsvp.deadline,
            tema: model.theme.slug,
            estilos: model.theme.styles,
            layoutConfig: normalizeLayoutConfig(data.layoutConfig),
            contactosRSVP: model.rsvp.contacts,
            multimedia: {
                capas: model.media.capas,
                personajeHeader: model.media.personajeHeader,
                personajeSeparador: model.media.personajeSeparador,
                fondoVentana3: model.media.fondoVentana3,
                galeria: model.media.galeria,
                musica: model.music.source,
                audios: model.music.tracks,
                audioPlayMode: model.music.playMode
            }
        };
    }

    function normalizeMedia(value) {
        const media = isPlainObject(value) ? value : {};
        const capas = isPlainObject(media.capas) ? media.capas : {};
        return {
            capas: {
                portada: firstString(capas.portada, media.hero, media.personajeHeader, media.galeria?.[0]),
                encuentro: firstString(capas.encuentro, media.location, media.personajeSeparador, media.galeria?.[1]),
                confirmacion: firstString(capas.confirmacion, media.rsvp, media.fondoVentana3, media.galeria?.[2])
            },
            personajeHeader: firstString(media.personajeHeader),
            personajeSeparador: firstString(media.personajeSeparador),
            fondoVentana3: firstString(media.fondoVentana3),
            galeria: Array.isArray(media.galeria) ? media.galeria : []
        };
    }

    function normalizeMusic(value) {
        const music = isPlainObject(value) ? value : {};
        const source = firstString(music.source, music.src, music.musica);
        return {
            source,
            tracks: normalizeAudioTracks(music.tracks || music.audios, source),
            playMode: firstString(music.playMode, music.audioPlayMode) || "selector"
        };
    }

    function normalizeLocation(value) {
        const location = isPlainObject(value) ? value : {};
        return {
            name: firstString(location.name, location.lugarNombre),
            address: firstString(location.address, location.lugarDireccion),
            mapsUrl: firstString(location.mapsUrl, location.googleMapsUrl, location.linkMaps),
            calendarUrl: firstString(location.calendarUrl, location.googleCalendarUrl)
        };
    }

    function normalizeRsvp(value) {
        const rsvp = isPlainObject(value) ? value : {};
        return {
            deadline: firstString(rsvp.deadline, rsvp.confirmacionLimite),
            contacts: normalizeContacts(rsvp.contacts || rsvp.contactosRSVP)
        };
    }

    function normalizeTheme(value, legacyStyles = {}) {
        if (typeof value === "string") return { slug: value, styles: legacyStyles || {} };
        const theme = isPlainObject(value) ? value : {};
        return {
            slug: firstString(theme.slug, theme.name),
            fontFamily: firstString(theme.fontFamily),
            styles: isPlainObject(theme.styles) ? theme.styles : legacyStyles || {}
        };
    }

    function legacySections(media, location, rsvp, data) {
        const hasLocationData = Boolean(data.mensaje || data.horarioTexto || data.horario || location.name || location.address || location.mapsUrl);
        const hasRsvpData = Boolean(data.fechaEvento || data.fecha || rsvp.deadline || rsvp.contacts.length);
        const enabledByType = {
            hero: Boolean(data.nombre || data.subtitulo || data.fechaTexto || data.fecha || media.capas.portada),
            location: hasLocationData,
            rsvp: hasRsvpData
        };

        return LEGACY_SECTION_MAP.map((section) => ({
            ...section,
            enabled: enabledByType[section.type] !== false,
            data: { legacyLayer: layerNameForSection(section.type) }
        }));
    }

    function normalizeSections(value) {
        const source = Array.isArray(value) ? value : [];
        return source
            .map((section, index) => normalizeSection(section, index))
            .filter(Boolean)
            .sort((first, second) => first.order - second.order || first.id.localeCompare(second.id));
    }

    function normalizeSection(section, index) {
        if (!isPlainObject(section)) return null;
        const order = Number(section.order);
        const type = firstString(section.type) || "event-info";
        return {
            id: firstString(section.id) || `${type}-${index + 1}`,
            type,
            enabled: section.enabled !== false,
            order: Number.isFinite(order) ? order : (index + 1) * 10,
            data: isPlainObject(section.data) ? section.data : {}
        };
    }

    function normalizeLayoutConfig(value) {
        const defaults = {
            capa1: { objectPosition: "50% 25%", scale: 1, align: "flex-end", offsetY: 78, contentScale: "medium" },
            capa2: { objectPosition: "50% 35%", scale: 1, align: "center", offsetY: 50, contentScale: "medium" },
            capa3: { objectPosition: "50% 35%", scale: 1, align: "center", offsetY: 50, contentScale: "medium" }
        };
        const normalized = Object.fromEntries(Object.entries(defaults).map(([layer, config]) => {
            const saved = value?.[layer] || {};
            const offsetY = Number(saved.offsetY);
            return [layer, {
                ...config,
                ...saved,
                offsetY: Number.isFinite(offsetY) && offsetY >= 50 && offsetY <= 95 ? offsetY : config.offsetY
            }];
        }));
        const audio = value?.audioButton || {};
        normalized.audioButton = {
            verticalEdge: audio.verticalEdge === "bottom" ? "bottom" : "top",
            horizontalEdge: audio.horizontalEdge === "right" ? "right" : "left",
            verticalOffset: clampPercent(audio.verticalOffset, 22),
            horizontalOffset: clampPercent(audio.horizontalOffset, 22)
        };
        return normalized;
    }

    function normalizeAudioTracks(value, fallbackSource) {
        const tracks = Array.isArray(value)
            ? value.map((track, index) => typeof track === "string" ? { src: track, name: `Pista ${index + 1}` } : track)
            : [];
        if (tracks.length) return tracks.filter((track) => track?.src);
        return fallbackSource ? [{ src: fallbackSource, name: "Musica de fondo" }] : [];
    }

    function contactsFromConfirmation(confirmacion) {
        if (!confirmacion) return [];

        return [
            { nombre: confirmacion.nombre1, telefono: confirmacion.tel1 },
            { nombre: confirmacion.nombre2, telefono: confirmacion.tel2 }
        ].filter((contact) => contact.telefono);
    }

    function normalizeContacts(value) {
        return Array.isArray(value)
            ? value
                .filter((contact) => isPlainObject(contact))
                .map((contact) => ({
                    nombre: firstString(contact.nombre, contact.name),
                    telefono: firstString(contact.telefono, contact.phone)
                }))
            : [];
    }

    function layerNameForSection(type) {
        return {
            hero: "capa1",
            location: "capa2",
            rsvp: "capa3"
        }[type] || "";
    }

    function clampPercent(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.min(95, number)) : fallback;
    }

    function firstString(...values) {
        const value = values.find((item) => typeof item === "string" && item.trim());
        return value ? value.trim() : "";
    }

    function isPlainObject(value) {
        return Boolean(value && typeof value === "object" && !Array.isArray(value));
    }

    return {
        CURRENT_SCHEMA_VERSION,
        normalizeEvent,
        hasNewSchema,
        normalizeSections
    };
});
