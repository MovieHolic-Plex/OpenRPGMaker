import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEnemyRecordForm, renderTroopRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom, findByTestId } from "./fakeDom";
import { getDatabaseActiveTab, setDatabaseActiveTab } from "@/editor/panels/database";
import { resetRecordViewSessionState, selectedRecordIdForSession } from "@/editor/panels/databaseRecordViewSession";
import { isolateTimers } from "./mergedTeardown";

describe("databaseEnemyResourceSlot", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    store.replace(project);
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function enemyWithMonsterResource(resourceId: string | undefined) {
    const project = store.getCurrent();
    const troop = project.database.troops[0]!;
    const enemyId = troop.members?.[0]?.enemyId ?? troop.enemyIds[0];
    const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
    if (!enemy) throw new Error("enemy fixture missing");
    enemy.monsterResourceId = resourceId;
    return enemy;
  }
  function previewButtons(form: FakeElement): FakeElement[] {
    return form.querySelectorAll("button").filter((node) => node.className.includes("db-resource-set-button"));
  }
  describe("몬스터 그래픽 미리보기 슬롯", () => {
    it("generated 리소스를 해석할 수 없으면 클릭 불가능한 정적 라벨을 보여준다 (데드 버튼 금지)", () => {
      const enemy = enemyWithMonsterResource("generated-nonexistent-sheet");
      const form = new FakeElement("div");
      renderEnemyRecordForm(form as unknown as HTMLElement, enemy);
      const dead = previewButtons(form);
      expect(dead.length, "리소스 선택 불가 컨텍스트에서 버튼을 렌더하면 안 된다").toBe(0);
      const text = form.textContent ?? "";
      expect(text).toContain("generated-nonexistent-sheet");
    });

    it("리소스가 없으면 (없음) 라벨만 보여준다", () => {
      const enemy = enemyWithMonsterResource(undefined);
      const form = new FakeElement("div");
      renderEnemyRecordForm(form as unknown as HTMLElement, enemy);
      expect(previewButtons(form).length).toBe(0);
      expect(form.textContent ?? "").toContain("(없음)");
    });
  });
});

describe("databaseTroopOpenEnemy", () => {
  isolateTimers();
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
});

describe("databaseTroopRecordViewNameSync", () => {
  isolateTimers();
  // fix(db): troops는 공용 nameField(onRename→updateRecordRowLabel) 경로 밖에 있어(자체
  // textField 사용) 이름을 타이핑해도 좌측 레코드 리스트 라벨이 갱신되지 않았다
  // (qa-troops-report.md m5). 리스트 행을 다른 파일이 만드는 실제 구조와 동일한
  // data-testid="db-record-row-<id>" + ".db-list-name"으로 흉내내 검증한다.
  describe("database troop record view — list row name sync", () => {
    let cleanupDom: (() => void) | undefined;

    beforeEach(() => {
      cleanupDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      cleanupDom?.();
      cleanupDom = undefined;
    });

    it("updates the left-side list row label while typing in the name field, without a full rerender", () => {
      const troop = store.getCurrent().database.troops[0];
      if (!troop) throw new Error("missing default troop");

      const row = document.createElement("button");
      row.dataset.testid = `db-record-row-${troop.id}`;
      const nameNode = document.createElement("span");
      nameNode.className = "db-list-name";
      nameNode.textContent = troop.name;
      row.append(nameNode);
      document.body.append(row);

      const form = document.createElement("section");
      let rerenderCalls = 0;
      renderTroopRecordForm(form, troop, () => {
        rerenderCalls += 1;
      });

      const nameInput = form.querySelector("[data-testid='db-field-name']") as (HTMLInputElement & { dispatchEvent: (event: Event) => boolean }) | null;
      if (!nameInput) throw new Error("missing name field");
      nameInput.value = "새 부대이름";
      nameInput.dispatchEvent(new Event("input"));

      expect(nameNode.textContent).toBe("새 부대이름");
      expect(store.getCurrent().database.troops.find((entry) => entry.id === troop.id)?.name).toBe("새 부대이름");
      // typing must not trigger a full rerender (that would drop focus mid-keystroke)
      expect(rerenderCalls).toBe(0);
    });
  });
});
