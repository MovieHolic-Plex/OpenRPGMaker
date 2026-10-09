import { NextResponse } from "next/server";
import { EDITOR_PUBLIC, serveStaticFile } from "~/lib/staticFile";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const rel = segments.map(decodeURIComponent).join("/");
  const res = await serveStaticFile(path.join(EDITOR_PUBLIC, "assets"), rel);
  return res ?? NextResponse.json({ error: "not found" }, { status: 404 });
}
