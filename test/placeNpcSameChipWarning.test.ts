// 잠금 누수 감사(2026-10-16) #8 준비 — 같은 걷기 칩이 한 맵에 세 번째로 놓이면 place_npc 가 알린다. 막지는 않는다.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
import { beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

beforeEach(() => resetMapEditHistory());

describe("place_npc 같은 칩 3번째 경고", () => {
  it("같은 칩 두 명까지는 경고가 없고, 세 번째부터 경고가 붙는다", () => {
    const project = createBlankProject();
    const ctx = { project, currentMapId: project.startMapId, assistantRun: true } as ToolContext;
    const graphic = { textureKey: "tex_easyrpg_charset_people1", characterIndex: 2 };
    const results = [0, 1, 2].map((i) => runTool(ctx, "place_npc", { mapId: project.startMapId, name: `주민${i}`, x: 3 + i * 3, y: 6, graphic }, { dryRun: false }));
    expect(results.every((result) => result.ok)).toBe(true);
    const warned = (result: (typeof results)[number]) => (result.diff?.warnings ?? []).some((warning) => /같은 걷기 칩/u.test(warning));
    expect(warned(results[0]!)).toBe(false);
    expect(warned(results[1]!)).toBe(false);
    expect(warned(results[2]!)).toBe(true);
  });
});
