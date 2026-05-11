import type { IncomingNotification } from "./types.js";

/**
 * Verify the HMAC-SHA256 signature of an incoming YooMoney notification.
 *
 * Uses the Web Crypto API — works in Node 18+, Bun, Deno, Cloudflare Workers.
 *
 * @param notification - Parsed notification body (key/value from POST).
 * @param notificationSecret - Secret key from YooMoney HTTP notification settings.
 * @returns `true` if the signature is valid.
 */
export async function verifyNotificationSignature(
  notification: IncomingNotification,
  notificationSecret: string,
): Promise<boolean> {
  const signaturePayload = buildSignaturePayload(notification);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(notificationSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signaturePayload),
  );

  const computed = hexEncode(signatureBytes);
  return computed === notification.sign;
}

/**
 * Parse a URL-encoded notification body into a typed object.
 *
 * Accepts a string (raw body) or URLSearchParams.
 */
export function parseNotification(
  body: string | URLSearchParams,
): IncomingNotification {
  const params =
    typeof body === "string" ? new URLSearchParams(body) : body;

  return {
    notification_type: params.get("notification_type") ?? "",
    operation_id: params.get("operation_id") ?? "",
    amount: params.get("amount") ?? "",
    withdraw_amount: params.get("withdraw_amount") ?? "",
    currency: params.get("currency") ?? "",
    datetime: params.get("datetime") ?? "",
    sender: params.get("sender") ?? "",
    codepro: params.get("codepro") ?? "",
    label: params.get("label") ?? "",
    unaccepted: params.get("unaccepted") ?? "",
    sign: params.get("sign") ?? "",
    sha1_hash: params.get("sha1_hash") ?? undefined,
    test_notification: params.get("test_notification") ?? undefined,
    lastname: params.get("lastname") ?? undefined,
    firstname: params.get("firstname") ?? undefined,
    fathersname: params.get("fathersname") ?? undefined,
    email: params.get("email") ?? undefined,
    phone: params.get("phone") ?? undefined,
    city: params.get("city") ?? undefined,
    street: params.get("street") ?? undefined,
    building: params.get("building") ?? undefined,
    suite: params.get("suite") ?? undefined,
    flat: params.get("flat") ?? undefined,
    zip: params.get("zip") ?? undefined,
  } as IncomingNotification;
}

// -------------------------------------------------------------------------
// Internal helpers
// -------------------------------------------------------------------------

function buildSignaturePayload(
  notification: IncomingNotification,
): string {
  const entries: Record<string, string> = {};

  for (const [key, value] of Object.entries(notification)) {
    if (key === "sign" || value === undefined) continue;
    entries[key] = encodeRFC3986(String(value));
  }

  return Object.keys(entries)
    .sort()
    .map((k) => `${k}=${entries[k]}`)
    .join("&");
}

function encodeRFC3986(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function hexEncode(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
