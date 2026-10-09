// 컴포저 액션 행의 "방금 적용한 AI 변경 되돌리기" 버튼.
//
// 이 버튼은 걷어낸 `ai-completion-strip`(맵 위에 fixed 로 떠 있던 요약 + 되돌리기 밴드)의
// 유일한 실기능 후계자다. 밴드가 들고 있던 요약 문장은 변경 카드 제목이 같은 소스
// (proposalHumanSummaryLine)로 이미 보여주고 있었고, 밴드 쪽 팔레트만 어긋나 있었다.
// 계약: 되돌릴 AI 체크포인트가 히스토리 top 일 때만 존재하고, 그 외에는 행에서 빠진다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishAiApplyCompletion } from "@/editor/aiApplyCompletion";
import { editorState } from "@/editor/editorState";
import {
  getMapEditHistoryEntries,
  getMapEditHistoryState,
  recordProjectSnapshot,
  resetMapEditHistory,
} from "@/editor/mapEditHistory";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

function installFakeLocalStorage(): void {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  editorState.set({
    currentMapId: store.getCurrent().startMapId,
    layer: "lower",
    tool: "paint",
    selection: null,
    chatDock: "float",
  });
});

afterEach(() => {
  teardownAiChatPanel(); // 완료 스토어(모듈 싱글턴)를 비워 다음 케이스로 새지 않게 한다.
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

function renderPanel(): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel({}));
}

/** 히스토리 스냅샷 서명이 갈라지도록 맵을 실제로 바꾼다(같은 상태는 push 되지 않는다). */
function editFirstTile(tile: number): void {
  const project = store.getCurrent();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  if (!map) throw new Error("start map missing");
  const lowerTiles = [...map.lowerTiles];
  lowerTiles[0] = tile;
  store.replace({ ...project, maps: { ...project.maps, [mapId]: { ...map, lowerTiles } } });
}

function publishApplied(summary: string): void {
  publishAiApplyCompletion({
    mapId: store.getCurrent().startMapId,
    instruction: "마을에 대장간 하나",
    summary,
  });
}

describe("컴포저 되돌리기 버튼", () => {
  it("컴포저 액션 행에 살고, 적용 전에는 행에서 빠져 있다", () => {
    const panel = renderPanel();
    const undo = findByTestId(panel, "ai-composer-undo");
    if (!undo) throw new Error("composer undo button missing");

    expect(undo.textContent).toContain("되돌리기");
    expect(undo.hidden).toBe(true);
    expect(undo.getAttribute("aria-hidden")).toBe("true");
    expect(undo.closest("[data-testid=ai-composer-actions]")).toBeTruthy();
  });

  it("걷어낸 완료 스트립 표면은 어디에도 남지 않는다", () => {
    const panel = renderPanel();

    expect(findByTestId(panel, "ai-completion-host")).toBeNull();
    expect(findByTestId(panel, "ai-completion-strip")).toBeNull();
    expect(findByTestId(panel, "ai-completion-undo")).toBeNull();
  });

  it("AI 적용이 발행되면 드러나고 요약을 툴팁에 싣는다", () => {
    recordProjectSnapshot("AI 적용", store.getCurrent().startMapId);
    const panel = renderPanel();
    publishApplied("집 1 · 길 12칸");

    const undo = findByTestId(panel, "ai-composer-undo");
    expect(undo?.hidden).toBe(false);
    expect(undo?.getAttribute("aria-hidden")).toBe("false");
    expect(undo?.getAttribute("title")).toContain("집 1 · 길 12칸");
  });

  it("누르면 그 변경을 되돌리고 버튼은 다시 사라진다", () => {
    recordProjectSnapshot("AI 적용", store.getCurrent().startMapId);
    const panel = renderPanel();
    publishApplied("타일 4");
    const undo = findByTestId(panel, "ai-composer-undo");
    expect(undo?.hidden).toBe(false);

    undo?.click();

    expect(getMapEditHistoryState().canUndo).toBe(false);
    expect(undo?.hidden).toBe(true);
  });

  it("AI 체크포인트가 히스토리 top 이 아니면 눌러도 되돌리지 않는다", () => {
    recordProjectSnapshot("AI 적용", store.getCurrent().startMapId);
    const panel = renderPanel();
    publishApplied("타일 4");
    // 사용자가 직접 편집해 AI 체크포인트를 top 에서 밀어냈다.
    editFirstTile(7);
    recordProjectSnapshot("사용자 편집", store.getCurrent().startMapId);
    const before = getMapEditHistoryEntries().length;
    expect(before).toBe(2);

    const undo = findByTestId(panel, "ai-composer-undo");
    undo?.click();

    expect(getMapEditHistoryEntries().length).toBe(before);
    expect(undo?.hidden).toBe(true);
  });
});
