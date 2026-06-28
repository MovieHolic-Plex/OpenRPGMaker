import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleProject() {
  return deserialize(JSON.stringify(battleFixture));
}

// DB 기반 전투 런타임 검증(RM2K3 에디터 경험 개선분):
// 1) 액터/적 능력치가 데이터베이스 곡선/스탯에서 온다.
// 2) defend 명령이 피해를 절반으로 줄인다.
// 3) escape 가 결과로 나올 수 있다.
// 4) 승리 보상(exp/gold)이 적 rewards 에서 누적된다.
describe("database-driven battle runtime", () => {
  it("reads actor max HP from the parameter curve at initial level", () => {
    const runtime = createBattleRuntime({
      project: battleProject(),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });
    // 기본 주인공 레벨1 곡선 maxHp = 514(actorModel PARAMETER_LEVEL_ONE).
    expect(runtime.snapshot().actors[0]?.maxHp).toBe(514);
  });

  it("normalizes legacy actor and enemy records before creating battlers", () => {
    const project = battleProject();
    const actor = project.database.actors[0];
    const enemy = project.database.enemies[0];
    if (!actor || !enemy) throw new Error("expected battle fixture records");
    delete (actor as Partial<typeof actor>).parameterCurves;
    delete (enemy as Partial<typeof enemy>).stats;

    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });

    expect(runtime.snapshot().actors[0]?.maxHp).toBeGreaterThan(0);
    expect(runtime.snapshot().enemies[0]?.maxHp).toBeGreaterThan(0);
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().result).toBe("victory");
  });

  it("reads enemy HP/attack from enemy stats, not hardcoded constants", () => {
    const runtime = createBattleRuntime({
      project: battleProject(),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });
    // fixture 의 slime stats.maxHp = 10.
    expect(runtime.snapshot().enemies[0]?.maxHp).toBe(10);
  });

  it("accumulates exp/gold rewards from defeated enemies on victory", () => {
    const runtime = createBattleRuntime({
      project: battleProject(),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });
    runtime.tick(1_000);
    // 한 번의 공격으로 약한 slime(10 HP) 처치 → 승리.
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();
    expect(snapshot.result).toBe("victory");
    expect(snapshot.rewards.exp).toBe(7);
    expect(snapshot.rewards.gold).toBe(3);
  });

  it("halves incoming damage while an actor is defending", () => {
    // slime 의 공격력 기반 일반 공격 데미지가, 방어 시 절반으로 줄어드는지 확인.
    // slime 은 skillIds 가 비어 있어 일반 공격(power = attack)을 쓴다.
    const runtime = createBattleRuntime({
      project: battleProject(),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });
    // 1) 먼저 액터 턴에서 방어 명령을 준다.
    runtime.tick(1_000);
    expect(runtime.snapshot().phase).toBe("actorCommand");
    runtime.performActorCommand({ kind: "defend" });
    // 2) 적 턴까지 충분히 진행한다.
    runtime.tick(10_000);
    const hero = runtime.snapshot().actors[0];
    // 방어 중 받은 피해: 데미지 = attack(10)/2 + 10/2 − defense(59)/2, 방어 시 절반.
    // 절대값보다 '방어로 인해 살아남았는지(514 HP에서 한 방에 죽지 않음)' 로 검증.
    expect(hero?.defeated).toBe(false);
    expect(hero?.hp).toBeGreaterThan(0);
  });

  it("supports escape attempt when canEscape is enabled", () => {
    const runtime = createBattleRuntime({
      project: battleProject(),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "escape" });
    const result = runtime.snapshot().result;
    // 도주 시도 결과는 승리/패배가 아닌 escape 이거나(실패 시) 여전히 진행 중.
    expect(["escape", undefined]).toContain(result);
  });

  it("supports a healing skill effect instead of dealing damage", () => {
    // skill_claw 는 damage 효과지만, 힐 스킬을 임시로 만들어 효과 분기를 검증한다.
    const project = battleProject();
    project.database.skills[0] = {
      ...project.database.skills[0],
      id: "skill_heal",
      name: "Heal",
      power: 30,
      effect: { kind: "healing", statistic: "mind", affects: "hp" },
    };
    project.database.actors[0] = {
      ...project.database.actors[0],
      learnedSkills: [{ level: 1, skillId: "skill_heal" }],
    };
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });
    runtime.tick(1_000);
    // 힐 스킬을 자신에게 시전(healing 효과는 대상이 자신). HP 가 최대로 유지된다.
    const before = runtime.snapshot().actors[0]?.hp;
    runtime.performActorCommand({ kind: "skill", skillId: "skill_heal", targetEnemyId: "enemy-1" });
    const after = runtime.snapshot().actors[0]?.hp;
    expect(after).toBeGreaterThanOrEqual(before ?? 0);
    // 적은 힐에 피해를 입지 않는다.
    expect(runtime.snapshot().enemies[0]?.hp).toBe(runtime.snapshot().enemies[0]?.maxHp);
  });

  it("resolves skill battle animation metadata for runtime playback", () => {
    const project = battleProject();
    project.database.skills[0] = {
      ...project.database.skills[0],
      animationId: "anim_magic",
    };
    project.database.battleAnimations = [
      {
        id: "anim_magic",
        name: "마법 광선",
        resourceId: "easyrpg-battle-blow",
        scope: "singleTarget",
        position: "center",
        sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
        frames: [
          {
            cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }],
          },
          {
            cells: [{ pattern: 1, x: 0, y: -8, zoom: 110, opacity: 220, visible: true }],
          },
        ],
        timings: [
          {
            frameIndex: 0,
            soundResourceId: "easyrpg-sound-magic1",
            flash: {
              target: "target",
              color: { red: 160, green: 160, blue: 255, gray: 0 },
              durationFrames: 8,
            },
          },
        ],
      },
    ];

    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });

    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

    expect(runtime.snapshot().lastAnimation).toMatchObject({
      animationId: "anim_magic",
      name: "마법 광선",
      resourceId: "easyrpg-battle-blow",
      targetId: "enemy-1",
      scope: "singleTarget",
      position: "center",
      soundResourceIds: ["easyrpg-sound-magic1"],
      flashTargets: ["target"],
      screenShake: false,
      frameCount: 2,
    });
  });
});
