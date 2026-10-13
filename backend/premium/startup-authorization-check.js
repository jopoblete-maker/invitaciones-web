"use strict";

const { inspectSnapshotBudget, LIMITS } = require("./snapshot-budget");
const { createEventVersionEditorialService } = require("../../js/core/event-version-editorial-service");

/** Private Node startup check. Reference JSON is supplied independently of the
 * authorization configuration by trusted process composition. Never read a file,
 * HTTP input or manifest to reconstruct the expected canonical content.
 * Returns only DISABLED/PASS/FAIL; the caller owns logging and the premium gate.
 */
function checkPremiumStartupAuthorization({ enabled, referenceText, getAuthorizationState } = {}) {
    if (enabled === undefined || enabled === "" || enabled === "false") return "DISABLED";
    if (enabled !== "true") return "FAIL";
    try {
        if (typeof referenceText !== "string" || !referenceText
            || Buffer.byteLength(referenceText, "utf8") > LIMITS.maxBytes) return "FAIL";
        const reference = JSON.parse(referenceText);
        inspectSnapshotBudget(reference);
        if (!reference || reference.schema_version !== 2
            || reference.template?.slug !== "boda-fiesta-premium"
            || typeof reference.id !== "string"
            || Object.hasOwn(reference.metadata || {}, "demo")
            || Object.hasOwn(reference.metadata || {}, "purpose")
            || !Array.isArray(reference.sections)
            || !reference.sections.some(section => ["gallery", "dress-code", "gifts", "collaborative-album"].includes(section?.type))
            || typeof getAuthorizationState !== "function") return "FAIL";

        // No production adapter is reachable here. Even a future accidental
        // adapter invocation cannot write and forces the check to fail.
        let adapterInvoked = false;
        const forbiddenWrite = () => {
            adapterInvoked = true;
            throw new Error("STARTUP_CHECK_WRITE_FORBIDDEN");
        };
        const adapter = Object.freeze(Object.fromEntries([
            "createEvent", "createVersion", "transitionWorkflow", "publishVersion", "rollbackVersion"
        ].map(method => [method, forbiddenWrite])));
        const service = createEventVersionEditorialService(adapter, { getAuthorizationState });
        service.preparePremiumContent(reference.id, reference);
        return adapterInvoked ? "FAIL" : "PASS";
    } catch (_) {
        return "FAIL";
    }
}

module.exports = { checkPremiumStartupAuthorization };
