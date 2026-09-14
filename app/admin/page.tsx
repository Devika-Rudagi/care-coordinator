import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminOverdueList from "./AdminOverdueList";
import AdminTodayList from "./AdminTodayList";
import AdminPatientsTable from "./AdminPatientsTable";
import {
  ArrowLeftIcon,
  Avatar,
  Badge,
  Card,
  HeartIcon,
  criticalityTone,
} from "../components/ui";

export const metadata = { title: "Admin dashboard" };

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return (
      <main className="max-w-lg mx-auto px-6 py-16 text-center">
        <p className="text-2xl mb-3">🔒</p>
        <p className="text-slate-700 font-medium">Admin access only</p>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          Your account doesn't have admin permissions.
        </p>
        <Link href="/" className="text-teal-600 hover:underline text-sm">
          Back to Care Coordinator
        </Link>
      </main>
    );
  }

  // Deliberately unscoped — this is the one page in the app that reads
  // across every patient and caregiver, not just "mine." Reads on these
  // tables are already open by design (needed for the unauthenticated
  // patient view), so this page adds no new data exposure — it's purely
  // a role-gated aggregation of data that was already broadly readable.
  const { data: patients } = await supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: circleRows } = await supabase
    .from("care_circle_members")
    .select("patient_id, name, role, user_id")
    .neq("role", "patient");

  const { data: allTasks } = await supabase
    .from("task_instances")
    .select("id, patient_id, scheduled_for, status, task_templates(title, type)")
    .eq("status", "pending")
    .order("scheduled_for", { ascending: true });

  const patientsList = patients ?? [];
  const circle = circleRows ?? [];
  const tasks = allTasks ?? [];

  const patientById = new Map(patientsList.map((p) => [p.id, p]));

  const caregiversByPatient = new Map<string, string[]>();
  for (const row of circle) {
    const list = caregiversByPatient.get(row.patient_id) ?? [];
    list.push(row.name);
    caregiversByPatient.set(row.patient_id, list);
  }

  function caregiverLine(patientId: string) {
    const names = caregiversByPatient.get(patientId);
    return names && names.length > 0 ? names.join(", ") : "No caregivers yet";
  }

  const distinctCaregiverIds = new Set(
    circle.filter((r) => r.user_id).map((r) => r.user_id),
  );

  const now = new Date();
  const overdueRaw = tasks.filter((t) => new Date(t.scheduled_for) < now);
  const todayRaw = tasks.filter((t) => {
    const d = new Date(t.scheduled_for);
    return d >= now && d.toDateString() === now.toDateString();
  });

  function toRow(t: any) {
    const patient = patientById.get(t.patient_id);
    return {
      id: t.id,
      patient_id: t.patient_id,
      patient_name: patient?.name ?? "Unknown patient",
      title: t.task_templates?.title ?? "Task",
      scheduled_for: t.scheduled_for,
      caregivers: caregiverLine(t.patient_id),
    };
  }

  const overdueRows = overdueRaw.map(toRow);
  const todayRows = todayRaw.map(toRow);

  const criticalityCounts = { low: 0, medium: 0, high: 0 };
  for (const p of patientsList) {
    const c = (p.criticality ?? "medium") as "low" | "medium" | "high";
    if (c in criticalityCounts) criticalityCounts[c]++;
  }
  const extraCareCount = patientsList.filter((p) => p.needs_extra_care).length;

  // Caregiver workload: for each real caregiver account, how many overdue
  // and today's-tasks fall on patients they're part of, and across how
  // many patients. This is the "who needs help" view an admin actually
  // wants, on top of the per-patient breakdown above.
  const caregiverIdToName = new Map<string, string>();
  const caregiverPatientSets = new Map<string, Set<string>>();
  for (const row of circle) {
    if (!row.user_id) continue;
    caregiverIdToName.set(row.user_id, row.name);
    const set = caregiverPatientSets.get(row.user_id) ?? new Set<string>();
    set.add(row.patient_id);
    caregiverPatientSets.set(row.user_id, set);
  }

  const workload = Array.from(caregiverPatientSets.entries())
    .map(([userId, patientSet]) => {
      const overdueCount = overdueRaw.filter((t) =>
        patientSet.has(t.patient_id),
      ).length;
      const todayCount = todayRaw.filter((t) =>
        patientSet.has(t.patient_id),
      ).length;
      return {
        userId,
        name: caregiverIdToName.get(userId) ?? "Unknown",
        patientCount: patientSet.size,
        overdueCount,
        todayCount,
      };
    })
    .sort((a, b) => b.overdueCount - a.overdueCount);

  // Per-patient overdue count and enriched rows for the client-side
  // sortable/filterable table — sorting, search, and filtering all happen
  // in the browser now, so this just shapes the data once.
  const overdueCountByPatient = new Map<string, number>();
  for (const t of overdueRaw) {
    overdueCountByPatient.set(
      t.patient_id,
      (overdueCountByPatient.get(t.patient_id) ?? 0) + 1,
    );
  }
  const patientRows = patientsList.map((p) => ({
    id: p.id,
    name: p.name,
    criticality: p.criticality ?? "medium",
    needs_extra_care: p.needs_extra_care ?? false,
    discharge_date: p.discharge_date,
    caregiverNames: caregiversByPatient.get(p.id) ?? [],
    overdueCount: overdueCountByPatient.get(p.id) ?? 0,
  }));

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeftIcon />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <HeartIcon className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 leading-tight">
              Admin dashboard
            </h1>
            <p className="text-xs text-slate-500 leading-tight">
              Cross-patient, cross-caregiver overview
            </p>
          </div>
        </div>

        {/* Stat cards, inline in the header row to save vertical space */}
        <div className="flex gap-2">
          <div className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-center">
            <div className="text-lg font-semibold text-slate-900 leading-none">
              {patientsList.length}
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">
              Patients
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-center">
            <div className="text-lg font-semibold text-slate-900 leading-none">
              {distinctCaregiverIds.size}
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">
              Caregivers
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-center">
            <div className="text-lg font-semibold text-rose-600 leading-none">
              {overdueRows.length}
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">
              Overdue
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-center">
            <div className="text-lg font-semibold text-blue-600 leading-none">
              {extraCareCount}
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">
              Extra care
            </div>
          </div>
        </div>
      </div>

      {/* Main dashboard grid — everything below fits side by side instead
          of stacking, and the two task lists scroll within their own
          fixed-height panel instead of growing the whole page. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left sidebar: criticality + workload, stacked, compact */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-4">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
              By criticality
            </h2>
            <div className="space-y-2.5">
              {(["high", "medium", "low"] as const).map((level) => {
                const count = criticalityCounts[level];
                const pct = patientsList.length
                  ? Math.round((count / patientsList.length) * 100)
                  : 0;
                return (
                  <div key={level}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <Badge tone={criticalityTone[level]}>{level}</Badge>
                      <span className="text-slate-500">{count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          level === "high"
                            ? "bg-rose-400"
                            : level === "medium"
                              ? "bg-amber-400"
                              : "bg-slate-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
              Caregiver workload
            </h2>
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {workload.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">
                  No caregivers yet.
                </p>
              ) : (
                workload.map((w) => (
                  <div key={w.userId} className="flex items-center gap-2">
                    <Avatar name={w.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {w.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {w.patientCount} patient{w.patientCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      {w.overdueCount > 0 && (
                        <Badge tone="rose">{w.overdueCount}</Badge>
                      )}
                      {w.todayCount > 0 && (
                        <Badge tone="amber">{w.todayCount}</Badge>
                      )}
                      {w.overdueCount === 0 && w.todayCount === 0 && (
                        <Badge tone="teal">Clear</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Overdue panel — scrolls internally, page doesn't grow with it */}
        <div className="lg:col-span-5">
          <Card className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Overdue right now
              </h2>
              <Badge tone="rose">{overdueRows.length}</Badge>
            </div>
            <div className="overflow-y-auto max-h-[520px] pr-1">
              <AdminOverdueList initialTasks={overdueRows} />
            </div>
          </Card>
        </div>

        {/* Today panel — same scroll pattern */}
        <div className="lg:col-span-4">
          <Card className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Still due today
              </h2>
              <Badge tone="amber">{todayRows.length}</Badge>
            </div>
            <div className="overflow-y-auto max-h-[520px] pr-1">
              <AdminTodayList initialTasks={todayRows} />
            </div>
          </Card>
        </div>

        {/* All patients — sortable, filterable, searchable, in a fixed
            scrolling frame so the page itself stays a constant height
            regardless of patient count. */}
        <div className="lg:col-span-12">
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3 mt-1">
            All patients
          </h2>
          <Card className="p-4">
            <AdminPatientsTable patients={patientRows} />
          </Card>
        </div>
      </div>
    </main>
  );
}
