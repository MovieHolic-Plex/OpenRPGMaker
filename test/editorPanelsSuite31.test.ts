// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import { closeTilesetAiWorkspace, isTilesetAiWorkspaceOpen, openTilesetAiWorkspace } from "@/editor/panels/tilesetAiWorkspaceModal";
import { renderTilesetsTab } from "@/editor/panels/tilesetSettingsPanel";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { resetTilesetAiReviewSessions, runTilesetAiReview, setTilesetAiReviewAnalyzer } from "@/editor/tilesetAiNativeReviewSession";
import { tilesetKnowledgeFingerprint } from "@/editor/tilesetAiNativeAnalysis";
import { resetTilesetAiConversation } from "@/editor/tilesetAiConversationSession";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { TilesetDef, EnemyRecord } from "@/project/types";
import { fieldByTestId as findByTestId, mountField as renderWithFakeDom } from "./helpers/aiTestSignals";
import { walkField, walkSelect, walkGroupComposition } from "@/editor/panels/walkEncounterOptions";
import { renderEnemyRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import { battleEventCommandRuntimeSupport, m2CommandRuntimeClassification } from "@/project/eventCommands/runtimeSupport";
import { isolateTimers } from "./mergedTeardown";

describe("tilesetAiWorkspaceModal", () => {
  isolateTimers();
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
});

describe("zz-qa-fixes", () => {
  isolateTimers();
  describe("walkEncounterOptions", () => {
    isolateTimers();
    it("keeps unnamed authored records selectable with a visible identifier", () => {
      const select = walkSelect([{ id: "var_0001", name: "" }], "var_0001", () => undefined);
      expect(select.options[0]?.textContent?.trim()).not.toBe("");
      expect(select.value).toBe("var_0001");
    });
    it("assigns the field name explicitly without incorporating its option labels", () => {
      const select = walkSelect([{ id: "a", name: "option-a" }], "a", () => undefined);
      const field = walkField("field-a", select);
      expect(select.getAttribute("aria-label")).toBe(field.querySelector("span")?.textContent);
    });
    it("counts repeated and hidden authored members instead of using the legacy enemy list", () => {
      const strip = walkGroupComposition({ id: "group", name: "Group", enemyIds: ["wrong"], autoAlign: false, battleEventPages: [], members: [
        { enemyId: "a", x: 0, y: 0 }, { enemyId: "a", x: 1, y: 1, hidden: true }, { enemyId: "b", x: 2, y: 2 },
      ] });
      expect(Array.from(strip.children).map((child) => ({ ...(child as HTMLElement).dataset }))).toEqual([
        { enemyId: "a", count: "2", hiddenCount: "1" }, { enemyId: "b", count: "1", hiddenCount: "0" },
      ]);
    });
    it("counts legacy enemyIds when no formation was authored and preserves an empty authored formation", () => {
      const troop = { id: "group", name: "Group", enemyIds: ["a", "a"], autoAlign: true, battleEventPages: [] };
      expect(walkGroupComposition(troop).querySelector<HTMLElement>("[data-enemy-id=a]")?.dataset.count).toBe("2");
      expect(walkGroupComposition({ ...troop, members: [] }).querySelector("[data-enemy-id]")).toBeNull();
    });
  });
  // Adversarial unit checks for fixes 3/4/5 (temp QA file — delete after run).
  describe("zz-qa-fixes", () => {
    isolateTimers();
    function enemyWith(resourceId: string | undefined): EnemyRecord {
      return {
        id: "enemy_qa",
        name: "QA",
        monsterResourceId: resourceId,
        stats: { maxHp: 1, maxMp: 0, attack: 1, defense: 1, mind: 1, agility: 1 },
        rewards: { exp: 0, gold: 0 },
        actions: [],
        stateRates: {},
      } as unknown as EnemyRecord;
    }
    describe("fix 3: m2-109-result-summary classification", () => {
      it("does not throw and classifies as editor-only in troop context", () => {
        expect(() => m2CommandRuntimeClassification("m2-109-result-summary")).not.toThrow();
        const support = battleEventCommandRuntimeSupport({ kind: "m2Command", commandId: "m2-109-result-summary", fields: {} });
        expect(support).toBe("editor-only");
      });

      it("every persisted m2 id used by the troop panel is classifiable (no crash path)", () => {
        for (const id of ["m2-101-enemy-encounter", "m2-102-change-battleback", "m2-109-result-summary"]) {
          expect(() => battleEventCommandRuntimeSupport({ kind: "m2Command", commandId: id, fields: {} }), id).not.toThrow();
        }
      });
    });
    describe("fix 4: generated-resource preview slot", () => {
      it("renders a neutral slot with no button for generated- resources", () => {
        const form = document.createElement("div");
        renderEnemyRecordForm(form, enemyWith("generated-qa-monster"));
        const slot = form.querySelector(".db-neutral-resource-slot.generated");
        expect(slot).not.toBeNull();
        expect(slot!.querySelector("button")).toBeNull();
      });

      it("empty resource renders an empty neutral slot, also buttonless", () => {
        const form = document.createElement("div");
        renderEnemyRecordForm(form, enemyWith(undefined));
        const slot = form.querySelector(".db-neutral-resource-slot.empty");
        expect(slot).not.toBeNull();
        expect(slot!.querySelector("button")).toBeNull();
      });
    });
  });
});
