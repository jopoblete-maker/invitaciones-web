const assert = require("assert");
const fs = require("fs");
const path = require("path");
const InvitationDataSource = require("../js/core/invitation-data-source");

const VERSION_ID = "11111111-1111-4111-8111-111111111111";

(async () => {
    const publicSource = InvitationDataSource.selectInvitationSource(
        "?id=public-event",
        "invitaciones.example.test"
    );
    assert.deepStrictEqual(publicSource, {
        mode: "public",
        eventId: "public-event",
        url: "/api/eventos/public-event"
    });
    const publicCalls = [];
    await InvitationDataSource.loadInvitationSource(publicSource, async (url, options) => {
        publicCalls.push({ url, options });
        return { ok: true, json: async () => ({ public: true }) };
    });
    assert.deepStrictEqual(publicCalls, [{ url: "/api/eventos/public-event", options: undefined }]);

    const previewSource = InvitationDataSource.selectInvitationSource(
        `?preview=1&eventId=preview-event&versionId=${VERSION_ID}`,
        "127.0.0.1"
    );
    assert.deepStrictEqual(previewSource, {
        mode: "private-preview",
        privatePreview: true,
        eventId: "preview-event",
        versionId: VERSION_ID,
        url: `/api/preview/eventos/preview-event/versions/${VERSION_ID}`
    });
    const previewCalls = [];
    await InvitationDataSource.loadInvitationSource(previewSource, async (url, options) => {
        previewCalls.push({ url, options });
        return { ok: false, status: 404 };
    }).then(
        () => assert.fail("Preview failure must reject."),
        (error) => assert.match(error.message, /Vista previa/)
    );
    assert.deepStrictEqual(previewCalls, [{
        url: `/api/preview/eventos/preview-event/versions/${VERSION_ID}`,
        options: { cache: "no-store" }
    }]);
    assert(previewCalls.every((call) => !call.url.startsWith("/api/eventos/")));

    const remotePreview = InvitationDataSource.selectInvitationSource(
        `?preview=1&eventId=preview-event&versionId=${VERSION_ID}`,
        "invitaciones.example.test"
    );
    assert.deepStrictEqual(remotePreview, { mode: "invalid-preview", privatePreview: true });
    const lanPreview = InvitationDataSource.selectInvitationSource(
        `?preview=1&eventId=preview-event&versionId=${VERSION_ID}`,
        "192.168.1.25"
    );
    assert.deepStrictEqual(lanPreview, { mode: "invalid-preview", privatePreview: true });

    assert.strictEqual(
        InvitationDataSource.selectInvitationSource(
            "?devDraft=demo-event-v2",
            "localhost"
        ).url,
        "/__dev-drafts/demo-event-v2.event.json"
    );
    assert.strictEqual(
        InvitationDataSource.selectInvitationSource(
            "?devFixture=boda-civil-esencial",
            "localhost"
        ).url,
        "/__dev-fixtures/boda-civil-esencial.fixture.json"
    );

    const inserted = [];
    const bodyClasses = [];
    const documentDouble = {
        getElementById(id) {
            return inserted.find((element) => element.id === id) || null;
        },
        createElement() {
            return {
                setAttribute(name, value) { this[name] = value; }
            };
        },
        body: {
            prepend(element) { inserted.unshift(element); },
            classList: { add(name) { bodyClasses.push(name); } }
        }
    };
    InvitationDataSource.showPrivatePreviewBadge(documentDouble);
    assert.strictEqual(inserted[0].textContent, "VISTA PREVIA — NO PUBLICADO");
    assert(bodyClasses.includes("is-private-preview"));
    assert.strictEqual(publicSource.privatePreview, undefined);

    const sourceCode = fs.readFileSync(
        path.resolve(__dirname, "..", "js", "core", "invitation-data-source.js"),
        "utf8"
    );
    assert(!sourceCode.includes("localStorage"));
    assert(!sourceCode.includes("sessionStorage"));
    assert(!sourceCode.includes("X-Admin-Password"));

    console.log("invitation-data-source tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
