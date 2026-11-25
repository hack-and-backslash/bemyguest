import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Server-only settings (e.g. the Google Drive connection). Kept in the
 * app_settings table, which only the secret key can read; in demo mode, in memory.
 */
const g = globalThis as unknown as { __goaSettings?: Map<string, unknown> };
const memory = () => (g.__goaSettings ??= new Map());

/** The whole (tiny) table in one read, shared by everything that renders in a request. */
const loadAll = cache(async (): Promise<Map<string, unknown>> => {
  const { data, error } = await createAdminClient().from("app_settings").select("key, value");
  if (error) throw new Error(`Couldn't read settings: ${error.message}`);
  return new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
});

export async function getSetting<T>(key: string): Promise<T | null> {
  if (isDemo) return (memory().get(key) as T) ?? null;
  return ((await loadAll()).get(key) as T) ?? null;
}

export async function setSetting(key: string, value: unknown) {
  if (isDemo) {
    memory().set(key, value);
    return;
  }
  const { error } = await createAdminClient()
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Couldn't save settings: ${error.message}`);
}

export async function deleteSetting(key: string) {
  if (isDemo) {
    memory().delete(key);
    return;
  }
  const { error } = await createAdminClient().from("app_settings").delete().eq("key", key);
  if (error) throw new Error(`Couldn't clear settings: ${error.message}`);
}

/* Secrets inside settings are encrypted, keyed off the site's own secret. */

function key() {
  const base = process.env.BOOTH_SIGNING_SECRET || process.env.SUPABASE_SECRET_KEY || "demo-only-key";
  return createHash("sha256").update(`settings:${base}`).digest();
}

export function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

/** null if it can't be opened (e.g. the site's secret key changed). */
export function unseal(sealed: string): string | null {
  try {
    const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
