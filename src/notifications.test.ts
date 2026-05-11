import { describe, it, expect } from "vitest";
import {
  verifyNotificationSignature,
  parseNotification,
} from "./notifications.js";
import type { IncomingNotification } from "./types.js";

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
});

describe("verifyNotificationSignature", () => {
  it("returns true for a valid HMAC-SHA256 signature", async () => {
    const secret = "testsecret";
    const notification: IncomingNotification = {
      notification_type: "p2p-incoming",
      operation_id: "123",
      amount: "10.00",
      withdraw_amount: "10.00",
      currency: "643",
      datetime: "2024-01-01T00:00:00Z",
      sender: "41001234",
      codepro: "false",
      label: "test",
      unaccepted: "false",
      sign: "", // will be computed
    };

    // Compute expected HMAC-SHA256
    const entries: Record<string, string> = {};
    for (const [key, value] of Object.entries(notification)) {
      if (key === "sign" || value === undefined) continue;
      entries[key] = encodeURIComponent(String(value)).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      );
    }
    const payload = Object.keys(entries)
      .sort()
      .map((k) => `${k}=${entries[k]}`)
      .join("&");

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expectedSign = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    notification.sign = expectedSign;

    const valid = await verifyNotificationSignature(notification, secret);
    expect(valid).toBe(true);
  });

  it("returns false for an invalid signature", async () => {
    const notification: IncomingNotification = {
      notification_type: "p2p-incoming",
      operation_id: "123",
      amount: "10.00",
      withdraw_amount: "10.00",
      currency: "643",
      datetime: "2024-01-01T00:00:00Z",
      sender: "41001234",
      codepro: "false",
      label: "test",
      unaccepted: "false",
      sign: "0000000000000000000000000000000000000000000000000000000000000000",
    };

    const valid = await verifyNotificationSignature(notification, "secret");
    expect(valid).toBe(false);
  });
});
