// 스튜디오 셸: 장면 | 모니터 | 오른쪽 채팅 + 아래 덱(레인 보드, 그리드 행 — 2026-09-17 §11).
// 기본 입력줄 캡슐은 건드리지 않고, is-studio 일 때만 이 레이아웃이 산다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addChildMap, addMap } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createStudioShell } from "@/editor/panels/aiStudioShell";
import { createLaneManager } from "@/editor/panels/aiLaneManager";
import { resetLaneSessionForTest } from "@/editor/panels/aiLaneSession";
import { publishTeamActivity } from "@/ai/piAgent/teamActivity";
import { createTeamBoardState, reduceTeamBoard } from "@/ai/piAgent/teamBoardState";
import { renderTopbar } from "@/editor/panels/menu";
import { laneSession } from "@/editor/panels/aiLaneSession";
import { LANE_BOARD_EMPTY_TEXT } from "@/editor/panels/aiLaneBoard";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(() => {
  store.replace(createBlankProject());
  resetLaneSessionForTest();
  resetMapEditHistory();
  restoreDom = installFakeDom();
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
  editorState.set({
    currentMapId: store.getCurrent().startMapId,
    layer: "lower",
    tool: "paint",
    selection: null,
  });
});

afterEach(() => {
  publishTeamActivity(null);
  teardownAiChatPanel();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

function renderPanel(): FakeElement {
  const panel = renderWithFakeDom(() => renderAiChatPanel());
  findByTestId(panel, "ai-collapsed-restore")?.click();
  return panel;
}

describe("스튜디오 셸 단독", () => {
  it("덱 탭은 레인·변경·활동이고, 레인 0 이면 한 줄 안내, 작업 계획은 감독 스레드 위 슬롯에 선다", () => {
    const host = new FakeElement("div");
    const log = new FakeElement("div");
    log.className = "ai-history-log-mount";
    const bar = new FakeElement("div");
    bar.className = "ai-command-bar";
    bar.dataset.testid = "ai-command-bar";
    host.append(log, bar);

    const shell = createStudioShell({ onExit: () => {}, onFontZoom: () => {} });
    shell.attach(host as unknown as HTMLElement, {
      historyLogMount: log as unknown as HTMLElement,
      commandBar: bar as unknown as HTMLElement,
    });
    const root = shell.root as unknown as FakeElement;

    expect(findByTestId(root, "ai-studio-scenes")).toBeTruthy();
    expect(findByTestId(root, "ai-studio-monitor")).toBeTruthy();
    expect(findByTestId(root, "ai-studio-chat")).toBeTruthy();
    expect(findByTestId(root, "ai-studio-deck")).toBeTruthy();
    expect((findByTestId(root, "ai-studio-composer") as FakeElement).childNodes).toContain(bar);
    // 탭 셋 — 도구·작업·기획·새 레인 탭은 없다(§11 결정 3).
    expect(findByTestId(root, "ai-studio-tab-lanes")?.className).toContain("is-on");
    expect(findByTestId(root, "ai-studio-tab-changes")).toBeTruthy();
    expect(findByTestId(root, "ai-studio-tab-activity")).toBeTruthy();
    for (const gone of ["tools", "work", "planning", "newLane"]) expect(findByTestId(root, `ai-studio-tab-${gone}`)).toBeNull();
    // 레인 0 — 한 줄 미니 상태.
    expect(findByTestId(root, "lane-board-empty")?.textContent).toContain(LANE_BOARD_EMPTY_TEXT);
    expect(findByTestId(root, "ai-studio-deck")?.className).toContain("is-empty");
    expect(shell.root.textContent).not.toContain("Canonical");

    findByTestId(root, "ai-studio-tab-changes")?.click();
    expect(shell.root.textContent).toContain("아직 비교할 변경이 없습니다");

    // 자율 실행 체크리스트는 덱이 아니라 감독 스레드 위 슬롯이다.
    const workSlot = findByTestId(root, "ai-studio-work-slot");
    expect(workSlot?.getAttribute("hidden")).not.toBeNull();
    shell.setWorkPlan({
      id: "plan",
      goal: "우물을 놓는다",
      createdAt: "0",
      currentLayerIndex: 0,
      currentItemId: "a",
      layers: [{
        id: "l1",
        title: "광장",
        items: [
          { id: "a", title: "광장 비우기", instruction: "", status: "done" },
          { id: "b", title: "우물", instruction: "", status: "pending" },
        ],
      }],
    }, true);
    expect(workSlot?.getAttribute("hidden")).toBeNull();
    expect(workSlot?.textContent).toContain("광장 비우기");
    expect(workSlot?.textContent).toContain("완료");
    expect(workSlot?.textContent).toContain("우물");
    shell.setWorkPlan(null, false);
    expect(workSlot?.getAttribute("hidden")).not.toBeNull();

    shell.detach();
    expect(host.childNodes).toContain(log);
    expect(host.childNodes).toContain(bar);
  });
});

describe("패널 스튜디오 모드", () => {
  it("기본 부팅은 입력줄 캡슐이고 스튜디오 셸이 없다", () => {
    const panel = renderPanel();
    expect(panel.classList.contains("is-studio")).toBe(false);
    expect(findByTestId(panel, "ai-studio-shell")).toBeNull();
    expect(panel.dataset.logSlot).toBe("glass");
    expect(findByTestId(panel, "ai-command-bar")).toBeTruthy();
  });

  it("톱바 스튜디오와 숨은 훅이 같은 셸을 열고, ☰ 에는 없다", () => {
    const panel = renderPanel();
    const topbar = new FakeElement("div");
    renderTopbar(topbar as unknown as HTMLElement);
    const menu = findByTestId(panel, "ai-command-menu");
    expect(findByTestId(menu!, "ai-studio-toggle")).toBeNull();
    expect(findByTestId(menu!, "ai-command-menu-studio")).toBeNull();
    expect(findByTestId(topbar, "topbar-ai-studio")).toBeTruthy();

    findByTestId(panel, "ai-studio-toggle")?.click();
    expect(panel.classList.contains("is-studio")).toBe(true);
    expect(findByTestId(panel, "ai-studio-shell")).toBeTruthy();
    expect(panel.dataset.logSlot).toBe("history");
    const logParent = findByTestId(panel, "ai-chat-log")?.parentNode;
    expect(logParent instanceof FakeElement ? logParent.className : "").toContain("ai-history-log-mount");
    const barParent = findByTestId(panel, "ai-command-bar")?.parentNode;
    expect(barParent instanceof FakeElement ? barParent.className : "").toContain("ai-studio-composer");
    expect(findByTestId(panel, "ai-studio-scene")?.textContent).toContain("빈 맵");
    expect(storage.get("oprn:ai-studio")).toBe("1");
  });

  it("스튜디오를 끄면 입력줄 캡슐로 돌아가고 로그는 유리 마운트다", () => {
    const panel = renderPanel();
    findByTestId(panel, "ai-studio-toggle")?.click();
    expect(findByTestId(panel, "ai-studio-shell")).toBeTruthy();

    findByTestId(panel, "ai-studio-toggle")?.click();
    expect(panel.classList.contains("is-studio")).toBe(false);
    expect(findByTestId(panel, "ai-studio-shell")).toBeNull();
    expect(panel.dataset.logSlot).toBe("glass");
    const logParent = findByTestId(panel, "ai-chat-log")?.parentNode;
    expect(logParent instanceof FakeElement ? logParent.className : "").toContain("ai-glass-log");
    // 데크(2026-09-03): 입력줄은 패널 직속이 아니라 데크(레일·기록·컴포저 한 표면) 안으로 돌아온다.
    expect(findByTestId(panel, "ai-command-bar")?.parentElement).toBe(findByTestId(panel, "ai-deck"));
    expect(storage.get("oprn:ai-studio")).toBe("0");
  });

  it("모니터는 살아 있는 맵 캔버스를 들이고, 도구는 「모든 도구」 버튼 하나로 나간다", () => {
    const body = (globalThis.document as unknown as { body: FakeElement }).body;
    const shellWrap = new FakeElement("div");
    shellWrap.className = "editor-canvas-scroll-shell";
    const canvas = new FakeElement("div");
    canvas.dataset.testid = "edit-canvas";
    canvas.setAttribute("data-testid", "edit-canvas");
    shellWrap.append(canvas);
    body.append(shellWrap);

    const panel = renderPanel();
    findByTestId(panel, "ai-studio-toggle")?.click();

    const monitor = findByTestId(panel, "ai-studio-monitor-stage");
    expect(monitor?.querySelector("[data-testid=edit-canvas]")).toBeTruthy();
    expect(findByTestId(panel, "ai-studio-monitor-thumb")).toBeNull();

    expect(findByTestId(panel, "ai-studio-tools-all")).toBeTruthy();
    expect(findByTestId(panel, "ai-studio-tool-card")).toBeNull();

    findByTestId(panel, "ai-studio-toggle")?.click();
    expect(body.querySelector("[data-testid=edit-canvas]")).toBeTruthy();
  });
});

// ── 2026-09-03 재개편(「장면 콘솔」) — docs/superpowers/specs/2026-09-03-ai-studio-console-design.md ──
function standaloneShell(options: Partial<Parameters<typeof createStudioShell>[0]> = {}) {
  const host = new FakeElement("div");
  const log = new FakeElement("div");
  log.className = "ai-history-log-mount";
  const chatLog = new FakeElement("div");
  chatLog.className = "ai-chat-log";
  chatLog.dataset.testid = "ai-chat-log";
  log.append(chatLog);
  const bar = new FakeElement("div");
  bar.className = "ai-command-bar";
  bar.dataset.testid = "ai-command-bar";
  host.append(log, bar);
  const shell = createStudioShell({ onExit: () => {}, onFontZoom: () => {}, ...options });
  shell.attach(host as unknown as HTMLElement, {
    historyLogMount: log as unknown as HTMLElement,
    commandBar: bar as unknown as HTMLElement,
  });
  const root = shell.root as unknown as FakeElement;
  return { shell, root, host, chatLog };
}

/** hidden 은 속성으로도 프로퍼티로도 쓴다 — 둘 중 하나면 숨김이다. */
function isHidden(target: FakeElement | null | undefined): boolean {
  if (!target) return true;
  return target.hidden === true || target.getAttribute("hidden") !== null;
}

function fire(target: FakeElement, type: string, value?: string): void {
  if (value !== undefined) (target as unknown as { value: string }).value = value;
  target.dispatchEvent(new Event(type));
}

describe("스튜디오 콘솔(재개편)", () => {
  it("장면 행은 썸네일·크기·시작 배지를 달고, 검색이 행을 걸러낸다", () => {
    const { root } = standaloneShell();
    const startId = store.getCurrent().startMapId;
    const thumb = findByTestId(root, `ai-studio-thumb-${startId}`);
    expect(thumb?.tagName).toBe("CANVAS");
    const row = findByTestId(root, "ai-studio-scene");
    expect(row?.textContent).toContain("빈 맵");
    expect(row?.textContent).toMatch(/\d+×\d+/u);
    expect(row?.textContent).toContain("시작");

    const search = findByTestId(root, "ai-studio-scene-search");
    expect(search).toBeTruthy();
    fire(search!, "input", "zzz-없는-이름");
    expect(findByTestId(root, "ai-studio-scene")).toBeNull();
    expect(root.textContent).toContain("맞는 장면이 없습니다");
    fire(search!, "input", "빈");
    expect(findByTestId(root, "ai-studio-scene")?.textContent).toContain("빈 맵");
  });

  it("「새 장면」은 맵을 만들어 곧바로 선택한다", () => {
    const { root } = standaloneShell();
    const before = Object.keys(store.getCurrent().maps).length;
    findByTestId(root, "ai-studio-scene-add")?.click();
    const maps = store.getCurrent().maps;
    expect(Object.keys(maps).length).toBe(before + 1);
    const current = editorState.get().currentMapId;
    expect(current && maps[current]?.name).toContain("새 장면");
    expect(findByTestId(root, "ai-studio-monitor-label")?.textContent).toContain("새 장면");
  });

  it("모니터 머리띠에 장면 이름과 크기 칩이 있고 「편집기로」가 onExit 를 부른다", () => {
    let exited = 0;
    const { root } = standaloneShell({ onExit: () => { exited += 1; } });
    expect(findByTestId(root, "ai-studio-monitor-label")?.textContent).toContain("빈 맵");
    expect(findByTestId(root, "ai-studio-monitor-meta")?.textContent).toMatch(/\d+×\d+/u);
    findByTestId(root, "ai-studio-exit")?.click();
    expect(exited).toBe(1);
  });

  it("조수 상태는 유휴면 「대기 중」, 일할 때는 문장을 그대로 보인다", () => {
    const { shell, root } = standaloneShell();
    const status = findByTestId(root, "ai-studio-status");
    shell.setStatus("대기");
    expect(status?.textContent).toBe("대기 중");
    expect(status?.dataset.state).toBe("idle");
    shell.setStatus("맵 짓는 중…");
    expect(status?.textContent).toBe("맵 짓는 중…");
    expect(status?.dataset.state).toBe("busy");
  });

  it("활동 탭은 도구 호출 줄을 최신순으로 보이고 배지로 개수를 센다", () => {
    const { shell, root } = standaloneShell();
    shell.setToolLines(["paint_road → 길 12칸", "place_npc → 상인"]);
    const tab = findByTestId(root, "ai-studio-tab-activity");
    expect(tab?.textContent).toContain("2");
    tab?.click();
    const pane = findByTestId(root, "ai-studio-activity");
    expect(pane?.textContent).toContain("paint_road");
    expect(pane?.textContent).toContain("place_npc");
    expect(pane?.textContent?.indexOf("paint_road")).toBeLessThan(pane?.textContent?.indexOf("place_npc") ?? -1);
  });

  it("덱은 기본 펼침이고 ⌄ 로 접으면 머리 한 줄만 남는다", () => {
    const { root } = standaloneShell();
    const deck = findByTestId(root, "ai-studio-deck");
    const toggle = findByTestId(root, "ai-studio-deck-collapse");
    expect(deck?.className).not.toContain("is-collapsed");
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    toggle?.click();
    expect(deck?.className).toContain("is-collapsed");
    expect(root.className).toContain("is-deck-collapsed");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    // 접힌 채로 탭을 고르면 다시 펼친다.
    findByTestId(root, "ai-studio-tab-activity")?.click();
    expect(deck?.className).not.toContain("is-collapsed");
  });

  it("덱은 그리드 행이다 — 오버레이·드로워·손잡이가 없다(§11 결정 2)", () => {
    const { root } = standaloneShell();
    expect(root.className).not.toContain("is-deck-overlay");
    expect(findByTestId(root, "ai-studio-deck-handle")).toBeNull();
    expect(findByTestId(root, "ai-studio-split-deck")).toBeNull();
    expect(findByTestId(root, "ai-studio-deck")?.className).not.toContain("is-drawer");
    expect(findByTestId(root, "ai-studio-left")).toBeNull();
  });

  it("refreshMonitor 는 attach 뒤에 나타난 캔버스를 입양한다", () => {
    // 부팅: persist 된 스튜디오가 캔버스보다 먼저 attach 되면 빈 자리가 고정됐다.
    const { shell, root } = standaloneShell();
    const stage = findByTestId(root, "ai-studio-monitor-stage");
    expect(stage?.querySelector("[data-testid=ai-studio-monitor-empty]")).toBeTruthy();
    expect(stage?.querySelector("[data-testid=edit-canvas]")).toBeNull();

    const body = (globalThis.document as unknown as { body: FakeElement }).body;
    const canvas = new FakeElement("div");
    canvas.dataset.testid = "edit-canvas";
    canvas.setAttribute("data-testid", "edit-canvas");
    const zoom = new FakeElement("div");
    zoom.dataset.testid = "editor-zoom-controls";
    zoom.setAttribute("data-testid", "editor-zoom-controls");
    body.append(canvas, zoom);

    shell.refreshMonitor();
    expect(stage?.querySelector("[data-testid=edit-canvas]")).toBe(canvas);
    expect(stage?.querySelector("[data-testid=ai-studio-monitor-empty]")).toBeNull();
    expect(findByTestId(root, "ai-studio-monitor-chrome")?.querySelector("[data-testid=editor-zoom-controls]")).toBe(zoom);

    shell.detach();
    expect(body.querySelector("[data-testid=edit-canvas]")).toBe(canvas);
    expect(body.querySelector("[data-testid=editor-zoom-controls]")).toBe(zoom);
  });

  it("좌·우 손잡이가 있고 키보드로 크기를 조절한다", () => {
    // Break: 손잡이가 없거나 키 입력이 크기에 닿지 않아 고정 폭으로 굳는다.
    const { root } = standaloneShell();
    const shell = root;
    const scenes = findByTestId(root, "ai-studio-split-scenes");
    const chat = findByTestId(root, "ai-studio-split-chat");
    expect(scenes?.getAttribute("role")).toBe("separator");
    expect(chat?.getAttribute("role")).toBe("separator");
    const before = shell?.style.getPropertyValue("--studio-scenes-col");
    expect(before).toContain("px");
    // FakeDom에는 KeyboardEvent 생성자가 없어 일반 Event에 key를 얹는다.
    const key = (name: string): Event => Object.assign(new Event("keydown", { bubbles: true }), { key: name });
    scenes?.dispatchEvent(key("ArrowRight"));
    const after = shell?.style.getPropertyValue("--studio-scenes-col");
    expect(after).not.toBe(before);
    expect(Number.parseInt(after ?? "0", 10)).toBeGreaterThan(Number.parseInt(before ?? "0", 10));
    chat?.dispatchEvent(key("Home"));
    expect(shell?.style.getPropertyValue("--studio-chat-col")).toBe("280px");
    // 더블클릭이면 기본값(장면 252 / 조수 400 / 덱 236)으로 돌아온다.
    scenes?.dispatchEvent(new Event("dblclick", { bubbles: true }));
    expect(shell?.style.getPropertyValue("--studio-scenes-col")).toBe("252px");
    // 크기는 localStorage에 남아 다음 부팅에도 산다.
    const saved = JSON.parse(storage.get("oprn:ai-studio-layout") ?? "{}") as Record<string, unknown>;
    expect(typeof saved.scenes).toBe("number");
    expect(typeof saved.chat).toBe("number");
    // 덱 높이는 CSS 가 소유한다(§11) — 저장 레이아웃에 deck 키가 없다.
    expect(saved.deck).toBeUndefined();
  });

  it("장면 레일과 조수 열을 접으면 셸에 접힘 클래스가 붙는다", () => {
    const { root } = standaloneShell();
    const scenesToggle = findByTestId(root, "ai-studio-scenes-collapse");
    const chatToggle = findByTestId(root, "ai-studio-chat-collapse");
    expect(scenesToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(chatToggle?.getAttribute("aria-expanded")).toBe("true");
    scenesToggle?.click();
    expect(root.className).toContain("is-scenes-collapsed");
    expect(scenesToggle?.getAttribute("aria-expanded")).toBe("false");
    chatToggle?.click();
    expect(root.className).toContain("is-chat-collapsed");
    expect(chatToggle?.getAttribute("aria-expanded")).toBe("false");
    scenesToggle?.click();
    chatToggle?.click();
    expect(root.className).not.toContain("is-scenes-collapsed");
    expect(root.className).not.toContain("is-chat-collapsed");
  });

  it("실내 장면은 부모 아래에 접혀 있고, 펼치면 보이며 검색은 평탄화한다", () => {
    const parentId = store.getCurrent().startMapId;
    addChildMap(parentId, "안채", { width: 8, height: 6 });
    const { root, shell } = standaloneShell();
    const names = () => root.querySelectorAll("[data-testid=ai-studio-scene]").map((row) => row.textContent ?? "");
    expect(names().some((text) => text.includes("빈 맵"))).toBe(true);
    expect(names().some((text) => text.includes("안채"))).toBe(false);
    findByTestId(root, "ai-studio-scene-fold")?.click();
    expect(names().some((text) => text.includes("안채"))).toBe(true);
    findByTestId(root, "ai-studio-scene-fold")?.click();
    expect(names().some((text) => text.includes("안채"))).toBe(false);

    const search = findByTestId(root, "ai-studio-scene-search");
    fire(search!, "input", "안채");
    expect(names().some((text) => text.includes("안채"))).toBe(true);
    fire(search!, "input", "");

    const childId = Object.keys(store.getCurrent().maps).find((id) => store.getCurrent().maps[id]?.name === "안채");
    expect(childId).toBeTruthy();
    selectEditorMap(childId!);
    shell.refreshScenes();
    expect(names().some((text) => text.includes("안채"))).toBe(true);
  });

  it("새 변경은 배지만 세우고 사용자가 고른 탭을 앗지 않는다", () => {
    const { shell, root } = standaloneShell();
    const project = store.getCurrent();
    const preview = {
      before: project,
      after: project,
      mapId: project.startMapId,
      title: "타일 변경",
    };
    findByTestId(root, "ai-studio-tab-activity")?.click();
    shell.setChangePreview(preview);
    expect(findByTestId(root, "ai-studio-tab-changes")?.className).not.toContain("is-on");
    expect(findByTestId(root, "ai-studio-tab-activity")?.className).toContain("is-on");
    expect(findByTestId(root, "ai-studio-tab-changes")?.querySelector(".ai-studio-tab-badge")?.hidden).not.toBe(true);
    findByTestId(root, "ai-studio-tab-changes")?.click();
    expect(root.textContent).toContain("타일 변경");
  });

  it("작업 계획은 감독 스레드 위 슬롯에서 진행률을 센다", () => {
    const { shell, root } = standaloneShell();
    shell.setWorkPlan({
      id: "plan",
      goal: "광장을 꾸민다",
      createdAt: "0",
      currentLayerIndex: 0,
      currentItemId: "b",
      layers: [{
        id: "l1",
        title: "광장",
        items: [
          { id: "a", title: "광장 비우기", instruction: "", status: "done" },
          { id: "b", title: "우물 놓기", instruction: "", status: "in_progress" },
          { id: "c", title: "벤치", instruction: "", status: "pending" },
        ],
      }],
    }, true);
    const slot = findByTestId(root, "ai-studio-work-slot");
    expect(slot?.textContent).toContain("1/3");
    expect(findByTestId(root, "ai-studio-work-progress")).toBeTruthy();
    expect(findByTestId(root, "ai-studio-work")?.textContent).toContain("광장을 꾸민다");
  });

  it("실행 보드가 버스에 오르면 팀장·팀원이 레인 보드의 행으로 서고, 행을 누르면 오른쪽이 팀 보드다", () => {
    const { root } = standaloneShell();
    let state = createTeamBoardState("team", "대장간 거리");
    state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "lead", role: "orchestrator", mapId: null, mapName: null, task: state.task });
    state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b1", role: "builder", mapId: null, mapName: "시장 마을", task: "대장간 2채", memberId: "architect", label: "건축가" });
    state = reduceTeamBoard(state, { type: "agent_event", agentId: "b1", event: { type: "tool_start", id: "t1", name: "place_structure", args: { x: 13, y: 5 } } });
    publishTeamActivity(state);
    const rows = root.querySelectorAll("[data-testid=lane-team-row]");
    expect(rows.length).toBe(2);
    const builder = rows.find((row) => row.textContent.includes("건축가"));
    expect(builder?.textContent).toContain("시장 마을");
    expect(findByTestId(root, "ai-studio-deck-caption")?.textContent).toContain("작업 중");
    expect(findByTestId(root, "lane-board-empty")).toBeNull();

    builder?.click();
    const chat = findByTestId(root, "ai-studio-chat");
    expect(chat?.className).toContain("is-team-thread");
    expect(findByTestId(root, "ai-team-work")?.dataset.detail).toBe("true");
    expect(findByTestId(root, "ai-team-tx-args")?.textContent).toBe("x: 13 · y: 5");
    findByTestId(root, "ai-studio-back-director")?.click();
    expect(chat?.className).not.toContain("is-team-thread");

    publishTeamActivity(null);
    expect(findByTestId(root, "lane-team-row")).toBeNull();
    expect(findByTestId(root, "lane-board-empty")).toBeTruthy();
  });

  it("빈 대화에는 장면 정보만 보이고 추천은 없다", () => {
    const received: string[] = [];
    const { shell, root, chatLog } = standaloneShell({ onSuggest: (text) => received.push(text) });
    const briefing = findByTestId(root, "ai-studio-briefing");
    expect(briefing).toBeTruthy();
    expect(briefing?.hidden).toBe(false);
    expect(briefing?.textContent).toContain("빈 맵");
    const suggest = findByTestId(root, "ai-studio-suggest");
    expect(suggest).toBeNull();
    expect(received).toHaveLength(0);

    chatLog.append(new FakeElement("div"));
    shell.refreshMonitor();
    expect(findByTestId(root, "ai-studio-briefing")?.hidden).toBe(true);
  });

});

// ── 2026-09-17 §11 — 하단 레인 보드. 좌 레일은 장면만, 레인은 표 하나, 행 클릭이 오른쪽 스레드 ──
function neverRunner() {
  return () => new Promise<never>(() => undefined);
}

describe("하단 레인 보드", () => {
  it("좌 레일은 장면 트리만이고 조수 절·채팅 목록이 없다", () => {
    const { root } = standaloneShell();
    expect(findByTestId(root, "ai-studio-scenes")).toBeTruthy();
    expect(findByTestId(root, "ai-studio-agents")).toBeNull();
    expect(findByTestId(root, "ai-studio-threads")).toBeNull();
    expect(findByTestId(root, "ai-studio-monitor")).toBeTruthy();
    expect(findByTestId(root, "ai-studio-chat")).toBeTruthy();
  });

  it("레인이 서면 표에 에이전트·상태·묶음·턴·마지막 줄·동작 열로 한 행이 서고 캡션이 센다", async () => {
    const manager = createLaneManager({ runAgent: neverRunner() });
    const { root } = standaloneShell({ laneManager: manager });
    manager.add({
      id: "lane_a", label: "빈 맵", mapIds: ["map_blank_start"], agentLabel: "시공A",
      provider: "google-antigravity", model: "gemini-3.7-flash", instruction: "북쪽 숲", maxTurns: 12,
    });
    const table = findByTestId(root, "lane-table");
    expect(table).toBeTruthy();
    expect(table?.textContent).toContain("에이전트");
    expect(table?.textContent).toContain("묶음 (장면)");
    const row = findByTestId(root, "lane-row");
    expect(row?.dataset.status).toBe("idle");
    expect(row?.textContent).toContain("시공A");
    expect(row?.textContent).toContain("gemini-3.7-flash");
    expect(row?.textContent).toContain("빈 맵");
    expect(row?.textContent).toContain("0/12턴");
    expect(findByTestId(root, "lane-row-start")).toBeTruthy();
    expect(findByTestId(root, "ai-studio-deck-caption")?.textContent).toBe("대기 1");
    expect(findByTestId(root, "ai-studio-deck")?.className).not.toContain("is-empty");

    findByTestId(root, "lane-row-start")?.click();
    await Promise.resolve();
    expect(findByTestId(root, "lane-row")?.dataset.status).toBe("running");
    expect(findByTestId(root, "lane-row-stop")).toBeTruthy();
    expect(findByTestId(root, "ai-studio-deck-caption")?.textContent).toBe("작업 중 1");
    expect(findByTestId(root, "ai-studio-tab-lanes")?.textContent).toContain("1");
    findByTestId(root, "lane-row-stop")?.click();
    expect(findByTestId(root, "lane-row")?.dataset.status).toBe("stopped");
    manager.dispose();
  });

  it("행을 누르면 오른쪽 열이 그 레인 스레드가 되고 수신자 칩이 붙는다, ← 감독 으로 돌아온다", () => {
    const manager = createLaneManager({ runAgent: neverRunner() });
    const { root } = standaloneShell({ laneManager: manager });
    manager.add({
      id: "lane_x", label: "폐광 입구", mapIds: ["map_blank_start"], agentLabel: "지형",
      provider: "google-antigravity", model: "gemini-3.7-flash", instruction: "갱도 입구를 정리한다",
    });
    const chat = findByTestId(root, "ai-studio-chat");
    findByTestId(root, "lane-row")?.click();
    expect(chat?.className).toContain("is-lane-thread");
    expect(findByTestId(root, "lane-thread")).toBeTruthy();
    expect(findByTestId(root, "lane-receiver")?.textContent).toBe("→ 지형");
    expect(findByTestId(root, "ai-studio-thread-title")?.textContent).toContain("지형");
    expect(findByTestId(root, "lane-row")?.className).toContain("is-selected");

    findByTestId(root, "ai-studio-back-director")?.click();
    expect(chat?.className).not.toContain("is-lane-thread");
    expect(findByTestId(root, "ai-studio-thread-title")?.textContent).toBe("감독");
    manager.dispose();
  });

  it("「＋ 새 레인」 은 팝오버로 폼을 열고, 만들면 닫히며 표에 행이 선다", async () => {
    const manager = createLaneManager({ runAgent: neverRunner() });
    const { root } = standaloneShell({ laneManager: manager });
    const button = findByTestId(root, "ai-studio-new-lane");
    expect(isHidden(findByTestId(root, "ai-studio-popover"))).toBe(true);
    button?.click();
    expect(isHidden(findByTestId(root, "ai-studio-popover"))).toBe(false);
    expect(button?.getAttribute("aria-expanded")).toBe("true");
    expect(findByTestId(root, "lane-form")).toBeTruthy();
    fire(findByTestId(root, "lane-instruction")!, "input", "우물을 놓는다");
    findByTestId(root, "lane-create")?.click();
    await Promise.resolve();
    expect(isHidden(findByTestId(root, "ai-studio-popover"))).toBe(true);
    expect(findByTestId(root, "lane-row")).toBeTruthy();
    expect(findByTestId(root, "lane-row")?.dataset.status).toBe("running");
    expect(findByTestId(root, "ai-studio-chat")?.className).toContain("is-lane-thread");
    manager.dispose();
  });

  it("다른 장면의 레인은 모니터 모서리 썸네일로, 지금 장면의 레인은 장면 행 칩으로 보인다", () => {
    const other = addMap("달빛 숲", 20, 15);
    const manager = createLaneManager({ runAgent: neverRunner() });
    const { root } = standaloneShell({ laneManager: manager });
    manager.add({ id: "lane_o", label: "달빛 숲", mapIds: [other], agentLabel: "시공B", provider: "google-antigravity", model: "gemini-3.7-flash", instruction: "사당" });
    void manager.start("lane_o");
    expect(findByTestId(root, "ai-studio-monitor-lane")?.textContent).toContain("달빛 숲");
    expect(findByTestId(root, "ai-studio-monitor-lanes")?.hidden).toBe(false);
    // 빈 프로젝트의 새 맵은 시작 맵 아래 실내로 접혀 있다 — 펼치면 그 행에 레인 칩이 붙어 있다.
    findByTestId(root, "ai-studio-scene-fold")?.click();
    const chips = root.querySelectorAll("[data-testid=ai-studio-lane-chip]");
    expect(chips.map((chip) => chip.textContent).join("|")).toContain("시공B");
    manager.dispose();
  });
});

describe("스튜디오 나가기 확인", () => {
  it("레인이 없으면 바로 나간다", () => {
    let exits = 0;
    const { root } = standaloneShell({ onExit: () => { exits += 1; } });
    findByTestId(root, "ai-studio-exit")?.click();
    expect(exits).toBe(1);
    expect(findByTestId(root, "ai-studio-exit-dialog")).toBeNull();
  });

  it("작업 중 레인이 있으면 확인창이 먼저고, 취소는 남고 나가기는 onExit 를 부른다", () => {
    let exits = 0;
    const manager = createLaneManager({ runAgent: neverRunner() });
    const { shell, root } = standaloneShell({ laneManager: manager, onExit: () => { exits += 1; } });
    manager.add({ id: "lane_r", label: "빈 맵", mapIds: ["map_blank_start"], agentLabel: "시공A", provider: "google-antigravity", model: "gemini-3.7-flash", instruction: "숲", maxTurns: 12 });
    void manager.start("lane_r");
    findByTestId(root, "ai-studio-exit")?.click();
    expect(exits).toBe(0);
    const dialog = findByTestId(root, "ai-studio-exit-dialog");
    expect(dialog?.textContent).toContain("레인은 계속 돕니다");
    expect(dialog?.textContent).toContain("시공A");
    findByTestId(root, "ai-studio-exit-cancel")?.click();
    expect(findByTestId(root, "ai-studio-exit-dialog")).toBeNull();
    shell.requestExit();
    findByTestId(root, "ai-studio-exit-confirm")?.click();
    expect(exits).toBe(1);
    manager.dispose();
  });
});

describe("스튜디오 밖 — 조수 카드의 레인 요약 줄", () => {
  it("레인 0 이면 숨고, 레인이 돌면 요약이 서고, 「스튜디오에서 보기」 가 그 레인 스레드로 연다", async () => {
    const panel = renderPanel();
    const summary = findByTestId(panel, "ai-lane-summary");
    expect(isHidden(summary)).toBe(true);
    const manager = laneSession();
    manager.add({ id: "lane_s", label: "빈 맵", mapIds: [store.getCurrent().startMapId], agentLabel: "시공A", provider: "google-antigravity", model: "gemini-3.7-flash", instruction: "숲", maxTurns: 12 });
    expect(isHidden(summary)).toBe(false);
    expect(findByTestId(panel, "ai-lane-summary-headline")?.textContent).toBe("레인 대기 1");
    findByTestId(panel, "ai-lane-summary-open")?.click();
    expect(panel.classList.contains("is-studio")).toBe(true);
    expect(findByTestId(panel, "ai-studio-chat")?.className).toContain("is-lane-thread");
    expect(findByTestId(panel, "lane-receiver")?.textContent).toBe("→ 시공A");
    manager.discard("lane_s");
    findByTestId(panel, "ai-studio-toggle")?.click();
    expect(panel.classList.contains("is-studio")).toBe(false);
    expect(isHidden(findByTestId(panel, "ai-lane-summary"))).toBe(true);
  });
});
