import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import type { Project } from "@/project/types";
import { initLocalProjectStore, type LocalProjectStore } from "../../electron/local-store/store";
import { createProjectSessionRegistry } from "../../electron/main/sessions";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DATA_URL = `data:image/png;base64,${Buffer.from(PNG_BYTES).toString("base64")}`;
const MEDIA_COMMIT_SUMMARY = "미디어 분리";

let projectDir: string;
let store: LocalProjectStore;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "oprn-media-"));
  store = await initLocalProjectStore({ projectDir });
});

afterEach(async () => {
  store.close();
  await rm(projectDir, { force: true, recursive: true });
});

function projectWithInlineAsset(): Project {
  const base = projectWithoutEventDrafts(createHouseTemplateGalleryProject());
  return {
    ...base,
    assets: {
      ...base.assets,
      uploaded: {
        ...base.assets.uploaded,
        asset_inline: { id: "asset_inline", name: "인라인 자산", kind: "sprite", dataUrl: DATA_URL, meta: {} },
      },
    },
  };
}

describe("local store assets", () => {
  it("손상된 기존 파일은 읽기를 거절하고 정상 원본 재업로드로 복구한다", async () => {
    const ref = await store.putAsset(PNG_BYTES, { mime: "image/png", extension: "png" });
    writeFileSync(join(projectDir, "assets", `${ref.sha256}.png`), PNG_BYTES.slice(0, 3));
    await expect(store.assetBytes(ref.sha256)).rejects.toThrow("손상");
    await store.putAsset(PNG_BYTES, { mime: "image/png", extension: "png" });
    expect(await store.assetBytes(ref.sha256)).toEqual(PNG_BYTES);
    expect(readdirSync(join(projectDir, "assets")).some(name => name.endsWith(".pending"))).toBe(false);
  });

  it("putAsset 은 sha256 파일명으로 쓰고 같은 바이트는 한 벌만 남다", async () => {
    const ref = await store.putAsset(PNG_BYTES, { mime: "image/png", extension: "png", originalName: "a.png", kind: "sprite" });
    const again = await store.putAsset(PNG_BYTES, { mime: "image/png", extension: "png", originalName: "b.png", kind: "sprite" });

    expect(ref.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(ref.bytes).toBe(PNG_BYTES.byteLength);
    expect(again.sha256).toBe(ref.sha256);
    expect(existsSync(join(projectDir, "assets", `${ref.sha256}.png`))).toBe(true);
    expect(store.listAssets()).toHaveLength(1);
    expect(await store.assetBytes(ref.sha256)).toEqual(PNG_BYTES);
  });

  it("separateInlineMedia 가 base64 를 파일로 기고 두 번째 호출은 no-op 이다", async () => {
    const first = await store.separateInlineMedia(projectWithInlineAsset());

    expect(first.changed).toBe(true);
    expect(first.migratedAssetIds).toEqual(["asset_inline"]);
    const migrated = first.project.assets.uploaded.asset_inline;
    expect(migrated?.dataUrl).toBeUndefined();
    expect(migrated?.ref?.mime).toBe("image/png");
    expect(migrated?.ref?.extension).toBe("png");
    expect(await store.assetBytes(migrated?.ref?.sha256 ?? "")).toEqual(PNG_BYTES);
    expect(store.loadSnapshot()?.sha256).toBe(first.sha256);
    expect(store.listCommits(5).filter((commit) => commit.summary === MEDIA_COMMIT_SUMMARY)).toHaveLength(1);

    const second = await store.separateInlineMedia(first.project);
    expect(second.changed).toBe(false);
    expect(second.migratedAssetIds).toEqual([]);
    expect(store.listCommits(5).filter((commit) => commit.summary === MEDIA_COMMIT_SUMMARY)).toHaveLength(1);
  });

  it("이미 ref 인 자산은 건드리지 않는다", async () => {
    const ref = await store.putAsset(PNG_BYTES, { mime: "image/png", extension: "png", originalName: "x.png", kind: "sprite" });
    const base = projectWithoutEventDrafts(createHouseTemplateGalleryProject());
    const project: Project = {
      ...base,
      assets: {
        ...base.assets,
        uploaded: { asset_ref: { id: "asset_ref", name: "이미 참조", kind: "sprite", ref, meta: {} } },
      },
    };

    const result = await store.separateInlineMedia(project);

    expect(result.changed).toBe(false);
    expect(result.migratedAssetIds).toEqual([]);
  });

  it("pruneUnusedAssets 는 참조되지 않는 파일과 행을 지운다", async () => {
    const used = await store.putAsset(PNG_BYTES, { mime: "image/png", extension: "png", originalName: "used.png", kind: "sprite" });
    const orphan = await store.putAsset(new Uint8Array([1, 2, 3]), { mime: "image/png", extension: "png", originalName: "orphan.png", kind: "sprite" });

    const removed = await store.pruneUnusedAssets([used.sha256]);

    expect(removed).toEqual([orphan.sha256]);
    expect(existsSync(join(projectDir, "assets", `${orphan.sha256}.png`))).toBe(false);
    expect(existsSync(join(projectDir, "assets", `${used.sha256}.png`))).toBe(true);
    expect(store.listAssets().map((asset) => asset.sha256)).toEqual([used.sha256]);
  });
});

describe("폴더를 열 때 인라인 미디어를 자동으로 분리한다", () => {
  it("open 이 base64 를 파일로 옮기고 분리 커밋을 한 번만 남긴다", async () => {
    const dir = await mkdtemp(join(tmpdir(), "oprn-open-migrate-"));
    const seeded = await initLocalProjectStore({ projectDir: dir });
    await seeded.saveProject(projectWithInlineAsset());
    seeded.close();

    const sessions = createProjectSessionRegistry();
    const session = await sessions.open(1, dir);

    const migrated = session.store.loadSnapshot()?.project.assets.uploaded.asset_inline;
    expect(migrated?.dataUrl).toBeUndefined();
    expect(migrated?.ref?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(session.store.listCommits(5).filter((commit) => commit.summary === MEDIA_COMMIT_SUMMARY)).toHaveLength(1);

    sessions.close(1);
    await rm(dir, { force: true, recursive: true });
  });
});
