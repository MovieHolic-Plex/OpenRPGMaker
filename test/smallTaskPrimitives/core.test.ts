/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { CORE_PRIMITIVES } from "@/editor/smallTask/primitives/core/commands";
import { PRIMITIVES as equipmentPrimitives } from "@/editor/smallTask/primitives/units/19-db-items-equipment";
import { eventName, insertAtIndex, koreanSentence, mapName, recordName } from "@/editor/smallTask/primitives/core/helpers";
import { primitiveScope } from "@/editor/smallTask/primitives/core/scope";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { createPrimitiveRegistry } from "@/editor/smallTask/primitives/registry";
import { matchesPrimitiveSchema, runPrimitive } from "@/editor/smallTask/primitives/run";
import { smallTaskBase } from "@/editor/smallTask/history";
import { mapTarget as makeTarget } from "@/editor/smallTask/target";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { openingStageFlag } from "@/project/openingStage";
import type { QuestGraphConditionExpression } from "@/project/quest/questDef";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { runSmallTaskPrimitiveTool } from "@/editor/tools/smallTaskPrimitiveTools";
import { getTool, toOpenAiTools } from "@/editor/tools/toolRegistry";
import { createBlankProjectCopy, eventTarget, expectApplies, expectRefused, expectUndoRestores, runHeadless } from "./harness";

function fixture(commands: Command[] = [{ kind: "text", body: "첫 줄" }, { kind: "text", body: "둘째 줄" }]) {
  const before = createBlankProjectCopy();
  const map = before.maps[before.startMapId];
  before.tilesets = { [map.tilesetId]: { ...before.tilesets[map.tilesetId], referenceDocuments: [] } };
  before.assets = { sprites: {}, uploaded: {} };
  before.resourceProfiles = [];
  const page: EventPage = { id: "page_first", name: "인사", conditions: [], trigger: { kind: "action" },
    graphic: {}, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands };
  const spare = { ...page, id: "page_other", commands: [{ kind: "wait", ms: 50 } as const] };
  const event: GameEvent = { id: "ev_first", name: "안내인", x: 2, y: 3, trigger: page.trigger, commands: [], pages: [page, spare] };
  map.events = [event, { ...event, id: "ev_other", pages: [spare] }];
  const read = (p: Project) => p.maps[map.id].events[0].pages![0].commands;
  return { before, page, map, event, target: eventTarget(before, map.id, event.id, page.id), read };
}

describe("명령 한 줄", () => {
  it("고른 페이지의 한 줄을 지우고 다른 페이지, 이벤트, 원본을 보존하며 한 번에 되돌린다", async () => {
    const { before, page, map, target, read } = fixture();
    const { after, summary } = expectApplies(before, target, "cmd.delete", { index: 0, expectedHash: eventCommandHash(page.commands[0]) });
    expect(read(after)).toEqual([page.commands[1]]);
    expect(read(before)).toHaveLength(2);
    expect(after.maps[map.id].events[1]).toBe(map.events[1]);
    expect(after.maps[map.id].events[0].pages![1]).toBe(map.events[0].pages![1]);
    expect(summary.headline).toContain("삭제");
    await expectUndoRestores(before, after, target);
  });

  it("분기 안에서 명령 한 줄을 옮기며 다른 목록을 보존한다", async () => {
    const rows: Command[] = [{ kind: "wait", ms: 10 }, { kind: "breakLoop" }];
    const { before, target, read } = fixture([{ kind: "loop", body: rows }, { kind: "text", body: "끝" }]);
    const args = { index: 0, toIndex: 1, branchPath: [0, LOOP_BODY_BRANCH_INDEX], expectedHash: eventCommandHash(rows[0]) };
    const { after } = expectApplies(before, target, "cmd.move", args);
    expect(read(after)).toEqual([{ kind: "loop", body: [rows[1], rows[0]] }, { kind: "text", body: "끝" }]);
    expect(read(before)[0]).toEqual({ kind: "loop", body: rows });
    await expectUndoRestores(before, after, target);
  });

  it("분기가 있는 줄 자체를 자식과 함께 옮긴다", () => {
    const loop: Command = { kind: "loop", body: [{ kind: "breakLoop" }] };
    const line: Command = { kind: "text", body: "끝" };
    const { before, event, target, read } = fixture([loop, line]);
    event.pages = event.pages!.slice(0, 1);
    const { after } = expectApplies(before, target, "cmd.move", { index: 0, toIndex: 1, expectedHash: eventCommandHash(loop) });
    expect(read(after)).toEqual([line, loop]);
    expect(runHeadless(after, target.mapId, target.eventId).step).toMatchObject({ kind: "text", body: "끝" });
  });

  it("해시가 달라졌거나 분기에 자식이 있으면 삭제를 거절한다", () => {
    const { before, target, page, read } = fixture([{ kind: "loop", body: [{ kind: "breakLoop" }] }]);
    expectRefused(before, target, "cmd.delete", { index: 0, expectedHash: "stale" }, /명령 목록이 바뀌었어요/u);
    expectRefused(before, target, "cmd.delete", { index: 0, expectedHash: eventCommandHash(page.commands[0]) }, /분기 안에 명령/u);
    expect(read(before)).toHaveLength(1);
  });

  it("하위 분기의 이동 명령이 사용하는 위치 표시를 보호한다", () => {
    const { before, target, page, read } = fixture([
      { kind: "label", name: "입구" },
      { kind: "loop", body: [{ kind: "gotoLabel", name: "입구" }] },
    ]);
    expectRefused(before, target, "cmd.delete", { index: 0, expectedHash: eventCommandHash(page.commands[0]) }, /위치 표시로 이동하는 명령/u);
    expect(read(before)).toHaveLength(2);
  });

  it("하위 분기에 자기 위치 표시가 있으면 바깥의 같은 표시를 지울 수 있다", () => {
    const { before, target, page } = fixture([
      { kind: "label", name: "입구" },
      { kind: "loop", body: [{ kind: "label", name: "입구" }, { kind: "gotoLabel", name: "입구" }] },
    ]);
    expect(expectApplies(before, target, "cmd.delete", { index: 0, expectedHash: eventCommandHash(page.commands[0]) }).after).not.toBe(before);
  });

  it.each(["저장", "새 초안", "편집 전 원본", "초안의 스크립트"] as const)(
    "다른 이벤트의 제거 명령이 사용하는 출현을 보호한다 (%s)", mode => {
      const spawn = { id: "slimes", troopId: "troop_slime", area: { x: 1, y: 1, w: 1, h: 1 }, maxAlive: 1 };
      const { before: live, target, map, page, read } = fixture([{ kind: "spawnFieldEnemy", spawn }]);
      const remove: Command = mode === "초안의 스크립트"
        ? { kind: "script", source: 'await game.cmd({ kind: "despawnFieldEnemy", spawnId: "slimes" });', compiled: "" }
        : { kind: "despawnFieldEnemy", spawnId: "slimes" };
      const other = map.events[1]!;
      const persisted = { ...other, pages: [{ ...other.pages![0]!, commands: [{ kind: "loop", body: [remove] }] as Command[] }] };
      map.events[1] = mode === "저장" ? persisted
        : mode === "편집 전 원본" ? { ...other, draft: { kind: "edit", original: persisted } }
        : { ...persisted, draft: { kind: "new", original: other } };
      const task = smallTaskBase(live, target);
      const args = { index: 0, expectedHash: eventCommandHash(page.commands[0]) };
      expect(() => runPrimitive(task, target, "cmd.delete", args, undefined, live)).toThrow(/제거하는 명령/u);
      expect(read(live)).toHaveLength(1);
    },
  );

  it("오프닝을 끝내는 기억 명령을 보호한다", () => {
    const { before, target, page } = fixture();
    before.system.opening = { enabled: true, skippable: true, scenes: [],
      stage: { mapId: target.mapId, eventId: target.eventId, x: 2, y: 3 } };
    page.commands.push({ kind: "setFlag", flag: openingStageFlag(target.mapId, target.eventId), value: false });
    expectRefused(before, target, "cmd.delete", { index: 2, expectedHash: eventCommandHash(page.commands[2]) }, /오프닝을 마치는/u);
  });

  it.each<{ completesWhen: QuestGraphConditionExpression }>([
    { completesWhen: { kind: "switch", switchId: "sw_done", value: true } },
    { completesWhen: { all: [{ kind: "switch", storyFlagId: "quest-done" }] } },
    { completesWhen: [{ kind: "storyFlag", flagId: "quest-done" }] },
  ])("퀘스트 완료 조건이 읽는 스위치의 마지막 쓰기만 보호한다 (%j)", ({ completesWhen }) => {
    const write: Command = { kind: "setSwitch", switchId: "sw_done", value: true };
    const { before, target, read } = fixture([write]);
    before.switches.push({ id: "sw_done", name: "퀘스트 완료" });
    before.storyFlags = [{ id: "quest-done", kind: "switch", targetId: "sw_done", description: "완료 표시" }];
    const args = { index: 0, expectedHash: eventCommandHash(write) };
    expect(read(expectApplies(structuredClone(before), target, "cmd.delete", args).after)).toEqual([]);

    before.quests = [{
      kind: "graph", id: "quest", title: "완료 확인", edges: [],
      nodes: [{ id: "done", description: "완료", completesWhen }],
    }];
    expectRefused(structuredClone(before), target, "cmd.delete", args, /진행 값을 읽는 조건/u);
    before.maps[target.mapId].events[1].pages![0].commands.push(write);
    expect(read(expectApplies(before, target, "cmd.delete", args).after)).toEqual([]);
  });

  it("다른 대상, 잘못된 인자, 없는 도착 위치, 오래된 이동 해시를 거절한다", () => {
    const { before, target, map, page } = fixture();
    const args = { index: 0, expectedHash: eventCommandHash(page.commands[0]) };
    expectRefused(before, makeTarget(before, map.id)!, "cmd.delete", args);
    expectRefused(before, target, "cmd.delete", { ...args, eventId: "ev_other" }, /형식/u);
    expectRefused(before, target, "cmd.delete", { ...args, index: -1 }, /형식/u);
    expectRefused(before, target, "cmd.move", { ...args, toIndex: 2 }, /위치/u);
    expectRefused(before, target, "cmd.move", { ...args, toIndex: 0, expectedHash: "stale" }, /명령 목록이 바뀌었어요/u);
    expect(expectApplies(before, target, "cmd.move", { ...args, toIndex: 0 }).after).toBe(before);
  });

  it.each([["cmd.delete", {}], ["cmd.move", { toIndex: 1 }]] as const)(
    "%s는 페이지를 생략하면 페이지가 하나뿐일 때만 적용한다", (id, extra) => {
      const { before, target, page, event, read } = fixture();
      const withoutPage = { ...target, pageId: undefined };
      const args = { index: 0, expectedHash: eventCommandHash(page.commands[0]), ...extra };
      const singlePage = structuredClone(before);
      singlePage.maps[target.mapId].events.find(row => row.id === event.id)!.pages!.splice(1);
      expectRefused(before, withoutPage, id, args, /고칠 페이지를 선택해/u);
      const { after } = expectApplies(singlePage, withoutPage, id, args);
      expect(read(after)[0]).toEqual(page.commands[1]);
    },
  );

  it("동작이 기준 프로젝트의 중첩 배열을 제자리에서 바꾸면 즉시 실패한다", () => {
    const { before, target, page, read } = fixture();
    Object.freeze(before); // A shallow freeze alone leaves the command list writable.
    const mutation = vi.spyOn(CORE_PRIMITIVES.find(row => row.id === "cmd.delete")!, "apply").mockImplementation(({ project }) => {
      read(project).pop();
      return project;
    });
    try {
      const args = { index: 0, expectedHash: eventCommandHash(page.commands[0]) };
      expect(() => runPrimitive(before, target, "cmd.delete", args)).toThrow(TypeError);
      expect(mutation).toHaveBeenCalledOnce();
      expect(read(before)).toHaveLength(2);
    } finally {
      mutation.mockRestore();
    }
  });

  it("분기 위치에서 한 줄을 삽입하고 위치 생략 시 목록 끝에 더한다", () => {
    const { before, target, read } = fixture([{ kind: "loop", body: [] }]);
    const selection = [0, LOOP_BODY_BRANCH_INDEX];
    const first = insertAtIndex({ project: before, target }, { kind: "wait", ms: 20 }, undefined, selection);
    const after = insertAtIndex({ project: first, target }, { kind: "wait", ms: 10 }, 0, selection);
    expect(read(after)).toEqual([{ kind: "loop", body: [{ kind: "wait", ms: 10 }, { kind: "wait", ms: 20 }] }]);
    expect(() => insertAtIndex({ project: before, target }, { kind: "breakLoop" })).toThrow("반복 안에만");
    expect(() => insertAtIndex({ project: before, target }, { kind: "wait", ms: 0 }, 0, [0])).toThrow(PrimitiveError);
  });

  it("표시 이름이 없거나 식별자만 있을 때 읽을 수 있는 이름을 쓴다", () => {
    const { event, map } = fixture();
    expect(eventName(event)).toBe("안내인");
    expect(mapName({ ...map, name: map.id })).toBe("맵");
    expect(recordName("items", { id: "potion", name: "potion" })).toBe("아이템");
    expect(koreanSentence("매우 오래된 장터의 안내인 ".repeat(12)).length).toBeLessThanOrEqual(80);
  });
});

it("자료집 범위를 호스트의 레코드에 고정하고 기본 장비 칸 저장 ID를 제한한다", () => {
  const { before } = fixture();
  delete before.database.equipmentSlots;
  const target = { kind: "dbEntry", collection: "equipmentSlots", id: "weapon", label: "무기" } as const;
  const ctx = { project: before, target };
  const update = equipmentPrimitives.find(row => row.id === "db.equipmentSlots.update")!;
  expect(primitiveScope(ctx, update, { label: "무기 손" })).toMatchObject({
    create: { collection: "equipmentSlots", max: 1, ids: ["weapon"] },
  });
  before.database.equipmentSlots = [{ id: "weapon", label: "무기" }];
  expect(primitiveScope(ctx, update, { label: "무기 손" }).create).toBeUndefined();
  const wrongRow = { ...update, scope: () => ({ kind: "dbRemove", collection: "equipmentSlots", id: "helmet" } as const) };
  expect(() => primitiveScope(ctx, wrongRow, {})).toThrow(/선택한 자료집 항목/u);
});

describe("등록과 호스트 도구", () => {
  it("호스트 도구는 작업 사본 바깥의 초안이 사용하는 출현 명령을 보호한다", async () => {
    const spawn = { id: "slimes", troopId: "troop_slime", area: { x: 1, y: 1, w: 1, h: 1 }, maxAlive: 1 };
    const command = { kind: "spawnFieldEnemy", spawn } as const;
    const { before: live, target, map } = fixture([command]);
    const original = map.events[1]!;
    map.events[1] = { ...original, pages: undefined, commands: [{ kind: "despawnFieldEnemy", spawnId: spawn.id }],
      draft: { kind: "new", original } };
    const project = smallTaskBase(live, target);
    const ctx = { project, smallTaskTarget: target, smallTaskDraftSource: live };
    await expect(runSmallTaskPrimitiveTool(ctx, "apply_small_task_primitive", {
      id: "cmd.delete", args: { index: 0, expectedHash: eventCommandHash(command) },
    })).rejects.toThrow(/제거하는 명령/u);
    expect(ctx.project).toBe(project);
  });

  it("페이지가 없는 기존 이벤트에는 명령 삭제와 이동을 제안하지 않는다", async () => {
    const { before, event } = fixture();
    delete event.pages;
    const target = eventTarget(before, before.startMapId, event.id);
    const { data } = await runSmallTaskPrimitiveTool({ project: before, smallTaskTarget: target }, "list_small_task_primitives", {});
    expect(data?.map(row => row.id)).not.toContain("cmd.delete");
    expect(data?.map(row => row.id)).not.toContain("cmd.move");
  });

  it("별칭을 호출 시 해석하고 숨긴 행과 아직 등록되지 않은 별칭을 제안하지 않는다", () => {
    const [base] = CORE_PRIMITIVES;
    const alias = { ...base, id: "m2.000.insert", aliasOf: base.id };
    const waiting = { ...alias, id: "m2.001.insert", aliasOf: "cmd.missing" };
    const { getPrimitive, primitivesForTarget } = createPrimitiveRegistry([{ ...base, hidden: true }, alias, waiting]);
    const { target } = fixture();
    expect(getPrimitive(alias.id)?.id).toBe(base.id);
    expect(getPrimitive(waiting.id)).toBeUndefined();
    expect(primitivesForTarget(target)).toEqual([alias]);
    expect(() => createPrimitiveRegistry([base, base])).toThrow("중복");
    expect(() => createPrimitiveRegistry([{ ...base, aliasOf: alias.id }, alias])).toThrow("순환");
  });

  it("중첩 필드, 배열 범위와 단일 분기 입력을 검사한다", () => {
    const schema = {
      type: "object", required: ["values"], additionalProperties: false,
      properties: {
        values: { type: "array", minItems: 1, maxItems: 2, items: { oneOf: [
          { type: "integer", minimum: 1, maximum: 9 },
          { type: "string", pattern: "^한글$" },
        ] } },
      },
    } as const;
    expect(matchesPrimitiveSchema(schema, { values: [3, "한글"] })).toBe(true);
    for (const value of [{}, { values: [] }, { values: [0] }, { values: ["다른 글"] }, { values: [2, 3, 4] },
      { values: [3], target: "다른 대상" }, Object.create({ values: [3] })]) {
      expect(matchesPrimitiveSchema(schema, value)).toBe(false);
    }
  });

  it("일반 호출에는 대상이 없고, 작은 일 호출은 호스트 대상만 쓴다", async () => {
    const { before, target, page, read } = fixture();
    const ctx = { project: before, smallTaskTarget: target };
    const write = "apply_small_task_primitive";
    const list = "list_small_task_primitives";
    expect(toOpenAiTools().some(tool => [write, list].includes(tool.function.name))).toBe(false);
    expect(getTool(write)).toBeUndefined();
    expect(getTool(list)).toBeUndefined();
    await expect(runSmallTaskPrimitiveTool(ctx, list, {})).resolves.toMatchObject({ data: expect.arrayContaining([
      { id: "cmd.delete", title: "명령 한 줄 삭제", args: expect.objectContaining({ required: ["index", "expectedHash"] }) },
      { id: "cmd.move", title: "명령 한 줄 이동", args: expect.objectContaining({ required: ["index", "toIndex", "expectedHash"] }) },
    ]) });
    const args = { index: 0, expectedHash: eventCommandHash(page.commands[0]) };
    await expect(runSmallTaskPrimitiveTool(ctx, write, { id: "cmd.delete", args, target })).rejects.toThrow(PrimitiveError);
    await expect(runSmallTaskPrimitiveTool(ctx, write, { id: "cmd.delete", args: { index: 0 } })).rejects.toThrow(/형식/u);
    await expect(runSmallTaskPrimitiveTool(ctx, write, { id: "cmd.move", args: { index: 0, toIndex: 1 } })).rejects.toThrow(/형식/u);
    expect(ctx.project).toBe(before);
    await expect(runSmallTaskPrimitiveTool(ctx, write, { id: "cmd.delete", args })).resolves.toMatchObject({ ok: true });
    expect(read(ctx.project)).toHaveLength(1);
  });
});
