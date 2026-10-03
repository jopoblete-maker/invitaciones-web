"use strict";

const { RsvpError } = require("./errors");

async function runRetention({ adapter, batchSize = 50, signal } = {}) {
    if (!adapter || typeof adapter.purgeDue !== "function") throw new TypeError("An existing purge adapter is required.");
    // SQL rsvp_purge_due accepts 1..100 events per transaction.
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100
        || (signal !== undefined && !(signal instanceof AbortSignal))) throw new RsvpError("RSVP_INVALID_PAYLOAD");
    let processed = 0;
    let batches = 0;
    while (!signal?.aborted) {
        let count;
        try { count = await adapter.purgeDue({ limit: batchSize }); }
        catch (error) {
            if (error instanceof RsvpError) throw error;
            throw new RsvpError("RSVP_INTERNAL_ERROR");
        }
        if (!Number.isSafeInteger(count) || count < 0 || count > batchSize
            || !Number.isSafeInteger(processed + count) || !Number.isSafeInteger(batches + 1)) {
            throw new RsvpError("RSVP_INTERNAL_ERROR");
        }
        processed += count;
        batches++;
        // A partial batch exhausts the unlocked rows eligible for that call.
        // Locked rows and later expirations remain for a future explicit run.
        if (count < batchSize) break;
    }
    return { processed, batches, aborted: Boolean(signal?.aborted) };
}

module.exports = { runRetention };
