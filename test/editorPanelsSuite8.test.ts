import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { battlePanel } from "@/editor/panels/actorRecordBattlePanels";
import { createBlankProject, createBlankMap } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { assistantIdleHints, directorStartPrompts, formatComposerPlaceholder, idlePresenceLine, nextStepHint, readAgentBrief } from "@/editor/panels/aiAgentBrief";
import { editorState } from "@/editor/editorState";
import { buildEditorReferenceIndex, type EditorReferenceIndex, type EditorReferenceTarget } from "@/editor/aiAnswerLinks";
import { decorateEditorReferences, renderAssistantAnswer } from "@/editor/panels/aiAnswerLinkRender";
import type { Project } from "@/project/types";
import { renderMarkdown } from "@/util/markdown";
import { aiPreviewDiffLines, aiPreviewEvidenceLines, aiPreviewSourceFingerprint, aiPreviewSourceMatches, renderPreviewReport } from "@/editor/panels/aiAssistantPanel";
import { createAiPreviewProject } from "@/project/aiPreviewGenerator";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { isolateTimers } from "./mergedTeardown";

describe("actorBattleCommandsPanel", () => {
  isolateTimers();
  // 액터 「전투 명령」 패널(RM2003 배우별 명령, 2026-10-02) — 켜기·순서·끄기가 실제로 저장되는지.
  function node(root: FakeElement, testId: string): FakeElement {
    const found = findByTestId(root, testId);
    if (!found) throw new Error(`missing ${testId}`);
    return found;
  }
  describe("액터 전투 명령 패널", () => {
    it("켜면 직업 명령을 옮겨 오고, ↓·삭제·끄기가 battleCommandIds 에 저장된다", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        const actorId = project.database.actors[0]!.id;
        const klass = project.database.classes.find((entry) => entry.id === project.database.actors[0]!.classId)!;
        const classIds = klass.battleCommands.map((command) => command.id);
        expect(classIds.length).toBeGreaterThan(1);
        store.replace(project);
        const host = document.createElement("section") as unknown as FakeElement;
        const actor = () => store.getCurrent().database.actors.find((entry) => entry.id === actorId)!;
        const render = () => {
          host.replaceChildren(battlePanel(actor(), render, () => undefined) as unknown as Node as never);
        };
        render();
        expect(findByTestId(host, "db-actor-command-class-note")).not.toBeNull();

        const toggle = node(host, "db-field-actor-custom-commands");
        toggle.checked = true;
        toggle.dispatchEvent(new Event("change"));
        expect(actor().battleCommandIds).toEqual(classIds.slice(0, 7));

        node(host, "db-actor-command-down-0").click();
        expect(actor().battleCommandIds?.slice(0, 2)).toEqual([classIds[1], classIds[0]]);

        node(host, "db-actor-command-remove-0").click();
        expect(actor().battleCommandIds?.[0]).toBe(classIds[0]);
        expect(deserialize(serialize(store.getCurrent())).database.actors.find((entry) => entry.id === actorId)!.battleCommandIds)
          .toEqual(actor().battleCommandIds);

        const off = node(host, "db-field-actor-custom-commands");
        off.checked = false;
        off.dispatchEvent(new Event("change"));
        expect("battleCommandIds" in actor()).toBe(false);
      } finally {
        restoreDom();
      }
    });
  });
});

describe("aiAgentBrief", () => {
  isolateTimers();
  describe("readAgentBrief", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
      const mapId = store.getCurrent().startMapId;
      editorState.set({
        currentMapId: mapId,
        layer: "lower",
        tool: "paint",
        selection: null,
      });
    });

    afterEach(() => {
    });

    it("맵 크기·레이어·도구를 한 줄로 읽는다", () => {
      const brief = readAgentBrief();
      expect(brief.mapName).toBe("빈 맵");
      expect(brief.mapSize).toBe("20×15");
      expect(brief.layerShort).toBe("바닥");
      expect(brief.toolLabel).toBe("칠하기");
      expect(brief.line).toBe("빈 맵 20×15 · 바닥 · 칠하기");
      expect(brief.lookingAt).toBe("지금 빈 맵 20×15");
      expect(brief.eventCount).toBe(0);
    });

    it("이벤트 레이어+도구는 도구를 중복하지 않는다", () => {
      editorState.set({ layer: "event", tool: "event" });
      expect(readAgentBrief().line).toBe("빈 맵 20×15 · 이벤트");
    });

    it("선택 영역이 있으면 줄과 placeholder에 칸 수가 실린다", () => {
      const mapId = store.getCurrent().startMapId;
      editorState.set({
        selection: { mapId, x: 3, y: 4, width: 4, height: 3 },
      });
      const brief = readAgentBrief();
      expect(brief.selectionLabel).toBe("선택 4×3 (3,4)");
      expect(brief.line).toContain("선택 4×3 (3,4)");
      expect(formatComposerPlaceholder()).toBe("한 문장으로 지시");
    });

    it("선택이 있으면 선택 꾸미기 명령을 앞에 둔다", () => {
      const mapId = store.getCurrent().startMapId;
      editorState.set({
        selection: { mapId, x: 0, y: 0, width: 2, height: 2 },
      });
      const prompts = directorStartPrompts(readAgentBrief());
      expect(prompts.map((prompt) => prompt.id)).toEqual(["selection", "place", "character"]);
      expect(prompts).toHaveLength(3);
    });

    it("이벤트 레이어에서는 등장인물 명령을 앞에 둔다", () => {
      editorState.set({ layer: "event", tool: "event" });
      const prompts = directorStartPrompts(readAgentBrief());
      expect(prompts[0]?.id).toBe("character");
      expect(prompts[0]?.instruction).toContain("빈 맵");
    });

    it("대기 한 줄과 골드 힌트 둘을 준다", () => {
      const brief = readAgentBrief();
      expect(idlePresenceLine(brief)).toBe("이 맵에 무엇을 둘까요");
      expect(assistantIdleHints(brief)).toHaveLength(2);
      expect(assistantIdleHints(brief)[0]?.label).toBe("강가를 만들어줘");
      expect(formatComposerPlaceholder()).toBe("한 문장으로 지시");
    });

    it("빈 맵은 버튼을 누르라고 안내한다", () => {
      expect(nextStepHint(readAgentBrief())).toBe("빈 맵이에요. 아래 중 하나를 누르면 바로 시작합니다.");
    });

    it("흙길 오토타일 외곽만 있어도 실제 길로 인식한다", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("start map missing");
      map.lowerTiles[7 * map.width + 2] = 390;
      map.lowerTiles[7 * map.width + 3] = 391;
      map.lowerTiles[7 * map.width + 4] = 392;
      store.replace(structuredClone(project));

      const brief = readAgentBrief();
      expect(brief.hasPath).toBe(true);
      expect(nextStepHint(brief)).not.toContain("길이 없어요");
    });

    it("선택이 있으면 그 칸을 고르라고 안내한다", () => {
      const mapId = store.getCurrent().startMapId;
      editorState.set({
        selection: { mapId, x: 1, y: 1, width: 2, height: 2 },
      });
      expect(nextStepHint(readAgentBrief())).toBe("선택한 칸에 무엇을 둘지 골라 보세요.");
    });
  });
});

describe("aiAnswerLinkRender", () => {
  isolateTimers();
  function fixture(): Project {
    const project = createBlankProject();
    const start = project.maps[project.startMapId];
    if (!start) throw new Error("blank project has no start map");
    start.name = "햇살 마을";
    const house = createBlankMap("상인 하나의 집", 20, 16);
    house.id = "map_house_interior_1";
    project.maps[house.id] = house;
    return project;
  }
  function merchant() {
    return {
      id: "ev_new_merchant",
      x: 3,
      y: 4,
      trigger: { kind: "action" as const },
      commands: [],
      pages: [{
        id: "ev_new_merchant_page_1",
        name: "새로 온 상인",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" as const },
        priority: "same" as const,
        movement: { type: "fixed" as const, speed: 3 as const, frequency: 3 as const },
        commands: [],
      }],
    };
  }
  function index(): EditorReferenceIndex {
    return buildEditorReferenceIndex(fixture());
  }
  function links(root: HTMLElement): FakeElement[] {
    return (root as unknown as FakeElement).querySelectorAll("[data-testid=ai-answer-link]");
  }
  describe("assistant answer internal links", () => {
    let restoreDom: (() => void) | null = null;

    beforeEach(() => {
      restoreDom = installFakeDom();
    });

    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("turns an authored map name inside the answer into a navigation button", () => {
      const text = "우측 하단 마을 구역에 ‘상인 하나의 집’(실내 맵 1채)이 마련되어 있습니다.";
      const root = renderMarkdown(text);

      const created = decorateEditorReferences(root, index(), () => true);
      const buttons = links(root);

      expect(created).toBe(1);
      expect(buttons.map((button) => button.textContent)).toEqual(["상인 하나의 집"]);
      expect(buttons[0]?.tagName).toBe("BUTTON");
      expect(buttons[0]?.attrs.type).toBe("button");
    });

    it("keeps the surrounding sentence intact around the link", () => {
      const text = "‘상인 하나의 집’ 안에는 아직 상점 NPC가 없습니다.";
      const root = renderMarkdown(text);

      decorateEditorReferences(root, index(), () => true);

      expect(root.textContent).toBe(text);
    });

    it("clicking a link navigates to that target exactly once", () => {
      const navigated: EditorReferenceTarget[] = [];
      const root = renderMarkdown("‘상인 하나의 집’으로 가보세요.");

      decorateEditorReferences(root, index(), (target) => {
        navigated.push(target);
        return true;
      });
      const button = links(root)[0];
      if (!button) throw new Error("link not created");
      button.click();

      expect(navigated).toEqual([{ kind: "map", mapId: "map_house_interior_1" }]);
    });

    it("never links names inside code spans or fenced code", () => {
      const root = renderMarkdown(["`상인 하나의 집`", "", "```", "상인 하나의 집", "```"].join("\n"));

      const created = decorateEditorReferences(root, index(), () => true);

      expect(created).toBe(0);
      expect(links(root)).toHaveLength(0);
    });

    it("does not decorate an existing markdown link label", () => {
      const root = renderMarkdown("[상인 하나의 집](https://example.com/docs)");

      expect(decorateEditorReferences(root, index(), () => true)).toBe(0);
    });

    it("renderAssistantAnswer wires the live project index into the bubble body", () => {
      store.replace(fixture());

      const body = renderAssistantAnswer("‘상인 하나의 집’은 아직 비어 있습니다.");

      expect(links(body).map((button) => button.dataset.refKind)).toEqual(["map"]);
    });

    it("맵 변경 뒤 새 이벤트 이름으로 색인을 다시 만든다", () => {
      const project = fixture();
      store.replace(project);
      renderAssistantAnswer("햇살 마을은 조용합니다.");
      store.updateMap(project.startMapId, (map) => {
        const event = merchant();
        const page = event.pages[0];
        if (!page) throw new Error("event page is missing");
        page.name = "새로 온 상인";
        map.events.push(event);
      });

      const body = renderAssistantAnswer("새로 온 상인을 만나보세요.");

      expect(links(body).map((button) => button.dataset.refLabel)).toEqual(["새로 온 상인"]);
    });

    it("같은 이름이 여러 곳이면 한 곳을 고르지 않는다", () => {
      const project = createBlankProject();
      const first = createBlankMap("여관", 20, 16);
      first.id = "map_inn_a";
      const second = createBlankMap("여관", 20, 16);
      second.id = "map_inn_b";
      project.maps = { [first.id]: first, [second.id]: second };
      project.startMapId = first.id;
      store.replace(project);

      const body = renderAssistantAnswer("여관은 두 곳입니다.");

      expect(links(body).map((button) => button.dataset.refKind)).toEqual(["ambiguous"]);
    });
  });
});

describe("aiAssistantPanel", () => {
  isolateTimers();
  function withFakeDom<T>(run: () => T): T {
    const restore = installFakeDom();
    try {
      return run();
    } finally {
      restore();
    }
  }
  function directParagraphText(container: HTMLElement): string[] {
    return (Array.from(container.childNodes) as unknown[])
      .filter((node): node is FakeElement => node instanceof FakeElement && node.tagName === "P")
      .map((node) => node.textContent);
  }
  describe("AI assistant preview summaries", () => {
    it("shows diff, evidence, and approval-relevant metadata for a successful preview", () => {
      // The preview generator targets the EasyRPG combined-town sheet, which new projects no longer ship (2026-10-07 purge).
      const source = withRetiredEasyRpgTilesets(createBlankProject());
      const result = createAiPreviewProject({ goal: "작은 항구 마을", sourceProject: source });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.clarificationQuestion);

      expect(aiPreviewDiffLines(source, result)).toEqual([
        expect.stringContaining("프리뷰 맵:"),
        `맵 수: ${Object.keys(source.maps).length} → ${Object.keys(result.project.maps).length}`,
        `시작 맵: ${source.startMapId} → ${result.project.startMapId}`,
        expect.stringContaining("NPC: 항구 안내인/preview-guide"),
      ]);
      expect(aiPreviewEvidenceLines(result)).toEqual([
        expect.stringContaining("ChipSet 증거:"),
        expect.stringContaining("CharSet 증거: easyrpg-charset-people"),
        expect.stringContaining("타일 그룹:"),
        expect.stringContaining("reachableNpcEvents=통과"),
      ]);
      expect(source.startMapId).not.toBe(result.project.startMapId);
    });

    it("surfaces fail-closed missing evidence instead of approval metadata", () => {
      const result = createAiPreviewProject({ goal: "추상적인 분위기", sourceProject: withRetiredEasyRpgTilesets(createBlankProject()) });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected fail-closed result");

      expect(aiPreviewDiffLines(createBlankProject(), result)).toEqual(["적용될 프로젝트 변경 없음."]);
      expect(aiPreviewEvidenceLines(result)).toEqual([
        expect.stringContaining("질문:"),
        expect.stringContaining("부족한 증거: charset_not_high_confidence"),
      ]);
    });
    it("invalidates stale generated previews when the source project changes before approval", () => {
      const source = createBlankProject();
      const fingerprint = aiPreviewSourceFingerprint(source);

      expect(aiPreviewSourceMatches(source, fingerprint)).toBe(true);

      source.meta.title = "changed after preview generation";

      expect(aiPreviewSourceMatches(source, fingerprint)).toBe(false);
    });

    it("renders technical preview evidence under a default-closed validation details block", () => {
      withFakeDom(() => {
        const container = document.createElement("div");

        renderPreviewReport(container, {
          beforeDetails: ["프리뷰 맵: 작은 항구"],
          detailLines: ["ChipSet 증거: combined-town / high"],
          afterDetails: ["승인 전까지 원본 프로젝트는 변경되지 않습니다."],
        });

        const details = container.querySelector("details");
        expect(details?.getAttribute("open")).toBeNull();
        expect(details?.querySelector("summary")?.textContent).toBe("생성 검증 상세");
        expect(details?.textContent).toContain("ChipSet 증거");
      });
    });

    it("keeps diff and approval lines visible while evidence text stays inside details", () => {
      withFakeDom(() => {
        const container = document.createElement("div");

        renderPreviewReport(container, {
          beforeDetails: ["프리뷰 맵: 작은 항구", "맵 수: 1 → 2"],
          detailLines: ["CharSet 증거: easyrpg-charset-people"],
          afterDetails: ["승인 전까지 원본 프로젝트는 변경되지 않습니다."],
        });

        expect(directParagraphText(container)).toEqual([
          "프리뷰 맵: 작은 항구",
          "맵 수: 1 → 2",
          "승인 전까지 원본 프로젝트는 변경되지 않습니다.",
        ]);
        expect(directParagraphText(container).join("\n")).not.toContain("증거");
        expect(container.querySelector("details")?.textContent).toContain("CharSet 증거");
      });
    });

    it("omits the validation details block when there are no technical lines", () => {
      withFakeDom(() => {
        const container = document.createElement("div");

        renderPreviewReport(container, {
          beforeDetails: ["프리뷰 목표를 먼저 입력하세요."],
        });

        expect(container.querySelector("details")).toBeNull();
        expect(directParagraphText(container)).toEqual(["프리뷰 목표를 먼저 입력하세요."]);
      });
    });
  });
});
