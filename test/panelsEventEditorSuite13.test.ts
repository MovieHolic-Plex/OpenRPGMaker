import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { createBlankProject, DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, GameEvent, EventPage, EventPageCondition, NpcScheduleEntry, Project } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom, renderWithFakeDom, FakeElement } from "./fakeDom";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { startSession } from "@/project/session";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { editorState } from "@/editor/editorState";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { el } from "@/util/dom";
import { validateEventDraftBody, validateEventDraft } from "@/editor/eventDraftValidator";
import { renderNpcActivityCondition } from "@/editor/panels/eventEditor/conditionForm";
import { collectNpcActivitySuggestions } from "@/editor/panels/eventEditor/options";
import { isolateTimers } from "./mergedTeardown";

describe("commandBody", () => {
  isolateTimers();
  describe("changeBattleCommandsCommandBody", () => {
    isolateTimers();
    describe("Change Battle Commands modern form + runtime", () => {
      let restoreDom: (() => void) | undefined;
      let staged: Command;

      const actions: CommandListActions = {
        addCommand: () => undefined,
        insertCommand: () => undefined,
        deleteCommand: () => undefined,
        moveCommand: () => undefined,
        moveCommandTo: () => undefined,
        replaceCommand: (_path, command) => {
          staged = command;
        },
      };

      beforeEach(() => {
        restoreDom = installFakeDom();
        const project = createBlankProject();
        store.replace(project);
        staged = {
          kind: "m2Command",
          commandId: "m2-092-change-battle-commands",
          fields: { target: "party", operation: "add", value: "" },
        };
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("전용 폼: 대상/조작/커맨드/메뉴 프리뷰", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [0], actions, lockKind: true }, staged)
        );
        expect(findByTestId(body, "change-battle-commands-command-body")).toBeTruthy();
        expect(findByTestId(body, "change-battle-commands-target-mode")).toBeTruthy();
        expect(findByTestId(body, "change-battle-commands-operation")).toBeTruthy();
        expect(findByTestId(body, "change-battle-commands-command-select")).toBeTruthy();
        expect(findByTestId(body, "change-battle-commands-preview")).toBeTruthy();
      });

      it("조작/커맨드 저장", () => {
        const commandId = store.getCurrent().database.battleCommands?.[0]?.id
          ?? store.getCurrent().database.classes[0]?.battleCommands[0]?.id
          ?? "cmd_attack";
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [0], actions, lockKind: true }, staged)
        );
        const op = findByTestId(body, "change-battle-commands-operation") as unknown as HTMLSelectElement;
        op.value = "set";
        op.dispatchEvent(new Event("change"));
        const cmdSelect = findByTestId(body, "change-battle-commands-command-select") as unknown as HTMLSelectElement;
        cmdSelect.value = commandId;
        cmdSelect.dispatchEvent(new Event("change"));
        expect(staged.kind).toBe("m2Command");
        if (staged.kind !== "m2Command") return;
        expect(staged.fields.operation).toBe("set");
        expect(staged.fields.value).toBe(commandId);
      });

      it("런타임: 세션 오버라이드에 커맨드를 추가한다", () => {
        const project = store.getCurrent();
        const session = startSession(project);
        const actorId = session.partyActorIds[0] ?? project.database.actors[0]?.id ?? "actor_hero";
        const entry = m2CommandById("m2-092-change-battle-commands");
        expect(entry).toBeTruthy();
        if (!entry) return;
        executeM2RuntimeCommand(session, entry, {
          commandId: "m2-092-change-battle-commands",
          fields: { target: actorId, operation: "add", value: "cmd_item" },
        }, { project });
        expect(session.actorBattleCommands?.[actorId]).toContain("cmd_item");
        const menu = battleCommandsForActor(project, actorId, {
          overrideCommandIds: session.actorBattleCommands?.[actorId],
        });
        expect(menu.some((command) => command.id === "cmd_item" || command.kind === "item")).toBe(true);
      });
    });
  });
  describe("choicesCommandBody", () => {
    isolateTimers();
    const noopActions = {
      addCommand: () => undefined,
      deleteCommand: () => undefined,
      insertCommand: () => undefined,
      moveCommand: () => undefined,
      moveCommandTo: () => undefined,
      replaceCommand: () => undefined,
    };
    describe("choices command body", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("renders only active option rows (no ghost empty slots)", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [], actions: noopActions },
            {
              kind: "choices",
              prompt: "진행할까요?",
              options: [
                { text: "예", branch: [] },
                { text: "아니오", branch: [] },
              ],
              cancelBehavior: "choice2",
            } satisfies Command
          )
        );

        expect(findByTestId(body, "event-choice-option-1")).not.toBeNull();
        expect(findByTestId(body, "event-choice-option-2")).not.toBeNull();
        expect(findByTestId(body, "event-choice-option-3")).toBeNull();
        expect(findByTestId(body, "event-choice-option-4")).toBeNull();
        expect(findByTestId(body, "event-choice-option-5")).toBeNull();
        expect(findByTestId(body, "event-choice-add")).not.toBeNull();
        expect(findByTestId(body, "event-choice-cancel-choice1")).not.toBeNull();
        expect(findByTestId(body, "event-choice-cancel-choice2")).not.toBeNull();
        expect(findByTestId(body, "event-choice-cancel-choice3")).toBeNull();
        expect(findByTestId(body, "event-choice-remove-1")).not.toBeNull();
        expect(findByTestId(body, "event-choice-remove-2")).not.toBeNull();

        const optionRow = findByTestId(body, "event-choice-option-1")?.parentElement;
        expect(optionRow?.className).toContain("event-command-choice-row");
        expect(optionRow?.className).not.toContain("event-command-choice-row-prompt");

        const promptRow = findByTestId(body, "event-choice-prompt")?.parentElement;
        expect(promptRow?.className).toContain("event-command-choice-row-prompt");
      });

      it("is RM2003-style: texts + cancel only (no inline branch editors)", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [], actions: noopActions },
            {
              kind: "choices",
              options: [
                { text: "A", branch: [{ kind: "text", body: "hi" }] },
                { text: "B", branch: [] },
                { text: "C", branch: [] },
              ],
              cancelBehavior: "branch",
              cancelBranch: [{ kind: "text", body: "cancel" }],
            } satisfies Command
          )
        );

        // Branch editing stays in the main event command list, not this dialog.
        expect(findByTestId(body, "event-choice-branch-1")).toBeNull();
        expect(findByTestId(body, "event-choice-branch-add-1")).toBeNull();
        expect(findByTestId(body, "event-choice-cancel-branch-body")).toBeNull();
        expect(findByTestId(body, "event-choice-cancel-branch-add")).toBeNull();
        expect(findByTestId(body, "event-choice-delete-1")).toBeNull();
        expect(findByTestId(body, "event-choice-branch-list-note")).not.toBeNull();
      });

      it("uses short labels and omits long help paragraphs", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [], actions: noopActions },
            {
              kind: "choices",
              options: [
                { text: "예", branch: [] },
                { text: "아니오", branch: [] },
              ],
              cancelBehavior: "choice2",
            } satisfies Command
          )
        );

        const text = body.textContent ?? "";
        expect(text).not.toContain("플레이어가 취소");
        expect(text).not.toContain("오른쪽 미리보기");
        expect(text).not.toContain("접어서 편집");
        expect(text).not.toContain("응답 명령");
        expect(text).not.toContain("명령 추가");
        expect(text).toContain("왼쪽 목록에서 고칩니다");
        expect(findByTestId(body, "event-choice-cancel-disallow")).not.toBeNull();
        expect(findByTestId(body, "event-choice-add")?.textContent).toContain("추가");
      });
    });
  });
  describe("eraseEventCommandBody", () => {
    isolateTimers();
    describe("Erase Event command body", () => {
      let restoreDom: (() => void) | undefined;
      let replaced: Command | undefined;

      const actions: CommandListActions = {
        addCommand: () => {},
        insertCommand: () => {},
        replaceCommand: (_path, command) => {
          replaced = command;
        },
        deleteCommand: () => {},
        moveCommand: () => {},
        moveCommandTo: () => {},
      };

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
        replaced = undefined;
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("catalog entry has no fake map/x/y fields", () => {
        const entry = m2CommandById("m2-086-erase-event");
        expect(entry?.title).toBe("Erase Event");
        expect(entry?.fields ?? []).toEqual([]);
      });

      it("renders intent card and target picker without map/x/y", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [0], actions, lockKind: true },
            { kind: "m2Command", commandId: "m2-086-erase-event", fields: {} },
          )
        );
        expect(findByTestId(body, "m2-command-intent-card")).toBeTruthy();
        expect(body.textContent).toContain("플레이 중 이벤트 지우기");
        expect(body.textContent).toContain("에디터 맵에서 이벤트 오브젝트를 삭제하는 버튼이 아닙니다");
        expect(findByTestId(body, "m2-erase-event-target")).toBeTruthy();
        expect(findByTestId(body, "m2-erase-event-preview")).toBeTruthy();
        expect(body.textContent).not.toContain("맵 선택");
        expect(body.textContent).not.toMatch(/\bX\b.*0/);
      });

      it("writes eventId when target changes", () => {
        const project = store.getCurrent();
        const map = project.maps[project.startMapId];
        const eventId = map.events[0]?.id ?? "ev_test";
        if (!map.events[0]) {
          map.events.push({
            id: eventId,
            x: 1,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
          });
          store.replace(project);
        }

        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [0], actions, lockKind: true },
            { kind: "m2Command", commandId: "m2-086-erase-event", fields: {} },
          )
        );
        const select = findByTestId(body, "m2-erase-event-target") as FakeElement | null;
        expect(select).toBeTruthy();
        if (!select) return;
        select.value = eventId;
        select.dispatchEvent(new Event("change"));
        expect(replaced).toMatchObject({
          kind: "m2Command",
          commandId: "m2-086-erase-event",
          fields: { eventId },
        });
      });
    });
  });
  describe("forkCommandBody", () => {
    isolateTimers();
    describe("fork command body UX (RM rhythm)", () => {
      let restoreDom: (() => void) | undefined;
      let replaced: Command | undefined;

      const actions: CommandListActions = {
        addCommand: () => {},
        insertCommand: () => {},
        replaceCommand: (_path, command) => {
          replaced = command;
        },
        deleteCommand: () => {},
        moveCommand: () => {},
        moveCommandTo: () => {},
      };

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
        replaced = undefined;
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("renders condition-only dialog with else checkbox and list-editing hint", () => {
        const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [0], actions, lockKind: true },
            {
              kind: "fork",
              condition: { kind: "switch", switchId, value: true },
              then: [{ kind: "text", body: "열림" }],
            }
          )
        );

        expect(findByTestId(body, "event-command-fork-form")).toBeTruthy();
        expect(findByTestId(body, "event-condition-form")).toBeTruthy();
        expect(findByTestId(body, "event-condition-mode")).toBeTruthy();
        expect(body.textContent).toContain("조건 종류");
        expect(body.textContent).toContain("대상 스위치");
        expect(findByTestId(body, "event-fork-else-enabled")).toBeTruthy();
        expect(findByTestId(body, "event-fork-body-hint")?.textContent).toContain("왼쪽 목록");
        expect(findByTestId(body, "event-fork-summary-then")?.textContent).toContain("1개 명령");
        expect(findByTestId(body, "event-fork-summary-else")?.textContent).toContain("분기 없음");
        // No in-dialog then/else mini editors.
        expect(findByTestId(body, "event-fork-branch-then")).toBeFalsy();
        expect(findByTestId(body, "event-fork-branch-add-then")).toBeFalsy();
        expect(findByTestId(body, "event-condition-eval")).toBeTruthy();
      });

      it("toggles else branch via checkbox without body editors", () => {
        const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [0], actions, lockKind: true },
            {
              kind: "fork",
              condition: { kind: "switch", switchId, value: true },
              then: [],
            }
          )
        );
        const check = findByTestId(body, "event-fork-else-enabled") as FakeElement | null;
        expect(check).toBeTruthy();
        if (!check) return;
        check.checked = true;
        check.dispatchEvent(new Event("change"));
        expect(replaced).toMatchObject({
          kind: "fork",
          else: [],
        });
      });

      it("updates leaf condition through labeled controls", () => {
        const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [0], actions, lockKind: true },
            {
              kind: "fork",
              condition: { kind: "switch", switchId, value: true },
              then: [],
            }
          )
        );
        const state = findByTestId(body, "event-condition-switch-value") as FakeElement | null;
        expect(state).toBeTruthy();
        if (!state) return;
        state.value = "false";
        state.dispatchEvent(new Event("change"));
        expect(replaced).toMatchObject({
          kind: "fork",
          condition: { kind: "switch", switchId, value: false },
        });
      });

      it("can author all/any group conditions from mode select", () => {
        const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [0], actions, lockKind: true },
            {
              kind: "fork",
              condition: { kind: "switch", switchId, value: true },
              then: [],
            }
          )
        );
        const mode = findByTestId(body, "event-condition-mode") as FakeElement | null;
        expect(mode).toBeTruthy();
        if (!mode) return;
        mode.value = "all";
        mode.dispatchEvent(new Event("change"));
        expect(replaced).toMatchObject({
          kind: "fork",
          condition: { kind: "all" },
        });
      });

      function seedHostEvent(characterId?: string): void {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event: GameEvent = {
          id: "ev_fork_host",
          x: 0,
          y: 0,
          trigger: { kind: "action" },
          commands: [],
          pages: [],
          ...(characterId ? { characterId } : {}),
        };
        project.maps[mapId]!.events = [event];
        store.replace(project);
        editorState.set({ selectedEventId: event.id, currentMapId: mapId });
      }

      it("shows the always-false friendship hint on the fork form when the host has no NPC link", () => {
        seedHostEvent();
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [0], actions, lockKind: true },
            {
              kind: "fork",
              condition: { kind: "friendshipAtLeast", value: 80 },
              then: [],
            }
          )
        );
        const hint = findByTestId(body, "event-condition-friendship-requires-character-id");
        expect(hint).toBeTruthy();
        expect(hint?.textContent).toContain("항상 거짓");
      });

      it("hides the friendship hint when the host has an NPC link", () => {
        seedHostEvent("char_a");
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [0], actions, lockKind: true },
            {
              kind: "fork",
              condition: { kind: "friendshipAtLeast", value: 80 },
              then: [],
            }
          )
        );
        expect(findByTestId(body, "event-condition-friendship-requires-character-id")).toBeFalsy();
      });

      it("uses minutes and seconds for the fork timer like the page control", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [0], actions, lockKind: true },
            {
              kind: "fork",
              condition: { kind: "timer", timerId: "timer1", seconds: 90 },
              then: [],
            }
          )
        );
        expect(findByTestId(body, "event-condition-timer-minutes")?.value).toBe("1");
        expect(findByTestId(body, "event-condition-timer-seconds")?.value).toBe("30");
        expect(body.textContent).toContain("분");
        expect(body.textContent).toContain("초");
      });

      it("defaults a new fork timer to 0 seconds like the page control", () => {
        const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [0], actions, lockKind: true },
            {
              kind: "fork",
              condition: { kind: "switch", switchId, value: true },
              then: [],
            }
          )
        );
        const mode = findByTestId(body, "event-condition-mode") as FakeElement | null;
        expect(mode).toBeTruthy();
        if (!mode) return;
        mode.value = "timer";
        mode.dispatchEvent(new Event("change"));
        expect(replaced).toMatchObject({
          kind: "fork",
          condition: { kind: "timer", timerId: "timer1", seconds: 0 },
        });
      });

      it("labels npc activity as author-facing copy, not an internal id", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [0], actions, lockKind: true },
            {
              kind: "fork",
              condition: { kind: "npcActivity", activity: "work" },
              then: [],
            }
          )
        );
        expect(body.textContent).not.toContain("활동 ID");
        expect(body.textContent).toContain("지금 하는 일");
      });
    });
  });
  describe("m2CommandIntentCard", () => {
    isolateTimers();
    /**
     * 제네릭 M2 폼(구 "기타 명령 껍데기")에 붙인 설명카드의 계약.
     *
     * 판정 축은 `m2-command-intent-card` 클래스 하나다 — 전용 폼(화면 연출·이벤트 지우기)이
     * 먼저 쓰던 마커가 제각각이라, 새 카드를 얹으면서 같은 클래스로 모았다.
     * 각 카드의 둘째 문장은 **부정문**이어야 한다. 그게 이 카드를 붙이는 이유이고,
     * 첫 문장만 있으면 한국어 머리글과 같은 말을 두 번 하는 것이다.
     */
    const CASES: readonly { readonly commandId: string; readonly testid: string; readonly not: string }[] = [
      { commandId: "m2-026-change-vehicle-graphic", testid: "m2-change-vehicle-graphic-intent", not: "아닙니다" },
      { commandId: "m2-030-change-screen-transition", testid: "m2-change-screen-transition-intent", not: "않습니다" },
      { commandId: "m2-066-play-movie", testid: "m2-play-movie-intent", not: "아닙니다" },
      { commandId: "m2-078-open-menu-screen", testid: "m2-open-menu-screen-intent", not: "아닙니다" },
      { commandId: "m2-201-camera-control", testid: "m2-camera-control-intent", not: "않습니다" },
      { commandId: "m2-207-region-trigger", testid: "m2-region-trigger-intent", not: "합니다" },
      { commandId: "m2-212-cutscene-control", testid: "m2-cutscene-control-intent", not: "정합니다" },
    ];
    describe("M2 제네릭 폼 설명카드", () => {
      let restoreDom: (() => void) | undefined;

      const actions: CommandListActions = {
        addCommand: () => {},
        insertCommand: () => {},
        replaceCommand: () => {},
        deleteCommand: () => {},
        moveCommand: () => {},
        moveCommandTo: () => {},
      };

      const bodyOf = (commandId: string): FakeElement =>
        renderWithFakeDom(() =>
          renderCommandBody({ path: [0], actions, lockKind: true }, { kind: "m2Command", commandId, fields: {} })
        );

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
      });

      for (const c of CASES) {
        it(`${c.commandId} 은 설명카드를 단다`, () => {
          // 카탈로그가 살아 있어야 제목 분기가 성립한다 — id 가 갈리면 여기서 먼저 깨진다.
          expect(m2CommandById(c.commandId)).toBeTruthy();
          const card = findByTestId(bodyOf(c.commandId), c.testid);
          expect(card).toBeTruthy();
          expect(card?.className ?? "").toContain("m2-command-intent-card");
          expect(card?.textContent ?? "").toContain(c.not);
        });
      }

      it("전용 폼이 먼저 쓰던 카드도 같은 클래스로 판정된다", () => {
        const screenEffect = findByTestId(bodyOf("m2-202-screen-effect"), "m2-screen-effect-intent");
        expect(screenEffect?.className ?? "").toContain("m2-command-intent-card");
        const eraseEvent = findByTestId(bodyOf("m2-086-erase-event"), "m2-command-intent-card");
        expect(eraseEvent?.className ?? "").toContain("m2-command-intent-card");
      });
    });
  });
  describe("textCommandAuthoring", () => {
    isolateTimers();
    const noopActions: CommandListActions = {
      addCommand: () => {},
      insertCommand: () => {},
      replaceCommand: () => {},
      deleteCommand: () => {},
      moveCommand: () => {},
      moveCommandTo: () => {},
    };
    describe("문장 표시 쉬운 저작 화면", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("주 편집 화면 안에서 실제 대화창 미리보기를 즉시 갱신한다", () => {
        // Break: 인스펙터에는 별도 우측 프리뷰 패널이 없어서 본문을 바꿔도 결과를 볼 수 없다.
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [], actions: noopActions, lockKind: true }, { kind: "text", body: "처음 문장" })
        );
        const preview = findByTestId(body, "event-command-text-live-preview");
        const textarea = findByTestId(body, "event-command-text-body") as HTMLTextAreaElement | null;

        expect(preview?.textContent).toContain("처음 문장");
        if (!textarea) throw new Error("missing text body");
        textarea.value = "바뀐 문장";
        textarea.dispatchEvent(new Event("input"));
        expect(preview?.textContent).toContain("바뀐 문장");
        expect(preview?.textContent).not.toContain("처음 문장");
      });

      it("선택한 문장을 쉬운 강조 도구로 감싸고 명령 데이터에 반영한다", () => {
        // Break: 저수준 제어문자 팔레트만 있으면 사용자가 강조 범위를 직접 escape 코드로 작성해야 한다.
        let latest: Command | undefined;
        const actions: CommandListActions = {
          ...noopActions,
          replaceCommand: (_path, command) => {
            latest = command;
          },
        };
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [], actions, lockKind: true }, { kind: "text", body: "중요한 말" })
        );
        const textarea = findByTestId(body, "event-command-text-body") as HTMLTextAreaElement | null;
        const emphasize = findByTestId(body, "event-command-text-tool-emphasis");
        if (!textarea || !emphasize) throw new Error("missing easy authoring control");

        textarea.setSelectionRange(0, 3);
        emphasize.click();

        expect(latest).toMatchObject({ kind: "text", body: "\\c[2]중요한\\c[0] 말" });
        expect(findByTestId(body, "event-command-text-live-preview")?.textContent).toContain("중요한 말");
      });

      it("원시 제어문자 팔레트는 닫힌 고급 영역에 두되 계속 사용할 수 있다", () => {
        // Break: 제어문자 버튼 열두 개가 기본 작성 흐름을 밀어내거나, 반대로 고급 입력 경로가 사라진다.
        let latest: Command | undefined;
        const actions: CommandListActions = {
          ...noopActions,
          replaceCommand: (_path, command) => {
            latest = command;
          },
        };
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [], actions, lockKind: true }, { kind: "text", body: "안녕" })
        );
        const advanced = findByTestId(body, "event-command-text-control-details") as HTMLDetailsElement | null;
        const colorButton = findByTestId(body, "event-command-text-insert-color");

        expect(advanced).not.toBeNull();
        expect(advanced?.open).toBe(false);
        expect(findByTestId(body, "event-command-text-palette")?.closest("details")).toBe(advanced);
        colorButton?.click();
        expect(latest).toMatchObject({ kind: "text", body: "\\c[1]안녕" });
      });
    });
  });
  describe("weekdayConditionForm", () => {
    isolateTimers();
    describe("weekday condition toggles", () => {
      let restoreDom: (() => void) | undefined;

      const actions: CommandListActions = {
        addCommand: () => {},
        insertCommand: () => {},
        replaceCommand: () => {},
        deleteCommand: () => {},
        moveCommand: () => {},
        moveCommandTo: () => {},
      };

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("keeps earlier weekday toggles when the branch form is not rebuilt", () => {
        let cmd: Command = { kind: "fork", condition: { kind: "weekday", weekdays: [0, 6] }, then: [] };
        const body = renderWithFakeDom(() => renderCommandBody({
          path: [0],
          lockKind: true,
          getCurrentCommand: () => cmd,
          actions: { ...actions, replaceCommand: (_path, next) => { cmd = next; } },
        }, cmd));

        const boxes = body.querySelector('[data-testid="event-condition-weekdays"]')?.querySelectorAll("input") ?? [];
        expect(boxes.map((box) => box.checked)).toEqual([true, false, false, false, false, false, true]);
        expect(body.querySelector('[data-testid="event-condition-eval-summary"]')?.textContent).toBe("요일 일·토");

        const sunday = boxes[0];
        const monday = boxes[1];
        if (!sunday || !monday) throw new Error("missing weekday checkboxes");
        sunday.checked = false;
        sunday.dispatchEvent(new Event("change"));
        monday.checked = true;
        monday.dispatchEvent(new Event("change"));

        expect(cmd).toMatchObject({ kind: "fork", condition: { kind: "weekday", weekdays: [1, 6] } });
        expect(body.querySelector('[data-testid="event-condition-eval-summary"]')?.textContent).toBe("요일 월·토");
        expect(boxes.map((box) => box.checked)).toEqual([false, true, false, false, false, false, true]);
      });
    });
  });
});

describe("pageConditions", () => {
  isolateTimers();
  // 페이지 조건의 "꺼짐/없음" 방향 저작 보증.
  // 런타임은 switch value:false / item present:false / actor present:false 를 정상 평가하는데
  // (src/project/io/pageResolution.ts:33-46) 좌측 "언제 보이나요" 패널은 항상 true 로만 써서
  // (a) 데이터에 있는 false 를 화면에서 볼 수 없고 (b) id 를 한 번 바꾸면 조용히 true 로 뒤집혔다.
  describe("eventPageConditionOffValue", () => {
    isolateTimers();
    const EVENT_ID = "ev-cond-off";
    function seedPage(conditions: readonly EventPageCondition[]): { mapId: string; page: EventPage } {
      const mapId = store.getCurrent().startMapId;
      const page: EventPage = {
        id: "page-off",
        name: "꺼짐 조건",
        conditions: [...conditions],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      };
      const event: GameEvent = {
        id: EVENT_ID,
        x: 2,
        y: 2,
        trigger: { kind: "action" },
        commands: [],
        pages: [page],
      };
      store.update((draft) => {
        const target = draft.maps[mapId];
        if (!target) return;
        target.events = [...target.events.filter((entry) => entry.id !== EVENT_ID), structuredClone(event)];
      });
      return { mapId, page: livePage(mapId) };
    }
    function livePage(mapId: string): EventPage {
      const page = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === EVENT_ID)?.pages?.[0];
      if (!page) throw new Error("live page missing");
      return page;
    }
    function render(mapId: string, page: EventPage) {
      return renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, EVENT_ID, page) }));
    }
    describe("페이지 조건: 꺼짐/없음 방향 저작", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("스위치 조건의 켜짐/꺼짐 셀렉트가 저장된 value 를 보여준다", () => {
        const switchId = store.getCurrent().switches[0]?.id ?? "sw_a";
        const { mapId, page } = seedPage([{ kind: "switch", switchId, value: false }]);
        const root = render(mapId, page);
        const value = findByTestId(root, "event-page-switch-condition-value");
        expect(value).toBeDefined();
        expect(value?.value).toBe("off");
      });

      it("스위치 조건의 셀렉트를 꺼짐으로 바꾸면 store 에 value:false 로 저장된다", () => {
        const switchId = store.getCurrent().switches[0]?.id ?? "sw_a";
        const { mapId, page } = seedPage([{ kind: "switch", switchId, value: true }]);
        const root = render(mapId, page);
        const value = findByTestId(root, "event-page-switch-condition-value");
        if (!value) throw new Error("switch value select missing");
        value.value = "off";
        value.dispatchEvent(new Event("change"));
        const stored = livePage(mapId).conditions.find((entry) => entry.kind === "switch");
        expect(stored).toEqual({ kind: "switch", switchId, value: false });
      });

      it("아이템 조건은 보유/미보유를 저작하고 유지한다", () => {
        const { mapId, page } = seedPage([{ kind: "item", itemId: DEFAULT_ITEM_ID, present: false }]);
        const root = render(mapId, page);
        const value = findByTestId(root, "event-page-item-condition-present");
        expect(value?.value).toBe("absent");
      });

      it("주인공 조건은 파티 있음/없음을 저작하고 유지한다", () => {
        const { mapId, page } = seedPage([{ kind: "actor", actorId: DEFAULT_ACTOR_ID, present: false }]);
        const root = render(mapId, page);
        const value = findByTestId(root, "event-page-actor-condition-present");
        expect(value?.value).toBe("absent");
      });

      it("고급 스위치에서 꺼짐을 저작한 뒤 대상을 바꿔도 value:false를 유지한다", () => {
        const switches = store.getCurrent().switches;
        const { mapId, page } = seedPage([
          { kind: "switch", switchId: switches[0]?.id ?? "sw_1", value: true },
          { kind: "switch", switchId: switches[1]?.id ?? "sw_2", value: true },
          { kind: "switch", switchId: switches[2]?.id ?? "sw_3", value: true },
        ]);
        const root = render(mapId, page);
        const polarity = findByTestId(root, "event-page-advanced-condition-switch-value-0");
        const picker = findByTestId(root, "event-page-advanced-condition-switch-0");
        if (!polarity || !picker) throw new Error("advanced switch controls missing");

        polarity.value = "false";
        polarity.dispatchEvent(new Event("change"));
        picker.value = switches[0]?.id ?? "sw_changed";
        picker.dispatchEvent(new Event("change"));

        expect(polarity.textContent).toContain("꺼짐");
        expect(livePage(mapId).conditions[2]).toEqual({
          kind: "switch",
          switchId: switches[0]?.id ?? "sw_changed",
          value: false,
        });
      });

      it("고급 아이템에서 보유 안 함을 저작한 뒤 대상을 바꿔도 present:false를 유지한다", () => {
        const items = store.getCurrent().database.items;
        const { mapId, page } = seedPage([
          { kind: "item", itemId: DEFAULT_ITEM_ID, present: true },
          { kind: "item", itemId: items[1]?.id ?? "item_extra", present: true },
        ]);
        const root = render(mapId, page);
        const polarity = findByTestId(root, "event-page-advanced-condition-item-present-0");
        const picker = findByTestId(root, "event-page-advanced-condition-item-0");
        if (!polarity || !picker) throw new Error("advanced item controls missing");

        polarity.value = "false";
        polarity.dispatchEvent(new Event("change"));
        picker.value = DEFAULT_ITEM_ID;
        picker.dispatchEvent(new Event("change"));

        expect(polarity.textContent).toContain("보유 안 함");
        expect(livePage(mapId).conditions[1]).toEqual({ kind: "item", itemId: DEFAULT_ITEM_ID, present: false });
      });

      it("고급 주인공에서 파티에 없음을 저작한 뒤 대상을 바꿔도 present:false를 유지한다", () => {
        const actors = store.getCurrent().database.actors;
        const { mapId, page } = seedPage([
          { kind: "actor", actorId: DEFAULT_ACTOR_ID, present: true },
          { kind: "actor", actorId: actors[1]?.id ?? "actor_extra", present: true },
        ]);
        const root = render(mapId, page);
        const polarity = findByTestId(root, "event-page-advanced-condition-actor-present-0");
        const picker = findByTestId(root, "event-page-advanced-condition-actor-0");
        if (!polarity || !picker) throw new Error("advanced actor controls missing");

        polarity.value = "false";
        polarity.dispatchEvent(new Event("change"));
        picker.value = DEFAULT_ACTOR_ID;
        picker.dispatchEvent(new Event("change"));

        expect(polarity.textContent).toContain("파티에 없음");
        expect(livePage(mapId).conditions[1]).toEqual({ kind: "actor", actorId: DEFAULT_ACTOR_ID, present: false });
      });
    });
  });
  describe("npcActivitySuggestions", () => {
    isolateTimers();
    const EVENT_ID = "ev-activity-condition";
    const NPC_ID = "ev-scheduled-npc";
    function scheduleEntry(mapId: string, activity: string | undefined): NpcScheduleEntry {
      return { when: { timePhase: "day" }, at: { mapId, x: 3, y: 3 }, activity, facing: "down" };
    }
    function seedScheduledNpc(project: Project, activities: readonly (string | undefined)[]): void {
      const mapId = project.startMapId;
      const npc: GameEvent = {
        id: NPC_ID,
        x: 3,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        schedule: activities.map((activity) => scheduleEntry(mapId, activity)),
      };
      const map = project.maps[mapId];
      if (!map) throw new Error("start map missing");
      map.events = [...map.events.filter((entry) => entry.id !== NPC_ID), npc];
    }
    function activityPage(activity: string): EventPage {
      return {
        id: "page-activity",
        name: "활동 조건",
        conditions: [{ kind: "npcActivity", activity }],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: "안녕" }],
      };
    }
    function hostEvent(page: EventPage): GameEvent {
      return { id: EVENT_ID, x: 2, y: 2, trigger: page.trigger, commands: [], pages: [page] };
    }
    function optionValues(root: FakeElement, testId: string): string[] {
      const list = findByTestId(root, testId);
      if (!list) throw new Error(`datalist ${testId} 없음`);
      return list.children.filter((child) => child.tagName === "OPTION").map((option) => option.value);
    }
    describe("활동 조건 저작 도움", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
      });

      afterEach(() => {
        restoreDom?.();
        restoreDom = undefined;
      });

      it("프로젝트 일정에 적힌 활동을 중복 없이 정렬해 모은다", () => {
        const project = createBlankProject();
        seedScheduledNpc(project, ["저녁 장터", "귀가", "저녁 장터", "  ", undefined]);

        expect(collectNpcActivitySuggestions(project)).toEqual(["귀가", "저녁 장터"]);
      });

      it("일정이 없으면 빈 목록을 준다", () => {
        expect(collectNpcActivitySuggestions(createBlankProject())).toEqual([]);
      });

      it("페이지 활동 조건 입력이 프로젝트 활동을 후보로 건다", () => {
        const project = createBlankProject();
        seedScheduledNpc(project, ["귀가", "저녁 장터"]);
        const page = activityPage("저녁 장터");
        const mapId = project.startMapId;
        project.maps[mapId]!.events = [...project.maps[mapId]!.events, hostEvent(page)];
        store.replace(project);

        const root = renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, EVENT_ID, page) }));

        expect(optionValues(root, "event-page-npc-activity-condition-options")).toEqual(["귀가", "저녁 장터"]);
        const input = findByTestId(root, "event-page-npc-activity-condition-input");
        expect(input?.getAttribute("list")).toBe("event-page-npc-activity-condition-options");
      });

      it("분기 폼 활동 입력도 같은 후보를 건다", () => {
        const project = createBlankProject();
        seedScheduledNpc(project, ["귀가"]);
        store.replace(project);

        const root = renderWithFakeDom(() =>
          el("div", { children: [renderNpcActivityCondition({ kind: "npcActivity", activity: "귀가" }, () => undefined)] })
        );

        expect(optionValues(root, "event-condition-npc-activity-options")).toEqual(["귀가"]);
        const input = findByTestId(root, "event-condition-npc-activity");
        expect(input?.getAttribute("list")).toBe("event-condition-npc-activity-options");
      });

      it("어떤 일정에도 없는 활동은 저작 시점에 알려준다", () => {
        const project = createBlankProject();
        seedScheduledNpc(project, ["귀가"]);
        const event = hostEvent(activityPage("관광"));
        project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

        const result = validateEventDraftBody(project, project.startMapId, event);
        const issue = result.issues.find((entry) => entry.code === "condition.npcActivity.unknown");

        expect(issue?.severity).toBe("warning");
        expect(issue?.message).toContain("NPC 일정");
      });

      it("일정에 있는 활동은 알리지 않는다", () => {
        const project = createBlankProject();
        seedScheduledNpc(project, ["귀가", "저녁 장터"]);
        const event = hostEvent(activityPage("저녁 장터"));
        project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

        const result = validateEventDraftBody(project, project.startMapId, event);

        expect(result.issues.filter((entry) => entry.code === "condition.npcActivity.unknown")).toEqual([]);
      });

      it("빈 활동은 기존 경고만 내고 미확인 경고를 겹치지 않는다", () => {
        const project = createBlankProject();
        seedScheduledNpc(project, ["귀가"]);
        const event = hostEvent(activityPage("   "));
        project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

        const codes = validateEventDraftBody(project, project.startMapId, event).issues.map((entry) => entry.code);

        expect(codes).toContain("condition.npcActivity.empty");
        expect(codes).not.toContain("condition.npcActivity.unknown");
      });
    });
  });
  describe("pageConditionAuthoringIntegrity", () => {
    isolateTimers();
    const EVENT_ID = "ev-condition-integrity";
    function seedPage(conditions: readonly EventPageCondition[]): { mapId: string; page: EventPage } {
      const mapId = store.getCurrent().startMapId;
      const page: EventPage = {
        id: "page-condition-integrity",
        name: "조건 무결성",
        conditions: [...conditions],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      };
      const event: GameEvent = {
        id: EVENT_ID,
        x: 2,
        y: 2,
        trigger: { kind: "action" },
        commands: [],
        pages: [page],
      };
      store.update((draft) => {
        const map = draft.maps[mapId];
        if (!map) return;
        map.events = [...map.events.filter((entry) => entry.id !== EVENT_ID), structuredClone(event)];
      });
      return { mapId, page: livePage(mapId) };
    }
    function livePage(mapId: string): EventPage {
      const page = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === EVENT_ID)?.pages?.[0];
      if (!page) throw new Error("live page missing");
      return page;
    }
    function render(mapId: string, page: EventPage) {
      return renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, EVENT_ID, page) }));
    }
    describe("페이지 조건 저작 무결성", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
      });

      it.each([
        {
          name: "스위치",
          condition: () => ({ kind: "switch", switchId: store.getCurrent().switches[0]?.id ?? "sw_1", value: false }) as EventPageCondition,
          pickerTestId: "event-page-switch-condition-input",
          errorTestId: "event-page-switch-condition-error",
          expected: { kind: "switch", switchId: "", value: false },
          issueCode: "reference.switch.missing",
        },
        {
          name: "아이템",
          condition: () => ({ kind: "item", itemId: DEFAULT_ITEM_ID, present: false }) as EventPageCondition,
          pickerTestId: "event-page-item-condition-input",
          errorTestId: "event-page-item-condition-error",
          expected: { kind: "item", itemId: "", present: false },
          issueCode: "reference.item.missing",
        },
      ])("$name 참조를 비워도 조건을 보존하고 인라인 오류와 집계 검증을 표시한다", ({ condition, pickerTestId, errorTestId, expected, issueCode }) => {
        const { mapId, page } = seedPage([condition()]);
        const root = render(mapId, page);
        const picker = findByTestId(root, pickerTestId);
        const error = findByTestId(root, errorTestId);
        if (!picker || !error) throw new Error("reference controls missing");

        picker.value = "";
        picker.dispatchEvent(new Event("change"));

        expect(livePage(mapId).conditions[0]).toEqual(expected);
        expect(error.hidden).toBe(false);
        const validation = validateEventDraft(store.getCurrent(), mapId, EVENT_ID);
        expect(validation.issues.some((issue) => issue.code === issueCode)).toBe(true);
      });

      it("칩으로 아이템 조건을 담으면 행이 생기고, 다시 빼면 안내 한 줄로 돌아간다", () => {
        const { mapId, page } = seedPage([]);
        const emptyRoot = render(mapId, page);
        expect(findByTestId(emptyRoot, "event-condition-empty")).not.toBeNull();
        expect(findByTestId(emptyRoot, "event-condition-row-아이템")).toBeNull();
        const chip = findByTestId(emptyRoot, "event-condition-chip-item");
        if (!chip) throw new Error("item chip missing");
        expect(chip.getAttribute("aria-pressed")).toBe("false");

        chip.click();

        // 첫 아이템에 조용히 묶지 않는다 — 빈 참조로 세우고 행의 「아이템을 선택하세요」가 고르게 한다(2026-09-18).
        expect(livePage(mapId).conditions).toEqual([{ kind: "item", itemId: "", present: true }]);
        const openRoot = render(mapId, livePage(mapId));
        const row = findByTestId(openRoot, "event-condition-row-아이템");
        if (!row) throw new Error("enabled item row missing after chip toggle");
        expect(row.dataset.conditionActive).toBe("true");
        expect(row.classList.contains("disabled")).toBe(false);
        expect(findByTestId(openRoot, "event-condition-chip-item")?.getAttribute("aria-pressed")).toBe("true");
        expect(findByTestId(openRoot, "event-page-item-condition-input")).not.toBeNull();

        findByTestId(openRoot, "event-condition-chip-item")?.click();

        expect(livePage(mapId).conditions).toEqual([]);
        expect(findByTestId(render(mapId, livePage(mapId)), "event-condition-empty")).not.toBeNull();
      });
    });
  });
});
