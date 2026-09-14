import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Session-aware server client — reads the caregiver's auth cookie so
// Server Components can query with the right identity for RLS to apply.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render — safe to ignore since
            // middleware.ts refreshes the session on every request instead.
          }
        },
      },
    },
  );
}
