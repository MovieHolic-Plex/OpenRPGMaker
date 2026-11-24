import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { changeCountsLine, changedSinceRun, listChangeItems, revertChangeItem } from "@/editor/panels/aiChangeSummaryCard";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project, GameEvent, EnemyRecord, ItemRecord } from "@/project/types";
import { isReadOnlyToolNoise, phaseStatusText, shouldShowStatusInChat } from "@/editor/panels/aiChatPanelHelpers";
import { formatAiRunningStatus, parseAutonomousRunBudget, renderToolActivityEntry, renderWorkPlanChecklist } from "@/editor/panels/aiChatRenderers";
import { installFakeDom, renderWithFakeDom, FakeElement, findByTestId } from "./fakeDom";
import type { WorkPlan } from "@/ai/workPlan";
import { AUTONOMY_LEVELS, type AutonomyLevel } from "@/ai/autonomyLevels";
import { createComposerElements, type ComposerElements } from "@/editor/panels/aiComposer";
import { contextUsagePercent, contextUsageTone, createAiContextMeter, formatContextMeterLabel, type AiContextSnapshot } from "@/editor/panels/aiContextMeter";
import type { ContextUsage } from "@/ai/contextCompaction";
import { EMPTY_SESSION_USAGE, addSessionUsage } from "@/ai/sessionUsage";
import { creationCardModel, eventAppearanceId, firstPlayedMusic, firstSpokenLine } from "@/editor/panels/aiCreationCards";
import { DECK_ICON_NAMES, deckIcon } from "@/editor/panels/aiDeckIcons";
import { createDeckRail, deckStateOfTone } from "@/editor/panels/aiDeckRail";
import { findEntityMentions, renderEntityMentionStrip, type EntityMention } from "@/editor/panels/aiEntityMentions";
import type { AuditEntry } from "@/ai/assistantSession";
import { mergeHarnessTimeline } from "@/editor/panels/aiHarnessModal";
import { AI_INSTRUCTIONS_MAX_CHARS } from "@/ai/projectInstructions";
import { closeAiInstructionsModal, openAiInstructionsModal } from "@/editor/panels/aiInstructionsModal";
import { getMapEditHistoryMarker, getMapEditHistoryState, resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { isolateTimers } from "./mergedTeardown";

describe("aiChangeSummaryCard", () => {
  isolateTimers();
  type MapEvent = GameMap["events"][number];
  const npc = (id: string, x: number, y: number, name = id): MapEvent => ({ id, name, x, y, pages: [] } as unknown as MapEvent);
  function seed(): Project {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "create_map", { id: "map_east", name: "동쪽", width: 12, height: 10 });
    if (!result.ok) throw new Error(result.summary);
    const map = ctx.project.maps.map_east!;
    return { ...ctx.project, maps: { ...ctx.project.maps, map_east: { ...map, events: [npc("ev_a", 1, 1, "촌장")] } } };
  }
  function withMap(project: Project, mapId: string, patch: Partial<GameMap>): Project {
    return { ...project, maps: { ...project.maps, [mapId]: { ...project.maps[mapId]!, ...patch } } };
  }
  describe("listChangeItems", () => {
    it("separates a map's tiles from its events and counts by kind", () => {
      const before = seed();
      const map = before.maps.map_east!;
      const tiles = [...map.lowerTiles]; tiles[5] = 9;
      const after = withMap(before, "map_east", { lowerTiles: tiles, events: [npc("ev_a", 4, 4, "촌장"), npc("ev_b", 2, 2, "상인")] });
      const items = listChangeItems(before, after);
      expect(items.map((item) => `${item.kind}:${item.change}:${item.id}`)).toEqual(["map:modified:map_east", "event:modified:ev_a", "event:added:ev_b"]);
      expect(changeCountsLine(items)).toBe("맵 1 · 이벤트 2");
    });

    it("reports a new map once and its events", () => {
      const before = seed();
      const after = { ...before, maps: { ...before.maps, map_new: { ...before.maps.map_east!, id: "map_new", name: "숲속 마을" } } } as Project;
      const items = listChangeItems(before, after);
      expect(items.filter((item) => item.mapId === "map_new").map((item) => `${item.kind}:${item.change}`)).toEqual(["map:added", "event:added"]);
    });
  });
  describe("revertChangeItem", () => {
    it("puts one moved event back and leaves the other change alone", () => {
      const before = seed();
      const after = withMap(before, "map_east", { events: [npc("ev_a", 4, 4, "촌장"), npc("ev_b", 2, 2, "상인")] });
      const items = listChangeItems(before, after);
      const moved = items.find((item) => item.id === "ev_a")!;
      const next = revertChangeItem(after, before, moved);
      expect(next.maps.map_east!.events.map((event) => [event.id, event.x, event.y])).toEqual([["ev_a", 1, 1], ["ev_b", 2, 2]]);
    });

    it("removes an added event and an added map", () => {
      const before = seed();
      const after = { ...withMap(before, "map_east", { events: [npc("ev_a", 1, 1, "촌장"), npc("ev_b", 2, 2)] }),
        maps: { ...before.maps, map_east: { ...before.maps.map_east!, events: [npc("ev_a", 1, 1, "촌장"), npc("ev_b", 2, 2)] }, map_new: { ...before.maps.map_east!, id: "map_new" } } } as Project;
      const items = listChangeItems(before, after);
      const noEvent = revertChangeItem(after, before, items.find((item) => item.id === "ev_b")!);
      expect(noEvent.maps.map_east!.events.map((event) => event.id)).toEqual(["ev_a"]);
      const noMap = revertChangeItem(noEvent, before, items.find((item) => item.kind === "map" && item.id === "map_new")!);
      expect(Object.keys(noMap.maps)).not.toContain("map_new");
    });

    it("restores map tiles while keeping the map's current events", () => {
      const before = seed();
      const tiles = [...before.maps.map_east!.lowerTiles]; tiles[3] = 7;
      const after = withMap(before, "map_east", { lowerTiles: tiles, events: [npc("ev_a", 6, 6, "촌장")] });
      const item = listChangeItems(before, after).find((entry) => entry.kind === "map")!;
      const next = revertChangeItem(after, before, item);
      expect(next.maps.map_east!.lowerTiles[3]).toBe(before.maps.map_east!.lowerTiles[3]);
      expect(next.maps.map_east!.events[0]!.x).toBe(6);
    });
  });
  describe("changedSinceRun", () => {
    it("notices a hand edit made after the run", () => {
      const before = seed();
      const after = withMap(before, "map_east", { events: [npc("ev_a", 4, 4, "촌장")] });
      const item = listChangeItems(before, after)[0]!;
      expect(changedSinceRun(item, after, after)).toBe(false);
      expect(changedSinceRun(item, after, withMap(after, "map_east", { events: [npc("ev_a", 5, 4, "촌장")] }))).toBe(true);
    });
  });
});

describe("aiChatLeanUi", () => {
  isolateTimers();
  function samplePlan(overrides: Partial<WorkPlan> = {}): WorkPlan {
    return {
      id: "plan-1",
      goal: "RPG 만들어줘",
      createdAt: "2026-08-14T00:00:00.000Z",
      currentLayerIndex: 0,
      currentItemId: "L1-1",
      layers: [
        {
          id: "L1",
          title: "마을",
          items: [
            { id: "L1-1", title: "마을 광장", instruction: "광장", status: "in_progress" },
            { id: "L1-2", title: "집 3채", instruction: "집", status: "pending" },
          ],
        },
      ],
      ...overrides,
    };
  }
  describe("AI 채팅 lean UI 정책", () => {
    it("단계 라벨에 모델 코드를 넣지 않는다", () => {
      expect(phaseStatusText("plan")).toBe("계획 중");
      expect(phaseStatusText("execute")).toBe("실행 중");
      expect(phaseStatusText("review")).toBe("검수 중");
    });

    it("진행 상태줄은 짧고 분모 상한을 숨긴다", () => {
      expect(formatAiRunningStatus(0, 12_000, 0, 200, "계획 중")).toBe("계획 중… 12초");
      expect(formatAiRunningStatus(0, 12_000, 4, 200, "실행 중")).toBe("실행 중… 12초 · 도구 4");
    });

    it("status 말풍선은 재시도·오류 신호만 허용한다", () => {
      expect(shouldShowStatusInChat("연결 끊김 — 재시도 중(1/2)")).toBe(true);
      expect(shouldShowStatusInChat("요청이 커서 이번 턴에는 일부만 제안합니다. 이어서 요청해 주세요.")).toBe(true);
      expect(shouldShowStatusInChat("변경 없는 종료를 감지해 실행 계획을 다시 요청합니다.")).toBe(false);
      expect(shouldShowStatusInChat("zero-change-rekick")).toBe(false);
    });

    it("조회성 툴 성공은 목록 노이즈로 분류한다", () => {
      expect(isReadOnlyToolNoise("get_map_region")).toBe(true);
      expect(isReadOnlyToolNoise("list_resources")).toBe(true);
      expect(isReadOnlyToolNoise("show_tiles")).toBe(true);
      expect(isReadOnlyToolNoise("paint_road")).toBe(false);
      expect(isReadOnlyToolNoise("build_house" as string)).toBe(false);
    });

    it("성공 툴 항목은 JSON 상세 없이 한 줄이다", () => {
      const restore = installFakeDom();
      try {
        const node = renderWithFakeDom(() =>
          renderToolActivityEntry(
            "paint_road",
            { ok: true, summary: "길 12칸" },
            { args: { mapId: "m1" }, index: 1 }
          )
        ) as FakeElement;
        expect(node.tagName).toBe("DIV");
        // 데크(2026-09-03): 한 줄 텍스트 「✓ 요약」 → 라벨/요약/상태 세 칸 행. 함수 이름은 title 로만.
        expect(node.querySelector?.(".ai-act-label")?.textContent).toBe("길 놓기");
        expect(node.querySelector?.(".ai-act-sum")?.textContent).toBe("길 12칸");
        expect(node.textContent).not.toContain("paint_road");
        expect(node.getAttribute("title")).toContain("paint_road");
        expect(node.querySelector?.("pre")).toBeFalsy();
      } finally {
        restore();
      }
    });
  });
  describe("자율 실행 예산 표시 (todo 6)", () => {
    it("자동 계속 status 텍스트에서 used/total 을 파싱한다", () => {
      expect(parseAutonomousRunBudget("자율 실행 계속 (2/48)")).toEqual({ used: 2, total: 48, exhausted: false });
      expect(parseAutonomousRunBudget("자율 실행 계속 (48/48)")).toEqual({ used: 48, total: 48, exhausted: false });
    });

    it("예산 소진 status 는 used=total + exhausted 플래그로 파싱된다", () => {
      expect(parseAutonomousRunBudget("자율 실행 예산 소진 — 「계속」이라고 보내면 이어서 진행합니다."))
        .toEqual({ used: 48, total: 48, exhausted: true });
    });

    it("무관한 status 텍스트는 null 을 돌려준다", () => {
      expect(parseAutonomousRunBudget("생각 중… 3초")).toBeNull();
      expect(parseAutonomousRunBudget("작업 계획 1/4")).toBeNull();
      expect(parseAutonomousRunBudget("")).toBeNull();
    });
  });
  describe("작업 계획 앞면 렌더", () => {
    it("상태·진행·중지·계획 보기와 예산을 렌더하고 항목 본문은 두지 않는다", () => {
      const restore = installFakeDom();
      try {
        let opened = 0;
        const node = renderWithFakeDom(() =>
          renderWorkPlanChecklist(samplePlan(), {
            active: true,
            budget: { used: 3, total: 48 },
            onOpenBook: () => {
              opened += 1;
            },
          })
        ) as FakeElement;
        expect(node.dataset.testid).toBe("ai-work-plan-checklist");
        expect(node.textContent).toContain("마을 광장 중");
        expect(node.textContent).toContain("예산 3/48");
        expect(node.querySelectorAll("[data-testid='ai-autonomous-item']")).toHaveLength(0);
        expect(node.querySelector("[data-testid='ai-autonomous-progress']")?.textContent).toBe("0/2");
        expect(node.querySelector("[data-testid='ai-run-status']")?.textContent).toBe("마을 광장 중");
        expect(node.querySelector("[data-testid='ai-run-stop']")?.textContent).toBe("중지");
        expect(node.querySelector("[data-testid='ai-plan-book-open']")?.textContent).toBe("계획 보기");
        expect(node.querySelector("[data-testid='ai-run-details-toggle']")?.textContent).toContain("자세히");
        // 2026-09-21 앞면 개편: 머리 pill(아이콘+상태) + 본문은 드롭다운. 예산 칩은 여전히 「자세히」에 둔다.
        expect(node.querySelector("[data-testid='ai-plan-head']")?.textContent).not.toContain("예산");
        expect(node.dataset.active).toBe("true");
        expect(node.dataset.complete).toBe("false");
        expect(node.querySelector("[data-testid='ai-work-item-activity']")?.textContent).toBe("진행 중…");
        node.querySelector("[data-testid='ai-plan-book-open']")?.click();
        expect(opened).toBe(1);
      } finally {
        restore();
      }
    });

    it.each([
      { active: true, stoppedReason: undefined, status: "마무리 확인 중", complete: false },
      { active: false, stoppedReason: "max-tool-calls", status: "작업 중단 — 실행 한도 도달", complete: false },
      { active: false, stoppedReason: "token-budget", status: "작업 중단 — 실행 한도 도달", complete: false },
      { active: false, stoppedReason: "error", status: "작업 중단 — 오류", complete: false },
      { active: false, stoppedReason: "apply-failed", status: "작업 중단 — 적용 실패", complete: false },
      { active: false, stoppedReason: "final", status: "모두 완료", complete: true },
    ])("체크가 끝나도 실행 상태 $stoppedReason / active=$active 를 반영한다", (state) => {
      const restore = installFakeDom();
      try {
        const plan = samplePlan();
        for (const item of plan.layers.flatMap((layer) => layer.items)) item.status = "done";
        const node = renderWithFakeDom(() => renderWorkPlanChecklist(plan, state)) as FakeElement;
        expect(node.querySelector("[data-testid='ai-run-status']")?.textContent).toBe(state.status);
        expect(node.dataset.complete).toBe(String(state.complete));
      } finally { restore(); }
    });

    it("건너뛴 항목이 남은 계획을 모두 완료로 표시하지 않는다", () => {
      const restore = installFakeDom();
      try {
        const plan = samplePlan();
        plan.layers[0]!.items[0]!.status = "done";
        plan.layers[0]!.items[1]!.status = "skipped";
        const node = renderWithFakeDom(() => renderWorkPlanChecklist(plan, { active: false, stoppedReason: "final" })) as FakeElement;
        expect(node.querySelector("[data-testid='ai-run-status']")?.textContent).toBe("계획 종료 — 건너뛴 항목 있음");
        expect(node.dataset.complete).toBe("false");
      } finally { restore(); }
    });

    it("필드가 빠진(망가진) 계획 페이로드도 안전하게 렌더한다 — 예외 없음", () => {
      const restore = installFakeDom();
      try {
        const malformed = {
          goal: "목표",
          layers: [
            { id: "L1", title: "레이어", items: [{ id: "x", title: "항목" }] },
            { title: "아이템 없는 레이어" },
          ],
        } as unknown as WorkPlan;
        const node = renderWithFakeDom(() => renderWorkPlanChecklist(malformed)) as FakeElement;
        expect(node.textContent).toContain("목표");
        expect(node.dataset.testid).toBe("ai-work-plan-checklist");
      } finally {
        restore();
      }
    });

    it("막힌 항목은 앞줄이 먼저 말하고 사유가 붙는다", () => {
      const restore = installFakeDom();
      try {
        const plan = samplePlan();
        plan.layers[0]!.items[0]!.status = "blocked";
        plan.layers[0]!.items[0]!.note = "스펙 게이트: 밑그림이 없습니다";
        const node = renderWithFakeDom(() => renderWorkPlanChecklist(plan, { active: false })) as FakeElement;
        expect(node.dataset.blocked).toBe("true");
        expect(node.querySelector("[data-testid='ai-run-status']")?.textContent).toBe("막힘 — 마을 광장");
        expect(node.querySelector("[data-testid='ai-work-item-blocked-note']")?.textContent).toBe("스펙 게이트: 밑그림이 없습니다");
        expect(node.querySelectorAll("[data-testid='ai-autonomous-item']")).toHaveLength(0);
      } finally {
        restore();
      }
    });

    it("layers 가 아예 없는 페이로드는 빈 앞면으로 안전하게 렌더한다", () => {
      const restore = installFakeDom();
      try {
        const node = renderWithFakeDom(() =>
          renderWorkPlanChecklist({ goal: "던전 하나" } as unknown as WorkPlan)
        ) as FakeElement;
        expect(node.dataset.testid).toBe("ai-work-plan-checklist");
        expect(node.textContent).toContain("던전 하나");
        expect(node.querySelector("[data-testid='ai-autonomous-progress']")?.textContent).toBe("0/0");
      } finally {
        restore();
      }
    });
  });
});

// 지시줄 자율성 셀렉트 — 컴포저 단위 계약: 값 어휘·초기값·콜백·외부 동기화.
// 추론 강도 셀렉트는 없다: 레벨 프리셋이 추론을 정한다(src/ai/autonomyLevels.ts).
describe("aiComposerEffort", () => {
  isolateTimers();
  function button(testid: string): HTMLButtonElement {
    const node = document.createElement("button");
    node.dataset.testid = testid;
    return node;
  }
  function div(cls: string): HTMLElement {
    const node = document.createElement("div");
    node.className = cls;
    return node;
  }
  function render(extra: {
    readonly autonomy?: AutonomyLevel;
    readonly onAutonomy?: (level: AutonomyLevel) => void;
  } = {}): ComposerElements {
    const input = document.createElement("textarea");
    return createComposerElements({
      input,
      collapseButton: button("ai-collapse"),
      sendButton: button("ai-send"),
      abortButton: button("ai-abort"),
      undoAppliedButton: button("ai-composer-undo"),
      contextChips: div("ai-context-chips"),
      composerChips: div("ai-composer-chips"),
      nextSteps: div("ai-next-steps"),
      queueIndicator: div("ai-pending-queue"),
      statusGroup: div("ai-status-group"),
      onNewChat: () => undefined,
      effortChips: {
        initialAutonomy: extra.autonomy ?? "balanced",
        onAutonomyChange: extra.onAutonomy ?? (() => undefined),
      },
    });
  }
  describe("aiComposer 자율성 셀렉트", () => {
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("effortChips 를 주지 않으면 셀렉트를 만들지 않는다", () => {
      // Break: 옵션 없이 셀렉트가 생겨 콜백 없는 컨트롤이 행을 차지한다.
      const input = document.createElement("textarea");
      const shell = createComposerElements({
        input,
        collapseButton: button("ai-collapse"),
        sendButton: button("ai-send"),
        abortButton: button("ai-abort"),
        undoAppliedButton: button("ai-composer-undo"),
        contextChips: div("ai-context-chips"),
        composerChips: div("ai-composer-chips"),
        nextSteps: div("ai-next-steps"),
        queueIndicator: div("ai-pending-queue"),
        statusGroup: div("ai-status-group"),
        onNewChat: () => undefined,
      });
      expect(shell.autonomySelect).toBeNull();
      expect((shell.actions as unknown as FakeElement).querySelector('[data-testid="ai-composer-autonomy"]')).toBeNull();
    });

    it("적용 정책은 자율성과 별도로 다섯 모드를 제공한다", () => {
      const shell = render();
      // 셀렉트들은 액션 행이 아니라 「작업 설정」 팝오버(commandBar 안)에 산다(public baseline 0d4f13e7c8).
      const select = (shell.commandBar as unknown as FakeElement).querySelector('[data-testid="ai-composer-apply-mode"]');
      expect(select?.querySelectorAll("option").map(option => option.getAttribute("value"))).toEqual(["yolo", "auto", "default", "review", "step"]);
      expect(select?.value).toBe("default");
    });

    it("자율성 선택지는 다이얼 전체를 한국어 라벨로 그린다", () => {
      // Break: 읽기 전용이 목록에서 빠지면 ask 레일을 부를 수단이 UI 에서 사라진다.
      const shell = render();
      const autonomyOptions = shell.autonomySelect?.querySelectorAll("option") ?? [];
      expect([...autonomyOptions].map((node) => node.getAttribute("value"))).toEqual(
        AUTONOMY_LEVELS.map((level) => level.id),
      );
      expect([...autonomyOptions].map((node) => node.textContent)).toEqual(
        AUTONOMY_LEVELS.map((level) => level.label),
      );
      expect([...autonomyOptions].map((node) => node.getAttribute("value"))).toContain("readonly");
    });

    it("추론 강도 셀렉트를 그리지 않는다", () => {
      // Break: 수동 override 가 남으면 다이얼이 저장한 프리셋 값과 갈라진다.
      const shell = render();
      // 셀렉트들은 액션 행이 아니라 「작업 설정」 팝오버(commandBar 안)에 산다(public baseline 0d4f13e7c8).
      const selects = (shell.commandBar as unknown as FakeElement).querySelectorAll('[data-testid="ai-composer-autonomy"]');
      expect([...selects].length).toBe(1);
    });

    it("초기값을 그리고 change 가 콜백을 부른다", () => {
      const picked: AutonomyLevel[] = [];
      const shell = render({ autonomy: "autonomous", onAutonomy: (level) => picked.push(level) });
      expect(shell.autonomySelect?.value).toBe("autonomous");
      if (!shell.autonomySelect) throw new Error("autonomy select missing");
      shell.autonomySelect.value = "readonly";
      shell.autonomySelect.dispatchEvent(new Event("change"));
      expect(picked).toEqual(["readonly"]);
    });

    it("알 수 없는 값은 콜백 없이 표시를 되돌린다", () => {
      // Break: 검증 없이 통과시키면 저장소에 레벨 아닌 문자열이 들어가 유도가 balanced 로 무너진다.
      const picked: AutonomyLevel[] = [];
      const shell = render({ autonomy: "balanced", onAutonomy: (level) => picked.push(level) });
      if (!shell.autonomySelect) throw new Error("autonomy select missing");
      shell.autonomySelect.value = "turbo";
      shell.autonomySelect.dispatchEvent(new Event("change"));
      expect(picked).toEqual([]);
      expect(shell.autonomySelect.value).toBe("balanced");
    });

    it("syncEffort 가 셀렉트 표시를 고친다", () => {
      // Break: 설정 모달에서 바꾼 뒤 컴포저 표시만 옛값이라 거짓을 보여준다.
      const shell = render({ autonomy: "balanced" });
      shell.syncEffort("max");
      expect(shell.autonomySelect?.value).toBe("max");
    });

    it("셀렉트는 작업 설정 팝오버에 있고, 액션 행 lead 는 그 토글만 갖고, 팝오버 기계를 건드리지 않는다", () => {
      // 자율성 셀렉트는 「작업 설정」 팝오버로 옮겨졌다(public baseline 0d4f13e7c8) — lead 에는 여는 토글이 남는다.
      const shell = render();
      const actions = shell.actions as unknown as FakeElement;
      const lead = actions.querySelector(".ai-composer-actions-lead");
      expect(lead?.querySelector('[data-testid="ai-composer-settings"]')).toBeTruthy();
      const popover = (shell.commandBar as unknown as FakeElement).querySelector('[data-testid="ai-composer-settings-popover"]');
      expect(popover?.contains(shell.autonomySelect)).toBe(true);
      expect(shell.openKind()).toBeNull();
    });
  });
});

// test/aiContextMeter.test.ts
// 맥락 게이지 — 라벨/톤 계산과 팝오버가 스냅샷을 그대로 비추는지.
//
// 톤 기준은 **자동 압축 임계** 다(모델 창이 아니다): 사용자가 궁금한 것은 "창이 얼마 남았나"
// 가 아니라 "언제 자동으로 압축이 도는가" 이기 때문이다. 게이지가 창 기준으로 세면 임계를
// 넘어 압축이 돌아도 게이지는 한가하게 보인다.
describe("aiContextMeter", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  function usage(overrides: Partial<ContextUsage> = {}): ContextUsage {
    return {
      estimateTokens: 40_000,
      usageTokens: 0,
      contextTokens: 40_000,
      contextWindow: 128_000,
      reserveTokens: 16_384,
      thresholdTokens: 111_616,
      ratio: 40_000 / 128_000,
      overThreshold: false,
      ...overrides,
    };
  }
  function snapshot(overrides: Partial<AiContextSnapshot> = {}): AiContextSnapshot {
    return {
      usage: usage(),
      totals: EMPTY_SESSION_USAGE,
      summary: null,
      canUndoCompaction: false,
      busy: false,
      ...overrides,
    };
  }
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });
  describe("게이지 숫자와 톤", () => {
    it("Given 비율 When 퍼센트 Then 정수로 반올림한다", () => {
      expect(contextUsagePercent(usage({ ratio: 0.6249 }))).toBe(62);
      expect(contextUsagePercent(usage({ ratio: 0 }))).toBe(0);
    });

    it("Given 임계 미만 When 톤 Then idle", () => {
      expect(contextUsageTone(usage({ contextTokens: 40_000 }))).toBe("idle");
    });

    it("Given 임계의 80% 이상 When 톤 Then near", () => {
      expect(contextUsageTone(usage({ contextTokens: Math.ceil(111_616 * 0.8) }))).toBe("near");
    });

    it("Given 임계 초과 When 톤 Then warn", () => {
      expect(contextUsageTone(usage({ contextTokens: 120_000, overThreshold: true }))).toBe("warn");
    });

    it("Given 세션 없음 When 라벨 Then 0% 라고 거짓말하지 않고 무엇의 칸인지 말한다(C-71)", () => {
      // C-71(92a6aba61e): 줄표 자리표시 대신 「맥락 사용량」. 숫자 0% 를 지어내지 않는 계약은 그대로다.
      expect(formatContextMeterLabel(null)).toBe("맥락 사용량");
      expect(formatContextMeterLabel(usage({ ratio: 0.31 }))).toBe("맥락 31%");
    });
  });
  describe("팝오버 내용", () => {
    it("Given 세션 없음 When 렌더 Then 압축 버튼이 잠기고 안내 문장이 온다", () => {
      const meter = createAiContextMeter({
        read: () => snapshot({ usage: null }),
        onCompact: () => undefined,
        onUndoCompaction: () => undefined,
        onToggle: () => undefined,
      });
      const popover = meter.popover as unknown as FakeElement;

      expect((meter.button as unknown as FakeElement).textContent).toBe("맥락 사용량");
      expect(findByTestId(popover, "ai-context-headline")!.textContent).toBe("아직 대화가 없습니다");
      expect((findByTestId(popover, "ai-context-compact") as unknown as { disabled: boolean }).disabled).toBe(true);
      expect(findByTestId(popover, "ai-context-usage")!.textContent).toBe("아직 요청 없음");
    });

    it("Given 사용량과 요약이 있는 스냅샷 When 갱신 Then 토큰·임계·모델별 집계가 보인다", () => {
      let current = snapshot({
        usage: usage({ usageTokens: 52_000, contextTokens: 52_000, ratio: 52_000 / 128_000 }),
        totals: addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", { prompt_tokens: 52_000, completion_tokens: 900 }),
        summary: "## Goal\n마을 정비",
      });
      const meter = createAiContextMeter({
        read: () => current,
        onCompact: () => undefined,
        onUndoCompaction: () => undefined,
        onToggle: () => undefined,
      });
      const popover = meter.popover as unknown as FakeElement;

      expect((meter.button as unknown as FakeElement).textContent).toBe("맥락 41%");
      expect((meter.button as unknown as FakeElement).dataset.tone).toBe("idle");
      const detail = findByTestId(popover, "ai-context-detail")!.textContent;
      expect(detail).toContain("52,000 / 128,000 토큰");
      expect(detail).toContain("자동 압축 임계 111,616 토큰");
      expect(findByTestId(popover, "ai-context-usage")!.textContent).toBe("호출 1회 · 입력 52,000 · 출력 900");
      expect(findByTestId(popover, "ai-context-models")!.textContent).toContain("gpt-x");
      // 요약 원문은 접힌 채 존재한다 — 토글로만 펼친다.
      const body = findByTestId(popover, "ai-context-summary-body")!;
      expect(body.hidden).toBe(true);
      expect(body.textContent).toContain("마을 정비");
      (findByTestId(popover, "ai-context-summary-toggle") as unknown as HTMLElement).click();
      expect(body.hidden).toBe(false);

      // 임계를 넘기면 톤이 경고로 바뀐다.
      current = snapshot({ usage: usage({ contextTokens: 120_000, ratio: 120_000 / 128_000, overThreshold: true }) });
      meter.refresh();
      expect((meter.button as unknown as FakeElement).dataset.tone).toBe("warn");
      expect(findByTestId(popover, "ai-context-detail")!.textContent).toContain("이미 넘었습니다");
    });

    it("Given 턴 진행 중 When 갱신 Then 압축·되돌리기 둘 다 잠긴다(요약 콜이 진행 중 요청과 겹친다)", () => {
      const meter = createAiContextMeter({
        read: () => snapshot({ busy: true, canUndoCompaction: true }),
        onCompact: () => undefined,
        onUndoCompaction: () => undefined,
        onToggle: () => undefined,
      });
      const popover = meter.popover as unknown as FakeElement;

      expect((findByTestId(popover, "ai-context-compact") as unknown as { disabled: boolean }).disabled).toBe(true);
      expect((findByTestId(popover, "ai-context-compact-undo") as unknown as { disabled: boolean }).disabled).toBe(true);
    });

    it("Given 되돌릴 압축이 없음 When 갱신 Then 되돌리기 버튼 자체를 숨긴다", () => {
      const meter = createAiContextMeter({
        read: () => snapshot(),
        onCompact: () => undefined,
        onUndoCompaction: () => undefined,
        onToggle: () => undefined,
      });

      expect(findByTestId(meter.popover as unknown as FakeElement, "ai-context-compact-undo")!.hidden).toBe(true);
    });

    it("Given 버튼 클릭 When 콜백 Then 압축·되돌리기·열기 신호가 각각 나간다", () => {
      const calls: string[] = [];
      const meter = createAiContextMeter({
        read: () => snapshot({ canUndoCompaction: true }),
        onCompact: () => calls.push("compact"),
        onUndoCompaction: () => calls.push("undo"),
        onToggle: () => calls.push("toggle"),
      });
      const popover = meter.popover as unknown as FakeElement;

      (meter.button as unknown as HTMLElement).click();
      (findByTestId(popover, "ai-context-compact") as unknown as HTMLElement).click();
      (findByTestId(popover, "ai-context-compact-undo") as unknown as HTMLElement).click();

      expect(calls).toEqual(["toggle", "compact", "undo"]);
    });
  });
});

describe("aiCreationCards", () => {
  isolateTimers();
  function run(project: Project, tool: string, args: Record<string, unknown>): Project {
    const ctx = { project };
    const result = runTool(ctx, tool, args);
    if (!result.ok) throw new Error(`${tool}: ${result.summary}`);
    return ctx.project;
  }
  describe("creation card models", () => {
    it("reads an equipment item's key stats and type from the record the tool wrote", () => {
      const before = createBlankProject();
      const after = run(before, "upsert_item", { item: { id: "item_flame_sword", name: "불꽃검", type: "weapon", price: 300, equipmentProfile: { statBonuses: { attack: 12, defense: 0, mind: 3, agility: 0 } } } });
      const item = listChangeItems(before, after).find((entry) => entry.id === "item_flame_sword")!;
      const model = creationCardModel(after, item)!;
      expect(model.title).toBe("불꽃검");
      expect(model.kindLine).toBe("장비 · 무기");
      expect(model.stats).toBe("공격 +12 · 마력 +3 · 300G");
    });

    it("gives a monster its HP/attack line", () => {
      const before = createBlankProject();
      const after = run(before, "upsert_enemy", { enemy: { id: "enemy_boss", name: "어둠 군주", monsterResourceId: "generated-enemy-slime-01", stats: { maxHp: 900, maxMp: 50, attack: 40, defense: 22, mind: 30, agility: 18 } } });
      const item = listChangeItems(before, after).find((entry) => entry.kind === "enemy" && entry.id === "enemy_boss")!;
      expect(creationCardModel(after, item)!.stats).toMatch(/^HP 900 · 공격 40 · 방어 22/u);
    });

    it("marks an item whose icon is a type stand-in, and clears the mark once a fitting icon is set", () => {
      const before = createBlankProject();
      const after = run(before, "upsert_item", { item: { id: "item_lunchbox", name: "나그네 도시락", type: "medicine" } });
      const item = listChangeItems(before, after).find((entry) => entry.id === "item_lunchbox")!;
      expect(creationCardModel(after, item)!.placeholderArt).toBe(true);
      const fixed = run(after, "upsert_item", { item: { id: "item_lunchbox", iconResourceId: "cc0-jetrel-bread" } });
      expect(creationCardModel(fixed, item)!.placeholderArt).toBeUndefined();
      const tea = run(before, "upsert_item", { item: { id: "item_tea", name: "달빛 차", type: "medicine" } });
      expect(creationCardModel(tea, listChangeItems(before, tea).find((entry) => entry.id === "item_tea")!)!.placeholderArt).toBeUndefined();
    });
  });
  describe("battle music change", () => {
    it("lists the project battle track as a music item and reverts only it", () => {
      const before = createBlankProject();
      const after = { ...before, system: { ...before.system, battleBgmResourceId: "cc0-bgm-boss-test" } } as Project;
      const items = listChangeItems(before, after);
      const music = items.find((entry) => entry.kind === "music")!;
      expect(music).toMatchObject({ id: "battleBgmResourceId", change: "modified", label: "전투 음악" });
      const reverted = revertChangeItem(after, before, music);
      expect(reverted.system.battleBgmResourceId).toBe(before.system.battleBgmResourceId);
    });
  });
  describe("firstSpokenLine", () => {
    it("finds the first text line inside nested choices, with its speaker", () => {
      const event = { id: "ev", x: 0, y: 0, pages: [{ commands: [
        { kind: "choices", options: [{ text: "네", branch: [{ kind: "text", speaker: "상인", body: "\n어서 오세요!\n둘째 줄" }] }] },
      ] }] } as unknown as GameEvent;
      expect(firstSpokenLine(event)).toEqual({ speaker: "상인", text: "어서 오세요!" });
    });
  });
  describe("firstPlayedMusic", () => {
    it("finds the boss track an event plays as background music, ignoring sound effects", () => {
      const event = { id: "ev", x: 0, y: 0, pages: [{ commands: [
        { kind: "playAudio", resourceId: "cc0-se-roar", loop: false },
        { kind: "playAudio", resourceId: "cc0-bgm-boss", loop: true },
      ] }] } as unknown as GameEvent;
      expect(firstPlayedMusic(event)).toBe("cc0-bgm-boss");
    });

    it("finds the appearance an assistant-made character event wears, so the card can follow its generated chip", () => {
      const before = createBlankProject();
      const placed = run(before, "make_villager", { mapId: before.startMapId, id: "ev_smith", name: "무기점 주인 도르간", home: { x: 3, y: 3 }, dialogue: [{ text: "어서 오게." }] });
      const linked = run(placed, "generate_walk_chip", { name: "도르간", description: "dwarf weapon-shop owner with a sword", events: [{ mapId: before.startMapId, eventId: "ev_smith" }] });
      const item = listChangeItems(before, linked).find((entry) => entry.kind === "event" && entry.id === "ev_smith")!;
      const appearanceId = linked.database.characterAppearances!.find((app) => app.name === "도르간")!.id;
      expect(eventAppearanceId(linked, item)).toBe(appearanceId);
      expect(eventAppearanceId(placed, item)).toBeUndefined();
    });
  });
});

describe("aiDeckIcons", () => {
  isolateTimers();
  describe("aiDeckIcons — 데크 아이콘 빌더", () => {
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("아이콘은 currentColor stroke 의 svg 이고 이름을 data-icon 으로 든다", () => {
      // Break: 아이콘이 텍스트 글리프(☰·🕒)로 돌아가거나 stroke/fill 계약이 깨진다.
      const icon = deckIcon("plus");
      expect(icon.tagName.toLowerCase()).toBe("svg");
      expect(icon.getAttribute("data-icon")).toBe("plus");
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("stroke")).toBe("currentColor");
      expect(icon.getAttribute("fill")).toBe("none");
      expect(icon.getAttribute("stroke-width")).toBe("1.75");
      expect(icon.getAttribute("width")).toBe("18");
      expect(icon.getAttribute("class")).toContain("ai-deck-icon");
    });

    it("크기 옵션은 width/height 를 함께 바꾼다", () => {
      // Break: size 가 width 에만 적용되거나 무시된다.
      const icon = deckIcon("clock", { size: 15 });
      expect(icon.getAttribute("width")).toBe("15");
      expect(icon.getAttribute("height")).toBe("15");
    });

    it("모든 이름에 그림(path/circle/rect) 이 하나 이상 있다", () => {
      // Break: 사전에 이름만 있고 경로가 비어 빈 사각형이 그려진다.
      for (const name of DECK_ICON_NAMES) {
        const icon = deckIcon(name);
        expect(icon.childNodes.length, name).toBeGreaterThan(0);
      }
    });
  });
});

describe("aiDeckRail", () => {
  isolateTimers();
  describe("aiDeckRail — 데크 상태 레일", () => {
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("이름은 「조수」 이고 헤더·얼굴 클래스는 되살리지 않는다", () => {
      // Break: 레일이 .ai-chat-header / .ai-director-* 이름을 다시 쓰면 aiPanelChrome 계약과 충돌한다.
      // 이름은 조수 하나다 — e9d308b43a 가 「AI」 에서 「조수」 로 바꿨다(머리·레일·접기 버튼이 같은 이름).
      const rail = createDeckRail();
      expect(rail.root.dataset.testid).toBe("ai-deck-rail");
      expect(rail.root.querySelector(".ai-deck-rail-name")?.textContent).toBe("조수");
      expect(rail.root.querySelector(".ai-chat-header")).toBeNull();
      expect(rail.root.querySelector(".ai-director-name")).toBeNull();
      expect(rail.root.querySelector(".ai-director-face")).toBeNull();
    });

    it("맵 맥락은 setContext 로 바뀌고 없으면 비운다", () => {
      // Break: 맵 이름이 갱신되지 않거나 null 에 「null」 글자가 남는다.
      const rail = createDeckRail();
      rail.setContext("시장 마을");
      expect(rail.root.querySelector(".ai-deck-rail-ctx")?.textContent).toBe("시장 마을");
      rail.setContext(null);
      expect(rail.root.querySelector(".ai-deck-rail-ctx")?.textContent).toBe("");
    });

    it("상태는 data-ai-state 하나로 점과 문장 톤이 함께 움직인다", () => {
      // Break: 점 클래스만 바뀌고 dataset 이 안 바뀌면 CSS 헤어라인·알약이 어긋난다.
      const rail = createDeckRail();
      expect(rail.root.dataset.aiState).toBe("idle");
      rail.setState("run");
      expect(rail.root.dataset.aiState).toBe("run");
      const dot = rail.root.querySelector(".ai-deck-rail-dot");
      expect(dot?.dataset.aiState).toBe("run");
      rail.setState("attention");
      expect(rail.root.dataset.aiState).toBe("attention");
      expect(dot?.dataset.aiState).toBe("attention");
    });

    it("액션 슬롯은 비어 있고 상태 슬롯은 기존 ai-status 를 받을 자리다", () => {
      // Break: 레일이 버튼을 스스로 만들면 컴포저와 두 벌이 된다 — 슬롯만 제공해야 한다.
      const rail = createDeckRail();
      expect(rail.actions.childNodes.length).toBe(0);
      const status = document.createElement("span");
      status.dataset.testid = "ai-status";
      rail.statusSlot.append(status);
      expect(rail.root.querySelector("[data-testid='ai-status']")).toBe(status);
    });

    it("상태 톤(idle/running/ok/error) → 데크 상태 사상 — 확인 필요는 톤이 아니라 패널이 직접 setState 한다", () => {
      // Break: 새 톤이 idle 로 조용히 떨어져 진행·확인 필요가 회색으로 보인다.
      expect(deckStateOfTone("idle")).toBe("idle");
      expect(deckStateOfTone("running")).toBe("run");
      expect(deckStateOfTone("ok")).toBe("done");
      expect(deckStateOfTone("error")).toBe("error");
    });
  });
});

describe("aiEntityMentions", () => {
  isolateTimers();
  describe("findEntityMentions", () => {
    it("finds an enemy and an item mentioned in one sentence, in text order", () => {
      const project = createBlankProject();
      project.database.enemies = [
        {
          id: "enemy_goblin",
          name: "고블린",
        } as EnemyRecord,
      ];
      project.database.items = [
        {
          id: "item_potion",
          name: "체력 물약",
        } as ItemRecord,
      ];

      const mentions = findEntityMentions(
        "상점에서 체력 물약을 사고 숲에서 고블린을 처치했다.",
        project
      );

      expect(mentions).toHaveLength(2);
      expect(mentions[0]).toEqual({
        collection: "items",
        id: "item_potion",
        name: "체력 물약",
        record: project.database.items[0],
      });
      expect(mentions[1]).toEqual({
        collection: "enemies",
        id: "enemy_goblin",
        name: "고블린",
        record: project.database.enemies[0],
      });
    });

    it("returns [] for text mentioning nothing, and [] for empty text", () => {
      const project = createBlankProject();
      project.database.enemies = [
        {
          id: "enemy_slime",
          name: "슬라임",
        } as EnemyRecord,
      ];

      expect(findEntityMentions("아무것도 일치하지 않는 문장입니다.", project)).toEqual([]);
      expect(findEntityMentions("", project)).toEqual([]);
      expect(findEntityMentions("   ", project)).toEqual([]);
    });

    it("prefers the longer name: a project with enemies named '슬라임' and '슬라임 왕' and text '슬라임 왕이 나타났다' yields exactly one mention, '슬라임 왕'", () => {
      const project = createBlankProject();
      project.database.enemies = [
        {
          id: "enemy_slime",
          name: "슬라임",
        } as EnemyRecord,
        {
          id: "enemy_king_slime",
          name: "슬라임 왕",
        } as EnemyRecord,
      ];

      const mentions = findEntityMentions("슬라임 왕이 나타났다", project);
      expect(mentions).toHaveLength(1);
      expect(mentions[0]?.name).toBe("슬라임 왕");
      expect(mentions[0]?.id).toBe("enemy_king_slime");
    });

    it("honours the limit argument", () => {
      const project = createBlankProject();
      project.database.items = [
        { id: "item_1", name: "사과 물약" } as ItemRecord,
        { id: "item_2", name: "바나나 물약" } as ItemRecord,
        { id: "item_3", name: "포도 물약" } as ItemRecord,
      ];

      const text = "사과 물약, 바나나 물약, 포도 물약 중 하나를 고르세요.";
      const mentions = findEntityMentions(text, project, 2);
      expect(mentions).toHaveLength(2);
      expect(mentions.map((m) => m.name)).toEqual(["사과 물약", "바나나 물약"]);
    });
  });
  describe("renderEntityMentionStrip", () => {
    let restoreFakeDom: (() => void) | undefined;

    afterEach(() => {
      restoreFakeDom?.();
      restoreFakeDom = undefined;
    });

    it("returns null for [] and, for two mentions, produces a container with testid ai-mention-strip holding two chips whose names match", () => {
      restoreFakeDom = installFakeDom();
      const project = createBlankProject();

      expect(renderEntityMentionStrip([], project)).toBeNull();

      const mentions: EntityMention[] = [
        {
          collection: "enemies",
          id: "enemy_1",
          name: "불도깨비",
          record: { id: "enemy_1", name: "불도깨비" } as EnemyRecord,
        },
        {
          collection: "items",
          id: "item_1",
          name: "마나 포션",
          record: { id: "item_1", name: "마나 포션" } as ItemRecord,
        },
      ];

      const node = renderWithFakeDom(() =>
        renderEntityMentionStrip(mentions, project)!
      ) as FakeElement;

      expect(node).not.toBeNull();
      expect(node.dataset.testid).toBe("ai-mention-strip");
      expect(node.getAttribute("role")).toBe("list");
      expect(node.getAttribute("aria-label")).toBe("언급된 자료");

      const chip1 = findByTestId(node, "ai-mention-enemies-enemy_1");
      const chip2 = findByTestId(node, "ai-mention-items-item_1");

      expect(chip1).not.toBeNull();
      expect(chip2).not.toBeNull();

      expect(chip1?.getAttribute("role")).toBe("listitem");
      expect(chip1?.getAttribute("title")).toBe("불도깨비");
      expect(chip1?.querySelector(".ai-mention-name")?.textContent).toBe("불도깨비");

      expect(chip2?.getAttribute("role")).toBe("listitem");
      expect(chip2?.getAttribute("title")).toBe("마나 포션");
      expect(chip2?.querySelector(".ai-mention-name")?.textContent).toBe("마나 포션");
    });
  });
  // 라이브 턴에서 실측한 오탐(2026-08-26): 기본 프로젝트에는 "map", "ale", "egg", "bell",
  // "bone", "coal" 같은 짧은 순수 ASCII 아이템 이름이 수십 개 있다. 부분 문자열 포함만으로
  // 매칭하면 어시스턴트가 "현재 맵: 이슬 장터 마을 (mapvillage30_100x100)" 이라고 말하는
  // 순간 아이템 "map" 썸네일이 붙는다 — 실제로 브라우저에서 붙는 것을 확인했다.
  // 단어 경계가 없다는 근거는 **한글에만** 해당하므로, ASCII 이름은 경계를 요구한다.
  describe("짧은 ASCII 이름 오탐", () => {
    function projectWithNames(itemNames: string[], enemyNames: string[] = []) {
      const project = createBlankProject();
      project.database.items = itemNames.map((name, i) => ({ id: `item_ascii_${i}`, name }) as ItemRecord);
      project.database.enemies = enemyNames.map((name, i) => ({ id: `enemy_ascii_${i}`, name }) as EnemyRecord);
      return project;
    }

    it('맵 id 문자열 안의 "map" 은 아이템 map 으로 보지 않는다', () => {
      const project = projectWithNames(["map"]);

      expect(findEntityMentions("현재 맵: 이슬 장터 마을 (mapvillage30_100x100)", project)).toEqual([]);
    });

    it("다른 영어 단어에 숨은 짧은 이름도 잡지 않는다", () => {
      const project = projectWithNames(["ale", "egg", "bell", "bone"]);

      const found = findEntityMentions("The female scale bellows; bones remain. eggplant.", project);

      expect(found.map((m) => m.name)).toEqual([]);
    });

    it("독립된 단어로 나오면 ASCII 이름도 정상 매칭한다", () => {
      const project = projectWithNames(["map", "ale"]);

      const found = findEntityMentions("상자에 map 과 ale 을 넣었습니다.", project);

      expect(found.map((m) => m.name).sort()).toEqual(["ale", "map"]);
    });

    it("한글 이름은 그대로 부분 문자열로 매칭한다(경계가 없으므로)", () => {
      const project = projectWithNames([], ["슬라임"]);

      expect(findEntityMentions("슬라임을 광장에 두었습니다.", project).map((m) => m.name)).toEqual(["슬라임"]);
    });
  });
});

// 하네스 타임라인 병합 — 사람이 누른 것과 모델이 한 것이 한 줄기로 흘러야 한다.
//
// 왜 필요한가: 「압축을 누른 직후 턴이 깨졌다」, 「도크를 바꾸자 답장이 사라졌다」류는 두 스트림을
// 따로 보면 절대 안 보인다. 그리고 병합에는 조용한 함정이 하나 있다 — audit 항목 중 `at` 이 없는
// 것들(초기 상태줄)을 빈 문자열로 정렬하면 전부 맨 앞으로 몰려 «순서가 거짓» 이 된다.
describe("aiHarnessTimelineMerge", () => {
  isolateTimers();
  const audit: readonly AuditEntry[] = [
    { kind: "user", text: "석상 좀 고쳐줘", at: "2026-08-30T04:00:00.000Z" },
    { kind: "status", text: "phase:plan" }, // at 없음 — 직전 시각을 물려받아야 한다
    { kind: "tool", name: "set_event", args: {}, ok: true, summary: "이벤트 1건", at: "2026-08-30T04:00:10.000Z" },
  ];
  describe("mergeHarnessTimeline", () => {
    it("interleaves front actions with audit entries by time", () => {
      const merged = mergeHarnessTimeline(audit, [
        { at: "2026-08-30T04:00:05.000Z", seq: 1, surface: "context-panel", action: "context-compact" },
        { at: "2026-08-30T04:00:20.000Z", seq: 2, surface: "panel", action: "turn-rewind" },
      ]);
      expect(
        merged.map((row) => (row.kind === "ui" ? `ui:${row.event.action}` : `audit:${row.entry.kind}`)),
      ).toEqual([
        "audit:user",
        "audit:status", // at 없는 칸이 사용자 발언 뒤에 그대로 남는다
        "ui:context-compact",
        "audit:tool",
        "ui:turn-rewind",
      ]);
    });

    it("puts the audit entry first when the timestamps tie", () => {
      // 액션의 결과가 그 액션보다 앞서 보이면 인과가 뒤집힌다.
      const merged = mergeHarnessTimeline(
        [{ kind: "status", text: "압축 완료", at: "2026-08-30T04:00:05.000Z" }],
        [{ at: "2026-08-30T04:00:05.000Z", seq: 1, surface: "context-panel", action: "context-compact" }],
      );
      expect(merged.map((row) => row.kind)).toEqual(["audit", "ui"]);
    });

    it("returns audit alone when nothing was pressed", () => {
      expect(mergeHarnessTimeline(audit, [])).toHaveLength(audit.length);
      expect(mergeHarnessTimeline([], [])).toHaveLength(0);
    });
  });
});

// test/aiInstructionsModal.test.ts
// 감독 지침 편집 모달 — 저장이 **프로젝트에** 들어가고, 되돌리기 스냅샷을 남기고,
// 세션에 알려 주는지.
//
// 프로젝트에 저장하는 이유(localStorage 가 아닌): 지침은 그 게임의 성질이지 이 브라우저의
// 설정이 아니다. 프로젝트를 옮기면 규칙도 따라가야 한다.
describe("aiInstructionsModal", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  function open(saved: string[]): FakeElement {
    return openAiInstructionsModal({ onSaved: (value) => saved.push(value) }) as unknown as FakeElement;
  }
  function typeInto(backdrop: FakeElement, value: string): void {
    const input = findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement & FakeElement;
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }
  function save(backdrop: FakeElement): void {
    (findByTestId(backdrop, "ai-instructions-save") as unknown as HTMLElement).click();
  }
  beforeEach(() => {
    store.replace(createBlankProject());
    // 히스토리는 모듈 전역이다 — 리셋하지 않으면 앞 케이스가 남긴 동일 서명 스냅샷 때문에
    // pushSnapshot 의 중복 제거가 이번 케이스의 스냅샷을 삼킨다.
    resetMapEditHistory();
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    closeAiInstructionsModal();
    restoreDom?.();
    restoreDom = null;
    vi.restoreAllMocks();
  });
  describe("감독 지침 모달", () => {
    it("Given 지침 없는 프로젝트 When 열기 Then 빈 입력과 0자 카운터", () => {
      const backdrop = open([]);

      expect((findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement).value).toBe("");
      expect(findByTestId(backdrop, "ai-instructions-counter")!.textContent).toBe(`0 / ${AI_INSTRUCTIONS_MAX_CHARS}자`);
    });

    it("Given 이미 저장된 지침 When 열기 Then 그 값이 실려 온다", () => {
      store.update((draft) => {
        draft.aiInstructions = "4방향 이동만 쓴다.";
      });

      const backdrop = open([]);

      expect((findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement).value).toBe("4방향 이동만 쓴다.");
    });

    it("Given 지침 입력 When 저장 Then 프로젝트에 남고 onSaved 로 알리고 모달이 닫힌다", () => {
      const saved: string[] = [];
      const backdrop = open(saved);

      typeInto(backdrop, "  타일셋 B 는 쓰지 마라.\r\n ");
      save(backdrop);

      expect(store.getCurrent().aiInstructions).toBe("타일셋 B 는 쓰지 마라.");
      expect(saved).toEqual(["타일셋 B 는 쓰지 마라."]);
      expect(backdrop.parentElement).toBeNull();
    });

    it("Given 지침 편집 When 저장 Then 되돌리기 스냅샷이 남는다(다른 프로젝트 편집과 동일)", () => {
      const before = getMapEditHistoryMarker();
      const backdrop = open([]);

      typeInto(backdrop, "전투는 턴제다.");
      save(backdrop);

      expect(getMapEditHistoryMarker()).toBeGreaterThan(before);
      expect(getMapEditHistoryState().canUndo).toBe(true);
    });

    it("Given 저장된 지침을 비움 When 저장 Then 필드가 제거된다(빈 문자열을 남기지 않는다)", () => {
      store.update((draft) => {
        draft.aiInstructions = "지울 규칙";
      });
      const saved: string[] = [];
      const backdrop = open(saved);

      typeInto(backdrop, "   ");
      save(backdrop);

      expect("aiInstructions" in store.getCurrent()).toBe(false);
      expect(saved).toEqual([""]);
    });

    it("Given 값을 바꾸지 않고 저장 When 클릭 Then 스냅샷도 onSaved 도 없다(빈 편집은 편집이 아니다)", () => {
      const before = getMapEditHistoryMarker();
      const saved: string[] = [];
      const backdrop = open(saved);

      save(backdrop);

      expect(getMapEditHistoryMarker()).toBe(before);
      expect(saved).toEqual([]);
      expect(backdrop.parentElement).toBeNull();
    });

    it("Given 상한 초과 입력 When 저장 Then 상한에서 잘려 저장된다", () => {
      const backdrop = open([]);

      typeInto(backdrop, "가".repeat(AI_INSTRUCTIONS_MAX_CHARS + 200));
      save(backdrop);

      expect(store.getCurrent().aiInstructions).toHaveLength(AI_INSTRUCTIONS_MAX_CHARS);
    });

    it("Given 입력 중 When 글자 수 변화 Then 카운터가 따라온다", () => {
      const backdrop = open([]);

      typeInto(backdrop, "다섯글자");

      expect(findByTestId(backdrop, "ai-instructions-counter")!.textContent).toBe(`4 / ${AI_INSTRUCTIONS_MAX_CHARS}자`);
    });

    it("Given 닫기 버튼 When 클릭 Then 저장 없이 닫힌다", () => {
      const backdrop = open([]);

      typeInto(backdrop, "저장하지 않을 값");
      (findByTestId(backdrop, "ai-instructions-close") as unknown as HTMLElement).click();

      expect(backdrop.parentElement).toBeNull();
      expect(store.getCurrent().aiInstructions).toBeUndefined();
    });
  });
});
