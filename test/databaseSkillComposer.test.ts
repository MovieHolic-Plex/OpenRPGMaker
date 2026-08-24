import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDatabaseActiveTab,
  renderDatabasePanel,
  setDatabaseActiveTab,
} from "@/editor/panels/database";
import {
  resetRecordViewSessionState,
  selectedRecordIdForSession,
  setSelectedRecordId,
} from "@/editor/panels/databaseRecordViewSession";
import { deriveSkillComposerModel } from "@/editor/panels/databaseSkillComposerModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

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
