"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { cx } from "@/lib/ui";

/** Copies text to the clipboard and says so for a couple of seconds. */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2200);
  }

  return (
    <button type="button" onClick={copy} className={cx("btn btn-sm btn-outline", className)}>
      <Icon name={state === "copied" ? "check" : "copy"} size={18} strokeWidth={2} />
      <span aria-live="polite">{state === "copied" ? "Copied!" : state === "failed" ? "Couldn't copy" : label}</span>
    </button>
  );
}
