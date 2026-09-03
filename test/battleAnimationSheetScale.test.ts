/** @vitest-environment happy-dom */
/**
 * 시트 해상도 계약 — `BattleAnimationSheet.assetScale`.
 *
 * 왜 필요한가(실측 2026-09-03): 런타임이 모든 시트를 320 시대 자산으로 보고 2배로 그려서,
 * 384px 고해상도 이펙트 시트를 그대로 넣으면 768 논리 px 로 무대를 덮는다. 반대로 지금의
 * 96px 시트는 48 격자를 2배 복제한 것이라 화면에서 한 픽셀이 4 CSS px 굵기다(몬스터 밀도의 1/10).
 * 시트 1px 이 논리 px 몇 개를 차지하는지를 레코드가 들고 있어야 두 종류가 한 렌더러에서 맞게 그려진다.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountBattleAnimationPlayback } from "@/player/battleAnimationDom";
import {
  battleAnimationSheetAssetScale,
  battleAnimationSheetRendering,
  battleAnimationSheetRmScale,
} from "@/player/battleAnimationPlayback";
import { BATTLE_ASSET_PIXEL_SCALE } from "@/player/battleStageScale";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { BattleAnimationSheet } from "@/project/types";

const LEGACY_SHEET: BattleAnimationSheet = { frameWidth: 96, frameHeight: 96, columns: 5 };
const HIRES_SHEET: BattleAnimationSheet = { frameWidth: 384, frameHeight: 384, columns: 10, assetScale: 0.5 };

describe("normalizeBattleAnimationRecord — assetScale", () => {
  it("필드가 없는 저장 레코드는 320 시대 자산(2)으로 읽힌다", () => {
    const record = normalizeBattleAnimationRecord({ id: "a", name: "a", sheet: LEGACY_SHEET });
    expect(record.sheet?.assetScale).toBe(BATTLE_ASSET_PIXEL_SCALE);
  });

  it("고해상도 시트의 0.5 를 보존한다", () => {
    const record = normalizeBattleAnimationRecord({ id: "a", name: "a", sheet: HIRES_SHEET });
    expect(record.sheet?.assetScale).toBe(0.5);
  });

  it("비정상 값은 범위(0.125~8) 안으로 접거나 기본값으로 돌린다", () => {
    const tooSmall = normalizeBattleAnimationRecord({ id: "a", name: "a", sheet: { ...LEGACY_SHEET, assetScale: 0.001 } });
    const tooBig = normalizeBattleAnimationRecord({ id: "a", name: "a", sheet: { ...LEGACY_SHEET, assetScale: 99 } });
    const nan = normalizeBattleAnimationRecord({ id: "a", name: "a", sheet: { ...LEGACY_SHEET, assetScale: Number.NaN } });
    expect(tooSmall.sheet?.assetScale).toBe(0.125);
    expect(tooBig.sheet?.assetScale).toBe(8);
    expect(nan.sheet?.assetScale).toBe(BATTLE_ASSET_PIXEL_SCALE);
  });
});

describe("시트 배율 파생값", () => {
  it("논리 px 환산: 레거시 2, 고해상도 0.5, 시트 없음 2", () => {
    expect(battleAnimationSheetAssetScale(LEGACY_SHEET)).toBe(2);
    expect(battleAnimationSheetAssetScale(HIRES_SHEET)).toBe(0.5);
    expect(battleAnimationSheetAssetScale(undefined)).toBe(2);
  });

  it("RM px(320 시대) 환산은 논리 환산의 절반 — 미리보기·맵이 쓴다", () => {
    expect(battleAnimationSheetRmScale(LEGACY_SHEET)).toBe(1);
    expect(battleAnimationSheetRmScale(HIRES_SHEET)).toBe(0.25);
  });

  it("확대되는 시트만 pixelated, 축소되는 시트는 smooth", () => {
    expect(battleAnimationSheetRendering(LEGACY_SHEET)).toBe("pixelated");
    expect(battleAnimationSheetRendering({ ...LEGACY_SHEET, assetScale: 1 })).toBe("pixelated");
    expect(battleAnimationSheetRendering(HIRES_SHEET)).toBe("smooth");
  });
});

describe("battleAnimationDom.animationCell — 시트 배율", () => {
  const TARGET_ID = "enemy_1";

  function seed(sheet: BattleAnimationSheet): void {
    const project = createBlankProject();
    project.database.battleAnimations = [
      normalizeBattleAnimationRecord({
        id: "anim_test",
        name: "테스트",
        resourceId: "easyrpg-battle-blow",
        sheet,
        frames: [{ cells: [{ pattern: 0, x: 4, y: -8, zoom: 100, opacity: 255, visible: true }] }],
      }),
    ];
    store.replace(project);
  }

  function mount(): HTMLElement {
    const scene = document.createElement("section");
    const target = document.createElement("div");
    target.dataset.testid = TARGET_ID;
    scene.append(target);
    document.body.append(scene);
    const playback = mountBattleAnimationPlayback(
      {
        lastAnimation: {
          animationId: "anim_test",
          targetId: TARGET_ID,
          name: "테스트",
          soundResourceIds: [],
          flashTargets: [],
          screenShake: false,
          frameCount: 1,
        },
      } as never,
      scene
    );
    if (!playback) throw new Error("재생 엘리먼트가 없다");
    return playback.element;
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("레거시 96px 시트는 지금처럼 192 논리 px · pixelated 로 그린다", () => {
    seed(LEGACY_SHEET);
    const cell = mount().querySelector<HTMLCanvasElement>(".battle-animation-cell");
    expect(cell?.width).toBe(96);
    expect(cell?.style.width).toBe("192px");
    expect(cell?.style.height).toBe("192px");
    expect(cell?.dataset.rendering).toBe("pixelated");
  });

  it("384px·0.5 시트도 같은 192 논리 px 를 차지하고 smooth 로 그린다", () => {
    seed(HIRES_SHEET);
    const cell = mount().querySelector<HTMLCanvasElement>(".battle-animation-cell");
    expect(cell?.width).toBe(384);
    expect(cell?.style.width).toBe("192px");
    expect(cell?.style.height).toBe("192px");
    expect(cell?.dataset.rendering).toBe("smooth");
  });

  it("셀 오프셋(x/y)은 시트 해상도와 무관하게 RM px 로 환산된다", () => {
    seed(HIRES_SHEET);
    const cell = mount().querySelector<HTMLCanvasElement>(".battle-animation-cell");
    // x:4 → 8 논리 px, y:-8 → -16 논리 px — 레거시 시트와 같은 값이어야 한다.
    expect(cell?.style.left).toBe(`calc(50% + ${4 * BATTLE_ASSET_PIXEL_SCALE}px)`);
    expect(cell?.style.top).toBe(`calc(50% + ${-8 * BATTLE_ASSET_PIXEL_SCALE}px)`);
  });
});
