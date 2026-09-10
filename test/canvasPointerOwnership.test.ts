// test/canvasPointerOwnership.test.ts
// 캔버스 포인터 제스처 소유권 판정 순수 모듈 단위 테스트.
//
// 판정 5조항 및 경계 조건(우클릭 도구 무관, select 도구 맵 밖/안, selection/stamp/초점 유예, 스페이스 무장)을 고정한다.

import { describe, expect, it } from "vitest";
import {
  resolveCanvasGestureOwner,
  type CanvasOwnershipInput,
} from "@/editor/canvasPointerOwnership";

function baseInput(overrides: Partial<CanvasOwnershipInput> = {}): CanvasOwnershipInput {
  return {
    pointer: { button: 0, buttons: 1 },
    pastePreviewActive: false,
    panArmed: false,
    tool: "paint",
    selectionActive: false,
    paletteStampActive: false,
    deferCameraFocus: false,
    tileInMapBounds: true,
    ...overrides,
  };
}

describe("resolveCanvasGestureOwner", () => {
  describe("0. 붙여넣기 미리보기 활성 (scene)", () => {
    it("pastePreviewActive 가 참이면 버튼(0, 1, 2, 3, 4)이나 도구와 무관하게 항상 scene", () => {
      expect(resolveCanvasGestureOwner(baseInput({ pastePreviewActive: true, pointer: { button: 0, buttons: 1 } }))).toBe("scene");
      expect(resolveCanvasGestureOwner(baseInput({ pastePreviewActive: true, pointer: { button: 1, buttons: 4 } }))).toBe("scene");
      expect(resolveCanvasGestureOwner(baseInput({ pastePreviewActive: true, pointer: { button: 2, buttons: 2 } }))).toBe("scene");
      expect(resolveCanvasGestureOwner(baseInput({ pastePreviewActive: true, pointer: { button: 3, buttons: 8 } }))).toBe("scene");
      expect(resolveCanvasGestureOwner(baseInput({ pastePreviewActive: true, pointer: { button: 4, buttons: 16 } }))).toBe("scene");
      expect(resolveCanvasGestureOwner(baseInput({ pastePreviewActive: true, tool: "pan", panArmed: true }))).toBe("scene");
    });
  });

  describe("1. 가운데 버튼 (pan)", () => {
    it("button이 1이면 도구와 무관하게 항상 pan", () => {
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 1, buttons: 4 } }))).toBe("pan");
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 1, buttons: 0 }, tool: "paint" }))).toBe("pan");
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 1, buttons: 0 }, tool: "select" }))).toBe("pan");
    });

    it("buttons에 4(가운데 버튼)가 켜져 있으면 button이 0이어도 pan", () => {
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 0, buttons: 4 } }))).toBe("pan");
    });
  });

  describe("2. 오른쪽 버튼 (region)", () => {
    it("button이 2이면 도구 및 맵 경계와 무관하게 항상 region", () => {
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 2, buttons: 2 }, tool: "paint" }))).toBe("region");
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 2, buttons: 2 }, tool: "pan" }))).toBe("region");
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 2, buttons: 2 }, tool: "select", tileInMapBounds: false }))).toBe("region");
    });

    it("buttons에 2(우클릭)가 켜져 있으면 region", () => {
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 0, buttons: 2 } }))).toBe("region");
    });

    it("가운데 버튼보다 오른쪽 버튼이 뒤에 평가되지만 둘 다 명확히 분기된다", () => {
      // button이 1이면 1조항에서 pan
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 1, buttons: 2 } }))).toBe("pan");
    });
  });

  describe("3. 왼쪽 버튼 + (tool === 'pan' || panArmed)", () => {
    it("tool이 pan이고 button이 0(왼쪽)이면 pan", () => {
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 0, buttons: 1 }, tool: "pan" }))).toBe("pan");
    });

    it("스페이스 팬 무장(panArmed === true) 상태이고 button이 0(왼쪽)이면 어떤 도구여도 pan", () => {
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 0, buttons: 1 }, tool: "paint", panArmed: true }))).toBe("pan");
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 0, buttons: 1 }, tool: "select", panArmed: true }))).toBe("pan");
    });

    it("button이 3 또는 4(보조 마우스 버튼)이면 tool이 pan이거나 panArmed여도 null 반환", () => {
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 3, buttons: 8 }, tool: "pan" }))).toBeNull();
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 4, buttons: 16 }, tool: "pan" }))).toBeNull();
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 3, buttons: 8 }, tool: "paint", panArmed: true }))).toBeNull();
      expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 4, buttons: 16 }, tool: "paint", panArmed: true }))).toBeNull();
    });
  });

  describe("4. 왼쪽 버튼 + select 도구 + 맵 밖 드래그", () => {
    it("select 도구 + 맵 밖(!tileInMapBounds) + 다른 간섭이 없으면 pan", () => {
      expect(
        resolveCanvasGestureOwner(
          baseInput({
            pointer: { button: 0, buttons: 1 },
            tool: "select",
            tileInMapBounds: false,
            selectionActive: false,
            paletteStampActive: false,
            deferCameraFocus: false,
          }),
        ),
      ).toBe("pan");
    });

    it("button이 3 또는 4(보조 마우스 버튼)이면 select 도구 + 맵 밖이어도 null 반환", () => {
      expect(
        resolveCanvasGestureOwner(
          baseInput({
            pointer: { button: 3, buttons: 8 },
            tool: "select",
            tileInMapBounds: false,
            selectionActive: false,
            paletteStampActive: false,
            deferCameraFocus: false,
          }),
        ),
      ).toBeNull();
      expect(
        resolveCanvasGestureOwner(
          baseInput({
            pointer: { button: 4, buttons: 16 },
            tool: "select",
            tileInMapBounds: false,
            selectionActive: false,
            paletteStampActive: false,
            deferCameraFocus: false,
          }),
        ),
      ).toBeNull();
    });

    it("select 도구여도 맵 안(tileInMapBounds === true)이면 null (오버레이 소유)", () => {
      expect(
        resolveCanvasGestureOwner(
          baseInput({
            pointer: { button: 0, buttons: 1 },
            tool: "select",
            tileInMapBounds: true,
            selectionActive: false,
            paletteStampActive: false,
            deferCameraFocus: false,
          }),
        ),
      ).toBeNull();
    });

    it("선택 활성(selectionActive === true)이면 맵 밖이어도 null", () => {
      expect(
        resolveCanvasGestureOwner(
          baseInput({
            pointer: { button: 0, buttons: 1 },
            tool: "select",
            tileInMapBounds: false,
            selectionActive: true,
          }),
        ),
      ).toBeNull();
    });

    it("팔레트 스탬프 활성(paletteStampActive === true)이면 맵 밖이어도 null", () => {
      expect(
        resolveCanvasGestureOwner(
          baseInput({
            pointer: { button: 0, buttons: 1 },
            tool: "select",
            tileInMapBounds: false,
            paletteStampActive: true,
          }),
        ),
      ).toBeNull();
    });

    it("초점 유예(deferCameraFocus === true) 중이면 맵 밖이어도 null", () => {
      expect(
        resolveCanvasGestureOwner(
          baseInput({
            pointer: { button: 0, buttons: 1 },
            tool: "select",
            tileInMapBounds: false,
            deferCameraFocus: true,
          }),
        ),
      ).toBeNull();
    });
  });

  describe("5. 그 외 (null — 오버레이 소유)", () => {
    it("paint / fill / erase 등 일반 도구에서 맵 안 좌클릭은 null", () => {
      expect(resolveCanvasGestureOwner(baseInput({ tool: "paint", tileInMapBounds: true }))).toBeNull();
      expect(resolveCanvasGestureOwner(baseInput({ tool: "fill", tileInMapBounds: true }))).toBeNull();
      expect(resolveCanvasGestureOwner(baseInput({ tool: "erase", tileInMapBounds: true }))).toBeNull();
      expect(resolveCanvasGestureOwner(baseInput({ tool: "event", tileInMapBounds: true }))).toBeNull();
      expect(resolveCanvasGestureOwner(baseInput({ tool: "eyedropper", tileInMapBounds: true }))).toBeNull();
    });

    it("paint 도구에서 맵 밖 좌클릭도 null", () => {
      expect(resolveCanvasGestureOwner(baseInput({ tool: "paint", tileInMapBounds: false }))).toBeNull();
    });
  });
});
