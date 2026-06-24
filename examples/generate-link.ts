/**
 * Generate a payment link and HTML form.
 *
 * Usage:
 *   npx tsx examples/generate-link.ts
 *   bun examples/generate-link.ts
 */
import { generatePaymentLink, generatePaymentForm } from "../src/index.js";

const receiver = process.env.YOOMONEY_RECEIVER ?? "4100118425529732";
const label = `order-${Date.now()}`;

const link = generatePaymentLink({
  receiver,
  sum: 100,
  label,
  successURL: "https://example.com/thanks",
});

console.log("Payment link:\n");
console.log(`  ${link}\n`);
console.log(`Label for verification: ${label}\n`);

console.log("HTML form:\n");
console.log(
  generatePaymentForm({
    receiver,
    sum: 100,
    label,
    successURL: "https://example.com/thanks",
  }),
);
