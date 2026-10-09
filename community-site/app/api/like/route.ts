import { NextRequest, NextResponse } from "next/server";
import { getPool } from "~/lib/db";
import { clientIp, rateLimit } from "~/lib/rateLimit";

export const dynamic = "force-dynamic";

const TARGETS: Record<string, { table: string; key: string }> = {
  asset: { table: "openrpg_assets", key: "slug" },
  game: { table: "openrpg_games", key: "slug" },
  post: { table: "openrpg_posts", key: "id" },
};

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const target = TARGETS[String(body.type)];
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!target || !id || id.length > 80) {
    return NextResponse.json({ error: "Invalid like target." }, { status: 400 });
  }
  if (!rateLimit(`like:${clientIp(req)}:${body.type}:${id}`, 1, 6 * 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Already liked." }, { status: 409 });
  }
  const { rows } = await getPool().query(
    `update ${target.table} set likes = likes + 1 where ${target.key} = $1 and status = 'visible' returning likes`,
    [id],
  );
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ likes: rows[0].likes });
}
