// DB UI 현대화 W4 P3 — 아이템 폼 인스펙터 전환 계약 검증(fakeDom).
//
// todo 9: databaseItemRecordView.ts 가 모던 컨트롤(T8 프리미티브)로 전환된 뒤에도
// 저장 필드명/스키마는 그대로여야 한다. 이 파일이 검증하는 불변식:
//   1. HP/MP 회복 % 슬라이더+스테퍼 → updateDatabaseRecord 로 클램프·스텝 정규화 값 저장.
//   2. 대상(scope) 세그먼트 → 저장된 ItemScope enum 값 그대로 재작성.
//   3. 사용 가능 배우 아바타 칩 → usableActorIds 배열 토글(직업 체크박스 계약 유지).
//   4. 메뉴/전투 토글 스위치 → 기존 boolean 필드명 그대로 저장.
//   5. 종류(type) 변경 → updateItemType + 전체 재렌더 계약 유지(패널 스왑).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderItemRecordForm } from "@/editor/panels/databaseItemRecordView";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { createBlankProject } from "@/project/defaults";
import { FARM_TOOLS } from "@/project/farmModel";
import { store } from "@/project/store";
import type { ItemRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  const project = createBlankProject();
  project.database.actors[0]!.faceResourceId = "easyrpg-faceset-actor1";
  project.database.actors[0]!.faceIndex = 0;
  if (project.database.actors[1]) {
    project.database.actors[1]!.faceResourceId = "easyrpg-faceset-actor1";
    project.database.actors[1]!.faceIndex = 1;
  }
  const item = project.database.items[0];
  if (!item) throw new Error("fixture needs at least one item");
  item.hpRecovery = { flat: 30, percentMax: 40 };
  item.mpRecovery = { flat: 10, percentMax: 20 };
  item.usableActorIds = [project.database.actors[0]!.id];
  item.usableClassIds = [];
  item.scope = "ally";
  item.onlyUsableInMenu = false;
  store.replace(project);
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("database item inspector form", () => {
  it("renders the inspector header with 96px icon, name edit (db-field-name), and type tag", () => {
    const form = renderForm();
    expect(byTestId(form, "db-item-inspector-header")).toBeTruthy();
    const icon = form.querySelector(".db-item-inspector-icon");
    expect(icon).toBeTruthy();
    expect(icon?.style.backgroundImage).toContain("url(");
    expect(form.querySelector(".db-item-inspector-type-tag")?.textContent).toBe("약");

    const nameInput = byTestId(form, "db-field-name");
    expect(nameInput.value).toBe("회복약");
    nameInput.value = "고급 회복약";
    nameInput.dispatchEvent(new Event("input"));
    expect(currentItem().name).toBe("고급 회복약");
  });

  it("HP/MP recovery % slider/stepper writes clamped step-5 values to the store", () => {
    const form = renderForm();
    const hpStepper = byTestId(form, "db-field-item-hp-percent-stepper");
    const hpSlider = byTestId(form, "db-field-item-hp-percent-slider");
    expect(hpStepper.attrs.min).toBe("0");
    expect(hpStepper.attrs.max).toBe("100");
    expect(hpStepper.attrs.step).toBe("5");
    expect(hpStepper.value).toBe("40");
    expect(hpSlider.value).toBe("40");

    // % 101 → 100 클램프(adversarial: malformed input).
    hpStepper.value = "101";
    hpStepper.dispatchEvent(new Event("input"));
    expect(currentItem().hpRecovery.percentMax).toBe(100);
    expect(hpStepper.value).toBe("100");
    expect(hpSlider.value).toBe("100");

    // 스텝 5 정규화: 37 → 35.
    hpStepper.value = "37";
    hpStepper.dispatchEvent(new Event("input"));
    expect(currentItem().hpRecovery.percentMax).toBe(35);

    // 슬라이더 이동도 동일 경로(updateDatabaseRecord)로 저장된다.
    hpSlider.value = "65";
    hpSlider.dispatchEvent(new Event("input"));
    expect(currentItem().hpRecovery.percentMax).toBe(65);
    expect(byTestId(form, "db-field-item-hp-percent-stepper").value).toBe("65");

    // MP 쪽도 같은 계약.
    const mpStepper = byTestId(form, "db-field-item-mp-percent-stepper");
    mpStepper.value = "95";
    mpStepper.dispatchEvent(new Event("input"));
    expect(currentItem().mpRecovery.percentMax).toBe(95);
  });

  it("keeps the base percent testid on the field wrapper while inputs use -slider/-stepper", () => {
    const form = renderForm();
    const base = form.querySelector("[data-testid='db-field-item-hp-percent']");
    expect(base).toBeTruthy();
    expect(byTestId(form, "db-field-item-hp-percent-slider")).toBeTruthy();
    expect(byTestId(form, "db-field-item-hp-percent-stepper")).toBeTruthy();
    expect(byTestId(form, "db-field-item-hp-flat")).toBeTruthy();
    expect(byTestId(form, "db-field-item-mp-flat")).toBeTruthy();
  });

  it("segmented scope radio rewrites the stored ItemScope enum", () => {
    const form = renderForm();
    const radios = form.querySelectorAll("[data-testid='db-field-item-scope-option']");
    expect(radios).toHaveLength(2);
    const [allyRadio, allAlliesRadio] = radios as [FakeElement, FakeElement];
    expect(allyRadio.checked).toBe(true);
    expect(currentItem().scope).toBe("ally");

    allAlliesRadio.checked = true;
    allAlliesRadio.dispatchEvent(new Event("change", { bubbles: true }));
    expect(currentItem().scope).toBe("allAllies");

    allyRadio.checked = true;
    allyRadio.dispatchEvent(new Event("change", { bubbles: true }));
    expect(currentItem().scope).toBe("ally");
  });

  it("avatar chip toggles an actor id in usableActorIds and keeps class checkboxes", () => {
    const form = renderForm();
    const actor2 = store.getCurrent().database.actors[1];
    if (!actor2) throw new Error("fixture needs 2 actors");
    const chips = form.querySelectorAll("[data-testid='db-field-item-usable-actors-chip']");
    expect(chips.length).toBeGreaterThanOrEqual(2);
    const chip2 = chips.find((chip) => chip.dataset.actorId === actor2.id);
    if (!chip2) throw new Error(`missing chip for actor ${actor2.id}`);

    expect(chip2.getAttribute("aria-pressed")).toBe("false");
    expect(currentItem().usableActorIds).not.toContain(actor2.id);
    chip2.click();
    expect(currentItem().usableActorIds).toContain(actor2.id);
    expect(chip2.getAttribute("aria-pressed")).toBe("true");
    expect(chip2.classList.contains("dimmed")).toBe(false);

    chip2.click();
    expect(currentItem().usableActorIds).not.toContain(actor2.id);
    expect(chip2.getAttribute("aria-pressed")).toBe("false");
    expect(chip2.classList.contains("dimmed")).toBe(true);

    // 직업(usableClassIds) 체크박스 계약은 그대로 유지된다.
    const klassId = store.getCurrent().database.classes[0]?.id;
    if (klassId) {
      const classCheck = byTestId(form, `db-field-item-usable-class-${klassId}`);
      expect(classCheck.attrs.type).toBe("checkbox");
      classCheck.checked = true;
      classCheck.dispatchEvent(new Event("input"));
      expect(currentItem().usableClassIds).toContain(klassId);
    }
  });

  it("toggle switches write the stored boolean fields (onlyUsableInMenu / onlyEffectiveOnDeadActors)", () => {
    const form = renderForm();
    const menuToggle = byTestId(form, "db-field-item-only-menu");
    expect(menuToggle.attrs.type).toBe("checkbox");
    expect(menuToggle.checked).toBe(false);
    menuToggle.checked = true;
    menuToggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(currentItem().onlyUsableInMenu).toBe(true);
    expect(currentItem().occasion).toBe("field");

    menuToggle.checked = false;
    menuToggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(currentItem().onlyUsableInMenu).toBe(false);

    const deadToggle = byTestId(form, "db-field-item-only-dead");
    deadToggle.checked = true;
    deadToggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(currentItem().onlyEffectiveOnDeadActors).toBe(true);
  });

  it("battle/field occasion toggles write the stored occasionBattle/occasionField flags", () => {
    const item = firstItem();
    updateDatabaseRecord("items", item.id, { type: "switch", occasionField: false, occasionBattle: false, occasion: "never" });
    const form = renderForm();
    expect(findByTestId(form, "db-items-switch-panel")).not.toBeNull();

    const battleToggle = byTestId(form, "db-field-item-occasion-battle");
    expect(battleToggle.checked).toBe(false);
    battleToggle.checked = true;
    battleToggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(currentItem().occasionBattle).toBe(true);
    expect(currentItem().occasion).toBe("battle");

    const fieldToggle = byTestId(form, "db-field-item-occasion-field");
    fieldToggle.checked = true;
    fieldToggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(currentItem().occasionField).toBe(true);
    expect(currentItem().occasion).toBe("always");
  });

  it("type change calls updateItemType + full rerender and swaps type panels", () => {
    let rerenderCount = 0;
    const form = renderForm(() => {
      rerenderCount += 1;
    });
    const typeSelect = byTestId(form, "db-field-item-type");
    typeSelect.value = "special";
    typeSelect.dispatchEvent(new Event("change"));

    expect(rerenderCount).toBe(1);
    const item = currentItem();
    expect(item.type).toBe("special");
    expect(item.consumable).toBe(true);
    expect(item.scope).toBe("ally");

    // 전체 재렌더 계약: 새 렌더는 메디신 패널 대신 스페셜 패널을 그린다.
    const secondForm = document.createElement("section") as unknown as FakeElement;
    renderItemRecordForm(secondForm as unknown as HTMLElement, item, () => undefined);
    expect(findByTestId(secondForm, "db-items-medicine-panel")).toBeNull();
    expect(findByTestId(secondForm, "db-items-special-panel")).not.toBeNull();
  });

  it("weapon type shows an equipment-tab door instead of the legacy equipment form", () => {
    updateDatabaseRecord("items", firstItem().id, { type: "weapon" });
    const form = document.createElement("section") as unknown as FakeElement;
    const panelRoot = document.createElement("div") as unknown as FakeElement;
    panelRoot.className = "database-modal-body";
    panelRoot.append(form as unknown as HTMLElement);
    renderItemRecordForm(form as unknown as HTMLElement, currentItem(), () => undefined);

    expect(findByTestId(form, "db-field-item-wield-type")).toBeNull();
    expect(findByTestId(form, "db-item-open-equipment-tab")).not.toBeNull();
    expect(findByTestId(form, "db-item-equipment-redirect")?.textContent).toContain("장비 탭");
  });

  it("weapon type record tab drops stacked price/scope/capture fields", async () => {
    const { renderRecordTab } = await import("@/editor/panels/databaseRecordViews");
    updateDatabaseRecord("items", firstItem().id, { type: "weapon" });
    const host = document.createElement("div") as unknown as FakeElement;
    renderRecordTab(host as unknown as HTMLElement, "items", () => undefined);
    expect(findByTestId(host, "db-item-open-equipment-tab")).not.toBeNull();
    expect(findByTestId(host, "db-field-price")).toBeNull();
    expect(findByTestId(host, "db-field-item-capture-multiplier")).toBeNull();
  });

  // 농사 도구 드롭다운은 FARM_TOOLS 정본에서 파생되어야 한다. 하드코딩이면 axe/pickaxe 가
  // 빠져 나무 베기·채굴이 저작 불가가 된다(회귀 방지).
  it("farm tool dropdown offers every canonical FARM_TOOLS value with Korean labels", () => {
    const form = renderForm();
    const select = byTestId(form, "db-field-item-farm-tool");
    expect(select.children.map((option) => option.attrs.value)).toEqual(["", ...FARM_TOOLS]);
    expect(select.children.map((option) => option.textContent)).toEqual(["(없음)", "괭이", "물뿌리개", "도끼", "곡괭이"]);

    select.value = "pickaxe";
    select.dispatchEvent(new Event("change"));
    expect(currentItem().farmTool).toBe("pickaxe");

    select.value = "";
    select.dispatchEvent(new Event("change"));
    expect(currentItem().farmTool).toBeUndefined();
  });
});

function renderForm(rerender: () => void = () => undefined): FakeElement {
  const form = document.createElement("section") as unknown as FakeElement;
  renderItemRecordForm(form as unknown as HTMLElement, currentItem(), rerender);
  return form;
}

function currentItem(): ItemRecord {
  const item = store.getCurrent().database.items.find((entry) => entry.id === firstItem().id);
  if (!item) throw new Error("fixture item missing from store");
  return item;
}

function firstItem(): ItemRecord {
  const item = store.getCurrent().database.items[0];
  if (!item) throw new Error("fixture needs at least one item");
  return item;
}

function byTestId(root: FakeElement, testid: string): FakeElement {
  const element = findByTestId(root, testid);
  if (!element) throw new Error(`missing test id ${testid}`);
  return element;
}
