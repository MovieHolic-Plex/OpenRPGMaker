import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { battleDataEmptied, unaskedChanges } from "@/ai/v2/gameChecks";
import type { Project } from "@/project/types";

// 2026-10-25 장난감 가게 고치기 4턴: 「메뉴의 스킬·장비·파티도 빼 줘」에 주인공 기술·직업 전투 데이터를 비웠고, 「파티」「스킬」 낱말 면제로 못 잡았다.
const T4 = "엔딩 카드 본문에 「노장인 제페토:」 이름표가 그대로 붙어 나와. 이름표 없이 이야기처럼 써 줘. 선택지의 「(엔딩)」 메모와 메뉴의 스킬·장비·파티도 빼 줘. 전투 없는 이야기인데 하트 체력 514/514 가 보이니 지워 줘.";
function emptied() {
  const before = createBlankProject() as Project;
  const after = structuredClone(before);
  const hero = after.database.actors[0]!;
  const cls = after.database.classes.find((c) => c.id === hero.classId) ?? after.database.classes[0]!;
  const beforeCls = before.database.classes.find((c) => c.id === cls.id)!;
  // 빈 프로젝트 직업에 데이터가 없을 수도 있어 앞에 채워 둔다.
  beforeCls.learnedSkills = [{ level: 1, skillId: "skill_x" } as never];
  beforeCls.battleCommands = [{ kind: "attack" } as never];
  before.database.actors[0]!.learnedSkills = [{ level: 1, skillId: "skill_y" } as never];
  hero.learnedSkills = [];
  cls.learnedSkills = [];
  cls.battleCommands = [];
  return { before, after };
}

describe("menu requests never empty actor/class battle data", () => {
  it("flags the T4 case even though the request says 파티·스킬", () => {
    const { before, after } = emptied();
    const out = unaskedChanges(before, after, T4);
    expect(out.some((l) => l.includes("전투 데이터") && l.includes("configure_field_menu"))).toBe(true);
    expect(battleDataEmptied(before, after, T4).length).toBe(2);
  });
  it("allows it when the request asks to delete the data itself", () => {
    const { before, after } = emptied();
    expect(battleDataEmptied(before, after, "주인공 스킬을 전부 지워 줘")).toEqual([]);
  });
  it("is quiet when nothing shrank", () => {
    const before = createBlankProject() as Project;
    expect(battleDataEmptied(before, structuredClone(before), T4)).toEqual([]);
  });
});

describe("advisor diff shows emptied battle data", () => {
  it("lists ⚠ 비운 데이터 lines instead of only counts", async () => {
    const { summarizeProjectDiff } = await import("@/ai/v2/advisor");
    const { before, after } = emptied();
    expect(summarizeProjectDiff(before, after)).toContain("⚠ 비운 데이터");
  });
});
