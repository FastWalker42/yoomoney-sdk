/** Direction of a financial transaction. */
export type OperationDirection = "in" | "out";

/** Status of a payment / transfer. */
export type OperationStatus = "success" | "refused" | "in_progress";

/** Type of operation in the history. */
export type OperationType =
  | "payment-shop"
  | "outgoing-transfer"
  | "deposition"
  | "incoming-transfer"
  | "incoming-transfer-protected";

/** Filter for operation-history: deposit or payment. */
export type OperationTypeFilter = "deposition" | "payment";

/** Recipient identifier type for outgoing P2P transfers. */
export type RecipientType = "account" | "phone" | "email";

/** Account type returned by account-info. */
export type AccountType = "personal" | "professional";

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
  /** Filter by operation type(s). */
  type?: OperationTypeFilter | OperationTypeFilter[];
  /** Filter payments by label. */
  label?: string;
  /** Show operations from this datetime (ISO 8601). */
  from?: string;
  /** Show operations until this datetime (ISO 8601). */
  till?: string;
  /** Pagination cursor returned by a previous call. */
  start_record?: string;
  /** Number of records per page (1–100, default 30). */
  records?: number;
  /** Include full details for each operation. */
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
  /** Present only when details=true or fetched via operation-details. */
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
// Client options
// ---------------------------------------------------------------------------

export interface YooMoneyClientOptions {
  /** OAuth token with required permissions. */
  token: string;
  /** Base URL override (default: https://yoomoney.ru). */
  baseUrl?: string;
  /** Request timeout in ms (default: 10 000). */
  timeout?: number;
}
