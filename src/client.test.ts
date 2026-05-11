import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { YooMoneyClient } from "./client";
import { YooMoneyError, YooMoneyHttpError } from "./errors";

const TOKEN = "test-token-123";

function mockFetch(response: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Unauthorized",
    json: () => Promise.resolve(response),
  });
}

describe("YooMoneyClient", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // getAccountInfo
  // -----------------------------------------------------------------------

  describe("getAccountInfo", () => {
    it("sends correct request and returns account info", async () => {
      const body = {
        account: "4100123456789",
        balance: 1000.5,
        currency: "643",
        account_status: "identified",
        account_type: "personal",
      };
      const fakeFetch = mockFetch(body);
      globalThis.fetch = fakeFetch;

      const client = new YooMoneyClient({ token: TOKEN });
      const info = await client.getAccountInfo();

      expect(fakeFetch).toHaveBeenCalledOnce();
      const [url, opts] = fakeFetch.mock.calls[0];
      expect(url).toBe("https://yoomoney.ru/api/account-info");
      expect(opts.method).toBe("POST");
      expect(opts.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(info.account).toBe("4100123456789");
      expect(info.balance).toBe(1000.5);
    });
  });

  // -----------------------------------------------------------------------
  // getOperationHistory
  // -----------------------------------------------------------------------

  describe("getOperationHistory", () => {
    it("returns operations list", async () => {
      const body = {
        operations: [
          {
            operation_id: "op1",
            status: "success",
            direction: "in",
            amount: 500,
            datetime: "2024-01-01T00:00:00.000+03:00",
            title: "Deposit",
            type: "deposition",
          },
        ],
      };
      globalThis.fetch = mockFetch(body);

      const client = new YooMoneyClient({ token: TOKEN });
      const result = await client.getOperationHistory({ records: 5 });

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].operation_id).toBe("op1");
    });

    it("sends type filter correctly", async () => {
      const fakeFetch = mockFetch({ operations: [] });
      globalThis.fetch = fakeFetch;

      const client = new YooMoneyClient({ token: TOKEN });
      await client.getOperationHistory({ type: ["deposition", "payment"] });

      const sentBody = fakeFetch.mock.calls[0][1].body as string;
      expect(sentBody).toContain("type=deposition+payment");
    });

    it("throws YooMoneyError on API error", async () => {
      globalThis.fetch = mockFetch({ error: "illegal_param_type" });

      const client = new YooMoneyClient({ token: TOKEN });
      await expect(
        client.getOperationHistory({ type: "deposition" }),
      ).rejects.toThrow(YooMoneyError);
    });
  });

  // -----------------------------------------------------------------------
  // getOperationDetails
  // -----------------------------------------------------------------------

  describe("getOperationDetails", () => {
    it("returns operation details", async () => {
      const body = {
        operation_id: "op1",
        status: "success",
        direction: "out",
        amount: 300,
        datetime: "2024-01-01T00:00:00.000+03:00",
        title: "Payment",
        type: "payment-shop",
        details: "Detailed info",
      };
      globalThis.fetch = mockFetch(body);

      const client = new YooMoneyClient({ token: TOKEN });
      const result = await client.getOperationDetails({
        operation_id: "op1",
      });

      expect(result.operation_id).toBe("op1");
      expect(result.details).toBe("Detailed info");
    });

    it("throws on API error", async () => {
      globalThis.fetch = mockFetch({
        error: "illegal_param_operation_id",
      });

      const client = new YooMoneyClient({ token: TOKEN });
      await expect(
        client.getOperationDetails({ operation_id: "bad" }),
      ).rejects.toThrow(YooMoneyError);
    });
  });

  // -----------------------------------------------------------------------
  // checkPaymentByLabel
  // -----------------------------------------------------------------------

  describe("checkPaymentByLabel", () => {
    it("returns found=true when matching ops exist", async () => {
      const body = {
        operations: [
          {
            operation_id: "op1",
            status: "success",
            direction: "in",
            amount: 100,
            datetime: "2024-01-01T00:00:00.000+03:00",
            title: "Deposit",
            type: "deposition",
            label: "order-42",
          },
        ],
      };
      globalThis.fetch = mockFetch(body);

      const client = new YooMoneyClient({ token: TOKEN });
      const result = await client.checkPaymentByLabel("order-42");

      expect(result.found).toBe(true);
      expect(result.operations).toHaveLength(1);
    });

    it("returns found=false when no matching ops", async () => {
      globalThis.fetch = mockFetch({ operations: [] });

      const client = new YooMoneyClient({ token: TOKEN });
      const result = await client.checkPaymentByLabel("nonexistent");

      expect(result.found).toBe(false);
      expect(result.operations).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // getRecentOperations
  // -----------------------------------------------------------------------

  describe("getRecentOperations", () => {
    it("returns recent operations", async () => {
      const body = {
        operations: [
          {
            operation_id: "op1",
            status: "success",
            direction: "in",
            amount: 200,
            datetime: "2024-02-01T00:00:00.000+03:00",
            title: "Test",
            type: "deposition",
          },
        ],
      };
      globalThis.fetch = mockFetch(body);

      const client = new YooMoneyClient({ token: TOKEN });
      const ops = await client.getRecentOperations(5);

      expect(ops).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // getOperationHistoryAll (pagination)
  // -----------------------------------------------------------------------

  describe("getOperationHistoryAll", () => {
    it("iterates through all pages", async () => {
      const page1 = {
        next_record: "2",
        operations: [
          {
            operation_id: "op1",
            status: "success",
            direction: "in",
            amount: 100,
            datetime: "2024-01-02T00:00:00.000+03:00",
            title: "A",
            type: "deposition",
          },
          {
            operation_id: "op2",
            status: "success",
            direction: "out",
            amount: 50,
            datetime: "2024-01-01T00:00:00.000+03:00",
            title: "B",
            type: "payment-shop",
          },
        ],
      };
      const page2 = {
        operations: [
          {
            operation_id: "op3",
            status: "success",
            direction: "in",
            amount: 300,
            datetime: "2023-12-31T00:00:00.000+03:00",
            title: "C",
            type: "deposition",
          },
        ],
      };

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        const data = callCount === 0 ? page1 : page2;
        callCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () => Promise.resolve(data),
        });
      });

      const client = new YooMoneyClient({ token: TOKEN });
      const ops: string[] = [];
      for await (const op of client.getOperationHistoryAll()) {
        ops.push(op.operation_id);
      }

      expect(ops).toEqual(["op1", "op2", "op3"]);
    });
  });

  // -----------------------------------------------------------------------
  // HTTP errors
  // -----------------------------------------------------------------------

  describe("HTTP error handling", () => {
    it("throws YooMoneyHttpError on non-OK response", async () => {
      globalThis.fetch = mockFetch({}, 401);

      const client = new YooMoneyClient({ token: TOKEN });
      await expect(client.getAccountInfo()).rejects.toThrow(
        YooMoneyHttpError,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Custom baseUrl
  // -----------------------------------------------------------------------

  describe("custom baseUrl", () => {
    it("respects custom baseUrl", async () => {
      const fakeFetch = mockFetch({ operations: [] });
      globalThis.fetch = fakeFetch;

      const client = new YooMoneyClient({
        token: TOKEN,
        baseUrl: "https://custom.example.com/",
      });
      await client.getOperationHistory();

      const url = fakeFetch.mock.calls[0][0];
      expect(url).toBe("https://custom.example.com/api/operation-history");
    });
  });
});
