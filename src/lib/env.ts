export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * Demo mode: no Supabase keys yet. The site runs with sample data kept in
 * memory (lost on restart) and "Continue with Google" signs you in as Sam.
 */
export const isDemo = !supabaseUrl || !supabasePublishableKey;

/** Comma-separated Google emails that can open /admin. */
export const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined) {
  if (isDemo) return true;
  return !!email && adminEmails.includes(email.toLowerCase());
}

export const DEMO_COOKIE = "goa_demo_session";
