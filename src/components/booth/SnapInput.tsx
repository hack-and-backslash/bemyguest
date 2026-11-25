"use client";

import { uploads } from "@/lib/booth/uploader";
import { cx } from "@/lib/ui";

/**
 * A label wrapping a hidden file input: the most reliable way to open the
 * photo picker on phones (iOS offers Take Photo / Photo Library / Browse).
 */
export function SnapInput({
  className,
  children,
  label,
}: {
  className?: string;
  children: React.ReactNode;
  /** Accessible name when the visible content isn't enough. */
  label?: string;
}) {
  return (
    <label
      className={cx(
        "cursor-pointer has-[input:focus-visible]:outline-[3px] has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-sky-700",
        className,
      )}
    >
      <input
        type="file"
        accept="image/*"
        multiple
        aria-label={label}
        className="sr-only"
        onChange={(e) => {
          uploads.pick(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />
      {children}
    </label>
  );
}
