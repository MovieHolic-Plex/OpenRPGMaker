/**
 * 한 장짜리 번들 전투 배경(장소 그림, battle-scenery-<키>) — battle-backdrop 하네스 `build --bundle` 이 싣는다.
 * 실린 그림이 하네스 원장의 Opus 검수 기록(화소 해시)과 같은지, 겹 배경 종류로 풀리지 않고 그 그림 그대로 깔리는지,
 * 검증·도구가 그 id 를 아는지, 장소 테마 표가 가리키는 배경이 실제로 있는지를 고정한다.
 * 문서 openwiki/harnesses/battle-backdrop.md 「장소 그림(번들 한 장 그림)」.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import stillsDoc from "@/assets/battleSceneryStills.json";
import { BATTLE_BACKDROP_ID_HINT, BATTLE_SCENERY_BIOMES, BATTLE_SCENERY_STILLS, battleSceneryStill, resolveSceneryBiome, unknownSceneryIdMessage } from "@/assets/battleSceneryCatalog";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { resolveBattleBackdrop } from "@/battle/battleBackdrop";
import { readBattleScenery } from "@/editor/panels/battleSceneryPicker";
import { BACKDROP_PASS_SCORE, BACKDROP_REVIEW_STANDARD } from "@/harnesses/battle-backdrop/opusReview";
import { createBlankProject } from "@/project/defaults";
import { collectWebExportAssets } from "@/project/webExportAssets";
import type { Project } from "@/project/types";

const ROOT = process.cwd();
type Still = { key: string; ko: string; en: string; run: string; pixelSha256: string; nativePixelSha256: string; score: number; batch: string; by: string };
const stills = stillsDoc.stills as readonly Still[];
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, "harness-data/battle-backdrop/ledger.json"), "utf8")) as {
  runs: Record<string, {
    pick?: { letter: string; nativePixelSha256: string; storedPixelSha256: string; score?: number; batch?: string };
    reviews?: { id: string; standard: string; model: string; counted: boolean; entries: { label: string; pixelSha256: string; letter?: string; control?: string }[]; answers: Record<string, { v: string; score: number }> }[];
  }>;
};

function readPixels(file: string): { width: number; height: number; data: Buffer; sha: string } {
  const png = PNG.sync.read(fs.readFileSync(file));
  const sha = createHash("sha256").update(Buffer.concat([Buffer.from(`${png.width}x${png.height}:`), Buffer.from(png.data)])).digest("hex");
  return { width: png.width, height: png.height, data: png.data, sha };
}

describe("장소 그림 목록", () => {
  it("키는 겹 배경 종류와 겹치지 않고 id 는 battle-scenery-<키> 다", () => {
    expect(BATTLE_SCENERY_STILLS.map((s) => s.key)).toEqual(stills.map((s) => s.key));
    for (const still of BATTLE_SCENERY_STILLS) {
      expect(BATTLE_SCENERY_BIOMES as readonly string[]).not.toContain(still.key);
      expect(still.resourceId).toBe(`battle-scenery-${still.key}`);
      expect(still.ko.trim()).not.toBe("");
      expect(still.en.trim()).not.toBe("");
    }
    expect(new Set(stills.map((s) => s.key)).size).toBe(stills.length);
  });

  it.each(stills.map((s) => [s.key, s] as const))("%s: 그림은 번들 규격이고 원장의 Opus 검수 통과 그림과 화소가 같다", (_key, still) => {
    const file = path.join(ROOT, "public/assets/generated/battle-scenery", still.key, "preview.png");
    const img = readPixels(file);
    // 겹 배경 미리보기와 같은 규격: 640×360 = 320×180 격자 2배(2×2 블록이 같다), 불투명, 32색 이하.
    expect([img.width, img.height]).toEqual([640, 360]);
    const colors = new Set<number>();
    for (let y = 0; y < img.height; y += 1) for (let x = 0; x < img.width; x += 1) {
      const i = (y * img.width + x) * 4, j = ((y & ~1) * img.width + (x & ~1)) * 4;
      expect(img.data[i + 3]).toBe(255);
      if (img.data[i] !== img.data[j] || img.data[i + 1] !== img.data[j + 1] || img.data[i + 2] !== img.data[j + 2]) throw new Error(`${still.key}: (${x},${y}) 가 2×2 블록과 다르다`);
      colors.add((img.data[i]! << 16) | (img.data[i + 1]! << 8) | img.data[i + 2]!);
    }
    expect(colors.size).toBeLessThanOrEqual(32);
    expect(fs.statSync(file).size).toBeLessThan(40_000);
    expect(img.sha).toBe(still.pixelSha256);
    // 원장: 그 판의 선택이 이 화소이고, 효력 있는 Opus 묶음(디코이 전부 reject)에서 3.5 이상 pass 를 받았다.
    const run = ledger.runs[still.run]!;
    expect(run.pick?.storedPixelSha256).toBe(still.pixelSha256);
    expect(run.pick?.nativePixelSha256).toBe(still.nativePixelSha256);
    expect(run.pick?.batch).toBe(still.batch);
    const batch = (run.reviews ?? []).find((b) => b.id === still.batch)!;
    expect(batch.counted).toBe(true);
    expect(batch.standard).toBe(BACKDROP_REVIEW_STANDARD);
    expect(batch.model).toMatch(/opus/iu);
    const controls = batch.entries.filter((e) => e.control);
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) expect(batch.answers[control.label]!.v).toBe("reject");
    const entry = batch.entries.find((e) => !e.control && e.pixelSha256 === still.nativePixelSha256)!;
    expect(batch.answers[entry.label]!.v).toBe("pass");
    expect(batch.answers[entry.label]!.score).toBeGreaterThanOrEqual(BACKDROP_PASS_SCORE);
    expect(batch.answers[entry.label]!.score).toBe(still.score);
  });
});

describe("장소 그림은 새·기존 프로젝트 모두에서 풀린다", () => {
  it.each(BATTLE_SCENERY_STILLS.map((s) => [s.resourceId, s] as const))("%s", (id, still) => {
    const project = createBlankProject() as Project;
    // 프로젝트에 자원을 넣지 않아도(기존 프로젝트) 번들 경로로 풀린다.
    expect(project.assets.uploaded[id]).toBeUndefined();
    expect(resolveAssetResourceUrl(id, { project })).toContain(`battle-scenery/${still.key}/preview.png`);
    expect(builtinGeneratedResourceIds()).toContain(id);
    expect(battleSceneryStill(id)).toBe(still);
    // 겹 배경 종류로 풀지 않는다 — 그림 그대로 깔린다.
    expect(resolveSceneryBiome(project, { backdropResourceId: id })).toBeUndefined();
    expect(readBattleScenery(project, id)).toEqual({ kind: "custom", id });
    expect(unknownSceneryIdMessage(id)).toBeUndefined();
    expect(BATTLE_BACKDROP_ID_HINT).toContain(id);
    // 맵에 저작한 값이 그 맵의 전투 배경이 되고, 내보내기에 그림이 실린다.
    const map = project.maps[project.startMapId]!;
    map.battleBackground = id;
    const troopId = project.database.troops[0]!.id;
    project.database.troops[0]!.previewBackgroundResourceId = "battle-scenery-forest";
    expect(resolveBattleBackdrop({ project, troopId, location: { mapId: map.id, x: 1, y: 1 } })).toBe(id);
    expect(collectWebExportAssets(project).map((a) => a.zipPath)).toContain(still.image);
  });

  it("지어낸 battle-scenery id 는 여전히 거절한다", () => {
    expect(unknownSceneryIdMessage("battle-scenery-forest-night")).toContain("is not a battle backdrop");
  });
});
