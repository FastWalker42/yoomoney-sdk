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
