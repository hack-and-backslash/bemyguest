"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/Icon";
import { cx } from "@/lib/ui";
import { addTesterAction, clearDataAction, goLiveAction, type FormResult } from "./actions";

function Message({ state }: { state: FormResult }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={cx(
        "rounded-xl px-3 py-2 text-sm font-semibold",
        state.error ? "bg-coral-200 text-coral-800" : "bg-sea-200 text-sea-800",
      )}
    >
      {state.error ?? state.ok}
    </p>
  );
}

export function AddTester() {
  const [state, action, pending] = useActionState(addTesterAction, {});

  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="tester-email" className="text-sm font-semibold">
        Add a tester
      </label>
      <div className="flex flex-wrap gap-2">
        {/* Remounted after each try: empty after an add, their typing kept after an error. */}
        <input
          key={state.at ?? 0}
          defaultValue={state.error ? state.value : ""}
          autoFocus={!!state.at}
          id="tester-email"
          name="email"
          type="email"
          inputMode="email"
          required
          autoComplete="off"
          placeholder="Their Google email"
          className="field max-w-sm flex-1"
        />
        <button className="btn btn-sm btn-sea" disabled={pending}>
          <Icon name="plus" size={18} strokeWidth={2} />
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {state.error && <Message state={state} />}
    </form>
  );
}

/** Two-step: open it, type "clear", confirm. Closes itself once it has worked. */
export function ClearData() {
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [state, action, pending] = useActionState(clearDataAction, {});
  const [typed, setTyped] = useState("");
  const open = openedAt !== null && !(state.ok && (state.at ?? 0) > openedAt);

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-sand-50 p-5 shadow-[var(--shadow-rest)]">
      <div className="flex flex-col gap-1">
        <h3 className="text-[17px] font-bold">Clear all data</h3>
        <p className="text-sm leading-relaxed text-ink-soft">
          Deletes every RSVP, +1 request, wall note and booth photo, so you can see the empty site again. Everyone stays
          signed in, and your tester list stays.
        </p>
      </div>
      {!open ? (
        <button
          type="button"
          className="btn btn-sm btn-outline self-start"
          onClick={() => {
            setTyped("");
            setOpenedAt(Date.now());
          }}
        >
          <Icon name="trash" size={18} strokeWidth={2} />
          Clear all data…
        </button>
      ) : (
        <form action={action} className="flex flex-col gap-2">
          <label htmlFor="clear-confirm" className="text-sm font-semibold">
            Type <b>clear</b> to confirm. This can&apos;t be undone.
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="clear-confirm"
              name="confirm"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="field max-w-[12rem]"
            />
            <button className="btn btn-sm btn-primary" disabled={pending || typed.trim().toLowerCase() !== "clear"}>
              {pending ? "Clearing…" : "Clear everything"}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpenedAt(null)} disabled={pending}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <Message state={state} />
    </div>
  );
}

/** Two-step as well. On success the page reloads as the live dashboard (the action redirects). */
export function GoLive() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(goLiveAction, {});

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-sea-200 p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-[17px] font-bold">Go live</h3>
        <p className="text-sm leading-relaxed text-ink">
          Opens the site to anyone with the link. After this, Clear all data goes away for good, so nothing real can be
          wiped by mistake.
        </p>
      </div>
      {!open ? (
        <button type="button" className="btn btn-sm btn-sea self-start" onClick={() => setOpen(true)}>
          <Icon name="send" size={18} strokeWidth={2} />
          Go live…
        </button>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <label className="flex items-center gap-2.5 text-[15px] font-semibold">
            <input type="checkbox" name="clear" defaultChecked className="size-5 accent-[var(--color-sea-700)]" />
            Clear the test data first
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm btn-sea" disabled={pending}>
              {pending ? "Going live…" : "Go live now"}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <Message state={state} />
    </div>
  );
}
