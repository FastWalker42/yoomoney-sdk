import { describe, it, expect } from "vitest";
import {
  verifyNotificationSignature,
  parseNotification,
} from "./notifications.js";

// ---------------------------------------------------------------------------
// Self-consistent test vectors.
//
// We can't use the "official" example signature from the YooMoney docs
// directly because the published example payload contains Jinja-style
// translation artifacts (`{% translate %}Москва{% /translate %}` instead of
// `Moscow`), so the documented signature was computed over a broken payload.
//
// Instead, we build URL-encoded webhook bodies (exactly what YooMoney sends),
// compute the expected HMAC-SHA256 with an INDEPENDENT implementation below,
// and feed the body + sign into verifyNotificationSignature. The independence
// of the helper makes the positive tests non-circular, and the tamper tests
// prove that the verifier actually inspects the body.
// ---------------------------------------------------------------------------

/** Independent HMAC-SHA256 implementation, used only to compute test vectors. */
async function computeExpectedSign(
  body: string,
  secret: string,
): Promise<string> {
  const params = new URLSearchParams(body);
  const entries = Array.from(params.entries()).filter(
    ([k]) => k !== "sign",
  );
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const encodeRFC3986 = (s: string) =>
    encodeURIComponent(s).replace(
      /[!'()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );

  const payload = entries
    .map(([k, v]) => `${k}=${encodeRFC3986(v)}`)
    .join("&");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  return Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// A full HTTPS-style notification with sender info, Cyrillic test included.
const FULL_BODY =
  "notification_type=p2p-incoming&operation_id=904035776918098009&amount=0.99&withdraw_amount=1.00&currency=643&datetime=2014-04-28T16%3A31%3A28Z&sender=41003188981230&codepro=false&label=YM.label.12345&test_notification=false&unaccepted=false&lastname=Ivanov&firstname=Ivan&fathersname=Ivanovich&email=address%40example.ru&phone=%2B79253332211&city=Moscow&street=Tverskaya&building=12&suite=10&flat=10&zip=125075&sha1_hash=8693ddf402fe5dcc4c4744d466cabada2628148c";

const MINIMAL_BODY =
  "notification_type=p2p-incoming&operation_id=123&amount=10.00&withdraw_amount=10.00&currency=643&datetime=2024-01-01T00%3A00%3A00Z&sender=41001234&codepro=false&label=test&unaccepted=false";

const SECRET = "testsecret";

describe("parseNotification", () => {
  it("parses URL-encoded body into typed object", () => {
    const body =
      "notification_type=p2p-incoming&operation_id=123&amount=10.00&withdraw_amount=10.00&currency=643&datetime=2024-01-01T00:00:00Z&sender=41001234&codepro=false&label=test&unaccepted=false&sign=abc123";

    const n = parseNotification(body);

    expect(n.notification_type).toBe("p2p-incoming");
    expect(n.operation_id).toBe("123");
    expect(n.amount).toBe("10.00");
    expect(n.label).toBe("test");
    expect(n.sign).toBe("abc123");
  });

  it("handles URLSearchParams input", () => {
    const params = new URLSearchParams();
    params.set("notification_type", "card-incoming");
    params.set("operation_id", "456");
    params.set("amount", "50.00");
    params.set("withdraw_amount", "50.00");
    params.set("currency", "643");
    params.set("datetime", "2024-06-01T12:00:00Z");
    params.set("sender", "");
    params.set("codepro", "false");
    params.set("label", "order-1");
    params.set("unaccepted", "false");
    params.set("sign", "def456");

    const n = parseNotification(params);

    expect(n.notification_type).toBe("card-incoming");
    expect(n.label).toBe("order-1");
  });

  it("leaves optional fields undefined when absent from body", () => {
    const body =
      "notification_type=p2p-incoming&operation_id=1&amount=1.00&withdraw_amount=1.00&currency=643&datetime=2024-01-01T00:00:00Z&sender=&codepro=false&label=&unaccepted=false&sign=abc";

    const n = parseNotification(body);

    expect(n.lastname).toBeUndefined();
    expect(n.firstname).toBeUndefined();
    expect(n.email).toBeUndefined();
    expect(n.sha1_hash).toBeUndefined();
  });
});

describe("verifyNotificationSignature", () => {
  it("accepts a correctly signed full body (string)", async () => {
    const sign = await computeExpectedSign(FULL_BODY, SECRET);
    const body = `${FULL_BODY}&sign=${sign}`;

    const valid = await verifyNotificationSignature(body, SECRET);
    expect(valid).toBe(true);
  });

  it("accepts a correctly signed minimal body (string)", async () => {
    const sign = await computeExpectedSign(MINIMAL_BODY, SECRET);
    const body = `${MINIMAL_BODY}&sign=${sign}`;

    const valid = await verifyNotificationSignature(body, SECRET);
    expect(valid).toBe(true);
  });

  it("accepts URLSearchParams input", async () => {
    const sign = await computeExpectedSign(MINIMAL_BODY, SECRET);
    const params = new URLSearchParams(`${MINIMAL_BODY}&sign=${sign}`);

    const valid = await verifyNotificationSignature(params, SECRET);
    expect(valid).toBe(true);
  });

  it("accepts a parsed IncomingNotification object", async () => {
    const sign = await computeExpectedSign(MINIMAL_BODY, SECRET);
    const body = `${MINIMAL_BODY}&sign=${sign}`;
    const n = parseNotification(body);

    const valid = await verifyNotificationSignature(n, SECRET);
    expect(valid).toBe(true);
  });

  it("rejects an invalid signature", async () => {
    const body = `${MINIMAL_BODY}&sign=0000000000000000000000000000000000000000000000000000000000000000`;

    const valid = await verifyNotificationSignature(body, SECRET);
    expect(valid).toBe(false);
  });

  it("rejects a wrong secret", async () => {
    const sign = await computeExpectedSign(MINIMAL_BODY, SECRET);
    const body = `${MINIMAL_BODY}&sign=${sign}`;

    const valid = await verifyNotificationSignature(body, "wrong-secret");
    expect(valid).toBe(false);
  });

  it("rejects a tampered amount (replay protection)", async () => {
    const sign = await computeExpectedSign(MINIMAL_BODY, SECRET);
    // Replace amount=10.00 with amount=999.99 but keep original sign.
    const tampered = `${MINIMAL_BODY.replace(
      "amount=10.00",
      "amount=999.99",
    )}&sign=${sign}`;

    const valid = await verifyNotificationSignature(tampered, SECRET);
    expect(valid).toBe(false);
  });

  it("rejects a tampered label (replay protection)", async () => {
    const sign = await computeExpectedSign(MINIMAL_BODY, SECRET);
    const tampered = `${MINIMAL_BODY.replace(
      "label=test",
      "label=evil",
    )}&sign=${sign}`;

    const valid = await verifyNotificationSignature(tampered, SECRET);
    expect(valid).toBe(false);
  });

  it("rejects a body with no sign field", async () => {
    const valid = await verifyNotificationSignature(MINIMAL_BODY, SECRET);
    expect(valid).toBe(false);
  });

  it("rejects an empty body", async () => {
    const valid = await verifyNotificationSignature("", SECRET);
    expect(valid).toBe(false);
  });

  it("handles empty label value (key= form)", async () => {
    const bodyWithEmptyLabel =
      "notification_type=p2p-incoming&operation_id=123&amount=10.00&withdraw_amount=10.00&currency=643&datetime=2024-01-01T00%3A00%3A00Z&sender=41001234&codepro=false&label=&unaccepted=false";

    const sign = await computeExpectedSign(bodyWithEmptyLabel, SECRET);
    const body = `${bodyWithEmptyLabel}&sign=${sign}`;

    const valid = await verifyNotificationSignature(body, SECRET);
    expect(valid).toBe(true);
  });

  it("handles a body with Cyrillic characters in sender fields", async () => {
    const bodyWithCyrillic =
      "notification_type=card-incoming&operation_id=999&amount=500.00&withdraw_amount=500.00&currency=643&datetime=2024-05-01T10%3A00%3A00Z&sender=&codepro=false&label=order-5&unaccepted=false&lastname=%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2&firstname=%D0%98%D0%B2%D0%B0%D0%BD&city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0";

    const sign = await computeExpectedSign(bodyWithCyrillic, SECRET);
    const body = `${bodyWithCyrillic}&sign=${sign}`;

    const valid = await verifyNotificationSignature(body, SECRET);
    expect(valid).toBe(true);
  });
});
