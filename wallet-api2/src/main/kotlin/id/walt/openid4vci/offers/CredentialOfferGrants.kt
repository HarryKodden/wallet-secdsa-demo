package id.walt.openid4vci.offers

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * OID4VCI credential offer `grants` object.
 *
 * Stock walt.id 0.23.1 rejects offers that advertise both `authorization_code` and
 * `pre-authorized_code`. The OID4VCI spec allows both; SURF OIDF lab (and others) do so.
 * This overlay keeps both grants so the wallet can prefer pre-authorized when present.
 */
@Serializable
data class CredentialOfferGrants(
    @SerialName("authorization_code")
    val authorizationCode: AuthorizationCodeGrant? = null,
    @SerialName("urn:ietf:params:oauth:grant-type:pre-authorized_code")
    val preAuthorizedCode: PreAuthorizedCodeGrant? = null,
) {
    init {
        require(authorizationCode != null || preAuthorizedCode != null) {
            "Credential offer grants must include authorization_code and/or pre-authorized_code"
        }
    }
}
