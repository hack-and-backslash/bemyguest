import Link from "next/link";
import { Icon } from "@/components/Icon";
import { formatStamp } from "@/lib/format";
import { setPreviewAction } from "@/app/(guest)/actions";

/** The couple's announcement, across the top of every guest page. */
export function Announcement({ text, at }: { text: string; at: string | null }) {
  if (!text) return null;
  return (
    <div role="status" className="flex items-start gap-2.5 bg-sun-100 px-4 py-3 text-[15px] lg:items-center lg:justify-center lg:px-12">
      <Icon name="pin" size={20} className="mt-0.5 shrink-0 text-coral-600 lg:mt-0" />
      <p className="font-semibold">
        {text}
        {at && <span className="ml-2 text-[13px] font-normal whitespace-nowrap text-ink-soft">{formatStamp(at)}</span>}
      </p>
    </div>
  );
}

/** Shown while the couple (or a tester) previews the site at another moment. */
export function PreviewStrip({ now, couple }: { now: number; couple: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-2 text-sm text-white">
      <span className="flex items-center gap-1.5 font-semibold">
        <Icon name="eye" size={16} strokeWidth={2} />
        Previewing the site as on {formatStamp(new Date(now).toISOString())}
      </span>
      <span className="text-white/75">Only you see this. Saving still works as normal.</span>
      {couple && (
        <Link href="/admin/settings#preview" className="font-semibold text-sun-300 hover:text-sun-100">
          Change
        </Link>
      )}
      <form action={setPreviewAction}>
        <input type="hidden" name="at" value="now" />
        <button className="font-semibold text-sun-300 underline-offset-2 hover:underline">Back to now</button>
      </form>
    </div>
  );
}
