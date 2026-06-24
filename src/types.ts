// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

export type OperationDirection = "in" | "out";

export type OperationStatus = "success" | "refused" | "in_progress";

export type OperationType =
  | "payment-shop"
  | "outgoing-transfer"
  | "deposition"
  | "incoming-transfer"
  | "incoming-transfer-protected";

export type OperationTypeFilter = "deposition" | "payment";

export type RecipientType = "account" | "phone" | "email";

export type AccountType = "personal" | "professional";

export type PaymentType = "PC" | "AC";

export type NotificationType = "p2p-incoming" | "card-incoming";

// ---------------------------------------------------------------------------
// account-info
// ---------------------------------------------------------------------------

export interface AccountInfo {
  account: string;
  balance: number;
  currency: string;
  account_status: string;
  account_type: AccountType;
  balance_details?: {
    total: number;
    available: number;
    deposition_pending?: number;
    blocked?: number;
    debt?: number;
    hold?: number;
  };
  cards_linked?: Array<{
    pan_fragment: string;
    type: string;
  }>;
}

// ---------------------------------------------------------------------------
// operation-history
// ---------------------------------------------------------------------------

export interface OperationHistoryParams {
  type?: OperationTypeFilter | OperationTypeFilter[];
  label?: string;
  from?: string;
  till?: string;
  start_record?: string;
  records?: number;
  details?: boolean;
}

export interface Operation {
  operation_id: string;
  status: OperationStatus;
  direction: OperationDirection;
  amount: number;
  datetime: string;
  title: string;
  type: OperationType;
  pattern_id?: string;
  label?: string;
  details?: string;
  recipient?: string;
  recipient_type?: RecipientType;
  sender?: string;
  message?: string;
  comment?: string;
  codepro?: boolean;
  fee?: number;
  amount_due?: number;
  /** Total amount debited from the sender (includes YooMoney fee when fee is on sender). Only present for incoming transfers and operation-details responses. */
  withdraw_amount?: number;
  digital_goods?: Record<string, unknown>;
}

export interface OperationHistoryResponse {
  next_record?: string;
  operations: Operation[];
  error?: string;
}

// ---------------------------------------------------------------------------
// operation-details
// ---------------------------------------------------------------------------

export interface OperationDetailsParams {
  operation_id: string;
}

export type OperationDetailsResponse = Operation & {
  error?: string;
};

// ---------------------------------------------------------------------------
// Check payment options
// ---------------------------------------------------------------------------

/**
 * Who pays the YooMoney processing fee.
 *
 * This is a **business-logic** choice made at payment creation time —
 * it determines what `sum` value goes into the quickpay link and what
 * threshold the SDK uses to validate the received `op.amount`.
 *
 * - `"sender"` (default) — the sender pays the fee on top of the requested
 *   amount. The SDK asks YooMoney for `sum = amount * 1.03` so that after
 *   the ~3% fee is deducted, the receiver gets at least `amount`.
 *   Validation: `op.amount >= amount`.
 *
 * - `"receiver"` — the fee is deducted from the requested amount. The SDK
 *   asks YooMoney for `sum = amount`, accepts that the receiver will get
 *   `amount - fee` (≈ `amount * 0.97`).
 *   Validation: `op.amount >= amount * (1 - MAX_FEE_RATE)`.
 *
 * The constant `MAX_FEE_RATE = 0.03` covers the maximum YooMoney card
 * processing fee (~3%). Wallet-to-wallet transfers are cheaper, so using
 * 3% is a safe worst-case threshold for any payment method.
 *
 * Note: this option does NOT affect the YooMoney API itself — it only
 * affects the `sum` field in `generatePaymentLink` and the comparison
 * threshold in `checkPaymentByLabel`.
 */
export type FeePayer = "sender" | "receiver";

export interface CheckPaymentOptions {
  /**
   * Expected payment amount in RUB (the amount you *want to receive*,
   * NOT the amount to charge the sender — the SDK adjusts for fees
   * internally based on `feePayer`).
   *
   * When set, only operations whose `op.amount` is `>=` the calculated
   * threshold are considered valid:
   * - `feePayer: "sender"` (default) → threshold = `amount`
   * - `feePayer: "receiver"` → threshold = `amount * 0.97`
   * - `ignoreFee: true` → threshold = `amount` (exact comparison, no fee tolerance)
   *
   * Leave `undefined` for open-ended payments (e.g. balance top-ups) —
   * any positive incoming transfer with matching label is accepted.
   */
  amount?: number;
  /** Whether to require `status === "success"`. Default: `true`. */
  requireSuccess?: boolean;
  /**
   * Who pays the YooMoney fee. Default: `"sender"`.
   * See {@link FeePayer} for semantics. Ignored when `ignoreFee: true`.
   */
  feePayer?: FeePayer;
  /**
   * Skip fee-aware comparison entirely. When `true`, the SDK compares
   * `op.amount` against `amount` exactly (no fee tolerance).
   *
   * Use this when you don't care about YooMoney's fee and want exact
   * matching (e.g. the receiver has 0% fee, or you're testing).
   * Default: `false`.
   */
  ignoreFee?: boolean;
}

// ---------------------------------------------------------------------------
// Payment link / form
// ---------------------------------------------------------------------------

export interface PaymentLinkParams {
  /** Receiver wallet number. */
  receiver: string;
  /**
   * Amount to charge from sender (RUB). This is the **gross** amount —
   * the SDK will adjust it based on `feePayer` if you use the
   * `generatePaymentLinkWithFee` helper, but in plain `generatePaymentLink`
   * this value goes directly to YooMoney as `sum`.
   *
   * Omit for open-ended payments (free-amount top-ups). YooMoney will
   * show a form where the sender enters any positive amount.
   */
  sum?: number;
  /** Payment method: PC = wallet, AC = bank card. */
  paymentType?: PaymentType;
  /** Label for identifying this payment (up to 64 chars). */
  label?: string;
  /** URL to redirect sender after successful payment. */
  successURL?: string;
  /**
   * Who pays the YooMoney fee. When set, the SDK adjusts `sum` accordingly:
   * - `"sender"` → `sum = expectedAmount * 1.03` (sender pays fee on top)
   * - `"receiver"` → `sum = expectedAmount` (fee deducted from this sum)
   *
   * Use this when you have a target "amount the receiver should get" and
   * want the SDK to compute the correct `sum` to send to YooMoney.
   * When omitted, `sum` is used as-is.
   */
  feePayer?: FeePayer;
}

// ---------------------------------------------------------------------------
// Notification (incoming transfer webhook)
// ---------------------------------------------------------------------------

export interface IncomingNotification {
  notification_type: NotificationType;
  operation_id: string;
  amount: string;
  withdraw_amount: string;
  currency: string;
  datetime: string;
  sender: string;
  codepro: string;
  label: string;
  unaccepted: string;
  sign: string;
  /** @deprecated Use `sign` instead. Removed after May 18, 2026. */
  sha1_hash?: string;
  test_notification?: string;
  lastname?: string;
  firstname?: string;
  fathersname?: string;
  email?: string;
  phone?: string;
  city?: string;
  street?: string;
  building?: string;
  suite?: string;
  flat?: string;
  zip?: string;
}

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface YooMoneyClientOptions {
  token: string;
  baseUrl?: string;
  /** Request timeout in ms (default: 10000). */
  timeout?: number;
  /** Max number of retries on 429 / 5xx / network errors (default: 3). */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 500). */
  retryBaseDelay?: number;
}

/** Options for `YooMoneyClient.waitForPayment`. */
export interface WaitForPaymentOptions extends CheckPaymentOptions {
  /** Total time to poll before giving up, in ms (default: 300000 = 5 min). */
  timeoutMs?: number;
  /** Interval between polls in ms (default: 5000, minimum: 1000). */
  intervalMs?: number;
}
