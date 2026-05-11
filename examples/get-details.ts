/**
 * Example: Get details of a specific operation.
 *
 * Usage:
 *   YOOMONEY_TOKEN=<your_token> npx tsx examples/get-details.ts <operation_id>
 */
import { YooMoneyClient } from "../src";

async function main() {
  const token = process.env.YOOMONEY_TOKEN;
  const operationId = process.argv[2];

  if (!token) {
    console.error("Set YOOMONEY_TOKEN environment variable");
    process.exit(1);
  }
  if (!operationId) {
    console.error("Usage: npx tsx examples/get-details.ts <operation_id>");
    process.exit(1);
  }

  const client = new YooMoneyClient({ token });
  const details = await client.getOperationDetails({
    operation_id: operationId,
  });

  console.log("Operation details:\n");
  console.log(JSON.stringify(details, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
