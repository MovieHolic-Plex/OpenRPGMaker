/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/07-cmd-staging";
import { mapTarget } from "@/editor/smallTask/target";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults/blankProject";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, Project, UploadedAsset } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectApplies, expectRefused, expectUndoRestores, loadFixture } from "./harness";

const MOVIE: UploadedAsset = {
  id: "movie_opening_stage",
  name: "달밤의 오프닝",
  kind: "movie",
  dataUrl: "data:video/webm;base64,GkXfow==",
  meta: {},
};
const AUDIO = "cc0-se-osx-wooded-box-open";
const PICTURE = "tex_beodeul_city";
const PAGE = "test_staging_page";
const EVENT = "test_staging_event";
const OTHER = "test_other_actor";
const LINE: Command = { kind: "text", body: "잠깐, 왼쪽을 봐." };
const WAIT: Command = { kind: "wait", ms: 120 };
const trigger = { kind: "action" } as const;

type Fixture = "blank" | "built" | "maou";
type Fields = Record<string, unknown>;
type Example = { args: Fields; expected: Command };
type StagingExamples = { fixture: Fixture; insert: Example; update: Example };
const fixtures = new Map<Fixture, Project>();

function cachedFixture(name: Fixture): Project {
  const existing = fixtures.get(name);
  if (existing) return existing;
  const loaded = loadFixture(name);
  fixtures.set(name, loaded);
  return loaded;
}

const examples: readonly StagingExamples[] = [
  {
    fixture: "built",
    insert: {
      args: { animationId: "fx:door-open", target: "self", wait: true },
      expected: { kind: "showAnimation", animationId: "fx:door-open", target: { eventId: "" }, wait: true },
    },
    update: {
      args: { targetEventId: OTHER, wait: false },
      expected: { kind: "showAnimation", animationId: "fx:door-open", target: { eventId: OTHER }, wait: false },
    },
  },
  {
    fixture: "maou",
    insert: {
      args: { emote: "exclamation", durationMs: 800 },
      expected: { kind: "showEmote", emote: "exclamation", durationMs: 800, target: { eventId: "" } },
    },
    update: {
      args: { target: "player", emote: "sparkle" },
      expected: { kind: "showEmote", emote: "sparkle", durationMs: 800, target: "player" },
    },
  },
  {
    fixture: "blank",
    insert: {
      args: { resourceId: PICTURE, pictureId: "pic3", x: 40, y: 20, opacity: 128, waitForPicture: true },
      expected: { kind: "showPicture", resourceId: PICTURE, pictureId: "pic3", x: 40, y: 20, opacity: 128, waitForPicture: true },
    },
    update: {
      args: { x: -12, blendMode: "screen", easing: "easeOut", recordInGallery: true },
      expected: { kind: "showPicture", resourceId: PICTURE, pictureId: "pic3", x: -12, y: 20, opacity: 128, waitForPicture: true, blendMode: "screen", easing: "easeOut", recordInGallery: true },
    },
  },
  {
    fixture: "blank",
    insert: { args: { pictureId: "pic3" }, expected: { kind: "erasePicture", pictureId: "pic3" } },
    update: { args: { pictureId: "숨길 사진" }, expected: { kind: "erasePicture", pictureId: "숨길 사진" } },
  },
  {
    fixture: "built",
    insert: {
      args: { resourceId: AUDIO, channel: "se", volume: 63 },
      expected: { kind: "playAudio", resourceId: AUDIO, channel: "se", loop: false, volume: 63 },
    },
    update: {
      args: { channel: "bgs", loop: true, fadeInMs: 500 },
      expected: { kind: "playAudio", resourceId: AUDIO, channel: "bgs", loop: true, fadeInMs: 500, volume: 63 },
    },
  },
  {
    fixture: "maou",
    insert: { args: { channel: "bgm" }, expected: { kind: "stopAudio", channel: "bgm" } },
    update: { args: { channel: "all" }, expected: { kind: "stopAudio" } },
  },
  {
    fixture: "blank",
    insert: {
      args: { resourceId: MOVIE.id, wait: false },
      expected: { kind: "playMovie", resourceId: MOVIE.id, wait: false, skippable: true },
    },
    update: {
      args: { skippable: false },
      expected: { kind: "playMovie", resourceId: MOVIE.id, wait: false, skippable: false },
    },
  },
  {
    fixture: "maou",
    insert: {
      args: { ambient: 0.7, transitionMs: 500 },
      expected: { kind: "setLighting", ambient: 0.7, color: "#000000", transitionMs: 500 },
    },
    update: {
      args: { color: "#173343" },
      expected: { kind: "setLighting", ambient: 0.7, color: "#173343", transitionMs: 500 },
    },
  },
  {
    fixture: "built",
    insert: {
      args: { id: "lantern_corner", target: "self", radius: 3, color: "#ffe7ab", flicker: true },
      expected: { kind: "addLight", source: { id: "lantern_corner", at: { eventId: EVENT }, radius: 3, intensity: 1, color: "#ffe7ab", flicker: true } },
    },
    update: {
      args: { radius: 5, x: 3, y: 2, coneDegrees: 60, coneFacing: "down" },
      expected: { kind: "addLight", source: { id: "lantern_corner", at: { x: 3, y: 2 }, radius: 5, intensity: 1, color: "#ffe7ab", flicker: true, cone: { degrees: 60, facing: "down" } } },
    },
  },
  {
    fixture: "blank",
    insert: { args: { id: "lantern_corner" }, expected: { kind: "removeLight", id: "lantern_corner" } },
    update: { args: { all: true }, expected: { kind: "removeLight", all: true } },
  },
  {
    fixture: "built",
    insert: {
      args: { weather: "rain", intensity: 0.4, transitionMs: 2000 },
      expected: { kind: "setWeather", weather: "rain", intensity: 0.4, transitionMs: 2000 },
    },
    update: {
      args: { weather: "snow" },
      expected: { kind: "setWeather", weather: "snow", intensity: 0.4, transitionMs: 2000 },
    },
  },
];

function fixture(name: Fixture, commands: Command[]) {
  const loaded = cachedFixture(name);
  const mapProject = Object.keys(loaded.maps).length ? loaded : createBlankProject();
  const mapId = mapProject.startMapId;
  const map = mapProject.maps[mapId]!;
  const page: EventPage = {
    id: PAGE, name: "선택한 페이지", commands, trigger, priority: "same", conditions: [], graphic: {},
    movement: { type: "fixed", speed: 3, frequency: 3 },
  };
  const event: GameEvent = {
    id: EVENT, name: "대장장이", x: 2, y: 2, trigger, commands: [],
    pages: [{ ...page, id: "test_unselected_page", commands: [WAIT] }, page],
  };
  const other: GameEvent = { id: OTHER, name: "나무꾼 ev_private", x: 3, y: 2, trigger, commands: [] };
  const project: Project = {
    ...mapProject,
    assets: { ...mapProject.assets, uploaded: { ...mapProject.assets.uploaded, [MOVIE.id]: MOVIE } },
    maps: { ...mapProject.maps, [mapId]: { ...map, events: [...map.events, event, other] } },
  };
  const target = mapTarget(project, mapId, EVENT, PAGE);
  if (target?.kind !== "event") throw new Error("테스트 이벤트가 없습니다.");
  return { project, target, mapId, page };
}

function selectedPage(project: Project, mapId: string): EventPage {
  return project.maps[mapId]!.events.find(event => event.id === EVENT)!.pages![1]!;
}

for (const row of examples) {
  for (const mode of ["insert", "update"] as const) {
    const { args, expected } = row[mode];
    const id = `cmd.${expected.kind}.${mode}`;
    it(`${row.fixture}에서 ${id}의 저장값, 요약, 범위와 되돌리기를 확인한다`, async () => {
      const initial = mode === "insert" ? [LINE, WAIT] : [LINE, row.insert.expected, WAIT];
      const { project, target, mapId, page } = fixture(row.fixture, initial);
      const beforeCommands = structuredClone(initial);
      const result = runPrimitive(project, target, id, { ...args, index: 1 });
      expect(selectedPage(result.after, mapId).commands).toStrictEqual([LINE, expected, WAIT]);
      expect(jsonEqual(page.commands, beforeCommands)).toBe(true);
      const primitive = PRIMITIVES.find(entry => entry.id === id)!;
      expect(result.sentence).toBe(primitive.describe({ project, target }, { ...args, index: 1 }));
      expect(result.sentence).toMatch(/[가-힣].*합니다\.$/u);
      expect(result.sentence).not.toMatch(/[A-Za-z{}\[\]]/u);
      expect(result.sentence.length).toBeLessThanOrEqual(80);
      const scope = primitive.scope({ project, target }, { mapId: "다른 맵" });
      expect(scope).toEqual({ kind: "eventPage", mapId, eventId: EVENT, pageId: PAGE });
      const renamedMap = { ...result.after.maps[mapId]!, name: "범위 밖 이름" };
      const outside = { ...result.after, maps: { ...result.after.maps, [mapId]: renamedMap } };
      expect(checkSmallTaskScope(project, outside, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
      expectRefused(project, { kind: "map", mapId, label: "맵" }, id, { ...args, index: 1 });
      await expectUndoRestores(project, result.after, target);
    }, row.fixture === "maou" ? 300_000 : undefined);
  }
}

it("분기 안 한 줄을 끼워 넣고 해시로 오래된 수정 요청을 거절한다", () => {
  const loop: Command = { kind: "loop", body: [WAIT] };
  const { project, target, mapId } = fixture("blank", [LINE, loop]);
  const path = { branchPath: [1, LOOP_BODY_BRANCH_INDEX], index: 0 };
  const { after } = runPrimitive(project, target, "cmd.showEmote.insert", { ...path, emote: "question" });
  expect(selectedPage(after, mapId).commands).toStrictEqual([
    LINE, { ...loop, body: [{ kind: "showEmote", emote: "question", target: { eventId: "" } }, WAIT] },
  ]);
  const current: Command = { kind: "showEmote", emote: "question", target: { eventId: "" } };
  expect(() => runPrimitive(after, target, "cmd.showEmote.update", { ...path, expectedHash: eventCommandHash(WAIT), emote: "idea" })).toThrow("그 줄의 내용이 바뀌었습니다");
  const updated = runPrimitive(after, target, "cmd.showEmote.update", { ...path, expectedHash: eventCommandHash(current), emote: "idea" });
  expect(selectedPage(updated.after, mapId).commands).toStrictEqual([LINE, { ...loop, body: [{ ...current, emote: "idea" }, WAIT] }]);
});

it("그림 합성을 보통으로 돌리면 합성 설정만 지운다", () => {
  const picture: Command = { kind: "showPicture", resourceId: PICTURE, pictureId: "pic1", x: 0, y: 0, opacity: 128 };
  const { project, target, mapId } = fixture("blank", [{ ...picture, blendMode: "screen" }]);
  const { after } = runPrimitive(project, target, "cmd.showPicture.update", { index: 0, blendMode: "normal" });
  expect(selectedPage(after, mapId).commands).toStrictEqual([picture]);
});

it.each([
  ["showAnimation", { animationId: "never_registered" }, "애니메이션"],
  ["showAnimation", { animationId: "fx:popup:item:never_registered" }, "아이템"],
  ["showPicture", { resourceId: "actor:never_registered" }, "그림"],
  ["showPicture", { resourceId: AUDIO }, "그림"],
  ["playAudio", { resourceId: "never_registered" }, "소리"],
  ["playAudio", { resourceId: PICTURE }, "소리"],
  ["playMovie", { resourceId: PICTURE }, "동영상"],
] as const)("%s의 잘못된 참조를 사용자 문구로 거절한다", (kind, args, message) => {
  const { project, target } = fixture("blank", []);
  const action = () => runPrimitive(project, target, `cmd.${kind}.insert`, args);
  expect(action).toThrow(PrimitiveError);
  expect(action).toThrow(new RegExp(`^프로젝트에서 .*${message}|^연출에 쓸 ${message}`, "u"));
});

function runtime(kind: string, args: Fields) {
  const { project, target, mapId } = fixture("blank", []);
  const { after } = runPrimitive(project, target, `cmd.${kind}.insert`, args);
  const session = startSession(after, 7);
  const interpreter = createInterpreter(selectedPage(after, mapId).commands, session, after, { currentEventId: EVENT });
  return { step: interpreter.start(), session };
}

it("실행기가 이 이벤트의 머리 위에 느낌표를 띄울 단계를 전달한다", () => {
  expect(runtime("showEmote", { emote: "exclamation", durationMs: 700 }).step).toEqual({
    kind: "showEmote", target: { eventId: "" }, emote: "exclamation", durationMs: 700,
  });
});

it("실행기가 동영상의 대기와 건너뛰기 설정을 전달한다", () => {
  expect(runtime("playMovie", { resourceId: MOVIE.id, wait: false, skippable: false }).step).toEqual({
    kind: "playMovie", resourceId: MOVIE.id, wait: false, skippable: false,
  });
});

it("실행기가 눈 효과와 전환 시간을 전달한다", () => {
  expect(runtime("setWeather", { weather: "snow", intensity: 0.25, transitionMs: 600 }).step).toEqual({
    kind: "setWeather", weather: "snow", intensity: 0.25, transitionMs: 600,
  });
});

it("실행기가 선택한 이벤트에 붙은 광원을 게임 상태에 추가한다", () => {
  const { session, step } = runtime("addLight", { id: "corner_light", target: "self", radius: 3, flicker: true });
  expect(step.kind).toBe("done");
  expect(session.lighting?.sources).toEqual([
    { id: "corner_light", at: { eventId: EVENT }, radius: 3, intensity: 1, flicker: true },
  ]);
});

const corpusFile = resolve(dirname(fileURLToPath(import.meta.url)), "../../harness-data/small-task-corpus/07-cmd-staging.json");
const corpus: CorpusCase[] = JSON.parse(readFileSync(corpusFile, "utf8"));
const movieSeed: UploadedAsset = { ...MOVIE, id: "staging_corpus_movie" };
const commandSeeds: Readonly<Partial<Record<string, Command>>> = {
  "cmd.showAnimation.update": { kind: "showAnimation", target: { eventId: "" }, animationId: "fx:container:chest", wait: false },
  "cmd.erasePicture.update": { kind: "erasePicture", pictureId: "pic1" },
  "cmd.playMovie.update": { kind: "playMovie", resourceId: movieSeed.id, wait: true, skippable: true },
  "cmd.removeLight.update": { kind: "removeLight", id: "candle" },
  "cmd.setWeather.update": { kind: "setWeather", weather: "snow", intensity: 0.5, transitionMs: 1000 },
};

// 공용 자료는 준비 단계가 없다. 필요한 명령이나 동영상이 없는 상태에서 먼저 거절을 확인하고,
// 같은 요청을 자료가 준비된 페이지에도 적용해 결과를 확인한다.
for (const entry of corpus.filter(row => row.expectRefusal && row.expect?.length)) {
  it(`준비된 페이지에서 적용한다 · ${entry.request}`, async () => {
    const baseline = cachedFixture(entry.fixture);
    const target = resolveTarget(baseline, entry.target);
    if (target.kind !== "event") throw new Error("연출 명령의 이벤트를 찾을 수 없습니다.");
    const map = baseline.maps[target.mapId]!;
    const seed = commandSeeds[entry.primitive];
    const events = map.events.map(event => event.id === target.eventId ? {
      ...event, pages: event.pages?.map(page => page.id === target.pageId && seed
        ? { ...page, commands: [structuredClone(seed), ...page.commands] }
        : page),
    } : event);
    const assets = entry.primitive.startsWith("cmd.playMovie.")
      ? { ...baseline.assets, uploaded: { ...baseline.assets.uploaded, [movieSeed.id]: movieSeed } }
      : baseline.assets;
    const project = { ...baseline, maps: { ...baseline.maps, [map.id]: { ...map, events } }, assets };
    const { after } = expectApplies(project, target, entry.primitive, entry.args);
    for (const check of entry.expect!) expect(readCheckPath(after, check.at), check.at).toEqual(check.equals);
    await expectUndoRestores(project, after, target);
  });
}
