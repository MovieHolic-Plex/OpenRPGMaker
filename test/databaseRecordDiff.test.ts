import { describe, expect, it } from "vitest";
import { databaseRecordNameById, diffDatabaseRecords } from "@/project/databaseRecordDiff";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function withEnemy(project: Project, patch: Record<string, unknown>): Project {
  const next = structuredClone(project) as Mutable<Project>;
  const database = next.database as unknown as Record<string, unknown[]>;
  database.enemies = [
    {
      id: "enemy_imp", name: "임프", graphicHue: 0, transparent: false, flying: false,
      monsterResourceId: "generated-enemy-slime-01",
      stats: { maxHp: 64, maxMp: 0, attack: 12, defense: 8, mind: 4, agility: 9 },
      rewards: { exp: 5, gold: 3, dropRatePercent: 0 },
      skillIds: [], actions: [], stateRates: {}, elementRates: {},
      ...patch,
    },
  ];
  return next;
}

describe("diffDatabaseRecords — 레코드 단위 구조 diff", () => {
  it("중첩 능력치는 점 경로로 펴고 수치 델타를 계산한다", () => {
    const before = withEnemy(createBlankProject(), {});
    const after = withEnemy(createBlankProject(), {
      stats: { maxHp: 300, maxMp: 0, attack: 28, defense: 8, mind: 4, agility: 9 },
      rewards: { exp: 40, gold: 3, dropRatePercent: 5, dropItemId: "item_sword" },
    });
    const changes = diffDatabaseRecords(before, after);
    const imp = changes.find((change) => change.id === "enemy_imp");
    expect(imp).toBeDefined();
    expect(imp?.change).toBe("changed");
    expect(imp?.collection).toBe("enemies");
    expect(imp?.areaLabel).toBe("적");
    const byPath = new Map(imp!.fields.map((field) => [field.path, field]));
    expect(byPath.get("stats.maxHp")).toMatchObject({ label: "최대 HP", before: 64, after: 300, delta: 236 });
    expect(byPath.get("stats.attack")).toMatchObject({ label: "공격", delta: 16 });
    expect(byPath.get("rewards.exp")).toMatchObject({ label: "경험치", delta: 35 });
    expect(byPath.get("rewards.dropItemId")).toMatchObject({ label: "드롭 아이템", before: undefined, after: "item_sword", delta: null });
    expect(byPath.has("stats.defense")).toBe(false);
  });

  it("리소스 id 필드는 graphic 으로 표시한다", () => {
    const before = withEnemy(createBlankProject(), {});
    const after = withEnemy(createBlankProject(), { monsterResourceId: "generated-enemy-bat-01" });
    const [imp] = diffDatabaseRecords(before, after);
    expect(imp?.fields).toEqual([
      expect.objectContaining({ path: "monsterResourceId", label: "몬스터 그림", graphic: true, before: "generated-enemy-slime-01", after: "generated-enemy-bat-01" }),
    ]);
  });

  it("추가·삭제 레코드를 구분하고 삭제는 필드 없이 신원만 남긴다", () => {
    const before = withEnemy(createBlankProject(), {});
    const after = structuredClone(before) as Mutable<Project>;
    const database = after.database as unknown as Record<string, unknown[]>;
    database.enemies = [];
    database.items = [...(database.items ?? []), { id: "item_sword", name: "동검", price: 120, iconResourceId: "cc0-jetrel-wake-herb" }];
    const changes = diffDatabaseRecords(before, after);
    const removed = changes.find((change) => change.change === "removed");
    const added = changes.find((change) => change.change === "added");
    expect(removed).toMatchObject({ collection: "enemies", id: "enemy_imp", name: "임프", fields: [], after: null });
    expect(added).toMatchObject({ collection: "items", id: "item_sword", name: "동검", before: null });
    expect(added?.fields.map((field) => field.path)).toEqual(expect.arrayContaining(["price", "iconResourceId"]));
    // 이름은 카드 머리가 말하므로 필드 행에서 뺀다.
    expect(added?.fields.some((field) => field.path === "name")).toBe(false);
    expect(added?.fields.find((field) => field.path === "iconResourceId")?.graphic).toBe(true);
  });

  it("같은 프로젝트면 빈 목록이고 필드 상한을 넘으면 접힌 수를 알린다", () => {
    const project = withEnemy(createBlankProject(), {});
    expect(diffDatabaseRecords(project, project)).toEqual([]);
    const many = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`extra${index}`, index]));
    const after = withEnemy(createBlankProject(), many);
    const [imp] = diffDatabaseRecords(project, after, { maxFieldsPerRecord: 4 });
    expect(imp?.fields).toHaveLength(4);
    expect(imp?.hiddenFieldCount).toBe(2);
  });

  it("databaseRecordNameById 는 어느 컬렉션의 id 든 이름으로 바꾼다", () => {
    const project = withEnemy(createBlankProject(), {});
    expect(databaseRecordNameById(project, "enemy_imp")).toBe("임프");
    expect(databaseRecordNameById(project, "nope")).toBeNull();
  });
});
