import { timingSafeEqual } from "node:crypto";

type CronEnvironment = { [key: string]: string | undefined };

export function getCronSecret(environment: CronEnvironment = process.env): string {
  return environment.CRON_SECRET?.trim() || environment.FV_CRON_SECRET?.trim() || "";
}

export function isAuthorizedCronRequest(request: Request, environment: CronEnvironment = process.env): boolean {
  const secret = getCronSecret(environment);
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
