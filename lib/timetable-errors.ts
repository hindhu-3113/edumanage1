export class TimetableRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "TimetableRequestError";
  }
}
