// 파티 그룹 정보량 줄이기(2026-09-23) — 레일 4칸·하위 보기 경로·머리 한 문장·같은 값 열 숨김.
import { afterEach, describe, expect, it } from "vitest";
import {
  TAB_GROUPS,
  PARTY_SUBVIEW_PARENT,
  databaseTabPath,
  getDatabaseActiveTab,
  renderDatabasePanel,
  setDatabaseActiveTab,
} from "@/editor/panels/database";
import { visibleActorColumns } from "@/editor/panels/databaseActorStudio";
import { actorSummarySentence } from "@/editor/panels/actorRecordView";
import { classSummarySentence } from "@/editor/panels/databaseClassRecordView";
import { skillSentenceFragments } from "@/editor/panels/databaseSkillRecordView";
import { itemSummarySentence } from "@/editor/panels/databaseItemRecordView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;
afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  Reflect.deleteProperty(globalThis, "window");
});

function mountPanel(tab: Parameters<typeof setDatabaseActiveTab>[0]): FakeElement {
  restoreDom = installFakeDom();
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); } } },
  });
  store.replace(createBlankProject());
  setDatabaseActiveTab(tab);
  const host = document.createElement("div") as unknown as FakeElement;
  host.className = "database-modal-body";
  renderDatabasePanel(host as unknown as HTMLElement);
  return host;
}

describe("party rail", () => {
  // Break caught: 승급 트리·스킬 트리·공유 외형을 레일에 다시 올리면 초보가 「직업」과 「직업 승급 트리」를
  // 다른 데이터로 읽는 7칸 레일로 되돌아간다.
  it("keeps four primary destinations and routes the three views under their owner", () => {
    const party = TAB_GROUPS.find((group) => group.slug === "party");
    expect(party?.tabs).toEqual(["actors", "classes", "skills", "items"]);
    expect(PARTY_SUBVIEW_PARENT).toEqual({ characterAppearances: "actors", promotionTree: "classes", skillTrees: "skills" });
    expect(databaseTabPath("promotionTree")).toEqual(["classes", "promotionTree"]);
    expect(databaseTabPath("skillTrees")).toEqual(["skills", "skillTrees"]);
    expect(databaseTabPath("characterAppearances")).toEqual(["actors", "characterAppearances"]);
  });
});

describe("party subview strip", () => {
  // Break caught: 레일에서 뺀 세 목적지에 닿을 길이 탭 검색뿐이 되면 사실상 사라진 기능이 된다.
  it("switches between an owner and its view without a rail row, keeping the owner active in the rail", () => {
    const host = mountPanel("classes");
    const strip = findByTestId(host, "db-party-subviews");
    expect(strip?.textContent).toBe("직업 편집승급 트리");
    findByTestId(host, "db-subview-promotion-tree")?.click();
    expect(getDatabaseActiveTab()).toBe("promotionTree");
    expect(findByTestId(host, "db-tab-classes")?.classList.contains("active")).toBe(true);
    expect(findByTestId(host, "db-subview-promotion-tree")?.classList.contains("active")).toBe(true);
    findByTestId(host, "db-subview-classes")?.click();
    expect(getDatabaseActiveTab()).toBe("classes");
  });

  it("does not draw the strip on tabs without views", () => {
    const host = mountPanel("items");
    expect(findByTestId(host, "db-party-subviews")).toBeNull();
  });
});

describe("actor list columns", () => {
  it("hides level, HP and map columns when every actor shares the value", () => {
    const project = createBlankProject();
    const actors = project.database.actors.map((actor) => ({ ...actor, initialLevel: 1, characterTransparent: false, parameterCurves: { ...actor.parameterCurves, maxHp: project.database.actors[0]!.parameterCurves.maxHp } }));
    expect([...visibleActorColumns(actors)]).toEqual([]);
  });

  it("brings a column back as soon as one actor differs", () => {
    const project = createBlankProject();
    const base = project.database.actors[0]!;
    const actors = [base, { ...base, id: "other", initialLevel: base.initialLevel + 4, characterTransparent: !base.characterTransparent }];
    const columns = visibleActorColumns(actors);
    expect(columns.has("level")).toBe(true);
    expect(columns.has("map")).toBe(true);
  });
});

describe("record summary sentences", () => {
  it("says the actor's class, start level and party membership", () => {
    const project = createBlankProject();
    const actor = project.database.actors[0]!;
    const klass = project.database.classes.find((entry) => entry.id === actor.classId);
    project.system.startActorIds = [actor.id];
    expect(actorSummarySentence(project, actor)).toBe(`${klass?.name} 직업으로 Lv ${actor.initialLevel}에 시작하고, 처음부터 파티에 있습니다.`);
    project.system.startActorIds = [];
    expect(actorSummarySentence(project, actor)).toContain("이벤트로 합류할 때까지 대기합니다");
  });

  it("reads class counts as one sentence", () => {
    expect(classSummarySentence({ role: "striker", skillCount: 3, commandCount: 6, equipmentCount: 12, promotionCount: 0 }))
      .toBe("공격형 직업. 스킬 3개를 배우고, 전투 명령 6개 · 착용 장비 12종을 씁니다. 승급 경로는 없습니다.");
    expect(classSummarySentence({ role: "guardian", skillCount: 1, commandCount: 4, equipmentCount: 2, promotionCount: 2 }))
      .toContain("승급 경로 2개");
  });

  it("describes a skill without repeating defaults", () => {
    const project = createBlankProject();
    const skill = { ...project.database.skills[0]!, effect: { kind: "damage", statistic: "attack", affects: "hp" } as const, power: 10, successRate: 100, hitRate: 100, stateEffects: [], elementId: undefined };
    const fragments = skillSentenceFragments(project, skill);
    expect(fragments.primary).toBe("공격력 기반 HP 피해 · 위력 10");
    expect(fragments.element).toBe("");
    expect(fragments.states).toBe("");
    expect(skillSentenceFragments(project, { ...skill, hitRate: 90 }).primary).toContain("명중 90%");
  });

  it("answers what an item does when used", () => {
    const project = createBlankProject();
    const item = project.database.items.find((entry) => entry.hpRecovery.flat > 0 || entry.hpRecovery.percentMax > 0);
    expect(item).toBeDefined();
    const sentence = itemSummarySentence(project, item!);
    expect(sentence.startsWith("사용하면 ")).toBe(true);
    expect(sentence).toContain("HP");
  });
});
