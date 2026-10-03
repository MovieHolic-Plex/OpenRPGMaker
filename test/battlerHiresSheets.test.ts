/** @vitest-environment happy-dom */
// Starter companions are retired; the reusable upscale kernel remains independent.
import { describe, expect, it } from "vitest";
import {
  BATTLER_HIRES_SHEETS,
  battlerHiresSheet,
  battlerHiresSheetUrl,
  battlerSheetAssetScale,
} from "@/assets/battlerHiresSheets";
import { battlerIdleAnimation } from "@/assets/battlerIdleAnimations";
import { createBattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { battleField } from "@/player/battleFieldDom";
import { deserialize } from "@/project/io";
import { store } from "@/project/store";
import { xbr2x } from "../scripts/lib/pixelUpscale.mjs";
import battleFixture from "./fixtures/projects/battle-v3.json";

describe("폐기된 starter 고해상도 짝", () => {
  it("전투 시트와 idle 스트립을 등록하지 않는다", () => {
    expect(BATTLER_HIRES_SHEETS).toEqual([]);
    for (const id of ["hero", ...[1, 2, 3, 4, 5, 6].map(i => `generated-actor-hero-0${i}-battle`)]) {
      expect(battlerHiresSheet(id)).toBeUndefined();
      expect(battlerIdleAnimation(id)).toBeUndefined();
    }
    expect(battlerHiresSheet(undefined)).toBeUndefined();
    expect(battlerSheetAssetScale(undefined)).toBe(2);
  });

  it("직접 등록한 짝의 URL과 논리 크기는 기존 계약을 유지한다", () => {
    const entry = { resourceId: "uploaded-custom-battler", path: "assets/custom/hires.png", cellWidth: 192, cellHeight: 192 };
    expect(battlerSheetAssetScale(entry)).toBe(0.5);
    expect(battlerHiresSheetUrl(entry)).toBe("/assets/custom/hires.png");
  });
});

describe("xBR 2배 커널", () => {
  /** 8×8: 좌하 삼각형(x <= y)은 검정, 나머지 투명 — 대각 계단 경계. */
  function staircase(): { width: number; height: number; data: Uint8Array } {
    const size = 8;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (x <= y) data.set([0, 0, 0, 255], (y * size + x) * 4);
      }
    }
    return { width: size, height: size, data };
  }

  it("대각 계단은 중간 알파로 이어지고, 경계에서 먼 안쪽·바깥은 그대로다", () => {
    const image = staircase();
    const up = xbr2x(image.width, image.height, image.data);
    expect(up.width).toBe(16);
    const alpha = (x: number, y: number) => up.data[(y * 16 + x) * 4 + 3]!;
    let blended = 0;
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) if (alpha(x, y) > 0 && alpha(x, y) < 255) blended += 1;
    expect(blended, "계단을 잇는 중간 알파 픽셀이 있어야 한다").toBeGreaterThan(0);
    // 안쪽(좌하 깊숙이)은 완전 불투명, 바깥(우상 깊숙이)은 완전 투명.
    expect(alpha(1, 14)).toBe(255);
    expect(alpha(14, 1)).toBe(0);
  });

  it("단색 면은 가장자리까지 그대로다 — 이미지 밖을 투명으로 보지 않는다", () => {
    const red = [200, 40, 40, 255];
    const data = new Uint8Array([...red, ...red, ...red, ...red]);
    const up = xbr2x(2, 2, data);
    for (let i = 0; i < 16; i += 1) expect([...up.data.subarray(i * 4, i * 4 + 4)]).toEqual(red);
  });
});

describe("런타임 — 필드의 액터 스프라이트", () => {
  function renderField(battleCharacterResourceId: string): HTMLElement {
    const project = deserialize(JSON.stringify(battleFixture));
    (project.system as { battleUiStyle?: string }).battleUiStyle = "retro2003";
    store.replace(project);
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 });
    const snapshot: BattleSnapshot = runtime.snapshot();
    const actor = snapshot.actors[0];
    expect(actor).toBeTruthy();
    (actor as { battleCharacterResourceId?: string }).battleCharacterResourceId = battleCharacterResourceId;
    return battleField(snapshot);
  }

  it("삭제된 영웅 시트는 starter URL을 그리지 않는다", () => {
    const field = renderField("generated-actor-hero-03-battle");
    expect(field.querySelector("[data-testid='battle-actor-sprite-generated-actor-hero-03-battle']")).toBeNull();
    expect(field.innerHTML).not.toContain("generated/starter/");
  });

  it("현재 걷기 칩 전투 시트는 48px 셀을 정수 배율로 그린다", () => {
    const field = renderField("charset-battler-actor1-0");
    const sprite = field.querySelector<HTMLElement>("[data-testid='battle-actor-sprite-charset-battler-actor1-0']");
    expect(sprite?.dataset.rendering).toBe("pixelated");
    expect(sprite?.dataset.battlerSheetSize).toBe("288px 768px");
    expect(sprite?.style.getPropertyValue("--battle-sprite-frame-width")).toBe("96px");
    expect(sprite?.style.backgroundImage).toContain("charset-battlers/actor1-0.png");
    expect(sprite?.style.backgroundImage).not.toContain("starter/");
  });
});
