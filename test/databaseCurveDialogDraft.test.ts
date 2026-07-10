import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { actorCurveCards, actorExperiencePanel } from "@/editor/panels/actorRecordCurveEditors";
import { classCurveCards } from "@/editor/panels/databaseClassCurveEditors";
import { renderClassExperiencePanel } from "@/editor/panels/databaseClassExperienceCurveEditor";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

// P7 회귀 스펙: 곡선 다이얼로그의 "취소"가 입력값을 적용해버리던 결함(draft 미분리) +
// 다이얼로그를 닫아도 시트 요약이 갱신되지 않던 결함 + "다음 레벨까지" dead 탭.
let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  resetMapEditHistory();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function body(): FakeElement {
  return document.body as unknown as FakeElement;
}

function byTestId(testid: string): FakeElement {
  const found = findByTestId(body(), testid);
  if (!found) throw new Error(`missing [data-testid=${testid}]`);
  return found;
}

function commitInput(input: FakeElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("change"));
}

describe("class parameter curve dialog draft separation (P7)", () => {
  function openDialog(): void {
    const record = store.getCurrent().database.classes[0];
    if (!record) throw new Error("expected default class");
    const cards = classCurveCards(record);
    const maxHpCard = cards[0];
    if (!(maxHpCard instanceof FakeElement)) throw new Error("expected fake card");
    maxHpCard.dispatchEvent(new Event("click"));
  }

  function storedMaxHpLv1(): number | undefined {
    return store.getCurrent().database.classes[0]?.parameterCurves.maxHp[0];
  }

  it("취소 discards edits even after the value input change committed to the draft", () => {
    const before = storedMaxHpLv1();
    openDialog();
    commitInput(byTestId("db-class-parameter-value"), "77777");
    byTestId("db-class-parameter-cancel").click();
    expect(storedMaxHpLv1()).toBe(before);
    expect(findByTestId(body(), "db-class-parameter-dialog")).toBeNull();
  });

  it("OK commits the draft to the store", () => {
    openDialog();
    commitInput(byTestId("db-class-parameter-value"), "77777");
    byTestId("db-class-parameter-close").click();
    expect(storedMaxHpLv1()).toBe(77777);
  });

  it("도움말 dead 버튼은 제거됐다", () => {
    openDialog();
    const dialog = byTestId("db-class-parameter-dialog");
    expect(dialog.textContent).not.toContain("도움말");
  });
});

describe("class experience curve dialog draft + delta tab (P7)", () => {
  function openExpDialog(): { host: FakeElement } {
    const record = store.getCurrent().database.classes[0];
    if (!record) throw new Error("expected default class");
    const host = el("div") as unknown as FakeElement;
    const refresh = (): void => renderClassExperiencePanel(record, host as unknown as HTMLElement, refresh);
    refresh();
    const edit = findByTestId(host, "db-class-exp-edit");
    if (!edit) throw new Error("missing exp edit button");
    edit.dispatchEvent(new Event("click"));
    return { host };
  }

  function storedBase(): number | undefined {
    return store.getCurrent().database.classes[0]?.expCurve.base;
  }

  it("취소 discards the edited base value", () => {
    const before = storedBase();
    openExpDialog();
    commitInput(byTestId("db-class-exp-base"), "999");
    byTestId("db-class-exp-cancel").click();
    expect(storedBase()).toBe(before);
  });

  it("OK commits and the sheet summary rerenders immediately", () => {
    const { host } = openExpDialog();
    commitInput(byTestId("db-class-exp-base"), "999");
    byTestId("db-class-exp-close").click();
    expect(storedBase()).toBe(999);
    const summary = findByTestId(host, "db-class-exp-summary");
    expect(summary?.textContent).toContain("기본=999");
  });

  it("다음 레벨까지 tab switches the table to per-level deltas", () => {
    openExpDialog();
    const dialog = byTestId("db-class-exp-dialog");
    const before = dialog.querySelector(".db-class-exp-table")?.textContent ?? "";
    const deltaTab = byTestId("db-class-exp-tab-delta");
    deltaTab.dispatchEvent(new Event("click"));
    const after = dialog.querySelector(".db-class-exp-table")?.textContent ?? "";
    expect(after).not.toBe(before);
    expect(deltaTab.classList.contains("active")).toBe(true);
    // 최고 레벨(99)은 "다음 레벨"이 없으므로 - 로 표시.
    expect(after).toContain("L99: -");
    byTestId("db-class-exp-tab-total").dispatchEvent(new Event("click"));
    const restored = dialog.querySelector(".db-class-exp-table")?.textContent ?? "";
    expect(restored).toBe(before);
  });
});

describe("actor curve dialogs draft + self-refreshing summaries (P7 + qa-actors)", () => {
  function actor(): ReturnType<typeof store.getCurrent>["database"]["actors"][number] {
    const found = store.getCurrent().database.actors[0];
    if (!found) throw new Error("expected default actor");
    return found;
  }

  it("취소 discards actor parameter edits, OK commits them", () => {
    const record = actor();
    const cards = actorCurveCards(record);
    const maxHpCard = cards[0];
    if (!(maxHpCard instanceof FakeElement)) throw new Error("expected fake card");
    const before = store.getCurrent().database.actors[0]?.parameterCurves.maxHp[0];

    maxHpCard.dispatchEvent(new Event("click"));
    commitInput(byTestId("db-actor-parameter-value"), "4321");
    byTestId("db-actor-parameter-cancel").click();
    expect(store.getCurrent().database.actors[0]?.parameterCurves.maxHp[0]).toBe(before);

    maxHpCard.dispatchEvent(new Event("click"));
    commitInput(byTestId("db-actor-parameter-value"), "4321");
    byTestId("db-actor-parameter-close").click();
    expect(store.getCurrent().database.actors[0]?.parameterCurves.maxHp[0]).toBe(4321);
    // 커밋 후 카드 요약이 즉시 갱신된다(P7 요약 미갱신 회귀 방지).
    expect(maxHpCard.textContent).toContain("4321");
  });

  it("actor exp dialog OK updates the panel summary immediately, 취소 discards", () => {
    const record = actor();
    const panelChildren = actorExperiencePanel(record);
    const row = panelChildren[0];
    if (!(row instanceof FakeElement)) throw new Error("expected fake row");
    const edit = findByTestId(row, "db-actor-exp-edit");
    if (!edit) throw new Error("missing exp edit button");
    const beforeBase = store.getCurrent().database.actors[0]?.expCurve.base;

    edit.dispatchEvent(new Event("click"));
    commitInput(byTestId("db-actor-exp-base"), "500");
    byTestId("db-actor-exp-cancel").click();
    expect(store.getCurrent().database.actors[0]?.expCurve.base).toBe(beforeBase);

    edit.dispatchEvent(new Event("click"));
    commitInput(byTestId("db-actor-exp-base"), "500");
    byTestId("db-actor-exp-close").click();
    expect(store.getCurrent().database.actors[0]?.expCurve.base).toBe(500);
    const summary = findByTestId(row, "db-actor-exp-summary");
    expect(summary?.textContent).toContain("기본=500");
  });
});
