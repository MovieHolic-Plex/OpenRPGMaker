/** @vitest-environment happy-dom */
/**
 * 48px 영웅 전투 시트의 고해상도 짝(xBR 4배, 192px 셀) 계약.
 *
 * 왜(실측 2026-09-03): 몬스터 배틀러는 384px 원본이 필드에서 밀도 1.6 인데 영웅은 48px 셀을 2배로 그려
 * 0.5 였다. 픽셀아트를 모델에 다시 그리게 하면 다른 사람이 되므로 결정적 업스케일러로 형태·색을 그대로
 * 두고 계단만 잇는다. 여기서 세 조각을 묶는다: 카탈로그 · 커밋된 PNG(생성기 재현) · 런타임이 그걸 쓰는지.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import {
  BATTLER_HIRES_CELL,
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
import { hiresTargets, renderHiresPng } from "../scripts/asset-gen/gen-battler-hires-sheets.mjs";
import { xbr2x } from "../scripts/lib/pixelUpscale.mjs";
import battleFixture from "./fixtures/projects/battle-v3.json";

const REPO_ROOT = path.resolve(__dirname, "..");
const publicPath = (relative: string): string => path.join(REPO_ROOT, "public", relative);

function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("카탈로그와 커밋된 PNG", () => {
  it("여섯 영웅 + 레거시 별칭 hero 가 192px 셀 시트를 가리키고 파일이 존재한다", () => {
    expect(BATTLER_HIRES_SHEETS.map((entry) => entry.resourceId)).toEqual([
      ...[1, 2, 3, 4, 5, 6].map((index) => `generated-actor-hero-0${index}-battle`),
      "hero",
    ]);
    for (const entry of BATTLER_HIRES_SHEETS) {
      expect(entry.cellWidth).toBe(BATTLER_HIRES_CELL);
      expect(existsSync(publicPath(entry.path)), entry.path).toBe(true);
      // 3열 × 8행 전투 시트 규격 × 4.
      expect(pngSize(publicPath(entry.path))).toEqual({ width: 192 * 3, height: 192 * 8 });
    }
    expect(battlerHiresSheet("hero")?.path).toBe(battlerHiresSheet("generated-actor-hero-01-battle")?.path);
    expect(battlerHiresSheet("generated-actor-hero-99-battle")).toBeUndefined();
    expect(battlerHiresSheet(undefined)).toBeUndefined();
  });

  it("고해상도 시트는 논리 px 배율 0.5, 없는 시트는 320 시대 자산(2)이다", () => {
    expect(battlerSheetAssetScale(battlerHiresSheet("generated-actor-hero-01-battle"))).toBe(0.5);
    expect(battlerSheetAssetScale(undefined)).toBe(2);
    expect(battlerHiresSheetUrl(BATTLER_HIRES_SHEETS[0]!)).toBe("/assets/generated/starter/hires/hero-01-battle.png");
  });

  it("커밋된 시트·idle 스트립은 생성기가 원본에서 다시 만든 바이트와 같다(재현성)", () => {
    for (const target of hiresTargets()) {
      expect(existsSync(target.output), target.output).toBe(true);
      const rendered = Buffer.from(renderHiresPng(target.source).bytes);
      expect(rendered.equals(readFileSync(target.output)), `${target.kind} ${target.slug}`).toBe(true);
    }
  });

  it("액터 idle 스트립도 같은 192px 셀의 고해상도 짝을 쓴다 — idle 로 넘어갈 때 화질이 튀지 않는다", () => {
    for (const index of [1, 2, 3, 4, 5, 6]) {
      const idle = battlerIdleAnimation(`generated-actor-hero-0${index}-battle`);
      expect(idle?.cellWidth).toBe(BATTLER_HIRES_CELL);
      expect(idle?.path).toContain("starter/hires/idle/");
      expect(pngSize(publicPath(idle!.path))).toEqual({ width: 192 * 4, height: 192 });
    }
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
    (project.system as { battleUiStyle?: string }).battleUiStyle = "ff";
    store.replace(project);
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 });
    const snapshot: BattleSnapshot = runtime.snapshot();
    const actor = snapshot.actors[0];
    expect(actor).toBeTruthy();
    (actor as { battleCharacterResourceId?: string }).battleCharacterResourceId = battleCharacterResourceId;
    return battleField(snapshot);
  }

  it("등록된 영웅 시트는 고해상도 짝을 같은 논리 크기(288×768)로 부드럽게 그린다", () => {
    const field = renderField("generated-actor-hero-03-battle");
    const sprite = field.querySelector<HTMLElement>("[data-testid='battle-actor-sprite-generated-actor-hero-03-battle']");
    // 정적 시트(포즈 전환 때 복원되는 원본)는 고해상도 짝이다.
    expect(sprite?.dataset.battlerSheetUrl).toBe("/assets/generated/starter/hires/hero-03-battle.png");
    expect(sprite?.dataset.rendering).toBe("smooth");
    expect(sprite?.dataset.battlerSheetCell).toBe("192");
    // 화면 크기는 시트 해상도와 무관하게 48 셀 × 2 × (3열 × 8행) 논리 px 다.
    expect(sprite?.dataset.battlerSheetSize).toBe("288px 768px");
    expect(sprite?.style.getPropertyValue("--battle-sprite-frame-width")).toBe("96px");
    // 마운트 시점 포즈가 idle 이라 보이는 배경은 같은 192px 셀의 고해상도 idle 스트립이고, 크기는 4칸 × 96 논리 px.
    expect(sprite?.style.backgroundImage).toContain("/assets/generated/starter/hires/idle/hero-03-battle.png");
    expect(sprite?.style.backgroundSize).toBe("384px 96px");
  });

});
