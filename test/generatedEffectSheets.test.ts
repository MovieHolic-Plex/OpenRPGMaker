/**
 * 절차 생성 전투 이펙트 시트 계약.
 *
 * 이 파이프라인은 세 조각이 서로를 참조한다: 카탈로그(JSON) · 페인터(scripts) · 커밋된 PNG.
 * 하나만 움직이면 에디터에서 빈 그래픽이 뜨거나 프로젝트 역직렬화가 던진다. 여기서 세 개를
 * 한 번에 묶는다 — 특히 "렌더 결과 == 커밋된 바이트" 는 생성기가 재현 가능한지의 유일한 증거다.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { listDatabaseResourceOptionsForTest } from "@/editor/panels/databaseResourcePickerDialog";
import { createBlankProject } from "@/project/defaults";
import {
  GENERATED_EFFECT_RESOURCE_IDS,
  GENERATED_EFFECT_SHEET,
  GENERATED_EFFECT_SHEETS,
  generatedEffectResourceId,
  generatedEffectSheetFileName,
} from "@/assets/generatedEffectSheets";
import { defaultBattleAnimationRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import {
  effectSheetOutputPath,
  loadEffectCatalog,
  paintedEffectSlugs,
  renderEffectSheetPng,
  renderEffectStrip,
  REPO_ROOT,
} from "../scripts/lib/effectSheet/render.mjs";

const catalog = loadEffectCatalog();

/** PNG IHDR 에서 실제 이미지 크기를 집는다 — 런타임은 이 크기 안에서 프레임을 자른다. */
function pngSize(filePath: string): { width: number; height: number } {
  const bytes = readFileSync(filePath);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function frameHasPixels(strip: { width: number; height: number; data: Uint8Array }, frameIndex: number): boolean {
  const { frameWidth } = GENERATED_EFFECT_SHEET;
  const originX = frameIndex * frameWidth;
  for (let y = 0; y < strip.height; y += 1) {
    for (let x = originX; x < originX + frameWidth; x += 1) {
      if (strip.data[(y * strip.width + x) * 4 + 3] > 0) return true;
    }
  }
  return false;
}

function frameSignature(strip: { width: number; height: number; data: Uint8Array }, frameIndex: number): string {
  const { frameWidth } = GENERATED_EFFECT_SHEET;
  const originX = frameIndex * frameWidth;
  let hash = 0x811c9dc5;
  for (let y = 0; y < strip.height; y += 1) {
    for (let x = originX; x < originX + frameWidth; x += 1) {
      const index = (y * strip.width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        hash = (Math.imul(hash ^ strip.data[index + channel], 0x01000193) >>> 0) >>> 0;
      }
    }
  }
  return hash.toString(16);
}

describe("생성 이펙트 카탈로그", () => {
  it("카탈로그 slug 와 페인터 목록이 정확히 일치한다", () => {
    const catalogSlugs = [...GENERATED_EFFECT_SHEETS.map((effect) => effect.slug)].sort();
    expect(paintedEffectSlugs().sort()).toEqual(catalogSlugs);
  });

  it("시트 규격은 96x96 프레임 5장이다", () => {
    expect(GENERATED_EFFECT_SHEET).toEqual({ frameWidth: 96, frameHeight: 96, columns: 5 });
    expect(catalog.sheet).toEqual(GENERATED_EFFECT_SHEET);
  });

  it("리소스 id 는 중복 없이 slug 마다 하나씩 나온다", () => {
    expect(GENERATED_EFFECT_RESOURCE_IDS).toHaveLength(GENERATED_EFFECT_SHEETS.length);
    expect(new Set(GENERATED_EFFECT_RESOURCE_IDS).size).toBe(GENERATED_EFFECT_SHEETS.length);
  });
  it("에디터 리소스 피커가 battle 종리로 전부 노출한다", () => {
    const options = listDatabaseResourceOptionsForTest("battle", createBlankProject());
    for (const id of GENERATED_EFFECT_RESOURCE_IDS) {
      expect(options.some((option) => option.id === id)).toBe(true);
    }
  });
});
describe.each(GENERATED_EFFECT_SHEETS.map((effect) => effect.slug))("이펙트 시트 %s", (slug) => {
  it("출력 PNG 크기가 시트 규경과 정확하게 같다", () => {
    const size = pngSize(effectSheetOutputPath(slug));
    expect(size).toEqual({
      width: GENERATED_EFFECT_SHEET.frameWidth * GENERATED_EFFECT_SHEET.columns,
      height: GENERATED_EFFECT_SHEET.frameHeight,
    });
  });

  it("커밋된 PNG 가 있고 렌더 결과와 바이트가 같다", () => {
    const outputPath = effectSheetOutputPath(slug);
    expect(existsSync(outputPath)).toBe(true);
    const committed = readFileSync(outputPath);
    const rendered = Buffer.from(renderEffectSheetPng(slug, catalog));
    expect(rendered.equals(committed)).toBe(true);
  });

  it("두 번 렌더해도 같은 바이트가 나온다", () => {
    const first = Buffer.from(renderEffectSheetPng(slug, catalog));
    const second = Buffer.from(renderEffectSheetPng(slug, catalog));
    expect(first.equals(second)).toBe(true);
  });

  it("프레임 5장이 모두 그려지고 서로 다르다", () => {
    const strip = renderEffectStrip(slug, catalog);
    expect(strip.width).toBe(GENERATED_EFFECT_SHEET.frameWidth * GENERATED_EFFECT_SHEET.columns);
    expect(strip.height).toBe(GENERATED_EFFECT_SHEET.frameHeight);
    const signatures: string[] = [];
    for (let index = 0; index < GENERATED_EFFECT_SHEET.columns; index += 1) {
      expect(frameHasPixels(strip, index), `프레임 ${index} 가 완전히 비었다`).toBe(true);
      signatures.push(frameSignature(strip, index));
    }
    expect(new Set(signatures).size).toBe(GENERATED_EFFECT_SHEET.columns);
  });

  it("자를 프레임 사각이 시트 밖을 넘지 않는다", () => {
    // 런타임(battleAnimationDom.animationCell)은 pattern 을 column/row 로 톴서 자른다.
    // 시트가 짧거나 columns 가 틀리면 마지막 프레임이 바가지를 자려서 화면이 보이지 않는다.
    const { frameWidth, frameHeight, columns } = GENERATED_EFFECT_SHEET;
    const size = pngSize(effectSheetOutputPath(slug));
    const record = defaultBattleAnimationRecords().find(
      (entry) => entry.resourceId === generatedEffectResourceId(slug)
    );
    expect(record).toBeDefined();
    for (const frame of record?.frames ?? []) {
      for (const cell of frame.cells) {
        const right = (cell.pattern % columns) * frameWidth + frameWidth;
        const bottom = Math.floor(cell.pattern / columns) * frameHeight + frameHeight;
        expect(right).toBeLessThanOrEqual(size.width);
        expect(bottom).toBeLessThanOrEqual(size.height);
      }
    }
  });

  it("리소스 id 가 public 경로로 해석된다", () => {
    const url = resolveAssetResourceUrl(generatedEffectResourceId(slug));
    expect(url).toBe(`/assets/generated/effects/${generatedEffectSheetFileName(slug)}`);
    expect(existsSync(path.join(REPO_ROOT, "public", url!.slice(1)))).toBe(true);
  });
});

describe("기본 데이터베이스 배선", () => {
  const records = defaultBattleAnimationRecords();

  it("생성 시트마다 애니메이션 레코드가 있다", () => {
    for (const id of GENERATED_EFFECT_RESOURCE_IDS) {
      expect(records.some((record) => record.resourceId === id)).toBe(true);
    }
  });

  it("생성 레코드는 5프레임 전부를 순서대로 재생한다", () => {
    const generated = records.filter((record) => GENERATED_EFFECT_RESOURCE_IDS.includes(record.resourceId ?? ""));
    expect(generated).toHaveLength(GENERATED_EFFECT_SHEETS.length);
    for (const record of generated) {
      expect(record.sheet?.columns).toBe(GENERATED_EFFECT_SHEET.columns);
      expect(record.frames?.map((frame) => frame.cells[0]?.pattern)).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it("회복·마법·독은 근접 타격 아트를 더 이상 돌려쓰지 않는다", () => {
    for (const [animationId, slug] of [
      ["anim_heal", "heal-bloom"],
      ["anim_magic", "arcane-nova"],
      ["anim_poison", "poison-mist"],
    ] as const) {
      const record = records.find((entry) => entry.id === animationId);
      expect(record?.resourceId).toBe(generatedEffectResourceId(slug));
    }
  });

  it("애니메이션 id 는 중복되지 않는다", () => {
    const ids = records.map((record) => record.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
