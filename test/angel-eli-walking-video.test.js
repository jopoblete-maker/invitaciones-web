"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { setupWalkingVideo } = require("../js/events/angel-eli-presentation");

function fixture({ supported = true, play } = {}) {
    const document = new EventTarget(); document.hidden = false;
    const view = new EventTarget(); view.innerHeight = 800;
    const video = {
        currentTime: 0, paused: true, plays: 0, bounds: { top: 1000, bottom: 1500, height: 500 },
        pause() { this.paused = true; },
        play() { this.plays++; this.paused = false; return play ? play() : Promise.resolve(); },
        getBoundingClientRect() { return this.bounds; }
    };
    let observer;
    if (supported) view.IntersectionObserver = class {
        constructor(callback) { this.callback = callback; observer = this; }
        observe(target) { assert.equal(target, video); }
        disconnect() { this.disconnected = true; }
    };
    setupWalkingVideo(video, document, view);
    const intersect = visible => observer.callback([{ isIntersecting: visible, intersectionRect: { height: visible ? 300 : 0 } }]);
    return { document, view, video, observer, intersect };
}
test("walking video plays only while visible, pauses on exit, and restarts on entry without touching music", () => {
    const f = fixture();
    assert(f.video.paused); assert.equal(f.video.plays, 0);
    f.video.currentTime = 4;
    f.intersect(true);
    assert.equal(f.video.currentTime, 0); assert(f.video.autoplay && !f.video.paused);
    f.video.currentTime = 2;
    f.intersect(true); assert.equal(f.video.currentTime, 2); assert.equal(f.video.plays, 1);
    f.intersect(false); assert(f.video.paused); assert.equal(f.video.currentTime, 2);
    f.intersect(true); assert.equal(f.video.currentTime, 0); assert.equal(f.video.plays, 2);
    f.document.hidden = true; f.document.dispatchEvent(new Event("visibilitychange")); assert(f.video.paused);
    f.document.hidden = false; f.document.dispatchEvent(new Event("visibilitychange")); assert.equal(f.video.plays, 3);
    setupWalkingVideo.dispose(); assert(f.observer.disconnected && f.video.paused);
    f.document.dispatchEvent(new Event("visibilitychange")); assert.equal(f.video.plays, 3);
});
test("stale rejected autoplay does not disable a newer entry; playback failure is contained", async () => {
    const rejections = [];
    const f = fixture({ play: () => new Promise((_resolve, reject) => rejections.push(reject)) });
    f.intersect(true); f.intersect(false); f.intersect(true);
    rejections[0](Error("aborted")); await Promise.resolve(); assert(f.video.autoplay);
    rejections[1](Error("blocked")); await Promise.resolve(); assert(!f.video.autoplay);
    setupWalkingVideo.dispose();
    const synchronous = fixture({ play: () => { throw Error("unsupported"); } });
    assert.doesNotThrow(() => synchronous.intersect(true));
    assert(!synchronous.video.autoplay);
    setupWalkingVideo.dispose();
});
test("scroll and resize visibility fallback also pauses and resets without IntersectionObserver", () => {
    const f = fixture({ supported: false });
    assert.equal(f.video.plays, 0);
    f.video.bounds = { top: 100, bottom: 600, height: 500 };
    f.view.dispatchEvent(new Event("scroll")); assert.equal(f.video.plays, 1);
    f.video.currentTime = 3;
    f.video.bounds = { top: -600, bottom: -100, height: 500 };
    f.view.dispatchEvent(new Event("resize")); assert(f.video.paused);
    f.video.bounds = { top: 100, bottom: 600, height: 500 };
    f.view.dispatchEvent(new Event("scroll")); assert.equal(f.video.currentTime, 0);
    setupWalkingVideo.dispose();
});
