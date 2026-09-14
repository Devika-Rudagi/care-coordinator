"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge, HeartIcon } from "../../components/ui";

const supabase = createClient();

const criticalityStyles: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function PatientAttributesEditor({
  patientId,
  initialCriticality,
  initialNeedsExtraCare,
}: {
  patientId: string;
  initialCriticality: string;
  initialNeedsExtraCare: boolean;
}) {
  const [criticality, setCriticality] = useState(initialCriticality);
  const [needsExtraCare, setNeedsExtraCare] = useState(initialNeedsExtraCare);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function updateCriticality(value: string) {
    const previous = criticality;
    setCriticality(value);
    setSaving(true);
    setSaveError("");
    const { error, data } = await supabase
      .from("patients")
      .update({ criticality: value })
      .eq("id", patientId)
      .select();
    setSaving(false);
    if (error || !data || data.length === 0) {
      setCriticality(previous);
      setSaveError("Couldn't save — change reverted.");
    }
  }

  async function toggleExtraCare() {
    const previous = needsExtraCare;
    const next = !needsExtraCare;
    setNeedsExtraCare(next);
    setSaving(true);
    setSaveError("");
    const { error, data } = await supabase
      .from("patients")
      .update({ needs_extra_care: next })
      .eq("id", patientId)
      .select();
    setSaving(false);
    if (error || !data || data.length === 0) {
      setNeedsExtraCare(previous);
      setSaveError("Couldn't save — change reverted.");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={criticality}
          onChange={(e) => updateCriticality(e.target.value)}
          disabled={saving}
          className={`text-xs font-medium uppercase tracking-wide border rounded-full px-2.5 py-1 cursor-pointer disabled:opacity-60 ${criticalityStyles[criticality] ?? criticalityStyles.medium}`}
        >
          <option value="low">Low criticality</option>
          <option value="medium">Medium criticality</option>
          <option value="high">High criticality</option>
        </select>

        <button
          onClick={toggleExtraCare}
          disabled={saving}
          className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wide border rounded-full px-2.5 py-1 transition-colors disabled:opacity-60 ${
            needsExtraCare
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
          }`}
        >
          <HeartIcon className="w-3 h-3" />
          {needsExtraCare ? "Needs extra care" : "Mark needs extra care"}
        </button>
      </div>
      {saveError && (
        <p className="text-xs text-rose-600 mt-1.5">{saveError}</p>
      )}
    </div>
  );
}
