import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ProfileForm from "./ProfileForm";
import { ArrowLeftIcon } from "../components/ui";

export const metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="max-w-lg mx-auto px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-8"
      >
        <ArrowLeftIcon />
        Back to Care Coordinator
      </Link>

      <ProfileForm
        userId={user.id}
        userEmail={user.email ?? ""}
        initialProfile={profile}
      />
    </main>
  );
}
