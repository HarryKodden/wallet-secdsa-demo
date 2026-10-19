/**
 * Run: node --test web-wallet/apps/waltid-dev-wallet/src/server/utils/pkce.test.mjs
 */
import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {createHash, randomBytes} from "node:crypto";

function generatePkceS256() {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    return {verifier, challenge, method: "S256"};
}

describe("PKCE S256", () => {
    it("produces base64url verifier and matching challenge", () => {
        const {verifier, challenge, method} = generatePkceS256();
        assert.equal(method, "S256");
        assert.match(verifier, /^[A-Za-z0-9_-]+$/);
        assert.ok(verifier.length >= 43);
        const expected = createHash("sha256").update(verifier).digest("base64url");
        assert.equal(challenge, expected);
    });
});
