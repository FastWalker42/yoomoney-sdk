export class YooMoneyError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "YooMoneyError";
    this.code = code;
  }
}

export class YooMoneyHttpError extends YooMoneyError {
  readonly statusCode: number;
  readonly statusText: string;

  constructor(statusCode: number, statusText: string) {
    super(`HTTP ${statusCode}: ${statusText}`, "http_error");
    this.name = "YooMoneyHttpError";
    this.statusCode = statusCode;
    this.statusText = statusText;
  }
}
