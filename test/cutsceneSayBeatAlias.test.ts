// 컷신·에필로그에 이벤트 명령 모양 {kind:"text",body} 로 쓴 대사를 say 로 옮긴다.
// 2026-09-24 갤러리 호러 r5: define_ending 세 번이 스키마 enum 에서 통째로 튕겼다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

describe("say beat aliases", () => {
  it("define_ending accepts text/body epilogue beats as say", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const result = runTool(ctx, "define_ending", { id: "ending_bad", name: "그림 속의 미아", conditions: [], epilogue: [
      { kind: "text", body: "마지막 꽃잎이 떨어졌다." },
      { kind: "narrate", text: "하린은 그림의 일부가 되었다." },
    ] });
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
    const ending = ctx.project.endings!.find((entry) => entry.id === "ending_bad")!;
    expect(JSON.stringify(ending.epilogue)).toContain('"kind":"say"');
    expect(JSON.stringify(ending.epilogue)).toContain("마지막 꽃잎이 떨어졌다.");
    expect(JSON.stringify(ending.epilogue)).not.toContain('"body"');
    expect(JSON.stringify(result)).toContain("say 로 옮겼습니다");
  });

  it("script_cutscene accepts a text beat inside parallel", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const result = runTool(ctx, "script_cutscene", { mapId: ctx.project.startMapId, x: 3, y: 3, trigger: "auto", once: true, beats: [
      { kind: "text", body: "그림이 웃었다." },
      { kind: "parallel", beats: [{ kind: "text", message: "…" }, { kind: "shake", durationMs: 300 }] },
    ] });
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
  });
});
