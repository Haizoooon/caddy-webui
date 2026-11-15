export const roles = ["admin", "editor", "viewer"] as const;

export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (roles as readonly string[]).includes(value);
}

export function isAdmin(role: Role | undefined | null): boolean {
  return role === "admin";
}

export function canEditSites(role: Role | undefined | null): boolean {
  return role === "admin" || role === "editor";
}

export function canViewRawConfig(role: Role | undefined | null): boolean {
  return role === "admin";
}
