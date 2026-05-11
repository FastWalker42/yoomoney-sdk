/**
 * Example: Fetch the 10 most recent operations.
 *
 * Usage:
 *   YOOMONEY_TOKEN=<your_token> npx tsx examples/get-history.ts
 */
import { YooMoneyClient } from "../src";

async function main() {
  const token = process.env.YOOMONEY_TOKEN;
  if (!token) {
    console.error("Set YOOMONEY_TOKEN environment variable");
    process.exit(1);
  }

  const client = new YooMoneyClient({ token });
  const ops = await client.getRecentOperations(10);

  console.log(`Last ${ops.length} operations:\n`);
  for (const op of ops) {
    console.log(
      `  [${op.datetime}] ${op.direction === "in" ? "+" : "-"}${op.amount}  ${op.title}  (${op.status})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
