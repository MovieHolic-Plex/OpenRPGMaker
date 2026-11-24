import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auxCompositeKey, bindAuxDetails, getAuxOpen, getAuxOpenSet, isAuxOpen, setAuxOpen, setAuxClosed, syncAuxHosts } from "@/editor/panels/eventEditor/auxOpenController";
import { installFakeDom, FakeElement, findByTestId, renderWithFakeDom } from "./fakeDom";
import { applyCommandDiff, countCommandDiff, diffCommandLists, hasCommandDiffChanges } from "@/editor/panels/eventEditor/commandDiff";
import type { Command, Condition } from "@/project/types";
import { newM2Command } from "@/editor/eventCommandFactory";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import { handleCommandShortcut } from "@/editor/panels/eventEditor/commandListContextMenu";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { compileConditionFromText } from "@/editor/panels/eventEditor/conditionCompile";
import { evalCondition, startSession } from "@/project/session";
import { renderConditionEvalPreview } from "@/editor/panels/eventEditor/conditionEvalPreview";
import { editorState } from "@/editor/editorState";
import { renderEventScheduleEditor } from "@/editor/panels/eventEditor/eventScheduleEditor";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { clearCommandToolbarHistories, createCommandToolbarHistory } from "@/editor/panels/eventEditor/commandToolbarHistory";
import { isolateTimers } from "./mergedTeardown";

describe("auxOpenController", () => {
  isolateTimers();
  describe("auxOpenController non-exclusive preview+flow", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("AI is exclusive — closes preview and flow when opened", () => {
      const key = auxCompositeKey("map_a", "ev_1", "p1");
      const ai = document.createElement("details");
      const preview = document.createElement("details");
      const flow = document.createElement("details");
      bindAuxDetails(key, "ai", ai);
      bindAuxDetails(key, "preview", preview);
      bindAuxDetails(key, "flow", flow);

      setAuxOpen(key, "preview");
      setAuxOpen(key, "flow");
      expect(preview.open).toBe(true);
      expect(flow.open).toBe(true);

      setAuxOpen(key, "ai");
      expect(ai.open).toBe(true);
      expect(preview.open).toBe(false);
      expect(flow.open).toBe(false);
    });

    it("preview and flow can be open simultaneously", () => {
      const key = auxCompositeKey("map_b", "ev_2", "p1");
      const ai = document.createElement("details");
      const preview = document.createElement("details");
      const flow = document.createElement("details");
      bindAuxDetails(key, "ai", ai);
      bindAuxDetails(key, "preview", preview);
      bindAuxDetails(key, "flow", flow);

      setAuxOpen(key, "preview");
      expect(preview.open).toBe(true);
      expect(flow.open).toBe(false);

      setAuxOpen(key, "flow");
      expect(preview.open).toBe(true);
      expect(flow.open).toBe(true);
      expect(ai.open).toBe(false);
    });

    it("closing preview does not close flow", () => {
      const key = auxCompositeKey("map_c", "ev_3", "p1");
      const ai = document.createElement("details");
      const preview = document.createElement("details");
      const flow = document.createElement("details");
      bindAuxDetails(key, "ai", ai);
      bindAuxDetails(key, "preview", preview);
      bindAuxDetails(key, "flow", flow);

      setAuxOpen(key, "preview");
      setAuxOpen(key, "flow");
      setAuxClosed(key, "preview");

      expect(preview.open).toBe(false);
      expect(flow.open).toBe(true);
    });

    it("opening preview closes AI but not flow", () => {
      const key = auxCompositeKey("map_d", "ev_4", "p1");
      const ai = document.createElement("details");
      const preview = document.createElement("details");
      const flow = document.createElement("details");
      bindAuxDetails(key, "ai", ai);
      bindAuxDetails(key, "preview", preview);
      bindAuxDetails(key, "flow", flow);

      setAuxOpen(key, "ai");
      expect(ai.open).toBe(true);

      setAuxOpen(key, "preview");
      expect(ai.open).toBe(false);
      expect(preview.open).toBe(true);
      expect(flow.open).toBe(false);

      setAuxOpen(key, "flow");
      expect(preview.open).toBe(true);
      expect(flow.open).toBe(true);
    });

    it("setAuxOpen(null) closes all panels", () => {
      const key = auxCompositeKey("map_e", "ev_5", "p1");
      const ai = document.createElement("details");
      const preview = document.createElement("details");
      const flow = document.createElement("details");
      bindAuxDetails(key, "ai", ai);
      bindAuxDetails(key, "preview", preview);
      bindAuxDetails(key, "flow", flow);

      setAuxOpen(key, "preview");
      setAuxOpen(key, "flow");
      setAuxOpen(key, null);

      expect(ai.open).toBe(false);
      expect(preview.open).toBe(false);
      expect(flow.open).toBe(false);
    });

    it("isAuxOpen checks individual panel state", () => {
      const key = auxCompositeKey("map_f", "ev_6", "p1");
      const ai = document.createElement("details");
      const preview = document.createElement("details");
      const flow = document.createElement("details");
      bindAuxDetails(key, "ai", ai);
      bindAuxDetails(key, "preview", preview);
      bindAuxDetails(key, "flow", flow);

      setAuxOpen(key, "preview");
      setAuxOpen(key, "flow");

      expect(isAuxOpen(key, "preview")).toBe(true);
      expect(isAuxOpen(key, "flow")).toBe(true);
      expect(isAuxOpen(key, "ai")).toBe(false);
    });

    it("getAuxOpenSet returns the full set of open panels", () => {
      const key = auxCompositeKey("map_g", "ev_7", "p1");
      const ai = document.createElement("details");
      const preview = document.createElement("details");
      const flow = document.createElement("details");
      bindAuxDetails(key, "ai", ai);
      bindAuxDetails(key, "preview", preview);
      bindAuxDetails(key, "flow", flow);

      setAuxOpen(key, "preview");
      setAuxOpen(key, "flow");

      const set = getAuxOpenSet(key);
      expect(set.has("preview")).toBe(true);
      expect(set.has("flow")).toBe(true);
      expect(set.has("ai")).toBe(false);
      expect(set.size).toBe(2);
    });

    it("syncAuxHosts restores open state after re-bind", () => {
      const key = auxCompositeKey("map_h", "ev_8", "p1");
      const ai = document.createElement("details");
      const preview = document.createElement("details");
      const flow = document.createElement("details");
      bindAuxDetails(key, "ai", ai);
      bindAuxDetails(key, "preview", preview);
      bindAuxDetails(key, "flow", flow);

      setAuxOpen(key, "preview");
      setAuxOpen(key, "flow");

      const preview2 = document.createElement("details");
      const flow2 = document.createElement("details");
      bindAuxDetails(key, "preview", preview2);
      bindAuxDetails(key, "flow", flow2);
      syncAuxHosts(key);

      expect(preview2.open).toBe(true);
      expect(flow2.open).toBe(true);
    });

    it("getAuxOpen returns primary open panel for backward compat", () => {
      const key = auxCompositeKey("map_i", "ev_9", "p1");
      const ai = document.createElement("details");
      const preview = document.createElement("details");
      const flow = document.createElement("details");
      bindAuxDetails(key, "ai", ai);
      bindAuxDetails(key, "preview", preview);
      bindAuxDetails(key, "flow", flow);

      setAuxOpen(key, "preview");
      setAuxOpen(key, "flow");
      expect(getAuxOpen(key)).toBe("preview");

      setAuxClosed(key, "preview");
      expect(getAuxOpen(key)).toBe("flow");

      setAuxClosed(key, "flow");
      expect(getAuxOpen(key)).toBe(null);
    });
  });
});

// test/commandDiff.test.ts
// before/after 명령 목록 비교 → 유령 행 계산 → 행 단위 제외 적용.
describe("commandDiff", () => {
  isolateTimers();
  function text(body: string): Command {
    return { kind: "text", body } as Command;
  }
  describe("diffCommandLists", () => {
    it("문구만 달라진 한 줄은 삭제+추가가 아니라 «바뀜» 한 줄이다", () => {
      const rows = diffCommandLists([text("상자다")], [text("낡은 상자다")]);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("change");
      expect(rows[0].before).toMatchObject({ body: "상자다" });
      expect(rows[0].after).toMatchObject({ body: "낡은 상자다" });
    });

    it("끝에 붙은 줄은 «새로 생김», 나머지는 «그대로»다", () => {
      const rows = diffCommandLists([text("안녕")], [text("안녕"), text("새 대사")]);
      expect(rows.map((row) => row.status)).toEqual(["keep", "add"]);
      expect(countCommandDiff(rows)).toEqual({ added: 1, removed: 0, changed: 0 });
    });

    it("사라진 줄은 «없어짐»이다", () => {
      const rows = diffCommandLists([text("안녕"), text("잘 가")], [text("안녕")]);
      expect(rows.map((row) => row.status)).toEqual(["keep", "remove"]);
      expect(countCommandDiff(rows)).toEqual({ added: 0, removed: 1, changed: 0 });
    });

    it("조건은 그대로인데 안쪽만 바뀌면 fork 는 «그대로»고 자식만 표시된다", () => {
      const before = [{
        kind: "fork",
        condition: { kind: "selfSwitch", key: "A", value: true },
        then: [text("열었다")],
      } as Command];
      const after = [{
        kind: "fork",
        condition: { kind: "selfSwitch", key: "A", value: true },
        then: [text("열었다"), text("비어 있다")],
      } as Command];

      const rows = diffCommandLists(before, after);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("keep");
      const then = rows[0].branches.find((branch) => branch.key === "forkThen")!;
      expect(then.label).toBe("조건이 맞을 때");
      expect(then.rows.map((row) => row.status)).toEqual(["keep", "add"]);
    });

    it("새로 생긴 fork 는 하위 트리 전체가 «새로 생김»이다", () => {
      const after = [{
        kind: "fork",
        condition: { kind: "selfSwitch", key: "A", value: true },
        then: [text("비어 있다")],
        else: [text("회복약을 얻었다")],
      } as Command];
      const rows = diffCommandLists([], after);
      expect(rows[0].status).toBe("add");
      const branches = rows[0].branches.map((branch) => branch.key);
      expect(branches).toEqual(["forkThen", "forkElse"]);
      for (const branch of rows[0].branches) {
        expect(branch.rows.every((row) => row.status === "add")).toBe(true);
      }
      expect(countCommandDiff(rows)).toEqual({ added: 3, removed: 0, changed: 0 });
    });

    it("바뀌는 것이 없으면 hasChanges 는 false 다", () => {
      const rows = diffCommandLists([text("안녕")], [text("안녕")]);
      expect(hasCommandDiffChanges(rows)).toBe(false);
    });
  });
  describe("applyCommandDiff", () => {
    it("제외가 없으면 after 를 그대로 만든다", () => {
      const before = [text("안녕")];
      const after = [text("안녕"), text("잘 가")];
      const rows = diffCommandLists(before, after);
      expect(applyCommandDiff(rows)).toEqual(after);
    });

    it("추가를 빼면 그 줄만 안 들어간다", () => {
      const rows = diffCommandLists([text("안녕")], [text("안녕"), text("잘 가")]);
      const addRow = rows.find((row) => row.status === "add")!;
      expect(applyCommandDiff(rows, new Set([addRow.id]))).toEqual([text("안녕")]);
    });

    it("삭제를 빼면 원래 줄이 되살아난다", () => {
      const rows = diffCommandLists([text("안녕"), text("잘 가")], [text("안녕")]);
      const removeRow = rows.find((row) => row.status === "remove")!;
      expect(applyCommandDiff(rows, new Set([removeRow.id]))).toEqual([text("안녕"), text("잘 가")]);
    });

    it("바뀜을 빼면 원래 값이 남는다", () => {
      const rows = diffCommandLists([text("상자다")], [text("낡은 상자다")]);
      expect(applyCommandDiff(rows, new Set([rows[0].id]))).toEqual([text("상자다")]);
    });

    it("분기 안쪽 추가만 골라 뺄 수 있다", () => {
      const before = [{
        kind: "fork",
        condition: { kind: "selfSwitch", key: "A", value: true },
        then: [text("열었다")],
      } as Command];
      const after = [{
        kind: "fork",
        condition: { kind: "selfSwitch", key: "A", value: true },
        then: [text("열었다"), text("비어 있다")],
      } as Command];

      const rows = diffCommandLists(before, after);
      const inner = rows[0].branches[0].rows.find((row) => row.status === "add")!;
      expect(applyCommandDiff(rows, new Set([inner.id]))).toEqual(before);
      expect(applyCommandDiff(rows)).toEqual(after);
    });

    it("선택지 분기도 슬롯별로 유지된다", () => {
      const before = [{
        kind: "choices",
        prompt: "",
        options: [
          { text: "네", branch: [text("좋아")] },
          { text: "아니오", branch: [] },
        ],
        cancelBehavior: "none",
      } as unknown as Command];
      const after = structuredClone(before) as unknown as {
        options: { text: string; branch: Command[] }[];
      }[];
      after[0].options[1].branch = [text("알겠다")];

      const rows = diffCommandLists(before, after as unknown as Command[]);
      expect(rows[0].status).toBe("keep");
      expect(applyCommandDiff(rows)).toEqual(after);
    });
  });
});

describe("commentCommandBody", () => {
  isolateTimers();
  describe("comment command UX", () => {
    let restoreDom: (() => void) | undefined;
    let inserted: Command | undefined;

    const actions: CommandListActions = {
      addCommand: () => {},
      insertCommand: (_path, command) => {
        inserted = command;
      },
      replaceCommand: () => {},
      deleteCommand: () => {},
      moveCommand: () => {},
      moveCommandTo: () => {},
    };

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
      inserted = undefined;
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("edits comment text and color through catalog controls without losing either field", () => {
      let cmd: Command = { ...newM2Command("m2-088-comment"), fields: { comment: "문 연 뒤 대사", color: "yellow" } };
      const body = renderWithFakeDom(() => renderCommandBody({
        path: [0], lockKind: true, getCurrentCommand: () => cmd,
        actions: { ...actions, replaceCommand: (_path, next) => { cmd = next; } },
      }, cmd));

      expect(findByTestId(body, "m2-command-body-m2-088-comment")).toBeTruthy();
      expect(findByTestId(body, "m2-command-comment-textarea")).toBeTruthy();
      const text = findByTestId(body, "m2-command-comment-textarea");
      const color = findByTestId(body, "m2-command-color-option-select");
      if (!text || !color) throw new Error("missing comment controls");
      expect(text.value).toBe("문 연 뒤 대사");
      expect(color.value).toBe("yellow");
      text.value = "수정된 주석";
      text.dispatchEvent(new Event("change"));
      color.value = "cyan";
      color.dispatchEvent(new Event("change"));
      expect(cmd).toEqual({ kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "수정된 주석", color: "cyan" } });
    });

    it("summarizes comments without dumping field keys", () => {
      const parts = commandSummaryParts({
        kind: "m2Command",
        commandId: "m2-088-comment",
        fields: { comment: "컷신 시작", color: "cyan" },
      });
      const text = parts.map((part) => part.text).join("");
      expect(text).toContain("주석");
      expect(text).toContain("컷신 시작");
      expect(text).not.toContain("color:");
    });

    it("Ctrl+/ inserts a comment command via shortcut", () => {
      const item = new FakeElement("div");
      item.className = "cmd-item";
      const event = new Event("keydown", { bubbles: true, cancelable: true });
      Object.defineProperties(event, { ctrlKey: { value: true }, altKey: { value: false }, key: { value: "/" } });

      handleCommandShortcut(event as KeyboardEvent, {
        x: 0,
        y: 0,
        item: item as unknown as HTMLElement,
        command: { kind: "text", body: "x" },
        path: [0],
        actions,
        openEditor: () => {},
      });

      expect(event.defaultPrevented).toBe(true);
      expect(inserted).toBeUndefined();
      const text = document.querySelector<HTMLTextAreaElement>('[data-testid="m2-command-comment-textarea"]');
      if (!text) throw new Error("shortcut did not open comment editor");
      text.value = "shortcut comment";
      text.dispatchEvent(new Event("change"));
      document.querySelector<HTMLButtonElement>('[data-testid="event-command-edit-ok"]')?.click();
      expect(inserted).toEqual({ kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "shortcut comment", color: "green" } });
    });
  });
});

describe("conditionCompile", () => {
  isolateTimers();
  describe("compileConditionFromText", () => {
    it("compiles night + switch AND friendship OR item sketches", () => {
      const project = createBlankProject();
      project.switches[0] = { id: "sw_door", name: "문 열림" };
      project.database.items[0] = {
        ...project.database.items[0]!,
        id: "item_key",
        name: "낡은 열쇠",
      };

      const andResult = compileConditionFromText("문 열림 AND 밤", project);
      expect(andResult.condition.kind).toBe("all");
      if (andResult.condition.kind === "all") {
        expect(andResult.condition.conditions.some((c) => c.kind === "timePhase")).toBe(true);
        expect(andResult.condition.conditions.some((c) => c.kind === "switch")).toBe(true);
      }

      const orResult = compileConditionFromText("호감 100 OR 낡은 열쇠", project);
      expect(orResult.condition.kind).toBe("any");

      const notResult = compileConditionFromText("NOT 밤", project);
      expect(notResult.condition).toEqual({
        kind: "not",
        condition: { kind: "timePhase", phase: "night" },
      });
    });

    it("evaluates compiled group conditions", () => {
      const project = createBlankProject();
      project.switches[0] = { id: "sw_a", name: "A" };
      const compiled = compileConditionFromText("A AND 낮", project);
      const session = startSession(project);
      session.switches.sw_a = true;
      // gameTime may be undefined → timePhase day can be false; just ensure eval does not throw
      expect(typeof evalCondition(session, compiled.condition)).toBe("boolean");
    });
  });
});

describe("conditionEvalPreview", () => {
  isolateTimers();
  const PLAY_TIME_KINDS: readonly { readonly name: string; readonly condition: Condition }[] = [
    { name: "timer", condition: { kind: "timer", timerId: "timer1", seconds: 10 } },
    { name: "timePhase", condition: { kind: "timePhase", phase: "morning" } },
    { name: "season", condition: { kind: "season", season: "spring" } },
    { name: "npcActivity", condition: { kind: "npcActivity", activity: "work" } },
    { name: "friendshipAtLeast", condition: { kind: "friendshipAtLeast", value: 0 } },
    { name: "battleResult", condition: { kind: "battleResult", result: "victory" } },
    { name: "run", condition: { kind: "run", query: "active", value: false } },
  ];
  describe("conditionEvalPreview", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
      editorState.set({ selectedEventId: "ev_test" });
    });

    afterEach(() => {
      editorState.set({ selectedEventId: null });
      restoreDom?.();
    });

    it("does not render a confident 충족/미충족 for play-time kinds the editor cannot justify", () => {
      for (const { name, condition } of PLAY_TIME_KINDS) {
        const root = renderWithFakeDom(() => renderConditionEvalPreview(condition));
        const undetermined = findByTestId(root, "event-condition-eval-undetermined");
        const badge = findByTestId(root, "event-condition-eval-badge");
        expect(findByTestId(root, "event-condition-eval"), name).toBeTruthy();
        expect(findByTestId(root, "event-condition-eval-summary"), name).toBeTruthy();
        expect(undetermined, `${name} should expose the undeterminable state`).toBeTruthy();
        expect(badge?.textContent, name).not.toBe("충족");
        expect(badge?.textContent, name).not.toBe("미충족");
        expect(badge?.textContent, name).not.toBe("불충족");
        expect(root.dataset.evalOk, name).not.toBe("true");
        expect(root.dataset.evalOk, name).not.toBe("false");
      }
    });

    it("still renders a 충족/불충족 verdict for start-state kinds", () => {
      const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
      const root = renderWithFakeDom(() =>
        renderConditionEvalPreview({ kind: "switch", switchId, value: false })
      );
      expect(findByTestId(root, "event-condition-eval-undetermined")).toBeNull();
      expect(findByTestId(root, "event-condition-eval-badge")?.textContent).toBe("충족");
      expect(root.dataset.evalOk).toBe("true");
    });

    it("evaluates timePhase/season against play-start gameTime when the time system is on", () => {
      const project = createBlankProject();
      project.system.timeSystem = { enabled: true };
      store.replace(project);

      const morning = renderWithFakeDom(() =>
        renderConditionEvalPreview({ kind: "timePhase", phase: "morning" })
      );
      expect(findByTestId(morning, "event-condition-eval-undetermined")).toBeNull();
      expect(findByTestId(morning, "event-condition-eval-badge")?.textContent).toBe("충족");
      expect(morning.dataset.evalOk).toBe("true");

      const night = renderWithFakeDom(() =>
        renderConditionEvalPreview({ kind: "timePhase", phase: "night" })
      );
      expect(findByTestId(night, "event-condition-eval-undetermined")).toBeNull();
      expect(findByTestId(night, "event-condition-eval-badge")?.textContent).toBe("불충족");
      expect(night.dataset.evalOk).toBe("false");

      const spring = renderWithFakeDom(() =>
        renderConditionEvalPreview({ kind: "season", season: "spring" })
      );
      expect(findByTestId(spring, "event-condition-eval-badge")?.textContent).toBe("충족");

      const winter = renderWithFakeDom(() =>
        renderConditionEvalPreview({ kind: "season", season: "winter" })
      );
      expect(findByTestId(winter, "event-condition-eval-badge")?.textContent).toBe("불충족");
    });

    it("evaluates insideLocation against the passed map — unknown without one", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      if (!map) throw new Error("missing start map");
      const { x, y } = project.startPos;
      map.locations = [{ id: "loc_badge", name: "배지 구역", x: x - 1, y: y - 1, w: 4, h: 4 }];
      const condition = { kind: "insideLocation", locationId: "loc_badge", inside: true } as const;
      // 맵을 넘기면 실제 판정(시작점이 구역 안이므로 충족) — 시뮬레이션과 같은 입력.
      const decided = renderWithFakeDom(() => renderConditionEvalPreview(condition, mapId));
      expect(findByTestId(decided, "event-condition-eval-badge")?.textContent).toBe("충족");
      // 맵 없이 호출하면 판정 불가 — 참/거짓을 지어내지 않는다.
      const unknown = renderWithFakeDom(() => renderConditionEvalPreview(condition));
      expect(findByTestId(unknown, "event-condition-eval-undetermined")).toBeTruthy();
    });
  });
});

describe("editorNpcSchedule", () => {
  isolateTimers();
  describe("NPC schedule editor", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => restoreDom?.());

    // Break caught: an NPC without a tool-authored schedule has no editor surface.
    it("renders for an empty schedule and authors every when/target field", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      map.events.push({ id: "npc", x: 2, y: 3, trigger: { kind: "action" }, commands: [] });
      store.replace(project);

      const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;
      expect(host).toBeTruthy();
      findByTestId(host, "event-schedule-add")?.click();

      setValue(host, "event-schedule-time-phase-0", "evening");
      setChecked(host, "event-schedule-hour-enabled-0", true);
      setValue(host, "event-schedule-hour-start-0", "17");
      setValue(host, "event-schedule-hour-end-0", "19");
      setValue(host, "event-schedule-season-0", "fall");
      setChecked(host, "event-schedule-day-enabled-0", true);
      setValue(host, "event-schedule-day-start-0", "8");
      setValue(host, "event-schedule-day-end-0", "14");
      setValue(host, "event-schedule-x-0", "4");
      setValue(host, "event-schedule-y-0", "5");
      setValue(host, "event-schedule-facing-0", "left");
      setValue(host, "event-schedule-activity-0", "shop");

      expect(store.getCurrent().maps[map.id]?.events[0]?.schedule?.[0]).toEqual({
        when: { timePhase: "evening", hourRange: [17, 19], season: "fall", dayRange: [8, 14] },
        at: { mapId: map.id, x: 4, y: 5 },
        facing: "left",
        activity: "shop",
      });
    });

    // Break caught: schedule rows can be added but not removed back to the empty state.
    it("deletes the authored schedule row", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      map.events.push({
        id: "npc",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        schedule: [{ when: {}, at: { mapId: map.id, x: 2, y: 3 } }],
      });
      store.replace(project);
      const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

      findByTestId(host, "event-schedule-delete-0")?.click();

      expect(store.getCurrent().maps[map.id]?.events[0]?.schedule).toEqual([]);
    });

    // Break caught: an authored hour/day range cannot be cleared back to an always-matching condition.
    it("clears exact-time and day ranges independently", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      map.events.push({
        id: "npc",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        schedule: [{
          when: { timePhase: "day", hourRange: [10, 16], season: "spring", dayRange: [2, 7] },
          at: { mapId: map.id, x: 2, y: 3 },
        }],
      });
      store.replace(project);
      const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

      setChecked(host, "event-schedule-hour-enabled-0", false);
      setChecked(host, "event-schedule-day-enabled-0", false);

      expect(store.getCurrent().maps[map.id]?.events[0]?.schedule?.[0]?.when).toEqual({
        timePhase: "day",
        season: "spring",
      });
    });

    // Break caught: HTML min/max can be bypassed and invalid schedule coordinates are persisted.
    it("clamps bypassed hour, day, and target coordinate values", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      map.events.push({
        id: "npc",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        schedule: [{ when: { hourRange: [6, 18], dayRange: [1, 28] }, at: { mapId: map.id, x: 2, y: 3 } }],
      });
      store.replace(project);
      const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

      setValue(host, "event-schedule-hour-start-0", "-10");
      setValue(host, "event-schedule-hour-end-0", "80");
      setValue(host, "event-schedule-day-start-0", "0");
      setValue(host, "event-schedule-day-end-0", "500");
      setValue(host, "event-schedule-x-0", "-3");
      setValue(host, "event-schedule-y-0", "9999");

      expect(store.getCurrent().maps[map.id]?.events[0]?.schedule?.[0]).toMatchObject({
        when: { hourRange: [0, 48], dayRange: [1, 99] },
        at: { mapId: map.id, x: 0, y: map.height - 1 },
      });
    });

    // Break caught: an unconditional row before a conditional row shadows the later schedule silently.
    it("warns when an unconditional row shadows later rows", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      map.events.push({
        id: "npc",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        schedule: [
          { when: {}, at: { mapId: map.id, x: 2, y: 3 } },
          { when: { timePhase: "night" }, at: { mapId: map.id, x: 3, y: 3 } },
        ],
      });
      store.replace(project);

      const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

      expect(findByTestId(host, "event-schedule-shadow-warning-0")).toBeTruthy();
    });
  });
  function setValue(host: FakeElement, testid: string, value: string): void {
    const control = findByTestId(host, testid);
    if (!control) throw new Error(`missing ${testid}`);
    control.value = value;
    control.dispatchEvent(new Event("change"));
  }
  function setChecked(host: FakeElement, testid: string, checked: boolean): void {
    const control = findByTestId(host, testid);
    if (!control) throw new Error(`missing ${testid}`);
    control.checked = checked;
    control.dispatchEvent(new Event("change"));
  }
});

describe("eventCommandHistoryDrag", () => {
  isolateTimers();
  function baseActions(overrides: Partial<CommandListActions> = {}): CommandListActions {
    return {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand: vi.fn(),
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
      ...overrides,
    };
  }
  function startDrag(item: FakeElement | undefined): void {
    if (!item) throw new Error("drag source missing");
    item.querySelector('[data-testid="event-command-drag-handle"]')?.dispatchEvent(new Event("pointerdown"));
    item.dispatchEvent(new Event("dragstart"));
  }
  function dropEvent(sourcePath: readonly number[]): Event {
    const payload = JSON.stringify(sourcePath);
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      clientY: { value: 1 },
      dataTransfer: {
        value: {
          types: ["application/x-oprn-event-command-path", "text/plain"],
          getData: (type: string) =>
            type === "application/x-oprn-event-command-path" || type === "text/plain" ? payload : "",
          setData: vi.fn(),
          effectAllowed: "move",
          dropEffect: "move",
        },
      },
    });
    return event;
  }
  describe("event command history lifecycle", () => {
    it("forwards cross-container moves and records them for undo", () => {
      let commands: Command[] = [{ kind: "text", body: "A" }];
      const moveCommandAcross = vi.fn(() => {
        commands = [{ kind: "text", body: "B" }];
      });
      const history = createCommandToolbarHistory({
        key: "map:event:page-cross",
        readCommands: () => commands,
        replaceCommands: (next) => { commands = next; },
      });
      const wrapped = history.wrapActions(baseActions({ moveCommandAcross }));

      expect(wrapped.moveCommandAcross).toBeTypeOf("function");
      wrapped.moveCommandAcross?.([0], [1, FORK_THEN_BRANCH_INDEX], 0);
      expect(moveCommandAcross).toHaveBeenCalledWith([0], [1, FORK_THEN_BRANCH_INDEX], 0);
      expect(history.canUndo()).toBe(true);
      history.undo();
      expect(commands).toEqual([{ kind: "text", body: "A" }]);
    });

    it("does not resurrect cancelled edits after the event session history is cleared", () => {
      let commands: Command[] = [{ kind: "text", body: "A" }];
      const key = "map:event:page-cancel";
      const first = createCommandToolbarHistory({
        key,
        readCommands: () => commands,
        replaceCommands: (next) => { commands = next; },
      });
      const wrapped = first.wrapActions(baseActions({
        replaceCommand: (_path, command) => { commands = [command]; },
      }));
      wrapped.replaceCommand([0], { kind: "text", body: "B" });
      expect(first.canUndo()).toBe(true);

      // Cancel restores A and closes the edit session.
      commands = [{ kind: "text", body: "A" }];
      clearCommandToolbarHistories("map:event:");
      const reopened = createCommandToolbarHistory({
        key,
        readCommands: () => commands,
        replaceCommands: (next) => { commands = next; },
      });
      expect(reopened.canUndo()).toBe(false);
      reopened.undo();
      expect(commands).toEqual([{ kind: "text", body: "A" }]);
    });
  });
  describe("nested event command drag/drop DOM", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => { restoreDom = installFakeDom(); });
    afterEach(() => restoreDom?.());

    it("uses the real nested parent path for same-branch row reordering", () => {
      const moveCommandTo = vi.fn();
      const commands: Command[] = [{
        kind: "fork",
        condition: { kind: "switch", switchId: "sw_0001", value: true },
        then: [
          { kind: "text", body: "A" },
          { kind: "text", body: "B" },
        ],
      }];
      const host = renderWithFakeDom(() => {
        const root = document.createElement("div");
        renderCommandList(root, commands, [], baseActions({ moveCommandTo }));
        return root;
      });
      const rows = host.querySelectorAll('[data-testid="event-command-text"]') as unknown as FakeElement[];
      expect(rows).toHaveLength(2);
      startDrag(rows[0]);
      rows[1]?.dispatchEvent(dropEvent([0, FORK_THEN_BRANCH_INDEX, 0]));
      expect(moveCommandTo).toHaveBeenCalledWith([0, FORK_THEN_BRANCH_INDEX, 0], 1);
    });

    it("routes a drop on the empty branch button to that branch instead of the root list", () => {
      const moveCommandAcross = vi.fn();
      const commands: Command[] = [
        {
          kind: "fork",
          condition: { kind: "switch", switchId: "sw_0001", value: true },
          then: [],
        },
        { kind: "text", body: "move me" },
      ];
      const host = renderWithFakeDom(() => {
        const root = document.createElement("div");
        renderCommandList(root, commands, [], baseActions({ moveCommandAcross }));
        return root;
      });
      const empty = host.querySelector(
        `[data-testid="event-command-branch-empty-0-${FORK_THEN_BRANCH_INDEX}"]`,
      ) as unknown as FakeElement | null;

      expect(empty?.dataset.containerPath).toBe(JSON.stringify([0, FORK_THEN_BRANCH_INDEX]));
      startDrag(host.querySelector('[data-testid="event-command-text"]') as unknown as FakeElement);
      empty?.dispatchEvent(dropEvent([1]));
      expect(moveCommandAcross).toHaveBeenCalledWith(
        [1],
        [0, FORK_THEN_BRANCH_INDEX],
        Number.MAX_SAFE_INTEGER,
      );
    });

    it("renders an empty branch drop zone and routes root-to-branch moves across containers", () => {
      const moveCommandAcross = vi.fn();
      const commands: Command[] = [
        {
          kind: "fork",
          condition: { kind: "switch", switchId: "sw_0001", value: true },
          then: [],
        },
        { kind: "text", body: "move me" },
      ];
      const host = renderWithFakeDom(() => {
        const root = document.createElement("div");
        renderCommandList(root, commands, [], baseActions({ moveCommandAcross }));
        return root;
      });
      const zones = host.querySelectorAll('[data-testid="event-command-branch-drop-zone"]') as unknown as FakeElement[];
      const thenZone = zones.find((zone) =>
        zone.dataset.containerPath === JSON.stringify([0, FORK_THEN_BRANCH_INDEX])
      );
      expect(thenZone).toBeTruthy();
      startDrag(host.querySelector('[data-testid="event-command-text"]') as unknown as FakeElement);
      thenZone?.dispatchEvent(dropEvent([1]));
      expect(moveCommandAcross).toHaveBeenCalledWith(
        [1],
        [0, FORK_THEN_BRANCH_INDEX],
        Number.MAX_SAFE_INTEGER
      );
    });
  });
});
