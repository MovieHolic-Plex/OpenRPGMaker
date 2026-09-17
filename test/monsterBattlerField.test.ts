/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { battleField } from "@/player/battleFieldDom";
import { createBattleRuntime } from "@/battle/runtime";
import { createScarloxyPokemonDemoProject } from "@/project/defaults/defaultProject";
import { giveMonster } from "@/project/monsterCollection";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { startSession } from "@/project/session";
import { store } from "@/project/store";

describe("파티 몬스터 전투 필드 렌더", () => {
  it("아군 필드에 파티 몬스터가 back 스프라이트로 그려진다", () => {
    const project = createScarloxyPokemonDemoProject();
    store.replace(project); // battleField가 store.getCurrent()로 종족 그래픽을 조회한다.
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
    const field = battleField(runtime.snapshot());

    // 아군 노드가 몬스터 배틀러로 표시되고, 종족 그래픽이 back 클래스로 렌더된다.
    const actorNode = field.querySelector<HTMLElement>('.battle-actor-group .battle-actor[data-monster-battler="true"]');
    expect(actorNode).toBeTruthy();
    const monsterImg = field.querySelector<HTMLImageElement>(".battle-actor-group .battle-monster-back");
    expect(monsterImg).toBeTruthy();
    expect(monsterImg?.getAttribute("src")).toContain("scarloxy-monster-sparchu");

    // 상대는 야생 몬스터가 그대로(정면).
    const enemyImg = field.querySelector<HTMLImageElement>(".battle-enemy-group .battle-enemy-image");
    expect(enemyImg?.getAttribute("src")).toContain("scarloxy-monster-larvea");
  });

  it("종족 그래픽이 없어도 배우용 스킨 스프라이트로 위장하지 않는다", () => {
    const project = createScarloxyPokemonDemoProject();
    const species = project.database.monsterSpecies?.find((record) => record.id === scarloxySpeciesId("sparchu"));
    if (!species) throw new Error("missing sparchu");
    species.graphic.monsterResourceId = "";
    store.replace(project);
    const session = startSession(project, 7);
    giveMonster(project, session, { speciesId: species.id, level: 5 });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_pkmn_grass_a",
      canEscape: true,
      canLose: false,
      partyMonsters: session.monsterParty.map((id) => session.monsterInstances[id]!),
      rng: () => 0,
    });

    const actorNode = battleField(runtime.snapshot()).querySelector<HTMLElement>(".battle-actor-group .battle-actor");
    expect(actorNode?.dataset.monsterBattler).toBe("true");
    expect(actorNode?.querySelector(".battle-skin-actor-image")).toBeNull();
    expect(actorNode?.querySelector(".battle-monster-back")).toBeNull();
  });
});
