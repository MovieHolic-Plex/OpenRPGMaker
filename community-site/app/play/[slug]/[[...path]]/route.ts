import { handleReleasePlay } from "~/lib/releaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string; path?: string[] }> }) {
  return handleReleasePlay(request, await params);
}
