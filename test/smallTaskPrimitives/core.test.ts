/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { CORE_PRIMITIVES } from "@/editor/smallTask/primitives/core/commands";
import { eventName, insertAtIndex, koreanSentence, mapName, recordName } from "@/editor/smallTask/primitives/core/helpers";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { createPrimitiveRegistry } from "@/editor/smallTask/primitives/registry";
import { matchesPrimitiveSchema } from "@/editor/smallTask/primitives/run";
import { mapTarget as makeTarget } from "@/editor/smallTask/target";
import { createBlankProject } from "@/project/defaults/blankProject";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { runSmallTaskPrimitiveTool } from "@/editor/tools/smallTaskPrimitiveTools";
import { getTool, toOpenAiTools } from "@/editor/tools/toolRegistry";
import { expectApplies, expectRefused, expectUndoRestores, eventTarget, runHeadless } from "./harness";

function fixture(commands: Command[] = [{ kind: "text", body: "첫 줄" }, { kind: "text", body: "둘째 줄" }]) {
  const before = createBlankProject();
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
    const args = { index: 0, toIndex: 1, branchPath: [0, LOOP_BODY_BRANCH_INDEX] };
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
    const { after } = expectApplies(before, target, "cmd.move", { index: 0, toIndex: 1 });
    expect(read(after)).toEqual([line, loop]);
    expect(runHeadless(after, target.mapId, target.eventId).step).toMatchObject({ kind: "text", body: "끝" });
  });

  it("해시가 달라졌거나 분기에 자식이 있으면 삭제를 거절한다", () => {
    const { before, target, read } = fixture([{ kind: "loop", body: [{ kind: "breakLoop" }] }]);
    expectRefused(before, target, "cmd.delete", { index: 0, expectedHash: "stale" }, /내용이 바뀌었습니다/u);
    expectRefused(before, target, "cmd.delete", { index: 0 }, /분기 안에 명령/u);
    expect(read(before)).toHaveLength(1);
  });

  it("다른 대상, 잘못된 인자, 없는 도착 위치, 오래된 이동 해시를 거절한다", () => {
    const { before, target, map } = fixture();
    expectRefused(before, makeTarget(before, map.id)!, "cmd.delete", { index: 0 });
    expectRefused(before, target, "cmd.delete", { index: 0, eventId: "ev_other" }, /형식/u);
    expectRefused(before, target, "cmd.delete", { index: -1 }, /형식/u);
    expectRefused(before, target, "cmd.move", { index: 0, toIndex: 2 }, /위치/u);
    expectRefused(before, target, "cmd.move", { index: 0, toIndex: 1, expectedHash: "stale" }, /내용이 바뀌었어요/u);
    expect(expectApplies(before, target, "cmd.move", { index: 0, toIndex: 0 }).after).toBe(before);
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

describe("등록과 호스트 도구", () => {
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
    const { before, target, read } = fixture();
    const ctx = { project: before, smallTaskTarget: target };
    const write = "apply_small_task_primitive";
    const list = "list_small_task_primitives";
    expect(toOpenAiTools().some(tool => [write, list].includes(tool.function.name))).toBe(false);
    expect(getTool(write)).toBeUndefined();
    expect(getTool(list)).toBeUndefined();
    await expect(runSmallTaskPrimitiveTool(ctx, list, {})).resolves.toMatchObject({ data: expect.arrayContaining([
      { id: "cmd.delete", title: "명령 한 줄 삭제", args: expect.any(Object) },
    ]) });
    await expect(runSmallTaskPrimitiveTool(ctx, write, { id: "cmd.delete", args: { index: 0 }, target })).rejects.toThrow(PrimitiveError);
    expect(ctx.project).toBe(before);
    await expect(runSmallTaskPrimitiveTool(ctx, write, { id: "cmd.delete", args: { index: 0 } })).resolves.toMatchObject({ ok: true });
    expect(read(ctx.project)).toHaveLength(1);
  });
});
