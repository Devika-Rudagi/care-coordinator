import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import SignOutButton from "./components/SignOutButton";
import {
  Avatar,
  Badge,
  Button,
  Card,
  PlusIcon,
  HeartIcon,
  EmptyStateIllustration,
  CoordinationIllustration,
  ChecklistIllustration,
  SparkleIcon,
  CheckIcon,
  UserIcon,
  criticalityTone,
} from "./components/ui";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="max-w-5xl mx-auto px-6">
        {/* Hero */}
        <section className="grid md:grid-cols-2 gap-10 items-center py-16 md:py-24">
          <div>
            <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <SparkleIcon className="w-3.5 h-3.5" />
              AI-assisted, human-confirmed
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 leading-tight mb-5">
              Everyone on the same page, from day one home.
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              Care Coordinator turns confusing hospital discharge paperwork
              into one shared, live checklist — so every caregiver in a
              family knows exactly what's been done, and what's next.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login">
                <Button variant="primary" size="lg">
                  Sign in to get started
                </Button>
              </Link>
              <Link href="/about">
                <Button variant="secondary" size="lg">
                  How it works
                </Button>
              </Link>
            </div>
          </div>
          <CoordinationIllustration />
        </section>

        {/* Why this exists */}
        <section className="py-14 border-t border-slate-100">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <ChecklistIllustration />
            <div>
              <h2 className="text-sm font-medium text-teal-700 uppercase tracking-wide mb-3">
                The problem
              </h2>
              <p className="text-2xl font-medium text-slate-900 leading-snug mb-4">
                Hospital readmissions spike in the 30 days after
                discharge — usually not from a lack of information, but
                from nobody being sure who's tracking what.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Discharge instructions get split across family members who
                each see only part of the picture. Care Coordinator gives
                everyone the same live view instead.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-14 border-t border-slate-100">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-8 text-center">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
                <SparkleIcon className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-slate-900 mb-1.5">
                Paste or photograph paperwork
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                AI reads discharge instructions and pulls out medications,
                follow-ups, and warning signs automatically.
              </p>
            </Card>
            <Card className="p-6">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <CheckIcon className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-slate-900 mb-1.5">
                A human confirms every item
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Nothing becomes a real task until a caregiver reviews it —
                AI proposes, a person always decides.
              </p>
            </Card>
            <Card className="p-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <UserIcon className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-slate-900 mb-1.5">
                Everyone stays in sync
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Caregivers see updates live. The patient gets their own
                simple view — no login needed.
              </p>
            </Card>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="py-16 text-center border-t border-slate-100">
          <h2 className="text-2xl font-medium text-slate-900 mb-3">
            Ready to bring your family's care team together?
          </h2>
          <Link href="/login">
            <Button variant="primary" size="lg" className="mt-2">
              Sign in with your email
            </Button>
          </Link>
        </section>
      </main>
    );
  }

  // Two explicit queries instead of PostgREST's nested-select shorthand —
  // easier to debug, and avoids relying on foreign-key relationship
  // auto-detection silently failing.
  const { data: memberships, error: membershipError } = await supabase
    .from("care_circle_members")
    .select("patient_id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const patientIds = Array.from(
    new Set((memberships ?? []).map((m) => m.patient_id)),
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, name")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = profile?.is_admin ?? false;

  // Priority: the caregiver's own saved profile name (Task 2) > a name
  // recorded against a specific patient's care circle > their raw email
  // as a last resort. Profile name wins first since it's their own
  // stated identity, not tied to any one patient.
  const displayName = profile?.name || memberships?.[0]?.name || user.email;

  let patients: any[] = [];
  let patientsError: any = null;
  if (patientIds.length > 0) {
    const res = await supabase.from("patients").select("*").in("id", patientIds);
    patients = res.data ?? [];
    patientsError = res.error;
  }

  // Pending invites for this exact email, across ALL patients — this is
  // the discoverability fix: since there's no invite email sent yet,
  // this is the only place a newly invited caregiver can find out they
  // were invited at all, without needing a direct link.
  let pendingInvites: any[] = [];
  if (user.email) {
    const { data: inviteRows } = await supabase
      .from("care_circle_members")
      .select("id, patient_id, name")
      .is("user_id", null)
      .ilike("invited_email", user.email);

    if (inviteRows && inviteRows.length > 0) {
      const invitePatientIds = inviteRows.map((r) => r.patient_id);
      const { data: invitePatients } = await supabase
        .from("patients")
        .select("id, name, diagnosis")
        .in("id", invitePatientIds);

      pendingInvites = inviteRows.map((invite) => ({
        ...invite,
        patient: invitePatients?.find((p) => p.id === invite.patient_id),
      }));
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <header className="flex items-start justify-between mb-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-900/20">
            <HeartIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Care Coordinator
            </h1>
            <p className="text-sm text-slate-500">
              Everyone on the same page, from day one home.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Link
              href="/profile"
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-1.5 pr-3.5 py-1.5 hover:border-teal-300 hover:shadow-sm transition-all"
            >
              <Avatar name={displayName} size="sm" />
              <span className="text-sm font-medium text-slate-700 hidden sm:inline">
                {displayName}
              </span>
            </Link>

            {/* Hover-reveal dropdown — invisible bridge (pt-2) keeps the
                hover state alive while moving the cursor down to it */}
            <div className="absolute right-0 top-full w-full pt-2 hidden group-hover:block z-10">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-lg shadow-slate-900/10 overflow-hidden">
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="block w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100"
                  >
                    Admin dashboard
                  </Link>
                )}
                <SignOutButton variant="menu-item" />
              </div>
            </div>
          </div>

          <Link href="/new-patient">
            <Button variant="primary" size="md">
              <PlusIcon />
              Add patient
            </Button>
          </Link>
        </div>
      </header>

      {pendingInvites.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-teal-700 uppercase tracking-wide mb-3">
            You've been invited
          </h2>
          <div className="space-y-3">
            {pendingInvites.map((invite) => (
              <Link key={invite.id} href={`/patient/${invite.patient_id}`}>
                <Card className="p-4 flex items-center gap-4 border-teal-200 bg-teal-50/50 hover:border-teal-400 transition-colors">
                  <Avatar name={invite.patient?.name || "?"} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900">
                      {invite.patient?.name}
                    </div>
                    <div className="text-sm text-slate-500">
                      Invited as {invite.name} — tap to accept
                    </div>
                  </div>
                  <Badge tone="teal">New</Badge>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
          Patients you're tracking
        </h2>
        {patients.length > 0 && (
          <Badge tone="slate">{patients.length} total</Badge>
        )}
      </div>

      {(membershipError || patientsError) && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-2.5 mb-4">
          Couldn't load your patients: {membershipError?.message || patientsError?.message}
        </div>
      )}

      {patients.length === 0 && pendingInvites.length === 0 && (
        <Card className="p-12 text-center">
          <EmptyStateIllustration />
          <p className="text-slate-600 font-medium mt-4">No patients yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-6">
            Add the first patient to start building their care checklist.
          </p>
          <Link href="/new-patient">
            <Button variant="primary">
              <PlusIcon />
              Add your first patient
            </Button>
          </Link>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {patients.map((p, i) => (
          <Link
            key={p.id}
            href={`/patient/${p.id}`}
            className="animate-fade-in-up"
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <Card className="p-4 flex items-center gap-4 hover:border-teal-300 hover:shadow-md hover:shadow-teal-900/5 hover:-translate-y-0.5 transition-all">
              <Avatar name={p.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="font-medium text-slate-900 truncate">
                    {p.name}
                  </div>
                  {p.needs_extra_care && (
                    <span title="Needs extra care" className="text-blue-500">
                      ●
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500 truncate">
                  {p.diagnosis || "No diagnosis noted"}
                </div>
              </div>
              <Badge tone={criticalityTone[p.criticality] ?? "slate"}>
                {p.criticality ?? "medium"}
              </Badge>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
