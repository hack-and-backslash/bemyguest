import Link from "next/link";
import type { IconName } from "@/content/wedding";
import { Illustration } from "@/components/Decor";
import { Icon } from "@/components/Icon";
import { cx } from "@/lib/ui";

/** Friendly placeholder for sections the couple hasn't written yet. */
export function ComingSoon({
  icon,
  tint,
  kicker,
  title,
  body,
}: {
  icon: IconName;
  tint: string;
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <section className="animate-fade-up relative flex flex-col items-center gap-4 px-6 pt-12 pb-20 text-center lg:pt-20 lg:pb-28">
      <Illustration name="cloud" className="animate-drift pointer-events-none absolute top-6 left-[20%] hidden w-52 opacity-90 lg:block" />
      <span className={cx("flex size-24 items-center justify-center rounded-full", tint)}>
        <Icon name={icon} size={44} strokeWidth={1.5} />
      </span>
      <p className="kicker text-[26px] text-sea-700 lg:text-[30px]">{kicker}</p>
      <h1 className="max-w-2xl font-serif text-[34px] leading-[1.1] text-balance lg:text-[52px]">{title}</h1>
      <p className="max-w-xl text-lg leading-relaxed text-ink-soft">{body}</p>
      <Link href="/" className="btn btn-outline mt-3">
        <Icon name="arrow-left" size={20} strokeWidth={2} />
        Back home
      </Link>
    </section>
  );
}
