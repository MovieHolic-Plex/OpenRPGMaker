import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createScarloxyPokemonDemoProject } from "@/project/defaults/defaultProject";
import { deserialize, serialize } from "@/project/io";
import { evolveMonster, giveMonster, monsterBattleStatsForSpecies } from "@/project/monsterCollection";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { startSession } from "@/project/session";

describe("Scarloxy 포켓몬풍 데모 프로젝트", () => {
  it("직렬화 왕복이 통과한다 (종/적/트룹/이벤트/리소스 참조 무결성)", () => {
    const project = deserialize(serialize(createScarloxyPokemonDemoProject()));
    expect(project.meta.title).toBe("Scarloxy 포켓몬풍 데모");
    expect(project.system.monsterCollection).toBe(true);
    expect(project.system.battleUiStyle).toBe("pokemon");
    expect(project.maps.map_pkmn_town).toBeDefined();
    expect(project.maps.map_pkmn_route?.troopIds).toContain("troop_pkmn_grass_a");
  });

  it("팩 몬스터 19종이 종으로 등록되고 배틀러 이미지가 해석된다", () => {
    const project = createScarloxyPokemonDemoProject();
    const species = (project.database.monsterSpecies ?? []).filter((record) => record.id.startsWith("species_scarloxy_"));
    expect(species).toHaveLength(19);
    expect(new Set(species.map((record) => record.id)).size).toBe(19);
    expect(species.map((record) => record.id)).toEqual(expect.arrayContaining([
      scarloxySpeciesId("mossling"), scarloxySpeciesId("emberkit"), scarloxySpeciesId("puddlup"),
    ]));
    for (const record of species) {
      expect(record.graphic.monsterResourceId).toMatch(/^scarloxy-monster-/);
      expect(resolveAssetResourceUrl(record.graphic.monsterResourceId)).toMatch(/^\/assets\/scarloxy\//);
    }
    const sparchu = species.find((record) => record.id === scarloxySpeciesId("sparchu"));
    expect(sparchu?.evolutions?.[0]).toMatchObject({ toSpeciesId: scarloxySpeciesId("cindrill"), requires: { level: 7 } });
  });

  it("야생 적은 종과 연결되고 라이벌 트룹은 포획 금지다", () => {
    const project = createScarloxyPokemonDemoProject();
    const larvea = project.database.enemies.find((enemy) => enemy.id === "enemy_pkmn_larvea");
    expect(larvea?.speciesId).toBe(scarloxySpeciesId("larvea"));
    expect(larvea?.level).toBe(3);
    expect(project.database.troops.find((troop) => troop.id === "troop_pkmn_rival")?.uncapturable).toBe(true);
    expect(project.database.troops.find((troop) => troop.id === "troop_pkmn_grass_a")?.uncapturable).toBe(false);
  });

  // 포켓몬 스킨은 1:1 대치가 계약이다(적 우상단/아군 좌하단, openwiki/runtime-battle.md).
  // 야생 트룹에 적을 둘 이상 넣으면 화면 문법이 깨진다 — 더블배틀 시스템이 생기기 전까지 금지.
  it("포켓몬 데모의 모든 트룹은 적이 정확히 한 마리다 (1:1 대치 계약)", () => {
    const project = createScarloxyPokemonDemoProject();
    const pokemonTroops = project.database.troops.filter((troop) => troop.id.startsWith("troop_pkmn_"));
    expect(pokemonTroops.length).toBeGreaterThan(0);
    for (const troop of pokemonTroops) {
      expect(troop.members.length).toBe(1);
      expect(troop.activeSlots ?? 1).toBe(1);
    }
    // 야생 인카운터 목록에도 다수 적 트룹이 섞이지 않는다.
    const route = project.maps.map_pkmn_route!;
    for (const troopId of route.troopIds) {
      const troop = project.database.troops.find((record) => record.id === troopId);
      expect(troop?.members.length).toBe(1);
    }
  });

  it("전기자기파가 확정 마비를 부여한다", () => {
    const project = createScarloxyPokemonDemoProject();
    const wave = project.database.skills.find((skill) => skill.id === "skill_scarloxy_wave");
    expect(wave?.effect).toMatchObject({ kind: "support" });
    expect(wave?.elementId).toBe("electric");
    expect(wave?.stateEffects).toEqual([{ stateId: "state_paralysis", chance: 100, operation: "add" }]);
    // 스파르츄가 실제로 배우는 레벨(원작 피카츄 순서: lv9).
    const sparchu = (project.database.monsterSpecies ?? []).find((s) => s.id === scarloxySpeciesId("sparchu"))!;
    expect(sparchu.skillsByLevel?.find((entry) => entry.skillId === "skill_scarloxy_wave")?.level).toBe(9);

    const session = startSession(project, 11);
    giveMonster(project, session, { speciesId: scarloxySpeciesId("sparchu"), level: 10, nickname: "절연" });
    const partyMonsters = session.monsterParty.map((id) => session.monsterInstances[id]!);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_pkmn_grass_a",
      canEscape: true,
      canLose: false,
      battleFlow: "strict",
      partyMonsters,
      sessionState: { switches: {}, variables: {}, inventory: {} },
      // 0.5 는 확률 판정을 통과하지 못한다 — 100% 부여라 상태 바이트와 무관하게 붙는다.
      rng: () => 0.5,
    });
    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_wave", targetEnemyId: "enemy-1" });
    const enemy = runtime.snapshot().enemies[0]!;
    expect(enemy.stateIds).toContain("state_paralysis");
  });

  it("스타터 지급 → 야생 포획 → 레벨 진화 루프가 동작한다", () => {
    const project = createScarloxyPokemonDemoProject();
    const session = startSession(project, 7);

    // 스타터 지급 (박사 이벤트의 giveMonster 커맨드와 동일 경로)
    const starter = giveMonster(project, session, { speciesId: scarloxySpeciesId("sparchu"), level: 5, nickname: "스파르츄" });
    expect(starter.ok).toBe(true);
    expect(session.monsterParty).toHaveLength(1);

    // 야생 라르베아 포획 (rng 0 → 항상 성공)
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_pkmn_grass_a",
      canEscape: true,
      canLose: false,
      battleFlow: "strict",
      sessionState: { switches: {}, variables: {}, inventory: { item_capture_orb: 3 } },
      captureLocation: { mapId: "map_pkmn_route", x: 10, y: 10 },
      rng: () => 0,
      onMonsterCaptured: (capture) => {
        giveMonster(project, session, {
          speciesId: capture.speciesId,
          level: capture.level,
          caughtAt: { mapId: "map_pkmn_route", x: 10, y: 10 },
          ivs: capture.ivs,
        });
      },
    });
    runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();
    expect(snapshot.capturedMonsters).toHaveLength(1);
    expect(snapshot.capturedMonsters[0]?.speciesId).toBe(scarloxySpeciesId("larvea"));
    expect(session.monsterParty).toHaveLength(2);

    // 7레벨 도달 시 스파르츄 → 신드릴 진화
    const instanceId = session.monsterParty[0];
    if (!instanceId) throw new Error("missing starter instance");
    session.monsterInstances[instanceId]!.level = 7;
    const evolved = evolveMonster(project, session, { instanceId, allowItemEvolution: false });
    expect(evolved.ok).toBe(true);
    expect(session.monsterInstances[instanceId]?.speciesId).toBe(scarloxySpeciesId("cindrill"));
  });

  it("파티 몬스터가 트레이너 대신 전투 필드에 나선다", () => {
    const project = createScarloxyPokemonDemoProject();
    expect(project.system.battleParty).toBe("monsters");
    const session = startSession(project, 7);
    giveMonster(project, session, { speciesId: scarloxySpeciesId("sparchu"), level: 5, nickname: "스파르츄" });
    const partyMonsters = session.monsterParty.map((id) => session.monsterInstances[id]!);

    const runtime = createBattleRuntime({
      project,
      troopId: "troop_pkmn_grass_a",
      canEscape: true,
      canLose: false,
      partyMonsters,
      sessionState: { switches: {}, variables: {}, inventory: {} },
      rng: () => 0,
    });
    const snap = runtime.snapshot();
    // 필드 아군 = 트레이너 액터가 아니라 파티 몬스터(스파르츄).
    expect(snap.actors).toHaveLength(1);
    const field = snap.actors[0]!;
    expect(field.speciesId).toBe(scarloxySpeciesId("sparchu"));
    expect(field.monsterInstanceId).toBe(partyMonsters[0]!.instanceId);
    expect(field.name).toBe("스파르츄");
    expect(field.id.startsWith("mon:")).toBe(true);
    expect(field.maxHp).toBeGreaterThan(0);
    // 상대는 야생 몬스터.
    expect(snap.enemies).toHaveLength(1);
  });

  it("스탯 공식이 레벨/IV에 반응하고, 전투 HP가 인스턴스로 되돌려쓰인다", () => {
    const project = createScarloxyPokemonDemoProject();
    const species = (project.database.monsterSpecies ?? []).find((s) => s.id === scarloxySpeciesId("larvea"))!;
    const lo = monsterBattleStatsForSpecies(species, 3, { hp: 0, atk: 0, def: 0, spd: 0 });
    const hi = monsterBattleStatsForSpecies(species, 30, { hp: 15, atk: 15, def: 15, spd: 15 });
    expect(hi.maxHp).toBeGreaterThan(lo.maxHp);
    expect(hi.attack).toBeGreaterThan(lo.attack);

    // 전투 몬스터가 피해를 입으면 세션 인스턴스 currentHp에 반영된다.
    const session = startSession(project, 3);
    giveMonster(project, session, { speciesId: scarloxySpeciesId("larvea"), level: 5, nickname: "라르베아" });
    const instanceId = session.monsterParty[0]!;
    const maxHp = session.monsterInstances[instanceId]!.currentHp ?? 0;
    applyBattleRewardsToSession(
      session,
      {
        result: "victory",
        rewards: { exp: 0, gold: 0, items: [], enemyLevel: 3 },
        actors: [{ id: `mon:${instanceId}`, recordId: `mon:${instanceId}`, monsterInstanceId: instanceId, name: "라르베아", hp: 4, maxHp, mp: 0, maxMp: 0, gauge: 0, defeated: false, defending: false, pose: "idle", stateIds: [], skillIds: [] }],
        participatingActorIds: [`mon:${instanceId}`],
      },
      project
    );
    expect(session.monsterInstances[instanceId]?.currentHp).toBe(4);
  });
});
