import {parseDisclosures} from "../composables/disclosures.ts";
import {computedAsync} from "@vueuse/core";
import {parseJwt} from "../utils/jwt.ts";
import {computed, type Ref, ref, watchEffect} from "vue";
import {useCurrentWallet} from "./accountWallet";

export type WalletCredential = {
    wallet?: string;
    id: string;
    document?: string;
    disclosures?: string;
    addedOn?: string;
    addedAt?: string;
    manifest?: string;
    parsedDocument?: {
        [key: string]: any;
        display?: Array<Object>;
    };
    format?: string;
    /** wallet-api2 nested digital credential (pre-normalize) */
    credential?: any;
    issuer?: string | { name?: string; id?: string; image?: string };
    subject?: string;
};

/**
 * Map wallet-api2 list/detail payloads into the classic wallet-api shape
 * expected by VerifiableCredentialCard / detail views.
 */
export function normalizeWalletCredential(raw: any): WalletCredential {
    if (!raw || typeof raw !== "object") {
        return {id: String(raw ?? "")};
    }

    // Already classic (or previously normalized)
    if (raw.parsedDocument || (raw.document && !raw.credential)) {
        return {
            ...raw,
            addedOn: raw.addedOn ?? raw.addedAt,
        };
    }

    const nested = raw.credential;
    if (nested && typeof nested === "object") {
        const credentialData = nested.credentialData ?? nested.originalCredentialData ?? null;
        const document =
            nested.signed ??
            nested.signedWithDisclosures ??
            (typeof nested.document === "string" ? nested.document : undefined);

        let disclosures: string | undefined;
        if (typeof nested.disclosures === "string") {
            disclosures = nested.disclosures;
        } else if (Array.isArray(nested.disclosures)) {
            disclosures = nested.disclosures.join("~");
        }

        const format = nested.format ?? raw.format;
        const openIdFormat = inferOpenId4VpFormat(nested, format);
        // Enrich mdoc credentialData so the UI has a usable type/title
        let parsedDocument = credentialData ?? undefined;
        if (parsedDocument && (format === "mso_mdoc" || nested.type === "vc-mdocs")) {
            const docType = parsedDocument.docType ?? nested.docType ?? "mDL";
            const shortType = String(docType).split(".").pop() || "mDL";
            parsedDocument = {
                ...parsedDocument,
                type: parsedDocument.type ?? ["VerifiableCredential", shortType],
                name: parsedDocument.name ?? shortType,
            };
        }

        return {
            id: raw.id,
            format: openIdFormat ?? format,
            document,
            disclosures,
            parsedDocument,
            addedOn: raw.addedOn ?? raw.addedAt,
            addedAt: raw.addedAt,
            issuer: nested.issuer ?? raw.issuer,
            subject: nested.subject ?? raw.subject,
            manifest: raw.manifest,
        };
    }

    // List metadata only — synthesize a minimal parsed document for the card
    const format = raw.format as string | undefined;
    const issuer = raw.issuer;
    const stub: Record<string, any> = {
        type: format ? ["VerifiableCredential", formatLabel(format)] : ["VerifiableCredential"],
        issuer: typeof issuer === "string" ? {id: issuer} : issuer,
    };
    if (raw.subject) stub.credentialSubject = {id: raw.subject};
    if (format?.includes("sd-jwt") || format === "dc+sd-jwt" || format === "vc+sd-jwt") {
        stub.vct = format;
    }
    if (format === "mso_mdoc") {
        stub.type = ["VerifiableCredential", "mDL"];
        stub.name = "mDL";
        stub.docType = "org.iso.18013.5.1.mDL";
    }

    return {
        id: raw.id,
        format,
        parsedDocument: stub,
        addedOn: raw.addedOn ?? raw.addedAt,
        addedAt: raw.addedAt,
        issuer,
        subject: raw.subject,
    };
}

function formatLabel(format: string): string {
    if (format.includes("sd-jwt") || format === "dc+sd-jwt") return "IdentityCredential";
    if (format.includes("jwt_vc")) return "OpenBadgeCredential";
    return format.replace(/[+_-]/g, " ");
}

/** Fetch list + hydrate each item from GET detail when list is metadata-only. */
export async function fetchNormalizedCredentials(walletId: string): Promise<WalletCredential[]> {
    const list = await $fetch<any[]>(`/wallet-api/wallet/${walletId}/credentials`);
    if (!Array.isArray(list) || list.length === 0) return [];

    const needsHydrate = list.some((c) => c && !c.parsedDocument && !c.document && !c.credential);
    if (!needsHydrate) {
        return list.map(normalizeWalletCredential);
    }

    const hydrated = await Promise.all(
        list.map(async (item) => {
            try {
                const detail = await $fetch(
                    `/wallet-api/wallet/${walletId}/credentials/${encodeURIComponent(item.id)}`,
                );
                return normalizeWalletCredential(detail);
            } catch (e) {
                console.warn("Failed to hydrate credential", item.id, e);
                return normalizeWalletCredential(item);
            }
        }),
    );
    return hydrated;
}

export function useCredential(credential: Ref<WalletCredential | null>) {
    const currentWallet = useCurrentWallet();

    const normalized = computed(() =>
        credential.value ? normalizeWalletCredential(credential.value) : null,
    );

    const jwtJson = computedAsync(async () => {
        const value = normalized.value;
        if (!value) return null;

        if (value.parsedDocument) return value.parsedDocument;

        let parsed;
        if (value.format && value.format === "mso_mdoc") {
            // wallet-api2 already embeds credentialData; only fall back to util parse for hex CBOR
            if (!value.document) return null;
            try {
                const resp = await fetch(`/wallet-api/util/parseMDoc`, {
                    method: "POST",
                    headers: {"Content-Type": "text/plain"},
                    body: value.document,
                });
                if (!resp.ok) return {docType: "mDL", type: ["VerifiableCredential", "mDL"], name: "mDL"};
                parsed = await resp.json();
            } catch {
                return {docType: "mDL", type: ["VerifiableCredential", "mDL"], name: "mDL"};
            }
        } else if (value.document) {
            parsed = parseJwt(value.document);
        } else {
            return null;
        }

        if (parsed.vc) return parsed.vc;
        else return parsed;
    }, null);

    const disclosures = computed(() => {
        if (normalized.value && normalized.value.disclosures) {
            return parseDisclosures(normalized.value.disclosures);
        } else return null;
    });

    const manifest = computed(() =>
        normalized.value?.manifest && normalized.value.manifest != "{}"
            ? typeof normalized.value.manifest === "string"
                ? JSON.parse(normalized.value.manifest)
                : normalized.value.manifest
            : (normalized.value?.parsedDocument?.display?.[0] ?? null),
    );
    const manifestClaims = computed(() => manifest.value?.display?.claims);

    async function fetchVctName(vct: string): Promise<String> {
        try {
            const response = await fetch(
                `/wallet-api/wallet/${currentWallet.value}/exchange/resolveVctUrl?vct=${vct}`,
            );
            if (!response.ok) throw new Error(String(response.status));
            const data = await response.json();
            return data.name || vctNameFallback(vct);
        } catch (error) {
            return vctNameFallback(vct);
        }
    }

    function vctNameFallback(vct: string): string {
        try {
            const path = vct.includes("/") ? vct.split("/").pop()! : vct;
            return path.replace(/[_\-+.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        } catch {
            return "Credential";
        }
    }

    const titleTitelized = ref("");

    watchEffect(async () => {
        if (jwtJson.value?.vct) {
            titleTitelized.value = (await fetchVctName(jwtJson.value.vct)) as string;
        } else {
            titleTitelized.value =
                manifest.value?.display?.title ??
                jwtJson.value?.name ??
                jwtJson.value?.type?.at(-1)?.replace(/([a-z0-9])([A-Z])/g, "$1 $2") ??
                jwtJson.value?.vct?.replace("_vc+sd-jwt", "").replace(/([a-z0-9])([A-Z])/g, "$1 $2") ??
                jwtJson.value?.docType ??
                normalized.value?.format ??
                "Credential";
        }
    });

    const credentialSubtitle = computed(
        () => manifest.value?.display?.card?.description ?? jwtJson.value?.name,
    );
    const credentialImageUrl = computed(
        () =>
            manifest.value?.display?.card?.logo?.uri ??
            jwtJson.value?.issuer?.image?.id ??
            jwtJson.value?.issuer?.image,
    );
    const issuerName = computed(
        () =>
            manifest.value?.display?.card?.issuedBy ??
            jwtJson.value?.issuer?.name ??
            (typeof jwtJson.value?.issuer === "string" ? shortDid(jwtJson.value.issuer) : null) ??
            (typeof normalized.value?.issuer === "string"
                ? shortDid(normalized.value.issuer)
                : (normalized.value?.issuer as any)?.name) ??
            null,
    );
    const issuerLogo = computed(
        () => jwtJson.value?.issuer?.image?.id ?? jwtJson.value?.issuer?.image,
    );
    const issuerDid = computed(
        () =>
            manifest.value?.input?.issuer ??
            jwtJson.value?.issuer?.id ??
            jwtJson.value?.issuer ??
            jwtJson.value?.iss ??
            normalized.value?.issuer,
    );
    const issuerKid = computed(() =>
        normalized.value?.format === "vc+sd-jwt" || normalized.value?.format === "dc+sd-jwt"
            ? (jwtJson.value?.iss ?? null)
            : null,
    );
    const credentialIssuerService = computed(() => manifest.value?.input?.credentialIssuer);

    /** Epoch ms expiry, or null if the credential has no expiry claim. */
    const expiryAtMs = computed(() =>
        resolveCredentialExpiryMs(jwtJson.value, normalized.value),
    );
    const isNotExpired = computed(() => {
        const at = expiryAtMs.value;
        if (at == null) return true;
        return at > Date.now();
    });
    const issuanceDate = computed(() => {
        if (jwtJson.value?.issuanceDate) {
            return new Date(jwtJson.value?.issuanceDate).toISOString().slice(0, 10);
        } else if (jwtJson.value?.validFrom) {
            return new Date(jwtJson.value?.validFrom).toISOString().slice(0, 10);
        } else if (jwtJson.value?.iat) {
            return new Date(jwtJson.value.iat * 1000).toISOString().slice(0, 10);
        } else {
            return null;
        }
    });
    const expirationDate = computed(() => {
        const at = expiryAtMs.value;
        if (at == null) return null;
        return new Date(at).toISOString().slice(0, 10);
    });

    return {
        jwtJson,
        disclosures,
        manifest,
        manifestClaims,
        titleTitelized,
        credentialSubtitle,
        credentialImageUrl,
        issuerName,
        issuerLogo,
        issuerDid,
        issuerKid,
        credentialIssuerService,
        isNotExpired,
        issuanceDate,
        expirationDate,
    };
}

function shortDid(did: string): string {
    if (!did || typeof did !== "string") return "Unknown";
    if (did.length <= 28) return did;
    return did.slice(0, 16) + "…" + did.slice(-8);
}

/**
 * Resolve credential expiry as epoch milliseconds.
 * Checks W3C date fields, JWT `exp`, and the issuer-signed JWT inside an SD-JWT
 * document (`jwt~disclosures…`) when credentialData omits `exp`.
 */
export function resolveCredentialExpiryMs(
    parsed: Record<string, any> | null | undefined,
    walletCredential?: WalletCredential | null,
): number | null {
    const fromParsed = expiryMsFromClaims(parsed);
    if (fromParsed != null) return fromParsed;

    const document = walletCredential?.document;
    if (typeof document !== "string" || !document.includes(".")) return null;

    try {
        // SD-JWT: issuer JWT is the first '~'-separated segment.
        const issuerJwt = document.split("~")[0] || document;
        const payload = parseJwt(issuerJwt);
        if (payload && typeof payload === "object") {
            return expiryMsFromClaims(payload as Record<string, any>);
        }
    } catch {
        // ignore unparseable documents
    }
    return null;
}

function expiryMsFromClaims(claims: Record<string, any> | null | undefined): number | null {
    if (!claims || typeof claims !== "object") return null;

    if (claims.expirationDate) {
        const t = Date.parse(String(claims.expirationDate));
        if (!Number.isNaN(t)) return t;
    }
    if (claims.validUntil) {
        const t = Date.parse(String(claims.validUntil));
        if (!Number.isNaN(t)) return t;
    }
    if (claims.exp != null && claims.exp !== "") {
        const exp = Number(claims.exp);
        if (!Number.isNaN(exp)) {
            // JWT exp is seconds; tolerate ms if clearly large.
            return exp > 1e12 ? exp : exp * 1000;
        }
    }
    return null;
}

/** Flatten mdoc claims for the detail view (wallet-api2 credentialData or classic issuerSigned). */
export function mdocClaimRows(parsed: any): {elementIdentifier: string; elementValue: string}[] {
    if (!parsed || typeof parsed !== "object") return [];

    if (parsed.issuerSigned?.nameSpaces) {
        const nsKey = Object.keys(parsed.issuerSigned.nameSpaces)[0];
        const items = parsed.issuerSigned.nameSpaces[nsKey] ?? [];
        return items.map((elem: any) => ({
            elementIdentifier: elem.elementIdentifier ?? String(elem),
            elementValue: formatMdocValue(elem.elementValue),
        }));
    }

    const rows: {elementIdentifier: string; elementValue: string}[] = [];
    for (const [key, val] of Object.entries(parsed)) {
        if (key === "docType" || key === "type" || key === "name") continue;
        if (val && typeof val === "object" && !Array.isArray(val)) {
            for (const [claim, claimVal] of Object.entries(val as Record<string, unknown>)) {
                rows.push({
                    elementIdentifier: claim,
                    elementValue: formatMdocValue(claimVal),
                });
            }
        }
    }
    return rows;
}

function formatMdocValue(v: unknown): string {
    if (v == null) return "—";
    if (typeof v === "boolean" || typeof v === "number") return String(v);
    if (typeof v === "string") return v;
    if (Array.isArray(v)) {
        if (v.length > 24 && v.every((n) => typeof n === "number")) {
            return `[binary ${v.length} bytes]`;
        }
        try {
            return JSON.stringify(v);
        } catch {
            return String(v);
        }
    }
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}

/**
 * Prefer JWT `typ` / signature hints so stock `jwt_vc_json` SD-JWT shows as
 * `dc+sd-jwt` / `vc+sd-jwt` in the UI (matches wallet-api2 present remaps).
 */
function inferOpenId4VpFormat(nested: any, fallback?: string): string | undefined {
    const typ =
        nested?.signature?.jwtHeader?.typ ??
        nested?.jwtHeader?.typ ??
        nested?.header?.typ;
    if (typ === "dc+sd-jwt") return "dc+sd-jwt";
    if (typ === "vc+sd-jwt" || typ === "vc+sd_jwt") return "vc+sd-jwt";
    if (typeof fallback === "string" && /sd-jwt/i.test(fallback)) return fallback;
    if (Array.isArray(nested?.disclosures) || typeof nested?.disclosures === "string") {
        if (fallback === "jwt_vc_json" || !fallback) return "vc+sd-jwt";
    }
    return fallback;
}
