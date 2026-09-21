"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const adminScript = fs.readFileSync(path.join(root, "js", "admin.js"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const executableAdminScript = adminScript.replace(/\/\*[\s\S]*?\*\//g, "");

assert.strictEqual(adminScript.includes("ADMIN_PASSWORD_HASH"), false);
assert.strictEqual(adminScript.includes("sessionStorage"), false);
assert.strictEqual(adminScript.includes("localStorage"), false);
assert.strictEqual(adminScript.includes("handleSubmit"), true);
assert.strictEqual(adminScript.includes('addEventListener("submit", handleSubmit)'), false);
assert.strictEqual(executableAdminScript.includes("fetch("), false);
assert.strictEqual(executableAdminScript.includes('method: "POST"'), false);
assert.strictEqual(adminHtml.includes('id="legacyAdminControls" hidden'), true);
assert.strictEqual(adminHtml.includes('src="js/core/admin-editorial-client.js"'), true);
assert.strictEqual(adminHtml.includes('id="editorialReaderForm"'), true);
assert.strictEqual(adminHtml.includes('id="editorialState"'), true);

console.log("admin-editorial-read-only test passed");
