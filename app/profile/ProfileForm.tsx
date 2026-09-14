"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, SuccessOverlay, UserIcon } from "../components/ui";

const supabase = createClient();

type Profile = {
  name: string | null;
  age: number | null;
  address: string | null;
} | null;

export default function ProfileForm({
  userId,
  userEmail,
  initialProfile,
}: {
  userId: string;
  userEmail: string;
  initialProfile: Profile;
}) {
  const [name, setName] = useState(initialProfile?.name ?? "");
  const [age, setAge] = useState(
    initialProfile?.age != null ? String(initialProfile.age) : "",
  );
  const [address, setAddress] = useState(initialProfile?.address ?? "");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true);
    setError("");
    const { error } = await supabase.from("profiles").upsert({
      user_id: userId,
      name: name.trim() || null,
      age: age.trim() ? parseInt(age.trim(), 10) : null,
      address: address.trim() || null,
      updated_at: new Date().toISOString(),
    });
    setLoading(false);
    if (error) {
      setError("Couldn't save your profile. Please try again.");
      return;
    }
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1200);
  }

  return (
    <>
      <SuccessOverlay message="Profile saved!" visible={showSuccess} />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center">
          <UserIcon />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            My profile
          </h1>
          <p className="text-sm text-slate-500">{userEmail}</p>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Age
            </label>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="e.g. 34"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Address
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city, state"
              className="w-full h-24 border border-slate-200 rounded-xl px-4 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-none"
            />
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
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </Card>
    </>
  );
}
