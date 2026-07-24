import { NextRequest, NextResponse } from "next/server";
import { getPool } from "~/lib/db";
import { clientIp, rateLimit } from "~/lib/rateLimit";

export const dynamic = "force-dynamic";

const PARENT_TYPES = new Set(["post", "asset", "game"]);

export async function POST(req: NextRequest) {
  if (!rateLimit(`comment:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many comments — wait a minute and try again." }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.website === "string" && body.website) {
    return NextResponse.json({ id: "ok" }, { status: 201 });
  }

  if (!PARENT_TYPES.has(String(body.parentType))) {
    return NextResponse.json({ error: "Unknown comment target." }, { status: 400 });
  }
  const parentId = typeof body.parentId === "string" ? body.parentId.trim() : "";
  if (!parentId || parentId.length > 80) {
    return NextResponse.json({ error: "Invalid comment target." }, { status: 400 });
  }
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "The comment is empty." }, { status: 400 });

  try {
    const { rows } = await getPool().query(
      `insert into openrpg_comments (parent_type, parent_id, body, author)
       values ($1, $2, $3, $4) returning id`,
      [
        body.parentType,
        parentId,
        text.slice(0, 2000),
        typeof body.author === "string" && body.author.trim() ? body.author.trim().slice(0, 40) : "anonymous",
      ],
    );
    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save the comment. Try again." }, { status: 500 });
  }
}
