import { createHash, randomUUID } from "node:crypto";
import { closeSync, copyFileSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, realpathSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { deserializeStoredProjectJson } from "../../src/project/persistence/core/loadRepair";
import type { ProjectBackupEntry, RestoredProject } from "../../src/project/persistence/backupTypes";
import { assetFileName, readVerifiedAsset, writeAssetFile } from "./assetFiles";
import { openNodeSqliteDriver, type Driver } from "./driver";
import { LocalStoreError } from "./errors";
import { ASSETS_DIR, BACKUPS_DIR, LOCAL_STORE_FORMAT_VERSION, META_KEYS, PROJECT_STORE_FILE } from "./schema";
import { foldDocument, foldedTilesetShas, sha256HexOfText } from "./tilesetFold";

/** Read each blob from this backup, without the live store's process cache. */
function backupDocument(db: Driver, raw: string, sha256: string): string {
  const folded = foldedTilesetShas(raw);
  if (!folded) return raw;
  const wire = foldDocument(folded.document, (marker) => {
    const sha = (marker as { readonly $blob: string }).$blob;
    const row = db.prepare("SELECT body FROM tileset_blobs WHERE sha256 = ?").get([sha]);
    if (!row || typeof row.body !== "string" || sha256HexOfText(row.body) !== sha) {
      throw new LocalStoreError("format", "백업 타일셋 본문이 없거나 손상되어 복구를 중단했습니다.");
    }
    return { sha256: sha, text: row.body };
  });
  if (wire.sha256 !== sha256) throw new LocalStoreError("format", "백업 프로젝트가 손상되어 복구를 중단했습니다.");
  return wire.full();
}

/** Read snapshots without migrations, WAL changes, or media separation in the backup. */
function inspectBackup(backupDir: string) {
  const file = join(backupDir, PROJECT_STORE_FILE);
  if (!lstatSync(file).isFile()) throw new LocalStoreError("backup-path", "백업에 project.sqlite 파일이 없습니다.");
  if (existsSync(`${file}-wal`) && statSync(`${file}-wal`).size > 0) {
    throw new LocalStoreError("backup-path", "사용 중인 프로젝트는 복구 원본으로 사용할 수 없습니다. 백업 만들기로 만든 폴더를 선택하세요.");
  }
  const db = openNodeSqliteDriver(file, { readOnly: true });
  try {
    const version = Number(db.prepare("SELECT value FROM meta WHERE key = ?").get([META_KEYS.formatVersion])?.value);
    if (!Number.isInteger(version) || version < 1 || version > LOCAL_STORE_FORMAT_VERSION) {
      throw new LocalStoreError("format", "이 버전에서 복구할 수 없는 백업입니다.");
    }
    const row = db.prepare("SELECT project_id,title,current_json,current_sha256,revision FROM project WHERE id = 1").get([]);
    if (!row) throw new LocalStoreError("backup-path", "백업에 저장된 프로젝트가 없습니다.");
    const projectId = db.prepare("SELECT value FROM meta WHERE key = ?").get([META_KEYS.projectId])?.value;
    if (!projectId || projectId !== row.project_id || !Number.isSafeInteger(Number(row.revision)) || Number(row.revision) < 0) {
      throw new LocalStoreError("format", "백업의 프로젝트 정보가 올바르지 않습니다.");
    }
    return {
      projectId: String(row.project_id), title: String(row.title ?? "이름 없는 프로젝트"),
      serialized: String(row.current_json), sha256: String(row.current_sha256), revision: Number(row.revision),
      document: () => backupDocument(db, String(row.current_json), String(row.current_sha256)),
      assets: db.prepare("SELECT sha256,extension,bytes FROM assets").all([]),
      integrity: () => {
        const checks = db.prepare("PRAGMA quick_check").all([]);
        return checks.length > 0 && checks.every(check => Object.values(check)[0] === "ok");
      },
      close: () => db.close(),
    };
  } catch (error) { db.close(); throw error; }
}

export function backupDirectory(projectDir: string, id: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/.test(id)) throw new LocalStoreError("backup-path", "백업 이름이 올바르지 않습니다.");
  const root = resolve(projectDir, BACKUPS_DIR), dir = resolve(root, id);
  if (realpathSync(root) !== root || !realpathSync(dir).startsWith(root + sep) || lstatSync(dir).isSymbolicLink()) {
    throw new LocalStoreError("backup-path", "프로젝트 백업 폴더 밖의 경로는 열 수 없습니다.");
  }
  return dir;
}

export function listLocalProjectBackups(projectDir: string): ProjectBackupEntry[] {
  const root = join(projectDir, BACKUPS_DIR);
  if (!existsSync(root)) return [];
  const backups: ProjectBackupEntry[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const dir = backupDirectory(projectDir, entry.name), snapshot = inspectBackup(dir);
      try {
        backups.push({ id: entry.name, title: snapshot.title, revision: snapshot.revision,
          createdAt: statSync(join(dir, PROJECT_STORE_FILE)).mtime.toISOString(), assetCount: snapshot.assets.length });
      } finally { snapshot.close(); }
    } catch { /* Incomplete or incompatible snapshots cannot be offered as recovery points. */ }
  }
  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

/** Restore to a new folder only. Validate document and all asset bytes before publishing the copy. */
export async function restoreLocalProjectBackup(backupDir: string, projectDir: string): Promise<RestoredProject> {
  backupDir = resolve(backupDir); projectDir = resolve(projectDir);
  if (existsSync(projectDir)) throw new LocalStoreError("backup-path", "복구 대상 폴더가 이미 있습니다. 새 폴더를 선택하세요.");
  if (projectDir.startsWith(backupDir + sep)) throw new LocalStoreError("backup-path", "백업 안에는 복구할 수 없습니다.");
  const snapshot = inspectBackup(backupDir);
  const pending = join(dirname(projectDir), `.oprn-recovery-${randomUUID()}`);
  try {
    const serialized = snapshot.document();
    if (!snapshot.integrity() || createHash("sha256").update(serialized, "utf8").digest("hex") !== snapshot.sha256) {
      throw new LocalStoreError("format", "백업 프로젝트가 손상되어 복구를 중단했습니다.");
    }
    const project = deserializeStoredProjectJson(JSON.parse(serialized), serialized);
    const assetRows = new Map(snapshot.assets.map(row => [String(row.sha256), row]));
    for (const asset of Object.values(project.assets.uploaded)) {
      if (!asset.ref) continue;
      const row = assetRows.get(asset.ref.sha256);
      // File lookup is SHA based. Reimporting identical bytes under another extension may
      // update the asset row while older document refs still have the original extension.
      if (!row || Number(row.bytes) !== asset.ref.bytes) {
        throw new LocalStoreError("asset", "백업에 프로젝트가 참조하는 소재가 없습니다.");
      }
    }
    mkdirSync(dirname(projectDir), { recursive: true });
    mkdirSync(pending); mkdirSync(join(pending, ASSETS_DIR));
    copyFileSync(join(backupDir, PROJECT_STORE_FILE), join(pending, PROJECT_STORE_FILE));
    if (snapshot.assets.length && (!lstatSync(join(backupDir, ASSETS_DIR)).isDirectory() || lstatSync(join(backupDir, ASSETS_DIR)).isSymbolicLink())) {
      throw new LocalStoreError("asset", "백업 소재 폴더가 올바르지 않습니다.");
    }
    for (const row of snapshot.assets) {
      const sha256 = String(row.sha256), extension = String(row.extension);
      const bytes = readVerifiedAsset(join(backupDir, ASSETS_DIR), sha256, extension, Number(row.bytes));
      writeAssetFile(join(pending, ASSETS_DIR, assetFileName(sha256, extension)), bytes, sha256);
    }
    const copied = inspectBackup(pending);
    try {
      if (!copied.integrity() || copied.sha256 !== snapshot.sha256 || copied.serialized !== snapshot.serialized || copied.document() !== serialized) {
        throw new LocalStoreError("format", "복구 사본을 확인하지 못했습니다.");
      }
    } finally { copied.close(); }
    // Folder copies need their own storage identity: Electron's asset URLs use this ID.
    // Keep the document and its hash unchanged, including the saved game and AI records.
    const restoredId = randomUUID();
    const db = openNodeSqliteDriver(join(pending, PROJECT_STORE_FILE));
    try {
      db.exec("BEGIN IMMEDIATE");
      db.prepare("UPDATE meta SET value = ? WHERE key = ?").run([restoredId, META_KEYS.projectId]);
      for (const table of ["project", "maps", "commits", "ai_activity_logs", "ai_conversations", "ai_analysis_runs"]) {
        db.prepare(`UPDATE ${table} SET project_id = ? WHERE project_id = ?`).run([restoredId, snapshot.projectId]);
      }
      db.exec("COMMIT");
    } finally { db.close(); }
    const restored = inspectBackup(pending);
    try {
      if (!restored.integrity() || restored.projectId !== restoredId || restored.sha256 !== snapshot.sha256 || restored.serialized !== snapshot.serialized) {
        throw new LocalStoreError("format", "복구 사본을 확인하지 못했습니다.");
      }
    } finally { restored.close(); }
    const file = openSync(join(pending, PROJECT_STORE_FILE), "r");
    try { fsyncSync(file); } finally { closeSync(file); }
    if (existsSync(projectDir)) throw new LocalStoreError("backup-path", "복구 대상 폴더가 이미 있습니다.");
    renameSync(pending, projectDir);
    if (process.platform !== "win32") {
      const directory = openSync(dirname(projectDir), "r");
      try { fsyncSync(directory); } finally { closeSync(directory); }
    }
    return { projectDir, projectId: restoredId, sha256: snapshot.sha256, title: snapshot.title };
  } finally {
    snapshot.close();
    if (existsSync(pending)) rmSync(pending, { recursive: true, force: true });
  }
}

export function recoveryProjectDirectory(source: string, root?: string): string {
  return join(root ?? dirname(source), root ? randomUUID() : `${basename(source)}-recovered-${randomUUID()}`);
}
