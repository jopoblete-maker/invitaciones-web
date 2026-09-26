"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const adminScript = fs.readFileSync(path.join(root, "js", "admin.js"), "utf8");
const editorialClient = fs.readFileSync(path.join(root, "js", "core", "admin-editorial-client.js"), "utf8");
const editorialWorkflow = fs.readFileSync(path.join(root, "js", "core", "admin-editorial-workflow.js"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const executableAdminScript = adminScript.replace(/\/\*[\s\S]*?\*\//g, "");

assert.strictEqual(adminScript.includes("ADMIN_PASSWORD_HASH"), false);
assert.strictEqual(adminScript.includes("sessionStorage"), false);
assert.strictEqual(adminScript.includes("localStorage"), false);
assert.strictEqual(editorialClient.includes("sessionStorage"), false);
assert.strictEqual(editorialClient.includes("localStorage"), false);
assert.strictEqual(editorialWorkflow.includes("sessionStorage"), false);
assert.strictEqual(editorialWorkflow.includes("localStorage"), false);
assert.strictEqual(adminScript.includes("handleSubmit"), true);
assert.strictEqual(adminScript.includes('addEventListener("submit", handleSubmit)'), false);
assert.strictEqual(executableAdminScript.includes("fetch("), false);
assert.strictEqual(executableAdminScript.includes('method: "POST"'), false);
assert.strictEqual(adminHtml.includes('id="legacyAdminControls" hidden'), true);
assert.strictEqual(adminHtml.includes('src="js/core/admin-editorial-client.js"'), true);
assert.strictEqual(adminHtml.includes('src="js/core/admin-editorial-workflow.js"'), true);
assert.strictEqual(adminHtml.includes('id="editorialReaderForm"'), true);
assert.strictEqual(adminHtml.includes('id="editorialState"'), true);
assert.strictEqual(adminHtml.includes("sin realizar cambios"), false);
assert.strictEqual(editorialClient.includes('fetchImpl("/api/eventos"'), false);
assert.strictEqual(editorialClient.includes('fetchImpl(`/api/eventos'), false);
assert.strictEqual(adminScript.includes("Version UUID:"), true);
assert.strictEqual(adminScript.includes("Numero de version:"), true);
assert.strictEqual(adminScript.includes("cambiara la invitacion publica"), true);
assert.strictEqual(adminScript.includes("executeEditorialAction(action, button)"), true);

console.log("admin-editorial-read-only test passed");
