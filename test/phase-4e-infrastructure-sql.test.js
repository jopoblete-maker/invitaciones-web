const assert = require("assert");
const fs = require("fs");
const path = require("path");

const sqlRoot = path.resolve(__dirname, "..", "docs", "sql", "phase-4e");
const rateLimitSql = fs.readFileSync(path.join(sqlRoot, "01-admin-rate-limit.sql"), "utf8");
const auditSql = fs.readFileSync(path.join(sqlRoot, "02-admin-audit.sql"), "utf8");

assert(rateLimitSql.includes("CREATE TABLE IF NOT EXISTS public.admin_rate_limit_windows"));
assert(rateLimitSql.includes("UNIQUE (window_key, window_started_at)"));
assert(rateLimitSql.includes("CREATE OR REPLACE FUNCTION public.consume_admin_rate_limit"));
assert(rateLimitSql.includes("SECURITY DEFINER"));
assert(rateLimitSql.includes("SET search_path = pg_catalog, public"));
assert(rateLimitSql.includes("pg_advisory_xact_lock"));
assert(rateLimitSql.includes("REVOKE ALL ON FUNCTION public.consume_admin_rate_limit(text, integer, integer)"));
assert(rateLimitSql.includes("TO service_role"));
assert(!/password|token|signing.key|snapshot/i.test(rateLimitSql));

assert(auditSql.includes("CREATE TABLE IF NOT EXISTS public.admin_audit_log"));
for (const column of ["timestamp", "event_id", "version_id", "action", "result", "error_code", "admin_identity", "ip", "origin"]) {
    assert(new RegExp(`\\b${column}\\b`).test(auditSql), `missing audit column: ${column}`);
}
for (const index of [
    "admin_audit_log_timestamp_idx",
    "admin_audit_log_event_timestamp_idx",
    "admin_audit_log_version_timestamp_idx",
    "admin_audit_log_action_timestamp_idx"
]) assert(auditSql.includes(index));
assert(auditSql.includes("CREATE OR REPLACE FUNCTION public.append_admin_audit"));
assert(auditSql.includes("CREATE OR REPLACE FUNCTION public.purge_admin_audit_before"));
assert(auditSql.includes("ADMIN_AUDIT_LOG_APPEND_ONLY"));
assert(auditSql.includes("12 months"));
assert(auditSql.includes("REVOKE ALL ON TABLE public.admin_audit_log"));
assert(auditSql.includes("TO service_role"));
assert(!/password|preview.token|signing.key|payload completo|snapshot/i.test(auditSql));

assert(!rateLimitSql.includes("create_event_version"));
assert(!rateLimitSql.includes("publish_event_version"));
assert(!auditSql.includes("create_event_version"));
assert(!auditSql.includes("publish_event_version"));

console.log("phase-4e infrastructure SQL tests passed");
