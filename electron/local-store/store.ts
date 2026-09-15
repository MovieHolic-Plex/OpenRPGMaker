import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { canonicalJsonString } from "../../src/project/persistence/core/canonicalJson";
import { deserializeStoredProjectJson } from "../../src/project/persistence/core/loadRepair";
import { mapPatchChangeSet, planMapPatch, readMapPatchSnapshot } from "../../src/project/persistence/core/mapPatch";
import type { MapSaveConflict } from "../../src/project/persistence/core/mapMerge";
import { projectWire, type ProjectWire } from "../../src/project/persistence/core/projectWire";
import type { GameMap, Project } from "../../src/project/types";
import { applyStorePragmas, openNodeSqliteDriver, readDataVersion, type Driver, type DriverValue } from "./driver";
import { LocalStoreError } from "./errors";
import { ASSETS_DIR, BACKUPS_DIR, LOCAL_STORE_FORMAT_VERSION, META_KEYS, PROJECT_STORE_FILE, STORE_DDL } from "./schema";

export type LocalStoreSaveResult =
  | { readonly kind: "saved"; readonly sha256: string; readonly revision: number }
  | { readonly kind: "conflict"; readonly conflicts: readonly MapSaveConflict[] };

export type LocalProjectSnapshot = {
  readonly project: Project;
  readonly sha256: string;
  readonly revision: number;
};

export type LocalMapMirror = {
  readonly mapId: string;
  readonly name: string | null;
  readonly sha256: string;
};

export type LocalStoreInfo = {
  readonly formatVersion: number;
  readonly projectId: string;
  readonly title: string | null;
  readonly revision: number;
  readonly sha256: string | null;
  readonly mapCount: number;
  readonly updatedAt: string | null;
};

export type LocalMapPatchInput = {
  readonly baseProject: Project;
  readonly project: Project;
  readonly changedMapIds?: readonly string[];
};

export type LocalProjectStore = {
  readonly projectDir: string;
  readonly projectId: string;
  info(): LocalStoreInfo;
  mapMirrors(): ReadonlyMap<string, LocalMapMirror>;
  loadSnapshot(): LocalProjectSnapshot | null;
  saveProject(project: Project): Promise<LocalStoreSaveResult>;
  saveMapPatch(input: LocalMapPatchInput): Promise<LocalStoreSaveResult>;
  exportSerialized(): string | null;
  backup(): string;
  dataVersion(): number;
  close(): void;
};

export type OpenLocalProjectStoreOptions = {
  readonly projectDir: string;
  readonly now?: () => string;
  readonly appVersion?: string;
};

const MAP_PATCH_MAX_ATTEMPTS = 4;

type ProjectRow = {
  readonly projectId: string;
  readonly title: string | null;
  readonly documentVersion: number;
  readonly serialized: string;
  readonly sha256: string;
  readonly revision: number;
  readonly updatedAt: string;
};

function sha256HexOfText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function readMeta(driver: Driver, key: string): string | null {
  const row = driver.prepare("SELECT value FROM meta WHERE key = ?").get([key]);
  if (!row) return null;
  return String(row.value ?? "");
}

function writeMeta(driver: Driver, key: string, value: string): void {
  driver.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run([key, value]);
}

function readProjectRow(driver: Driver): ProjectRow | null {
  const row = driver.prepare(
    "SELECT project_id, title, document_version, current_json, current_sha256, revision, updated_at FROM project WHERE id = 1",
  ).get([]);
  if (!row) return null;
  return {
    projectId: String(row.project_id),
    title: row.title === null || row.title === undefined ? null : String(row.title),
    documentVersion: Number(row.document_version),
    serialized: String(row.current_json),
    sha256: String(row.current_sha256),
    revision: Number(row.revision),
    updatedAt: String(row.updated_at),
  };
}

function mapRowValues(projectId: string, mapId: string, map: GameMap, now: string): readonly DriverValue[] {
  return [
    projectId,
    mapId,
    map.name ?? null,
    typeof map.width === "number" ? map.width : null,
    typeof map.height === "number" ? map.height : null,
    map.tilesetId ?? null,
    JSON.stringify(map),
    sha256HexOfText(canonicalJsonString(map)),
    now,
  ];
}

function replaceMapMirrors(driver: Driver, projectId: string, project: Project, now: string): void {
  const upsert = driver.prepare(
    `INSERT INTO maps (project_id, map_id, name, width, height, tileset_id, map_json, sha256, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, map_id) DO UPDATE SET
       name = excluded.name, width = excluded.width, height = excluded.height, tileset_id = excluded.tileset_id,
       map_json = excluded.map_json, sha256 = excluded.sha256, updated_at = excluded.updated_at`,
  );
  const present = new Set<string>();
  for (const [mapId, map] of Object.entries(project.maps)) {
    upsert.run(mapRowValues(projectId, mapId, map, now));
    present.add(mapId);
  }
  const removal = driver.prepare("DELETE FROM maps WHERE project_id = ? AND map_id = ?");
  for (const row of driver.prepare("SELECT map_id FROM maps WHERE project_id = ?").all([projectId])) {
    const mapId = String(row.map_id);
    if (!present.has(mapId)) removal.run([projectId, mapId]);
  }
}

function writeProjectRow(driver: Driver, project: Project, wire: ProjectWire, projectId: string, now: string): number {
  const revision = (readProjectRow(driver)?.revision ?? 0) + 1;
  driver.prepare(
    `INSERT INTO project (id, project_id, title, document_version, current_json, current_sha256, revision, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, document_version = excluded.document_version, current_json = excluded.current_json,
       current_sha256 = excluded.current_sha256, revision = excluded.revision, updated_at = excluded.updated_at`,
  ).run([
    projectId,
    project.meta?.title ?? null,
    Number(project.version),
    wire.serialized,
    wire.sha256,
    revision,
    now,
  ]);
  replaceMapMirrors(driver, projectId, project, now);
  return revision;
}

function sqlLiteral(value: string): string {
  if (value.includes("'")) throw new LocalStoreError("backup-path", "backup path must not contain a quote");
  return `'${value}'`;
}

function backupStamp(now: string): string {
  return now.replace(/[:.]/g, "-");
}

function createStore(driver: Driver, options: OpenLocalProjectStoreOptions, projectId: string, clock: () => string): LocalProjectStore {
  return {
    projectDir: options.projectDir,
    projectId,
    info(): LocalStoreInfo {
      const row = readProjectRow(driver);
      const mapCount = driver.prepare("SELECT COUNT(*) AS count FROM maps WHERE project_id = ?").get([projectId]);
      return {
        formatVersion: Number(readMeta(driver, META_KEYS.formatVersion) ?? LOCAL_STORE_FORMAT_VERSION),
        projectId,
        title: row?.title ?? null,
        revision: row?.revision ?? 0,
        sha256: row?.sha256 ?? null,
        mapCount: mapCount ? Number(mapCount.count ?? 0) : 0,
        updatedAt: row?.updatedAt ?? null,
      };
    },
    mapMirrors(): ReadonlyMap<string, LocalMapMirror> {
      const mirrors = new Map<string, LocalMapMirror>();
      for (const row of driver.prepare("SELECT map_id, name, sha256 FROM maps WHERE project_id = ?").all([projectId])) {
        const mapId = String(row.map_id);
        mirrors.set(mapId, { mapId, name: row.name === null || row.name === undefined ? null : String(row.name), sha256: String(row.sha256) });
      }
      return mirrors;
    },
    loadSnapshot(): LocalProjectSnapshot | null {
      const row = readProjectRow(driver);
      if (!row) return null;
      return { project: deserializeStoredProjectJson(JSON.parse(row.serialized)), sha256: row.sha256, revision: row.revision };
    },
    async saveProject(project: Project): Promise<LocalStoreSaveResult> {
      const wire = await projectWire(project);
      return driver.transaction(() => ({
        kind: "saved",
        sha256: wire.sha256,
        revision: writeProjectRow(driver, project, wire, projectId, clock()),
      }));
    },
    async saveMapPatch(input: LocalMapPatchInput): Promise<LocalStoreSaveResult> {
      const changeSet = mapPatchChangeSet(input.baseProject, input.project, input.changedMapIds);
      for (let attempt = 0; attempt < MAP_PATCH_MAX_ATTEMPTS; attempt += 1) {
        const planned = readProjectRow(driver);
        const latest = planned ? readMapPatchSnapshot(JSON.parse(planned.serialized)) : changeSet.canonicalBase;
        const plan = await planMapPatch(changeSet, latest);
        if (plan.kind === "conflict") return { kind: "conflict", conflicts: plan.conflicts };
        const written = driver.transaction((): LocalStoreSaveResult | null => {
          const inside = readProjectRow(driver);
          if ((inside?.sha256 ?? null) !== (planned?.sha256 ?? null)) return null;
          return {
            kind: "saved",
            sha256: plan.wire.sha256,
            revision: writeProjectRow(driver, plan.mergedProject, plan.wire, projectId, clock()),
          };
        });
        if (written) return written;
      }
      throw new LocalStoreError("cas", "project changed too often while saving a map patch");
    },
    exportSerialized(): string | null {
      return readProjectRow(driver)?.serialized ?? null;
    },
    backup(): string {
      const backupsDir = join(options.projectDir, BACKUPS_DIR);
      mkdirSync(backupsDir, { recursive: true });
      const target = join(backupsDir, `${backupStamp(clock())}.sqlite`);
      driver.exec(`VACUUM INTO ${sqlLiteral(target)}`);
      return target;
    },
    dataVersion(): number {
      return readDataVersion(driver);
    },
    close(): void {
      driver.close();
    },
  };
}

export async function initLocalProjectStore(options: OpenLocalProjectStoreOptions, appVersion?: string): Promise<LocalProjectStore> {
  mkdirSync(options.projectDir, { recursive: true });
  mkdirSync(join(options.projectDir, ASSETS_DIR), { recursive: true });
  const driver = openNodeSqliteDriver(join(options.projectDir, PROJECT_STORE_FILE));
  const clock = options.now ?? ((): string => new Date().toISOString());
  applyStorePragmas(driver);
  driver.exec(STORE_DDL);
  const existing = readMeta(driver, META_KEYS.projectId);
  const projectId = existing ?? randomUUID();
  if (!existing) {
    writeMeta(driver, META_KEYS.projectId, projectId);
    writeMeta(driver, META_KEYS.formatVersion, String(LOCAL_STORE_FORMAT_VERSION));
    writeMeta(driver, META_KEYS.createdAt, clock());
    if (appVersion ?? options.appVersion) writeMeta(driver, META_KEYS.appVersion, appVersion ?? options.appVersion ?? "");
  }
  return createStore(driver, options, projectId, clock);
}

export async function openLocalProjectStore(options: OpenLocalProjectStoreOptions): Promise<LocalProjectStore> {
  const driver = openNodeSqliteDriver(join(options.projectDir, PROJECT_STORE_FILE));
  applyStorePragmas(driver);
  const projectId = readMeta(driver, META_KEYS.projectId);
  if (!projectId) {
    driver.close();
    throw new LocalStoreError("not-a-store", `no project store in ${options.projectDir}`);
  }
  const formatVersion = Number(readMeta(driver, META_KEYS.formatVersion) ?? 0);
  if (formatVersion > LOCAL_STORE_FORMAT_VERSION) {
    driver.close();
    throw new LocalStoreError("format", `store format ${formatVersion} is newer than this build supports`);
  }
  return createStore(driver, options, projectId, options.now ?? ((): string => new Date().toISOString()));
}
