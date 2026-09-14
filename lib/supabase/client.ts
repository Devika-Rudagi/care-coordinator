import { createBrowserClient } from "@supabase/ssr";

// Session-aware browser client — used by every Client Component that needs
// to know "who's logged in" (the caregiver dashboard, intake, login page).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
