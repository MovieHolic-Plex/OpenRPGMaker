// 스튜디오 셸: 장면 | 모니터 | 오른쪽 채팅 + 아래 덱.
// 기본 입력줄 캡슐은 건드리지 않고, is-studio 일 때만 이 레이아웃이 산다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createStudioShell } from "@/editor/panels/aiStudioShell";
import { renderTopbar } from "@/editor/panels/menu";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(() => {
  store.replace(createBlankProject());
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
    expect(findByTestId(shell.root as unknown as FakeElement, "ai-studio-tab-tools")?.className).toContain("is-on");
    expect(findByTestId(shell.root as unknown as FakeElement, "ai-studio-tool-grid")).toBeTruthy();
    expect(findByTestId(shell.root as unknown as FakeElement, "ai-studio-tool-card")?.textContent).toContain("NPC 배치");
    expect(shell.root.textContent).not.toContain("Canonical");
    expect(findByTestId(shell.root as unknown as FakeElement, "ai-studio-monitor-thumb")).toBeNull();

    findByTestId(shell.root as unknown as FakeElement, "ai-studio-tab-work")?.click();
    expect(shell.root.textContent).toContain("아직 작업 계획이 없습니다");
    findByTestId(shell.root as unknown as FakeElement, "ai-studio-tab-changes")?.click();
    expect(shell.root.textContent).toContain("아직 비교할 변경이 없습니다");

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
    expect(shell.root.textContent).toContain("됨");
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
    expect(findByTestId(panel, "ai-command-bar")?.parentElement).toBe(panel);
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

    const card = findByTestId(panel, "ai-studio-tool-card");
    card?.click();
    const input = findByTestId(panel, "ai-input") as unknown as { value: string };
    expect(input.value.length).toBeGreaterThan(0);

    findByTestId(panel, "ai-studio-toggle")?.click();
    expect(body.querySelector("[data-testid=edit-canvas]")).toBeTruthy();
  });
});
