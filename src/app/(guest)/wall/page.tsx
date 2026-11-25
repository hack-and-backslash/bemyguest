import type { Metadata } from "next";
import { Avatar } from "@/components/Avatar";
import { FairyLights } from "@/components/Decor";
import { Icon } from "@/components/Icon";
import { StickyNote } from "@/components/StickyNote";
import { getConfirmedGuests, getViewer, listNotes } from "@/lib/data";
import { firstName } from "@/lib/format";
import { deleteNoteAction } from "../actions";
import { NoteComposer } from "./NoteComposer";

export const metadata: Metadata = { title: "Who's coming" };

export default async function WallPage() {
  const viewer = (await getViewer())!;
  const [guests, notes] = await Promise.all([getConfirmedGuests(), listNotes(viewer.guest.id)]);
  // eslint-disable-next-line react-hooks/purity -- server render: "fresh" notes get the pin-in animation
  const now = Date.now();

  return (
    <>
      <section className="relative flex flex-col items-center gap-2.5 px-5 pt-12 pb-2 text-center lg:pt-16">
        <FairyLights className="absolute inset-x-0 top-0 h-12 lg:h-[90px]" />
        <p className="kicker text-[24px] text-sea-700 lg:text-[32px]">The crew is assembling</p>
        <h1 className="font-serif text-[40px] leading-[1.08] lg:text-[60px]">Who&apos;s coming</h1>
        <p className="max-w-[640px] text-lg leading-relaxed text-pretty text-ink-soft lg:text-[19px]">
          Everyone who&apos;s said yes shows up here. Leave us a little note — we&apos;ll read every single one (probably
          twice).
        </p>
      </section>

      <section aria-labelledby="yes-title" className="flex flex-col items-center gap-5 px-4 pt-6 pb-10 lg:pb-12">
        <h2 id="yes-title" className="text-[17px] font-bold tracking-[0.04em]">
          {guests.length === 1 ? "1 guest said yes" : `${guests.length} guests said yes`}
        </h2>
        {guests.length > 0 ? (
          <ul className="flex max-w-full gap-4 overflow-x-auto px-2 pt-2 pb-3 lg:flex-wrap lg:justify-center lg:overflow-visible">
            {guests.slice(0, 24).map((g, i) => (
              <li key={`${g.displayName}-${i}`} className="flex w-[72px] shrink-0 flex-col items-center gap-2 transition-transform duration-300 ease-[var(--ease-spring)] hover:-translate-y-1">
                <Avatar name={g.displayName} url={g.avatarUrl} size={60} ringed />
                <span className="w-full truncate text-center text-sm font-semibold">{g.displayName}</span>
              </li>
            ))}
            {guests.length > 24 && (
              <li className="flex w-[72px] shrink-0 flex-col items-center gap-2">
                <span className="flex size-[60px] items-center justify-center rounded-full border-2 border-dashed border-sea-700 font-bold text-sea-700">
                  +{guests.length - 24}
                </span>
                <span className="text-sm font-semibold text-ink-soft">more</span>
              </li>
            )}
          </ul>
        ) : (
          <p className="text-ink-soft">Nobody yet. RSVP and you&apos;ll be first on the wall!</p>
        )}
      </section>

      <section aria-label="Guestbook" className="grid items-start gap-8 px-3 pb-16 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10 lg:px-28 lg:pb-20">
        <NoteComposer authorName={firstName(viewer.guest.displayName)} avatarUrl={viewer.guest.avatarUrl} />

        <div className="wall-board grid grid-cols-2 content-start gap-x-3.5 gap-y-5 rounded-[28px] px-3.5 pt-6 pb-8 sm:grid-cols-3 lg:gap-x-6 lg:gap-y-7 lg:rounded-[36px] lg:px-8 lg:pt-9 lg:pb-11">
          {notes.length === 0 && (
            <p className="col-span-full py-10 text-center font-script text-2xl text-ink-soft">
              The wall is empty… for now. Be the first!
            </p>
          )}
          {notes.map((n, i) => {
            const mine = n.guestId === viewer.guest.id;
            return (
              <StickyNote
                key={n.id}
                note={mine ? { ...n, authorName: `${n.authorName} (you)` } : n}
                index={i}
                fresh={now - new Date(n.createdAt).getTime() < 15_000}
                action={
                  mine ? (
                    <form action={deleteNoteAction}>
                      <input type="hidden" name="noteId" value={n.id} />
                      <button
                        type="submit"
                        aria-label="Delete my note"
                        className="flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-black/5 hover:text-ink"
                      >
                        <Icon name="close" size={18} strokeWidth={2} />
                      </button>
                    </form>
                  ) : null
                }
              />
            );
          })}
        </div>
      </section>
    </>
  );
}
