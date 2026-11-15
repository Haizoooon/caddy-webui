import { getSetting, setSetting } from "./db";
import { isRole, roles, type Role } from "./roles";
import { getNotificationRecipients } from "./users";
import { validEmail } from "./mailer";

export interface NotificationEvents {
  caddyUnreachable: boolean;
  caddyRecovered: boolean;
  upstreamDown: boolean;
  upstreamRecovered: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  intervalMinutes: number;
  roles: Role[];
  extraRecipients: string[];
  events: NotificationEvents;
}

const SETTING_KEY = "notifications";

const defaults: NotificationSettings = {
  enabled: false,
  intervalMinutes: 5,
  roles: ["admin"],
  extraRecipients: [],
  events: {
    caddyUnreachable: true,
    caddyRecovered: true,
    upstreamDown: true,
    upstreamRecovered: true,
  },
};

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = getSetting(SETTING_KEY);
    if (!raw) return { ...defaults, events: { ...defaults.events } };

    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    const selectedRoles = Array.isArray(parsed.roles)
      ? parsed.roles.filter(isRole)
      : defaults.roles;

    return {
      enabled: parsed.enabled === true,
      intervalMinutes:
        typeof parsed.intervalMinutes === "number" &&
        parsed.intervalMinutes >= 1 &&
        parsed.intervalMinutes <= 1440
          ? Math.floor(parsed.intervalMinutes)
          : defaults.intervalMinutes,
      roles: selectedRoles.length > 0 ? selectedRoles : defaults.roles,
      extraRecipients: Array.isArray(parsed.extraRecipients)
        ? parsed.extraRecipients.filter(
            (email): email is string => typeof email === "string" && validEmail(email),
          )
        : [],
      events: {
        caddyUnreachable: parsed.events?.caddyUnreachable !== false,
        caddyRecovered: parsed.events?.caddyRecovered !== false,
        upstreamDown: parsed.events?.upstreamDown !== false,
        upstreamRecovered: parsed.events?.upstreamRecovered !== false,
      },
    };
  } catch {
    return { ...defaults, events: { ...defaults.events } };
  }
}

export function saveNotificationSettings(
  settings: NotificationSettings,
): NotificationSettings {
  const normalized: NotificationSettings = {
    enabled: settings.enabled,
    intervalMinutes: Math.min(1440, Math.max(1, Math.floor(settings.intervalMinutes))),
    roles: settings.roles.filter(isRole),
    extraRecipients: Array.from(
      new Set(
        settings.extraRecipients
          .map((email) => email.trim().toLowerCase())
          .filter(validEmail),
      ),
    ),
    events: {
      caddyUnreachable: Boolean(settings.events.caddyUnreachable),
      caddyRecovered: Boolean(settings.events.caddyRecovered),
      upstreamDown: Boolean(settings.events.upstreamDown),
      upstreamRecovered: Boolean(settings.events.upstreamRecovered),
    },
  };

  if (normalized.roles.length === 0) normalized.roles = ["admin"];
  setSetting(SETTING_KEY, JSON.stringify(normalized));
  return normalized;
}

export function notificationRecipientEmails(
  settings: NotificationSettings,
): string[] {
  const fromUsers = getNotificationRecipients(settings.roles).map((user) => user.email);
  return Array.from(
    new Set(
      [...fromUsers, ...settings.extraRecipients]
        .map((email) => email.trim().toLowerCase())
        .filter(validEmail),
    ),
  );
}

export function notificationRoleOptions(): Role[] {
  return [...roles];
}

export function lastHealthCheck(): string | null {
  try {
    return getSetting("monitor:lastCheck");
  } catch {
    return null;
  }
}
