<template>
  <CenterMain>
    <BackButton />
    <LoadingIndicator v-if="pending">Loading credential...</LoadingIndicator>
    <div v-else-if="error || !credential" class="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
      Could not load this credential.
      <pre class="mt-2 text-xs overflow-auto">{{ error }}</pre>
    </div>
    <div v-else>
      <div class="flex justify-center items-center my-10">
        <VerifiableCredentialCard
          :credential="credential"
          :isDetailView="true"
          :stale-binding="staleBinding"
          :stale-reason="staleReason"
        />
      </div>
      <div
        v-if="staleBinding"
        class="mx-7 mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950"
        role="status"
      >
        <p class="font-semibold">Bound to a wiped SoftHSM key</p>
        <p class="mt-1">
          {{ staleReason || "This credential’s subject DID no longer matches the live SoftHSM key." }}
          Presentations will fail until you delete it and re-receive with a fresh
          <code class="rounded bg-red-100 px-1">did:jwk</code> / offer.
        </p>
      </div>
      <div class="px-7 py-1">
        <div v-if="jwtJson?.type">
          <div class="text-gray-600 font-bold">
            {{
              jwtJson?.type[jwtJson?.type.length - 1].replace(
                /([a-z0-9])([A-Z])/g,
                "$1 $2",
              )
            }}
            Details
          </div>

          <!-- VerifiableDiploma -->
          <div
            v-if="
              jwtJson?.type[jwtJson?.type.length - 1] == 'VerifiableDiploma'
            "
          >
            <hr class="my-5" />
            <div class="text-gray-500 mb-4 font-bold">Subject</div>
            <div class="md:flex text-gray-500 mb-3 md:mb-1">
              <div class="min-w-[19vw]">Given Name</div>
              <div class="font-bold">
                {{ jwtJson?.credentialSubject?.givenNames }}
              </div>
            </div>
            <div class="md:flex text-gray-500 mb-3 md:mb-1">
              <div class="min-w-[19vw]">Family Name</div>
              <div class="font-bold">
                {{ jwtJson?.credentialSubject?.familyName }}
              </div>
            </div>
            <div class="md:flex text-gray-500 mb-3 md:mb-1">
              <div class="min-w-[19vw]">Date Of Birth</div>
              <div class="font-bold">
                {{ jwtJson?.credentialSubject?.dateOfBirth }}
              </div>
            </div>
            <hr class="my-5" />
            <div class="text-gray-500 mb-4 font-bold">Achievement</div>
            <div class="md:flex text-gray-500 mb-3 md:mb-1">
              <div class="min-w-[19vw]">Identifier</div>
              <div class="font-bold">
                {{ jwtJson?.credentialSubject?.identifier }}
              </div>
            </div>
            <div class="md:flex text-gray-500 mb-3 md:mb-1">
              <div class="min-w-[19vw]">Title</div>
              <div class="font-bold">
                {{ jwtJson?.credentialSubject?.learningAchievement.title }}
              </div>
            </div>
            <div class="md:flex text-gray-500 mb-3 md:mb-1">
              <div class="min-w-[19vw]">Description</div>
              <div class="font-bold">
                {{
                  jwtJson?.credentialSubject?.learningAchievement.description
                }}
              </div>
            </div>
            <div class="md:flex text-gray-500 mb-3 md:mb-1">
              <div class="min-w-[19vw]">Additional Notes</div>
              <div class="font-bold">
                {{
                  jwtJson?.credentialSubject?.learningAchievement
                    .additionalNote[0]
                }}
              </div>
            </div>
            <div class="md:flex text-gray-500 mb-3 md:mb-1">
              <div class="min-w-[19vw]">Grading Scheme</div>
              <div class="font-bold">
                {{ jwtJson?.credentialSubject?.gradingScheme.title }}
              </div>
            </div>
            <div class="md:flex text-gray-500 mb-3 md:mb-1">
              <div class="min-w-[19vw]">Graduation Location</div>
              <div class="font-bold">
                {{ jwtJson?.credentialSubject?.awardingOpportunity.location }}
              </div>
            </div>
            <div class="md:flex text-gray-500 mb-3 md:mb-1">
              <div class="min-w-[19vw]">Study Timeframe</div>
              <div class="font-bold"></div>
            </div>
            <hr class="my-5" />
            <div class="text-gray-500 mb-4 font-bold">University</div>
            <div class="md:flex text-gray-500 mb-3 md:mb-1">
              <div class="min-w-[19vw]">Legal Identifier</div>
              <div class="font-bold">
                {{
                  jwtJson?.credentialSubject?.awardingOpportunity.awardingBody
                    .eidasLegalIdentifier
                }}
              </div>
            </div>
            <div class="md:flex text-gray-500 mb-3 md:mb-1">
              <div class="min-w-[19vw]">Name</div>
              <div class="font-bold">
                {{
                  jwtJson?.credentialSubject?.awardingOpportunity.awardingBody
                    .preferredName
                }}
              </div>
            </div>
            <div class="md:flex text-gray-500 mb-3 md:mb-1">
              <div class="min-w-[19vw]">Registration</div>
              <div class="font-bold">
                {{
                  jwtJson?.credentialSubject?.awardingOpportunity.awardingBody
                    .registration
                }}
              </div>
            </div>
          </div>

          <!-- Open Badge 3.0 -->
          <div
            v-else-if="
              jwtJson?.type[jwtJson?.type.length - 1] == 'OpenBadgeCredential'
            "
          >
            <hr class="my-5" />
            <div class="flex items-center">
              <div>
                <div class="text-gray-500 mb-4 font-bold">Subject</div>
                <div class="md:flex text-gray-500 mb-3 md:mb-1">
                  <div class="min-w-[19vw]">Name</div>
                  <div class="font-bold">
                    {{ jwtJson?.credentialSubject?.achievement.name }}
                  </div>
                </div>
                <div class="md:flex text-gray-500 mb-3 md:mb-1">
                  <div class="min-w-[19vw]">Description</div>
                  <div class="font-bold">
                    {{ jwtJson?.credentialSubject?.achievement.description }}
                  </div>
                </div>
                <div class="md:flex text-gray-500 mb-3 md:mb-1">
                  <div class="min-w-[19vw]">Criteria</div>
                  <div class="font-bold grow-0">
                    {{
                      jwtJson?.credentialSubject?.achievement.criteria
                        ?.narrative
                    }}
                  </div>
                </div>
              </div>
              <img
                :src="jwtJson?.credentialSubject?.achievement.image?.id"
                class="w-32 h-20 hidden md:block"
              />
            </div>
          </div>

          <!-- Permanent Resident Card -->
          <div
            v-else-if="
              jwtJson?.type[jwtJson?.type.length - 1] == 'PermanentResidentCard'
            "
          >
            <hr class="my-5" />
            <div>
              <div class="text-gray-500 mb-4 font-bold">Subject Info</div>
              <div class="md:flex text-gray-500 mb-3 md:mb-1">
                <div class="min-w-[19vw]">Given Name</div>
                <div class="font-bold">
                  {{ jwtJson?.credentialSubject?.givenName }}
                </div>
              </div>
              <div class="md:flex text-gray-500 mb-3 md:mb-1">
                <div class="min-w-[19vw]">Surname</div>
                <div class="font-bold">
                  {{ jwtJson?.credentialSubject?.familyName }}
                </div>
              </div>
              <div class="md:flex text-gray-500 mb-3 md:mb-1">
                <div class="min-w-[19vw]">Date Of Birth</div>
                <div class="font-bold grow-0">
                  {{ jwtJson?.credentialSubject?.birthDate }}
                </div>
              </div>
              <div class="md:flex text-gray-500 mb-3 md:mb-1">
                <div class="min-w-[19vw]">Sex</div>
                <div class="font-bold grow-0">
                  {{ jwtJson?.credentialSubject?.gender }}
                </div>
              </div>
              <div class="md:flex text-gray-500 mb-3 md:mb-1">
                <div class="min-w-[19vw]">Country Of Birth</div>
                <div class="font-bold grow-0">
                  {{ jwtJson?.credentialSubject?.birthCountry }}
                </div>
              </div>
              <div class="md:flex text-gray-500 mb-3 md:mb-1">
                <div class="min-w-[19vw]">Category</div>
                <div class="font-bold grow-0">
                  {{ jwtJson?.credentialSubject?.lprCategory }}
                </div>
              </div>
              <div class="md:flex text-gray-500 mb-3 md:mb-1">
                <div class="min-w-[19vw]">USCIS</div>
                <div class="font-bold grow-0">
                  {{ jwtJson?.credentialSubject?.lprNumber }}
                </div>
              </div>
              <div class="md:flex text-gray-500 mb-3 md:mb-1">
                <div class="min-w-[19vw]">Resident Since</div>
                <div class="font-bold grow-0">
                  {{ jwtJson?.credentialSubject?.residentSince }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="credential?.format === 'mso_mdoc'">
          <div class="text-gray-600 font-bold">Details</div>
          <hr class="my-5" />
          <div
            class="md:flex text-gray-500 mb-3 md:mb-1"
            v-for="elem in mdocRows"
            :key="elem.elementIdentifier"
          >
            <div class="min-w-[19vw]">{{ elem.elementIdentifier }}</div>
            <div class="font-bold break-all">{{ elem.elementValue }}</div>
          </div>
          <p v-if="mdocRows.length === 0" class="text-gray-500 text-sm">
            No mdoc claims to display.
          </p>
        </div>

        <div
          v-if="issuerName || issuerDid || credentialIssuerService || issuerKid"
        >
          <hr class="my-5" />
          <div class="text-gray-500 mb-4 font-bold">Issuer</div>
          <div class="md:flex text-gray-500 mb-3 md:mb-1">
            <div class="min-w-[19vw]">Name</div>
            <div class="font-bold">{{ issuerName }}</div>
          </div>
          <div class="md:flex text-gray-500 mb-3 md:mb-1">
            <div class="min-w-[19vw]">DID</div>
            <div class="font-bold truncate hover:overflow-auto">
              {{ issuerDid }}
            </div>
          </div>
          <div
            v-if="isSdJwtFormat"
            class="md:flex text-gray-500 mb-3 md:mb-1"
          >
            <div class="min-w-[19vw]">KeyID</div>
            <div class="font-bold truncate hover:overflow-auto">
              {{ issuerKid }}
            </div>
          </div>
          <div class="md:flex text-gray-500 mb-3 md:mb-1">
            <div class="min-w-[19vw]">Service endpoint</div>
            <NuxtLink
              class="font-bold truncate"
              :to="credentialIssuerService ?? ''"
              _blank
            >
              {{ credentialIssuerService }}
            </NuxtLink>
          </div>
        </div>

        <div v-if="manifestClaims">
          <hr class="my-5" />
          <div class="text-gray-500 mb-4 font-bold">Entra Manifest Claims</div>
          <ul>
            <li
              v-for="[jsonKey, nameDescriptor] in Object.entries(
                manifestClaims,
              )"
              class="md:flex text-gray-500 mb-3 md:mb-1"
            >
              <div class="min-w-[19vw]">
                {{ nameDescriptor?.label ?? "Unknown" }}
              </div>
              <div class="font-bold truncate hover:overflow-auto">
                {{
                  credential
                    ? (JSONPath({
                        path: jsonKey.replace(/^vc\./, ""),
                        json: jwtJson,
                      }).find((elem) => elem) ?? `Not found: ${jsonKey}`)
                    : null
                }}
              </div>
            </li>
          </ul>
        </div>

        <div v-if="disclosures">
          <hr class="my-5" />
          <div class="text-gray-500 mb-4 font-bold">
            Selectively disclosable attributes
          </div>
          <ul v-if="disclosures?.length > 0">
            <li
              v-for="disclosure in disclosures"
              class="md:flex text-gray-500 mb-3 md:mb-1"
            >
              <div class="min-w-[19vw]">Attribute "{{ disclosure[1] }}"</div>
              <div class="font-bold">{{ disclosure[2] }}</div>
            </li>
          </ul>
          <div v-else>No disclosable attributes!</div>
        </div>

        <div class="text-gray-600 flex justify-between">
          <hr class="mt-5 mb-3" />
          <div>
            {{
              jwtJson?.expirationDate && jwtJson?.issuanceDate
                ? "Valid from " +
                  new Date(jwtJson?.issuanceDate).toISOString().slice(0, 10) +
                  " to " +
                  new Date(jwtJson?.expirationDate).toISOString().slice(0, 10)
                : ""
            }}
          </div>
          <div class="text-gray-900">
            Issued:
            {{ issuanceDate ? issuanceDate : "No issuance date" }}
          </div>
        </div>
      </div>
    </div>
    <div class="flex justify-between mt-12">
      <div class="flex gap-3">
        <button
          class="rounded bg-primary-400 px-2 py-1 text-white shadow-sm hover:bg-primary-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
          type="button"
          @click="showCredentialJson = !showCredentialJson"
        >
          View Credential
        </button>
        <button
          v-if="manifest"
          class="rounded bg-primary-400 px-2 py-1 text-white shadow-sm hover:bg-primary-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
          type="button"
          @click="showCredentialManifest = !showCredentialManifest"
        >
          View Credential Manifest
        </button>
      </div>
      <button
        class="rounded bg-red-500 px-2 py-1 text-white shadow-sm hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        type="button"
        @click="deleteCredential"
      >
        Delete Credential
      </button>
    </div>
    <div v-if="showCredentialJson">
      <div class="flex space-x-3 mt-10">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900 whitespace-pre-wrap">
            {{ credentialId }}
          </p>
          <p class="text-sm text-gray-500">Verifiable Credential data below:</p>
        </div>
      </div>
      <div class="p-3 shadow mt-3">
        <h3 class="font-semibold mb-2">QR code</h3>
        <div v-if="credential && credential.document">
          <NuxtErrorBoundary>
            <qrcode-vue
              v-if="credential.document && credential.document.length <= 4296"
              :value="credential.document"
              class="m-5"
              level="L"
              size="500"
            />
            <p v-else>
              Unfortunately, this Verifiable Credential is too big to be
              viewable as QR code (credential size is
              {{ credential.document.length }} characters, but the maximum a QR
              code can hold is 4296).
            </p>

            <template #error="{ error }">
              <p>QR code is too long: {{ error }}</p>
            </template>
          </NuxtErrorBoundary>
        </div>
      </div>
      <div class="shadow p-3 mt-2 font-mono overflow-scroll">
        <h3 class="font-semibold mb-2">JWT</h3>
        <pre v-if="credential && credential?.document">{{
          /*JSON.stringify(JSON.parse(*/
          credential.document /*), null, 2)*/ ?? ""
        }}</pre>
      </div>
      <div class="shadow p-3 mt-2 font-mono overflow-scroll">
        <h3 class="font-semibold mb-2">JSON</h3>
        <pre v-if="credential && credential?.document">{{ jwtJson }} </pre>
      </div>
    </div>

    <div v-if="showCredentialManifest">
      <div class="flex space-x-3 mt-10">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900 whitespace-pre-wrap">
            {{ credentialId }}
          </p>
          <p class="text-sm text-gray-500">
            Verifiable Credential Manifest below:
          </p>
        </div>
      </div>
      <div class="shadow p-3 mt-2 font-mono overflow-scroll">
        <h3 class="font-semibold mb-2">Credential manifest</h3>
        <pre v-if="manifest">{{ manifest }} </pre>
      </div>
    </div>
  </CenterMain>
</template>

<script lang="ts" setup>
import VerifiableCredentialCard from "@waltid-web-wallet/components/credentials/VerifiableCredentialCard.vue";
import {
  useCredential,
  normalizeWalletCredential,
  mdocClaimRows,
  type WalletCredential,
} from "@waltid-web-wallet/composables/credential.ts";
import LoadingIndicator from "@waltid-web-wallet/components/loading/LoadingIndicator.vue";
import {useCurrentWallet} from "@waltid-web-wallet/composables/accountWallet.ts";
import BackButton from "@waltid-web-wallet/components/buttons/BackButton.vue";
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import {JSONPath} from "jsonpath-plus";
import QrcodeVue from "qrcode.vue";
import {computed, ref} from "vue";
import {
  credentialBindingById,
  fetchSecdsaStatus,
  type SecdsaStatusResponse,
} from "@waltid-web-wallet/composables/secdsaStatus.ts";
import {useSecdsaPin} from "@waltid-web-wallet/composables/secdsaPin.ts";

const route = useRoute();
const credentialId = Array.isArray(route.params.credentialId)
  ? route.params.credentialId[0]
  : String(route.params.credentialId ?? "");
const currentWallet = useCurrentWallet();
const {defaultAccountId} = useSecdsaPin();

const showCredentialJson = ref(false);
const showCredentialManifest = ref(false);
const secdsaStatus = ref<SecdsaStatusResponse | null>(null);

const {
  data: credentialRaw,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `wallet-${currentWallet.value}-credential-${credentialId}`,
  () =>
    $fetch(
      `/wallet-api/wallet/${currentWallet.value}/credentials/${encodeURIComponent(credentialId)}`,
    ),
  {watch: [currentWallet]},
);

onMounted(async () => {
  refresh();
  if (currentWallet.value) {
    secdsaStatus.value = await fetchSecdsaStatus(
      String(currentWallet.value),
      defaultAccountId(),
    );
  }
});

const credential = computed(() =>
  credentialRaw.value ? normalizeWalletCredential(credentialRaw.value) : null,
);

const binding = computed(() =>
  credentialBindingById(secdsaStatus.value).get(credentialId),
);
const staleBinding = computed(() => binding.value?.valid === false);
const staleReason = computed(() => binding.value?.reason ?? "");

const isSdJwtFormat = computed(() => {
  const f = String(credential.value?.format ?? "");
  return f === "vc+sd-jwt" || f === "dc+sd-jwt" || /sd-jwt/i.test(f);
});

const {
  jwtJson,
  disclosures,
  issuerName,
  issuerDid,
  issuerKid,
  credentialIssuerService,
  issuanceDate,
  manifest,
  manifestClaims,
} = useCredential(credential);

const mdocRows = computed(() => mdocClaimRows(jwtJson.value));

async function deleteCredential() {
  await $fetch(
    `/wallet-api/wallet/${currentWallet.value}/credentials/${encodeURIComponent(credentialId)}`,
    {method: "DELETE"},
  );
  await navigateTo({path: `/wallet/${currentWallet.value}`});
}

useHead({title: "View credential - walt.id"});
</script>
