// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { normalizeEventPage } from "@/editor/eventPages";
import { updateScopedPage } from "@/editor/smallTask/primitives/core/helpers";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError, SELECT_EVENT_PAGE } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/16-cond-world-social";
import { createInterpreter } from "@/player/interpreter";
import { findFacedItemTarget } from "@/player/itemUseOnTarget";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { resolveEventPage } from "@/project/io/pageResolution";
import { setLayerTileAt } from "@/project/mapLayers";
import { npcScheduleTargetForEvent } from "@/project/npcSchedule";
import { endRoguelikeRun, startRoguelikeRun } from "@/project/roguelikeRun";
import { runtimeEventViewById, runtimeEventViewsForMap, type RuntimeEventPositions } from "@/project/runtimeEventState";
import { applyRuntimeMapOverrides } from "@/project/runtimeMap";
import { setMapTileOverride, startSession, type PlaySession } from "@/project/session";
import { cachedSightBlocker } from "@/project/sightBlockers";
import type { Condition, DifficultyRecord, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import corpus from "../../harness-data/small-task-corpus/16-cond-world-social.json";
import { eventTarget, expectKoreanSentence, expectRefused, expectUndoRestores, loadFixture, mapTarget } from "./harness";

const TOWN = "map_1c3b4f24-9d3d-4c31-9d24-4dbda2df705d";
const SHOP = "map_mk_konbini";
const BLANK = "map_test_town";
const EVENT = "ev_test_dialogue";
const PAGE = "pg_test_main";
const REWARD: EventPage["commands"] = [{ kind: "changeGold", op: "+=", amount: 3 }];
const EXISTING: Condition = { kind: "selfSwitch", key: "A", value: false };
const DIFFICULTIES: DifficultyRecord[] = [
  { id: "easy", name: "쉬움" }, { id: "normal", name: "보통" }, { id: "hard", name: "어려움" },
];

function testTown(project = loadFixture("blank")) {
  const page = normalizeEventPage({ id: PAGE, name: "손님 맞이", commands: REWARD });
  const fallback = normalizeEventPage({ id: "pg_test_base", name: "평소의 인사" });
  const watcher: GameEvent = {
    id: "ev_test_guard", name: "문지기", characterId: "guard_test", x: 4, y: 4,
    trigger: { kind: "action" }, commands: [], pages: [{ ...fallback, id: "pg_test_guard" }],
  };
  const event: GameEvent = {
    id: EVENT, name: "서윤", characterId: "host_test", x: 2, y: 2,
    trigger: { kind: "action" }, commands: [],
    schedule: [{ when: { timePhase: "day" }, at: { mapId: BLANK, x: 2, y: 2 }, activity: "work" }],
    pages: [fallback, page],
  };
  const map = { ...createBlankMap("마을", 8, 8), id: BLANK, events: [event, watcher],
    locations: [{ id: "loc_test_shop", name: "가게", x: 2, y: 2, w: 3, h: 3 }] };
  return {
    ...project, maps: { ...project.maps, [BLANK]: map }, startMapId: BLANK,
    startPos: { x: 1, y: 1 }, mapTree: { mapId: BLANK, children: [] },
    system: { ...project.system, difficulties: DIFFICULTIES },
  };
}

type Place = readonly [fixture: "blank" | "built" | "maou", mapId: string, eventId: string, pageId: string];

const blank: Place = ["blank", BLANK, EVENT, PAGE];
const built: Place = ["built", TOWN, "ev_supply_shop", "ev_supply_shop_active"];
const maou: Place = ["maou", SHOP, "ev_mk_hina", "ev_mk_hina_p3"];
const sharedProjects = new Map<"built" | "maou", Project>();

function fixtureProject(name: Place[0]): Project {
  if (name === "blank") return testTown();
  let project = sharedProjects.get(name);
  if (!project) {
    project = loadFixture(name);
    // Match the editor's normalization before the first primitive freezes the fixture.
    ensureSwitchVariableSlots(project);
    removeLegacySpriteReferences(project);
    sharedProjects.set(name, project);
  }
  return project;
}

function fixture(place: Place) {
  const [name, mapId, eventId, pageId] = place;
  const project = fixtureProject(name);
  const target = eventTarget(project, mapId, eventId, pageId);
  return { project, target, mapId, eventId, pageId };
}

function getEvent(project: Project, at: ReturnType<typeof fixture>) {
  return project.maps[at.mapId]!.events.find((event) => event.id === at.eventId)!;
}

function getPage(project: Project, at: ReturnType<typeof fixture>) {
  return getEvent(project, at).pages!.find((page) => page.id === at.pageId)!;
}

const cases: readonly { place: Place; args: Record<string, unknown>; stored: Condition; preview: string }[] = [
  { place: built, args: { phase: "night" }, stored: { kind: "timePhase", phase: "night" }, preview: "밤" },
  { place: built, args: { season: "winter" }, stored: { kind: "season", season: "winter" }, preview: "겨울" },
  { place: blank, args: { weekdays: [6, 1, 6] }, stored: { kind: "weekday", weekdays: [1, 6] }, preview: "월요일·토요일" },
  { place: blank, args: {}, stored: { kind: "npcActivity", activity: "work" }, preview: "「일」" },
  { place: built, args: { locationId: "loc10", inside: false }, stored: { kind: "insideLocation", locationId: "loc10", inside: false }, preview: "마을 광장」 밖" },
  { place: maou, args: { npcKey: "hina", value: 50 }, stored: { kind: "friendshipAtLeast", npcKey: "hina", value: 50 }, preview: "히나」의 호감도가 50" },
  { place: maou, args: { npcKey: "lily", state: "engaged" }, stored: { kind: "relationshipAtLeast", npcKey: "lily", state: "engaged" }, preview: "리리」와의 관계" },
  { place: built, args: { result: "escape" }, stored: { kind: "battleResult", result: "escape" }, preview: "도망쳤을 때" },
  { place: blank, args: { query: "floor", value: 3 }, stored: { kind: "run", query: "floor", op: ">=", value: 3 }, preview: "3층 이상" },
  { place: blank, args: { subject: "event", dir: "left" }, stored: { kind: "facing", subject: "event", dir: "left" }, preview: "이 이벤트가 왼쪽" },
  { place: blank, args: { relation: "eventBehindPlayer" }, stored: { kind: "relativeFacing", relation: "eventBehindPlayer" }, preview: "주인공의 등 뒤" },
  { place: blank, args: { value: false }, stored: { kind: "hiding", value: false }, preview: "숨지 않았을 때" },
  { place: blank, args: { eventId: "ev_test_guard" }, stored: { kind: "pursuitActive", eventId: "ev_test_guard", value: true }, preview: "문지기" },
  {
    place: blank,
    args: { watcherCharacterId: "guard_test", watcherLocationId: "loc_test_shop", range: 4, nightRange: 2, doorsBlock: true },
    stored: { kind: "eventSeesPlayer", eventId: "", range: 4, value: true, watchers: { characterId: "guard_test", locationId: "loc_test_shop" },
      darkness: { night: 2 }, doorsBlock: true },
    preview: "가게",
  },
  { place: built, args: { op: ">", value: 2 }, stored: { kind: "clearCount", op: ">", value: 2 }, preview: "2회 초과" },
  { place: maou, args: { endingId: "end_mk_best_employee", value: false }, stored: { kind: "endingSeen", endingId: "end_mk_best_employee", value: false }, preview: "이달의 우수 사원" },
  { place: built, args: {}, stored: { kind: "newGamePlus", value: true }, preview: "강하게 다시 하기" },
  { place: blank, args: { difficultyId: "hard" }, stored: { kind: "difficulty", difficultyId: "hard" }, preview: "어려움" },
];

describe("선택한 이벤트 페이지의 월드 조건", () => {
  beforeAll(() => {
    // Building the full flagship project takes longer than an individual case.
    fixtureProject("maou");
  }, 180_000);

  it.each(cases)("$stored.kind 조건만 저장하고 한 번에 되돌린다", async ({ place, args, stored, preview }) => {
    const at = fixture(place);
    const { project, target } = at;
    const original = getPage(project, at);
    const before = structuredClone(original);
    const primitive = `cond.${stored.kind}.page.set`;
    const result = runPrimitive(project, target, primitive, args);

    expect(getPage(result.after, at)).toEqual({ ...before, conditions: [...before.conditions, stored] });
    expect(getPage(project, at)).toEqual(before);
    expect(getPage(result.after, at).commands).toBe(original.commands);
    expect(getEvent(result.after, at).pages!.filter((page) => page.id !== at.pageId))
      .toEqual(getEvent(project, at).pages!.filter((page) => page.id !== at.pageId));
    expectKoreanSentence(result.sentence, target);
    expect(result.sentence).toContain(preview);
    expect(result.sentence).toMatch(/^[^.!?{}\[\]\n]+\.$/u);
    expect(result.sentence.length).toBeLessThanOrEqual(80);
    expect(result.sentence).not.toMatch(/(?:ev_|map_|loc\d|end_|diff_|cond\.)/u);
    expectRefused(project, mapTarget(project, at.mapId), primitive, args);
    await expectUndoRestores(project, result.after, target);
  });

  it("같은 조건을 제자리에서 교체하고 같은 종류의 조건이 여러 개면 거부한다", () => {
    const at = fixture(blank);
    const page = getPage(at.project, at);
    const old: Condition = { kind: "season", season: "summer" };
    const other: Condition = { kind: "not", condition: { kind: "season", season: "spring" } };
    page.conditions = [EXISTING, old, other];
    const args = { season: "winter" };
    const id = "cond.season.page.set";
    const result = runPrimitive(at.project, at.target, id, args);
    expect(getPage(result.after, at).conditions).toEqual([EXISTING, { kind: "season", season: "winter" }, other]);
    expect(page.conditions).toEqual([EXISTING, old, other]);

    const duplicate = updateScopedPage(at, (original) => ({
      ...original, conditions: [...original.conditions, { kind: "season", season: "fall" }],
    }));
    expect(() => runPrimitive(duplicate, at.target, id, args)).toThrow(/같은 종류의 조건이 여러 개/u);
  });

  it("복합 시야의 거리만 고치고 한 번의 되돌리기로 원래 조건을 돌린다", async () => {
    const at = fixture(blank);
    const page = getPage(at.project, at);
    const old: Condition = {
      kind: "eventSeesPlayer", eventId: "", range: 5, value: false, sameRoom: true, requireFacing: false,
      hearRange: 4, doorsBlock: true, watchers: { characterId: "guard_test", name: "문지기", locationId: "loc_test_shop" },
      darkness: { night: 2, dark: 1, darkAmbient: 0.8 },
    };
    const later: Condition = { kind: "season", season: "summer" };
    page.conditions = [EXISTING, old, later];
    const id = "cond.eventSeesPlayer.page.set";
    const { after, sentence } = runPrimitive(at.project, at.target, id, { range: 3 });

    expect(getPage(after, at).conditions).toEqual([EXISTING, { ...old, range: 3 }, later]);
    expect(getPage(after, at).commands).toBe(page.commands);
    expect(page.conditions).toEqual([EXISTING, old, later]);
    expect(sentence).toContain("중 아무도");
    expectRefused(after, at.target, id, { sameRoom: false }, /같은 방 제한/u);
    await expectUndoRestores(at.project, after, at.target);

    const updated = runPrimitive(after, at.target, id, { eventId: "ev_test_guard", darkAmbient: 0.7 });
    const { watchers: _watchers, ...direct } = old;
    expect(getPage(updated.after, at).conditions[1]).toEqual({
      ...direct, eventId: "ev_test_guard", range: 3, darkness: { night: 2, dark: 1, darkAmbient: 0.7 },
    });
    const overrides = runPrimitive(updated.after, at.target, id, { nightRange: 1, darkRange: 0 });
    expect(overrides.sentence).toContain("밤 1칸");
    expect(overrides.sentence).toContain("어둠 0칸");
  });

  it("선택한 인물의 일정에 없는 활동은 다른 인물에게 등록돼 있어도 거부한다", () => {
    const at = fixture(blank);
    const owner = getEvent(at.project, at);
    const guard = at.project.maps[at.mapId]!.events.find((event) => event.id === "ev_test_guard")!;
    guard.schedule = [{ ...owner.schedule![0]!, activity: "rest" }];
    const id = "cond.npcActivity.page.set";
    expectRefused(at.project, at.target, id, { activity: "rest" }, /이 이벤트의 일정/u);
    expectRefused(at.project, at.target, id, { activity: "wrok" }, /이 이벤트의 일정/u);
    expect(getPage(at.project, at).conditions).toEqual([]);
  });

  it("조건을 다른 페이지나 다른 이벤트에 쓴 변경을 가드가 범위 밖으로 거부한다", () => {
    const at = fixture(blank);
    const { project, target } = at;
    const primitive = PRIMITIVES.find((row) => row.id === "cond.timePhase.page.set")!;
    const args = { phase: "night" };
    const scope = primitive.scope({ project, target }, args);
    expect(scope).toEqual({ kind: "eventPage", field: "conditions", mapId: BLANK, eventId: EVENT, pageId: PAGE });
    expectRefused(project, mapTarget(project, BLANK), primitive.id, args);

    for (const [eventId, pageId] of [[EVENT, "pg_test_base"], ["ev_test_guard", "pg_test_guard"]] as const) {
      const otherTarget = eventTarget(project, BLANK, eventId, pageId);
      const foreignEdit = primitive.apply({ project, target: otherTarget }, args);
      const refusal = checkSmallTaskScope(project, foreignEdit, scope);
      expect(refusal.ok).toBe(false);
      if (!refusal.ok) expect(refusal.reason).toMatch(/범위 밖/u);
    }

    const commandEdit = structuredClone(project);
    getPage(commandEdit, at).commands = [{ kind: "text", body: "조건과 함께 들어온 다른 명령" }];
    const refusal = checkSmallTaskScope(project, commandEdit, scope);
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) expect(refusal.reason).toMatch(/범위 밖/u);
  });

  it("페이지가 여럿이면 조건을 바꿀 페이지를 먼저 고르도록 안내한다", () => {
    const at = fixture(blank);
    const target = eventTarget(at.project, at.mapId, at.eventId);
    const apply = () => runPrimitive(at.project, target, "cond.timePhase.page.set", { phase: "night" });
    expect(apply).toThrow(SELECT_EVENT_PAGE);
    expect(getPage(at.project, at).conditions).toEqual([]);
  });

  it("읽는 참조가 같은 맵에 있어도 모델이 페이지나 맵을 바꿔 쓸 수 없다", () => {
    const at = fixture(blank);
    const { project, target } = at;
    const id = "cond.insideLocation.page.set";
    const before = structuredClone(getEvent(project, at));
    const redirect = { locationId: "loc_test_shop", eventId: "ev_test_guard", pageId: "pg_test_guard", mapId: "map_elsewhere" };
    expect(() => runPrimitive(project, target, id, redirect)).toThrow(PrimitiveError);
    expect(getEvent(project, at)).toEqual(before);
  });

  it.each([
    ["insideLocation", { locationId: "loc_missing" }, "구역"],
    ["insideLocation", { locationId: "loc_test_shop", eventId: "ev_missing" }, "이벤트"],
    ["friendshipAtLeast", { npcKey: "missing_character" }, "인물"],
    ["relationshipAtLeast", { npcKey: "missing_character" }, "인물"],
    ["pursuitActive", { eventId: "ev_missing" }, "이벤트"],
    ["eventSeesPlayer", { watcherLocationId: "loc_missing" }, "구역"],
    ["eventSeesPlayer", { watcherCharacterId: "missing_character" }, "인물"],
    ["eventSeesPlayer", { watcherCharacterId: "guard_test", watcherName: "서윤", watcherLocationId: "loc_test_shop", value: false }, "관찰자"],
    ["eventSeesPlayer", { watcherName: "없는 이름" }, "관찰자"],
    ["eventSeesPlayer", { sameRoom: false, doorsBlock: true }, "같은 방 제한"],
    ["endingSeen", { endingId: "end_missing" }, "엔딩"],
    ["difficulty", { difficultyId: "diff_missing" }, "난이도"],
    ["weekday", { weekdays: [] }, "값의 형식"],
    ["clearCount", { value: -1 }, "값의 형식"],
    ["run", { query: "flag", flag: "   " }, "탐험 기록"],
  ] as const)("%s 조건의 잘못된 값을 한국어로 거부한다", (kind, args, message) => {
    const { project, target } = fixture(blank);
    const apply = () => runPrimitive(project, target, `cond.${kind}.page.set`, args);
    expect(apply).toThrow(PrimitiveError);
    expect(apply).toThrow(message);
  });
});

describe("난이도를 저작한 프로젝트의 코퍼스", () => {
  // These cases are refused by the shared fixture until its difficulty rows are authored.
  const rows = (corpus as CorpusCase[]).filter((row) => row.primitive === "cond.difficulty.page.set" && row.expect?.length);
  const base = fixtureProject("built");
  const project = { ...base, system: { ...base.system, difficulties: DIFFICULTIES } };
  it.each(rows)("$request", async ({ target: selector, primitive, args, expect: checks }) => {
    const target = resolveTarget(project, selector);
    const { after, sentence } = runPrimitive(project, target, primitive, args);
    for (const check of checks!) expect(readCheckPath(after, check.at), check.at).toEqual(check.equals);
    expectKoreanSentence(sentence, target);
    await expectUndoRestores(project, after, target);
  });
});

describe("실행 중 등장 조건 판정", () => {
  function checkGold(kind: Condition["kind"], args: Record<string, unknown>, misses: Partial<PlaySession>, matches: Partial<PlaySession>) {
    const at = fixture(blank);
    const { project, target } = at;
    const { after } = runPrimitive(project, target, `cond.${kind}.page.set`, args);
    const event = getEvent(after, at);
    const map = after.maps[at.mapId]!;

    function earned(overrides: Partial<PlaySession>) {
      const session = Object.assign(startSession(after, 7), overrides);
      const page = resolveEventPage(event, session, { locations: map.locations });
      const previousGold = session.gold;
      expect(createInterpreter(page!.commands, session, after, { currentEventId: event.id }).start().kind).toBe("done");
      return session.gold - previousGold;
    }

    expect(earned(misses)).toBe(0);
    expect(earned(matches)).toBe(3);
  }

  const day = { day: 1, year: 1, season: "spring", minute: 0 } as const;

  it("낮에는 기본 페이지를 실행하고 밤에는 보상을 주는 페이지를 실행한다", () => {
    checkGold("timePhase", { phase: "night" }, { gameTime: { ...day, hour: 13 } }, { gameTime: { ...day, hour: 23 } });
  });

  it("구역 경계의 한 칸 바깥과 한 칸 안을 구분한다", () => {
    checkGold("insideLocation", { locationId: "loc_test_shop" }, { x: 1, y: 2 }, { x: 2, y: 2 });
  });

  it("이 이벤트에 연결된 인물의 호감도로 보상 여부를 가른다", () => {
    checkGold("friendshipAtLeast", { value: 50 }, { friendship: { host_test: 49 } }, { friendship: { host_test: 50 } });
  });

  it("클리어 횟수가 두 번에 도달했을 때만 보상을 준다", () => {
    checkGold("clearCount", { value: 2 }, { clearHistory: { count: 1, endingIds: [] } }, { clearHistory: { count: 2, endingIds: [] } });
  });

  it("등록된 난이도와 현재 세션의 난이도가 같을 때 보상을 준다", () => {
    checkGold("difficulty", { difficultyId: "hard" }, { difficultyId: "normal" }, { difficultyId: "hard" });
  });

  it("일정에서 실제로 발생한 활동으로 등장 페이지를 고른다", () => {
    const at = fixture(blank);
    const authored = getEvent(at.project, at);
    authored.schedule = [{ ...authored.schedule![0]!, activity: "  빵 굽기  " }];
    const { after } = runPrimitive(at.project, at.target, "cond.npcActivity.page.set", { activity: "빵 굽기" });
    const event = getEvent(after, at);
    const session = startSession(after, 7);
    expect(resolveEventPage(event, session)?.id).toBe("pg_test_base");
    const activity = npcScheduleTargetForEvent(at.mapId, event, { ...day, hour: 13 }, undefined)?.activity;
    expect(activity).toBe("빵 굽기");
    session.npcActivities = { [event.id]: activity! };
    expect(resolveEventPage(event, session)?.id).toBe(PAGE);
  });

  it.each(["completed", "failed", "abandoned"] as const)("탐험 상태가 %s여도 기록의 층 조건을 평가한다", (status) => {
    const at = fixture(blank);
    const { after, sentence } = runPrimitive(at.project, at.target, "cond.run.page.set", { query: "floor", value: 3 });
    expect(sentence).toContain("탐험 기록의 층이 3층 이상");
    const event = getEvent(after, at);
    const session = startSession(after, 7);
    expect(resolveEventPage(event, session)?.id).toBe("pg_test_base");
    startRoguelikeRun(session, { seed: 7, startFloor: 3 });
    expect(resolveEventPage(event, session)?.id).toBe(PAGE);
    expect(endRoguelikeRun(session, status)).toBe(true);
    expect(resolveEventPage(event, session)?.id).toBe(PAGE);
  });

  it("관찰자의 거리와 방향을 평가한다", () => {
    const at = fixture(blank);
    const { project, target } = at;
    const args = { eventId: "ev_test_guard", range: 3, sameRoom: false };
    const { after } = runPrimitive(project, target, "cond.eventSeesPlayer.page.set", args);
    const observer = () => ({ x: 4, y: 4, direction: "left" as const });
    const session = Object.assign(startSession(after, 7), { x: 2, y: 4 });
    const event = getEvent(after, at);
    expect(resolveEventPage(event, session, { eventPosition: observer })?.id).toBe(PAGE);
    session.x = 6;
    expect(resolveEventPage(event, session, { eventPosition: observer })?.id).toBe("pg_test_base");
    expect(jsonEqual(getPage(project, at).conditions, [])).toBe(true);
  });

  it.each([true, false])("구역에 들어오고 나가는 관찰자로 발견 조건 %s을 판정한다", (value) => {
    const at = fixture(blank);
    const args = { watcherCharacterId: "guard_test", watcherName: "문지기", watcherLocationId: "loc_test_shop", range: 3, value };
    const { after } = runPrimitive(at.project, at.target, "cond.eventSeesPlayer.page.set", args);
    const map = after.maps[at.mapId]!;
    for (const [x, inLocation] of [[5, false], [4, true]] as const) {
      const session = Object.assign(startSession(after, 7), { x: 3, y: 4 });
      const eventPositions = { ev_test_guard: { x, y: 4, direction: "left" as const } };
      const matches = inLocation === value;
      expect(runtimeEventViewById(after, map, session, eventPositions, at.eventId)?.pageId).toBe(matches ? PAGE : "pg_test_base");
      const priorGold = session.gold;
      const command = { kind: "callMapEvent", eventId: at.eventId } as const;
      expect(createInterpreter([command], session, after, { eventPositions }).start().kind).toBe("done");
      expect(session.gold - priorGold).toBe(matches ? 3 : 0);
    }
  });

  it("다른 맵에서 옮겨 온 관찰자를 포함하고 원본 맵에서 제거되면 제외한다", () => {
    const at = fixture(blank);
    const { after } = runPrimitive(at.project, at.target, "cond.eventSeesPlayer.page.set", {
      watcherName: "문지기", watcherLocationId: "loc_test_shop", range: 3,
    });
    const map = after.maps[at.mapId]!;
    const guard = map.events.find((event) => event.id === "ev_test_guard")!;
    const source = { ...createBlankMap("경비실", 8, 8), id: "guard_room", events: [guard] };
    const current = { ...map, events: map.events.filter((event) => event.id !== guard.id) };
    const project = { ...after, maps: { ...after.maps, [at.mapId]: current, [source.id]: source } };
    const session = Object.assign(startSession(project, 7), { x: 2, y: 4 });
    session.eventLocations = { [guard.id]: { mapId: at.mapId, x: 4, y: 4, direction: "left" } };
    const activePage = () => runtimeEventViewById(project, current, session, {}, at.eventId)?.pageId;
    expect(activePage()).toBe(PAGE);
    session.removedEventIds = { [source.id]: [guard.id] };
    expect(activePage()).toBe("pg_test_base");
  });

  it.each(["실시간 위치", "이동 기록", "저작 위치"] as const)("이름을 지정한 관찰자가 지워지면 %s에서 제외한다", (source) => {
    const at = fixture(blank);
    const guardId = "ev_test_guard";
    const { after } = runPrimitive(at.project, at.target, "cond.eventSeesPlayer.page.set", {
      eventId: guardId, range: 3, requireFacing: false,
    });
    const session = Object.assign(startSession(after, 7), { x: 2, y: 4 });
    const position = { x: 4, y: 4, direction: "left" as const };
    const positions: RuntimeEventPositions = source === "실시간 위치" ? { [guardId]: position } : {};
    if (source === "이동 기록") session.eventLocations = { [guardId]: { ...position, mapId: at.mapId } };
    const activePage = () => runtimeEventViewById(after, after.maps[at.mapId]!, session, positions, at.eventId)?.pageId;
    expect(activePage()).toBe(PAGE);
    session.erasedEventIds = [guardId];
    expect(activePage()).toBe("pg_test_base");
  });

  it.each([
    ["facing", { subject: "event", dir: "left" }],
    ["relativeFacing", { relation: "playerBehindEvent" }],
  ] as const)("%s 페이지가 실시간 방향과 같은 맵의 이동 기록을 읽는다", (kind, args) => {
    const at = fixture(blank);
    const { after } = runPrimitive(at.project, at.target, `cond.${kind}.page.set`, args);
    const map = after.maps[at.mapId]!;
    const session = Object.assign(startSession(after, 7), { x: 4, y: 2 });
    const atHost = { x: 3, y: 2 };
    const activePage = (direction?: "left" | "right") => runtimeEventViewById(after, map, session, {
      [at.eventId]: { ...atHost, direction },
    }, at.eventId)?.pageId;
    expect(activePage()).toBe("pg_test_base");
    expect(activePage("left")).toBe(PAGE);
    expect(activePage("right")).toBe("pg_test_base");
    session.eventLocations = { [at.eventId]: { ...atHost, mapId: at.mapId, direction: "left" } };
    expect(activePage()).toBe(PAGE);
    session.eventLocations[at.eventId] = { ...atHost, mapId: "elsewhere", direction: "left" };
    expect(activePage("left")).toBeUndefined();
  });

  it("하층 타일 변경과 복원이 캐시된 시야 판정과 맵 이벤트 호출에 반영된다", () => {
    const at = fixture(blank);
    const { after } = runPrimitive(at.project, at.target, "cond.eventSeesPlayer.page.set", {
      eventId: "ev_test_guard", range: 3,
    });
    const map = structuredClone(after.maps[at.mapId]!);
    const session = Object.assign(startSession(after, 7), { x: 2, y: 4 });
    const positions = { ev_test_guard: { x: 4, y: 4, direction: "left" as const } };
    const index = 4 * map.width + 3;
    const floor = map.lowerTiles[index]!;
    const activePage = () => runtimeEventViewById(after, map, session, positions, at.eventId)?.pageId;
    const earned = () => {
      const gold = session.gold;
      const commands = [{ kind: "callMapEvent", eventId: at.eventId }] as const;
      expect(createInterpreter([...commands], session, after, { eventPositions: positions }).start().kind).toBe("done");
      return session.gold - gold;
    };
    expect(activePage()).toBe(PAGE);
    const initialBlocker = cachedSightBlocker(after, map);
    setMapTileOverride(session, map.id, "upper", index, floor);
    applyRuntimeMapOverrides(map, session);
    expect(cachedSightBlocker(after, map)).toBe(initialBlocker);
    setMapTileOverride(session, map.id, "lower", index, -1);
    applyRuntimeMapOverrides(map, session);
    expect(activePage()).toBe("pg_test_base");
    expect(earned()).toBe(0);
    setMapTileOverride(session, map.id, "lower2", index, floor);
    applyRuntimeMapOverrides(map, session);
    expect(activePage()).toBe(PAGE);
    expect(earned()).toBe(3);
  });

  it("아이템을 사용할 때에도 실제 관찰자로 등장 페이지를 고른다", () => {
    const at = fixture(blank);
    const itemId = "test_key";
    getPage(at.project, at).conditions = [{ kind: "itemUsed", itemId }];
    const { after } = runPrimitive(at.project, at.target, "cond.eventSeesPlayer.page.set", {
      watcherName: "문지기", value: false, sameRoom: false, requireFacing: false, range: 3,
    });
    const player = { x: 2, y: 1, facing: "down" as const };
    const session = Object.assign(startSession(after, 7), player);
    const map = after.maps[at.mapId]!;
    expect(findFacedItemTarget(after, map, session, { ev_test_guard: { x: 6, y: 4 } }, player, itemId)?.page.id).toBe(PAGE);
    expect(findFacedItemTarget(after, map, session, { ev_test_guard: { x: 4, y: 4 } }, player, itemId)).toBeUndefined();
    expect(session.itemUsedId).toBeUndefined();
  });

  it("플레이에서 닫힌 문, 밤과 어두운 조명, 문을 통과한 소리를 판정한다", () => {
    const at = fixture(blank);
    const map = at.project.maps[at.mapId]!;
    map.events.push({
      id: "ev_test_door", name: "문", x: 3, y: 4, trigger: { kind: "action" },
      commands: [{ kind: "transfer", mapId: at.mapId, x: 3, y: 5 }],
    });
    const positions = { ev_test_guard: { x: 4, y: 4, direction: "left" as const } };
    const sight = { eventId: "ev_test_guard", range: 4, nightRange: 1, darkRange: 1, darkAmbient: 0.8 };
    function page(args: Record<string, unknown>, hour = 13, ambient = 0, project = at.project) {
      const { after } = runPrimitive(project, at.target, "cond.eventSeesPlayer.page.set", { ...sight, ...args });
      const session = Object.assign(startSession(after, 7), { x: 2, y: 4, gameTime: { ...day, hour }, lighting: { ambient } });
      return runtimeEventViewsForMap(after, after.maps[at.mapId]!, session, positions).find((view) => view.event.id === at.eventId)?.pageId;
    }

    expect(page({})).toBe(PAGE);
    expect(page({ doorsBlock: true })).toBe("pg_test_base");
    expect(page({}, 23)).toBe("pg_test_base");
    expect(page({}, 13, 0.8)).toBe("pg_test_base");
    expect(page({ doorsBlock: true, hearRange: 4 }, 23)).toBe("pg_test_base");
    expect(page({ doorsBlock: true, hearRange: 5 }, 23)).toBe(PAGE);
    const mapWithGap = { ...map, lowerTiles: [...map.lowerTiles] };
    setLayerTileAt(mapWithGap, 1, 4 * map.width + 3, -1);
    const projectWithGap = { ...at.project, maps: { ...at.project.maps, [at.mapId]: mapWithGap } };
    expect(page({}, 13, 0, projectWithGap)).toBe("pg_test_base");
  });
});
