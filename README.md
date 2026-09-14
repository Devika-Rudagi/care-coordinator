# Care Coordinator

A shared, AI-assisted checklist for the weeks right after a hospital discharge — built so every caregiver in a family sees the same up-to-date picture of what needs to happen next, instead of guessing over group texts.

**Live demo:** https://care-coordinator-plum.vercel.app

---

## The problem

The 30 days after a hospital discharge are when hospital readmissions spike — not usually from a lack of information, but from fragmented coordination. Discharge paperwork is dense, and responsibility for following it splits across several people (the patient, adult children, sometimes a home aide) with no single shared source of truth. A missed medication, a forgotten follow-up, or an unnoticed warning sign often comes down to nobody being sure who was tracking what.

Care Coordinator turns that paperwork into one live, shared checklist that an entire care circle can act on together.

## What it does

- **AI-powered intake** — paste discharge instructions as text, or upload a photo/PDF. A structured extraction call (Google Gemini, JSON-schema-constrained) pulls out medications, follow-up appointments, and symptoms to watch for.
- **Human review before anything is trusted** — extracted items appear as editable draft cards. Nothing becomes a real task until a caregiver explicitly confirms it, including setting a real date/time for anything the AI couldn't infer confidently.
- **Real-time multi-caregiver sync** — every caregiver on a patient's care circle sees the same live checklist. Marking a task done updates everyone else's view instantly, with attribution ("✓ done by Sarah").
- **Invite-based access control** — a patient (or existing caregiver) invites someone by email; that person only gains access once they log in with that exact email and accept. Logging in proves identity; accepting an invite proves authorization.
- **A separate, frictionless view for the patient themselves** — large tap targets, no login required, so the person actually recovering isn't managed *around* but can participate directly.
- **Editable after the fact** — medications, follow-ups, and watch items can all be edited (dosage, frequency, guidance, and the scheduled date/time) after creation, not just marked done.
- **Browser notifications** — both caregivers and the patient get reminded when something is due or overdue, with the patient's name and item details in the notification itself.
- **Admin dashboard** — a role-gated, cross-patient view showing overdue tasks bucketed by severity, caregiver workload, and patients sorted by urgency — with search, filter, and sortable columns.
- **Patient criticality tagging** — an independent "needs extra care" flag alongside a criticality level, both editable inline.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth — email + one-time code, no password |
| Real-time | Supabase Realtime |
| Access control | Postgres Row Level Security |
| AI | Google Gemini API (structured/JSON-schema-constrained extraction, multimodal input) |
| Email | Resend (transactional invite emails) |
| Deployment | Vercel |

## Architecture notes worth knowing

- **Recurring tasks use a template/instance split.** `task_templates` holds the rule ("metformin, twice daily"); `task_instances` holds each actual day's occurrence. This is the correct model for anything recurring — conflating the two is a common mistake.
- **A cadence parser translates clinical shorthand.** Frequencies like `Q6H`, `BID`, `PRN`, and stated duration limits (`× 5 days`) are parsed into correctly scheduled instances, with PRN taking priority even when a max frequency is also stated.
- **Reads are broadly open by design; writes are scoped.** Most tables are readable by anyone with a patient's link (this is what makes the unauthenticated patient view possible), but writes require confirmed, authenticated care-circle membership. This is a deliberate trade-off, not an oversight — it's stated explicitly wherever it applies.
- **Local time is handled via the browser's own `Date` object**, not manual UTC offset math — reading and writing scheduled times converts automatically and correctly regardless of the viewer's timezone.

## Getting started

### Prerequisites
- Node.js 18+
- A Supabase project
- A Google Gemini API key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))
- A Resend API key ([resend.com](https://resend.com)) for invite emails

### Environment variables

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-gemini-api-key
RESEND_API_KEY=your-resend-api-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Database setup

This project's schema and Row Level Security policies were built incrementally in the Supabase SQL Editor rather than as versioned migration files. Core tables: `patients`, `care_circle_members`, `task_templates`, `task_instances`, `watch_items`, `profiles`, `contact_messages`, `extraction_events`. Each table has RLS enabled with policies matching the open-read/scoped-write pattern described above.
**Known gap:** consolidating these into a single versioned migration file is a real next step for anyone forking this repo.

### Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

### Supabase Auth configuration

- Enable the **Email** provider under Authentication → Providers.
- Add `http://localhost:3000/auth/confirm` (and your production URL's equivalent) under Authentication → URL Configuration → Redirect URLs.
- Configure custom SMTP (Authentication → SMTP Settings) if you hit Supabase's default sender rate limit during testing.

## Known limitations

- **Invite emails currently only deliver reliably to the sender's own verified email** unless a custom domain is verified with Resend — a real constraint on inviting external testers right now.
- **No true push notifications** — browser notifications only fire while the tab is open; a production version would need a service worker or server-side push.
- **"Responsible caregiver" is circle-level, not task-level** — the data model doesn't support assigning one specific task to one specific person, only to a patient's whole care circle.
- **No formal test suite** — this was built and validated through direct manual testing and real usage, not automated tests.

## Why this exists

Built as a rapid, focused product build exploring how AI can assist with a genuinely high-stakes coordination problem — with a deliberate design principle throughout: AI proposes, humans confirm; the system should coordinate people, not replace their judgment.
