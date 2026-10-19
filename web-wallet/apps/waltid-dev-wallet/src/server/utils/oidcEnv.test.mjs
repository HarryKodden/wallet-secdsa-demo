/**
 * Run: node --test web-wallet/apps/waltid-dev-wallet/src/server/utils/oidcEnv.test.mjs
 */
import {describe, it, beforeEach, afterEach} from "node:test";
import assert from "node:assert/strict";

const KEYS = [
    "OIDC_BASE_URL",
    "OIDC_AUTHORIZE_URL",
    "OIDC_TOKEN_URL",
    "OIDC_REDIRECT_URI",
    "OIDC_SCOPES",
    "OID4VCI_REDIRECT_URI",
];

const saved = {};

function firstEnv(...names) {
    for (const name of names) {
        const v = process.env[name]?.trim();
        if (v) return v;
    }
    return "";
}

beforeEach(() => {
    for (const k of KEYS) {
        saved[k] = process.env[k];
        delete process.env[k];
    }
});

afterEach(() => {
    for (const k of KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
});

describe("OIDC env", () => {
    it("uses OIDC_BASE_URL and derives OID4VCI callback", () => {
        process.env.OIDC_BASE_URL = "https://wallet.e-tunity.net";
        process.env.OIDC_AUTHORIZE_URL = "https://idp.example/authorize";
        const base = firstEnv("OIDC_BASE_URL") || "http://localhost:7115";
        assert.equal(base, "https://wallet.e-tunity.net");
        assert.equal(firstEnv("OIDC_AUTHORIZE_URL"), "https://idp.example/authorize");
        assert.equal(
            firstEnv("OID4VCI_REDIRECT_URI") || `${base.replace(/\/$/, "")}/oid4vci/callback`,
            "https://wallet.e-tunity.net/oid4vci/callback",
        );
    });

    it("defaults when unset", () => {
        const base = firstEnv("OIDC_BASE_URL") || "http://localhost:7115";
        assert.equal(base, "http://localhost:7115");
    });
});
