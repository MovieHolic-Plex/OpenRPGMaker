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
import { battleAnimationDurationMs } from "@/player/battleAnimationPlayback";
import {
  effectSheetOutputPath,
  loadEffectCatalog,
  paintedEffectSlugs,
  renderEffectSheetPng,
  renderEffectStrip,
  REPO_ROOT,
} from "../scripts/lib/effectSheet/render.mjs";

const catalog = loadEffectCatalog();

const EXPECTED_FRAME_COUNTS = {
  "slash-steel": 8,
  "fire-burst": 10,
  "ice-shatter": 10,
  "thunder-strike": 10,
  "water-column": 10,
  "wind-slice": 10,
  "earth-spike": 10,
  "heal-bloom": 10,
  "poison-mist": 10,
  "arcane-nova": 12,
  "tackle-impact": 8,
  "claw-rake": 8,
  "bite-crunch": 8,
  "projectile-shot": 8,
  "leaf-volley": 10,
  "psychic-wave": 10,
  "shadow-pulse": 10,
  "holy-beam": 10,
  "sleep-dust": 10,
  "power-aura": 10,
  "guard-barrier": 10,
  "capture-seal": 12,
  "critical-burst": 8,
  "sonic-wave": 8,
  "drain-orbs": 10,
  "revive-rise": 10,
  "cleanse-sparkle": 10,
  "paralysis-bind": 10,
  "blind-veil": 10,
  "confusion-spiral": 10,
  "silence-lock": 10,
  "summon-portal": 12,
  "smoke-vanish": 8,
  "meteor-fall": 12,
} as const;

const EXPECTED_SOUND_TIMINGS = {
  "slash-steel": { frameIndex: 3, resourceId: "easyrpg-sound-attack2" },
  "fire-burst": { frameIndex: 4, resourceId: "easyrpg-sound-explosion1" },
  "ice-shatter": { frameIndex: 5, resourceId: "easyrpg-sound-ice2" },
  "thunder-strike": { frameIndex: 3, resourceId: "easyrpg-sound-flash1" },
  "water-column": { frameIndex: 5, resourceId: "easyrpg-sound-wave1" },
  "wind-slice": { frameIndex: 4, resourceId: "easyrpg-sound-wind8" },
  "earth-spike": { frameIndex: 5, resourceId: "easyrpg-sound-earth8" },
  "heal-bloom": { frameIndex: 2, resourceId: "easyrpg-sound-recovery5" },
  "poison-mist": { frameIndex: 4, resourceId: "easyrpg-sound-poison" },
  "arcane-nova": { frameIndex: 3, resourceId: "easyrpg-sound-magic1" },
  "tackle-impact": { frameIndex: 3, resourceId: "easyrpg-sound-blow4" },
  "claw-rake": { frameIndex: 3, resourceId: "easyrpg-sound-attack1" },
  "bite-crunch": { frameIndex: 4, resourceId: "easyrpg-sound-damage2" },
  "projectile-shot": { frameIndex: 5, resourceId: "easyrpg-sound-shot2" },
  "leaf-volley": { frameIndex: 5, resourceId: "easyrpg-sound-pollen" },
  "psychic-wave": { frameIndex: 4, resourceId: "easyrpg-sound-confusion" },
  "shadow-pulse": { frameIndex: 5, resourceId: "easyrpg-sound-darkness4" },
  "holy-beam": { frameIndex: 5, resourceId: "easyrpg-sound-holy5" },
  "sleep-dust": { frameIndex: 3, resourceId: "easyrpg-sound-sleep" },
  "power-aura": { frameIndex: 4, resourceId: "easyrpg-sound-buff" },
  "guard-barrier": { frameIndex: 4, resourceId: "easyrpg-sound-barrier2" },
  "capture-seal": { frameIndex: 7, resourceId: "easyrpg-sound-teleport2" },
  "critical-burst": { frameIndex: 3, resourceId: "easyrpg-sound-combat2" },
  "sonic-wave": { frameIndex: 4, resourceId: "easyrpg-sound-wave2" },
  "drain-orbs": { frameIndex: 5, resourceId: "easyrpg-sound-absorb1" },
  "revive-rise": { frameIndex: 5, resourceId: "easyrpg-sound-raise2" },
  "cleanse-sparkle": { frameIndex: 4, resourceId: "easyrpg-sound-recovery8" },
  "paralysis-bind": { frameIndex: 4, resourceId: "easyrpg-sound-flash3" },
  "blind-veil": { frameIndex: 4, resourceId: "easyrpg-sound-blind" },
  "confusion-spiral": { frameIndex: 4, resourceId: "easyrpg-sound-debuff" },
  "silence-lock": { frameIndex: 5, resourceId: "easyrpg-sound-silence" },
  "summon-portal": { frameIndex: 7, resourceId: "easyrpg-sound-magic2" },
  "smoke-vanish": { frameIndex: 3, resourceId: "easyrpg-sound-fog1" },
  "meteor-fall": { frameIndex: 7, resourceId: "easyrpg-sound-fall2" },
} as const;

function expectedFrameCount(slug: string): number {
  const count = EXPECTED_FRAME_COUNTS[slug as keyof typeof EXPECTED_FRAME_COUNTS];
  if (count === undefined) throw new Error(`예상 프레임 수가 없다: ${slug}`);
  return count;
}

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

  it("시트는 96x96 셀과 75ms 재생 간격을 공유하고 종류별로 8~12장을 쓴다", () => {
    expect(GENERATED_EFFECT_SHEET.frameWidth).toBe(96);
    expect(GENERATED_EFFECT_SHEET.frameHeight).toBe(96);
    expect((catalog.sheet as unknown as { frameDurationMs?: number }).frameDurationMs).toBe(75);
    expect(
      Object.fromEntries(GENERATED_EFFECT_SHEETS.map((effect) => [
        effect.slug,
        (effect as typeof effect & { readonly frameCount?: number }).frameCount,
      ]))
    ).toEqual(EXPECTED_FRAME_COUNTS);
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
  const frameCount = expectedFrameCount(slug);

  it("출력 PNG 크기가 시트 규경과 정확하게 같다", () => {
    const size = pngSize(effectSheetOutputPath(slug));
    expect(size).toEqual({
      width: GENERATED_EFFECT_SHEET.frameWidth * frameCount,
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

  it("용도별 프레임이 모두 그려지고 서로 다르다", () => {
    const strip = renderEffectStrip(slug, catalog);
    expect(strip.width).toBe(GENERATED_EFFECT_SHEET.frameWidth * frameCount);
    expect(strip.height).toBe(GENERATED_EFFECT_SHEET.frameHeight);
    const signatures: string[] = [];
    for (let index = 0; index < frameCount; index += 1) {
      expect(frameHasPixels(strip, index), `프레임 ${index} 가 완전히 비었다`).toBe(true);
      signatures.push(frameSignature(strip, index));
    }
    expect(new Set(signatures).size).toBe(frameCount);
  });

  it("자를 프레임 사각이 시트 밖을 넘지 않는다", () => {
    // 런타임(battleAnimationDom.animationCell)은 pattern 을 column/row 로 톴서 자른다.
    // 시트가 짧거나 columns 가 틀리면 마지막 프레임이 바가지를 자려서 화면이 보이지 않는다.
    const { frameWidth, frameHeight } = GENERATED_EFFECT_SHEET;
    const columns = frameCount;
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

  it("생성 레코드는 용도별 8~12프레임 전부를 순서대로 재생한다", () => {
    const generated = records.filter((record) => GENERATED_EFFECT_RESOURCE_IDS.includes(record.resourceId ?? ""));
    expect(generated).toHaveLength(GENERATED_EFFECT_SHEETS.length);
    for (const record of generated) {
      const slug = record.resourceId!.replace("generated-battle-anim-", "");
      const frameCount = expectedFrameCount(slug);
      expect(record.sheet?.columns).toBe(frameCount);
      expect(record.frames?.map((frame) => frame.cells[0]?.pattern)).toEqual(
        Array.from({ length: frameCount }, (_unused, index) => index)
      );
    }
  });

  it("생성 레코드는 장수가 늘어도 0.6~0.9초 안에서 재생된다", () => {
    const expectedDurations = {
      "slash-steel": 600,
      "fire-burst": 750,
      "ice-shatter": 750,
      "thunder-strike": 750,
      "water-column": 750,
      "wind-slice": 750,
      "earth-spike": 750,
      "heal-bloom": 750,
      "poison-mist": 750,
      "arcane-nova": 900,
      "tackle-impact": 600,
      "claw-rake": 600,
      "bite-crunch": 600,
      "projectile-shot": 600,
      "leaf-volley": 750,
      "psychic-wave": 750,
      "shadow-pulse": 750,
      "holy-beam": 750,
      "sleep-dust": 750,
      "power-aura": 750,
      "guard-barrier": 750,
      "capture-seal": 900,
      "critical-burst": 600,
      "sonic-wave": 600,
      "drain-orbs": 750,
      "revive-rise": 750,
      "cleanse-sparkle": 750,
      "paralysis-bind": 750,
      "blind-veil": 750,
      "confusion-spiral": 750,
      "silence-lock": 750,
      "summon-portal": 900,
      "smoke-vanish": 600,
      "meteor-fall": 900,
    } as const;
    for (const record of records.filter((entry) => GENERATED_EFFECT_RESOURCE_IDS.includes(entry.resourceId ?? ""))) {
      const slug = record.resourceId!.replace("generated-battle-anim-", "") as keyof typeof expectedDurations;
      expect(battleAnimationDurationMs(record), slug).toBe(expectedDurations[slug]);
    }
  });

  it("생성 이펙트 34종은 각각 한 개의 기본 효과음을 충격 프레임에 재생한다", () => {
    const generated = records.filter((record) => GENERATED_EFFECT_RESOURCE_IDS.includes(record.resourceId ?? ""));
    for (const record of generated) {
      const slug = record.resourceId!.replace("generated-battle-anim-", "") as keyof typeof EXPECTED_SOUND_TIMINGS;
      const expected = EXPECTED_SOUND_TIMINGS[slug];
      const soundTimings = record.timings?.filter((timing) => timing.soundResourceId !== undefined) ?? [];

      expect(soundTimings, slug).toHaveLength(1);
      expect(soundTimings[0]?.frameIndex, slug).toBe(expected.frameIndex);
      expect(soundTimings[0]?.soundResourceId, slug).toBe(expected.resourceId);
      expect(expected.frameIndex, slug).toBeLessThan(record.frames?.length ?? 0);
    }
  });

  it("같은 충격 프레임의 플래시·흔들림·효과음은 하나의 타이밍으로 합쳐진다", () => {
    const slash = records.find((record) => record.resourceId === "generated-battle-anim-slash-steel");
    const impactTimings = slash?.timings?.filter((timing) => timing.frameIndex === 3) ?? [];

    expect(impactTimings).toHaveLength(1);
    expect(impactTimings[0]?.flash).toBeDefined();
    expect(impactTimings[0]?.screenShake).toBeDefined();
    expect(impactTimings[0]?.soundResourceId).toBe("easyrpg-sound-attack2");
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
