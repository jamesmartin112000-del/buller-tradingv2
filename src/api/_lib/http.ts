export class HttpError extends Error {
  constructor(
  public readonly status: number,
  message: string)
  {
    super(message);
  }
}

export function sanitizePublicApiError(error: unknown) {
  if (error instanceof HttpError) {
    return { status: error.status, message: error.message };
  }
  console.error('Public data request failed', error);
  return {
    status: 502,
    message: 'The verified upstream data source is temporarily unavailable.'
  };
}