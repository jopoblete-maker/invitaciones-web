const http = require("http");
const fs = require("fs");
const path = require("path");
const { validateEventForPersistence } = require("../js/core/event-validator");
const { createPrivatePreviewBridge } = require("./private-preview-bridge");
const { EVENT_ID, CANDIDATE_EVENT_ID, preparePremiumLocalPreview } = require("./premium-local-preview");

const ROOT = path.resolve(__dirname, "..");
const HOST = process.env.PREVIEW_HOST || "127.0.0.1";
const PORT = Number(process.env.PREVIEW_PORT || 4173);

const CONTENT_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mp4": "video/mp4",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg"
};

function validateDraftContent(raw) {
    let draft;
    try {
        draft = JSON.parse(raw);
    } catch {
        return {
            valid: false,
            status: 400,
            body: {
                error: "Draft JSON invalido.",
                validationErrors: ["El archivo no contiene JSON valido."]
            }
        };
    }

    const validation = validateEventForPersistence(draft);
    if (!validation.valid) {
        return {
            valid: false,
            status: 422,
            body: {
                error: "El draft no es valido para preview.",
                validationErrors: validation.errors
            }
        };
    }

    return { valid: true, status: 200, body: draft };
}

function sendJson(res, status, body) {
    const content = JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type": CONTENT_TYPES[".json"],
        "Content-Length": Buffer.byteLength(content),
        "Cache-Control": "no-store"
    });
    res.end(content);
}

function createPreviewRequestHandler(options = {}) {
    // Trusted Node composition only. Tests supply synthetic JSON inputs without
    // reading commercial files; HTTP requests cannot select or replace this loader.
    const loadPremiumPreviewInput = options.loadPremiumPreviewInput || (() => {
        const draftPath = path.join(ROOT, ".dev", "drafts", `${EVENT_ID}.event.json`);
        const approvalPath = path.join(ROOT, ".dev", "premium", `${EVENT_ID}.authorization.json`);
        if (fs.statSync(draftPath).size > 12 * 1024 * 1024 || fs.statSync(approvalPath).size > 12 * 1024 * 1024) throw new Error();
        return { content: JSON.parse(fs.readFileSync(draftPath, "utf8")),
            configuration: JSON.parse(fs.readFileSync(approvalPath, "utf8")) };
    });
    // Fixed local candidate files, independent of the published reference and approval.
    function loadCandidateFiles(suffix) {
        const contentPath = path.join(ROOT, ".dev", "premium", `${CANDIDATE_EVENT_ID}.${suffix}.event.json`);
        const approvalPath = path.join(ROOT, ".dev", "premium", `${CANDIDATE_EVENT_ID}.${suffix}.authorization.json`);
        if (fs.statSync(contentPath).size > 12 * 1024 * 1024 || fs.statSync(approvalPath).size > 12 * 1024 * 1024) throw new Error();
        return { content: JSON.parse(fs.readFileSync(contentPath, "utf8")),
            configuration: JSON.parse(fs.readFileSync(approvalPath, "utf8")) };
    }
    const loadPremiumCandidateInput = options.loadPremiumCandidateInput || (() => loadCandidateFiles("b17-candidate"));
    const loadPremiumE2CandidateInput = options.loadPremiumE2CandidateInput || (() => loadCandidateFiles("b17-e2-candidate"));
    const loadPremiumE4CandidateInput = options.loadPremiumE4CandidateInput || (() => loadCandidateFiles("b17-e4-candidate"));
    const privatePreviewBridge = createPrivatePreviewBridge({
        apiBaseUrl: options.apiBaseUrl ?? process.env.YCOR_API_BASE_URL,
        adminPassword: options.adminPassword ?? process.env.YCOR_ADMIN_PASSWORD,
        fetchImpl: options.fetchImpl ?? globalThis.fetch
    });

    return function handlePreviewRequest(req, res) {
        let pathname;
        try {
            const requestUrl = new URL(req.url, `http://${HOST}:${PORT}`);
            pathname = decodeURIComponent(requestUrl.pathname);
        } catch (_) {
            res.writeHead(400); res.end("Invalid request"); return;
        }

        if ([`/__premium-local-preview/${EVENT_ID}`, `/__premium-local-preview/${CANDIDATE_EVENT_ID}`,
            `/__premium-local-preview/${CANDIDATE_EVENT_ID}/b17-e2`,
            `/__premium-local-preview/${CANDIDATE_EVENT_ID}/b17-e4`].includes(pathname)) {
            const address = req.socket?.remoteAddress;
            if (address && !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) {
                sendJson(res, 403, { error: "Local preview only." }); return;
            }
            if ((req.method || "GET") !== "GET") { sendJson(res, 405, { error: "Method not allowed." }); return; }
            try {
                const candidate = pathname !== `/__premium-local-preview/${EVENT_ID}`;
                const input = pathname.endsWith("/b17-e4") ? loadPremiumE4CandidateInput()
                    : pathname.endsWith("/b17-e2") ? loadPremiumE2CandidateInput()
                    : candidate ? loadPremiumCandidateInput() : loadPremiumPreviewInput();
                // Every loader, including synthetic tests, uses the same budget,
                // private authorization and full event validation composition.
                const result = preparePremiumLocalPreview(input.content, input.configuration,
                    { eventId: candidate ? CANDIDATE_EVENT_ID : EVENT_ID });
                sendJson(res, result.accepted ? 200 : 422, result.accepted
                    ? { content: result.content, presentation: result.presentation }
                    : { error: "Premium preview unavailable." });
            } catch (_) { sendJson(res, 422, { error: "Premium preview unavailable." }); }
            return;
        }

        // Never serve private approvals, reference material or Node modules.
        // Reject both separators and traversal before mapping dev aliases.
        if (pathname.includes("\\") || pathname.includes("%")
            || pathname.split("/").some(segment => segment === "." || segment === "..")
            || /^\/(?:backend|scripts|node_modules)(?:\/|$)/i.test(pathname)) {
            res.writeHead(404); res.end("Not found"); return;
        }

        if (privatePreviewBridge.matches(pathname)) {
            privatePreviewBridge.handle(req, res, pathname);
            return;
        }

        if (pathname.split("/").some((segment) => segment.startsWith("."))) {
            res.writeHead(404, { "Cache-Control": "no-store" });
            res.end("Not found");
            return;
        }

        const isDraftRequest = pathname.startsWith("/__dev-drafts/");
        const relativePath = pathname.startsWith("/__dev-fixtures/")
            ? path.join(".dev", "fixtures", pathname.replace("/__dev-fixtures/", ""))
            : isDraftRequest
                ? path.join(".dev", "drafts", pathname.replace("/__dev-drafts/", ""))
                : pathname === "/" ? "invitacion.html" : pathname.slice(1);
        const filePath = path.resolve(ROOT, relativePath);

        if (!filePath.startsWith(ROOT + path.sep)) {
            res.writeHead(403);
            res.end("Forbidden");
            return;
        }

        const normalizedFile = path.relative(ROOT, filePath).split(path.sep).join("/").toLowerCase();
        if (normalizedFile.startsWith(".dev/premium/") || normalizedFile.startsWith(".dev/referencias/")
            || normalizedFile === `.dev/drafts/${EVENT_ID}.event.json`) {
            res.writeHead(404); res.end("Not found"); return;
        }

        if (isDraftRequest) {
            fs.readFile(filePath, "utf8", (readError, raw) => {
                if (readError) {
                    res.writeHead(readError.code === "ENOENT" ? 404 : 500);
                    res.end(readError.code === "ENOENT" ? "Not found" : "Server error");
                    return;
                }

                const result = validateDraftContent(raw);
                sendJson(res, result.status, result.body);
            });
            return;
        }

        fs.stat(filePath, (statError, stat) => {
            if (statError || !stat.isFile()) {
                res.writeHead(statError?.code === "ENOENT" ? 404 : 500);
                res.end(statError?.code === "ENOENT" ? "Not found" : "Server error");
                return;
            }

            const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
            const range = req.headers.range;

            if (range) {
                const match = range.match(/^bytes=(\d*)-(\d*)$/);
                if (!match) {
                    res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
                    res.end();
                    return;
                }

                const start = match[1] ? Number(match[1]) : 0;
                const end = match[2] ? Number(match[2]) : stat.size - 1;
                if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end >= stat.size) {
                    res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
                    res.end();
                    return;
                }

                res.writeHead(206, {
                    "Content-Type": contentType,
                    "Content-Length": end - start + 1,
                    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
                    "Accept-Ranges": "bytes",
                    "Cache-Control": "no-store"
                });
                fs.createReadStream(filePath, { start, end }).pipe(res);
                return;
            }

            res.writeHead(200, {
                "Content-Type": contentType,
                "Content-Length": stat.size,
                "Accept-Ranges": "bytes",
                "Cache-Control": "no-store"
            });
            fs.createReadStream(filePath).pipe(res);
        });
    };
}

const handleRequest = createPreviewRequestHandler();

function createPreviewServer(options) {
    return http.createServer(createPreviewRequestHandler(options));
}

if (require.main === module) {
    createPreviewServer().listen(PORT, HOST, () => {
        console.log(`Preview local: http://${HOST}:${PORT}/invitacion.html?devFixture=boda-civil-esencial`);
        console.log(`Draft v1: http://${HOST}:${PORT}/invitacion.html?devDraft=kaly-joha-boda-civil`);
        console.log(`Draft v2: http://${HOST}:${PORT}/invitacion.html?devDraft=demo-event-v2`);
    });
}

module.exports = {
    createPreviewServer,
    createPreviewRequestHandler,
    handleRequest,
    validateDraftContent
};
