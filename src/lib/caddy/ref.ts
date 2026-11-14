export interface RouteRef {
  server: string;
  index: number;
  id?: string;
}

export const SITE_ID_PREFIX = "caddyweb_";

export function encodeRef(ref: RouteRef): string {
  return Buffer.from(JSON.stringify(ref), "utf8").toString("base64url");
}

export function decodeRef(value: string): RouteRef | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.server !== "string" || !candidate.server) return null;
    if (!Number.isInteger(candidate.index) || (candidate.index as number) < 0) return null;

    return {
      server: candidate.server,
      index: candidate.index as number,
      id: typeof candidate.id === "string" ? candidate.id : undefined,
    };
  } catch {
    return null;
  }
}

export function managedId(routeId: string | undefined): string | undefined {
  if (!routeId || !routeId.startsWith(SITE_ID_PREFIX)) return undefined;
  return routeId.slice(SITE_ID_PREFIX.length);
}
