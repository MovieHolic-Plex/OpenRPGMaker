import { cp, lstat, mkdtemp, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { openNodeSqliteDriver } from "../local-store/driver";
import { assignCopiedProjectId } from "../local-store/projectIdentity";
import { META_KEYS, PROJECT_STORE_FILE } from "../local-store/schema";

async function folderEntryExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function publishCopyFolder(staging: string, source: string): Promise<string> {
  const base = basename(source) + " 사본";
  for (let i = 1; i <= 999; i++) {
    const path = join(dirname(source), i === 1 ? base : `${base} ${i}`);
    if (await folderEntryExists(path)) continue;
    try {
      await rename(staging, path);
      return path;
    } catch (error) {
      // The name may have been taken while the copy was being published.
      if (!(await folderEntryExists(path))) throw error;
    }
  }
  throw new Error("사본을 만들 폴더 이름을 찾지 못했습니다.");
}

/** Stage the database and files together, then publish the completed sibling folder. */
export async function duplicateProjectFolder(source: string): Promise<{ projectDir: string; title: string }> {
  const staging = await mkdtemp(join(dirname(source), ".oprn-copy-"));
  try {
    const snapshotPath = join(staging, PROJECT_STORE_FILE);
    const sourceDb = join(source, PROJECT_STORE_FILE);
    const db = openNodeSqliteDriver(sourceDb, { readOnly: true });
    try {
      // Snapshot committed pages, including WAL, without copying live SQLite sidecars.
      db.prepare("VACUUM INTO ?").run([snapshotPath]);
    } finally { db.close(); }

    const copy = openNodeSqliteDriver(snapshotPath);
    let title: string | null;
    try {
      const sourceId = copy.prepare("SELECT value FROM meta WHERE key = ?").get([META_KEYS.projectId])?.value;
      if (typeof sourceId !== "string" || !sourceId) throw new Error("프로젝트 저장소를 확인하지 못했습니다.");
      const storedTitle = copy.prepare("SELECT title FROM project WHERE id = 1").get([])?.title;
      title = typeof storedTitle === "string" && storedTitle ? storedTitle : null;
      assignCopiedProjectId(copy, sourceId);
    } finally { copy.close(); }

    const excluded = new Set(["", "-wal", "-shm", "-journal"].map((suffix) => sourceDb + suffix));
    await cp(source, staging, { recursive: true, force: false, errorOnExist: true, verbatimSymlinks: true, filter: (path) => !excluded.has(path) });
    const projectDir = await publishCopyFolder(staging, source);
    return { projectDir, title: title ?? basename(projectDir) };
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch((cleanupError: unknown) => console.warn("[project] 사본 정리 실패:", cleanupError));
    throw error;
  }
}
