import { NextRequest, NextResponse } from "next/server";
import { getPool } from "~/lib/db";
import { clientIp, rateLimit } from "~/lib/rateLimit";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["general", "showcase", "qna", "feedback"]);

export async function POST(req: NextRequest) {
  if (!rateLimit(`post:${clientIp(req)}`, 6, 60_000)) {
    return NextResponse.json({ error: "Too many posts — wait a minute and try again." }, { status: 429 });
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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 120) {
    return NextResponse.json({ error: "A title (max 120 chars) is required." }, { status: 400 });
  }
  if (!CATEGORIES.has(String(body.category))) {
    return NextResponse.json({ error: "Unknown category." }, { status: 400 });
  }
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "The post body is empty." }, { status: 400 });

  try {
    const { rows } = await getPool().query(
      `insert into openrpg_posts (category, title, body, author, lang)
       values ($1, $2, $3, $4, $5) returning id`,
      [
        body.category,
        title,
        text.slice(0, 10000),
        typeof body.author === "string" && body.author.trim() ? body.author.trim().slice(0, 40) : "anonymous",
        body.lang === "ko" ? "ko" : "en",
      ],
    );
    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save the post. Try again." }, { status: 500 });
  }
}
