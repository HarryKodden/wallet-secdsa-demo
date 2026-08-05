/**
 * Server-only helpers for the local issuer-api2 / verifier-api2 Lab proxies.
 */

export function issuerApi2Base(): string {
    const config = useRuntimeConfig();
    // Prefer container env so compose overrides win over build-time defaults.
    return String(
        process.env.ISSUER_API2_INTERNAL_URL ||
            config.issuerApi2InternalUrl ||
            "http://issuer-api2:7005",
    ).replace(/\/$/, "");
}

export function verifierApi2Base(): string {
    const config = useRuntimeConfig();
    return String(
        process.env.VERIFIER_API2_INTERNAL_URL ||
            config.verifierApi2InternalUrl ||
            "http://verifier-api2:7004",
    ).replace(/\/$/, "");
}

export async function labFetch(url: string, init?: RequestInit): Promise<Response> {
    try {
        return await fetch(url, init);
    } catch (err) {
        const cause = err instanceof Error ? err.message : String(err);
        throw createError({
            statusCode: 502,
            statusMessage: `Lab upstream unreachable (${url}): ${cause}`,
        });
    }
}

export async function readUpstreamJson<T = unknown>(
    response: Response,
): Promise<T> {
    const text = await response.text();
    let body: unknown = text;
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        // keep raw text
    }
    if (!response.ok) {
        const message =
            (body &&
                typeof body === "object" &&
                "message" in body &&
                String((body as { message: unknown }).message)) ||
            (typeof body === "string" && body) ||
            `Upstream ${response.status}`;
        throw createError({
            statusCode: response.status >= 400 && response.status < 600 ? response.status : 502,
            statusMessage: String(message),
            data: body,
        });
    }
    return body as T;
}

/** DCQL fragment derived from a credential the holder already has. */
export type LabCredentialQuery = {
    format: string;
    typeValues?: string[][];
    vctValues?: string[];
    doctypeValue?: string;
    queryId?: string;
    /** Optional post-present return URL (verifier success_redirect_uri). */
    successRedirectUri?: string;
    errorRedirectUri?: string;
};

export function buildCrossDeviceSessionBody(query: LabCredentialQuery) {
    const format = String(query.format || "").trim();
    if (!format) {
        throw createError({ statusCode: 400, statusMessage: "format is required" });
    }

    const id = String(query.queryId || "wallet_credential")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 64) || "wallet_credential";

    let meta: Record<string, unknown>;
    if (format === "mso_mdoc") {
        const doctypeValue = String(query.doctypeValue || "").trim();
        if (!doctypeValue) {
            throw createError({
                statusCode: 400,
                statusMessage: "doctypeValue is required for mso_mdoc",
            });
        }
        meta = { doctype_value: doctypeValue };
    } else if (format === "dc+sd-jwt" || format === "vc+sd-jwt") {
        const vctValues = (query.vctValues || [])
            .map((v) => String(v).trim())
            .filter(Boolean);
        if (!vctValues.length) {
            throw createError({
                statusCode: 400,
                statusMessage: "vctValues is required for sd-jwt formats",
            });
        }
        meta = { vct_values: vctValues };
    } else {
        const typeValues = (query.typeValues || [])
            .map((row) => row.map((t) => String(t).trim()).filter(Boolean))
            .filter((row) => row.length > 0);
        if (!typeValues.length) {
            throw createError({
                statusCode: 400,
                statusMessage: "typeValues is required for jwt_vc_json credentials",
            });
        }
        meta = { type_values: typeValues };
    }

    const body: Record<string, unknown> = {
        flow_type: "cross_device",
        core_flow: {
            dcql_query: {
                credentials: [
                    {
                        id,
                        format,
                        meta,
                    },
                ],
            },
        },
    };

    const successRedirectUri = String(query.successRedirectUri || "").trim();
    const errorRedirectUri = String(query.errorRedirectUri || "").trim();
    if (successRedirectUri || errorRedirectUri) {
        body.redirects = {
            ...(successRedirectUri
                ? { success_redirect_uri: successRedirectUri }
                : {}),
            ...(errorRedirectUri ? { error_redirect_uri: errorRedirectUri } : {}),
        };
    }

    return body;
}
