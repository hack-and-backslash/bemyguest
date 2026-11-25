import Link from "next/link";
import { Icon } from "@/components/Icon";
import type { BoothPhase } from "@/lib/booth/phase";
import { cx } from "@/lib/ui";
import { setBoothPreviewAction } from "./actions";

const stages: { phase: BoothPhase; label: string }[] = [
  { phase: "teaser", label: "Before" },
  { phase: "open", label: "Weekend" },
  { phase: "closed", label: "After" },
];

/** For the couple, testers during rehearsal, and demo mode: flip between the booth's three stages. */
export function PreviewBar({
  phase,
  real,
  demo,
  couple,
}: {
  phase: BoothPhase;
  real: BoothPhase;
  demo: boolean;
  couple: boolean;
}) {
  return (
    <div className="mx-auto mb-4 flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 lg:px-8">
      <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink-soft">
        <Icon name="eye" size={16} strokeWidth={2} />
        {demo ? "Demo: see each stage" : couple ? "Just you two: preview as" : "Testing: preview as"}
      </span>
      <form action={setBoothPreviewAction} className="flex gap-1.5">
        {stages.map((s) => (
          <button
            key={s.phase}
            name="phase"
            value={s.phase}
            aria-pressed={phase === s.phase}
            className={cx(
              "min-h-9 rounded-full px-3 text-[13px] font-semibold",
              phase === s.phase ? "bg-ink text-white" : "border-[1.5px] border-sand-300 bg-sand-50 text-ink",
            )}
          >
            {s.label}
            {s.phase === real && <span className="font-normal opacity-75"> (now)</span>}
          </button>
        ))}
      </form>
      {couple && (
        <Link href="/admin/booth" className="ml-auto text-[13px] font-semibold">
          Booth control
        </Link>
      )}
    </div>
  );
}
