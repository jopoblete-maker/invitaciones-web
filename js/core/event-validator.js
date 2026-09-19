(function (root, factory) {
    const schema = typeof require === "function"
        ? require("./event-schema")
        : root.EventSchema;
    const templateRegistry = typeof require === "function"
        ? require("./template-registry")
        : root.TemplateRegistry;
    const sectionContracts = typeof require === "function"
        ? require("./section-contracts")
        : root.SectionContracts;
    const moduleRegistry = typeof require === "function"
        ? require("./module-registry")
        : root.ModuleRegistry;
    const themeRegistry = typeof require === "function"
        ? require("./theme-registry")
        : root.ThemeRegistry;
    const planRegistry = typeof require === "function"
        ? require("./plan-registry")
        : root.PlanRegistry;
    const validator = factory(
        schema,
        templateRegistry,
        sectionContracts,
        moduleRegistry,
        themeRegistry,
        planRegistry
    );

    if (typeof module === "object" && module.exports) {
        module.exports = validator;
    }

    root.EventValidator = validator;
})(typeof globalThis !== "undefined" ? globalThis : this, function (
    schema,
    templateRegistry,
    sectionContracts,
    moduleRegistry,
    themeRegistry,
    planRegistry
) {
    const CURRENT_SCHEMA_VERSION = schema?.CURRENT_SCHEMA_VERSION || 1;
    const V2_SCHEMA_VERSION = schema?.V2_SCHEMA_VERSION || 2;
    const TEMPLATES = templateRegistry?.TEMPLATES || {};

    function validateNewEvent(event) {
        const errors = [];

        if (!isPlainObject(event)) {
            return {
                valid: false,
                errors: ["El evento debe ser un objeto."]
            };
        }

        if (event.schema_version === undefined || event.schema_version === null || event.schema_version === "") {
            errors.push("schema_version es obligatorio.");
        } else if (Number(event.schema_version) !== CURRENT_SCHEMA_VERSION) {
            errors.push(`schema_version no soportado: ${event.schema_version}.`);
        }

        validateObject(event.event, "event", errors);
        validateTemplate(event.template, errors);
        validateSections(event.sections, errors);
        validateOptionalObject(event.theme, "theme", errors);
        validateOptionalObject(event.music, "music", errors);
        validateOptionalObject(event.location, "location", errors);
        validateOptionalObject(event.rsvp, "rsvp", errors);
        validateOptionalObject(event.branding, "branding", errors);

        return {
            valid: errors.length === 0,
            errors
        };
    }

    function validateTemplate(template, errors) {
        if (!validateObject(template, "template", errors)) return;
        if (!nonEmptyString(template.slug)) {
            errors.push("template.slug es obligatorio.");
            return;
        }

        const slug = template.slug.trim();
        if (!Object.prototype.hasOwnProperty.call(TEMPLATES, slug)) {
            errors.push(`template.slug no registrado: ${slug}.`);
        }
    }

    function validateSections(sections, errors) {
        if (!Array.isArray(sections)) {
            errors.push("sections debe ser un array.");
            return;
        }

        const ids = new Set();
        sections.forEach((section, index) => {
            const prefix = `sections[${index}]`;
            if (!isPlainObject(section)) {
                errors.push(`${prefix} debe ser un objeto.`);
                return;
            }

            if (!nonEmptyString(section.id)) {
                errors.push(`${prefix}.id es obligatorio.`);
            } else if (ids.has(section.id)) {
                errors.push(`${prefix}.id duplicado: ${section.id}.`);
            } else {
                ids.add(section.id);
            }

            if (!nonEmptyString(section.type)) {
                errors.push(`${prefix}.type es obligatorio.`);
            }

            if (typeof section.enabled !== "boolean") {
                errors.push(`${prefix}.enabled debe ser boolean.`);
            }

            if (!Number.isFinite(Number(section.order))) {
                errors.push(`${prefix}.order debe ser numerico.`);
            }

            if (!isPlainObject(section.data)) {
                errors.push(`${prefix}.data debe ser un objeto.`);
            }
        });
    }

    function validateObject(value, label, errors) {
        if (!isPlainObject(value)) {
            errors.push(`${label} debe ser un objeto.`);
            return false;
        }
        return true;
    }

    function validateOptionalObject(value, label, errors) {
        if (value === undefined || value === null) return;
        validateObject(value, label, errors);
    }

    function nonEmptyString(value) {
        return typeof value === "string" && value.trim().length > 0;
    }

    function isPlainObject(value) {
        return Boolean(value && typeof value === "object" && !Array.isArray(value));
    }

    function validateV2Event(event) {
        const errors = [];

        if (!isPlainObject(event)) {
            return { valid: false, errors: ["El evento debe ser un objeto."] };
        }

        if (event.schema_version !== V2_SCHEMA_VERSION) {
            errors.push(`schema_version debe ser ${V2_SCHEMA_VERSION}.`);
        }

        if (event.id !== undefined && !isValidId(event.id)) {
            errors.push("id debe usar letras minusculas, numeros y guiones simples.");
        }

        validateRegisteredValue(event.event_type, schema?.V2_EVENT_TYPES, "event_type", errors);
        validateRegisteredValue(event.plan, Object.keys(planRegistry?.PLANS || {}), "plan", errors);
        validateRegisteredValue(event.status, schema?.V2_EVENT_STATUSES, "status", errors);

        const template = validateV2Template(event.template, errors);
        const identityValid = validateObject(event.identity, "identity", errors);
        if (identityValid && !nonEmptyString(event.identity.title)) {
            errors.push("identity.title es obligatorio.");
        }

        const scheduleValid = validateObject(event.schedule, "schedule", errors);
        const hasValidScheduleDate = scheduleValid && isValidDate(event.schedule.date);
        if (scheduleValid && !hasValidScheduleDate) {
            errors.push("schedule.date debe ser una fecha valida en formato YYYY-MM-DD.");
        }

        validateOptionalObject(event.location, "location", errors);
        validateV2Theme(event.theme, errors);
        const sections = validateV2Sections(event.sections, template, errors);
        const modules = validateV2Modules(event.modules, template, errors);
        const mediaValid = validateObject(event.media, "media", errors);
        validateOptionalObject(event.metadata, "metadata", errors);

        if (Array.isArray(event.sections) && !event.sections.some(isEnabled)) {
            errors.push("sections debe incluir al menos una seccion habilitada.");
        }

        validateV2Invariants(event, sections, modules, template, mediaValid, hasValidScheduleDate, errors);

        return { valid: errors.length === 0, errors };
    }

    function validateV2Template(templateValue, errors) {
        if (!validateObject(templateValue, "template", errors)) return null;
        if (!nonEmptyString(templateValue.slug)) {
            errors.push("template.slug es obligatorio.");
            return null;
        }

        const slug = templateValue.slug.trim();
        if (!Object.prototype.hasOwnProperty.call(TEMPLATES, slug)) {
            errors.push(`template.slug no registrado: ${slug}.`);
            return null;
        }
        return TEMPLATES[slug];
    }

    function validateRegisteredValue(value, allowedValues, path, errors) {
        if (!nonEmptyString(value)) {
            errors.push(`${path} es obligatorio.`);
        } else if (!Array.isArray(allowedValues) || !allowedValues.includes(value.trim())) {
            errors.push(`${path} no registrado: ${value.trim()}.`);
        }
    }

    function validateV2Sections(sections, template, errors) {
        if (!Array.isArray(sections)) {
            errors.push("sections debe ser un array.");
            return [];
        }

        const ids = new Set();
        return sections.map((section, index) => {
            const prefix = `sections[${index}]`;
            if (!isPlainObject(section)) {
                errors.push(`${prefix} debe ser un objeto.`);
                return null;
            }

            if (!nonEmptyString(section.id)) {
                errors.push(`${prefix}.id es obligatorio.`);
            } else if (ids.has(section.id)) {
                errors.push(`${prefix}.id duplicado: ${section.id}.`);
            } else {
                ids.add(section.id);
            }

            let contract = null;
            if (!nonEmptyString(section.type)) {
                errors.push(`${prefix}.type es obligatorio.`);
            } else if (!sectionContracts?.has(section.type)) {
                errors.push(`${prefix}.type no registrado: ${section.type}.`);
            } else {
                contract = sectionContracts.get(section.type);
                if (template && !template.supportedSections.includes(section.type)) {
                    errors.push(`${prefix}.type no soportado por template.slug: ${section.type}.`);
                }
            }

            if (section.enabled !== undefined && typeof section.enabled !== "boolean") {
                errors.push(`${prefix}.enabled debe ser boolean.`);
            }
            if (!Number.isFinite(Number(section.order))) {
                errors.push(`${prefix}.order debe ser numerico.`);
            }

            const dataValid = validateObject(section.data, `${prefix}.data`, errors);
            const configValid = section.config === undefined
                ? true
                : validateObject(section.config, `${prefix}.config`, errors);
            if (contract && dataValid) {
                validateAllowedKeys(section.data, contract.allowedDataKeys, `${prefix}.data`, errors);
                (contract.requiredDataKeys || []).forEach((key) => {
                    if (section.data[key] === undefined || section.data[key] === null || section.data[key] === "") {
                        errors.push(`${prefix}.data.${key} es obligatorio.`);
                    }
                });
            }
            if (contract && configValid && section.config !== undefined) {
                validateAllowedKeys(section.config, contract.allowedConfigKeys, `${prefix}.config`, errors);
            }
            return section;
        });
    }

    function validateV2Modules(modulesValue, template, errors) {
        if (!validateObject(modulesValue, "modules", errors)) return {};

        Object.entries(modulesValue).forEach(([slug, config]) => {
            const prefix = `modules.${slug}`;
            if (!moduleRegistry?.has(slug)) {
                errors.push(`${prefix} no esta registrado.`);
                return;
            }
            if (!validateObject(config, prefix, errors)) return;
            if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
                errors.push(`${prefix}.enabled debe ser boolean.`);
            }
            validateAllowedKeys(config, moduleRegistry.get(slug).configKeys, prefix, errors);
            if (isEnabled(config) && template && !template.supportedModules.includes(slug)) {
                errors.push(`${prefix} no esta soportado por template.slug.`);
            }
        });
        return modulesValue;
    }

    function validateV2Theme(theme, errors) {
        if (theme === undefined || theme === null) return;
        if (!validateObject(theme, "theme", errors)) return;

        if (theme.slug !== undefined) {
            if (!nonEmptyString(theme.slug)) {
                errors.push("theme.slug debe ser un string no vacio.");
            } else if (!themeRegistry?.has(theme.slug)) {
                errors.push(`theme.slug no registrado: ${theme.slug.trim()}.`);
            }
        }

        if (theme.overrides !== undefined) {
            if (!validateObject(theme.overrides, "theme.overrides", errors)) return;
            validateAllowedKeys(theme.overrides, themeRegistry?.RUNTIME_TOKEN_KEYS || [], "theme.overrides", errors);
            Object.entries(theme.overrides).forEach(([key, value]) => {
                if (typeof value !== "string" || value.trim() === "") {
                    errors.push(`theme.overrides.${key} debe ser un string no vacio.`);
                }
            });
        }
    }

    function validateV2Invariants(event, sections, modules, template, mediaValid, hasValidScheduleDate, errors) {
        const enabledSections = sections.filter((section) => section && isEnabled(section));
        const rsvpSection = enabledSections.find((section) => section.type === "rsvp");
        if (rsvpSection && (!isPlainObject(modules.rsvp) || !isEnabled(modules.rsvp))) {
            errors.push("modules.rsvp es requerido por una seccion RSVP habilitada.");
        }

        enabledSections.filter((section) => section.type === "countdown").forEach((section) => {
            const target = section.data?.target_datetime;
            if (!isValidDateTime(target) && !hasValidScheduleDate) {
                errors.push(`sections.${section.id}.data.target_datetime debe ser valido si schedule.date no esta disponible.`);
            }
        });

        const mediaItems = mediaValid && isPlainObject(event.media.items) ? event.media.items : {};
        sections.forEach((section, index) => {
            const mediaId = section?.data?.media_id;
            if (mediaId !== undefined && !hasOwn(mediaItems, mediaId)) {
                errors.push(`sections[${index}].data.media_id no existe en media.items: ${mediaId}.`);
            }
        });
        validateMusicMedia(modules.music, mediaItems, errors);

        enabledSections.filter((section) => section.type === "location").forEach((section) => {
            if (section.config?.show_maps === true) {
                if (!hasUsableMapsUrl(event.location)) {
                    errors.push(`sections.${section.id}.config.show_maps requiere una URL utilizable en location.`);
                }
                validateTemplateAction(template, "maps", `sections.${section.id}.config.show_maps`, errors);
            }
            if (section.config?.show_calendar === true) {
                if (!hasValidScheduleDate) {
                    errors.push(`sections.${section.id}.config.show_calendar requiere schedule.date valida.`);
                }
                validateTemplateAction(template, "calendar", `sections.${section.id}.config.show_calendar`, errors);
            }
        });
    }

    function validateMusicMedia(music, mediaItems, errors) {
        if (!isPlainObject(music)) return;
        if (music.media_id !== undefined && !hasOwn(mediaItems, music.media_id)) {
            errors.push(`modules.music.media_id no existe en media.items: ${music.media_id}.`);
        }
        if (Array.isArray(music.tracks)) {
            music.tracks.forEach((track, index) => {
                if (isPlainObject(track) && track.media_id !== undefined && !hasOwn(mediaItems, track.media_id)) {
                    errors.push(`modules.music.tracks[${index}].media_id no existe en media.items: ${track.media_id}.`);
                }
            });
        }
    }

    function validateTemplateAction(template, action, path, errors) {
        if (template && !template.supportedActions.includes(action)) {
            errors.push(`${path} no esta soportado por template.slug.`);
        }
    }

    function validateAllowedKeys(value, allowedKeys, path, errors) {
        Object.keys(value).forEach((key) => {
            if (!allowedKeys.includes(key)) errors.push(`${path}.${key} no esta permitido.`);
        });
    }

    function isValidId(value) {
        return nonEmptyString(value) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim());
    }

    function isValidDate(value) {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [year, month, day] = value.split("-").map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year
            && date.getUTCMonth() === month - 1
            && date.getUTCDate() === day;
    }

    function isValidDateTime(value) {
        return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
    }

    function isEnabled(value) {
        return isPlainObject(value) && value.enabled !== false;
    }

    function hasOwn(value, key) {
        return typeof key === "string" && Object.prototype.hasOwnProperty.call(value, key);
    }

    function hasUsableMapsUrl(location) {
        if (!isPlainObject(location)) return false;
        const value = location.maps_url ?? location.mapsUrl ?? location.url;
        if (!nonEmptyString(value)) return false;
        try {
            const url = new URL(value);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch {
            return false;
        }
    }

    return {
        CURRENT_SCHEMA_VERSION,
        validateNewEvent,
        validateV2Event
    };
});
