"use strict";

const fs = require("fs");
const path = require("path");

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
    const privateResponse = (res) => res.status(404).end();
    const invitationRequests = new WeakSet();
    const publicStatic = express.static(rootPath, { dotfiles: "ignore" });
    const invitationStatic = express.static(rootPath, {
        dotfiles: "ignore", etag: false, lastModified: false, cacheControl: false
    });

    function privacyHeaders(res) {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Referrer-Policy", "no-referrer");
    }

    function guard(req, res, next) {
        let inspected;
        try { inspected = inspectUrl(req.url); } catch (_error) { return privateResponse(res); }
        if (inspected.blocked) return privateResponse(res);
        // Match the static server's single decode for physical resolution.
        const candidate = path.resolve(rootPath, `.${inspected.actual}`);
        if (!within(rootPath, candidate) || within(backendPath, candidate)) return privateResponse(res);
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
            if (!within(rootPath, resolved) || within(backendPath, resolved)) return privateResponse(res);
            if (resolved.toLowerCase() === invitationPath.toLowerCase()) {
                invitationRequests.add(req);
                privacyHeaders(res);
            }
            return next();
        });
    }

    function serveRoot(req, res, next) {
        const serve = invitationRequests.has(req) ? invitationStatic : publicStatic;
        return serve(req, res, next);
    }

    return Object.freeze({ guard, serveRoot });
}

module.exports = { createStaticPolicy };
