import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listEditorCommands, listMapCommands, matchEditorCommands } from "@/editor/commandRegistry";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests, getEditorUiMode } from "@/editor/editorUiMode";
import { allPanels } from "@/editor/workspace/panelRegistry";
import { getWorkspaceLayout, resetWorkspaceForTests, updateWorkspaceLayout } from "@/editor/workspace/workspaceStore";
import { layoutFromPreset } from "@/editor/workspace/workspaceLayout";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const WORKSPACE_KEY = "oprn:workspace:v1";
const UI_MODE_KEY = "oprn:editor-ui-mode";

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
    resetEditorUiModeForTests("beginner");
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

  it("편집 모드 명령이 모드를 바꾸고 도크 구성은 건드리지 않는다", () => {
    // 2026-09-03: 「화면: 밀도 — 안내/보통/촘촘」과 「화면: 프리셋 — …」 명령을 걷었다. 밀도는 편집 모드와
    // 같은 축의 두 번째 이름이었고, 프리셋은 톱바 작업 칩과 함께 사라진 개념이다.
    const commands = listEditorCommands();
    const before = getWorkspaceLayout().docks;
    commands.find((c) => c.id === "editor-ui-mode-expert")!.run();
    expect(getEditorUiMode()).toBe("expert");
    expect(getWorkspaceLayout().density).toBe("dense");
    expect(getWorkspaceLayout().docks).toEqual(before);
    commands.find((c) => c.id === "editor-ui-mode-beginner")!.run();
    expect(getEditorUiMode()).toBe("beginner");
    expect(getWorkspaceLayout().density).toBe("guided");
    expect(commands.some((c) => c.id.startsWith("workspace-preset-"))).toBe(false);
    expect(commands.some((c) => c.id.startsWith("workspace-density-"))).toBe(false);
  });

  it("패널 명령이 도크를 옮기고 닫는다", () => {
    resetEditorUiModeForTests("standard");
    installDockHosts();
    const commands = listEditorCommands();
    updateWorkspaceLayout(layoutFromPreset("map"));
    commands.find((c) => c.id === "workspace-panel-tiles-right")!.run();
    expect(getWorkspaceLayout().docks.left).toEqual(["maps"]);
    expect(getWorkspaceLayout().docks.right).toContain("tiles");

    commands.find((c) => c.id === "workspace-panel-tiles")!.run();
    expect(getWorkspaceLayout().docks.right).not.toContain("tiles");
  });

  it("초보 모드에는 도크 패널 명령을 등록하지 않는다", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    installDockHosts();
    storage.setItem(UI_MODE_KEY, "beginner");
    storage.setItem(WORKSPACE_KEY, JSON.stringify({
      presetId: "map",
      docks: { left: ["tiles", "maps"], right: ["assistant"], bottom: [] },
    }));
    resetEditorUiModeForTests("beginner");
    resetWorkspaceForTests();

    const ids = listEditorCommands().map((command) => command.id);
    expect(ids).not.toContain("workspace-panel-tiles");
    expect(ids).not.toContain("workspace-panel-maps");
    expect(ids).not.toContain("workspace-panel-tiles-right");
    expect(ids).not.toContain("workspace-panel-maps-right");
    expect(JSON.parse(storage.getItem(WORKSPACE_KEY) ?? "{}").docks.left).toEqual(["tiles", "maps"]);
  });

  // 예전 이름(밀도 낱말)으로 검색하던 손을 막지 않는다.
  it("구 밀도 이름으로도 편집 모드 명령이 검색된다", () => {
    const commands = listEditorCommands();
    expect(matchEditorCommands("전문가", commands).some((c) => c.id === "editor-ui-mode-expert")).toBe(true);
    expect(matchEditorCommands("촘촘", commands).some((c) => c.id === "editor-ui-mode-expert")).toBe(true);
    expect(matchEditorCommands("초보", commands).some((c) => c.id === "editor-ui-mode-beginner")).toBe(true);
    expect(matchEditorCommands("안내", commands).some((c) => c.id === "editor-ui-mode-beginner")).toBe(true);
    expect(matchEditorCommands("모드", commands).filter((c) => c.id.startsWith("editor-ui-mode-"))).toHaveLength(3);
  });

  it("맵 명령은 주입된 select를 호출한다", () => {
    const project = store.getCurrent();
    const picked: string[] = [];
    const commands = listMapCommands(project, (mapId) => { picked.push(mapId); return true; });
    expect(commands.length).toBeGreaterThan(0);
    commands[0]!.run();
    expect(picked).toHaveLength(1);
  });

  it("registers the complete expert chrome command set exactly once", () => {
    const commands = listEditorCommands();
    const requiredIds = [
      "open-world",
      "open-resources",
      // 2026-09-03: 표준 모드에서 도구 메뉴 두 번 클릭이 유일한 길이던 셋에 팔레트 길을 낸다.
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

  it("워크스페이스 명령이 편집 모드 3개 · 패널마다 3개씩 정확히 한 번 등록된다", () => {
    resetEditorUiModeForTests("standard");
    installDockHosts();
    const ids = listEditorCommands().map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const mode of ["beginner", "standard", "expert"]) {
      expect(ids.filter((id) => id === `editor-ui-mode-${mode}`)).toHaveLength(1);
    }
    for (const panel of allPanels().filter((candidate) => candidate.id !== "assistant")) {
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
