import { handleReleaseDownload } from "~/lib/releaseServer";
import { bumpCounter } from "~/lib/db";
import { clientIp, rateLimit } from "~/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string; releaseId: string }> }) {
  const resolved = await params;
  const response = await handleReleaseDownload(request, resolved);
  if (response.ok && rateLimit(`dl:game:${clientIp(request)}:${resolved.slug}`, 1, 24 * 60 * 60 * 1000)) {
    await bumpCounter("openrpg_games", "downloads", resolved.slug);
  }
  return response;
}
