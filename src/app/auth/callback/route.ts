import { NextResponse, type NextRequest } from "next/server";
import { isDemo } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Google sends guests back here; we swap the one-time code for a session cookie. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const origin =
    process.env.NODE_ENV === "development" || !forwardedHost ? url.origin : `https://${forwardedHost}`;

  const code = url.searchParams.get("code");
  if (!isDemo && code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
