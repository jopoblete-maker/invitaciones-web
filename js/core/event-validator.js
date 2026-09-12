(function (root, factory) {
    const schema = typeof require === "function"
        ? require("./event-schema")
        : root.EventSchema;
    const validator = factory(schema);

    if (typeof module === "object" && module.exports) {
        module.exports = validator;
    }

    root.EventValidator = validator;
})(typeof globalThis !== "undefined" ? globalThis : this, function (schema) {
    const CURRENT_SCHEMA_VERSION = schema?.CURRENT_SCHEMA_VERSION || 1;

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

        return {
            valid: errors.length === 0,
            errors
        };
    }

    function validateTemplate(template, errors) {
        if (!validateObject(template, "template", errors)) return;
        if (!nonEmptyString(template.slug)) {
            errors.push("template.slug es obligatorio.");
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

    return {
        CURRENT_SCHEMA_VERSION,
        validateNewEvent
    };
});
