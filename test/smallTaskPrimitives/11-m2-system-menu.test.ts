/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/11-m2-system-menu";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults/blankProject";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, M2CommandFields, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { eventTarget, expectKoreanSentence, expectUndoRestores, loadFixture, mapTarget } from "./harness";

const music = "cc0-music-field-loop";
const sound = "cc0-sound-ui-confirm";

type Args = Record<string, unknown>;
type Row = {
  row: string;
  suffix: string;
  args: Args;
  fields: M2CommandFields;
  updateArgs: Args;
  updateFields: M2CommandFields;
  invalid: Args;
  reason: RegExp;
};

const cases: Row[] = [
  {
    row: "027", suffix: "change-system-bgm", args: { resourceId: music, volume: 42 },
    fields: { slot: "battle", cue: "battle", operation: "set", resourceId: music, volume: 42 },
    updateArgs: { operation: "reset" }, updateFields: { operation: "reset", resourceId: "" },
    invalid: { resourceId: "없는곡" }, reason: /음악을 찾을 수 없습니다/u,
  },
  {
    row: "028", suffix: "change-system-se", args: { cue: "confirm", resourceId: sound },
    fields: { slot: "defeat", cue: "confirm", operation: "set", resourceId: sound, volume: 100 },
    updateArgs: { cue: "cancel", volume: 12 }, updateFields: { cue: "cancel", volume: 12 },
    invalid: { resourceId: music }, reason: /효과음을 찾을 수 없습니다/u,
  },
  {
    row: "029", suffix: "change-system-graphic", args: { resourceId: "windowskin-warm" },
    fields: { target: "", operation: "set", value: "windowskin-warm" },
    updateArgs: { resourceId: "windowskin-default" }, updateFields: { value: "windowskin-default" },
    invalid: { resourceId: "없는그림" }, reason: /메뉴 그림을 찾을 수 없습니다/u,
  },
  {
    row: "072", suffix: "set-teleportation-point", args: { x: 3, y: 4, label: "동쪽 관문" },
    fields: { target: "", operation: "set", value: "", x: 3, y: 4, label: "동쪽 관문" },
    updateArgs: { x: 5 }, updateFields: { x: 5 },
    invalid: { mapId: "없는맵" }, reason: /목적지 맵을 찾을 수 없습니다/u,
  },
  ...[
    ["073", "teleportation-on-off"], ["075", "change-escape-access"], ["077", "change-save-access"],
    ["079", "change-menu-access"], ["095", "toggle-atb-wait-mode"], ["096", "toggle-fullscreen-mode"],
  ].map(([row, suffix]): Row => ({
    row, suffix, args: { enabled: false }, fields: { enabled: "false" },
    updateArgs: { enabled: true }, updateFields: { enabled: "true" },
    invalid: { enabled: "아니요" }, reason: /[가-힣]/u,
  })),
  {
    row: "074", suffix: "set-escape-location", args: { x: 7, y: 6 },
    fields: { target: "", x: 7, y: 6 },
    updateArgs: { y: 3 }, updateFields: { y: 3 },
    invalid: { x: 9999, y: 6 }, reason: /맵 범위 밖/u,
  },
  {
    row: "078", suffix: "open-menu-screen", args: { screen: "monster-box" },
    fields: { screen: "monster-box" }, updateArgs: { screen: "skills" }, updateFields: { screen: "skills" },
    invalid: { screen: "skills", actorId: "없는배우" }, reason: /배우를 찾을 수 없습니다/u,
  },
  {
    row: "088", suffix: "comment", args: { comment: "보스전 준비", color: "pink" },
    fields: { comment: "보스전 준비", color: "pink" },
    updateArgs: { comment: "보스전 순서 확인" }, updateFields: { comment: "보스전 순서 확인" },
    invalid: { comment: "  " }, reason: /주석 내용을 입력하세요/u,
  },
  ...[
    ["093", "open-load-menu"], ["094", "exit-game"], ["097", "open-video-options"],
  ].map(([row, suffix]): Row => ({
    row, suffix, args: {}, fields: {}, updateArgs: {}, updateFields: {},
    invalid: { pageId: "다른페이지" }, reason: /[가-힣]/u,
  })),
];

const fixtures = ["blank", "built", "maou"] as const;
const sceneFixtures = new Map<(typeof fixtures)[number], Project>();
const unchanged: Command = { kind: "text", body: "원래 대사" };

function scene(fixture: (typeof fixtures)[number], commands: Command[] = [unchanged]) {
  let before = sceneFixtures.get(fixture);
  if (!before) {
    before = loadFixture(fixture);
    sceneFixtures.set(fixture, before);
  }
  const template = before.maps[before.startMapId] ? undefined : createBlankProject();
  const map = template ? template.maps[template.startMapId] : before.maps[before.startMapId];
  const page: EventPage = {
    id: "system_menu_page", name: "설정 페이지", conditions: [], graphic: {},
    movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same",
    trigger: { kind: "action" }, commands,
  };
  const otherPage = { ...page, id: "system_menu_other_page", name: "다른 페이지", commands: [unchanged] };
  const event: GameEvent = {
    id: "system_menu_event", name: "설정 확인", x: 2, y: 2, trigger: page.trigger, commands: [], pages: [page, otherPage],
  };
  const project: Project = {
    ...before, ...(template ? { startMapId: map.id, mapTree: template.mapTree, startPos: template.startPos } : {}),
    maps: { ...before.maps, [map.id]: { ...map, events: [...map.events, event] } },
  };
  const target = eventTarget(project, map.id, event.id, page.id);
  const current = (value: Project) => value.maps[map.id].events.find(candidate => candidate.id === event.id)!;
  return { project, target, event, map, otherPage, current, commands: (value: Project) => current(value).pages![0].commands };
}

function m2(row: Row, fields: M2CommandFields): Command {
  return { kind: "m2Command", commandId: `m2-${row.row}-${row.suffix}`, fields };
}

function expectedFields(row: Row, mapId: string) {
  return ["072", "074"].includes(row.row) ? { ...row.fields, mapId } : row.fields;
}

describe("시스템·메뉴 작은 일", () => {
  beforeAll(() => {
    for (const fixture of fixtures) sceneFixtures.set(fixture, loadFixture(fixture));
  }, 120_000);

  cases.forEach((row, i) => {
    const fixture = fixtures[i % fixtures.length];
    const insertId = `m2.${row.row}.insert`;
    const updateId = `m2.${row.row}.update`;

    it(`${row.suffix} 한 줄 삽입과 되돌리기`, async () => {
      const { project, target, map, commands, current, otherPage } = scene(fixture);
      const before = structuredClone(project);
      const { after, sentence } = runPrimitive(project, target, insertId, row.args);
      expect(commands(after)).toEqual([unchanged, m2(row, expectedFields(row, map.id))]);
      expect(current(after).pages![1]).toEqual(otherPage);
      expect(jsonEqual(project, before)).toBe(true);
      expectKoreanSentence(sentence, target);
      await expectUndoRestores(project, after, target);
    });

    it(`${row.suffix} 한 줄 수정과 되돌리기`, async () => {
      const initial = scene(fixture);
      const fields = expectedFields(row, initial.map.id);
      const parameterless = ["093", "094", "097"].includes(row.row);
      const old = m2(row, { ...fields, legacy: "기존 값" });
      const { project, target, commands, current, otherPage } = scene(fixture, [old, unchanged]);
      const before = structuredClone(project);
      const { after, sentence } = runPrimitive(project, target, updateId, {
        index: 0, expectedHash: eventCommandHash(old), ...row.updateArgs,
      });
      const expected = parameterless ? {} : { ...fields, legacy: "기존 값", ...row.updateFields };
      expect(commands(after)).toEqual([m2(row, expected), unchanged]);
      expect(current(after).pages![1]).toEqual(otherPage);
      expect(jsonEqual(project, before)).toBe(true);
      expectKoreanSentence(sentence, target);
      await expectUndoRestores(project, after, target);
    });

    it(`${row.suffix} 잘못된 인자와 다른 페이지 변경 거부`, () => {
      const { project, target, map, event, current } = scene(fixture);
      expect(() => runPrimitive(project, target, insertId, row.invalid)).toThrow(row.reason);
      expect(() => runPrimitive(project, target, updateId, { index: 0, ...row.updateArgs })).toThrow(/[가-힣]/u);
      const ctx = { project, target };
      for (const id of [insertId, updateId]) {
        const primitive = PRIMITIVES.find(candidate => candidate.id === id)!;
        const other = structuredClone(project);
        current(other).pages![1].commands.push(m2(row, row.fields));
        const result = checkSmallTaskScope(project, other, primitive.scope(ctx, { mapId: "다른 맵" }));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toMatch(/범위 밖/u);
        expect(() => runPrimitive(project, mapTarget(project, map.id), id, {})).toThrow(/범위 밖/u);
      }
      expect(map.events.some(candidate => candidate.id === event.id)).toBe(false);
    });
  });

  it("분기 안의 명령을 고치고 오래된 확인값을 거부한다", () => {
    const original: Command = { kind: "m2Command", commandId: "m2-077-change-save-access", fields: { enabled: "true" } };
    const { project, target, commands } = scene("blank", [{ kind: "loop", body: [original, unchanged] }]);
    const args = { index: 0, branchPath: [0, LOOP_BODY_BRANCH_INDEX], enabled: false };
    const id = "m2.077.update";
    expect(() => runPrimitive(project, target, id, { ...args, expectedHash: "이전 줄" })).toThrow(/바뀌었습니다/u);
    const { after } = runPrimitive(project, target, id, { ...args, expectedHash: eventCommandHash(original) });
    expect(commands(after)).toEqual([{ kind: "loop", body: [{ ...original, fields: { enabled: "false" } }, unchanged] }]);
  });

  it("동적으로 위치를 잡던 옛 순간이동 명령은 이름만 바꿔도 위치 지정 방식이 유지된다", () => {
    const original: Command = { kind: "m2Command", commandId: "m2-072-set-teleportation-point", fields: { label: "귀환" } };
    const { project, target, commands } = scene("blank", [original]);
    const { after } = runPrimitive(project, target, "m2.072.update", { index: 0, label: "동쪽 관문" });
    expect(commands(after)).toEqual([{ ...original, fields: { label: "동쪽 관문" } }]);
  });

  it("다른 맵을 목적지로 가리켜도 선택한 페이지에만 쓴다", () => {
    const { project, target, map, commands } = scene("built");
    const destination = Object.values(project.maps).find(candidate => candidate.id !== map.id)!;
    const { after } = runPrimitive(project, target, "m2.074.insert", { mapId: destination.id, x: 1, y: 1 });
    expect(after.maps[destination.id]).toBe(destination);
    expect(commands(after).at(-1)).toEqual({
      kind: "m2Command", commandId: "m2-074-set-escape-location",
      fields: { target: "", mapId: destination.id, x: 1, y: 1 },
    });
  });

  it("주석 미리보기에서 식별자와 여러 문장 구분을 제거한다", () => {
    const { project, target } = scene("blank");
    const comment = 'ev_secret { "key": "m2-027-change-system-bgm" } 문장. 다음 문장?';
    const { sentence } = runPrimitive(project, target, "m2.088.insert", { comment });
    expectKoreanSentence(sentence, target);
    expect(sentence).not.toMatch(/secret|m2-|[{}"\[\]?]/u);
    expect(sentence.match(/\./gu)).toHaveLength(1);
  });
});

function play(id: string, args: Args) {
  const { project, target, map, commands } = scene("blank", []);
  const { after } = runPrimitive(project, target, id, args);
  const session = startSession(after, 42);
  session.currentMapId = map.id;
  const step = createInterpreter(commands(after), session, after).start();
  return { session, step, map };
}

describe("시스템·메뉴 명령 실행", () => {
  it("저장을 금지한다", () => {
    const { session, step } = play("m2.077.insert", { enabled: false });
    expect(step.kind).toBe("done");
    expect(session.m2Runtime?.access.save).toBe(false);
  });

  it("전투곡과 소리 크기를 세션에 적용한다", () => {
    const { session } = play("m2.027.insert", { resourceId: music, volume: 42 });
    expect(session.systemAudioOverrides?.bgm?.battle).toEqual({ resourceId: music, volume: 42 });
  });

  it("순간이동 지점에 이름과 좌표를 기록한다", () => {
    const { session, map } = play("m2.072.insert", { x: 3, y: 4, label: "동쪽 관문" });
    expect(session.teleportPoints).toEqual([{ mapId: map.id, x: 3, y: 4, label: "동쪽 관문" }]);
  });

  it("스킬 장착 단계에서 이벤트 실행을 멈춘다", () => {
    const { step } = play("m2.078.insert", { screen: "skills" });
    expect(step).toEqual({ kind: "openMenuScreen", screen: "skills" });
  });
});

type UpdateCase = CorpusCase & { setup: { commands: Command[] } };
const updateCorpus: UpdateCase[] = JSON.parse(readFileSync("test/smallTaskPrimitives/11-m2-system-menu/update-corpus.json", "utf8"));

function corpusProject(fixture: Project, { setup, target }: UpdateCase): Project {
  if (target.kind !== "event") throw new Error("이벤트 대상을 확인하세요.");
  const { mapId = fixture.startMapId, eventId, pageId } = target;
  const map = fixture.maps[mapId];
  const events = map.events.map(event => event.id === eventId
    ? { ...event, pages: event.pages?.map(page => page.id === pageId
        ? { ...page, commands: [...setup.commands, ...page.commands] }
        : page) }
    : event);
  return { ...fixture, maps: { ...fixture.maps, [mapId]: { ...map, events } } };
}

describe("기존 명령을 심은 수정 코퍼스", () => {
  const loaded = new Map<UpdateCase["fixture"], Project>();
  it.each(updateCorpus)("$request", async entry => {
    let fixture = loaded.get(entry.fixture);
    if (!fixture) {
      fixture = loadFixture(entry.fixture);
      loaded.set(entry.fixture, fixture);
    }
    const before = corpusProject(fixture, entry);
    const target = resolveTarget(before, entry.target);
    const apply = () => runPrimitive(before, target, entry.primitive, entry.args);
    if (entry.expectRefusal) {
      expect(apply).toThrow(PrimitiveError);
      return;
    }

    const { after, sentence } = apply();
    expectKoreanSentence(sentence, target);
    for (const check of entry.expect ?? []) expect(readCheckPath(after, check.at), check.at).toEqual(check.equals);
    await expectUndoRestores(before, after, target);
  });
});
