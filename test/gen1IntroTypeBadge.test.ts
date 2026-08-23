/** @vitest-environment happy-dom */
// Gen1 UI 계약 2건.
//  (1) 파티 몬스터 전투 인트로는 "야생의 X가 나타났다!" 다음에 "가라, Y!" 를 한 비트 더 준다.
//      트레이너(종족 없는 아군)만 있는 전투에서는 그 비트가 없다.
//  (2) 기술 서브메뉴 버튼에 타입 배지가 붙는다 — elementId 가 있는 기술에만.
import { describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene } from "@/player/battleDom";
import { BATTLE_INTRO_MS } from "@/player/battleSequencer";
import { sendOutDirectorState } from "@/player/battleDirectorDom";
import { createScarloxyPokemonDemoProject } from "@/project/defaults";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { store } from "@/project/store";
import type { MonsterInstance } from "@/project/session";
import type { Project } from "@/project/types";

const EMBER = "skill_scarloxy_ember";
const SCRATCH = "skill_scarloxy_scratch";
const MONSTER_NAME = "스파르츄";

function starterMonster(project: Project): MonsterInstance {
  return {
    instanceId: "mon_gen1_ui_1",
    speciesId: scarloxySpeciesId("sparchu"),
    level: 5,
    exp: 0,
    skillIds: [EMBER, SCRATCH],
    friendship: 70,
    caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
  };
}

function mount(options: { monsterParty: boolean; introHold: boolean }) {
  const project = createScarloxyPokemonDemoProject();
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
      expect(controller.root.querySelector("[data-testid='actor-command-attack']")).toBeTruthy();
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
      controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-skill']")?.click();

      // 불씨 뿜기(elementId: "fire") → 데모가 저작한 한글 타입명.
      const ember = controller.root.querySelector<HTMLElement>(`[data-testid='actor-skill-${EMBER}']`);
      expect(ember, "불씨 뿜기 항목이 서브메뉴에 없다").toBeTruthy();
      const badge = ember!.querySelector<HTMLElement>(".battle-command-tag");
      expect(badge?.textContent).toBe("불꽃");
      expect(badge?.dataset.skillType).toBe("fire");
      // 기술명(strong) 뒤, 상세(small) 앞에 놓여야 배지로 읽힌다.
      expect(badge?.previousElementSibling?.tagName.toLowerCase()).toBe("strong");

      // 할퀴기(무속성) → 배지를 지어내지 않는다.
      const scratch = controller.root.querySelector<HTMLElement>(`[data-testid='actor-skill-${SCRATCH}']`);
      expect(scratch, "할퀴기 항목이 서브메뉴에 없다").toBeTruthy();
      expect(scratch!.querySelector(".battle-command-tag")).toBeNull();
    } finally {
      controller.destroy();
      vi.useRealTimers();
    }
  });
});
