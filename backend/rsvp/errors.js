"use strict";

const DEFINITIONS = Object.freeze(Object.fromEntries([
    ["RSVP_NOT_AVAILABLE", 404, "RSVP_NOT_AVAILABLE", "RSVP no disponible."],
    ["RSVP_DEADLINE_CLOSED", 409, "RSVP_DEADLINE_CLOSED", "El plazo de respuesta terminó."],
    ["RSVP_REVISION_CONFLICT", 409, "REVISION_CONFLICT", "La configuración cambió. Actualiza antes de continuar."],
    ["RSVP_EVENT_ARCHIVED", 409, "RSVP_EVENT_ARCHIVED", "El evento está archivado."],
    ["RSVP_ATTENDEE_COUNT_INVALID", 422, "RSVP_ATTENDEE_LIMIT", "La cantidad de asistentes no está permitida."],
    ["RSVP_CALENDAR_INVALID", 422, "INVALID_MANAGED_CALENDAR", "El calendario Managed es inválido."],
    ["RSVP_RATE_LIMITED", 429, "RATE_LIMITED", "Demasiadas solicitudes."],
    ["RSVP_RATE_LIMIT_UNAVAILABLE", 503, "RATE_LIMIT_UNAVAILABLE", "El control de solicitudes no está disponible."],
    ["RSVP_WRITE_RESULT_UNKNOWN", 504, "RSVP_WRITE_RESULT_UNKNOWN", "No se pudo confirmar el resultado de la operación."],
    ["RSVP_INTERNAL_ERROR", 500, "INTERNAL_ERROR", "Ocurrió un error interno."],
    ["RSVP_INVALID_PAYLOAD", 400, "RSVP_INVALID_PAYLOAD", "Los datos de la solicitud son inválidos."],
    // SQL-backed administrative conditions. Public token failures retain the
    // separate RSVP_NOT_AVAILABLE category; this catalog does not infer scope.
    ["ADMIN_EVENT_NOT_ACTIVE", 409, "ADMIN_EVENT_NOT_ACTIVE", "El evento no está activo."],
    ["PII_RETENTION_EXPIRED", 410, "PII_RETENTION_EXPIRED", "El período de retención terminó."],
    ["IDEMPOTENCY_KEY_CONSUMED", 409, "IDEMPOTENCY_KEY_CONSUMED", "La clave de creación ya fue consumida."],
    ["ADMIN_INVITATION_NOT_FOUND", 404, "ADMIN_INVITATION_NOT_FOUND", "La invitación no está disponible."],
    ["MANAGED_CONFIG_NOT_FOUND", 409, "MANAGED_CONFIG_NOT_FOUND", "La configuración Managed no está disponible."],
    ["ADMIN_EVENT_NOT_FOUND", 404, "ADMIN_EVENT_NOT_FOUND", "El evento no está disponible."],
    ["CAPACITY_BELOW_CURRENT_ATTENDANCE", 409, "CAPACITY_BELOW_CURRENT_ATTENDANCE", "El cupo es menor que la asistencia vigente."],
    // Backend categories defined by the HTTP contract, not SQL error names.
    ["UPSTREAM_TIMEOUT", 504, "UPSTREAM_TIMEOUT", "El servicio no respondió a tiempo."],
    ["MANAGED_PUBLICATION_REQUIRED", 409, "MANAGED_PUBLICATION_REQUIRED", "Se requiere una publicación canónica para Managed."],
    ["MANAGED_NOT_ENABLED", 409, "MANAGED_NOT_ENABLED", "RSVP Managed no está habilitado."]
].map(([code, status, httpCode, message]) => [code, Object.freeze({ status, httpCode, message })])));

class RsvpError extends Error {
    constructor(code) {
        const safeCode = Object.prototype.hasOwnProperty.call(DEFINITIONS, code) ? code : "RSVP_INTERNAL_ERROR";
        super(DEFINITIONS[safeCode].message);
        this.name = "RsvpError";
        this.code = safeCode;
    }
}

function toHttpError(error) {
    const code = error instanceof RsvpError && Object.prototype.hasOwnProperty.call(DEFINITIONS, error.code)
        ? error.code : "RSVP_INTERNAL_ERROR";
    const definition = DEFINITIONS[code];
    return { status: definition.status, body: { error: { code: definition.httpCode, message: definition.message } } };
}

module.exports = { RsvpError, toHttpError, DEFINITIONS };
