"use client";

import { useRef, useState } from "react";
import {
  AlignJustify,
  Check,
  List,
  Monitor,
  Moon,
  RotateCcw,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PREFERENCES,
  PREFS_COOKIE,
  PREFS_MAX_AGE,
  type Preferences,
  type ThemePreference,
} from "@/lib/preferences";
import { SITE_KIND_META, siteKinds } from "@/lib/caddy/schema";
import {
  Badge,
  Button,
  Card,
  CardHeader,
} from "@/components/ui/primitives";
import { Field, Select, Toggle } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

const themeOptions: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", description: "Clouds, white cards, dark ink.", icon: Sun },
  { value: "dark", label: "Dark", description: "Low-light slate surfaces.", icon: Moon },
  { value: "system", label: "System", description: "Follow the operating system.", icon: Monitor },
];

const densityOptions = [
  {
    value: "comfortable" as const,
    label: "Comfortable",
    description: "Roomy rows for touch and small screens.",
    icon: AlignJustify,
  },
  {
    value: "compact" as const,
    label: "Compact",
    description: "Fit more sites and upstreams on screen.",
    icon: List,
  },
];

export function PreferencesCard({ initial }: { initial: Preferences }) {
  const [preferences, setPreferences] = useState(initial);
  const preferencesRef = useRef(initial);
  const { push } = useToast();

  function apply(next: Preferences) {
    preferencesRef.current = next;
    setPreferences(next);

    const root = document.documentElement;
    root.classList.toggle("dark", next.theme === "dark");
    root.dataset.theme = next.theme;
    root.dataset.density = next.density;

    document.cookie = `${PREFS_COOKIE}=${encodeURIComponent(
      JSON.stringify(next),
    )}; Path=/; Max-Age=${PREFS_MAX_AGE}; SameSite=Lax`;
  }

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    apply({ ...preferencesRef.current, [key]: value });
  }

  function reset() {
    apply({ ...DEFAULT_PREFERENCES });
    push({ tone: "success", title: "Preferences reset to defaults" });
  }

  return (
    <Card>
      <CardHeader
        title="Preferences"
        description="Appearance and defaults are saved in a cookie in this browser."
        action={
          <Badge tone="muted">
            {preferences.theme === "system" ? "System theme" : `${preferences.theme} theme`}
          </Badge>
        }
      />

      <div className="space-y-5 p-4">
        <div>
          <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">
            Appearance
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const selected = preferences.theme === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("theme", option.value)}
                  aria-pressed={selected}
                  className={cn(
                    "flex items-start gap-3 rounded-[3px] border p-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-line hover:border-line-strong hover:bg-cloud/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px]",
                      selected ? "bg-primary text-white" : "bg-cloud text-ink-soft",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
                      {option.label}
                      {selected ? (
                        <Check className="h-3.5 w-3.5 text-primary-ink" aria-hidden />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">
            Table density
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {densityOptions.map((option) => {
              const Icon = option.icon;
              const selected = preferences.density === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("density", option.value)}
                  aria-pressed={selected}
                  className={cn(
                    "flex items-start gap-3 rounded-[3px] border p-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-line hover:border-line-strong hover:bg-cloud/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px]",
                      selected ? "bg-primary text-white" : "bg-cloud text-ink-soft",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
                      {option.label}
                      {selected ? (
                        <Check className="h-3.5 w-3.5 text-primary-ink" aria-hidden />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <p className="mb-3 text-xs font-bold tracking-wide text-ink-soft uppercase">
            New site defaults
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Site type"
              htmlFor="defaultKind"
              hint="Preselected when you open the site builder."
            >
              <Select
                id="defaultKind"
                value={preferences.defaultKind}
                onChange={(event) =>
                  update("defaultKind", event.target.value as Preferences["defaultKind"])
                }
              >
                {siteKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {SITE_KIND_META[kind].label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="TLS mode"
              htmlFor="defaultTls"
              hint="Automatic for public domains, internal CA for LAN names."
            >
              <Select
                id="defaultTls"
                value={preferences.defaultTls}
                onChange={(event) =>
                  update("defaultTls", event.target.value as Preferences["defaultTls"])
                }
              >
                <option value="auto">Automatic HTTPS</option>
                <option value="internal">Internal CA</option>
              </Select>
            </Field>
          </div>

          <div className="mt-4">
            <Toggle
              checked={preferences.defaultEncode}
              onChange={(next) => update("defaultEncode", next)}
              label="Compression by default"
              description="Pre-enable gzip and zstd for new sites."
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs leading-relaxed text-muted">
              Preferences apply instantly and persist for one year.
            </p>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset preferences
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
