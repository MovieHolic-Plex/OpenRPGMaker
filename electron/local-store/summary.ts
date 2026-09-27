import { existsSync } from "node:fs";
import { join } from "node:path";
import { openNodeSqliteDriver } from "./driver";
import { PROJECT_STORE_FILE } from "./schema";

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
