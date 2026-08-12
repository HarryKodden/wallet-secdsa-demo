<template>
  <CenterMain>
    <article class="max-w-3xl">
      <h1 class="text-2xl font-semibold text-gray-900">Privacy &amp; usage</h1>
      <p class="mt-2 text-sm text-gray-600">
        This application is an <strong>educational proof of concept</strong>.
        It is not a production identity wallet and is not offered as a commercial service.
      </p>

      <section class="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p class="font-semibold">SECDSA patent notice</p>
        <p class="mt-1">
          SECDSA is patent-encumbered. Educational and research use only unless you have a license.
          See
          <a
            class="underline"
            href="https://github.com/HarryKodden/SECDSA/blob/main/USAGE.md"
            target="_blank"
            rel="noopener noreferrer"
          >SECDSA USAGE.md</a>
          and this repository’s <code>NOTICE</code> file.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">What this demo stores</h2>
        <div class="mt-3 overflow-x-auto rounded-xl border border-gray-200">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-gray-50 text-gray-700">
              <tr>
                <th class="px-3 py-2 font-semibold">Data</th>
                <th class="px-3 py-2 font-semibold">Where</th>
                <th class="px-3 py-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-gray-700">
              <tr>
                <td class="px-3 py-2">Wallets, DIDs, credentials, events</td>
                <td class="px-3 py-2">Postgres</td>
                <td class="px-3 py-2">Persists across wallet-api2 restarts</td>
              </tr>
              <tr>
                <td class="px-3 py-2">SECDSA key metadata (public JWK)</td>
                <td class="px-3 py-2">Postgres</td>
                <td class="px-3 py-2"><strong>Private keys never leave SoftHSM</strong></td>
              </tr>
              <tr>
                <td class="px-3 py-2">SoftHSM private key material</td>
                <td class="px-3 py-2">SECDSA lab (memory WSCD)</td>
                <td class="px-3 py-2">Cleared if the <code>secdsa</code> container is recreated</td>
              </tr>
              <tr>
                <td class="px-3 py-2">SoftHSM PIN (session)</td>
                <td class="px-3 py-2">wallet-api2 process memory (+ browser Pinia while the tab lives)</td>
                <td class="px-3 py-2">
                  Not written to disk. Survives SPA navigations; cleared when wallet-api2 restarts.
                  PRF-encrypted copy may be stored for silent restore after passkey login.
                </td>
              </tr>
              <tr>
                <td class="px-3 py-2">Login session</td>
                <td class="px-3 py-2">HTTP-only cookies</td>
                <td class="px-3 py-2">Gates the UI for this demo</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-sm text-gray-700">
          Credentials accepted from external issuers (for example a sandbox OID4VCI agent)
          stay in your local Postgres volume so you can present them later.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">What we do not do</h2>
        <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>We do not sell or share your demo credentials with third parties.</li>
          <li>We do not send SoftHSM PINs to issuers or verifiers.</li>
          <li>We do not claim production GDPR readiness — treat all data as disposable lab data.</li>
        </ul>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">Third-party services</h2>
        <p class="mt-2 text-sm text-gray-700">
          Sign-in may use an external OIDC provider (for example SURF). Credential offers and
          presentations talk to whatever issuer/verifier URLs you open — those parties process
          data under their own policies.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">Wipe local demo data</h2>
        <p class="mt-2 text-sm text-gray-700">
          Removing Compose volumes deletes wallets, credentials, and keys in Postgres.
          Restarting the SECDSA lab clears SoftHSM memory:
        </p>
        <pre class="mt-3 overflow-x-auto rounded-xl bg-gray-900 px-4 py-3 text-sm text-gray-100">docker compose down -v
docker compose up --build -d</pre>
      </section>

      <p class="mt-8 mb-10 text-sm text-gray-600">
        Logo:
        <a
          class="text-blue-600 underline"
          href="https://www.flaticon.com/free-icon/digital-wallet_6783364"
          target="_blank"
          rel="noopener noreferrer"
        >Digital wallet</a>
        icon by Freepik (Flaticon).
        <span class="mx-2 text-gray-300">·</span>
        <NuxtLink class="text-blue-600 underline" to="/help">← Back to Help</NuxtLink>
      </p>
    </article>
  </CenterMain>
</template>

<script setup lang="ts">
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";

definePageMeta({
  layout: "default-reduced-nav",
});

useHead({ title: "Privacy & usage - walt.id" });
</script>

<style scoped>
code {
  border-radius: 0.25rem;
  background: #f3f4f6;
  padding: 0.1rem 0.35rem;
  font-size: 0.85em;
}
pre code {
  background: transparent;
  padding: 0;
  color: inherit;
}
</style>
