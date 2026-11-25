import { checkMemoryUpload, memoryFiles, storageMode } from "@/lib/booth/storage";

/**
 * Stand-in for ImageKit while no ImageKit keys are set (local testing): takes a
 * signed form like the one the phone sends to ImageKit, keeps the file in
 * memory, and answers the way ImageKit does.
 */
export async function POST(request: Request) {
  if (storageMode !== "memory") return new Response("Not found", { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("Bad upload", { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) return new Response("No file", { status: 400 });

  const fields: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") fields[k] = v;
  });
  const problem = checkMemoryUpload(fields, file.size, file.type);
  if (problem) return new Response(problem, { status: 403 });

  const data = Buffer.from(await file.arrayBuffer());
  memoryFiles().set(fields.key, { type: fields["Content-Type"], data });
  return Response.json({ fileId: fields.key, filePath: `/${fields.key}`, size: data.length });
}
