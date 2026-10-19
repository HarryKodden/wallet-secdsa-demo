import {createHash, randomBytes} from "node:crypto";

export type PkcePair = {
    verifier: string;
    challenge: string;
    method: "S256";
};

/** RFC 7636 S256 PKCE pair for OIDC / OAuth authorize + token. */
export function generatePkceS256(): PkcePair {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    return {verifier, challenge, method: "S256"};
}
