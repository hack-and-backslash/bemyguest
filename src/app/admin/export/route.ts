import { getAdminData, getViewer } from "@/lib/data";
import { toCsv } from "@/lib/stats";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return new Response("Not found", { status: 404 });
  const { rows } = await getAdminData(viewer);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rsvps-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
