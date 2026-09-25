import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { compileCutscene } from "@/editor/cutscene";
import { createBlankProject } from "@/project/defaults/blankProject";

describe("컷신 shake beat", () => {
  it("script_cutscene 이 shake beat 를 명령 형식 오류 없이 받는다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "script_cutscene", {
      mapId: ctx.project.startMapId, x: 3, y: 3, trigger: "auto", once: true,
      beats: [{ kind: "fade", direction: "in", durationMs: 800 }, { kind: "shake", durationMs: 500 }, { kind: "say", speaker: "탐정", text: "비명이다!" }],
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });

  it("intensity 숫자는 선택지 문자열로 맞추고 런타임 value 도 채운다", () => {
    const project = createBlankProject();
    const commands = compileCutscene([{ kind: "shake", intensity: 7 }], { project } as never) as unknown as { kind: string; fields?: Record<string, unknown> }[];
    const shake = JSON.stringify(commands);
    expect(shake).toContain('"intensity":"6"');
    expect(shake).toContain('"value":6');
  });
});
