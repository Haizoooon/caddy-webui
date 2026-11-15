import type { Metadata } from "next";
import { requirePageUser } from "@/lib/guards";
import { getUserById } from "@/lib/users";
import { ProfileView } from "@/components/profile/profile-view";
import { Notice, PageHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await requirePageUser();

  if (!session.userId) {
    return (
      <div>
        <PageHeader title="Profile" description="Your account details." />
        <Notice tone="warning" title="Profile requires the database">
          The environment admin is signed in without a database account. Check{" "}
          <code className="font-mono">CADDYWEB_DATA_DIR</code> and reload.
        </Notice>
      </div>
    );
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return (
      <div>
        <PageHeader title="Profile" description="Your account details." />
        <Notice tone="danger" title="Account not found">
          Your session points to a user that no longer exists. Sign in again.
        </Notice>
      </div>
    );
  }

  return (
    <ProfileView
      initial={{
        username: user.username,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        authSource: user.authSource,
        emailNotifications: user.emailNotifications,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        hasPassword: user.authSource === "password" || user.authSource === "both",
      }}
    />
  );
}
