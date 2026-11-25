import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/data";
import { connectDrive } from "@/lib/google-drive";
import { verify } from "@/lib/booth/storage";

/** Google sends the couple back here after they allow Drive access. */
export async function GET(request: NextRequest) {
  const back = (result: string, message?: string) => {
    const url = new URL("/admin/booth", request.nextUrl.origin);
    url.searchParams.set("drive", result);
    if (message) url.searchParams.set("msg", message);
    return NextResponse.redirect(url);
  };

  const viewer = await getViewer();
  if (!viewer?.isAdmin) return new NextResponse("Not found", { status: 404 });

  const q = request.nextUrl.searchParams;
  if (q.get("error")) return back("error", "Google sign-in was cancelled.");
  const [expires, signature] = (q.get("state") ?? "").split(".");
  if (!expires || !signature || Number(expires) < Date.now() || !verify(`drive:${viewer.guest.id}:${expires}`, signature)) {
    return back("error", "That link expired. Please connect again.");
  }
  const code = q.get("code");
  if (!code) return back("error", "Google didn't send a code. Please connect again.");

  try {
    await connectDrive(code, new URL("/admin/drive/callback", request.nextUrl.origin).toString());
  } catch (e) {
    return back("error", e instanceof Error ? e.message : "Couldn't connect Google Drive.");
  }
  return back("connected");
}
