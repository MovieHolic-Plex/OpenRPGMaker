import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { FORK_ELSE_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { getTool } from "@/editor/tools/toolRegistry";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { deleteEventCommand, eventCommandHash, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import type { Command, EventPage } from "@/project/types";

const text: Command = { kind: "text", body: "문을 열까?", speaker: "문지기" };
const wait: Command = { kind: "wait", ms: 100 };
function page(...commands: Command[]): EventPage {
  return { id: "page1", name: "입구", conditions: [], trigger: { kind: "action" }, priority: "below", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, commands };
}

describe("이벤트 명령 한 줄", () => {
  it("처음과 끝에서 끼워 넣고 수정하고 지운다. 원본 페이지와 입력은 보존한다", () => {
    const original = page(wait);
    const first = insertEventCommand(original, 0, text);
    const last = insertEventCommand(first, 2, text);
    const updated = updateEventCommand(last, 2, { body: "문을 열자." }, eventCommandHash(text));
    expect(updated.commands).toEqual([text, wait, { ...text, body: "문을 열자." }]);
    expect(deleteEventCommand(updated, 0, eventCommandHash(text))).toEqual(page(wait, { ...text, body: "문을 열자." }));
    expect(deleteEventCommand(updated, 2, eventCommandHash(updated.commands[2]!))).toEqual(first);
    expect(insertEventCommand(page(), 0, text).commands).toEqual([text]);
    expect(deleteEventCommand(page(text), 0, eventCommandHash(text)).commands).toEqual([]);
    expect(original.commands).toEqual([wait]);
    expect(first.commands[0]).not.toBe(text);
  });

  it("줄이 바뀌면 이전 해시를 거절하고 키 순서만 다른 해시는 받는다", () => {
    const original = page(text);
    const reordered = { speaker: "문지기", body: "문을 열까?", kind: "text" } as const;
    expect(eventCommandHash(reordered)).toBe(eventCommandHash(text));
    const changed = updateEventCommand(original, 0, { body: "수정" }, eventCommandHash(reordered));
    for (const operation of [
      () => updateEventCommand(changed, 0, { speaker: "상인" }, eventCommandHash(text)),
      () => deleteEventCommand(changed, 0, eventCommandHash(text)),
    ]) expect(operation).toThrow("내용이 바뀌었습니다");
    expect(() => insertEventCommand(original, -1, wait)).toThrow();
    expect(() => insertEventCommand(original, 2, wait)).toThrow();
    expect(() => deleteEventCommand(original, 1, eventCommandHash(text))).toThrow();
    expect(() => updateEventCommand(original, 0, { kind: "wait" }, eventCommandHash(text))).toThrow("명령 종류");
  });

  it("조건·반복·선택지 안의 한 줄을 수정하면서 분기 구조를 보존한다", () => {
    const choices: Command = { kind: "choices", options: [{ text: "첫 선택", branch: [text] }], cancelBranch: [wait] };
    const fork: Command = { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [
      { kind: "loop", body: [choices, { kind: "breakLoop" }] },
    ], else: [wait] };
    const original = page(fork);
    const nested = [0, FORK_THEN_BRANCH_INDEX, 0, LOOP_BODY_BRANCH_INDEX, 0, 0];
    const edited = insertEventCommand(original, [...nested, 1], wait);
    const updated = updateEventCommand(edited, [...nested, 0], { body: "분기 안의 대사" }, eventCommandHash(text));
    const deleted = deleteEventCommand(updated, [...nested, 1], eventCommandHash(wait));
    expect(deleted.commands).toEqual([{ ...fork, then: [{ kind: "loop", body: [
      { ...choices, options: [{ text: "첫 선택", branch: [{ ...text, body: "분기 안의 대사" }] }] }, { kind: "breakLoop" },
    ] }] }]);
    expect(original.commands).toEqual([fork]);
    expect(updateEventCommand(page(choices), 0, { optionLabels: ["새 문구"] }, eventCommandHash(choices)).commands).toEqual([
      { ...choices, options: [{ text: "새 문구", branch: [text] }] },
    ]);
    expect(() => deleteEventCommand(original, 0, eventCommandHash(fork))).toThrow("분기 안에 명령");
    expect(() => deleteEventCommand(page(choices), 0, eventCommandHash(choices))).toThrow("분기 안에 명령");
    expect(() => updateEventCommand(original, 0, { then: [] }, eventCommandHash(fork))).toThrow("분기 안의 명령");
    expect(() => updateEventCommand(page(choices), 0, { options: [] }, eventCommandHash(choices))).toThrow("분기 안의 명령");
    expect(() => insertEventCommand(original, [0, 99, 0], text)).toThrow();
    expect(() => insertEventCommand(original, [0, FORK_THEN_BRANCH_INDEX], text)).toThrow();
    expect(() => insertEventCommand(original, 1, { kind: "breakLoop" })).toThrow("반복 안에만");
    expect(() => insertEventCommand(original, 1, { kind: "text" } as Command)).toThrow("문구가 필요");
  });

  it("없는 조건 분기는 삽입할 때 만들고 수정과 삭제는 거절한다", () => {
    const fork: Command = { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [wait] };
    const original = page(fork);
    const path = [0, FORK_ELSE_BRANCH_INDEX, 0];
    expect(() => updateEventCommand(original, path, { body: "분기 안의 대사" }, eventCommandHash(text))).toThrow("명령 줄을 찾을 수 없습니다.");
    expect(() => deleteEventCommand(original, path, eventCommandHash(text))).toThrow("명령 줄을 찾을 수 없습니다.");
    expect(insertEventCommand(original, path, text).commands).toEqual([{ ...fork, else: [text] }]);
    expect(original.commands[0]).not.toHaveProperty("else");
  });

  it("등록된 쓰기 도구와 get_event 해시로 실제 도구 실행 경계를 왕복한다", async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    project.tilesets = { [map.tilesetId]: project.tilesets[map.tilesetId]! };
    map.events.push({
      id: "gate", name: "문지기", x: 2, y: 2, trigger: { kind: "action" }, commands: [],
      pages: [page({ kind: "choices", options: [{ text: "연다", branch: [text] }] }), { ...page(wait), id: "page2" }],
    });
    const ctx: ToolContext = { project, assistantRun: true };
    const target = { mapId, eventId: "gate", pageId: "page1" };
    const getHashes = async () => {
      const read = await runToolAsync(ctx, "get_event", { mapId, eventId: "gate", includeCommandHashes: true });
      expect(read.ok, read.summary).toBe(true);
      return (read.data as { commandHashes: { commands: { index: number; branchPath: number[]; hash: string }[] }[] }).commandHashes;
    };
    for (const name of ["insert_event_command", "update_event_command", "delete_event_command"]) {
      expect(getTool(name)?.mode).toBe("write");
    }
    const initialHashes = await getHashes();
    const leaf = initialHashes[0]!.commands[1]!;
    const row = { ...target, index: leaf.index, branchPath: leaf.branchPath };
    const updated = await runToolAsync(ctx, "update_event_command", { ...row, patch: { body: "지금은 닫혔다." }, expectedHash: leaf.hash });
    expect(updated.ok, updated.summary).toBe(true);
    expect(updated.summary).toContain("『문지기』");
    const staleProject = ctx.project;
    const stale = await runToolAsync(ctx, "delete_event_command", { ...row, expectedHash: leaf.hash });
    expect(stale).toMatchObject({ ok: false, issues: [{ code: "stale-event-command" }] });
    expect(ctx.project).toBe(staleProject);
    const newLeaf = (await getHashes())[0]!.commands[1]!;
    const deleted = await runToolAsync(ctx, "delete_event_command", { ...row, expectedHash: newLeaf.hash });
    expect(deleted.ok, deleted.summary).toBe(true);
    const inserted = await runToolAsync(ctx, "insert_event_command", { ...row, command: { kind: "text", speaker: "문지기", body: "다음에 오세요." } });
    expect(inserted.ok, inserted.summary).toBe(true);
    expect(checkSmallTaskScope(project, ctx.project, { ...target, kind: "dialogue" }).ok).toBe(true);
    expect(checkSmallTaskScope(project, ctx.project, { ...target, kind: "eventPage" }).ok).toBe(true);

    const loop = { kind: "loop", body: [{ kind: "breakLoop" }] };
    const insertedLoop = await runToolAsync(ctx, "insert_event_command", { ...target, index: 1, command: loop });
    expect(insertedLoop.ok, insertedLoop.summary).toBe(true);
    expect(ctx.project.maps[mapId]?.events.at(-1)?.pages?.[0]?.commands[1]).toEqual(loop);
  }, 60_000);
});
