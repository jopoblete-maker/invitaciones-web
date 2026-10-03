const assert = require("assert");
const { resolveLocal, resolveManagedCalendar } = require("../backend/rsvp/calendar");
let checks = 0;
const schedule = { date: "2027-06-12", time: "18:30", timezone: "America/Buenos_Aires" };
const deadline = { date: "2027-06-01", time: "23:59" };
function rejected(fn) { assert.throws(fn, (error) => error.code === "RSVP_CALENDAR_INVALID"); checks++; }
assert.deepStrictEqual(resolveManagedCalendar(schedule, deadline), {
    timezone: schedule.timezone, eventAt: "2027-06-12T21:30:00Z", deadlineAt: "2027-06-02T02:59:00Z"
}); checks++;
assert.strictEqual(resolveLocal("2024-02-29", "00:00", "UTC"), "2024-02-29T00:00:00Z"); checks++;
for (const date of ["2023-02-29", "2027-04-31", "2027-13-01", "2027-00-01", "2027-01-00", "2027-6-12", "2027-06-12\n", "0000-01-01", null]) {
    rejected(() => resolveLocal(date, "18:30", "UTC"));
}
for (const time of ["24:00", "12:60", "1:30", "12:30:00", "12:30Z", "12:30\n", " 12:30", null]) rejected(() => resolveLocal("2027-06-12", time, "UTC"));
for (const timezone of [undefined, null, "", "America/Invalid", "+03:00", "UTC+3", " UTC", "posix/America/New_York", "right/UTC"]) {
    rejected(() => resolveLocal("2027-06-12", "18:30", timezone));
}
for (const [date, time] of [["2018-03-11", "02:30"], ["2018-11-04", "01:30"]]) {
    rejected(() => resolveLocal(date, time, "America/New_York"));
    rejected(() => resolveManagedCalendar(schedule, { date, time, timezone: "America/New_York" }));
    rejected(() => resolveManagedCalendar({ date, time, timezone: "America/New_York" }, deadline));
    rejected(() => resolveManagedCalendar({ ...schedule, timezone: "America/New_York" }, { date, time }));
}
rejected(() => resolveManagedCalendar(schedule, undefined));
rejected(() => resolveManagedCalendar(schedule, { ...deadline, timezone: "UTC" }));
assert.strictEqual(resolveLocal("2018-03-11", "03:30", "America/New_York"), "2018-03-11T07:30:00Z"); checks++;
assert.strictEqual(resolveLocal("2018-11-04", "02:30", "America/New_York"), "2018-11-04T07:30:00Z"); checks++;
const previousTimezone = process.env.TZ;
try {
    const expected = resolveManagedCalendar(schedule, deadline);
    for (const timezone of ["UTC", "Asia/Tokyo", "America/Los_Angeles"]) {
        process.env.TZ = timezone;
        assert.deepStrictEqual(resolveManagedCalendar(schedule, deadline), expected);
        checks++;
    }
} finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
}
assert(!Object.prototype.hasOwnProperty.call(resolveManagedCalendar(schedule, deadline), "purgeDueAt")); checks++;
console.log(`rsvp-calendar: ${checks} checks passed`);
