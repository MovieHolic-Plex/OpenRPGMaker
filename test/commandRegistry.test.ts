import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listEditorCommands, listMapCommands, matchEditorCommands } from "@/editor/commandRegistry";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests, getEditorUiMode } from "@/editor/editorUiMode";
import { allPanels } from "@/editor/workspace/panelRegistry";
import { WORKSPACE_PRESETS } from "@/editor/workspace/workspaceLayout";
import { getWorkspaceLayout, resetWorkspaceForTests } from "@/editor/workspace/workspaceStore";
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

  it("레이아웃 프리셋은 도크만 바꾸고 현재 밀도를 보존한다", () => {
    const commands = listEditorCommands();
    commands.find((c) => c.id === "workspace-preset-data")!.run();
    expect(getWorkspaceLayout().presetId).toBe("data");
    expect(getWorkspaceLayout().docks.left).toEqual([]);
    expect(getEditorUiMode()).toBe("beginner");

    commands.find((c) => c.id === "workspace-preset-map")!.run();
    expect(getWorkspaceLayout().docks.left).toEqual(["tiles", "maps"]);
    expect(getEditorUiMode()).toBe("beginner");
  });

  it("밀도 명령이 프리셋 구성을 건드리지 않고 밀도만 바꾼다", () => {
    const commands = listEditorCommands();
    commands.find((c) => c.id === "workspace-preset-map")!.run();
    const before = getWorkspaceLayout().docks;
    commands.find((c) => c.id === "workspace-density-guided")!.run();
    expect(getEditorUiMode()).toBe("beginner");
    expect(getWorkspaceLayout().density).toBe("guided");
    expect(getWorkspaceLayout().docks).toEqual(before);
  });

  it("패널 명령이 도크를 옮기고 닫는다", () => {
    resetEditorUiModeForTests("standard");
    installDockHosts();
    const commands = listEditorCommands();
    commands.find((c) => c.id === "workspace-preset-map")!.run();
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

  // 예전 이름으로 검색하던 손을 막지 않는다.
  it("구 모드 이름으로도 프리셋·밀도 명령이 검색된다", () => {
    const commands = listEditorCommands();
    expect(matchEditorCommands("전문가", commands).some((c) => c.id === "workspace-density-dense")).toBe(true);
    expect(matchEditorCommands("초보", commands).some((c) => c.id === "workspace-density-guided")).toBe(true);
    expect(matchEditorCommands("모드", commands).some((c) => c.id.startsWith("workspace-preset-"))).toBe(true);
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
      "map-screenshot",
      "build-palette",
      // 구 `drawer-map` / `drawer-tile` / `drawer-event` 는 2026-08-26 에 삭제됐다.
      // 그 세 명령은 `activateLeftDrawerTab()` 을 부르고 있었는데, 그 함수가 사용하는 서랽 탭 UI는
      // 어느 지점에서도 마운트되지 않았다 — `drawer-map` 은 아무 일도 하지 않았고,
      // `drawer-tile` / `drawer-event` 는 아래 레이어 명령과 중복이었다.
      "layer-lower",
      "layer-upper",
      "layer-event",
      "toggle-chat-dock",
    ];
    expect(commands.filter((command) => requiredIds.includes(command.id)).map((command) => command.id).sort()).toEqual([...requiredIds].sort());
  });

  it("워크스페이스 명령이 프리셋 3개 · 밀도 3개 · 패널마다 3개씩 정확히 한 번 등록된다", () => {
    resetEditorUiModeForTests("standard");
    installDockHosts();
    const ids = listEditorCommands().map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of WORKSPACE_PRESETS) {
      expect(ids.filter((id) => id === `workspace-preset-${preset.id}`)).toHaveLength(1);
    }
    for (const density of ["guided", "comfortable", "dense"]) {
      expect(ids.filter((id) => id === `workspace-density-${density}`)).toHaveLength(1);
    }
    for (const panel of allPanels().filter((candidate) => candidate.id !== "assistant")) {
      expect(ids).toContain(`workspace-panel-${panel.id}`);
      expect(ids).toContain(`workspace-panel-${panel.id}-left`);
      expect(ids).toContain(`workspace-panel-${panel.id}-right`);
    }
    expect(ids).not.toContain("workspace-panel-assistant-left");
    expect(ids).toEqual(expect.arrayContaining([
      "assistant-dock-glass",
      "assistant-dock-side",
      "assistant-dock-float",
    ]));
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
