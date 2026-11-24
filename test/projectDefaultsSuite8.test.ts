// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeSystemRecords, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { ENEMY_MOTION_RECORD_IDS, ENEMY_STILL_MOTION_DEFAULT, framedArt, normalizeEnemyStillMotion, resolveEnemyStillMotion, stageOwnsFilters, stillMotionLevel } from "@/project/enemyStillMotion";
import { enemyDeath, enemyHit, enemyIdle } from "@/player/battleEnemyStillMotion";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene } from "@/player/battleDom";
import { BATTLE_INTRO_MS } from "@/player/battleSequencer";
import { sendOutDirectorState } from "@/player/battleDirectorDom";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { store } from "@/project/store";
import type { MonsterInstance } from "@/project/session";
import type { Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("enemyStillMotion", () => {
  isolateTimers();
  function node(markup: string, extra: (element: HTMLElement) => void = () => {}): HTMLElement {
    const host = document.createElement("div");
    host.innerHTML = markup;
    const root = host.firstElementChild as HTMLElement;
    extra(root);
    return root;
  }
  function imageOf(root: HTMLElement): HTMLElement | null {
    return root.querySelector<HTMLElement>(".battle-enemy-image");
  }
  const STILL = `<button class="battle-enemy" data-record-id="enemy_fs_wolf"><img class="battle-enemy-image"></button>`;
  describe("적 그림 움직임 설정", () => {
    it("기본은 all 이고, 바꾸는 프로젝트만 값을 남긴다", () => {
      expect(ENEMY_STILL_MOTION_DEFAULT).toBe("all");
      expect(normalizeEnemyStillMotion("stillOnly")).toBe("stillOnly");
      expect(normalizeEnemyStillMotion("off")).toBe("off");
      expect(normalizeEnemyStillMotion(true)).toBeUndefined();
      const base = { startActorIds: ["actor_hero"] };
      expect(normalizeSystemRecords(base).enemyStillMotion).toBeUndefined();
      expect(normalizeSystemRecords({ ...base, enemyStillMotion: "all" }).enemyStillMotion).toBeUndefined();
      expect(normalizeSystemRecords({ ...base, enemyStillMotion: "stillOnly" }).enemyStillMotion).toBe("stillOnly");
      expect(normalizeSystemRecords({ ...base, enemyStillMotion: "off" }).enemyStillMotion).toBe("off");
      expect(resolveEnemyStillMotion({ system: {} })).toBe("all");
      expect(resolveEnemyStillMotion({ system: { enemyStillMotion: "off" } })).toBe("off");
    });

    it("조수 도구가 모드를 바꾸고 기본값으로 되돌린다", () => {
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "set_project_settings", { battle: { enemyStillMotion: "stillOnly" } }).ok).toBe(true);
      expect(ctx.project.system.enemyStillMotion).toBe("stillOnly");
      expect(runTool(ctx, "set_project_settings", { battle: { enemyStillMotion: "off" } }).ok).toBe(true);
      expect(ctx.project.system.enemyStillMotion).toBe("off");
      expect(runTool(ctx, "set_project_settings", { battle: { enemyStillMotion: "all" } }).ok).toBe(true);
      expect("enemyStillMotion" in ctx.project.system).toBe(false);
      expect(runTool(ctx, "set_project_settings", { battle: { enemyStillMotion: true } }).ok).toBe(false);
    });
  });
  describe("엔진 연출 단계", () => {
    it("칸이 없는 정지 그림은 full, 칸 있는 그림은 all 에서 translate", () => {
      const still = node(STILL);
      expect(framedArt(still, imageOf(still))).toBe(false);
      expect(stillMotionLevel(still, imageOf(still), "all")).toBe("full");

      for (const attr of ["data-pixel-enemy", "data-pixel-party", "data-charset-enemy"]) {
        const framed = node(STILL, (element) => { element.setAttribute(attr, "dash"); });
        expect(framedArt(framed, imageOf(framed)), attr).toBe(true);
        expect(stillMotionLevel(framed, imageOf(framed), "all"), attr).toBe("translate");
      }

      const extended = node(STILL, (element) => { element.dataset.battlerExtended = "true"; });
      expect(stillMotionLevel(extended, imageOf(extended), "all")).toBe("translate");

      const strip = node(STILL, (element) => {
        element.querySelector<HTMLElement>(".battle-enemy-image")!.dataset.battlerAnim = "generated-enemy-slime-01";
      });
      expect(stillMotionLevel(strip, imageOf(strip), "all")).toBe("translate");
    });

    it("stillOnly 는 칸 있는 그림을 그대로 두고, off 는 아무 데도 걸지 않는다", () => {
      const still = node(STILL);
      expect(stillMotionLevel(still, imageOf(still), "stillOnly")).toBe("full");
      const sheet = node(STILL, (element) => { element.dataset.pixelEnemy = "dash"; });
      expect(stillMotionLevel(sheet, imageOf(sheet), "stillOnly")).toBe("off");
      expect(stillMotionLevel(sheet, imageOf(sheet), "all")).toBe("translate");
      expect(stillMotionLevel(still, imageOf(still), "off")).toBe("off");
      expect(stillMotionLevel(still, null, "all")).toBe("off");
    });

    it("허용 목록(오너 선택 A: 숲늑대·엄니멧돼지) 밖의 적은 어떤 모드에서도 움직이지 않는다", () => {
      expect([...ENEMY_MOTION_RECORD_IDS].sort()).toEqual(["enemy_fs_boar", "enemy_fs_wolf"]);
      const boar = node(STILL, (element) => { element.dataset.recordId = "enemy_fs_boar"; element.dataset.pixelEnemy = "dash"; });
      expect(stillMotionLevel(boar, imageOf(boar), "all")).toBe("translate");
      for (const recordId of ["enemy_fs_spider", ""]) {
        const other = node(STILL, (element) => { element.dataset.recordId = recordId; element.dataset.pixelEnemy = "dash"; });
        for (const mode of ["all", "stillOnly", "off"] as const) expect(stillMotionLevel(other, imageOf(other), mode), `${recordId}/${mode}`).toBe("off");
      }
      const unlisted = node(`<button class="battle-enemy"><img class="battle-enemy-image"></button>`);
      expect(stillMotionLevel(unlisted, imageOf(unlisted), "all")).toBe("off");
    });

    it("보스 무대·보스 입장은 filter·scale 을 스스로 쓴다", () => {
      const scene = (step: string, bigBoss: boolean) => {
        const host = document.createElement("div");
        host.innerHTML = `<div class="battle-scene" data-battle-director-step="${step}" ${bigBoss ? 'data-battle-big-boss="true"' : ""}><button class="battle-enemy"><img class="battle-enemy-image"></button></div>`;
        return host.querySelector<HTMLElement>(".battle-enemy")!;
      };
      expect(stageOwnsFilters(scene("intro", false))).toBe(true);
      expect(stageOwnsFilters(scene("action", false))).toBe(false);
      expect(stageOwnsFilters(scene("action", true))).toBe(true);
      const sink = node(`<button class="battle-enemy" data-collapse="bossSink"><img class="battle-enemy-image"></button>`);
      expect(stageOwnsFilters(sink)).toBe(true);
    });

    it("WAAPI 가 없는 환경에서는 조용히 건너뛴다", () => {
      const still = node(STILL);
      Object.defineProperty(imageOf(still)!, "animate", { value: undefined });
      const opts = { level: "full" as const, staged: false };
      expect(() => { enemyHit(still, opts); enemyDeath(still, opts); enemyIdle(still, opts); }).not.toThrow();
      expect(imageOf(still)!.hasAttribute("data-enemy-anim")).toBe(false);
    });
  });
});

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
