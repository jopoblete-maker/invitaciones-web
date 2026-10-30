"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { startCover } = require("../js/events/angel-eli-presentation");

class Element extends EventTarget {
    constructor() {
        super(); this.children = []; this.inert = false; this.paused = true;
        this.classes = new Set();
        this.classList = {
            add: v => this.classes.add(v), remove: v => this.classes.delete(v),
            toggle: (v, on) => on ? this.classes.add(v) : this.classes.delete(v)
        };
        this.attributes = {};
    }
    setAttribute(k, v) { this.attributes[k] = v; }
    append(...children) { this.children.push(...children); }
    remove() { this.removed = true; }
    contains(el) { return this === el || this.children.some(c => c.contains(el)); }
    focus() { this.focused = true; }
    scrollIntoView() { this.scrolled = true; }
    pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
    play() { this.plays = (this.plays || 0) + 1; return Promise.resolve(); }
}
function cover(play) {
    const video = new Element(), pages = [new Element(), new Element(), new Element()];
    if (play) video.play = play;
    pages[2].inert = true;
    const branding = new Element();
    const document = { body: new Element(), documentElement: new Element(), createElement: () => new Element(),
        getElementById: id => id === "ae-brand-signature" ? branding : null };
    const timers = new Map(); let sequence = 0;
    const clock = { setTimeout: fn => { timers.set(++sequence, fn); return sequence; },
        clearTimeout: id => timers.delete(id), scrollTo: () => {} };
    const app = { querySelector: s => s === "video" ? video : null, querySelectorAll: () => pages };
    startCover(app, document, clock);
    const fallback = pages[0].children[0];
    return { video, pages, document, branding, timers, fallback, button: fallback.children[1] };
}
test("cover locks scroll and later sections until ended, restores prior inert state and cleans watchdog", () => {
    const c = cover();
    assert.equal(c.video.plays, 1);
    assert(c.document.body.classes.has("ae-cover-locked"));
    assert(c.document.documentElement.classes.has("ae-cover-locked"));
    assert(c.pages[1].inert);
    assert(c.fallback.hidden);
    assert(c.branding.hidden && c.branding.inert);
    c.video.dispatchEvent(new Event("ended"));
    assert(!c.document.body.classes.has("ae-cover-locked"));
    assert(!c.pages[1].inert && c.pages[2].inert);
    assert.equal(c.timers.size, 0);
    assert(c.fallback.removed);
    assert(!c.branding.hidden && !c.branding.inert);
});
test("rejected or synchronously failing autoplay offers a keyboard-operable continuation", async () => {
    for (const play of [() => Promise.reject(new Error("blocked")), () => { throw Error("unsupported"); }]) {
        const c = cover(play);
        await Promise.resolve();
        assert.equal(c.fallback.hidden, false);
        assert.equal(c.button.type, "button");
        assert(c.branding.hidden && c.branding.inert);
        c.button.dispatchEvent(new Event("click"));
        assert(!c.document.body.classes.has("ae-cover-locked"));
        assert(c.pages[1].focused && c.pages[1].scrolled);
        assert(c.video.paused);
        assert.equal(c.timers.size, 0);
        assert(!c.branding.hidden && !c.branding.inert);
    }
});
test("error, abort, pause and a stalled or pending play offer continuation without silently unlocking", () => {
    for (const type of ["error", "abort", "pause", "timeout"]) {
        const c = cover(() => new Promise(() => {}));
        if (type === "timeout") [...c.timers.values()][0]();
        else c.video.dispatchEvent(new Event(type));
        assert.equal(c.fallback.hidden, false);
        assert(c.document.body.classes.has("ae-cover-locked"));
        c.button.dispatchEvent(new Event("click"));
        assert(!c.pages[1].inert);
    }
});
test("only advancing video resets the watchdog; ended restores focus from fallback", () => {
    const c = cover();
    const first = [...c.timers.keys()][0];
    c.video.currentTime = 1; c.video.dispatchEvent(new Event("timeupdate"));
    const next = [...c.timers.keys()][0];
    assert.notEqual(first, next);
    c.video.dispatchEvent(new Event("timeupdate"));
    assert.equal([...c.timers.keys()][0], next);
    c.document.activeElement = c.button;
    c.video.dispatchEvent(new Event("ended"));
    assert(c.pages[1].focused);
});

function music(manualOnly, keyboard) {
    const script = fs.readFileSync(require.resolve("../js/invitacion.js"), "utf8");
    const elements = Object.fromEntries(["audioWidget", "btnMusic", "bgMusic", "audioTrackSelector"].map(id => [id, new Element()]));
    const document = new EventTarget();
    document.getElementById = id => elements[id]; document.querySelectorAll = () => [];
    const audio = elements.bgMusic;
    audio.play = () => { audio.plays = (audio.plays || 0) + 1; return Promise.reject(Error("policy")); };
    const context = vm.createContext({ document, escapeHtml: v => v });
    vm.runInContext(script.slice(script.indexOf("function setupMusic("), script.indexOf("function renderState(")), context);
    context.setupMusic([{ src: "/synthetic.mp3" }], "playlist", manualOnly, keyboard);
    return { document, audio, button: elements.btnMusic };
}
test("Angel/Eli music tries autoplay, retries on keyboard and preserves explicit pause control", async () => {
    const c = music(false, true);
    await Promise.resolve();
    assert.equal(c.audio.plays, 1);
    c.document.dispatchEvent(new Event("keydown"));
    assert.equal(c.audio.plays, 2);
    c.audio.paused = false; c.audio.onplay(); c.button.onclick();
    assert(c.audio.paused);
    c.document.dispatchEvent(new Event("click"));
    assert.equal(c.audio.plays, 2);
});
test("existing premium manual music remains manual", () => {
    const c = music(true, false);
    c.document.dispatchEvent(new Event("click"));
    c.document.dispatchEvent(new Event("keydown"));
    assert.equal(c.audio.plays, undefined);
    c.button.onclick();
    assert.equal(c.audio.plays, 1);
});
