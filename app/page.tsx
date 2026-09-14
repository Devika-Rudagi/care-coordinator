import { redirect } from "next/navigation";
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
  criticalityTone,
} from "./components/ui";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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

  // The name they typed when creating a patient or accepting an invite —
  // falls back to their email only if they have no membership rows yet
  // (e.g. signed in with only a pending invite, not yet accepted).
  const displayName = memberships?.[0]?.name || user.email;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = profile?.is_admin ?? false;

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
