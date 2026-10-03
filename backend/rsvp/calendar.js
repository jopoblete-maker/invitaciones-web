"use strict";

const { Temporal } = require("@js-temporal/polyfill");
const { RsvpError } = require("./errors");

function invalid() { throw new RsvpError("RSVP_CALENDAR_INVALID"); }
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }

function resolveLocal(date, time, timezone) {
    if (typeof date !== "string" || date.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith("0000")
        || typeof time !== "string" || time.length !== 5 || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
        || typeof timezone !== "string" || timezone.length > 100 || timezone.trim() !== timezone
        || !/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(timezone) || /^(posix|right)\//.test(timezone)) invalid();
    try {
        new Intl.DateTimeFormat("en", { timeZone: timezone });
        const [year, month, day] = date.split("-").map(Number);
        const [hour, minute] = time.split(":").map(Number);
        const local = Temporal.PlainDateTime.from({ year, month, day, hour, minute }, { overflow: "reject" });
        return local.toZonedDateTime(timezone, { disambiguation: "reject" }).toInstant().toString();
    } catch (_error) { invalid(); }
}

function resolveManagedCalendar(schedule, deadline) {
    if (!object(schedule) || !object(deadline) || Object.keys(deadline).length !== 2
        || !Object.prototype.hasOwnProperty.call(deadline, "date") || !Object.prototype.hasOwnProperty.call(deadline, "time")) invalid();
    return {
        timezone: schedule.timezone,
        eventAt: resolveLocal(schedule.date, schedule.time, schedule.timezone),
        deadlineAt: resolveLocal(deadline.date, deadline.time, schedule.timezone)
    };
}

module.exports = { resolveLocal, resolveManagedCalendar };
