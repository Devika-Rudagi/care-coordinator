"use client";

import { ChangeEvent, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  AlertIcon,
  ArrowLeftIcon,
  Badge,
  Button,
  CalendarIcon,
  Card,
  FileTextIcon,
  PillIcon,
  PlusIcon,
  SparkleIcon,
  SuccessOverlay,
  TrashIcon,
  UploadIcon,
} from "../../../components/ui";

const supabase = createClient();

type Medication = {
  name: string;
  dosage?: string;
  frequency: string;
  times_of_day?: string[];
  scheduledDate?: string; // "YYYY-MM-DD", local
  scheduledTime?: string; // "HH:MM", local
};
type Appointment = {
  type: string;
  provider?: string;
  date?: string; // raw AI-extracted text, kept for reference only
  scheduledDate?: string; // "YYYY-MM-DD", local — the real, caregiver-set date
  scheduledTime?: string; // "HH:MM", local
};
type WatchItem = {
  symptom: string;
  guidance?: string;
  urgency: "low" | "medium" | "high";
};

type Extracted = {
  medications: Medication[];
  appointments: Appointment[];
  watch_for: WatchItem[];
};

// Converts a local date ("YYYY-MM-DD") + time ("HH:MM") pair into a
// correctly UTC-converted ISO timestamp. The Date constructor reads
// year/month/day/hour/minute as LOCAL values and computes the right UTC
// instant internally — same pattern used for the later per-occurrence
// time edit on the caregiver dashboard. Falls back to right now if either
// piece is missing.
function localDateTimeToISO(dateStr?: string, timeStr?: string): string {
  if (!dateStr || !timeStr) return new Date().toISOString();
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

const urgencyTone: Record<string, "rose" | "amber" | "slate"> = {
  high: "rose",
  medium: "amber",
  low: "slate",
};

const emptyExtracted: Extracted = {
  medications: [],
  appointments: [],
  watch_for: [],
};

export default function IntakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"text" | "file">("text");
  const [rawText, setRawText] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [existingItemCount, setExistingItemCount] = useState<number | null>(
    null,
  );

  useEffect(() => {
    async function checkExisting() {
      const { count } = await supabase
        .from("task_templates")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", patientId);
      setExistingItemCount(count ?? 0);
    }
    checkExisting();
  }, [patientId]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setFileBase64(base64);
      setFileMimeType(file.type);
      setFileName(file.name);
      if (file.type.startsWith("image/")) {
        setFilePreview(result);
      } else {
        setFilePreview(null);
      }
    };
    reader.readAsDataURL(file);
  }

  function clearFile() {
    setFileBase64(null);
    setFileMimeType(null);
    setFileName(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleExtract() {
    setLoading(true);
    setError("");
    try {
      const payload: Record<string, string> = {};
      if (mode === "text") {
        payload.text = rawText;
      } else if (fileBase64 && fileMimeType) {
        payload.imageBase64 = fileBase64;
        payload.mimeType = fileMimeType;
      }

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Extraction failed");
      }
      const data = await res.json();
      const todayStr = new Date().toISOString().split("T")[0];
      data.medications = (data.medications || []).map((m: Medication) => ({
        ...m,
        scheduledDate: todayStr,
        scheduledTime: "09:00",
      }));
      data.appointments = (data.appointments || []).map((a: Appointment) => ({
        ...a,
        scheduledDate: "",
        scheduledTime: "",
      }));
      setExtracted(data);
    } catch (e: any) {
      console.error("Extraction error:", e.message);
      setError(
        `${e.message || "Could not extract from that."} You can try again, or add items manually below.`,
      );
    } finally {
      setLoading(false);
    }
  }

  function startManualEntry() {
    setExtracted({ ...emptyExtracted });
  }

  function updateMed(index: number, field: keyof Medication, value: string) {
    if (!extracted) return;
    const meds = [...extracted.medications];
    meds[index] = { ...meds[index], [field]: value };
    setExtracted({ ...extracted, medications: meds });
  }

  function addMed() {
    if (!extracted) return;
    const todayStr = new Date().toISOString().split("T")[0];
    setExtracted({
      ...extracted,
      medications: [
        ...extracted.medications,
        {
          name: "",
          dosage: "",
          frequency: "",
          scheduledDate: todayStr,
          scheduledTime: "09:00",
        },
      ],
    });
  }

  function removeMed(index: number) {
    if (!extracted) return;
    setExtracted({
      ...extracted,
      medications: extracted.medications.filter((_, i) => i !== index),
    });
  }

  function updateAppt(index: number, field: keyof Appointment, value: string) {
    if (!extracted) return;
    const appts = [...extracted.appointments];
    appts[index] = { ...appts[index], [field]: value };
    setExtracted({ ...extracted, appointments: appts });
  }

  function addAppt() {
    if (!extracted) return;
    setExtracted({
      ...extracted,
      appointments: [
        ...extracted.appointments,
        { type: "", provider: "", date: "", scheduledDate: "", scheduledTime: "" },
      ],
    });
  }

  function removeAppt(index: number) {
    if (!extracted) return;
    setExtracted({
      ...extracted,
      appointments: extracted.appointments.filter((_, i) => i !== index),
    });
  }

  function updateWatch(index: number, field: keyof WatchItem, value: string) {
    if (!extracted) return;
    const items = [...extracted.watch_for];
    items[index] = { ...items[index], [field]: value } as WatchItem;
    setExtracted({ ...extracted, watch_for: items });
  }

  function addWatch() {
    if (!extracted) return;
    setExtracted({
      ...extracted,
      watch_for: [
        ...extracted.watch_for,
        { symptom: "", guidance: "", urgency: "medium" },
      ],
    });
  }

  function removeWatch(index: number) {
    if (!extracted) return;
    setExtracted({
      ...extracted,
      watch_for: extracted.watch_for.filter((_, i) => i !== index),
    });
  }

  async function handleConfirm() {
    if (!extracted) return;
    setLoading(true);

    for (const med of extracted.medications) {
      if (!med.name.trim()) continue;
      const { data: template } = await supabase
        .from("task_templates")
        .insert({
          patient_id: patientId,
          type: "medication",
          title: med.name,
          details: med.dosage || null,
          frequency: med.frequency || "once daily",
          times_of_day: med.times_of_day || [],
        })
        .select()
        .single();

      if (template) {
        await supabase.from("task_instances").insert({
          template_id: template.id,
          patient_id: patientId,
          scheduled_for: localDateTimeToISO(med.scheduledDate, med.scheduledTime),
          status: "pending",
        });
      }
    }

    for (const appt of extracted.appointments) {
      if (!appt.type.trim()) continue;
      const { data: template } = await supabase
        .from("task_templates")
        .insert({
          patient_id: patientId,
          type: "appointment",
          title: appt.type,
          details: appt.provider ? `with ${appt.provider}` : null,
          frequency: "once",
          times_of_day: [],
        })
        .select()
        .single();

      if (template) {
        await supabase.from("task_instances").insert({
          template_id: template.id,
          patient_id: patientId,
          scheduled_for: localDateTimeToISO(appt.scheduledDate, appt.scheduledTime),
          status: "pending",
        });
      }
    }

    for (const item of extracted.watch_for) {
      if (!item.symptom.trim()) continue;
      await supabase.from("watch_items").insert({
        patient_id: patientId,
        symptom: item.symptom,
        guidance: item.guidance || null,
        urgency: item.urgency,
        status: "active",
      });
    }

    setLoading(false);
    setShowSuccess(true);
    setTimeout(() => {
      router.push(`/patient/${patientId}`);
    }, 1000);
  }

  const totalFound = extracted
    ? extracted.medications.length +
      extracted.appointments.length +
      extracted.watch_for.length
    : 0;

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <SuccessOverlay
        message={`Checklist ${
          existingItemCount && existingItemCount > 0 ? "updated" : "created"
        }!`}
        visible={showSuccess}
      />
      <Link
        href={`/patient/${patientId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6"
      >
        <ArrowLeftIcon />
        Back to dashboard
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center">
          <SparkleIcon />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Add discharge instructions
          </h1>
          <p className="text-sm text-slate-500">
            We'll pull out medications, follow-ups, and things to watch for.
          </p>
        </div>
      </div>

      {existingItemCount !== null && existingItemCount > 0 && (
        <div className="bg-blue-50 border border-blue-100 text-blue-800 text-sm rounded-xl px-4 py-3 mt-4">
          This patient already has {existingItemCount} item
          {existingItemCount === 1 ? "" : "s"} on their checklist. Anything
          you confirm here will be <strong>added</strong> to it, not replace
          it.
        </div>
      )}

      {!extracted && (
        <Card className="p-6 mt-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode("text")}
              className={`flex-1 text-sm font-medium rounded-xl px-4 py-2.5 border transition-colors ${
                mode === "text"
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Paste text
            </button>
            <button
              onClick={() => setMode("file")}
              className={`flex-1 text-sm font-medium rounded-xl px-4 py-2.5 border transition-colors ${
                mode === "file"
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Upload photo or PDF
            </button>
          </div>

          {mode === "text" ? (
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste discharge instructions here…"
              className="w-full h-48 p-4 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-none"
            />
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              {!fileBase64 ? (
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center gap-2 h-48 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-teal-300 hover:bg-teal-50/30 transition-colors"
                >
                  <UploadIcon className="w-8 h-8 text-slate-400" />
                  <span className="text-sm text-slate-500">
                    Click to upload a photo or PDF of the paperwork
                  </span>
                </label>
              ) : (
                <div className="relative border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt="Uploaded discharge paperwork"
                      className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                      <FileTextIcon className="w-8 h-8" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {fileName}
                    </div>
                    <div className="text-xs text-slate-400">Ready to extract</div>
                  </div>
                  <button
                    onClick={clearFile}
                    className="text-slate-300 hover:text-rose-500 p-1"
                    aria-label="Remove file"
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-2.5 mt-4">
              {error}
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full mt-4"
            onClick={handleExtract}
            disabled={
              loading ||
              (mode === "text" ? !rawText.trim() : !fileBase64)
            }
          >
            {loading ? (
              "Reading instructions…"
            ) : (
              <>
                <SparkleIcon className="w-4 h-4" />
                Extract checklist
              </>
            )}
          </Button>

          <button
            onClick={startManualEntry}
            className="w-full text-center text-sm text-slate-400 hover:text-teal-600 mt-3"
          >
            Skip AI and add items manually instead
          </button>
        </Card>
      )}

      {extracted && (
        <div className="space-y-6 mt-6">
          {totalFound === 0 ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertIcon className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                We couldn't find any medications, follow-ups, or watch items
                in that {mode === "file" ? "file" : "text"}. You can try again
                with clearer paperwork, or add items manually using the "+"
                buttons below.
              </span>
            </div>
          ) : (
            <div className="bg-teal-50 border border-teal-100 text-teal-800 text-sm rounded-xl px-4 py-3">
              Review what we found below. Nothing is saved until you confirm
              — edit, remove, or add anything that isn't right.
            </div>
          )}

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                Medications
              </h2>
              <button
                onClick={addMed}
                className="text-xs text-teal-600 hover:underline flex items-center gap-1"
              >
                <PlusIcon className="w-3 h-3" />
                Add medication
              </button>
            </div>
            <div className="space-y-3">
              {extracted.medications.length === 0 && (
                <Card className="p-4 text-sm text-slate-400 text-center border-dashed">
                  None found
                </Card>
              )}
              {extracted.medications.map((med, i) => (
                <Card key={i} className="p-4">
                  <div className="flex gap-3 items-start">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                      <PillIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        value={med.name}
                        onChange={(e) => updateMed(i, "name", e.target.value)}
                        placeholder="Medication name"
                        className="w-full font-medium border-b border-slate-200 pb-1.5 focus:border-teal-500"
                      />
                      <input
                        value={med.dosage || ""}
                        onChange={(e) => updateMed(i, "dosage", e.target.value)}
                        placeholder="Dosage"
                        className="w-full text-sm text-slate-600 border-b border-slate-200 pb-1.5 focus:border-teal-500"
                      />
                      <input
                        value={med.frequency}
                        onChange={(e) =>
                          updateMed(i, "frequency", e.target.value)
                        }
                        placeholder="Frequency (e.g. twice daily)"
                        className="w-full text-sm text-slate-600 border-b border-slate-200 pb-1.5 focus:border-teal-500"
                      />
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          First dose
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={med.scheduledDate || ""}
                            onChange={(e) =>
                              updateMed(i, "scheduledDate", e.target.value)
                            }
                            className="flex-1 text-sm text-slate-600 border-b border-slate-200 pb-1.5 focus:border-teal-500 bg-transparent"
                          />
                          <input
                            type="time"
                            value={med.scheduledTime || ""}
                            onChange={(e) =>
                              updateMed(i, "scheduledTime", e.target.value)
                            }
                            className="flex-1 text-sm text-slate-600 border-b border-slate-200 pb-1.5 focus:border-teal-500 bg-transparent"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeMed(i)}
                      className="text-slate-300 hover:text-rose-500 p-1"
                      aria-label="Remove medication"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                Follow-up appointments
              </h2>
              <button
                onClick={addAppt}
                className="text-xs text-teal-600 hover:underline flex items-center gap-1"
              >
                <PlusIcon className="w-3 h-3" />
                Add appointment
              </button>
            </div>
            <div className="space-y-3">
              {extracted.appointments.length === 0 && (
                <Card className="p-4 text-sm text-slate-400 text-center border-dashed">
                  None found
                </Card>
              )}
              {extracted.appointments.map((appt, i) => (
                <Card key={i} className="p-4">
                  <div className="flex gap-3 items-start">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        value={appt.type}
                        onChange={(e) =>
                          updateAppt(i, "type", e.target.value)
                        }
                        placeholder="Appointment type"
                        className="w-full font-medium border-b border-slate-200 pb-1.5 focus:border-teal-500"
                      />
                      <input
                        value={appt.provider || ""}
                        onChange={(e) =>
                          updateAppt(i, "provider", e.target.value)
                        }
                        placeholder="Provider"
                        className="w-full text-sm text-slate-600 border-b border-slate-200 pb-1.5 focus:border-teal-500"
                      />
                      <div>
                        {appt.date && (
                          <p className="text-xs text-slate-400 mb-1.5">
                            AI read this as: "{appt.date}" — set the real
                            date below.
                          </p>
                        )}
                        <label className="block text-xs text-amber-700 mb-1">
                          Actual appointment date & time
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={appt.scheduledDate || ""}
                            onChange={(e) =>
                              updateAppt(i, "scheduledDate", e.target.value)
                            }
                            className="flex-1 text-sm text-amber-800 bg-amber-50 border-b border-amber-300 pb-1.5 px-2 pt-1 rounded-t-md focus:border-amber-500"
                          />
                          <input
                            type="time"
                            value={appt.scheduledTime || ""}
                            onChange={(e) =>
                              updateAppt(i, "scheduledTime", e.target.value)
                            }
                            className="flex-1 text-sm text-amber-800 bg-amber-50 border-b border-amber-300 pb-1.5 px-2 pt-1 rounded-t-md focus:border-amber-500"
                          />
                        </div>
                        {(!appt.scheduledDate || !appt.scheduledTime) && (
                          <p className="text-xs text-amber-600 mt-1">
                            Set a real date and time before confirming.
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeAppt(i)}
                      className="text-slate-300 hover:text-rose-500 p-1"
                      aria-label="Remove appointment"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                Watch for
              </h2>
              <button
                onClick={addWatch}
                className="text-xs text-teal-600 hover:underline flex items-center gap-1"
              >
                <PlusIcon className="w-3 h-3" />
                Add watch item
              </button>
            </div>
            <div className="space-y-3">
              {extracted.watch_for.length === 0 && (
                <Card className="p-4 text-sm text-slate-400 text-center border-dashed">
                  None found
                </Card>
              )}
              {extracted.watch_for.map((item, i) => (
                <Card key={i} className="p-4 border-amber-200 bg-amber-50/60">
                  <div className="flex gap-3 items-start">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <AlertIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        value={item.symptom}
                        onChange={(e) =>
                          updateWatch(i, "symptom", e.target.value)
                        }
                        placeholder="Symptom to watch for"
                        className="w-full font-medium bg-transparent border-b border-amber-200 pb-1.5 focus:border-amber-500"
                      />
                      <input
                        value={item.guidance || ""}
                        onChange={(e) =>
                          updateWatch(i, "guidance", e.target.value)
                        }
                        placeholder="What to do (e.g. call doctor)"
                        className="w-full text-sm text-slate-600 bg-transparent border-b border-amber-200 pb-1.5 focus:border-amber-500"
                      />
                      <select
                        value={item.urgency}
                        onChange={(e) =>
                          updateWatch(i, "urgency", e.target.value)
                        }
                        className="text-xs bg-transparent border-b border-amber-200 pb-1 focus:border-amber-500"
                      >
                        <option value="low">Low urgency</option>
                        <option value="medium">Medium urgency</option>
                        <option value="high">High urgency</option>
                      </select>
                      <Badge
                        tone={urgencyTone[item.urgency] ?? "slate"}
                        className="ml-2"
                      >
                        {item.urgency} urgency
                      </Badge>
                    </div>
                    <button
                      onClick={() => removeWatch(i)}
                      className="text-slate-300 hover:text-rose-500 p-1"
                      aria-label="Remove watch item"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setExtracted(null)}
            >
              Start over
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? "Saving…" : "Confirm & create checklist"}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
