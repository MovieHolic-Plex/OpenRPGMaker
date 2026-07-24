import { NextRequest, NextResponse } from "next/server";
import { getPool } from "~/lib/db";
import { validatePackageWithEditor } from "~/lib/editorPackageCheck";
import { isLicense } from "~/lib/kinds";
import { clientIp, rateLimit } from "~/lib/rateLimit";
import { decodeDataUrl, readGamePackageProjectJson, slugify, sniffImageMime } from "~/lib/validate";

export const dynamic = "force-dynamic";

const MAX_PACKAGE_BYTES = 96 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!rateLimit(`game:${clientIp(req)}`, 4, 60_000)) {
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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });
  if (!isLicense(body.license)) return NextResponse.json({ error: "Choose a license." }, { status: 400 });
  if (typeof body.packageBase64 !== "string" || !body.packageBase64) {
    return NextResponse.json({ error: "The package file is missing." }, { status: 400 });
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(body.packageBase64, "base64");
  } catch {
    return NextResponse.json({ error: "The package payload is not valid base64." }, { status: 400 });
  }
  if (bytes.length > MAX_PACKAGE_BYTES) {
    return NextResponse.json({ error: "Package too large (96 MB max)." }, { status: 413 });
  }

  try {
    readGamePackageProjectJson(bytes);
  } catch {
    return NextResponse.json({ error: "Not a valid .oprn package." }, { status: 422 });
  }
  const check = await validatePackageWithEditor(bytes);
  if (!check.ok) {
    return NextResponse.json({ error: `The editor could not open this package: ${check.error}` }, { status: 422 });
  }

  let coverDataUrl: string | null = null;
  if (typeof body.coverDataUrl === "string" && body.coverDataUrl) {
    const cover = decodeDataUrl(body.coverDataUrl);
    if (cover && cover.bytes.length <= 2 * 1024 * 1024 && sniffImageMime(cover.bytes) === cover.mime) {
      coverDataUrl = body.coverDataUrl;
    }
  }

  const tags = Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === "string").slice(0, 12) : [];
  const slug = `${slugify(title)}-${Date.now().toString(36)}`;

  try {
    await getPool().query(
      `insert into openrpg_games (slug, title, description, author, tags, license, package_base64, map_count, asset_count, cover_data_url)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        slug,
        title,
        typeof body.description === "string" ? body.description.slice(0, 2000) : "",
        typeof body.author === "string" && body.author.trim() ? body.author.trim().slice(0, 40) : "anonymous",
        tags,
        body.license,
        check.normalizedBase64 ?? body.packageBase64,
        check.mapCount ?? 0,
        check.uploadedAssetCount ?? 0,
        coverDataUrl,
      ],
    );
  } catch {
    return NextResponse.json({ error: "Could not save the game. Try again." }, { status: 500 });
  }
  return NextResponse.json({ slug }, { status: 201 });
}
