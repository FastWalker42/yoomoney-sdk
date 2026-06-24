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
 * - `"sender"` (default) — the sender is charged the fee on top of `sum`.
 *   The receiver gets exactly `sum` (i.e. `op.amount === sum`).
 *   Use this when you generate a quickpay link with the default settings.
 *
 * - `"receiver"` — the fee is deducted from `sum`.
 *   The sender pays exactly `sum`, the receiver gets `sum - fee`
 *   (i.e. `op.withdraw_amount === sum`, `op.amount < sum`).
 *   Use this when you explicitly opted into receiver-pays-fee mode in
 *   YooMoney dashboard.
 *
 * When `ignoreFee: true` is set, this value is ignored.
 */
export type FeePayer = "sender" | "receiver";

export interface CheckPaymentOptions {
  /**
   * Expected payment amount (RUB). When set, only operations whose
   * relevant amount field is `>=` this value are considered valid.
   *
   * - With `ignoreFee: false` (default) and `feePayer: "sender"` (default):
   *   compares against `op.amount` (what the receiver actually got).
   * - With `ignoreFee: false` and `feePayer: "receiver"`: compares against
   *   `op.withdraw_amount` (what the sender was charged).
   * - With `ignoreFee: true`: always compares against `op.withdraw_amount`,
   *   so partial payments are rejected even if YooMoney fee ate part of `sum`.
   *
   * Leave `undefined` for open-ended payments (e.g. balance top-ups) —
   * any positive incoming transfer with matching label is accepted.
   */
  amount?: number;
  /** Whether to require `status === "success"`. Default: `true`. */
  requireSuccess?: boolean;
  /** Who pays the YooMoney fee. Default: `"sender"`. Ignored when `ignoreFee: true`. */
  feePayer?: FeePayer;
  /**
   * Skip fee-aware comparison entirely. When `true`, the SDK compares
   * `amount` against `op.withdraw_amount` (total debited from sender).
   * Useful when you don't care about YooMoney's cut and just want to
   * verify the user paid at least the requested sum.
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
   * Amount to charge from sender (RUB).
   *
   * Omit for open-ended payments (free-amount top-ups). YooMoney will
   * show a form where the sender enters any positive amount. The
   * resulting operation's `label` still lets you identify it later.
   */
  sum?: number;
  /** Payment method: PC = wallet, AC = bank card. */
  paymentType?: PaymentType;
  /** Label for identifying this payment (up to 64 chars). */
  label?: string;
  /** URL to redirect sender after successful payment. */
  successURL?: string;
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
