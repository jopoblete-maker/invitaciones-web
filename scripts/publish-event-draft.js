#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { validateNewEvent } = require("../js/core/event-validator");

const ROOT = path.resolve(__dirname, "..");
const DRAFTS_DIR = path.join(ROOT, ".dev", "drafts");
const PUBLIC_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseArgs(argv) {
    const args = {
        overwrite: false,
        dryRun: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--overwrite") {
            args.overwrite = true;
        } else if (arg === "--dry-run") {
            args.dryRun = true;
        } else if (arg === "--draft" || arg === "--id" || arg === "--target") {
            const value = argv[index + 1];
            if (!value || value.startsWith("--")) {
                throw new Error(`Falta valor para ${arg}.`);
            }
            args[arg.slice(2)] = value;
            index += 1;
        } else {
            throw new Error(`Argumento no reconocido: ${arg}.`);
        }
    }

    ["draft", "id", "target"].forEach((name) => {
        if (!args[name]) throw new Error(`--${name} es obligatorio.`);
    });

    return args;
}

function validatePublicId(id) {
    return PUBLIC_ID_PATTERN.test(String(id || ""));
}

function resolveDraftPath(draftName) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(draftName || ""))) {
        throw new Error("El nombre del draft solo puede contener minusculas, numeros y guiones.");
    }

    const filePath = path.resolve(DRAFTS_DIR, `${draftName}.event.json`);
    const relative = path.relative(DRAFTS_DIR, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("Ruta de draft invalida.");
    }

    return filePath;
}

function loadDraft(draftName) {
    const filePath = resolveDraftPath(draftName);
    let raw;
    try {
        raw = fs.readFileSync(filePath, "utf8");
    } catch (error) {
        if (error.code === "ENOENT") {
            throw new Error(`Draft no encontrado: ${draftName}.`);
        }
        throw error;
    }

    try {
        return JSON.parse(raw);
    } catch {
        throw new Error(`Draft JSON invalido: ${draftName}.`);
    }
}

function normalizeTarget(target) {
    let url;
    try {
        url = new URL(target);
    } catch {
        throw new Error("--target debe ser una URL valida.");
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("--target debe usar http o https.");
    }

    return url.toString().replace(/\/+$/, "");
}

function buildPayload({ draft, id, password, overwrite = false }) {
    const payload = {
        password,
        id,
        ...draft
    };

    if (overwrite) payload.overwrite = true;
    return payload;
}

function safeSummary({ draftName, publicId, target, draft, validation, overwrite }) {
    return [
        `draft: ${draftName}`,
        `public id: ${publicId}`,
        `template: ${draft.template?.slug || "(sin template)"}`,
        `sections: ${Array.isArray(draft.sections) ? draft.sections.length : 0}`,
        `target: ${target}`,
        `overwrite: ${overwrite ? "si" : "no"}`,
        `status: ${validation.valid ? "VALID" : "INVALID"}`
    ];
}

async function publishDraft(options, requestImpl = globalThis.fetch) {
    if (!validatePublicId(options.id)) {
        throw new Error("--id debe usar minusculas, numeros y guiones, sin guion inicial ni final.");
    }

    const target = normalizeTarget(options.target);
    const draft = loadDraft(options.draft);
    const validation = validateNewEvent(draft);

    if (options.dryRun) {
        return {
            dryRun: true,
            validation,
            summary: safeSummary({
                draftName: options.draft,
                publicId: options.id,
                target,
                draft,
                validation,
                overwrite: options.overwrite
            })
        };
    }

    if (!validation.valid) {
        return {
            dryRun: false,
            validation,
            skipped: true,
            summary: safeSummary({
                draftName: options.draft,
                publicId: options.id,
                target,
                draft,
                validation,
                overwrite: options.overwrite
            })
        };
    }

    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
        throw new Error("ADMIN_PASSWORD no esta definido en el entorno.");
    }

    if (typeof requestImpl !== "function") {
        throw new Error("fetch no esta disponible.");
    }

    const payload = buildPayload({
        draft,
        id: options.id,
        password,
        overwrite: options.overwrite
    });

    const response = await requestImpl(`${target}/api/eventos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await parseResponseJson(response);

    if (!response.ok) {
        throw new Error(messageForStatus(response.status, data?.error));
    }

    return {
        dryRun: false,
        validation,
        response: data,
        summary: safeSummary({
            draftName: options.draft,
            publicId: options.id,
            target,
            draft,
            validation,
            overwrite: options.overwrite
        })
    };
}

async function parseResponseJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function messageForStatus(status, serverMessage) {
    const message = serverMessage ? ` ${serverMessage}` : "";
    const byStatus = {
        400: `Request invalido.${message}`,
        401: "Autenticacion fallida. Revisar ADMIN_PASSWORD.",
        409: `El public id ya existe. Usar --overwrite solo si corresponde.${message}`,
        413: `Payload demasiado grande.${message}`,
        500: `Error interno del servidor.${message}`,
        504: `Timeout del servidor.${message}`
    };
    return byStatus[status] || `Error HTTP ${status}.${message}`;
}

async function main() {
    try {
        const options = parseArgs(process.argv.slice(2));
        const result = await publishDraft(options);
        result.summary.forEach((line) => console.log(line));

        if (!result.validation.valid) {
            result.validation.errors.forEach((error) => console.error(`error: ${error}`));
            process.exitCode = 1;
            return;
        }

        if (result.dryRun) {
            console.log("dry-run: no se hizo request");
            return;
        }

        console.log(`publicado: ${result.response?.id || options.id}`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    PUBLIC_ID_PATTERN,
    buildPayload,
    loadDraft,
    normalizeTarget,
    parseArgs,
    publishDraft,
    resolveDraftPath,
    safeSummary,
    validatePublicId
};
