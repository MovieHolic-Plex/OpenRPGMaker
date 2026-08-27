// 시스템·연출(피커 3페이지) 명령 프리뷰 폴리시 계약.
// 색조/날씨/먼 배경/키 입력 프리뷰가 "실제 시각 요소"를 갖는지 구조로만 검사한다
// (한국어 산문 전문·픽셀 색은 고정하지 않는다).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const TINT_ID = "m2-046-tint-screen";
const WEATHER_ID = "m2-050-set-weather-effects";
const KEY_INPUT_ID = "m2-067-key-input-processing";
const PARALLAX_ID = "m2-069-change-parallax-back";

const UPLOADED_BACKDROP_ID = "uploaded-parallax-cliff";

let replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();

function context(): CommandEditContext {
  return {
    path: [3],
    actions: {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand,
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
    },
  };
}

function renderBody(commandId: string, fields: Record<string, unknown>): FakeElement {
  const cmd = { kind: "m2Command", commandId, fields } as unknown as Command;
  return renderWithFakeDom(() => renderM2CommandBody(context(), cmd) ?? document.createElement("div"));
}

function requireTestId(root: FakeElement, testId: string): FakeElement {
  const found = findByTestId(root, testId);
  if (!found) throw new Error(`missing [data-testid="${testId}"]`);
  return found;
}

/** 프리뷰 구조 불변조건: [시각 요소] → .actor-m2-preview-line → .actor-m2-preview-note */
function expectVisualFirstThenLineThenNote(preview: FakeElement, visualTestId: string): void {
  const first = preview.children[0];
  expect(first?.dataset.testid).toBe(visualTestId);
  const classes = preview.children.map((child) => child.className);
  const lineIndex = classes.findIndex((name) => name.split(/\s+/).includes("actor-m2-preview-line"));
  const noteIndex = classes.findIndex((name) => name.split(/\s+/).includes("actor-m2-preview-note"));
  expect(lineIndex).toBeGreaterThan(0);
  expect(noteIndex).toBeGreaterThan(lineIndex);
}

describe("page 3 시스템·연출 프리뷰 폴리시", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
    const project = createBlankProject();
    project.assets.uploaded[UPLOADED_BACKDROP_ID] = {
      id: UPLOADED_BACKDROP_ID,
      name: "절벽 원경.png",
      kind: "backdrop",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      meta: { width: 640, height: 480 },
    };
    store.replace(project);
  });

  afterEach(() => {
    restoreDom?.();
  });

  describe("화면 색조", () => {
    it("프리뷰 첫 자식이 stage + 색 swatch이고 프리셋 선택이 data-tint로 반영된다", () => {
      const body = renderBody(TINT_ID, { color: "blue", value: "", duration: 600 });
      const preview = requireTestId(body, "tint-screen-preview");
      const stage = requireTestId(preview, "tint-screen-preview-stage");
      const swatch = requireTestId(stage, "tint-screen-preview-swatch");

      expect(stage.className.split(/\s+/)).toEqual(
        expect.arrayContaining(["actor-m2-preview-stage", "page3-preview-stage"])
      );
      expect(swatch.className.split(/\s+/)).toEqual(
        expect.arrayContaining(["actor-m2-effect-swatch", "page3-tint-preview"])
      );
      expect(swatch.dataset.tint).toBe("blue");
      expect(swatch.dataset.durationMs).toBe("600");
      expectVisualFirstThenLineThenNote(preview, "tint-screen-preview-stage");
      expect(findByTestId(body, "tint-screen-preview-error")).toBeNull();
    });

    it("기존 색상 칩 testid를 유지하고 칩 클릭이 swatch 색조를 갱신한다", () => {
      const body = renderBody(TINT_ID, { color: "neutral", value: "", duration: 0 });
      expect(findByTestId(body, "tint-screen-color-chips")).not.toBeNull();
      for (const id of ["neutral", "white", "red", "green", "blue", "yellow", "purple", "black"]) {
        expect(findByTestId(body, `tint-screen-color-${id}`), id).not.toBeNull();
      }
      expect(requireTestId(body, "tint-screen-preview-swatch").dataset.tint).toBe("neutral");

      requireTestId(body, "tint-screen-color-red").click();

      expect(requireTestId(body, "tint-screen-preview-swatch").dataset.tint).toBe("red");
    });

    it("유효한 직접 색은 custom swatch + 인라인 효과 색 변수로 표현된다", () => {
      const body = renderBody(TINT_ID, { color: "blue", value: "#3366ff", duration: 200 });
      const swatch = requireTestId(body, "tint-screen-preview-swatch");

      expect(swatch.dataset.tint).toBe("custom");
      expect(swatch.style.getPropertyValue("--actor-m2-effect-color")).not.toBe("");
      expect(findByTestId(body, "tint-screen-preview-error")).toBeNull();
    });

    it("무효한 직접 색은 status 오류 안내를 띄운다", () => {
      const body = renderBody(TINT_ID, { color: "blue", value: "nope", duration: 200 });
      const error = requireTestId(body, "tint-screen-preview-error");

      expect(error.getAttribute("role")).toBe("status");
      expect(error.textContent.trim().length).toBeGreaterThan(0);
      expect(requireTestId(body, "tint-screen-preview-swatch").dataset.tint).toBe("blue");
    });

    it("폼을 여는 것만으로는 명령을 저장하지 않는다", () => {
      renderBody(TINT_ID, { color: "blue", value: "", duration: 600 });
      expect(replaceCommand).not.toHaveBeenCalled();
    });
  });

  describe("날씨 효과", () => {
    it("stage 안에 강도가 반영된 오버레이가 항상 존재한다", () => {
      const body = renderBody(WEATHER_ID, { value: "rain,0.7", transitionMs: 800 });
      const preview = requireTestId(body, "set-weather-effects-preview");
      const stage = requireTestId(preview, "set-weather-effects-preview-stage");
      const overlay = requireTestId(stage, "set-weather-effects-preview-overlay");

      expect(stage.className.split(/\s+/)).toEqual(
        expect.arrayContaining(["actor-m2-preview-stage", "page3-preview-stage", "page3-preview-weather"])
      );
      expect(overlay.className.split(/\s+/)).toEqual(
        expect.arrayContaining(["actor-m2-weather-overlay", "page3-weather-preview"])
      );
      expect(overlay.dataset.weather).toBe("rain");
      expect(Number(overlay.dataset.intensity)).toBeCloseTo(0.7, 5);
      expect(overlay.dataset.transitionMs).toBe("800");
      expectVisualFirstThenLineThenNote(preview, "set-weather-effects-preview-stage");
    });

    it("날씨 없음에서도 오버레이를 DOM에서 제거하지 않는다", () => {
      const body = renderBody(WEATHER_ID, { value: "none", transitionMs: 0 });
      const overlay = requireTestId(body, "set-weather-effects-preview-overlay");

      expect(overlay.dataset.weather).toBe("none");
    });

    it("종류 칩마다 색 점을 붙이고 기존 칩 testid를 유지한다", () => {
      const body = renderBody(WEATHER_ID, { value: "snow,0.4", transitionMs: 0 });
      for (const id of ["none", "rain", "storm", "snow", "fog"]) {
        const chip = requireTestId(body, `set-weather-effects-kind-${id}`);
        const dot = requireTestId(chip, `set-weather-effects-kind-${id}-dot`);
        expect(dot.className.split(/\s+/)).toContain("actor-m2-weather-dot");
      }
    });

    it("안개일 때만 원·근 두 겹의 안개 층이 생긴다", () => {
      const fog = renderBody(WEATHER_ID, { value: "fog,0.7", transitionMs: 800 });
      const far = requireTestId(fog, "set-weather-effects-preview-fog-far");
      const near = requireTestId(fog, "set-weather-effects-preview-fog-near");
      expect(far.className.split(/\s+/)).toContain("actor-m2-fog-layer");
      expect(near.className.split(/\s+/)).toContain("actor-m2-fog-layer");
      expect(fog.querySelectorAll(".actor-m2-fog-layer")).toHaveLength(2);

      const rain = renderBody(WEATHER_ID, { value: "rain,0.7", transitionMs: 0 });
      expect(rain.querySelectorAll(".actor-m2-fog-layer")).toHaveLength(0);
      expect(findByTestId(rain, "set-weather-effects-preview-fog-far")).toBeNull();
      expect(findByTestId(rain, "set-weather-effects-preview-fog-near")).toBeNull();
    });

    it("강도 슬라이더가 숫자 입력·오버레이와 동기화되고 저장 형식은 그대로다", () => {
      const body = renderBody(WEATHER_ID, { value: "fog,0.7", transitionMs: 800 });
      const slider = requireTestId(body, "set-weather-effects-intensity-slider");
      const numberInput = requireTestId(body, "set-weather-effects-intensity-input");
      expect(slider.className.split(/\s+/)).toContain("page3-range-input");
      expect(slider.getAttribute("type")).toBe("range");
      expect(Number(slider.value)).toBeCloseTo(0.7, 5);

      slider.value = "0.35";
      slider.dispatchEvent(new Event("input"));

      expect(Number(numberInput.value)).toBeCloseTo(0.35, 5);
      expect(Number(requireTestId(body, "set-weather-effects-preview-overlay").dataset.intensity)).toBeCloseTo(0.35, 5);
      expect(replaceCommand).toHaveBeenCalledWith(
        [3],
        expect.objectContaining({
          fields: expect.objectContaining({ value: "fog,0.35" }),
        })
      );
    });

    it("폼을 여는 것만으로는 명령을 저장하지 않는다", () => {
      renderBody(WEATHER_ID, { value: "fog,0.7", transitionMs: 800 });
      expect(replaceCommand).not.toHaveBeenCalled();
    });
  });

  describe("먼 배경 변경", () => {
    it("선택된 배경은 실제 이미지 + 캡션으로 보인다", () => {
      const body = renderBody(PARALLAX_ID, { value: UPLOADED_BACKDROP_ID });
      const preview = requireTestId(body, "change-parallax-back-preview");
      const panel = requireTestId(preview, "change-parallax-back-preview-image");

      expect(panel.className.split(/\s+/)).toEqual(
        expect.arrayContaining(["actor-m2-parallax-preview", "actor-m2-preview-stage"])
      );
      expect(panel.dataset.state).toBe("ready");
      const images = panel.querySelectorAll("img");
      expect(images).toHaveLength(1);
      expect(images[0]?.className.split(/\s+/)).toContain("actor-m2-parallax-preview-img");
      expect(images[0]?.getAttribute("alt")).toContain("먼 배경");
      const caption = requireTestId(preview, "change-parallax-back-preview-caption");
      expect(caption.getAttribute("title")).toBe(UPLOADED_BACKDROP_ID);
      expectVisualFirstThenLineThenNote(preview, "change-parallax-back-preview-image");
    });

    it("미선택이면 empty 상태 안내만 보이고 이미지가 없다", () => {
      const body = renderBody(PARALLAX_ID, { value: "" });
      const panel = requireTestId(body, "change-parallax-back-preview-image");

      expect(panel.dataset.state).toBe("empty");
      expect(panel.querySelectorAll("img")).toHaveLength(0);
      expect(findByTestId(panel, "change-parallax-back-preview-empty")).not.toBeNull();
      expect(findByTestId(panel, "change-parallax-back-preview-missing")).toBeNull();
    });

    it("해석할 수 없는 리소스는 missing 상태로 알린다", () => {
      const body = renderBody(PARALLAX_ID, { value: "no-such-backdrop-#$%" });
      const panel = requireTestId(body, "change-parallax-back-preview-image");

      expect(panel.dataset.state).toBe("missing");
      expect(panel.querySelectorAll("img")).toHaveLength(0);
      expect(findByTestId(panel, "change-parallax-back-preview-missing")).not.toBeNull();
    });

    it("기존 리소스 선택/피커 testid를 유지하고 오픈 시 저장하지 않는다", () => {
      const body = renderBody(PARALLAX_ID, { value: UPLOADED_BACKDROP_ID });
      expect(findByTestId(body, "change-parallax-back-resource-select")).not.toBeNull();
      expect(findByTestId(body, "change-parallax-back-resource-picker")).not.toBeNull();
      expect(replaceCommand).not.toHaveBeenCalled();
    });
  });

  describe("키 입력", () => {
    it("저장되는 키 코드 집합을 키캡으로 전부 보여준다", () => {
      const body = renderBody(KEY_INPUT_ID, { variableId: "", value: "true" });
      const preview = requireTestId(body, "key-input-processing-preview");
      const keycaps = requireTestId(preview, "key-input-processing-keycaps");

      expect(keycaps.className.split(/\s+/)).toContain("actor-m2-keycaps");
      expect(keycaps.getAttribute("aria-label")).toBe("입력 가능한 키 코드");
      for (const code of ["1", "2", "3", "4", "5", "6", "7", "digits"]) {
        const cap = requireTestId(keycaps, `key-input-processing-keycap-${code}`);
        expect(cap.className.split(/\s+/)).toContain("actor-m2-keycap");
      }
      expect(keycaps.querySelectorAll(".actor-m2-keycap")).toHaveLength(8);
      expectVisualFirstThenLineThenNote(preview, "key-input-processing-keycaps");
    });

    it("대상 변수·대기 배지를 시각 요소와 함께 노출한다", () => {
      const waiting = renderBody(KEY_INPUT_ID, { variableId: "", value: "true" });
      expect(requireTestId(waiting, "key-input-processing-preview-target").textContent.trim().length).toBeGreaterThan(0);
      expect(requireTestId(waiting, "key-input-processing-preview-wait").dataset.wait).toBe("true");

      const notWaiting = renderBody(KEY_INPUT_ID, { variableId: "", value: "false" });
      expect(requireTestId(notWaiting, "key-input-processing-preview-wait").dataset.wait).toBe("false");
    });

    it("기존 변수/대기 컨트롤 testid를 유지하고 오픈 시 저장하지 않는다", () => {
      const body = renderBody(KEY_INPUT_ID, { variableId: "", value: "true" });
      expect(findByTestId(body, "key-input-processing-variable")).not.toBeNull();
      expect(findByTestId(body, "key-input-processing-wait")).not.toBeNull();
      expect(replaceCommand).not.toHaveBeenCalled();
    });
  });
});
