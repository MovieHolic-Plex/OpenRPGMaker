import { NextRequest, NextResponse } from "next/server";
import { getPool } from "~/lib/db";
import { isAssetKind, isLicense } from "~/lib/kinds";
import { clientIp, rateLimit } from "~/lib/rateLimit";
import { decodeDataUrl, slugify, sniffAudioMime, sniffImageMime } from "~/lib/validate";

export const dynamic = "force-dynamic";

const MAX_ASSET_BYTES = 24 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!rateLimit(`asset:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many uploads — wait a minute and try again." }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.website === "string" && body.website) {
    return NextResponse.json({ slug: "ok" }, { status: 201 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });
  if (!isAssetKind(body.kind)) return NextResponse.json({ error: "Unknown asset kind." }, { status: 400 });
  if (!isLicense(body.license)) return NextResponse.json({ error: "Choose a license." }, { status: 400 });

  const decoded = decodeDataUrl(body.dataUrl);
  if (!decoded) return NextResponse.json({ error: "The file payload is not a valid base64 data URL." }, { status: 400 });
  if (decoded.bytes.length > MAX_ASSET_BYTES) {
    return NextResponse.json({ error: "File too large (24 MB max)." }, { status: 413 });
  }
  const sniffed = sniffImageMime(decoded.bytes) ?? sniffAudioMime(decoded.bytes);
  if (!sniffed) {
    return NextResponse.json({ error: "The file is not a supported image or audio format." }, { status: 422 });
  }
  if (decoded.mime !== sniffed && !(sniffed === "audio/mp4" && decoded.mime === "audio/x-m4a")) {
    return NextResponse.json({ error: "The file contents do not match its declared format." }, { status: 422 });
  }

  const meta =
    typeof body.meta === "object" && body.meta !== null && !Array.isArray(body.meta) ? body.meta : {};
  const tags = Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === "string").slice(0, 12) : [];
  const slug = `${slugify(name)}-${Date.now().toString(36)}`;

  try {
    await getPool().query(
      `insert into openrpg_assets (slug, name, kind, description, author, tags, license, data_url, meta)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        slug,
        name,
        body.kind,
        typeof body.description === "string" ? body.description.slice(0, 2000) : "",
        typeof body.author === "string" && body.author.trim() ? body.author.trim().slice(0, 40) : "anonymous",
        tags,
        body.license,
        body.dataUrl,
        JSON.stringify(meta),
      ],
    );
  } catch {
    return NextResponse.json({ error: "Could not save the asset. Try again." }, { status: 500 });
  }
  return NextResponse.json({ slug }, { status: 201 });
}
