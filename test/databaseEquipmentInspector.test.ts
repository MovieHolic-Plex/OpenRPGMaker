import { updateDatabaseRecord } from "@/editor/databaseActions";
// DB UI 현대화 W4 P3 — 장비 폼 인스펙터 전환 계약 검증(fakeDom).
//
// todo 10: databaseEquipmentRecordView.ts 가 모던 컨트롤(T8 프리미티브)로 전환된 뒤에도
// 저장 필드명/스키마는 그대로여야 한다. 이 파일이 검증하는 불변식:
//   1. 헤더(아이콘+이름 db-field-name+부위 세그먼트) + 요약 칩 호스트 승격.
//   2. 부위(slot) 세그먼트 변경 → slot 필드 재작성 + 칩 호스트 부분 갱신 — 전체 폼
//      재렌더 금지(센티널 노드 생존으로 증명).
//   3. 양손 장비 토글 → '양손 장비' 칩이 호스트에 나타난다(부분 갱신).
//   4. 상태 저항/부여율 % 슬라이더+스테퍼 → 클램프(150 → 100) + 쓰기-백.
//   5. 방어 방식(resist/inflict) 세그먼트 + 9종 효과 플래그 토글스위치 → 기존
//      필드명/testid 그대로 저장.
//   6. 장착 허용 배우/직업 체크박스 계약 유지(db-field-equipment-actor-<id> e2e
//      의존) — 아바타 칩은 아이템 폼의 비장비 아이템에만 적용되고, 장비 폼은
//      per-actor testid + .check() e2e 계약이 있어 체크박스를 유지한다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EquipmentRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

function seedEquipment(patch: Partial<EquipmentRecord> = {}): EquipmentRecord {
  const record = normalizeEquipmentRecord({
    id: "equip_sword",
    name: "검",
    twoHanded: false,
    cursed: false,
    ...patch,
  });
  store.update((project) => {
    project.database.equipment = [record];
  });
  return store.getCurrent().database.equipment[0]!;
}

function renderForm(recordId = "equip_sword"): FakeElement {
  const form = document.createElement("section") as unknown as FakeElement;
  const record = store.getCurrent().database.equipment.find((entry) => entry.id === recordId);
  if (!record) throw new Error(`missing equipment ${recordId}`);
  renderEquipmentRecordForm(form as unknown as HTMLElement, record);
  return form;
}

function chipTexts(host: FakeElement): string[] {
  const row = findByTestId(host, "db-equipment-summary-chips");
  if (!row) throw new Error("missing summary chip row");
  return row.childNodes
    .map((node) => ("textContent" in node ? String(node.textContent ?? "") : ""))
    .map((text) => text.trim())
    .filter(Boolean);
}

function byTestId(root: FakeElement, testid: string): FakeElement {
  const element = findByTestId(root, testid);
  if (!element) throw new Error(`missing test id ${testid}`);
  return element;
}

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  seedEquipment();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("equipment inspector header", () => {
  // Break caught: an author needs an actor-selectable live preview, not only a record-wide
  // permission checklist and isolated bonus numbers.
  it("switches the actor comparison between eligible and ineligible actors", () => {
    const project = store.getCurrent();
    const equipment = project.database.equipment[0]!;
    const firstActor = project.database.actors[0]!;
    const secondActor = project.database.actors[1]!;
    equipment.equippableActorIds = [firstActor.id];
    equipment.equippableClassIds = [];
    firstActor.initialEquipment = {};
    secondActor.initialEquipment = {};

    const form = renderForm();
    const resultHost = byTestId(form, "db-equipment-comparison-result");
    expect(resultHost.dataset.state).toBe("eligible");
    expect(resultHost.textContent).toContain(`Lv.${firstActor.initialLevel}`);

    const actorSelect = byTestId(form, "db-equipment-comparison-actor");
    actorSelect.value = secondActor.id;
    actorSelect.dispatchEvent(new Event("change"));

    expect(findByTestId(form, "db-equipment-comparison-result")).toBe(resultHost);
    expect(resultHost.dataset.state).toBe("ineligible");
    expect(resultHost.textContent).toContain("장착 불가");
  });

  // Break caught: editing the candidate's stats must update the comparison in place; a stale
  // delta is more misleading than having no preview at all.
  it("refreshes actor stat deltas in place when an equipment bonus changes", () => {
    const project = store.getCurrent();
    const equipment = project.database.equipment[0]!;
    const actor = project.database.actors[0]!;
    equipment.equippableActorIds = [actor.id];
    equipment.equippableClassIds = [];
    equipment.statBonuses.attack = 8;
    actor.initialEquipment = {};

    const form = renderForm();
    const resultHost = byTestId(form, "db-equipment-comparison-result");
    expect(resultHost.textContent).toContain("빈 부위에 장착");
    expect(byTestId(form, "db-equipment-comparison-delta-attack").textContent).toContain("+8");

    const attack = byTestId(form, "db-field-equipment-attack");
    attack.value = "20";
    attack.dispatchEvent(new Event("input"));

    expect(findByTestId(form, "db-equipment-comparison-result")).toBe(resultHost);
    expect(byTestId(form, "db-equipment-comparison-delta-attack").textContent).toContain("+20");
  });

  // Break caught: an already-equipped candidate must not reuse the empty-slot fallback copy.
  it("labels an already-equipped candidate instead of claiming the slot is empty", () => {
    const project = store.getCurrent();
    const equipment = project.database.equipment[0]!;
    const actor = project.database.actors[0]!;
    equipment.equippableActorIds = [actor.id];
    equipment.equippableClassIds = [];
    actor.initialEquipment = { weapon: equipment.id };

    const resultHost = byTestId(renderForm(), "db-equipment-comparison-result");

    expect(resultHost.textContent).toContain("이미 착용 중");
    expect(resultHost.textContent).not.toContain("빈 부위에 장착");
  });

  it("renders a named effect story beside the existing summary chips", () => {
    const form = renderForm();
    expect(byTestId(form, "db-equipment-effect-story")).toBeTruthy();
    expect(byTestId(form, "db-equipment-story-stats")).toBeTruthy();
  });

  it("renders icon, name edit (db-field-name), slot segmented, and the summary chips host", () => {
    const form = renderForm();
    expect(findByTestId(form, "db-equipment-inspector-header")).not.toBeNull();
    expect(form.querySelector(".db-equipment-inspector-icon")).toBeTruthy();

    const nameInput = byTestId(form, "db-field-name");
    expect(nameInput.value).toBe("검");
    nameInput.value = "강철검";
    nameInput.dispatchEvent(new Event("input"));
    expect(store.getCurrent().database.equipment[0]?.name).toBe("강철검");

    // 부위 세그먼트 — EquipmentRecord.slot 실값 5종, 기본값 weapon 체크.
    const slotRadios = form.querySelectorAll("[data-testid='db-field-equipment-slot-option']");
    expect(slotRadios).toHaveLength(5);
    expect(slotRadios.map((radio) => radio.attrs.value)).toEqual(["weapon", "shield", "helmet", "armor", "accessory"]);
    expect(slotRadios[0].checked).toBe(true);

    const chipsHost = findByTestId(form, "db-equipment-summary-chips");
    expect(chipsHost).not.toBeNull();
    expect(chipsHost?.className).toContain("db-equipment-summary-chips");
    // 헤더 안에 승격되어 있다(직접 자식이 아니라 헤더 하위).
    expect(form.querySelector(".db-equipment-inspector-header")?.querySelector(".db-equipment-summary-chips")).toBeTruthy();
  });

  it("segmented slot change rewrites slot and refreshes chips without a full form rebuild", () => {
    const form = renderForm();
    const chipsHost = byTestId(form, "db-equipment-summary-chips");
    const firstChip = chipsHost.childNodes[0];

    // 센티널: 칩 호스트와 무관한 노드(설명 필드/헤더)에 마커를 남긴다 — 부분 갱신이면
    // 살아남고, 전체 재렌더면 사라진다.
    const description = byTestId(form, "db-field-equipment-description");
    description.dataset.sentinel = "alive";
    const header = byTestId(form, "db-equipment-inspector-header");
    header.dataset.sentinel = "header-alive";

    const slotRadios = form.querySelectorAll("[data-testid='db-field-equipment-slot-option']");
    const shield = slotRadios.find((radio) => radio.attrs.value === "shield");
    if (!shield) throw new Error("missing shield slot option");
    shield.checked = true;
    shield.dispatchEvent(new Event("change", { bubbles: true }));

    expect(store.getCurrent().database.equipment[0]?.slot).toBe("shield");
    // 칩 호스트는 같은 노드, 자식만 교체(부분 갱신 경로).
    expect(findByTestId(form, "db-equipment-summary-chips")).toBe(chipsHost);
    expect(chipsHost.childNodes[0]).not.toBe(firstChip);
    // 무관한 노드는 그대로 — 전체 재렌더가 아니다.
    expect(findByTestId(form, "db-field-equipment-description")?.dataset.sentinel).toBe("alive");
    expect(findByTestId(form, "db-equipment-inspector-header")?.dataset.sentinel).toBe("header-alive");
  });

  it("name edit rewrites the name field and keeps the header intact", () => {
    const form = renderForm();
    const nameInput = byTestId(form, "db-field-name");
    nameInput.value = "전설의 검";
    nameInput.dispatchEvent(new Event("input"));
    expect(store.getCurrent().database.equipment[0]?.name).toBe("전설의 검");
    expect(byTestId(form, "db-field-name").value).toBe("전설의 검");
  });
});

describe("summary chips partial refresh (refreshSummaryChips closure)", () => {
  it("toggle twoHanded switch adds the 양손 장비 chip without a rebuild", () => {
    const form = renderForm();
    expect(chipTexts(form)).toEqual(["명중률 100%", "치명타율 +0%p"]);
    expect(findByTestId(form, "db-equipment-summary-empty")).toBeNull();

    const twoHanded = byTestId(form, "db-field-equipment-two-handed");
    expect(twoHanded.attrs.type).toBe("checkbox");
    expect(twoHanded.attrs.role).toBe("switch");
    twoHanded.checked = true;
    twoHanded.dispatchEvent(new Event("change", { bubbles: true }));

    expect(store.getCurrent().database.equipment[0]?.twoHanded).toBe(true);
    const texts = chipTexts(form);
    expect(texts).toContain("양손 장비");
    expect(findByTestId(form, "db-equipment-summary-empty")).toBeNull();

    // 되돌리면 칩도 다시 빠진다 — 초기 스냅샷이 아닌 currentEquipment 추적.
    twoHanded.checked = false;
    twoHanded.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getCurrent().database.equipment[0]?.twoHanded).toBe(false);
    expect(chipTexts(form)).toEqual(["명중률 100%", "치명타율 +0%p"]);
  });

  it("effect flag toggleSwitch writes effectFlags and refreshes the chip row", () => {
    const form = renderForm();
    const double = byTestId(form, "db-field-equipment-effect-double");
    expect(double.attrs.type).toBe("checkbox");
    double.checked = true;
    double.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getCurrent().database.equipment[0]?.effectFlags.doubleAttack).toBe(true);
    expect(chipTexts(form)).toContain("2회 공격");

    double.checked = false;
    double.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getCurrent().database.equipment[0]?.effectFlags.doubleAttack).toBe(false);
    expect(chipTexts(form)).toEqual(["명중률 100%", "치명타율 +0%p"]);
  });
});

describe("state percent sliders (0-100%)", () => {
  it("clamps out-of-range input with display write-back (150 → 100)", () => {
    const form = renderForm();
    const slider = byTestId(form, "db-field-equipment-state-resistance-slider");
    expect(slider.attrs.type).toBe("range");
    expect(slider.attrs.min).toBe("0");
    expect(slider.attrs.max).toBe("100");
    expect(slider.attrs.step).toBe("1");

    slider.value = "150";
    slider.dispatchEvent(new Event("input"));
    expect(store.getCurrent().database.equipment[0]?.stateResistanceChance).toBe(100);
    expect(slider.value).toBe("100");

    // 레거시 클램프 계약(databaseWave2BatchC): base testid 는 클램프+쓰기-백 입력이다.
    const base = byTestId(form, "db-field-equipment-state-resistance");
    expect(base.attrs.type).toBe("number");
    base.value = "250";
    base.dispatchEvent(new Event("input"));
    expect(base.value).toBe("100");
    expect(store.getCurrent().database.equipment[0]?.stateResistanceChance).toBe(100);
  });

  it("state infliction chance uses the same slider/stepper pair contract", () => {
    const form = renderForm();
    const inflictSlider = byTestId(form, "db-field-equipment-state-infliction-slider");
    inflictSlider.value = "101";
    inflictSlider.dispatchEvent(new Event("input"));
    expect(store.getCurrent().database.equipment[0]?.stateInflictionChance).toBe(100);
    expect(inflictSlider.value).toBe("100");
    // base testid 는 숫자 입력(stepper)에 남는다 — numberField 시절 클램프 계약.
    const base = byTestId(form, "db-field-equipment-state-infliction");
    expect(base.attrs.type).toBe("number");
  });
});

describe("state defense mode + effect flags (modern controls)", () => {
  it("offers only an explicit repair for legacy inflict defense settings", () => {
    updateDatabaseRecord("equipment", store.getCurrent().database.equipment[0]!.id, { stateDefenseMode: "inflict" });
    const form = renderForm();
    expect(findByTestId(form, "db-field-equipment-state-defense-mode")).toBeNull();
    byTestId(form, "db-equipment-enable-state-resistance").click();
    expect(store.getCurrent().database.equipment[0]?.stateDefenseMode).toBe("resist");
  });

  it("keeps actor/class permission checkbox testids (e2e contract)", () => {
    const form = renderForm();
    const actorId = store.getCurrent().database.actors[0]?.id;
    if (!actorId) throw new Error("fixture needs an actor");
    const actorCheck = byTestId(form, `db-field-equipment-actor-${actorId}`);
    expect(actorCheck.attrs.type).toBe("checkbox");
    actorCheck.checked = true;
    actorCheck.dispatchEvent(new Event("change"));
    expect(store.getCurrent().database.equipment[0]?.equippableActorIds).toContain(actorId);

    const klassId = store.getCurrent().database.classes[0]?.id;
    if (klassId) {
      const classCheck = byTestId(form, `db-field-equipment-class-${klassId}`);
      expect(classCheck.attrs.type).toBe("checkbox");
      classCheck.checked = true;
      classCheck.dispatchEvent(new Event("change"));
      expect(store.getCurrent().database.equipment[0]?.equippableClassIds).toContain(klassId);
    }
  });
});
