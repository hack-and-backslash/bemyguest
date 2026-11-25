"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, isDemo } from "@/lib/env";
import { getSiteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export async function signInWithGoogle() {
  if (isDemo) {
    const jar = await cookies();
    jar.set(DEMO_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    redirect("/");
  }

  const supabase = await createClient();
  const origin = await getSiteUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}
