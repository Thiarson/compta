export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ValidationDetail {
  instancePath: string;
  params: Record<string, unknown>;
  message?: string;
}

function fieldFromDetail(detail: ValidationDetail): string | null {
  if (detail.instancePath) {
    return detail.instancePath.replace(/^\//, '');
  }
  const missingProperty = detail.params.missingProperty;
  return typeof missingProperty === 'string' ? missingProperty : null;
}

// Per-field messages live in ApiError.details, not .message (always "Validation failed").
export function getFieldErrors(error: unknown, field: string): { message?: string }[] {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') {
    return [];
  }

  const details = error.details as ValidationDetail[] | undefined;

  return (details ?? [])
    .filter((detail) => fieldFromDetail(detail) === field)
    .map((detail) => ({ message: detail.message }));
}
