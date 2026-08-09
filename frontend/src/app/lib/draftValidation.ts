const DAY_MS = 24 * 60 * 60 * 1000;

export function addDaysIso(iso: string, days: number): string | null {
  const baseMs = Date.parse(iso);
  if (!Number.isFinite(baseMs)) return null;
  return new Date(baseMs + days * DAY_MS).toISOString();
}

export function computeDefaultResolutionDeadlineIso(options: {
  closesAtIso?: string;
  timeLeftHours: number;
  nowMs?: number;
}): string {
  const nowMs = options.nowMs ?? Date.now();
  const closeMs = options.closesAtIso ? Date.parse(options.closesAtIso) : Number.NaN;
  const baseIso = Number.isFinite(closeMs)
    ? new Date(closeMs).toISOString()
    : new Date(nowMs + options.timeLeftHours * 60 * 60 * 1000).toISOString();

  return (
    addDaysIso(baseIso, 31) ??
    new Date(nowMs + (options.timeLeftHours * 60 * 60 + 31 * DAY_MS)).toISOString()
  );
}

export function expectedPollCloseMs(options: {
  targetClosesAt?: string;
  reviewHours: number;
  defaultPollDays: number;
  nowMs: number;
}): number {
  const explicitCloseMs = options.targetClosesAt ? Date.parse(options.targetClosesAt) : Number.NaN;
  if (Number.isFinite(explicitCloseMs)) return explicitCloseMs;
  return options.nowMs + (options.reviewHours * 60 * 60 * 1000) + options.defaultPollDays * DAY_MS;
}

export function resolutionDeadlineFollowsPollClose(options: {
  resolutionDeadline: string;
  targetClosesAt?: string;
  reviewHours: number;
  defaultPollDays: number;
  nowMs: number;
}): boolean {
  const resolutionMs = Date.parse(options.resolutionDeadline);
  if (!Number.isFinite(resolutionMs)) return false;
  return resolutionMs > expectedPollCloseMs(options);
}
