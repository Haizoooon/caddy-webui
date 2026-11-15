import { getConfig, getUpstreams, publicAdminUrl } from "./caddy/admin";
import { getSetting, setSetting } from "./db";
import { sendNotificationEmails } from "./mailer";
import {
  getNotificationSettings,
  notificationRecipientEmails,
  type NotificationSettings,
} from "./notifications-settings";

interface MonitorState {
  caddy: "up" | "down";
  upstreams: Record<string, "up" | "down">;
  checkedAt: string | null;
}

export interface HealthCheckResult {
  ok: boolean;
  skipped?: "disabled" | "interval" | "running";
  caddyUp: boolean;
  upstreams: { address: string; healthy: boolean; fails: number }[];
  recipients: number;
  notificationsSent: number;
  checkedAt: string | null;
}

let running = false;

async function readState(): Promise<MonitorState> {
  try {
    const raw = await getSetting("monitor:state");
    if (raw) return JSON.parse(raw) as MonitorState;
  } catch {
    // ignore malformed state
  }

  return { caddy: "up", upstreams: {}, checkedAt: null };
}

async function writeState(state: MonitorState): Promise<void> {
  try {
    await setSetting("monitor:state", JSON.stringify(state));
    await setSetting("monitor:lastCheck", state.checkedAt ?? new Date().toISOString());
  } catch {
    // The database may not be configured yet.
  }
}

async function notify(
  settings: NotificationSettings,
  recipients: string[],
  subject: string,
  lines: string[],
): Promise<number> {
  if (!settings.enabled || recipients.length === 0) return 0;
  return sendNotificationEmails(recipients, subject, lines.join("\n"));
}

export async function runHealthCheck(options: { force?: boolean } = {}): Promise<HealthCheckResult> {
  if (running) {
    return {
      ok: false,
      skipped: "running",
      caddyUp: false,
      upstreams: [],
      recipients: 0,
      notificationsSent: 0,
      checkedAt: null,
    };
  }

  running = true;

  try {
    const settings = await getNotificationSettings();

    if (!options.force && !settings.enabled) {
      return {
        ok: false,
        skipped: "disabled",
        caddyUp: false,
        upstreams: [],
        recipients: 0,
        notificationsSent: 0,
        checkedAt: null,
      };
    }

    if (!options.force) {
      const lastRun = Number((await getSetting("monitor:lastRun")) || 0);
      if (
        Number.isFinite(lastRun) &&
        Date.now() - lastRun < settings.intervalMinutes * 60_000
      ) {
        return {
          ok: false,
          skipped: "interval",
          caddyUp: false,
          upstreams: [],
          recipients: 0,
          notificationsSent: 0,
          checkedAt: null,
        };
      }
    }

    const state = await readState();
    const recipients = settings.enabled ? await notificationRecipientEmails(settings) : [];
    const adminUrl = publicAdminUrl();
    const stamp = new Date().toISOString();
    const upstreamStatus: HealthCheckResult["upstreams"] = [];
    let notificationsSent = 0;
    let caddyUp = true;

    try {
      await getConfig();
    } catch {
      caddyUp = false;
    }

    if (!caddyUp) {
      if (state.caddy !== "down" && settings.events.caddyUnreachable) {
        notificationsSent += await notify(
          settings,
          recipients,
          "[CaddyWeb] Caddy is unreachable",
          [
            `CaddyWeb could not reach the Caddy Admin API at ${adminUrl}.`,
            "Sites may be down or Caddy may have stopped.",
            `Checked at ${stamp}.`,
            "Open the panel for details.",
          ],
        );
      }
      state.caddy = "down";
    } else {
      if (state.caddy === "down" && settings.events.caddyRecovered) {
        notificationsSent += await notify(
          settings,
          recipients,
          "[CaddyWeb] Caddy is reachable again",
          [
            `The Caddy Admin API at ${adminUrl} is responding again.`,
            `Checked at ${stamp}.`,
          ],
        );
      }
      state.caddy = "up";

      try {
        const upstreams = await getUpstreams();
        const nextUpstreams: Record<string, "up" | "down"> = {};

        for (const upstream of upstreams) {
          const healthy = upstream.fails === 0;
          nextUpstreams[upstream.address] = healthy ? "up" : "down";
          upstreamStatus.push({
            address: upstream.address,
            healthy,
            fails: upstream.fails,
          });

          if (!healthy && state.upstreams[upstream.address] !== "down") {
            if (settings.events.upstreamDown) {
              notificationsSent += await notify(
                settings,
                recipients,
                `[CaddyWeb] Upstream unhealthy: ${upstream.address}`,
                [
                  `Upstream ${upstream.address} reports ${upstream.fails} failed request(s).`,
                  `Active requests: ${upstream.num_requests}.`,
                  `Checked at ${stamp}.`,
                ],
              );
            }
          } else if (
            healthy &&
            state.upstreams[upstream.address] === "down" &&
            settings.events.upstreamRecovered
          ) {
            notificationsSent += await notify(
              settings,
              recipients,
              `[CaddyWeb] Upstream recovered: ${upstream.address}`,
              [
                `Upstream ${upstream.address} is healthy again.`,
                `Checked at ${stamp}.`,
              ],
            );
          }
        }

        state.upstreams = nextUpstreams;
      } catch {
        // Caddy is reachable but the upstream endpoint failed; keep old state.
      }
    }

    state.checkedAt = stamp;
    await writeState(state);
    try {
      await setSetting("monitor:lastRun", String(Date.now()));
    } catch {
      // ignore
    }

    return {
      ok: true,
      caddyUp,
      upstreams: upstreamStatus,
      recipients: recipients.length,
      notificationsSent,
      checkedAt: stamp,
    };
  } finally {
    running = false;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __caddywebMonitorStarted: boolean | undefined;
}

export function startMonitor(): void {
  if (globalThis.__caddywebMonitorStarted) return;
  globalThis.__caddywebMonitorStarted = true;

  const tick = () => {
    void runHealthCheck().catch((error) => {
      console.warn("[caddyweb] health monitor failed:", error);
    });
  };

  const initial = setTimeout(tick, 20_000);
  initial.unref?.();

  const interval = setInterval(tick, 60_000);
  interval.unref?.();
}
