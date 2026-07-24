import { NextResponse } from "next/server";
import { bumpCounter, getGame } from "~/lib/db";
import { clientIp, rateLimit } from "~/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const game = await getGame(slug);
  if (!game) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (rateLimit(`dl:game:${clientIp(_req)}:${slug}`, 1, 24 * 60 * 60 * 1000)) {
    await bumpCounter("openrpg_games", "downloads", slug);
  }
  const bytes = Buffer.from(game.package_base64, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openrpg.project+zip",
      "Content-Disposition": `attachment; filename="game.oprn"; filename*=UTF-8''${encodeURIComponent(game.slug)}.oprn`,
      "Content-Length": String(bytes.length),
    },
  });
}
