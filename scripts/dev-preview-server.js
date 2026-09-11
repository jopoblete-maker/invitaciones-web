const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HOST = "127.0.0.1";
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

const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${HOST}:${PORT}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const relativePath = pathname.startsWith("/__dev-fixtures/")
        ? path.join(".dev", "fixtures", pathname.replace("/__dev-fixtures/", ""))
        : pathname.startsWith("/__dev-drafts/")
            ? path.join(".dev", "drafts", pathname.replace("/__dev-drafts/", ""))
            : pathname === "/" ? "invitacion.html" : pathname.slice(1);
    const filePath = path.resolve(ROOT, relativePath);

    if (!filePath.startsWith(ROOT + path.sep)) {
        res.writeHead(403);
        res.end("Forbidden");
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
});

server.listen(PORT, HOST, () => {
    console.log(`Preview local: http://${HOST}:${PORT}/invitacion.html?devFixture=boda-civil-esencial`);
    console.log(`Draft local: http://${HOST}:${PORT}/invitacion.html?devDraft=kaly-joha-boda-civil`);
});
