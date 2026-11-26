// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { validateEventDraftBody, validateEventDraft } from "@/editor/eventDraftValidator";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, GameEvent, EventPage, MapId } from "@/project/types";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { shortArmLabel } from "@/editor/panels/eventEditor/scriptLines";
import { renderStoryboard, renderViewToggle } from "@/editor/panels/eventEditor/storyboardView";
import { branchesOf, simulatePageCommands } from "@/editor/panels/eventEditor/previewSimulation";
import { commandBranches } from "@/editor/tools/commandTraversal";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { commandLabel, openEventCommandPicker } from "@/editor/panels/eventEditor/commandPicker";
import { isolateTimers } from "./mergedTeardown";
import { createDefaultGameEvent, addEvent } from "@/editor/eventActions";
import { editorState } from "@/editor/editorState";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { resetModalStackForTest, modalStackEntryCountForTest } from "@/editor/ui/modalStack";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { renderEventPageFlow, renderEventPagePreview } from "@/editor/panels/eventEditor/eventScriptModernViews";
import { readEventSurfaceCss } from "./helpers/eventSurfaceCss";
import { renderClassicPageTabStrip, renderPageActions } from "@/editor/panels/eventEditor/pageProps";
import { openPageTabContextMenu } from "@/editor/panels/eventEditor/pageTabContextMenu";
import { pageTabDropIndex } from "@/editor/panels/eventEditor/pageTabDragDrop";
import { addEventPage, clearCopiedEventPage, copyEventPageToClipboard } from "@/editor/eventPages";

describe("eventBattleAdmission", () => {
  isolateTimers();
  type BattleCommand = Extract<Command, { kind: "battleProcessing" }>;
  const previous = store.getCurrent();
  let project = createBlankProject();
  beforeEach(() => { project = createBlankProject(); store.replaceProject(project); });
  afterEach(() => { document.body.replaceChildren(); store.replaceProject(previous); });
  function control(id: string): HTMLElement {
    const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!node) throw new Error(`Missing control ${id}`);
    return node;
  }
  function select(id: string, value: string): void {
    const node = control(id);
    if (!(node instanceof HTMLSelectElement)) throw new Error(`Not a select ${id}`);
    node.value = value; node.dispatchEvent(new Event("change"));
  }
  function command(): BattleCommand {
    return { kind: "battleProcessing", troopId: "", canEscape: true, canLose: false,
      victoryBranch: [{ kind: "setFlag", flag: "kept", value: true }] };
  }
  function troop() {
    const record = project.database.troops[0];
    if (!record) throw new Error("Missing fixture troop");
    return record;
  }
  describe("native battle confirmation admission", () => {
    it.each(["empty", "missing", "empty-members", "variable-empty", "variable-missing"])("retains the draft when %s is confirmed and allows corrected authoring", kind => {
      // Given an incomplete command and a separate valid troop for correction.
      const initial = command();
      const validId = troop().id;
      if (kind === "missing") initial.troopId = "removed-troop";
      if (kind === "empty-members") {
        project.database.troops.push({ ...troop(), id: "empty", members: [], enemyIds: [] });
        initial.troopId = "empty";
      }
      if (kind.startsWith("variable")) {
        initial.troopSource = "variable"; initial.troopVariableId = kind === "variable-empty" ? "" : "removed-variable";
      }
      const apply = vi.fn();
      openEventCommandEditDialog({ initial, onApply: apply });
      const dialog = control("event-command-edit-dialog");
      control("battle-processing-preset-boss").click();
      // When confirming invalid input, no command is committed or discarded.
      control("event-command-edit-ok").click();
      expect(apply).not.toHaveBeenCalled();
      expect(control("event-command-edit-dialog")).toBe(dialog);
      const warning = control("battle-processing-warning");
      expect(warning.hidden).toBe(false);
      expect(warning.textContent?.trim().length).toBeGreaterThan(0);
      // Correct the same mounted draft; prior rule and branch edits survive.
      select("battle-processing-troop-source", "fixed");
      select("battle-processing-troop-select", validId);
      control("event-command-edit-ok").click();
      expect(apply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        troopId: validId, canEscape: false, battleFlow: "strict", victoryBranch: initial.victoryBranch,
      }));
      expect(dialog.isConnected).toBe(false);
    });

    it("revalidates a troop removed while the dialog is open", () => {
      const apply = vi.fn();
      openEventCommandEditDialog({ initial: { ...command(), troopId: troop().id }, onApply: apply });
      project.database.troops = [];
      control("event-command-edit-ok").click();
      expect(apply).not.toHaveBeenCalled();
      expect(control("battle-processing-warning").hidden).toBe(false);
    });

    it("accepts a selected variable without treating the unused fixed reference as required", () => {
      const variable = project.variables[0];
      if (!variable) throw new Error("Missing fixture variable");
      const initial = { ...command(), troopSource: "variable", troopVariableId: variable.id } as const;
      const apply = vi.fn();
      openEventCommandEditDialog({ initial, onApply: apply });
      control("event-command-edit-ok").click();
      expect(apply).toHaveBeenCalledExactlyOnceWith(initial);
    });

    it.each(["hidden", "legacy"])("accepts legitimate %s composition", kind => {
      if (kind === "hidden") troop().members = troop().enemyIds.map(enemyId => ({ enemyId, hidden: true, x: 20, y: 20 }));
      else troop().members = [];
      const apply = vi.fn();
      openEventCommandEditDialog({ initial: { ...command(), troopId: troop().id }, onApply: apply });
      control("event-command-edit-ok").click();
      expect(apply).toHaveBeenCalledTimes(1);
    });

    it("blocks aggregate event Apply for a troop whose effective composition is empty", () => {
      troop().members = []; troop().enemyIds = [];
      const event: GameEvent = { id: "admission", x: 1, y: 1, trigger: { kind: "action" },
        commands: [], pages: [{ id: "battle-page", name: "Battle", conditions: [], graphic: {},
          trigger: { kind: "action" }, priority: "below", movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [{ ...command(), troopId: troop().id }] }] };
      const result = validateEventDraftBody(project, project.startMapId, event);
      expect(result.canCommit).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({ code: "battle.troop.empty", severity: "error", commandPath: [0] }));
    });
  });
});

describe("eventCommand", () => {
  isolateTimers();
  //
  // 분기 열거의 정본이 하나임을 못박는 계약 테스트.
  //
  // 회귀 배경(실측 2026-08-31): 같은 일을 하는 분기 열거 함수가 다섯 벌 있었고 그중 셋이
  // 상점 실패 분기(`failedTransactionBranch`)를 빠뜨렸다. 런타임(`player/interpreter/resume.ts`)
  // 은 그 분기를 실행하는데 목록·플로우·미리보기에는 줄이 안 났고, 검증도 그 안으로 들어가지
  // 않았다 — 화면에 없는 분기는 모르고 지워진다. 라벨도 뷰마다 갈려 같은 분기가 «참» /
  // «참일 때» / «조건이 맞을 때» / «조건을 만족함» 네 이름으로 불렸다.
  describe("eventCommandBranchesSingleSource", () => {
    isolateTimers();
    const SUCCESS = "거래 감사합니다!";
    const FAILURE = "돈이 모자라시군요.";
    function shopWithBothBranches(): Command {
      return {
        kind: "shop",
        itemIds: [],
        allowSell: true,
        branchOnTransaction: true,
        transactionBranch: [{ kind: "text", body: SUCCESS }],
        branchOnFailedTransaction: true,
        failedTransactionBranch: [{ kind: "text", body: FAILURE }],
      } as Command;
    }
    function textOf(node: HTMLElement): string {
      return node.textContent ?? "";
    }
    /** 목록 뷰는 host 에 그려 넣는다. 액션은 이 테스트에서 쓰지 않으므로 빈 껍데기를 넘긴다. */
    function listHostFor(commands: Command[]): HTMLElement {
      const host = document.createElement("div");
      renderCommandList(host, commands, [], {} as never);
      return host;
    }
    describe("상점 실패 분기는 모든 뷰에 나온다", () => {
      it("정본이 성공·실패 두 분기를 라벨과 경로 칸까지 준다", () => {
        const branches = eventCommandBranches(shopWithBothBranches());
        expect(branches.map((branch) => branch.kind)).toEqual(["shopTransaction", "shopFailure"]);
        expect(branches.map((branch) => branch.label)).toEqual(["거래했을 때", "거래하지 못했을 때"]);
        // -1 / -12 는 `eventCommandPaths` 가 정한 분기 인덱스다. 목록 뷰는 예전에 -12 를
        // import 조차 하지 않아 이 분기를 주소로 가리킬 수 없었다.
        expect(branches.map((branch) => branch.branchIndex)).toEqual([-1, -12]);
      });

      it("목록 뷰가 실패 분기 줄과 그 안의 명령을 찍는다", () => {
        const host = listHostFor([shopWithBothBranches()]);
        const text = textOf(host);
        expect(text).toContain("거래했을 때");
        expect(text).toContain(SUCCESS);
        expect(text).toContain("거래하지 못했을 때");
        expect(text).toContain(FAILURE);
        expect(host.querySelector("[data-container-path='[0,-12]']")).not.toBeNull();
      });

      it("스토리 뷰가 실패 분기를 해결 가능한 경로로 찍는다", () => {
        const host = renderStoryboard([shopWithBothBranches()]);
        expect(textOf(host)).toContain(FAILURE);
        expect(host.querySelector<HTMLElement>("[data-cmd-path='[0,-12,0]']")?.textContent).toContain(FAILURE);
      });

      it("미리보기 스텝에 실패 분기 대사가 들어간다", () => {
        const steps = simulatePageCommands([shopWithBothBranches()]).steps;
        const bodies = steps.map((step) => (step.command.kind === "text" ? step.command.body : ""));
        expect(bodies).toContain(SUCCESS);
        expect(bodies).toContain(FAILURE);
        const failureStep = steps.find((step) => step.command.kind === "text" && step.command.body === FAILURE);
        expect(failureStep?.branchLabel).toBe("거래하지 못했을 때");
      });

      it("플로우가 쓰는 어댑터와 프로젝트 순회 어댑터도 두 분기를 본다", () => {
        expect(branchesOf(shopWithBothBranches()).map((branch) => branch.label))
          .toEqual(["거래했을 때", "거래하지 못했을 때"]);
        expect(commandBranches(shopWithBothBranches()).map((branch) => branch.kind))
          .toEqual(["shopTransaction", "shopFailure"]);
      });
    });
    describe("분기 라벨은 뷰마다 갈리지 않는다", () => {
      const fork: Command = {
        kind: "fork",
        condition: { kind: "switch", switchId: "0001", value: true },
        then: [{ kind: "text", body: "참 쪽" }],
        else: [{ kind: "text", body: "거짓 쪽" }],
      };

      it("조건 분기는 네 뷰 모두 같은 이름을 쓴다", () => {
        const canonical = eventCommandBranches(fork).map((branch) => branch.label);
        expect(canonical).toEqual(["조건이 맞을 때", "조건이 맞지 않을 때"]);

        // 플로우 어댑터
        expect(branchesOf(fork).map((branch) => branch.label)).toEqual(canonical);
        // 목록 뷰 — d885889d6e 부터 목록만 정본 라벨을 짧게 말한다(「그러면」/「아니면」).
        // 그래도 정본 라벨에서 한 함수(shortArmLabel)로 파생되므로 뷰마다 갈리지 않는다.
        const list = textOf(listHostFor([fork]));
        expect(canonical.map(shortArmLabel)).toEqual(["그러면", "아니면"]);
        for (const label of canonical) expect(list).toContain(shortArmLabel(label));
        // 스토리 뷰
        const storyboard = textOf(renderStoryboard([fork]));
        for (const label of canonical) expect(storyboard).toContain(label);
        // 미리보기 스텝 라벨
        const labels = simulatePageCommands([fork]).steps.map((step) => step.branchLabel).filter(Boolean);
        expect(new Set(labels)).toEqual(new Set(canonical));
      });

      it("빈 배열도 저작 대상이라 분기로 센다", () => {
        // `commandBranches` 로 빈 분기를 찾아 명령을 밀어 넣는 호출부가 있다(AI 병합 경로).
        const emptyShop = { kind: "shop", itemIds: [], failedTransactionBranch: [] } as Command;
        expect(eventCommandBranches(emptyShop).map((branch) => branch.kind)).toEqual(["shopFailure"]);
      });
    });
  });
  describe("eventCommandDragOwnership", () => {
    isolateTimers();
    const MIME = "application/x-oprn-event-command-path";
    const commands = [{ kind: "text" as const, body: "A" }, { kind: "text" as const, body: "B" }];
    const actions = (): CommandListActions => ({
      addCommand: vi.fn(), insertCommand: vi.fn(), replaceCommand: vi.fn(),
      deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn(),
    });
    function dragEvent(type: string, types = [MIME], payload = "[0]"): Event {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", {
        value: { types, getData: () => payload, setData: vi.fn() },
      });
      return event;
    }
    function startDrag(host: HTMLElement): HTMLElement {
      const item = host.querySelector<HTMLElement>(".cmd-item")!;
      item.querySelector(".cmd-drag-handle")!.dispatchEvent(new Event("pointerdown"));
      item.dispatchEvent(dragEvent("dragstart"));
      return item;
    }
    function mount(callbacks: CommandListActions): HTMLElement {
      const host = document.createElement("div");
      document.body.append(host);
      renderCommandList(host, commands, [], callbacks);
      return host;
    }
    afterEach(() => {
      document.querySelectorAll(".cmd-item").forEach(item => item.dispatchEvent(new Event("dragend")));
      document.body.replaceChildren();
    });
    describe("event command drag ownership", () => {
      it("ignores plain text and unowned command payloads", () => {
        const callbacks = actions();
        const host = mount(callbacks);
        host.dispatchEvent(dragEvent("drop", ["text/plain"]));
        host.dispatchEvent(dragEvent("drop"));
        expect(callbacks.moveCommandTo).not.toHaveBeenCalled();
      });

      it("rejects commands dragged from another editor and altered payloads", () => {
        const first = mount(actions());
        const callbacks = actions();
        const second = mount(callbacks);
        startDrag(first);
        second.dispatchEvent(dragEvent("drop"));
        startDrag(second);
        second.dispatchEvent(dragEvent("drop", [MIME], "[1]"));
        expect(callbacks.moveCommandTo).not.toHaveBeenCalled();
      });

      it("uses current callbacks after reusing a list host and rejects the old drag", () => {
        const oldActions = actions();
        const currentActions = actions();
        const host = mount(oldActions);
        const oldSource = startDrag(host);
        renderCommandList(host, commands, [], currentActions);
        host.dispatchEvent(dragEvent("drop"));
        expect(oldActions.moveCommandTo).not.toHaveBeenCalled();
        expect(currentActions.moveCommandTo).not.toHaveBeenCalled();
        oldSource.dispatchEvent(new Event("dragend"));
        startDrag(host);
        host.dispatchEvent(dragEvent("drop"));
        expect(oldActions.moveCommandTo).not.toHaveBeenCalled();
        expect(currentActions.moveCommandTo).toHaveBeenCalledExactlyOnceWith([0], Number.MAX_SAFE_INTEGER);
      });
    });
  });
  describe("eventCommandPickerAudio", () => {
    isolateTimers();
    describe("event command picker audio intent", () => {
      afterEach(() => {
        document.body.replaceChildren();
      });

      it.each([
        ["BGM 재생...", true],
        ["SE 재생...", false],
      ] as const)("preserves the channel selected by %s", (label, loop) => {
        let selected: Command | null = null;
        openEventCommandPicker({
          title: "이벤트 명령",
          context: "map",
          onSelect: (command) => {
            selected = command;
          },
        });

        const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".event-command-picker-command"))
          .find((candidate) => candidate.getAttribute("aria-label") === label);
        expect(button, `${label} command button`).toBeDefined();
        button?.click();

        expect(selected).toEqual({ kind: "playAudio", resourceId: "", loop });
      });

      it("uses a channel-neutral edit-dialog label", () => {
        expect(commandLabel("playAudio")).toBe("소리 재생");
      });
    });
  });
});

describe("eventDraftProjectionIntegration", () => {
  isolateTimers();
  let mapId: string;
  const eventId = "projection-integration";
  function control(id: string): HTMLElement {
    const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!node) throw new Error(`Missing ${id}`);
    return node;
  }
  beforeEach(() => {
    resetModalStackForTest();
    const project = createBlankProject();
    mapId = project.startMapId;
    const event = createDefaultGameEvent(2, 2);
    event.id = eventId;
    event.characterId = "alice";
    project.characters = { alice: { displayName: "Before" } };
    const map = project.maps[mapId];
    if (!map) throw new Error("Missing map");
    map.events = [event];
    store.replaceProject(project);
    editorState.set({ currentMapId: mapId, selectedEventId: eventId, selectedEventPageId: event.pages?.[0]?.id ?? null });
    openEventEditorModal(mapId, eventId);
    resetMapEditHistory();
  });
  afterEach(() => {
    document.querySelector('[data-testid="event-editor-modal"]')?.dispatchEvent(new CustomEvent("oprn:event-editor-close"));
    document.body.replaceChildren();
    resetModalStackForTest();
    resetMapEditHistory();
  });
  it("renders the staged name in the NPC rail without changing canonical profiles", () => {
    // Given: a mounted editor linked to an existing profile.
    const input = control("event-character-display-name-input");
    if (!(input instanceof HTMLInputElement)) throw new Error("Expected name input");
    // When: the actual name control stages an edit.
    input.value = "Staged name";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    // Then: rail and working input agree while canonical data stays isolated.
    expect(control("evt-rail-meta-npc").textContent).toBe("Staged name");
    expect(projectWithoutEventDrafts(store.getCurrent()).characters?.alice?.displayName).toBe("Before");
  });
  it("validates a newly staged switch and commits it through parent Apply", () => {
    // Given: the actual field-template dialog over the event editor.
    control("event-command-toolbar-field-monster").click();
    const input = control("field-monster-template-clear-switch");
    if (!(input instanceof HTMLInputElement)) throw new Error("Expected switch input");
    input.value = "projection_new_switch";
    control("field-monster-template-apply").click();
    const before = store.getCurrent();
    expect(before.switches.some(entry => entry.id === "projection_new_switch")).toBe(false);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    // When: parent validation consumes the same transaction that Apply will commit.
    expect(validateEventDraft(before, mapId, eventId).canCommit).toBe(true);
    control("event-editor-apply").click();
    // Then: the switch and template pages commit atomically, not a fatal-reference refusal.
    const canonical = projectWithoutEventDrafts(store.getCurrent());
    expect(canonical.switches.some(entry => entry.id === "projection_new_switch")).toBe(true);
    expect(canonical.maps[mapId]?.events.find(entry => entry.id === eventId)?.pages).toHaveLength(2);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
  });
});

//
// 플로우가 «미리보기 위에 겹치는 팝오버» 에서 «네 번째 보기 방식» 으로 승격된 계약.
//
// 회귀 배경(실측 2026-08-31): 플로우는 도구 팝오버 안 `<details>` 아코디언이었고
// 618×280 으로 묶여 있었다. 1440px 높이 화면에서도 280px 만 써서 최상위 명령 7개 중
// 2개만 보였고, 무엇보다 미리보기 **위에** 절대 배치로 떠서 「자동 재생」 버튼과 단계
// 카운터를 덮었다. 겹쳐 뜨는 동안에도 미리보기가 몇 번째 단계인지 알려주지 않아
// 두 화면이 서로 남남이었다.
//
// 여기서 못박는 것:
//  1) 플로우는 `<details>` 팝오버가 아니다 (겹칠 오버레이가 없다)
//  2) 보기 방식 세그먼트에 네 번째 버튼으로 있고, 미리보기와 배타적이다
//  3) 미리보기가 보던 단계를 **경로로** 짚는다 — 인덱스로 짚으면 `breakLoop` 에서 어긋난다
describe("eventPageFlowView", () => {
  isolateTimers();
  const PAGE_BASE: Omit<EventPage, "commands"> = {
    id: "pg_flow",
    name: "테스트",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
  };
  function pageWith(commands: Command[]): EventPage {
    return { ...PAGE_BASE, commands };
  }
  /** 분기 안쪽에 명령이 있는 페이지 — 경로가 여러 칸인 단계를 만든다. */
  function branchingPage(): EventPage {
    return pageWith([
      { kind: "text", body: "첫 줄" },
      {
        kind: "fork",
        condition: { kind: "switch", switchId: "", value: true },
        then: [{ kind: "text", body: "참 쪽" }],
        else: [{ kind: "text", body: "거짓 쪽" }],
      },
      { kind: "text", body: "마지막 줄" },
    ] as Command[]);
  }
  function flowFor(page: EventPage, opts?: { onSelect?: (path: number[]) => void }): HTMLElement {
    store.replace(createBlankProject());
    return renderEventPageFlow({ mapId: "map_start", eventId: "ev_flow", page, ...opts });
  }
  describe("플로우 보기 승격", () => {
    it("팝오버 details 가 아니라 칼럼을 쓰는 section 이다", () => {
      const flow = flowFor(branchingPage());
      expect(flow.tagName.toLowerCase()).toBe("section");
      expect(flow.querySelector("details")).toBeNull();
      expect(flow.querySelector("[data-testid='event-script-flowchart']")).toBeNull();
      expect(flow.dataset.testid).toBe("event-page-flow");
    });

    it("보기 방식 세그먼트의 네 번째 버튼이고 미리보기와 배타적이다", () => {
      const bar = renderViewToggle("flow", () => {});
      const labels = Array.from(bar.querySelectorAll("button")).map((btn) => btn.textContent);
      expect(labels).toEqual(["목록", "스토리", "미리보기", "플로우"]);
      const flowBtn = bar.querySelector("[data-testid='event-view-toggle-flow']");
      const previewBtn = bar.querySelector("[data-testid='event-view-toggle-preview']");
      expect(flowBtn?.getAttribute("aria-selected")).toBe("true");
      expect(previewBtn?.getAttribute("aria-selected")).toBe("false");
    });

    it("미리보기를 한 번도 열지 않았으면 강조하지 않고, 안내만 보여준다", () => {
      const flow = flowFor(pageWith([{ kind: "text", body: "혼자" }] as Command[]));
      expect(flow.querySelectorAll(".event-flow-node.is-current").length).toBe(0);
      expect(flow.querySelector("[data-testid='event-page-flow-current']")?.textContent)
        .toContain("미리보기에서 보던 단계");
    });

    it("미리보기가 보던 단계를 이어받아 그 노드를 짚는다", () => {
      const page = branchingPage();
      store.replace(createBlankProject());
      // 미리보기를 열고 「다음」을 세 번 눌러 참 쪽 분기 안(경로 [1,-2,0])까지 간다.
      const preview = renderEventPagePreview({ mapId: "map_start", eventId: "ev_flow", page });
      const next = preview.querySelector<HTMLElement>("[data-testid='event-script-live-next']");
      if (!next) throw new Error("미리보기 「다음」 버튼을 찾지 못했다");
      next.click();
      next.click();

      const steps = simulatePageCommands(page.commands, "ev_flow").steps;
      const expectedPath = steps[2]?.path;
      expect(expectedPath).toEqual([1, -2, 0]);

      const flow = renderEventPageFlow({ mapId: "map_start", eventId: "ev_flow", page });
      const current = flow.querySelectorAll<HTMLElement>(".event-flow-node.is-current");
      expect(current.length).toBe(1);
      expect(current[0]?.dataset.cmdPath).toBe(JSON.stringify(expectedPath));
      expect(current[0]?.getAttribute("aria-current")).toBe("step");
      expect(flow.querySelector("[data-testid='event-page-flow-current']")?.textContent)
        .toBe(`미리보기 현재 단계 3/${steps.length}`);
    });

    it("노드를 누르면 목록·스토리와 같은 편집 경로를 넘긴다", () => {
      const picked: number[][] = [];
      const flow = flowFor(branchingPage(), { onSelect: (path) => picked.push(path) });
      const nodes = flow.querySelectorAll<HTMLElement>(".event-flow-node");
      // 순차 명령 3개 + 분기 안 2개 = 5개 노드.
      expect(nodes.length).toBe(5);
      nodes[2]?.click();
      expect(picked).toEqual([[1, -2, 0]]);
    });

    it("`breakLoop` 이 뒤 명령을 끊어도 단계 경로는 어긋나지 않는다", () => {
      // 인덱스로 짝지으면 여기서 깨진다: 단계는 breakLoop 에서 멈추지만 플로우는 뒤 노드도 그린다.
      const page = pageWith([
        {
          kind: "loop",
          body: [
            { kind: "breakLoop" },
            { kind: "text", body: "닿지 않는 줄" },
          ],
        },
        { kind: "text", body: "반복 다음" },
      ] as Command[]);
      store.replace(createBlankProject());
      const steps = simulatePageCommands(page.commands, "ev_flow").steps;
      // 단계: loop, breakLoop, (뒤 텍스트는 걷지 않음), 반복 다음
      expect(steps.map((step) => step.command.kind)).toEqual(["loop", "breakLoop", "text"]);
      expect(steps.map((step) => step.path)).toEqual([[0], [0, -5, 0], [1]]);

      const flow = flowFor(page);
      // 플로우는 닿지 않는 줄까지 그리므로 노드는 4개 — 단계 수(3)와 다르다.
      const paths = Array.from(flow.querySelectorAll<HTMLElement>(".event-flow-node"))
        .map((node) => node.dataset.cmdPath);
      expect(paths).toEqual([
        JSON.stringify([0]),
        JSON.stringify([0, -5, 0]),
        JSON.stringify([0, -5, 1]),
        JSON.stringify([1]),
      ]);
      expect(paths.length).not.toBe(steps.length);
    });
  });
});

// test/eventPageManagementSurface.test.ts
//
// 이벤트 편집기 「페이지 관리」 작업면 계약. 2026-08-30 적대적 리뷰가 실측한 결함을 잡는다:
//
//   D1 헤더 이름 상자가 활성 페이지를 따라가지 않고, 고치면 **다른 페이지**가 바뀌었다.
//   D2 복사·삭제가 모달 오른쪽 끝(x=1514) 접힌 details 안에 있어 화면에 없었다.
//   D3 페이지 복제(`copyEventPage`)가 UI 에서 도달 불가였다.
//   D4 페이지 순서 이동(`moveEventPage`)이 UI 에서 도달 불가였다 — 순서가 런타임 우선순위다.
//   D5 붙여넣기·삭제가 조건부 마운트라 버튼이 나타났다 사라졌다.
//   D7 탭 우클릭 메뉴가 없었다(명령 목록에는 있다).
//   D8 role=tab 에 aria-pressed 를 함께 쓰고, tabindex·방향키가 없었다.
describe("eventPageManagementSurface", () => {
  isolateTimers();
  let mapId: MapId;
  let eventId: string;
  beforeEach(() => {
    resetModalStackForTest();
    clearCopiedEventPage();
    store.replace(createBlankProject());
    mapId = store.getCurrent().startMapId;
    eventId = addEvent(mapId, 3, 3);
    document.body.replaceChildren();
  });
  function currentEvent(): GameEvent {
    const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
    if (!event) throw new Error("event missing");
    return event;
  }
  function pages(): readonly EventPage[] {
    return currentEvent().pages ?? [];
  }
  function actions(activeIndex = 0): HTMLElement {
    const event = currentEvent();
    const page = (event.pages ?? [])[activeIndex];
    if (!page) throw new Error(`page ${activeIndex} missing`);
    const host = document.createElement("div");
    host.append(renderPageActions(mapId, event, page));
    document.body.append(host);
    return host;
  }
  function button(host: HTMLElement, testId: string): HTMLButtonElement {
    const node = host.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
    if (!node) throw new Error(`missing ${testId}`);
    return node;
  }
  describe("페이지 관리 작업면", () => {
    it("여섯 액션을 항상 마운트하고, 못 쓰는 것은 disabled + 이유를 말한다 (D2·D5)", () => {
      const host = actions();
      const ids = [
        "event-page-duplicate",
        "event-page-copy",
        "event-page-paste",
        "event-page-move-back",
        "event-page-move-forward",
        "event-page-delete",
      ];
      for (const id of ids) expect(button(host, id)).toBeTruthy();

      // 페이지 하나 · 클립보드 비었음 → 붙여넣기·순서·삭제는 못 쓴다.
      expect(button(host, "event-page-paste").disabled).toBe(true);
      expect(button(host, "event-page-paste").title).toContain("먼저 복사");
      expect(button(host, "event-page-delete").disabled).toBe(true);
      expect(button(host, "event-page-delete").title).toContain("하나뿐");
      expect(button(host, "event-page-move-back").disabled).toBe(true);
      expect(button(host, "event-page-move-forward").disabled).toBe(true);
      // 여섯 버튼은 ⋯ 메뉴 안에 있지만 항상 마운트된다. 닫힌 details 여도 .click() 은 동작한다.
      const menu = host.querySelector("details");
      expect(menu?.querySelector("summary")?.getAttribute("aria-label")).toBe("페이지 메뉴");
      expect(menu?.querySelectorAll("button")).toHaveLength(ids.length);
    });

    it("복제는 원본 바로 앞의 낮은 우선순위에 꽂는다 — 원본 뒤면 런타임 승자가 바뀐다 (D3)", () => {
      addEventPage(mapId, eventId);
      addEventPage(mapId, eventId);
      expect(pages()).toHaveLength(3);
      const sourceId = pages()[0]!.id;

      button(actions(0), "event-page-duplicate").click();

      const after = pages();
      expect(after).toHaveLength(4);
      expect(after[1]!.id).toBe(sourceId);
      expect(after[0]!.name).toBe(`${after[1]!.name} 복사본`);
    });

    it("순서 이동 버튼이 실제로 페이지를 옮기고 양 끝에서 막힌다 (D4)", () => {
      addEventPage(mapId, eventId);
      const [first, second] = [pages()[0]!.id, pages()[1]!.id];

      button(actions(1), "event-page-move-back").click();

      expect(pages().map((page) => page.id)).toEqual([second, first]);
      expect(button(actions(0), "event-page-move-back").disabled).toBe(true);
      expect(button(actions(1), "event-page-move-forward").disabled).toBe(true);
    });

    it("복사를 누르면 붙여넣기가 살아난다 (D5)", () => {
      const host = actions();
      expect(button(host, "event-page-paste").disabled).toBe(true);
      button(host, "event-page-copy").click();
      // 복사는 스토어를 바꾸지 않으므로 액션 줄이 스스로 자기를 다시 그린다.
      const refreshed = document.body.querySelector<HTMLElement>('[data-testid="event-page-tabs"]');
      expect(refreshed?.querySelector<HTMLButtonElement>('[data-testid="event-page-paste"]')?.disabled).toBe(false);
    });

    it("탭은 WAI-ARIA tablist 계약을 지킨다: aria-pressed 없음, roving tabindex (D8)", () => {
      addEventPage(mapId, eventId);
      const event = currentEvent();
      editorState.set({ selectedEventPageId: (event.pages ?? [])[1]!.id });
      const strip = renderClassicPageTabStrip(mapId, event, (event.pages ?? [])[1]!);

      const tabs = [...strip.querySelectorAll<HTMLElement>(".evt-page-segment")];
      expect(tabs).toHaveLength(2);
      for (const tab of tabs) expect(tab.getAttribute("aria-pressed")).toBeNull();
      expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["false", "true"]);
      expect(tabs.map((tab) => tab.getAttribute("tabindex"))).toEqual(["-1", "0"]);
    });

    it("방향키가 페이지 선택을 옮기고, Ctrl+방향키는 순서를 바꾼다 (D8)", () => {
      addEventPage(mapId, eventId);
      const event = currentEvent();
      const [first, second] = [(event.pages ?? [])[0]!.id, (event.pages ?? [])[1]!.id];
      editorState.set({ selectedEventPageId: first });
      const strip = renderClassicPageTabStrip(mapId, event, (event.pages ?? [])[0]!);
      document.body.append(strip);

      strip
        .querySelector<HTMLElement>('[data-testid="evt-page-segment-1"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(editorState.get().selectedEventPageId).toBe(second);

      strip
        .querySelector<HTMLElement>('[data-testid="evt-page-segment-1"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", ctrlKey: true, bubbles: true }));
      expect(pages().map((page) => page.id)).toEqual([second, first]);
    });

    it("실제 모달 구독 렌더 뒤에도 방향키와 Ctrl+방향키 포커스가 선택 페이지를 따른다", () => {
      addEventPage(mapId, eventId);
      editorState.set({ currentMapId: mapId, selectedEventId: eventId, selectedEventPageId: pages()[0]!.id });
      openEventEditorModal(mapId, eventId);
      const firstId = pages()[0]!.id;
      const secondId = pages()[1]!.id;
      const first = document.querySelector<HTMLElement>(`.evt-page-segment[data-page-id="${firstId}"]`)!;
      first.focus();

      first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(editorState.get().selectedEventPageId).toBe(secondId);
      expect((document.activeElement as HTMLElement).dataset.pageId).toBe(secondId);

      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowLeft", ctrlKey: true, bubbles: true,
      }));
      expect(pages().map((page) => page.id)).toEqual([secondId, firstId]);
      expect((document.activeElement as HTMLElement).dataset.pageId).toBe(secondId);
      expect((document.activeElement as HTMLElement).dataset.pageId).toBe(editorState.get().selectedEventPageId);
    });

    it("우클릭 메뉴의 붙여넣기는 선택이 아니라 **우클릭한** 페이지 바로 앞에 넣는다", () => {
      // 우클릭은 선택을 옮기지 않는다. 예전엔 붙여넣기가 editorState 의 활성 페이지로 자리를 잡아서,
      // 1페이지를 고른 상태에서 3페이지를 우클릭해 붙여넣으면 새 페이지가 index 0 에 꽂혔다.
      addEventPage(mapId, eventId);
      addEventPage(mapId, eventId);
      const [first, , third] = [pages()[0]!, pages()[1]!, pages()[2]!];
      expect(copyEventPageToClipboard(mapId, eventId, first.id)).toBe(true);
      editorState.set({ selectedEventPageId: first.id });

      openPageTabContextMenu({
        x: 20, y: 20, mapId, event: currentEvent(), page: third, index: 2, requestDelete: () => undefined,
      });
      document.querySelector<HTMLElement>('[data-testid="event-page-menu-paste"]')!.click();

      const after = pages();
      const pastedIndex = after.findIndex((page) => page.id === editorState.get().selectedEventPageId);
      expect(after.findIndex((page) => page.id === third.id)).toBe(3);
      expect(pastedIndex).toBe(2);
    });

    it("한 동작은 한 단어만 쓰고, 보이는 라벨이 접근성 이름에 들어 있다 (WCAG 2.5.3)", () => {
      const host = actions();
      const expected = [
        ["event-page-duplicate", "복제"],
        ["event-page-copy", "복사"],
        ["event-page-paste", "붙여넣기"],
        ["event-page-delete", "삭제"],
      ] as const;
      for (const [testId, label] of expected) {
        const node = button(host, testId);
        // 보이는 라벨은 진짜 텍스트 노드다 — `font-size:0` + `::after` 로 다른 말을 그리면 이 단언이 깨진다.
        expect(node.textContent, testId).toBe(label);
        expect(node.querySelector(".event-page-button-label")?.textContent, testId).toBe(label);
        expect(node.dataset.compactLabel, testId).toBeUndefined();
        expect(node.getAttribute("aria-label") ?? "", testId).toContain(label);
        // 비활성이여도 title 은 라벨을 되둥하지 않고 이유를 말한다.
        expect(node.getAttribute("title") ?? "", testId).not.toBe(label);
      }
    });

    it("좁은 포트 CSS 는 라벨을 지우고 다시 그리는 장치를 쓰지 않는다", () => {
      // 2026-09-11 Task 13: 페이지 버튼 규칙을 갖던 event-editor.balanced.css 는 구성 요소 버킷으로 흩어졌다 → 표면 전체를 본다.
      const css = readEventSurfaceCss();
      expect(css).not.toContain("attr(data-compact-label)");
      expect(css).not.toMatch(/\.event-page-button-label\s*\{[^}]*font-size:\s*0/u);
    });

    it("메뉴 복사는 선택을 옮기지 않는다 — 읽기 행위가 헤더·목록·버튼 대상을 끌고 가면 안 된다", () => {
      addEventPage(mapId, eventId);
      addEventPage(mapId, eventId);
      const [first, , third] = [pages()[0]!, pages()[1]!, pages()[2]!];
      editorState.set({ selectedEventPageId: first.id });

      openPageTabContextMenu({
        x: 12, y: 12, mapId, event: currentEvent(), page: third, index: 2, requestDelete: () => undefined,
      });
      document.querySelector<HTMLElement>('[data-testid="event-page-menu-copy"]')!.click();

      expect(editorState.get().selectedEventPageId).toBe(first.id);
    });

    it("이미 활성인 페이지를 메뉴로 복사해도 버튼 줄의 붙여넣기가 살아나고 안내도 바뀌다", () => {
      // 클립보드에 변경 통지가 없어서, 메뉴 복사 후에도 붙여넣기가 disabled + "먼저 복사를 누르세요"
      // 로 남았다 — 같은 화면의 성공 토스트와 정반대로 말하는 상태다.
      const host = actions(0);
      const active = pages()[0]!;
      editorState.set({ selectedEventPageId: active.id });
      expect(button(host, "event-page-paste").disabled).toBe(true);

      openPageTabContextMenu({
        x: 12, y: 12, mapId, event: currentEvent(), page: active, index: 0, requestDelete: () => undefined,
      });
      document.querySelector<HTMLElement>('[data-testid="event-page-menu-copy"]')!.click();

      const paste = document.body.querySelector<HTMLButtonElement>('[data-testid="event-page-paste"]')!;
      expect(paste.disabled).toBe(false);
      expect(paste.title).not.toContain("먼저 복사");
      expect(paste.title).toContain("앞");
    });

    it("탭 우클릭 메뉴가 여섯 항목을 주고 클립보드 상태를 반영한다 (D7)", () => {
      addEventPage(mapId, eventId);
      const event = currentEvent();
      const page = (event.pages ?? [])[0]!;
      openPageTabContextMenu({ x: 20, y: 20, mapId, event, page, index: 0, requestDelete: () => undefined });

      const menu = document.querySelector<HTMLElement>('[data-testid="event-page-context-menu"]');
      expect(menu).toBeTruthy();
      expect(menu!.getAttribute("role")).toBe("menu");
      expect([...menu!.querySelectorAll("[data-testid]")].map((node) => node.getAttribute("data-testid"))).toEqual([
        "event-page-menu-duplicate",
        "event-page-menu-copy",
        "event-page-menu-paste",
        "event-page-menu-move-back",
        "event-page-menu-move-forward",
        "event-page-menu-delete",
      ]);
      // 첫 페이지에서는 앞으로 옮기기와 빈 버퍼의 붙여넣기가 막혀 있다.
      expect(menu!.querySelector<HTMLButtonElement>('[data-testid="event-page-menu-move-back"]')!.disabled).toBe(true);
      expect(menu!.querySelector<HTMLButtonElement>('[data-testid="event-page-menu-paste"]')!.disabled).toBe(true);

      copyEventPageToClipboard(mapId, eventId, page.id);
      openPageTabContextMenu({ x: 20, y: 20, mapId, event, page, index: 0, requestDelete: () => undefined });
      const reopened = document.querySelector<HTMLElement>('[data-testid="event-page-context-menu"]');
      expect(reopened!.querySelector<HTMLButtonElement>('[data-testid="event-page-menu-paste"]')!.disabled).toBe(false);
    });

    it("우클릭 메뉴는 모달 스택 최상단을 잡는다 — Escape 가 이벤트 편집기까지 닫지 않도록", () => {
      const event = currentEvent();
      const page = (event.pages ?? [])[0]!;
      const before = modalStackEntryCountForTest();

      openPageTabContextMenu({ x: 10, y: 10, mapId, event, page, index: 0, requestDelete: () => undefined });
      expect(modalStackEntryCountForTest()).toBe(before + 1);

      document
        .querySelector<HTMLElement>('[data-testid="event-page-menu-duplicate"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(document.querySelector('[data-testid="event-page-context-menu"]')).toBeNull();
      expect(modalStackEntryCountForTest()).toBe(before);
    });

    it("우클릭 메뉴의 모든 닫기 경로가 리스너와 raw 모달 엔트리를 함께 치운다", () => {
      addEventPage(mapId, eventId);
      const event = currentEvent();
      const page = event.pages![0]!;
      const request = { x: 10, y: 10, mapId, event, page, index: 0, requestDelete: () => undefined };
      const baseline = modalStackEntryCountForTest();

      openPageTabContextMenu(request);
      openPageTabContextMenu(request);
      expect(document.querySelectorAll('[data-testid="event-page-context-menu"]')).toHaveLength(1);
      expect(modalStackEntryCountForTest()).toBe(baseline + 1);

      document.querySelector<HTMLElement>('[data-testid="event-page-menu-copy"]')!.click();
      expect(modalStackEntryCountForTest()).toBe(baseline);

      openPageTabContextMenu(request);
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(modalStackEntryCountForTest()).toBe(baseline);

      openPageTabContextMenu(request);
      document.querySelector<HTMLElement>('[data-testid="event-page-menu-duplicate"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(modalStackEntryCountForTest()).toBe(baseline);
    });

    it("페이지가 한 장이면 탭을 끌 수 없다", () => {
      const strip = renderClassicPageTabStrip(mapId, currentEvent(), pages()[0]!);
      const tab = strip.querySelector<HTMLElement>(".evt-page-segment[data-page-id]");
      expect(tab?.getAttribute("draggable")).toBe("false");
    });

    it("페이지가 두 장 이상이면 탭을 끌 수 있고, 복제 버튼은 브라우저 기본 드래그를 막는다", () => {
      addEventPage(mapId, eventId);
      const event = currentEvent();
      const strip = renderClassicPageTabStrip(mapId, event, (event.pages ?? [])[0]!);
      document.body.append(strip);
      const tabs = [...strip.querySelectorAll<HTMLElement>(".evt-page-segment[data-page-id]")];
      expect(tabs).toHaveLength(2);
      for (const tab of tabs) expect(tab.getAttribute("draggable")).toBe("true");
      expect(tabs[0]!.title).toContain("끌어다 놓아");

      const host = actions();
      const duplicate = button(host, "event-page-duplicate");
      expect(duplicate.getAttribute("draggable")).toBe("false");
      const drag = new Event("dragstart", { bubbles: true, cancelable: true });
      duplicate.dispatchEvent(drag);
      expect(drag.defaultPrevented).toBe(true);
    });

    it("탭 드롭은 소스 제거를 보정한 자리에 꽂는다", () => {
      expect(pageTabDropIndex(0, 2, false)).toBe(2);
      expect(pageTabDropIndex(2, 0, true)).toBe(0);
      expect(pageTabDropIndex(1, 1, false)).toBe(1);
    });

    it("탭을 다른 탭 위에 떨어뜨리면 페이지 순서가 바뀐다", () => {
      addEventPage(mapId, eventId);
      addEventPage(mapId, eventId);
      const [first, second, third] = pages();
      editorState.set({ selectedEventPageId: first!.id });
      const strip = renderClassicPageTabStrip(mapId, currentEvent(), first!);
      document.body.append(strip);
      const source = strip.querySelector<HTMLElement>(`[data-page-id="${first!.id}"]`)!;
      const target = strip.querySelector<HTMLElement>(`[data-page-id="${third!.id}"]`)!;
      target.getBoundingClientRect = () => ({
        x: 0, y: 0, top: 0, left: 0, right: 80, bottom: 28, width: 80, height: 28, toJSON: () => ({}),
      });

      source.dispatchEvent(new Event("dragstart", { bubbles: true }));
      target.dispatchEvent(new MouseEvent("drop", { bubbles: true, cancelable: true, clientX: 70 }));

      expect(pages().map((page) => page.id)).toEqual([second!.id, third!.id, first!.id]);
    });

    it("거부된 경계 이동은 성공 토스트를 만들지 않는다", () => {
      const host = actions();
      const target = button(host, "event-page-move-back");
      target.disabled = false;
      target.click();
      expect(document.querySelector('[data-testid="toast"]')).toBeNull();
    });
  });
});
