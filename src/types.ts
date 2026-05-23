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

export interface CheckPaymentOptions {
  /** Expected payment amount. When set, only operations with amount >= this value are considered valid. */
  amount?: number;
  /** Whether to require status === "success". Default: true. */
  requireSuccess?: boolean;
}

// ---------------------------------------------------------------------------
// Payment link / form
// ---------------------------------------------------------------------------

export interface PaymentLinkParams {
  /** Receiver wallet number. */
  receiver: string;
  /** Amount to charge from sender. */
  sum: number;
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
  timeout?: number;
}
