package id.walt.did.dids.resolver.local

import id.walt.crypto.keys.Key
import id.walt.crypto.keys.jwk.JWKKey
import id.walt.crypto.utils.Base64Utils.decodeFromBase64Url
import id.walt.did.dids.DidUtils
import id.walt.did.dids.document.DidDocument
import id.walt.did.dids.document.DidJwkDocument

/**
 * Overlay of stock walt.id `DidJwkResolver` (0.23.1).
 *
 * Stock [DidUtils.pathFromDid] keeps DID URL fragments (`did:jwk:…#0`). Decoding that
 * path as base64url throws `Invalid symbol '#' … at index …` — which surfaces on
 * OID4VP present when [id.walt.w3c.PresentationBuilder] resolves the holder DID from
 * a credential subject / `cnf.kid` that includes `#0`.
 *
 * Use the method-specific id without fragment/query (same as [DidUtils.identifierFromDid]).
 */
class DidJwkResolver : LocalResolverMethod("jwk") {

    override suspend fun resolve(did: String): Result<DidDocument> {
        val bareDid = bareDid(did)
        return resolveToKey(did).map { key ->
            DidDocument(
                DidJwkDocument(did = bareDid, didJwk = key.exportJWKObject()).toMap()
            )
        }
    }

    override suspend fun resolveToKey(did: String): Result<Key> {
        val encoded = DidUtils.identifierFromDid(did)
            ?: DidUtils.pathFromDid(did)?.substringBefore('#')?.substringBefore('?')
            ?: return Result.failure(IllegalArgumentException("Invalid did:jwk: $did"))
        return JWKKey.importJWK(encoded.decodeFromBase64Url().decodeToString())
    }

    private fun bareDid(did: String): String =
        did.substringBefore('#').substringBefore('?')
}
