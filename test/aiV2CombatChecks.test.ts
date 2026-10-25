import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { combatProblems, healingSources, stepsPerEncounter } from "@/ai/v2/combatChecks";
import { withEncountersOnlyWhenAsked } from "@/ai/v2/game";
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import type { Project } from "@/project/types";

const WHOLE = "견습 기사가 세 가지 시험을 통과해 기사가 되는 RPG 만들어 줘. 서임식이 엔딩.";

function battleGame(): { before: Project; after: Project } {
  const before = createBlankProject() as Project;
  const after = structuredClone(before);
  const map = after.maps[after.startMapId]!;
  map.events.push({
    id: "ev_trial", name: "검술 시험관", x: 3, y: 3,
    pages: [{ ...structuredClone(map.events[0]?.pages?.[0] ?? {}), conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId: "troop_slime", canEscape: false, canLose: false }] }],
  } as never);
  return { before, after };
}

describe("v2 combat finish checks (J55 no healing, J4 first-area attrition)", () => {
  it("blocks a battle game with no way to recover HP, and clears once an inn exists", () => {
    const { before, after } = battleGame();
    expect(healingSources(after)).toEqual([]);
    const blocked = combatProblems(before, after, WHOLE);
    expect(blocked.some((p) => p.startsWith("[출하 차단 no-healing]"))).toBe(true);

    after.maps[after.startMapId]!.events.push({
      id: "ev_inn", name: "여관 주인", x: 5, y: 3,
      pages: [{ ...structuredClone(after.maps[after.startMapId]!.events[0]!.pages[0]!), commands: [{ kind: "recoverAll" }] }],
    } as never);
    expect(healingSources(after).length).toBeGreaterThan(0);
    expect(combatProblems(before, after, WHOLE).some((p) => p.includes("no-healing"))).toBe(false);
  });

  it("flags random encounters the request never asked for, not ones it did", () => {
    const { before, after } = battleGame();
    const map = after.maps[after.startMapId]!;
    map.encounterTable = [{ troopId: "troop_slime", weight: 1 }];
    map.encounterRate = 25;
    expect(combatProblems(before, after, WHOLE).some((p) => p.startsWith("[게임 검사 조우]"))).toBe(true);
    expect(combatProblems(before, after, `${WHOLE} 숲에서는 랜덤으로 몬스터가 나와.`).some((p) => p.startsWith("[게임 검사 조우]"))).toBe(false);
  });

  it("leaves small non-combat edits alone", () => {
    const { after } = battleGame();
    expect(combatProblems(after, structuredClone(after), "촌장 대사를 바꿔 줘")).toEqual([]);
  });

  it("set_encounter_table defaults to off when the request has no encounter words", async () => {
    const seen: unknown[] = [];
    const tool: PiToolShape = { name: "set_encounter_table", label: "", description: "", parameters: {}, async execute(_id, params) { seen.push(params); return { content: [{ type: "text", text: "{}" }] }; } };
    const [quiet] = withEncountersOnlyWhenAsked([tool], WHOLE);
    await quiet!.execute("1", { mapId: "m", entries: [] });
    expect((seen[0] as { encounterRate?: number }).encounterRate).toBe(0);
    await quiet!.execute("2", { mapId: "m", entries: [], encounterRate: 8 });
    expect((seen[1] as { encounterRate?: number }).encounterRate).toBe(8);
    const [asked] = withEncountersOnlyWhenAsked([tool], "동굴에서 랜덤 인카운터가 나오게");
    await asked!.execute("3", { mapId: "m", entries: [] });
    expect((seen[2] as { encounterRate?: number }).encounterRate).toBeUndefined();
  });

  it("steps per encounter follows the runtime accumulator", () => {
    expect(stepsPerEncounter(8)).toBe(14);
    expect(stepsPerEncounter(25)).toBe(8);
    expect(stepsPerEncounter(0)).toBe(Infinity);
  });
});
