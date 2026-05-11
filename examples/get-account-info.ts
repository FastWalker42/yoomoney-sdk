/**
 * Example: Retrieve YooMoney account information.
 *
 * Usage:
 *   YOOMONEY_TOKEN=<your_token> npx tsx examples/get-account-info.ts
 */
import { YooMoneyClient } from "../src";

async function main() {
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
