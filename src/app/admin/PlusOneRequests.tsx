import { coupleNames, wedding } from "@/content/wedding";
import { CopyButton } from "@/components/CopyButton";
import { formatDateSpan, firstName } from "@/lib/format";
import { emailIndex, requestLabels, statusOf } from "@/lib/stats";
import type { AdminRow, PlusOneRequest, PlusOneStatus } from "@/lib/types";
import { cx } from "@/lib/ui";
import { decidePlusOneAction } from "./actions";

const order: Record<PlusOneStatus, number> = { pending: 0, approved: 1, declined: 2 };
const chip: Record<PlusOneStatus, string> = {
  pending: "bg-sun-100 text-ink",
  approved: "bg-sea-200 text-sea-800",
  declined: "bg-sand-200 text-ink-soft",
};

function inviteMessage(q: PlusOneRequest, host: string, siteUrl: string) {
  return (
    `Hi ${firstName(q.name)}! ${host} asked to bring you to our wedding in Goa (${formatDateSpan()} ${wedding.days[0].date.slice(0, 4)}), and we'd love to have you there. ` +
    `Here's our wedding site: ${siteUrl}\n\nSign in with Google using ${q.email} so we know it's you, then tell us your plans on the RSVP page. ` +
    `See you by the sea!\n${coupleNames}`
  );
}

/** Where the +1 themselves are at, matched by the email they were asked with. */
function theirProgress(them: AdminRow | undefined, rehearsal: boolean) {
  if (!them) return rehearsal ? "Not signed in yet (they can get in once you go live)" : "Not signed in yet";
  switch (statusOf(them)) {
    case "coming":
      return "Signed in and RSVP'd: coming";
    case "declined":
      return "Signed in and RSVP'd: can't make it";
    case "waiting":
      return "Signed in, waiting for you to go live (or add them as a tester)";
    case "removed":
      return "Signed in, but you removed them";
    default:
      return "Signed in, RSVP not finished";
  }
}

function Decide({ guestId, status, label, tone }: { guestId: string; status: PlusOneStatus; label: string; tone: "sea" | "plain" }) {
  return (
    <form action={decidePlusOneAction}>
      <input type="hidden" name="guestId" value={guestId} />
      <input type="hidden" name="status" value={status} />
      <button className={cx("btn btn-sm", tone === "sea" ? "btn-sea" : "btn-outline")}>{label}</button>
    </form>
  );
}

export function PlusOneRequests({ rows, rehearsal, siteUrl }: { rows: AdminRow[]; rehearsal: boolean; siteUrl: string }) {
  const asking = rows
    .filter((r): r is AdminRow & { request: PlusOneRequest } => !!r.request)
    .sort((a, b) => order[a.request.status] - order[b.request.status] || b.request.requestedAt.localeCompare(a.request.requestedAt));
  const byEmail = emailIndex(rows);
  const pending = asking.filter((r) => r.request.status === "pending").length;

  return (
    <section aria-labelledby="plus-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="plus-title" className="font-serif text-[28px]">
          Plus-one requests{" "}
          {pending > 0 && <span className="rounded-full bg-sun-100 px-2.5 py-0.5 align-middle font-sans text-base font-bold">{pending} to decide</span>}
        </h2>
        <p className="max-w-3xl text-sm text-ink-soft">
          Guests asking to bring someone. Declining is silent: they keep seeing &ldquo;requested&rdquo;, so tell them
          yourselves. Once you approve, copy the invite and send it on WhatsApp; the +1 then signs in and RSVPs for
          themselves.
        </p>
      </div>
      {asking.length === 0 ? (
        <p className="text-ink-soft">No requests yet.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {asking.map((r) => {
            const q = r.request;
            const host = r.displayName.trim() ? firstName(r.displayName) : r.email;
            const hostStatus = statusOf(r);
            return (
              <li key={r.id} className={cx("flex flex-col gap-3 rounded-3xl bg-sand-50 p-5 shadow-[var(--shadow-rest)]", q.status === "declined" && "opacity-75")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[17px] font-bold">{q.name}</span>
                    <span className="truncate text-sm text-ink-soft">{q.email}</span>
                  </div>
                  <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold", chip[q.status])}>{requestLabels[q.status]}</span>
                </div>
                <p className="text-sm">
                  Asked by <b>{host}</b>
                  {hostStatus === "declined" && <span className="text-coral-800"> (who can&apos;t make it now)</span>}
                  {hostStatus === "deciding" && <span className="text-ink-soft"> (RSVP not finished)</span>}
                </p>
                {q.status === "approved" && <p className="text-sm text-ink-soft">{theirProgress(byEmail.get(q.email), rehearsal)}</p>}
                <div className="flex flex-wrap gap-2">
                  {q.status !== "approved" && <Decide guestId={r.id} status="approved" label="Approve" tone="sea" />}
                  {q.status === "approved" && <CopyButton text={inviteMessage(q, host, siteUrl)} label="Copy invite message" className="btn-outline-sea" />}
                  {q.status !== "declined" && <Decide guestId={r.id} status="declined" label="Decline" tone="plain" />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
