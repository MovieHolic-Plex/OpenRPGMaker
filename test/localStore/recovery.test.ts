import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { initLocalProjectStore, openLocalProjectStore, type LocalProjectStore } from "../../electron/local-store/store";
import { listLocalProjectBackups, restoreLocalProjectBackup } from "../../electron/local-store/recovery";
import { createProjectSessionRegistry } from "../../electron/main/sessions";
import { createStoreHandlers } from "../../electron/main/dispatch";
import { OPRN_CHANNELS } from "../../electron/shared/channels";
import { openNodeSqliteDriver } from "../../electron/local-store/driver";

let root: string;
let source: LocalProjectStore;
const bytes = new Uint8Array([1, 2, 3, 4]);
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
      expect(await restored.assetBytes(restored.listAssets()[0]!.sha256)).toEqual(bytes);
      expect(restored.mapMirrors().size).toBe(source.mapMirrors().size);
    } finally { restored.close(); }
    expect(readFileSync(join(backup, "project.sqlite"))).toEqual(before);
    expect(listLocalProjectBackups(source.projectDir)).toHaveLength(2);
  });

  it("손상된 소재를 거절하고 불완전 복구 폴더를 남기지 않는다", async () => {
    const backup = dirname(source.backup());
    const asset = source.listAssets()[0]!;
    writeFileSync(join(backup, "assets", `${asset.sha256}.${asset.extension}`), bytes.slice(0, 2));
    const target = join(root, "broken-copy");
    await expect(restoreLocalProjectBackup(backup, target)).rejects.toThrow("손상");
    expect(existsSync(target)).toBe(false);
    expect(await source.assetBytes(asset.sha256)).toEqual(bytes);
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
