import type { PaymentLinkParams } from "./types.js";
import { YooMoneyError } from "./errors.js";

const QUICKPAY_URL = "https://yoomoney.ru/quickpay/confirm";
const MAX_LABEL_LENGTH = 64;

/**
 * Generate a YooMoney quickpay payment URL.
 *
 * The link opens the YooMoney payment page with pre-filled fields.
 * Use `label` to later identify the payment in operation history.
 */
export function generatePaymentLink(params: PaymentLinkParams): string {
  validatePaymentLinkParams(params);

  const qs = new URLSearchParams();
  qs.set("receiver", params.receiver);
  qs.set("quickpay-form", "button");
  // `sum` is optional — omit it for open-ended (free-amount) payments.
  if (params.sum !== undefined) qs.set("sum", String(params.sum));

  if (params.paymentType) qs.set("paymentType", params.paymentType);
  if (params.label) qs.set("label", params.label);
  if (params.successURL) qs.set("successURL", params.successURL);

  return `${QUICKPAY_URL}?${qs.toString()}`;
}

/**
 * Generate an HTML form that submits a payment to YooMoney.
 *
 * POST-based form is the officially documented approach.
 * Embed it in your page; the user clicks the button and pays.
 */
export function generatePaymentForm(
  params: PaymentLinkParams,
  buttonText = "Оплатить",
): string {
  validatePaymentLinkParams(params);

  const hidden = (name: string, value: string) =>
    `  <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`;

  const lines: string[] = [
    `<form method="POST" action="${QUICKPAY_URL}">`,
    hidden("receiver", params.receiver),
    hidden("quickpay-form", "button"),
  ];
  // `sum` is optional — omit it for open-ended (free-amount) payments.
  if (params.sum !== undefined) lines.push(hidden("sum", String(params.sum)));

  if (params.label) lines.push(hidden("label", params.label));
  if (params.successURL) lines.push(hidden("successURL", params.successURL));

  if (params.paymentType) {
    lines.push(hidden("paymentType", params.paymentType));
  } else {
    lines.push(
      `  <label><input type="radio" name="paymentType" value="PC" checked /> Кошелёк YooMoney</label>`,
      `  <label><input type="radio" name="paymentType" value="AC" /> Банковская карта</label>`,
    );
  }

  lines.push(`  <button type="submit">${escapeHtml(buttonText)}</button>`);
  lines.push(`</form>`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------

function validatePaymentLinkParams(params: PaymentLinkParams): void {
  if (!params || typeof params !== "object") {
    throw new YooMoneyError("Payment params are required", "invalid_params");
  }
  if (!params.receiver || params.receiver.trim() === "") {
    throw new YooMoneyError("`receiver` is required", "invalid_receiver");
  }
  if (typeof params.sum !== "undefined") {
    if (typeof params.sum !== "number" || !isFinite(params.sum) || params.sum <= 0) {
      throw new YooMoneyError(
        "`sum` must be a positive finite number when provided (omit it for open-ended payments)",
        "invalid_sum",
      );
    }
  }
  if (params.label !== undefined) {
    if (typeof params.label !== "string" || params.label.length === 0) {
      throw new YooMoneyError(
        "`label` must be a non-empty string when provided",
        "invalid_label",
      );
    }
    if (params.label.length > MAX_LABEL_LENGTH) {
      throw new YooMoneyError(
        `\`label\` must be at most ${MAX_LABEL_LENGTH} characters (got ${params.label.length})`,
        "invalid_label",
      );
    }
  }
}

/**
 * Escape a string for safe inclusion in HTML text content and
 * double-quoted attribute values.
 *
 * Escapes: & < > " '
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
