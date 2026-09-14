import { supabase } from "@/lib/supabase";
import SimplePatientView from "./SimplePatientView";

export default async function SimplePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (!patient)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-slate-500">Patient not found</p>
      </div>
    );

  const { data: tasks } = await supabase
    .from("task_instances")
    .select("*, task_templates(title, type, details)")
    .eq("patient_id", id)
    .eq("status", "pending")
    .order("scheduled_for", { ascending: true });

  // Care team = everyone except the patient's own "patient" role entry —
  // shown so the patient can see who's actually looking after them.
  const { data: careCircle } = await supabase
    .from("care_circle_members")
    .select("*")
    .eq("patient_id", id)
    .neq("role", "patient");

  return (
    <SimplePatientView
      patientId={id}
      patientName={patient.name}
      initialTasks={tasks || []}
      careTeam={careCircle || []}
    />
  );
}
