import { Icon } from "@/components/Icon";
import type { Note } from "@/lib/types";
import { cx, noteBg } from "@/lib/ui";

const tilts = [-2.5, 1.8, -1.2, 2.4, -1.8, 1.2, -2.2, 2];
const pins = ["bg-coral-600", "bg-sky-700", "bg-sea-700", "bg-[#E8893C]"];
const stickerColor = { heart: "text-coral-600", shell: "text-sea-700", sun: "text-[#B26A14]" } as const;

export function StickyNote({
  note,
  index,
  size = "md",
  fresh = false,
  action,
}: {
  note: Note;
  index: number;
  size?: "sm" | "md";
  fresh?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <article
      className={cx(
        "relative flex flex-col justify-between gap-3 rounded-md shadow-[0_8px_18px_rgb(31_58_61/0.12)] transition-shadow duration-300 hover:shadow-[0_16px_30px_rgb(31_58_61/0.18)]",
        noteBg[note.color],
        size === "md" ? "min-h-[150px] px-5 pt-7 pb-4 lg:min-h-[168px]" : "min-h-[100px] px-4 pt-5 pb-3",
        fresh && "animate-pin-in",
        note.hidden && "opacity-50",
      )}
      style={{ rotate: `${tilts[index % tilts.length]}deg` }}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute top-2.5 left-1/2 -ml-[7px] size-3.5 rounded-full shadow-[0_2px_3px_rgb(31_58_61/0.3)]",
          pins[index % pins.length],
        )}
      />
      <p className={cx("font-script leading-[1.3] break-words", size === "md" ? "text-[19px] lg:text-[21px]" : "text-[17px]")}>
        {note.body}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className={cx("font-bold", size === "md" ? "text-sm" : "text-[13px] text-ink-soft")}>— {note.authorName}</span>
        <span className="flex items-center gap-1">
          {note.sticker !== "none" && (
            <span className={stickerColor[note.sticker]}>
              <Icon name={note.sticker} size={size === "md" ? 26 : 20} strokeWidth={2} />
            </span>
          )}
          {action}
        </span>
      </div>
    </article>
  );
}
