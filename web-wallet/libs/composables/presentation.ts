import {encodeDisclosure} from "./disclosures.ts";
import {useCurrentWallet} from "./accountWallet.ts";
import {computed, type Ref, ref, watch} from "vue";
import {decodeRequest} from "./siop-requests.ts";
import {navigateTo} from "nuxt/app";
import {useSecdsaPin} from "./secdsaPin.ts";
import {normalizeWalletCredential} from "./credential.ts";

type PresentationTransactionDataItem = {
  type: string;
  credential_ids: string[];
  transaction_data_hashes_alg?: string[];
  require_cryptographic_holder_binding?: boolean;
  [key: string]: unknown;
};

type MatchedCredential = {
  id: string;
  document?: string;
  parsedDocument?: Record<string, unknown>;
  disclosures?: string;
  format?: string;
};

type ResolveVpRequestResult = {
  authorizationRequest?: Record<string, unknown>;
  nonce?: string | null;
  clientId?: string | null;
  responseUri?: string | null;
  hasRequestUri?: boolean;
  dcqlQuery?: Record<string, unknown> | null;
};

type MatchCredentialsResult = {
  matchedQueryIds: string[];
  matchCount: number;
  matchedCredentialIds: Record<string, string[]>;
};

function parseStringArrayParameter(value: string | null): string[] {
  if (!value) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Invalid transaction_data: expected a JSON array of strings.");
  }

  if (!Array.isArray(parsed) || !parsed.every((entry): entry is string => typeof entry === "string")) {
    throw new Error("Invalid transaction_data: expected a JSON array of strings.");
  }

  return parsed;
}

function decodeBase64UrlJson<T>(value: string): T {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = window.atob(`${base64}${padding}`);
    const utf8 = decodeURIComponent(
      Array.from(decoded)
        .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(utf8) as T;
  } catch {
    throw new Error("Invalid transaction_data: malformed base64url or JSON.");
  }
}

function isPresentationTransactionDataItem(value: unknown): value is PresentationTransactionDataItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PresentationTransactionDataItem).type === "string" &&
    Array.isArray((value as PresentationTransactionDataItem).credential_ids) &&
    (value as PresentationTransactionDataItem).credential_ids.every((credentialId) => typeof credentialId === "string")
  );
}

const TRANSACTION_DATA_KNOWN_FIELDS = [
  "type",
  "credential_ids",
  "transaction_data_hashes_alg",
  "require_cryptographic_holder_binding",
];

type TransactionDataProfile = {
  type: string;
  displayName: string;
  requiredFields?: string[];
};

export function transactionDataEntries(transactionDataItem: Record<string, unknown>) {
  return Object.entries(transactionDataItem).filter(
    ([field]) => !TRANSACTION_DATA_KNOWN_FIELDS.includes(field),
  );
}

export function formatTransactionDataField(field: string) {
  return field.replace(/_/g, " ");
}

export function formatTransactionDataValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function asUrlString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object" && "toString" in value) {
    const s = String(value);
    return s && s !== "[object Object]" ? s : null;
  }
  return null;
}

function parseTransactionDataFromRequest(request: string): PresentationTransactionDataItem[] {
  try {
    const url = new URL(request.includes("://") ? request : `openid4vp://authorize?${request.replace(/^\?/, "")}`);
    return parseStringArrayParameter(url.searchParams.get("transaction_data")).map((encoded) => {
      const item = decodeBase64UrlJson<unknown>(encoded);
      if (!isPresentationTransactionDataItem(item)) {
        throw new Error("Invalid transaction_data: each item must define type and credential_ids.");
      }
      return item;
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid transaction_data")) {
      throw error;
    }
    return [];
  }
}

export async function usePresentation(query: any) {
  const index = ref(0);
  const failed = ref(false);
  const failMessage = ref("Unknown error occurred.");

  const currentWallet = useCurrentWallet();
  const originalRequest = decodeRequest(query.request as string);

  let resolved: ResolveVpRequestResult;
  try {
    resolved = await $fetch<ResolveVpRequestResult>(
      `/wallet-api/wallet/${currentWallet.value}/credentials/present/resolve-request`,
      {
        method: "POST",
        body: {requestUrl: originalRequest},
      },
    );
  } catch (e: any) {
    failed.value = true;
    failMessage.value =
      e?.data?.message ?? e?.data ?? e?.statusMessage ?? e?.message ?? "Failed to resolve presentation request";
    throw e;
  }

  const dcqlQuery = resolved.dcqlQuery;
  if (!dcqlQuery) {
    failed.value = true;
    failMessage.value =
      "Presentation request has no DCQL query (wallet-api2 / OpenID4VP 1.0 requires dcql_query).";
    throw new Error(failMessage.value);
  }

  let transactionDataItems: PresentationTransactionDataItem[] = [];
  try {
    const fromAuth = (resolved.authorizationRequest as any)?.transaction_data;
    if (Array.isArray(fromAuth)) {
      transactionDataItems = fromAuth
        .map((item: unknown) => {
          if (typeof item === "string") {
            const decoded = decodeBase64UrlJson<unknown>(item);
            return isPresentationTransactionDataItem(decoded) ? decoded : null;
          }
          return isPresentationTransactionDataItem(item) ? item : null;
        })
        .filter(Boolean) as PresentationTransactionDataItem[];
    } else {
      transactionDataItems = parseTransactionDataFromRequest(originalRequest);
    }
  } catch (error) {
    failed.value = true;
    failMessage.value =
      error instanceof Error ? error.message : "Invalid transaction data in presentation request.";
    throw error;
  }

  const transactionDataProfiles = ref<TransactionDataProfile[]>([]);
  // Optional classic endpoint — ignore if missing on wallet-api2
  $fetch<TransactionDataProfile[]>(`/wallet-api/transaction-data-profiles`)
    .then((data) => {
      transactionDataProfiles.value = data;
    })
    .catch(() => {});

  function transactionDataDisplayName(type: string): string {
    const profile = transactionDataProfiles.value.find((p) => p.type === type);
    return profile?.displayName ?? type.split(".").pop()?.replace(/-/g, " ") ?? type;
  }

  const responseUri =
    asUrlString(resolved.responseUri) ??
    asUrlString((resolved.authorizationRequest as any)?.response_uri) ??
    asUrlString((resolved.authorizationRequest as any)?.redirect_uri) ??
    "";
  let verifierHost = "verifier";
  try {
    if (responseUri) verifierHost = new URL(responseUri).host;
    else if (resolved.clientId) verifierHost = String(resolved.clientId);
  } catch {
    verifierHost = responseUri || String(resolved.clientId ?? "verifier");
  }

  const presentationRequestPayload = JSON.stringify(dcqlQuery);

  const matchedCredentials = await fetchMatchedCredentials(
    currentWallet.value as string,
    dcqlQuery,
  );

  const selection = ref<{ [key: string]: boolean }>({});
  const selectedCredentialIds = computed(() =>
    Object.entries(selection.value)
      .filter((it) => it[1])
      .map((it) => it[0]),
  );
  for (let credential of matchedCredentials) {
    selection.value[credential.id] = true;
  }

  const disclosures: Ref<{ [key: string]: any[] }> = ref({});
  const encodedDisclosures = computed(() => {
    if (JSON.stringify(disclosures.value) === "{}") return null;

    const m: { [key: string]: any[] } = {};
    for (let credId in disclosures.value) {
      if (m[credId] === undefined) {
        m[credId] = [];
      }

      for (let disclosure of disclosures.value[credId]) {
        m[credId].push(encodeDisclosure(disclosure));
      }
    }

    return m;
  });

  function addDisclosure(credentialId: string, disclosure: string) {
    if (disclosures.value[credentialId] === undefined) {
      disclosures.value[credentialId] = [];
    }
    disclosures.value[credentialId].push(disclosure);
  }

  function removeDisclosure(credentialId: string, disclosure: string) {
    disclosures.value[credentialId] = disclosures.value[credentialId].filter(
      (elem) => elem[0] != disclosure[0],
    );
  }

  const disclosureModalState: Ref<{ [key: string]: boolean }> = ref({});

  for (let credential of matchedCredentials) {
    disclosureModalState.value[credential.id] = false;
  }
  if (matchedCredentials[index.value]) {
    disclosureModalState.value[matchedCredentials[index.value].id] = true;
  }

  function toggleDisclosure(credentialId: string) {
    disclosureModalState.value[credentialId] =
      !disclosureModalState.value[credentialId];
  }

  watch(index, () => {
    for (let credential of matchedCredentials) {
      disclosureModalState.value[credential.id] = false;
    }
    disclosureModalState.value[matchedCredentials[index.value].id] = true;
  });

  async function acceptPresentation() {
    failed.value = false;
    failMessage.value = "";

    const {ensureUnlocked} = useSecdsaPin();
    const unlocked = await ensureUnlocked({
      title: "Enter SECDSA PIN to present credential",
    });
    if (!unlocked) return;

    try {
      const result = await $fetch<{
        redirect_to?: string | null;
        get_url?: string | null;
        redirectUri?: string | null;
        transmission_success?: boolean | null;
        form_post_html?: string | null;
      }>(`/wallet-api/wallet/${currentWallet.value}/credentials/present`, {
        method: "POST",
        body: {
          requestUrl: originalRequest,
        },
      });

      const redirect =
        result?.redirect_to ?? result?.get_url ?? result?.redirectUri ?? null;

      if (redirect) {
        navigateTo(redirect, {external: true});
      } else if (result?.form_post_html) {
        // Verifier asked for form_post — open HTML response
        const w = window.open("", "_blank");
        if (w) {
          w.document.write(result.form_post_html);
          w.document.close();
        } else {
          window.alert("Presentation returned form_post HTML but pop-ups are blocked.");
        }
      } else {
        window.alert(
          result?.transmission_success === false
            ? "Presentation finished but verifier transmission reported failure."
            : "Presentation successful, no redirect URL supplied.",
        );
        navigateTo(`/wallet/${currentWallet.value}`, {external: true});
      }
    } catch (e: any) {
      failed.value = true;
      const msg =
        e?.data?.message ?? e?.data?.errorMessage ?? e?.message ?? String(e?.data ?? e);
      failMessage.value = String(msg);
      console.log("Error response: ", e?.data);
    }
  }

  return {
    currentWallet,
    verifierHost,
    transactionDataItems,
    transactionDataDisplayName,
    requestPayload: presentationRequestPayload,
    matchedCredentials,
    selectedCredentialIds,
    disclosures,
    selection,
    index,
    disclosureModalState,
    toggleDisclosure,
    addDisclosure,
    removeDisclosure,
    acceptPresentation,
    failed,
    failMessage,
  };
}

async function fetchMatchedCredentials(
  walletId: string,
  dcqlQuery: Record<string, unknown>,
): Promise<MatchedCredential[]> {
  const match = await $fetch<MatchCredentialsResult>(
    `/wallet-api/wallet/${walletId}/credentials/present/match-credentials-from-store`,
    {
      method: "POST",
      body: {dcqlQuery},
    },
  );

  const ids = [
    ...new Set(
      Object.values(match.matchedCredentialIds ?? {}).flatMap((list) => list ?? []),
    ),
  ];

  if (ids.length === 0) return [];

  const credentials = await Promise.all(
    ids.map(async (id) => {
      try {
        const detail = await $fetch(
          `/wallet-api/wallet/${walletId}/credentials/${encodeURIComponent(id)}`,
        );
        return normalizeWalletCredential(detail) as MatchedCredential;
      } catch (e) {
        console.warn("Failed to hydrate matched credential", id, e);
        return {id} as MatchedCredential;
      }
    }),
  );

  return credentials;
}
