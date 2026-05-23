import type {
  AccountInfo,
  CheckPaymentOptions,
  Operation,
  OperationDetailsParams,
  OperationDetailsResponse,
  OperationHistoryParams,
  OperationHistoryResponse,
  YooMoneyClientOptions,
} from "./types.js";
import { YooMoneyError, YooMoneyHttpError } from "./errors.js";

const DEFAULT_BASE_URL = "https://yoomoney.ru";
const DEFAULT_TIMEOUT = 10_000;

export class YooMoneyClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: YooMoneyClientOptions) {
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  async getAccountInfo(): Promise<AccountInfo> {
    return this.post<AccountInfo>("/api/account-info");
  }

  async getOperationHistory(
    params: OperationHistoryParams = {},
  ): Promise<OperationHistoryResponse> {
    const body = this.buildHistoryBody(params);
    const data = await this.post<OperationHistoryResponse>(
      "/api/operation-history",
      body,
    );
    if (data.error) {
      throw new YooMoneyError(
        `operation-history error: ${data.error}`,
        data.error,
      );
    }
    return data;
  }

  async *getOperationHistoryAll(
    params: Omit<OperationHistoryParams, "start_record"> = {},
  ): AsyncGenerator<Operation> {
    let startRecord: string | undefined;
    do {
      const page = await this.getOperationHistory({
        ...params,
        start_record: startRecord,
      });
      for (const op of page.operations) {
        yield op;
      }
      startRecord = page.next_record;
    } while (startRecord !== undefined);
  }

  async getOperationDetails(
    params: OperationDetailsParams,
  ): Promise<OperationDetailsResponse> {
    const body = new URLSearchParams();
    body.set("operation_id", params.operation_id);

    const data = await this.post<OperationDetailsResponse>(
      "/api/operation-details",
      body,
    );
    if (data.error) {
      throw new YooMoneyError(
        `operation-details error: ${data.error}`,
        data.error,
      );
    }
    return data;
  }

  async checkPaymentByLabel(
    label: string,
    opts: CheckPaymentOptions = {},
  ): Promise<{ found: boolean; operations: Operation[] }> {
    const page = await this.getOperationHistory({
      type: "deposition",
      label,
    });

    const requireSuccess = opts.requireSuccess !== false;
    const operations = page.operations.filter((op) => {
      if (requireSuccess && op.status !== "success") return false;
      if (opts.amount !== undefined && op.amount < opts.amount) return false;
      return true;
    });

    return {
      found: operations.length > 0,
      operations,
    };
  }

  async getRecentOperations(count = 10): Promise<Operation[]> {
    const page = await this.getOperationHistory({
      records: Math.min(Math.max(count, 1), 100),
    });
    return page.operations;
  }

  /**
   * Poll operation history until a payment with the given label appears.
   * Resolves with the matching operations or rejects on timeout.
   */
  async waitForPayment(
    label: string,
    opts: { timeoutMs?: number; intervalMs?: number } & CheckPaymentOptions = {},
  ): Promise<Operation[]> {
    const { timeoutMs = 300_000, intervalMs = 5_000, ...checkOpts } = opts;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const result = await this.checkPaymentByLabel(label, checkOpts);
      if (result.found) return result.operations;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new YooMoneyError(
      `Payment with label "${label}" not found within ${timeoutMs}ms`,
      "timeout",
    );
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private buildHistoryBody(params: OperationHistoryParams): URLSearchParams {
    const body = new URLSearchParams();

    if (params.type) {
      const types = Array.isArray(params.type)
        ? params.type.join(" ")
        : params.type;
      body.set("type", types);
    }
    if (params.label) body.set("label", params.label);
    if (params.from) body.set("from", params.from);
    if (params.till) body.set("till", params.till);
    if (params.start_record) body.set("start_record", params.start_record);
    if (params.records !== undefined)
      body.set("records", String(params.records));
    if (params.details !== undefined)
      body.set("details", String(params.details));

    return body;
  }

  private async post<T>(path: string, body?: URLSearchParams): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body?.toString() ?? "",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new YooMoneyHttpError(response.status, response.statusText);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
