import { siteKinds, type SiteKind, type TlsMode } from "./caddy/schema";

export type ThemePreference = "light" | "dark" | "system";
export type DensityPreference = "comfortable" | "compact";

export interface Preferences {
  theme: ThemePreference;
  density: DensityPreference;
  /** Default type preselected on the "New site" page. */
  defaultKind: SiteKind;
  /** Default TLS mode for new sites. */
  defaultTls: TlsMode;
  /** Default compression setting for new sites. */
  defaultEncode: boolean;
}

export const PREFS_COOKIE = "caddyweb_prefs";
export const PREFS_MAX_AGE = 60 * 60 * 24 * 365;

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "light",
  density: "comfortable",
  defaultKind: "reverse_proxy",
  defaultTls: "auto",
  defaultEncode: true,
};

const themes: ThemePreference[] = ["light", "dark", "system"];

export function parsePreferences(raw: string | null | undefined): Preferences {
  if (!raw) return { ...DEFAULT_PREFERENCES };

  let json = raw;
  try {
    json = decodeURIComponent(raw);
  } catch {
    // The value was not URL encoded; use it as-is.
  }

  try {
    const parsed = JSON.parse(json) as Partial<Preferences>;
    return {
      theme: themes.includes(parsed.theme as ThemePreference)
        ? (parsed.theme as ThemePreference)
        : DEFAULT_PREFERENCES.theme,
      density: parsed.density === "compact" ? "compact" : "comfortable",
      defaultKind: siteKinds.includes(parsed.defaultKind as SiteKind)
        ? (parsed.defaultKind as SiteKind)
        : DEFAULT_PREFERENCES.defaultKind,
      defaultTls: parsed.defaultTls === "internal" ? "internal" : "auto",
      defaultEncode:
        typeof parsed.defaultEncode === "boolean"
          ? parsed.defaultEncode
          : DEFAULT_PREFERENCES.defaultEncode,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function encodePreferences(preferences: Preferences): string {
  return encodeURIComponent(JSON.stringify(preferences));
}
