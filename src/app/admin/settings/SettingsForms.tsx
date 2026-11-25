"use client";

import { startTransition, useActionState, useState, type ReactNode } from "react";
import { cx } from "@/lib/ui";
import {
  saveBannerAction,
  saveBoothSettingsAction,
  saveContactAction,
  saveRsvpSettingsAction,
  type SettingsResult,
} from "./actions";

type Action = (prev: SettingsResult, form: FormData) => Promise<SettingsResult>;

/**
 * A settings form that keeps what was typed if saving fails (a plain
 * <form action> would reset it). Shows "Saved." or the problem under the button.
 */
function SettingsForm({
  action,
  children,
  submit,
  extra,
}: {
  action: Action;
  children: ReactNode;
  submit: string;
  extra?: (pending: boolean) => ReactNode;
}) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => run(data));
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-sm btn-sea" disabled={pending}>
          {pending ? "Saving…" : submit}
        </button>
        {extra?.(pending)}
        {(state.ok || state.error) && (
          <span role={state.error ? "alert" : "status"} className={cx("text-sm font-semibold", state.error ? "text-coral-800" : "text-sea-800")}>
            {state.error ?? state.ok}
          </span>
        )}
      </div>
    </form>
  );
}

const label = "text-[15px] font-semibold";
const hint = "text-sm text-ink-soft";

export function RsvpForm({ deadline, mode }: { deadline: string; mode: string }) {
  return (
    <SettingsForm action={saveRsvpSettingsAction} submit="Save RSVP settings">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="deadline" className={label}>
          Deadline
        </label>
        <input id="deadline" name="deadline" type="date" defaultValue={deadline} className="field max-w-[14rem]" />
        <p className={hint}>RSVPs close at the end of this day (India time). Leave it empty for no deadline.</p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className={cx(label, "mb-1")}>RSVPs are…</legend>
        {[
          ["deadline", "Open until the deadline", "The usual: they close by themselves."],
          ["closed", "Closed now", "Guests see their answers, read-only, and who to message."],
          ["open", "Open, ignoring the deadline", "Reopens them for everyone, even after the deadline."],
        ].map(([value, title, sub]) => (
          <label key={value} className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-sand-300 bg-sand-50 p-3.5 has-[:checked]:border-sea-700 has-[:checked]:bg-sea-200/40">
            <input type="radio" name="mode" value={value} defaultChecked={mode === value} className="mt-1 size-4 accent-[var(--color-sea-700)]" />
            <span className="flex flex-col">
              <span className="font-semibold">{title}</span>
              <span className={hint}>{sub}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </SettingsForm>
  );
}

export function BoothForm({ opens, closes, perGuest, budget }: { opens: string; closes: string; perGuest: number; budget: number }) {
  return (
    <SettingsForm action={saveBoothSettingsAction} submit="Save booth settings">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="opens" className={label}>
            Opens
          </label>
          <input id="opens" name="opens" type="datetime-local" defaultValue={opens} className="field" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="closes" className={label}>
            Uploads close
          </label>
          <input id="closes" name="closes" type="datetime-local" defaultValue={closes} className="field" />
        </div>
        <p className={cx(hint, "sm:col-span-2 -mt-2")}>India time. After uploads close, the booth stays up as the photo album.</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="perGuest" className={label}>
            Photos per guest
          </label>
          <input id="perGuest" name="perGuest" type="number" min={1} max={1000} step={1} defaultValue={perGuest} className="field" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="budget" className={label}>
            Storage safety line (MB)
          </label>
          <input id="budget" name="budget" type="number" min={100} max={100000} step={1} defaultValue={budget} className="field" />
        </div>
        <p className={cx(hint, "sm:col-span-2 -mt-2")}>
          New photos pause when the booth&apos;s files reach the line. ImageKit&apos;s free plan holds 3,000 MB, so keep it
          a little under that unless you upgrade.
        </p>
      </div>
    </SettingsForm>
  );
}

export function BannerForm({ banner }: { banner: string }) {
  const [value, setValue] = useState(banner);
  return (
    <SettingsForm
      action={saveBannerAction}
      submit={banner ? "Update" : "Post it"}
      extra={(pending) =>
        banner ? (
          <button name="intent" value="remove" className="btn btn-sm btn-outline" disabled={pending} onClick={() => setValue("")}>
            Take it down
          </button>
        ) : null
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="banner" className={label}>
          Announcement
        </label>
        <textarea
          id="banner"
          name="banner"
          rows={2}
          maxLength={160}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. The shuttle to the beach leaves the lobby at 4:30 PM"
          className="field min-h-[5.5rem] resize-y py-3"
        />
        <p className={hint}>{160 - value.length} characters left. Shown at the top of every page until you take it down.</p>
      </div>
    </SettingsForm>
  );
}

export function ContactForm({ contact }: { contact: string }) {
  return (
    <SettingsForm action={saveContactAction} submit="Save">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-line" className={label}>
          Guests reach you at
        </label>
        <input id="contact-line" name="contact" maxLength={80} defaultValue={contact} placeholder="e.g. Amit on +91 98xxx xxxxx" className="field" />
        <p className={hint}>Shown in the footer, on My profile, and wherever guests are told to message you.</p>
      </div>
    </SettingsForm>
  );
}
