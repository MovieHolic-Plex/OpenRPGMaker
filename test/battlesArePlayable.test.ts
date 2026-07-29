// "전투가 실제로 실행되는가" 를 지키는 가드.
//
// 실측 배경(2026-07-26): 잿불의 유산이 battleProcessing 으로 부르는 troop 3종
// (troop_forest_hornets / troop_golem_guard / troop_dragon)이 **어디에도 정의되지 않았다.**
// projectLint 가 error 3건을 냈고 그 전투들은 실행되지 않는다 — 게임을 끝까지 깰 수 없는 원인.
//
// 그리고 샘플 데모는 낡은 export 잔재(elementRates 의 state_death)로 lint error 35건을 뿜어
// **진짜 오류를 덮고 있었다.** map-audit 스킬이 run_lint 로 시작하므로 이 잡음은 실제로 해롭다.
import { describe, expect, it } from "vitest";
import { projectLint } from "@/project/lint/projectLint";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import { enemyBattlers } from "@/battle/battleBattlers";
import { repairLegacyRateKeys } from "@/project/defaults/legacyRateKeyRepair";
import type { Command, Project } from "@/project/types";

/** 프로젝트 안의 모든 battleProcessing 이 참조하는 troopId 를 모은다. */
function referencedTroopIds(project: Project): string[] {
  const ids = new Set<string>();
  const scan = (commands: readonly Command[] | undefined): void => {
    for (const command of commands ?? []) {
      if (command.kind === "battleProcessing") ids.add((command as { troopId: string }).troopId);
    }
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      scan(event.commands);
      for (const page of event.pages ?? []) scan(page.commands);
    }
  }
  for (const common of project.commonEvents ?? []) scan(common.commands);
  return [...ids];
}

const PROJECTS: readonly { readonly name: string; readonly make: () => Project }[] = [
  { name: "잿불의 유산", make: createEmberQuestProject },
  { name: "샘플 어드벤처", make: createSampleAdventureProject },
];

describe("전투 참조 무결성", () => {
  for (const { name, make } of PROJECTS) {
    const project = make();

    it(`${name}: 참조된 모든 전투 그룹이 정의돼 있다`, () => {
      const defined = new Set(project.database.troops.map((troop) => troop.id));
      const missing = referencedTroopIds(project).filter((id) => !defined.has(id));
      expect(missing).toEqual([]);
    });

    it(`${name}: 모든 전투 그룹이 실제로 배틀러를 만들 수 있다`, () => {
      // enemyBattlers 는 없는 enemyId 를 만나면 throw 한다 — 전투 시작 시점의 실패를 여기서 잡는다.
      for (const troop of project.database.troops) {
        expect(() => enemyBattlers(project, troop), `${troop.id}`).not.toThrow();
      }
    });

    it(`${name}: projectLint error 가 0건이다`, () => {
      const errors = projectLint(project).filter((issue) => issue.severity === "error");
      expect(errors, JSON.stringify(errors.slice(0, 5), null, 1)).toHaveLength(0);
    });
  }
});

describe("잿불의 유산 난이도 곡선", () => {
  const project = createEmberQuestProject();
  const troop = (id: string) => {
    const found = project.database.troops.find((entry) => entry.id === id);
    if (!found) throw new Error(`troop 없음: ${id}`);
    return found;
  };
  // 왜 "단조 증가" 를 주장하지 않는가(2026-07-26 실측):
  // 처음에 위협도 = Σ(maxHp + attack) 로 단조 증가를 검사했더니 두 가지 모순이 나왔다.
  //   1. 3인 그룹의 최소 위협도는 박쥐×3 = 381 이라, 숲 말벌을 3인으로 두면 **뒤에 나오는**
  //      박쥐 떼보다 세진다. 3인 구성 자체가 불가능해진다.
  //   2. 드래곤(단독, 358)이 골렘 호위(3인, 457)보다 "약하다" 고 나온다 — 합산 지표는 머릿수를
  //      곧 강함으로 세기 때문이다.
  // 턴제 전투 난이도는 스칼라 하나로 표현되지 않는다(행동 횟수·스파이크·내구가 따로 움직인다).
  // 방어할 수 없는 주장을 가드로 박으면 오히려 구성을 망친다 — 그래서 실제로 방어 가능한 것만 남긴다.

  /** 한 방의 최대치 — 보스다움의 지표. */
  const maxSpike = (id: string): number =>
    Math.max(...enemyBattlers(project, troop(id)).map((battler) => battler.attackPower));
  /** 가장 단단한 개체의 HP — 오래 버티는 정도. */
  const maxHp = (id: string): number =>
    Math.max(...enemyBattlers(project, troop(id)).map((battler) => battler.maxHp));

  it("최종 보스가 게임에서 가장 강한 단일 개체다", () => {
    const others = ["troop_slime_pair", "troop_forest_hornets", "troop_bat_swarm", "troop_golem_guard"];
    for (const id of others) {
      expect(maxSpike("troop_dragon"), `드래곤 스파이크 > ${id}`).toBeGreaterThan(maxSpike(id));
      expect(maxHp("troop_dragon"), `드래곤 HP > ${id}`).toBeGreaterThan(maxHp(id));
    }
  });

  it("폐광 보스가 일반 인카운터보다 단단하다", () => {
    for (const id of ["troop_slime_pair", "troop_forest_hornets", "troop_bat_swarm"]) {
      expect(maxHp("troop_golem_guard"), `골렘 HP > ${id}`).toBeGreaterThan(maxHp(id));
    }
  });

  it("첫 전투보다 머릿수가 줄어드는 후속 전투는 없다 — 체감 난이도가 거꾸로 간다", () => {
    const first = enemyBattlers(project, troop("troop_slime_pair")).length;
    for (const id of ["troop_forest_hornets", "troop_bat_swarm", "troop_golem_guard"]) {
      expect(enemyBattlers(project, troop(id)).length, id).toBeGreaterThanOrEqual(first);
    }
  });

  it("최종 보스는 단독이다 — canLose=false 결전에 호위를 붙이면 과하다", () => {
    expect(enemyBattlers(project, troop("troop_dragon"))).toHaveLength(1);
  });
});

describe("낡은 비율 키 정리", () => {
  it("정의되지 않은 elementRates/stateRates 키를 제거한다", () => {
    const project = createSampleAdventureProject();
    const enemy = project.database.enemies[0]!;
    (enemy as { elementRates: Record<string, string> }).elementRates = { fire: "C", state_death: "C", 없는속성: "A" };
    const result = repairLegacyRateKeys(project);
    expect(result.records).toBeGreaterThan(0);
    expect(Object.keys(enemy.elementRates)).toEqual(["fire"]);
    expect(result.removedKeys).toContain("state_death");
  });

  it("정의된 키는 건드리지 않는다", () => {
    const project = createSampleAdventureProject();
    const enemy = project.database.enemies[0]!;
    const before = { ...enemy.elementRates };
    repairLegacyRateKeys(project);
    expect(enemy.elementRates).toEqual(before);
  });

  it("클래스와 액터도 정리 대상이다 — 적만 고쳤다가 오류가 남았다", () => {
    const project = createSampleAdventureProject();
    const cls = project.database.classes[0]!;
    (cls as { elementRates: Record<string, string> }).elementRates = { fire: "C", state_death: "C" };
    repairLegacyRateKeys(project);
    expect(Object.keys(cls.elementRates)).toEqual(["fire"]);
  });
});
