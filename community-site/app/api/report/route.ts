import { NextRequest, NextResponse } from "next/server";
import { getPool } from "~/lib/db";
import { clientIp, rateLimit } from "~/lib/rateLimit";

export const dynamic = "force-dynamic";

const TYPES = new Set(["post", "comment", "asset", "game"]);

export async function POST(req: NextRequest) {
  if (!rateLimit(`report:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many reports — wait a minute and try again." }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!TYPES.has(String(body.type)) || !id || id.length > 80) {
    return NextResponse.json({ error: "Invalid report target." }, { status: 400 });
  }
  await getPool().query(
    "insert into openrpg_reports (target_type, target_id, reason) values ($1, $2, $3)",
    [body.type, id, typeof body.reason === "string" ? body.reason.slice(0, 500) : ""],
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
