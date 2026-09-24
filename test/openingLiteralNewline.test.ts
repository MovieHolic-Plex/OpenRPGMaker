import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

// 추리 도그푸딩 gen: set_opening 서술에 「\\n」 두 글자가 와서 오프닝에 「밤.\n불의의」 가 그대로 떴다.
describe("오프닝 서술의 글자 그대로 \\n", () => {
  it("set_opening·edit_opening 은 백슬래시-n 을 줄바꿈으로 바꾼다", () => {
    const ctx = { project: createBlankProject() };
    const set = runTool(ctx, "set_opening", { enabled: true, scenes: [{ kind: "text", narration: "폭풍우 치던 밤.\\n탐정은 저택으로 피신했다.", durationMs: 4000 }] });
    expect(set.ok, set.summary).toBe(true);
    expect(ctx.project.system.opening?.scenes[0]?.narration).toBe("폭풍우 치던 밤.\n탐정은 저택으로 피신했다.");
    const edit = runTool(ctx, "edit_opening", { op: "append", scene: { kind: "text", narration: "그리고\\r\\n비명.", durationMs: 3000 } });
    expect(edit.ok, edit.summary).toBe(true);
    expect(ctx.project.system.opening?.scenes.at(-1)?.narration).toBe("그리고\n비명.");
  });
});
