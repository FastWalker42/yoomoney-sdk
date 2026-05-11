export class YooMoneyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "YooMoneyError";
  }
}

export class YooMoneyHttpError extends YooMoneyError {
  constructor(
    public readonly statusCode: number,
    public readonly statusText: string,
  ) {
    super(`HTTP ${statusCode}: ${statusText}`, "http_error");
    this.name = "YooMoneyHttpError";
  }
}
