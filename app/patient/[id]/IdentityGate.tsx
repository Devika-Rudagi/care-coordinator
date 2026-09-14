"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card } from "../../components/ui";
import TaskDashboard from "./TaskDashboard";

export type Member = {
  id: string;
  name: string;
  role: string;
  user_id: string | null;
  invited_email?: string | null;
};

const supabase = createClient();

const roleLabel: Record<string, string> = {
  primary: "Primary caregiver",
  secondary: "Secondary caregiver",
};

export default function IdentityGate({
  patientId,
  patientName,
  userId,
  userEmail,
  initialMembership,
  initialPendingInvite,
  initialTasks,
  initialWatchItems,
  initialCareTeam,
}: {
  patientId: string;
  patientName: string;
  userId: string;
  userEmail: string;
  initialMembership: Member | null;
  initialPendingInvite: Member | null;
  initialTasks: any[];
  initialWatchItems: any[];
  initialCareTeam: Member[];
}) {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(initialMembership);
  const [pendingInvite] = useState<Member | null>(initialPendingInvite);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");

  async function handleAcceptInvite() {
    if (!pendingInvite) return;
    setAccepting(true);
    setAcceptError("");
    const { data: updated, error } = await supabase
      .from("care_circle_members")
      .update({ user_id: userId })
      .eq("id", pendingInvite.id)
      .select()
      .single();
    setAccepting(false);
    if (error) {
      setAcceptError(error.message);
      return;
    }
    if (updated) {
      setMember(updated);
      router.refresh();
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!member) {
    if (pendingInvite) {
      return (
        <Card className="p-6 max-w-sm mx-auto mt-10">
          <h2 className="font-medium text-slate-900 mb-1">
            You've been invited
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            {patientName}'s care circle has invited{" "}
            <strong>{pendingInvite.name}</strong> ({userEmail}) to join as a
            caregiver.
          </p>
          {acceptError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-2.5 mb-3">
              {acceptError}
            </div>
          )}
          <Button
            className="w-full"
            onClick={handleAcceptInvite}
            disabled={accepting}
          >
            {accepting ? "Joining…" : "Accept & join care circle"}
          </Button>
          <button
            onClick={handleSignOut}
            className="w-full text-center text-xs text-slate-400 hover:text-teal-600 mt-3"
          >
            Sign out
          </button>
        </Card>
      );
    }

    return (
      <Card className="p-6 max-w-sm mx-auto mt-10">
        <h2 className="font-medium text-slate-900 mb-1">
          You haven't been invited yet
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          You're signed in as <strong>{userEmail}</strong>, but you're not
          part of {patientName}'s care circle. Ask the patient or an
          existing caregiver to add you from {patientName}'s own page,
          using this email address.
        </p>
        <button
          onClick={handleSignOut}
          className="w-full text-center text-sm text-teal-600 hover:underline"
        >
          Sign out
        </button>
      </Card>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2 mb-4">
        <span className="text-xs text-slate-400">
          Signed in as{" "}
          <span className="font-medium text-slate-600">{member.name}</span>
        </span>
        <Badge tone="teal">{roleLabel[member.role] ?? member.role}</Badge>
        <button
          onClick={handleSignOut}
          className="text-xs text-teal-600 hover:underline"
        >
          Sign out
        </button>
      </div>
      <TaskDashboard
        patientId={patientId}
        patientName={patientName}
        currentMember={member}
        initialTasks={initialTasks}
        initialWatchItems={initialWatchItems}
        initialCareTeam={initialCareTeam}
      />
    </>
  );
}
