import { Icon } from "@/components/Icon";
import { googleCalendarUrl, isCalendarReady, outlookCalendarUrl, type CalendarTarget } from "@/lib/calendar";
import { getSiteUrl } from "@/lib/site";
import { cx } from "@/lib/ui";

export type CalendarLinks = { ready: boolean; google: string | null; outlook: string | null; ics: string };

export async function getCalendarLinks(target: CalendarTarget): Promise<CalendarLinks> {
  const site = await getSiteUrl();
  return {
    ready: isCalendarReady(target),
    google: googleCalendarUrl(target, site),
    outlook: outlookCalendarUrl(target, site),
    ics: `/calendar/${target}`,
  };
}

/** Google / Outlook / Apple (.ics) buttons. Rendered disabled until dates are set in content/wedding.ts. */
export function CalendarButtonRow({ links, className }: { links: CalendarLinks; className?: string }) {
  const base = "btn btn-sm";
  if (!links.ready) {
    return (
      <div className={cx("flex flex-col gap-2", className)}>
        <div className="flex flex-wrap gap-3">
          {["Google", "Outlook", "Apple (.ics)"].map((l) => (
            <span key={l} aria-disabled="true" className={cx(base, "btn-outline-sea opacity-60")}>
              <Icon name="calendar" size={18} strokeWidth={2} />
              {l}
            </span>
          ))}
        </div>
        <p className="text-sm text-ink-soft">Calendar links switch on once the dates are set.</p>
      </div>
    );
  }
  return (
    <div className={cx("flex flex-wrap gap-3", className)}>
      <a href={links.google!} target="_blank" rel="noopener noreferrer" className={cx(base, "btn-sea")}>
        <Icon name="calendar" size={18} strokeWidth={2} />
        Google
      </a>
      <a href={links.outlook!} target="_blank" rel="noopener noreferrer" className={cx(base, "btn-outline-sea")}>
        <Icon name="calendar" size={18} strokeWidth={2} />
        Outlook
      </a>
      <a href={links.ics} download className={cx(base, "btn-outline-sea")}>
        <Icon name="download" size={18} strokeWidth={2} />
        Apple (.ics)
      </a>
    </div>
  );
}
