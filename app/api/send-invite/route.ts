import { NextResponse } from "next/server";

// Sends a real notification email when someone is added to a patient's
// care circle — separate from Supabase's own auth emails (login codes),
// since this is a custom transactional message, not a login flow.
export async function POST(request: Request) {
  const { toEmail, inviteeName, patientName } = await request.json();

  if (!toEmail || !patientName) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Care Coordinator <onboarding@resend.dev>",
        to: toEmail,
        subject: `You've been added to ${patientName}'s care circle`,
        html: `
          <p>Hi ${inviteeName || "there"},</p>
          <p>You've been added as a caregiver for <strong>${patientName}</strong> on Care Coordinator.</p>
          <p>Sign in with this email address (${toEmail}) to view and help manage their care checklist.</p>
          <p><a href="${siteUrl}/login">Sign in to Care Coordinator →</a></p>
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend API error:", errText);
      return NextResponse.json({ error: errText }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("send-invite failed:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
