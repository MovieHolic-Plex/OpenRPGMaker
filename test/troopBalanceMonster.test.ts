// 몬스터 파티 게임의 트룹 밸런스 경고 기준선 — 2026-09-24 포켓몬풍 도그푸딩 pokemon-r2.
//
// 관장(스타터 Lv5 대비 과도한 몬스터 트룹)에 대해 액터 Lv1(HP 514) 기준 모의전이 「거의 위협이
// 되지 못합니다」만 뱉어 모델이 방치했고, 실제 자동 플레이는 스타터 단독파티로 그 전투에 전패해
// 마지막 목표(엔딩)가 막혔다. 경고는 스타터 기준으로 나와야 한다.

import { describe, expect, it } from "vitest";

import { runTool } from "@/editor/tools";
import { troopBalanceWarnings } from "@/editor/tools/troopBalanceCheck";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function monsterCtx(): { ctx: { project: Project }; speciesIds: string[] } {
  const ctx: { project: Project } = { project: createBlankProject() };
  ctx.project.system.battleParty = "monsters";
  ctx.project.system.monsterBattleParty = true;
  ctx.project.system.monsterCollection = true;
  const speciesIds = ctx.project.database.monsterSpecies.slice(0, 3).map(entry => entry.id);
  expect(speciesIds.length).toBeGreaterThan(0);
  const starter = runTool(ctx, "give_starter_monsters", { speciesIds });
  expect(starter.ok, starter.summary).toBe(true);
  return { ctx, speciesIds };
}

describe("troopBalanceWarnings — 몬스터 파티 기준선", () => {
  it("스타터로 못 이기는 트룹은 액터 기준 「위협 없음」 대신 전멸 경고를 낸다", () => {
    const { ctx, speciesIds } = monsterCtx();
    const speciesId = speciesIds[0]!;
    const enemy = runTool(ctx, "upsert_enemy", {
      enemy: { id: "enemy_impossible_golem", name: "불가능 골렘", monsterResourceId: "generated-enemy-slime-01", speciesId, level: 30 },
    });
    expect(enemy.ok, enemy.summary).toBe(true);
    const troop = runTool(ctx, "upsert_troop", {
      troop: { id: "troop_impossible", name: "불가능 트레이너", enemyIds: ["enemy_impossible_golem"] },
    });
    expect(troop.ok, troop.summary).toBe(true);

    const warnings = troopBalanceWarnings(ctx.project, "troop_impossible");
    const joined = warnings.join("\n");
    expect(joined).toContain("전멸");
    expect(joined).toContain("스타터");
    // 액터 Lv1(루카·HP 514) 기준으로 돌리면 「위협 없음」이 뜨던 옛 경고가 아니어야 한다.
    expect(joined).not.toContain("루카");
    expect(joined).not.toContain("거의 위협이 되지 못합니다");
  });

  it("약한 트룹도 액터 기준으로 판단하지 않는다 — 스타터 손실 기준만 쓴다", () => {
    const { ctx, speciesIds } = monsterCtx();
    const speciesId = speciesIds[0]!;
    const enemy = runTool(ctx, "upsert_enemy", {
      enemy: { id: "enemy_tiny_slime", name: "아주 약한 슬라임", monsterResourceId: "generated-enemy-slime-01", speciesId, level: 1 },
    });
    expect(enemy.ok, enemy.summary).toBe(true);
    const troop = runTool(ctx, "upsert_troop", {
      troop: { id: "troop_tiny", name: "아주 약한 무리", enemyIds: ["enemy_tiny_slime"] },
    });
    expect(troop.ok, troop.summary).toBe(true);

    const warnings = troopBalanceWarnings(ctx.project, "troop_tiny");
    const joined = warnings.join("\n");
    // 액터 기준(Lv1 루카 HP 514)이었다면 이 트룹에도 「거의 위협이 되지 못합니다」 가 떴을 것이다.
    // 스타터(수식 HP 18) 로는 모의전 손실이 10% 를 넘므로 경고 없음이 정상 — 어떤 경우든 액터 기준 문구는 나오면 안 된다.
    expect(joined).not.toContain("루카");
    expect(joined === "" || joined.includes("스타터")).toBe(true);
  });
});
