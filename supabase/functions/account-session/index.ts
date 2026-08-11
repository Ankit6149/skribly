import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.2";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const DEVICE_CLAIM = /^skd_[A-Za-z0-9_-]{43}$/;
const APP_VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const MAX_REQUEST_BYTES = 4096;
const OFFLINE_GRACE_SECONDS = 72 * 60 * 60;

interface RequestBody {
  deviceClaim: string;
  appVersion: string;
  productUpdatesOptIn: boolean;
}

interface TrialRow {
  trial_started_at: number;
  trial_ends_at: number;
  product_updates_opt_in: boolean;
  active_announcements: unknown[];
}

type AccountRole = "owner" | "member";

function accountRole(appMetadata: unknown): AccountRole {
  if (!appMetadata || typeof appMetadata !== "object") return "member";
  const metadata = appMetadata as Record<string, unknown>;
  return metadata.skribly_role === "owner" && metadata.skribly_owner === true
    ? "owner"
    : "member";
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

async function readBody(request: Request): Promise<RequestBody> {
  const statedLength = Number(request.headers.get("content-length") || 0);
  if (statedLength > MAX_REQUEST_BYTES) throw new Error("request_too_large");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
    throw new Error("request_too_large");
  }
  const value = JSON.parse(text) as Partial<RequestBody>;
  if (
    typeof value.deviceClaim !== "string" ||
    !DEVICE_CLAIM.test(value.deviceClaim) ||
    typeof value.appVersion !== "string" ||
    value.appVersion.length > 64 ||
    !APP_VERSION.test(value.appVersion) ||
    typeof value.productUpdatesOptIn !== "boolean"
  ) {
    throw new Error("invalid_request");
  }
  return value as RequestBody;
}

async function signingKey(adminClient: ReturnType<typeof createClient>): Promise<CryptoKey> {
  let encoded = Deno.env.get("SKRIBLY_ENTITLEMENT_PRIVATE_JWK");
  if (!encoded) {
    const { data, error } = await adminClient.rpc("skribly_get_entitlement_signing_jwk");
    if (error || typeof data !== "string") throw new Error("signing_unavailable");
    encoded = data;
  }
  if (!encoded) throw new Error("signing_unavailable");
  const key = JSON.parse(encoded) as JsonWebKey;
  if (key.kty !== "OKP" || key.crv !== "Ed25519" || !key.d || !key.x) {
    throw new Error("signing_unavailable");
  }
  return crypto.subtle.importKey("jwk", key, { name: "Ed25519" }, false, ["sign"]);
}

async function signEntitlement(
  payload: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>,
): Promise<string> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    "Ed25519",
    await signingKey(adminClient),
    payloadBytes,
  );
  return `${base64Url(payloadBytes)}.${base64Url(new Uint8Array(signature))}`;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return json(401, { error: "account_required" });

  try {
    const body = await readBody(request);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error("service_unavailable");

    const accountClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authorization.slice("Bearer ".length);
    const { data: userData, error: userError } = await accountClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user?.id || !user.email || !user.email_confirmed_at) {
      return json(401, { error: "verified_account_required" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await adminClient.rpc("skribly_claim_trial", {
      p_user_id: user.id,
      p_device_claim: body.deviceClaim,
      p_app_version: body.appVersion,
      p_product_updates_opt_in: body.productUpdatesOptIn,
    });
    if (error || !Array.isArray(data) || data.length !== 1) {
      console.error("trial_claim_failed", error?.code ?? "invalid_result");
      throw new Error("trial_claim_failed");
    }

    const row = data[0] as TrialRow;
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = Number(row.trial_ends_at);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) throw new Error("trial_claim_failed");
    const offlineUntil = Math.min(expiresAt, issuedAt + OFFLINE_GRACE_SECONDS);
    const signedEntitlement = await signEntitlement({
      productId: "skribly-personal-windows",
      licenseId: crypto.randomUUID(),
      accountId: user.id,
      email: user.email.toLowerCase(),
      deviceId: body.deviceClaim,
      issuedAt,
      entitlementType: "trial",
      expiresAt,
      offlineUntil,
      updatesUntil: 0,
      perpetual: false,
    }, adminClient);

    return json(200, {
      signedEntitlement,
      accountRole: accountRole(user.app_metadata),
      productUpdatesOptIn: Boolean(row.product_updates_opt_in),
      announcements: Array.isArray(row.active_announcements) ? row.active_announcements : [],
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "service_unavailable";
    if (code === "invalid_request") return json(400, { error: code });
    if (code === "request_too_large") return json(413, { error: code });
    console.error("account_session_failed", code);
    return json(503, { error: "account_service_unavailable" });
  }
});
