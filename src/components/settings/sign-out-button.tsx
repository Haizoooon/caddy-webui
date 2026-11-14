"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button, Spinner } from "@/components/ui/primitives";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={signOut} disabled={busy}>
      {busy ? <Spinner /> : <LogOut className="h-4 w-4" aria-hidden />}
      Sign out
    </Button>
  );
}
