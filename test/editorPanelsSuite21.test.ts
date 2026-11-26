import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { recordConnections } from "@/editor/databaseRecordConnections";
import { createBlankProject } from "@/project/defaults";
import { databaseRecordNameById, diffDatabaseRecords } from "@/project/databaseRecordDiff";
import type { Project, DatabaseRecords } from "@/project/types";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { FakeElement, installFakeDom, findByTestId } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";
import { getDatabaseActiveTab, renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { resetRecordViewSessionState, selectedRecordIdForSession, setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { getSelectedMonsterSpeciesId, setSelectedMonsterSpeciesId } from "@/editor/panels/databaseMonsterSpeciesView";
import { deriveSkillComposerModel } from "@/editor/panels/databaseSkillComposerModel";
import { store } from "@/project/store";
import { renderTerrainTab } from "@/editor/panels/databaseUtilityRecordViews";
import { getMapEditHistoryEntries, resetMapEditHistory, getMapEditHistoryState, undoMapEdit } from "@/editor/mapEditHistory";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { normalizeTypeChart } from "@/project/databaseRecordModel";
import { renderSwitchesTab, renderTermsTab, renderVariablesTab } from "@/editor/panels/databaseUtilityViews";

describe("databaseRecord", () => {
  isolateTimers();
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
});

describe("databaseSkillComposer", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  let previousImage: typeof Image | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    previousImage = globalThis.Image;
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: class {
        addEventListener(): void {
          // Thumbnail chroma-key loading is outside this DOM contract.
        }
      },
    });
    resetRecordViewSessionState();
    setSelectedMonsterSpeciesId(undefined);

    const project = createBlankProject();
    const skill = project.database.skills[0];
    const actor = project.database.actors[0];
    const klass = project.database.classes[0];
    const item = project.database.items[0];
    const equipment = project.database.equipment[0];
    if (!skill || !actor || !klass || !item || !equipment) throw new Error("missing database composer fixture");

    for (const entry of project.database.actors) entry.learnedSkills = [];
    for (const entry of project.database.classes) {
      entry.learnedSkills = [];
      entry.skillIds = [];
      entry.battleCommands = [];
    }
    for (const entry of project.database.items) {
      entry.skillId = undefined;
      entry.learnedSkillId = undefined;
      entry.activateSkillId = undefined;
    }
    for (const entry of project.database.equipment) {
      entry.skillId = undefined;
      entry.usableAsItemSkillId = undefined;
    }
    for (const entry of project.database.enemies) {
      entry.skillIds = [];
      entry.actions = [];
    }
    for (const entry of project.database.monsterSpecies ?? []) entry.skillsByLevel = [];

    skill.scope = "allEnemies";
    skill.type = "normal";
    skill.power = 42;
    skill.mpCost = { flat: 8, percentMax: 12 };
    skill.effect = { kind: "damage", statistic: "mind", affects: "hp" };
    skill.successRate = 90;
    skill.hitRate = 80;
    if (!project.database.elements?.[0] || !project.database.states[0] || !project.database.battleAnimations[0]) {
      throw new Error("missing skill summary fixture records");
    }
    project.database.elements[0].name = "불";
    project.database.states[0].name = "독";
    project.database.battleAnimations[0].name = "화염 폭발";
    skill.elementId = project.database.elements[0].id;
    skill.stateEffects = [
      { stateId: project.database.states[0]!.id, chance: 35, operation: "add" },
    ];
    skill.animationId = project.database.battleAnimations[0]?.id;

    actor.learnedSkills = [{ level: 3, skillId: skill.id }];
    klass.learnedSkills = [{ level: 5, skillId: skill.id }];
    klass.skillIds = [skill.id];
    item.skillId = undefined;
    item.activateSkillId = skill.id;
    equipment.skillId = undefined;
    equipment.usableAsItemSkillId = skill.id;
    const enemy = project.database.enemies[1];
    const species = project.database.monsterSpecies?.[1];
    if (!enemy || !species) throw new Error("missing non-first skill backlink fixtures");
    enemy.name = "두 번째 몬스터";
    enemy.skillIds = [skill.id];
    enemy.actions = [{
      skillId: skill.id,
      priority: 7,
      condition: { kind: "turn", start: 2, interval: 3 },
      switchOnAfterAction: { enabled: false },
      switchOffAfterAction: { enabled: false },
    }];
    species.name = "두 번째 종족";
    species.skillsByLevel = [{ level: 9, skillId: skill.id }];

    store.replace(project);
    setSelectedRecordId("skills", skill.id);
    setDatabaseActiveTab("skills");
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
    if (previousImage === undefined) Reflect.deleteProperty(globalThis, "Image");
    else Object.defineProperty(globalThis, "Image", { configurable: true, value: previousImage });
    previousImage = undefined;
  });
  describe("database skill ability composer", () => {
    it("derives readable chips and ordered effect summaries from existing fields", () => {
      // Break named: exposing raw enum/id values makes the composer another database ledger.
      const project = store.getCurrent();
      const skill = project.database.skills[0]!;
      const model = deriveSkillComposerModel(project, skill);

      expect(model.chips.map((chip) => chip.label)).toEqual([
        "일반 스킬",
        "적 전체",
        "MP 8 + 최대 MP 12%",
      ]);
      expect(model.effectBlocks.map((block) => [block.kind, block.summary])).toEqual([
        ["primary", "HP 피해 · 마력 기반 · 위력 42 · 성공 90% · 명중 80%"],
        ["element", "불"],
        ["states", "독 부여 35%"],
        ["animation", "화염 폭발"],
      ]);
    });

    it("finds every supported backlink field once and explains the relationship", () => {
      // Break named: checking only legacy skillId fields hides real learned/activated/command references.
      const project = store.getCurrent();
      const skill = project.database.skills[0]!;
      const klass = project.database.classes[0]!;
      const item = project.database.items[0]!;
      const equipment = project.database.equipment[0]!;
      const enemy = project.database.enemies[1]!;
      const species = project.database.monsterSpecies?.[1]!;

      klass.battleCommands = [
        { id: "command-skill", name: "전용기", kind: "skill", skillId: skill.id },
      ];
      item.skillId = skill.id;
      item.learnedSkillId = skill.id;
      item.activateSkillId = skill.id;
      equipment.skillId = skill.id;
      equipment.usableAsItemSkillId = skill.id;

      const model = deriveSkillComposerModel(project, skill);
      expect(model.backlinks.map(({ collection, id, relationship }) => ({ collection, id, relationship }))).toEqual([
        { collection: "actors", id: project.database.actors[0]!.id, relationship: "Lv 3 습득" },
        { collection: "classes", id: klass.id, relationship: "Lv 5 습득 · 전투 명령" },
        { collection: "items", id: item.id, relationship: "스킬 습득 · 스킬 발동" },
        { collection: "equipment", id: equipment.id, relationship: "장비 스킬 · 사용 스킬" },
        { collection: "enemies", id: enemy.id, relationship: "스킬 목록 · 행동 1" },
        { collection: "monsterSpecies", id: species.id, relationship: "Lv 9 습득" },
      ]);
    });

    it("states zero cost and empty optional effects without adding new runtime behavior", () => {
      // Break named: synthetic defaults can falsely imply an element, state, animation, or MP cost.
      const project = store.getCurrent();
      const skill = {
        ...project.database.skills[0]!,
        mpCost: { flat: 0, percentMax: 0 },
        elementId: undefined,
        stateEffects: [],
        animationId: undefined,
      };
      const model = deriveSkillComposerModel(project, skill);

      expect(model.chips.find((chip) => chip.kind === "cost")?.label).toBe("MP 소모 없음");
      expect(model.effectBlocks.slice(1).map((block) => block.summary)).toEqual([
        "무속성",
        "상태 변화 없음",
        "애니메이션 없음",
      ]);
    });

    it("shows activation, target, and cost chips with ordered authored effect blocks", () => {
      // Break named: removing the ability-composer projection leaves the skill detail as a raw field ledger.
      const panel = renderPanel();
      const composer = byTestId(panel, "db-skill-composer");

      expect(byTestId(composer, "db-skill-chip-activation").dataset.chipKind).toBe("activation");
      expect(byTestId(composer, "db-skill-chip-target").dataset.chipKind).toBe("target");
      expect(byTestId(composer, "db-skill-chip-cost").dataset.chipKind).toBe("cost");

      const blocks = composer.querySelectorAll(".db-skill-effect-block");
      expect(blocks.map((block) => block.dataset.effectKind)).toEqual([
        "primary",
        "element",
        "states",
        "animation",
      ]);
    });

    it("lists actor, class, item, and equipment backlinks that navigate inside the current modal", () => {
      // Break named: a backlink that reopens Database loses the current modal/session instead of selecting in place.
      const panel = renderPanel();
      const bodyBefore = panel.querySelector(".db-body");
      const project = store.getCurrent();
      const actor = project.database.actors[0]!;
      const klass = project.database.classes[0]!;
      const item = project.database.items[0]!;
      const equipment = project.database.equipment[0]!;

      expect(findByTestId(panel, `db-skill-backlink-actors-${actor.id}`)).not.toBeNull();
      expect(findByTestId(panel, `db-skill-backlink-classes-${klass.id}`)).not.toBeNull();
      expect(findByTestId(panel, `db-skill-backlink-items-${item.id}`)).not.toBeNull();
      expect(findByTestId(panel, `db-skill-backlink-equipment-${equipment.id}`)).not.toBeNull();

      byTestId(panel, `db-skill-backlink-actors-${actor.id}`).click();

      expect(getDatabaseActiveTab()).toBe("actors");
      expect(selectedRecordIdForSession("actors")).toBe(actor.id);
      expect(panel.querySelector(".db-body")).toBe(bodyBefore);
      expect(findByTestId(panel, `db-record-row-${actor.id}`)?.classList.contains("active")).toBe(true);
    });

    it("selects the exact non-first enemy through its rendered backlink", () => {
      // Break named: omitting enemy skillIds/actions either hides the backlink or falls back to the first enemy on navigation.
      const panel = renderPanel();
      const bodyBefore = panel.querySelector(".db-body");
      const enemy = store.getCurrent().database.enemies[1]!;
      const backlink = byTestId(panel, `db-skill-backlink-enemies-${enemy.id}`);

      expect(backlink.querySelector(".db-skill-backlink-kind")?.textContent).toBe("몬스터");
      backlink.click();

      expect(getDatabaseActiveTab()).toBe("enemies");
      expect(selectedRecordIdForSession("enemies")).toBe(enemy.id);
      expect(panel.querySelector(".db-body")).toBe(bodyBefore);
      expect(findByTestId(panel, `db-record-row-${enemy.id}`)?.classList.contains("active")).toBe(true);
    });

    it("selects the exact non-first monster species through its rendered backlink", () => {
      // Break named: treating monsterSpecies as a DatabaseCollection cannot set its dedicated selection before switching tabs.
      const panel = renderPanel();
      const bodyBefore = panel.querySelector(".db-body");
      const species = store.getCurrent().database.monsterSpecies?.[1];
      if (!species) throw new Error("missing non-first monster species fixture");
      const backlink = byTestId(panel, `db-skill-backlink-monsterSpecies-${species.id}`);

      expect(backlink.querySelector(".db-skill-backlink-kind")?.textContent).toBe("종족");
      backlink.click();

      expect(getDatabaseActiveTab()).toBe("monsterSpecies");
      expect(getSelectedMonsterSpeciesId()).toBe(species.id);
      expect(panel.querySelector(".db-body")).toBe(bodyBefore);
      expect(findByTestId(panel, `db-monster-species-row-${species.id}`)?.classList.contains("active")).toBe(true);
    });
  });
  function renderPanel(): FakeElement {
    const panel = document.createElement("div") as unknown as FakeElement;
    panel.className = "database-modal-body";
    renderDatabasePanel(panel as unknown as HTMLElement);
    return panel;
  }
  function byTestId(root: FakeElement, testid: string): FakeElement {
    const element = findByTestId(root, testid);
    if (!element) throw new Error(`missing test id ${testid}`);
    return element;
  }
});

describe("databaseTerrainTab", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  describe("terrain tab copy and pickers", () => {
    it("drops RM2003 path copy and keeps backdrop/footstep field testids with pickers", () => {
      const host = document.createElement("div") as unknown as FakeElement;
      renderTerrainTab(host as unknown as HTMLElement);
      const form = findByTestId(host, "db-detail-form");
      if (!form) throw new Error("missing terrain form");

      expect(form.textContent).not.toContain("RM2003");
      expect(form.textContent).not.toContain("database.terrains");
      expect(findByTestId(form, "db-field-terrain-backdrop-0")).not.toBeNull();
      expect(findByTestId(form, "db-field-terrain-footstep-0")).not.toBeNull();
      expect(findByTestId(form, "db-field-terrain-backdrop-0-set")).not.toBeNull();
      expect(findByTestId(form, "db-field-terrain-footstep-0-set")).not.toBeNull();
      expect(form.querySelector(".db-resource-picker-inline-name")).not.toBeNull();
      expect(findByTestId(form, "db-field-terrain-backdrop-0")?.className).toContain("db-authoring-id");
    });
  });
});

describe("databaseTypeChipMatrix", () => {
  isolateTimers();
  function renderSystem(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderSystemTab(host as unknown as HTMLElement, rerender);
    };
    rerender();
    return host;
  }
  function chip(host: FakeElement, attacker: string, defender: string): FakeElement {
    const node = findByTestId(host, `db-type-chart-${attacker}-${defender}`);
    if (!node) throw new Error(`missing chip ${attacker}->${defender}`);
    return node;
  }
  function multiplier(attacker: string, defender: string): number | undefined {
    return store.getCurrent().system.typeChart?.multipliers?.[attacker]?.[defender];
  }
  describe("database type chart chip matrix", () => {
    let cleanupDom: (() => void) | undefined;

    beforeEach(() => {
      cleanupDom = installFakeDom();
      store.replace(createBlankProject());
      store.update((draft) => {
        draft.system.typeChart = normalizeTypeChart({ types: ["fire", "water", "grass"], multipliers: {} });
      });
      resetMapEditHistory();
    });

    afterEach(() => {
      cleanupDom?.();
      cleanupDom = undefined;
      vi.unstubAllGlobals();
    });

    it("chip click cycles 0→0.25→0.5→1→1.5→2→3→4→0 with normalized writes and no rerender storm", () => {
      store.update((draft) => {
        draft.system.typeChart = normalizeTypeChart({
          types: ["fire", "water", "grass"],
          multipliers: { fire: { water: 0 } },
        });
      });
      const host = renderSystem();
      const fireWater = chip(host, "fire", "water");
      expect(fireWater.tagName).toBe("BUTTON");
      expect(fireWater.dataset.attacker).toBe("fire");
      expect(fireWater.dataset.defender).toBe("water");
      expect(fireWater.dataset.value).toBe("0");
      expect(fireWater.dataset.state).toBe("down");

      const historyBefore = getMapEditHistoryEntries().length;
      const expected = [0.25, 0.5, 1, 1.5, 2, 3, 4, 0];
      for (const value of expected) {
        fireWater.click();
        // store 에 정규화된 승수가 기록된다.
        expect(multiplier("fire", "water")).toBe(value);
        // 칩 dataset 도 같은 값으로 로컬 갱신된다.
        expect(fireWater.dataset.value).toBe(String(value));
        expect(fireWater.dataset.state).toBe(value > 1 ? "up" : value < 1 ? "down" : "neutral");
      }

      // 같은 DOM 노드 — 클릭이 전체 재렌더(호스트 재구축)를 유발하지 않는다.
      expect(chip(host, "fire", "water")).toBe(fireWater);
      // 클릭 1회 = 스냅샷 1개(updateTypeChartCell 경로), 8회 클릭 = 8개.
      expect(getMapEditHistoryEntries().length).toBe(historyBefore + expected.length);
      // 4→0 wrap 후 라벨도 갱신된다.
      expect(fireWater.textContent).toBe("0");
    });

    it("preview shows 'fire → grass 2.0x' after interacting with the fire→grass cell", () => {
      const host = renderSystem();
      const preview = findByTestId(host, "db-type-preview");
      if (!preview) throw new Error("missing preview");

      const fireGrass = chip(host, "fire", "grass");
      fireGrass.click(); // 1 → 1.5
      fireGrass.click(); // 1.5 → 2
      expect(multiplier("fire", "grass")).toBe(2);
      expect(preview.textContent).toContain("공격→방어");
      expect(preview.textContent).toContain("fire → grass 2.0x");

      // hover(마우스 진입)도 미리보기를 갱신한다.
      const fireWater = chip(host, "fire", "water");
      fireWater.dispatchEvent(new Event("mouseenter"));
      expect(preview.textContent).toContain("fire → water 1.0x");
    });

    it("contextmenu popover clamps 7→4 and -1→0, keeps 1.25, and Escape closes without writing", () => {
      const host = renderSystem();
      const fireWater = chip(host, "fire", "water");
      const popover = findByTestId(host, "db-type-chart-popover");
      const input = findByTestId(host, "db-type-chart-popover-input");
      const confirm = findByTestId(host, "db-type-chart-popover-confirm");
      if (!popover || !input || !confirm) throw new Error("missing popover nodes");

      fireWater.dispatchEvent(new Event("contextmenu"));
      expect(popover.hidden).toBe(false);
      input.value = "7";
      confirm.click();
      expect(multiplier("fire", "water")).toBe(4);
      expect(fireWater.dataset.value).toBe("4");
      expect(popover.hidden).toBe(true);

      fireWater.dispatchEvent(new Event("contextmenu"));
      input.value = "-1";
      confirm.click();
      expect(multiplier("fire", "water")).toBe(0);
      expect(fireWater.dataset.value).toBe("0");
      expect(popover.hidden).toBe(true);

      fireWater.dispatchEvent(new Event("contextmenu"));
      input.value = "1.25";
      confirm.click();
      expect(multiplier("fire", "water")).toBe(1.25);
      expect(fireWater.dataset.value).toBe("1.25");
      expect(popover.hidden).toBe(true);

      // Escape 는 쓰지 않고 닫는다.
      fireWater.dispatchEvent(new Event("contextmenu"));
      input.value = "2";
      const escapeEvent = new Event("keydown");
      Object.defineProperty(escapeEvent, "key", { configurable: true, value: "Escape" });
      // fakeDom does not bubble keyboard events. The browser regression exercises
      // the native input-to-editor path; this unit invokes the editor's handler.
      popover.dispatchEvent(escapeEvent);
      expect(popover.hidden).toBe(true);
      expect(multiplier("fire", "water")).toBe(1.25);
      expect(document.activeElement).toBe(fireWater);
    });

    it("blank type list still deletes system.typeChart after confirm", () => {
      const confirm = vi.fn(() => true);
      vi.stubGlobal("confirm", confirm);
      const host = renderSystem();
      expect(findByTestId(host, "db-type-chart-matrix")).not.toBeNull();
      expect(findByTestId(host, "db-type-chart-direct-edit")).not.toBeNull();

      const types = findByTestId(host, "db-field-system-type-chart-types");
      if (!types) throw new Error("missing types input");
      types.value = "";
      types.dispatchEvent(new Event("change"));

      expect(confirm).toHaveBeenCalled();
      expect(store.getCurrent().system.typeChart).toBeUndefined();
      expect(findByTestId(host, "db-type-chart-matrix")).toBeNull();
      vi.unstubAllGlobals();
    });

    it("canceling the empty-list confirm keeps the type chart", () => {
      const confirm = vi.fn(() => false);
      vi.stubGlobal("confirm", confirm);
      const host = renderSystem();
      const types = findByTestId(host, "db-field-system-type-chart-types");
      if (!types) throw new Error("missing types input");
      types.value = "";
      types.dispatchEvent(new Event("change"));

      expect(store.getCurrent().system.typeChart?.types).toEqual(["fire", "water", "grass"]);
      expect(findByTestId(host, "db-type-chart-matrix")).not.toBeNull();
      expect(types.value).toBe("fire, water, grass");
      vi.unstubAllGlobals();
    });

    it("diagonal cells are disabled and dimmed, and clicks on them do not write", () => {
      const host = renderSystem();
      const diagonal = chip(host, "fire", "fire");
      expect(diagonal.disabled).toBe(true);
      expect(diagonal.dataset.state).toBe("diag");

      diagonal.click();
      expect(multiplier("fire", "fire")).toBe(1);
      // diagonal 칩에는 contextmenu 리스너가 없다 — 팝오버가 열리지 않는다.
      diagonal.dispatchEvent(new Event("contextmenu"));
      const popover = findByTestId(host, "db-type-chart-popover");
      if (!popover) throw new Error("missing popover");
      expect(popover.hidden).toBe(true);
    });
  });
});

describe("databaseUtilityViews", () => {
  isolateTimers();
  function namedSwitches(): { id: string; name: string }[] {
    return store.getCurrent().switches.filter((record) => record.name.trim().length > 0);
  }
  function namedVariables(): { id: string; name: string }[] {
    return store.getCurrent().variables.filter((record) => record.name.trim().length > 0);
  }
  function renderUtility(render: (host: HTMLElement, rerender: () => void) => void): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      render(host as unknown as HTMLElement, rerender);
    };
    rerender();
    return host;
  }
  let previousWindow: typeof globalThis.window | undefined;
  function stubWindowTimers(): void {
    previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        setTimeout: (handler: TimerHandler): number => {
          if (typeof handler === "function") handler();
          return 0;
        },
        clearTimeout,
      },
    });
  }
  function restoreWindow(): void {
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
  describe("database utility views", () => {
    let cleanupDom: (() => void) | undefined;

    beforeEach(() => {
      cleanupDom = installFakeDom();
      stubWindowTimers();
      store.replace(createBlankProject());
      resetMapEditHistory();
    });

    afterEach(() => {
      cleanupDom?.();
      cleanupDom = undefined;
      restoreWindow();
    });

    it("switch add button creates the next numbered switch and focuses name input", () => {
      const host = renderUtility(renderSwitchesTab);
      // #777: 기본 카탈로그의 기동석 아이템이 스위치를 선언하므로 빈 프로젝트도 목록이 비지 않는다.
      // 이 테스트가 보는 것은 "개수 슬롯 추가/포커스" 흐름이다.
      expect(store.getCurrent().switches.some((entry) => entry.name.trim().length > 0)).toBe(true);
      expect(host.querySelectorAll(".db-empty-row")).toHaveLength(0);

      findByTestId(host, "db-add-switch")?.click();
      const input = findByTestId(host, "db-utility-selected-name");
      if (!input) throw new Error("missing selected switch input");
      input.value = "문 열림";
      input.dispatchEvent(new Event("input"));

      expect(namedSwitches()).toContainEqual({ id: "sw_0001", name: "문 열림" });
      expect(document.activeElement).toBe(input);
    });

    it("variable add button creates the next numbered variable and supports rename", () => {
      const host = renderUtility(renderVariablesTab);

      findByTestId(host, "db-add-variable")?.click();
      const input = findByTestId(host, "db-utility-selected-name");
      if (!input) throw new Error("missing selected variable input");
      input.value = "퍼즐 점수";
      input.dispatchEvent(new Event("input"));

      expect(namedVariables()).toEqual([{ id: "var_0001", name: "퍼즐 점수" }]);
      expect(document.activeElement).toBe(input);
    });

    // fix(db): 스위치/변수 삭제에 2단계 확인이 없었다(qa-system-report.md Minor) — 다른 DB
    // 탭과 동일하게 첫 클릭은 무장만 하고, 확인 창 안의 두 번째 클릭이 실제 삭제를 확정한다.
    it("row delete button requires a second click to confirm before removing the switch", () => {
      const host = renderUtility(renderSwitchesTab);
      findByTestId(host, "db-add-switch")?.click();

      const deleteButton = findByTestId(host, "db-delete-sw_0001");
      if (!deleteButton) throw new Error("missing delete button");

      deleteButton.click();
      expect(deleteButton.textContent).toBe("정말 삭제?");
      expect(namedSwitches()).toContainEqual({ id: "sw_0001", name: "새 스위치" });

      deleteButton.click();
      expect(namedSwitches().some((entry) => entry.id === "sw_0001")).toBe(false);
    });

    // fix(db): deleteSwitch/deleteVariable이 session.switches[id]/variables[id] 값을 정리하지
    // 않아, 삭제된 슬롯을 "+ 추가"로 재사용하면 이전 값(true)을 그대로 물려받는 위험이 있었다
    // (qa-system-report.md). ensureSwitchVariableSlots가 매 store.update마다 결측 세션 값을
    // 기본값으로 채워 넣으므로, 삭제 후 세션 값을 지우면 다음 update에서 기본값(false)으로
    // 리셋된다는 것을 검증한다.
    it("clears the stale runtime session value when a switch is deleted", () => {
      const host = renderUtility(renderSwitchesTab);
      findByTestId(host, "db-add-switch")?.click();
      store.update((project) => {
        project.session.switches.sw_0001 = true;
      });
      expect(store.getCurrent().session.switches.sw_0001).toBe(true);

      const deleteButton = findByTestId(host, "db-delete-sw_0001");
      deleteButton?.click();
      deleteButton?.click();

      expect(store.getCurrent().session.switches.sw_0001).toBe(false);
    });

    it("shows story flags in a read-only section instead of decorating switch rows", () => {
      store.update((project) => {
        const first = project.switches.find((record) => record.id === "sw_0001");
        if (!first) throw new Error("missing sw_0001");
        first.name = "시장 만남";
        project.storyFlags = [{
          id: "met-mayor",
          kind: "switch",
          targetId: "sw_0001",
          description: "촌장을 만남",
        }];
      });

      const host = renderUtility(renderSwitchesTab);
      const row = host.querySelector(".db-utility-row");
      const storyFlags = host.querySelector(".db-story-flag-list");

      expect(row?.textContent).toContain("시장 만남");
      expect(row?.textContent).not.toContain("met-mayor");
      expect(storyFlags?.textContent).toContain("스토리 플래그 (읽기 전용)");
      expect(storyFlags?.textContent).toContain("met-mayor");
    });

    // fix(db): 스위치/변수 이름 입력란이 키 입력마다 recordProjectSnapshot(비-코얼레스)을
    // 부르는 renameSwitch/renameVariable을 직접 호출해, 5글자 타이핑을 되돌리려면 Ctrl+Z를
    // 5번 눌러야 했다(qa-system-report.md). terms 필드와 동일한 recordCoalescedSnapshot으로
    // 맞춰 키 입력 스트림 전체가 undo 1스텝으로 병합돼야 한다.
    it("coalesces keystroke-by-keystroke switch renames into a single undo snapshot", () => {
      const host = renderUtility(renderSwitchesTab);
      findByTestId(host, "db-add-switch")?.click();
      resetMapEditHistory(); // isolate the rename snapshot count from the add snapshot

      const input = findByTestId(host, "db-utility-selected-name");
      if (!input) throw new Error("missing selected switch input");
      for (const next of ["H", "HE", "HEL", "HELL", "HELLO"]) {
        input.value = next;
        input.dispatchEvent(new Event("input"));
      }
      expect(namedSwitches()).toContainEqual({ id: "sw_0001", name: "HELLO" });

      const undone = undoMapEdit();
      expect(undone).toBe(true);
      // one snapshot for the whole keystroke stream — reverts straight back to the
      // pre-typing name ("새 스위치"), not one letter at a time.
      expect(namedSwitches()).toContainEqual({ id: "sw_0001", name: "새 스위치" });
      expect(getMapEditHistoryState().canUndo).toBe(false);
    });

    // fix(db): 용어 탭의 직행 store.update가 undo 스냅샷을 안 남겼다 — 다른 유틸리티 뷰
    // 필드는 Ctrl+Z가 되는데 용어만 안 되는 비일관 상태였다.
    it("records an undo snapshot when a term field changes, and undo restores the previous value", () => {
      expect(getMapEditHistoryState().canUndo).toBe(false);
      const host = renderUtility(renderTermsTab);
      const before = store.getCurrent().meta.terms.skill;

      const skillTerm = findByTestId(host, "db-field-skill-term");
      if (!skillTerm) throw new Error("missing skill term field");
      skillTerm.value = "Arts";
      skillTerm.dispatchEvent(new Event("input"));

      expect(store.getCurrent().meta.terms.skill).toBe("Arts");
      expect(getMapEditHistoryState().canUndo).toBe(true);

      const undone = undoMapEdit();

      expect(undone).toBe(true);
      expect(store.getCurrent().meta.terms.skill).toBe(before);
    });
  });
});
