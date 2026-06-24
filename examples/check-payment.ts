/**
 * Check if a payment with a specific label has been received.
 *
 * Usage:
 *   YOOMONEY_TOKEN=<token> npx tsx examples/check-payment.ts <label>
 *   YOOMONEY_TOKEN=<token> bun examples/check-payment.ts <label>
 */
import { YooMoneyClient } from "../src/index.js";

const token = process.env.YOOMONEY_TOKEN;
const label = process.argv[2];

if (!token) {
  console.error("Set YOOMONEY_TOKEN environment variable");
  process.exit(1);
}
if (!label) {
  console.error("Usage: bun examples/check-payment.ts <label>");
  process.exit(1);
}

const client = new YooMoneyClient({ token });
const result = await client.checkPaymentByLabel(label);

if (result.found) {
  console.log(`Payment with label "${label}" FOUND.\n`);
  for (const op of result.operations) {
    console.log(`  [${op.datetime}] +${op.amount}  ${op.title}  (${op.status})`);
  }
} else {
  console.log(`Payment with label "${label}" NOT found.`);
}
