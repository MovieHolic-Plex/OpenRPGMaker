import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createScarloxyPokemonDemoProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { evolveMonster, giveMonster } from "@/project/monsterCollection";
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

  it("팩 몬스터 16종이 종으로 등록되고 배틀러 이미지가 해석된다", () => {
    const project = createScarloxyPokemonDemoProject();
    const species = (project.database.monsterSpecies ?? []).filter((record) => record.id.startsWith("species_scarloxy_"));
    expect(species).toHaveLength(16);
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
});
