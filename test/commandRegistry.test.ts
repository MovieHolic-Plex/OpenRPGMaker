import { beforeEach, describe, expect, it } from "vitest";
import { listEditorCommands, listMapCommands, matchEditorCommands } from "@/editor/commandRegistry";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests, getEditorUiMode } from "@/editor/editorUiMode";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

describe("commandRegistry", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    resetEditorUiModeForTests("basic");
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

  it("모드 전환 명령이 basic↔expert를 토글한다", () => {
    const toggle = listEditorCommands().find((c) => c.id === "mode-toggle");
    toggle!.run();
    expect(getEditorUiMode()).toBe("expert");
    toggle!.run();
    expect(getEditorUiMode()).toBe("basic");
  });

  it("맵 명령은 주입된 select를 호출한다", () => {
    const project = store.getCurrent();
    const picked: string[] = [];
    const commands = listMapCommands(project, (mapId) => { picked.push(mapId); return true; });
    expect(commands.length).toBeGreaterThan(0);
    commands[0]!.run();
    expect(picked).toHaveLength(1);
  });

  it("matchEditorCommands는 라벨/키워드 포함 매칭, 빈 질의는 전체", () => {
    const commands = listEditorCommands();
    expect(matchEditorCommands("", commands)).toHaveLength(commands.length);
    const hits = matchEditorCommands("채우기", commands);
    expect(hits.some((c) => c.id === "tool-fill")).toBe(true);
    expect(matchEditorCommands("fill", commands).some((c) => c.id === "tool-fill")).toBe(true);
  });
});
