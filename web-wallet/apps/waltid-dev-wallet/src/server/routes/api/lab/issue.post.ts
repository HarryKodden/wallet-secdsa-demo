import { issuerApi2Base, labFetch, readUpstreamJson } from "../../../utils/labApis";

type IssueBody = {
    profileId?: string;
    authMethod?: "PRE_AUTHORIZED" | "AUTHORIZED";
};

/**
 * Create a credential offer on local issuer-api2 and return the offer URL
 * for the existing Scan → issuance flow.
 *
 * AUTHORIZED requires issuer-api2's user-login AS (ISSUER_AS_* / authentication-service.conf)
 * and a wallet OID4VCI client (OID4VCI_CLIENT_ID + redirect) registered for the issuer AS.
 */
export default defineEventHandler(async (event) => {
    const body = (await readBody<IssueBody>(event)) || {};
    const profileId = String(body.profileId || "").trim();
    if (!profileId) {
        throw createError({ statusCode: 400, statusMessage: "profileId is required" });
    }

    const authMethod =
        body.authMethod === "AUTHORIZED" ? "AUTHORIZED" : "PRE_AUTHORIZED";

    if (authMethod === "AUTHORIZED") {
        const flag = String(process.env.LAB_ENABLE_AUTH_CODE || "")
            .trim()
            .toLowerCase();
        const authorizeUrl = String(process.env.ISSUER_AS_AUTHORIZE_URL || "").trim();
        const demoKeycloak =
            !authorizeUrl || authorizeUrl.includes("keycloak.demo.walt.id");
        const explicitlyEnabled = flag === "true" || flag === "1" || flag === "yes";
        const explicitlyDisabled = flag === "false" || flag === "0" || flag === "no";
        if (explicitlyDisabled || (!explicitlyEnabled && demoKeycloak)) {
            throw createError({
                statusCode: 400,
                statusMessage:
                    "Lab authorization_code is disabled. Set ISSUER_AS_AUTHORIZE_URL / ISSUER_AS_TOKEN_URL / ISSUER_AS_CLIENT_ID (+ secret) to your AS, and LAB_ENABLE_AUTH_CODE=true (or use a non-demo AS URL). Wallet also needs OID4VCI_CLIENT_ID + OID4VCI_REDIRECT_URI.",
            });
        }
    }

    const payload: Record<string, unknown> = {
        profileId,
        authMethod,
        valueMode: "BY_REFERENCE",
    };
    if (authMethod === "AUTHORIZED") {
        payload.issuerStateMode = "INCLUDE";
    }

    const upstream = await labFetch(`${issuerApi2Base()}/issuer2/credential-offers`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    return readUpstreamJson(upstream);
});
