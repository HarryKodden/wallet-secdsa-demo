<template>
  <CenterMain>
    <article class="max-w-3xl prose-help">
      <h1 class="text-2xl font-semibold text-gray-900">Help</h1>
      <p class="mt-2 text-sm text-gray-600">
        This wallet is part of the <strong>walt.id + SECDSA demo stack</strong>.
        It stores verifiable credentials, creates DIDs from SoftHSM-backed keys,
        and speaks OpenID for Verifiable Credentials (OID4VCI / OID4VP) 1.0 via wallet-api2.
      </p>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">Quick start</h2>
        <ol class="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
          <li>Sign in with OIDC (demo default).</li>
          <li>
            Set or enter your SoftHSM PIN — the wallet then creates a SECDSA key and
            <code>did:jwk</code> automatically if they are missing.
          </li>
          <li>
            Open <strong>Scan</strong> to receive a credential offer or share a presentation.
          </li>
        </ol>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">Same-device QR codes</h2>
        <p class="mt-2 text-sm text-gray-700">
          The camera cannot read a QR shown on the same screen. On the Scan page, use
          <strong>Paste from clipboard</strong> or <strong>Upload QR image</strong> instead —
          paste an <code>openid-credential-offer://…</code> link or the
          <code>https://…/get-credential-offer/…</code> URL from the issuer tab.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">SECDSA PIN unlock</h2>
        <p class="mt-2 text-sm text-gray-700">
          After OIDC login the wallet asks for the SoftHSM PIN (or unlocks silently via passkey PRF)
          and calls <code>POST /wallet/&#123;id&#125;/keys/secdsa/unlock</code>.
          The same step provisions a SECDSA key and <code>did:jwk</code> when missing.
          The PIN is held in session memory (and optionally PRF-encrypted) — not as plaintext in the browser.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">Keys &amp; DIDs</h2>
        <div class="mt-3 overflow-x-auto rounded-xl border border-gray-200">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-gray-50 text-gray-700">
              <tr>
                <th class="px-3 py-2 font-semibold">Action</th>
                <th class="px-3 py-2 font-semibold">Where</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-gray-700">
              <tr>
                <td class="px-3 py-2">SECDSA key + <code>did:jwk</code></td>
                <td class="px-3 py-2">Created automatically after PIN setup (also Keys / DIDs in Settings)</td>
              </tr>
              <tr>
                <td class="px-3 py-2">Receive / present</td>
                <td class="px-3 py-2">Wallet → Scan (paste, upload, or camera)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-sm text-gray-700">
          SoftHSM keeps <strong>one user key</strong> per lab account. If another wallet regenerates
          a key for <code>citizen-42</code>, older DIDs can go stale and issuers reject proofs with
          <code>invalid_request</code>. Delete the stale key + DID, regenerate, create a new
          <code>did:jwk</code>, then use a <strong>fresh</strong> offer.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">Useful links</h2>
        <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li><NuxtLink class="text-blue-600 underline" to="/settings">Settings</NuxtLink> — SECDSA defaults</li>
          <li><NuxtLink class="text-blue-600 underline" to="/help/privacy">Privacy &amp; usage</NuxtLink></li>
          <li>
            APIs:
            <a class="text-blue-600 underline" href="http://localhost:7006/swagger" target="_blank" rel="noopener noreferrer">wallet</a>,
            <a class="text-blue-600 underline" href="http://localhost:7005/swagger" target="_blank" rel="noopener noreferrer">issuer</a>,
            <a class="text-blue-600 underline" href="http://localhost:7004/swagger" target="_blank" rel="noopener noreferrer">verifier</a>
          </li>
        </ul>
      </section>

      <section class="mt-8 mb-10">
        <h2 class="text-lg font-semibold text-gray-900">Troubleshooting</h2>
        <ul class="mt-2 list-disc space-y-2 pl-5 text-sm text-gray-700">
          <li><code>invalid_request</code> on Accept → stale SoftHSM key/DID or burned single-use offer.</li>
          <li>PIN keeps failing → wrong PIN, or SECDSA lab not running (<code>docker compose ps</code>).</li>
          <li>Empty keys after restart → memory WSCD wiped; regenerate key + DID.</li>
        </ul>
      </section>
    </article>
  </CenterMain>
</template>

<script setup lang="ts">
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";

definePageMeta({
  layout: "default-reduced-nav",
});

useHead({ title: "Help - walt.id" });
</script>

<style scoped>
code {
  border-radius: 0.25rem;
  background: #f3f4f6;
  padding: 0.1rem 0.35rem;
  font-size: 0.85em;
}
</style>
