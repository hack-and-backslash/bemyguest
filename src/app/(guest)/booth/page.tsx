import type { Metadata } from "next";
import { getViewer } from "@/lib/data";
import { isDemo } from "@/lib/env";
import { canPreview, getClock } from "@/lib/clock";
import { getControls } from "@/lib/controls";
import { boothStats, countGuestPhotos, getPhoto, listFeed, topThree } from "@/lib/booth/data";
import { phaseFor } from "@/lib/booth/viewer-phase";
import { BoothFeed } from "./BoothFeed";
import { BoothTeaser } from "./BoothTeaser";
import { PreviewBar } from "./PreviewBar";

export const metadata: Metadata = { title: "Photo Booth" };

export default async function BoothPage({ searchParams }: PageProps<"/booth">) {
  const viewer = (await getViewer())!;
  const [{ phase, real }, { now }, controls, previewer] = await Promise.all([
    phaseFor(viewer),
    getClock(viewer),
    getControls(),
    canPreview(viewer),
  ]);
  const bar = previewer && <PreviewBar phase={phase} real={real} demo={isDemo} couple={viewer.isAdmin} />;

  if (phase === "teaser") {
    return (
      <>
        {bar}
        <BoothTeaser now={now} opensAt={controls.boothOpensAt} />
      </>
    );
  }

  const { photo } = await searchParams;
  const [page, stats, top, mine] = await Promise.all([
    listFeed(viewer),
    boothStats(viewer),
    topThree(viewer, phase, now),
    countGuestPhotos(viewer),
  ]);
  const wanted = typeof photo === "string" ? photo : null;
  const initialPhoto =
    wanted && !page.photos.some((p) => p.id === wanted) && !top.photos.some((p) => p.id === wanted)
      ? await getPhoto(viewer, wanted)
      : null;

  return (
    <>
      {bar}
      <BoothFeed
        phase={phase}
        initial={page}
        initialStats={stats}
        initialTop={top}
        initialMine={mine}
        initialPhoto={initialPhoto}
        loadedAt={new Date(now).toISOString()}
      />
    </>
  );
}
