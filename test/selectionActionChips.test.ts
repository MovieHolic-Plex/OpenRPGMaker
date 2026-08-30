import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderSelectionActionChips,
  SELECTION_CHIP_PRESETS,
} from "@/editor/selectionActionChips";
import {
  anchoredBuildPalettePosition,
  anchoredSelectionChipsPosition,
} from "@/editor/selectionOverlayAnchor";
import type { AiSelectionContextRequest } from "@/editor/aiSelectionContext";
import type { TileSelection } from "@/editor/editorState";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

/** clearSelectionRegion 호출 기록 — 확인 단계가 실제로 지우기를 막는지 보려면 호출을 봐야 한다. */
const clearCalls: string[] = [];
vi.mock("@/editor/mapClipboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/editor/mapClipboard")>();
  return {
    ...actual,
    clearSelectionRegion: (mapId: string) => { clearCalls.push(mapId); },
  };
});

const SELECTION: TileSelection = { mapId: "map-1", x: 3, y: 4, width: 5, height: 6 };

// 실행체 통합 후: 칩은 팝오버를 열지 않고 조수 브리지 이벤트 하나만 쏜다.
type AssistantCall = { readonly selection: TileSelection | null; readonly request: AiSelectionContextRequest };

describe("renderSelectionActionChips", () => {
  let restore: () => void;
  beforeEach(() => { restore = installFakeDom(); });
  afterEach(() => { restore(); });

  it("AI 칩 1개를 렌더하고 클릭 시 선택을 조수 스코프로 넘긴다", () => {
    const calls: AssistantCall[] = [];
    const stub = ((selection: TileSelection | null, request: AiSelectionContextRequest) => {
      calls.push({ selection, request });
    }) as never;
    const bar = renderSelectionActionChips(SELECTION, stub);
    document.body.append(bar);
    expect(findByTestId(document.body as unknown as FakeElement, "selection-action-chips")).toBeTruthy();
    for (const preset of SELECTION_CHIP_PRESETS) {
      expect(findByTestId(document.body as unknown as FakeElement, `selection-chip-${preset.id}`)).toBeTruthy();
    }
    (findByTestId(document.body as unknown as FakeElement, "selection-chip-ai") as unknown as HTMLElement).click();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.selection).toEqual(SELECTION);
    // 포커스는 준다(사용자가 바로 타이핑). instruction=null 프리셋이므로 자동 전송은 없다.
    expect(calls[0]?.request.focus).toBe(true);
    expect(calls[0]?.request.instruction).toBeUndefined();
    expect(calls[0]?.request.autoRun).toBeUndefined();
  });
});

describe("지우기 확인 (넓은 영역)", () => {
  let restore: () => void;
  beforeEach(() => { restore = installFakeDom(); clearCalls.length = 0; });
  afterEach(() => { restore(); });

  const stub = (() => undefined) as never;

  it("48칸 선택은 첫 클릭에 확인으로 바뀌고 지우지 않는다", () => {
    // 되돌리기가 있어도 8×6 이 한 번의 오클릭으로 사라지면 무엇이 사라졌는지 알아보기 어렵다.
    const bar = renderSelectionActionChips({ mapId: "map-1", x: 0, y: 0, width: 8, height: 6 }, stub);
    document.body.append(bar);
    const button = findByTestId(document.body as unknown as FakeElement, "selection-chip-clear") as unknown as HTMLElement;
    button.click();
    expect(clearCalls).toHaveLength(0);
    expect(button.textContent).toContain("48칸");
    button.click();
    expect(clearCalls).toEqual(["map-1"]);
  });

  it("작은 영역(12칸 이하)은 예전처럼 한 번에 지운다", () => {
    const bar = renderSelectionActionChips({ mapId: "map-1", x: 0, y: 0, width: 3, height: 4 }, stub);
    document.body.append(bar);
    const button = findByTestId(document.body as unknown as FakeElement, "selection-chip-clear") as unknown as HTMLElement;
    button.click();
    expect(clearCalls).toEqual(["map-1"]);
  });
});

describe("anchoredSelectionChipsPosition", () => {
  const popupSize = { width: 220, height: 36 };
  const canvasSize = { width: 800, height: 600 };
  const selectionRect = { x: 100, y: 80, width: 160, height: 96 };

  it("포인터가 있으면 놓은 점 아래에 띄운다 (context-menu 느낌)", () => {
    const point = anchoredSelectionChipsPosition({
      selectionRect,
      popupSize,
      canvasSize,
      pointer: { x: 400, y: 300 },
    });
    expect(point.x).toBe(400 - 220 / 2);
    expect(point.y).toBe(300 + 16);
  });

  it("포인터 아래가 캔버스를 넘치면 위로 flip 한다", () => {
    const point = anchoredSelectionChipsPosition({
      selectionRect,
      popupSize,
      canvasSize,
      pointer: { x: 400, y: 590 },
    });
    expect(point.y).toBe(590 - 36 - 16);
  });

  it("포인터가 없으면 선택 rect 우측에 세로 중앙", () => {
    const point = anchoredSelectionChipsPosition({
      selectionRect,
      popupSize,
      canvasSize,
    });
    expect(point.x).toBe(100 + 160 + 8);
    expect(point.y).toBe(80 + 96 / 2 - 36 / 2);
  });

  it("팝업이 캔버스보다 커도 패딩 밖으로 나가지 않는다", () => {
    const point = anchoredSelectionChipsPosition({
      selectionRect,
      popupSize: { width: 900, height: 700 },
      canvasSize,
      pointer: { x: 400, y: 300 },
    });
    expect(point.x).toBe(8);
    expect(point.y).toBe(8);
  });

  it("건축 팔레트는 여전히 선택 우측 배치", () => {
    const build = anchoredBuildPalettePosition({
      selectionRect,
      popupSize: { width: 228, height: 140 },
      canvasSize,
    });
    expect(build.x).toBe(100 + 160 + 8);
  });
});
