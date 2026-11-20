/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { FORK_ELSE_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { normalizeEventPage } from "@/editor/eventPages";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/30-common-events";
import { dbTarget, mapTarget } from "@/editor/smallTask/target";
import { APPLY_SMALL_TASK_PRIMITIVE, runSmallTaskPrimitiveTool } from "@/editor/tools/smallTaskPrimitiveTools";
import { getTool } from "@/editor/tools/toolRegistry";
import { createInterpreter } from "@/player/interpreter";
import { createBlankMap, singleNodeTree } from "@/project/defaults/defaultMaps";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { scriptSourceHash } from "@/project/script/types";
import { getSwitch, getVariable, startSession } from "@/project/session";
import type { Command, CommonEvent, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectKoreanSentence, expectRefused, expectUndoRestores, loadFixture } from "./harness";

const eventId = "ce_test_bonus";
const switchId = "sw_0001";
const variableId = "var_0001";
const gold: Command = { kind: "changeGold", op: "+=", amount: 3 };
const setSwitch: Command = { kind: "setSwitch", switchId, value: true };
const count: Command = { kind: "setVariable", variableId, op: "+=", value: 1 };
const call: Command = { kind: "callCommonEvent", commonEventId: eventId };

function commonEvent(commands: Command[] = []): CommonEvent {
  return { id: eventId, name: "여관 혜택", trigger: "none", commands };
}

function startMapTarget(project: Project) {
  const target = mapTarget(project, project.startMapId);
  if (!target) throw new Error("시작 맵이 필요합니다.");
  return target;
}

function seed(commands: Command[] = [], fixture: "built" | "maou" = "built"): Project {
  const project = loadFixture(fixture);
  const map = project.maps[project.startMapId];
  const maps = { ...project.maps, [map.id]: { ...map } };
  return { ...project, maps, commonEvents: [...project.commonEvents, commonEvent(commands)] };
}

function runOn(project: Project, id: string, args: Record<string, unknown>) {
  return runPrimitive(project, startMapTarget(project), id, args);
}

const wait: Command = { kind: "wait", ms: 700 };
const stored = commonEvent([gold, wait]);
const fork: Command = { kind: "fork", condition: { kind: "switch", switchId, value: true }, then: [wait] };
const cases = [
  {
    id: "commonEvent.create", args: { name: "  여관 회복  " },
    expected: [stored, { id: "ce_1", name: "여관 회복", trigger: "none", commands: [] }],
    sentence: "이름이 「여관 회복」인 공용 이벤트를 만들어요.",
  },
  {
    id: "commonEvent.rename", args: { commonEventId: eventId, name: "숙박 혜택" },
    expected: [{ ...stored, name: "숙박 혜택" }],
    sentence: "「여관 혜택」의 이름을 「숙박 혜택」으로 바꿔요.",
  },
  {
    id: "commonEvent.trigger.set", args: { commonEventId: eventId, trigger: "auto", conditionSwitchId: switchId },
    expected: [{ ...stored, trigger: "auto", conditionSwitchId: switchId }],
    sentence: "「여관 혜택」에 ‘자동 실행’ 방식과 스위치 켜짐 조건을 설정해요.",
  },
  {
    id: "commonEvent.remove", args: { commonEventId: eventId }, expected: [],
    sentence: "「여관 혜택」 항목을 공용 이벤트 목록에서 지워요.",
  },
  {
    id: "commonEvent.command.insert", args: { commonEventId: eventId, index: 1, command: { kind: "text", body: "오늘의 혜택이에요." } },
    expected: [{ ...stored, commands: [gold, { kind: "text", speaker: "", body: "오늘의 혜택이에요." }, wait] }],
    sentence: "「여관 혜택」에 ‘문장 표시’ 명령을 넣어요.",
  },
  {
    id: "commonEvent.command.update", args: { commonEventId: eventId, index: 1, expectedCommand: wait, patch: { ms: 1000 } },
    expected: [{ ...stored, commands: [gold, { kind: "wait", ms: 1000 }] }],
    sentence: "「여관 혜택」에 있는 ‘대기’ 명령을 고쳐요.",
  },
  {
    id: "commonEvent.command.delete", args: { commonEventId: eventId, index: 0, expectedCommand: gold },
    expected: [{ ...stored, commands: [wait] }],
    sentence: "「여관 혜택」에 있는 ‘소지금 변경’ 명령을 지워요.",
  },
];

describe("공용 이벤트", () => {
  it.each(cases)("$id 저장, 한 문장, 되돌리기", async ({ id, args, expected, sentence }) => {
    const project = seed(stored.commands, id === "commonEvent.rename" ? "maou" : "built");
    const original = structuredClone(project.commonEvents);
    const target = startMapTarget(project);
    const result = runPrimitive(project, target, id, args);
    expect(result.after.commonEvents).toEqual([...original.slice(0, -1), ...expected]);
    expect(result.after.maps).toBe(project.maps);
    expect(result.after.database).toBe(project.database);
    expect(jsonEqual(project.commonEvents, original)).toBe(true);
    expect(result.sentence).toBe(sentence);
    expectKoreanSentence(result.sentence);
    await expectUndoRestores(project, result.after, target);
  }, 150_000);

  it.each(cases)("$id 범위 밖의 변경 거부", ({ id, args }) => {
    const project = seed(stored.commands);
    const otherEvent = { ...stored, id: "ce_other", name: "다른 공용 이벤트" };
    project.commonEvents = [otherEvent, ...project.commonEvents];
    const target = startMapTarget(project);
    const primitive = PRIMITIVES.find(row => row.id === id)!;
    const scope = primitive.scope({ project, target }, args);
    const { after } = runPrimitive(project, target, id, args);
    const changedTitle = { ...after, meta: { ...after.meta, title: "다른 프로젝트 제목" } };
    expect(checkSmallTaskScope(project, changedTitle, scope)).toMatchObject({
      ok: false, reason: expect.stringContaining("범위 밖"),
    });
    expect(after.commonEvents[0]).toBe(otherEvent);
    const changedOther = { ...after, commonEvents: [{ ...otherEvent, name: "범위 밖 새 이름" }, ...after.commonEvents.slice(1)] };
    expect(checkSmallTaskScope(project, changedOther, scope)).toMatchObject({
      ok: false, violations: [{ what: "공용 이벤트의 선택하지 않은 항목" }],
    });
    const createdExtra = { ...after, commonEvents: [...after.commonEvents, { ...otherEvent, id: "ce_extra" }] };
    expect(checkSmallTaskScope(project, createdExtra, scope)).toMatchObject({
      ok: false, violations: [{ what: "공용 이벤트의 새 항목 수" }],
    });

    const other = dbTarget(project, "actors", project.database.actors[0]!.id)!;
    expectRefused(project, other, id, args);
  });

  it("기존 공용 이벤트와 겹치지 않는 식별자를 골라 목록 끝에 추가한다", () => {
    const project = seed();
    project.commonEvents = [...project.commonEvents, { ...stored, id: "ce_1" }];
    const { after } = runOn(project, "commonEvent.create", { name: "여관 회복" });
    expect(after.commonEvents.at(-1)).toEqual({ id: "ce_2", name: "여관 회복", trigger: "none", commands: [] });
    expect(after.commonEvents.slice(0, -1)).toEqual(project.commonEvents);
    expect(() => runOn(project, "commonEvent.create", { name: " " })).toThrow("이름을 입력해 주세요");
  });

  it("실행 방식만 바꾸면 스위치를 유지하고, 비우라는 요청은 조건을 지운다", () => {
    const project = seed();
    project.commonEvents.at(-1)!.conditionSwitchId = switchId;
    const args = { commonEventId: eventId, trigger: "parallel" };
    const { after } = runOn(project, "commonEvent.trigger.set", args);
    expect(after.commonEvents.at(-1)).toEqual({ ...commonEvent(), trigger: "parallel", conditionSwitchId: switchId });
    const cleared = runOn(after, "commonEvent.trigger.set", { ...args, trigger: "none", conditionSwitchId: null });
    expect(cleared.after.commonEvents.at(-1)).toEqual(commonEvent());
    expect(() => runOn(project, "commonEvent.trigger.set", { ...args, conditionSwitchId: "sw_missing" })).toThrow("스위치를 찾을 수 없습니다");
    expect(() => runOn(project, "commonEvent.trigger.set", { ...args, trigger: "none", conditionSwitchId: switchId })).toThrow("자동 실행이나 병렬 처리");
    project.commonEvents.at(-1)!.conditionSwitchId = "sw_missing";
    expect(() => runOn(project, "commonEvent.trigger.set", args)).toThrow("스위치를 찾을 수 없습니다");
    expect(runOn(project, "commonEvent.trigger.set", { ...args, conditionSwitchId: null }).after.commonEvents.at(-1))
      .toEqual({ ...commonEvent(), trigger: "parallel" });
  });

  it("맵 페이지와 공용 이벤트, 전투 페이지의 중첩 호출자를 이름으로 알려 준다", () => {
    const project = seed();
    const map = project.maps[project.startMapId]!;
    map.events = [...map.events, {
      id: "ev_inn_entrance", name: "여관 입구", x: 0, y: 0, trigger: { kind: "action" }, commands: [],
      pages: [normalizeEventPage({ id: "page_inn", name: "안내", commands: [{ kind: "loop", body: [call] }] })],
    }];
    project.commonEvents = [...project.commonEvents, { ...commonEvent([call]), id: "ce_test_opening", name: "아침 알림" }];
    const troop = project.database.troops[0]!;
    project.database = {
      ...project.database,
      troops: [{
        ...troop, name: "동굴 경비대",
        battleEventPages: [{ id: "page_battle", name: "전투 준비", conditions: [], span: "battle", commands: [call] }],
      }, ...project.database.troops.slice(1)],
    };
    expect(() => runOn(project, "commonEvent.remove", { commonEventId: eventId }))
      .toThrow(/여관 입구.*안내.*아침 알림.*동굴 경비대.*전투 준비.*지울 수 없습니다/u);
  });

  it("편집 중인 맵 이벤트가 원본에 호출을 남겨 두면 공용 이벤트 삭제를 거부한다", () => {
    const project = seed();
    const original = { id: "ev_inn_gift", name: "여관 주인", x: 0, y: 0, commands: [call], trigger: { kind: "action" } } satisfies GameEvent;
    const map = project.maps[project.startMapId]!;
    map.events = [...map.events, { ...original, commands: [], draft: { kind: "edit", original } }];
    expect(() => runOn(project, "commonEvent.remove", { commonEventId: eventId })).toThrow(/여관 주인.*지울 수 없습니다/u);
  });

  it("자기 자신을 호출하는 공용 이벤트도 삭제할 수 없다", () => {
    expect(() => runOn(seed([call]), "commonEvent.remove", { commonEventId: eventId })).toThrow(/여관 혜택.*지울 수 없습니다/u);
  });

  it.each(["전투 명령", "직업", "필드 스킬"] as const)("자료집의 %s에서 사용하는 동안 삭제를 거부하고 이름 변경은 허용한다", source => {
    const project = seed();
    const entry = { id: "linked_command", name: "여관기술", kind: "commonEvent", commonEventId: eventId } as const;
    if (source === "전투 명령") project.database.battleCommands = [entry];
    if (source === "직업") project.database.classes[0]!.battleCommands = [entry];
    if (source === "필드 스킬") project.database.skills[0]!.fieldCommonEventId = eventId;
    const args = { commonEventId: eventId };
    expect(() => runOn(project, "commonEvent.remove", args)).toThrow(new RegExp(`${source}.*지울 수 없습니다`, "u"));
    const { after } = runOn(project, "commonEvent.rename", { ...args, name: "새 혜택" });
    expect(after.commonEvents.at(-1)).toEqual({ ...commonEvent(), name: "새 혜택" });
    expect(after.database).toBe(project.database);
  });

  it("전투 페이지에 이전 방식의 호출이 남아 있으면 삭제를 거부한다", () => {
    const project = seed();
    const troop = project.database.troops[0]!;
    troop.battleEventPages = [{
      id: "old_call_page", name: "개막", conditions: [], span: "battle",
      commands: [{ kind: "m2Command", commandId: "m2-106-call-common-event", fields: { value: `  ${eventId}  ` } }],
    }];
    expect(() => runOn(project, "commonEvent.remove", { commonEventId: eventId })).toThrow(/개막.*지울 수 없습니다/u);
  });

  it("이벤트 초안의 저장 원본에 스크립트 호출이 있으면 삭제를 거부한다", () => {
    const project = seed();
    const map = project.maps[project.startMapId]!;
    const source = `await game.callCommonEvent("${eventId}");`;
    const original = {
      id: "ev_script_original", name: "여관 종소리", x: 0, y: 0, trigger: { kind: "action" },
      commands: [{
        kind: "script", source, compiled: source,
        effects: { reads: [], writes: [], calls: [{ kind: "commonEvent", id: eventId }], dynamic: [] },
      }],
    } satisfies GameEvent;
    map.events = [...map.events, { ...original, commands: [], draft: { kind: "edit", original } }];
    expect(() => runOn(project, "commonEvent.remove", { commonEventId: eventId })).toThrow(/여관 종소리.*지울 수 없습니다/u);
  });

  it("구형 스크립트의 호출 대상을 확인할 수 없으면 삭제를 거부한다", () => {
    const project = seed([{ kind: "script", source: "await game.callCommonEvent(id)", compiled: "await game.callCommonEvent(id)" }]);
    expect(() => runOn(project, "commonEvent.remove", { commonEventId: eventId })).toThrow("사용하는지 확인할 수 없습니다");
  });

  it("라이브러리 스크립트의 호출 대상을 확인할 수 없으면 삭제를 거부한다", () => {
    const project = seed();
    const source = "export const run = async (id) => { await game.callCommonEvent(id); };";
    project.scriptLibrary = [{
      id: "bonus_runner", source, compiled: source,
      effects: { calls: [], reads: [], writes: [], dynamic: [{ api: "callCommonEvent", line: 1 }] },
    }];
    const args = { commonEventId: eventId };
    expect(() => runOn(project, "commonEvent.remove", args)).toThrow("사용하는지 확인할 수 없습니다");
    project.scriptLibrary = [];
    expect(runOn(project, "commonEvent.remove", args).after.commonEvents).toEqual([]);
  });

  it.each([
    { title: "분기 안의 호출", source: `await game.cmd({ kind: "loop", body: [{ kind: "callCommonEvent", commonEventId: "${eventId}" }] });` },
    { title: "다른 이름으로 꺼낸 호출", source: `const call = game.callCommonEvent; await call("${eventId}");` },
  ])("스크립트의 $title이 기록에서 빠져도 삭제를 거부한다", ({ source }) => {
    const project = seed();
    const caller = commonEvent([{
      kind: "script", source, compiled: source, effects: { calls: [], reads: [], writes: [], dynamic: [] },
    }]);
    project.commonEvents.unshift({ ...caller, id: "ce_other", name: "가게 판매" });
    expect(() => runOn(project, "commonEvent.remove", { commonEventId: eventId })).toThrow("사용하는지 확인할 수 없습니다");
  });

  it("자료집에서 읽은 기존 명령으로 수정하고, 줄이 밀리면 수정과 삭제를 거부한다", async () => {
    const project = seed([wait, gold]);
    const read = getTool("get_database_records")!.run(project, { collection: "commonEvents", ids: [eventId], include: "full" });
    const { records } = read.data as { records: CommonEvent[] };
    const ctx = { project, smallTaskTarget: startMapTarget(project) };
    const args = { commonEventId: eventId, index: 0, expectedCommand: records[0]!.commands[0], patch: { ms: 900 } };
    await runSmallTaskPrimitiveTool(ctx, APPLY_SMALL_TASK_PRIMITIVE, { id: "commonEvent.command.update", args });
    expect(ctx.project.commonEvents.at(-1)?.commands).toEqual([{ ...wait, ms: 900 }, gold]);

    const shifted = runOn(project, "commonEvent.command.insert", { commonEventId: eventId, index: 0, command: gold }).after;
    expect(() => runOn(shifted, "commonEvent.command.update", args)).toThrow("그 줄의 내용이 바뀌었습니다");
    expect(() => runOn(shifted, "commonEvent.command.delete", { commonEventId: eventId, index: 0, expectedHash: eventCommandHash(wait) }))
      .toThrow("그 줄의 내용이 바뀌었습니다");
    expect(() => runOn(project, "commonEvent.command.delete", { commonEventId: eventId, index: 0 }))
      .toThrow("기존 명령을 다시 읽고");
    expect(runOn(project, "commonEvent.command.delete", { commonEventId: eventId, index: 0, expectedHash: eventCommandHash(wait) })
      .after.commonEvents.at(-1)?.commands).toEqual([gold]);
  });

  it("중첩 위치에서 한 줄만 추가하고 수정하고 지운다", () => {
    const project = seed([fork, gold]);
    const args = { commonEventId: eventId, index: 0, branchPath: [0, FORK_THEN_BRANCH_INDEX] };
    const inserted = runOn(project, "commonEvent.command.insert", { ...args, command: { kind: "wait" } }).after;
    const updated = runOn(inserted, "commonEvent.command.update", { ...args, expectedCommand: { kind: "wait", ms: 500 }, patch: { ms: 100 } }).after;
    expect(updated.commonEvents.at(-1)?.commands).toEqual([{ ...fork, then: [{ kind: "wait", ms: 100 }, wait] }, gold]);
    const deleted = runOn(updated, "commonEvent.command.delete", { ...args, expectedCommand: { kind: "wait", ms: 100 } }).after;
    expect(jsonEqual(project, deleted)).toBe(true);
  });

  it("분기 자식의 일괄 추가·덮어쓰기·삭제를 모두 거부한다", () => {
    const project = seed([fork]);
    const args = { commonEventId: eventId, index: 0 };
    expect(() => runOn(project, "commonEvent.command.insert", { ...args, command: { kind: "loop", body: [gold] } })).toThrow("따로 넣어 주세요");
    expect(() => runOn(project, "commonEvent.command.update", { ...args, expectedCommand: fork, patch: { then: [] } })).toThrow("따로 고쳐야 합니다");
    expect(() => runOn(project, "commonEvent.command.delete", { ...args, expectedCommand: fork })).toThrow("분기 안에 명령이 남아");
    expect(() => runOn(project, "commonEvent.command.insert", { ...args, branchPath: [0, LOOP_BODY_BRANCH_INDEX], command: gold }))
      .toThrow("명령 줄을 찾을 수 없습니다");
  });

  it("아직 비어 있는 조건 거짓 분기에 첫 줄을 넣고, 어긋난 경로는 거부한다", () => {
    const project = seed([fork, gold]);
    const args = { commonEventId: eventId, index: 0, branchPath: [0, FORK_ELSE_BRANCH_INDEX], command: gold };
    expect(runOn(project, "commonEvent.command.insert", args).after.commonEvents.at(-1)?.commands)
      .toEqual([{ ...fork, else: [gold] }, gold]);
    expect(project.commonEvents.at(-1)?.commands).toEqual([fork, gold]);
    expect(() => runOn(project, "commonEvent.command.insert", { ...args, branchPath: [0] })).toThrow("분기 위치를 다시 확인");
    expect(() => runOn(project, "commonEvent.command.insert", { ...args, index: 1 })).toThrow("명령 줄을 찾을 수 없습니다");
  });

  it("분기 안에서 라벨을 사용하는 동안 이름 변경과 삭제를 막고, 독립 분기의 라벨은 지운다", () => {
    const label: Command = { kind: "label", name: "다음 장면" };
    const jump: Command = { kind: "gotoLabel", name: label.name };
    const project = seed([label, { ...fork, then: [jump] }]);
    const args = { commonEventId: eventId, index: 0, expectedCommand: label };
    expect(() => runOn(project, "commonEvent.command.update", { ...args, patch: { name: "끝" } })).toThrow("이 라벨로 이동하는 명령");
    expect(() => runOn(project, "commonEvent.command.delete", args)).toThrow("이 라벨로 이동하는 명령");
    expect(() => runOn(seed(), "commonEvent.command.insert", { commonEventId: eventId, command: jump })).toThrow("이동할 라벨을 찾을 수 없습니다");
    const independent = seed([{ ...fork, then: [label, jump], else: [label] }]);
    expect(runOn(independent, "commonEvent.command.delete", { ...args, branchPath: [0, FORK_ELSE_BRANCH_INDEX] }).after.commonEvents.at(-1)?.commands)
      .toEqual([{ ...fork, then: [label, jump], else: [] }]);
    expect(() => runOn(project, "commonEvent.command.insert", {
      commonEventId: eventId, index: 0, branchPath: [1, FORK_THEN_BRANCH_INDEX], command: label,
    })).toThrow("다른 라벨로 이동합니다");
  });

  it("호출된 공용 이벤트의 이동 명령이 호출자의 라벨을 쓰면 삭제를 거부한다", () => {
    const label: Command = { kind: "label", name: "마무리" };
    const calleeId = "ce_callee";
    const project = seed([{ kind: "callCommonEvent", commonEventId: calleeId }, label]);
    project.commonEvents.push({ ...commonEvent([{ kind: "gotoLabel", name: label.name }]), id: calleeId });
    const args = { commonEventId: eventId, index: 1, expectedCommand: label };
    expect(() => runOn(project, "commonEvent.command.delete", args)).toThrow("이 라벨로 이동하는 명령");
  });

  it("스크립트로 호출된 공용 이벤트의 이동 명령도 호출자의 라벨을 보호한다", () => {
    const calleeId = "ce_script_callee";
    const label: Command = { kind: "label", name: "마무리" };
    const source = `await game.callCommonEvent("${calleeId}");`;
    const project = seed([{
      kind: "script", source, compiled: source,
      effects: { calls: [{ kind: "commonEvent", id: calleeId }], reads: [], writes: [], dynamic: [] },
    }, label]);
    project.commonEvents.unshift({ ...commonEvent([{ kind: "gotoLabel", name: label.name }]), id: calleeId });
    expect(() => runOn(project, "commonEvent.command.delete", { commonEventId: eventId, index: 1, expectedCommand: label }))
      .toThrow("이 라벨로 이동하는 명령");
  });

  it.each([
    { kind: "setSwitch", switchId: "sw_missing", value: true },
    { kind: "changeItem", itemId: "item_missing", op: "+=", amount: 3 },
    { kind: "transfer", mapId: "map_missing", x: 0, y: 0 },
    { kind: "changeParty", actorId: "actor_missing", action: "add" },
    { kind: "callCommonEvent", commonEventId: "ce_missing" },
    { kind: "callMapEvent", eventId: "ev_missing" },
    { kind: "wait", ms: 500, variableId: "var_missing" },
    { kind: "playAudio", channel: "se", resourceId: "sound_missing" },
  ])("삽입 전 없는 참조 거부 ($kind)", command => {
    const project = seed();
    expect(() => runOn(project, "commonEvent.command.insert", { commonEventId: eventId, command }))
      .toThrow(/찾을 수 없습니다/u);
    expect(project.commonEvents.at(-1)).toEqual(commonEvent());
  });

  it("빈 문장, 맵 바깥 좌표, 잘못된 변수 연산자를 거부한다", () => {
    const project = seed();
    const args = { commonEventId: eventId };
    const insert = (command: Record<string, unknown>) => runOn(project, "commonEvent.command.insert", { ...args, command });
    expect(() => insert({ kind: "text", body: "  " })).toThrow("표시할 문장을 입력");
    expect(() => insert({ kind: "transfer", mapId: project.startMapId, x: -1, y: 0 })).toThrow("맵 범위를 벗어났습니다");
    expect(() => insert({ kind: "setVariable", variableId, op: "add", value: 1 })).toThrow("계산 방식을 골라");
    expect(() => insert({ kind: "setVariable", variableId, op: "/=", value: 0 })).toThrow("0으로 나눌 수 없습니다");
    expect(() => insert({ kind: "wait", ms: Number.MAX_SAFE_INTEGER + 1 })).toThrow(PrimitiveError);
    expect(() => insert({ kind: "changeTile", mapId: project.startMapId, layer: "upper", x: 0, y: 0, tile: -2 }))
      .toThrow("타일 번호를 확인해 주세요");
  });

  it("한 줄에서 중첩 조건의 존재하지 않는 스위치나 스킬을 거부한다", () => {
    const project = seed();
    const args = { commonEventId: eventId };
    expect(() => runOn(project, "commonEvent.command.insert", {
      ...args,
      command: { kind: "fork", condition: { kind: "not", condition: { kind: "switch", switchId: "sw_missing", value: true } } },
    })).toThrow("조건에서 가리키는 대상을 찾을 수 없습니다");
    expect(() => runOn(project, "commonEvent.command.insert", {
      ...args,
      command: { kind: "choices", cancelBehavior: "disallow", options: [
        { text: "다음", branch: [], enableWhen: { kind: "partyKnowsSkill", skillId: "skill_missing" } },
      ] },
    })).toThrow("조건에서 가리키는 대상을 찾을 수 없습니다");
  });

  it("기타 명령의 일부 항목만 고치고 숫자 상한을 검사한다", () => {
    const tint: Command = {
      kind: "m2Command", commandId: "m2-046-tint-screen", fields: { color: "neutral", saturation: 100, durationMs: 480 },
    };
    const project = seed([tint]);
    const args = { commonEventId: eventId, index: 0, expectedCommand: tint };
    const { after } = runOn(project, "commonEvent.command.update", { ...args, patch: { fields: { saturation: 150 } } });
    expect(after.commonEvents.at(-1)?.commands).toEqual([{ ...tint, fields: { ...tint.fields, saturation: 150 } }]);
    expect(() => runOn(project, "commonEvent.command.update", { ...args, patch: { fields: { saturation: 201 } } }))
      .toThrow("숫자 범위를 확인해 주세요");
  });

  it("스크립트 이름만 고칠 수 있고 코드와 참조 기록의 교체는 거부한다", () => {
    const source = `await game.callCommonEvent("${eventId}");`;
    const script: Command = {
      kind: "script", name: "공용 이벤트 호출", source, compiled: source, sourceHash: scriptSourceHash(source),
      effects: { calls: [{ kind: "commonEvent", id: eventId }], reads: [], writes: [], dynamic: [] },
    };
    const project = seed([script]);
    const args = { commonEventId: eventId, index: 0, expectedCommand: script };
    expect(runOn(project, "commonEvent.command.update", { ...args, patch: { name: "혜택 호출" } }).after.commonEvents.at(-1)?.commands)
      .toEqual([{ ...script, name: "혜택 호출" }]);
    expect(() => runOn(project, "commonEvent.command.update", { ...args, patch: { compiled: "await game.wait(1);" } }))
      .toThrow("스크립트 편집기에서");
    expect(() => runOn(project, "commonEvent.command.update", { ...args, patch: { effects: { calls: [], reads: [], writes: [], dynamic: [] } } }))
      .toThrow("스크립트 편집기에서");
    expect(() => runOn(seed(), "commonEvent.command.insert", { commonEventId: eventId, command: script }))
      .toThrow("스크립트 편집기에서");
  });

  it("분기 부모를 수정할 때 손대지 않은 자식 줄의 기존 참조 오류는 그대로 둔다", () => {
    const original: Command = { ...fork, then: [{ ...setSwitch, switchId: "sw_already_missing" }] };
    const project = seed([original]);
    const condition = { kind: "switch", switchId, value: false };
    expect(runOn(project, "commonEvent.command.update", {
      commonEventId: eventId, index: 0, expectedCommand: original, patch: { condition },
    }).after.commonEvents.at(-1)?.commands).toEqual([{ ...original, condition }]);
  });

  it("고친 한 줄의 새 참조도 검사한다", () => {
    const args = { commonEventId: eventId, index: 0, expectedCommand: setSwitch, patch: { switchId: "sw_missing" } };
    expect(() => runOn(seed([setSwitch]), "commonEvent.command.update", args)).toThrow("대상을 찾을 수 없습니다");
  });

  it("종류가 빠진 명령은 기본 대사로 바꾸지 않고 거부한다", () => {
    expect(() => runOn(seed(), "commonEvent.command.insert", { commonEventId: eventId, command: {} }))
      .toThrow(PrimitiveError);
  });

  it("길거나 식별자를 포함한 이름은 미리보기에서 안전하게 줄인다", () => {
    const map = { ...createBlankMap("빈 맵", 3, 3), id: "map_common_events" };
    const project: Project = {
      ...loadFixture("blank"),
      maps: { [map.id]: map },
      startMapId: map.id,
      mapTree: singleNodeTree(map.id),
    };
    const name = "ce_private 이름 ".repeat(15).trim();
    const { after, sentence } = runOn(project, "commonEvent.create", { name });
    expect(after.commonEvents).toEqual([{ id: "ce_1", name, trigger: "none", commands: [] }]);
    expectKoreanSentence(sentence);
    expect(sentence).not.toContain("ce_private");
  });
});

describe("공용 이벤트 호출 런타임", () => {
  function execute(project: Project) {
    const session = startSession(project, 1);
    const startingGold = session.gold;
    expect(createInterpreter([call], session, project).start()).toEqual({ kind: "done" });
    return { session, startingGold };
  }

  it("추가한 명령이 공용 이벤트를 부를 때 소지금을 세 개 늘린다", () => {
    const { after } = runOn(seed(), "commonEvent.command.insert", { commonEventId: eventId, command: gold });
    const { session, startingGold } = execute(after);
    expect(session.gold).toBe(startingGold + 3);
  });

  it("변수를 늘리는 수를 고치면 다음 호출이 바뀐 값으로 실행된다", () => {
    const { after } = runOn(seed([count]), "commonEvent.command.update", { commonEventId: eventId, index: 0, expectedCommand: count, patch: { value: 5 } });
    const { session } = execute(after);
    expect(getVariable(session, variableId)).toBe(5);
  });

  it("스위치 줄을 지워도 다음 줄은 그대로 실행된다", () => {
    const { after } = runOn(seed([setSwitch, count]), "commonEvent.command.delete", { commonEventId: eventId, index: 0, expectedCommand: setSwitch });
    const { session } = execute(after);
    expect(getSwitch(session, switchId)).toBe(false);
    expect(getVariable(session, variableId)).toBe(1);
  });
});
