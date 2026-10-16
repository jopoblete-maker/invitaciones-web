(function (root, factory) {
    const contract = factory();
    if (typeof module === "object" && module.exports) module.exports = contract;
    root.EditorialPreconditions = contract;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
    const uuid = value => typeof value === "string"
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    const revision = value => typeof value === "string" && /^(0|[1-9][0-9]{0,18})$/.test(value)
        && BigInt(value) <= 9223372036854775807n;
    function failure(code) { return Object.assign(new Error("Invalid editorial preconditions."), { code }); }
    function canonicalUuid(value) {
        if (!uuid(value)) throw failure("INVALID_REQUEST");
        return value.toLowerCase();
    }
    // Read models can contain historical descriptive identifiers. Preserve them;
    // mutation boundaries use canonicalUuid and reject invalid UUID formats.
    const normalizeVersionId = value => uuid(value) ? canonicalUuid(value) : value;
    function normalizeState(state) {
        if (!state || typeof state !== "object" || Array.isArray(state)) return state;
        return { ...state,
            currentWorkingVersionId: normalizeVersionId(state.currentWorkingVersionId),
            publishedVersionId: normalizeVersionId(state.publishedVersionId),
            versions: Array.isArray(state.versions) ? state.versions.map(v => v && typeof v === "object"
                ? { ...v, versionId: normalizeVersionId(v.versionId),
                    ...(own(v, "sourceVersionId") ? { sourceVersionId: normalizeVersionId(v.sourceVersionId) } : {}) } : v) : state.versions };
    }
    function expectations(options, rollback = false) {
        const fields = ["expectedPublishedVersionId", "expectedPublicationRevision",
            ...(rollback ? ["expectedWorkingVersionId"] : [])];
        if (!options || fields.some(key => !own(options, key))) throw failure("PRECONDITION_REQUIRED");
        for (const key of fields) {
            if (key === "expectedPublicationRevision" ? !revision(options[key])
                : options[key] !== null && !uuid(options[key])) throw failure("INVALID_REQUEST");
        }
        return Object.fromEntries(fields.map(key => [key, key === "expectedPublicationRevision" || options[key] === null
            ? options[key] : canonicalUuid(options[key])]));
    }
    function resultingRevision(before, target) {
        return (BigInt(before.expectedPublicationRevision)
            + (normalizeVersionId(before.expectedPublishedVersionId) === normalizeVersionId(target) ? 0n : 1n)).toString();
    }
    function receipt(value, eventId, versionId, before) {
        return Boolean(value && value.eventId === eventId && uuid(versionId) && uuid(value.publishedVersionId)
            && canonicalUuid(value.publishedVersionId) === canonicalUuid(versionId)
            && revision(value.publicationRevision)
            && value.publicationRevision === resultingRevision(before, versionId));
    }
    return { uuid, canonicalUuid, normalizeVersionId, normalizeState, revision, expectations, resultingRevision, receipt };
});
