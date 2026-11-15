import type { Metadata } from "next";
import { requirePageRole } from "@/lib/guards";
import { UsersView } from "@/components/users/users-view";

export const metadata: Metadata = { title: "Users & API tokens" };

export default async function UsersPage() {
  const user = await requirePageRole(["admin"]);
  return <UsersView currentUserId={user.userId} />;
}
