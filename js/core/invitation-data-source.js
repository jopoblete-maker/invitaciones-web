(function (root, factory) {
    const source = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = source;
    }

    root.InvitationDataSource = source;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const ALLOWED_FIXTURES = new Set(["boda-civil-esencial"]);
    const ALLOWED_DRAFTS = new Set([
        "kaly-joha-boda-civil",
        "demo-event-v2",
        "ycor-template-demo-boda-vertical"
    ]);

    function isLoopbackHost(hostname) {
        return ["localhost", "127.0.0.1", "::1"].includes(hostname);
    }

    function isLocalPreviewHost(hostname) {
        return (
            isLoopbackHost(hostname) ||
            /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
            /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
            /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
        );
    }

    function selectInvitationSource(search, hostname) {
        const params = new URLSearchParams(search || "");
        const previewToken = params.get("previewToken");
        if (previewToken) {
            return {
                mode: "private-preview",
                privatePreview: true,
                url: `/api/preview?token=${encodeURIComponent(previewToken)}`
            };
        }
        const isPrivatePreview = params.get("preview") === "1";

        if (isPrivatePreview) {
            const eventId = params.get("eventId");
            const versionId = params.get("versionId");
            if (!isLoopbackHost(hostname) || !eventId || !versionId) {
                return { mode: "invalid-preview", privatePreview: true };
            }
            return {
                mode: "private-preview",
                privatePreview: true,
                eventId,
                versionId,
                url: `/api/preview/eventos/${encodeURIComponent(eventId)}/versions/${encodeURIComponent(versionId)}`
            };
        }

        const devDraft = params.get("devDraft");
        if (devDraft) {
            return isLocalPreviewHost(hostname) && ALLOWED_DRAFTS.has(devDraft)
                ? {
                    mode: "local-draft",
                    url: `/__dev-drafts/${encodeURIComponent(devDraft)}.event.json`
                }
                : { mode: "invalid-preview" };
        }

        const devFixture = params.get("devFixture");
        if (devFixture) {
            return isLocalPreviewHost(hostname) && ALLOWED_FIXTURES.has(devFixture)
                ? {
                    mode: "local-fixture",
                    url: `/__dev-fixtures/${encodeURIComponent(devFixture)}.fixture.json`
                }
                : { mode: "invalid-preview" };
        }

        const id = params.get("id");
        return id
            ? { mode: "public", eventId: id, url: `/api/eventos/${encodeURIComponent(id)}` }
            : { mode: "missing" };
    }

    async function loadInvitationSource(source, fetchImpl = globalThis.fetch) {
        if (!source || ["missing", "invalid-preview"].includes(source.mode)) {
            throw new Error(source?.mode === "invalid-preview"
                ? "Vista previa no disponible."
                : "ID de invitacion no especificado.");
        }

        const options = source.mode === "public" ? undefined : { cache: "no-store" };
        const response = await fetchImpl(source.url, options);
        if (!response.ok) {
            throw new Error(source.mode === "public"
                ? "Invitacion no encontrada."
                : "Vista previa no disponible.");
        }
        return response.json();
    }

    function showPrivatePreviewBadge(documentRef) {
        if (!documentRef || documentRef.getElementById("privatePreviewBadge")) return;
        const badge = documentRef.createElement("div");
        badge.id = "privatePreviewBadge";
        badge.className = "private-preview-badge";
        badge.setAttribute("role", "status");
        badge.textContent = "VISTA PREVIA \u2014 NO PUBLICADO";
        documentRef.body.prepend(badge);
        documentRef.body.classList.add("is-private-preview");
    }

    return {
        isLoopbackHost,
        isLocalPreviewHost,
        selectInvitationSource,
        loadInvitationSource,
        showPrivatePreviewBadge
    };
});
