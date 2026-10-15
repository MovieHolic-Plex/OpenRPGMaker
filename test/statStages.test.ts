import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import {
  applyStatStage,
  compactStatStages,
  shiftStatStage,
  statStageMessage,
  statStageMultiplier,
} from "@/battle/statStages";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";

const skillBase = {
  animationId: "anim_magic",
  description: "x",
  type: "normal" as const,
  mpCost: { flat: 0, percentMax: 0 },
  successRate: 100,
  variance: 0,
  hitRate: 100,
  effect: { kind: "support" as const },
  maxPp: 30,
  power: 0,
};

function battle(skills: readonly Record<string, unknown>[], moveIds: readonly string[], model: "gen1" | "rm2k3" = "gen1") {
  const project: any = createScarloxyPokemonDemoProject();
  if (model === "rm2k3") delete project.system.battleModel;
  for (const skill of skills) project.database.skills.push(normalizeSkillRecord({ ...skillBase, ...skill } as any));
  const monster = {
    instanceId: "m1", speciesId: scarloxySpeciesId("sparchu"), level: 50, exp: 0, skillIds: [...moveIds],
    skillPp: Object.fromEntries(moveIds.map((id) => [id, 30])), friendship: 70, caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 },
  };
  let seed = 7;
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return ((seed >>> 8) & 0xffff) / 65536; };
  return createBattleRuntime({
    project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict",
    partyMonsters: [monster], sessionState: { switches: {}, variables: {}, inventory: {} }, rng,
  } as any) as any;
}

describe("능력치 단계 배율", () => {
  it("카트리지 표: −6 은 25%, 0 은 그대로, +6 은 400%", () => {
    expect(applyStatStage(100, { attack: -6 }, "attack")).toBe(25);
    expect(applyStatStage(100, { attack: 0 }, "attack")).toBe(100);
    expect(applyStatStage(100, { attack: 6 }, "attack")).toBe(400);
    expect(statStageMultiplier(undefined, "speed")).toBe(1);
  });

  it("한계(±6)에서 멈추고 실제로 바뀐 폭을 돌려준다", () => {
    const up = shiftStatStage({ attack: 5 }, "attack", 3);
    expect(up.stages).toEqual({ attack: 6 });
    expect(up.change).toMatchObject({ before: 5, after: 6, applied: 1, requested: 3 });
    const capped = shiftStatStage({ attack: 6 }, "attack", 1);
    expect(capped.change.applied).toBe(0);
    expect(statStageMessage("스파르츄", capped.change)).toBe("스파르츄의 공격은 더 이상 오르지 않는다!");
    expect(compactStatStages({ attack: 0, speed: 0 })).toBeUndefined();
  });

  it("문장은 변화 폭으로 올랐다/크게 올랐다/대폭 올랐다", () => {
    const line = (delta: number) => statStageMessage("가", shiftStatStage(undefined, "defense", delta).change);
    expect(line(1)).toBe("가의 방어가 올랐다!");
    expect(line(2)).toBe("가의 방어가 크게 올랐다!");
    expect(line(3)).toBe("가의 방어가 대폭 올랐다!");
    expect(line(-1)).toBe("가의 방어가 내려갔다!");
  });
});

describe("skill.statStageEffects 정규화", () => {
  it("모르는 stat·0 단계는 버리고 범위를 자른다, 없으면 필드 자체가 없다", () => {
    const plain = normalizeSkillRecord({ ...skillBase, id: "a", name: "a", scope: "enemy" } as any);
    expect("statStageEffects" in plain).toBe(false);
    const record = normalizeSkillRecord({
      ...skillBase, id: "b", name: "b", scope: "enemy",
      statStageEffects: [{ stat: "attack", stages: 9 }, { stat: "bogus", stages: 1 }, { stat: "speed", stages: 0 }, { stat: "evasion", stages: -2, chance: 30, target: "self" }],
    } as any);
    expect(record.statStageEffects).toEqual([{ stat: "attack", stages: 6 }, { stat: "evasion", stages: -2, chance: 30, target: "self" }]);
  });
});

describe("전투 런타임의 능력치 단계", () => {
  const growl = { id: "t_growl", name: "울음", scope: "enemy", statStageEffects: [{ stat: "attack", stages: -1 }] };
  const swords = { id: "t_swords", name: "칼춤", scope: "self", statStageEffects: [{ stat: "attack", stages: 2 }] };
  const cast = (rt: any, skillId: string, self = false) => {
    const before = rt.snapshot().timeline.length;
    rt.performActorCommand({ kind: "skill", skillId, targetEnemyId: "enemy-1", ...(self ? { targetActorId: "m1" } : {}) });
    return rt.snapshot().timeline.slice(before);
  };

  for (const model of ["gen1", "rm2k3"] as const) {
    it(`${model}: 칼춤은 시전자에게 +2, 울음은 대상에게 −1 이 걸리고 스냅샷에 실린다`, () => {
      const rt = battle([growl, swords], ["t_growl", "t_swords"], model);
      const own = cast(rt, "t_swords", true);
      expect(own.find((entry: any) => entry.statStage)?.statStage).toMatchObject({ stat: "attack", before: 0, after: 2 });
      expect(rt.snapshot().actors[0].statStages).toEqual({ attack: 2 });
      cast(rt, "t_growl");
      expect(rt.snapshot().enemies[0].statStages).toEqual({ attack: -1 });
    });
  }

  it("gen1: 공격 +2 가 물리 피해를 키운다(단계 없는 같은 전투 대비)", () => {
    const quick = "skill_scarloxy_quick";
    const base = battle([swords], [quick, "t_swords"]);
    const first = cast(base, quick).find((entry: any) => entry.kind === "damage" && entry.side === "actor")?.amount ?? 0;
    const boosted = battle([swords], [quick, "t_swords"]);
    cast(boosted, "t_swords", true);
    const second = cast(boosted, quick).find((entry: any) => entry.kind === "damage" && entry.side === "actor")?.amount ?? 0;
    expect(second).toBeGreaterThan(first);
  });

  it("+6 한계 뒤에는 한 줄 문장만 남기고 단계는 그대로", () => {
    const rt = battle([{ id: "t_harden", name: "단단", scope: "self", statStageEffects: [{ stat: "defense", stages: 6 }] }], ["t_harden"]);
    cast(rt, "t_harden", true);
    const again = cast(rt, "t_harden", true);
    expect(again.find((entry: any) => entry.statStage)?.message).toBe("스파르츄의 방어는 더 이상 오르지 않는다!");
    expect(rt.snapshot().actors[0].statStages).toEqual({ defense: 6 });
  });

  it("단계가 없는 전투의 스냅샷에는 statStages 필드가 없다(저장·표시 바이트 불변)", () => {
    const rt = battle([], ["skill_scarloxy_quick"]);
    expect("statStages" in rt.snapshot().actors[0]).toBe(false);
  });
});
