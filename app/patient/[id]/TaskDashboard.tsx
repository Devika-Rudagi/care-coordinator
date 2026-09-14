"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertIcon,
  Avatar,
  Badge,
  Button,
  CalendarIcon,
  Card,
  CheckIcon,
  PencilIcon,
  PhoneIcon,
  PillIcon,
  TrashIcon,
} from "../../components/ui";
import type { Member } from "./IdentityGate";

const supabase = createClient();

type Task = {
  id: string;
  template_id: string;
  status: string;
  scheduled_for: string;
  completed_by: string | null;
  completed_by_member?: { name: string } | null;
  task_templates: { title: string; type: string; details: string | null; frequency: string | null };
};

type WatchItem = {
  id: string;
  symptom: string;
  guidance: string | null;
  urgency: string;
  status: string;
};

const urgencyTone: Record<string, "rose" | "amber" | "slate"> = {
  high: "rose",
  medium: "amber",
  low: "slate",
};

function isOverdue(scheduledFor: string, status: string) {
  return status === "pending" && new Date(scheduledFor) < new Date();
}

function formatDateLabel(dateStr: string) {
  // scheduled_for is always stored in UTC; converting to a local Date
  // object here and comparing local calendar days is what makes "Today"
  // match what the caregiver actually sees on their own clock.
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string) {
  // No timeZone override — toLocaleTimeString defaults to the browser's
  // local timezone, converting automatically from the stored UTC value.
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupByDate(tasks: Task[]) {
  const groups: Record<string, Task[]> = {};
  for (const task of tasks) {
    // Group by local calendar day (browser's timezone), matching what the
    // person viewing the dashboard actually experiences as "today."
    const key = new Date(task.scheduled_for).toDateString();
    (groups[key] ||= []).push(task);
  }
  return Object.entries(groups).sort(
    ([a], [b]) => new Date(a).getTime() - new Date(b).getTime(),
  );
}

export default function TaskDashboard({
  patientId,
  patientName,
  currentMember,
  initialTasks,
  initialWatchItems,
  initialCareTeam,
}: {
  patientId: string;
  patientName: string;
  currentMember: Member;
  initialTasks: Task[];
  initialWatchItems: WatchItem[];
  initialCareTeam: Member[];
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const tasksRef = useRef<Task[]>(initialTasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Re-sync from fresh server props whenever they change — not just once
  // at mount. This matters specifically right after accepting a pending
  // invite: the dashboard mounts for the first time using whatever data
  // was available BEFORE membership existed (empty arrays), and without
  // this, it would stay stuck empty forever even once the server's
  // router.refresh() delivers the real data moments later.
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const [careTeam, setCareTeam] = useState<Member[]>(initialCareTeam);
  useEffect(() => {
    setCareTeam(initialCareTeam);
  }, [initialCareTeam]);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [watchItems, setWatchItems] = useState<WatchItem[]>(initialWatchItems);
  useEffect(() => {
    setWatchItems(initialWatchItems);
  }, [initialWatchItems]);

  const [editingWatchId, setEditingWatchId] = useState<string | null>(null);
  const [editSymptom, setEditSymptom] = useState("");
  const [editGuidance, setEditGuidance] = useState("");
  const [editUrgency, setEditUrgency] = useState("medium");
  const [savingWatchEdit, setSavingWatchEdit] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel(`patient-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_instances",
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          refetchTasks();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watch_items",
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          refetchWatchItems();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_circle_members",
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          refetchCareTeam();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  // Ask for notification permission once, on first load of the dashboard.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, []);

  // Poll every minute and fire a browser notification once a task's
  // scheduled time has arrived — including the patient's name and the
  // medication's own details, not just its title. Only works while this
  // tab is open — a known, stated limitation (real push would need a
  // service worker).
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      tasksRef.current.forEach((task) => {
        if (!isOverdue(task.scheduled_for, task.status)) return;

        const minutesLate =
          (Date.now() - new Date(task.scheduled_for).getTime()) / 60000;
        const justDue = minutesLate < 10;

        const title = justDue
          ? `⏰ Time for ${task.task_templates?.title}`
          : `⚠️ Overdue: ${task.task_templates?.title}`;

        const bodyParts = [patientName];
        if (task.task_templates?.details) bodyParts.push(task.task_templates.details);
        const body = bodyParts.join(" — ");

        new Notification(title, { body, tag: task.id });
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [patientName]);

  async function refetchTasks() {
    const { data } = await supabase
      .from("task_instances")
      .select(
        "*, task_templates(title, type, details, frequency), completed_by_member:care_circle_members!task_instances_completed_by_fkey(name)",
      )
      .eq("patient_id", patientId)
      .order("scheduled_for", { ascending: true });
    setTasks(data || []);
  }

  async function refetchWatchItems() {
    const { data } = await supabase
      .from("watch_items")
      .select("*")
      .eq("patient_id", patientId)
      .eq("status", "active");
    setWatchItems(data || []);
  }

  async function refetchCareTeam() {
    const { data } = await supabase
      .from("care_circle_members")
      .select("*")
      .eq("patient_id", patientId)
      .neq("role", "patient")
      .order("created_at", { ascending: true });
    setCareTeam(data || []);
  }

  async function removeCaregiver(memberId: string) {
    setRemovingId(memberId);
    const { error } = await supabase
      .from("care_circle_members")
      .delete()
      .eq("id", memberId);
    setRemovingId(null);
    if (!error) {
      setCareTeam((prev) => prev.filter((m) => m.id !== memberId));
    }
  }

  async function updateTaskTemplate(
    templateId: string,
    fields: { title: string; details: string; frequency: string },
  ) {
    const { error } = await supabase
      .from("task_templates")
      .update({
        title: fields.title.trim(),
        details: fields.details.trim() || null,
        frequency: fields.frequency.trim() || null,
      })
      .eq("id", templateId);
    if (error) return false;

    // All instances sharing this template show its title/details — update
    // them immediately rather than waiting on a refetch round-trip.
    setTasks((prev) =>
      prev.map((t) =>
        t.template_id === templateId
          ? {
              ...t,
              task_templates: {
                ...t.task_templates,
                title: fields.title.trim(),
                details: fields.details.trim() || null,
                frequency: fields.frequency.trim() || null,
              },
            }
          : t,
      ),
    );
    return true;
  }

  // Updates just this ONE occurrence's time — not the recurring template's
  // schedule. isoTimestamp is a full UTC ISO string; the local→UTC
  // conversion already happened in the caller (TaskSection), using the
  // browser's own Date object rather than manual offset math.
  async function updateTaskInstanceTime(instanceId: string, isoTimestamp: string) {
    const { error, data } = await supabase
      .from("task_instances")
      .update({ scheduled_for: isoTimestamp })
      .eq("id", instanceId)
      .select();
    if (error) {
      console.error("updateTaskInstanceTime failed:", error.message);
      return false;
    }
    if (!data || data.length === 0) {
      console.error(
        "updateTaskInstanceTime: no rows updated — likely blocked by a database permission rule.",
      );
      return false;
    }
    // Update the on-screen list immediately rather than waiting on a
    // network round-trip refetch — the earlier version relied solely on
    // refetchTasks(), which made the UI briefly (or visibly) show the old
    // time even though the database had already updated correctly.
    setTasks((prev) =>
      prev.map((t) =>
        t.id === instanceId ? { ...t, scheduled_for: isoTimestamp } : t,
      ),
    );
    return true;
  }

  async function toggleDone(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === "done" ? "pending" : "done";
    const { error, data } = await supabase
      .from("task_instances")
      .update({
        status: newStatus,
        completed_at: newStatus === "done" ? new Date().toISOString() : null,
        completed_by: newStatus === "done" ? currentMember.id : null,
      })
      .eq("id", taskId)
      .select();
    if (error) {
      console.error("toggleDone failed:", error.message);
      return;
    }
    if (!data || data.length === 0) {
      console.error(
        "toggleDone: no rows updated — likely blocked by a database permission rule.",
      );
      return;
    }
    // Optimistic local update in case the realtime event is delayed
    refetchTasks();
  }

  async function resolveWatchItem(
    itemId: string,
    resolution: "resolved" | "called_doctor",
  ) {
    await supabase
      .from("watch_items")
      .update({ status: resolution })
      .eq("id", itemId);
  }

  async function updateWatchItem(
    itemId: string,
    fields: { symptom: string; guidance: string; urgency: string },
  ) {
    const { error } = await supabase
      .from("watch_items")
      .update({
        symptom: fields.symptom.trim(),
        guidance: fields.guidance.trim() || null,
        urgency: fields.urgency,
      })
      .eq("id", itemId);
    if (!error) refetchWatchItems();
    return !error;
  }

  const medTasks = tasks.filter((t) => t.task_templates?.type === "medication");
  const apptTasks = tasks.filter(
    (t) => t.task_templates?.type === "appointment",
  );

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const progress = useMemo(
    () => (tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100)),
    [doneCount, tasks.length],
  );

  return (
    <div className="space-y-6">
      {tasks.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">
              Today's progress
            </span>
            <span className="text-sm text-slate-400">
              {doneCount} of {tasks.length} done
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </Card>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
            Care team
          </h2>
          <Badge tone="slate">{careTeam.length}</Badge>
        </div>
        <div className="space-y-2">
          {careTeam.length === 0 && (
            <Card className="p-4 text-sm text-slate-400 text-center border-dashed">
              No other caregivers yet.
            </Card>
          )}
          {careTeam.map((m) => {
            const isPending = !m.user_id;
            const isSelf = m.id === currentMember.id;
            const canRemove =
              currentMember.role === "primary" && !isSelf;

            return (
              <Card key={m.id} className="p-3.5 flex items-center gap-3">
                <Avatar name={m.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900 text-sm">
                      {m.name}
                    </span>
                    <Badge tone={m.role === "primary" ? "teal" : "blue"}>
                      {m.role}
                    </Badge>
                    {isPending && <Badge tone="amber">Pending</Badge>}
                  </div>
                  {isPending && m.invited_email && (
                    <div className="text-xs text-slate-400 mt-0.5">
                      Invited: {m.invited_email}
                    </div>
                  )}
                </div>
                {canRemove && (
                  <button
                    onClick={() => removeCaregiver(m.id)}
                    disabled={removingId === m.id}
                    className="text-slate-300 hover:text-rose-500 p-1.5 disabled:opacity-40"
                    aria-label={`Remove ${m.name}`}
                  >
                    <TrashIcon />
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {watchItems.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
            Watch for
          </h2>
          <div className="space-y-3">
            {watchItems.map((item) => {
              if (editingWatchId === item.id) {
                return (
                  <Card
                    key={item.id}
                    className="p-4 border-amber-300 bg-amber-50/60"
                  >
                    <div className="space-y-2.5">
                      <input
                        value={editSymptom}
                        onChange={(e) => setEditSymptom(e.target.value)}
                        placeholder="Symptom to watch for"
                        className="w-full font-medium bg-transparent border-b border-amber-300 pb-1.5 focus:border-amber-500"
                      />
                      <input
                        value={editGuidance}
                        onChange={(e) => setEditGuidance(e.target.value)}
                        placeholder="What to do (e.g. call doctor)"
                        className="w-full text-sm text-slate-600 bg-transparent border-b border-amber-300 pb-1.5 focus:border-amber-500"
                      />
                      <select
                        value={editUrgency}
                        onChange={(e) => setEditUrgency(e.target.value)}
                        className="text-xs bg-transparent border-b border-amber-300 pb-1 focus:border-amber-500"
                      >
                        <option value="low">Low urgency</option>
                        <option value="medium">Medium urgency</option>
                        <option value="high">High urgency</option>
                      </select>
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingWatchId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={savingWatchEdit || !editSymptom.trim()}
                          onClick={async () => {
                            setSavingWatchEdit(true);
                            const ok = await updateWatchItem(item.id, {
                              symptom: editSymptom,
                              guidance: editGuidance,
                              urgency: editUrgency,
                            });
                            setSavingWatchEdit(false);
                            if (ok) setEditingWatchId(null);
                          }}
                        >
                          {savingWatchEdit ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              }

              return (
                <Card
                  key={item.id}
                  className="p-4 border-amber-200 bg-amber-50/60"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <AlertIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900">
                        {item.symptom}
                      </div>
                      {item.guidance && (
                        <div className="text-sm text-slate-600 mt-0.5">
                          {item.guidance}
                        </div>
                      )}
                      <Badge tone={urgencyTone[item.urgency] ?? "slate"} className="mt-2">
                        {item.urgency} urgency
                      </Badge>
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => resolveWatchItem(item.id, "resolved")}
                        >
                          <CheckIcon className="w-3.5 h-3.5" />
                          Mark resolved
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => resolveWatchItem(item.id, "called_doctor")}
                        >
                          <PhoneIcon className="w-3.5 h-3.5" />
                          Called doctor
                        </Button>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingWatchId(item.id);
                        setEditSymptom(item.symptom);
                        setEditGuidance(item.guidance ?? "");
                        setEditUrgency(item.urgency);
                      }}
                      className="text-slate-300 hover:text-teal-600 p-1.5 shrink-0"
                      aria-label={`Edit ${item.symptom}`}
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <TaskSection
        title="Medications"
        icon={<PillIcon className="w-4 h-4" />}
        tasks={medTasks}
        emptyLabel="No medications yet."
        onToggle={toggleDone}
        onUpdateTemplate={updateTaskTemplate}
        onUpdateTime={updateTaskInstanceTime}
        iconTone="teal"
      />

      <TaskSection
        title="Follow-ups"
        icon={<CalendarIcon className="w-4 h-4" />}
        tasks={apptTasks}
        emptyLabel="No follow-ups yet."
        onToggle={toggleDone}
        onUpdateTemplate={updateTaskTemplate}
        onUpdateTime={updateTaskInstanceTime}
        iconTone="blue"
      />
    </div>
  );
}

function TaskSection({
  title,
  icon,
  tasks,
  emptyLabel,
  onToggle,
  onUpdateTemplate,
  onUpdateTime,
  iconTone,
}: {
  title: string;
  icon: ReactNode;
  tasks: Task[];
  emptyLabel: string;
  onToggle: (id: string, status: string) => void;
  onUpdateTemplate: (
    templateId: string,
    fields: { title: string; details: string; frequency: string },
  ) => Promise<boolean>;
  onUpdateTime: (instanceId: string, isoTimestamp: string) => Promise<boolean>;
  iconTone: "teal" | "blue";
}) {
  const toneClasses =
    iconTone === "teal" ? "bg-teal-50 text-teal-600" : "bg-blue-50 text-blue-600";
  const grouped = groupByDate(tasks);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Tracks which specific card (instance) was clicked — not which template
  // it belongs to. Two instances (e.g. metformin's 8am and 8pm doses) share
  // one template, but only the card actually clicked should turn into a
  // form; saving still updates the shared template underneath.
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [editFrequency, setEditFrequency] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDate, setEditDate] = useState(""); // "YYYY-MM-DD", local — now editable
  const [savingEdit, setSavingEdit] = useState(false);

  function startEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditTemplateId(task.template_id);
    setEditTitle(task.task_templates?.title ?? "");
    setEditDetails(task.task_templates?.details ?? "");
    setEditFrequency(task.task_templates?.frequency ?? "");

    // Populate both date and time from the browser's own local timezone —
    // these getters already convert automatically from the stored UTC value.
    const original = new Date(task.scheduled_for);
    const yyyy = original.getFullYear();
    const mm = String(original.getMonth() + 1).padStart(2, "0");
    const dd = String(original.getDate()).padStart(2, "0");
    setEditDate(`${yyyy}-${mm}-${dd}`);
    const hh = String(original.getHours()).padStart(2, "0");
    const min = String(original.getMinutes()).padStart(2, "0");
    setEditTime(`${hh}:${min}`);
  }

  async function saveEdit() {
    if (!editTemplateId || !editingTaskId) return;
    setSavingEdit(true);

    const templateOk = await onUpdateTemplate(editTemplateId, {
      title: editTitle,
      details: editDetails,
      frequency: editFrequency,
    });

    let timeOk = true;
    if (editDate && editTime) {
      // Both date and time are now caregiver-editable, read as local
      // values — the JS Date constructor interprets them as local time
      // and computes the correct UTC instant internally, so
      // toISOString() below is already correctly converted.
      const [year, month, day] = editDate.split("-").map(Number);
      const [hh, mm] = editTime.split(":").map(Number);
      const updated = new Date(year, month - 1, day, hh, mm);
      timeOk = await onUpdateTime(editingTaskId, updated.toISOString());
    } else {
      console.error("saveEdit: editDate or editTime was missing — skipped.");
    }

    setSavingEdit(false);
    if (templateOk && timeOk) setEditingTaskId(null);
  }

  return (
    <section>
      <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
        {title}
      </h2>
      {tasks.length === 0 ? (
        <Card className="p-5 text-sm text-slate-400 text-center border-dashed">
          {emptyLabel}
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([dateKey, group]) => {
            const sorted = [...group].sort(
              (a, b) =>
                new Date(a.scheduled_for).getTime() -
                new Date(b.scheduled_for).getTime(),
            );
            const isExpanded = expanded[dateKey] ?? false;
            const visible = isExpanded ? sorted : sorted.slice(0, 2);
            const hiddenCount = sorted.length - visible.length;

            return (
              <div key={dateKey}>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                  {formatDateLabel(sorted[0].scheduled_for)}
                </div>
                <div className="space-y-2">
                  {visible.map((task) => {
                    const done = task.status === "done";
                    const isEditing = editingTaskId === task.id;

                    if (isEditing) {
                      return (
                        <Card key={task.id} className="p-4 border-teal-200">
                          <div className="space-y-2.5">
                            <input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              placeholder="Name"
                              className="w-full font-medium border-b border-slate-200 pb-1.5 focus:border-teal-500"
                            />
                            <input
                              value={editDetails}
                              onChange={(e) => setEditDetails(e.target.value)}
                              placeholder="Dosage / provider details"
                              className="w-full text-sm text-slate-600 border-b border-slate-200 pb-1.5 focus:border-teal-500"
                            />
                            <input
                              value={editFrequency}
                              onChange={(e) => setEditFrequency(e.target.value)}
                              placeholder="Frequency (e.g. twice daily)"
                              className="w-full text-sm text-slate-600 border-b border-slate-200 pb-1.5 focus:border-teal-500"
                            />
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">
                                Date &amp; time (this occurrence only)
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="date"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                  className="flex-1 text-sm text-slate-600 border-b border-slate-200 pb-1.5 focus:border-teal-500 bg-transparent"
                                />
                                <input
                                  type="time"
                                  value={editTime}
                                  onChange={(e) => setEditTime(e.target.value)}
                                  className="flex-1 text-sm text-slate-600 border-b border-slate-200 pb-1.5 focus:border-teal-500 bg-transparent"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingTaskId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={saveEdit}
                                disabled={savingEdit || !editTitle.trim()}
                              >
                                {savingEdit ? "Saving…" : "Save"}
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    }

                    return (
                      <Card
                        key={task.id}
                        className={`p-4 ${done ? "bg-slate-50" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => onToggle(task.id, task.status)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 ${
                              done
                                ? "bg-teal-500 border-teal-500 text-white"
                                : "border-slate-300 text-transparent hover:border-teal-400"
                            }`}
                          >
                            <CheckIcon className="w-3.5 h-3.5" />
                          </button>
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              done ? "bg-slate-100 text-slate-400" : toneClasses
                            }`}
                          >
                            {icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={
                                  done
                                    ? "line-through text-slate-400"
                                    : "font-medium text-slate-900"
                                }
                              >
                                {task.task_templates?.title}
                              </span>
                              <span className="text-xs text-slate-400">
                                {formatTime(task.scheduled_for)}
                              </span>
                              {done && task.completed_by_member?.name && (
                                <span className="text-xs text-slate-400 ml-2">
                                  ✓ done by {task.completed_by_member.name}
                                </span>
                              )}
                            </div>
                            {task.task_templates?.details && (
                              <div
                                className={`text-sm ${done ? "text-slate-300" : "text-slate-500"}`}
                              >
                                {task.task_templates.details}
                              </div>
                            )}
                            {isOverdue(task.scheduled_for, task.status) && (
                              <Badge tone="rose" className="mt-1">
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <button
                            onClick={() => startEdit(task)}
                            className="text-slate-300 hover:text-teal-600 p-1.5 shrink-0"
                            aria-label={`Edit ${task.task_templates?.title}`}
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {sorted.length > 2 && (
                  <button
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [dateKey]: !isExpanded,
                      }))
                    }
                    className="text-xs text-teal-600 hover:underline mt-2"
                  >
                    {isExpanded ? "Show less ▲" : `Show ${hiddenCount} more ▼`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
