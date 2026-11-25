import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/data";
import { phaseFor } from "@/lib/booth/viewer-phase";
import { getClock } from "@/lib/clock";
import { getControls } from "@/lib/controls";
import { boothBytes, boothStats, countGuestPhotos, countNewer, getPhoto, listFeed, topThree } from "@/lib/booth/data";
import { MAX_BYTES } from "@/lib/booth/storage";

/**
 * The booth's live data, fetched by the phone:
 *   ?cursor=…&mine=1   next page of the feed
 *   ?poll=<iso>        new-photo count, stats and the top 3 (every ~20 s)
 *   ?photo=<id>        one photo (for shared links)
 *   ?allowance=1       how many more photos I can share, and whether the booth is full or paused
 */
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (viewer.guest.blocked || viewer.waiting) return NextResponse.json({ error: "Not available." }, { status: 403 });

  const q = request.nextUrl.searchParams;
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const poll = q.get("poll");
    if (poll !== null) {
      const [{ phase }, { now }] = await Promise.all([phaseFor(viewer), getClock(viewer)]);
      const [newer, stats, top] = await Promise.all([
        poll ? countNewer(viewer, poll) : Promise.resolve(0),
        boothStats(viewer),
        topThree(viewer, phase, now),
      ]);
      return NextResponse.json({ newer, stats, top }, { headers });
    }

    if (q.get("allowance") !== null) {
      const [mine, bytes, c] = await Promise.all([countGuestPhotos(viewer), boothBytes(), getControls()]);
      return NextResponse.json(
        {
          left: Math.max(0, c.boothMaxPerGuest - mine),
          max: c.boothMaxPerGuest,
          full: bytes + MAX_BYTES > c.boothBudgetMB * 1_000_000,
          paused: c.boothPaused && !viewer.isAdmin,
        },
        { headers },
      );
    }

    const photoId = q.get("photo");
    if (photoId) {
      const photo = await getPhoto(viewer, photoId);
      return photo
        ? NextResponse.json({ photo }, { headers })
        : NextResponse.json({ error: "That photo isn't here any more." }, { status: 404, headers });
    }

    const page = await listFeed(viewer, { cursor: q.get("cursor"), mine: q.get("mine") === "1" });
    return NextResponse.json(page, { headers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't load the booth." },
      { status: 500, headers },
    );
  }
}
