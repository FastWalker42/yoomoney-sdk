/**
 * Retrieve YooMoney account information.
 *
 * Usage:
 *   YOOMONEY_TOKEN=<token> npx tsx examples/get-account-info.ts
 *   YOOMONEY_TOKEN=<token> bun examples/get-account-info.ts
 */
import { YooMoneyClient } from "../src/index.js";

const token = process.env.YOOMONEY_TOKEN;
if (!token) {
  console.error("Set YOOMONEY_TOKEN environment variable");
  process.exit(1);
}

const client = new YooMoneyClient({ token });
const info = await client.getAccountInfo();

console.log("Account info:\n");
console.log(`  Account:  ${info.account}`);
console.log(`  Balance:  ${info.balance} (currency ${info.currency})`);
console.log(`  Status:   ${info.account_status}`);
console.log(`  Type:     ${info.account_type}`);

if (info.cards_linked?.length) {
  console.log("  Linked cards:");
  for (const card of info.cards_linked) {
    console.log(`    ${card.type} ${card.pan_fragment}`);
  }
}
