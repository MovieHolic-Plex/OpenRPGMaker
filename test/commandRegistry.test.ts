import { beforeEach, describe, expect, it } from "vitest";
import { listEditorCommands, listMapCommands, matchEditorCommands } from "@/editor/commandRegistry";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests, getEditorUiMode } from "@/editor/editorUiMode";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

describe("commandRegistry", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    resetEditorUiModeForTests("beginner");
    editorState.set({ tool: "paint", layer: "lower" });
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

  it("모드 전환 명령이 초보→표준→전문가를 순환한다", () => {
    const toggle = listEditorCommands().find((c) => c.id === "mode-toggle");
    toggle!.run();
    expect(getEditorUiMode()).toBe("standard");
    toggle!.run();
    expect(getEditorUiMode()).toBe("expert");
    toggle!.run();
    expect(getEditorUiMode()).toBe("beginner");
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
      "drawer-map",
      "drawer-tile",
      "drawer-event",
      "mode-beginner",
      "mode-standard",
      "mode-expert",
      "toggle-chat-dock",
    ];
    expect(commands.filter((command) => requiredIds.includes(command.id)).map((command) => command.id)).toEqual(requiredIds);
  });

  it("direct mode commands select beginner, standard, and expert chrome", () => {
    const commands = listEditorCommands();
    for (const mode of ["beginner", "standard", "expert"] as const) {
      commands.find((command) => command.id === `mode-${mode}`)!.run();
      expect(getEditorUiMode()).toBe(mode);
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
