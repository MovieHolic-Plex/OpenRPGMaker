/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { runtimeResourceUrl } from "@/assets/runtimeResourceUrls";
import { FORK_ELSE_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { smallTaskErrorMessage } from "@/editor/smallTask/capsule";
import { PrimitiveError, STALE_COMMAND_LIST } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/07-cmd-staging";
import { mapTarget } from "@/editor/smallTask/target";
import { SAMPLE_MOVIE_RESOURCE, resolveMovieResourceUrl as resolveMoviePreviewUrl } from "@/editor/panels/eventEditor/playMoviePreview";
import en from "@/i18n/catalogs/en.json";
import ja from "@/i18n/catalogs/ja.json";
import zh from "@/i18n/catalogs/zh.json";
import { containsHangul, createTranslator } from "@/i18n/translator";
import { createInterpreter } from "@/player/interpreter";
import { resolvePictureSource } from "@/player/pictures/pictureResources";
import { resolveMovieResourceUrl } from "@/player/playSceneMovies";
import { createBlankProject, ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { beginEventEditDraft } from "@/project/eventDrafts";
import { applyMapDefaultLighting } from "@/project/lightingRules";
import { setUploadedAssetResolver } from "@/project/persistence/assetAccessors";
import { showPictureState, startSession } from "@/project/session";
import { createStandaloneHtmlExport } from "@/project/standaloneExport";
import { STANDALONE_ASSETS_NODE_ID } from "@/project/standaloneHtml";
import type { Command, EventPage, GameEvent, Project, UploadedAsset } from "@/project/types";
import { collectWebExportAssets } from "@/project/webExportAssets";
import { jsonEqual } from "@/util/structuralJson";
import { expectApplies, expectRefused, expectUndoRestores, loadFixture } from "./harness";
import { createLocalRepositoryFixture } from "../localStore/localRepositoryFixture";

const MOVIE: UploadedAsset = {
  id: "movie_opening_stage",
  name: "달밤의 오프닝",
  kind: "movie",
  dataUrl: "data:video/webm;base64,GkXfow==",
  meta: {},
};
const AUDIO = "cc0-se-osx-wooded-box-open";
const PICTURE = "oprn-title-field";
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

function editArgs(command: Command, args: Fields): Fields {
  return { index: 0, expectedHash: eventCommandHash(command), ...args };
}

function cachedFixture(name: Fixture): Project {
  const existing = fixtures.get(name);
  if (existing) return existing;
  const loaded = loadFixture(name);
  // The editor fills session slots on opening the project, before the primitive freezes its snapshot.
  ensureSwitchVariableSlots(loaded);
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
      const fields = mode === "insert" ? { ...args, index: 1 } : editArgs(row.insert.expected, { ...args, index: 1 });
      const result = runPrimitive(project, target, id, fields);
      expect(selectedPage(result.after, mapId).commands).toStrictEqual([LINE, expected, WAIT]);
      expect(jsonEqual(page.commands, beforeCommands)).toBe(true);
      const primitive = PRIMITIVES.find(entry => entry.id === id)!;
      expect(result.sentence).toBe(primitive.describe({ project, target }, fields));
      expect(result.sentence).toMatch(/[가-힣].*합니다\.$/u);
      expect(result.sentence.replace(/#[0-9a-f]{6}\b/giu, "")).not.toMatch(/[A-Za-z{}\[\]]/u);
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
  expect(() => runPrimitive(after, target, "cmd.showEmote.update", { ...path, expectedHash: eventCommandHash(WAIT), emote: "idea" })).toThrow(STALE_COMMAND_LIST);
  const updated = runPrimitive(after, target, "cmd.showEmote.update", { ...path, expectedHash: eventCommandHash(current), emote: "idea" });
  expect(selectedPage(updated.after, mapId).commands).toStrictEqual([LINE, { ...loop, body: [{ ...current, emote: "idea" }, WAIT] }]);
});

it("같은 종류의 줄이 재정렬되면 확인값 없는 요청과 이전 줄 확인값을 모두 거절한다", async () => {
  const first: Command = { kind: "showEmote", emote: "heart", target: "player" };
  const second: Command = { ...first, emote: "question" };
  const { project, target, page, mapId } = fixture("blank", [second, first]);
  const id = "cmd.showEmote.update";
  expectRefused(project, target, id, { index: 0, durationMs: 500 }, /값의 형식/u);
  expectRefused(project, target, id, editArgs(first, { durationMs: 500 }), /명령 목록이 바뀌었어요/u);
  expect(page.commands).toStrictEqual([second, first]);
  const { after } = expectApplies(project, target, id, editArgs(first, { index: 1, durationMs: 500 }));
  expect(selectedPage(after, mapId).commands).toStrictEqual([second, { ...first, durationMs: 500 }]);
  await expectUndoRestores(project, after, target);
});

it("같은 내용의 명령이 이동해도 원래 줄로 오인해 수정하지 않는다", () => {
  const emote: Command = { kind: "showEmote", emote: "heart", target: "player" };
  const { project, target, page } = fixture("blank", [{ ...emote }, emote, WAIT]);
  expectRefused(project, target, "cmd.showEmote.update", editArgs(emote, { durationMs: 500 }), /같은 명령이 여러 개/u);
  expect(page.commands).toStrictEqual([emote, emote, WAIT]);
});

it("없는 분기와 줄에 쓰지 않고, 비어 있는 분기에는 끝에 추가한다", () => {
  const loop: Command = { kind: "loop", body: [] };
  const { project, target, mapId } = fixture("blank", [LINE, loop]);
  const id = "cmd.showEmote.insert";
  expectRefused(project, target, id, { branchPath: [1] }, /분기 위치/u);
  expectRefused(project, target, id, { branchPath: [1, FORK_ELSE_BRANCH_INDEX] }, /명령 분기를 찾을 수 없어요/u);
  expectRefused(project, target, id, { branchPath: [1, LOOP_BODY_BRANCH_INDEX], index: 1 }, /줄이 없습니다/u);
  expectRefused(project, target, "cmd.showEmote.update", editArgs(LINE, { emote: "heart" }), /같은 종류/u);
  const { after } = runPrimitive(project, target, id, { branchPath: [1, LOOP_BODY_BRANCH_INDEX] });
  expect(selectedPage(after, mapId).commands).toStrictEqual([
    LINE, { ...loop, body: [{ kind: "showEmote", emote: "heart", target: { eventId: "" } }] },
  ]);
  const beforeMap = project.maps[mapId]!;
  const eventIndex = beforeMap.events.findIndex(event => event.id === EVENT);
  const afterMap = after.maps[mapId]!;
  expect(afterMap.events[eventIndex]!.pages![0]).toBe(beforeMap.events[eventIndex]!.pages![0]);
  expect(afterMap.events.find(event => event.id === OTHER)).toBe(beforeMap.events.find(event => event.id === OTHER));
});

it.each(["insert", "update"] as const)("같은 배열을 쓰는 두 분기에서 선택한 분기만 %s 하고 되돌린다", async mode => {
  const emote: Command = { kind: "showEmote", target: "player", emote: "heart", durationMs: undefined };
  const shared = [emote];
  const fork: Command = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 3 }, then: shared, else: shared };
  const { project, target, page, mapId } = fixture("blank", [fork]);
  const { after } = runPrimitive(project, target, `cmd.showEmote.${mode}`, {
    branchPath: [0, FORK_THEN_BRANCH_INDEX], index: 0, emote: "smile",
    ...(mode === "update" ? { expectedHash: eventCommandHash(emote) } : {}),
  });
  const next = mode === "insert" ? [{ kind: "showEmote", target: { eventId: "" }, emote: "smile" }, emote]
    : [{ ...emote, emote: "smile" }];
  expect(selectedPage(after, mapId).commands).toStrictEqual([{ ...fork, then: next, else: [emote] }]);
  expect(page.commands).toStrictEqual([fork]);
  expect(shared).toStrictEqual([emote]);
  await expectUndoRestores(project, after, target);
});

it("그림 합성을 보통으로 돌리면 합성 설정만 지운다", () => {
  const picture: Command = { kind: "showPicture", resourceId: PICTURE, pictureId: "pic1", x: 0, y: 0, opacity: 128 };
  const before = { ...picture, blendMode: "screen" } as const;
  const { project, target, mapId } = fixture("blank", [before]);
  const { after } = runPrimitive(project, target, "cmd.showPicture.update", editArgs(before, { blendMode: "normal" }));
  expect(selectedPage(after, mapId).commands).toStrictEqual([picture]);
});

const slotPicture: Command = { kind: "showPicture", resourceId: PICTURE, pictureId: "title_card", x: 0, y: 0 };
const slotLight: Command = { kind: "addLight", source: { id: "door_lamp", at: "player", radius: 3 } };

it("다른 그림이 쓰는 자리로 바꾸려 해도 재생 시 두 자리를 유지한다", () => {
  const laterPicture = { ...slotPicture, pictureId: "second_card", x: 40 };
  const { project, target, page } = fixture("blank", [slotPicture, laterPicture]);
  expectRefused(project, target, "cmd.showPicture.update", editArgs(slotPicture, { pictureId: " second_card " }), /이미 쓰는 그림 자리/u);
  const session = startSession(project, 7);
  const player = createInterpreter(page.commands, session, project);
  const first = player.start();
  if (first.kind !== "showPicture") throw new Error("첫 그림 표시 단계가 없습니다.");
  showPictureState(session, first);
  const second = player.resume(undefined);
  if (second.kind !== "showPicture") throw new Error("두 번째 그림 표시 단계가 없습니다.");
  showPictureState(session, second);
  expect(Object.keys(session.pictures)).toEqual(["title_card", "second_card"]);
});

it("같은 그림 자리를 채우는 명령이 남으면 위치만 바꿀 수 있다", () => {
  const later = { ...slotPicture, x: 40 };
  const { project, target, mapId } = fixture("blank", [slotPicture, later]);
  expectRefused(project, target, "cmd.showPicture.update", editArgs(later, { index: 1, pictureId: "new_card" }), /이 그림 자리를 채우고 있어/u);
  const { after } = expectApplies(project, target, "cmd.showPicture.update", editArgs(later, { index: 1, x: 60 }));
  expect(selectedPage(after, mapId).commands).toStrictEqual([slotPicture, { ...later, x: 60 }]);
});

it.each(["new", "edit", "original"] as const)("다른 이벤트의 초안과 저장본에 남은 그림 자리를 보호한다 · %s", source => {
  const picture = { ...slotPicture, pictureId: "free_card" };
  const { project, target, mapId } = fixture("blank", [slotPicture, picture]);
  const other = project.maps[mapId]!.events.find(event => event.id === OTHER)!;
  const commands: Command[] = [
    { kind: "erasePicture", pictureId: "title_card" },
    { ...slotPicture, pictureId: "occupied_card" },
  ];
  const original = { ...other, commands: source === "original" ? commands : [] };
  const draft: GameEvent = {
    ...other, id: source === "new" ? "new_event_draft" : other.id,
    commands: source === "original" ? [] : commands,
    draft: source === "new" ? { kind: "new" } : { kind: "edit", original },
  };
  if (source === "original") other.commands = commands;
  const live = { maps: { [mapId]: { events: [draft] } } };
  const rename = (args: Fields) => runPrimitive(project, target, "cmd.showPicture.update", args, undefined, live);
  expect(() => rename(editArgs(slotPicture, { pictureId: "new_card" }))).toThrow(/그림을 움직이거나 지우고 있어/u);
  expect(() => rename(editArgs(picture, { index: 1, pictureId: "occupied_card" }))).toThrow(/이미 쓰는 그림 자리/u);
});

it("선택한 이벤트 초안의 이전 그림 자리와 현재 명령을 구분한다", () => {
  const destination = { ...slotPicture, pictureId: "new_card" };
  const { project, target, mapId, page } = fixture("blank", [slotPicture, destination]);
  beginEventEditDraft(project, mapId, EVENT);
  page.commands = [slotPicture];
  const event = project.maps[mapId]!.events.find(row => row.id === EVENT)!;
  const live = { maps: { [mapId]: { events: [event] } } };
  const args = editArgs(slotPicture, { pictureId: destination.pictureId });
  const { after } = runPrimitive(project, target, "cmd.showPicture.update", args, undefined, live);
  expect(selectedPage(after, mapId).commands).toStrictEqual([destination]);
  expect(after.maps[mapId]!.events.find(row => row.id === EVENT)?.draft).toBe(event.draft);
  expect(event.draft?.original?.pages?.[1]?.commands).toStrictEqual([slotPicture, destination]);
});

it.each(["command", "mapDefault", "inheritedDefault"] as const)("다른 광원의 이름으로 바꿀 수 없다 · %s", owner => {
  const other = { ...slotLight.source, id: " other_lamp ", radius: 6 };
  const { project, target, mapId, page } = fixture("blank", owner === "command" ? [slotLight, { kind: "addLight", source: other }] : [slotLight]);
  const map = project.maps[mapId]!;
  const defaultLighting = { ambient: 0.5, sources: [other] };
  if (owner === "mapDefault") map.defaultLighting = defaultLighting;
  const previousMap = { ...map, id: "test_previous_map", events: [], defaultLighting };
  if (owner === "inheritedDefault") project.maps[previousMap.id] = previousMap;
  expectRefused(project, target, "cmd.addLight.update", editArgs(slotLight, { id: "other_lamp" }), /이미 쓰는 광원 이름/u);
  const session = startSession(project, 7);
  if (owner === "inheritedDefault") {
    applyMapDefaultLighting(session, previousMap);
    applyMapDefaultLighting(session, map);
  }
  expect(createInterpreter(page.commands, session, project).start().kind).toBe("done");
  expect(session.lighting?.sources).toHaveLength(2);
  expect(session.lighting?.sources).toContainEqual({ ...other, id: "other_lamp" });
  expect(session.lighting?.sources).toContainEqual(slotLight.source);
});

it("같은 페이지의 다른 분기에서 지우는 그림은 자리를 바꿀 수 없다", () => {
  const remove: Command = { kind: "erasePicture", pictureId: "title_card" };
  const { project, target, page } = fixture("blank", [slotPicture, { kind: "loop", body: [remove] }]);
  const before = structuredClone(page.commands);
  expectRefused(project, target, "cmd.showPicture.update", {
    index: 0, pictureId: "new_card", expectedHash: eventCommandHash(slotPicture),
  }, /그림 자리를 바꿀 수 없습니다/u);
  expect(page.commands).toStrictEqual(before);
});

it("다른 명령이 켜는 광원은 이름을 보존하면서 반지름만 고친다", () => {
  const earlier = { ...slotLight, source: { ...slotLight.source, id: " door_lamp ", radius: 1 } };
  const { project, target, mapId } = fixture("blank", [earlier, slotLight]);
  expectRefused(project, target, "cmd.addLight.update", editArgs(slotLight, { index: 1, id: "new_lamp" }), /이 광원을 켜고 있어/u);
  const { after } = expectApplies(project, target, "cmd.addLight.update", editArgs(slotLight, { index: 1, radius: 5 }));
  const commands = selectedPage(after, mapId).commands;
  expect(commands).toStrictEqual([earlier, { ...slotLight, source: { ...slotLight.source, radius: 5 } }]);
  const session = startSession(after, 7);
  expect(createInterpreter(commands, session, after).start().kind).toBe("done");
  expect(session.lighting?.sources).toEqual([{ ...slotLight.source, radius: 5 }]);
});

it("열린 다른 이벤트 초안에서 같은 광원을 켜면 이름을 바꿀 수 없다", () => {
  const { project, target, mapId } = fixture("blank", [slotLight]);
  const other = project.maps[mapId]!.events.find(event => event.id === OTHER)!;
  const source = { ...slotLight.source, id: " door_lamp ", radius: 1 };
  const draft: GameEvent = { ...other, commands: [{ kind: "addLight", source }], draft: { kind: "edit", original: other } };
  const live = { maps: { [mapId]: { events: [draft] } } };
  const args = editArgs(slotLight, { id: "new_lamp" });
  expect(() => runPrimitive(project, target, "cmd.addLight.update", args, undefined, live)).toThrow(/이 광원을 켜고 있어/u);
});

it("선택한 이벤트의 취소용 원본에만 남은 광원 이름은 바꿀 수 있다", () => {
  const { project, target, mapId } = fixture("blank", [slotLight]);
  beginEventEditDraft(project, mapId, EVENT);
  const { after } = runPrimitive(project, target, "cmd.addLight.update", editArgs(slotLight, { id: "new_lamp" }));
  expect(selectedPage(after, mapId).commands).toStrictEqual([
    { ...slotLight, source: { ...slotLight.source, id: "new_lamp" } },
  ]);
  expect(after.maps[mapId]!.events.find(event => event.id === EVENT)?.draft?.original?.pages?.[1]?.commands)
    .toStrictEqual([slotLight]);
});

it("공용 이벤트에서 이동시키는 그림은 자리를 바꿀 수 없다", () => {
  const { project, target } = fixture("blank", [slotPicture]);
  const move: Command = { kind: "m2Command", commandId: "m2-052-move-picture", fields: { pictureId: "title_card" } };
  project.commonEvents = [{ id: "move_card", name: "그림 옮기기", trigger: "none", commands: [move] }];
  expectRefused(project, target, "cmd.showPicture.update", editArgs(slotPicture, { pictureId: "new_card" }), /그림 자리를 바꿀 수 없습니다/u);
});

it("그림 자리를 생략한 M2 이동 명령의 기본 자리도 보호한다", () => {
  const picture = { ...slotPicture, pictureId: "pic1" };
  const { project, target } = fixture("blank", [picture]);
  project.commonEvents = [{
    id: "move_card", name: "그림 옮기기", trigger: "none",
    commands: [{ kind: "m2Command", commandId: "m2-052-move-picture", fields: { x: 40 } }],
  }];
  expectRefused(project, target, "cmd.showPicture.update", editArgs(picture, { pictureId: "pic2" }), /그림 자리를 바꿀 수 없습니다/u);
});

it("공용 스크립트가 광원을 끄는 경우에는 이름만 보호한다", () => {
  const { project, target, mapId } = fixture("blank", [slotLight]);
  const code = 'await game.cmd({ "kind": "removeLight", id: "door_lamp" })';
  project.scriptLibrary = [{ id: "staging_light", source: code, compiled: code }];
  expectRefused(project, target, "cmd.addLight.update", editArgs(slotLight, { id: "new_lamp" }), /스크립트/u);
  const { after } = runPrimitive(project, target, "cmd.addLight.update", editArgs(slotLight, { radius: 5 }));
  expect(selectedPage(after, mapId).commands).toStrictEqual([{ ...slotLight, source: { ...slotLight.source, radius: 5 } }]);
  expect(after.scriptLibrary).toBe(project.scriptLibrary);
});

it("맵의 기본 광원을 갱신하는 명령은 이름을 바꿀 수 없다", () => {
  const { project, target, mapId } = fixture("blank", [slotLight]);
  project.maps[mapId]!.defaultLighting = { ambient: 0.5, sources: [{ ...slotLight.source, id: " door_lamp ", radius: 1 }] };
  expectRefused(project, target, "cmd.addLight.update", editArgs(slotLight, { id: "new_lamp" }), /맵의 기본 광원/u);
  const { after } = runPrimitive(project, target, "cmd.addLight.update", editArgs(slotLight, { radius: 5 }));
  expect(after.maps[mapId]!.defaultLighting).toBe(project.maps[mapId]!.defaultLighting);
  const session = startSession(after, 7);
  const commands = selectedPage(after, mapId).commands;
  expect(createInterpreter(commands, session, after).start().kind).toBe("done");
  expect(session.lighting?.sources).toEqual([{ ...slotLight.source, radius: 5 }]);
});

it.each(["battlePage", "afterBattle"] as const)("적 그룹의 %s 명령에서 끄는 광원은 이름을 바꿀 수 없다", context => {
  const { project, target, mapId } = fixture("blank", [slotLight]);
  const remove: Command = { kind: "removeLight", id: "door_lamp" };
  const commands: Command[] = [{ kind: "loop", body: [remove] }];
  project.database = {
    ...project.database,
    troops: [{
      id: "staging_troop", name: "광원 테스트", enemyIds: [], autoAlign: false,
      battleEventPages: context === "battlePage" ? [{ id: "staging_troop_page", name: "첫 줄", conditions: [], span: "battle", commands }] : [],
      afterBattle: context === "afterBattle" ? { victory: commands } : undefined,
    }],
  };
  expectRefused(project, target, "cmd.addLight.update", editArgs(slotLight, { id: "new_lamp" }), /광원 이름을 바꿀 수 없습니다/u);
  const { after } = runPrimitive(project, target, "cmd.addLight.update", editArgs(slotLight, { radius: 7 }));
  expect(selectedPage(after, mapId).commands).toStrictEqual([{ ...slotLight, source: { ...slotLight.source, radius: 7 } }]);
  expect(after.database.troops).toBe(project.database.troops);
});

it("사용 중인 명령이 없으면 그림 자리와 광원 이름을 바꾼다", () => {
  const { project, target, mapId } = fixture("blank", [slotPicture, slotLight]);
  const picture = runPrimitive(project, target, "cmd.showPicture.update", editArgs(slotPicture, { pictureId: "new_card" })).after;
  const rename = (fields: Fields) => runPrimitive(picture, target, "cmd.addLight.update", editArgs(slotLight, { index: 1, ...fields }));
  const { after, sentence } = rename({ id: " new_lamp " });
  expect(selectedPage(after, mapId).commands).toStrictEqual([
    { ...slotPicture, pictureId: "new_card" }, { ...slotLight, source: { ...slotLight.source, id: "new_lamp" } },
  ]);
  expect(sentence).toContain("이름 new_lamp");
  expect(rename({ id: "another_lamp" }).sentence).toContain("이름 another_lamp");
  expect(rename({ radius: 5 }).sentence).toBe("빛 켜기(주인공 · 반지름 5칸) 명령을 수정합니다.");
});

it.each([
  ["showAnimation", { animationId: "never_registered" }, "애니메이션"],
  ["showAnimation", { animationId: "fx:popup:item:never_registered" }, "아이템"],
  ["showPicture", { resourceId: "actor:never_registered" }, "그림"],
  ["showPicture", { resourceId: AUDIO }, "그림"],
  ["showPicture", { resourceId: "tex_beodeul_city" }, "그림"],
  ["showPicture", { resourceId: "easyrpg-title-title1" }, "그림"],
  ["playAudio", { resourceId: "never_registered" }, "소리"],
  ["playAudio", { resourceId: PICTURE }, "소리"],
  ["playMovie", { resourceId: PICTURE }, "동영상"],
] as const)("%s의 잘못된 참조를 사용자 문구로 거절한다", (kind, args, message) => {
  const { project, target } = fixture("blank", []);
  const action = () => runPrimitive(project, target, `cmd.${kind}.insert`, args);
  expect(action).toThrow(PrimitiveError);
  expect(action).toThrow(new RegExp(`^프로젝트에서 .*${message}|^연출에 쓸 ${message}`, "u"));
});

it("내장 연출의 잘못된 동전 개수와 남는 식별자 조각을 거절한다", () => {
  const { project, target } = fixture("blank", []);
  for (const animationId of ["fx:popup:gold:-1", "fx:popup:gold:2.5", "fx:container:chest:unknown"]) {
    expectRefused(project, target, "cmd.showAnimation.insert", { animationId }, /내장 연출/u);
  }
});

it("기존 명령이 있는 줄에서도 다른 맵의 이벤트와 맵 밖 위치를 거절한다", () => {
  const animation: Command = { kind: "showAnimation", target: "player", animationId: "fx:door-open" };
  const { project, target, mapId } = fixture("blank", [animation]);
  const id = "cmd.showAnimation.update";
  expectRefused(project, target, id, editArgs(animation, { targetEventId: "absent_event" }), /현재 맵에서 연출할 이벤트/u);
  expectRefused(project, target, id, editArgs(animation, { x: project.maps[mapId]!.width, y: 0 }), /현재 맵 안에서 연출할 칸/u);
});

it("예전 연출의 사라진 참조를 그대로 두고 대기 설정만 수정한다", () => {
  const animation: Command = { kind: "showAnimation", target: { eventId: "old_actor" }, animationId: "old_effect", wait: true };
  const { project, target, mapId } = fixture("blank", [animation]);
  const { after, sentence } = runPrimitive(project, target, "cmd.showAnimation.update", editArgs(animation, { wait: false }));
  expect(selectedPage(after, mapId).commands).toStrictEqual([{ ...animation, wait: false }]);
  expect(sentence).toContain("찾을 수 없는 이벤트");
  expect(sentence).not.toContain("이 이벤트");
});

it("빛의 색과 가장자리, 부채꼴 각도와 방향을 요약한다", async () => {
  const { project, target, mapId } = fixture("blank", [slotLight]);
  const fields = { color: "#e02020", edge: "hard", coneDegrees: 60, coneFacing: "down" };
  const { after, sentence } = expectApplies(project, target, "cmd.addLight.update", editArgs(slotLight, fields));
  expect(sentence).toContain("색 #e02020 · 또렷한 가장자리 · 부채꼴 60도 아래");
  expect(selectedPage(after, mapId).commands[0]).toMatchObject({
    source: { color: "#e02020", edge: "hard", cone: { degrees: 60, facing: "down" } },
  });
  await expectUndoRestores(project, after, target);
});

it("자료집에 이름만 있는 소리와 종류만 동영상인 그림을 거절한다", () => {
  const { project, target } = fixture("blank", []);
  const resourceId = "sound_without_file";
  project.resourceProfiles = [...project.resourceProfiles, { kind: "sound", assetId: resourceId, name: "파일 없는 소리" }];
  project.assets.uploaded[MOVIE.id] = { ...MOVIE, dataUrl: "data:image/png;base64,AAAA" };
  expectRefused(project, target, "cmd.playAudio.insert", { resourceId }, /재생할 수 있는 소리/u);
  expectRefused(project, target, "cmd.playMovie.insert", { resourceId: MOVIE.id }, /재생할 수 있는 동영상/u);
});

it("동영상 검증은 업로드 형식과 실제 재생기가 고르는 리소스를 확인한다", () => {
  const invalid = fixture("blank", []);
  invalid.project.assets.uploaded[MOVIE.id] = { ...MOVIE, dataUrl: "data:video/webm,GkXfow==" };
  invalid.project.assets.uploaded[AUDIO] = { ...MOVIE, id: AUDIO };
  expectRefused(invalid.project, invalid.target, "cmd.playMovie.insert", { resourceId: MOVIE.id }, /재생할 수 있는 동영상/u);
  expectRefused(invalid.project, invalid.target, "cmd.playMovie.insert", { resourceId: AUDIO }, /재생할 수 있는 동영상/u);

  const { project, target, mapId } = fixture("blank", []);
  project.assets.uploaded[MOVIE.id] = {
    ...MOVIE, dataUrl: undefined, ref: { sha256: "a".repeat(64), mime: "video/webm", bytes: 4, extension: "webm" },
  };
  const { after } = runPrimitive(project, target, "cmd.playMovie.insert", { resourceId: MOVIE.id });
  expect(selectedPage(after, mapId).commands[0]).toMatchObject({ kind: "playMovie", resourceId: MOVIE.id });
});

it("기존 자료를 건드리지 않는 영상 설정 수정은 허용한다", () => {
  const movie: Command = { kind: "playMovie", resourceId: "old_movie_file", wait: true };
  const { project, target, mapId } = fixture("blank", [movie]);
  const { after, sentence } = runPrimitive(project, target, "cmd.playMovie.update", editArgs(movie, { wait: false }));
  expect(selectedPage(after, mapId).commands).toStrictEqual([{ ...movie, wait: false }]);
  expect(sentence).toContain("바로 다음 줄로 · 건너뛰기 허용");
});

it.each(["insert", "update"] as const)("번들 샘플을 %s 하면 플레이어가 동영상 경로를 사용한다", async mode => {
  const movie: Command = { kind: "playMovie", resourceId: MOVIE.id, wait: false };
  const { project, target, mapId } = fixture("blank", mode === "insert" ? [] : [movie]);
  const fields = { resourceId: SAMPLE_MOVIE_RESOURCE.id };
  const args = mode === "insert" ? fields : editArgs(movie, fields);
  const { after, sentence } = expectApplies(project, target, `cmd.playMovie.${mode}`, args);
  const step = createInterpreter(selectedPage(after, mapId).commands, startSession(after, 7), after).start();
  expect(step).toMatchObject({ kind: "playMovie", resourceId: SAMPLE_MOVIE_RESOURCE.id });
  expect(sentence).toContain(SAMPLE_MOVIE_RESOURCE.name);
  expect(resolveMovieResourceUrl(SAMPLE_MOVIE_RESOURCE.id, after)).toBe(SAMPLE_MOVIE_RESOURCE.url);
  const path = SAMPLE_MOVIE_RESOURCE.url.slice(1);
  expect(collectWebExportAssets(after)).toContainEqual({
    kind: "public", resourceId: SAMPLE_MOVIE_RESOURCE.id, sourcePath: path, zipPath: path,
  });
  await expectUndoRestores(project, after, target);
});

it("연출 명령의 번들 샘플 WebM을 실행형 HTML에 포함한다", async () => {
  const { project, target } = fixture("blank", []);
  const { id, url } = SAMPLE_MOVIE_RESOURCE;
  const { after } = runPrimitive(project, target, "cmd.playMovie.insert", { resourceId: id });
  const bytes = readFileSync(`public${url}`);
  const { blob } = await createStandaloneHtmlExport(after, {
    fetchBytes: async path => path === url ? bytes : new Uint8Array([1]),
  });

  const document = new DOMParser().parseFromString(await blob.text(), "text/html");
  const assets = JSON.parse(document.getElementById(STANDALONE_ASSETS_NODE_ID)!.textContent!);
  expect(assets[url.slice(1)]).toBe(`data:video/webm;base64,${bytes.toString("base64")}`);
});

it("번들 동영상과 이름이 같은 잘못된 업로드 및 확인되지 않은 파일은 거절한다", () => {
  const { project, target } = fixture("blank", []);
  const id = SAMPLE_MOVIE_RESOURCE.id;
  project.assets.uploaded[id] = { ...MOVIE, id, dataUrl: "data:image/png;base64,AAAA" };
  for (const resourceId of [id, "absent.webm"]) {
    expectRefused(project, target, "cmd.playMovie.insert", { resourceId }, /재생할 수 있는 동영상/u);
  }
});

it("SQLite에서 다시 연 업로드 동영상의 호스트 URL을 편집기와 플레이어가 함께 쓴다", async () => {
  const { repository, close } = await createLocalRepositoryFixture();
  try {
    const { project, target, mapId } = fixture("blank", []);
    const bytes = readFileSync(`public${SAMPLE_MOVIE_RESOURCE.url}`);
    const { ref } = await repository.assets.put(bytes, { mime: "video/webm", extension: "webm" });
    project.assets.uploaded[MOVIE.id] = { ...MOVIE, dataUrl: undefined, ref };
    const { after } = expectApplies(project, target, "cmd.playMovie.insert", { resourceId: MOVIE.id });
    expect((await repository.save(after)).kind).toBe("saved");
    const reloaded = await repository.loadProject();
    if (!reloaded) throw new Error("SQLite 프로젝트를 다시 열지 못했습니다.");
    expect(reloaded.assets.uploaded[MOVIE.id]?.ref).toEqual(ref);
    const step = createInterpreter(selectedPage(reloaded, mapId).commands, startSession(reloaded, 7), reloaded).start();
    if (step.kind !== "playMovie") throw new Error("동영상 재생 단계가 없습니다.");
    setUploadedAssetResolver({ url: ref => repository.assets.url(ref.sha256), bytes: async () => bytes });
    expect(resolveMovieResourceUrl(step.resourceId, reloaded)).toBe(repository.assets.url(ref.sha256));
    expect(resolveMoviePreviewUrl(step.resourceId, reloaded)).toBe(repository.assets.url(ref.sha256));
  } finally {
    setUploadedAssetResolver(null);
    close();
  }
});

it.each(["Moonlight", "月明かり", MOVIE.id])("동영상 요약에 표시 이름만 쓴다 · %s", name => {
  const { project, target } = fixture("blank", []);
  project.assets.uploaded[MOVIE.id] = { ...MOVIE, name };
  const { sentence } = expectApplies(project, target, "cmd.playMovie.insert", { resourceId: MOVIE.id });
  expect(sentence).toContain(name === MOVIE.id ? "지정한 동영상" : name);
  expect(sentence).not.toContain(MOVIE.id);
});

it.each([["en", en], ["ja", ja], ["zh", zh]] as const)("%s 편집기 카탈로그가 연출 거절 문구를 번역한다", (locale, catalog) => {
  const { project, target } = fixture("blank", [slotLight, { ...slotLight, source: { ...slotLight.source, id: "second_light" } }]);
  const translator = createTranslator(catalog, { locale });
  const operations = [
    () => runPrimitive(project, target, "cmd.addLight.update", editArgs(slotLight, { id: "second_light" })),
    () => runPrimitive(project, target, "cmd.addLight.update", editArgs(slotLight, { expectedHash: "stale", radius: 8 })),
    () => runPrimitive(project, target, "cmd.playMovie.insert", { resourceId: "missing_movie" }),
  ];
  for (const operation of operations) {
    let error: unknown;
    try { operation(); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(PrimitiveError);
    const translated = translator.translate(smallTaskErrorMessage(error));
    expect(translated).toBeTruthy();
    expect(containsHangul(translated!)).toBe(false);
  }
  expect(translator.translate(smallTaskErrorMessage(new Error("Failed")))).toBeTruthy();
});

it("광원 이름 앞뒤 공백을 일치시켜 실제로 같은 빛을 끈다", () => {
  const { project, target, mapId } = fixture("blank", [slotLight]);
  const { after } = runPrimitive(project, target, "cmd.removeLight.insert", { id: " door_lamp " });
  const commands = selectedPage(after, mapId).commands;
  expect(commands).toStrictEqual([slotLight, { kind: "removeLight", id: "door_lamp" }]);
  const session = startSession(after, 7);
  expect(createInterpreter(commands, session, after).start().kind).toBe("done");
  expect(session.lighting?.sources).toEqual([]);
});

function runtime(kind: string, args: Fields) {
  const { project, target, mapId } = fixture("blank", []);
  const { after } = runPrimitive(project, target, `cmd.${kind}.insert`, args);
  const session = startSession(after, 7);
  const interpreter = createInterpreter(selectedPage(after, mapId).commands, session, after, { currentEventId: EVENT });
  return { step: interpreter.start(), session, project: after };
}

it("그림 명령이 실행기에 넘긴 리소스를 게임에서 해석할 수 있다", () => {
  const { step, project } = runtime("showPicture", { resourceId: PICTURE, pictureId: "pic3" });
  expect(step).toMatchObject({ kind: "showPicture", resourceId: PICTURE, pictureId: "pic3" });
  expect(resolvePictureSource(PICTURE, project)).toBe("/assets/generated/title/oprn-title-field.png");
});

it("렌더링 전에도 존재하는 오프닝 스틸을 선택하고 없는 컷은 거절한다", () => {
  const { project, target, mapId } = fixture("blank", []);
  const sceneId = "staging_still_scene";
  project.system = {
    ...project.system,
    opening: {
      enabled: true, skippable: true,
      scenes: [{ id: sceneId, kind: "animatic", narration: "", durationMs: 1000, composition: { width: 320, height: 180, layers: [] } }],
    },
  };
  const resourceId = `opening-still:${sceneId}@500`;
  expect(runtimeResourceUrl(resourceId)).toBeNull();
  const { after } = expectApplies(project, target, "cmd.showPicture.insert", { resourceId });
  expect(selectedPage(after, mapId).commands[0]).toMatchObject({ kind: "showPicture", resourceId });
  expectRefused(project, target, "cmd.showPicture.insert", { resourceId: "opening-still:missing@500" }, /표시할 수 있는 그림/u);
});

it("그림 자리의 공백을 정리하고 요약에 바뀐 그림 크기를 보여 준다", () => {
  const { project, target, mapId } = fixture("blank", [slotPicture]);
  const moved = runPrimitive(project, target, "cmd.showPicture.update", editArgs(slotPicture, { pictureId: " pic3 ", scale: 25 }));
  const erased = runPrimitive(moved.after, target, "cmd.erasePicture.insert", { pictureId: " pic3 " });
  expect(selectedPage(erased.after, mapId).commands).toStrictEqual([
    { ...slotPicture, pictureId: "pic3", scale: 25 }, { kind: "erasePicture", pictureId: "pic3" },
  ]);
  expect(moved.sentence).toContain("3번 자리 · 크기 25%");
  expect(erased.sentence).toContain("3번 자리");
});

it("그림의 전환 시간 상한을 적용하고 잘못된 좌표와 이름을 거절한다", () => {
  const { project, target, mapId } = fixture("blank", []);
  const id = "cmd.showPicture.insert";
  const { after } = runPrimitive(project, target, id, { resourceId: PICTURE, durationMs: 60_000 });
  expect(selectedPage(after, mapId).commands[0]).toMatchObject({ kind: "showPicture", durationMs: 60_000 });
  for (const invalid of [{ durationMs: 60_001 }, { x: Number.MAX_SAFE_INTEGER + 1 }, { pictureId: "  " }]) {
    expectRefused(project, target, id, { resourceId: PICTURE, ...invalid }, /값의 형식/u);
  }
  expectRefused(project, target, id, { resourceId: PICTURE, pictureId: " __proto__ " }, /그림 자리 이름/u);
});

it("실행기가 이 이벤트의 머리 위에 느낌표를 띄울 단계를 전달한다", () => {
  expect(runtime("showEmote", { emote: "exclamation", durationMs: 700 }).step).toEqual({
    kind: "showEmote", target: { eventId: "" }, emote: "exclamation", durationMs: 700,
  });
});

it("실행기가 동영상의 대기와 건너뛰기 설정을 전달한다", () => {
  const { step, project } = runtime("playMovie", { resourceId: MOVIE.id, wait: false, skippable: false });
  expect(step).toEqual({
    kind: "playMovie", resourceId: MOVIE.id, wait: false, skippable: false,
  });
  expect(resolveMovieResourceUrl(MOVIE.id, project)).toBe(MOVIE.dataUrl);
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
