import { NextResponse } from "next/server";
import { ApiError, CaddyError } from "./caddy/errors";
import type { CaddyWarning } from "./caddy/types";

export function ok<T extends Record<string, unknown>>(data: T = {} as T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function fail(
  error: string,
  status = 400,
  extra: { issues?: Record<string, string>; warnings?: CaddyWarning[] } = {},
) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.message, error.status, {
      issues: error.issues,
      warnings: error.warnings,
    });
  }

  if (error instanceof CaddyError) {
    const status = error.status >= 400 && error.status <= 599 ? error.status : 502;
    return fail(error.message, status, { warnings: error.warnings });
  }

  console.error("[caddyweb]", error);
  return fail("Unexpected server error.", 500);
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "local";
}
