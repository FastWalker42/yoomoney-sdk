import { describe, it, expect } from "vitest";
import { generatePaymentLink, generatePaymentForm } from "./payment-link.js";
import { YooMoneyError } from "./errors.js";

describe("generatePaymentLink", () => {
  it("generates URL with required params", () => {
    const url = generatePaymentLink({ receiver: "410012345", sum: 100 });

    expect(url).toContain("https://yoomoney.ru/quickpay/confirm?");
    expect(url).toContain("receiver=410012345");
    expect(url).toContain("sum=100");
    expect(url).toContain("quickpay-form=button");
  });

  it("includes optional params", () => {
    const url = generatePaymentLink({
      receiver: "410012345",
      sum: 250.5,
      label: "order-99",
      paymentType: "AC",
      successURL: "https://example.com/ok",
    });

    expect(url).toContain("label=order-99");
    expect(url).toContain("paymentType=AC");
    expect(url).toContain("successURL=https");
  });
});

describe("generatePaymentForm", () => {
  it("generates valid HTML form", () => {
    const html = generatePaymentForm({ receiver: "410012345", sum: 100 });

    expect(html).toContain("<form");
    expect(html).toContain("quickpay/confirm");
    expect(html).toContain('name="receiver"');
    expect(html).toContain('value="410012345"');
    expect(html).toContain('value="100"');
    expect(html).toContain("</form>");
  });

  it("includes label in hidden field", () => {
    const html = generatePaymentForm({
      receiver: "410012345",
      sum: 50,
      label: "test-label",
    });

    expect(html).toContain('name="label"');
    expect(html).toContain('value="test-label"');
  });

  it("shows radio buttons when paymentType is not set", () => {
    const html = generatePaymentForm({ receiver: "410012345", sum: 50 });
    expect(html).toContain('value="PC"');
    expect(html).toContain('value="AC"');
  });

  it("uses fixed paymentType when specified", () => {
    const html = generatePaymentForm({
      receiver: "410012345",
      sum: 50,
      paymentType: "AC",
    });
    expect(html).toContain('name="paymentType" value="AC"');
    expect(html).not.toContain("radio");
  });

  it("uses custom button text", () => {
    const html = generatePaymentForm(
      { receiver: "410012345", sum: 50 },
      "Pay now",
    );
    expect(html).toContain("Pay now");
  });

  it("escapes HTML special characters in label and button text", () => {
    const html = generatePaymentForm(
      {
        receiver: "410012345",
        sum: 50,
        label: `<script>alert("xss")</script>`,
      },
      `Click & "Pay" <now>`,
    );

    // No raw script tag leaks into the output.
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;Pay&quot;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;now&gt;");
  });
});

describe("input validation", () => {
  it("rejects empty receiver", () => {
    expect(() =>
      generatePaymentLink({ receiver: "", sum: 100 }),
    ).toThrow(YooMoneyError);
  });

  it("rejects whitespace-only receiver", () => {
    expect(() =>
      generatePaymentLink({ receiver: "   ", sum: 100 }),
    ).toThrow(YooMoneyError);
  });

  it("rejects non-positive sum", () => {
    expect(() =>
      generatePaymentLink({ receiver: "410012345", sum: 0 }),
    ).toThrow(YooMoneyError);
    expect(() =>
      generatePaymentLink({ receiver: "410012345", sum: -10 }),
    ).toThrow(YooMoneyError);
  });

  it("rejects NaN / Infinity sum", () => {
    expect(() =>
      generatePaymentLink({ receiver: "410012345", sum: NaN }),
    ).toThrow(YooMoneyError);
    expect(() =>
      generatePaymentLink({ receiver: "410012345", sum: Infinity }),
    ).toThrow(YooMoneyError);
  });

  it("rejects label longer than 64 chars", () => {
    expect(() =>
      generatePaymentLink({
        receiver: "410012345",
        sum: 100,
        label: "x".repeat(65),
      }),
    ).toThrow(YooMoneyError);
  });

  it("accepts label exactly 64 chars", () => {
    expect(() =>
      generatePaymentLink({
        receiver: "410012345",
        sum: 100,
        label: "x".repeat(64),
      }),
    ).not.toThrow();
  });
});

describe("open-ended payments (sum omitted)", () => {
  it("generatePaymentLink omits sum param when not provided", () => {
    const url = generatePaymentLink({
      receiver: "410012345",
      label: "topup-1",
    });
    expect(url).toContain("receiver=410012345");
    expect(url).toContain("label=topup-1");
    expect(url).not.toContain("sum=");
  });

  it("generatePaymentLink with sum still includes it", () => {
    const url = generatePaymentLink({
      receiver: "410012345",
      sum: 100,
    });
    expect(url).toContain("sum=100");
  });

  it("generatePaymentForm omits sum hidden field when not provided", () => {
    const html = generatePaymentForm({
      receiver: "410012345",
      label: "topup-1",
    });
    expect(html).not.toContain('name="sum"');
    expect(html).toContain('name="receiver"');
    expect(html).toContain('name="label"');
  });

  it("generatePaymentForm with sum still includes hidden field", () => {
    const html = generatePaymentForm({
      receiver: "410012345",
      sum: 100,
    });
    expect(html).toContain('name="sum"');
    expect(html).toContain('value="100"');
  });

  it("open-ended: receiver-only link generates without error", () => {
    expect(() =>
      generatePaymentLink({ receiver: "410012345" }),
    ).not.toThrow();
  });
});

describe("feePayer adjustment (v2.4.0)", () => {
  it("feePayer=sender: multiplies sum by (1 + MAX_FEE_RATE)", () => {
    // 5 * 1.03 = 5.15
    const url = generatePaymentLink({
      receiver: "410012345",
      sum: 5,
      feePayer: "sender",
    });
    expect(url).toContain("sum=5.15");
  });

  it("feePayer=receiver: uses sum as-is (fee will be deducted)", () => {
    const url = generatePaymentLink({
      receiver: "410012345",
      sum: 5,
      feePayer: "receiver",
    });
    expect(url).toContain("sum=5");
    expect(url).not.toContain("sum=5.");
  });

  it("feePayer omitted: uses sum as-is", () => {
    const url = generatePaymentLink({
      receiver: "410012345",
      sum: 5,
    });
    expect(url).toContain("sum=5");
  });

  it("feePayer=sender with open-ended (sum omitted): no sum in URL", () => {
    const url = generatePaymentLink({
      receiver: "410012345",
      feePayer: "sender",
      label: "topup-1",
    });
    expect(url).not.toContain("sum=");
  });

  it("feePayer=sender: rounds sum to 2 decimal places", () => {
    // 100 * 1.03 = 103 (no decimals needed)
    const url1 = generatePaymentLink({
      receiver: "410012345",
      sum: 100,
      feePayer: "sender",
    });
    expect(url1).toContain("sum=103");

    // 99.99 * 1.03 = 102.9897 → rounds to 102.99
    const url2 = generatePaymentLink({
      receiver: "410012345",
      sum: 99.99,
      feePayer: "sender",
    });
    expect(url2).toContain("sum=102.99");
  });

  it("generatePaymentForm also adjusts sum for feePayer=sender", () => {
    const html = generatePaymentForm({
      receiver: "410012345",
      sum: 5,
      feePayer: "sender",
    });
    expect(html).toContain('name="sum"');
    expect(html).toContain('value="5.15"');
  });

  it("rejects invalid feePayer value", () => {
    expect(() =>
      // @ts-expect-error testing runtime guard
      generatePaymentLink({ receiver: "410012345", sum: 5, feePayer: "split" }),
    ).toThrow(YooMoneyError);
  });
});
