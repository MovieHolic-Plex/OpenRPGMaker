import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderCropTab } from "@/editor/panels/databaseCropView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, FakeElement } from "./fakeDom";
import { actorCurveCards, actorExperiencePanel } from "@/editor/panels/actorRecordCurveEditors";
import { classCurveCards } from "@/editor/panels/databaseClassCurveEditors";
import { renderExperienceCurvePanel } from "@/editor/panels/databaseClassExperienceCurveEditor";
import { updateDatabaseRecord, addDatabaseRecord } from "@/editor/databaseActions";
import { el } from "@/util/dom";
import { databaseReferenceMessage } from "@/editor/databaseReferences";
import { createDatabaseModalDirtySession } from "@/editor/panels/databaseModalDirtySession";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { isolateTimers } from "./mergedTeardown";

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
