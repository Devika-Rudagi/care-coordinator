"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui";

const supabase = createClient();

export default function SignOutButton({
  variant = "button",
}: {
  variant?: "button" | "menu-item";
}) {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (variant === "menu-item") {
    return (
      <button
        onClick={handleSignOut}
        className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Sign out
      </button>
    );
  }

  return (
    <Button variant="secondary" size="md" onClick={handleSignOut}>
      Sign out
    </Button>
  );
}
