import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Handles the click-through from the magic-link email. Supabase appends
// token_hash and type to whatever emailRedirectTo we passed in, so this
// route exists purely to verify that token and hand back a real session —
// no SMTP/template access needed, unlike the 6-digit-code approach.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const redirectTo = searchParams.get("redirect_to") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirect(redirectTo);
    }
  }

  redirect("/login?error=invalid_link");
}
