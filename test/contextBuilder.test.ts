// test/contextBuilder.test.ts
// 시스템 프롬프트 어휘 다이제스트 계약 테스트 — role별 시공 그룹 id 주입(2단계-C).

import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { createBlankProject } from "@/project/defaults";

describe("buildSystemPrompt — 타일 어휘 다이제스트", () => {
  it("어휘 다이제스트에 role별 시공 그룹 id가 들어간다", () => {
    const project = createBlankProject();
    const context = buildSystemPrompt(project, { currentMapId: project.startMapId });
    expect(context).toContain("harness-combined-town-plaster-wall-9slice");
    expect(context).toMatch(/wall:/);
  });
});
