import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defaultSharedCharacterGraphics, SHARED_CHARACTER_GRAPHICS_ENDPOINT, parseSharedCharacterGraphicsDocument } from "../../src/project/sharedCharacterGraphicsSchema";
import type { CharacterGraphicsDocument } from "../../src/project/characterGraphics";

const MAX_BYTES = 2 * 1024 * 1024;
const digest = (document: CharacterGraphicsDocument): string => createHash("sha256").update(JSON.stringify(document)).digest("hex");

/** One durable library per host user, outside project folders and disposable builds. */
export function sharedCharacterGraphicsFile(): string {
  return process.env.OPRN_SHARED_CHARACTER_GRAPHICS_FILE || join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "oprn", "character-graphics.json");
}

export function readSharedCharacterGraphics(file = sharedCharacterGraphicsFile()) {
  const document = existsSync(file) ? parseSharedCharacterGraphicsDocument(JSON.parse(readFileSync(file, "utf8"))) : defaultSharedCharacterGraphics();
  return { document, revision: digest(document) };
}

export function writeSharedCharacterGraphics(input: unknown, file = sharedCharacterGraphicsFile()) {
  const body = input as { revision?: unknown; document?: unknown } | null;
  if (!body || typeof body.revision !== "string") throw new Error("공용 저장본의 버전이 필요합니다.");
  const document = parseSharedCharacterGraphicsDocument(body.document);
  mkdirSync(dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  let fd: number;
  try { fd = openSync(lock, "wx", 0o600); }
  catch { throw new Error("다른 창에서 공용 자료를 저장 중입니다. 다시 불러온 뒤 적용하세요."); }
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const current = readSharedCharacterGraphics(file);
    if (current.revision !== body.revision) throw new Error("공용 자료가 다른 창에서 변경됐습니다. 다시 불러온 뒤 적용하세요.");
    writeFileSync(temporary, JSON.stringify(document, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    const output = openSync(temporary, "r");
    try { fsyncSync(output); } finally { closeSync(output); }
    if (existsSync(file)) writeFileSync(`${file}.previous`, readFileSync(file), { mode: 0o600 });
    renameSync(temporary, file);
    // Read the accepted file, not an echo of the submitted draft.
    return readSharedCharacterGraphics(file);
  } finally {
    closeSync(fd);
    unlinkSync(lock);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export async function sharedCharacterGraphicsResponse(method: string, body?: unknown) {
  try {
    if (method === "GET") return { status: 200, body: readSharedCharacterGraphics() };
    if (method === "POST") return { status: 200, body: writeSharedCharacterGraphics(body) };
    return { status: 405, body: { error: "GET 또는 POST 요청이 필요합니다." } };
  } catch (error) {
    return { status: method === "POST" ? 409 : 500, body: { error: error instanceof Error ? error.message : "공용 자료 저장 실패" } };
  }
}

export function sharedCharacterGraphicsMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  if ((req.url ?? "").split("?")[0] !== SHARED_CHARACTER_GRAPHICS_ENDPOINT) return next();
  const finish = (status: number, body: unknown): void => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
  };
  // No cross-origin CORS grant. JSON + this non-simple header prevents form/CSRF writes.
  if (req.method === "POST" && (req.headers["x-oprn-shared-catalog"] !== "1"
    || !req.headers["content-type"]?.startsWith("application/json")
    || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`))) {
    finish(403, { error: "같은 편집기에서만 공용 자료를 저장할 수 있습니다." }); return;
  }
  void (async () => {
    let body: unknown;
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BYTES) { finish(413, { error: "공용 자료는 2MB 이하여야 합니다." }); return; }
        chunks.push(Buffer.from(chunk));
      }
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    }
    const result = await sharedCharacterGraphicsResponse(req.method ?? "GET", body);
    finish(result.status, result.body);
  })().catch(() => finish(400, { error: "공용 자료 요청을 읽지 못했습니다." }));
}
