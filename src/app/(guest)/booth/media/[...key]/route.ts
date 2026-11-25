import { memoryFiles, storageMode } from "@/lib/booth/storage";

/** Serves photos kept in memory (local testing only; real photos come from ImageKit). */
export async function GET(_request: Request, ctx: RouteContext<"/booth/media/[...key]">) {
  if (storageMode !== "memory") return new Response("Not found", { status: 404 });
  const { key } = await ctx.params;
  const file = memoryFiles().get(key.join("/"));
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Content-Length": String(file.data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
