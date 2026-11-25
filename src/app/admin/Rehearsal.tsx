import { Icon } from "@/components/Icon";
import type { Access } from "@/lib/access";
import type { AdminRow } from "@/lib/types";
import { letInAction, removeTesterAction } from "./actions";
import { AddTester, ClearData, GoLive } from "./RehearsalForms";

/** The dashboard's rehearsal card: who can get in, clear the test data, go live. */
export function Rehearsal({ access, couple, waiting }: { access: Access; couple: string[]; waiting: AdminRow[] }) {
  return (
    <section aria-labelledby="rehearsal-title" className="card flex flex-col gap-6 rounded-[28px] border-2 border-dashed border-sun-300 p-5 lg:p-7">
      <div className="flex flex-col gap-1.5">
        <span className="self-start rounded-full bg-sun-100 px-3 py-1 text-[13px] font-bold">Rehearsal mode</span>
        <h2 id="rehearsal-title" className="font-serif text-[28px] leading-tight">
          Only you and your testers can get in
        </h2>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          Anyone else who signs in sees an &ldquo;almost ready&rdquo; page. Everything testers do is test data: clear it
          whenever you like, and again when you go live. Testers can also preview the photo booth before it opens.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-[17px] font-bold">Testers ({access.testers.length})</h3>
        <ul className="flex flex-wrap gap-2">
          {couple.map((email) => (
            <li key={email} className="flex min-h-10 items-center gap-1.5 rounded-full bg-sea-200 px-3.5 text-sm font-semibold">
              <Icon name="ring" size={16} />
              {email}
              <span className="font-normal text-ink-soft">(you)</span>
            </li>
          ))}
          {access.testers.map((email) => (
            <li key={email} className="flex min-h-10 items-center gap-1 rounded-full bg-sand-50 pl-3.5 text-sm font-semibold shadow-[var(--shadow-rest)]">
              {email}
              <form action={removeTesterAction}>
                <input type="hidden" name="email" value={email} />
                <button
                  aria-label={`Remove ${email}`}
                  title="Remove"
                  className="flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-black/5 hover:text-ink"
                >
                  <Icon name="close" size={16} strokeWidth={2} />
                </button>
              </form>
            </li>
          ))}
        </ul>
        <AddTester />
        {waiting.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl bg-sky-200 p-4">
            <p className="text-sm font-semibold">
              Signed in but not let in yet ({waiting.length}). Add them as testers, or they&apos;ll get in when you go live:
            </p>
            <ul className="flex flex-col gap-1.5">
              {waiting.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span>
                    <b>{r.displayName || "No name"}</b> <span className="text-ink-soft">{r.email}</span>
                  </span>
                  <LetIn email={r.email} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ClearData />
        <GoLive />
      </div>
    </section>
  );
}

/** One-click "add as tester" for someone already waiting. */
function LetIn({ email }: { email: string }) {
  return (
    <form action={letInAction}>
      <input type="hidden" name="email" value={email} />
      <button className="min-h-9 rounded-full bg-sand-50 px-3 text-[13px] font-semibold text-sea-800 hover:bg-white">Let in</button>
    </form>
  );
}
