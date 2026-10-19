/**
 * Lightweight tests for G2 consent session helpers (pure logic mirrored here).
 * Run: node --test web-wallet/apps/waltid-dev-wallet/src/server/utils/soleControlConsent.test.mjs
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

const PREFIX = "soleControlConsent:";

function remember(store, walletId) {
    store.set(`${PREFIX}issuance`, JSON.stringify({walletId, at: Date.now()}));
}

function consume(store, walletId, maxAgeMs = 15 * 60_000) {
    const raw = store.get(`${PREFIX}issuance`);
    if (!raw) return false;
    store.delete(`${PREFIX}issuance`);
    const parsed = JSON.parse(raw);
    if (parsed.walletId !== walletId) return false;
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > maxAgeMs) return false;
    return true;
}

describe("issuance consent session", () => {
    it("consumes matching consent once", () => {
        const store = new Map();
        remember(store, "w1");
        assert.equal(consume(store, "w1"), true);
        assert.equal(consume(store, "w1"), false);
    });

    it("rejects wrong wallet", () => {
        const store = new Map();
        remember(store, "w1");
        assert.equal(consume(store, "w2"), false);
    });

    it("rejects expired consent", () => {
        const store = new Map();
        store.set(`${PREFIX}issuance`, JSON.stringify({walletId: "w1", at: Date.now() - 20 * 60_000}));
        assert.equal(consume(store, "w1", 15 * 60_000), false);
    });
});
