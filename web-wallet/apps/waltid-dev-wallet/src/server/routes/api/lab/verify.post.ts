import {
    buildCrossDeviceSessionBody,
    type LabCredentialQuery,
    labFetch,
    readUpstreamJson,
    verifierApi2Base,
} from "../../../utils/labApis";

type VerifyBody = LabCredentialQuery & {
    /** @deprecated use format + typeValues / vctValues / doctypeValue */
    presetId?: string;
};

/**
 * Create a cross-device verification session on local verifier-api2 for a
 * DCQL query that matches a credential already in the wallet.
 */
export default defineEventHandler(async (event) => {
    const body = (await readBody<VerifyBody>(event)) || {};
    if (!body.format) {
        throw createError({
            statusCode: 400,
            statusMessage:
                "Select a credential from your wallet (format + type/vct/doctype required)",
        });
    }

    const sessionBody = buildCrossDeviceSessionBody({
        format: body.format,
        typeValues: body.typeValues,
        vctValues: body.vctValues,
        doctypeValue: body.doctypeValue,
        queryId: body.queryId,
        successRedirectUri: body.successRedirectUri,
        errorRedirectUri: body.errorRedirectUri,
        flowType: body.flowType,
    });

    const upstream = await labFetch(
        `${verifierApi2Base()}/verification-session/create`,
        {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(sessionBody),
        },
    );

    const created = await readUpstreamJson<{
        sessionId?: string;
        bootstrapAuthorizationRequestUrl?: string;
        fullAuthorizationRequestUrl?: string;
    }>(upstream);

    const requestUrl =
        created.bootstrapAuthorizationRequestUrl ||
        created.fullAuthorizationRequestUrl;
    if (!requestUrl) {
        throw createError({
            statusCode: 502,
            statusMessage: "Verifier did not return an authorization request URL",
            data: created,
        });
    }

    return {
        sessionId: created.sessionId,
        requestUrl,
        bootstrapAuthorizationRequestUrl: created.bootstrapAuthorizationRequestUrl,
        fullAuthorizationRequestUrl: created.fullAuthorizationRequestUrl,
    };
});
