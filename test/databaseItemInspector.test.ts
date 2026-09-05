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
import { itemEffectStory, renderItemRecordForm } from "@/editor/panels/databaseItemRecordView";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import { FARM_TOOLS } from "@/project/farmModel";
import { store } from "@/project/store";
import type { ItemRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  const project = createBlankProject();
  project.database.actors[0]!.faceResourceId = "easyrpg-faceset-actor1-00";
  if (project.database.actors[1]) {
    project.database.actors[1]!.faceResourceId = "easyrpg-faceset-actor1-01";
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
  // Break caught: removing the effect-story model would return the author to reading raw
  // scope/occasion/charge/recovery fields one by one.
  it("summarizes a finite-use party medicine from live item fields", () => {
    const project = store.getCurrent();
    const item = normalizeItemRecord({
      ...currentItem(),
      scope: "allAllies",
      occasion: "always",
      occasionField: true,
      occasionBattle: true,
      consumable: true,
      consumptionLimit: 3,
      hpRecovery: { flat: 30, percentMax: 40 },
      mpRecovery: { flat: 0, percentMax: 20 },
      healStateIds: [project.database.states[0]!.id],
    });

    const story = itemEffectStory(project, item);

    expect(story.target).toBe("아군 전체");
    expect(story.occasion).toBe("필드 · 전투");
    expect(story.consumption).toBe("1개당 3회 사용");
    expect(story.effects).toContain("HP 최대치 40% + 30 회복");
    expect(story.effects).toContain("MP 최대치 20% 회복");
    expect(story.effects.some((effect) => effect.startsWith("상태 회복:"))).toBe(true);
  });

  // Break caught: a special item with a live activateSkillId must name the triggered
  // skill instead of showing a generic "special" ledger row.
  it("resolves a special item's triggered skill name", () => {
    const project = store.getCurrent();
    const skill = project.database.skills[0];
    if (!skill) throw new Error("fixture needs a skill");
    const item = normalizeItemRecord({
      ...currentItem(),
      type: "special",
      activateSkillId: skill.id,
      skillId: undefined,
      hpRecovery: { flat: 0, percentMax: 0 },
      mpRecovery: { flat: 0, percentMax: 0 },
    });

    expect(itemEffectStory(project, item).effects).toContain(`스킬 발동: ${skill.name}`);
  });

  // Break caught: special items bypass isItemActorEligible, so populated legacy/AI
  // restriction ids must not be presented as an enforced actor/class allowlist.
  it("does not present special item actor and class ids as runtime restrictions", () => {
    const project = store.getCurrent();
    const actor = project.database.actors[0]!;
    const klass = project.database.classes[0]!;
    const item = normalizeItemRecord({
      ...currentItem(),
      type: "special",
      usableActorIds: [actor.id],
      usableClassIds: [klass.id],
    });

    const story = itemEffectStory(project, item);

    expect(story.notes.some((note) => note.startsWith("사용 허용:"))).toBe(false);
  });

  // Break caught: battle runtime ignores onlyUsableInMenu when the canonical occasion is
  // always, so the summary must not claim this inconsistent legacy record is menu-only.
  it("keeps an always item battle-usable when the legacy menu-only flag is also set", () => {
    const project = store.getCurrent();
    const item = normalizeItemRecord({
      ...currentItem(),
      occasion: "always",
      occasionField: false,
      occasionBattle: false,
      onlyUsableInMenu: true,
    });

    expect(itemEffectStory(project, item).occasion).toBe("필드 · 전투");
  });

  // Break caught: editing a recovery value without refreshing the story would leave a
  // polished but stale summary that contradicts the saved record.
  it("renders the effect story and refreshes it in place after recovery edits", () => {
    const form = renderForm();
    const storyHost = byTestId(form, "db-item-effect-story");
    expect(byTestId(form, "db-item-story-target").textContent).toContain("아군 1명");
    expect(storyHost.textContent).toContain("HP 최대치 40% + 30 회복");

    const hpStepper = byTestId(form, "db-field-item-hp-percent-stepper");
    hpStepper.value = "65";
    hpStepper.dispatchEvent(new Event("input"));

    expect(findByTestId(form, "db-item-effect-story")).toBe(storyHost);
    expect(storyHost.textContent).toContain("HP 최대치 65% + 30 회복");
    expect(storyHost.textContent).not.toContain("HP 최대치 40% + 30 회복");
  });

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

  it("occasion selection synchronizes menu and battle flags", () => {
    const form = renderForm();
    const occasion = byTestId(form, "db-field-item-occasion");
    occasion.value = "field";
    occasion.dispatchEvent(new Event("change"));
    expect(currentItem()).toMatchObject({ occasion: "field", onlyUsableInMenu: true, occasionField: true, occasionBattle: false });
    occasion.value = "always";
    occasion.dispatchEvent(new Event("change"));
    expect(currentItem()).toMatchObject({ occasion: "always", onlyUsableInMenu: false, occasionField: true, occasionBattle: true });
    const deadToggle = byTestId(form, "db-field-item-only-dead");
    deadToggle.checked = true;
    deadToggle.dispatchEvent(new Event("change"));
    expect(currentItem().onlyEffectiveOnDeadActors).toBe(true);
  });

  it("switch items use the same occasion authority", () => {
    updateDatabaseRecord("items", firstItem().id, { type: "switch", occasion: "never" });
    const occasion = byTestId(renderForm(), "db-field-item-occasion");
    occasion.value = "field";
    occasion.dispatchEvent(new Event("change"));
    expect(currentItem()).toMatchObject({ occasion: "field", occasionField: true, occasionBattle: false });
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

  // Break caught: 같은 record.scope 를 쓰는 컨트롤이 한 화면에 둘(수치 카드의 "범위"
  // 셀렉트 + 대상 세그먼트) 있으면 한쪽을 바꿔도 다른 쪽은 재렌더 전까지 옛 값을 보여준다
  // — 장비 부위(slot) 중복 P0 와 같은 모양이다.
  it("draws one scope control for usable items and none for ordinary goods", () => {
    // 픽스처 item[0] 은 약 계열 — 2지 세그먼트가 권위자다.
    const medicineForm = renderForm();
    expect(findByTestId(medicineForm, "db-field-item-scope")).not.toBeNull();
    expect(findByTestId(medicineForm, "db-field-scope")).toBeNull();

    updateDatabaseRecord("items", firstItem().id, { type: "normalGoods" });
    const goodsForm = renderForm();
    expect(findByTestId(goodsForm, "db-field-scope")).toBeNull();
    expect(findByTestId(goodsForm, "db-field-item-scope")).toBeNull();
  });

  // Break caught: "사용 가능" 카드가 약/책/씨앗/특수 패널에 각각 복제돼 있어 종류를 바꿀
  // 때마다 같은 카드가 다른 자리에 나타났다. 이제 한 장이 위계상 "사용 제한" 구역을 소유한다.
  it("renders one shared usable card placed under the limits section", () => {
    const form = renderForm();
    expect(form.querySelectorAll("[data-testid='db-item-card-usable']")).toHaveLength(1);
    const order = workbenchTestids(form);
    expect(order.indexOf("db-item-section-limits")).toBeLessThan(order.indexOf("db-item-card-usable"));
  });

  // Break caught: 카드가 오름차순으로 쌓이면 그래픽 카드가 효과 카드 사이에 끼고, 가격·포획
  // 배율·연결 스킬이 "수치" 한 장에 섞여 이름이 내용을 설명하지 못한다.
  it("orders workbench cards as summary → definition → effect → limits", () => {
    expect(workbenchTestids(renderForm())).toEqual([
      "db-item-card-story",
      "db-item-section-definition",
      "db-item-card-basics",
      "db-item-section-effect",
      "db-items-medicine-panel",
      "db-item-card-state-effects",
      "db-item-card-animation",
      "db-item-card-targeting",
      "db-item-section-limits",
      "db-item-card-usable",
      "db-item-card-graphic",
      "db-field-support-notice",
    ]);
  });

  // Break caught: stateEffects 는 스키마·뮤테이터·전투 런타임에 모두 있는데 저작 UI 가 없어서
  // "적에게 맹독을 거는 아이템"을 에디터만으로는 만들 수 없었다(도구/JSON 편집 필요).
  it("authors item state effects through add, edit and delete rows", () => {
    const states = store.getCurrent().database.states;
    const firstState = states[0];
    const secondState = states[1];
    if (!firstState || !secondState) throw new Error("fixture needs two states");
    const form = renderLiveForm();

    byTestId(form, "db-item-state-effect-add").click();
    expect(currentItem().stateEffects).toEqual([{ stateId: firstState.id, chance: 100, operation: "add" }]);
    expect(findByTestId(form, "db-item-state-effect-row-0")).not.toBeNull();

    const statePicker = byTestId(form, "db-field-item-state-effect-state-0");
    statePicker.value = secondState.id;
    statePicker.dispatchEvent(new Event("change"));
    const chance = byTestId(form, "db-field-item-state-effect-chance-0");
    chance.value = "140";
    chance.dispatchEvent(new Event("input"));
    const operation = byTestId(form, "db-field-item-state-effect-op-0");
    operation.value = "remove";
    operation.dispatchEvent(new Event("change"));

    // 확률은 저장 전에 0..100 으로 클램프된다(스킬 탭과 같은 계약).
    expect(currentItem().stateEffects).toEqual([{ stateId: secondState.id, chance: 100, operation: "remove" }]);

    byTestId(form, "db-item-state-effect-delete-0").click();
    expect(currentItem().stateEffects).toEqual([]);
    expect(findByTestId(form, "db-item-state-effect-row-0")).toBeNull();
  });

  // Break caught: battle/runtime.ts 는 item.animationId 로 전투 연출을 재생하는데 아이템 탭에
  // 애니메이션 선택이 없어, 저작자가 만든 전투 아이템은 언제나 무연출이었다.
  it("assigns and clears the battle animation played when the item is used", () => {
    const animation = store.getCurrent().database.battleAnimations[0];
    if (!animation) throw new Error("fixture needs a battle animation");
    const form = renderForm();

    const picker = byTestId(form, "db-picker-item-animation");
    picker.value = animation.id;
    picker.dispatchEvent(new Event("change"));
    expect(currentItem().animationId).toBe(animation.id);

    picker.value = "";
    picker.dispatchEvent(new Event("change"));
    expect(currentItem().animationId).toBeUndefined();
  });

  // Break caught: careProfile 은 monsterCare 런타임이 소비하는데 저작 UI 가 없어 먹이·장난감
  // 아이템은 기본 카탈로그에만 존재하고 사용자가 새로 만들 수 없었다.
  it("authors the monster care profile and removes it when set to none", () => {
    updateDatabaseRecord("items", firstItem().id, { type: "special" });
    const form = renderLiveForm();

    const kind = byTestId(form, "db-field-item-care-kind");
    kind.value = "feed";
    kind.dispatchEvent(new Event("change"));
    expect(currentItem().careProfile).toEqual({ kind: "feed", friendshipDelta: 0 });

    const friendship = byTestId(form, "db-field-item-care-friendship");
    friendship.value = "8";
    friendship.dispatchEvent(new Event("input"));
    const exp = byTestId(form, "db-field-item-care-exp");
    exp.value = "20";
    exp.dispatchEvent(new Event("input"));
    expect(currentItem().careProfile).toEqual({ kind: "feed", friendshipDelta: 8, expDelta: 20 });

    const kindAfter = byTestId(form, "db-field-item-care-kind");
    kindAfter.value = "none";
    kindAfter.dispatchEvent(new Event("change"));
    expect(currentItem().careProfile).toBeUndefined();
  });

  it("round-trips edited state effects, animation and care profile through project persistence", () => {
    const project = store.getCurrent();
    const itemId = currentItem().id;
    const animationId = project.database.battleAnimations[0]!.id;
    const stateEffects = [{ stateId: project.database.states[0]!.id, chance: 75, operation: "add" as const }];
    const careProfile = { kind: "toy" as const, friendshipDelta: 8, expDelta: 20 };
    updateDatabaseRecord("items", itemId, { stateEffects, animationId, careProfile });

    const reloaded = deserialize(serialize(store.getCurrent()));
    expect(reloaded.database.items.find((item) => item.id === itemId)).toMatchObject({ stateEffects, animationId, careProfile });
    store.replace(reloaded);
    updateDatabaseRecord("items", itemId, { stateEffects: [], animationId: undefined, careProfile: undefined });
    const cleared = deserialize(serialize(store.getCurrent())).database.items.find((item) => item.id === itemId)!;
    expect(cleared.stateEffects).toEqual([]);
    expect(cleared.animationId).toBeUndefined();
    expect(cleared.careProfile).toBeUndefined();
  });

  // Break caught: 서사가 remove(상태 회복)만 읽어서, 맹독을 부여하는 아이템이 "직접 효과 없음"
  // 으로 요약됐다. 확률이 100 미만이면 확률도 밝혀야 저작자가 판정을 예측할 수 있다.
  it("narrates inflicted states with their chance and names the battle animation", () => {
    const project = store.getCurrent();
    const state = project.database.states[0];
    const animation = project.database.battleAnimations[0];
    if (!state || !animation) throw new Error("fixture needs a state and an animation");
    const item = normalizeItemRecord({
      ...currentItem(),
      hpRecovery: { flat: 0, percentMax: 0 },
      mpRecovery: { flat: 0, percentMax: 0 },
      healStateIds: [],
      animationId: animation.id,
      stateEffects: [{ stateId: state.id, chance: 75, operation: "add" }],
    });

    const story = itemEffectStory(project, item);

    expect(story.effects).toContain(`상태 부여: ${state.name} (75%)`);
    expect(story.notes).toContain(`전투 연출: ${animation.name}`);
  });

  it("omits the chance when an inflicted state always lands", () => {
    const project = store.getCurrent();
    const state = project.database.states[0];
    if (!state) throw new Error("fixture needs a state");
    const item = normalizeItemRecord({
      ...currentItem(),
      hpRecovery: { flat: 0, percentMax: 0 },
      mpRecovery: { flat: 0, percentMax: 0 },
      healStateIds: [],
      stateEffects: [{ stateId: state.id, chance: 100, operation: "add" }],
    });

    expect(itemEffectStory(project, item).effects).toContain(`상태 부여: ${state.name}`);
  });

  // 가격은 "수치" 대신 정의(기본) 카드가 소유한다. 종류를 바꿔도 사라지지 않아야 한다.
  it("keeps price and consumption in basics, without unrelated farming options on medicine", () => {
    const basics = byTestId(renderForm(), "db-item-card-basics");
    expect(findByTestId(basics, "db-field-price")).not.toBeNull();
    expect(findByTestId(basics, "db-field-item-type")).not.toBeNull();
    expect(findByTestId(basics, "db-field-item-consumption-limit")).not.toBeNull();
    expect(findByTestId(basics, "db-field-item-farm-tool")).toBeNull();
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

  it("legacy weapon item keeps its price but has no scope/capture editors", async () => {
    const { renderRecordTab } = await import("@/editor/panels/databaseRecordViews");
    updateDatabaseRecord("items", firstItem().id, { type: "weapon" });
    const host = document.createElement("div") as unknown as FakeElement;
    renderRecordTab(host as unknown as HTMLElement, "items", () => undefined);
    expect(findByTestId(host, "db-item-open-equipment-tab")).not.toBeNull();
    expect(findByTestId(host, "db-field-price")).not.toBeNull();
    expect(findByTestId(host, "db-field-item-capture-multiplier")).toBeNull();
  });

  // 농사 도구 드롭다운은 FARM_TOOLS 정본에서 파생되어야 한다. 하드코딩이면 axe/pickaxe 가
  // 빠져 나무 베기·채굴이 저작 불가가 된다(회귀 방지).
  it("farm tool dropdown offers every canonical FARM_TOOLS value with Korean labels", () => {
    updateDatabaseRecord("items", firstItem().id, { type: "normalGoods" });
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

/**
 * 실제 패널처럼 rerender 가 같은 노드를 다시 그리는 폼. 행 추가/삭제처럼 컨트롤 개수가
 * 바뀌는 편집은 rerender 계약까지 함께 검증해야 한다(no-op rerender 로는 새 행이
 * 화면에 없는데도 통과한다).
 */
function renderLiveForm(): FakeElement {
  const form = document.createElement("section") as unknown as FakeElement;
  const paint = (): void => {
    form.replaceChildren();
    renderItemRecordForm(form as unknown as HTMLElement, currentItem(), paint);
  };
  paint();
  return form;
}

/** 워크벤치 격자의 직계 자식 testid 순서 = 화면에서 읽히는 카드 순서. */
function workbenchTestids(form: FakeElement): string[] {
  const workbench = findByTestId(form, "db-items-oprn-workbench");
  if (!workbench) throw new Error("missing db-items-oprn-workbench");
  return workbench.children.map((child) => child.dataset.testid).filter((testid): testid is string => Boolean(testid));
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
