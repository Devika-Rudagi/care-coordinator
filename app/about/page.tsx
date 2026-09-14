import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowLeftIcon,
  Card,
  CheckIcon,
  ChecklistIllustration,
  HeartIcon,
  SparkleIcon,
  UserIcon,
} from "../components/ui";

export const metadata = { title: "About" };

const principles = [
  {
    icon: SparkleIcon,
    title: "AI reads the paperwork, humans make the call",
    body: "Discharge instructions are extracted into a structured checklist automatically — but nothing becomes a real task until a caregiver reviews and confirms it. The system flags anything ambiguous, like a relative date, rather than guessing.",
  },
  {
    icon: CheckIcon,
    title: "One shared checklist, not five group texts",
    body: "Every caregiver sees the same live checklist and knows who did what, in real time — so no one has to ask whether Dad already took his evening medication.",
  },
  {
    icon: UserIcon,
    title: "Built for the patient too, not just around them",
    body: "The patient gets their own simple, large-touch-target view of what's next for them — not just a system their family manages on their behalf.",
  },
];

export default async function AboutPage() {
  const supabase = await createClient();

  const [
    { count: patientCount },
    { count: taskDoneCount },
    { count: extractionCount },
    { data: circleRows },
  ] = await Promise.all([
    supabase.from("patients").select("*", { count: "exact", head: true }),
    supabase
      .from("task_instances")
      .select("*", { count: "exact", head: true })
      .eq("status", "done"),
    supabase
      .from("extraction_events")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("care_circle_members")
      .select("user_id")
      .neq("role", "patient")
      .not("user_id", "is", null),
  ]);

  const caregiverCount = new Set((circleRows ?? []).map((r) => r.user_id)).size;

  const stats = [
    { label: "Patients tracked", value: patientCount ?? 0 },
    { label: "Caregivers coordinating", value: caregiverCount },
    { label: "Tasks completed", value: taskDoneCount ?? 0 },
    { label: "AI extractions run", value: extractionCount ?? 0 },
  ];

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-8"
      >
        <ArrowLeftIcon />
        Back to Care Coordinator
      </Link>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-900/20">
          <HeartIcon className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          About Care Coordinator
        </h1>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-center mb-10">
        <p className="text-lg text-slate-600 leading-relaxed">
          The weeks right after a hospital discharge are when small things
          matter most — a missed medication, a forgotten follow-up, a symptom
          nobody flagged in time. Care Coordinator exists to make that window
          safer, by giving every caregiver in a family the same clear,
          up-to-date picture of what needs to happen next.
        </p>
        <ChecklistIllustration className="w-full max-w-[240px] mx-auto" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 text-center">
            <div className="text-2xl font-semibold text-slate-900">
              {s.value}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      <section className="mb-12">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">
          Why this exists
        </h2>
        <Card className="p-6">
          <p className="text-slate-600 leading-relaxed">
            Discharge paperwork is dense, and responsibility for following
            it usually splits across several people — the patient, their
            adult children, sometimes a home aide — none of whom has the
            full picture. That gap is exactly where hospital readmissions
            tend to happen: not from a lack of information, but from
            nobody being sure who's tracking what. Care Coordinator turns
            that paperwork into one shared, live checklist everyone can
            act on together.
          </p>
        </Card>
      </section>

      <section className="mb-12">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">
          How it works
        </h2>
        <div className="space-y-4">
          {principles.map((p) => (
            <Card key={p.title} className="p-5 flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <p.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-slate-900 mb-1">
                  {p.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {p.body}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">
          Get in touch
        </h2>
        <Card className="p-6 flex items-center justify-between flex-wrap gap-4">
          <p className="text-slate-600">
            Questions, feedback, or want to try it with your own family?
          </p>
          <Link
            href="/contact"
            className="text-teal-600 font-medium hover:underline"
          >
            Contact us →
          </Link>
        </Card>
      </section>
    </main>
  );
}
