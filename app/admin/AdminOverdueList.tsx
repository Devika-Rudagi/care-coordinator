"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Avatar, Badge, Button } from "../components/ui";

const supabase = createClient();

type TaskRow = {
  id: string;
  patient_id: string;
  patient_name: string;
  title: string;
  scheduled_for: string;
  caregivers: string;
};

const BUCKET_ORDER = ["Just now", "Today", "This week", "Over a week"] as const;

function bucketFor(scheduledFor: string, now: Date) {
  const hours = (now.getTime() - new Date(scheduledFor).getTime()) / 3600000;
  if (hours < 1) return "Just now";
  if (hours < 24) return "Today";
  if (hours < 24 * 7) return "This week";
  return "Over a week";
}

function timeAgo(scheduledFor: string, now: Date) {
  const mins = Math.round((now.getTime() - new Date(scheduledFor).getTime()) / 60000);
  if (mins < 60) return `${mins}m overdue`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h overdue`;
  return `${Math.round(hours / 24)}d overdue`;
}

export default function AdminOverdueList({
  initialTasks,
}: {
  initialTasks: TaskRow[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dismissing, setDismissing] = useState<string | null>(null);
  const now = new Date();

  async function dismiss(taskId: string) {
    setDismissing(taskId);
    const { error } = await supabase
      .from("task_instances")
      .update({ status: "skipped" })
      .eq("id", taskId);
    setDismissing(null);
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  }

  const buckets: Record<string, TaskRow[]> = {
    "Just now": [],
    Today: [],
    "This week": [],
    "Over a week": [],
  };
  for (const t of tasks) {
    buckets[bucketFor(t.scheduled_for, now)].push(t);
  }
  for (const key of BUCKET_ORDER) {
    buckets[key].sort(
      (a, b) =>
        new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime(),
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="p-5 text-sm text-slate-400 text-center border border-dashed border-slate-200 rounded-2xl">
        Nothing overdue anywhere.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {BUCKET_ORDER.map((bucketName) => {
        const items = buckets[bucketName];
        if (items.length === 0) return null;
        const isExpanded = expanded[bucketName] ?? false;
        const visible = isExpanded ? items : items.slice(0, 3);
        const hidden = items.length - visible.length;

        return (
          <div key={bucketName}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                {bucketName}
              </span>
              <Badge tone={bucketName === "Over a week" ? "rose" : "amber"}>
                {items.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {visible.map((t) => (
                <div
                  key={t.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3"
                >
                  <Avatar name={t.patient_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 text-sm">
                      {t.title}
                      <span className="text-slate-400 font-normal">
                        {" "}
                        — {t.patient_name}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Responsible: {t.caregivers}
                    </div>
                  </div>
                  <Badge tone="rose">{timeAgo(t.scheduled_for, now)}</Badge>
                  <button
                    onClick={() => dismiss(t.id)}
                    disabled={dismissing === t.id}
                    className="text-xs text-slate-400 hover:text-teal-600 underline disabled:opacity-40 shrink-0"
                  >
                    {dismissing === t.id ? "…" : "Dismiss"}
                  </button>
                </div>
              ))}
            </div>
            {hidden > 0 && (
              <button
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [bucketName]: true }))
                }
                className="text-xs text-teal-600 hover:underline mt-2"
              >
                Show {hidden} more in this bucket ▼
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
