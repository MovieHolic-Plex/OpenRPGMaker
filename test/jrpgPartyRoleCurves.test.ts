// jrpg-loop-1 D7: 조수가 만든 JRPG 파티원은 전부 기본 곡선(HP514·MP43…)이라 같은 몸이었다 — 도구가 즉시 알리고 검사가 평평한 파티도 잡는다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { checkJrpg } from "@/qa/gameCheck/jrpg";
import type { Project } from "@/project/types";

function party(curves: Array<Record<string, number[]> | undefined>): { project: Project; warnings: string[][] } {
  const ctx = { project: createBlankProject() };
  ctx.project.system.genre = "adventure-jrpg";
  const warnings: string[][] = [];
  const ids: string[] = [];
  curves.forEach((parameterCurves, index) => {
    const id = `actor_t${index}`;
    ids.push(id);
    const result = runTool(ctx as never, "upsert_actor", { actor: { id, name: `배우${index}`, classId: ctx.project.database.classes[0]!.id, ...(parameterCurves ? { parameterCurves } : {}) } });
    warnings.push(result.ok ? (result.diff.warnings ?? []) : [String(result.summary)]);
  });
  expect(runTool(ctx as never, "set_party", { scope: "start", actorIds: ids }).ok).toBe(true);
  return { project: ctx.project, warnings };
}

describe("JRPG 파티 역할 곡선", () => {
  it("기본 곡선 그대로인 두 번째 배우에게 곡선을 주라고 알린다", () => {
    const { warnings } = party([undefined, undefined]);
    expect(warnings[1]!.some((text) => text.includes("완전히 같습니다"))).toBe(true);
  });
  it("역할별 곡선을 주면 같은 몸 경고도 평평한 파티 경고도 없다", () => {
    const { project, warnings } = party([
      { maxHp: [640, 6200], defense: [90, 900], attack: [70, 780] },
      { maxHp: [380, 3600], maxMp: [75, 980], mind: [95, 950] },
      { agility: [85, 950], attack: [65, 760], maxHp: [470, 4600] },
    ]);
    expect(warnings.flat().some((text) => text.includes("완전히 같습니다"))).toBe(false);
    const codes = checkJrpg(project).map((finding) => finding.code);
    expect(codes).not.toContain("jrpg-party-identical-stats");
    expect(codes).not.toContain("jrpg-party-flat-roles");
  });
  it("세 명 이상인데 곡선이 거의 같으면 flat-roles 로 잡는다", () => {
    const { project } = party([
      { maxHp: [520, 5000] },
      { maxHp: [530, 5050] },
      { maxHp: [510, 4980] },
    ]);
    const codes = checkJrpg(project).map((finding) => finding.code);
    expect(codes.includes("jrpg-party-identical-stats") || codes.includes("jrpg-party-flat-roles")).toBe(true);
  });
});
