import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderTroopRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import { selectedRecordIdForSession } from "@/editor/panels/databaseRecordViewSession";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

// 적 그룹 인스펙터의 "몬스터 열기" 링크 — 선택 슬롯의 적을 enemies 탭 선택 상태로
// 지정한다. 거울 패턴: databaseEnemyRecordView 의 "종족 열기" 버튼과 동일하게
// setSelectedRecordId + switchDatabaseActiveTab.
describe("database troop record view — open enemy link", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  it("renders an open-enemy button naming the selected slot enemy", () => {
    const troop = store.getCurrent().database.troops[0];
    if (!troop) throw new Error("missing default troop");
    const memberEnemyId = troop.members?.[0]?.enemyId;
    if (!memberEnemyId) throw new Error("missing default troop member");
    const enemy = store.getCurrent().database.enemies.find((entry) => entry.id === memberEnemyId);
    if (!enemy) throw new Error("missing default enemy");

    const form = document.createElement("section");
    renderTroopRecordForm(form, troop, () => {});

    const button = findByTestId(form as unknown as FakeElement, "db-troop-open-enemy");
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain(enemy.name);
  });

  it("clicking the button selects the slot enemy in the enemies collection", () => {
    const troop = store.getCurrent().database.troops[0];
    if (!troop) throw new Error("missing default troop");
    const memberEnemyId = troop.members?.[0]?.enemyId;
    if (!memberEnemyId) throw new Error("missing default troop member");

    const panelRoot = document.createElement("div") as unknown as FakeElement;
    panelRoot.className = "database-modal-body";
    const form = document.createElement("section") as unknown as FakeElement;
    panelRoot.append(form);
    renderTroopRecordForm(form as unknown as HTMLElement, troop, () => {});

    const button = findByTestId(form, "db-troop-open-enemy");
    expect(button).not.toBeNull();
    button?.click();

    expect(selectedRecordIdForSession("enemies")).toBe(memberEnemyId);
  });
});
