import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { giveMonster } from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import { setEquippedTool } from "@/project/toolActions";
import { interactWithFarmPlot } from "@/player/farming";
import { useItemFromMenu } from "@/player/playerItemUse";
import type { ItemRecord, Project } from "@/project/types";

function catalogItem(project: Project, id: string): ItemRecord {
  const item = project.database.items.find((record) => record.id === id);
  if (!item) throw new Error(`기본 아이템이 없습니다: ${id}`);
  return item;
}

function battleFor(project: Project, itemId: string, inventory = 1, itemUseCharges?: Record<string, number>) {
  const actorIds = project.database.actors.slice(0, 2).map((actor) => actor.id);
  const troopId = project.database.troops[0]?.id;
  if (actorIds.length < 2 || !troopId) throw new Error("기본 전투 데이터가 부족합니다.");
  const runtime = createBattleRuntime({
    project,
    troopId,
    canEscape: false,
    canLose: true,
    rng: () => 0,
    sessionState: { switches: {}, variables: {}, inventory: { [itemId]: inventory }, itemUseCharges },
    party: {
      levels: Object.fromEntries(actorIds.map((id) => [id, 1])),
      experience: Object.fromEntries(actorIds.map((id) => [id, 0])),
      vitals: Object.fromEntries(actorIds.map((id) => [id, { hp: 1, mp: 0 }])),
      stateIds: Object.fromEntries(actorIds.map((id) => [id, []])),
      partyActorIds: actorIds,
    },
  });
  runtime.tick(1_000);
  return { runtime, actorIds };
}

describe("확장 기본 아이템 실행 경로", () => {
  it("아이템 고유 상태 효과 경로로 전투 강화 상태를 부여한다", () => {
    const project = createBlankProject();
    const { runtime, actorIds } = battleFor(project, "item_gen2_war_draught");

    runtime.performActorCommand({ kind: "item", itemId: "item_gen2_war_draught", targetEnemyId: "", targetActorId: actorIds[1]! });

    expect(runtime.snapshot().actors.find((actor) => actor.recordId === actorIds[1])?.stateIds).toContain("state_attack_up");
    expect(runtime.snapshot().eventState.inventory.item_gen2_war_draught ?? 0).toBe(0);
  });

  it("아군 전체 회복을 모든 대상에 적용하고 한 개만 소모한다", () => {
    const project = createBlankProject();
    const { runtime, actorIds } = battleFor(project, "item_gen2_party_potion");

    runtime.performActorCommand({ kind: "item", itemId: "item_gen2_party_potion", targetEnemyId: "", targetActorId: actorIds[0]! });

    expect(runtime.snapshot().actors.map((actor) => actor.hp).every((hp) => hp > 1)).toBe(true);
    expect(runtime.snapshot().eventState.inventory.item_gen2_party_potion ?? 0).toBe(0);
  });

  it("사료와 장난감의 돌봄 수치를 파티 몬스터에게 적용한다", () => {
    const project = createBlankProject();
    project.system.monsterCollection = true;
    const session = startSession(project, 41);
    const speciesId = project.database.monsterSpecies?.[0]?.id;
    if (!speciesId) throw new Error("기본 몬스터 종이 없습니다.");
    const given = giveMonster(project, session, { speciesId, level: 1, friendship: 20 });
    if (!given.ok) throw new Error("몬스터를 파티에 넣지 못했습니다.");
    session.inventory.item_gen2_monster_feast = 1;
    session.inventory.item_gen2_training_frisbee = 1;

    expect(useItemFromMenu(project, session, "item_gen2_monster_feast", undefined, given.instance.instanceId).kind).toBe("used");
    expect(useItemFromMenu(project, session, "item_gen2_training_frisbee", undefined, given.instance.instanceId).kind).toBe("used");
    expect(session.monsterInstances[given.instance.instanceId]?.friendship).toBe(47);
    expect(session.monsterInstances[given.instance.instanceId]?.exp).toBe(55);
  });

  it("성장 씨앗은 선택한 배우의 영구 능력 보너스를 올린다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0]!;
    session.inventory.item_gen2_might_seed = 1;

    expect(useItemFromMenu(project, session, "item_gen2_might_seed", actorId).kind).toBe("used");
    expect(session.actorParamBonuses?.[actorId]?.attack).toBe(2);
    expect(session.inventory.item_gen2_might_seed ?? 0).toBe(0);
  });

  it("작물 씨앗은 연결된 기본 작물로 실제 밭에 심어진다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const sourceMap = project.maps[project.startMapId];
    if (!sourceMap) throw new Error("기본 맵이 없습니다.");
    const map = { ...sourceMap, farmableArea: [{ x: 2, y: 2, w: 1, h: 1 }] };
    session.inventory.item_hoe = 1;
    session.inventory.item_gen2_turnip_seed = 1;
    setEquippedTool(session, "item_hoe");
    expect(interactWithFarmPlot(project, session, map, 2, 2, "till").kind).toBe("tilled");
    setEquippedTool(session, "item_gen2_turnip_seed");

    expect(interactWithFarmPlot(project, session, map, 2, 2, "plant")).toMatchObject({
      kind: "planted",
      cropId: "crop_gen2_turnip",
      itemId: "item_gen2_turnip_seed",
    });
    expect(session.inventory.item_gen2_turnip_seed ?? 0).toBe(0);
  });

  it("스위치 아이템은 연결 스위치를 켜고 재사용을 거부한다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    session.inventory.item_gen2_sun_relay = 2;

    expect(useItemFromMenu(project, session, "item_gen2_sun_relay").kind).toBe("used");
    expect(session.switches.sw_0001).toBe(true);
    expect(session.inventory.item_gen2_sun_relay).toBe(1);
    expect(useItemFromMenu(project, session, "item_gen2_sun_relay").kind).toBe("unusable");
    expect(session.inventory.item_gen2_sun_relay).toBe(1);
  });

  it("유한 사용 횟수를 메뉴와 전투 모두 같은 충전 권위자로 계산한다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0]!;
    session.inventory.item_gen2_twin_dose_kit = 1;
    session.actorVitals[actorId] = { hp: 1, mp: 0, maxHp: 500, maxMp: 100 };

    expect(useItemFromMenu(project, session, "item_gen2_twin_dose_kit", actorId).kind).toBe("used");
    expect(session.inventory.item_gen2_twin_dose_kit).toBe(1);
    expect(session.itemUseCharges?.item_gen2_twin_dose_kit).toBe(1);
    session.actorVitals[actorId]!.hp = 1;
    expect(useItemFromMenu(project, session, "item_gen2_twin_dose_kit", actorId).kind).toBe("used");
    expect(session.inventory.item_gen2_twin_dose_kit ?? 0).toBe(0);
    expect(session.itemUseCharges?.item_gen2_twin_dose_kit).toBeUndefined();

    const { runtime, actorIds } = battleFor(project, "item_gen2_five_spark_core");
    const enemyId = runtime.snapshot().enemies[0]?.id;
    if (!enemyId) throw new Error("기본 적이 없습니다.");
    runtime.performActorCommand({ kind: "item", itemId: "item_gen2_five_spark_core", targetEnemyId: enemyId });
    expect(runtime.snapshot().eventState.inventory.item_gen2_five_spark_core).toBe(1);
    expect(runtime.snapshot().eventState.itemUseCharges?.item_gen2_five_spark_core).toBe(1);
    expect(actorIds.length).toBe(2);
  });

  it("네 속성 아이템 스킬과 두 상태 공격 아이템이 실제 적에게 효과를 남긴다", () => {
    const project = createBlankProject();
    for (const itemId of [
      "item_gen2_frost_vial",
      "item_gen2_quake_stone",
      "item_gen2_gale_fan",
      "item_gen2_shadow_dust",
      "item_gen2_venom_ampoule",
      "item_gen2_paralysis_coil",
    ]) {
      const { runtime } = battleFor(project, itemId);
      const before = runtime.snapshot().enemies[0];
      if (!before) throw new Error("기본 적이 없습니다.");
      runtime.performActorCommand({ kind: "item", itemId, targetEnemyId: before.id });
      const after = runtime.snapshot().enemies[0]!;
      expect(after.hp < before.hp || after.stateIds.length > before.stateIds.length, itemId).toBe(true);
      expect(runtime.snapshot().lastAnimation?.animationId, itemId).toBe(catalogItem(project, itemId).animationId);
    }
  });
});
