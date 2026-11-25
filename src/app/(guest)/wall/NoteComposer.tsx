"use client";

import { useActionState, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import type { NoteColor, Sticker } from "@/lib/types";
import { NOTE_MAX } from "@/lib/validate";
import { cx } from "@/lib/ui";
import { postNoteAction, type NoteFormState } from "../actions";

const colors: { id: NoteColor; label: string; bg: string }[] = [
  { id: "sun", label: "Sunshine yellow", bg: "bg-sun-100" },
  { id: "coral", label: "Coral pink", bg: "bg-coral-200" },
  { id: "sea", label: "Seafoam", bg: "bg-sea-200" },
  { id: "sky", label: "Sky blue", bg: "bg-sky-200" },
];

const stickers: { id: Sticker; label: string; className: string }[] = [
  { id: "heart", label: "Heart doodle", className: "text-coral-600" },
  { id: "shell", label: "Shell doodle", className: "text-sea-700" },
  { id: "sun", label: "Sun doodle", className: "text-[#B26A14]" },
  { id: "none", label: "No doodle", className: "" },
];

export function NoteComposer({ authorName, avatarUrl }: { authorName: string; avatarUrl: string | null }) {
  const [body, setBody] = useState("");
  const [color, setColor] = useState<NoteColor>("sun");
  const [sticker, setSticker] = useState<Sticker>("heart");
  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(async (prev, form) => {
    const result = await postNoteAction(prev, form);
    if (result.posted) setBody("");
    return result;
  }, {});

  const empty = !body.trim();

  return (
    <form
      action={formAction}
      className="card flex flex-col gap-3.5 rounded-[28px] bg-white p-6 lg:sticky lg:top-6 lg:rounded-[32px] lg:p-8"
    >
      <h2 className="font-serif text-[28px] leading-[1.15] lg:text-[30px]">Leave us a note</h2>
      <label htmlFor="note-text" className="text-[15px] font-semibold">
        Your message <span className="font-medium text-ink-soft">(short and sweet)</span>
      </label>
      <textarea
        id="note-text"
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, NOTE_MAX))}
        maxLength={NOTE_MAX}
        rows={4}
        placeholder="Write something nice (or embarrassing)…"
        className="field resize-none py-3.5 font-script text-xl leading-snug"
      />
      <span className="-mt-1.5 self-end text-[13px] font-semibold text-ink-soft" aria-live="polite">
        {body.length} / {NOTE_MAX}
      </span>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-[15px] font-semibold">Pick a note colour</legend>
        <div className="flex gap-3">
          {colors.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.label}
              aria-pressed={color === c.id}
              onClick={() => setColor(c.id)}
              className={cx(
                "size-11 rounded-full border-2 transition-transform duration-200 ease-[var(--ease-spring)] hover:scale-110",
                c.bg,
                color === c.id ? "border-ink shadow-[0_0_0_3px_#fff,0_0_0_5px_#1F3A3D]" : "border-sand-300",
              )}
            />
          ))}
        </div>
      </fieldset>
      <input type="hidden" name="color" value={color} />

      <fieldset className="flex flex-col">
        <legend className="mb-2.5 text-[15px] font-semibold">Add a doodle</legend>
        <div className="flex gap-2.5">
          {stickers.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-label={s.label}
              aria-pressed={sticker === s.id}
              onClick={() => setSticker(s.id)}
              className={cx(
                "flex h-12 min-w-12 items-center justify-center rounded-[14px] border-2 px-2.5 text-[13px] font-bold transition-transform duration-200 ease-[var(--ease-spring)] hover:scale-110",
                sticker === s.id ? "border-sea-700 bg-sea-200" : "border-sand-300 bg-sand-50",
                s.className,
              )}
            >
              {s.id === "none" ? <span className="text-ink-soft">None</span> : <Icon name={s.id} strokeWidth={2} />}
            </button>
          ))}
        </div>
      </fieldset>
      <input type="hidden" name="sticker" value={sticker} />

      <p className="mt-1 flex items-center gap-2.5 text-sm text-ink-soft">
        <Avatar name={authorName} url={avatarUrl} size={28} tone="sun" />
        Posting as {authorName}
      </p>
      {state.error && (
        <p role="alert" className="rounded-xl bg-coral-200 px-4 py-2.5 text-sm font-semibold text-coral-800">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary mt-1" disabled={empty || pending}>
        <Icon name="send" size={20} strokeWidth={2} />
        {pending ? "Pinning…" : "Pin it to the wall"}
      </button>
    </form>
  );
}
