"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { makeZip, type ZipEntry } from "@/lib/zip";

export type DayGroup = {
  day: string;
  label: string;
  photos: { id: string; url: string; author: string; createdAt: string; caption: string; hearts: number; ext: string; hidden: boolean }[];
};

const IST = 5.5 * 3_600_000;
const clock = (iso: string) => new Date(Date.parse(iso) + IST).toISOString().slice(11, 16);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guest";
const csv = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** One button per day: fetches that day's full-size photos and saves them as a ZIP. */
export function DayDownloads({ days }: { days: DayGroup[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function download(group: DayGroup) {
    setBusy(group.day);
    setError(null);
    setProgress(0);
    try {
      const entries: ZipEntry[] = [];
      const rows = [["file", "by", "time (IST)", "hearts", "hidden", "caption"].map(csv).join(",")];
      let done = 0;
      for (const p of group.photos) {
        const res = await fetch(p.url);
        if (!res.ok) throw new Error(`Couldn't fetch a photo by ${p.author} (${res.status}).`);
        const name = `${clock(p.createdAt).replace(":", "")}-${slug(p.author)}-${p.id.slice(0, 6)}.${p.ext}`;
        entries.push({ name, data: new Uint8Array(await res.arrayBuffer()), date: new Date(p.createdAt) });
        rows.push([name, p.author, clock(p.createdAt), p.hearts, p.hidden ? "yes" : "", p.caption].map(csv).join(","));
        setProgress(++done / group.photos.length);
      }
      entries.push({ name: "captions.csv", data: new TextEncoder().encode(rows.join("\n")), date: new Date() });
      const url = URL.createObjectURL(makeZip(entries));
      const a = document.createElement("a");
      a.href = url;
      a.download = `photo-booth-${group.day}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make the ZIP.");
    } finally {
      setBusy(null);
    }
  }

  if (!days.length) return <p className="text-[15px] text-ink-soft">Nothing to download yet.</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2.5">
        {days.map((g) => (
          <button
            key={g.day}
            type="button"
            disabled={!!busy}
            onClick={() => download(g)}
            className="btn btn-sm btn-outline"
          >
            <Icon name="download" size={18} strokeWidth={2} />
            {busy === g.day ? `Packing… ${Math.round(progress * 100)}%` : `${g.label} · ${g.photos.length}`}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-coral-800">
          {error}
        </p>
      )}
    </div>
  );
}
