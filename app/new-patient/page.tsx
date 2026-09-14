"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeftIcon,
  Button,
  Card,
  SuccessOverlay,
  UserIcon,
} from "../components/ui";

const supabase = createClient();

export default function NewPatientPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [dischargeDate, setDischargeDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [primaryCaregiverName, setPrimaryCaregiverName] = useState("");
  const [criticality, setCriticality] = useState<"low" | "medium" | "high">(
    "medium",
  );
  const [needsExtraCare, setNeedsExtraCare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login?redirect=/new-patient");
      } else {
        setUserId(user.id);
      }
    });
  }, [router]);

  async function handleCreate() {
    if (!name.trim() || !primaryCaregiverName.trim() || !userId) {
      setError("Patient name and your name are required.");
      return;
    }
    setLoading(true);
    setError("");

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .insert({
        name: name.trim(),
        diagnosis: diagnosis.trim() || null,
        discharge_date: dischargeDate,
        criticality,
        needs_extra_care: needsExtraCare,
      })
      .select()
      .single();

    if (patientError || !patient) {
      setError("Could not create patient. Try again.");
      setLoading(false);
      return;
    }

    // The patient's own row has no user_id — they don't log in, their
    // private link is their access. The caregiver's row is tied to their
    // real authenticated account, which is what real access control needs.
    const { error: circleError } = await supabase.from("care_circle_members").insert([
      { patient_id: patient.id, name: name.trim(), role: "patient" },
      {
        patient_id: patient.id,
        user_id: userId,
        name: primaryCaregiverName.trim(),
        role: "primary",
      },
    ]);

    if (circleError) {
      setError(`Patient created, but couldn't set up the care circle: ${circleError.message}`);
      setLoading(false);
      return;
    }

    setLoading(false);
    setShowSuccess(true);
    setTimeout(() => {
      router.push(`/patient/${patient.id}`);
    }, 900);
  }

  return (
    <main className="max-w-lg mx-auto px-6 py-12 animate-fade-in-up">
      <SuccessOverlay message="Patient added!" visible={showSuccess} />
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6"
      >
        <ArrowLeftIcon />
        Back to patients
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center">
          <UserIcon />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Add a patient
          </h1>
          <p className="text-sm text-slate-500">
            A few basics to set up their care circle.
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Patient name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="e.g. Robert Chen"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Diagnosis / reason for admission
            </label>
            <input
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="e.g. Fall / hip fracture recovery"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Discharge date
            </label>
            <input
              type="date"
              value={dischargeDate}
              onChange={(e) => setDischargeDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Criticality
            </label>
            <select
              value={criticality}
              onChange={(e) =>
                setCriticality(e.target.value as "low" | "medium" | "high")
              }
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 bg-white"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={needsExtraCare}
              onChange={(e) => setNeedsExtraCare(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-700">
              This patient needs extra attention (e.g. living alone,
              cognitive concerns)
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Your name
            </label>
            <input
              value={primaryCaregiverName}
              onChange={(e) => setPrimaryCaregiverName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="e.g. Sarah Chen"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              You'll be set as the primary caregiver for this patient.
            </p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleCreate}
            disabled={loading || !userId}
          >
            {loading ? "Creating…" : "Create patient"}
          </Button>
        </div>
      </Card>
    </main>
  );
}
