"use strict";
// Fixed loopback entrypoint. No administrative bridge or remote API configuration.
const { createPreviewServer } = require("./dev-preview-server");
if (require.main === module) {
    const server = createPreviewServer({ apiBaseUrl: "", adminPassword: "" });
    server.listen(4175, "127.0.0.1", () =>
        console.log("Preview local: http://127.0.0.1:4175/invitacion.html?devDraft=angel-eli-boda"));
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
        server.closeAllConnections(); server.close();
    });
}
