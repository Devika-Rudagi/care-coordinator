import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import IdentityGate from "./IdentityGate";
import PatientAttributesEditor from "./PatientAttributesEditor";
import { ensureDailyInstances } from "@/lib/generateTasks";
import {
  ArrowLeftIcon,
  Avatar,
  Badge,
  Button,
  Card,
  SparkleIcon,
  UserIcon,
} from "../../components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("name")
    .eq("id", id)
    .single();

  return { title: patient?.name || "Patient" };
}

export default async function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?redirect=/patient/${id}`);

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (!patient)
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <Card className="p-10 text-center">
          <p className="text-slate-600 font-medium">Patient not found</p>
          <Link href="/" className="inline-block mt-4">
            <Button variant="secondary">Back to patients</Button>
          </Link>
        </Card>
      </main>
    );

  // Ordered + limited to 1, rather than .maybeSingle() — resilient to a
  // duplicate membership row for the same account (which previously caused
  // this check to silently fail and show "join circle" for someone who
  // was already a real member).
  const { data: membershipRows } = await supabase
    .from("care_circle_members")
    .select("*")
    .eq("patient_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const membership = membershipRows?.[0] ?? null;

  // No active membership yet — check whether the patient (or an existing
  // caregiver) has invited this exact email address. Real authorization,
  // not just "anyone with the link can type a name and join."
  let pendingInvite = null;
  if (!membership && user.email) {
    const { data: pendingRows } = await supabase
      .from("care_circle_members")
      .select("*")
      .eq("patient_id", id)
      .is("user_id", null)
      .ilike("invited_email", user.email)
      .limit(1);
    pendingInvite = pendingRows?.[0] ?? null;
  }

  let tasks: any[] = [];
  let watchItems: any[] = [];

  let tasksLoadError: string | null = null;
  let careTeam: any[] = [];

  // Only generate/fetch the actual care plan once real membership is
  // confirmed — a signed-in stranger with the link sees the join screen,
  // nothing else.
  if (membership) {
    await ensureDailyInstances(id, supabase);

    const tasksRes = await supabase
      .from("task_instances")
      .select(
        "*, task_templates(title, type, details, frequency), completed_by_member:care_circle_members!task_instances_completed_by_fkey(name)",
      )
      .eq("patient_id", id)
      .order("scheduled_for", { ascending: true });
    tasks = tasksRes.data || [];
    if (tasksRes.error) tasksLoadError = tasksRes.error.message;

    const watchRes = await supabase
      .from("watch_items")
      .select("*")
      .eq("patient_id", id)
      .eq("status", "active");
    watchItems = watchRes.data || [];

    const teamRes = await supabase
      .from("care_circle_members")
      .select("*")
      .eq("patient_id", id)
      .neq("role", "patient")
      .order("created_at", { ascending: true });
    careTeam = teamRes.data || [];
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6"
      >
        <ArrowLeftIcon />
        All patients
      </Link>

      {tasksLoadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-2.5 mb-4">
          Couldn't load tasks: {tasksLoadError}
        </div>
      )}

      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Avatar name={patient.name} size="lg" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {patient.name}
              </h1>
              <p className="text-slate-500">{patient.diagnosis}</p>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <Badge tone="slate">
                  Discharged {patient.discharge_date}
                </Badge>
                <PatientAttributesEditor
                  patientId={patient.id}
                  initialCriticality={patient.criticality ?? "medium"}
                  initialNeedsExtraCare={patient.needs_extra_care ?? false}
                />
              </div>
            </div>
          </div>
        </div>

        {membership && (
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-100">
            <Link href={`/patient/${patient.id}/intake`}>
              <Button variant="primary" size="sm">
                <SparkleIcon className="w-4 h-4" />
                Add discharge instructions
              </Button>
            </Link>
            <Link href={`/patient/${patient.id}/simple`}>
              <Button variant="outline" size="sm">
                <UserIcon className="w-4 h-4" />
                Open patient view
              </Button>
            </Link>
          </div>
        )}
      </Card>

      <IdentityGate
        patientId={patient.id}
        patientName={patient.name}
        userId={user.id}
        userEmail={user.email ?? ""}
        initialMembership={membership}
        initialPendingInvite={pendingInvite}
        initialTasks={tasks}
        initialWatchItems={watchItems}
        initialCareTeam={careTeam}
      />
    </main>
  );
}
