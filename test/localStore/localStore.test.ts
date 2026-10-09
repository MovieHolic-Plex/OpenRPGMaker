import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { serialize } from "@/project/io";
import type { Project } from "@/project/types";
import { sha256HexTextSync } from "@/util/sha256";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store";
import { readPragmaWithForeignConnection } from "./sqliteProbe";

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
  it("init 이 project.sqlite·assets/·meta 행을 만들고 WAL·synchronous·foreign_keys 를 켠다", async () => {
    const store = await initLocalProjectStore({ projectDir });

    expect(existsSync(join(projectDir, "project.sqlite"))).toBe(true);
    expect(existsSync(join(projectDir, "assets"))).toBe(true);

    const info = store.info();
    expect(info.formatVersion).toBe(2);
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
    expect(serialize(reopened.loadSnapshot()!.project)).toBe(expected);
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