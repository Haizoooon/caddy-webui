import bcrypt from "bcryptjs";
import { ApiError } from "./errors";
import {
  formatZodError,
  normalizeHost,
  normalizePath,
  normalizeUpstream,
  siteInputSchema,
  type SiteInput,
} from "./schema";
import type { CaddyRoute } from "./types";
import { findAuthHash } from "./handlers";

export async function readSiteInput(request: Request): Promise<SiteInput> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("Invalid request body.", 400);
  }

  const parsed = siteInputSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("Please fix the highlighted fields.", 422, {
      issues: formatZodError(parsed.error),
    });
  }

  const input = parsed.data;
  input.hosts = input.hosts
    .map((host) => normalizeHost(host))
    .filter((host): host is string => Boolean(host));
  input.upstreams = input.upstreams
    .map((upstream) => normalizeUpstream(upstream).value)
    .filter((upstream): upstream is string => Boolean(upstream));
  input.path = normalizePath(input.path);
  input.root = input.root.trim();

  return input;
}

export async function hashSitePassword(input: SiteInput): Promise<string | undefined> {
  if (!input.auth.enabled || !input.auth.password) return undefined;
  return bcrypt.hash(input.auth.password, 10);
}

export function requirePassword(
  input: SiteInput,
  existing?: CaddyRoute,
): string | undefined {
  if (!input.auth.enabled) return undefined;

  if (input.auth.password) return undefined;

  const existingHash = existing ? findAuthHash(existing) : undefined;
  if (existingHash) return existingHash;

  throw new ApiError("A password is required for basic auth.", 422, {
    issues: { "auth.password": "Choose a password for this site." },
  });
}

export function assertValidRouteInput(input: SiteInput): void {
  if (
    (input.kind === "file_server" || input.kind === "filemanager") &&
    input.auth.enabled &&
    !input.auth.username
  ) {
    throw new ApiError("A username is required for basic auth.", 422, {
      issues: { "auth.username": "Choose a username for this site." },
    });
  }
}
