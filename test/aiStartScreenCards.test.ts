import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { installFakeDom, findByTestId, renderWithFakeDom } from "./fakeDom";
import {
  AI_AUTHORING_EXAMPLES,
  buildAiAuthoringExamples,
  defaultAiVisualStartPrompts,
} from "@/editor/panels/aiStartScreenCards";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  const storage = new Map<string, string>();
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
  const mapId = store.getCurrent().startMapId;
  editorState.set({
    currentMapId: mapId,
    layer: "lower",
    tool: "paint",
    selection: null,
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

// ── 삭제한 describe 3개 ──────────────────────────────────────────────────────
//   formatRelativeTime · summarizeActivityResult · buildTryRegionCard
//
// 셋 다 대기화면 카드(빠른 예시 · 최근 작업)의 부품이었다. 카드 표면이 폐기되면서 함수도
// 함께 사라졌다 — 남은 것은 "무엇을 만들 수 있는지 알려주는 문구" 뿐이고, 그 일은 컴포저
// 추천 칩이 한다.

describe("buildAiAuthoringExamples", () => {
  it("길·NPC·상점·상자·집·퀘스트 예제를 빠짐없이 제공하고 클릭한 문장을 넘긴다", () => {
    expect(new Set(AI_AUTHORING_EXAMPLES.map((example) => example.kind))).toEqual(
      new Set(["road", "npc", "shop", "chest", "house", "quest"]),
    );
    const picked: Array<{ instruction: string; id: string }> = [];
    const examples = renderWithFakeDom(() =>
      buildAiAuthoringExamples({
        onPick: (instruction, id) => picked.push({ instruction, id }),
      }),
    );

    expect(findByTestId(examples, "ai-authoring-examples")).not.toBeNull();
    expect(examples.querySelectorAll("button")).toHaveLength(6);
    findByTestId(examples, "ai-authoring-example-shop")!.click();
    expect(picked).toEqual([
      {
        id: "shop",
        instruction: AI_AUTHORING_EXAMPLES.find((example) => example.id === "shop")!.instruction,
      },
    ]);
  });
});

// ── 삭제한 describe 2개 ──────────────────────────────────────────────────────
//   buildRecentAiWorkCard · buildVisualStartGallery
//
// 최근 작업 카드와 5열 비주얼 갤러리. 둘 다 대기화면이었고 폐기됐다(스펙 §3) — 갤러리가
// 쓰던 타일 모자이크 배열 ~80줄도 함께 지웠다. 아래는 그 둘이 지키려던 것 중 살아남은 부분:
// 부팅 빈 면에 카드가 아니라 **추천 칩**이 온다.
describe("부팅 빈 면", () => {
  it("대기화면 카드 대신 추천 칩 3개를 세운다", () => {
    const panel = renderWithFakeDom(() => renderAiChatPanel());
    const chips = findByTestId(panel, "ai-composer-chips");

    expect(findByTestId(panel, "ai-start-visual-gallery")).toBeNull();
    expect(findByTestId(panel, "ai-start-recent-work")).toBeNull();
    expect(findByTestId(panel, "ai-empty-cta")).toBeNull();
    expect(chips?.querySelectorAll("button").length).toBe(3);
    expect(chips?.hidden).toBe(false);
    expect(defaultAiVisualStartPrompts().length).toBeGreaterThanOrEqual(3);
  });
});
