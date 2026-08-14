// test/databaseBalanceCompute.test.ts
// todo 14 — 순수 밸런스 계산 모듈(databaseBalanceCompute.ts) 검증.
// store/DOM/IO 의존 없음, 결정적: 같은 project 는 항상 같은 출력.
import { describe, expect, it } from "vitest";
import {
  PARTY_CURVE_LEVELS,
  detectBalanceIssues,
  enemyScatter,
  partyPowerCurve,
} from "@/editor/panels/databaseBalanceCompute";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import { DEFAULT_ACTOR_ID, DEFAULT_CLASS_ID, DEFAULT_EQUIPMENT_ID, DEFAULT_ITEM_ID } from "@/project/defaults/constants";
import type { Project } from "@/project/types";

function emptyParty(project: Project): Project {
  return { ...project, session: { ...project.session, partyActorIds: [] } };
}

function emptyEnemies(project: Project): Project {
  return { ...project, database: { ...project.database, enemies: [] } };
}

function missingClass(project: Project): Project {
  return {
    ...project,
    database: {
      ...project.database,
      actors: project.database.actors.map((actor) =>
        actor.id === DEFAULT_ACTOR_ID ? { ...actor, classId: "class_does_not_exist" } : actor
      ),
    },
  };
}

// 이상값 3종(과잉 회복 / 보스 HP 급증 / 공격력 정체)을 심은 픽스처.
// 깨끗한 ember 프로젝트를 베이스로, 감지기가 정확히 3건을 찾는지 본다.
function plantedAnomalies(): Project {
  const project = createEmberQuestProject();
  const db = project.database;
  // (a) 과잉 회복: 포션 고정 회복 999 > 임계 400.
  db.items = db.items.map((item) =>
    item.id === DEFAULT_ITEM_ID ? { ...item, hpRecovery: { flat: 999, percentMax: 0 } } : item
  );
  // (b) 보스 HP 급증: 드래곤(exp 160) HP 400, 같은 exp 대역(±30%) 일반 적 2종 HP 50.
  const slime = db.enemies.find((enemy) => enemy.id === "enemy_slime")!;
  const bandEnemy = (id: string, exp: number, maxHp: number) => ({
    ...slime,
    id,
    name: id,
    rewards: { ...slime.rewards, exp },
    stats: { ...slime.stats, maxHp },
  });
  db.enemies = [
    ...db.enemies.filter((enemy) => enemy.id !== "enemy_slime"),
    bandEnemy("enemy_band_a", 150, 50),
    bandEnemy("enemy_band_b", 155, 50),
  ].map((enemy) =>
    enemy.id === "enemy_dragon" ? { ...enemy, stats: { ...enemy.stats, maxHp: 400 } } : enemy
  );
  // (c) 공격력 정체: 영웅 클래스 공격 곡선이 Lv6 이후 45 고정(5레벨 이상 미증가).
  db.classes = db.classes.map((klass) =>
    klass.id === DEFAULT_CLASS_ID
      ? {
          ...klass,
          parameterCurves: {
            ...klass.parameterCurves,
            attack: Array.from({ length: 99 }, (_, index) => (index < 5 ? 20 + index : 45)),
          },
        }
      : klass
  );
  return project;
}

describe("partyPowerCurve", () => {
  it("항상 50개(1..50) 항목을 돌려주고 레벨 순서가 맞다", () => {
    const curve = partyPowerCurve(createEmberQuestProject());
    expect(curve).toHaveLength(PARTY_CURVE_LEVELS);
    expect(curve.map((point) => point.level)).toEqual(Array.from({ length: PARTY_CURVE_LEVELS }, (_, index) => index + 1));
    // 깨끗한 픽스처: HP 는 레벨에 따라 단조 증가(또는 명시적 평탄).
    const hp = curve.map((point) => point.hp);
    expect(hp.every((value, index) => index === 0 || value >= hp[index - 1])).toBe(true);
  });

  it("파티가 비면 50개 전부 0 항목을 돌려준다", () => {
    const curve = partyPowerCurve(emptyParty(createEmberQuestProject()));
    expect(curve).toHaveLength(PARTY_CURVE_LEVELS);
    for (const point of curve) {
      expect(point.hp).toBe(0);
      expect(point.attack).toBe(0);
      expect(point.defense).toBe(0);
      expect(point.mind).toBe(0);
      expect(point.agility).toBe(0);
    }
  });

  it("곡선 인덱스는 level-1 이고 초기 장비 statBonuses 가 합산된다", () => {
    const project = createEmberQuestProject();
    const db = project.database;
    // 장비 보너스를 검증 대상(무기) 하나로 좁히고, 곡선을 손으로 만든 값으로 교체한다.
    db.actors = db.actors.map((actor) =>
      actor.id === DEFAULT_ACTOR_ID ? { ...actor, initialEquipment: { weapon: DEFAULT_EQUIPMENT_ID } } : actor
    );
    db.classes = db.classes.map((klass) =>
      klass.id === DEFAULT_CLASS_ID
        ? {
            ...klass,
            parameterCurves: {
              ...klass.parameterCurves,
              maxHp: Array.from({ length: 99 }, (_, index) => 5000 + index),
              attack: Array.from({ length: 99 }, (_, index) => 1000 + index),
            },
          }
        : klass
    );
    const sword = db.equipment.find((entry) => entry.id === DEFAULT_EQUIPMENT_ID)!;
    const curve = partyPowerCurve(project);
    // level 5 → 곡선 인덱스 4. 장비 보너스는 매 레벨 더해진다.
    expect(curve[4].hp).toBe(5004);
    expect(curve[4].attack).toBe(1004 + sword.statBonuses.attack);
    expect(curve[0].attack).toBe(1000 + sword.statBonuses.attack);
  });

  it("클래스가 없는 배우는 0 곡선으로 처리되어 예외를 던지지 않는다", () => {
    const curve = partyPowerCurve(missingClass(createEmberQuestProject()));
    expect(curve).toHaveLength(PARTY_CURVE_LEVELS);
    for (const point of curve) expect(Number.isFinite(point.attack)).toBe(true);
  });
});

describe("enemyScatter", () => {
  it("모든 enemies 항목을 커버하고 필드가 채워진다", () => {
    const project = createEmberQuestProject();
    const scatter = enemyScatter(project);
    expect(scatter.map((point) => point.id).sort()).toEqual(project.database.enemies.map((enemy) => enemy.id).sort());
    for (const point of scatter) {
      expect(point.name.length).toBeGreaterThan(0);
      expect(point.hp).toBeGreaterThan(0);
      expect(point.dps).toBeGreaterThanOrEqual(0);
      expect(point.exp).toBeGreaterThanOrEqual(0);
      expect(point.gold).toBeGreaterThanOrEqual(0);
      expect(typeof point.isBoss).toBe("boolean");
    }
  });

  it("상위 10% exp(또는 uncapturable 트룹) 적만 isBoss 로 표시된다", () => {
    const project = createEmberQuestProject();
    const scatter = enemyScatter(project);
    const dragon = scatter.find((point) => point.id === "enemy_dragon")!;
    expect(dragon.isBoss).toBe(true);
    expect(scatter.filter((point) => point.isBoss)).toHaveLength(1);

    // uncapturable 은 트룹 단위 플래그다 — 슬라임을 uncapturable 트룹에 넣으면 보스급 취급.
    const troop = project.database.troops[0]!;
    project.database.troops = [
      ...project.database.troops,
      { ...troop, id: "troop_uncapturable_slime", name: "포획 불가", uncapturable: true, enemyIds: ["enemy_slime"], members: [{ enemyId: "enemy_slime", x: 84, y: 52 }] },
    ];
    const after = enemyScatter(project);
    expect(after.find((point) => point.id === "enemy_slime")!.isBoss).toBe(true);
  });

  it("enemies 가 비면 scatter 는 빈 배열이고 곡선은 여전히 50개다", () => {
    const project = emptyEnemies(createEmberQuestProject());
    expect(enemyScatter(project)).toEqual([]);
    expect(partyPowerCurve(project)).toHaveLength(PARTY_CURVE_LEVELS);
  });

  it("파티가 비어도 예외를 던지지 않는다", () => {
    const project = emptyParty(createEmberQuestProject());
    const scatter = enemyScatter(project);
    expect(scatter).toHaveLength(project.database.enemies.length);
  });
});

describe("detectBalanceIssues", () => {
  it("깨끗한 프로젝트에서는 문제가 없다", () => {
    expect(detectBalanceIssues(createEmberQuestProject())).toEqual([]);
  });

  it("심은 이상값 3종을 정확히 감지한다 (a→b→c 순서)", () => {
    const issues = detectBalanceIssues(plantedAnomalies());
    expect(issues.map((issue) => issue.kind)).toEqual(["overheal", "boss-hp-spike", "skill-stagnation"]);
    for (const issue of issues) {
      expect(issue.title.length).toBeGreaterThan(0);
      expect(issue.detail.length).toBeGreaterThan(0);
    }
  });

  it("enemies 가 비어도 휴리스틱이 예외를 던지지 않는다", () => {
    expect(() => detectBalanceIssues(emptyEnemies(createEmberQuestProject()))).not.toThrow();
  });

  it("클래스가 없는 배우도 예외를 던지지 않는다", () => {
    expect(() => detectBalanceIssues(missingClass(createEmberQuestProject()))).not.toThrow();
  });

  it("결정적이다 — 같은 project 는 항상 같은 출력", () => {
    const project = createEmberQuestProject();
    expect(partyPowerCurve(project)).toEqual(partyPowerCurve(project));
    expect(enemyScatter(project)).toEqual(enemyScatter(project));
    expect(detectBalanceIssues(project)).toEqual(detectBalanceIssues(project));
  });
});
