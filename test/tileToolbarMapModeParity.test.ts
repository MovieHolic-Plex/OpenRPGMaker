/** @vitest-environment happy-dom */
/**
 * 맵 모드 도구(집기·밀기·통행·장면)를 고르는 네 경로가 같은 상태 계약을 지켜야 한다.
 *
 * 회귀 배경(2026-08-27 좌측 사이드바 적대적 리뷰 §5, 브라우저 실측):
 * 표준/전문가 도구막대의 「장면 놓기」는 `editorState.set({ tool })` 만 해서 레이어를 바꾸지
 * 않았다. 같은 이름의 버튼이 초보 레일(basicLeftRail)과 단축키 N 에서는 레이어까지 이벤트로
 * 바꾸므로, 사용자는 같은 버튼을 눌러도 모드에 따라 다른 결과를 얻었다.
 * 실측 증거: .omo/evidence/left-sidebar-repair/before-standard-contract.json
 *   → parity.layerBeforeEventTool "바닥" / toolAfterEventClick "event" / layerAfterEventToolClick "바닥"
 * 또한 도구막대 경로만 activePaletteStamp 와 selection 을 남겨 두어, 사이드바가 보여 주는
 * 타일과 실제로 찍히는 타일이 갈렸다.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { selectEyedropperTool, selectMapModeTool } from "@/editor/panels/tileToolbarActions";
import { handleEditorKey } from "@/editor/hotkeys";

beforeEach(() => {
  editorState.set({
    activePaletteStamp: null,
    layer: "lower",
    paintShape: "pen",
    selection: null,
    tool: "paint",
  });
});

const STAMP = {
  cells: [{ dx: 0, dy: 0, layer: "lower", tile: 7 }],
  height: 1,
  source: { endTile: 7, startTile: 7 },
  width: 1,
} as const;
const SELECTION = { height: 2, mapId: "map-1", width: 2, x: 1, y: 1 } as const;

describe("selectMapModeTool", () => {
  it("장면 놓기는 레이어까지 이벤트로 바꾼다 (레일·단축키 N 과 동일 계약)", () => {
    selectMapModeTool("event");
    expect(editorState.get().tool).toBe("event");
    expect(editorState.get().layer).toBe("event");
  });

  it("장면 외 맵 모드 도구는 이벤트 레이어에서 바닥으로 탈출한다", () => {
    editorState.set({ layer: "event", tool: "event" });
    selectMapModeTool("collision");
    expect(editorState.get().tool).toBe("collision");
    expect(editorState.get().layer).toBe("lower");
  });

  it("이벤트 레이어가 아니면 레이어를 건드리지 않는다", () => {
    editorState.set({ layer: "upper" });
    selectMapModeTool("pan");
    expect(editorState.get().layer).toBe("upper");
  });

  it("무장된 팔레트 스탬프와 선택 영역을 정리한다 (사이드바 표시와 실제 결과의 괴리 차단)", () => {
    editorState.set({ activePaletteStamp: STAMP, selection: SELECTION });
    selectMapModeTool("collision");
    expect(editorState.get().activePaletteStamp).toBeNull();
    expect(editorState.get().selection).toBeNull();
  });

  it("집기 진입점은 맵 모드 계약을 그대로 재사용한다", () => {
    editorState.set({ activePaletteStamp: STAMP, layer: "event" });
    selectEyedropperTool();
    expect(editorState.get().tool).toBe("eyedropper");
    expect(editorState.get().layer).toBe("lower");
    expect(editorState.get().activePaletteStamp).toBeNull();
  });
});

describe("경로 간 패리티", () => {
  function press(key: string): void {
    handleEditorKey(new KeyboardEvent("keydown", { key, cancelable: true }));
  }

  it("단축키 N 과 도구막대 장면 놓기가 같은 tool·layer 를 만든다", () => {
    press("n");
    const viaHotkey = { layer: editorState.get().layer, tool: editorState.get().tool };
    editorState.set({ layer: "lower", tool: "paint" });
    selectMapModeTool("event");
    expect({ layer: editorState.get().layer, tool: editorState.get().tool }).toEqual(viaHotkey);
  });

  it("단축키 6(통행)과 도구막대 통행 표시가 같은 tool·layer 를 만든다", () => {
    editorState.set({ layer: "event", tool: "event" });
    press("6");
    const viaHotkey = { layer: editorState.get().layer, tool: editorState.get().tool };
    editorState.set({ layer: "event", tool: "event" });
    selectMapModeTool("collision");
    expect({ layer: editorState.get().layer, tool: editorState.get().tool }).toEqual(viaHotkey);
  });
});
