"use strict";

// Adapt only the legacy wire contract. All access decisions remain in adminAccess.
function createAdminLegacyAccess(adminAccess) {
    return async function authorizeLegacy(req, res) {
        const bodyPassword = req.body?.password;
        const headerPassword = typeof req.get === "function"
            ? req.get("X-Admin-Password") : req.headers?.["x-admin-password"];
        const credential = headerPassword !== undefined && headerPassword !== bodyPassword
            ? undefined : bodyPassword;
        const adapted = {
            get(name) {
                if (name.toLowerCase() === "x-admin-password") return credential;
                return typeof req.get === "function" ? req.get(name) : req.headers?.[name.toLowerCase()];
            }
        };
        const result = await adminAccess.authorize(adapted, {
            mutate: true, endpoint: "/api/eventos", action: "legacy-save", originFirst: true
        });
        if (result.ok) return true;
        if (result.code === "RATE_LIMITED") res.setHeader("Retry-After", String(result.retryAfterSeconds));
        res.status(result.status).json({ error: result.message });
        return false;
    };
}

module.exports = { createAdminLegacyAccess };
