#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { validateEventForPersistence } = require("../js/core/event-validator");
const { createEventEditorialApiClient, normalizeBaseUrl } = require("./event-editorial-api-client");

const ROOT = path.resolve(__dirname, "..");
const DRAFTS_DIR = path.join(ROOT, ".dev", "drafts");
const PUBLIC_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseArgs(argv) {
    const args = { overwrite: false, dryRun: false, legacy: false };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--overwrite") args.overwrite = true;
        else if (arg === "--dry-run") args.dryRun = true;
        else if (arg === "--legacy") args.legacy = true;
        else if (arg === "--help") args.help = true;
        else if (arg === "--draft" || arg === "--id" || arg === "--target") {
            const value = argv[index + 1];
            if (!value || value.startsWith("--")) throw new Error(`Falta valor para ${arg}.`);
            args[arg.slice(2)] = value;
            index += 1;
        } else {
            throw new Error(`Argumento no reconocido: ${arg}.`);
        }
    }

    if (!args.help) {
        ["draft", "id"].forEach((name) => {
            if (!args[name]) throw new Error(`--${name} es obligatorio.`);
        });
    }
    return args;
}

function validatePublicId(id) {
    return PUBLIC_ID_PATTERN.test(String(id || ""));
}

function resolveDraftPath(draftName) {
    if (!PUBLIC_ID_PATTERN.test(String(draftName || ""))) {
        throw new Error("El nombre del draft solo puede contener minusculas, numeros y guiones.");
    }
    const filePath = path.resolve(DRAFTS_DIR, `${draftName}.event.json`);
    const relative = path.relative(DRAFTS_DIR, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Ruta de draft invalida.");
    return filePath;
}

function loadDraft(draftName) {
    const filePath = resolveDraftPath(draftName);
    let raw;
    try {
        raw = fs.readFileSync(filePath, "utf8");
    } catch (error) {
        if (error.code === "ENOENT") throw new Error(`Draft no encontrado: ${draftName}.`);
        throw error;
    }
    try {
        return JSON.parse(raw);
    } catch {
        throw new Error(`Draft JSON invalido: ${draftName}.`);
    }
}

function normalizeTarget(target) {
    return normalizeBaseUrl(target);
}

function buildPayload({ draft, id, password, overwrite = false }) {
    const payload = { ...draft, password, id };
    if (overwrite) payload.overwrite = true;
    else delete payload.overwrite;
    return payload;
}

function resolveSourceVersionId(state) {
    return state.currentWorkingVersionId ?? state.publishedVersionId ?? null;
}

function safeSummary({ draftName, publicId, target, draft, validation, mode, overwrite }) {
    return [
        `draft: ${draftName}`,
        `event id: ${publicId}`,
        `template: ${draft.template?.slug || "(sin template)"}`,
        `sections: ${Array.isArray(draft.sections) ? draft.sections.length : 0}`,
        `mode: ${mode}`,
        `target: ${target || "(sin configurar; no requerido para dry-run)"}`,
        ...(mode === "legacy" ? [`overwrite: ${overwrite ? "si" : "no"}`] : []),
        `status: ${validation.valid ? "VALID" : "INVALID"}`
    ];
}

function environmentForMode(legacy, env) {
    return {
        target: env.YCOR_API_BASE_URL,
        password: legacy
            ? env.ADMIN_PASSWORD || env.YCOR_ADMIN_PASSWORD
            : env.YCOR_ADMIN_PASSWORD || env.ADMIN_PASSWORD
    };
}

async function publishDraft(options, dependencies = {}) {
    if (!validatePublicId(options.id)) {
        throw new Error("--id debe usar minusculas, numeros y guiones, sin guion inicial ni final.");
    }
    if (options.overwrite && !options.legacy) {
        throw new Error("--overwrite solo esta disponible con --legacy y nunca omite la concurrencia versionada.");
    }

    const deps = typeof dependencies === "function" ? { fetchImpl: dependencies } : dependencies;
    const env = deps.env || process.env;
    const configuration = environmentForMode(options.legacy, env);
    const configuredTarget = options.target || configuration.target;
    const target = configuredTarget ? normalizeTarget(configuredTarget) : null;
    const draft = loadDraft(options.draft);
    const validation = validateEventForPersistence(draft);
    const mode = options.legacy ? "legacy" : "versioned-create-draft";
    const summary = safeSummary({
        draftName: options.draft,
        publicId: options.id,
        target,
        draft,
        validation,
        mode: options.legacy ? "legacy" : "versioned create draft",
        overwrite: options.overwrite
    });

    if (options.dryRun) return { dryRun: true, validation, mode, summary, draft };
    if (!validation.valid) return { dryRun: false, validation, skipped: true, mode, summary };
    if (!target) throw new Error("YCOR_API_BASE_URL no esta configurada y no se indico --target.");
    if (!configuration.password) {
        throw new Error(options.legacy
            ? "ADMIN_PASSWORD no esta definido en el entorno."
            : "YCOR_ADMIN_PASSWORD no esta definido en el entorno.");
    }

    if (options.legacy) {
        const payload = buildPayload({
            draft,
            id: options.id,
            password: configuration.password,
            overwrite: options.overwrite
        });
        const response = await (deps.fetchImpl || globalThis.fetch)(`${target}/api/eventos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await parseResponseJson(response);
        if (!response.ok) throw new Error(messageForLegacyStatus(response.status));
        return { dryRun: false, validation, mode, response: data, summary };
    }

    const clientFactory = deps.clientFactory || createEventEditorialApiClient;
    const client = clientFactory({
        baseUrl: target,
        adminPassword: configuration.password,
        fetchImpl: deps.fetchImpl || globalThis.fetch
    });
    let editorialState;
    try {
        editorialState = await client.getEditorialState(options.id);
    } catch (error) {
        if (error?.code !== "EVENT_NOT_FOUND") throw error;
        const response = await client.createEvent(options.id, draft);
        return {
            dryRun: false,
            validation,
            mode,
            response,
            editorialState: null,
            createPayload: { eventId: options.id, content: draft },
            createdEvent: true,
            summary
        };
    }
    const expectedWorkingVersionId = editorialState.currentWorkingVersionId ?? null;
    const sourceVersionId = resolveSourceVersionId(editorialState);
    const createPayload = { content: draft, expectedWorkingVersionId, sourceVersionId };
    const response = await client.createVersion(options.id, createPayload);

    return {
        dryRun: false,
        validation,
        mode,
        response,
        editorialState,
        createPayload,
        createdEvent: false,
        summary
    };
}

async function parseResponseJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function messageForLegacyStatus(status) {
    const byStatus = {
        400: "Request legacy invalido.",
        401: "Autenticacion legacy fallida.",
        409: "El public id ya existe en el flujo legacy.",
        413: "Payload demasiado grande.",
        500: "Error interno del servidor.",
        504: "Timeout del servidor."
    };
    return byStatus[status] || `Error HTTP ${status}.`;
}

function usage() {
    return [
        "Uso versionado: npm run publish:event -- --draft <nombre> --id <eventId> [--dry-run] [--target <url>]",
        "Modo legacy deprecado: agregar --legacy [--overwrite]",
        "El modo versionado crea una version draft; no publica el evento."
    ];
}

async function main() {
    try {
        const options = parseArgs(process.argv.slice(2));
        if (options.help) {
            usage().forEach((line) => console.log(line));
            return;
        }
        const result = await publishDraft(options);
        result.summary.forEach((line) => console.log(line));
        if (!result.validation.valid) {
            result.validation.errors.forEach((error) => console.error(`error: ${error}`));
            process.exitCode = 1;
            return;
        }
        if (result.dryRun) {
            console.log("dry-run: no se hizo GET ni POST");
            return;
        }
        if (result.mode === "legacy") {
            console.log(`guardado legacy: ${result.response?.id || options.id}`);
            return;
        }
        console.log(`Evento: ${options.id}`);
        console.log(`Version creada: ${result.response?.versionId}`);
        console.log(`Numero de version: ${result.response?.versionNumber}`);
        console.log("Estado: draft");
        console.log("Publicada: NO");
        console.log(`Preview local: /invitacion.html?preview=1&eventId=${encodeURIComponent(options.id)}&versionId=${encodeURIComponent(result.response?.versionId || "")}`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

if (require.main === module) main();

module.exports = {
    PUBLIC_ID_PATTERN,
    buildPayload,
    environmentForMode,
    loadDraft,
    normalizeTarget,
    parseArgs,
    publishDraft,
    resolveDraftPath,
    resolveSourceVersionId,
    safeSummary,
    usage,
    validatePublicId
};
