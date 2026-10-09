import { NextRequest, NextResponse } from "next/server";
import { bumpCounter, getAsset } from "~/lib/db";
import { clientIp, rateLimit } from "~/lib/rateLimit";
import { decodeDataUrl } from "~/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const asset = await getAsset(slug);
  if (!asset) return NextResponse.json({ error: "not found" }, { status: 404 });

  const format = req.nextUrl.searchParams.get("format");
  const decoded = decodeDataUrl(asset.data_url);

  if (format === "raw") {
    if (!decoded) return NextResponse.json({ error: "asset payload is corrupt" }, { status: 500 });
    const ext = decoded.mime.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
    return new NextResponse(new Uint8Array(decoded.bytes), {
      headers: {
        "Content-Type": decoded.mime,
        "Content-Disposition": `attachment; filename="asset.${ext}"; filename*=UTF-8''${encodeURIComponent(asset.slug)}.${ext}`,
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  if (rateLimit(`dl:asset:${clientIp(req)}:${slug}`, 1, 24 * 60 * 60 * 1000)) {
    await bumpCounter("openrpg_assets", "downloads", slug);
  }
  const uploadedAsset = {
    id: asset.slug,
    name: asset.name,
    kind: asset.kind,
    dataUrl: asset.data_url,
    meta: asset.meta,
  };
  return new NextResponse(JSON.stringify(uploadedAsset, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="asset.openrpg.json"; filename*=UTF-8''${encodeURIComponent(asset.slug)}.openrpg-asset.json`,
    },
  });
}
