import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listEditorCommands, listMapCommands, matchEditorCommands } from "@/editor/commandRegistry";
import { editorState } from "@/editor/editorState";
import { allPanels } from "@/editor/workspace/panelRegistry";
import { LEFT_DOCK_TASK_HOST } from "@/editor/workspace/leftDockPanels";
import { getWorkspaceLayout, resetWorkspaceForTests, updateWorkspaceLayout } from "@/editor/workspace/workspaceStore";
import { layoutFromPreset } from "@/editor/workspace/workspaceLayout";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const WORKSPACE_KEY = "oprn:workspace:v1";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function installDockHosts(): void {
  vi.stubGlobal("document", {
    body: { classList: { add: vi.fn(), remove: vi.fn() }, dataset: {} },
    querySelectorAll: vi.fn(() => [{}]),
  });
}

describe("commandRegistry", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    resetWorkspaceForTests();
    editorState.set({ tool: "paint", layer: "lower" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("도구 명령 실행이 editorState를 바꾼다", () => {
    const commands = listEditorCommands();
    const fill = commands.find((c) => c.id === "tool-fill");
    expect(fill).toBeTruthy();
    fill!.run();
    expect(editorState.get().tool).toBe("fill");
    const event = commands.find((c) => c.id === "tool-event");
    event!.run();
    expect(editorState.get().layer).toBe("event");
  });

  it("이벤트 레이어에서 브러시 도구 명령 실행 시 하위 레이어로 탈출한다", () => {
    editorState.set({ tool: "event", layer: "event" });
    const commands = listEditorCommands();
    const paint = commands.find((c) => c.id === "tool-paint");
    paint!.run();
    expect(editorState.get().tool).toBe("paint");
    expect(editorState.get().paintShape).toBe("pen");
    expect(editorState.get().layer).toBe("lower");
  });

  it("화면 밀도·프리셋·편집 모드 명령이 없다", () => {
    // 2026-09-03 밀도·프리셋 명령을, 2026-09-27 초보/표준/전문가 편집 모드 명령을 걷었다.
    const ids = listEditorCommands().map((c) => c.id);
    expect(ids.some((id) => id.startsWith("workspace-preset-"))).toBe(false);
    expect(ids.some((id) => id.startsWith("workspace-density-"))).toBe(false);
    expect(ids.some((id) => id.startsWith("editor-ui-mode-"))).toBe(false);
  });

  it("패널 명령이 도크를 옮기고 닫는다", () => {
    installDockHosts();
    const commands = listEditorCommands();
    updateWorkspaceLayout(layoutFromPreset("map"));
    // 타일(왼쪽 도크 작업 호스트, LEFT_DOCK_TASK_HOST)은 늘 마운트돼 패널 명령을 내놓지 않는다 — 맵 트리로 본다.
    expect(commands.some((c) => c.id.startsWith("workspace-panel-tiles"))).toBe(false);
    commands.find((c) => c.id === "workspace-panel-maps-right")!.run();
    expect(getWorkspaceLayout().docks.left).toEqual(["tiles"]);
    expect(getWorkspaceLayout().docks.right).toContain("maps");

    commands.find((c) => c.id === "workspace-panel-maps")!.run();
    expect(getWorkspaceLayout().docks.right).not.toContain("maps");
  });

  it("도크 패널 명령은 저장된 도크 구성을 바꾸지 않고 항상 등록된다", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    installDockHosts();
    storage.setItem(WORKSPACE_KEY, JSON.stringify({
      presetId: "map",
      docks: { left: ["tiles", "maps"], right: ["assistant"], bottom: [] },
    }));
    resetWorkspaceForTests();

    const ids = listEditorCommands().map((command) => command.id);
    // 타일은 왼쪽 도크 작업 호스트라 패널 명령이 없다(#3245, LEFT_DOCK_TASK_HOST).
    expect(ids).not.toContain("workspace-panel-tiles");
    expect(ids).toContain("workspace-panel-maps");
    expect(ids).not.toContain("workspace-panel-tiles-right");
    expect(ids).toContain("workspace-panel-maps-right");
    expect(JSON.parse(storage.getItem(WORKSPACE_KEY) ?? "{}").docks.left).toEqual(["tiles", "maps"]);
  });

  it("맵 명령은 주입된 select를 호출한다", () => {
    const project = store.getCurrent();
    const picked: string[] = [];
    const commands = listMapCommands(project, (mapId) => { picked.push(mapId); return true; });
    expect(commands.length).toBeGreaterThan(0);
    commands[0]!.run();
    expect(picked).toHaveLength(1);
  });

  it("registers the complete chrome command set exactly once", () => {
    const commands = listEditorCommands();
    const requiredIds = [
      "open-world",
      "open-world-codex",
      "open-resources",
      // 2026-09-03: 도구 메뉴 두 번 클릭이 유일한 길이던 셋에 팔레트 길을 낸다.
      "open-audio",
      "open-map-event-search",
      "save-project",
      "map-screenshot",
      "build-palette",
      // 구 `drawer-map` / `drawer-tile` / `drawer-event` 는 2026-08-26 에 삭제됐다.
      // 그 세 명령은 `activateLeftDrawerTab()` 을 부르고 있었는데, 그 함수가 사용하는 서랽 탭 UI는
      // 어느 지점에서도 마운트되지 않았다 — `drawer-map` 은 아무 일도 하지 않았고,
      // `drawer-tile` / `drawer-event` 는 아래 레이어 명령과 중복이었다.
      "layer-lower",
      "layer-upper",
      "layer-event",
      // 구 `toggle-chat-dock` 은 2026-08-31 에 삭제됐다 — 도크가 하나뿐이라 「전환」이
      // 갈 곳이 없다. 부재 계약은 아래 워크스페이스 케이스가 담당한다.
    ];
    expect(commands.filter((command) => requiredIds.includes(command.id)).map((command) => command.id).sort()).toEqual([...requiredIds].sort());
  });

  it("워크스페이스 명령이 패널마다 3개씩 정확히 한 번 등록된다", () => {
    installDockHosts();
    const ids = listEditorCommands().map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.startsWith("editor-ui-mode-"))).toEqual([]);
    for (const panel of allPanels().filter((candidate) => candidate.id !== "assistant" && candidate.id !== LEFT_DOCK_TASK_HOST)) {
      expect(ids).toContain(`workspace-panel-${panel.id}`);
      expect(ids).toContain(`workspace-panel-${panel.id}-left`);
      expect(ids).toContain(`workspace-panel-${panel.id}-right`);
    }
    expect(ids).not.toContain("workspace-panel-assistant-left");
    // 조수 도크 명령 4종(assistant-dock-glass/side/float · toggle-chat-dock)은 2026-08-31
    // 도크 축 삭제와 함께 빠졌다. 팔레트에 다시 나타나면 회귀다.
    for (const dead of [
      "assistant-dock-glass",
      "assistant-dock-side",
      "assistant-dock-float",
      "toggle-chat-dock",
    ]) {
      expect(ids, dead).not.toContain(dead);
    }
  });

  it("공통 저작 작업 네 개가 명령 팔레트에도 정확히 한 번 등록된다", () => {
    const ids = listEditorCommands().map((command) => command.id);
    for (const task of ["map", "event", "data", "test"]) {
      expect(ids.filter((id) => id === `authoring-task-${task}`)).toHaveLength(1);
    }
  });

  it('Standard offers all inspection commands but not ineffective dock toggles', () => {
    installDockHosts();
    const ids = listEditorCommands().map(command => command.id);
    expect(ids.filter(id => id.startsWith('sidebar-inspection-'))).toEqual([
      'sidebar-inspection-inspector', 'sidebar-inspection-ruleAudit', 'sidebar-inspection-history',
    ]);
    // 화면을 못 바꾸는 도크 토글 = 늘 마운트된 왼쪽 작업 호스트(타일)의 열기/닫기·이동(#3245). 다른 패널 명령은 남는다.
    expect(ids.some(id => id.startsWith(`workspace-panel-${LEFT_DOCK_TASK_HOST}`))).toBe(false);
  });

  it("톱바에서 ⌘K 로 옮긴 단추마다 명령이 하나씩 있고, 이름으로 찾을 수 있다", () => {
    // Break: 2026-11 개편으로 톱바에서 물린 단추가 ⌘K 에도 없어 닿을 길이 사라진다.
    const commands = listEditorCommands();
    const cases: readonly (readonly [string, string])[] = [
      ["topbar-battle-test", "전투 테스트"],
      ["topbar-ai-studio", "AI 스튜디오"],
      ["commit-history-toggle", "저장 기록"],
      ["topbar-identity", "편집 이름"],
      ["window-fullscreen", "전체화면"],
      ["open-world", "세계관"],
      ["open-audio", "음악"],
      ["open-map-event-search", "맵·이벤트 찾기"],
    ];
    for (const [id, query] of cases) {
      expect(commands.filter((command) => command.id === id), id).toHaveLength(1);
      expect(matchEditorCommands(query, commands).some((command) => command.id === id), `${id} ← 「${query}」`).toBe(true);
    }
  });

  it("「패널 보기」 명령은 왼쪽 열의 패널 단추를 누른다", () => {
    // Break: 「보기」 메뉴 단추를 톱바에서 빼면서 패널 전환의 두 번째 길이 사라진다.
    const clicked = vi.fn();
    const paneButton = {
      dataset: { testid: "sidebar-progress", leftPane: "progress" },
      getAttribute: (name: string) => (name === "aria-label" ? "진행" : name === "aria-pressed" ? "false" : null),
      click: clicked,
    };
    vi.stubGlobal("document", {
      body: { classList: { add: vi.fn(), remove: vi.fn() }, dataset: {} },
      querySelectorAll: vi.fn(() => [{}]),
      querySelector: vi.fn((selector: string) => (selector.includes("editor-ai-sidebar")
        ? { querySelectorAll: () => [paneButton] }
        : null)),
    });
    const command = listEditorCommands().find((entry) => entry.id === "workspace-panels-button-progress");
    expect(command?.label).toBe("화면: 패널 보기 — 진행");
    command?.run();
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("왼쪽 열에서 뺀 연결·공방·스토어·검사는 ⌘K 명령으로 남는다", () => {
    const commands = listEditorCommands();
    for (const [id, query] of [["left-drawer-links", "맵 연결"], ["left-drawer-workshop", "공방"], ["left-drawer-store", "에셋 스토어"], ["inspect-rule-violations", "규칙 위반"]] as const) {
      expect(commands.filter((command) => command.id === id), id).toHaveLength(1);
      expect(matchEditorCommands(query, commands).some((command) => command.id === id), query).toBe(true);
    }
  });

  it("도움말: 단축키 명령이 등록되어 '단축키' 검색으로 찾을 수 있다", () => {
    const commands = listEditorCommands();
    expect(commands.some((c) => c.id === "help-shortcuts")).toBe(true);
    expect(matchEditorCommands("단축키", commands).some((c) => c.id === "help-shortcuts")).toBe(true);
    expect(matchEditorCommands("help", commands).some((c) => c.id === "help-shortcuts")).toBe(true);
  });

  it("matchEditorCommands는 라벨/키워드 포함 매칭, 빈 질의는 전체", () => {
    const commands = listEditorCommands();
    expect(matchEditorCommands("", commands)).toHaveLength(commands.length);
    const hits = matchEditorCommands("채우기", commands);
    expect(hits.some((c) => c.id === "tool-fill")).toBe(true);
    expect(matchEditorCommands("fill", commands).some((c) => c.id === "tool-fill")).toBe(true);
  });
});
