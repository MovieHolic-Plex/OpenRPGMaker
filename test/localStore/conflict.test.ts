import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import type { Project } from "@/project/types";
import { initLocalProjectStore, type LocalProjectStore } from "../../electron/local-store/store";
import { overwriteTitleFromForeignConnection } from "./sqliteProbe";

const NAME_A = "A 의 맵";
const NAME_B = "B 의 맵";

let projectDir: string;
let store: LocalProjectStore;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "oprn-conflict-"));
  store = await initLocalProjectStore({ projectDir });
});

afterEach(async () => {
  store.close();
  await rm(projectDir, { force: true, recursive: true });
});

function baseProject(): Project {
  return projectWithoutEventDrafts(createScarloxyDemoProject());
}

function rename(project: Project, mapId: string, name: string): Project {
  const map = project.maps[mapId];
  if (!map) throw new Error(`fixture has no map ${mapId}`);
  return { ...project, maps: { ...project.maps, [mapId]: { ...map, name } } };
}

function firstTwoMapIds(project: Project): readonly [string, string] {
  const [first, second] = Object.keys(project.maps);
  if (!first || !second) throw new Error("fixture needs two maps");
  return [first, second];
}

describe("local store map patches", () => {
  it("서로 다른 맵을 고친 두 편집이 병합되어 둘 다 남고 revision 이 오른다", async () => {
    const base = baseProject();
    const [aId, bId] = firstTwoMapIds(base);
    await store.saveProject(base);

    const first = await store.saveMapPatch({ baseProject: base, project: rename(base, aId, NAME_A) });
    const second = await store.saveMapPatch({ baseProject: base, project: rename(base, bId, NAME_B) });

    expect(first).toMatchObject({ kind: "saved" });
    expect(second).toMatchObject({ kind: "saved" });
    const snapshot = store.loadSnapshot();
    expect(snapshot?.project.maps[aId]?.name).toBe(NAME_A);
    expect(snapshot?.project.maps[bId]?.name).toBe(NAME_B);
    expect(store.info().revision).toBe(3);
  });

  it("같은 맵을 다르게 고치면 두 번째 저장이 충돌이고 정본은 첫 편집 그대로다", async () => {
    const base = baseProject();
    const [mapId] = firstTwoMapIds(base);
    await store.saveProject(base);

    await store.saveMapPatch({ baseProject: base, project: rename(base, mapId, NAME_A) });
    const second = await store.saveMapPatch({ baseProject: base, project: rename(base, mapId, NAME_B) });

    expect(second).toEqual({ kind: "conflict", conflicts: [{ mapId, name: NAME_B }] });
    expect(store.loadSnapshot()?.project.maps[mapId]?.name).toBe(NAME_A);
    expect(store.info().revision).toBe(2);
  });

  it("changedMapIds 힌트로 실제 변경을 숨길 수 없다", async () => {
    const base = baseProject();
    const [aId, bId] = firstTwoMapIds(base);
    await store.saveProject(base);

    const mine = rename(rename(base, aId, NAME_A), bId, NAME_B);
    const saved = await store.saveMapPatch({ baseProject: base, project: mine, changedMapIds: [aId] });

    expect(saved).toMatchObject({ kind: "saved" });
    const snapshot = store.loadSnapshot();
    expect(snapshot?.project.maps[aId]?.name).toBe(NAME_A);
    expect(snapshot?.project.maps[bId]?.name).toBe(NAME_B);
  });

  it("바깥 연결이 쓴 뒤 data_version 이 바뀐다", async () => {
    const base = baseProject();
    await store.saveProject(base);
    const before = store.dataVersion();

    overwriteTitleFromForeignConnection(join(projectDir, "project.sqlite"), "밖에서 바꾼 제목");

    expect(store.dataVersion()).not.toBe(before);
  });

  it("바깥 연결만 쓴 뒤에는 정본 텍스트가 그대로다", async () => {
    const base = baseProject();
    await store.saveProject(base);
    const serialized = store.exportSerialized();

    overwriteTitleFromForeignConnection(join(projectDir, "project.sqlite"), "밖에서 바꾼 제목");

    expect(store.exportSerialized()).toBe(serialized);
    expect(store.loadSnapshot()?.project.meta.title).toBe(base.meta.title);
  });
});
