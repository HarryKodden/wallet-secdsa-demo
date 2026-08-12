import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
    decideWalletApi2UnlockSync,
    resolveWalletApi2UnlockAuthorization,
} from "./secdsaUnlockAuth.mjs";

describe("resolveWalletApi2UnlockAuthorization", () => {
    it("prefers Authorization Bearer over cookie (paired mobile)", () => {
        assert.equal(
            resolveWalletApi2UnlockAuthorization({
                authorizationHeader: "Bearer pair-jwt",
                cookieToken: "web-cookie",
            }),
            "Bearer pair-jwt",
        );
    });

    it("adds Bearer prefix when missing", () => {
        assert.equal(
            resolveWalletApi2UnlockAuthorization({
                authorizationHeader: "raw-jwt",
            }),
            "Bearer raw-jwt",
        );
    });

    it("falls back to auth.token cookie (web SPA)", () => {
        assert.equal(
            resolveWalletApi2UnlockAuthorization({
                cookieToken: "web-cookie",
            }),
            "Bearer web-cookie",
        );
    });

    it("returns null when neither header nor cookie (SoftHSM-only mobile Protocol 4)", () => {
        assert.equal(
            resolveWalletApi2UnlockAuthorization({}),
            null,
        );
    });
});

describe("decideWalletApi2UnlockSync", () => {
    it("skips sync when no auth — SoftHSM-only success path for iPhone", () => {
        assert.deepEqual(decideWalletApi2UnlockSync(null), {
            attempt: false,
            authorization: null,
        });
    });

    it("attempts sync when cookie/Bearer present — web SPA path", () => {
        assert.deepEqual(decideWalletApi2UnlockSync("Bearer web-cookie"), {
            attempt: true,
            authorization: "Bearer web-cookie",
        });
    });
});
