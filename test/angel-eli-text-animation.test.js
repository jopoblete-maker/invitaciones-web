"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { setupTextAnimations, layerDesigns, wordSequenceTiming } = require("../js/events/angel-eli-presentation");

function fixture(reduced = false, supported = true) {
    const frames = [0, 1].map(() => {
        const words = [0, 1, 2].map(() => ({ animations: [], animate(keyframes, timing) {
            const animation = { keyframes, timing, playState: "running",
                cancel() { this.playState = "idle"; }, pause() { this.playState = "paused"; } };
            this.animations.push(animation);
            return animation;
        } }));
        return { words, dataset: {}, querySelectorAll: () => words };
    });
    const document = new EventTarget(); document.hidden = false; document.timeline = { currentTime: 100 };
    const preference = new EventTarget(); preference.matches = reduced;
    const view = { matchMedia: () => preference };
    let observer;
    if (supported) view.IntersectionObserver = class {
        constructor(callback) { this.callback = callback; observer = this; }
        observe() {}
        disconnect() { this.disconnected = true; }
    };
    const app = { querySelectorAll: () => frames.map(parentElement => ({ parentElement })) };
    setupTextAnimations(app, document, view);
    const intersect = (index, on) => observer.callback([{ target: frames[index], isIntersecting: on, intersectionRect: { height: on ? 300 : 0 } }]);
    const reduce = on => { preference.matches = on; preference.dispatchEvent(new Event("change")); };
    return { frames, document, observer, intersect, reduce };
}
test("text cycles run only while visible, pause outside and restart on re-entry", () => {
    const f = fixture();
    assert.equal(f.frames[0].dataset.textAnimation, "fixed");
    f.intersect(0, true);
    const firstCycle = f.frames[0].words.map(word => word.animations[0]);
    assert(firstCycle.every(animation => animation.playState === "running" && animation.startTime === 100));
    assert(f.frames[1].words.every(word => word.animations.length === 0));
    f.intersect(0, false);
    assert(firstCycle.every(animation => animation.playState === "paused"));
    assert.equal(f.frames[0].dataset.textAnimation, "paused");
    f.intersect(0, true);
    assert(firstCycle.every(animation => animation.playState === "idle"));
    assert(f.frames[0].words.every(word => word.animations.length === 2));
    assert.equal(f.frames[0].dataset.textAnimation, "playing");
    f.document.hidden = true; f.document.dispatchEvent(new Event("visibilitychange"));
    assert.equal(f.frames[0].dataset.textAnimation, "paused");
    f.document.hidden = false; f.document.dispatchEvent(new Event("visibilitychange"));
    assert.equal(f.frames[0].dataset.textAnimation, "playing");
    setupTextAnimations.dispose(); assert(f.observer.disconnected);
});
test("reduced motion stays fixed, including live preference changes; unsupported observers stay fixed", () => {
    const f = fixture(true);
    f.intersect(0, true);
    assert.equal(f.frames[0].dataset.textAnimation, "fixed");
    assert(f.frames[0].words.every(word => word.animations.length === 0));
    f.reduce(false); assert.equal(f.frames[0].dataset.textAnimation, "playing");
    f.reduce(true); assert.equal(f.frames[0].dataset.textAnimation, "fixed");
    setupTextAnimations.dispose();
    const noObserver = fixture(false, false);
    assert(noObserver.frames.every(frame => frame.dataset.textAnimation === "fixed"));
    setupTextAnimations.dispose();
});
test("each section waits exactly 2000 ms AFTER its final word finishes appearing, then fades together", () => {
    for (const design of Object.values(layerDesigns)) {
        const count = design.copy.flatMap(([, text]) => text.match(/\S+/gu)).length;
        const timing = wordSequenceTiming(count);
        const last = timing.keyframes.at(-1);
        const lastWordComplete = last[2].offset * timing.duration;
        assert.equal(lastWordComplete, timing.revealEnd);
        assert.equal(timing.fadeStart - lastWordComplete, 2000);
        timing.keyframes.forEach((frames, index) => {
            assert.equal(Math.round(frames[1].offset * timing.duration), index * 300);
            assert.equal(frames[3].offset * timing.duration, timing.fadeStart);
            assert.equal(frames[3].opacity, 1);
            assert.equal(frames[4].opacity, 0);
        });
        assert.equal(timing.duration - timing.fadeStart, 600);
    }
    assert.deepEqual(layerDesigns.cierre.copy.slice(1), [["angel", "Ángel"], ["and", "y"], ["eli", "Eli"]]);
});
test("the six verified PNG backgrounds match original section geometry and exact Fiesta time", () => {
    const originals = { fiesta: "fiesta", confirmacion: "confirmacion", vestimenta: "vestimenta",
        regalos: "regalos", "carpeta-compartida": "carpeta", cierre: "cierre" };
    assert.deepEqual(Object.keys(layerDesigns), Object.keys(originals));
    const geometry = file => {
        const bytes = fs.readFileSync(file);
        assert.equal(bytes.subarray(1, 4).toString(), "PNG");
        return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    };
    for (const [id, original] of Object.entries(originals)) {
        const background = path.join(__dirname, "../assets/events/fondos-sin-texto", layerDesigns[id].background + "-fondo.png");
        assert.deepEqual(geometry(background), geometry(path.join(__dirname, "../assets/events/angel-eli", original + ".png")));
    }
    assert.equal(layerDesigns.fiesta.copy.find(([kind]) => kind === "time")[1], "20:00 hs. a 4:00 a.m hs");
});
