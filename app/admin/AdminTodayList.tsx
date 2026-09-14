"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "../components/ui";

const supabase = createClient();

type TaskRow = {
  id: string;
  patient_name: string;
  title: string;
  scheduled_for: string;
  caregivers: string;
};

export default function AdminTodayList({
  initialTasks,
}: {
  initialTasks: TaskRow[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [dismissing, setDismissing] = useState<string | null>(null);

  async function dismiss(taskId: string) {
    setDismissing(taskId);
    const { error } = await supabase
      .from("task_instances")
      .update({ status: "skipped" })
      .eq("id", taskId);
    setDismissing(null);
    if (!error) setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  if (tasks.length === 0) {
    return (
      <div className="p-5 text-sm text-slate-400 text-center border border-dashed border-slate-200 rounded-2xl">
        Nothing else due today.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div
          key={t.id}
          className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3"
        >
          <Avatar name={t.patient_name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-slate-900 text-sm">
              {t.title}
              <span className="text-slate-400 font-normal"> — {t.patient_name}</span>
            </div>
            <div className="text-xs text-slate-400">
              Responsible: {t.caregivers}
            </div>
          </div>
          <span className="text-xs text-slate-400">
            {new Date(t.scheduled_for).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
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
  );
}
