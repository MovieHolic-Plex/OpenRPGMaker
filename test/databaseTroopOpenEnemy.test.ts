import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDatabaseActiveTab, setDatabaseActiveTab } from "@/editor/panels/database";
import { renderTroopRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import { resetRecordViewSessionState, selectedRecordIdForSession } from "@/editor/panels/databaseRecordViewSession";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

// 적 그룹 인스펙터의 몬스터 열기 링크 — enemy view "종족 열기"의 거울 패턴
// (setSelectedRecordId + switchDatabaseActiveTab). troops[0]의 enemy_slime은
// records[0] 폴백과 동일해서 setSelectedRecordId 누락을 못 잡으므로 non-first
// 적(enemy_meadow_slime)을 쓰는 troop_slime_pair로 구동하고, 탭 전환까지 단언한다.
describe("database troop record view — open enemy link", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
    resetRecordViewSessionState();
    setDatabaseActiveTab("troops");
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  function troopSlimePair() {
    const troop = store.getCurrent().database.troops.find((entry) => entry.id === "troop_slime_pair");
    if (!troop) throw new Error("missing troop_slime_pair");
    const memberEnemyId = troop.members?.[0]?.enemyId;
    if (memberEnemyId !== "enemy_meadow_slime") throw new Error(`expected non-first enemy, got ${memberEnemyId}`);
    return { troop, memberEnemyId };
  }

  function mountInDatabaseBody(form: FakeElement): void {
    const root = document.createElement("div") as unknown as FakeElement;
    root.className = "database-modal-body";
    const body = document.createElement("div") as unknown as FakeElement;
    body.className = "db-body";
    body.append(form);
    root.append(body);
    (document.body as unknown as FakeElement).append(root);
  }

  it("renders an open-enemy button naming the selected slot enemy", () => {
    const { troop } = troopSlimePair();
    const enemy = store.getCurrent().database.enemies.find((entry) => entry.id === "enemy_meadow_slime");
    if (!enemy) throw new Error("missing enemy_meadow_slime");

    const form = document.createElement("section");
    renderTroopRecordForm(form, troop, () => {});

    const button = findByTestId(form as unknown as FakeElement, "db-troop-open-enemy");
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain(enemy.name);
  });

  it("clicking the button selects the slot enemy and switches to the monster tab", () => {
    const { troop, memberEnemyId } = troopSlimePair();
    const form = document.createElement("section") as unknown as FakeElement;
    mountInDatabaseBody(form);
    renderTroopRecordForm(form as unknown as HTMLElement, troop, () => {});

    const button = findByTestId(form, "db-troop-open-enemy");
    expect(button).not.toBeNull();
    button?.click();

    expect(selectedRecordIdForSession("enemies")).toBe(memberEnemyId);
    expect(getDatabaseActiveTab()).toBe("enemies");
  });
});
