// 2026-10-05 조수 스트레스 실측: 「이기면 500G」를 적 보상 gold 500 과 승리 분기 changeGold +500 으로 둘 다 넣어
// 실제로는 1000G 가 들어왔는데 도구는 ok 만 돌려줬다. 거부하지 않고 합계를 경고로 알린다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

function bossEvent(troopId: string, victoryBranch: unknown[]) {
  return { id: "ev_boss", name: "보스", x: 3, y: 3, pages: [{ conditions: [], trigger: { kind: "action" }, commands: [{
    kind: "battleProcessing", troopId, canEscape: false, canLose: true, branchOnResult: true,
    victoryBranch, defeatBranch: [{ kind: "gameOver" }],
  }] }] };
}

describe("battle gold double reward warning", () => {
  const setup = () => {
    const project = createBlankProject();
    const troop = project.database.troops[0]!;
    const enemyId = troop.members?.[0]?.enemyId ?? troop.enemyIds[0]!;
    const enemy = project.database.enemies.find(entry => entry.id === enemyId)!;
    enemy.rewards = { ...enemy.rewards, gold: 500 };
    for (const other of troop.members?.map(member => member.enemyId) ?? troop.enemyIds) {
      if (other !== enemyId) project.database.enemies.find(entry => entry.id === other)!.rewards.gold = 0;
    }
    return { project, troopId: troop.id };
  };
  const warnings = (result: ReturnType<typeof runTool>) =>
    ((result as { diff?: { warnings?: string[] } }).diff?.warnings ?? []).filter(warning => warning.includes("전투 보상 골드"));

  it("warns when the victory branch adds gold on top of the troop's battle reward", () => {
    const { project, troopId } = setup();
    const result = runTool({ project }, "upsert_event", { mapId: project.startMapId,
      event: bossEvent(troopId, [{ kind: "changeGold", op: "+=", amount: 500 }]) });
    expect(result.ok).toBe(true);
    expect(warnings(result).join("\n")).toContain("1000G");
  });

  it("stays quiet when the victory branch gives no extra gold", () => {
    const { project, troopId } = setup();
    const result = runTool({ project }, "upsert_event", { mapId: project.startMapId,
      event: bossEvent(troopId, [{ kind: "text", body: "이겼다" }]) });
    expect(result.ok).toBe(true);
    expect(warnings(result)).toEqual([]);
  });
});
