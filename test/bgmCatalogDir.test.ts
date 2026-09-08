import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { CATALOG_RELATIVE_DIR, listInstalledCatalogFiles } from "../scripts/lib/bgmCatalogDir";

it("mp3/wav 만, 0바이트는 빼고, 정렬해서 돌려준다", async () => {
  const root = await mkdtemp(join(tmpdir(), "bgm-catalog-"));
  try {
    await writeFile(join(root, "b.mp3"), "sound");
    await writeFile(join(root, "a.wav"), "sound");
    await writeFile(join(root, "empty.mp3"), "");
    await writeFile(join(root, "notes.txt"), "text");
    expect(listInstalledCatalogFiles(root)).toEqual(["a.wav", "b.mp3"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

it("디렉터리가 없으면 빈 배열이다 — 팩 미설치가 오류는 아니다", () => {
  expect(listInstalledCatalogFiles(join(tmpdir(), "absent-bgm-dir-xyz"))).toEqual([]);
});

it("카탈로그 상대 경로를 한 곳에서만 정의한다", () => {
  expect(CATALOG_RELATIVE_DIR).toBe("assets/cc0/audio/catalog");
});
