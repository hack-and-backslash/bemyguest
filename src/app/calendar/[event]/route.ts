import { wedding } from "@/content/wedding";
import { buildIcs, isCalendarReady } from "@/lib/calendar";
import { getSiteUrl } from "@/lib/site";

export async function GET(_request: Request, ctx: RouteContext<"/calendar/[event]">) {
  const { event } = await ctx.params;
  const target = event.replace(/\.ics$/, "");
  const known = target === "all" || wedding.events.some((e) => e.id === target);
  if (!known || !isCalendarReady(target)) {
    return new Response("Not available", { status: 404 });
  }
  const body = buildIcs(target, await getSiteUrl());
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="bemyguest-${target}.ics"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
