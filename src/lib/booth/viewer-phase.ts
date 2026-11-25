import "server-only";
import { isDemo } from "@/lib/env";
import { getControls } from "@/lib/controls";
import { getClock } from "@/lib/clock";
import type { Viewer } from "@/lib/types";
import { boothPhase, type BoothPhase } from "@/lib/booth/phase";

export type PhaseView = { phase: BoothPhase; real: BoothPhase; preview: boolean };

/** The booth stage to show this viewer: the real one, or the one at their preview moment. */
export async function phaseFor(viewer: Viewer | null): Promise<PhaseView> {
  const [controls, clock] = await Promise.all([getControls(), getClock(viewer)]);
  const real = boothPhase(controls, Date.now());
  if (clock.preview) return { phase: boothPhase(controls, clock.now), real, preview: true };
  // Demo mode shows the booth open, since that's the fun part.
  if (isDemo) return { phase: "open", real, preview: real !== "open" };
  return { phase: real, real, preview: false };
}

/** The booth bar's Before / Weekend / After buttons pick a moment in that stage (null: the real now). */
export function momentFor(phase: BoothPhase, times: { boothOpensAt: string; boothClosesAt: string }, real: BoothPhase) {
  if (phase === real) return null;
  const opens = Date.parse(times.boothOpensAt);
  const closes = Date.parse(times.boothClosesAt);
  if (phase === "teaser") return opens - 2 * 86_400_000;
  if (phase === "open") return Math.min(opens + 12 * 3_600_000, (opens + closes) / 2);
  return closes + 3_600_000;
}
