import { describe, expect, it } from "vitest";
import { wellData } from "@/project/flagship/fallen/wellBeast";
import type { Project } from "@/project/types";

// 2026-11-10 오너: 「예고는 해야 맞지만, 약점을 보여줄 필요는 없음」.
// 우물 밑 눈먼 영주의 전투 중 글(끊김 문장·전투 대사)은 무엇을 하는지만 말하고 무엇이 끊는지(번개)는 말하지 않는다.
// 끊는 규칙(chargeBreak.elementIds)은 그대로다 — 약점이 사라진 게 아니라 글로 알려 주지 않을 뿐이다.

function build(): Project {
  const project = {
    switches: [], database: { skills: [], states: [], enemies: [], troops: [], equipment: [], actors: [] },
  } as unknown as Project;
  const upsert = <T extends { id: string }>(list: T[], row: T) => {
    const i = list.findIndex((x) => x.id === row.id);
    if (i >= 0) list[i] = row; else list.push(row);
  };
  const exec = (p: Project, name: string, args: Record<string, unknown>) => {
    const db = p.database as unknown as Record<string, { id: string }[]>;
    const table = { upsert_state: "states", upsert_skill: "skills", upsert_enemy: "enemies", upsert_troop: "troops", upsert_equipment: "equipment" }[name];
    if (!table) throw new Error(`unexpected tool ${name}`);
    upsert(db[table]!, Object.values(args)[0] as { id: string });
    return undefined;
  };
  wellData(project, exec);
  return project;
}

const ANSWER = /번개|천둥|뇌전|하늘의 불/;

describe("well boss hides its weakness but keeps the telegraph", () => {
  it("break messages and battle lines never name the answer element", () => {
    const project = build();
    const wellSkills = project.database.skills.filter((s) => s.id.startsWith("skill_fs2_well"));
    const breakers = wellSkills.filter((s) => s.chargeBreak);
    expect(breakers.length).toBeGreaterThanOrEqual(4);
    for (const s of breakers) expect(s.chargeBreak?.message ?? "", s.id).not.toMatch(ANSWER);
    const troop = project.database.troops.find((t) => t.id === "troop_fs2_well_beast") as unknown as { battleEventPages: { commands: { body?: string }[] }[] };
    const lines = troop.battleEventPages.flatMap((p) => p.commands.map((c) => c.body ?? "")).filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).not.toMatch(ANSWER);
  });

  it("keeps the mechanic: thunder still breaks the song and echo, and the boss is still weak to thunder", () => {
    const project = build();
    const skill = (id: string) => project.database.skills.find((s) => s.id === id)!;
    expect(skill("skill_fs2_well_gill_song").chargeBreak?.elementIds).toContain("thunder");
    expect(skill("skill_fs2_well_echo").chargeBreak?.elementIds).toContain("thunder");
    expect(skill("skill_fs2_well_gill_song").chargeTurns).toBe(1);
    expect(project.database.enemies.find((e) => e.id === "enemy_fs2_well_beast")!.elementRates.thunder).toBe("A");
  });
});
