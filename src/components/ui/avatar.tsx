import { cn } from "@/lib/utils";

export function Avatar({
  avatar,
  name,
  username,
  size = 36,
  className,
}: {
  avatar?: string | null;
  name?: string | null;
  username?: string;
  size?: number;
  className?: string;
}) {
  const label = (name || username || "?").trim();
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full border border-line object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
    >
      {initials || "?"}
    </span>
  );
}
