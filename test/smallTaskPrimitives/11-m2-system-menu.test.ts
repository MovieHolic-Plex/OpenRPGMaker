/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { FORK_ELSE_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError, SELECT_EVENT_PAGE, STALE_COMMAND_LIST } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/11-m2-system-menu";
import { createInterpreter } from "@/player/interpreter";
import { systemAudioOverride } from "@/player/systemAudioSlots";
import { createBlankProject, ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { serialize } from "@/project/io";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, M2CommandFields, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store";
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
type Fixture = (typeof fixtures)[number];
const fixtureProjects = new Map<Fixture, Project>();
const unchanged: Command = { kind: "text", body: "원래 대사" };

function fixtureProject(fixture: Fixture): Project {
  let project = fixtureProjects.get(fixture);
  if (!project) {
    project = loadFixture(fixture);
    // Match editor load normalization before the primitive freezes the fixture.
    ensureSwitchVariableSlots(project);
    removeLegacySpriteReferences(project);
    fixtureProjects.set(fixture, project);
  }
  return project;
}

function scene(fixture: Fixture, commands: Command[] = [unchanged]) {
  const before = fixtureProject(fixture);
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
    for (const fixture of fixtures) fixtureProject(fixture);
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
      const expected: M2CommandFields = parameterless ? {} : { ...fields, legacy: "기존 값", ...row.updateFields };
      if (row.updateArgs.operation === "reset") delete expected.volume;
      expect(commands(after)).toEqual([m2(row, expected), unchanged]);
      expect(current(after).pages![1]).toEqual(otherPage);
      expect(jsonEqual(project, before)).toBe(true);
      expectKoreanSentence(sentence, target);
      await expectUndoRestores(project, after, target);
    });

    it(`${row.suffix} 잘못된 인자와 다른 페이지 변경 거부`, () => {
      const { project, target, map, event, current } = scene(fixture);
      expect(() => runPrimitive(project, target, insertId, row.invalid)).toThrow(row.reason);
      expect(() => runPrimitive(project, target, updateId, {
        index: 0, expectedHash: eventCommandHash(unchanged), ...row.updateArgs,
      })).toThrow(/이 종류의 명령/u);
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

  it("페이지가 여러 개면 페이지 선택을 요구하고 선택한 페이지에만 추가한다", () => {
    const { project, map, event, otherPage, current } = scene("blank");
    const id = "m2.077.insert";
    const args = { enabled: false };
    const eventOnly = eventTarget(project, map.id, event.id);
    expect(() => runPrimitive(project, eventOnly, id, args)).toThrow(SELECT_EVENT_PAGE);

    const pageTarget = eventTarget(project, map.id, event.id, otherPage.id);
    const { after } = runPrimitive(project, pageTarget, id, args);
    expect(current(after).pages![0]).toBe(event.pages![0]);
    expect(current(after).pages![1].commands).toEqual([
      unchanged, { kind: "m2Command", commandId: "m2-077-change-save-access", fields: { enabled: "false" } },
    ]);
    expect(otherPage.commands).toEqual([unchanged]);
  });

  it("분기 안의 명령을 고치고 오래된 확인값을 거부한다", async () => {
    const original: Command = { kind: "m2Command", commandId: "m2-077-change-save-access", fields: { enabled: "true" } };
    const { project, target, commands } = scene("blank", [original, { kind: "loop", body: [original, unchanged] }]);
    const args = { index: 0, branchPath: [1, LOOP_BODY_BRANCH_INDEX], enabled: false };
    const id = "m2.077.update";
    expect(() => runPrimitive(project, target, id, { ...args, expectedHash: "이전 줄" })).toThrow(STALE_COMMAND_LIST);
    const { after } = runPrimitive(project, target, id, { ...args, expectedHash: eventCommandHash(original) });
    expect(commands(after)).toEqual([original, { kind: "loop", body: [{ ...original, fields: { enabled: "false" } }, unchanged] }]);
    await expectUndoRestores(project, after, target);

    const projectDir = await mkdtemp(join(tmpdir(), "oprn-system-menu-"));
    try {
      const storage = await initLocalProjectStore({ projectDir });
      try {
        expect((await storage.saveSerialized(serialize(after))).kind).toBe("saved");
      } finally {
        storage.close();
      }
      const reopened = await openLocalProjectStore({ projectDir });
      try {
        expect(commands(reopened.loadSnapshot()!.project)).toEqual(commands(after));
      } finally {
        reopened.close();
      }
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });

  it("같은 종류의 두 줄이 이동했으면 해시 없는 수정과 이전 위치의 수정을 거부한다", () => {
    const original: Command = { kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "첫 주석" } };
    const neighbor = { ...original, fields: { comment: "두 번째 주석" } };
    const expectedHash = eventCommandHash(original);
    const { project, target, commands } = scene("blank", [neighbor, original]);
    const args = { index: 0, comment: "첫 주석 수정" };
    expect(() => runPrimitive(project, target, "m2.088.update", args)).toThrow(PrimitiveError);
    expect(() => runPrimitive(project, target, "m2.088.update", { ...args, expectedHash })).toThrow(STALE_COMMAND_LIST);
    expect(() => runPrimitive(project, target, "m2.088.update", { ...args, index: 2, expectedHash })).toThrow(STALE_COMMAND_LIST);
    expect(commands(project)).toEqual([neighbor, original]);
    const { after } = runPrimitive(project, target, "m2.088.update", { ...args, index: 1, expectedHash });
    expect(commands(after)).toEqual([neighbor, { ...original, fields: { comment: "첫 주석 수정", color: "green" } }]);
  });

  it("선택지의 빈 분기 끝에 추가하고 없는 분기와 범위 밖 줄은 거부한다", () => {
    const choice: Command = { kind: "choices", options: [{ text: "저장 금지", branch: [] }, { text: "그대로", branch: [unchanged] }] };
    const { project, target, commands } = scene("blank", [choice, unchanged]);
    const id = "m2.077.insert";
    for (const args of [
      { branchPath: [0], enabled: false },
      { branchPath: [0, FORK_ELSE_BRANCH_INDEX], enabled: false },
      { branchPath: [0, 2], enabled: false },
    ]) {
      expect(() => runPrimitive(project, target, id, args)).toThrow(/분기/u);
    }
    expect(() => runPrimitive(project, target, id, { branchPath: [0, 0], index: 1, enabled: false })).toThrow(/줄 위치/u);
    const { after } = runPrimitive(project, target, id, { branchPath: [0, 0], enabled: false });
    const inserted: Command = { kind: "m2Command", commandId: "m2-077-change-save-access", fields: { enabled: "false" } };
    expect(commands(after)).toEqual([{ ...choice, options: [{ text: "저장 금지", branch: [inserted] }, choice.options[1]] }, unchanged]);
    expect(commands(project)).toEqual([choice, unchanged]);
  });

  it("같은 배열을 공유하는 두 선택지를 한 분기 편집으로 동시에 바꾸지 않는다", () => {
    const original: Command = { kind: "m2Command", commandId: "m2-077-change-save-access", fields: { enabled: "true" } };
    const branch = [original];
    const choice: Command = { kind: "choices", options: [{ text: "첫 분기", branch }, { text: "다른 분기", branch }] };
    const { project, target, commands } = scene("blank", [choice]);
    for (const id of ["m2.077.insert", "m2.077.update"]) {
      const hash = id.endsWith(".update") ? { expectedHash: eventCommandHash(original) } : {};
      expect(() => runPrimitive(project, target, id, { branchPath: [0, 0], index: 0, enabled: false, ...hash })).toThrow(/분기가 같은 명령 목록/u);
    }
    expect(commands(project)).toEqual([{ ...choice, options: [{ text: "첫 분기", branch: [original] }, { text: "다른 분기", branch: [original] }] }]);
  });

  it("파일이 없는 자료집 항목과 종류가 다른 메뉴 그림을 거부한다", () => {
    const { project: fixture, target } = scene("blank");
    const project: Project = {
      ...fixture,
      resourceProfiles: [...fixture.resourceProfiles,
        { kind: "music", assetId: "missing-music-file", name: "없는 음악 파일" },
        { kind: "music", assetId: sound, name: "음악으로 잘못 분류한 효과음" },
        { kind: "system", assetId: "missing-menu-file", name: "없는 메뉴 그림 파일" },
        { kind: "system", assetId: sound, name: "잘못 분류된 효과음" },
        { kind: "system", assetId: music, name: "메뉴 그림으로 잘못 분류한 음악" },
      ],
    };
    for (const resourceId of ["missing-music-file", sound]) {
      expect(() => runPrimitive(project, target, "m2.027.insert", { resourceId })).toThrow(/음악을 찾을 수 없습니다/u);
    }
    for (const resourceId of ["missing-menu-file", sound, music]) {
      expect(() => runPrimitive(project, target, "m2.029.insert", { resourceId })).toThrow(/메뉴 그림을 찾을 수 없습니다/u);
    }
  });

  it("음원 누락과 공백, 복원과 음원 지정이 겹치는 입력을 거부한다", () => {
    const { project, target } = scene("blank");
    expect(() => runPrimitive(project, target, "m2.027.insert", { volume: 42 })).toThrow(/사용할 소리를 고르/u);
    expect(() => runPrimitive(project, target, "m2.028.insert", { resourceId: "  " })).toThrow(/공백/u);
    expect(() => runPrimitive(project, target, "m2.027.insert", { operation: "reset", resourceId: music })).toThrow(/따로 고르지/u);
    expect(() => runPrimitive(project, target, "m2.027.insert", { operation: "reset", volume: 42 })).toThrow(/기본값.*소리 크기/u);
    expect(() => runPrimitive(project, target, "m2.027.insert", { cue: "field", resourceId: music, volume: 42 })).toThrow(/필드 기본곡/u);
    expect(() => runPrimitive(project, target, "m2.078.insert", { screen: "skills", actorId: "  " })).toThrow(/입력칸을 비워/u);
  });

  it("올린 리소스는 실제 파일과 등록한 종류가 일치할 때만 선택한다", () => {
    const { project: fixture, target, commands } = scene("blank");
    const audio = "data:audio/wav;base64,AA==";
    const image = "data:image/png;base64,AA==";
    const project: Project = { ...fixture, assets: { ...fixture.assets, uploaded: {
      ...fixture.assets.uploaded,
      "real-audio": { id: "real-audio", name: "음원", kind: "music", dataUrl: audio, meta: {} },
      "real-menu": { id: "real-menu", name: "메뉴 그림", kind: "system", dataUrl: image, meta: {} },
      "image-as-audio": { id: "image-as-audio", name: "잘못 등록한 그림", kind: "music", dataUrl: image, meta: {} },
      "audio-as-image": { id: "audio-as-image", name: "잘못 등록한 음원", kind: "system", dataUrl: audio, meta: {} },
    } } };
    for (const [id, valid, invalid, field] of [
      ["m2.027.insert", "real-audio", "image-as-audio", "resourceId"],
      ["m2.029.insert", "real-menu", "audio-as-image", "value"],
    ] as const) {
      const { after } = runPrimitive(project, target, id, { resourceId: valid });
      expect(commands(after).at(-1)).toMatchObject({ fields: { [field]: valid } });
      expect(() => runPrimitive(project, target, id, { resourceId: invalid })).toThrow(/찾을 수 없습니다/u);
    }
  });

  it("동적으로 위치를 잡던 옛 순간이동 명령은 이름만 바꿔도 위치 지정 방식이 유지된다", () => {
    const original: Command = { kind: "m2Command", commandId: "m2-072-set-teleportation-point", fields: { label: "귀환" } };
    const { project, target, commands } = scene("blank", [original]);
    const { after } = runPrimitive(project, target, "m2.072.update", { index: 0, expectedHash: eventCommandHash(original), label: "동쪽 관문" });
    expect(commands(after)).toEqual([{ ...original, fields: { label: "동쪽 관문" } }]);
  });

  it.each(["deleted", "resized"])("목적지가 %s 상태여도 이름만 바꾸고 되돌릴 수 있다", async state => {
    const mapId = "old-destination";
    const fields = { mapId, x: 4, y: 6, label: "귀환" };
    const original: Command = { kind: "m2Command", commandId: "m2-072-set-teleportation-point", fields };
    const fixture = scene("blank", [original]);
    const { maps, mapTree } = fixture.project;
    const project = state === "deleted" ? fixture.project : {
      ...fixture.project,
      maps: { ...maps, [mapId]: { ...createBlankMap("옛 목적지", 2, 2, fixture.map.tilesetId), id: mapId } },
      mapTree: { ...mapTree, children: [...mapTree.children, { mapId, children: [] }] },
    };
    const args = { index: 0, expectedHash: eventCommandHash(original), label: "옛 관문" };
    const { after } = runPrimitive(project, fixture.target, "m2.072.update", args);
    expect(fixture.commands(after)).toEqual([{ ...original, fields: { ...fields, label: args.label } }]);
    expect(() => runPrimitive(project, fixture.target, "m2.072.update", { ...args, x: 3 }))
      .toThrow(state === "deleted" ? /목적지 맵을 찾을 수 없습니다/u : /맵 범위 밖/u);
    await expectUndoRestores(project, after, fixture.target);
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

  it("무음으로 지정한 전투곡은 기본값 복원 명령을 실행할 때까지 덮어쓴다", () => {
    const { project, target, commands } = scene("blank", []);
    const { after: muted } = runPrimitive(project, target, "m2.027.insert", { resourceId: "" });
    const { after: reset } = runPrimitive(muted, target, "m2.027.insert", { operation: "reset" });
    const session = startSession(project, 42);
    createInterpreter(commands(muted), session, muted).start();
    expect(session.systemAudioOverrides?.bgm?.battle).toEqual({ resourceId: "", volume: 100 });
    createInterpreter(commands(reset).slice(1), session, reset).start();
    expect(session.systemAudioOverrides?.bgm?.battle).toBeUndefined();
  });

  it("순간이동 지점에 이름과 좌표를 기록한다", () => {
    const { session, map } = play("m2.072.insert", { x: 3, y: 4, label: "동쪽 관문" });
    expect(session.teleportPoints).toEqual([{ mapId: map.id, x: 3, y: 4, label: "동쪽 관문" }]);
  });

  it("옛 순간이동 줄에서 이름만 바꾸면 플레이어 위치를 쓰고 좌표를 바꾸면 지점이 고정된다", () => {
    const original: Command = { kind: "m2Command", commandId: "m2-072-set-teleportation-point", fields: { label: "귀환" } };
    const { project, target, commands, map } = scene("built", [original]);
    const otherMap = Object.values(project.maps).find(candidate => candidate.id !== map.id)!;
    const line = { index: 0, expectedHash: eventCommandHash(original) };
    const { after: renamed } = runPrimitive(project, target, "m2.072.update", { ...line, label: "시장" });
    const { after: fixed } = runPrimitive(project, target, "m2.072.update", { ...line, x: 3, y: 4 });
    const session = startSession(project, 42);
    session.currentMapId = otherMap.id;
    session.x = 1;
    session.y = 2;
    createInterpreter(commands(renamed), session, renamed).start();
    expect(session.teleportPoints).toEqual([{ mapId: otherMap.id, x: 1, y: 2, label: "시장" }]);
    createInterpreter(commands(fixed), session, fixed).start();
    expect(session.teleportPoints).toEqual([
      { mapId: otherMap.id, x: 1, y: 2, label: "시장" },
      { mapId: map.id, x: 3, y: 4, label: "귀환" },
    ]);
  });

  it("옛 전투곡 줄은 음원을 바꾸거나 복원해도 원래 오디오 칸을 쓴다", () => {
    const original: Command = { kind: "m2Command", commandId: "m2-027-change-system-bgm", fields: { slot: "battle", value: "old-battle-music" } };
    const { project, target, commands } = scene("blank", [original]);
    const { after } = runPrimitive(project, target, "m2.027.update", {
      index: 0, expectedHash: eventCommandHash(original), cue: "battle", resourceId: music,
    });
    expect(commands(after)).toEqual([{ ...original, fields: { slot: "battle", resourceId: music } }]);
    const session = startSession(after, 42);
    createInterpreter(commands(after), session, after).start();
    expect(systemAudioOverride(session.m2Runtime, "battle")).toBe(music);
    expect(session.systemAudioOverrides?.bgm?.battle).toBeUndefined();
    const line = { index: 0, expectedHash: eventCommandHash(commands(after)[0]) };
    expect(() => runPrimitive(after, target, "m2.027.update", { ...line, operation: "reset", volume: 30 })).toThrow(/기본값.*소리 크기/u);
    const { after: reset } = runPrimitive(after, target, "m2.027.update", { ...line, operation: "reset" });
    createInterpreter(commands(reset), session, reset).start();
    expect(systemAudioOverride(session.m2Runtime, "battle")).toBeUndefined();
  });

  it("좌표를 생략한 옛 고정 순간이동 지점은 이름을 바꿔도 맵의 원점으로 등록한다", () => {
    const fixture = scene("blank");
    const original: Command = { kind: "m2Command", commandId: "m2-072-set-teleportation-point", fields: { mapId: fixture.map.id, label: "귀환" } };
    const { project, target, commands, map } = scene("blank", [original]);
    const { after } = runPrimitive(project, target, "m2.072.update", { index: 0, expectedHash: eventCommandHash(original), label: "북문" });
    expect(commands(after)).toEqual([{ ...original, fields: { ...original.fields, label: "북문" } }]);
    const session = startSession(after, 42);
    createInterpreter(commands(after), session, after).start();
    expect(session.teleportPoints).toEqual([{ mapId: map.id, x: 0, y: 0, label: "북문" }]);
  });

  it("스킬 장착 단계에서 이벤트 실행을 멈춘다", () => {
    const { step } = play("m2.078.insert", { screen: "skills" });
    expect(step).toEqual({ kind: "openMenuScreen", screen: "skills" });
  });

  it("지정한 배우의 스킬 장착과 몬스터 보관함으로 넘긴다", () => {
    const { project } = scene("blank");
    const actorId = project.database.actors[0].id;
    expect(play("m2.078.insert", { screen: "skills", actorId }).step)
      .toEqual({ kind: "openMenuScreen", screen: "skills", actorId });
    expect(play("m2.078.insert", { screen: "monster-box" }).step)
      .toEqual({ kind: "openMenuScreen", screen: "monster-box" });
  });

  it("불러오기와 게임 종료를 플레이어 전환 단계로 넘긴다", () => {
    expect(play("m2.093.insert", {}).step).toEqual({ kind: "openLoadMenu" });
    expect(play("m2.094.insert", {}).step).toEqual({ kind: "returnToTitle" });
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
  it.each(updateCorpus)("$request", async entry => {
    const before = corpusProject(fixtureProject(entry.fixture), entry);
    const target = resolveTarget(before, entry.target);
    // The corpus seeds the line the assistant originally read, including stale-location refusal cases.
    const args = { expectedHash: eventCommandHash(entry.setup.commands[0]), ...entry.args };
    const apply = () => runPrimitive(before, target, entry.primitive, args);
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
