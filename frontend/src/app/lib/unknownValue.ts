export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getErrorCode(value: unknown): string {
  return isRecord(value) && typeof value.code === "string" ? value.code : "";
}

export function getErrorMessage(value: unknown, fallback = "Unbekannter Fehler"): string {
  if (value instanceof Error && value.message) return value.message;
  return isRecord(value) && typeof value.message === "string" && value.message ? value.message : fallback;
}

export function getErrorStatus(value: unknown, fallback = 500): number {
  const status = isRecord(value) ? value.status : null;
  return typeof status === "number" && Number.isFinite(status) ? status : fallback;
}
