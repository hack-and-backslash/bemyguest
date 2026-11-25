import { CopyButton } from "@/components/CopyButton";
import { fmtPhone } from "@/lib/rsvp-text";
import type { computeStats } from "@/lib/stats";
import { Bars } from "./Bars";

type Stats = ReturnType<typeof computeStats>;

function Card({ title, intro, children, id }: { title: string; intro?: string; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="card flex scroll-mt-6 flex-col gap-4 rounded-[28px] p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-2xl">{title}</h2>
        {intro && <p className="text-sm text-ink-soft">{intro}</p>}
      </div>
      {children}
    </div>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[15px] font-bold">
        {title} <span className="font-semibold text-ink-soft">({count})</span>
      </h3>
      {children}
    </div>
  );
}

const list = "flex flex-col gap-1.5 text-[15px]";
const empty = <p className="text-ink-soft">Nothing yet.</p>;

/** Rooms, food & bar, travel and good-to-know: everything the RSVP collects for planning. */
export function Planning({ stats }: { stats: Stats }) {
  const r = stats.rooms;
  const anyRooms = r.pairs.length + r.oneWay.length + r.waitingOnPlusOne.length + r.pool.length + r.notAnswered.length;
  return (
    <>
      {/* Rooms */}
      <section aria-labelledby="rooms-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="rooms-title" className="font-serif text-[28px]">
            Rooms
          </h2>
          <p className="max-w-3xl text-sm text-ink-soft">
            Cottages are for two. Here&apos;s who wants to share with whom, so you can pair everyone up. Kids stay with their
            parents.
          </p>
        </div>
        {!anyRooms ? (
          empty
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card flex flex-col gap-5 rounded-[28px] p-6">
              <Group title="Sorted" count={r.pairs.length}>
                <ul className={list}>
                  {r.pairs.map((p) => (
                    <li key={`${p.a.id}-${p.b.id || p.b.name}`}>
                      <b>{p.a.name}</b> &amp; <b>{p.b.name}</b> <span className="text-ink-soft">· {p.note}</span>
                    </li>
                  ))}
                </ul>
              </Group>
              <Group title="Asked for someone" count={r.oneWay.length}>
                <ul className={list}>
                  {r.oneWay.map((o) => (
                    <li key={o.from.id}>
                      <b>{o.from.name}</b> wants <b>{o.to}</b> <span className="text-ink-soft">· {o.theirPick}</span>
                    </li>
                  ))}
                </ul>
              </Group>
              <Group title="Waiting on a +1 decision" count={r.waitingOnPlusOne.length}>
                <ul className={list}>
                  {r.waitingOnPlusOne.map((o) => (
                    <li key={o.from.id}>
                      <b>{o.from.name}</b> with {o.plusOne}
                    </li>
                  ))}
                </ul>
              </Group>
            </div>
            <div className="card flex flex-col gap-5 rounded-[28px] p-6">
              <Group title="Happy to be paired" count={r.pool.length}>
                <p className="text-[15px]">{r.pool.map((p) => p.name).join(", ")}</p>
              </Group>
              <Group title="Haven't picked yet" count={r.notAnswered.length}>
                <p className="text-[15px] text-ink-soft">{r.notAnswered.map((p) => p.name).join(", ")}</p>
              </Group>
              <Group title="Bringing kids" count={r.families.length}>
                <ul className={list}>
                  {r.families.map((f) => (
                    <li key={f.id}>
                      <b>{f.name}</b>: {f.kids.map((k) => `${k.name} (${k.age === 0 ? "under 1" : k.age})`).join(", ")}
                    </li>
                  ))}
                </ul>
              </Group>
            </div>
          </div>
        )}
      </section>

      {/* Food + bar */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Food"
          intro="Plates for everyone coming, kids included. Approved +1s count as “not picked yet” until they RSVP. It applies to every meal."
        >
          <Bars
            unit="plates"
            rows={[
              ...stats.mealRows.map((m) => ({ label: m.label, count: m.count })),
              { label: "Not picked yet", count: stats.mealUnknown, muted: true },
            ]}
          />
          {stats.dietary.length > 0 && (
            <div className="mt-2 flex flex-col gap-2 border-t border-sand-200 pt-4">
              <h3 className="text-[15px] font-bold">Keep off their plate</h3>
              <ul className={list}>
                {stats.dietary.map((d, i) => (
                  <li key={i}>
                    <span className="font-semibold">{d.name}:</span> {d.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card title="The bar" intro={`${stats.bar.drinkers} drinking, ${stats.bar.mocktails} on mocktails.`}>
          {stats.bar.drinkers ? (
            <>
              <Bars unit="people" rows={stats.bar.styles.map((s) => ({ label: s.label, count: s.count }))} />
              {stats.bar.spirits.some((s) => s.count) && (
                <div className="flex flex-col gap-2 border-t border-sand-200 pt-4">
                  <h3 className="text-[15px] font-bold">Straight up: their pour</h3>
                  <Bars unit="people" rows={stats.bar.spirits.filter((s) => s.count).map((s) => ({ label: s.label, count: s.count }))} />
                </div>
              )}
              {stats.bar.favourites.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-sand-200 pt-4">
                  <h3 className="text-[15px] font-bold">Favourite cocktails</h3>
                  <ul className={list}>
                    {stats.bar.favourites.map((f) => (
                      <li key={f.id}>
                        <span className="font-semibold">{f.name}:</span> {f.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            empty
          )}
        </Card>
      </section>

      {/* Travel */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card title="Arrivals" intro="People getting in each day, kids and approved +1s included, by where they land.">
          {stats.arrivalRows.length ? (
            <Bars
              unit="people"
              rows={stats.arrivalRows.map((a) => ({ label: a.label, count: a.people, detail: a.detail || undefined, muted: a.date === "unknown" }))}
            />
          ) : (
            empty
          )}
          <Group title="Want help finding a cab" count={stats.cabHelp.length}>
            <ul className={list}>
              {stats.cabHelp.map((c) => (
                <li key={c.id}>
                  <b>{c.name}</b> <span className="text-ink-soft">· {c.when || "arrival not set"}</span>
                </li>
              ))}
            </ul>
          </Group>
          <Group title="Happy to share a cab" count={stats.shareGroups.reduce((n, g) => n + g.people.length, 0)}>
            <ul className={list}>
              {stats.shareGroups.map((g) => (
                <li key={g.label}>
                  <span className="font-semibold">{g.label}:</span> {g.people.map((p) => p.name).join(", ")}
                  {g.people.length > 1 && <span className="ml-1.5 rounded-full bg-sea-200 px-2 py-0.5 text-xs font-bold text-sea-800">match</span>}
                </li>
              ))}
            </ul>
          </Group>
        </Card>
        <Card title="Heading home" intro="People leaving each day, by time of day.">
          {stats.departureRows.length ? (
            <Bars
              unit="people"
              rows={stats.departureRows.map((a) => ({ label: a.label, count: a.people, detail: a.detail || undefined, muted: a.date === "unknown" }))}
            />
          ) : (
            empty
          )}
          <p className="rounded-2xl bg-sun-100 px-4 py-3 text-[15px]">
            <b>{stats.lastBreakfast}</b> {stats.lastBreakfast === 1 ? "person is" : "people are"} still around for breakfast
            on the last morning.
          </p>
        </Card>
      </section>

      {/* Good to know + WhatsApp */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card title="Good to know" intro="Mobility, medical and anything else guests told you.">
          {stats.needs.length ? (
            <ul className="flex flex-col gap-2.5 text-[15px]">
              {stats.needs.map((n) => (
                <li key={n.id}>
                  <b>{n.name}</b>
                  {n.needs.length > 0 && <span className="text-coral-800"> · {n.needs.join(", ")}</span>}
                  {n.notes && <span className="block text-ink-soft">{n.notes}</span>}
                </li>
              ))}
            </ul>
          ) : (
            empty
          )}
        </Card>
        <Card id="whatsapp" title="WhatsApp" intro={`${stats.whatsapp.length} numbers from guests who are coming, for the wedding group.`}>
          {stats.whatsapp.length ? (
            <>
              <CopyButton
                label="Copy all numbers"
                text={stats.whatsapp.map((w) => w.number).join("\n")}
                className="self-start"
              />
              <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto text-[15px]">
                {stats.whatsapp.map((w) => (
                  <li key={w.id} className="flex justify-between gap-3">
                    <span>{w.name}</span>
                    <a href={`https://wa.me/${w.number.replace(/^\+/, "")}`} target="_blank" rel="noreferrer" className="font-semibold tabular-nums">
                      {fmtPhone(w.number)}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            empty
          )}
        </Card>
      </section>
    </>
  );
}
