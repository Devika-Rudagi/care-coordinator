"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeftIcon,
  Avatar,
  Badge,
  Button,
  CalendarIcon,
  CheckIcon,
  PillIcon,
} from "../../../components/ui";

type Task = {
  id: string;
  status: string;
  scheduled_for: string;
  task_templates: { title: string; type: string; details: string | null };
};

type CareTeamMember = { id: string; name: string; role: string };

function formatDateLabel(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isOverdue(scheduledFor: string, status: string) {
  return status === "pending" && new Date(scheduledFor) < new Date();
}

function groupByDate(tasks: Task[]) {
  const groups: Record<string, Task[]> = {};
  for (const task of tasks) {
    const key = new Date(task.scheduled_for).toDateString();
    (groups[key] ||= []).push(task);
  }
  return Object.entries(groups).sort(
    ([a], [b]) => new Date(a).getTime() - new Date(b).getTime(),
  );
}

export default function SimplePatientView({
  patientId,
  patientName,
  initialTasks,
  careTeam,
}: {
  patientId: string;
  patientName: string;
  initialTasks: Task[];
  careTeam: CareTeamMember[];
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const tasksRef = useRef<Task[]>(initialTasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  const [team, setTeam] = useState<CareTeamMember[]>(careTeam);
  const [justDone, setJustDone] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showManageTeam, setShowManageTeam] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function removeCaregiver(memberId: string) {
    setRemovingId(memberId);
    const { error } = await supabase
      .from("care_circle_members")
      .delete()
      .eq("id", memberId);
    setRemovingId(null);
    if (!error) {
      setTeam((prev) => prev.filter((m) => m.id !== memberId));
    }
  }

  async function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    const { data: newInvite, error } = await supabase
      .from("care_circle_members")
      .insert({
        patient_id: patientId,
        invited_email: inviteEmail.trim().toLowerCase(),
        name: inviteName.trim(),
        role: "secondary",
      })
      .select()
      .single();
    setInviting(false);
    if (error) {
      setInviteError(
        "Couldn't send that invite. Check the email and try again.",
      );
      return;
    }
    if (newInvite) {
      setTeam((prev) => [...prev, newInvite]);
    }

    // Best-effort: the invite row is already saved regardless of whether
    // this email succeeds, so we don't block success on it — a caregiver
    // can still be found via the "you've been invited" banner on login
    // even if the notification email itself fails to send.
    fetch("/api/send-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toEmail: inviteEmail.trim(),
        inviteeName: inviteName.trim(),
        patientName,
      }),
    }).catch((err) => console.error("Invite email failed to send:", err));

    setInviteSent(true);
    setInviteName("");
    setInviteEmail("");
  }

  useEffect(() => {
    const channel = supabase
      .channel(`simple-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_instances",
          filter: `patient_id=eq.${patientId}`,
        },
        refetch,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  // Ask for notification permission once, so the patient's own device can
  // remind them directly — not just the caregiver's.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, []);

  // Same scheduled-time reminder logic as the caregiver dashboard, worded
  // for the patient directly rather than mentioning them by name.
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      tasksRef.current.forEach((task) => {
        if (!isOverdue(task.scheduled_for, task.status)) return;

        const title = `⏰ Time for ${task.task_templates?.title}`;
        const body = task.task_templates?.details
          ? task.task_templates.details
          : "Tap to mark it done.";

        new Notification(title, { body, tag: task.id });
      });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  async function refetch() {
    const { data } = await supabase
      .from("task_instances")
      .select("*, task_templates(title, type, details)")
      .eq("patient_id", patientId)
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true });
    setTasks(data || []);
  }

  async function markDone(taskId: string) {
    setJustDone(taskId);
    await supabase
      .from("task_instances")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", taskId);
  }

  const grouped = groupByDate(tasks);

  return (
    <main
      className="min-h-screen bg-gradient-to-b from-teal-50 to-white px-6 max-w-md mx-auto"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <Link
        href={`/patient/${patientId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-8"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        Caregiver view
      </Link>

      <h1 className="text-3xl font-semibold text-slate-900 mb-1">
        Hi {patientName.split(" ")[0]} 👋
      </h1>
      <p className="text-slate-500 text-lg mb-6">Here's what's next for you</p>

      {team.length > 0 && (
        <div className="flex items-center gap-2 mb-8 bg-white/70 border border-teal-100 rounded-2xl px-4 py-3">
          <div className="flex -space-x-2">
            {team.slice(0, 4).map((member) => (
              <div key={member.id} className="ring-2 ring-white rounded-full">
                <Avatar name={member.name} size="sm" />
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-500">
            {team.length === 1 ? (
              <>
                <span className="font-medium text-slate-700">
                  {team[0].name}
                </span>{" "}
                is looking after you
              </>
            ) : (
              <>
                <span className="font-medium text-slate-700">
                  {team
                    .slice(0, 2)
                    .map((m) => m.name)
                    .join(" & ")}
                </span>
                {team.length > 2 && ` +${team.length - 2} more`} are
                looking after you
              </>
            )}
          </p>
        </div>
      )}

      {team.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowManageTeam((v) => !v)}
            className="text-xs text-slate-400 hover:text-teal-600 underline"
          >
            {showManageTeam ? "Hide care team" : "Manage care team"}
          </button>
          {showManageTeam && (
            <div className="mt-2 space-y-2">
              {team.map((m) => (
                <div
                  key={m.id}
                  className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 flex items-center gap-3"
                >
                  <Avatar name={m.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      {m.name}
                    </div>
                    <div className="text-xs text-slate-400 capitalize">
                      {m.role}
                    </div>
                  </div>
                  <button
                    onClick={() => removeCaregiver(m.id)}
                    disabled={removingId === m.id}
                    className="text-xs text-rose-500 hover:underline disabled:opacity-40 shrink-0"
                  >
                    {removingId === m.id ? "…" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!showInviteForm && !inviteSent && (
        <button
          onClick={() => setShowInviteForm(true)}
          className="w-full text-center text-sm text-teal-700 font-medium bg-teal-50 hover:bg-teal-100 rounded-2xl py-3 mb-8 transition-colors"
        >
          + Add someone to your care team
        </button>
      )}

      {showInviteForm && !inviteSent && (
        <div className="bg-white border-2 border-teal-100 rounded-2xl p-5 mb-8">
          <h3 className="font-medium text-slate-900 mb-1">
            Add a caregiver
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            They'll be able to see and help manage your checklist once they
            sign in with this email.
          </p>
          <input
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Their name"
            className="w-full text-base border border-slate-200 rounded-xl px-4 py-2.5 mb-3 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            type="email"
            placeholder="Their email"
            className="w-full text-base border border-slate-200 rounded-xl px-4 py-2.5 mb-3 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          {inviteError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-2.5 mb-3">
              {inviteError}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowInviteForm(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleInvite}
              disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}
            >
              {inviting ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </div>
      )}

      {inviteSent && (
        <div className="bg-teal-50 border border-teal-100 rounded-2xl px-4 py-3 mb-8">
          <p className="text-sm text-teal-800">
            Invite sent — they can now sign in to join.
          </p>
          <button
            onClick={() => setInviteSent(false)}
            className="text-sm text-teal-700 font-medium hover:underline mt-2"
          >
            + Add another
          </button>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-2xl font-medium text-slate-700">
            You're all caught up
          </p>
          <p className="text-slate-400 mt-2">Nothing left to do right now</p>
        </div>
      )}

      <div className="space-y-8">
        {grouped.map(([dateKey, group]) => (
          <DayGroup
            key={dateKey}
            dateKey={dateKey}
            group={group}
            onMarkDone={markDone}
            justDone={justDone}
          />
        ))}
      </div>
    </main>
  );
}

function DayGroup({
  dateKey,
  group,
  onMarkDone,
  justDone,
}: {
  dateKey: string;
  group: Task[];
  onMarkDone: (id: string) => void;
  justDone: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...group].sort(
    (a, b) =>
      new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime(),
  );
  const visible = expanded ? sorted : sorted.slice(0, 2);
  const hiddenCount = sorted.length - visible.length;

  return (
    <div>
      <div className="text-sm font-medium text-teal-700 uppercase tracking-wide mb-3">
        {formatDateLabel(sorted[0].scheduled_for)}
      </div>
      <div className="space-y-4">
        {visible.map((task) => {
          const isMedication = task.task_templates?.type === "medication";
          const overdue = isOverdue(task.scheduled_for, task.status);
          return (
            <button
              key={task.id}
              onClick={() => onMarkDone(task.id)}
              className={`w-full text-left border-2 rounded-3xl p-6 bg-white transition-all active:scale-[0.98] ${
                overdue
                  ? "border-rose-300 hover:border-rose-400"
                  : isMedication
                    ? "border-teal-200 hover:border-teal-400"
                    : "border-blue-200 hover:border-blue-400"
              } ${justDone === task.id ? "opacity-40" : ""} shadow-sm`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                    overdue
                      ? "bg-rose-100 text-rose-600"
                      : isMedication
                        ? "bg-teal-100 text-teal-600"
                        : "bg-blue-100 text-blue-600"
                  }`}
                >
                  {isMedication ? (
                    <PillIcon className="w-7 h-7" />
                  ) : (
                    <CalendarIcon className="w-7 h-7" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-2xl font-medium text-slate-900">
                      {task.task_templates?.title}
                    </span>
                    <span className="text-base text-slate-400">
                      {formatTime(task.scheduled_for)}
                    </span>
                    {isOverdue(task.scheduled_for, task.status) && (
                      <Badge tone="rose">Overdue</Badge>
                    )}
                  </div>
                  {task.task_templates?.details && (
                    <div className="text-lg text-slate-500 mt-0.5">
                      {task.task_templates.details}
                    </div>
                  )}
                  <div
                    className={`inline-flex items-center gap-1.5 mt-4 text-lg font-medium ${
                      isMedication ? "text-teal-600" : "text-blue-600"
                    }`}
                  >
                    <CheckIcon className="w-5 h-5" />
                    Tap when done
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {sorted.length > 2 && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full text-center text-teal-700 font-medium mt-3 py-2 hover:bg-teal-50 rounded-xl transition-colors"
        >
          {expanded ? "Show less ▲" : `Show ${hiddenCount} more ▼`}
        </button>
      )}
    </div>
  );
}
