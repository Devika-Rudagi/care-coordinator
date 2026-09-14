"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeftIcon,
  Button,
  Card,
  HeartIcon,
} from "../components/ui";

const supabase = createClient();

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in every field.");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.from("contact_messages").insert({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    });
    setLoading(false);
    if (error) {
      setError("Couldn't send your message. Please try again.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="max-w-lg mx-auto px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-8"
      >
        <ArrowLeftIcon />
        Back to Care Coordinator
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center">
          <HeartIcon />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Contact us
          </h1>
          <p className="text-sm text-slate-500">
            Questions, feedback, or a story to share — we'd like to hear it.
          </p>
        </div>
      </div>

      <Card className="p-6 mt-6">
        {sent ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">📨</div>
            <p className="text-slate-900 font-medium">Message sent</p>
            <p className="text-sm text-slate-500 mt-1">
              Thanks for reaching out — we'll get back to you soon.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Your name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Your email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full h-32 border border-slate-200 rounded-xl px-4 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-none"
                placeholder="How can we help?"
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
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Sending…" : "Send message"}
            </Button>
          </div>
        )}
      </Card>
    </main>
  );
}
