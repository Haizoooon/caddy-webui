"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, KeyRound, Save, Trash2, UserRound } from "lucide-react";
import { api } from "@/lib/api-client";
import { roleLabels, type Role } from "@/lib/roles";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CodeBlock,
  Notice,
  PageHeader,
  Spinner,
  buttonClass,
} from "@/components/ui/primitives";
import { Field, Input, Toggle } from "@/components/ui/form";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";

interface ProfileData {
  username: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: Role;
  authSource: "password" | "oidc" | "both" | "none";
  emailNotifications: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  hasPassword: boolean;
}

function authLabel(source: ProfileData["authSource"]): string {
  if (source === "both") return "Password + OAuth";
  if (source === "oidc") return "OAuth / SSO";
  if (source === "password") return "Password";
  return "No login method";
}

async function imageToAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  bitmap.close?.();

  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ProfileView({ initial }: { initial: ProfileData }) {
  const router = useRouter();
  const { push } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(initial.name ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [avatar, setAvatar] = useState(initial.avatar ?? "");
  const [emailNotifications, setEmailNotifications] = useState(
    initial.emailNotifications,
  );
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  async function pickAvatar(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      push({ tone: "danger", title: "Use a PNG, JPEG or WebP image" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      push({ tone: "danger", title: "Image must be smaller than 5 MB" });
      return;
    }

    try {
      setAvatar(await imageToAvatar(file));
    } catch {
      push({ tone: "danger", title: "Could not read the image" });
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await api("/api/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          email,
          avatar,
          emailNotifications,
        }),
      });
      push({ tone: "success", title: "Profile saved" });
      router.refresh();
    } catch (error) {
      push({
        tone: "danger",
        title: "Could not save the profile",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      push({ tone: "danger", title: "Passwords do not match" });
      return;
    }

    setPasswordBusy(true);
    try {
      await api("/api/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      push({ tone: "success", title: "Password updated" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      push({
        tone: "danger",
        title: "Could not update the password",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Your display name, avatar, contact email and notification preferences."
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Account"
              description="This information is shown in the sidebar and in audit entries."
            />
            <div className="space-y-5 p-4">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar
                  avatar={avatar}
                  name={name}
                  username={initial.username}
                  size={80}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className={buttonClass("outline", "sm")}>
                    <Camera className="h-3.5 w-3.5" aria-hidden />
                    Upload avatar
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => void pickAvatar(event.target.files?.[0])}
                    />
                  </label>
                  {avatar ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAvatar("");
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Display name"
                  htmlFor="profileName"
                  hint="Shown in the interface. Username stays unchanged."
                >
                  <Input
                    id="profileName"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={initial.username}
                  />
                </Field>

                <Field
                  label="Email"
                  htmlFor="profileEmail"
                  hint="Used for health alerts when notifications are enabled."
                >
                  <Input
                    id="profileEmail"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </Field>
              </div>

              <div className="border-t border-line pt-4">
                <Toggle
                  checked={emailNotifications}
                  onChange={setEmailNotifications}
                  label="Email notifications"
                  description="Receive alerts about Caddy and upstream health. Requires an email above."
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={saving}>
                  {saving ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />}
                  Save profile
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Password"
              description={
                initial.hasPassword
                  ? "Change the password used for local login."
                  : "Add a local password. OAuth sign-in keeps working."
              }
              action={<KeyRound className="h-4 w-4 text-muted" aria-hidden />}
            />
            <form onSubmit={changePassword} className="space-y-4 p-4">
              {initial.hasPassword ? (
                <Field label="Current password" htmlFor="currentPassword">
                  <Input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </Field>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password" htmlFor="newPassword" hint="At least 8 characters.">
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Confirm password" htmlFor="confirmPassword">
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </Field>
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="outline" disabled={passwordBusy}>
                  {passwordBusy ? <Spinner /> : <KeyRound className="h-4 w-4" aria-hidden />}
                  Update password
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Identity" />
            <div className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Username
                </span>
                <span className="font-mono text-xs text-ink">{initial.username}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Role
                </span>
                <Badge
                  tone={
                    initial.role === "admin"
                      ? "purple"
                      : initial.role === "editor"
                        ? "info"
                        : "muted"
                  }
                >
                  {roleLabels[initial.role]}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Login
                </span>
                <span className="text-right text-xs text-ink-soft">
                  {authLabel(initial.authSource)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Last login
                </span>
                <span className="text-right text-xs text-ink-soft">
                  {initial.lastLoginAt ? formatDateTime(initial.lastLoginAt) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Member since
                </span>
                <span className="text-right text-xs text-ink-soft">
                  {formatDate(initial.createdAt)}
                </span>
              </div>
            </div>
            <div className="border-t border-line px-4 py-3">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Usernames and roles are managed by an administrator. You can change your
                display name, email, avatar and password here.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Email alerts" description="How notification emails are chosen." />
            <div className="p-4">
              <Notice tone="info" title="Opt in with your email">
                Add an email above and keep notifications enabled. Administrators configure
                SMTP and which events trigger alerts in Settings.
              </Notice>
              <CodeBlock className="mt-3">{`Events: Caddy unreachable, upstream
unhealthy and upstream recovered.`}</CodeBlock>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
