import type { PaymentLinkParams } from "./types.js";

const QUICKPAY_URL = "https://yoomoney.ru/quickpay/confirm";

/**
 * Generate a YooMoney quickpay payment URL.
 *
 * The link opens the YooMoney payment page with pre-filled fields.
 * Use `label` to later identify the payment in operation history.
 */
export function generatePaymentLink(params: PaymentLinkParams): string {
  const qs = new URLSearchParams();
  qs.set("receiver", params.receiver);
  qs.set("quickpay-form", "button");
  qs.set("sum", String(params.sum));

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
  const hidden = (name: string, value: string) =>
    `  <input type="hidden" name="${name}" value="${escapeHtml(value)}" />`;

  const lines: string[] = [
    `<form method="POST" action="${QUICKPAY_URL}">`,
    hidden("receiver", params.receiver),
    hidden("quickpay-form", "button"),
    hidden("sum", String(params.sum)),
  ];

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
