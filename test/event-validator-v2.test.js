const assert = require("assert");
const {
    validateEventForPersistence,
    validateNewEvent,
    validateV2Event
} = require("../js/core/event-validator");
const TemplateRegistry = require("../js/core/template-registry");
const ThemeRegistry = require("../js/core/theme-registry");
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
expectError(validEvent({ theme: { slug: "minimal" } }), "theme.slug");
expectError(validEvent({ theme: { slug: "infantil" } }), "theme.slug");
expectError(validEvent({ theme: { slug: "romantico", overrides: { unknown: "value" } } }), "theme.overrides.unknown");
ThemeRegistry.RUNTIME_TOKEN_KEYS.forEach((key) => {
    assert.strictEqual(validateV2Event(validEvent({
        theme: { slug: "romantico", overrides: { [key]: `value-${key}` } }
    })).valid, true, `theme.overrides.${key} debe provenir de ThemeRegistry`);
});

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

// Only this reloaded validator sees the synthetic template. Production stays closed.
{
    const validatorPath = require.resolve("../js/core/event-validator");
    const registryPath = require.resolve("../js/core/template-registry");
    const savedValidator = require.cache[validatorPath];
    const savedRegistry = require.cache[registryPath];
    const registry = require(registryPath);
    const { createPolicy } = require("../js/core/external-link-policy");
    const types = ["gallery", "dress-code", "gifts", "collaborative-album"];
    const template = { ...registry.getTemplate("boda-civil-esencial"), supportedSections: ["hero", ...types] };
    const url = "https://album.example.test/approved";
    const mediaItems = { photo: { type: "image", src: "/assets/synthetic/photo.webp" } };
    const gifts = { title: "Regalos", message: "Gracias", alias: "alias.demo", cbu: "0".repeat(22) };
    const sections = [
        { id: "gallery-a", type: "gallery", enabled: true, order: 20, data: { items: [{ media_id: "photo", alt: "Foto" }] } },
        { id: "dress-a", type: "dress-code", enabled: true, order: 30, data: { description: "Formal" } },
        { id: "gifts-a", type: "gifts", enabled: true, order: 40, data: gifts },
        { id: "album-a", type: "collaborative-album", enabled: true, order: 50, data: { url } }
    ];
    const options = { bySectionId: {
        "gallery-a": { authorizedMediaIds: ["photo"], mediaItems },
        "dress-a": {},
        "gifts-a": { authorizedGiftData: gifts },
        "album-a": { albumUrl: url, albumPolicy: createPolicy({ allowedUrls: [url] }) }
    } };
    const event = validEvent({ media: { items: mediaItems }, sections: [...validEvent().sections, ...sections] });
    const before = JSON.stringify({ event, options });
    const freeze = value => {
        if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
        return value;
    };
    freeze(event); freeze(options);
    try {
        require.cache[registryPath] = { id: registryPath, filename: registryPath, loaded: true, exports: {
            ...registry, hasTemplate: slug => slug === "boda-civil-esencial", getTemplate: () => template
        } };
        delete require.cache[validatorPath];
        const isolated = require(validatorPath);
        const check = (value = event, config = options) => isolated.validateV2Event(value, config).valid;
        assert(check());
        assert(check({ ...event, sections: event.sections.map(value => types.includes(value.type)
            ? { ...value, enabled: false } : value) }));
        assert(!check({ ...event, sections: event.sections.map(value => value.type === "gifts"
            ? { ...value, enabled: false, data: { ...gifts, cbu: "invalid" } } : value) }));
        assert(!check(event, {}));
        assert(!isolated.validateEventForPersistence(event).valid);
        for (const section of sections) {
            const changed = { ...event, sections: event.sections.map(value => value === section ? { ...value, id: value.id + "-b" } : value) };
            assert(!check(changed), "A different section cannot inherit options");
            const incomplete = { ...options.bySectionId }; delete incomplete[section.id];
            assert(!check(event, { bySectionId: incomplete }));
            assert(!check({ ...changed, sections: changed.sections.map(value => ({ ...value, enabled: false })) }));
        }
        assert(!check({ ...event, sections: [...event.sections, sections[0]] }));
        assert(!check(event, { ...options, albumPolicy: { isAllowed: () => true } }));
        assert(!check(event, { bySectionId: { ...options.bySectionId, nonexistent: {} } }));
        const disabled = { ...event, sections: event.sections.map(value => types.includes(value.type)
            ? { ...value, enabled: false } : value) };
        assert(!check(disabled, { bySectionId: { ...options.bySectionId, nonexistent: {} } }));
        assert(check(disabled, options));
        const revoked = Proxy.revocable({}, {}); revoked.revoke();
        assert.doesNotThrow(() => assert(!check(event, revoked.proxy)));
        assert.doesNotThrow(() => assert(!check(event, { bySectionId: revoked.proxy })));
        assert.doesNotThrow(() => assert(!check(event, { bySectionId: { ...options.bySectionId, "gallery-a": revoked.proxy } })));
        for (const malformed of [null, [], { bySectionId: null }, { bySectionId: [] },
            { bySectionId: { ...options.bySectionId, "gifts-a": null } }]) {
            assert.doesNotThrow(() => assert(!check(event, malformed)));
        }
        let accessorCalls = 0;
        const accessorOptions = Object.defineProperty({}, "bySectionId", { get() { accessorCalls++; throw new Error("synthetic"); } });
        assert(!check(event, accessorOptions));
        const accessorEntry = Object.defineProperty({}, "albumUrl", { get() { accessorCalls++; return url; } });
        assert(!check(event, { bySectionId: { ...options.bySectionId, "album-a": accessorEntry } }));
        assert.strictEqual(accessorCalls, 0);
        assert(!check(event, { bySectionId: Object.create(options.bySectionId) }));
        assert(!check({ ...event, premiumOptions: options, authorized: true }, {}));
        assert(!check({ ...event, sections: event.sections.map(value => value.type === "collaborative-album"
            ? { ...value, data: { url: "https://album.example.test/different" } } : value) }));
        assert(!check(event, { bySectionId: { ...options.bySectionId, "album-a": { albumUrl: url } } }));
        assert(!check({ ...event, media: { items: { photo: { type: "image", src: "/assets/synthetic/other.webp" } } } }));
        assert(!check({ ...event, sections: event.sections.map(value => value.type === "gallery"
            ? { ...value, data: { items: [{ media_id: "other", alt: "Foto" }] } } : value) }));
        for (const field of ["title", "message", "alias", "cbu"]) {
            const expected = { ...gifts }; delete expected[field];
            assert(!check(event, { bySectionId: { ...options.bySectionId, "gifts-a": { authorizedGiftData: expected } } }));
            assert(!check(event, { bySectionId: { ...options.bySectionId, "gifts-a": { authorizedGiftData: { ...gifts, [field]: "different" } } } }));
        }
        // Previous explicit global calls remain structural-only and compatible.
        assert(check(event, { authorizedMediaIds: ["photo"], albumPolicy: createPolicy({ allowedUrls: [url] }) }));
        // A permissive legacy callback can satisfy structure, but is not private authority.
        const permissive = { authorizedMediaIds: ["photo"], albumPolicy: { isAllowed: () => true } };
        assert(check(event, permissive));
        assert(!isolated.validateEventForPersistence(event).valid);
        const { createPremiumWriteBoundary } = require("../backend/premium/write-boundary");
        const boundary = createPremiumWriteBoundary({ getAuthorizationState: () => undefined });
        assert.deepStrictEqual(boundary.validateForWrite({ eventId: event.id, content: event }), { accepted: false });
        assert(isolated.validateV2Event(validEvent()).valid);
        assert(isolated.validateEventForPersistence(validEvent()).valid);
        assert(isolated.validateEventForPersistence(validV1).valid);
        assert(isolated.validateEventForPersistence({}).valid);
        assert.strictEqual(JSON.stringify({ event, options }), before);
    } finally {
        require.cache[validatorPath] = savedValidator;
        require.cache[registryPath] = savedRegistry;
    }
    const production = require(validatorPath);
    assert(!production.validateV2Event(event, options).valid);
    assert(production.validateV2Event(event, options).errors.some(error => error.includes("no soportado por template")));
}

console.log("event-validator v2 test passed");
