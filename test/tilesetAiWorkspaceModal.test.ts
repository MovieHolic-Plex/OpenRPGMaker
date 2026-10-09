// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import {
  closeTilesetAiWorkspace,
  isTilesetAiWorkspaceOpen,
  openTilesetAiWorkspace,
} from "@/editor/panels/tilesetAiWorkspaceModal";
import { renderTilesetsTab } from "@/editor/panels/tilesetSettingsPanel";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import {
  resetTilesetAiReviewSessions,
  runTilesetAiReview,
  setTilesetAiReviewAnalyzer,
} from "@/editor/tilesetAiNativeReviewSession";
import { tilesetKnowledgeFingerprint } from "@/editor/tilesetAiNativeAnalysis";
import { resetTilesetAiConversation } from "@/editor/tilesetAiConversationSession";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { fieldByTestId as findByTestId, mountField as renderWithFakeDom } from "./helpers/aiTestSignals";
type FakeElement = HTMLElement;
function installFakeDom(): () => void {
  document.body.replaceChildren();
  return () => document.body.replaceChildren();
}

let cleanupDom: (() => void) | null = null;
let tilesetId = "";

function currentTileset(): TilesetDef {
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) throw new Error("missing tileset fixture");
  return tileset;
}

function fakeAnalyzer(): void {
  setTilesetAiReviewAnalyzer(async (tileset, feedback) => {
    const columns = tileset.tilesPerRow;
    return {
      kind: "success",
      rawAnswer: "{}",
      review: {
      fingerprint: tilesetKnowledgeFingerprint(tileset),
      proposals: [
        {
          cellLayers: null,
          confidence: 0.96,
          description: "cliff",
          evidence: "cliff pattern",
          feedback: feedback.join(" "),
          id: "cliff",
          name: "반복 절벽",
          passage: { down: false, left: false, right: false, up: false },
          placementRules: "",
          question: "절벽이 맞나요?",
          quickReplies: ["맞아"],
          status: "pending",
          template: "repeatable-cliff-2x3",
          tileIds: [0, 1, columns, columns + 1, columns * 2, columns * 2 + 1],
        },
        {
          cellLayers: null,
          confidence: 0.42,
          description: "desk",
          evidence: "desk pattern",
          feedback: "",
          id: "desk",
          name: "미확인 가구",
          passage: { down: false, left: false, right: false, up: false },
          placementRules: "",
          question: "책상인가요?",
          quickReplies: ["책상", "선반"],
          status: "pending",
          template: "desk",
          tileIds: [3, 4],
        },
      ],
      summary: "two proposals",
      warnings: [],
      },
    };
  });
}

describe("AI tileset workspace entry", () => {
  beforeEach(() => {
    cleanupDom = installFakeDom();
    const project = createBlankProject();
    tilesetId = Object.keys(project.tilesets)[0] ?? "";
    const tileset = project.tilesets[tilesetId];
    if (!tileset) throw new Error("missing tileset fixture");
    tileset.tileGroups = [];
    store.replace(project);
    resetTilesetAiReviewSessions();
    resetTilesetAiConversation();
  });

  afterEach(() => {
    closeTilesetAiWorkspace();
    setTilesetAiReviewAnalyzer(null);
    resetTilesetAiReviewSessions();
    resetTilesetAiConversation();
    cleanupDom?.();
    cleanupDom = null;
  });

  it("keeps the human knowledge editor visible without an inline AI inbox", () => {
    // Given / When
    const panel = renderWithFakeDom(() => renderTileGroupPanel(currentTileset(), () => undefined));

    // Then
    expect(findByTestId(panel, "tileset-knowledge-template-water-autotile-3x3")).not.toBeNull();
    expect(findByTestId(panel, "tileset-ai-review-inbox")).toBeNull();
    expect(findByTestId(panel, "tileset-ai-review-manual")).toBeNull();
  });

  it("retires the separate AI launcher and exposes reference documents in the tile library", () => {
    const editor = renderWithFakeDom(() => renderTilesetEditor(currentTileset(), () => undefined));
    expect(findByTestId(editor, "tileset-ai-workspace-open")).toBeNull();

    const host = renderWithFakeDom(() => {
      const root = document.createElement("div");
      renderTilesetsTab(root, () => undefined);
      return root;
    });
    expect(findByTestId(host, "tileset-ai-workspace-open")).toBeNull();
    expect(findByTestId(host, "tileset-section-tab-references")?.textContent).toBe("AI 참고문서");
  });
});

describe("AI tileset workspace three-step flow", () => {
  beforeEach(() => {
    cleanupDom = installFakeDom();
    const project = createBlankProject();
    tilesetId = Object.keys(project.tilesets)[0] ?? "";
    const tileset = project.tilesets[tilesetId];
    if (!tileset) throw new Error("missing tileset fixture");
    tileset.tileGroups = [];
    store.replace(project);
    resetTilesetAiReviewSessions();
    resetTilesetAiConversation();
    fakeAnalyzer();
  });

  afterEach(() => {
    closeTilesetAiWorkspace();
    setTilesetAiReviewAnalyzer(null);
    resetTilesetAiReviewSessions();
    resetTilesetAiConversation();
    cleanupDom?.();
    cleanupDom = null;
  });

  it("starts on the analyze step and moves to questions once analysis lands", async () => {
    // Given
    openTilesetAiWorkspace(tilesetId);
    const host = document.body.querySelector("[data-testid='tileset-ai-workspace-host']");
    expect(host).not.toBeNull();

    // When — land the analysis, then observe the natural step on a fresh open
    await runTilesetAiReview(currentTileset(), () => undefined);
    closeTilesetAiWorkspace();
    openTilesetAiWorkspace(tilesetId);

    // Then — natural step after analysis is questions
    const body = document.body as unknown as FakeElement;
    const workspace = findByTestId(body, "tileset-ai-workspace");
    expect(workspace?.dataset.step).toBe("questions");
    expect(findByTestId(body, "tileset-ai-workspace-step-questions")?.classList.contains("current")).toBe(true);
  });

  it("shows the summary step with a confirmed list and applies to the project", async () => {
    // Given
    await runTilesetAiReview(currentTileset(), () => undefined);
    openTilesetAiWorkspace(tilesetId);
    const body = document.body as unknown as FakeElement;
    const toSummary = findByTestId(body, "tileset-ai-workspace-to-summary");
    expect(toSummary).not.toBeNull();

    // When — skip remaining questions, go to summary
    toSummary?.click();
    const workspace = findByTestId(body, "tileset-ai-workspace");
    expect(workspace?.dataset.step).toBe("summary");
    expect(findByTestId(body, "tileset-ai-summary-item-cliff")).not.toBeNull();

    const apply = findByTestId(body, "tileset-ai-workspace-apply");
    expect(apply?.textContent).toContain("확정된 1개 적용");
    apply?.click();

    // Then
    expect(currentTileset().tileGroups?.map((group) => group.name)).toEqual(["반복 절벽"]);
    expect(findByTestId(body, "tileset-ai-workspace-apply")?.textContent).toContain("적용됨");
    expect(isTilesetAiWorkspaceOpen()).toBe(true);
  });
});
