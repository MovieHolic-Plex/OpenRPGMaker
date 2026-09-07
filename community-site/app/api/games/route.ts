import { getPool } from "~/lib/db";
import { clientIp, rateLimit } from "~/lib/rateLimit";
import { createReleaseUploadHandler } from "~/lib/releaseUpload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const publish = createReleaseUploadHandler({ pool: getPool() });

export async function POST(request: Request) {
  if (!rateLimit(`game:${clientIp(request)}`, 4, 60_000)) {
    return Response.json({ error: "Too many uploads. Try again in a minute." }, { status: 429 });
  }
  return publish(request);
}
