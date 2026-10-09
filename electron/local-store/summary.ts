import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { openNodeSqliteDriver } from "./driver";
import { ASSETS_DIR, PROJECT_STORE_FILE } from "./schema";
import type { ProjectCoverSource } from "../shared/start";

export type ProjectFolderSummary = {
  readonly title: string | null;
  readonly updatedAt: string | null;
  readonly mapCount: number;
};

/**
 * 시작 화면 최근 목록용 요약. 문서 본문(current_json, 수십 MB)은 읽지 않고 저장 행 메타와 맵 거울 수만 본다.
 * 읽기 전용 연결(query_only)이라 세션이 같은 파일을 열어 둬도 쓰지 않는다. 폴더가 저장소가 아니면 null.
 */
export function readProjectFolderSummary(projectDir: string): ProjectFolderSummary | null {
  const path = join(projectDir, PROJECT_STORE_FILE);
  // 없는 경로를 열면 SQLite 가 빈 파일을 만든다 — 먼저 확인한다.
  if (!existsSync(path)) return null;
  let driver: ReturnType<typeof openNodeSqliteDriver>;
  try {
    driver = openNodeSqliteDriver(path);
  } catch {
    return null;
  }
  try {
    driver.exec("PRAGMA busy_timeout=2000");
    driver.exec("PRAGMA query_only=1");
    const row = driver.prepare("SELECT project_id, title, updated_at FROM project WHERE id = 1").get([]);
    if (!row) return { title: null, updatedAt: null, mapCount: 0 };
    const count = driver.prepare("SELECT COUNT(*) AS count FROM maps WHERE project_id = ?").get([String(row.project_id)]);
    return {
      title: row.title === null || row.title === undefined ? null : String(row.title),
      updatedAt: row.updated_at === null || row.updated_at === undefined ? null : String(row.updated_at),
      mapCount: count ? Number(count.count ?? 0) : 0,
    };
  } catch {
    return null;
  } finally {
    driver.close();
  }
}

/** 카드 그림 재료로 싣는 업로드 타일셋 그림 상한. 이보다 큰 그림판은 카드에서 첫 글자로 둔다. */
const MAX_UPLOADED_TILESET_BYTES = 16 * 1024 * 1024;
const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function parseOrNull(text: unknown): unknown {
  if (typeof text !== "string") return null;
  try { return JSON.parse(text); } catch { return null; }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/**
 * 시작 맵과 그 타일셋을 읽는다(시작 화면이 카드 그림을 굽는 재료). 읽기 전용 연결이고,
 * 수십 MB 인 문서 본문은 SQLite 의 JSON 함수로 필요한 칸만 꺼낸다 — 렌더러로 문서를 통째로 넘기지 않는다.
 * 맵이나 타일셋을 못 찾으면 null(빈 폴더·옛 형식).
 */
export function readProjectCoverSource(projectDir: string): ProjectCoverSource | null {
  const path = join(projectDir, PROJECT_STORE_FILE);
  if (!existsSync(path)) return null;
  let driver: ReturnType<typeof openNodeSqliteDriver>;
  try {
    driver = openNodeSqliteDriver(path);
  } catch {
    return null;
  }
  try {
    driver.exec("PRAGMA busy_timeout=2000");
    driver.exec("PRAGMA query_only=1");
    const head = driver.prepare(
      "SELECT project_id, json_extract(current_json, '$.startMapId') AS start_map, json_extract(current_json, '$.startPos') AS start_pos FROM project WHERE id = 1",
    ).get([]);
    if (!head) return null;
    const projectId = String(head.project_id);
    const startMapId = typeof head.start_map === "string" ? head.start_map : null;
    // 맵은 저장마다 갱신되는 맵 거울(maps) 표에서 읽는다. 거울이 없는 옛 저장소면 문서에서 꺼낸다.
    const mirror = startMapId
      ? driver.prepare("SELECT map_id, map_json FROM maps WHERE project_id = ? AND map_id = ?").get([projectId, startMapId])
        ?? driver.prepare("SELECT map_id, map_json FROM maps WHERE project_id = ? ORDER BY map_id LIMIT 1").get([projectId])
      : driver.prepare("SELECT map_id, map_json FROM maps WHERE project_id = ? ORDER BY map_id LIMIT 1").get([projectId]);
    let map = asRecord(parseOrNull(mirror?.map_json));
    if (!map && startMapId) {
      const row = driver.prepare("SELECT value FROM json_each((SELECT current_json FROM project WHERE id = 1), '$.maps') WHERE key = ?").get([startMapId]);
      map = asRecord(parseOrNull(row?.value));
    }
    if (!map || typeof map.tilesetId !== "string") return null;
    const tilesetRow = driver.prepare(
      "SELECT json_remove(value, '$.referenceDocuments') AS value FROM json_each((SELECT current_json FROM project WHERE id = 1), '$.tilesets') WHERE key = ?",
    ).get([map.tilesetId]);
    let tileset = asRecord(parseOrNull(tilesetRow?.value));
    // 접힌 행(형식 2)이면 타일셋 칸은 {"$blob": sha} 표식이고 본문은 tileset_blobs 에 있다.
    if (tileset && typeof tileset.$blob === "string") {
      const blob = driver.prepare("SELECT json_remove(body, '$.referenceDocuments') AS body FROM tileset_blobs WHERE sha256 = ?").get([tileset.$blob]);
      tileset = asRecord(parseOrNull(blob?.body));
    }
    if (!tileset) return null;
    const image = asRecord(tileset.image);
    let uploadedImage: string | null = null;
    if (image?.type === "uploaded" && typeof image.id === "string") {
      uploadedImage = readUploadedImage(driver, projectDir, image.id);
      if (!uploadedImage) return null;
    }
    const pos = asRecord(parseOrNull(head.start_pos));
    const focus = map.id === startMapId && pos && typeof pos.x === "number" && typeof pos.y === "number" ? { x: pos.x, y: pos.y } : null;
    return { map, tileset, focus, uploadedImage };
  } catch {
    return null;
  } finally {
    driver.close();
  }
}

function readUploadedImage(driver: ReturnType<typeof openNodeSqliteDriver>, projectDir: string, assetId: string): string | null {
  const row = driver.prepare(
    "SELECT json_extract(value, '$.ref.sha256') AS sha, json_extract(value, '$.ref.extension') AS ext, json_extract(value, '$.ref.mime') AS mime, json_extract(value, '$.dataUrl') AS data_url FROM json_each((SELECT current_json FROM project WHERE id = 1), '$.assets.uploaded') WHERE key = ?",
  ).get([assetId]);
  if (!row) return null;
  if (typeof row.data_url === "string" && row.data_url.startsWith("data:image/")) {
    return row.data_url.length <= MAX_UPLOADED_TILESET_BYTES * 1.4 ? row.data_url : null;
  }
  const sha = typeof row.sha === "string" && /^[0-9a-f]{64}$/.test(row.sha) ? row.sha : null;
  const ext = typeof row.ext === "string" && /^[a-z0-9]{1,8}$/.test(row.ext) ? row.ext : null;
  const mime = typeof row.mime === "string" && IMAGE_MIME.has(row.mime) ? row.mime : null;
  if (!sha || !ext || !mime) return null;
  const file = join(projectDir, ASSETS_DIR, sha + "." + ext);
  if (!existsSync(file) || statSync(file).size > MAX_UPLOADED_TILESET_BYTES) return null;
  return "data:" + mime + ";base64," + readFileSync(file).toString("base64");
}
