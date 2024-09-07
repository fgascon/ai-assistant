export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isStringOrUndefined(value: unknown): value is string | undefined {
  return typeof value === "string" || value === undefined;
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  if (!(error instanceof Error)) {
    return false;
  }
  const nodeError = error as NodeJS.ErrnoException;
  return (
    isStringOrUndefined(nodeError.code) &&
    isStringOrUndefined(nodeError.syscall) &&
    isStringOrUndefined(nodeError.path)
  );
}
