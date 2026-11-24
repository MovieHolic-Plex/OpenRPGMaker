import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, GameEvent } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom, renderWithFakeDom, FakeElement } from "./fakeDom";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { startSession } from "@/project/session";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { editorState } from "@/editor/editorState";
import { isolateTimers } from "./mergedTeardown";

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
