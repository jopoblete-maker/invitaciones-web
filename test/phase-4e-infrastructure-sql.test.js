const assert = require("assert");
const fs = require("fs");
const path = require("path");

const sqlRoot = path.resolve(__dirname, "..", "docs", "sql", "phase-4e");
const rateLimitSql = fs.readFileSync(path.join(sqlRoot, "01-admin-rate-limit.sql"), "utf8");
const auditSql = fs.readFileSync(path.join(sqlRoot, "02-admin-audit.sql"), "utf8");
const compact = (sql) => sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();
const rateLimit = compact(rateLimitSql);
const audit = compact(auditSql);
function functionBody(sql, name) {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
    assert(start >= 0, `missing function: ${name}`);
    const end = sql.indexOf("$function$;", start);
    assert(end >= 0, `unterminated function: ${name}`);
    return sql.slice(start, end);
}

const rateLimitFunction = functionBody(rateLimit, "consume_admin_rate_limit");
const auditFunction = functionBody(audit, "append_admin_audit");

assert(rateLimit.includes("CREATE TABLE IF NOT EXISTS public.admin_rate_limit_windows"));
for (const column of [
    "id uuid PRIMARY KEY",
    "window_key text NOT NULL",
    "window_started_at timestamptz NOT NULL",
    "request_count integer NOT NULL",
    "created_at timestamptz NOT NULL DEFAULT transaction_timestamp()",
    "updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()"
]) assert(rateLimit.includes(column), `missing rate-limit column: ${column}`);
assert(rateLimit.includes("CONSTRAINT admin_rate_limit_windows_key_window_uq UNIQUE (window_key, window_started_at)"));
assert(rateLimit.includes("admin_rate_limit_windows_lookup_idx ON public.admin_rate_limit_windows (window_key, window_started_at)"));
assert.match(rateLimitFunction, /public\.consume_admin_rate_limit\( p_window_key text, p_window_seconds integer, p_max_requests integer \)/);
assert.match(rateLimitFunction, /RETURNS TABLE\(allowed boolean, retry_after_seconds integer, current_count integer\)/);
assert(rateLimitFunction.includes("SECURITY DEFINER"));
assert(rateLimitFunction.includes("SET search_path = pg_catalog, public"));
assert(rateLimitFunction.includes("pg_advisory_xact_lock(hashtextextended(p_window_key, 0))"));
assert(rateLimitFunction.includes("pg_try_advisory_xact_lock(2147483647, 0)"));
assert(rateLimitFunction.includes("floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds"));
assert.match(rateLimitFunction, /p_window_seconds < 1.*p_window_seconds > 86400/s);
assert.match(rateLimitFunction, /p_max_requests < 1.*p_max_requests > 100000/s);
assert(rateLimitFunction.includes("window_started_at < (v_now - interval '1 day')"));
assert(rateLimitFunction.includes("window_key = p_window_key AND window_started_at < v_started"));
assert(rateLimitFunction.includes("request_count = public.admin_rate_limit_windows.request_count + 1"));
assert(rateLimitFunction.includes("RETURN QUERY SELECT v_count <= p_max_requests, v_retry, v_count"));
assert(rateLimit.includes("REVOKE ALL ON FUNCTION public.consume_admin_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated"));
assert(rateLimit.includes("GRANT EXECUTE ON FUNCTION public.consume_admin_rate_limit(text, integer, integer) TO service_role"));
assert(!/password|token|signing.key|snapshot/i.test(rateLimit));

assert(audit.includes("CREATE TABLE IF NOT EXISTS public.admin_audit_log"));
for (const column of ["timestamp", "event_id", "version_id", "action", "result", "error_code", "admin_identity", "ip", "origin"]) {
    assert(new RegExp(`\\b${column}\\b`).test(audit), `missing audit column: ${column}`);
}
for (const index of [
    "admin_audit_log_timestamp_idx",
    "admin_audit_log_event_timestamp_idx",
    "admin_audit_log_version_timestamp_idx",
    "admin_audit_log_action_timestamp_idx"
]) assert(audit.includes(index));
assert(audit.includes("BEFORE UPDATE OR DELETE ON public.admin_audit_log"));
assert(audit.includes("ADMIN_AUDIT_LOG_APPEND_ONLY"));
assert(audit.includes("CREATE OR REPLACE FUNCTION public.purge_admin_audit_before"));
assert(audit.includes("interval '12 months'"));
assert(audit.includes("REVOKE ALL ON TABLE public.admin_audit_log FROM PUBLIC, anon, authenticated, service_role"));
assert(audit.includes("GRANT EXECUTE ON FUNCTION public.append_admin_audit(text, uuid, text, text, text, text, inet, text) TO service_role"));
assert(audit.includes("GRANT EXECUTE ON FUNCTION public.purge_admin_audit_before(timestamptz) TO service_role"));
assert(auditFunction.includes("p_admin_identity IS DISTINCT FROM 'shared-admin-credential'"));
assert(!/p_admin_identity\s*=\s*''/.test(auditFunction));
assert(!/p_admin_identity\s+IS\s+NULL/.test(auditFunction));
assert(!/password|preview.token|signing.key|payload completo|snapshot/i.test(audit));

assert(!rateLimit.includes("create_event_version"));
assert(!rateLimit.includes("publish_event_version"));
assert(!audit.includes("create_event_version"));
assert(!audit.includes("publish_event_version"));

console.log("phase-4e infrastructure SQL tests passed");
