const assert = require("assert");
const {
    validateEventForPersistence,
    validateNewEvent,
    validateV2Event
} = require("../js/core/event-validator");
const TemplateRegistry = require("../js/core/template-registry");
function validEvent(overrides = {}) {
    return {
        schema_version: 2,
        id: "evento-v2",
        event_type: "wedding-civil",
        plan: "esencial",
        status: "approved",
        template: { slug: "boda-civil-esencial" },
        identity: { title: "Kaly & Joha" },
        schedule: { date: "2027-04-17" },
        sections: [
            { id: "hero", type: "hero", enabled: true, order: 10, data: {} }
        ],
        modules: {},
        media: { items: {} },
        ...overrides
    };
}

function expectError(event, fragment) {
    const result = validateV2Event(event);
    assert.strictEqual(result.valid, false, `Expected invalid event for: ${fragment}`);
    assert(result.errors.some((error) => error.includes(fragment)), result.errors.join("\n"));
    return result;
}

assert.deepStrictEqual(validateV2Event(validEvent()), { valid: true, errors: [] });
assert.deepStrictEqual(validateEventForPersistence(validEvent()), { valid: true, errors: [] });
assert.deepStrictEqual(validateEventForPersistence({ nombre: "Legacy" }), { valid: true, errors: [] });
expectError(validEvent({ schema_version: 1 }), "schema_version");
expectError(validEvent({ event_type: "unknown" }), "event_type");
expectError(validEvent({ event_type: "birthday" }), "event_type no soportado por template.slug");
assert.strictEqual(validateV2Event(validEvent({
    event_type: "birthday",
    template: { slug: "cumple-clasico" }
})).valid, true);
expectError(validEvent({ plan: "unknown" }), "plan");
expectError(validEvent({ status: "unknown" }), "status");
expectError(validEvent({ template: { slug: "unknown" } }), "template.slug");
expectError(validEvent({ identity: {} }), "identity.title");
expectError(validEvent({ schedule: { date: "2027-02-29" } }), "schedule.date");
expectError(validEvent({ sections: [] }), "al menos una seccion");
expectError(validEvent({
    sections: [{ id: "closing", type: "closing", enabled: true, order: 10, data: {} }]
}), "requiere una seccion habilitada de type: hero");
expectError(validEvent({
    sections: [{ id: "hero", type: "hero", enabled: false, order: 10, data: {} }]
}), "requiere una seccion habilitada de type: hero");

expectError(validEvent({
    sections: [
        { id: "same", type: "hero", enabled: true, order: 10, data: {} },
        { id: "same", type: "closing", enabled: true, order: 20, data: {} }
    ]
}), "id duplicado");
expectError(validEvent({
    sections: [{ id: "unknown", type: "unknown", enabled: true, order: 10, data: {} }]
}), "type no registrado");
expectError(validEvent({
    sections: [{ id: "hero", type: "hero", enabled: true, order: 10, data: { unknown: true } }]
}), "data.unknown no esta permitido");
expectError(validEvent({
    sections: [{ id: "hero", type: "hero", enabled: true, order: 10, data: {}, config: { unknown: true } }]
}), "config.unknown no esta permitido");

expectError(validEvent({ modules: { unknown: {} } }), "modules.unknown");
expectError(validEvent({ modules: { music: "yes" } }), "modules.music debe ser un objeto");
expectError(validEvent({ theme: { slug: "unknown" } }), "theme.slug");
expectError(validEvent({ theme: { slug: "romantico", overrides: { unknown: "value" } } }), "theme.overrides.unknown");

const validatorPath = require.resolve("../js/core/event-validator");
const registryPath = require.resolve("../js/core/template-registry");
const originalValidatorModule = require.cache[validatorPath];
const originalRegistryModule = require.cache[registryPath];
try {
    const restricted = {
        ...TemplateRegistry.getTemplate("boda-civil-esencial"),
        supportedSections: ["hero"],
        supportedModules: []
    };
    const templates = { "boda-civil-esencial": restricted };
    require.cache[registryPath] = {
        id: registryPath,
        filename: registryPath,
        loaded: true,
        exports: {
            TEMPLATES: templates,
            hasTemplate: (slug) => Object.prototype.hasOwnProperty.call(templates, String(slug || "").trim()),
            getTemplate: (slug) => templates[String(slug || "").trim()]
        }
    };
    delete require.cache[validatorPath];
    const restrictedValidator = require(validatorPath);
    const incompatibleSection = restrictedValidator.validateV2Event(validEvent({
        sections: [
            { id: "hero", type: "hero", enabled: true, order: 10, data: {} },
            { id: "closing", type: "closing", enabled: true, order: 20, data: {} }
        ]
    }));
    assert(incompatibleSection.errors.some((error) => error.includes("type no soportado")));
    const incompatibleModule = restrictedValidator.validateV2Event(validEvent({
        modules: { music: { enabled: true } }
    }));
    assert(incompatibleModule.errors.some((error) => error.includes("modules.music no esta soportado")));
} finally {
    require.cache[registryPath] = originalRegistryModule;
    require.cache[validatorPath] = originalValidatorModule;
}

expectError(validEvent({
    sections: [{ id: "rsvp", type: "rsvp", enabled: true, order: 10, data: {} }]
}), "modules.rsvp es requerido");
assert.strictEqual(validateV2Event(validEvent({
    sections: [
        { id: "hero", type: "hero", enabled: true, order: 10, data: {} },
        { id: "rsvp", type: "rsvp", enabled: true, order: 20, data: {} }
    ],
    modules: { rsvp: { enabled: true } }
})).valid, true);

assert.strictEqual(validateV2Event(validEvent({
    schedule: { date: "2027-04-17" },
    sections: [
        { id: "hero", type: "hero", enabled: true, order: 10, data: {} },
        { id: "countdown", type: "countdown", enabled: true, order: 20, data: {} }
    ]
})).valid, true);
assert.strictEqual(validateV2Event(validEvent({
    schedule: { date: "invalid" },
    sections: [{
        id: "countdown",
        type: "countdown",
        enabled: true,
        order: 10,
        data: { target_datetime: "2027-04-17T18:30:00-03:00" }
    }]
})).errors.some((error) => error.includes("target_datetime")), false);
expectError(validEvent({
    schedule: { date: "invalid" },
    sections: [{ id: "countdown", type: "countdown", enabled: true, order: 10, data: { target_datetime: "invalid" } }]
}), "target_datetime");

expectError(validEvent({
    sections: [{ id: "hero", type: "hero", enabled: true, order: 10, data: { media_id: "missing" } }]
}), "data.media_id");
expectError(validEvent({ modules: { music: { enabled: true, media_id: "missing" } } }), "modules.music.media_id");
assert.strictEqual(validateV2Event(validEvent({
    sections: [{ id: "hero", type: "hero", enabled: true, order: 10, data: { media_id: "cover" } }],
    modules: { music: { enabled: true, media_id: "song" } },
    media: { items: { cover: {}, song: {} } }
})).valid, true);

expectError(validEvent({
    location: {},
    sections: [{ id: "location", type: "location", enabled: true, order: 10, data: {}, config: { show_maps: true } }]
}), "show_maps requiere");
assert.strictEqual(validateV2Event(validEvent({
    location: { maps_url: "https://maps.google.com/?q=-34.6,-58.4" },
    sections: [
        { id: "hero", type: "hero", enabled: true, order: 10, data: {} },
        { id: "location", type: "location", enabled: true, order: 20, data: {}, config: { show_maps: true } }
    ]
})).valid, true);
expectError(validEvent({
    schedule: {},
    sections: [{ id: "location", type: "location", enabled: true, order: 10, data: {}, config: { show_calendar: true } }]
}), "show_calendar requiere");

const accumulated = validateV2Event({
    schema_version: 99,
    event_type: "unknown",
    plan: "unknown",
    status: "unknown",
    template: { slug: "unknown" },
    identity: {},
    schedule: {},
    sections: [],
    modules: {},
    media: {}
});
assert.strictEqual(accumulated.valid, false);
assert(accumulated.errors.length >= 8, accumulated.errors.join("\n"));

const validV1 = {
    schema_version: 1,
    event: {},
    template: { slug: "boda-civil-esencial" },
    sections: [{ id: "hero", type: "hero", enabled: true, order: 10, data: {} }]
};
assert.deepStrictEqual(validateNewEvent(validV1), { valid: true, errors: [] });
const v2ThroughV1 = validateNewEvent(validEvent());
assert.strictEqual(v2ThroughV1.valid, false);
assert(v2ThroughV1.errors.includes("schema_version no soportado: 2."));
assert.strictEqual(validateEventForPersistence({ ...validV1, schema_version: 3 }).valid, false);

console.log("event-validator v2 test passed");
