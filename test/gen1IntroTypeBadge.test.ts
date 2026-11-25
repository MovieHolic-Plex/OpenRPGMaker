// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene } from "@/player/battleDom";
import { BATTLE_INTRO_MS } from "@/player/battleSequencer";
import { sendOutDirectorState } from "@/player/battleDirectorDom";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import { store } from "@/project/store";
import { type MonsterInstance, startSession } from "@/project/session";
import type { Project } from "@/project/types";
import { battleField } from "@/player/battleFieldDom";
import { giveMonster } from "@/project/monsterCollection";
import { isolateTimers } from "./mergedTeardown";

// Gen1 UI 계약 2건.
//  (1) 파티 몬스터 전투 인트로는 "야생의 X가 나타났다!" 다음에 "가라, Y!" 를 한 비트 더 준다.
//      트레이너(종족 없는 아군)만 있는 전투에서는 그 비트가 없다.
//  (2) 기술 서브메뉴 버튼에 타입 배지가 붙는다 — elementId 가 있는 기술에만.
describe("gen1IntroTypeBadge", () => {
  isolateTimers();
  const EMBER = "skill_scarloxy_ember";
  const SCRATCH = "skill_scarloxy_scratch";
  const UNTYPED = "skill_gen1_ui_untyped";
  const MONSTER_NAME = "스파르츄";
  function starterMonster(project: Project): MonsterInstance {
    return {
      instanceId: "mon_gen1_ui_1",
      speciesId: scarloxySpeciesId("sparchu"),
      level: 5,
      exp: 0,
      skillIds: [EMBER, SCRATCH, UNTYPED],
      friendship: 70,
      caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
    };
  }
  function mount(options: { monsterParty: boolean; introHold: boolean }) {
    const project = createScarloxyPokemonDemoProject();
    project.database.skills.push(normalizeSkillRecord({ id: UNTYPED, name: "Untyped Move", maxPp: 10 }));
    store.replace(project);
    const host = document.createElement("div");
    document.body.append(host);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_pkmn_grass_a",
      canEscape: true,
      canLose: true,
      ...(options.monsterParty ? { partyMonsters: [starterMonster(project)] } : {}),
      rng: () => 0.5,
    });
    const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: options.introHold });
    return { controller, runtime, project };
  }
  function message(root: ParentNode): string {
    return (root.querySelector(".battle-message-window")?.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  describe("Gen1 인트로 — 내보내기 비트", () => {
    it("몬스터 파티는 '나타났다' 다음 비트에서 '가라, X!' 를 말한다", () => {
      vi.useFakeTimers();
      const { controller, runtime } = mount({ monsterParty: true, introHold: true });
      try {
        // 첫 비트: 야생 등장.
        expect(message(controller.root)).toContain("나타났다!");
        expect(message(controller.root)).not.toContain("가라");

        // 둘째 비트: 내보내기. 파티 선두 몬스터 이름을 부른다.
        // 메시지 창 textContent 에는 커서 글리프(>)가 함께 잡히므로 문장으로 대조한다.
        vi.advanceTimersByTime(BATTLE_INTRO_MS);
        expect(message(controller.root)).toContain(`가라, ${MONSTER_NAME}!`);
        expect(message(controller.root)).not.toContain("나타났다");

        // 셋째 비트: 커맨드 입력으로 넘어가고 시퀀스 점유가 풀린다.
        vi.advanceTimersByTime(BATTLE_INTRO_MS);
        expect(message(controller.root)).not.toContain("가라");
        expect(runtime.snapshot().phase).toBe("actorCommand");
        expect(controller.root.querySelector("[data-testid='actor-command-fight']")).toBeTruthy();
      } finally {
        controller.destroy();
        vi.useRealTimers();
      }
    });

    it("트레이너(종족 없는 아군)만 있는 전투에는 내보내기 비트가 없다", () => {
      vi.useFakeTimers();
      const { controller, runtime } = mount({ monsterParty: false, introHold: false });
      try {
        const snapshot = runtime.snapshot();
        expect(snapshot.actors.length).toBeGreaterThan(0);
        expect(snapshot.actors.some((actor) => actor.monsterInstanceId)).toBe(false);
        expect(sendOutDirectorState(snapshot)).toBeUndefined();
      } finally {
        controller.destroy();
        vi.useRealTimers();
      }
    });
  });
  describe("기술 타입 배지", () => {
    it("elementId 가 있는 기술에만 타입 배지가 붙는다", () => {
      vi.useFakeTimers();
      const { controller, runtime } = mount({ monsterParty: true, introHold: false });
      try {
        for (let i = 0; i < 200 && runtime.snapshot().phase !== "actorCommand"; i += 1) runtime.tick(1000);
        vi.advanceTimersByTime(300);
        controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-fight']")?.click();

        // 불씨 뿜기(elementId: "fire") → 완성 Gen1 타입 정의의 표시 이름.
        const ember = controller.root.querySelector<HTMLElement>(`[data-testid='actor-skill-${EMBER}']`);
        expect(ember, "불씨 뿜기 항목이 서브메뉴에 없다").toBeTruthy();
        const badge = ember!.querySelector<HTMLElement>(".battle-command-tag");
        expect(badge?.textContent).toBe("불꽃");
        expect(badge?.dataset.skillType).toBe("fire");
        // 기술명(strong) 뒤, 상세(small) 앞에 놓여야 배지로 읽힌다.
        expect(badge?.previousElementSibling?.tagName.toLowerCase()).toBe("strong");

        // 완성 Gen1 데이터에서 할퀴기는 Normal 타입이다.
        const scratch = controller.root.querySelector<HTMLElement>(`[data-testid='actor-skill-${SCRATCH}']`);
        expect(scratch, "할퀴기 항목이 서브메뉴에 없다").toBeTruthy();
        const scratchBadge = scratch!.querySelector<HTMLElement>(".battle-command-tag");
        expect(scratchBadge?.textContent).toBe("노말");
        expect(scratchBadge?.dataset.skillType).toBe("normal");

        // elementId가 없는 테스트 전용 기술에는 배지를 지어내지 않는다.
        const untyped = controller.root.querySelector<HTMLElement>(`[data-testid='actor-skill-${UNTYPED}']`);
        expect(untyped, "무속성 기술 항목이 서브메뉴에 없다").toBeTruthy();
        expect(untyped!.querySelector(".battle-command-tag")).toBeNull();
      } finally {
        controller.destroy();
        vi.useRealTimers();
      }
    });
  });
});

describe("monsterBattlerField", () => {
  isolateTimers();
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
});
