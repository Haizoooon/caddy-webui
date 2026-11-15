"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  Check,
  Copy,
  KeyRound,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { api, fetcher } from "@/lib/api-client";
import { roleLabels, roles, type Role } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Notice,
  PageHeader,
  Skeleton,
  Spinner,
  StatCard,
  buttonClass,
  type Tone,
} from "@/components/ui/primitives";
import { Field, Input, Select, Toggle } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/avatar";

interface AdminUser {
  id: number;
  username: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  emailNotifications: boolean;
  role: Role;
  active: boolean;
  authSource: "password" | "oidc" | "both" | "none";
  createdAt: string;
  lastLoginAt: string | null;
}

interface ApiToken {
  id: number;
  name: string;
  prefix: string;
  userId: number;
  username: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

const roleTone: Record<Role, Tone> = {
  admin: "purple",
  editor: "info",
  viewer: "muted",
};

export function UsersView({ currentUserId }: { currentUserId?: number }) {
  const { push } = useToast();
  const users = useSWR<{ ok: true; users: AdminUser[] }>("/api/admin/users", fetcher);
  const tokens = useSWR<{ ok: true; tokens: ApiToken[] }>("/api/admin/tokens", fetcher);

  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [revoking, setRevoking] = useState<ApiToken | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [copied, setCopied] = useState(false);

  const [tokenUserId, setTokenUserId] = useState("");
  const [tokenName, setTokenName] = useState("Automation");
  const [tokenExpiry, setTokenExpiry] = useState("0");
  const [tokenBusy, setTokenBusy] = useState(false);

  const userList = users.data?.users ?? [];
  const tokenList = tokens.data?.tokens ?? [];

  const stats = useMemo(
    () => ({
      admins: userList.filter((user) => user.role === "admin" && user.active).length,
      editors: userList.filter((user) => user.role === "editor" && user.active).length,
      viewers: userList.filter((user) => user.role === "viewer" && user.active).length,
    }),
    [userList],
  );

  async function deleteUser() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/admin/users/${deleting.id}`, { method: "DELETE" });
      await users.mutate();
      push({ tone: "success", title: "User deleted", description: deleting.username });
      setDeleting(null);
    } catch (caught) {
      push({
        tone: "danger",
        title: "Could not delete user",
        description: caught instanceof Error ? caught.message : "Unknown error",
      });
    } finally {
      setDeleteBusy(false);
    }
  }

  async function createToken() {
    if (!tokenUserId) {
      push({ tone: "danger", title: "Select a user first" });
      return;
    }

    setTokenBusy(true);
    try {
      const result = await api<{ ok: true; token: string; record: ApiToken }>(
        "/api/admin/tokens",
        {
          method: "POST",
          body: JSON.stringify({
            userId: Number(tokenUserId),
            name: tokenName,
            expiresInDays: Number(tokenExpiry),
          }),
        },
      );
      setNewToken(result.token);
      setCopied(false);
      setTokenName("Automation");
      await tokens.mutate();
      push({ tone: "success", title: "API token created" });
    } catch (caught) {
      push({
        tone: "danger",
        title: "Could not create token",
        description: caught instanceof Error ? caught.message : "Unknown error",
      });
    } finally {
      setTokenBusy(false);
    }
  }

  async function revokeToken() {
    if (!revoking) return;
    setRevokeBusy(true);
    try {
      await api(`/api/admin/tokens?id=${revoking.id}`, { method: "DELETE" });
      await tokens.mutate();
      push({ tone: "success", title: "Token revoked", description: revoking.prefix });
      setRevoking(null);
    } catch (caught) {
      push({
        tone: "danger",
        title: "Could not revoke token",
        description: caught instanceof Error ? caught.message : "Unknown error",
      });
    } finally {
      setRevokeBusy(false);
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
      push({ tone: "success", title: "Token copied" });
    } catch {
      push({ tone: "danger", title: "Copy failed" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Users & API tokens"
        description="Manage accounts, roles and bearer tokens for the subdomain API."
        actions={
          <Button onClick={() => setEditing("new")}>
            <UserPlus className="h-4 w-4" aria-hidden />
            New user
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Admins"
          value={stats.admins}
          hint="Full access"
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          tone="purple"
        />
        <StatCard
          label="Editors"
          value={stats.editors}
          hint="Manage sites"
          icon={<UsersIcon className="h-4 w-4" aria-hidden />}
          tone="info"
        />
        <StatCard
          label="Viewers"
          value={stats.viewers}
          hint="Read only"
          icon={<UsersIcon className="h-4 w-4" aria-hidden />}
          tone="muted"
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Accounts"
          description="Local passwords and OAuth logins both map to these roles."
          action={
            <Badge tone="muted">{userList.length} user{userList.length === 1 ? "" : "s"}</Badge>
          }
        />

        {users.isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        ) : users.error ? (
          <div className="p-4">
            <Notice tone="danger" title="Could not load users">
              {users.error instanceof Error ? users.error.message : "Unknown error"}
            </Notice>
          </div>
        ) : userList.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="h-5 w-5" aria-hidden />}
            title="No users yet"
            description="The environment admin still works. Create database users to assign roles."
            action={<Button onClick={() => setEditing("new")}>Create a user</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-cloud/50 text-[10px] font-bold tracking-[0.1em] text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-bold">User</th>
                  <th className="px-3 py-2.5 font-bold">Role</th>
                  <th className="px-3 py-2.5 font-bold">Login</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-3 py-2.5 font-bold">Last login</th>
                  <th className="px-4 py-2.5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {userList.map((user) => (
                  <tr key={user.id} className="hover:bg-cloud/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          avatar={user.avatar}
                          name={user.name}
                          username={user.username}
                          size={32}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {user.name || user.username}
                            {user.id === currentUserId ? (
                              <span className="ml-2 text-[10px] font-bold text-muted uppercase">
                                you
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted">
                            @{user.username}
                            {user.email ? ` · ${user.email}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={roleTone[user.role]}>{roleLabels[user.role]}</Badge>
                    </td>
                    <td className="px-3 py-3 text-xs text-ink-soft">
                      {user.authSource === "both"
                        ? "Password + OAuth"
                        : user.authSource === "oidc"
                          ? "OAuth"
                          : "Password"}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={user.active ? "success" : "warning"}>
                        {user.active ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(user)}
                          className={buttonClass("outline", "sm")}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(user)}
                          className="rounded-[3px] border border-transparent p-2 text-muted hover:border-danger/30 hover:bg-danger/10 hover:text-danger-ink"
                          aria-label={`Delete ${user.username}`}
                          disabled={user.id === currentUserId}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="API tokens"
          description="Bearer tokens for POST /api/v1/subdomains. A token inherits its user's role."
          action={<Badge tone="info">{tokenList.length} active</Badge>}
        />

        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_1fr_140px_auto] sm:items-end">
          <Field label="User" htmlFor="tokenUser">
            <Select
              id="tokenUser"
              value={tokenUserId}
              onChange={(event) => setTokenUserId(event.target.value)}
            >
              <option value="">Select a user…</option>
              {userList
                .filter((user) => user.active)
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({roleLabels[user.role]})
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="Name" htmlFor="tokenName">
            <Input
              id="tokenName"
              value={tokenName}
              onChange={(event) => setTokenName(event.target.value)}
              placeholder="CI deploy"
            />
          </Field>

          <Field label="Expiry" htmlFor="tokenExpiry">
            <Select
              id="tokenExpiry"
              value={tokenExpiry}
              onChange={(event) => setTokenExpiry(event.target.value)}
            >
              <option value="0">Never</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
            </Select>
          </Field>

          <Button onClick={createToken} disabled={tokenBusy || !tokenUserId}>
            {tokenBusy ? <Spinner /> : <KeyRound className="h-4 w-4" aria-hidden />}
            Create
          </Button>
        </div>

        {newToken ? (
          <div className="border-b border-line bg-success/5 p-4">
            <p className="text-sm font-semibold text-ink">
              Copy this token now — it is shown only once.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-[3px] border border-success/30 bg-surface px-3 py-2 font-mono text-xs text-ink">
                {newToken}
              </code>
              <Button variant="outline" size="sm" onClick={copyToken}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setNewToken("")}>
                <X className="h-3.5 w-3.5" />
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}

        {tokens.isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1].map((row) => (
              <Skeleton key={row} className="h-9 w-full" />
            ))}
          </div>
        ) : tokenList.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="h-5 w-5" aria-hidden />}
            title="No API tokens"
            description="Create a token to add subdomains from CI, scripts or another service."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-cloud/50 text-[10px] font-bold tracking-[0.1em] text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Name</th>
                  <th className="px-3 py-2.5 font-bold">User</th>
                  <th className="px-3 py-2.5 font-bold">Prefix</th>
                  <th className="px-3 py-2.5 font-bold">Last used</th>
                  <th className="px-3 py-2.5 font-bold">Expires</th>
                  <th className="px-4 py-2.5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tokenList.map((token) => (
                  <tr key={token.id} className="hover:bg-cloud/30">
                    <td className="px-4 py-3 font-semibold text-ink">{token.name}</td>
                    <td className="px-3 py-3 text-xs text-ink-soft">{token.username}</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted">
                      {token.prefix}…
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">
                      {token.lastUsedAt ? formatDateTime(token.lastUsedAt) : "Never"}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">
                      {token.expiresAt ? formatDateTime(token.expiresAt) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setRevoking(token)}
                        className="rounded-[3px] border border-transparent p-2 text-muted hover:border-danger/30 hover:bg-danger/10 hover:text-danger-ink"
                        aria-label={`Revoke ${token.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing ? (
        <UserEditor
          user={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void users.mutate();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this user?"
        description={
          deleting
            ? `${deleting.username} will lose access immediately. Their API tokens are revoked with the account.`
            : undefined
        }
        confirmLabel="Delete user"
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={deleteUser}
      />

      <ConfirmDialog
        open={Boolean(revoking)}
        title="Revoke this token?"
        description={
          revoking
            ? `${revoking.name} (${revoking.prefix}…) will stop working immediately.`
            : undefined
        }
        confirmLabel="Revoke token"
        busy={revokeBusy}
        onCancel={() => setRevoking(null)}
        onConfirm={revokeToken}
      />
    </div>
  );
}

function UserEditor({
  user,
  onClose,
  onSaved,
}: {
  user?: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const isEdit = Boolean(user);
  const [username, setUsername] = useState(user?.username ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "viewer");
  const [active, setActive] = useState(user?.active ?? true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api(isEdit ? `/api/admin/users/${user!.id}` : "/api/admin/users", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify({
          username,
          name,
          email: email || undefined,
          password: password || undefined,
          role,
          active,
        }),
      });

      push({
        tone: "success",
        title: isEdit ? "User updated" : "User created",
        description: username,
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative w-full max-w-lg rounded-[3px] border border-line bg-surface"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-ink">
              {isEdit ? "Edit user" : "New user"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Roles control what this account can do in CaddyWeb.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[2px] p-1.5 text-muted hover:bg-cloud hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username" htmlFor="userUsername">
              <Input
                id="userUsername"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </Field>

            <Field label="Role" htmlFor="userRole">
              <Select
                id="userRole"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
              >
                {roles.map((entry) => (
                  <option key={entry} value={entry}>
                    {roleLabels[entry]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Email" htmlFor="userEmail" optional hint="Used to link OAuth accounts and send alerts.">
            <Input
              id="userEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field label="Display name" htmlFor="userDisplayName" optional>
            <Input
              id="userDisplayName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Alice Example"
              autoComplete="off"
            />
          </Field>

          <Field
            label={isEdit ? "New password" : "Password"}
            htmlFor="userPassword"
            optional={isEdit}
            hint={isEdit ? "Leave blank to keep the current password." : "At least 8 characters."}
          >
            <Input
              id="userPassword"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required={!isEdit}
              minLength={8}
              placeholder={isEdit ? "••••••••" : "Password"}
            />
          </Field>

          {isEdit ? (
            <div className="border-t border-line pt-4">
              <Toggle
                checked={active}
                onChange={setActive}
                label="Account active"
                description="Disabled accounts cannot sign in and their API tokens stop working."
              />
            </div>
          ) : null}

          {error ? (
            <Notice tone="danger" title="Could not save">
              {error}
            </Notice>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner /> : <UserPlus className="h-4 w-4" aria-hidden />}
            {isEdit ? "Save changes" : "Create user"}
          </Button>
        </div>
      </form>
    </div>
  );
}
