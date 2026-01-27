export class HttpError extends Error {
  public status: number;
  public details?: unknown;
  public code?: string;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    if (details && typeof (details as any).code === 'string') {
      this.code = (details as any).code;
    }
  }
}
