import {
  Braces,
  ExternalLink,
  FileWarning,
  FolderOpen,
  HardDrive,
  Waypoints,
} from "lucide-react";
import type { SiteKind } from "@/lib/caddy/schema";
import { cn } from "@/lib/utils";

const icons = {
  reverse_proxy: Waypoints,
  file_server: FolderOpen,
  filemanager: HardDrive,
  redirect: ExternalLink,
  respond: FileWarning,
  custom: Braces,
} satisfies Record<SiteKind, React.ComponentType<{ className?: string }>>;

export function KindIcon({ kind, className }: { kind: SiteKind; className?: string }) {
  const Icon = icons[kind];
  return <Icon className={cn("h-4 w-4", className)} aria-hidden />;
}
