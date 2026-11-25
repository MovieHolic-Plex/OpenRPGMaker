import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { recordConnections } from "@/editor/databaseRecordConnections";
import { createBlankProject } from "@/project/defaults";
import { databaseRecordNameById, diffDatabaseRecords } from "@/project/databaseRecordDiff";
import type { Project, DatabaseRecords } from "@/project/types";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { FakeElement, installFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("databaseRecordConnections", () => {
  isolateTimers();
  describe("자료집 연결 칸 — 쓰는 곳·확인할 것", () => {
    it("직업을 쓰는 주인공을 전부 목록으로 낸다(삭제 메시지처럼 첫 건만이 아니다)", () => {
      const project = createBlankProject();
      const classId = project.database.classes[0]!.id;
      const users = project.database.actors.filter((actor) => actor.classId === classId);
      const { uses } = recordConnections(project, "classes", classId);
      const actorUses = uses.filter((use) => use.kind === "주인공");
      expect(actorUses.map((use) => use.target?.id)).toEqual(users.map((actor) => actor.id));
      for (const use of actorUses) expect(use.target?.collection).toBe("actors");
    });

    it("시작 파티 주인공은 시스템이 쓰는 곳으로 잡힌다", () => {
      const project = createBlankProject();
      const actorId = project.system.startActorIds[0]!;
      const { uses, checks } = recordConnections(project, "actors", actorId);
      expect(uses).toContainEqual({ kind: "시스템", name: "시작 파티" });
      expect(checks).not.toContain("아직 아무 데서도 쓰지 않아요");
    });

    it("아무도 안 쓰는 몬스터는 확인할 것에 오른다", () => {
      const project = createBlankProject();
      const enemy = project.database.enemies[0]!;
      project.database.troops = project.database.troops.filter((troop) =>
        !troop.enemyIds.includes(enemy.id) && !troop.members?.some((member) => member.enemyId === enemy.id));
      const { uses, checks } = recordConnections(project, "enemies", enemy.id);
      expect(uses).toEqual([]);
      expect(checks).toContain("아직 아무 데서도 쓰지 않아요");
    });

    it("목록이 못 잡는 참조도 삭제 차단 검사가 찾으면 한 줄로 보인다", () => {
      const project = createBlankProject();
      const item = project.database.items[0]!;
      project.system.sellPrices = [{ itemId: item.id, price: 1 } as never];
      const { uses, checks } = recordConnections(project, "items", item.id);
      expect(uses.some((use) => use.kind === "다른 곳" && use.name.includes("판매 가격"))).toBe(true);
      expect(checks).not.toContain("아직 아무 데서도 쓰지 않아요");
    });

    it("연결 칸 밖의 컬렉션은 빈 결과다", () => {
      const project = createBlankProject();
      expect(recordConnections(project, "battleAnimations", "anything")).toEqual({ uses: [], checks: [] });
    });
  });
});

describe("databaseRecordDiff", () => {
  isolateTimers();
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
});

describe("databaseRecordThumbnails", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  describe("database record list thumbnails", () => {
    it("returns collection-specific thumbnail slots for visual database records", () => {
      const project = createBlankProject();

      const actor = thumb("actors", project.database.actors[0], project);
      expect(actor.className).toContain("db-list-thumb");
      expect(actor.className).toContain("db-list-thumb-crop");
      expect(actor.style.backgroundImage).toContain("/assets/easyrpg/faceset/");

      const enemy = thumb("enemies", project.database.enemies[0], project);
      expect(enemy.className).toContain("db-list-thumb-image");
      expect(enemy.querySelector("img")?.attrs.src).toContain("/assets/");

      const item = thumb("items", project.database.items[0], project);
      expect(item.querySelector("img")?.attrs.src).toContain("/assets/cc0/");

      const equipment = thumb("equipment", project.database.equipment[0], project);
      expect(equipment.querySelector("img")?.attrs.src).toContain("/assets/cc0/");

      const skill = thumb("skills", project.database.skills[0], project);
      expect(skill.className).toContain("db-list-thumb-animation");
      expect(skill.style.backgroundImage).toContain("/assets/generated/effects/");

      const animation = thumb("battleAnimations", project.database.battleAnimations[0], project);
      expect(animation.className).toContain("db-list-thumb-animation");
      // EasyRPG 전투 애니메이션 시트는 2026-10-07 저작권 정리로 지웠다 — 기본 애니메이션은 생성 효과 시트를 쓴다.
      expect(animation.style.backgroundImage).toContain("/assets/generated/effects/");
    });

    it("returns visual thumbnails for classes, troops, and states", () => {
      const project = createBlankProject();

      const klass = thumb("classes", project.database.classes[0], project);
      expect(klass.className).toContain("db-list-thumb");

      const troop = thumb("troops", project.database.troops[0], project);
      expect(troop.className).toContain("db-list-thumb");

      const state = thumb("states", project.database.states[0], project);
      expect(state.className).toContain("db-list-thumb-state");
      expect(state.style.backgroundColor).toMatch(/^#|rgb/i);
    });

    it("returns empty slots for missing supported resources", () => {
      const project = createBlankProject();
      const actor = { ...project.database.actors[0], faceResourceId: undefined };
      const empty = recordListThumbnail("actors", actor, project);
      expect(empty?.className).toContain("db-list-thumb");
      expect(empty?.className).toContain("empty");
    });

    // 얼굴 한 칸 = 파일 한 장 — 시트 오프셋이 아니라 그림 한 장이 슬롯을 채운다.
    it("renders the actor face image whole, with no sheet offset", () => {
      const project = createBlankProject();
      const actor = { ...project.database.actors[0] };
      const node = thumb("actors", actor, project);
      expect(node.style.backgroundPosition).toBe("center");
      expect(node.style.backgroundSize).toBe("32px 32px");
    });

    it("parameterized size scales the thumbnail while the default stays at 32px", () => {
      const project = createBlankProject();
      const actor = { ...project.database.actors[0] };

      // 기본(size 미지정)은 기존 32px 크롭과 동일하다 — 기존 호출부 계약 유지.
      const defaultNode = thumb("actors", actor, project);
      const explicit32 = recordListThumbnail("actors", actor, project, 32);
      if (!(explicit32 instanceof FakeElement)) throw new Error("expected fake element");
      expect(explicit32.style.backgroundSize).toBe(defaultNode.style.backgroundSize);

      // 48px 은 배율 1.5 로 표시 크기가 커진다 (backgroundSize 첫 숫자 = 표시 크기).
      const large = recordListThumbnail("actors", actor, project, 48);
      if (!(large instanceof FakeElement)) throw new Error("expected fake element");
      expect(large.style.backgroundSize).not.toBe(defaultNode.style.backgroundSize);
      expect(firstPx(large.style.backgroundSize) / firstPx(defaultNode.style.backgroundSize)).toBeCloseTo(1.5);

      // 손상된 size(0/음수)는 32px 기본으로 폴백한다.
      const broken = recordListThumbnail("actors", actor, project, 0);
      if (!(broken instanceof FakeElement)) throw new Error("expected fake element");
      expect(broken.style.backgroundSize).toBe(defaultNode.style.backgroundSize);

      // 애니메이션 크롭도 size 를 따른다 (같은 1.5 배율).
      const animationDefault = recordListThumbnail("battleAnimations", project.database.battleAnimations[0], project);
      const animation = recordListThumbnail("battleAnimations", project.database.battleAnimations[0], project, 48);
      if (!(animation instanceof FakeElement) || !(animationDefault instanceof FakeElement)) throw new Error("expected fake element");
      expect(animation.style.backgroundSize).not.toBe(animationDefault.style.backgroundSize);
      expect(firstPx(animation.style.backgroundSize) / firstPx(animationDefault.style.backgroundSize)).toBeCloseTo(1.5);
    });
  });
  function thumb<C extends DatabaseCollection>(
    collection: C,
    record: DatabaseRecords[C][number] | undefined,
    project: ReturnType<typeof createBlankProject>
  ): FakeElement {
    if (!record) throw new Error(`Missing ${collection} record`);
    const node = recordListThumbnail(collection, record, project);
    if (node instanceof FakeElement) return node;
    throw new Error(`Expected ${collection} thumbnail`);
  }
  function firstPx(backgroundSize: string): number {
    return Number.parseFloat(backgroundSize) || 0;
  }
});
