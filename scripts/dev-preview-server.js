const http = require("http");
const fs = require("fs");
const path = require("path");
const { validateEventForPersistence } = require("../js/core/event-validator");

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

function handleRequest(req, res) {
    const requestUrl = new URL(req.url, `http://${HOST}:${PORT}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
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
}

function createPreviewServer() {
    return http.createServer(handleRequest);
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
    handleRequest,
    validateDraftContent
};
