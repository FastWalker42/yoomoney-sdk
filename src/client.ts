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
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY = 500;
const MAX_LABEL_LENGTH = 64;

export class YooMoneyClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelay: number;

  constructor(options: YooMoneyClientOptions) {
    if (!options.token || typeof options.token !== "string") {
      throw new YooMoneyError("YooMoneyClient: `token` is required", "invalid_token");
    }
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelay = options.retryBaseDelay ?? DEFAULT_RETRY_BASE_DELAY;
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
    if (!params?.operation_id) {
      throw new YooMoneyError(
        "getOperationDetails: `operation_id` is required",
        "illegal_param_operation_id",
      );
    }
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
    validateLabel(label);

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
    validateLabel(label);

    const {
      timeoutMs = 300_000,
      intervalMs = 5_000,
      ...checkOpts
    } = opts;
    if (intervalMs < 1_000) {
      throw new YooMoneyError(
        "waitForPayment: `intervalMs` must be at least 1000ms to avoid rate limiting",
        "invalid_interval",
      );
    }

    const deadline = Date.now() + timeoutMs;

    // Always run at least one check, even when timeoutMs === 0.
    do {
      const result = await this.checkPaymentByLabel(label, checkOpts);
      if (result.found) return result.operations;

      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const sleepMs = Math.min(intervalMs, remaining);
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    } while (Date.now() < deadline);

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

  private async post<T>(
    path: string,
    body?: URLSearchParams,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const bodyStr = body?.toString() ?? "";

    let attempt = 0;
    let lastError: unknown;
    while (attempt <= this.maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: bodyStr,
          signal: controller.signal,
        });

        // Retry on 429 / 5xx
        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < this.maxRetries
        ) {
          await sleep(this.retryBackoffDelay(attempt));
          attempt++;
          continue;
        }

        if (!response.ok) {
          throw new YooMoneyHttpError(response.status, response.statusText);
        }

        // Verify Content-Type before parsing JSON.
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          // Try to read text for diagnostics (truncated).
          let snippet = "";
          try {
            snippet = (await response.text()).slice(0, 200);
          } catch {
            /* ignore */
          }
          throw new YooMoneyError(
            `Unexpected Content-Type "${contentType}" from ${path}${
              snippet ? `: ${snippet}` : ""
            }`,
            "invalid_content_type",
          );
        }

        return (await response.json()) as T;
      } catch (err) {
        lastError = err;
        // Retry only on network errors / abort; HTTP errors above already
        // throw YooMoneyHttpError which we should not retry.
        if (err instanceof YooMoneyHttpError) throw err;
        if (err instanceof YooMoneyError && err.code === "invalid_content_type") {
          throw err;
        }
        if (attempt < this.maxRetries) {
          await sleep(this.retryBackoffDelay(attempt));
          attempt++;
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new YooMoneyError("Request failed", "request_failed");
  }

  private retryBackoffDelay(attempt: number): number {
    // Exponential backoff with jitter: 500ms, 1000ms, 2000ms, ...
    const base = this.retryBaseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * base * 0.3;
    return Math.round(base + jitter);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateLabel(label: string): void {
  if (typeof label !== "string" || label.length === 0) {
    throw new YooMoneyError(
      "Label must be a non-empty string",
      "invalid_label",
    );
  }
  if (label.length > MAX_LABEL_LENGTH) {
    throw new YooMoneyError(
      `Label must be at most ${MAX_LABEL_LENGTH} characters (got ${label.length})`,
      "invalid_label",
    );
  }
}
