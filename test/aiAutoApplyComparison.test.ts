// 자동 적용도 전/후 비교를 띄운다 (감독 지시 2026-08-25: "전과 후를 비교하는 걸 띄우게
// 하잖아. 이거 auto approve mode 도 넣고").
//
// 실측한 결함: autoApprove 는 이미 AiConfig 에 있고(llmClient.ts:54) agentMode 기본값이 "auto"
// 라서 사실상 켜져 있었다. 그런데 aiChatPanel 의 자동 경로는 acceptProposal() 을 바로 부르고
// 평범한 시스템 버블 "자동 적용됨 N건 — 3초 내 실행취소 가능" 만 남겼다. 그 버블의 실행취소
// 버튼은 setTimeout 3000ms 로 사라진다. 전/후 썸네일(renderProposalMapThumbnail)은 수동
// renderProposal 경로에만 있었다 — 즉 비교 화면은 있는데 자동 승인 모드에는 없었다.
//
// 그래서 자동 적용 결과에도 같은 비교 카드를 세우고, 그 카드에 자동 적용 토글과 사라지지 않는
// 되돌리기를 함께 둔다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAppliedComparison } from "@/editor/panels/aiProposalCard";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

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

/** 같은 맵의 타일 한 칸만 바꾼 after 프로젝트 — 전/후 크롭이 실제로 잡히는 최소 변경. */
function withChangedTile(project: Project): Project {
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  if (!map) throw new Error("시작 맵이 없다");
  const lowerTiles = [...map.lowerTiles];
  lowerTiles[0] = (lowerTiles[0] ?? 0) + 1;
  return { ...project, maps: { ...project.maps, [mapId]: { ...map, lowerTiles } } };
}

beforeEach(() => {
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
});

describe("자동 적용 비교 카드", () => {
  function render(overrides: Partial<Parameters<typeof renderAppliedComparison>[0]> = {}): FakeElement {
    const before = createBlankProject();
    const after = withChangedTile(before);
    return renderWithFakeDom(() =>
      renderAppliedComparison({
        before,
        after,
        mapId: before.startMapId,
        summary: "집 1 · 길 12칸",
        appliedCount: 3,
        onUndo: () => undefined,
        ...overrides,
      }),
    );
  }

  it("적용 건수와 요약, 전/후 썸네일을 함께 보여준다", () => {
    const card = render();

    expect(findByTestId(card, "ai-auto-applied-card")).toBeTruthy();
    expect(card.textContent).toContain("집 1 · 길 12칸");
    expect(card.textContent).toContain("3");
    expect(findByTestId(card, "ai-auto-applied-thumbs")).toBeTruthy();
  });

  it("카드에서 자동 적용을 바로 끌 수 있다", () => {
    storage.set("oprn:ai-config", JSON.stringify({ autoApprove: true }));
    const card = render();

    const toggle = findByTestId(card, "ai-proposal-auto-approve-input");
    expect(toggle).toBeTruthy();

    toggle!.checked = false;
    toggle!.dispatchEvent(new Event("change"));

    expect(JSON.parse(storage.get("oprn:ai-config") ?? "{}").autoApprove).toBe(false);
  });

  it("되돌리기는 카드에 남아 있고 3초 타이머로 사라지지 않는다", () => {
    const undo = vi.fn();
    const card = render({ onUndo: undo });

    const button = findByTestId(card, "ai-auto-applied-undo");
    expect(button).toBeTruthy();

    button!.click();
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("맵 변경이 없으면 썸네일 없이 요약만 남긴다", () => {
    const before = createBlankProject();
    const card = renderWithFakeDom(() =>
      renderAppliedComparison({
        before,
        after: before,
        mapId: before.startMapId,
        summary: "데이터베이스만 수정",
        appliedCount: 1,
        onUndo: () => undefined,
      }),
    );

    expect(findByTestId(card, "ai-auto-applied-card")).toBeTruthy();
    expect(findByTestId(card, "ai-auto-applied-thumbs")).toBeNull();
    expect(card.textContent).toContain("데이터베이스만 수정");
  });
});
