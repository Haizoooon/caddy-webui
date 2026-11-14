export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function randomId(): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return uuid.replace(/-/g, "").slice(0, 16);
}

export function hostLabel(hosts: string[]): string {
  if (hosts.length === 0) return "All hosts";
  if (hosts.length === 1) return hosts[0];
  return `${hosts[0]} +${hosts.length - 1}`;
}

export function formatRelative(date: Date | number): string {
  const value = typeof date === "number" ? date : date.getTime();
  const diff = Date.now() - value;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return `${Math.floor(diff / 86_400_000)} d ago`;
}
