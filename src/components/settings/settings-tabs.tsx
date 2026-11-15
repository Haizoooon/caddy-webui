import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SettingsTabItem<T extends string> {
  key: T;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export function SettingsTabs<T extends string>({
  tabs,
  active,
}: {
  tabs: SettingsTabItem<T>[];
  active: T;
}) {
  return (
    <nav
      aria-label="Settings sections"
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;

        return (
          <Link
            key={tab.key}
            href={`/settings?tab=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-t-[3px] border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
              isActive
                ? "border-primary bg-primary/5 text-primary-ink"
                : "border-transparent text-muted hover:bg-cloud hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
