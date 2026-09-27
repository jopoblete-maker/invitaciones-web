const assert = require("assert");
const { createPublicEventResolver } = require("../js/core/public-event-resolver");

function createHarness({ events = {}, versions = {}, validatePublishedContent } = {}) {
    const calls = [];
    const fallbacks = [];
    const resolver = createPublicEventResolver({
        async getEvent(id) {
            calls.push(["event", id]);
            return events[id] || null;
        },
        async getVersion(id) {
            calls.push(["version", id]);
            return versions[id] || null;
        }
    }, {
        onFallback(details) {
            fallbacks.push(details);
        },
        validatePublishedContent
    });
    return { calls, fallbacks, resolver };
}

async function expectCode(code, action) {
    await assert.rejects(action, (error) => error.code === code, `Expected ${code}`);
}

(async () => {
    const legacyContent = { title: "legacy" };
    const publishedContent = { title: "published", nested: { value: 1 } };
    const normal = createHarness({
        events: {
            event: {
                id: "event", event_status: "active",
                published_version_id: "version-1", datos: legacyContent
            }
        },
        versions: {
            "version-1": { id: "version-1", event_id: "event", content: publishedContent }
        }
    });
    const resolved = await normal.resolver.resolvePublicEvent("event");
    assert.deepStrictEqual(resolved, publishedContent);
    assert.notDeepStrictEqual(resolved, legacyContent);
    assert.deepStrictEqual(normal.fallbacks, []);
    resolved.nested.value = 99;
    assert.strictEqual(publishedContent.nested.value, 1);

    const withoutPointer = createHarness({
        events: {
            "legacy-": {
                id: "legacy-", event_status: "active",
                published_version_id: null, datos: { title: "legacy trailing id" }
            }
        }
    });
    assert.deepStrictEqual(
        await withoutPointer.resolver.resolvePublicEvent("legacy-"),
        { title: "legacy trailing id" }
    );
    assert.deepStrictEqual(withoutPointer.calls, [["event", "legacy-"]]);
    assert.strictEqual(withoutPointer.fallbacks[0].reason, "missing-published-pointer");

    const unpublishedVersioned = createHarness({
        events: {
            "new-event": {
                id: "new-event",
                event_status: "active",
                published_version_id: null,
                current_working_version_id: "draft-v1",
                datos: { mustNotLeak: "draft" }
            }
        }
    });
    await expectCode(
        "PUBLIC_EVENT_NOT_FOUND",
        () => unpublishedVersioned.resolver.resolvePublicEvent("new-event")
    );
    assert.deepStrictEqual(unpublishedVersioned.calls, [["event", "new-event"]]);
    assert.deepStrictEqual(unpublishedVersioned.fallbacks, []);

    const missingVersion = createHarness({
        events: {
            event: {
                id: "event", event_status: "active",
                published_version_id: "missing", datos: { fallback: true }
            }
        }
    });
    assert.deepStrictEqual(await missingVersion.resolver.resolvePublicEvent("event"), { fallback: true });
    assert.strictEqual(missingVersion.fallbacks[0].reason, "published-version-not-found");

    const wrongOwner = createHarness({
        events: {
            event: {
                id: "event", event_status: "active",
                published_version_id: "foreign", datos: { fallback: true }
            }
        },
        versions: {
            foreign: { id: "foreign", event_id: "another-event", content: { private: true } }
        }
    });
    assert.deepStrictEqual(await wrongOwner.resolver.resolvePublicEvent("event"), { fallback: true });
    assert.strictEqual(wrongOwner.fallbacks[0].reason, "published-version-owner-mismatch");

    const archived = createHarness({
        events: {
            archived: {
                id: "archived", event_status: "archived",
                published_version_id: "version-1", datos: { mustNotLeak: true }
            }
        },
        versions: {
            "version-1": { id: "version-1", event_id: "archived", content: { mustNotLeak: true } }
        }
    });
    await expectCode("PUBLIC_EVENT_NOT_FOUND", () => archived.resolver.resolvePublicEvent("archived"));
    assert.deepStrictEqual(archived.calls, [["event", "archived"]]);

    const missingEvent = createHarness();
    await expectCode("PUBLIC_EVENT_NOT_FOUND", () => missingEvent.resolver.resolvePublicEvent("missing"));

    const invalidFallback = createHarness({
        events: {
            invalid: {
                id: "invalid", event_status: "active",
                published_version_id: null, datos: ["not", "an", "object"]
            }
        }
    });
    await expectCode(
        "PUBLIC_EVENT_INVALID_CONTENT",
        () => invalidFallback.resolver.resolvePublicEvent("invalid")
    );

    const invalidVersionContent = createHarness({
        events: {
            event: {
                id: "event", event_status: "active",
                published_version_id: "version-1", datos: { fallback: true }
            }
        },
        versions: {
            "version-1": { id: "version-1", event_id: "event", content: null }
        }
    });
    assert.deepStrictEqual(
        await invalidVersionContent.resolver.resolvePublicEvent("event"),
        { fallback: true }
    );
    assert.strictEqual(invalidVersionContent.fallbacks[0].reason, "published-version-content-invalid");

    const catalogContent = {
        schema_version: 2,
        template: { slug: "boda-vertical" },
        theme: { slug: "elegante" },
        metadata: { demo: true, purpose: "template-catalog-preview" }
    };
    const catalog = createHarness({
        events: {
            demo: {
                id: "demo",
                event_status: "active",
                published_version_id: "published",
                datos: { mustNotLeak: true }
            }
        },
        versions: {
            published: {
                id: "published",
                event_id: "demo",
                workflow_status: "approved",
                content: catalogContent
            }
        },
        validatePublishedContent: (content) => ({ valid: content === catalogContent })
    });
    assert.deepStrictEqual(
        await catalog.resolver.resolveCatalogPreview("demo", {
            templateSlug: "boda-vertical",
            themeSlug: "elegante"
        }),
        { eventId: "demo", versionId: "published", content: catalogContent }
    );
    assert.deepStrictEqual(catalog.fallbacks, []);

    for (const event of [
        null,
        { id: "demo", event_status: "archived", published_version_id: "published", datos: { fallback: true } },
        { id: "demo", event_status: "active", published_version_id: null, datos: { fallback: true } }
    ]) {
        const unavailable = createHarness({ events: event ? { demo: event } : {} });
        await expectCode(
            "CATALOG_PREVIEW_NOT_FOUND",
            () => unavailable.resolver.resolveCatalogPreview("demo", {
                templateSlug: "boda-vertical", themeSlug: "elegante"
            })
        );
        assert.deepStrictEqual(unavailable.fallbacks, []);
    }

    const approvedButNotPublished = createHarness({
        events: {
            demo: { id: "demo", event_status: "active", published_version_id: "published", datos: { fallback: true } }
        },
        versions: {
            published: {
                id: "other-approved",
                event_id: "demo",
                workflow_status: "approved",
                content: catalogContent
            }
        }
    });
    await expectCode(
        "CATALOG_PREVIEW_NOT_FOUND",
        () => approvedButNotPublished.resolver.resolveCatalogPreview("demo", {
            templateSlug: "boda-vertical", themeSlug: "elegante"
        })
    );
    assert.deepStrictEqual(approvedButNotPublished.fallbacks, []);

    const invalidCatalogCases = [
        { ...catalogContent, schema_version: 1 },
        { ...catalogContent, template: { slug: "another-template" } },
        { ...catalogContent, theme: { slug: "another-theme" } },
        { ...catalogContent, metadata: { demo: false, purpose: "template-catalog-preview" } },
        { ...catalogContent, metadata: { demo: true, purpose: "another-purpose" } }
    ];
    for (const content of invalidCatalogCases) {
        const invalidCatalog = createHarness({
            events: {
                demo: { id: "demo", event_status: "active", published_version_id: "published", datos: { fallback: true } }
            },
            versions: {
                published: { id: "published", event_id: "demo", workflow_status: "approved", content }
            }
        });
        await expectCode(
            "CATALOG_PREVIEW_INVALID_CONTENT",
            () => invalidCatalog.resolver.resolveCatalogPreview("demo", {
                templateSlug: "boda-vertical", themeSlug: "elegante"
            })
        );
        assert.deepStrictEqual(invalidCatalog.fallbacks, []);
    }

    const rejectedByValidator = createHarness({
        events: {
            demo: { id: "demo", event_status: "active", published_version_id: "published", datos: { fallback: true } }
        },
        versions: {
            published: {
                id: "published",
                event_id: "demo",
                workflow_status: "approved",
                content: catalogContent
            }
        },
        validatePublishedContent: () => ({ valid: false, errors: ["synthetic"] })
    });
    await expectCode(
        "CATALOG_PREVIEW_INVALID_CONTENT",
        () => rejectedByValidator.resolver.resolveCatalogPreview("demo", {
            templateSlug: "boda-vertical", themeSlug: "elegante"
        })
    );

    console.log("public-event-resolver tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
