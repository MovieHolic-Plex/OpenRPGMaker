import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { newCommand, newM2Command } from "@/editor/eventActions";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import {
  eventCommandPickerSearchEntries,
  eventCommandPickerTabEntries,
} from "@/editor/panels/eventEditor/commandPicker";
import { M2_MAP_SCREEN_SURFACE_GROUPS } from "@/project/eventCommands/m2PickerLayout";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";
import type { Command } from "@/project/types";

/**
 * 탭 3 「지도 · 화면 효과」는 RM2003 Event Command 4페이지가 아니라 연출 작업면이다.
 * 계약: `.omo/plans/event-editor-map-screen-effects-adversarial-review.md`
 *
 * - 조명 · 날씨 · 그림 · 화면 효과를 탭 3에서 찾는다(탭 4로 숨지 않는다).
 * - 화면 효과 / 카메라 미리보기는 토큰 요약 카드가 아니라 필드에 반응하는 그림이다.
 * - 지형 변경은 칩셋 크롭을 보여 준다. 번호 입력만으로는 무슨 그림인지 알 수 없다.
 * - 같은 일을 하는 레거시 RM 행(`m2-050`)은 네이티브 구현(`setWeather`) 위로 올라오지 않는다.
 */
describe("picker tab 3 information architecture", () => {
  it("puts zero informational (unselectable) rows on the tab-3 grid", () => {
    const entries = eventCommandPickerTabEntries(3);

    expect(entries.filter((entry) => !entry.selectable)).toEqual([]);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("groups tab 3 by work surface, not by RM classification names", () => {
    const groups = [...new Set(eventCommandPickerTabEntries(3).map((entry) => entry.group))];

    expect(groups).not.toContain("맵/이동");
    expect(groups).not.toContain("화면/연출");
    expect(groups).not.toContain("시스템/고급");
    expect(groups).not.toContain("소리");
    for (const group of groups) expect(M2_MAP_SCREEN_SURFACE_GROUPS).toContain(group);
    expect(groups).toContain("지도");
    expect(groups).toContain("조명·날씨");
    expect(groups).toContain("그림");
    expect(groups).toContain("화면 연출");
  });

  it("keeps lighting, weather, pictures, screen effects and camera on tab 3", () => {
    const tabThree = eventCommandPickerTabEntries(3);
    const ids = tabThree.map((entry) => entry.commandId);

    expect(ids).toContain("setLighting");
    expect(ids).toContain("setWeather");
    expect(ids).toContain("m2-051-show-picture");
    expect(ids).toContain("m2-053-erase-picture");
    expect(ids).toContain("m2-202-screen-effect");
    expect(ids).toContain("m2-201-camera-control");
    expect(ids).toContain("m2-071-change-tile");

    // 조명·날씨는 한 헤딩 아래 모인다 — 작가가 분위기를 만들 때 두 곳을 뒤지지 않게.
    const lightingGroup = tabThree.find((entry) => entry.commandId === "setLighting")?.group;
    expect(tabThree.find((entry) => entry.commandId === "setWeather")?.group).toBe(lightingGroup);
    // 애니메이션 표시는 소리가 아니라 화면 연출이다.
    expect(tabThree.find((entry) => entry.commandId === "showAnimation")?.group).toBe("화면 연출");
  });

  it("ranks the native 날씨 설정 above the legacy m2-050 catalog row", () => {
    const tabThree = eventCommandPickerTabEntries(3).map((entry) => entry.commandId);
    const search = eventCommandPickerSearchEntries()
      .filter((entry) => entry.label.includes("날씨"))
      .map((entry) => entry.commandId);

    expect(tabThree.indexOf("setWeather")).toBeGreaterThanOrEqual(0);
    expect(tabThree.indexOf("setWeather")).toBeLessThan(tabThree.indexOf("m2-050-set-weather-effects"));
    expect(search[0]).toBe("setWeather");
    expect(search).toContain("m2-050-set-weather-effects");
  });
});

describe("map and screen previews react to fields", () => {
  function withProject<T>(run: () => T): T {
    const restore = installFakeDom();
    try {
      store.replace(createBlankProject());
      return run();
    } finally {
      restore();
    }
  }

  function preview(cmd: Command): FakeElement {
    return renderWithFakeDom(() => renderCommandPreview(cmd));
  }

  function m2(commandId: string, fields: Record<string, string | number | boolean>): Command {
    const command = newM2Command(commandId);
    if (command.kind !== "m2Command") throw new Error(`expected m2Command: ${commandId}`);
    return { ...command, fields: { ...command.fields, ...fields } };
  }

  it("stages Screen Effect on the shared play stage instead of a token summary card", () => {
    withProject(() => {
      const root = preview(m2("m2-202-screen-effect", { effect: "tint", value: "#ff0000", durationMs: 600 }));

      const stage = findByTestId(root, "ecp-screen-effect-stage");
      expect(stage).toBeTruthy();
      expect(findByTestId(root, "ecp-screen-effect-scene")).toBeTruthy();
      expect(findByTestId(root, "ecp-screen-effect-overlay")).toBeTruthy();
      expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
      expect(findByTestId(root, "ecp-runtime-effect")).toBeNull();
    });
  });

  it("moves legacy RM screen rows onto the same stage as the modern one", () => {
    withProject(() => {
      // 색조·플래시·숨기기·표시·날씨 효과 — 전부 토큰 카드가 아니다.
      for (const [commandId, fields, effect] of [
        ["m2-046-tint-screen", { color: "red", value: "", duration: 30 }, "tint"],
        ["m2-047-flash-screen", { color: "white", durationMs: 300 }, "flash"],
        ["m2-044-hide-screen", {}, "fadeOut"],
        ["m2-045-show-screen", {}, "fadeIn"],
        ["m2-050-set-weather-effects", { value: "rain", intensity: 0.8, transitionMs: 400 }, "weather"],
      ] as const) {
        const root = preview(m2(commandId, fields));
        const stage = findByTestId(root, "ecp-screen-effect-stage");
        expect(stage, commandId).toBeTruthy();
        expect(stage?.dataset.effect, commandId).toBe(effect);
        expect(findByTestId(root, "ecp-screen-effect-overlay"), commandId).toBeTruthy();
        expect(root.querySelectorAll(".ecp-summary-card"), commandId).toHaveLength(0);
      }
    });
  });

  it("reads the legacy tint colour instead of guessing one", () => {
    withProject(() => {
      const red = findByTestId(preview(m2("m2-046-tint-screen", { color: "red", value: "" })), "ecp-screen-effect-overlay");
      const blue = findByTestId(preview(m2("m2-046-tint-screen", { color: "blue", value: "" })), "ecp-screen-effect-overlay");

      expect(red?.style.background).toContain("255,0,0");
      expect(blue?.style.background).toContain("0,0,255");
    });
  });

  it("draws the camera viewport moving to its target", () => {
    withProject(() => {
      const root = preview(m2("m2-201-camera-control", { mode: "panTo", target: "screen", x: 6, y: 3, zoom: 2, durationMs: 500 }));

      const stage = findByTestId(root, "ecp-camera-stage");
      expect(stage?.dataset.mode).toBe("pan");
      expect(stage?.dataset.zoom).toBe("2");
      expect(stage?.dataset.target).toBe("(6, 3)");
      expect(findByTestId(root, "ecp-camera-canvas-1")?.tagName).toBe("CANVAS");
      expect(findByTestId(root, "ecp-camera-frame-0")?.dataset.zoom).toBe("1");
      expect(findByTestId(root, "ecp-camera-frame-2")?.dataset.zoom).toBe("2");
      expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
      expect(findByTestId(root, "ecp-camera-caption")?.textContent).toContain("500ms");
    });
  });


  it("shows a chipset crop and a neighbour palette for 지형 변경", () => {
    withProject(() => {
      const project = store.getCurrent();
      const command = newCommand("changeTile");
      expect(command.kind).toBe("changeTile");
      if (command.kind !== "changeTile") return;
      const root = preview({ ...command, mapId: project.startMapId, x: 3, y: 4, tile: 12, layer: "upper" });

      const stage = findByTestId(root, "ecp-tile-chipsel");
      expect(stage?.dataset.tile).toBe("12");
      expect(stage?.dataset.tileset).toBeTruthy();
      const chip = findByTestId(root, "ecp-tile-chip-selected");
      // 칩셋 이미지를 직접 크롭해 보여 준다 — 색 상자나 숫자 스와치가 아니다.
      expect(chip?.style.backgroundImage ?? "").toContain("url(");
      expect(chip?.style.backgroundPosition ?? "").toMatch(/^-\d+(\.\d+)?px -\d+(\.\d+)?px$/);
      expect(findByTestId(root, "ecp-tile-chip-strip")?.childNodes.length).toBeGreaterThanOrEqual(4);
      expect(findByTestId(root, "ecp-tile-chipsel-title")?.textContent).toContain("그림 12");
      expect(root.textContent).toContain("상위");
      // 번호 스와치 폴백이 아니다.
      expect(root.querySelectorAll(".ecp-tile-swatch")).toHaveLength(0);
      expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
    });
  });

  it("marks a negative tile as clearing the cell", () => {
    withProject(() => {
      const project = store.getCurrent();
      const root = preview({ kind: "changeTile", mapId: project.startMapId, layer: "lower", x: 1, y: 1, tile: -1 });

      expect(findByTestId(root, "ecp-tile-chip-selected")?.dataset.tile).toBe("-1");
      expect(findByTestId(root, "ecp-tile-chipsel-title")?.textContent).toContain("비웁니다");
    });
  });
});
