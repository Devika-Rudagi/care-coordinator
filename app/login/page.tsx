"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, HeartIcon } from "../components/ui";

const supabase = createClient();

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const linkError = searchParams.get("error") === "invalid_link";

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendCode() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/confirm?redirect_to=${encodeURIComponent(
          redirectTo,
        )}`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setStage("code");
    }
  }

  async function verifyCode() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError("That code didn't work. Check it and try again.");
    } else {
      router.push(redirectTo);
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <Card className="p-8 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center">
            <HeartIcon className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            Care Coordinator
          </h1>
        </div>

        {linkError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-2.5 mb-4">
            That link didn't work — it may have expired or already been
            used. Enter your email again to get a fresh code.
          </div>
        )}

        {stage === "email" ? (
          <>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Your email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendCode()}
              type="email"
              placeholder="you@example.com"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 mb-4 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-2.5 mb-4">
                {error}
              </div>
            )}
            <Button
              className="w-full"
              onClick={sendCode}
              disabled={loading || !email.trim()}
            >
              {loading ? "Sending code…" : "Send login code"}
            </Button>
            <p className="text-xs text-slate-400 text-center mt-4">
              No password — we'll email you a 6-digit code.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-4">
              We sent a 6-digit code to <strong>{email}</strong>. Enter it
              below.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verifyCode()}
              placeholder="123456"
              inputMode="numeric"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 mb-4 text-center text-lg tracking-widest focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-2.5 mb-4">
                {error}
              </div>
            )}
            <Button
              className="w-full"
              onClick={verifyCode}
              disabled={loading || code.trim().length < 6}
            >
              {loading ? "Verifying…" : "Verify & continue"}
            </Button>
            <button
              onClick={() => {
                setStage("email");
                setError("");
              }}
              className="w-full text-center text-sm text-slate-400 hover:text-teal-600 mt-3"
            >
              Use a different email
            </button>
          </>
        )}
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
