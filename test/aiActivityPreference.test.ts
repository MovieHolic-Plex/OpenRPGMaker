import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { isolateTimers } from "./mergedTeardown";

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
