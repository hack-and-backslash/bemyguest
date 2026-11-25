import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/data";
import { authUrl, driveConfigured } from "@/lib/google-drive";
import { sign } from "@/lib/booth/storage";

/** Booth control → "Connect Google Drive": off to Google's consent screen. */
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return new NextResponse("Not found", { status: 404 });
  if (!driveConfigured) return NextResponse.redirect(new URL("/admin/booth?drive=off", request.nextUrl.origin));

  // Ties Google's answer to this person, and expires in 10 minutes.
  const expires = Date.now() + 10 * 60_000;
  const state = `${expires}.${sign(`drive:${viewer.guest.id}:${expires}`)}`;
  const redirectUri = new URL("/admin/drive/callback", request.nextUrl.origin).toString();
  return NextResponse.redirect(authUrl(redirectUri, state));
}
