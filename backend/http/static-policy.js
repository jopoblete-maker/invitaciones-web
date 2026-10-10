"use strict";

const fs = require("fs");
const path = require("path");

// Browser entrypoints, HTML script references, registered template styles/media
// and existing legacy data. Never expose whole source or asset directories.
const PUBLIC_FILES = new Set([
    "index.html", "admin.html", "catalogo.html", "invitacion.html",
    "js/main.js", "js/admin.js", "js/catalogo.js", "js/invitacion.js",
    "js/core/admin-editorial-client.js", "js/core/admin-event-editor.js",
    "js/core/admin-editorial-workflow.js", "js/core/event-schema.js",
    "js/core/admin-event-summary.js", "js/core/admin-dashboard.js", "css/admin.css",
    "js/core/admin-event-detail.js",
    "js/core/admin-event-create.js", "js/core/admin-event-create-builder.js",
    "js/core/plan-registry.js", "js/core/section-contracts.js",
    "js/core/module-registry.js", "js/core/event-validator.js",
    "js/core/theme-registry.js", "js/core/event-normalizer.js",
    "js/core/template-registry.js", "js/core/template-catalog.js",
    "js/core/section-renderer.js", "js/core/invitation-data-source.js",
    "js/core/calendar-actions.js", "js/core/countdown.js", "js/core/rsvp.js",
    "css/style.css", "css/catalogo.css", "css/invitacion.css",
    "css/templates/boda-vertical.css", "css/templates/cumple-clasico.css",
    "css/templates/boda-civil-esencial.css",
    "data.json", "data/moira-20-12-2026.json",
    "assets/musica.mp3",
    "assets/templates/boda-vertical/thumbnail.webp",
    "assets/templates/boda-vertical/demo/hero.svg",
    "assets/templates/boda-vertical/demo/closing.svg",
    "assets/templates/cumple-clasico/thumbnail.webp",
    "assets/templates/boda-civil-esencial/thumbnail.webp",
    "assets/templates/boda-civil-esencial/demo/hero.webp",
    "assets/events/kaly-joha/01-invitacion.gif",
    "assets/events/kaly-joha/02-portada.gif",
    "assets/events/kaly-joha/03-cierre.gif",
    "assets/events/kaly-joha/cierre-animado.gif",
    "assets/events/kaly-joha/musica.mp3"
]);

function within(directory, candidate) {
    const relative = path.relative(directory, candidate);
    return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function inspectUrl(url) {
    let value = (url || "/").split("?")[0];
    const actual = decodeURIComponent(value);
    // Decode repeatedly for inspection only. The static middleware retains its
    // original URL; alternate encodings never gain access to the private tree.
    for (let depth = 0; depth < 8; depth++) {
        const decoded = decodeURIComponent(value);
        if (decoded === value) break;
        value = decoded;
        if (depth === 7 && /%[0-9a-f]{2}/i.test(value)) throw new Error("Invalid path");
    }
    if (/[\0-\x1f\x7f]/.test(value)) throw new Error("Invalid path");
    value = value.replace(/\\/g, "/");
    const segments = value.split("/");
    const normalized = path.posix.normalize(`/${value}`);
    const privateSegment = (segment) => segment.replace(/[ .]+$/g, "").split(":")[0].toLowerCase() === "backend";
    return { normalized, actual, blocked: segments.some(privateSegment) || normalized.split("/").some(privateSegment) };
}

function createStaticPolicy({ root, express }) {
    const rootPath = fs.realpathSync(root);
    const backendPath = fs.realpathSync(path.join(rootPath, "backend"));
    const invitationPath = path.join(rootPath, "invitacion.html");
    function allowed(candidate) {
        if (!within(rootPath, candidate)) return false;
        const relative = path.relative(rootPath, candidate).split(path.sep).join("/").toLowerCase();
        return PUBLIC_FILES.has(relative);
    }
    const privateResponse = (res) => res.status(404).end();
    const invitationRequests = new WeakSet();
    const dynamicRequests = new WeakSet();
    const publicStatic = express.static(rootPath, { dotfiles: "ignore" });
    const invitationStatic = express.static(rootPath, {
        dotfiles: "ignore", etag: false, lastModified: false, cacheControl: false
    });

    function privacyHeaders(res) {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Referrer-Policy", "no-referrer");
    }

    function guard(req, res, next) {
        // Existing API handlers are mounted after static middleware. Let them
        // dispatch without ever exposing an API path through express.static.
        if (/^\/api(?:\/|\?|$)/i.test(req.url)) {
            dynamicRequests.add(req);
            return next();
        }
        let inspected;
        try { inspected = inspectUrl(req.url); } catch (_error) { return privateResponse(res); }
        if (inspected.blocked) return privateResponse(res);
        // Match the static server's single decode for physical resolution.
        if (inspected.actual.includes("\\")) return privateResponse(res);
        const candidate = path.resolve(rootPath, `.${inspected.actual === "/" ? "/index.html" : inspected.actual}`);
        if (!allowed(candidate) || within(backendPath, candidate)) return privateResponse(res);
        const invitation = candidate.toLowerCase() === invitationPath.toLowerCase();
        if (invitation) {
            invitationRequests.add(req);
            privacyHeaders(res);
        }
        fs.realpath(candidate, (error, resolved) => {
            if (error) {
                if (error.code === "ENOENT" || error.code === "ENOTDIR") return next();
                return privateResponse(res);
            }
            if (!allowed(resolved) || within(backendPath, resolved)) return privateResponse(res);
            fs.stat(resolved, (statError, entry) => {
                // An allowlisted filename cannot become a directory exposing
                // an implicit index or a junction into another tree.
                if (statError || !entry.isFile()) return privateResponse(res);
                if (resolved.toLowerCase() === invitationPath.toLowerCase()) {
                    invitationRequests.add(req);
                    privacyHeaders(res);
                }
                return next();
            });
        });
    }

    function serveRoot(req, res, next) {
        if (dynamicRequests.has(req)) return next();
        const serve = invitationRequests.has(req) ? invitationStatic : publicStatic;
        return serve(req, res, next);
    }

    return Object.freeze({ guard, serveRoot });
}

module.exports = { createStaticPolicy };
