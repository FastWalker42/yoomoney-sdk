/**
 * Fetch the 10 most recent operations.
 *
 * Usage:
 *   YOOMONEY_TOKEN=<token> npx tsx examples/get-history.ts
 *   YOOMONEY_TOKEN=<token> bun examples/get-history.ts
 */
import { YooMoneyClient } from "../src/index.js";

const token = process.env.YOOMONEY_TOKEN;
if (!token) {
  console.error("Set YOOMONEY_TOKEN environment variable");
  process.exit(1);
}

const client = new YooMoneyClient({ token });
const ops = await client.getRecentOperations(10);

console.log(`Last ${ops.length} operations:\n`);
for (const op of ops) {
  const sign = op.direction === "in" ? "+" : "-";
  console.log(`  [${op.datetime}] ${sign}${op.amount}  ${op.title}  (${op.status})`);
}
