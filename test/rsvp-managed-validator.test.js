const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const validator = require("../js/core/event-validator");
const registry = require("../js/core/module-registry");
const { resolveManagedCalendar } = require("../backend/rsvp/calendar");
let checks = 0;
function event() {
    return {
        schema_version: 2, id: "synthetic-managed", event_type: "wedding-civil", plan: "esencial", status: "approved",
        template: { slug: "boda-civil-esencial" }, identity: { title: "Synthetic event" },
        schedule: { date: "2027-06-12", time: "18:30", timezone: "America/Buenos_Aires" },
        sections: [{ id: "hero", type: "hero", enabled: true, order: 10, data: {} }],
        modules: { rsvp: { mode: "managed", enabled: true, deadline: { date: "2027-06-01", time: "23:59" } } }, media: { items: {} }
    };
}
function structural(value, expected) {
    const result = validator.validateEventForPersistence(value);
    assert.strictEqual(result.valid, expected, result.errors.join("\n")); checks++;
}
assert(registry.get("rsvp").configKeys.includes("mode")); checks++;
structural(event(), true);
for (const mode of [undefined, "whatsapp"]) {
    const value = event();
    value.modules.rsvp = { deadline: "historic free text", contacts: [] };
    value.schedule = { date: "2027-06-12" };
    if (mode !== undefined) value.modules.rsvp.mode = mode;
    structural(value, true);
}
for (const mode of ["other", null, "", 1, "Managed"]) {
    const value = event(); value.modules.rsvp.mode = mode; structural(value, false);
}
for (const enabled of [undefined, false, "true"]) {
    const value = event();
    if (enabled === undefined) delete value.modules.rsvp.enabled;
    else value.modules.rsvp.enabled = enabled;
    structural(value, false);
}
for (const deadline of [undefined, null, "historic text", {}, { date: "2027-02-29", time: "12:30" }, { date: "2027-06-01", time: "24:00" },
    { date: "2027-06-01", time: "12:30:00" }, { date: "2027-06-01", time: "12:30", timezone: "UTC" },
    { date: "2027-06-01\n", time: "12:30" }, { date: "2027-06-01", time: "12:30\n" }]) {
    const value = event(); value.modules.rsvp.deadline = deadline; structural(value, false);
}
for (const timezone of [undefined, null, "", "America/Invalid", "+03:00", " UTC", "posix/UTC", "right/UTC"]) {
    const value = event(); value.schedule.timezone = timezone; structural(value, false);
}
for (const time of [undefined, "24:00", "12:60", "1:30", "18:30:00", "18:30\n"]) {
    const value = event(); value.schedule.time = time; structural(value, false);
}
const contacts = event(); contacts.modules.rsvp.contacts = []; structural(contacts, false);
structural({ nombre: "Synthetic legacy", confirmacionLimite: "historic text" }, true);
structural({ nombre: "Synthetic legacy", rsvp: { mode: "managed" } }, false);
structural({ schema_version: 1, event: {}, template: { slug: "boda-civil-esencial" }, sections: [], rsvp: { mode: "managed" } }, false);
for (const [date, time] of [["2018-03-11", "02:30"], ["2018-11-04", "01:30"]]) {
    const value = event(); value.schedule = { date, time, timezone: "America/New_York" };
    structural(value, true); // Structure is valid; operational conversion must reject it.
    assert.throws(() => resolveManagedCalendar(value.schedule, value.modules.rsvp.deadline), (error) => error.code === "RSVP_CALENDAR_INVALID"); checks++;
}
const browser = {
    EventSchema: require("../js/core/event-schema"), TemplateRegistry: require("../js/core/template-registry"),
    SectionContracts: require("../js/core/section-contracts"), ModuleRegistry: registry,
    ThemeRegistry: require("../js/core/theme-registry"), PlanRegistry: require("../js/core/plan-registry")
};
vm.runInNewContext(fs.readFileSync(require.resolve("../js/core/event-validator"), "utf8"), browser);
assert.strictEqual(browser.EventValidator.validateV2Event(event()).valid, true); checks++;
console.log(`rsvp-managed-validator: ${checks} checks passed`);
