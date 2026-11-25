import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { battlePanel } from "@/editor/panels/actorRecordBattlePanels";
import { createBlankProject, createBlankMap } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { Window } from "happy-dom";
import { createActivityTrace, recordActivityEvent } from "@/ai/activityTrace";
import type { ActivityVisual } from "@/ai/activityVisual";
import { briefActivityVisuals, createActivityView } from "@/editor/panels/aiActivityView";
import { setActivityLevel, createActivityLevelControl, getActivityLevel } from "@/editor/panels/aiActivityPreference";
import { createInlineWorkCard } from "@/editor/panels/aiInlineWorkCard";
import { attachImage, releaseDetachedActivityImages, retainedActivityImageUrlCount } from "@/editor/panels/aiActivityMedia";
import { isAiLiveCanvasEnabled, setAiLiveCanvasEnabled } from "@/editor/aiLiveCanvas";
import { createTeamBoardState, reduceTeamBoard } from "@/ai/piAgent/teamBoardState";
import { createTeamTranscript } from "@/editor/panels/aiTeamTranscript";
import { createTeamWorkPane } from "@/editor/panels/aiTeamWorkPane";
import { createTeamBoard } from "@/editor/panels/aiTeamBoard";
import { createAiTeamSidebar } from "@/editor/panels/aiTeamSidebar";
import { createStudioShell } from "@/editor/panels/aiStudioShell";
import { publishTeamActivity } from "@/ai/piAgent/teamActivity";
import { createConversationLogHost } from "@/editor/panels/aiConversationLog";
import { activityEntryIndex } from "@/editor/panels/aiActivityIndex";
import { assistantIdleHints, directorStartPrompts, formatComposerPlaceholder, idlePresenceLine, nextStepHint, readAgentBrief } from "@/editor/panels/aiAgentBrief";
import { editorState } from "@/editor/editorState";
import { buildEditorReferenceIndex, type EditorReferenceIndex, type EditorReferenceTarget } from "@/editor/aiAnswerLinks";
import { decorateEditorReferences, renderAssistantAnswer } from "@/editor/panels/aiAnswerLinkRender";
import type { Project, GameMap } from "@/project/types";
import { renderMarkdown } from "@/util/markdown";
import { changeCountsLine, changedSinceRun, listChangeItems, revertChangeItem } from "@/editor/panels/aiChangeSummaryCard";
import { runTool } from "@/editor/tools";
import { isReadOnlyToolNoise, phaseStatusText, shouldShowStatusInChat } from "@/editor/panels/aiChatPanelHelpers";
import { formatAiRunningStatus, parseAutonomousRunBudget, renderToolActivityEntry, renderWorkPlanChecklist } from "@/editor/panels/aiChatRenderers";
import type { WorkPlan } from "@/ai/workPlan";
import { AUTONOMY_LEVELS, type AutonomyLevel } from "@/ai/autonomyLevels";
import { createComposerElements, type ComposerElements } from "@/editor/panels/aiComposer";
import { contextUsagePercent, contextUsageTone, createAiContextMeter, formatContextMeterLabel, type AiContextSnapshot } from "@/editor/panels/aiContextMeter";
import type { ContextUsage } from "@/ai/contextCompaction";
import { EMPTY_SESSION_USAGE, addSessionUsage } from "@/ai/sessionUsage";
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

describe("aiActivityPreference", () => {
  isolateTimers();
  describe("aiActivityBriefClutter", () => {
    isolateTimers();
    // 2026-09-23 도그푸딩(등대지기의 겨울): 조수 창이 조회한 초상화 6장과 개발자용 변경 집계
    // 「타일 2536 · 이벤트 +157 · 맵 속성 2 · DB 11 · …」로 덮였고, 생성 중 콘솔에
    // `blob:… net::ERR_FILE_NOT_FOUND` 가 ~200건 찍혔다.
    let window: Window;
    beforeEach(() => {
      window = new Window();
      vi.stubGlobal("document", window.document);
      vi.stubGlobal("localStorage", window.localStorage);
      vi.stubGlobal("Event", window.Event);
      vi.stubGlobal("Node", window.Node);
      vi.stubGlobal("MutationObserver", window.MutationObserver);
      vi.stubGlobal("HTMLDetailsElement", window.HTMLDetailsElement);
      setActivityLevel("brief");
    });
    // 그림 칸은 비동기로 채워진다 — 전역을 풀기 전에 그 작업이 끝나게 둔다.
    afterEach(async () => { await new Promise(resolve => setTimeout(resolve, 50)); vi.unstubAllGlobals(); });
    const portrait = (i: number): ActivityVisual => ({ kind: "asset", title: `인물 ${i}`, caption: "캐릭터", phase: "read", target: `actor:${i}` });
    const mapShot = (phase: ActivityVisual["phase"]): ActivityVisual => ({ kind: "record", title: "성에항", caption: "맵", phase, target: "map:harbor" });
    describe("간단히 보기는 조수 창을 그림 앨범으로 만들지 않는다", () => {
      it("조회로 읽은 그림(확인한 모습)은 그리지 않고, 바꾼 그림은 마지막 한 쌍까지만 그린다", () => {
        expect(briefActivityVisuals([portrait(1), portrait(2)].map((v, i) => ({ id: String(i), title: v.title, phase: v.phase, target: v.target, kind: v.kind })))).toEqual([]);
        const view = createActivityView({ archive: false });
        document.body.append(view.root);
        let trace = createActivityTrace("생성");
        trace = recordActivityEvent(trace, { type: "tool_end", id: "look", name: "get_project_summary", ok: true, summary: "프로젝트 확인", visuals: [1, 2, 3, 4, 5, 6].map(portrait) });
        view.update(trace);
        expect(view.root.querySelectorAll(".ai-media-figure")).toHaveLength(0);

        trace = recordActivityEvent(trace, { type: "tool_end", id: "paint", name: "place_tiles", ok: true, summary: "길 깔기", visuals: [mapShot("before"), mapShot("draft"), mapShot("before"), mapShot("draft")] });
        view.update(trace);
        expect(view.root.querySelectorAll(".ai-media-figure")).toHaveLength(2);

        setActivityLevel("detail");
        expect(view.root.querySelectorAll(".ai-media-figure")).toHaveLength(10);
      });

      it("변경 집계 원문 줄은 자세히 보기에서만 보인다", () => {
        const card = createInlineWorkCard({ title: "등대지기의 겨울", onStop: () => {} });
        document.body.append(card.root);
        const project = { maps: {} };
        card.attachChange({ mapId: "m", before: project, after: project, chips: ["타일 2536", "이벤트 +157", "DB 11"] } as never);
        const line = card.root.querySelector<HTMLElement>("[data-testid='ai-work-card-changed']")!;
        expect(line.textContent).toBe("타일 2536 · 이벤트 +157 · DB 11");
        expect(line.hidden).toBe(true);
        setActivityLevel("detail");
        expect(line.hidden).toBe(false);
        setActivityLevel("brief");
        expect(line.hidden).toBe(true);
      });
    });
    describe("활동 그림 Blob URL 은 그림이 읽히기 전에 풀리지 않는다", () => {
      it("읽는 중이거나 아직 붙지 않은 그림은 두고, 붙었다 떨어진 뒤 다 읽힌 그림만 푼다", async () => {
        const revoked: string[] = [];
        let serial = 0;
        // 생성자는 남긴다 — happy-dom 이 img.src 를 `new URL` 로 해석한다.
        const RealURL = globalThis.URL;
        vi.stubGlobal("URL", Object.assign(class extends RealURL {}, { createObjectURL: () => `blob:http://localhost/${++serial}`, revokeObjectURL: (url: string) => { revoked.push(url); } }));
        const complete = new Map<unknown, boolean>();
        const proto = window.HTMLImageElement.prototype as unknown as object;
        Object.defineProperty(proto, "complete", { configurable: true, get() { return complete.get(this) ?? false; } });

        const before = retainedActivityImageUrlCount();
        // ① 카드가 로그에 붙기 전에 그림이 준비됐다 — 떨어진 게 아니라 아직 안 붙은 것이다.
        const early = document.createElement("span");
        attachImage(early as unknown as HTMLElement, new Blob(["png"]), "초안");
        const earlyImage = early.querySelector("img")!;
        complete.set(earlyImage, true);
        releaseDetachedActivityImages();
        expect(revoked).toEqual([]);
        document.body.append(early);
        releaseDetachedActivityImages();

        // ② 붙어 있다가 행이 교체돼 떨어졌지만 아직 읽는 중 — 풀면 ERR_FILE_NOT_FOUND 다.
        const row = document.createElement("span");
        document.body.append(row);
        attachImage(row as unknown as HTMLElement, new Blob(["png"]), "변경 전");
        const rowImage = row.querySelector("img")!;
        releaseDetachedActivityImages();
        row.remove();
        releaseDetachedActivityImages();
        expect(revoked).toEqual([]);
        // 다 읽힌 뒤에는 푼다.
        complete.set(rowImage, true);
        releaseDetachedActivityImages();
        expect(revoked).toEqual(["blob:http://localhost/2"]);

        // ③ 한 번도 붙지 않은 그림도 유예 시간이 지나면 푼다(누수 방지).
        releaseDetachedActivityImages(Date.now() + 60_000);
        expect(revoked).toEqual(["blob:http://localhost/2"]);
        early.remove();
        releaseDetachedActivityImages();
        expect(revoked).toEqual(["blob:http://localhost/2", "blob:http://localhost/1"]);
        expect(retainedActivityImageUrlCount()).toBe(before);
        delete (proto as { complete?: boolean }).complete;
      });
    });
  });
  describe("aiActivityView", () => {
    isolateTimers();
    beforeEach(() => {
      const window = new Window();
      vi.stubGlobal("document", window.document);
      vi.stubGlobal("localStorage", window.localStorage);
      vi.stubGlobal("Event", window.Event);
      // el() 은 `child instanceof Node` 로 자식을 가른다 — document 만 바꾸면 Node 가 없어 전부 터졌다.
      vi.stubGlobal("Node", window.Node);
      vi.stubGlobal("HTMLDetailsElement", window.HTMLDetailsElement);
      setActivityLevel("brief");
      setAiLiveCanvasEnabled(true);
    });
    afterEach(() => {
      setAiLiveCanvasEnabled(true);
      vi.unstubAllGlobals();
    });
    const visibleText = (root: HTMLElement): string => {
      const notice = root.querySelector<HTMLElement>("p[role='status']");
      return `${root.querySelector(".ai-activity-entries")?.textContent ?? ""}\n${notice && !notice.hidden ? notice.textContent : ""}`;
    };
    describe("AI activity display levels", () => {
      it("defaults to brief and synchronizes existing main/member views without executing work", () => {
        expect(getActivityLevel()).toBe("brief");
        const main = createActivityView({ archive: false });
        const member = createActivityView({ archive: false });
        const control = createActivityLevelControl();
        document.body.append(main.root, member.root, control);
        let trace = createActivityTrace("조회");
        for (let i = 0; i < 12; i++) trace = recordActivityEvent(trace, { type: "tool_end", id: String(i), name: "get_map_region", ok: true, summary: "영역 확인" });
        main.update(trace); member.update(trace);
        expect(main.root.querySelectorAll(".ai-activity-entry").length).toBeLessThanOrEqual(4);
        setActivityLevel("trace");
        expect(main.root.querySelectorAll(".ai-activity-entry")).toHaveLength(12);
        expect(member.root.dataset.level).toBe("trace");
        expect(control.querySelector('[aria-pressed="true"]')?.getAttribute("data-activity-level")).toBe("trace");
        setActivityLevel("none");
        expect(main.root.hidden).toBe(true);
        setActivityLevel("detail");
        expect(main.root.hidden).toBe(false);
        expect(main.root.querySelectorAll(".ai-activity-entry")).toHaveLength(12);
      });

      it("toggles map construction visuals without changing the work log", () => {
        const control = createActivityLevelControl();
        document.body.append(control);
        const button = control.querySelector("[data-testid='ai-live-canvas']");
        expect(button?.getAttribute("aria-pressed")).toBe("true");
        expect(isAiLiveCanvasEnabled()).toBe(true);
        (button as HTMLButtonElement).click();
        expect(isAiLiveCanvasEnabled()).toBe(false);
        expect(button?.getAttribute("aria-pressed")).toBe("false");
        expect(getActivityLevel()).toBe("brief");
        (button as HTMLButtonElement).click();
        expect(isAiLiveCanvasEnabled()).toBe(true);
      });
      it("간단히 보기는 개발 용어·단계 번호·소요 시간 없이 하는 일만 말한다", () => {
        // 2026-09-23 실측 줄: `Ultrabrain · 계획`, `consult writer · 실행 중`, `시공 · 8.7초`,
        // `모델 응답 대기 · 6번째 단계`, `도구 찾기 · 2건 확인·처리`, `DB 읽기`, `타일셋 참고 읽기`.
        const view = createActivityView({ archive: false }); document.body.append(view.root);
        let trace = createActivityTrace("숲속 마을");
        trace = recordActivityEvent(trace, { type: "agent_spawn", agentId: "ultrabrain-plan", role: "orchestrator", mapId: null, mapName: null, task: "t", label: "Ultrabrain · 계획" });
        trace = recordActivityEvent(trace, { type: "agent_spawn", agentId: "map_a", role: "builder", mapId: "map_a", mapName: null, task: "t" });
        trace = recordActivityEvent(trace, { type: "tool_end", id: "f1", name: "find_tools", ok: true, summary: "도구 2개", durationMs: 8700 }, "map_a");
        trace = recordActivityEvent(trace, { type: "tool_end", id: "f2", name: "find_tools", ok: true, summary: "도구 1개", durationMs: 8700 }, "map_a");
        trace = recordActivityEvent(trace, { type: "tool_end", id: "d1", name: "get_database_records", ok: true, summary: "items 1건 / 1건" }, "map_a");
        trace = recordActivityEvent(trace, { type: "tool_start", id: "w1", name: "consult_writer", args: {} }, "map_a");
        trace = recordActivityEvent(trace, { type: "turn", index: 6 }, "map_a");
        view.update(trace);
        // 숨긴 필터·메타 줄(전체 기록 전용)은 빼고, 보이는 행과 안내 줄만 읽는다.
        const text = visibleText(view.root);
        expect(text).toContain("대사 쓰는 중");
        expect(text).toContain("생각하는 중");
        for (const jargon of ["Ultrabrain", "consult", "시공", "초", "번째 단계", "확인·처리", "DB", "items", "모델 응답 대기"]) expect(text).not.toContain(jargon);

        // 자세히 보기는 그대로 — 원래 이름·건수가 남는다.
        setActivityLevel("detail");
        const detail = visibleText(view.root);
        expect(detail).toContain("consult writer · 실행 중");
        expect(detail).toContain("DB 읽기");
      });

      it("간단히 보기는 조수가 회복한 도구 실패를 「실패」 로 적지 않고, 자세히 보기에는 남긴다", () => {
        const view = createActivityView({ archive: false }); document.body.append(view.root);
        let trace = createActivityTrace("스위치");
        trace = recordActivityEvent(trace, { type: "tool_end", id: "s1", name: "rename_switch", ok: false, summary: "번호 충돌" });
        view.update(trace);
        // 가장 최근 실패는 «다른 방법을 찾는 중» 으로, 빨간 표시 없이.
        expect(view.root.textContent).toContain("다른 방법을 찾는 중");
        expect(view.root.textContent).not.toContain("실패");
        expect(view.root.querySelector(".ai-activity-entry.is-error")).toBeNull();
        trace = recordActivityEvent(trace, { type: "tool_end", id: "s2", name: "rename_switch", ok: true, summary: "바꿈" });
        view.update(trace);
        expect(view.root.textContent).not.toContain("실패");
        expect(view.root.textContent).not.toContain("다른 방법을 찾는 중");
        expect(view.root.textContent).toContain("스위치 번호 바꾸기 · 완료");
        setActivityLevel("detail");
        expect(view.root.textContent).toContain("스위치 번호 바꾸기 · 실패");
      });

      it("keeps unchanged rows and open payloads while another tool completes", () => {
        setActivityLevel("trace");
        const view = createActivityView({ archive: false }); document.body.append(view.root);
        let trace = createActivityTrace("작업");
        trace = recordActivityEvent(trace, { type: "tool_end", id: "first", name: "get_event", ok: true, summary: "확인", result: { pages: 2 } });
        view.update(trace);
        const first = view.root.querySelector(".ai-activity-entry") as HTMLDetailsElement;
        first.open = true;
        trace = recordActivityEvent(trace, { type: "tool_end", id: "second", name: "find_events", ok: false, summary: "대상 없음" });
        view.update(trace);
        expect(view.root.querySelector(".ai-activity-entry")).toBe(first);
        expect(first.open).toBe(true);
      });
    });
  });
  describe("aiUiPerformance", () => {
    isolateTimers();
    let window: Window;
    beforeEach(() => {
      window = new Window();
      // A real window supplies add/removeEventListener for studio/modal lifecycle hooks.
      vi.stubGlobal('window', window);
      for (const key of ['document', 'Node', 'Element', 'HTMLElement', 'HTMLDetailsElement', 'Event', 'localStorage', 'MutationObserver'] as const) vi.stubGlobal(key, window[key]);
      setActivityLevel('brief');
    });
    afterEach(() => { publishTeamActivity(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
    function team() {
      let state = createTeamBoardState('team', '마을');
      for (let i = 0; i < 6; i++) state = reduceTeamBoard(state, { type: 'agent_spawn', agentId: 'a' + i, role: 'builder', mapId: 'm' + i, mapName: '장소' + i, task: '배정' + i, label: '팀원' + i });
      return state;
    }
    it('rolls a capped transcript without moving survivors and replaces only a completed tool', () => {
      const tx = createTeamTranscript(); document.body.append(tx.root);
      const rows = Array.from({ length: 200 }, (_, i) => ({ kind: 'tool' as const, id: 't' + i, name: 'paint_tiles', ok: null, summary: '' }));
      let agent = { ...team().agents[0]!, log: rows, droppedLog: 1 }; tx.update(agent);
      const list = tx.root.querySelector('.ai-team-tx-list')!;
      const survivor = list.children[1], unchanged = list.children[5];
      const inserts = vi.spyOn(list, 'insertBefore');
      agent = { ...agent, droppedLog: 2, log: [...rows.slice(1), { ...rows[0]!, id: 'next' }] }; tx.update(agent);
      expect(list.children).toHaveLength(200); expect(list.children[0]).toBe(survivor); expect(inserts).toHaveBeenCalledTimes(1);
      tx.update({ ...agent, log: agent.log.map((row, i) => i === 0 ? { ...row, ok: true, summary: '완료' } : row) });
      expect(list.children[0]).not.toBe(survivor); expect(list.children[4]).toBe(unchanged);
      expect(list.children[0]?.getAttribute('data-state')).toBe('ok'); expect(tx.root.textContent).toContain('이전 2행');
    });
    it('skips hidden transcript work and catches up when the fallback becomes visible', () => {
      const pane = createTeamWorkPane(), state = team(); pane.update(state);
      expect(pane.root.querySelector('.ai-team-tx-list')!.children).toHaveLength(0);
      const members = [...pane.root.querySelectorAll('.ai-team-work-member')]; pane.update({ ...state, report: '완료 보고' });
      expect([...pane.root.querySelectorAll('.ai-team-work-member')]).toEqual(members);
      pane.update({ ...state, trace: undefined }); expect(pane.root.querySelector('.ai-team-tx-task')?.textContent).toContain('배정5');
    });
    it('retains detached studio state and renders once when attached or updated', () => {
      const shell = createStudioShell({ onExit() {}, onFontZoom() {} });
      try {
        const state = team(); const create = vi.spyOn(document, 'createElement');
        publishTeamActivity(state); expect(create).not.toHaveBeenCalled(); create.mockRestore();
        const host = document.createElement('div'), log = document.createElement('div'), bar = document.createElement('div'); host.append(log, bar); document.body.append(host);
        shell.attach(host, { historyLogMount: log, commandBar: bar });
        expect(shell.root.querySelectorAll('[data-testid=lane-team-row]')).toHaveLength(6);
        (shell.root.querySelector('[data-testid=lane-team-row]') as HTMLElement).click();
        const work = shell.root.querySelector('[data-testid=ai-team-work]')!;
        const mutation = vi.spyOn(work, 'setAttribute'); publishTeamActivity({ ...state, report: '마지막 보고' });
        expect(work.textContent).toContain('마지막 보고');
        expect(mutation.mock.calls.filter(([key]) => key === 'data-phase')).toHaveLength(1);
        shell.detach(); publishTeamActivity({ ...state, report: '떨어진 뒤 보고' }); shell.attach(host, { historyLogMount: log, commandBar: bar });
        expect(work.textContent).toContain('떨어진 뒤 보고');
      } finally { shell.dispose(); }
    });
    it('retains member button identity and focus during text updates', () => {
      const sidebar = createAiTeamSidebar({ settings: document.createElement('div') }); document.body.append(sidebar.root);
      try {
        const state = team(); publishTeamActivity(state);
        const rows = [...sidebar.root.querySelectorAll<HTMLElement>('.ai-team-member')]; rows[0]!.focus();
        publishTeamActivity(reduceTeamBoard(state, { type: 'agent_event', agentId: 'a0', event: { type: 'execution_status', name: 'work.progress', summary: '새 진행' } }));
        expect(sidebar.root.querySelectorAll('.ai-team-member')[0]).toBe(rows[0]); expect(document.activeElement).toBe(rows[0]);
        expect(sidebar.root.querySelectorAll('.ai-team-member')[2]).toBe(rows[2]);
        expect(rows[0]!.textContent).toContain('새 진행');
      } finally { sidebar.dispose(); }
    });
    it('shares the media index without retaining pictures of entries dropped from a rolling trace', () => {
      const visual = { id: 'v', kind: 'map' as const, phase: 'draft' as const, title: '맵', target: 'm' };
      const trace = { ...createActivityTrace('test'), entries: [{ id: 'a', actor: 'a', kind: 'tool', name: 'paint_tiles', status: 'ok' as const, at: 1, summary: 'done', visuals: [visual] }] };
      const index = activityEntryIndex(trace); expect(activityEntryIndex({ ...trace })).toBe(index); expect(index.mediaByActor.get('a')).toEqual([visual]);
      expect(activityEntryIndex({ ...trace, entries: [] }).mediaByActor.has('a')).toBe(false);
    });
    it('preserves search, pagination, actor switching and unchanged rows', () => {
      setActivityLevel('trace'); const view = createActivityView({ archive: false }); document.body.append(view.root);
      let trace = createActivityTrace('test'); for (let i = 0; i < 110; i++) trace = recordActivityEvent(trace, { type: 'tool_end', id: 't' + i, name: 'get_event', ok: i % 3 !== 0, summary: '항목' + i }, i % 2 ? 'a' : 'b');
      view.update(trace); expect(view.root.querySelectorAll('.ai-activity-entry')).toHaveLength(50);
      const last = view.root.querySelector('.ai-activity-entries')!.lastElementChild; view.update(trace); expect(view.root.querySelector('.ai-activity-entries')!.lastElementChild).toBe(last);
      [...view.root.querySelectorAll('button')].find(b => b.textContent === '이전 기록 50건 더 보기')!.click(); expect(view.root.querySelectorAll('.ai-activity-entry')).toHaveLength(100);
      view.update(trace, 'a'); expect(view.root.querySelectorAll('.ai-activity-entry')).toHaveLength(50);
      const input = view.root.querySelector('input')!; input.value = '항목109'; input.dispatchEvent(new Event('input')); expect(view.root.querySelectorAll('.ai-activity-entry')).toHaveLength(1);
    });
    it('restores 200 messages with one height read and still scrolls a live append', () => {
      // An empty log is at the bottom (the follow controller samples it once at host creation, aiConversationScroll.ts); history fills it to 900px.
      const log = document.createElement('div'); let reads = 0; Object.defineProperty(log, 'scrollHeight', { get() { reads++; return log.children.length ? 900 : 0; } });
      const host = createConversationLogHost({ log, removeStartScreen() {} });
      reads = 0;
      host.renderConversationEntries(Array.from({ length: 200 }, (_, i) => ({ kind: 'assistant', text: '대답' + i, at: '2026-09-28' })));
      expect(reads).toBe(1); expect(log.querySelectorAll('.ai-command-row')).toHaveLength(200); expect(log.scrollTop).toBe(900);
      host.appendBubble('assistant', '다음'); expect(reads).toBe(2);
    });
    it('does not construct permanently hidden legacy board rows', () => {
      const state = team(), board = createTeamBoard(state); document.body.append(board.root); board.update(state);
      expect(board.root.querySelectorAll('.ai-team-agent')).toHaveLength(0); expect(board.root.querySelectorAll('.ai-activity-entry').length).toBeGreaterThan(0);
    });
    it('inspects only changed media subtrees and preserves images moved within the document', async () => {
      const RealURL = URL, revoke = vi.fn(); vi.stubGlobal('URL', Object.assign(class extends RealURL {}, { createObjectURL: () => 'blob:http://localhost/test', revokeObjectURL: revoke }));
      const surface = document.createElement('div'); document.body.append(surface); attachImage(surface, new Blob(['x']), 'picture');
      const image = surface.querySelector('img')!; let reads = 0;
      Object.defineProperty(image, 'isConnected', { get() { reads++; return document.body.contains(image); } }); Object.defineProperty(image, 'complete', { get() { return true; } });
      await new Promise(resolve => setTimeout(resolve, 5)); reads = 0;
      const text = document.createTextNode('unrelated'); document.body.append(text); text.remove(); await new Promise(resolve => setTimeout(resolve, 5)); expect(reads).toBe(0);
      surface.remove(); document.body.append(surface); await new Promise(resolve => setTimeout(resolve, 5)); expect(revoke).not.toHaveBeenCalled();
      surface.remove(); await new Promise(resolve => setTimeout(resolve, 5)); expect(revoke).toHaveBeenCalledOnce(); releaseDetachedActivityImages();
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
