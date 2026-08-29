import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createBlankProject } from "@/project/defaults";
import { deserialize } from "@/project/io";
import { validateProjectReferences } from "@/project/io/references";

const FIXTURE_PATH = join(process.cwd(), "test/fixtures/projects/item-runtime-qa-v3.json");
const DEMO_PATH = join(process.cwd(), "test/fixtures/projects/editor-authored-demo-v3.json");

/**
 * 런타임 QA 시나리오가 실제 기본 아이템을 만지려면 인벤토리에 이 일곱 갈래가 들어 있어야 한다.
 * scripts/build-item-qa-fixture.mjs 의 SEEDED_ITEMS 와 같은 목록이다 — 생성기가 성격까지
 * 실데이터로 확인하고, 여기서는 커밋된 결과물이 그 계약을 지키는지 본다.
 */
const SEEDED_ITEM_IDS = [
  "item_potion",
  "item_ether",
  "item_antidote_plus",
  "item_gen2_party_potion",
  "item_gen2_war_draught",
  "item_gen2_frost_vial",
  "item_gen2_twin_dose_kit",
] as const;

function loadFixture() {
  return deserialize(readFileSync(FIXTURE_PATH, "utf8"));
}

describe("아이템 런타임 QA 픽스처", () => {
  it("실제 로드 경로로 열리고 참조 검증도 통과한다", () => {
    const project = loadFixture();

    expect(() => validateProjectReferences(project)).not.toThrow();
  });

  it("출하 기본 아이템 카탈로그를 통째로 싣는다", () => {
    const project = loadFixture();
    const itemIds = new Set(project.database.items.map((item) => item.id));
    const shipped = createBlankProject().database;

    const missing = shipped.items.map((item) => item.id).filter((id) => !itemIds.has(id));
    expect(missing, `기본 카탈로그 누락: ${missing.join(", ")}`).toEqual([]);
    // 아이템이 가리키는 스킬·상태·애니메이션도 같은 규칙으로 실려야 참조가 산다.
    for (const [label, records] of [
      ["skills", shipped.skills],
      ["states", shipped.states],
      ["battleAnimations", shipped.battleAnimations],
      ["equipment", shipped.equipment],
    ] as const) {
      const present = new Set(project.database[label].map((record) => record.id));
      const gaps = records.map((record) => record.id).filter((id) => !present.has(id));
      expect(gaps, `${label} 누락: ${gaps.join(", ")}`).toEqual([]);
    }
  });

  it("데모 픽스처의 레코드와 시작 상태를 병합 뒤에도 그대로 지킨다", () => {
    const project = loadFixture();
    const demo = deserialize(readFileSync(DEMO_PATH, "utf8"));

    // 알려진 전투 경로(map_lantern_village → map_moonwell_forest)의 전제.
    expect(project.startMapId).toBe(demo.startMapId);
    expect(project.startPos).toEqual(demo.startPos);
    expect(project.session.partyActorIds).toEqual(demo.session.partyActorIds);

    for (const demoItem of demo.database.items) {
      expect(project.database.items.find((item) => item.id === demoItem.id), demoItem.id).toEqual(demoItem);
    }
    expect(Object.keys(project.maps).sort()).toEqual(Object.keys(demo.maps).sort());
    expect(project.database.troops.map((troop) => troop.id)).toEqual(demo.database.troops.map((troop) => troop.id));
  });

  it("시드된 일곱 갈래를 인벤토리에 3개 이상씩 들고 있다", () => {
    const project = loadFixture();
    const itemById = new Map(project.database.items.map((item) => [item.id, item]));

    for (const id of SEEDED_ITEM_IDS) {
      expect(itemById.get(id), id).toBeTruthy();
      expect(project.session.inventory[id] ?? 0, id).toBeGreaterThanOrEqual(3);
    }

    // 성격이 서로 다른 실행 경로여야 QA 가 의미를 갖는다.
    expect(itemById.get("item_potion")?.hpRecovery.flat).toBeGreaterThan(0);
    expect(itemById.get("item_ether")?.mpRecovery.flat).toBeGreaterThan(0);
    expect(itemById.get("item_antidote_plus")?.healStateIds.length).toBeGreaterThan(0);
    expect(itemById.get("item_gen2_party_potion")?.scope).toBe("allAllies");
    expect(itemById.get("item_gen2_war_draught")?.stateEffects).toEqual(
      expect.arrayContaining([expect.objectContaining({ operation: "add" })])
    );
    expect(itemById.get("item_gen2_frost_vial")).toMatchObject({ scope: "enemy", skillId: "skill_item_frost_vial" });
    expect(itemById.get("item_gen2_twin_dose_kit")?.consumptionLimit).toBeGreaterThan(1);
  });
});
