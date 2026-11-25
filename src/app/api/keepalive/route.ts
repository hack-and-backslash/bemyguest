import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Daily ping (see vercel.json) so Supabase's free plan doesn't pause the
 * database after a quiet week. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (isDemo) return Response.json({ ok: true, demo: true });
  const { error } = await createAdminClient().from("guests").select("id", { head: true, count: "exact" });
  return Response.json({ ok: !error }, { status: error ? 500 : 200 });
}
