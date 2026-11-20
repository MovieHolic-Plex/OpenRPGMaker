/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { newM2Command } from "@/editor/eventCommandFactory";
import { FORK_THEN_BRANCH_INDEX, resolveCommandAtPath } from "@/editor/eventCommandPaths";
import { mapTarget } from "@/editor/smallTask/target";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/14-m2-modern-logic";
import { hasSessionCheckpoint } from "@/player/checkpoints";
import { createInterpreter } from "@/player/interpreter";
import { currentObjectiveText } from "@/player/zoneFeedback";
import { createBlankProject } from "@/project/defaults";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { startSession } from "@/project/session";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import type { Command, EventPage, GameEvent, M2CommandFields, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectKoreanSentence, expectRefused, expectUndoRestores, loadFixture } from "./harness";
import updateCorpus from "./14-m2-modern-logic/update-corpus.json";

const EVENT = "ev_modern_logic";
const PAGE = "page_modern_logic";
const OTHER = "page_modern_other";
const FIRST: Command = { kind: "text", body: "이 줄은 그대로 남겨 둡니다." };
const VAR = "var_0001";
const SW = "sw_0001";
const MISS = "outside_reference";

const cases: ReadonlyArray<{
  command: string;
  initial: M2CommandFields;
  change: M2CommandFields;
  invalid: M2CommandFields;
  fixture?: "blank" | "built" | "maou";
}> = [
  { command: "206-wait-until", initial: { condition: "eventIdle" }, change: { timeoutMs: 3000 }, invalid: { target: MISS }, fixture: "blank" },
  { command: "208-quest-objective", initial: { questId: "찾아온 부탁", objectiveId: "열쇠", text: "열쇠 찾기" }, change: { state: "complete" }, invalid: { objectiveId: "" } },
  { command: "211-weighted-branch", initial: { table: "성공=3\n실패=1", resultVariableId: VAR }, change: { table: "성공=1\n실패=2" }, invalid: { table: "성공=0\n실패=0" } },
  { command: "214-ui-command", initial: { message: "입구 문을 살펴보세요." }, change: { surface: "banner", durationMs: 1500 }, invalid: { message: "" }, fixture: "maou" },
  { command: "215-debug-log", initial: { message: "재고 확인 시작" }, change: { level: "warn" }, invalid: { message: " " } },
  { command: "216-evaluate-expression", initial: { expression: "gold + 5 * 2", resultVariableId: VAR }, change: { expression: "(10 + 2) / 3" }, invalid: { expression: "missing_variable + 4" } },
  { command: "217-data-query", initial: { query: "playerX", variableId: VAR }, change: { query: "gold" }, invalid: { query: "itemCount", target: MISS } },
  { command: "219-key-poll", initial: { confirmSwitchId: SW }, change: { dirVariableId: VAR }, invalid: { dashSwitchId: MISS } },
  { command: "220-timed-choice", initial: { prompt: "어디로 갈까요?", options: "남문\n북문", resultVariableId: VAR }, change: { timeLimitMs: 10000 }, invalid: { timeLimitMs: 400 } },
  { command: "221-quick-time-event", initial: { keys: "up,z", resultVariableId: VAR }, change: { mode: "mash", keys: "x" }, invalid: { keys: "shift" } },
  { command: "222-high-score", initial: { scoreId: "달리기", valueVariableId: VAR }, change: { action: "submitLow" }, invalid: { valueVariableId: MISS } },
  { command: "223-teleport-menu", initial: { prompt: "돌아갈 곳을 고르세요.", resultVariableId: VAR }, change: { transfer: false }, invalid: { resultVariableId: MISS } },
  { command: "227-journal-line", initial: { text: "숲에서 열쇠를 찾았다." }, change: { writer: "정찰대", date: "셋째 날" }, invalid: { learnSkillId: MISS }, fixture: "maou" },
];

const fixtures = new Map<"blank" | "built" | "maou", Project>();

function fixtureProject(name: "blank" | "built" | "maou") {
  const existing = fixtures.get(name);
  if (existing) return existing;
  const loaded = loadFixture(name);
  fixtures.set(name, loaded);
  return loaded;
}

function scenario(fixture: "blank" | "built" | "maou", commands: Command[] = [FIRST]) {
  const base = fixtureProject(fixture);
  const mapSource = base.startMapId ? base : createBlankProject();
  const id = mapSource.startMapId;
  const template = mapSource.maps[id]!;
  const page: EventPage = {
    id: PAGE, name: "첫 페이지", trigger: { kind: "action" }, priority: "same", conditions: [], graphic: {},
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  };
  const event: GameEvent = {
    id: EVENT, name: "시험 장치", x: 0, y: 0, trigger: page.trigger, commands: [],
    pages: [page, { ...page, id: OTHER, name: "다른 페이지", commands: [] }],
  };
  const project: Project = {
    ...base, startMapId: id, mapTree: mapSource.mapTree,
    maps: { ...base.maps, [id]: { ...template, events: [...template.events, event] } },
  };
  const target = mapTarget(project, id, EVENT, PAGE)!;
  const findEvent = (p: Project) => p.maps[id]!.events.find(candidate => candidate.id === EVENT)!;
  return { project, target, id, findEvent };
}

function session(mapId: string): PlaySessionLike {
  return {
    flags: {}, switches: {}, variables: {}, timers: {}, gold: 7, inventory: {},
    partyActorIds: [], actorVitals: {}, currentMapId: mapId, x: 1, y: 1,
  };
}

function editArgs(commands: readonly Command[], index: number, fields: M2CommandFields) {
  return { index, expectedHash: eventCommandHash(commands[index]!), ...fields };
}

describe("현대 명령 한 줄 편집", () => {
  it.each(cases)("$command 추가·수정·되돌리기", async ({ command, initial, change, fixture = "built" }) => {
    const { project, target, findEvent } = scenario(fixture);
    const insertId = `m2.${command.slice(0, 3)}.insert`;
    const updateId = `m2.${command.slice(0, 3)}.update`;
    const added = runPrimitive(project, target, insertId, initial);
    expectKoreanSentence(added.sentence, target);
    expect(added.sentence).toMatch(/명령을 추가합니다\.$/u);
    const seeded = newM2Command(`m2-${command}`);
    const stored = { ...seeded, fields: { ...seeded.fields, ...initial } };
    expect(findEvent(added.after).pages![0]!.commands).toEqual([FIRST, stored]);
    expect(findEvent(added.after).pages![1]).toBe(findEvent(project).pages![1]);
    expect(findEvent(project).pages![0]!.commands).toEqual([FIRST]);
    await expectUndoRestores(project, added.after, target);

    const updated = runPrimitive(added.after, target, updateId, { index: 1, expectedHash: eventCommandHash(stored), ...change });
    expectKoreanSentence(updated.sentence, target);
    expect(updated.sentence).toMatch(/명령을 수정합니다\.$/u);
    expect(findEvent(updated.after).pages![0]!.commands).toEqual([FIRST, { ...stored, fields: { ...stored.fields, ...change } }]);
    expect(findEvent(added.after).pages![0]!.commands).toEqual([FIRST, stored]);
    await expectUndoRestores(added.after, updated.after, target);
  }, 150_000);

  it.each(cases)("$command 범위 밖 변경과 잘못된 입력 거절", ({ command, initial, invalid }) => {
    const { project, target, id, findEvent } = scenario("built");
    const insertId = `m2.${command.slice(0, 3)}.insert`;
    const updateId = `m2.${command.slice(0, 3)}.update`;
    const args = { ...initial, ...invalid };
    expect(() => runPrimitive(project, target, insertId, args)).toThrow(PrimitiveError);
    const { after } = runPrimitive(project, target, insertId, initial);
    const commands = findEvent(after).pages![0]!.commands;
    expect(() => runPrimitive(after, target, updateId, editArgs(commands, 1, invalid))).toThrow(PrimitiveError);
    expect(() => runPrimitive(after, target, updateId, editArgs(commands, 0, initial))).toThrow(/범위 밖/u);

    for (const primitiveId of [insertId, updateId]) {
      const primitive = PRIMITIVES.find(row => row.id === primitiveId)!;
      const attempted = structuredClone(project);
      findEvent(attempted).pages![1]!.commands.push(FIRST);
      const verdict = checkSmallTaskScope(project, attempted, primitive.scope({ project, target }, { pageId: OTHER }));
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) expect(verdict.reason).toMatch(/범위 밖/u);
      expectRefused(project, mapTarget(project, id)!, primitiveId, { index: 0, ...initial });
    }
    expect(jsonEqual(findEvent(project).pages![0]!.commands, [FIRST])).toBe(true);
  });

  it("체크포인트를 분기 끝에 넣고 실제로 게임 상태를 저장한다", () => {
    const fork: Command = { kind: "fork", condition: { kind: "switch", switchId: SW, value: true }, then: [], else: [FIRST] };
    const { project, target, findEvent } = scenario("built", [fork]);
    const { after } = runPrimitive(project, target, "m2.213.insert", { branchPath: [0, FORK_THEN_BRANCH_INDEX], label: "북문" });
    const commands = findEvent(after).pages![0]!.commands;
    expect(commands).toEqual([{ ...fork, then: [{ kind: "checkpointSave", label: "북문" }] }]);
    expect(findEvent(project).pages![0]!.commands).toEqual([fork]);
    const play = startSession(after);
    play.switches[SW] = true;
    expect(hasSessionCheckpoint(play)).toBe(false);
    expect(createInterpreter(commands, play, after).start()).toEqual({ kind: "done" });
    expect(hasSessionCheckpoint(play)).toBe(true);
  });

  it("분기 안 한 줄을 고치면서 저장된 필드와 다른 분기를 보존하고 오래된 확인값을 거절한다", () => {
    const legacy: Command = {
      kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "toast", message: "기존 안내", legacyNote: "보존" },
    };
    const fork: Command = { kind: "fork", condition: { kind: "switch", switchId: SW, value: true }, then: [legacy], else: [FIRST] };
    const { project, target, findEvent } = scenario("built", [fork]);
    const args = { index: 0, branchPath: [0, FORK_THEN_BRANCH_INDEX], message: "바뀐 안내", expectedHash: eventCommandHash(legacy) };
    const result = runPrimitive(project, target, "m2.214.update", args).after;
    expect(findEvent(result).pages![0]!.commands).toEqual([{
      ...fork, then: [{ ...legacy, fields: { ...legacy.fields, message: "바뀐 안내" } }],
    }]);
    expect(() => runPrimitive(result, target, "m2.214.update", args)).toThrow(/줄의 내용이 바뀌었습니다/u);
  });

  it("같은 종류의 명령이 그 자리에 새로 들어오면 이전 확인값으로 고칠 수 없다", () => {
    const log = (message: string): Command => ({ ...newM2Command("m2-215-debug-log"), fields: { level: "info", message } });
    const original = log("원래 기록");
    const replacement = log("새 기록");
    const { project, target, findEvent } = scenario("built", [replacement, original]);
    expectRefused(project, target, "m2.215.update", { index: 0, message: "수정" }, /형식/u);
    expectRefused(project, target, "m2.215.update", {
      index: 0, expectedHash: eventCommandHash(original), message: "수정",
    }, /줄의 내용이 바뀌었습니다/u);
    expect(findEvent(project).pages![0]!.commands).toEqual([replacement, original]);
  });

  it("없는 분기와 목록 밖 위치를 거절하고 분기에 한 줄만 추가한다", () => {
    const fork: Command = { kind: "fork", condition: { kind: "switch", switchId: SW, value: true }, then: [FIRST] };
    const { project, target, findEvent } = scenario("built", [fork]);
    const insert = (branchPath: number[], index?: number) => runPrimitive(project, target, "m2.215.insert", {
      branchPath, ...(index !== undefined ? { index } : {}), message: "분기 진입",
    });
    expect(() => insert([0])).toThrow(/분기 위치/u);
    expect(() => insert([0, -3])).toThrow(/분기를 찾을 수/u);
    expect(() => insert([0, FORK_THEN_BRANCH_INDEX], 2)).toThrow(/위치에 명령 줄/u);
    expect(() => insert([], Number.MAX_SAFE_INTEGER + 1)).toThrow(/위치에 명령 줄/u);
    expect(() => runPrimitive(project, target, "m2.215.insert", { pageId: OTHER, message: "다른 페이지" })).toThrow(PrimitiveError);
    const { after } = insert([0, FORK_THEN_BRANCH_INDEX], 0);
    expect(findEvent(after).pages![0]!.commands).toEqual([{
      ...fork, then: [{ ...newM2Command("m2-215-debug-log"), fields: { level: "info", message: "분기 진입" } }, FIRST],
    }]);
    expect(findEvent(project).pages![0]!.commands).toEqual([fork]);
  });

  it.each([
    ["m2.211.insert", { table: "성공=1\n실패=오타", resultVariableId: VAR }, /결과 이름=가중치/u],
    ["m2.214.insert", { surface: "banner", message: "북문", durationMs: 3000 }, /배너는 1.5초/u],
    ["m2.214.insert", { surface: "toast", message: "북문", durationMs: 0 }, /0보다 크게/u],
    ["m2.217.insert", { query: "actorHasState", target: "leader:state_poison:extra", variableId: VAR }, /콜론 하나/u],
    ["m2.217.insert", { query: "stringLength", target: "constructor", variableId: VAR }, /다른 이름/u],
    ["m2.219.insert", { confirmSwitchId: SW, cancelSwitchId: SW }, /서로 다른 스위치/u],
    ["m2.221.insert", { mode: "mash", keys: "x,z" }, /키를 하나만/u],
    ["m2.222.insert", { action: "read", scoreId: "달리기" }, /최고 점수 변수/u],
    ["m2.223.insert", { transfer: false }, /고른 장소를 저장할 변수/u],
  ] as const)("%s에서 실제 재생에 반영되지 않는 입력을 거절한다", (primitive, args, reason) => {
    const { project, target } = scenario("built");
    expect(() => runPrimitive(project, target, primitive, args)).toThrow(reason);
  });

  it("미리보기에서 내부 식별자와 자료 구조를 숨긴다", () => {
    const { project, target } = scenario("built");
    const { sentence } = runPrimitive(project, target, "m2.214.insert", {
      message: "{m2-214-ui-command} actor_private [실제 안내 문구] " + "가".repeat(180),
    });
    expectKoreanSentence(sentence);
    expect(sentence.length).toBeLessThanOrEqual(80);
    expect(sentence).not.toMatch(/m2-214|actor_private|[{}\[\]]/u);
  });
});

describe("다른 명령이 사용하는 기록 이름표", () => {
  it("공용 이벤트의 중첩 명령이 같은 퀘스트 목표를 쓰면 이름표를 바꾸지 않는다", () => {
    const { project, target, findEvent } = scenario("built");
    const fields = { questId: "순찰", objectiveId: "북문" };
    project.commonEvents = [...project.commonEvents, {
      id: "ce_modern_review", name: "순찰 완료", trigger: "none", commands: [{
        kind: "loop", body: [{ ...newM2Command("m2-208-quest-objective"), fields: { ...fields, state: "complete" } }],
      }],
    }];
    const { after } = runPrimitive(project, target, "m2.208.insert", fields);
    const commands = findEvent(after).pages![0]!.commands;
    expect(() => runPrimitive(after, target, "m2.208.update", editArgs(commands, 1, { objectiveId: "남문" }))).toThrow(/다른 명령도 이 퀘스트나 목표/u);
    expect(() => runPrimitive(after, target, "m2.208.update", editArgs(commands, 1, { text: "문을 확인하자." }))).not.toThrow();
  });

  it("다른 페이지에서 점수표를 읽으면 마지막 제출 명령을 바꾸지 않는다", () => {
    const readScore = { ...newM2Command("m2-222-high-score"), fields: { scoreId: "달리기", action: "read", resultVariableId: VAR } };
    const { project, target, findEvent } = scenario("built");
    findEvent(project).commands = [{
      ...newM2Command("m2-222-high-score"), fields: { scoreId: "달리기", action: "submit", valueVariableId: VAR },
    }];
    findEvent(project).pages![1]!.commands = [readScore];
    const { after } = runPrimitive(project, target, "m2.222.insert", { scoreId: "달리기", valueVariableId: VAR });
    const commands = findEvent(after).pages![0]!.commands;
    expect(() => runPrimitive(after, target, "m2.222.update", editArgs(commands, 1, { scoreId: "걷기" }))).toThrow(/점수를 올리는 마지막 명령/u);
    expect(() => runPrimitive(after, target, "m2.222.update", editArgs(commands, 1, { action: "reset" }))).toThrow(/점수를 올리는 마지막 명령/u);
    const { after: withSecondWriter } = runPrimitive(after, target, "m2.222.insert", { scoreId: "달리기", valueVariableId: VAR });
    expect(() => runPrimitive(withSecondWriter, target, "m2.222.update", editArgs(commands, 1, { scoreId: "걷기" }))).not.toThrow();
  });

  it("전투 후에 일지를 다시 읽으면 마지막 쓰기 명령을 바꾸지 않는다", () => {
    const reread = { ...newM2Command("m2-227-journal-line"), fields: { action: "reread", lineId: "숲 기록" } };
    const { project, target, findEvent } = scenario("built");
    project.database = { ...project.database, troops: [...project.database.troops, {
      id: "troop_modern_review", name: "일지 부대", enemyIds: [], autoAlign: true, battleEventPages: [],
      afterBattle: { victory: [reread] },
    }] };
    findEvent(project).pages![1]!.commands = [{
      ...newM2Command("m2-227-journal-line"), fields: { action: "write", lineId: "숲 기록", text: " " },
    }];
    const { after } = runPrimitive(project, target, "m2.227.insert", { lineId: "숲 기록", text: "숲에서 열쇠를 찾았다." });
    const commands = findEvent(after).pages![0]!.commands;
    expect(() => runPrimitive(after, target, "m2.227.update", editArgs(commands, 1, { lineId: "다른 기록" }))).toThrow(/줄을 쓰는 마지막 명령/u);
    expect(() => runPrimitive(after, target, "m2.227.update", editArgs(commands, 1, { action: "erase" }))).toThrow(/줄을 쓰는 마지막 명령/u);
    const { after: withErase } = runPrimitive(after, target, "m2.227.insert", { lineId: "숲 기록", action: "erase" });
    const eraseCommands = findEvent(withErase).pages![0]!.commands;
    expect(() => runPrimitive(withErase, target, "m2.227.update", editArgs(eraseCommands, 2, { lineId: "다른 기록" }))).toThrow(/줄을 지우는 마지막 명령/u);
  });
});

describe("추가한 현대 명령을 실제 해석기로 실행", () => {
  function runtime(primitive: string, fields: M2CommandFields) {
    const { project, target, id, findEvent } = scenario("built", []);
    const { after } = runPrimitive(project, target, primitive, fields);
    const play = session(id);
    return { play, interpreter: createInterpreter(findEvent(after).pages![0]!.commands, play, after, { currentEventId: EVENT }) };
  }

  it("조건이 거짓이면 대기하고 스위치가 켜지면 끝낸다", () => {
    const { play, interpreter } = runtime("m2.206.insert", { target: SW, timeoutMs: 3000 });
    expect(interpreter.start()).toMatchObject({ kind: "wait", allowParallelEvents: true });
    play.switches[SW] = true;
    expect(interpreter.resume(undefined)).toEqual({ kind: "done" });
  });

  it("이동 대기 명령에 주인공을 지정할 수 있다", () => {
    const { project, target, id, findEvent } = scenario("built", []);
    const { after } = runPrimitive(project, target, "m2.206.insert", { condition: "eventIdle", target: "player" });
    const interpreter = createInterpreter(findEvent(after).pages![0]!.commands, session(id), after, { isEventIdle: id => id === "player" });
    expect(interpreter.start()).toEqual({ kind: "done" });
  });

  it("빈 현재 목표를 넣으면 앞에서 띄운 목표가 실제로 사라진다", () => {
    const first = { ...newM2Command("m2-214-ui-command"), fields: { surface: "objectiveChip", message: "북문으로 가자.", durationMs: 0 } };
    const { project, target, id, findEvent } = scenario("built", [first]);
    const { after, sentence } = runPrimitive(project, target, "m2.214.insert", { surface: "objectiveChip", message: " " });
    const play = session(id);
    const commands = findEvent(after).pages![0]!.commands;
    expect(createInterpreter(commands.slice(0, 1), play, after).start()).toEqual({ kind: "done" });
    expect(currentObjectiveText(play.m2Runtime?.ui)).toBe("북문으로 가자.");
    expect(createInterpreter(commands.slice(1), play, after).start()).toEqual({ kind: "done" });
    expect(currentObjectiveText(play.m2Runtime?.ui)).toBeNull();
    expect(sentence).toMatch(/현재 목표를 지우는/u);
  });

  it("현재 목표를 짧은 알림으로 바꾸면 보이는 시간이 생기고, 완료 문구는 지우기로 설명한다", () => {
    const current = { ...newM2Command("m2-214-ui-command"), fields: { surface: "objectiveChip", message: "북문으로 가자.", durationMs: 0 } };
    const { project, target, id, findEvent } = scenario("built", [current]);
    const { after } = runPrimitive(project, target, "m2.214.update", editArgs([current], 0, { surface: "toast" }));
    const play = session(id);
    expect(createInterpreter(findEvent(after).pages![0]!.commands, play, after).start()).toEqual({ kind: "done" });
    expect(play.m2Runtime?.ui).toEqual([{ surface: "toast", message: "북문으로 가자.", durationMs: 1600 }]);
    const { sentence } = runPrimitive(project, target, "m2.214.update", editArgs([current], 0, { message: "수집 완료 3/3" }));
    expect(sentence).toMatch(/현재 목표를 지우는/u);
  });

  it("퀘스트 목표는 해당 이름표의 상태와 문구를 남긴다", () => {
    const { play, interpreter } = runtime("m2.208.insert", {
      questId: "순찰", objectiveId: "북문", state: "complete", text: "북문을 살폈다.",
    });
    expect(interpreter.start()).toEqual({ kind: "done" });
    expect(play.m2Runtime?.quests["순찰"]?.["북문"]).toEqual({ state: "complete", text: "북문을 살폈다." });
  });

  it("확률 결과는 0보다 큰 가중치 줄에 매긴 0부터의 번호로 저장한다", () => {
    const { play, interpreter } = runtime("m2.211.insert", { table: "없음=0\n열쇠=5", resultVariableId: VAR });
    expect(interpreter.start()).toEqual({ kind: "done" });
    expect(play.variables[VAR]).toBe(0);
  });

  it("식 계산은 소지금과 곱셈 우선순위를 반영한다", () => {
    const { play, interpreter } = runtime("m2.216.insert", { expression: "gold + 5 * 2", resultVariableId: VAR });
    expect(interpreter.start()).toEqual({ kind: "done" });
    expect(play.variables[VAR]).toBe(17);
  });

  it("제한시간 선택은 선택지 순서와 응답 번호를 보존한다", () => {
    const { play, interpreter } = runtime("m2.220.insert", { options: "남문\n북문", timeLimitMs: 10000, resultVariableId: VAR });
    expect(interpreter.start()).toEqual({ kind: "timedChoice", options: ["남문", "북문"], timeLimitMs: 10000 });
    expect(interpreter.resume(2)).toEqual({ kind: "done" });
    expect(play.variables[VAR]).toBe(2);
  });

  it("일지에는 입력한 글과 기록자 이름을 남긴다", () => {
    const { play, interpreter } = runtime("m2.227.insert", { text: "숲에서 열쇠를 찾았다.", writer: "정찰대" });
    expect(interpreter.start()).toEqual({ kind: "done" });
    expect(play.storyJournal).toEqual([{ id: "line-1", writer: "정찰대", date: "", text: "숲에서 열쇠를 찾았다.", state: "normal" }]);
  });
});

type PreparedCase = CorpusCase & { setup: Pick<CorpusCase, "primitive" | "args"> };

describe("기본 픽스처에 없는 명령의 수정 요청", () => {
  it.each(updateCorpus as PreparedCase[])("$request", async entry => {
    const fixture = fixtureProject(entry.fixture);
    const target = resolveTarget(fixture, entry.target);
    const { after: before } = runPrimitive(fixture, target, entry.setup.primitive, entry.setup.args);
    if (target.kind !== "event") throw new Error("검수할 이벤트를 찾을 수 없습니다.");
    const event = before.maps[target.mapId]?.events.find(event => event.id === target.eventId);
    const page = event?.pages?.find(page => page.id === target.pageId);
    const command = page && resolveCommandAtPath(page.commands, [
      ...(entry.args.branchPath as number[] | undefined ?? []), entry.args.index as number,
    ]);
    if (!command) throw new Error("검수할 명령을 찾을 수 없습니다.");
    const apply = () => runPrimitive(before, target, entry.primitive, { expectedHash: eventCommandHash(command), ...entry.args });
    if (entry.expectRefusal) {
      expect(apply).toThrow(PrimitiveError);
      return;
    }
    const { after, sentence } = apply();
    expectKoreanSentence(sentence, target);
    expect(entry.expect?.length).toBeGreaterThan(0);
    for (const check of entry.expect ?? []) expect(readCheckPath(after, check.at), check.at).toEqual(check.equals);
    await expectUndoRestores(before, after, target);
  });
});
