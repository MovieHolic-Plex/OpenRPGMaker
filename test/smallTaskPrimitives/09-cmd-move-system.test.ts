/** @vitest-environment happy-dom */
import { beforeAll, describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { CHARSET_FRAME_COUNT } from "@/assets/easyrpgRtp";
import { CHOICE_CANCEL_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { mapTarget } from "@/editor/smallTask/target";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError, SELECT_EVENT_PAGE, STALE_COMMAND_LIST } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/09-cmd-move-system";
import { getSessionCheckpoint } from "@/player/checkpoints";
import { createInterpreter } from "@/player/interpreter";
import { isPassableLanding } from "@/project/collision";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { openingMapViewResourceId } from "@/project/openingMapView";
import { roguelikeRoomId } from "@/project/roguelikeRooms";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import corpusData from "../../harness-data/small-task-corpus/09-cmd-move-system.json";
import { expectKoreanSentence, expectRefused, expectUndoRestores, loadFixture, setupCorpusProject } from "./harness";

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
  for (const name of ["blank", "built", "maou"] as const) {
    const fixture = loadFixture(name);
    ensureSwitchVariableSlots(fixture);
    removeLegacySpriteReferences(fixture);
    fixtures.set(name, fixture);
  }
}, 600_000);

function sample(fixture: Fixture, commands: Command[] = []) {
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

function withBlockedLanding(project: Project, y: number, ...xs: number[]): Project {
  const map = project.maps[mapId]!;
  const lowerTiles = [...map.lowerTiles];
  for (const x of xs) lowerTiles[x + y * map.width] = -1;
  return { ...project, maps: { ...project.maps, [mapId]: { ...map, lowerTiles } } };
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
      const expectedHash = edit === "update" ? { expectedHash: eventCommandHash(example.before) } : {};
      const result = runPrimitive(before, target, id, { ...args, ...expectedHash, index: 1 });
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
      .toThrow(STALE_COMMAND_LIST);
    const second = runPrimitive(after, target, id, { ...args, expectedHash: eventCommandHash({ kind: "checkpointSave", label: "샘" }) });
    expect(stored(second.after)).toStrictEqual([{ ...fork, then: [text, { kind: "checkpointSave", label: "언덕" }] }, wait]);
  });

  it("페이지가 여러 개면 대상에서 고른 페이지에만 쓴다", () => {
    const { before, target } = sample("blank", [{ kind: "returnToTitle" }]);
    const mapOnly = mapTarget(before, mapId)!;
    const eventOnly = mapTarget(before, mapId, eventId)!;
    expectRefused(before, mapOnly, "cmd.returnToTitle.insert", {});
    expect(() => runPrimitive(before, eventOnly, "cmd.returnToTitle.insert", {})).toThrow(SELECT_EVENT_PAGE);
    const expectedHash = eventCommandHash({ kind: "returnToTitle" });
    expect(() => runPrimitive(before, target, "cmd.returnToTitle.update", { index: 0, expectedHash, pageId: "page_neighbor" })).toThrow(PrimitiveError);
    expect(() => runPrimitive(before, target, "cmd.returnToTitle.update", { index: 1, expectedHash })).toThrow(STALE_COMMAND_LIST);
    const neighbor = mapTarget(before, mapId, eventId, "page_neighbor")!;
    expect(() => runPrimitive(before, neighbor, "cmd.returnToTitle.update", { index: 0, expectedHash })).toThrow(STALE_COMMAND_LIST);
    const { after } = runPrimitive(before, neighbor, "cmd.returnToTitle.insert", {});
    expect(after.maps[mapId]!.events[0]!.pages![1]!.commands).toStrictEqual([wait, { kind: "returnToTitle" }]);
    expect(stored(after)).toBe(stored(before));
  });

  it("없는 선택지 취소 분기를 만들어 삽입하지 않는다", () => {
    const choices: Command = { kind: "choices", options: [{ text: "듣기", branch: [text] }] };
    const { before, target } = sample("blank", [choices, wait]);
    expect(() => runPrimitive(before, target, "cmd.checkpointSave.insert", {
      branchPath: [0, CHOICE_CANCEL_BRANCH_INDEX],
    })).toThrow("선택한 명령 분기를 찾을 수 없어요.");
    expect(stored(before)).toStrictEqual([choices, wait]);
  });

  it("한 줄을 지우고 다시 끼우는 수정도 미리 읽은 해시를 요구한다", async () => {
    const first: Command = { kind: "killPlayer", gameOverId: defeatId };
    const shifted: Command = { kind: "killPlayer", gameOverId: defeatId, message: "남겨야 할 줄" };
    const fork: Command = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 1 }, then: [shifted, wait], else: [text] };
    const { before, target } = sample("blank", [fork]);
    const id = "cmd.killPlayer.update";
    const args = { branchPath: [0, FORK_THEN_BRANCH_INDEX], index: 0, gameOverId: "" };
    expect(() => runPrimitive(before, target, id, args)).toThrow("동작에 필요한 값의 형식");
    expect(() => runPrimitive(before, target, id, { ...args, expectedHash: eventCommandHash(first) }))
      .toThrow(STALE_COMMAND_LIST);
    expect(stored(before)).toStrictEqual([fork]);
    const { after } = runPrimitive(before, target, id, { ...args, expectedHash: eventCommandHash(shifted) });
    expect(stored(after)).toStrictEqual([{ ...fork, then: [{ kind: "killPlayer", message: shifted.message }, wait] }]);
    await expectUndoRestores(before, after, target);
  });

  it("복합 이동 경로에서 걷는 방향만 바꾸고 회전과 대기를 보존한다", async () => {
    const command: Command = {
      kind: "moveEvent", eventId: "", route: {
        moves: [{ kind: "turn", dir: "right" }, { kind: "wait" }, { kind: "move", dir: "down" }, { kind: "move", dir: "up" }],
        repeat: true, wait: false, skippable: true,
      },
    };
    const { before, target } = sample("blank", [text, command, wait]);
    const id = "cmd.moveEvent.update";
    const args = { index: 1, expectedHash: eventCommandHash(command) };
    const { after } = runPrimitive(before, target, id, { ...args, direction: "left" });
    const [turn, pause] = command.route.moves;
    expect(stored(after)).toStrictEqual([text, {
      ...command, route: { ...command.route, moves: [turn, pause, { kind: "move", dir: "left" }, { kind: "move", dir: "left" }] },
    }, wait]);
    for (const change of [{ steps: 2 }, { direction: "left", steps: 2 }]) {
      expect(() => runPrimitive(before, target, id, { ...args, ...change })).toThrow("걸음 수를 바꿀 수 없습니다");
    }
    expect(stored(before)).toStrictEqual([text, command, wait]);
    await expectUndoRestores(before, after, target);
  });

  it("기존에 막힌 착지점은 유지하고 방향·화면 전환만 고친다", async () => {
    const command: Command = { kind: "transfer", mapId, x: 2, y: 2, fade: "black", door: true };
    const { before: original, target } = sample("blank", [command]);
    const before = withBlockedLanding(original, 2, 2, 3);
    const map = before.maps[mapId]!;
    expect(isPassableLanding(before, map, 2, 2)).toBe(false);
    expect(isPassableLanding(before, map, 3, 2)).toBe(false);
    const args = { index: 0, expectedHash: eventCommandHash(command), direction: "left", fade: "white" };
    const { after } = runPrimitive(before, target, "cmd.transfer.update", args);
    expect(stored(after)).toStrictEqual([{ ...command, direction: "left", fade: "white" }]);
    expect(() => runPrimitive(before, target, "cmd.transfer.update", { ...args, x: 3 }))
      .toThrow("도착 칸에서 걸어 나갈 수 없습니다");
    await expectUndoRestores(before, after, target);
  });

  it("맵이 줄어든 뒤 화면 전환만 고칠 수 있고 새 착지는 범위를 확인한다", () => {
    const command: Command = { kind: "transfer", mapId, x: 5, y: 2, fade: "black" };
    const { before: original, target } = sample("blank", [command]);
    const map = original.maps[mapId]!;
    const tileset = original.tilesets[map.tilesetId]!;
    const resized = createBlankMap(map.name, 5, map.height, tileset.id, tileset.tileSize, tileset);
    const before: Project = {
      ...original,
      maps: { ...original.maps, [mapId]: { ...resized, id: mapId, events: map.events } },
    };
    const args = { index: 0, expectedHash: eventCommandHash(command), fade: "white" };
    const { after } = runPrimitive(before, target, "cmd.transfer.update", args);
    expect(stored(after)).toStrictEqual([{ ...command, fade: "white" }]);
    expect(() => runPrimitive(before, target, "cmd.transfer.update", { ...args, y: 3 }))
      .toThrow("지정한 칸을 맵에서 찾을 수 없습니다");
    const moved = runPrimitive(before, target, "cmd.transfer.update", { ...args, x: 3 });
    expect(stored(moved.after)).toStrictEqual([{ ...command, x: 3, fade: "white" }]);
  });

  it("반복 경로에 완료 대기를 함께 켜는 새 삽입과 수정을 거절한다", () => {
    const command: Command = {
      kind: "moveEvent", eventId: "", route: { moves: [{ kind: "move", dir: "right" }], repeat: false, wait: true },
    };
    const { before, target } = sample("blank", [command]);
    const reason = "반복 이동과 완료 대기를 함께 켤 수 없습니다";
    expect(() => runPrimitive(before, target, "cmd.moveEvent.insert", { repeat: true, wait: true })).toThrow(reason);
    const args = { index: 0, expectedHash: eventCommandHash(command), repeat: true };
    expect(() => runPrimitive(before, target, "cmd.moveEvent.update", args)).toThrow(reason);
    const { after } = runPrimitive(before, target, "cmd.moveEvent.update", { ...args, wait: false });
    expect(stored(after)).toStrictEqual([{ ...command, route: { ...command.route, repeat: true, wait: false } }]);
    expect(stored(before)).toStrictEqual([command]);
  });

  it("착지를 다른 칸으로 보정하지 않고 막힌 칸을 거절한다", () => {
    const { before: original, target } = sample("blank");
    expect(isPassableLanding(original, original.maps[mapId]!, 2, 2)).toBe(true);
    const before = withBlockedLanding(original, 2, 2);
    expect(() => runPrimitive(before, target, "cmd.transfer.insert", { mapId, x: 2, y: 2 }))
      .toThrow("도착 칸에서 걸어 나갈 수 없습니다");
  });
});

describe("참조 검증", () => {
  it("페이지 외형이 선택한 캐릭터셋의 프레임 범위를 검사한다", () => {
    const { before: original, target } = sample("blank");
    const map = original.maps[mapId]!;
    const [event, ...otherEvents] = map.events;
    const [page, ...otherPages] = event.pages!;
    const appearance = {
      id: "appearance_unit09", name: "광장 안내인", description: "",
      charset: { resourceId: "easyrpg-charset-actor1", characterIndex: 0 },
    };
    const events = [{ ...event, pages: [{ ...page, graphic: { appearanceId: appearance.id } }, ...otherPages] }, ...otherEvents];
    const before: Project = {
      ...original,
      maps: { ...original.maps, [mapId]: { ...map, events } },
      database: { ...original.database, characterAppearances: [appearance] },
    };
    const insert = (pattern: number) => runPrimitive(before, target, "cmd.setEventGraphicPattern.insert", { pattern });
    expect(stored(insert(CHARSET_FRAME_COUNT - 1).after)).toEqual([
      { kind: "setEventGraphicPattern", eventId: "", pattern: CHARSET_FRAME_COUNT - 1 },
    ]);
    expect(() => insert(CHARSET_FRAME_COUNT)).toThrow("대상 이벤트의 그림에 그 프레임이 없습니다");
  });

  it("선택한 페이지의 업로드 스프라이트에서 실제 프레임 범위를 확인한다", () => {
    const { before: original } = sample("blank");
    const map = original.maps[mapId]!;
    const [event, ...otherEvents] = map.events;
    const [page, ...otherPages] = event.pages!;
    const spriteId = "sprite_unit09";
    const graphic: EventPage["graphic"] = { ...page.graphic, sprite: { type: "uploaded", id: spriteId } };
    const events = [{ ...event, pages: [{ ...page, graphic }, ...otherPages] }, ...otherEvents];
    const before: Project = {
      ...original,
      maps: { ...original.maps, [mapId]: { ...map, events } },
      assets: { ...original.assets, uploaded: {
        ...original.assets.uploaded,
        [spriteId]: { id: spriteId, name: "문", kind: "sprite", meta: { width: 32, height: 16, frameWidth: 16, frameHeight: 16, frames: 2 } },
      } },
    };
    const target = mapTarget(before, mapId, eventId, pageId)!;
    const insert = (pattern: number) => runPrimitive(before, target, "cmd.setEventGraphicPattern.insert", { pattern });
    const { after } = insert(1);
    expect(stored(after)).toStrictEqual([{ kind: "setEventGraphicPattern", eventId: "", pattern: 1 }]);
    expect(() => insert(2)).toThrow("대상 이벤트의 그림에 그 프레임이 없습니다");
    expect(stored(before)).toStrictEqual([]);
  });

  it("엔딩 음악과 배경의 미디어 종류를 확인하고 비우면 참조를 제거한다", async () => {
    const command: Command = { kind: "ending", title: "달빛", message: "잘 가.", presentation: { portraits: "none", tone: "warm" } };
    const { before, target } = sample("blank", [command]);
    const musicResourceId = "cc0-bgm-town";
    const backgroundResourceId = "oprn-title-bright";
    const args = { index: 0, expectedHash: eventCommandHash(command) };
    const update = (presentation: Args) => runPrimitive(before, target, "cmd.ending.update", { ...args, ...presentation });
    expect(() => update({ musicResourceId: backgroundResourceId })).toThrow("엔딩 음악에는 배경음악");
    expect(() => update({ backgroundResourceId: musicResourceId })).toThrow("엔딩 배경에는 그림");
    const { after } = update({ musicResourceId, backgroundResourceId });
    const withMedia = { ...command, presentation: { ...command.presentation, musicResourceId, backgroundResourceId } };
    expect(stored(after)).toStrictEqual([withMedia]);
    const { after: cleared } = runPrimitive(after, target, "cmd.ending.update", {
      index: 0, expectedHash: eventCommandHash(withMedia), musicResourceId: "", backgroundResourceId: "",
    });
    expect(stored(cleared)).toStrictEqual([command]);
    await expectUndoRestores(after, cleared, target);
  });

  it("존재하는 맵은 엔딩 배경에 쓸 수 있다", () => {
    const { before, target } = sample("blank");
    const backgroundResourceId = openingMapViewResourceId(mapId);
    const { after } = runPrimitive(before, target, "cmd.ending.insert", { backgroundResourceId });
    expect(execute(after).result).toMatchObject({ kind: "returnToTitle", presentation: { backgroundResourceId } });
    expect(() => runPrimitive(before, target, "cmd.ending.insert", {
      backgroundResourceId: openingMapViewResourceId("missing_map"),
    })).toThrow(PrimitiveError);
  });

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
    const { before: original, target } = sample("blank");
    const defaultDifficulty = { id: "difficulty_easy_unit09", name: "쉬움" };
    const before: Project = {
      ...original,
      system: {
        ...original.system,
        defaultDifficultyId: defaultDifficulty.id,
        difficulties: [defaultDifficulty, ...original.system.difficulties!],
      },
    };
    const runActions: Args[] = [
      { mode: "start", seed: 12, startFloor: 2 },
      { mode: "advance", amount: 3 },
      { mode: "setFlag", flag: "보물 찾음", value: true },
      { mode: "resetRoom" },
      { mode: "end", result: "completed" },
    ];
    const withRun = runActions.reduce((project, args) => runPrimitive(project, target, "cmd.runControl.insert", args).after, before);
    const { after } = runPrimitive(withRun, target, "cmd.setDifficulty.insert", { difficultyId });
    const session = startSession(after, 19);
    expect(session.difficultyId).toBe(defaultDifficulty.id);
    const result = createInterpreter(stored(after), session, after, { currentEventId: eventId }).start();
    expect(result).toEqual({ kind: "done" });
    expect(session.difficultyId).toBe(difficultyId);
    expect(session.roguelikeRun).toMatchObject({
      seed: 12, floor: 5, flags: { "보물 찾음": true }, roomResetCounts: { [mapId]: 1 }, status: "completed",
    });
  });

  it("탐험 방 초기화에서 기존 대상을 지우면 현재 방을 초기화한다", () => {
    const fixture = fixtures.get("built")!;
    const roomId = roguelikeRoomId(fixture.maps[fixture.startMapId]!);
    const command: Command = { kind: "runControl", action: "resetRoom", roomId };
    const { before, target } = sample("built", [{ kind: "runControl", action: "start" }, command]);
    const update = (fields: Args) => runPrimitive(before, target, "cmd.runControl.update", {
      index: 1, expectedHash: eventCommandHash(command), ...fields,
    }).after;
    expect(stored(update({}))[1]).toEqual(command);
    const after = update({ roomId: "" });
    expect(stored(after)[1]).toEqual({ kind: "runControl", action: "resetRoom" });
    expect(execute(after).session.roguelikeRun?.roomResetCounts).toEqual({ [mapId]: 1 });
  });

  it("등록된 엔딩을 실행하고 엔딩 이름을 타이틀 연출로 전달한다", () => {
    const { before, target } = sample("maou");
    const { after } = runPrimitive(before, target, "cmd.triggerEnding.insert", { endingId });
    expect(execute(after).result).toMatchObject({ kind: "returnToTitle", title: "새로운 아침", clear: { endingId } });
  });
});

const corpus = corpusData as CorpusCase[];
describe("이동·시스템·엔딩 요청 코퍼스", () => {
  for (const entry of corpus) {
    it(entry.request, async () => {
      const before = setupCorpusProject(fixtures.get(entry.fixture)!, entry);
      const target = resolveTarget(before, entry.target);
      if (target.kind !== "event") throw new Error("검수에 필요한 이벤트 페이지를 고르세요.");
      const apply = () => runPrimitive(before, target, entry.primitive, entry.args, entry.selection);
      if (entry.expectRefusal) {
        expect(apply).toThrow(PrimitiveError);
        if (entry.refusalMessage) expect(apply).toThrow(new RegExp(entry.refusalMessage, "u"));
        return;
      }
      const { after, sentence } = apply();
      expectKoreanSentence(sentence, target);
      for (const check of entry.expect ?? []) expect(readCheckPath(after, check.at)).toEqual(check.equals);
      if (entry.setup) await expectUndoRestores(before, after, target);
    });
  }
});
