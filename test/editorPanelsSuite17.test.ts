import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classicEnemyFormation, enemyBattlers } from "@/battle/battleBattlers";
import { monsterSpeciesReferenceMessage, databaseReferenceMessage } from "@/editor/databaseReferences";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { kindOfBattleEventCondition } from "@/editor/panels/databaseTroopBattleEventConditions";
import { updateTroopBattleEventPage } from "@/editor/panels/databaseTroopBattleEventActions";
import { createBlankProject } from "@/project/defaults";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";
import { monsterEvolutionCycleSpeciesIds, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { store } from "@/project/store";
import type { MonsterSpeciesRecord, TroopRecord } from "@/project/types";
import { findByTestId, installFakeDom, FakeElement } from "./fakeDom";
import { numberField } from "@/editor/panels/databaseControls";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderCropTab } from "@/editor/panels/databaseCropView";
import { actorCurveCards, actorExperiencePanel } from "@/editor/panels/actorRecordCurveEditors";
import { classCurveCards } from "@/editor/panels/databaseClassCurveEditors";
import { renderExperienceCurvePanel } from "@/editor/panels/databaseClassExperienceCurveEditor";
import { updateDatabaseRecord, addDatabaseRecord } from "@/editor/databaseActions";
import { el } from "@/util/dom";
import { createDatabaseModalDirtySession } from "@/editor/panels/databaseModalDirtySession";
import { isolateTimers } from "./mergedTeardown";

describe("databaseCollectionTabsHardening", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function species(patch: Partial<MonsterSpeciesRecord> & Pick<MonsterSpeciesRecord, "id" | "name">): MonsterSpeciesRecord {
    return normalizeMonsterSpeciesRecord(patch);
  }
  function firstEnemyForm(): { form: FakeElement; enemyId: string } {
    const enemy = store.getCurrent().database.enemies[0];
    if (!enemy) throw new Error("enemy fixture missing");
    const form = new FakeElement("div");
    renderEnemyRecordForm(form as unknown as HTMLElement, enemy);
    return { form, enemyId: enemy.id };
  }
  function setNumber(form: FakeElement, testid: string, value: string): FakeElement {
    const input = findByTestId(form, testid);
    if (!input) throw new Error(`missing field ${testid}`);
    input.value = value;
    input.dispatchEvent(new Event("input"));
    return input;
  }
  describe("F1 포획률 스케일 마이그레이션", () => {
    it("0~100 스케일로 저작된 값을 0~1로 이관하고 이미 0~1인 값은 그대로 둔다", () => {
      expect(species({ id: "a", name: "a", captureRate: 40 }).captureRate).toBe(0.4);
      expect(species({ id: "a", name: "a", captureRate: 0.4 }).captureRate).toBe(0.4);
    });

    it("출하 기본 종족이 1.0으로 뭉개지지 않는다", () => {
      const records = defaultBattleRecords().monsterSpecies ?? [];
      expect(records.length).toBeGreaterThan(0);
      for (const record of records) {
        expect(record.captureRate).toBeLessThanOrEqual(1);
        expect(record.captureRate).toBeLessThan(1);
      }
    });
  });
  describe("F2 적 그룹 좌표", () => {
    it("에디터가 만든 좌표가 런타임에서 재배치되지 않는다", () => {
      const project = store.getCurrent();
      const enemyId = project.database.enemies[0]?.id;
      if (!enemyId) throw new Error("enemy fixture missing");
      const members = [0, 1, 2, 3].map((index) => ({ enemyId, ...classicEnemyFormation(index), hidden: false }));
      for (const member of members) expect(member.x).toBeLessThanOrEqual(150);
      const troop: TroopRecord = {
        ...project.database.troops[0]!,
        members,
        enemyIds: members.map((member) => member.enemyId),
      };
      const battlers = enemyBattlers(project, troop);
      battlers.forEach((battler, index) => {
        expect(battler.battleX).toBe(members[index]!.x);
        expect(battler.battleY).toBe(members[index]!.y);
      });
    });
  });
  describe("F3 전투 이벤트 조건 편집", () => {
    it("첫 조건을 편집해도 추가 조건이 살아 있다", () => {
      const troopId = store.getCurrent().database.troops[0]!.id;
      store.update((project) => {
        const troop = project.database.troops.find((entry) => entry.id === troopId)!;
        troop.battleEventPages = [
          {
            id: "page-1",
            name: "테스트",
            span: "battle",
            conditions: [
              { kind: "turn", start: 1, interval: 1 },
              { kind: "switch", switchId: "0001", value: true },
            ],
            commands: [],
          },
        ];
      });
      const troop = store.getCurrent().database.troops.find((entry) => entry.id === troopId)!;
      const page = troop.battleEventPages[0]!;
      const stored = page.conditions;
      updateTroopBattleEventPage(troop, page, { conditions: [{ kind: "turn", start: 3, interval: 1 }, ...stored.slice(1)] });
      const after = store.getCurrent().database.troops.find((entry) => entry.id === troopId)!.battleEventPages[0]!;
      expect(after.conditions).toHaveLength(2);
      expect(after.conditions[1]?.kind).toBe("switch");
    });

    it("전용 폼이 없는 조건 종류는 undefined 를 반환해 편집을 잠근다", () => {
      expect(kindOfBattleEventCondition({ kind: "selfSwitch", switchId: "A", value: true } as never)).toBeUndefined();
      expect(kindOfBattleEventCondition({ kind: "turn", start: 1, interval: 1 })).toBe("turn");
      expect(kindOfBattleEventCondition(undefined)).toBe("none");
    });
  });
  describe("F4/F6 적 숫자 필드", () => {
    it("레벨 입력이 화면값과 저장값 모두 99로 클램프된다", () => {
      const { form, enemyId } = firstEnemyForm();
      const input = setNumber(form, "db-field-enemy-level", "120");
      expect(input.value).toBe("99");
      expect(store.getCurrent().database.enemies.find((entry) => entry.id === enemyId)?.level).toBe(99);
    });

    it("드롭률 입력이 화면에서 100으로 클램프된다", () => {
      const { form } = firstEnemyForm();
      expect(setNumber(form, "db-field-enemy-drop-rate", "500").value).toBe("100");
    });
  });
  describe("F9 공격 패턴 표", () => {
    it("행동이 0개면 유령 행 대신 빈 상태를 보여주고, 행 추가가 실제 행동을 만든다", () => {
      const enemy = store.getCurrent().database.enemies[0]!;
      store.update((project) => {
        const target = project.database.enemies.find((entry) => entry.id === enemy.id)!;
        target.actions = [];
      });
      const live = store.getCurrent().database.enemies.find((entry) => entry.id === enemy.id)!;
      const form = new FakeElement("div");
      renderEnemyRecordForm(form as unknown as HTMLElement, live);
      expect(findByTestId(form, "db-enemy-actions-empty")).toBeTruthy();
      expect(findByTestId(form, "db-enemy-action-row-0")).toBeFalsy();
      findByTestId(form, "db-enemy-action-add")?.click();
      expect(store.getCurrent().database.enemies.find((entry) => entry.id === enemy.id)?.actions).toHaveLength(1);
    });
  });
  describe("F5 진화 사이클", () => {
    it("A→B→A 를 사이클로 검출하고 검증 이슈를 낸다", () => {
      const a = species({ id: "sp_a", name: "A", evolutions: [{ toSpeciesId: "sp_b", requires: { level: 5 } }] });
      const b = species({ id: "sp_b", name: "B", evolutions: [{ toSpeciesId: "sp_a", requires: { level: 9 } }] });
      expect(monsterEvolutionCycleSpeciesIds([a, b])).toEqual(["sp_a", "sp_b"]);
      store.update((project) => {
        project.database.monsterSpecies = [a, b];
      });
      const issues = collectProjectReferenceIssues(store.getCurrent());
      expect(issues.filter((issue) => issue.includes("사이클"))).toHaveLength(1);
    });
  });
  describe("F16 종족 삭제 가드", () => {
    it("giveMonster 명령이 참조하는 종족은 삭제 가드에 걸린다", () => {
      store.update((project) => {
        project.database.monsterSpecies = [species({ id: "sp_a", name: "A" })];
        project.commonEvents = [
          { id: "ce_1", name: "테스트", trigger: "none", commands: [{ kind: "giveMonster", speciesId: "sp_a", level: 5 }] } as never,
        ];
      });
      expect(monsterSpeciesReferenceMessage("sp_a")).not.toBeUndefined();
      expect(monsterSpeciesReferenceMessage("sp_a")).not.toBeNull();
    });

    it("다른 종족의 진화 대상이면 삭제 가드에 걸린다", () => {
      store.update((project) => {
        project.database.monsterSpecies = [
          species({ id: "sp_a", name: "A", evolutions: [{ toSpeciesId: "sp_b", requires: { level: 5 } }] }),
          species({ id: "sp_b", name: "B" }),
        ];
      });
      expect(monsterSpeciesReferenceMessage("sp_b")).toContain("진화");
    });
  });
});

describe("databaseControlsNumberField", () => {
  isolateTimers();
  // P4: numberField 가 클램프 후 input.value 를 되쓰지 않아(percentField 와 패턴 불일치)
  // 화면과 저장값이 어긋나던 결함 회귀 방지. blur(change) 시 표시가 반드시 정규화돼야 한다.
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function renderNumberField(
    value: number,
    bounds?: { min: number; max: number }
  ): { input: FakeElement; committed: number[] } {
    const committed: number[] = [];
    const field = numberField("테스트", "test-number-field", value, (next) => committed.push(next), bounds);
    const input = (field as unknown as FakeElement).querySelector("input");
    if (!input) throw new Error("numberField 가 input 을 렌더하지 않음");
    return { input, committed };
  }
  describe("numberField bounds clamp + display write-back (P4)", () => {
    it("clamps over-max input immediately and rewrites the visible value", () => {
      const { input, committed } = renderNumberField(50, { min: 0, max: 100 });
      input.value = "500000";
      input.dispatchEvent(new Event("input"));
      expect(committed.at(-1)).toBe(100);
      expect(input.value).toBe("100");
    });

    it("clamps under-min input and rewrites the visible value", () => {
      const { input, committed } = renderNumberField(50, { min: 0, max: 100 });
      input.value = "-50";
      input.dispatchEvent(new Event("input"));
      expect(committed.at(-1)).toBe(0);
      expect(input.value).toBe("0");
    });

    it("normalizes the display on blur(change) — cleared field shows the clamped floor", () => {
      const { input, committed } = renderNumberField(50, { min: 1, max: 99 });
      input.value = "";
      input.dispatchEvent(new Event("input"));
      input.dispatchEvent(new Event("change"));
      expect(input.value).toBe("1");
      expect(committed.at(-1)).toBe(1);
    });

    it("sets min/max attributes when bounds are provided", () => {
      const { input } = renderNumberField(5, { min: 0, max: 100 });
      expect(input.getAttribute("min")).toBe("0");
      expect(input.getAttribute("max")).toBe("100");
    });

    it("without bounds keeps raw commits but still normalizes NaN display on blur", () => {
      const { input, committed } = renderNumberField(5);
      input.value = "1234";
      input.dispatchEvent(new Event("input"));
      expect(committed.at(-1)).toBe(1234);
      expect(input.value).toBe("1234");
      input.value = "";
      input.dispatchEvent(new Event("change"));
      expect(input.value).toBe("0");
    });

    it("does not rewrite the field while typing an in-range value (no cursor jump)", () => {
      const { input } = renderNumberField(5, { min: 0, max: 100 });
      input.value = "42";
      input.dispatchEvent(new Event("input"));
      expect(input.value).toBe("42");
    });

    it("keeps a leading minus so a signed value can be typed (skill priority, backdrop scroll)", () => {
      const committed: number[] = [];
      const field = numberField("우선도", "test-number-field", 0, (next) => committed.push(next), { min: -7, max: 7 });
      const input = (field as unknown as FakeElement).querySelector("input");
      if (!input) throw new Error("numberField 가 input 을 렌더하지 않음");
      input.value = "-";
      input.dispatchEvent(new Event("input"));
      expect(committed).toEqual([]);
      expect(input.value).toBe("-");
      input.value = "-2";
      input.dispatchEvent(new Event("input"));
      expect(committed.at(-1)).toBe(-2);
      expect(input.value).toBe("-2");
    });

    it("keeps a trailing decimal and an equivalent spelling while a fraction is typed", () => {
      const committed: number[] = [];
      const field = numberField("배율", "test-number-field", 1, (next) => committed.push(next), { min: 0, max: 10, step: 0.05 });
      const input = (field as unknown as FakeElement).querySelector("input");
      if (!input) throw new Error("numberField 가 input 을 렌더하지 않음");
      input.value = "1.";
      input.dispatchEvent(new Event("input"));
      expect(committed).toEqual([]);
      expect(input.value).toBe("1.");
      input.value = "1.0";
      input.dispatchEvent(new Event("input"));
      expect(committed.at(-1)).toBe(1);
      expect(input.value).toBe("1.0");
      input.value = "1.05";
      input.dispatchEvent(new Event("input"));
      expect(committed.at(-1)).toBe(1.05);
      expect(input.value).toBe("1.05");
    });

    it("resolves a lone minus to the floor when the field blurs", () => {
      const committed: number[] = [];
      const field = numberField("우선도", "test-number-field", 1, (next) => committed.push(next), { min: -7, max: 7 });
      const input = (field as unknown as FakeElement).querySelector("input");
      if (!input) throw new Error("numberField 가 input 을 렌더하지 않음");
      input.value = "-";
      input.dispatchEvent(new Event("change"));
      expect(input.value).toBe("-7");
      expect(committed.at(-1)).toBe(-7);
    });
  });
});

describe("databaseCropView", () => {
  isolateTimers();
  let previousWindow: typeof globalThis.window | undefined;
  function stubWindowTimers(): void {
    previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        setTimeout: (handler: TimerHandler): number => {
          if (typeof handler === "function") handler();
          return 0;
        },
        clearTimeout,
      },
    });
  }
  function restoreWindow(): void {
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
  function renderUtility(render: (host: HTMLElement, rerender: () => void) => void): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      render(host as unknown as HTMLElement, rerender);
    };
    rerender();
    return host;
  }
  describe("database crop view", () => {
    let cleanupDom: (() => void) | undefined;

    beforeEach(() => {
      cleanupDom = installFakeDom();
      stubWindowTimers();
      store.replace(createBlankProject());
      resetMapEditHistory();
    });

    afterEach(() => {
      cleanupDom?.();
      cleanupDom = undefined;
      restoreWindow();
    });

    // fix(db): 계절 체크박스를 전부 해제하면 normalizeCropRecord가 데이터를 "봄"으로 강제
    // 복원하지만 화면(체크박스)은 갱신되지 않아 사용자가 "어느 계절에도 안 자란다"고
    // 착각했다(qa-items-report.md). rerender를 배선해 화면이 실제 저장값을 반영해야 한다.
    it("re-renders the season checkboxes after unchecking all seasons forces a spring restore", () => {
      const host = renderUtility(renderCropTab);
      findByTestId(host, "db-crop-add")?.click();

      const spring = findByTestId(host, "db-crop-season-spring");
      if (!spring) throw new Error("missing spring checkbox");
      expect(spring.checked).toBe(true);

      spring.checked = false;
      spring.dispatchEvent(new Event("input"));

      const cropId = store.getCurrent().database.crops?.[0]?.id;
      expect(store.getCurrent().database.crops?.find((crop) => crop.id === cropId)?.seasons).toEqual(["spring"]);
      // the DOM must reflect the forced restore, not the just-unchecked state
      const springAfter = findByTestId(host, "db-crop-season-spring");
      expect(springAfter?.checked).toBe(true);
    });

    it("adds an undo snapshot before add/delete and duplicate creates a name with the 사본 suffix", () => {
      const host = renderUtility(renderCropTab);
      expect(getMapEditHistoryState().canUndo).toBe(false);

      findByTestId(host, "db-crop-add")?.click();
      expect(getMapEditHistoryState().canUndo).toBe(true);
      const cropId = store.getCurrent().database.crops?.[0]?.id;
      expect(cropId).toBeTruthy();

      findByTestId(host, "db-crop-duplicate")?.click();
      const crops = store.getCurrent().database.crops ?? [];
      expect(crops).toHaveLength(2);
      expect(crops[1]?.name).toBe("새 작물 사본");
    });

    it("requires a second click within the confirm window before deleting a crop", () => {
      const host = renderUtility(renderCropTab);
      findByTestId(host, "db-crop-add")?.click();
      expect(store.getCurrent().database.crops).toHaveLength(1);

      const deleteButton = findByTestId(host, "db-crop-delete");
      if (!deleteButton) throw new Error("missing delete button");

      deleteButton.click();
      expect(deleteButton.textContent).toBe("정말 삭제?");
      expect(store.getCurrent().database.crops).toHaveLength(1);

      deleteButton.click();
      expect(store.getCurrent().database.crops).toHaveLength(0);

      const undone = undoMapEdit();
      expect(undone).toBe(true);
      expect(store.getCurrent().database.crops).toHaveLength(1);
    });

    // Break caught: an empty crop catalog falls back to a blank detail pane with no first action.
    it("offers a first-crop action in the empty state and opens the created record", () => {
      const host = renderUtility(renderCropTab);
      expect(findByTestId(host, "db-crop-empty")).toBeTruthy();

      findByTestId(host, "db-crop-empty-add")?.click();

      expect(store.getCurrent().database.crops).toHaveLength(1);
      expect(findByTestId(host, "db-crop-name")).toBeTruthy();
      // AI 입구는 자료집 머리줄 「말로 고치기」 하나다(impl-database PR-B) — 레코드마다 따로 붙지 않는다.
      expect(findByTestId(host, "small-task-open")).toBeNull();
    });

    // Break caught: the crop tab exposes raw fields but not whether time/farmable-map wiring is ready.
    it("shows farming readiness and a derived crop loop summary", () => {
      const host = renderUtility(renderCropTab);
      expect(findByTestId(host, "db-crop-readiness-time")?.dataset.state).toBe("needs-setup");
      expect(findByTestId(host, "db-crop-readiness-fields")?.dataset.state).toBe("needs-setup");

      findByTestId(host, "db-crop-add")?.click();
      const cropId = store.getCurrent().database.crops?.[0]?.id;
      if (!cropId) throw new Error("missing added crop");
      store.update((project) => {
        project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
        project.maps[project.startMapId].farmableArea = [{ x: 1, y: 1, w: 3, h: 2 }];
        const crop = project.database.crops?.find((entry) => entry.id === cropId);
        if (!crop) return;
        crop.stages = [{ days: 2 }, { days: 3 }];
        crop.harvestCount = 4;
        crop.seasons = ["spring", "summer"];
        crop.regrow = { days: 2 };
      });

      const readyHost = renderUtility(renderCropTab);
      expect(findByTestId(readyHost, "db-crop-readiness-time")?.dataset.state).toBe("ready");
      expect(findByTestId(readyHost, "db-crop-readiness-fields")?.dataset.state).toBe("ready");
      expect(findByTestId(readyHost, "db-crop-overview-growth")?.dataset.days).toBe("5");
      expect(findByTestId(readyHost, "db-crop-overview-yield")?.dataset.count).toBe("4");
      expect(findByTestId(readyHost, "db-crop-overview-seasons")?.dataset.count).toBe("2");
      expect(findByTestId(readyHost, "db-crop-overview-regrow")?.dataset.days).toBe("2");
    });

    // Break caught: broken seed/harvest links are only visible after opening each record by hand.
    it("reports unusable crop records and exposes direct repair actions", () => {
      store.update((project) => {
        project.database.crops = [{
          id: "crop_broken",
          name: "끊긴 작물",
          seedItemId: "missing_seed",
          harvestItemId: "missing_harvest",
          harvestCount: 1,
          stages: [{ days: 1 }],
          seasons: ["spring"],
        }];
      });

      const host = renderUtility(renderCropTab);
      expect(findByTestId(host, "db-crop-readiness-records")?.dataset.invalid).toBe("1");
      expect(findByTestId(host, "db-crop-readiness-records")?.dataset.state).toBe("needs-setup");
      expect(findByTestId(host, "db-crop-readiness-time-action")).toBeTruthy();
      expect(findByTestId(host, "db-crop-readiness-fields-action")).toBeTruthy();
      expect(findByTestId(host, "db-crop-readiness-tools-action")).toBeTruthy();
      expect(findByTestId(host, "db-crop-readiness-records-action")).toBeTruthy();
    });
  });
});

describe("databaseCurveDialogDraft", () => {
  isolateTimers();
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
      const refresh = (): void =>
        renderExperienceCurvePanel(
          {
            testidPrefix: "db-class-exp",
            dialogLabel: "경험치 곡선 설정",
            readCurve: () => store.getCurrent().database.classes.find((entry) => entry.id === record.id)?.expCurve ?? record.expCurve,
            onCommit: (expCurve) => updateDatabaseRecord("classes", record.id, { expCurve }),
            refresh,
          },
          host as unknown as HTMLElement
        );
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
});

describe("databaseDeleteGuardCommandCoverage", () => {
  isolateTimers();
  /**
   * 2026-09-19 리뷰 P0-6: 삭제 가드(databaseReferences)와 로드 검증기
   * (commandReferenceValidation)의 커버리지가 어긋나 있었다. 가드가 놓친 참조를 지우면
   * **경고 0건으로 저장**되고, 다음 로드에서 validateProjectReferences 가 하드 실패해
   * 프로젝트 전체가 열리지 않는다.
   *
   * 이 파일의 계약: "로드 검증기가 하드 실패로 다루는 참조는 삭제 가드도 반드시 막는다."
   * 검증기에 assert 를 추가할 때 이 테스트가 같이 깨져야 커버리지가 다시 갈라지지 않는다.
   */
  describe("삭제 가드는 로드 검증기와 같은 명령 참조를 본다", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
      resetMapEditHistory();
    });

    function addCommonEvent(commands: unknown[]): void {
      store.update((project) => {
        project.commonEvents.push({
          id: "ce_guard_probe",
          name: "가드 프로브",
          trigger: "none",
          commands: commands as never,
        } as never);
      });
    }

    /** 새 레코드는 기본 프로젝트의 다른 참조(시작 파티·기본 애니메이션 등)에 안 걸린다. */
    function freshRecordId(collection: Parameters<typeof addDatabaseRecord>[0]): string {
      const id = addDatabaseRecord(collection);
      expect(databaseReferenceMessage(collection, id)).toBeNull();
      return id;
    }

    it("showAnimation 만 참조하는 전투 애니메이션의 삭제를 막는다", () => {
      const animationId = freshRecordId("battleAnimations");

      addCommonEvent([{ kind: "showAnimation", target: "player", animationId, wait: true }]);

      expect(databaseReferenceMessage("battleAnimations", animationId)).toContain("가드 프로브");
    });

    it("enterHeroName 만 참조하는 주인공의 삭제를 막는다", () => {
      const actorId = freshRecordId("actors");

      addCommonEvent([{ kind: "enterHeroName", actorId, maxLength: 8, showInitialName: true, currentName: "" }]);

      expect(databaseReferenceMessage("actors", actorId)).toContain("가드 프로브");
    });

    it("addFollower 만 참조하는 주인공의 삭제를 막는다", () => {
      const actorId = freshRecordId("actors");

      addCommonEvent([{ kind: "addFollower", actorId }]);

      expect(databaseReferenceMessage("actors", actorId)).toContain("가드 프로브");
    });

    it("promoteActor 의 toClassId 만 참조하는 직업의 삭제를 막는다", () => {
      const classId = freshRecordId("classes");
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";

      addCommonEvent([{ kind: "promoteActor", actorId, toClassId: classId }]);

      expect(databaseReferenceMessage("classes", classId)).toContain("가드 프로브");
    });

    it("equipTool 만 참조하는 아이템의 삭제를 막는다", () => {
      const itemId = freshRecordId("items");

      addCommonEvent([{ kind: "equipTool", itemId }]);

      expect(databaseReferenceMessage("items", itemId)).toContain("가드 프로브");
    });

    it("stateRates 로만 참조되는 상태의 삭제를 막는다", () => {
      const stateId = freshRecordId("states");

      store.update((project) => {
        project.database.actors[0]!.stateRates[stateId] = "weak" as never;
      });

      expect(databaseReferenceMessage("states", stateId)).toContain("주인공");
    });

    // 가드가 막아 준 덕분에 저장본이 로드 가능한 상태로 남는다는 반대편 증거.
    it("가드가 막은 참조를 무시하고 지우면 로드 검증기가 실패한다(가드가 필요한 이유)", () => {
      const animationId = freshRecordId("battleAnimations");
      addCommonEvent([{ kind: "showAnimation", target: "player", animationId, wait: true }]);

      store.update((project) => {
        project.database.battleAnimations = project.database.battleAnimations.filter((record) => record.id !== animationId);
      });

      const issues = collectProjectReferenceIssues(store.getCurrent());
      expect(issues.join("\n")).toContain(animationId);
    });
  });
  /**
   * 2026-09-19 리뷰 P0-7: 되돌리기 범위가 프로젝트 전체여서, 도크 모드로 맵을 칠한 뒤 DB 를
   * 되돌리면 맵 편집까지 사라졌다. 프롬프트 문구가 약속하는 범위(=DB)로 좁혔다.
   */
  describe("DB 되돌리기는 맵을 건드리지 않는다", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
      resetMapEditHistory();
    });

    function firstMapId(): string {
      return Object.keys(store.getCurrent().maps)[0] ?? "";
    }

    it("맵만 바뀐 경우 dirty 로 보지 않는다", () => {
      const mapId = firstMapId();
      const dirtySession = createDatabaseModalDirtySession();

      store.update((project) => {
        project.maps[mapId]!.name = "도크로 고친 맵 이름";
      });

      expect(dirtySession.isDirty()).toBe(false);
    });

    it("되돌리기가 세션 중의 맵 편집을 살려 둔다", () => {
      const mapId = firstMapId();
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      const originalActorName = store.getCurrent().database.actors[0]?.name ?? "";
      const dirtySession = createDatabaseModalDirtySession();

      // 도크 모드의 정상 흐름: DB 를 고치면서 맵도 함께 칠한다.
      store.update((project) => {
        project.database.actors.find((record) => record.id === actorId)!.name = "버릴 이름";
        project.maps[mapId]!.name = "지켜야 할 맵 이름";
      });
      expect(dirtySession.isDirty()).toBe(true);

      dirtySession.discard();

      expect(store.getCurrent().database.actors[0]?.name).toBe(originalActorName);
      expect(store.getCurrent().maps[mapId]?.name).toBe("지켜야 할 맵 이름");
    });
  });
});
