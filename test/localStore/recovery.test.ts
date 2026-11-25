import { afterEach, describe, expect, it, beforeEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { initLocalProjectStore, type LocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createBlankProject } from "@/project/defaults/blankProject";
import { listLocalProjectBackups, restoreLocalProjectBackup } from "../../electron/local-store/recovery";
import { createProjectSessionRegistry } from "../../electron/main/sessions";
import { createStoreHandlers } from "../../electron/main/dispatch";
import { OPRN_CHANNELS } from "../../electron/shared/channels";
import { openNodeSqliteDriver } from "../../electron/local-store/driver";
import { DatabaseSync } from "node:sqlite";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { serialize } from "@/project/io";
import { deserializeStoredProjectJson } from "@/project/persistence/core/loadRepair";
import type { Project } from "@/project/types";
import { sha256HexTextSync } from "@/util/sha256";
import { readPragmaWithForeignConnection } from "./sqliteProbe";
import { isolateTimers } from "../mergedTeardown";

describe("importHistory", () => {
  isolateTimers();
  let directory: string | undefined;
  let store: LocalProjectStore | undefined;
  afterEach(async () => { store?.close(); store = undefined; if (directory) await rm(directory, { recursive: true, force: true }); });
  async function open() {
    directory = await mkdtemp(join(tmpdir(), "oprn-import-history-"));
    store = await initLocalProjectStore({ projectDir: directory }); return store;
  }
  describe("offline history import", () => {
    it("preserves structured JSON and imports every history family", async () => {
      const db = await open();
      db.importHistory({
        commits: [{ commit_id: "commit", created_at: "2026-09-21T00:00:00Z", diff_json: { maps: ["map"] } }],
        changes: [{ commit_id: "commit", entity_kind: "map", entity_id: "map", patch_json: { name: "saved" } }],
        aiActivityLogs: [{ log_id: "activity", channel: "chat", instruction: "hello", payload_json: { ok: true } }],
        aiConversations: [{ conversation_id: "conversation", title: "History", entries_json: [{ kind: "user", text: "hello" }] }],
        aiAnalysisRuns: [{ run_id: "analysis", selected_tile_ids_json: [1, 2], result_json: { ok: true } }],
      });
      expect(db.loadConversation("conversation")?.entries_json).toEqual([{ kind: "user", text: "hello" }]);
      expect(db.listActivity(10)).toHaveLength(1);
      expect(db.listCommits(10)).toHaveLength(1);
    });
    it("rolls back the complete batch when a later row conflicts", async () => {
      const db = await open();
      db.importHistory({ aiConversations: [{ conversation_id: "existing", entries_json: [] }] });
      expect(() => db.importHistory({
        aiActivityLogs: [{ log_id: "must-rollback", channel: "chat", payload_json: {} }],
        aiConversations: [{ conversation_id: "existing", entries_json: [] }],
      })).toThrow();
      expect(db.listActivity(10)).toEqual([]);
      expect(db.listConversations({ limit: 10 })).toHaveLength(1);
    });
  });
});

describe("recovery", () => {
  isolateTimers();
  let root: string;
  let source: LocalProjectStore;
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "oprn-recovery-"));
    source = await initLocalProjectStore({ projectDir: join(root, "original") });
    const project = createBlankProject();
    const ref = await source.putAsset(bytes, { mime: "image/jpeg", extension: "jpeg" });
    project.assets.uploaded.fixture = { id: "fixture", name: "원본", kind: "sprite", ref, meta: {} };
    await source.saveProject(project);
  });
  afterEach(async () => { source.close(); await rm(root, { recursive: true, force: true }); });
  describe("backup recovery", () => {
    it("문서·소재를 재로드하고 저장소 ID만 분리하며 원본과 백업을 보존한다", async () => {
      const backup = dirname(source.backup());
      const before = readFileSync(join(backup, "project.sqlite"));
      // Reading uses SHA, even when a repeated import changed the file extension.
      await source.putAsset(bytes, { mime: "image/jpeg", extension: "jpg" });
      const updatedBackup = dirname(source.backup());
      const result = await restoreLocalProjectBackup(updatedBackup, join(root, "restored"));
      const restored = await openLocalProjectStore({ projectDir: result.projectDir });
      try {
        expect(restored.projectId).not.toBe(source.projectId);
        expect(restored.loadSnapshot()?.sha256).toBe(source.loadSnapshot()?.sha256);
        expect(new Uint8Array(await restored.assetBytes(restored.listAssets()[0]!.sha256))).toEqual(bytes); // assetBytes 는 Node Buffer 를 돌려준다 — 바이트만 비교한다.
        expect(restored.mapMirrors().size).toBe(source.mapMirrors().size);
      } finally { restored.close(); }
      // 수십 MB 짜리 SQLite 를 toEqual 로 비교하면 어긋날 때 diff 를 그리다 워커가 메모리로 죽는다(CI SIGABRT) — 같은 바이트인지 해시로 본다.
      expect(sha256(readFileSync(join(backup, "project.sqlite")))).toBe(sha256(before));
      expect(listLocalProjectBackups(source.projectDir)).toHaveLength(2);
    });

    it("손상된 소재를 거절하고 불완전 복구 폴더를 남기지 않는다", async () => {
      const backup = dirname(source.backup());
      const asset = source.listAssets()[0]!;
      writeFileSync(join(backup, "assets", `${asset.sha256}.${asset.extension}`), bytes.slice(0, 2));
      const target = join(root, "broken-copy");
      await expect(restoreLocalProjectBackup(backup, target)).rejects.toThrow("손상");
      expect(existsSync(target)).toBe(false);
      expect(new Uint8Array(await source.assetBytes(asset.sha256))).toEqual(bytes); // assetBytes 는 Node Buffer 를 돌려준다 — 바이트만 비교한다.
    });

    it("기존 대상 폴더는 덮어쓰지 않는다", async () => {
      const backup = dirname(source.backup());
      const target = join(root, "existing");
      mkdirSync(target); writeFileSync(join(target, "keep.txt"), "남겨야 함");
      await expect(restoreLocalProjectBackup(backup, target)).rejects.toThrow("이미");
      expect(readFileSync(join(target, "keep.txt"), "utf8")).toBe("남겨야 함");
    });

    it("살아 있는 저장소가 본문을 캐시했어도 손상된 백업 타일셋을 거절한다", async () => {
      const backup = dirname(source.backup());
      const db = openNodeSqliteDriver(join(backup, "project.sqlite"));
      try { db.exec("UPDATE tileset_blobs SET body = '{}'"); } finally { db.close(); }
      const target = join(root, "broken-tilesets");
      await expect(restoreLocalProjectBackup(backup, target)).rejects.toThrow("타일셋");
      expect(existsSync(target)).toBe(false);
      expect(source.loadSnapshot()?.project.tilesets).toBeDefined();
    });

    it("IPC가 먼저 캐시한 핸들러도 HTTP 요청의 복구 루트를 사용한다", async () => {
      const sessions = createProjectSessionRegistry();
      await sessions.open("desktop", source.projectDir);
      const handlers = createStoreHandlers(sessions);
      const backupId = listLocalProjectBackups(source.projectDir)[0]?.id ?? dirname(source.backup()).split(/[\\/]/).pop()!;
      const recoveryRoot = join(root, "host-projects");
      try {
        const result = await handlers[OPRN_CHANNELS.projectRestoreBackup]!("desktop", { backupId }, { recoveryRoot }) as { projectDir: string };
        expect(dirname(result.projectDir)).toBe(recoveryRoot);
        expect(existsSync(join(result.projectDir, "project.sqlite"))).toBe(true);
      } finally { sessions.close("desktop"); }
    });
  });
});

describe("localStore", () => {
  isolateTimers();
  const RENAMED_MAP = "이름 바꾼 맵";
  let projectDir: string;
  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "oprn-local-store-"));
  });
  afterEach(async () => {
    await rm(projectDir, { force: true, recursive: true });
  });
  function renamedMap(project: Project, mapId: string, name: string): Project {
    const map = project.maps[mapId];
    if (!map) throw new Error(`fixture has no map ${mapId}`);
    return { ...project, maps: { ...project.maps, [mapId]: { ...map, name } } };
  }
  describe("local project store", () => {
    it("새 저장소는 판마다 새 id 다 · projectId 를 주면 그 id 로 만든다(시험 묶음의 재생용 고정) · 이미 있는 저장소의 id 는 바꾸지 않는다", async () => {
      const pin = "0d1e2f30-4a5b-4c6d-8e7f-90a1b2c3d4e5";
      const other = await mkdtemp(join(tmpdir(), "oprn-local-store-"));
      try {
        const a = await initLocalProjectStore({ projectDir });
        const b = await initLocalProjectStore({ projectDir: other });
        expect(a.projectId).not.toBe(b.projectId);
        a.close(); b.close();
        const again = await initLocalProjectStore({ projectDir, projectId: pin });
        expect(again.projectId).toBe(a.projectId);
        again.close();
      } finally { await rm(other, { force: true, recursive: true }); }
      const pinnedDir = await mkdtemp(join(tmpdir(), "oprn-local-store-"));
      try {
        const pinned = await initLocalProjectStore({ projectDir: pinnedDir, projectId: pin });
        expect(pinned.projectId).toBe(pin);
        pinned.close();
        const reopened = await openLocalProjectStore({ projectDir: pinnedDir });
        expect(reopened.projectId).toBe(pin);
        reopened.close();
      } finally { await rm(pinnedDir, { force: true, recursive: true }); }
    });

    it("init 이 project.sqlite·assets/·meta 행을 만들고 WAL·synchronous·foreign_keys 를 켠다", async () => {
      const store = await initLocalProjectStore({ projectDir });

      expect(existsSync(join(projectDir, "project.sqlite"))).toBe(true);
      expect(existsSync(join(projectDir, "assets"))).toBe(true);

      const info = store.info();
      expect(info.formatVersion).toBe(3);
      expect(info.projectId).toMatch(/^[0-9a-f-]{36}$/);
      store.close();

      expect(readPragmaWithForeignConnection(join(projectDir, "project.sqlite"), "journal_mode")).toBe("wal");
      expect(readPragmaWithForeignConnection(join(projectDir, "project.sqlite"), "synchronous")).toBe("2");
      expect(readPragmaWithForeignConnection(join(projectDir, "project.sqlite"), "foreign_keys")).toBe("1");
    });

    it("저장 → 읽기 왕복이 직렬화 텍스트를 그대로 보존하고 sha256 이 그 텍스트의 해시다", async () => {
      const store = await initLocalProjectStore({ projectDir });
      const project = projectWithoutEventDrafts(createScarloxyDemoProject());
      const expected = serialize(project);

      const saved = await store.saveProject(project);
      expect(saved.kind).toBe("saved");

      const raw = await readFile(join(projectDir, "project.sqlite"));
      expect(raw.byteLength).toBeGreaterThan(0);

      const snapshot = store.loadSnapshot();
      if (!snapshot) throw new Error("expected a stored snapshot");
      expect(snapshot.sha256).toBe(sha256HexTextSync(expected));
      expect(store.exportSerialized()).toBe(expected);
      expect(snapshot.project.meta.title).toBe(project.meta.title);
      store.close();
    });

    it("저장할 때마다 revision 이 오르고 맵 미러 행이 문서의 맵과 일치한다", async () => {
      const store = await initLocalProjectStore({ projectDir });
      const base = projectWithoutEventDrafts(createScarloxyDemoProject());
      const [mapId] = Object.keys(base.maps);
      if (!mapId) throw new Error("fixture needs a map");

      const first = await store.saveProject(base);
      const second = await store.saveProject(renamedMap(base, mapId, RENAMED_MAP));

      expect(first.kind).toBe("saved");
      expect(second.kind).toBe("saved");
      if (first.kind !== "saved" || second.kind !== "saved") return;
      expect(first.revision).toBe(1);
      expect(second.revision).toBe(2);

      const mirrors = store.mapMirrors();
      expect([...mirrors.keys()].sort()).toEqual(Object.keys(base.maps).sort());
      expect(mirrors.get(mapId)?.name).toBe(RENAMED_MAP);
      store.close();
    });

    it("export-json 은 저장된 텍스트를 그대로 돌려준다", async () => {
      const store = await initLocalProjectStore({ projectDir });
      const project = projectWithoutEventDrafts(createScarloxyDemoProject());
      const expected = serialize(project);
      await store.saveProject(project);

      const exported = store.exportSerialized();
      expect(exported).toBe(expected);

      const again = await store.saveProject(project);
      expect(again).toMatchObject({ kind: "saved", revision: 2 });
      expect(store.exportSerialized()).toBe(expected);
      store.close();
    });

    it("타일셋을 tileset_blobs 로 접어 저장하고 읽을 때 펼친 글이 바이트 단위로 같다", async () => {
      const store = await initLocalProjectStore({ projectDir });
      const project = projectWithoutEventDrafts(createScarloxyDemoProject());
      const expected = serialize(project);
      const tilesetIds = Object.keys(project.tilesets);
      expect(tilesetIds.length).toBeGreaterThan(0);
      await store.saveProject(project);
      store.close();

      const db = new DatabaseSync(join(projectDir, "project.sqlite"), { readOnly: true });
      const row = db.prepare("SELECT current_json, current_sha256 FROM project").get() as { current_json: string; current_sha256: string };
      const blobCount = (db.prepare("SELECT COUNT(*) AS n FROM tileset_blobs").get() as { n: number }).n;
      db.close();
      const folded = JSON.parse(row.current_json) as { tilesets: Record<string, unknown> };
      expect(Object.keys(folded.tilesets)).toEqual(tilesetIds);
      for (const marker of Object.values(folded.tilesets)) expect(marker).toEqual({ $blob: expect.stringMatching(/^[0-9a-f]{64}$/) });
      expect(blobCount).toBe(new Set(Object.values(folded.tilesets).map((m) => (m as { $blob: string }).$blob)).size);
      expect(row.current_sha256).toBe(sha256HexTextSync(expected));

      const reopened = await openLocalProjectStore({ projectDir });
      expect(reopened.exportSerialized()).toBe(expected);
      // loadSnapshot runs load repair (e.g. it now backfills the hero's paired face), so the reload is compared with
      // the same repair applied to the saved text; the folded text itself is byte-checked by exportSerialized above.
      expect(serialize(reopened.loadSnapshot()!.project)).toBe(serialize(deserializeStoredProjectJson(JSON.parse(expected))));
      reopened.close();
    });

    it("접지 않은 옛 행을 그대로 읽고, 타일셋을 고친 저장은 바뀐 본문만 남긴다", async () => {
      const store = await initLocalProjectStore({ projectDir });
      const project = projectWithoutEventDrafts(createScarloxyDemoProject());
      const legacy = serialize(project);
      await store.saveSerialized(JSON.stringify(JSON.parse(legacy), null, 1), null);
      store.close();
      const db = new DatabaseSync(join(projectDir, "project.sqlite"));
      db.prepare("UPDATE project SET current_json = ?, current_sha256 = ?").run(legacy, sha256HexTextSync(legacy));
      db.exec("DELETE FROM tileset_blobs");
      db.close();

      const reopened = await openLocalProjectStore({ projectDir });
      expect(reopened.exportSerialized()).toBe(legacy);
      const [tilesetId] = Object.keys(project.tilesets);
      const edited = reopened.loadSnapshot()!.project;
      const next: Project = { ...edited, tilesets: { ...edited.tilesets, [tilesetId!]: { ...edited.tilesets[tilesetId!]!, name: "고친 타일셋" } } };
      await reopened.saveProject(next);
      await reopened.saveProject(next);
      expect(reopened.exportSerialized()).toBe(serialize(next));
      reopened.close();

      const check = new DatabaseSync(join(projectDir, "project.sqlite"), { readOnly: true });
      const blobCount = (check.prepare("SELECT COUNT(*) AS n FROM tileset_blobs").get() as { n: number }).n;
      check.close();
      expect(blobCount).toBe(new Set(Object.values(next.tilesets).map((t) => JSON.stringify(t))).size);
    });

    it("backup 이 backups/ 에 VACUUM INTO 사본을 만든다", async () => {
      const store = await initLocalProjectStore({ projectDir });
      await store.saveProject(projectWithoutEventDrafts(createScarloxyDemoProject()));

      const backupPath = store.backup();
      expect(backupPath.startsWith(join(projectDir, "backups"))).toBe(true);
      expect(existsSync(backupPath)).toBe(true);
      expect(readPragmaWithForeignConnection(backupPath, "journal_mode")).toBe("delete");
      store.close();
    });

    it("닫은 뒤 다시 열면 같은 문서를 읽는다", async () => {
      const first = await initLocalProjectStore({ projectDir });
      const project = projectWithoutEventDrafts(createScarloxyDemoProject());
      await first.saveProject(project);
      const sha = first.loadSnapshot()?.sha256;
      first.close();

      const reopened = await openLocalProjectStore({ projectDir });
      expect(reopened.loadSnapshot()?.sha256).toBe(sha);
      expect(reopened.info().mapCount).toBe(Object.keys(project.maps).length);
      reopened.close();
    });
  });
});
