// 스튜디오 셸: 장면 | 모니터 | 오른쪽 채팅 + 아래 덱.
// 기본 입력줄 캡슐은 건드리지 않고, is-studio 일 때만 이 레이아웃이 산다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addChildMap } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createStudioShell } from "@/editor/panels/aiStudioShell";
import { createLaneManager } from "@/editor/panels/aiLaneManager";
import { resetLaneSessionForTest } from "@/editor/panels/aiLaneSession";
import { publishTeamActivity } from "@/ai/piAgent/teamActivity";
import { createTeamBoardState, reduceTeamBoard } from "@/ai/piAgent/teamBoardState";
import { renderTopbar } from "@/editor/panels/menu";
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
  it("덱 탭 작업/변경/도구를 갈아끼우고 빈 안내를 둔다", () => {
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

    expect(findByTestId(shell.root as unknown as FakeElement, "ai-studio-scenes")).toBeTruthy();
    expect(findByTestId(shell.root as unknown as FakeElement, "ai-studio-monitor")).toBeTruthy();
    expect(findByTestId(shell.root as unknown as FakeElement, "ai-studio-chat")).toBeTruthy();
    expect(findByTestId(shell.root as unknown as FakeElement, "ai-studio-deck")).toBeTruthy();
    expect((findByTestId(shell.root as unknown as FakeElement, "ai-studio-composer") as FakeElement).childNodes)
      .toContain(bar);
    // 드로워의 첫 탭은 「새 레인」 이다(레인 표는 좌 레일로 갔다).
    expect(findByTestId(shell.root as unknown as FakeElement, "ai-studio-tab-newLane")?.className).toContain("is-on");
    findByTestId(shell.root as unknown as FakeElement, "ai-studio-tab-tools")?.click();
    expect(findByTestId(shell.root as unknown as FakeElement, "ai-studio-tab-tools")?.className).toContain("is-on");
    expect(findByTestId(shell.root as unknown as FakeElement, "ai-studio-tool-grid")).toBeTruthy();
    // 데크(2026-09-03): 타일은 묶음(짓기 / 사람·이야기 / 보기·검사)으로 나뉘어 첫 카드가 NPC 가 아닐 수 있다 — 전체에서 찾는다.
    const toolCardTexts = (shell.root as unknown as FakeElement).querySelectorAll("[data-testid=ai-studio-tool-card]").map((card) => card.textContent);
    expect(toolCardTexts).toContain("NPC 배치");
    expect(shell.root.textContent).not.toContain("Canonical");
    expect(findByTestId(shell.root as unknown as FakeElement, "ai-studio-monitor-thumb")).toBeNull();

    findByTestId(shell.root as unknown as FakeElement, "ai-studio-tab-work")?.click();
    expect(shell.root.textContent).toContain("아직 작업 계획이 없습니다");
    findByTestId(shell.root as unknown as FakeElement, "ai-studio-tab-changes")?.click();
    expect(shell.root.textContent).toContain("아직 비교할 변경이 없습니다");

    // 계획이 떠도 드로워는 스스로 열리지 않는다(배지만) — 사용자가 탭을 고르면 그때 그린다.
    findByTestId(shell.root as unknown as FakeElement, "ai-studio-tab-work")?.click();
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
    expect(shell.root.textContent).toContain("광장 비우기");
    expect(shell.root.textContent).toContain("완료"); // 2026-09-03: 「됨/중」 단음절 라벨을 「완료/진행 중」으로 바꿨다.
    expect(shell.root.textContent).toContain("우물");

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

  it("모니터는 살아 있는 맵 캔버스를 들이고, 도구 카드는 입력줄을 채운다", () => {
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

    findByTestId(panel, "ai-studio-tab-tools")?.click();
    const card = findByTestId(panel, "ai-studio-tool-card");
    card?.click();
    const input = findByTestId(panel, "ai-input") as unknown as { value: string };
    expect(input.value.length).toBeGreaterThan(0);

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

  it("드로워는 기본 닫힘이고 맵 손잡이·접기 버튼·Esc 로 여닫는다", () => {
    const { root } = standaloneShell();
    const deck = findByTestId(root, "ai-studio-deck");
    const toggle = findByTestId(root, "ai-studio-deck-collapse");
    const handle = findByTestId(root, "ai-studio-deck-handle");
    expect(deck?.className).toContain("is-drawer");
    expect(deck?.className).toContain("is-collapsed");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    handle?.click();
    expect(deck?.className).not.toContain("is-collapsed");
    expect(handle?.getAttribute("aria-expanded")).toBe("true");
    toggle?.click();
    expect(deck?.className).toContain("is-collapsed");
    handle?.click();
    expect(deck?.className).not.toContain("is-collapsed");
    document.dispatchEvent(Object.assign(new Event("keydown", { bubbles: true }), { key: "Escape" }));
    expect(deck?.className).toContain("is-collapsed");
  });

  it("덱은 그리드 행이 아니라 오버레이다 — 덱 손잡이가 사라지고 셸이 오버레이 모드다", () => {
    // 2026-09-16: 덱이 행을 차지하면 맵 세로가 잘린다. 이제 맵 위로 올라오는 드로워이고,
    // 행 높이를 끌던 덱 손잡이는 존재하지 않는다.
    const { root } = standaloneShell();
    expect(root.className).toContain("is-deck-overlay");
    expect(root.className).toContain("is-deck-collapsed");
    expect(findByTestId(root, "ai-studio-split-deck")).toBeNull();
    expect(findByTestId(root, "ai-studio-deck")?.className).toContain("is-drawer");
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
    expect(typeof saved.deck).toBe("number");
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

  it("새 작업·변경은 배지만 세우고 사용자가 고른 탭을 앗지 않는다", () => {
    const { shell, root } = standaloneShell();
    const project = store.getCurrent();
    const plan = {
      id: "plan",
      goal: "우물을 놓는다",
      createdAt: "0",
      currentLayerIndex: 0,
      currentItemId: "a",
      layers: [{
        id: "l1",
        title: "광장",
        items: [{ id: "a", title: "우물", instruction: "", status: "in_progress" as const }],
      }],
    };
    const preview = {
      before: project,
      after: project,
      mapId: project.startMapId,
      title: "타일 변경",
    };

    shell.setWorkPlan(plan, true);
    // 이제 팀원·레인 활동은 좌 레일이 실시간으로 보여준다 — 드로워를 빼앗지 않는다.
    expect(findByTestId(root, "ai-studio-tab-work")?.className).not.toContain("is-on");
    expect(findByTestId(root, "ai-studio-deck")?.className).toContain("is-collapsed");

    findByTestId(root, "ai-studio-tab-tools")?.click();
    expect(findByTestId(root, "ai-studio-tab-tools")?.className).toContain("is-on");
    shell.setWorkPlan({ ...plan, currentItemId: "a" }, true);
    expect(findByTestId(root, "ai-studio-tab-tools")?.className).toContain("is-on");
    expect(findByTestId(root, "ai-studio-tab-work")?.className).not.toContain("is-on");

    findByTestId(root, "ai-studio-tab-activity")?.click();
    shell.setChangePreview(preview);
    // 변경도 마찬가지 — 배지만 서고 탭은 사용자가 정한다.
    expect(findByTestId(root, "ai-studio-tab-changes")?.className).not.toContain("is-on");

    findByTestId(root, "ai-studio-tab-activity")?.click();
    expect(findByTestId(root, "ai-studio-tab-activity")?.className).toContain("is-on");
    shell.setChangePreview(preview);
    expect(findByTestId(root, "ai-studio-tab-activity")?.className).toContain("is-on");
    expect(findByTestId(root, "ai-studio-tab-changes")?.className).not.toContain("is-on");
  });

  it("작업 판은 진행률을 세고 탭 배지에도 적는다", () => {
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
    findByTestId(root, "ai-studio-tab-work")?.click();
    expect(findByTestId(root, "ai-studio-tab-work")?.textContent).toContain("1/3");
    expect(findByTestId(root, "ai-studio-work-progress")).toBeTruthy();
    expect(findByTestId(root, "ai-studio-work")?.textContent).toContain("광장을 꾸민다");
  });

  it("실행 보드가 버스에 오르면 「작업」이 상세 페인(툴 인자 포함)을 열고 배지는 실행 중 인원을 센다", () => {
    const { root } = standaloneShell();
    // 드로워는 기본 닫힘 — 보드가 뜨면 「작업」 탭으로 스스로 열린다.
    expect(findByTestId(root, "ai-studio-deck")?.className).toContain("is-collapsed");
    findByTestId(root, "ai-studio-tab-tools")?.click();
    let state = createTeamBoardState("team", "대장간 거리");
    state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "lead", role: "orchestrator", mapId: null, mapName: null, task: state.task });
    state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b1", role: "builder", mapId: null, mapName: "시장 마을", task: "대장간 2채", memberId: "architect", label: "건축가" });
    state = reduceTeamBoard(state, { type: "agent_event", agentId: "b1", event: { type: "tool_start", id: "t1", name: "place_structure", args: { x: 13, y: 5 } } });
    const drawerBefore = findByTestId(root, "ai-studio-deck")?.className ?? "";
    publishTeamActivity(state);
    // 버스는 좌 레일을 실시간으로 채우고 배지를 세운다 — 드로워 상태는 발행 전후로 같다.
    expect(findByTestId(root, "ai-studio-team-row")).toBeTruthy();
    expect(findByTestId(root, "ai-studio-deck")?.className).toBe(drawerBefore);
    expect(findByTestId(root, "ai-studio-tab-work")?.textContent).toContain("2");
    findByTestId(root, "ai-studio-tab-work")?.click();
    expect(findByTestId(root, "ai-studio-tab-work")?.className).toContain("is-on");
    expect(findByTestId(root, "ai-studio-tab-work")?.textContent).toContain("2");
    expect(findByTestId(root, "ai-team-work")?.dataset.detail).toBe("true");
    expect(findByTestId(root, "ai-team-tx-args")?.textContent).toBe("x: 13 · y: 5");
    expect(findByTestId(root, "ai-team-work-member")).toBeTruthy();
    publishTeamActivity(null);
    expect(findByTestId(root, "ai-team-work")).toBeNull();
    expect(root.textContent).toContain("아직 작업 계획이 없습니다");
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

  it("도구 판은 「자주 쓰는」 절로 시작하고 필터가 카드를 걸러낸다", () => {
    const { root } = standaloneShell();
    findByTestId(root, "ai-studio-tab-tools")?.click();
    const npcCard = root.querySelectorAll("[data-testid=ai-studio-tool-card]").find((card) => card.dataset.tool === "place_npc");
    expect(npcCard?.textContent).toContain("NPC 배치");
    expect(root.textContent).toContain("자주 쓰는");
    const filter = findByTestId(root, "ai-studio-tool-filter");
    const total = root.querySelectorAll("[data-testid=ai-studio-tool-card]").length;
    fire(filter!, "input", "NPC");
    const cards = root.querySelectorAll("[data-testid=ai-studio-tool-card]");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThan(total);
    expect(cards.some((card) => card.dataset.tool === "place_npc")).toBe(true);
    fire(filter!, "input", "zzz-없는-도구");
    expect(root.textContent).toContain("맞는 도구가 없습니다");
  });
});

describe("스튜디오 도구 덱 — 묶음 + 아이콘 (데크 P3)", () => {
  it("타일은 짓기 / 사람·이야기 / 보기·검사 세 묶음이고 「편집/조회」 반복 라벨이 없다", () => {
    // Break: 17장이 한 격자에 흰 카드로 늘어서고 카드마다 「편집」 이 붙어 정보가 0 이 된다.
    const { root } = standaloneShell();
    findByTestId(root, "ai-studio-tab-tools")?.click();
    const grid = findByTestId(root, "ai-studio-tool-grid");
    expect(grid).toBeTruthy();
    const groups = grid?.querySelectorAll(".ai-studio-tool-group") ?? [];
    expect(groups.map((group) => group.querySelector(".ai-studio-tool-group-title")?.textContent)).toEqual(["짓기", "사람·이야기", "보기·검사"]);
    const cards = grid?.querySelectorAll("[data-testid=ai-studio-tool-card]") ?? [];
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.querySelector(".ai-studio-tool-mode")).toBeNull();
      expect(card.childNodes.some((child) => (child as { tagName?: string }).tagName?.toLowerCase() === "svg")).toBe(true);
    }
    expect(cards.map((card) => card.textContent)).toContain("NPC 배치");
  });
});

// ── 2026-09-16 재배치 — 가운데는 맵, 왼쪽은 채팅·실시간 조수 활동, 오른쪽은 지금 보는 채 chat ──
describe("스튜디오 3분할 재배치", () => {
  it("좌 레일에 실시간 조수 활동·채팅 목록·장면이 서고, 중앙은 맵, 오른쪽은 지금 보는 chat이다", () => {
    const { root } = standaloneShell();
    const left = findByTestId(root, "ai-studio-left");
    expect(left).toBeTruthy();
    expect(left ? findByTestId(left, "ai-studio-agents") : null).toBeTruthy();
    expect(left ? findByTestId(left, "ai-studio-threads") : null).toBeTruthy();
    expect(left ? findByTestId(left, "ai-studio-scenes") : null).toBeTruthy();
    expect(findByTestId(root, "ai-studio-monitor")).toBeTruthy();
    expect(findByTestId(root, "ai-studio-chat")).toBeTruthy();
  });

  it("레인 스레드를 고르면 오른쪽이 그 레인 스레드로 바뀌고, 감독을 고르면 돌아온다", () => {
    const manager = createLaneManager({
      onChange: () => undefined,
      runAgent: async () => { throw new Error("이 테스트는 실행하지 않는다"); },
    });
    const { root } = standaloneShell({ laneManager: manager });
    manager.add({
      id: "lane_x",
      label: "폐광 입구",
      mapIds: ["map_blank_start"],
      agentLabel: "지형",
      provider: "google-antigravity",
      model: "gemini-3.7-flash",
      instruction: "갱도 입구를 정리한다",
    });

    const agentRow = findByTestId(root, "ai-studio-agent-row");
    expect(agentRow?.textContent).toContain("지형");
    expect(agentRow?.textContent).toContain("대기");

    findByTestId(root, "ai-studio-thread-lane_x")?.click();
    const chat = findByTestId(root, "ai-studio-chat");
    expect(chat?.className).toContain("is-lane-thread");
    expect(findByTestId(root, "lane-thread")).toBeTruthy();

    findByTestId(root, "ai-studio-thread-director")?.click();
    expect(chat?.className).not.toContain("is-lane-thread");
    manager.dispose();
  });
});

// ── 2026-09-16: 하단 덱을 오버레이 드로워로 — 맵이 세로를 다 쓴다 ──
describe("스튜디오 덱 오버레이 드로워", () => {
  it("덱은 그리드 행을 차지하지 않고, 드로워로 접힌 채 뜬다", () => {
    const { root } = standaloneShell();
    expect(root.className).toContain("is-deck-overlay");
    const deck = findByTestId(root, "ai-studio-deck");
    expect(deck?.className).toContain("is-drawer");
    expect(deck?.className).toContain("is-collapsed");
  });

  it("탭이 새 레인·도구·작업… 이고 레인 표는 덱에서 빠졌으며, 탭을 고르면 드로워가 열린다", () => {
    const { root } = standaloneShell();
    expect(findByTestId(root, "ai-studio-tab-newLane")).toBeTruthy();
    expect(findByTestId(root, "ai-studio-tab-lanes")).toBeNull();
    expect(findByTestId(root, "lane-table")).toBeNull();

    findByTestId(root, "ai-studio-tab-tools")?.click();
    expect(findByTestId(root, "ai-studio-deck")?.className).not.toContain("is-collapsed");
    expect(findByTestId(root, "ai-studio-tool-grid")).toBeTruthy();
  });

  it("좌 레일 「조수」 절의 ＋ 가 드로워를 새 레인 탭으로 연다", () => {
    const { root } = standaloneShell();
    findByTestId(root, "ai-studio-new-lane")?.click();
    expect(findByTestId(root, "ai-studio-deck")?.className).not.toContain("is-collapsed");
    expect(findByTestId(root, "ai-studio-tab-newLane")?.className).toContain("is-on");
    expect(findByTestId(root, "lane-form")).toBeTruthy();
  });
});

// ── 2026-09-16: 좌 레일은 레인뿐 아니라 «팀원» 의 실시간 활동도 보여준다 ──
describe("좌 레일 실시간 활동 — 팀원", () => {
  it("팀 보드가 오르면 좌 레일 조수 절에 팀원 행이 산다(이름·종류·맵·턴/툴·마지막 줄)", () => {
    const { root } = standaloneShell();
    expect(findByTestId(root, "ai-studio-team-row")).toBeNull();

    let state = createTeamBoardState("team", "대장간 거리");
    state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "lead", role: "orchestrator", mapId: null, mapName: null, task: state.task });
    state = reduceTeamBoard(state, {
      type: "agent_spawn", agentId: "b1", role: "builder", mapId: "map_blank_start", mapName: "빈 맵", task: "대장간 2", memberId: "architect", label: "건축가",
    });
    state = reduceTeamBoard(state, { type: "agent_event", agentId: "b1", event: { type: "tool_start", id: "t1", name: "place_structure", args: { x: 13, y: 5 } } });
    state = reduceTeamBoard(state, { type: "agent_event", agentId: "b1", event: { type: "tool_end", id: "t1", name: "place_structure", ok: true, summary: "x: 13 · y: 5" } });
    publishTeamActivity(state);

    const rows = root.querySelectorAll("[data-testid=ai-studio-team-row]");
    expect(rows.length).toBe(2);
    const builder = rows.find((row) => row.textContent.includes("건축가"));
    expect(builder?.textContent).toContain("빈 맵");
    expect(builder?.textContent).toContain("x: 13");
    // 조수 수 배지에도 팀원이 함께 세어진다.
    expect(findByTestId(root, "ai-studio-agents")?.textContent).toBeTruthy();
    publishTeamActivity(null);
    expect(findByTestId(root, "ai-studio-team-row")).toBeNull();
  });
});
