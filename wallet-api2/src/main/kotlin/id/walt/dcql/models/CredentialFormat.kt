package id.walt.dcql.models

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNames

/**
 * Standard Credential Format Identifiers for OpenID4VP.
 * See Appendix B of OpenID4VP spec.
 *
 * **This list can be extended by profiles.**
 *
 * THUS, THIS IS POSSIBLY **NON-EXHAUSTIVE**.
 */
@OptIn(ExperimentalSerializationApi::class)
@Serializable
enum class CredentialFormat(vararg val id: String) {
    /** W3C VC as JWT */
    @SerialName("jwt_vc_json")
    JWT_VC_JSON("jwt_vc_json"),

    /** W3C VC with Data Integrity (JSON-LD) */
    @SerialName("ldp_vc")
    LDP_VC("ldp_vc"),

    /** ISO mdoc */
    @SerialName("mso_mdoc")
    MSO_MDOC("mso_mdoc"),

    /**
     * IETF SD-JWT VC.
     * Draft 28+ wire value is `dc+sd-jwt`; older verifiers/issuers (e.g. eduWallet
     * sandbox) still send the legacy `vc+sd-jwt` identifier in DCQL.
     */
    @SerialName("dc+sd-jwt")
    @JsonNames("vc+sd-jwt", "vc-sd_jwt")
    DC_SD_JWT(
        "dc+sd-jwt",
        "vc+sd-jwt",
        "vc-sd_jwt" // matches @SerialName on SdJwtCredential sealed class — used for DCQL format matching of stored credentials
    ),

    /** AnonCreds (support pending) */
    @SerialName("ac_vp")
    AC_VP("ac_vp")

    // other common or profile-specific formats here
    // For truly custom/unknown formats, the original string field might be needed
    // or a custom serializer for this enum to handle unknown values.

    // For simplicity, this enum covers common ones.
}
