/** @vitest-environment happy-dom */
import { beforeAll, describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { mapTarget } from "@/editor/smallTask/target";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/09-cmd-move-system";
import { getSessionCheckpoint } from "@/player/checkpoints";
import { createInterpreter } from "@/player/interpreter";
import { isPassableLanding } from "@/project/collision";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { startSession } from "@/project/session";
import type { Command, DifficultyRecord, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import corpusData from "../../harness-data/small-task-corpus/09-cmd-move-system.json";
import { expectKoreanSentence, expectRefused, expectUndoRestores, loadFixture } from "./harness";

const mapId = "map_unit09";
const eventId = "ev_unit09";
const pageId = "page_unit09";
const defeatId = "defeat_unit09";
const endingId = "ending_unit09";
const difficultyId = "difficulty_unit09";
const text: Command = { kind: "text", body: "기존 대사입니다." };
const wait: Command = { kind: "wait", ms: 70 };

type Args = Record<string, unknown>;
type Fixture = "blank" | "built" | "maou";

const fixtures = new Map<Fixture, Project>();

beforeAll(() => {
  fixtures.set("maou", loadFixture("maou"));
}, 180_000);

function sample(fixture: Fixture, commands: Command[] = []) {
  if (!fixtures.has(fixture)) fixtures.set(fixture, loadFixture(fixture));
  const project = fixtures.get(fixture)!;
  const tileset = project.tilesets.beodeul_city ?? project.tilesets[project.maps[project.startMapId]!.tilesetId]!;
  const grid = createBlankMap("아침 광장", 6, 6, tileset.id, tileset.tileSize, tileset);
  const page: EventPage = {
    id: pageId, name: "광장 안내", commands, conditions: [], graphic: {},
    trigger: { kind: "action" }, movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "below",
  };
  const event: GameEvent = {
    id: eventId, name: "광장 표지판", x: 1, y: 1, trigger: page.trigger, commands: [],
    pages: [page, { ...page, id: "page_neighbor", name: "옆 페이지", commands: [wait] }],
  };
  const map = { ...grid, id: mapId, events: [event, { ...event, id: "ev_guard", name: "광장 경비", x: 3, pages: [] }] };
  const priorStartMapId = project.startMapId;
  const before: Project = {
    ...project,
    startMapId: mapId,
    startPos: { x: 2, y: 2 },
    maps: { ...project.maps, [mapId]: map },
    mapTree: { mapId, children: priorStartMapId ? [project.mapTree] : [] },
    endings: [{ id: endingId, name: "새로운 아침", conditions: [], priority: 1 }, ...(project.endings ?? [])],
    system: {
      ...project.system,
      difficulties: [{ id: difficultyId, name: "도전" }],
      gameOvers: [{ id: defeatId, name: "검은 밤", settings: { presentation: "horror" } }],
    },
  };
  return { before, target: mapTarget(before, mapId, eventId, pageId)! };
}

function stored(project: Project) {
  return project.maps[mapId]!.events[0]!.pages![0]!.commands;
}

type Example = {
  fixture: Fixture;
  before: Command;
  insert: [Args, Command];
  update: [Args, Command];
};
const examples: Example[] = [
  {
    fixture: "blank", before: { kind: "transfer", mapId, x: 2, y: 2, direction: "left", fade: "black", door: true },
    insert: [{ mapId, x: 2, y: 2, fade: "white" }, { kind: "transfer", mapId, x: 2, y: 2, direction: "retain", fade: "white" }],
    update: [{ x: 3, transition: "blinds" }, { kind: "transfer", mapId, x: 3, y: 2, direction: "left", fade: "black", door: true, transition: "blinds" }],
  },
  {
    fixture: "built", before: { kind: "moveEvent", eventId: "", route: { moves: [{ kind: "turn", dir: "left" }, { kind: "move", dir: "down" }], repeat: false, skippable: false } },
    insert: [{ eventId: "ev_guard", direction: "up", steps: 3, wait: true }, { kind: "moveEvent", eventId: "ev_guard", route: { moves: Array.from({ length: 3 }, () => ({ kind: "move", dir: "up" })), repeat: false, wait: true } }],
    update: [{ eventId: "@player", wait: true }, { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "turn", dir: "left" }, { kind: "move", dir: "down" }], repeat: false, skippable: false, wait: true } }],
  },
  {
    fixture: "built", before: { kind: "setEventGraphicPattern", eventId: "this", pattern: 0 },
    insert: [{ pattern: 2 }, { kind: "setEventGraphicPattern", eventId: "", pattern: 2 }],
    update: [{ eventId: "ev_guard", pattern: 7 }, { kind: "setEventGraphicPattern", eventId: "ev_guard", pattern: 7 }],
  },
  {
    fixture: "maou", before: { kind: "changeTile", mapId, x: 1, y: 3, layer: "lower2", tile: 2 },
    insert: [{ x: 1, y: 2, layer: "upper2", tile: -1 }, { kind: "changeTile", mapId, x: 1, y: 2, layer: "upper2", tile: -1 }],
    update: [{ tile: 1 }, { kind: "changeTile", mapId, x: 1, y: 3, layer: "lower2", tile: 1 }],
  },
  {
    fixture: "built", before: { kind: "checkpointSave", label: "빛나는 샘" },
    insert: [{}, { kind: "checkpointSave" }],
    update: [{ label: "언덕 쉼터" }, { kind: "checkpointSave", label: "언덕 쉼터" }],
  },
  {
    fixture: "blank", before: { kind: "killPlayer", message: "함정", gameOverId: defeatId },
    insert: [{ message: "바닥이 꺼졌다.", gameOverId: defeatId }, { kind: "killPlayer", message: "바닥이 꺼졌다.", gameOverId: defeatId }],
    update: [{ gameOverId: "" }, { kind: "killPlayer", message: "함정" }],
  },
  {
    fixture: "maou", before: { kind: "triggerEnding", endingId },
    insert: [{ endingId }, { kind: "triggerEnding", endingId }],
    update: [{ endingId: "" }, { kind: "triggerEnding" }],
  },
  {
    fixture: "blank", before: { kind: "gameOver" },
    insert: [{ gameOverId: defeatId }, { kind: "gameOver", gameOverId: defeatId }],
    update: [{ gameOverId: defeatId }, { kind: "gameOver", gameOverId: defeatId }],
  },
  {
    fixture: "maou", before: { kind: "ending", title: "달빛", message: "잘 가.", presentation: { tone: "warm", portraits: "none" } },
    insert: [{}, { kind: "ending", title: "끝", message: "플레이해 주셔서 감사합니다." }],
    update: [{ message: "다시 만나.", tone: "dark" }, { kind: "ending", title: "달빛", message: "다시 만나.", presentation: { tone: "dark", portraits: "none" } }],
  },
  {
    fixture: "blank", before: { kind: "returnToTitle" },
    insert: [{}, { kind: "returnToTitle" }],
    update: [{}, { kind: "returnToTitle" }],
  },
  {
    fixture: "built", before: { kind: "openSaveMenu" },
    insert: [{}, { kind: "openSaveMenu" }],
    update: [{}, { kind: "openSaveMenu" }],
  },
  {
    fixture: "maou", before: { kind: "runControl", action: "start", seed: 90, startFloor: 3 },
    insert: [{ mode: "setFlag", flag: "문 열림", value: false }, { kind: "runControl", action: "setFlag", flag: "문 열림", value: false }],
    update: [{ mode: "end", result: "failed" }, { kind: "runControl", action: "end", result: "failed" }],
  },
  {
    fixture: "blank", before: { kind: "setDifficulty", difficultyId: "old_difficulty" },
    insert: [{ difficultyId }, { kind: "setDifficulty", difficultyId }],
    update: [{ difficultyId }, { kind: "setDifficulty", difficultyId }],
  },
];

describe("이동·시스템·엔딩 명령 한 줄 편집", () => {
  for (const example of examples) for (const edit of ["insert", "update"] as const) {
    const id = `cmd.${example.before.kind}.${edit}`;
    it(id, async () => {
      const [args, expected] = example[edit];
      const starting = edit === "insert" ? [text, wait] : [text, example.before, wait];
      const { before, target } = sample(example.fixture, structuredClone(starting));
      const result = runPrimitive(before, target, id, { ...args, index: 1 });
      expect(stored(result.after)).toStrictEqual([text, expected, wait]);
      expect(stored(before)).toStrictEqual(starting);
      expect(result.after.maps[mapId]!.events[0]!.pages![1]).toBe(before.maps[mapId]!.events[0]!.pages![1]);
      expectKoreanSentence(result.sentence, target);
      expect(result.sentence).toMatch(/\.$/u);
      if (jsonEqual(before, result.after)) {
        expect(result.summary.lines).toEqual([]);
      }
      await expectUndoRestores(before, result.after, target);

      const primitive = PRIMITIVES.find(row => row.id === id)!;
      const otherEvent = { ...result.after.maps[mapId]!.events[1]!, name: "범위 밖 경비" };
      const map = result.after.maps[mapId]!;
      const tampered = { ...result.after, maps: { ...result.after.maps, [mapId]: { ...map, events: [map.events[0]!, otherEvent] } } };
      expect(checkSmallTaskScope(before, tampered, primitive.scope({ project: before, target }, args)))
        .toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
    });
  }

  it("선택한 분기에서만 삽입하고 이전 확인값을 사용한 덮어쓰기를 거절한다", () => {
    const fork: Command = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 1 }, then: [text], else: [wait] };
    const { before, target } = sample("blank", [fork, wait]);
    const branchPath = [0, FORK_THEN_BRANCH_INDEX];
    const { after } = runPrimitive(before, target, "cmd.checkpointSave.insert", { branchPath, label: "샘" });
    expect(stored(after)).toStrictEqual([{ ...fork, then: [text, { kind: "checkpointSave", label: "샘" }] }, wait]);
    const id = "cmd.checkpointSave.update";
    const args = { branchPath, index: 1, label: "언덕" };
    expect(() => runPrimitive(after, target, id, { ...args, expectedHash: eventCommandHash(wait) }))
      .toThrow("그 줄의 내용이 바뀌었습니다");
    const second = runPrimitive(after, target, id, { ...args, expectedHash: eventCommandHash({ kind: "checkpointSave", label: "샘" }) });
    expect(stored(second.after)).toStrictEqual([{ ...fork, then: [text, { kind: "checkpointSave", label: "언덕" }] }, wait]);
  });

  it("지도 대상과 줄 번호로 페이지를 벗어나는 요청을 거절한다", () => {
    const { before, target } = sample("blank", [{ kind: "returnToTitle" }]);
    const otherTarget = mapTarget(before, mapId)!;
    expectRefused(before, otherTarget, "cmd.returnToTitle.insert", {});
    expect(() => runPrimitive(before, target, "cmd.returnToTitle.update", { index: 0, pageId: "page_neighbor" })).toThrow(PrimitiveError);
    expect(() => runPrimitive(before, target, "cmd.returnToTitle.update", { index: 1 })).toThrow("명령 줄");
  });

  it("착지를 다른 칸으로 보정하지 않고 막힌 칸을 거절한다", () => {
    const { before, target } = sample("blank");
    const map = before.maps[mapId]!;
    expect(isPassableLanding(before, map, 2, 2)).toBe(true);
    map.lowerTiles[2 + 2 * map.width] = -1;
    expect(() => runPrimitive(before, target, "cmd.transfer.insert", { mapId, x: 2, y: 2 }))
      .toThrow("도착 칸에서 걸어 나갈 수 없습니다");
  });
});

describe("참조 검증", () => {
  it.each([
    ["cmd.transfer.insert", { mapId: "missing_map", x: 1, y: 1 }, "목적지 맵"],
    ["cmd.transfer.insert", { mapId, x: 100, y: 1 }, "지정한 칸"],
    ["cmd.moveEvent.insert", { eventId: "missing_event" }, "대상 이벤트"],
    ["cmd.setEventGraphicPattern.insert", { eventId: "missing_event" }, "대상 이벤트"],
    ["cmd.changeTile.insert", { x: 1, y: 1, tile: 100000000 }, "타일셋"],
    ["cmd.killPlayer.insert", { gameOverId: "missing_defeat" }, "게임 오버 연출"],
    ["cmd.gameOver.insert", { gameOverId: "missing_defeat" }, "게임 오버 연출"],
    ["cmd.triggerEnding.insert", { endingId: "missing_ending" }, "등록된 엔딩"],
    ["cmd.ending.insert", { musicResourceId: "missing_resource" }, "그림이나 음악"],
    ["cmd.runControl.insert", { mode: "resetRoom", roomId: "missing_room" }, "초기화할 방"],
    ["cmd.runControl.insert", { mode: "advance", seed: 2 }, "탐험 조작"],
    ["cmd.setDifficulty.insert", { difficultyId: "missing_difficulty" }, "등록된 난이도"],
  ] as const)("%s 잘못된 참조 또는 값을 거절한다", (id, args, reason) => {
    const { before, target } = sample("blank", [text]);
    const run = () => runPrimitive(before, target, id, args);
    expect(run).toThrow(PrimitiveError);
    expect(run).toThrow(reason);
    expect(stored(before)).toEqual([text]);
  });
});

function execute(project: Project) {
  const session = startSession(project, 19);
  const result = createInterpreter(stored(project), session, project, { currentEventId: eventId }).start();
  return { result, session };
}

describe("헤드리스 실행", () => {
  it("장소 이동을 지정 좌표와 흰 전환 효과로 전달한다", () => {
    const { before, target } = sample("blank");
    const { after } = runPrimitive(before, target, "cmd.transfer.insert", { mapId, x: 3, y: 2, fade: "white" });
    expect(execute(after).result).toMatchObject({ kind: "transfer", mapId, x: 3, y: 2, fade: "white" });
  });

  it("체크포인트를 만든 뒤 저장 메뉴를 연다", () => {
    const { before, target } = sample("built");
    const first = runPrimitive(before, target, "cmd.checkpointSave.insert", { label: "안전 지대" });
    const { after } = runPrimitive(first.after, target, "cmd.openSaveMenu.insert", {});
    const { result, session } = execute(after);
    expect(result).toEqual({ kind: "openSaveMenu" });
    expect(getSessionCheckpoint(session)?.session).toMatchObject({ currentMapId: mapId, x: 2, y: 2 });
  });

  it("탐험 명령 다섯 가지와 난이도 변경을 실제 세션에 반영한다", () => {
    const { before, target } = sample("blank");
    const runActions: Args[] = [
      { mode: "start", seed: 12, startFloor: 2 },
      { mode: "advance", amount: 3 },
      { mode: "setFlag", flag: "보물 찾음", value: true },
      { mode: "resetRoom" },
      { mode: "end", result: "completed" },
    ];
    const withRun = runActions.reduce((project, args) => runPrimitive(project, target, "cmd.runControl.insert", args).after, before);
    const { after } = runPrimitive(withRun, target, "cmd.setDifficulty.insert", { difficultyId });
    const { result, session } = execute(after);
    expect(result).toEqual({ kind: "done" });
    expect(session.difficultyId).toBe(difficultyId);
    expect(session.roguelikeRun).toMatchObject({
      seed: 12, floor: 5, flags: { "보물 찾음": true }, roomResetCounts: { [mapId]: 1 }, status: "completed",
    });
  });

  it("등록된 엔딩을 실행하고 엔딩 이름을 타이틀 연출로 전달한다", () => {
    const { before, target } = sample("maou");
    const { after } = runPrimitive(before, target, "cmd.triggerEnding.insert", { endingId });
    expect(execute(after).result).toMatchObject({ kind: "returnToTitle", title: "새로운 아침", clear: { endingId } });
  });
});

type SeededCase = CorpusCase & {
  setup?: { commands?: Command[]; difficulties?: DifficultyRecord[] };
};

const corpus = corpusData as SeededCase[];

// These stored rows and difficulty records are absent from the shared fixtures.
describe("이동·시스템·엔딩 요청 코퍼스", () => {
  for (const entry of corpus) {
    it(entry.request, async () => {
      if (!fixtures.has(entry.fixture)) fixtures.set(entry.fixture, loadFixture(entry.fixture));
      const original = fixtures.get(entry.fixture)!;
      const target = resolveTarget(original, entry.target);
      if (target.kind !== "event") throw new Error("검수에 필요한 이벤트 페이지를 고르세요.");
      const map = original.maps[target.mapId]!;
      const before: Project = {
        ...original,
        system: entry.setup?.difficulties ? { ...original.system, difficulties: entry.setup.difficulties } : original.system,
        maps: entry.setup?.commands ? {
          ...original.maps,
          [map.id]: {
            ...map,
            events: map.events.map(event => event.id === target.eventId ? {
              ...event,
              pages: event.pages?.map(page => page.id === target.pageId ? { ...page, commands: entry.setup!.commands! } : page),
            } : event),
          },
        } : original.maps,
      };
      const apply = () => runPrimitive(before, target, entry.primitive, entry.args, entry.selection);
      if (entry.expectRefusal) {
        expect(apply).toThrow(PrimitiveError);
        return;
      }
      const { after, sentence } = apply();
      expectKoreanSentence(sentence, target);
      for (const check of entry.expect ?? []) expect(readCheckPath(after, check.at)).toEqual(check.equals);
      if (entry.setup) await expectUndoRestores(before, after, target);
    });
  }
});
