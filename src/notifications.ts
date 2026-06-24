import type { IncomingNotification } from "./types.js";

/**
 * Notification input: a parsed notification object, a raw URL-encoded body
 * string, or URLSearchParams.
 *
 * Working with the raw body (string / URLSearchParams) is preferred because
 * it preserves the exact set of fields YooMoney sent. Building the signature
 * from a parsed {@link IncomingNotification} is supported for backwards
 * compatibility but may produce an incorrect signature if optional fields
 * (e.g. `lastname`, `email`) are present in the original body but were
 * normalised to `""` / `undefined` during parsing.
 */
export type NotificationInput =
  | IncomingNotification
  | string
  | URLSearchParams;

/**
 * Verify the HMAC-SHA256 signature of an incoming YooMoney notification.
 *
 * Implements the algorithm described in the official YooMoney documentation:
 *
 * 1. Take all notification parameters EXCEPT `sign`.
 * 2. Sort them alphabetically by key (A-Z).
 * 3. URL-encode each value using RFC 3986 (UTF-8).
 * 4. Join as `key=value&key=value...`. Empty values are kept as `key=`.
 * 5. Compute HMAC-SHA256 with the notification secret.
 * 6. Compare the result (lowercase hex) with the received `sign` value using
 *    a constant-time comparison.
 *
 * Uses the Web Crypto API — works in Node 18+, Bun, Deno, Cloudflare Workers.
 *
 * @param input - Parsed notification object, raw URL-encoded body string,
 *   or URLSearchParams. Raw forms are preferred.
 * @param notificationSecret - Secret key from YooMoney HTTP notification
 *   settings.
 * @returns `true` if the signature is valid.
 */
export async function verifyNotificationSignature(
  input: NotificationInput,
  notificationSecret: string,
): Promise<boolean> {
  const params = toUrlSearchParams(input);
  const receivedSign = params.get("sign");

  // No `sign` field at all → cannot verify, refuse.
  if (!receivedSign) return false;

  const signaturePayload = buildSignaturePayload(params);
  const computed = await hmacSha256Hex(signaturePayload, notificationSecret);

  return constantTimeEqualsHex(computed, receivedSign);
}

/**
 * Parse a URL-encoded notification body into a typed object.
 *
 * Accepts a string (raw body) or URLSearchParams.
 *
 * Note: optional fields that are absent in the source body are set to
 * `undefined`. Required core fields are set to `""` when missing, matching
 * YooMoney's behaviour of always transmitting them (possibly empty).
 */
export function parseNotification(
  body: string | URLSearchParams,
): IncomingNotification {
  const params =
    typeof body === "string" ? new URLSearchParams(body) : body;

  const get = (key: string) => params.get(key);
  const getOrEmpty = (key: string) => params.get(key) ?? "";

  return {
    notification_type: getOrEmpty("notification_type"),
    operation_id: getOrEmpty("operation_id"),
    amount: getOrEmpty("amount"),
    withdraw_amount: getOrEmpty("withdraw_amount"),
    currency: getOrEmpty("currency"),
    datetime: getOrEmpty("datetime"),
    sender: getOrEmpty("sender"),
    codepro: getOrEmpty("codepro"),
    label: getOrEmpty("label"),
    unaccepted: getOrEmpty("unaccepted"),
    sign: getOrEmpty("sign"),
    // Optional fields: stay undefined when absent (matches docs semantics).
    sha1_hash: get("sha1_hash") ?? undefined,
    test_notification: get("test_notification") ?? undefined,
    lastname: get("lastname") ?? undefined,
    firstname: get("firstname") ?? undefined,
    fathersname: get("fathersname") ?? undefined,
    email: get("email") ?? undefined,
    phone: get("phone") ?? undefined,
    city: get("city") ?? undefined,
    street: get("street") ?? undefined,
    building: get("building") ?? undefined,
    suite: get("suite") ?? undefined,
    flat: get("flat") ?? undefined,
    zip: get("zip") ?? undefined,
  } as IncomingNotification;
}

// -------------------------------------------------------------------------
// Internal helpers
// -------------------------------------------------------------------------

function toUrlSearchParams(input: NotificationInput): URLSearchParams {
  if (typeof input === "string") return new URLSearchParams(input);
  if (input instanceof URLSearchParams) return input;

  // IncomingNotification → reconstruct URLSearchParams from present fields.
  // Skip `undefined` values to mirror what YooMoney actually sent.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  return params;
}

/**
 * Build the canonical signature payload from URLSearchParams.
 *
 * Per YooMoney docs:
 * - Remove the `sign` parameter.
 * - Sort remaining keys alphabetically.
 * - URL-encode values using RFC 3986.
 * - Empty values stay as `key=`.
 * - Join with `&`.
 */
function buildSignaturePayload(params: URLSearchParams): string {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of params.entries()) {
    if (key === "sign") continue;
    entries.push([key, value]);
  }
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  return entries
    .map(([k, v]) => `${k}=${encodeRFC3986(v)}`)
    .join("&");
}

function encodeRFC3986(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

async function hmacSha256Hex(
  payload: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  return hexEncode(signatureBytes);
}

function hexEncode(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time comparison of two lowercase hex strings.
 *
 * Falls back to a simple equality if the lengths differ (which already
 * leaks length information but is safe: HMAC-SHA256 is always 64 hex chars).
 */
function constantTimeEqualsHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
