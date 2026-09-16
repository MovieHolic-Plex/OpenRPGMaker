import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { serialize } from "@/project/io";
import { sha256HexTextSync } from "@/util/sha256";
import { initLocalProjectStore, type LocalProjectStore } from "../../electron/local-store/store";

let projectDir: string;
let store: LocalProjectStore;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "oprn-serialized-"));
  store = await initLocalProjectStore({ projectDir });
});

afterEach(async () => {
  store.close();
  await rm(projectDir, { force: true, recursive: true });
});

describe("local store saveSerialized", () => {
  it("보낸 텍스트를 그대로 저장하고 그 텍스트의 해시를 쓴다", async () => {
    const project = projectWithoutEventDrafts(createHouseTemplateGalleryProject());
    const serialized = serialize(project);

    const saved = await store.saveSerialized(serialized);

    expect(saved.kind).toBe("saved");
    if (saved.kind !== "saved") return;
    expect(saved.sha256).toBe(sha256HexTextSync(serialized));
    expect(store.exportSerialized()).toBe(serialized);
    expect(existsSync(join(projectDir, "project.sqlite"))).toBe(true);
    expect(store.loadSnapshot()?.project.maps).toBeDefined();
    expect(store.info().revision).toBe(1);
  });

  it("맵 미러 행을 텍스트에서 다시 만든다", async () => {
    const project = projectWithoutEventDrafts(createHouseTemplateGalleryProject());
    await store.saveSerialized(serialize(project));

    const mirrors = store.mapMirrors();

    expect([...mirrors.keys()].sort()).toEqual(Object.keys(project.maps).sort());
  });

  it("맵이 아닌 JSON 은 거절한다", async () => {
    await expect(store.saveSerialized('{"version":4}')).rejects.toThrow();
    expect(store.loadSnapshot()).toBeNull();
  });
});