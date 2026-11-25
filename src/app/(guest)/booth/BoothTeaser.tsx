/* eslint-disable @next/next/no-img-element -- small decorative prints */
import { Icon } from "@/components/Icon";
import type { IconName } from "@/content/wedding";
import { formatClock, formatDayShort, formatWeekdayDate } from "@/lib/format";
import { booth } from "@/content/booth";
import { Countdown } from "./Countdown";

const steps: { icon: IconName; bg: string; title: string; body: string }[] = [
  { icon: "camera", bg: "bg-coral-200", title: "Snap", body: "The airport selfie, the mehndi, the vows, the dance floor." },
  { icon: "send", bg: "bg-sea-200", title: "Share", body: `Up to ${booth.maxPerBatch} at once, straight into everyone's feed.` },
  { icon: "heart", bg: "bg-sun-100", title: "Heart", body: "Double-tap your favourites. Each day's top 3 get the spotlight." },
];

/** Before the booth opens: what it is and when. `opensAt`: ISO time from Site settings. */
export function BoothTeaser({ now, opensAt }: { now: number; opensAt: string }) {
  const day = opensAt.slice(0, 10);
  const opens = Date.parse(opensAt);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-4 pb-12">
      <section className="animate-fade-up flex flex-col gap-1 px-1">
        <p className="kicker text-[22px] text-coral-600">Photo Booth · coming soon</p>
        <h1 className="font-serif text-[32px] leading-[1.1] text-balance lg:text-5xl">
          Doors open the morning of {formatDayShort(day)}.
        </h1>
        <p className="mt-0.5 text-[15px] leading-relaxed text-ink-soft lg:text-lg">
          From {formatClock(opens)} on {formatWeekdayDate(day)}, so bring your travel snaps too.
        </p>
      </section>

      <div aria-hidden="true" className="relative mx-auto mt-3 h-[222px] w-full max-w-[390px] shrink-0">
        <div className="absolute top-6 left-[8%] w-[132px] -rotate-9 rounded bg-white px-[7px] pt-[7px] pb-[26px] shadow-[0_8px_20px_rgb(31_58_61/0.14)]">
          <div className="h-[132px] overflow-hidden rounded-sm bg-sand-300">
            <img src="/demo-booth/sunset.jpg" alt="" className="size-full object-cover opacity-35 blur-[1.5px] sepia-[.6]" />
          </div>
        </div>
        <div className="absolute top-4 right-[8%] w-[132px] rotate-8 rounded bg-white px-[7px] pt-[7px] pb-[26px] shadow-[0_8px_20px_rgb(31_58_61/0.14)]">
          <div className="h-[132px] overflow-hidden rounded-sm bg-sand-300">
            <img src="/demo-booth/night.jpg" alt="" className="size-full object-cover opacity-35 blur-[1.5px] sepia-[.6]" />
          </div>
        </div>
        <div className="absolute top-2 left-1/2 flex w-[150px] -translate-x-1/2 -rotate-[1.5deg] flex-col gap-2 rounded bg-white px-2 pt-2 pb-2.5 shadow-[0_12px_26px_rgb(31_58_61/0.18)]">
          <span className="absolute -top-2.5 left-1/2 h-5 w-[70px] -translate-x-1/2 rotate-3 rounded-sm bg-sun-300/75" />
          <div className="flex h-[148px] flex-col items-center justify-center gap-1.5 rounded-sm border-2 border-dashed border-sand-300 bg-sand-200 text-[#9C7650]">
            <Icon name="camera" size={34} strokeWidth={1.6} />
            <span className="kicker text-lg">your photo here</span>
          </div>
          <span className="kicker text-center text-[17px] text-ink-soft">see you in Goa!</span>
        </div>
      </div>

      <div className="mt-1">
        <Countdown target={opens} now={now} />
      </div>

      <ul aria-label="How the booth works" className="mt-4 flex flex-col gap-2.5 px-1">
        {steps.map((s) => (
          <li key={s.title} className="flex items-center gap-3">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${s.bg}`}>
              <Icon name={s.icon} size={21} />
            </span>
            <span className="flex flex-col gap-px">
              <span className="text-[15px] font-bold">{s.title}</span>
              <span className="text-[13px] leading-snug text-ink-soft lg:text-sm">{s.body}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-center gap-1.5 px-1 text-xs text-ink-soft">
        <Icon name="lock" size={15} strokeWidth={1.9} />
        Only signed-in guests can see the booth.
      </p>
    </div>
  );
}
