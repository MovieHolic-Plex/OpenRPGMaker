import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, rmSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodeDataUrlBytes, dataUrlExtension, dataUrlMime } from "../../src/project/persistence/core/dataUrl";
import { canonicalJsonString } from "../../src/project/persistence/core/canonicalJson";
import { deserializeStoredProjectJson } from "../../src/project/persistence/core/loadRepair";
import { mergeTeamProject, validateMergedTeamProject } from "../../src/project/persistence/core/teamMerge";
import type { MapSaveConflict } from "../../src/project/persistence/core/mapMerge";
import { projectWire, type ProjectWire } from "../../src/project/persistence/core/projectWire";
import type { GameMap, Project, UploadedAsset, UploadedAssetRef } from "../../src/project/types";
import { applyStorePragmas, openNodeSqliteDriver, readDataVersion, type Driver, type DriverValue } from "./driver";
import { LocalStoreError } from "./errors";
import { ASSETS_DIR, BACKUPS_DIR, LOCAL_STORE_FORMAT_VERSION, META_KEYS, PROJECT_STORE_FILE, STORE_DDL } from "./schema";

export type LocalStoreSaveResult =
  | { readonly kind: "saved"; readonly sha256: string; readonly revision: number; readonly serialized?: string }
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
  /** 3자 병합에만 쓰는 기준본. 호스트 디스패치는 필요할 때만 역직렬화하도록 getBaseProject 를 준다. */
  readonly baseProject?: Project;
  readonly getBaseProject?: () => Project;
  readonly project: Project;
  readonly changedMapIds?: readonly string[];
  /** Stored sha the base was read from; lets the save skip echoing an unmerged document. */
  readonly baseSha?: string | null;
};

export type LocalCommitInput = {
  readonly identity: {
  /** 이관 시 원본 commit_id·created_at 을 보존한다. 일반 저장에서는 생략한다. */
    readonly id: string;
    readonly label: string;
    readonly kind: string;
    readonly agentName?: string;
  };
  readonly reviewStatus: string;
  readonly summary: string;
  readonly parentCommitId?: string | null;
  readonly diff?: unknown;
  readonly toolNames?: readonly string[];
  readonly editActivity?: unknown;
};

export type LocalCommitRow = {
  readonly agentName: string | null;
  readonly authorId: string | null;
  readonly authorKind: string | null;
  readonly authorLabel: string | null;
  readonly commitId: string;
  readonly createdAt: string | null;
  readonly currentSha256: string | null;
  readonly message: string;
  readonly reviewStatus: string | null;
  readonly summary: string | null;
};

export type LocalActivityInput = {
  readonly logId: string;
  readonly runId?: string;
  readonly channel: string;
  readonly instruction: string;
  readonly mapId?: string;
  readonly payload: unknown;
};

export type LocalActivityListOptions = { readonly runId?: string };

export type LocalConversationInput = {
  readonly conversationId: string;
  readonly destinationProjectId?: string | null;
  readonly title: string;
  readonly model: string;
  readonly projectContextKey?: string;
  readonly entries: unknown;
  readonly savedAt: number;
};

export type LocalConversationListOptions = {
  readonly query?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly signal?: { readonly throwIfAborted?: () => void };
  readonly includeEntries?: boolean;
  readonly projectContextKey?: string;
};

export type LocalAnalysisRunInput = {
  readonly tilesetId: string;
  readonly selectedTiles: readonly number[];
  readonly promptContext: unknown;
  readonly result: unknown;
};

export type LocalStoreRow = Readonly<Record<string, unknown>>;

export type LocalAssetInput = {
  readonly mime: string;
  readonly extension: string;
  readonly originalName?: string;
  readonly kind?: string;
};

export type LocalAssetRow = {
  readonly sha256: string;
  readonly mime: string;
  readonly bytes: number;
  readonly extension: string;
  readonly originalName: string | null;
  readonly kind: string | null;
  readonly createdAt: string;
};

export type LocalMediaSeparationResult = {
  readonly changed: boolean;
  readonly migratedAssetIds: readonly string[];
  readonly project: Project;
  readonly sha256: string | null;
  readonly revision: number;
};

const MEDIA_SEPARATION_LABEL = "미디어 분리";

export type LocalProjectStore = {
  readonly projectDir: string;
  readonly projectId: string;
  info(): LocalStoreInfo;
  mapMirrors(): ReadonlyMap<string, LocalMapMirror>;
  loadSnapshot(): LocalProjectSnapshot | null;
  saveProject(project: Project): Promise<LocalStoreSaveResult>;
  saveSerialized(serialized: string, expectedSha?: string | null): Promise<LocalStoreSaveResult>;
  saveMapPatch(input: LocalMapPatchInput): Promise<LocalStoreSaveResult>;
  recordCommit(input: LocalCommitInput): string;
  listCommits(limit: number): readonly LocalCommitRow[];
  recordActivity(input: LocalActivityInput): void;
  listActivity(limit: number, options?: LocalActivityListOptions): readonly LocalStoreRow[];
  recordConversation(input: LocalConversationInput): void;
  listConversations(options: LocalConversationListOptions): readonly LocalStoreRow[];
  loadConversation(conversationId: string): LocalStoreRow | null;
  recordAnalysisRun(input: LocalAnalysisRunInput): void;
  putAsset(bytes: Uint8Array, input: LocalAssetInput): Promise<UploadedAssetRef>;
  assetBytes(sha256: string): Promise<Uint8Array>;
  listAssets(): readonly LocalAssetRow[];
  pruneUnusedAssets(referenced: readonly string[]): Promise<readonly string[]>;
  separateInlineMedia(project: Project): Promise<LocalMediaSeparationResult>;
  importHistory(tables: {
    readonly commits?: readonly Record<string, unknown>[];
    readonly changes?: readonly Record<string, unknown>[];
    readonly aiActivityLogs?: readonly Record<string, unknown>[];
    readonly aiConversations?: readonly Record<string, unknown>[];
    readonly aiAnalysisRuns?: readonly Record<string, unknown>[];
  }): void;
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

/**
 * 문서 본문 없이 저장 행의 메타만 읽는다. 실측(2026-09-26, 81MB 새 프로젝트): `info()` 가 sha 하나를 보려고
 * current_json 81MB 를 끌어오는 데 한 번에 약 0.4s 걸렸고, 팀 상태 폴링(3초)·맵 패치마다 돌았다.
 */
function readProjectMeta(driver: Driver): Omit<ProjectRow, "serialized"> | null {
  const row = driver.prepare(
    "SELECT project_id, title, document_version, current_sha256, revision, updated_at FROM project WHERE id = 1",
  ).get([]);
  if (!row) return null;
  return {
    projectId: String(row.project_id),
    title: row.title === null || row.title === undefined ? null : String(row.title),
    documentVersion: Number(row.document_version),
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
  const revision = (readProjectMeta(driver)?.revision ?? 0) + 1;
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

function jsonOrNull(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function parseOrNull(value: DriverValue | undefined): unknown {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text === "" ? null : JSON.parse(text);
}

function nullableText(value: DriverValue | undefined): string | null {
  return value === null || value === undefined ? null : String(value);
}

function clampLimit(limit: number): number {
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

function sha256HexOfBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function insertCommit(driver: Driver, projectId: string, input: LocalCommitInput, now: string): string {
  const commitId = randomUUID();
  driver.prepare(
    `INSERT INTO commits (commit_id, project_id, parent_commit_id, created_at, message, summary, review_status,
       author_id, author_kind, author_label, agent_name, current_sha256, diff_json, tool_names_json, edit_activity_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run([
    commitId,
    projectId,
    input.parentCommitId ?? null,
    now,
    input.summary,
    input.summary,
    input.reviewStatus,
    input.identity.id,
    input.identity.kind,
    input.identity.label,
    input.identity.agentName ?? null,
    readProjectMeta(driver)?.sha256 ?? null,
    jsonOrNull(input.diff),
    jsonOrNull(input.toolNames ?? []),
    jsonOrNull(input.editActivity),
  ]);
  return commitId;
}

function writeAssetBytes(
  projectDir: string,
  driver: Driver,
  bytes: Uint8Array,
  input: LocalAssetInput,
  now: string,
): UploadedAssetRef {
  if (!/^[a-zA-Z0-9]{1,12}$/.test(input.extension)) throw new LocalStoreError("asset", "invalid asset extension");
  const sha256 = sha256HexOfBytes(bytes);
  const assetsDir = join(projectDir, ASSETS_DIR);
  mkdirSync(assetsDir, { recursive: true });
  const filePath = join(assetsDir, `${sha256}.${input.extension}`);
  if (!existsSync(filePath)) writeFileSync(filePath, bytes);
  driver.prepare(
    `INSERT INTO assets (sha256, mime, bytes, extension, original_name, kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(sha256) DO UPDATE SET mime = excluded.mime, extension = excluded.extension,
       original_name = excluded.original_name, kind = excluded.kind`,
  ).run([sha256, input.mime, bytes.byteLength, input.extension, input.originalName ?? null, input.kind ?? null, now]);
  return { sha256, mime: input.mime, bytes: bytes.byteLength, extension: input.extension };
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function backupStamp(now: string): string {
  return now.replace(/[:.]/g, "-");
}

function createStore(driver: Driver, options: OpenLocalProjectStoreOptions, projectId: string, clock: () => string): LocalProjectStore {
  // 마지막으로 이 프로세스가 쓴(또는 읽은) 문서 문자열. 저장 행 sha 가 같을 때만 쓴다 — 다른 프로세스가
  // 행을 바꾸면 sha 가 달라 자동으로 버려진다. 문자열은 불변이라 공유해도 안전하다.
  // 실측(2026-09-26, 81MB 새 프로젝트): 패치·상태 조회마다 81MB 행을 다시 읽었다(한 번에 약 0.4s).
  let cached: { readonly sha256: string; readonly serialized: string } | null = null;
  const remember = (sha256: string, serialized: string): void => {
    cached = { sha256, serialized };
  };
  const cachedFor = (sha256: string | null | undefined) => (sha256 && cached?.sha256 === sha256 ? cached : null);
  const storedSerialized = (): string | null => {
    const meta = readProjectMeta(driver);
    if (!meta) return null;
    const hit = cachedFor(meta.sha256);
    if (hit) return hit.serialized;
    const row = readProjectRow(driver);
    if (!row) return null;
    remember(row.sha256, row.serialized);
    return row.serialized;
  };
  return {
    projectDir: options.projectDir,
    projectId,
    info(): LocalStoreInfo {
      const row = readProjectMeta(driver);
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
      const meta = readProjectMeta(driver);
      if (!meta) return null;
      const serialized = storedSerialized();
      if (serialized === null) return null;
      return { project: deserializeStoredProjectJson(JSON.parse(serialized)), sha256: meta.sha256, revision: meta.revision };
    },
    async saveProject(project: Project): Promise<LocalStoreSaveResult> {
      const wire = await projectWire(project);
      const saved = driver.transaction(() => ({
        kind: "saved" as const,
        sha256: wire.sha256,
        revision: writeProjectRow(driver, project, wire, projectId, clock()),
      }));
      remember(wire.sha256, wire.serialized);
      return saved;
    },
    async saveSerialized(serialized: string, expectedSha?: string | null): Promise<LocalStoreSaveResult> {
      const json = JSON.parse(serialized);
      const parsed = deserializeStoredProjectJson(json, serialized);
      const wire: ProjectWire = {
        serialized,
        json,
        sha256: sha256HexOfText(serialized),
      };
      const result = driver.transaction((): LocalStoreSaveResult => {
        if (expectedSha !== undefined && (readProjectMeta(driver)?.sha256 ?? null) !== expectedSha) {
          return { kind: "conflict", conflicts: [{ mapId: "project", name: "프로젝트가 다른 사용자에 의해 변경되었습니다" }] };
        }
        // The caller already holds `serialized`; echoing a multi-megabyte body back
        // over the HTTP bridge doubled every web save.
        return { kind: "saved", sha256: wire.sha256,
          revision: writeProjectRow(driver, parsed, wire, projectId, clock()) };
      });
      if (result.kind === "saved") remember(wire.sha256, serialized);
      return result;
    },
    async saveMapPatch(input: LocalMapPatchInput): Promise<LocalStoreSaveResult> {
      for (let attempt = 0; attempt < MAP_PATCH_MAX_ATTEMPTS; attempt += 1) {
        const planned = readProjectMeta(driver);
        // 호출자의 기준이 저장 행 그대로면(baseSha 일치) 그 뒤로 쓴 사람이 없다 — latest ≡ base 라 3자 병합은
        // 언제나 local 이다. 병합을 건너뛴다. 실측(2026-09-26, 81MB 새 프로젝트 문서, 칠하기 한 칸): 저장 행
        // 역직렬화 1.9s + 타일셋마다 정렬 직렬화 비교하는 mergeTeamProject 5.3s 가 매 패치에 돌았다(호스트 15s).
        // 검증·와이어·CAS 쓰기는 그대로라 그 사이 다른 저장이 끼면 아래에서 다시 병합 경로를 탄다.
        const baseIsStored = input.baseSha != null && planned?.sha256 === input.baseSha;
        const storedText = baseIsStored || !planned ? null : storedSerialized();
        const baseProject = baseIsStored ? null : (input.baseProject ?? input.getBaseProject?.());
        if (!baseIsStored && !baseProject) throw new LocalStoreError("cas", "map patch base is required to merge");
        const plan = baseIsStored
          ? { kind: "merged" as const, project: input.project }
          : mergeTeamProject(
            baseProject!,
            input.project,
            storedText !== null ? deserializeStoredProjectJson(JSON.parse(storedText)) : baseProject!,
          );
        // Never trust a caller-supplied map-id list: all changed roots must participate.
        if (plan.kind === "conflict") return plan;
        validateMergedTeamProject(plan.project);
        const wire = await projectWire(plan.project);
        const written = driver.transaction((): LocalStoreSaveResult | null => {
          if ((readProjectMeta(driver)?.sha256 ?? null) !== (planned?.sha256 ?? null)) return null;
          const revision = writeProjectRow(driver, plan.project, wire, projectId, clock());
          // Nobody wrote since the caller's base: the merge is the caller's own document,
          // so only a real team merge has content worth sending back.
          const untouched = input.baseSha != null && planned?.sha256 === input.baseSha;
          return untouched
            ? { kind: "saved", sha256: wire.sha256, revision }
            : { kind: "saved", sha256: wire.sha256, serialized: wire.serialized, revision };
        });
        if (written) {
          remember(wire.sha256, wire.serialized);
          return written;
        }
      }
      throw new LocalStoreError("cas", "project changed too often while saving a patch");
    },
    exportSerialized(): string | null {
      return storedSerialized();
    },
    backup(): string {
      const backupDir = join(options.projectDir, BACKUPS_DIR, `${backupStamp(clock())}-${randomUUID()}`);
      mkdirSync(join(backupDir, ASSETS_DIR), { recursive: true });
      const target = join(backupDir, PROJECT_STORE_FILE);
      try {
        driver.exec(`VACUUM INTO ${sqlLiteral(target)}`);
        const snapshot = openNodeSqliteDriver(target);
        try {
          for (const row of snapshot.prepare('SELECT sha256,extension FROM assets').all([])) {
            const name = `${String(row.sha256)}.${String(row.extension)}`;
            copyFileSync(join(options.projectDir, ASSETS_DIR, name), join(backupDir, ASSETS_DIR, name));
          }
        } finally { snapshot.close(); }
      } catch (error) { rmSync(backupDir, { recursive: true, force: true }); throw error; }
      return target;
    },
    recordCommit(input: LocalCommitInput): string {
      return insertCommit(driver, projectId, input, clock());
    },
    listCommits(limit: number): readonly LocalCommitRow[] {
      return driver.prepare(
        `SELECT commit_id, message, summary, review_status, author_id, author_kind, author_label, agent_name, created_at, current_sha256
           FROM commits WHERE project_id = ? ORDER BY created_at DESC, commit_id ASC LIMIT ?`,
      ).all([projectId, clampLimit(limit)]).map((row) => ({
        agentName: nullableText(row.agent_name),
        authorId: nullableText(row.author_id),
        authorKind: nullableText(row.author_kind),
        authorLabel: nullableText(row.author_label),
        commitId: String(row.commit_id),
        createdAt: nullableText(row.created_at),
        currentSha256: nullableText(row.current_sha256),
        message: String(row.message ?? ""),
        reviewStatus: nullableText(row.review_status),
        summary: nullableText(row.summary),
      }));
    },
    recordActivity(input: LocalActivityInput): void {
      driver.prepare(
        `INSERT INTO ai_activity_logs (log_id, project_id, run_id, channel, instruction, map_id, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(log_id) DO UPDATE SET run_id = excluded.run_id, channel = excluded.channel,
           instruction = excluded.instruction, map_id = excluded.map_id, payload_json = excluded.payload_json`,
      ).run([
        input.logId,
        projectId,
        input.runId ?? null,
        input.channel,
        input.instruction,
        input.mapId ?? null,
        jsonOrNull(input.payload),
        clock(),
      ]);
    },
    listActivity(limit: number, options: LocalActivityListOptions = {}): readonly LocalStoreRow[] {
      const rows = driver.prepare(
        `SELECT log_id, run_id, channel, instruction, map_id, payload_json, created_at FROM ai_activity_logs
         WHERE project_id = ? ORDER BY created_at DESC, log_id ASC LIMIT ?`,
      ).all([projectId, clampLimit(limit)]);
      return rows
        .filter((row) => (options.runId === undefined ? true : row.run_id === options.runId))
        .map((row) => ({
          log_id: String(row.log_id),
          run_id: nullableText(row.run_id),
          channel: String(row.channel),
          instruction: String(row.instruction),
          map_id: nullableText(row.map_id),
          payload_json: parseOrNull(row.payload_json),
          created_at: nullableText(row.created_at),
          source: "ai_activity_logs",
        }));
    },
    recordConversation(input: LocalConversationInput): void {
      const scopeProjectId = input.destinationProjectId
        ?? (input.projectContextKey?.startsWith("remote:") ? input.projectContextKey.slice(7) : projectId);
      driver.prepare(
        `INSERT INTO ai_conversations (conversation_id, project_id, title, model, project_context_key, entries_json, saved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(conversation_id) DO UPDATE SET title = excluded.title, model = excluded.model,
           project_context_key = excluded.project_context_key, entries_json = excluded.entries_json, saved_at = excluded.saved_at`,
      ).run([
        input.conversationId,
        scopeProjectId,
        input.title,
        input.model,
        input.projectContextKey ?? null,
        jsonOrNull(input.entries),
        new Date(input.savedAt).toISOString(),
      ]);
    },
    listConversations(options: LocalConversationListOptions): readonly LocalStoreRow[] {
      options.signal?.throwIfAborted?.();
      const query = options.query?.trim().toLowerCase();
      const rows = driver.prepare(
        `SELECT conversation_id, project_id, title, model, project_context_key, entries_json, saved_at
           FROM ai_conversations WHERE project_id = ?
           ORDER BY saved_at DESC, conversation_id ASC`,
      ).all([projectId]);
      const filtered = rows
        .filter((row) => (options.projectContextKey === undefined ? true : row.project_context_key === options.projectContextKey))
        .filter((row) => (query ? String(row.title).toLowerCase().includes(query) : true));
      const offset = Math.max(0, Math.floor(options.offset ?? 0));
      const limit = clampLimit(options.limit ?? 50);
      return filtered.slice(offset, offset + limit).map((row) => ({
        conversation_id: String(row.conversation_id),
        project_id: String(row.project_id),
        title: String(row.title),
        model: nullableText(row.model),
        project_context_key: nullableText(row.project_context_key),
        saved_at: nullableText(row.saved_at),
        ...(options.includeEntries === true ? { entries_json: parseOrNull(row.entries_json) } : {}),
      }));
    },
    loadConversation(conversationId: string): LocalStoreRow | null {
      const row = driver.prepare(
        "SELECT conversation_id, project_id, title, model, project_context_key, entries_json, saved_at FROM ai_conversations WHERE conversation_id = ?",
      ).get([conversationId]);
      if (!row) return null;
      return {
        conversation_id: String(row.conversation_id),
        project_id: String(row.project_id),
        title: String(row.title),
        model: nullableText(row.model),
        project_context_key: nullableText(row.project_context_key),
        entries_json: parseOrNull(row.entries_json),
        saved_at: nullableText(row.saved_at),
      };
    },
    recordAnalysisRun(input: LocalAnalysisRunInput): void {
      driver.prepare(
        `INSERT INTO ai_analysis_runs (run_id, project_id, tileset_id, selected_tile_ids_json, prompt_context_json, result_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run([
        randomUUID(),
        projectId,
        input.tilesetId,
        jsonOrNull(input.selectedTiles),
        jsonOrNull(input.promptContext),
        jsonOrNull(input.result),
        clock(),
      ]);
    },
    putAsset(bytes: Uint8Array, input: LocalAssetInput): Promise<UploadedAssetRef> {
      return Promise.resolve(writeAssetBytes(options.projectDir, driver, bytes, input, clock()));
    },
    assetBytes(sha256: string): Promise<Uint8Array> {
      const row = driver.prepare("SELECT extension FROM assets WHERE sha256 = ?").get([sha256]);
      if (!row) return Promise.reject(new LocalStoreError("asset", `asset ${sha256} is not registered`));
      return Promise.resolve(new Uint8Array(readFileSync(join(options.projectDir, ASSETS_DIR, `${sha256}.${String(row.extension)}`))));
    },
    listAssets(): readonly LocalAssetRow[] {
      return driver
        .prepare("SELECT sha256, mime, bytes, extension, original_name, kind, created_at FROM assets ORDER BY created_at ASC, sha256 ASC")
        .all([])
        .map((row) => ({
          sha256: String(row.sha256),
          mime: String(row.mime),
          bytes: Number(row.bytes),
          extension: String(row.extension),
          originalName: nullableText(row.original_name),
          kind: nullableText(row.kind),
          createdAt: nullableText(row.created_at) ?? "",
        }));
    },
    pruneUnusedAssets(referenced: readonly string[]): Promise<readonly string[]> {
      const keep = new Set(referenced);
      const removed: string[] = [];
      for (const row of driver.prepare("SELECT sha256, extension FROM assets").all([])) {
        const sha256 = String(row.sha256);
        if (keep.has(sha256)) continue;
        const filePath = join(options.projectDir, ASSETS_DIR, `${sha256}.${String(row.extension)}`);
        if (existsSync(filePath)) unlinkSync(filePath);
        driver.prepare("DELETE FROM assets WHERE sha256 = ?").run([sha256]);
        removed.push(sha256);
      }
      return Promise.resolve(removed);
    },
    async separateInlineMedia(project: Project): Promise<LocalMediaSeparationResult> {
      const migratedAssetIds: string[] = [];
      const uploaded: Record<string, UploadedAsset> = {};
      for (const [id, asset] of Object.entries(project.assets.uploaded)) {
        if (asset.ref || !asset.dataUrl) {
          uploaded[id] = asset;
          continue;
        }
        const bytes = decodeDataUrlBytes(asset.dataUrl);
        const mime = dataUrlMime(asset.dataUrl) ?? "application/octet-stream";
        const ref = writeAssetBytes(
          options.projectDir,
          driver,
          bytes,
          { mime, extension: dataUrlExtension(asset.dataUrl, mime), originalName: asset.name, kind: asset.kind },
          clock(),
        );
        const rest: UploadedAsset = { ...asset };
        delete rest.dataUrl;
        uploaded[id] = { ...rest, ref };
        migratedAssetIds.push(id);
      }
      const current = readProjectMeta(driver);
      if (migratedAssetIds.length === 0) {
        return { changed: false, migratedAssetIds: [], project, sha256: current?.sha256 ?? null, revision: current?.revision ?? 0 };
      }
      const nextProject: Project = { ...project, assets: { ...project.assets, uploaded } };
      const wire = await projectWire(nextProject);
      const revision = driver.transaction(() => writeProjectRow(driver, nextProject, wire, projectId, clock()));
      insertCommit(
        driver,
        projectId,
        {
          identity: { id: "oprn-media-separation", label: MEDIA_SEPARATION_LABEL, kind: "system" },
          reviewStatus: "direct",
          summary: MEDIA_SEPARATION_LABEL,
          toolNames: [],
        },
        clock(),
      );
      return { changed: true, migratedAssetIds, project: nextProject, sha256: wire.sha256, revision };
    },

    importHistory(tables: {
      readonly commits?: readonly Record<string, unknown>[];
      readonly changes?: readonly Record<string, unknown>[];
      readonly aiActivityLogs?: readonly Record<string, unknown>[];
      readonly aiConversations?: readonly Record<string, unknown>[];
      readonly aiAnalysisRuns?: readonly Record<string, unknown>[];
    }): void {
      const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
      const json = (value: unknown): string | null => value == null ? null : typeof value === "string" ? value : JSON.stringify(value);
      driver.transaction(() => {
        for (const row of tables.commits ?? []) {
          driver.prepare(
            `INSERT INTO commits (commit_id, project_id, parent_commit_id, created_at, message, summary, review_status, author_id, author_kind, author_label, agent_name, current_sha256, diff_json, tool_names_json, edit_activity_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          ).run([
            str(row.commit_id) ?? randomUUID(), projectId, str(row.parent_commit_id),
            str(row.created_at) ?? clock(), str(row.message), str(row.summary), str(row.review_status),
            str(row.author_id), str(row.author_kind), str(row.author_label), str(row.agent_name),
            str(row.current_sha256), json(row.diff_json), json(row.tool_names_json), json(row.edit_activity_json),
          ]);
        }
        for (const row of tables.changes ?? []) {
          driver.prepare(
            `INSERT INTO changes (commit_id, entity_kind, entity_id, patch_json) VALUES (?,?,?,?)`,
          ).run([str(row.commit_id) ?? "", str(row.entity_kind) ?? "", str(row.entity_id) ?? "", json(row.patch_json)]);
        }
        for (const row of tables.aiActivityLogs ?? []) {
          driver.prepare(
            `INSERT INTO ai_activity_logs (log_id, project_id, run_id, channel, instruction, map_id, payload_json, created_at) VALUES (?,?,?,?,?,?,?,?)`,
          ).run([str(row.log_id) ?? randomUUID(), projectId, str(row.run_id), str(row.channel) ?? "", str(row.instruction) ?? "", str(row.map_id), json(row.payload_json), str(row.created_at) ?? clock()]);
        }
        for (const row of tables.aiConversations ?? []) {
          driver.prepare(
            `INSERT INTO ai_conversations (conversation_id, project_id, title, model, project_context_key, entries_json, saved_at) VALUES (?,?,?,?,?,?,?)`,
          ).run([str(row.conversation_id) ?? randomUUID(), projectId, str(row.title) ?? "", str(row.model), str(row.project_context_key), json(row.entries_json), str(row.saved_at) ?? clock()]);
        }
        for (const row of tables.aiAnalysisRuns ?? []) {
          driver.prepare(
            `INSERT INTO ai_analysis_runs (run_id, project_id, tileset_id, selected_tile_ids_json, prompt_context_json, result_json, created_at) VALUES (?,?,?,?,?,?,?)`,
          ).run([str(row.run_id) ?? randomUUID(), projectId, str(row.tileset_id), json(row.selected_tile_ids_json), json(row.prompt_context_json), json(row.result_json), str(row.created_at) ?? clock()]);
        }
      });
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
