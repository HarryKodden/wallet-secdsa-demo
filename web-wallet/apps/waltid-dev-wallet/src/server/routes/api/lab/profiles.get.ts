import { issuerApi2Base, labFetch, readUpstreamJson } from "../../../utils/labApis";

type IssuerProfile = {
    profileId?: string;
    name?: string;
    credentialConfigurationId?: string;
};

/**
 * List credential profiles from local issuer-api2 (trimmed for the Lab UI).
 */
export default defineEventHandler(async () => {
    const upstream = await labFetch(`${issuerApi2Base()}/issuer2/profiles`, {
        headers: { Accept: "application/json" },
    });
    const profiles = await readUpstreamJson<IssuerProfile[]>(upstream);
    if (!Array.isArray(profiles)) {
        throw createError({
            statusCode: 502,
            statusMessage: "Issuer profiles response was not a list",
        });
    }
    return profiles.map((p) => ({
        profileId: p.profileId ?? "",
        name: p.name ?? p.profileId ?? "",
        credentialConfigurationId: p.credentialConfigurationId ?? "",
    }));
});
