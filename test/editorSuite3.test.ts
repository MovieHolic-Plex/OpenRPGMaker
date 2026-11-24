import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { compileCutscene, CutsceneValidationError, validateCutscene, type CutsceneBeat } from "@/editor/cutscene";
import { duplicateInto } from "@/editor/databaseCopy";
import { addDatabaseRecord, deleteDatabaseRecord } from "@/editor/databaseActions";
import { getMapEditHistoryMarker, resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { DATABASE_FIELD_SUPPORT, databaseFieldSupport, databaseFieldSupportNotice } from "@/editor/databaseFieldSupport";
import { FakeElement, installFakeDom } from "./fakeDom";
import { createDevShowcaseProjectForLocation } from "@/editor/devShowcaseProjects";
import { editorEventMarkerTexture } from "@/editor/editSceneEventMarkers";
import { isColorKeyedChipsetTextureKey } from "@/assets/bundled";
import { applyTransparentColorKey } from "@/assets/transparentColorKey";
import { charsetIdleFrameIndex, charsetWalkFrameIndex } from "@/player/charsetMotion";
import { readFileSync } from "node:fs";
import { EDIT_ACTIVITY_DISK_ENDPOINT } from "@/editor/editActivityEndpoint";
import { _resetEditActivityForTest, editActivityEntryCount, getEditActivityEntries, recordEditActivity, unlabeledEditActivityCount } from "@/editor/editActivityLog";
import { describeEventDiff, shortEventPath } from "@/editor/eventDiffLabel";
import { editorState } from "@/editor/editorState";
import { beginExistingEventDraft, createEventDraft, discardEventDraft, saveEventDraft } from "@/editor/eventDraftActions";
import { setEventPageTextCommand, updateEventPage } from "@/editor/eventPages";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { isolateTimers } from "./mergedTeardown";

describe("cutsceneCompiler", () => {
  isolateTimers();
  describe("compileCutscene", () => {
    it("대표 beat들을 이벤트 command 배열로 컴파일한다", () => {
      const beats: CutsceneBeat[] = [
        { kind: "say", speaker: "리나", face: { resourceId: "face_memory" }, text: "여기가 시작이었어." },
        { kind: "moveActor", target: "player", moves: [{ kind: "move", dir: "right" }], wait: true },
        { kind: "camera", mode: "pan", x: 5, y: 6, durationMs: 400, wait: true },
        { kind: "picture", action: "show", pictureId: "pic_memory", resourceId: "picture_memory", x: 10, y: 12 },
        { kind: "picture", action: "move", pictureId: "pic_memory", x: 24, y: 20, durationMs: 300, wait: true },
        { kind: "music", action: "bgm", resourceId: "bgm_memory" },
        { kind: "tint", value: "#101820", durationMs: 200, wait: true },
        { kind: "flash", color: "white", durationMs: 100 },
        { kind: "shake", intensity: 4, durationMs: 120 },
        { kind: "wait", ms: 80 },
      ];

      expect(compileCutscene(beats, { skippable: true })).toMatchInlineSnapshot(`
      [
        {
          "kind": "cutsceneControl",
          "mode": "begin",
          "skippable": true,
        },
        {
          "flipHorizontally": false,
          "kind": "changeFace",
          "position": "left",
          "resourceId": "face_memory",
        },
        {
          "body": "여기가 시작이었어.",
          "kind": "text",
          "speaker": "리나",
        },
        {
          "eventId": "@player",
          "kind": "moveEvent",
          "route": {
            "moves": [
              {
                "dir": "right",
                "kind": "move",
              },
            ],
            "repeat": false,
            "skippable": undefined,
            "wait": true,
          },
        },
        {
          "commandId": "m2-201-camera-control",
          "fields": {
            "durationMs": 400,
            "mode": "panTo",
            "target": "screen",
            "wait": true,
            "x": 5,
            "y": 6,
          },
          "kind": "m2Command",
        },
        {
          "kind": "showPicture",
          "pictureId": "pic_memory",
          "resourceId": "picture_memory",
          "x": 10,
          "y": 12,
        },
        {
          "commandId": "m2-052-move-picture",
          "fields": {
            "durationMs": 300,
            "pictureId": "pic_memory",
            "wait": true,
            "waitForPicture": true,
            "x": 24,
            "y": 20,
          },
          "kind": "m2Command",
        },
        {
          "kind": "playAudio",
          "loop": true,
          "resourceId": "bgm_memory",
        },
        {
          "commandId": "m2-046-tint-screen",
          "fields": {
            "color": "neutral",
            "durationMs": 200,
            "value": "#101820",
          },
          "kind": "m2Command",
        },
        {
          "kind": "wait",
          "ms": 200,
        },
        {
          "commandId": "m2-047-flash-screen",
          "fields": {
            "color": "white",
            "durationMs": 100,
          },
          "kind": "m2Command",
        },
        {
          "commandId": "m2-048-shake-screen",
          "fields": {
            "durationMs": 120,
            "intensity": "3",
            "value": 3,
          },
          "kind": "m2Command",
        },
        {
          "kind": "wait",
          "ms": 80,
        },
        {
          "kind": "label",
          "name": "cutscene_end",
        },
        {
          "commandId": "m2-201-camera-control",
          "fields": {
            "durationMs": 300,
            "mode": "return",
            "target": "player",
            "wait": true,
          },
          "kind": "m2Command",
        },
        {
          "commandId": "m2-046-tint-screen",
          "fields": {
            "color": "neutral",
            "durationMs": 0,
            "value": "#101820",
          },
          "kind": "m2Command",
        },
        {
          "durationMs": 0,
          "kind": "showPicture",
          "pictureId": "pic_memory",
          "resourceId": "picture_memory",
          "waitForPicture": false,
          "x": 24,
          "y": 20,
        },
        {
          "kind": "cutsceneControl",
          "mode": "end",
        },
      ]
    `);
    });

    it("begin/end 쌍과 스킵 라벨을 항상 보장한다", () => {
      const commands = compileCutscene([{ kind: "jump", name: "after_line" }, { kind: "label", name: "after_line" }], { skippable: true });

      expect(commands[0]).toEqual({ kind: "cutsceneControl", mode: "begin", skippable: true });
      expect(commands.at(-1)).toEqual({ kind: "cutsceneControl", mode: "end" });
      expect(commands).toContainEqual({ kind: "label", name: "cutscene_end" });
      expect(commands).toContainEqual({ kind: "gotoLabel", name: "after_line" });
    });

    it("parallel beat는 이동 루트를 비대기로 만들고 마지막에 이동 완료 대기를 둔다", () => {
      const commands = compileCutscene([
        {
          kind: "parallel",
          beats: [
            { kind: "moveActor", target: "ev_friend", moves: [{ kind: "move", dir: "left" }], wait: true },
            { kind: "picture", action: "show", pictureId: "pic_parallel", resourceId: "picture_memory", x: 0, y: 0 },
          ],
        },
      ]);

      expect(commands).toContainEqual({
        kind: "moveEvent",
        eventId: "ev_friend",
        route: { moves: [{ kind: "move", dir: "left" }], repeat: false, wait: false, skippable: undefined },
      });
      expect(commands).toContainEqual({ kind: "m2Command", commandId: "m2-058-wait-for-all-movement", fields: {} });
    });

    it("검증기가 없는 이벤트, 픽처 id 충돌, 음수 duration을 한국어 사유로 거부한다", () => {
      const beats: CutsceneBeat[] = [
        { kind: "moveActor", target: "ev_missing", moves: [], wait: true },
        { kind: "picture", action: "show", pictureId: "pic1", resourceId: "picture_memory", x: 0, y: 0 },
        { kind: "picture", action: "show", pictureId: "pic1", resourceId: "picture_memory", x: 1, y: 1 },
        { kind: "wait", ms: -1 },
      ];
      const result = validateCutscene(beats, { eventIds: new Set(["ev_known"]) });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.join("\n")).toContain("존재하지 않는 이벤트 'ev_missing'");
        expect(result.errors.join("\n")).toContain("픽처 id 'pic1'");
        expect(result.errors.join("\n")).toContain("duration은 음수일 수 없습니다");
      }
      expect(() => compileCutscene(beats, { context: { eventIds: new Set(["ev_known"]) } })).toThrow(CutsceneValidationError);
    });

    it("fade beat는 0.45 tint가 아닌 Screen Effect의 검정 fadeIn/fadeOut으로 컴파일한다", () => {
      const commands = compileCutscene([
        { kind: "fade", direction: "out", durationMs: 400, wait: true },
        { kind: "fade", direction: "in", durationMs: 400, wait: true },
      ]);
      expect(commands).toContainEqual(expect.objectContaining({
        kind: "m2Command",
        commandId: expect.stringMatching(/screen-effect/i),
        fields: expect.objectContaining({ effect: "fadeOut" }),
      }));
      expect(commands).toContainEqual(expect.objectContaining({
        kind: "m2Command",
        commandId: expect.stringMatching(/screen-effect/i),
        fields: expect.objectContaining({ effect: "fadeIn" }),
      }));
      expect(JSON.stringify(commands)).not.toContain("Tint Screen");
    });

    it("say beat의 emotion과 autoAdvance를 text command로 전달한다", () => {
      const commands = compileCutscene([
        { kind: "say", speaker: "리나", text: "기억나.", emotion: "sad", autoAdvance: true },
      ]);
      expect(commands).toContainEqual({
        kind: "text",
        speaker: "리나",
        body: "기억나.",
        emotion: "sad",
        autoAdvance: true,
      });
    });
  });
  /**
   * 카메라 줌이 AI 스키마에 노출되는가(2026-09-22).
   *
   * 왜 이 테스트가 필요한가: CutsceneCameraBeat.zoom 은 **컴파일러에 이미 있었지만**
   * CUTSCENE_BEAT_SCHEMA 에 없어서 모델이 그 필드의 존재를 알 수 없었다. 그래서
   * "고해상도 배경을 1:1로 쓰는" 요청에 모델이 배율을 걸 방법이 없었다. 스키마 노출과
   * 컴파일 결과를 함께 고정한다 — 둘 중 하나만 있으면 모델은 여전히 못 쓴다.
   */
  describe("컷신 카메라 줌", () => {
    it("zoom 이 m2-201 camera-control 필드로 전달된다", () => {
      const commands = compileCutscene([
        { kind: "camera", mode: "fixed", target: "player", zoom: 4.5, durationMs: 0 },
      ]);
      const camera = commands.find((c) => c.kind === "m2Command" && c.commandId === "m2-201-camera-control");
      expect(camera).toBeDefined();
      expect((camera as { fields: Record<string, unknown> }).fields.zoom).toBe(4.5);
    });

    it("zoom 을 생략하면 필드가 비어 런타임 기본(1)을 따른다", () => {
      const commands = compileCutscene([{ kind: "camera", mode: "fixed", target: "player" }]);
      const camera = commands.find((c) => c.kind === "m2Command" && c.commandId === "m2-201-camera-control");
      expect((camera as { fields: Record<string, unknown> }).fields.zoom).toBeUndefined();
    });
  });
});

describe("databaseCopy", () => {
  isolateTimers();
  type NamedRecord = { readonly id: string; name: string };
  // fix(db): " Copy" 하드코딩 접미사를 "사본"으로 바꾸면서, 이름 충돌 시 번호가 증가해야
  // 한다는 계약(P6)을 고정한다 — 반복 복제나 이미 "…사본" 접미사가 붙은 레코드를 다시
  // 복제해도 "…사본 사본" 같은 접미사 중첩이 생기지 않아야 한다.
  describe("duplicateInto — 사본 naming", () => {
    it("appends ' 사본' on the first duplicate", () => {
      const records: NamedRecord[] = [{ id: "a", name: "슬라임" }];
      duplicateInto(records, "a", "b");
      expect(records[1]?.name).toBe("슬라임 사본");
    });

    it("increments a trailing number when the plain 사본 name is already taken", () => {
      const records: NamedRecord[] = [
        { id: "a", name: "슬라임" },
        { id: "b", name: "슬라임 사본" },
      ];
      duplicateInto(records, "a", "c");
      expect(records[2]?.name).toBe("슬라임 사본 2");
    });

    it("keeps incrementing past existing numbered copies", () => {
      const records: NamedRecord[] = [
        { id: "a", name: "슬라임" },
        { id: "b", name: "슬라임 사본" },
        { id: "c", name: "슬라임 사본 2" },
      ];
      duplicateInto(records, "a", "d");
      expect(records[3]?.name).toBe("슬라임 사본 3");
    });

    it("duplicating an already-copied record uses the root name, not a nested suffix", () => {
      const records: NamedRecord[] = [
        { id: "a", name: "슬라임" },
        { id: "b", name: "슬라임 사본" },
      ];
      duplicateInto(records, "b", "c");
      expect(records[2]?.name).toBe("슬라임 사본 2");
      expect(records[2]?.name).not.toContain("사본 사본");
    });
  });
});

describe("databaseDirectReferenceDeletion", () => {
  isolateTimers();
  describe("database deletion preserves direct authored references", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
      resetMapEditHistory();
    });

    it.each(["learnedSkillId", "activateSkillId"] as const)("blocks a skill used only by item %s, including dormant effects", (field) => {
      const skillId = addDatabaseRecord("skills");
      const itemId = addDatabaseRecord("items");
      store.update((project) => {
        const item = project.database.items.find((record) => record.id === itemId)!;
        // The current type is normalGoods: inactive effects remain authored foreign keys.
        item.name = "참조를 보존할 아이템";
        item[field] = skillId;
        delete item.skillId;
      });
      const before = store.getCurrent();
      const historyMarker = getMapEditHistoryMarker();

      expect(deleteDatabaseRecord("skills", skillId)).toEqual({
        ok: false,
        message: expect.stringContaining("참조를 보존할 아이템"),
      });
      expect(store.getCurrent()).toBe(before);
      expect(getMapEditHistoryMarker()).toBe(historyMarker);

      store.update((project) => {
        delete project.database.items.find((record) => record.id === itemId)![field];
      });
      expect(deleteDatabaseRecord("skills", skillId)).toEqual({ ok: true });
      expect(deserialize(serialize(store.getCurrent())).database.skills.some((record) => record.id === skillId)).toBe(false);
    });

    it("blocks a skill used only by a class battle command", () => {
      const skillId = addDatabaseRecord("skills");
      const classId = addDatabaseRecord("classes");
      store.update((project) => {
        const actorClass = project.database.classes.find((record) => record.id === classId)!;
        actorClass.name = "전투 명령 소유 직업";
        actorClass.battleCommands = [{ id: "direct_skill", name: "직접 시전", kind: "skill", skillId }];
      });
      const before = store.getCurrent();
      const historyMarker = getMapEditHistoryMarker();

      expect(deleteDatabaseRecord("skills", skillId)).toEqual({
        ok: false,
        message: expect.stringContaining("전투 명령 소유 직업"),
      });
      expect(store.getCurrent()).toBe(before);
      expect(getMapEditHistoryMarker()).toBe(historyMarker);

      store.update((project) => {
        project.database.classes.find((record) => record.id === classId)!.battleCommands = [];
      });
      expect(deleteDatabaseRecord("skills", skillId)).toEqual({ ok: true });
      expect(deserialize(serialize(store.getCurrent())).database.skills.some((record) => record.id === skillId)).toBe(false);
    });

    const actorPermissions: { label: string; set: (project: Project, ids: string[]) => void }[] = [
      {
        label: "직업 장비 권한",
        set: (project, ids) => {
          project.database.classes[0]!.name = "권한 소유 레코드";
          project.database.classes[0]!.equipmentPermissions.actorIds = ids;
        },
      },
      {
        label: "장비 착용 권한",
        set: (project, ids) => {
          project.database.equipment[0]!.name = "권한 소유 레코드";
          project.database.equipment[0]!.equippableActorIds = ids;
        },
      },
      {
        label: "아이템 사용 권한",
        set: (project, ids) => {
          project.database.items[0]!.name = "권한 소유 레코드";
          project.database.items[0]!.usableActorIds = ids;
        },
      },
      {
        label: "레거시 아이템 장비 권한",
        set: (project, ids) => {
          project.database.items[0]!.name = "권한 소유 레코드";
          project.database.items[0]!.equipmentProfile.equippableActorIds = ids;
        },
      },
    ];

    it.each(actorPermissions)("blocks an actor referenced only by $label", ({ set }) => {
      const actorId = addDatabaseRecord("actors");
      store.update((project) => set(project, [actorId]));
      const before = store.getCurrent();
      const historyMarker = getMapEditHistoryMarker();

      expect(deleteDatabaseRecord("actors", actorId)).toEqual({
        ok: false,
        message: expect.stringContaining("권한 소유 레코드"),
      });
      expect(store.getCurrent()).toBe(before);
      expect(getMapEditHistoryMarker()).toBe(historyMarker);

      store.update((project) => set(project, []));
      expect(deleteDatabaseRecord("actors", actorId)).toEqual({ ok: true });
      expect(deserialize(serialize(store.getCurrent())).database.actors.some((record) => record.id === actorId)).toBe(false);
    });
  });
});

describe("databaseFieldSupport", () => {
  isolateTimers();
  const EXPECTED_FIELDS = [
    "imageResourceId",
    "iconResourceId",
    "consumptionLimit",
    "usableActorIds",
    "usableClassIds",
    "seedParameterBonuses",
    // 스키마·런타임에는 있었으나 저작 UI 가 없어 공시도 없던 세 필드(아이템 탭 기능 추가).
    "stateEffects",
    "animationId",
    "careProfile",
    "usageMessage",
    "equipmentProfile",
    "twoHanded",
    "accuracy",
    "criticalRate",
    "usableAsItemSkillId",
    "stateInflictIds",
    "stateInflictionChance",
    "stateResistanceChance",
    // 적의 투명·비행·색조는 화면에서 지운 칸이라(2026-10-02) 공시도 없다.
  ];
  describe("database field support descriptor", () => {
    it("is the unique exhaustive source for the eighteen-field truth contract", () => {
      expect(DATABASE_FIELD_SUPPORT.map((entry) => entry.field)).toEqual(EXPECTED_FIELDS);
      expect(new Set(DATABASE_FIELD_SUPPORT.map((entry) => entry.field)).size).toBe(18);
      expect(DATABASE_FIELD_SUPPORT.filter((entry) => entry.support === "runtime").map((entry) => entry.field)).toEqual([
        "imageResourceId",
        "iconResourceId",
        "consumptionLimit",
        "usableActorIds",
        "usableClassIds",
        "seedParameterBonuses",
        "stateEffects",
        "animationId",
        "careProfile",
        "twoHanded",
        "accuracy",
        "criticalRate",
        "usableAsItemSkillId",
        "stateInflictIds",
        "stateInflictionChance",
        "stateResistanceChance",
      ]);
      expect(databaseFieldSupport("usageMessage").support).toBe("editorOnly");
      expect(databaseFieldSupport("equipmentProfile").support).toBe("editorOnly");
    });

    it("describes imagery in the current inventory, equipment menu and shop", () => {
      for (const field of ["imageResourceId", "iconResourceId"]) {
        const help = databaseFieldSupport(field).help;
        expect(help).toContain("데이터베이스");
        expect(help).toContain("상점");
        expect(help).toContain("피커");
        expect(help).toContain("미리보기");
        expect(help).toContain("요약");
        expect(help).toContain("인벤토리");
        expect(help).toContain("전투");
        expect(help).toContain("장비 메뉴");
        expect(help).toContain("아이콘을 우선");
        expect(databaseFieldSupport(field).support).toBe("runtime");
      }
    });

    it("renders support state directly from the descriptor", () => {
      const restore = installFakeDom();
      try {
        const notice = databaseFieldSupportNotice("consumptionLimit", "usageMessage");
        const children = (notice as unknown as FakeElement).childNodes as FakeElement[];
        // 접힌 details: [summary, p, p]
        expect(children).toHaveLength(3);
        expect(notice.tagName).toBe("DETAILS");
        expect(children[0]!.tagName).toBe("SUMMARY");
        expect(children[1]!.dataset.runtimeSupport).toBe("runtime");
        expect(children[2]!.dataset.runtimeSupport).toBe("editorOnly");
      } finally {
        restore();
      }
    });
  });
});

describe("devShowcaseProjects", () => {
  isolateTimers();
  describe("local dev project URL overrides", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("lets projectRecovered load the LegacyDb canonical project instead of a generated showcase", () => {
      vi.stubGlobal("window", {
        location: {
          hostname: "127.0.0.1",
          search: "?projectRecovered=1&townCityShowcase=1",
        },
      });

      const project = createDevShowcaseProjectForLocation();

      expect(project).toBeNull();
    });

    it("does not let generated showcase URLs replace the canonical LegacyDb default by themselves", () => {
      vi.stubGlobal("window", {
        location: {
          hostname: "127.0.0.1",
          search: "?townCityShowcase=1",
        },
      });

      const project = createDevShowcaseProjectForLocation();

      expect(project).toBeNull();
    });

    it("creates a true blank project for the blankProject URL", () => {
      vi.stubGlobal("window", {
        location: {
          hostname: "127.0.0.1",
          search: "?blankProject=1",
        },
      });

      const project = createDevShowcaseProjectForLocation();

      if (!project) throw new Error("expected fresh blank project");
      expect(project?.meta.title).toBe("새 프로젝트");
      expect(Object.keys(project.maps)).toHaveLength(1);
      expect(project.maps[project.startMapId]?.events).toHaveLength(0);
    });
  });
});

describe("easyrpgRtpRuntime", () => {
  isolateTimers();
  describe("EasyRPG RTP runtime sprite rendering", () => {
    it("uses the saved facing direction for uploaded charset editor previews", () => {
      const project = createBlankProject();
      project.assets.uploaded.test_charset = { id: "test_charset", name: "test", kind: "charset", dataUrl: "data:image/png;base64,AA==", meta: {} };
      for (const [direction, frame] of [["up", 1], ["right", 13], ["down", 25], ["left", 37]] as const) {
        expect(editorEventMarkerTexture(project, { sprite: { type: "uploaded", id: "test_charset" }, pattern: 1, direction })?.frame).toBe(frame);
      }
    });
    it("preserves opaque artwork that shares RGB with a transparent corner", () => {
      for (const rgb of [[0, 0, 0], [255, 255, 255], [255, 118, 50]]) {
        const pixels = new Uint8ClampedArray([...rgb, 0, ...rgb, 255, 12, 34, 56, 128]);
        const before = pixels.slice();
        applyTransparentColorKey(pixels);
        expect(pixels).toEqual(before);
      }
    });
    it("makes pixels matching the sheet top-left color transparent", () => {
      const pixels = new Uint8ClampedArray([
        0, 147, 146, 255,
        12, 34, 56, 255,
        0, 147, 146, 128,
      ]);

      const key = applyTransparentColorKey(pixels);

      expect(key).toEqual({ r: 0, g: 147, b: 146, a: 255 });
      expect(Array.from(pixels.slice(0, 4))).toEqual([0, 147, 146, 0]);
      expect(Array.from(pixels.slice(4, 8))).toEqual([12, 34, 56, 255]);
      expect(Array.from(pixels.slice(8, 12))).toEqual([0, 147, 146, 0]);
    });

    it("cycles moving NPC frames inside the same RPG Maker 2000 CharSet slot", () => {
      const baseFrame = 86;

      expect(charsetWalkFrameIndex(baseFrame, "right", 0)).toBe(60);
      expect(charsetWalkFrameIndex(baseFrame, "right", 1)).toBe(61);
      expect(charsetWalkFrameIndex(baseFrame, "right", 2)).toBe(62);
      expect(charsetWalkFrameIndex(baseFrame, "right", 3)).toBe(61);
      expect(charsetWalkFrameIndex(baseFrame, "right", 4)).toBe(60);
      expect(charsetIdleFrameIndex(baseFrame, "left")).toBe(85);
    });

    it("applies transparent color keys only to object-heavy chipset sheets", () => {
      expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_interior")).toBe(true);
      expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_dungeon")).toBe(true);
      expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_retro_dungeon")).toBe(true);
      expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_combined_town")).toBe(false);
      expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_retro_exterior")).toBe(false);
    });
  });
});

describe("editActivityEndpoint", () => {
  isolateTimers();
  // 왜 파일을 문자열로 읽어 정규식으로 보는가 (선례: test/aiActivityLogEndpoint.test.ts):
  // 경로 상수는 순환 import 를 피하려고 **값만 복제**돼 있다 — 타입 검사가 드리프트를 못 본다.
  // 그리고 404 는 fetch 가 throw 하지 않는다. 클라이언트는 첫 실패에 미러를 스스로 끄므로 경로가
  // 어긋나면 로그가 조용히 0줄이 된다(2026-08-28 AI 미러 실측). 이 테스트가 방어선이다.
  //
  // 2026-09-16 (I3): 본체가 `vite.config.ts` 플러그인에서 `scripts/lib/activityMirror.mjs` 로
  // 나왔다. 이제 앱·로컬 서버·vite 가 같은 파일을 쓰므로 계약도 **공용 본체**를 본다 —
  // 껍데기 셋이 각자 미들웨어를 들고 있던 동안에는 이 계약이 vite 하나만 지켜봤다.
  describe("edit activity disk mirror endpoint", () => {
    const core = readFileSync(new URL("../scripts/lib/activityMirror.mjs", import.meta.url), "utf8");
    const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
    const client = readFileSync(new URL("../src/editor/editActivityLog.ts", import.meta.url), "utf8");
    const cli = readFileSync(new URL("../scripts/list-edit-activity.mjs", import.meta.url), "utf8");
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      scripts?: Record<string, string>;
    };

    it("공용 본체가 클라이언트와 같은 경로를 매칭한다", () => {
      expect(core).toContain(`export const EDIT_ACTIVITY_DISK_ENDPOINT = "${EDIT_ACTIVITY_DISK_ENDPOINT}"`);
      expect(core).toContain("pathname?.startsWith(EDIT_ACTIVITY_DISK_ENDPOINT)");
      expect(EDIT_ACTIVITY_DISK_ENDPOINT).toBe("/__oprn/edit-activity");
    });

    it("세 껍데기가 모두 같은 본체를 쓴다", () => {
      // 한 껍데기라도 빠지면 그 껍데기에서 로그가 조용히 0줄이 된다 — 이 증분의 존재 이유다.
      const vite = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
      const serve = readFileSync(new URL("../electron/serve/runtime.ts", import.meta.url), "utf8");
      for (const shell of [vite, serve]) {
        expect(shell).toContain("createActivityMirrorMiddleware");
      }
      // 앱은 app:// 프로토콜 핸들러가 페이지 출처 요청을 받는다(클라이언트는 상대 경로로 fetch 한다).
      const protocols = readFileSync(new URL("../electron/main/protocols.ts", import.meta.url), "utf8");
      expect(protocols).toContain("handleActivityMirror");
    });

    it("AI 미러 경로와 겹치지 않는다", () => {
      // 같은 파일에 append 하면 `npm run ai:log` 가 읽는 AI 턴 기록이 편집 노이즈에 묻힌다.
      expect(EDIT_ACTIVITY_DISK_ENDPOINT).not.toBe("/__oprn/ai-activity");
      expect(core).toContain('"output", kind === "ai" ? "ai-activity" : "edit-activity"');
    });

    it("클라이언트는 경로 문자열을 다시 적지 않고 상수를 쓴다", () => {
      expect(client).toContain("fetch(EDIT_ACTIVITY_DISK_ENDPOINT");
      expect(client).not.toMatch(/fetch\(\s*"\/__/);
    });

    it("dev 와 preview 양쪽에 붙는다", () => {
      // configureServer 만 있으면 `vite preview` 경로의 미러가 404 로 조용히 죽는다(AI 미러 실측).
      const plugin = viteConfig.slice(viteConfig.indexOf("function activityMirrorPlugin"));
      expect(plugin).toContain("configureServer(server)");
      expect(plugin).toContain("configurePreviewServer(server)");
      expect(plugin).toContain("server.middlewares.use(middleware)");
      expect(viteConfig).toMatch(/plugins:\s*\[[^\]]*activityMirrorPlugin\(\)/);
    });

    it("배치 본문을 읽고 고정 파일명만 쓴다", () => {
      // 클라이언트가 보내는 모양: { entries: EditActivityEntry[] }
      expect(client).toContain("JSON.stringify({ entries: batch })");
      expect(core).toContain("body.entries");
      // 경로 탈출 방어: **편집** 파일명에 클라이언트 값을 끼우지 않는다(템플릿 파일명 금지).
      // AI 분기는 `record.id` 를 파일명에 쓰므로 SAFE_ACTIVITY_ID_PATTERN 으로 막는다(아래 테스트).
      const editWriter = core.slice(core.indexOf("function writeEditActivity"));
      expect(editWriter).toContain('join(dir, "edits.jsonl")');
      expect(editWriter).toContain('join(dir, "latest.json")');
      expect(editWriter).toContain('join(dir, "index.json")');
      expect(editWriter).not.toMatch(/join\(dir, `/);
    });

    it("빈 배치를 400 으로 끊지 않는다", () => {
      // 400 을 주면 클라이언트가 미러를 영구히 끈다 — 조용한 유실의 시작점이다.
      expect(core).toContain("if (entries.length === 0) return 204");
    });

    it("CORS·OPTIONS·GET·본문 상한을 갖춘다", () => {
      const middleware = readFileSync(
        new URL("../scripts/lib/activityMirrorMiddleware.mjs", import.meta.url),
        "utf8",
      );
      expect(middleware).toContain("corsOrigin(req)");
      expect(middleware).toContain("access-control-allow-methods");
      expect(core).toContain("method not allowed");
      expect(core).toContain("payload too large");
      expect(core).toContain('url.includes("list")');
      expect(core).toContain("const EDIT_ACTIVITY_MAX_BODY_BYTES");
    });

    it("CLI 리더가 미들웨어와 같은 디렉터리·파일명을 읽는다", () => {
      // CLI 는 cwd 기준 개발 편의 도구다(앱·로컬 서버는 연 프로젝트 폴더 기준).
      expect(cli).toContain('join(process.cwd(), "output", "edit-activity")');
      expect(cli).toContain('join(DIR, "index.json")');
      expect(cli).toContain('join(DIR, "edits.jsonl")');
      expect(packageJson.scripts?.["edit:log"]).toBe("node scripts/list-edit-activity.mjs");
    });
  });
});

// 편집 행위 기록 회귀 테스트.
//
// 2026-08-29 관측성 감사에서 라이브 프로브로 재현한 증상을 정식화한다. 당시 결과:
//   1. NPC 생성 → 기록 0건   2. 이름 변경 → 0건   3. 커맨드 추가 → 0건
//   4. 조건 변경 → 0건       5. 적용 → 1건, 라벨 "이벤트 편집", 어떤 NPC 인지 없음
// 이 테스트는 각 단계가 기록되고, 적용 기록이 **어떤 NPC의 어떤 필드**인지 담는 것을 고정한다.
describe("editActivityRecording", () => {
  isolateTimers();
  beforeEach(() => {
    _resetEventDraftVaultForTest();
    store.replaceProject(createBlankProject());
    editorState.set({ selectedEventId: null, selectedEventPageId: null });
    _resetEditActivityForTest();
  });
  function labels(): readonly string[] {
    return getEditActivityEntries().map((entry) => entry.label ?? "(라벨 없음)");
  }
  describe("store mutation 초크포인트", () => {
    it("모든 mutation 메서드가 행위를 기록한다", () => {
      const mapId = store.getCurrent().startMapId;

      store.update((project) => {
        project.meta.title = "제목 변경";
      }, { scope: "project", label: "제목 변경" });
      store.updateMap(mapId, (map) => {
        map.lowerTiles[0] = 5;
      }, { label: "타일 편집", cells: [{ x: 0, y: 0, layer: "lower" }] });

      const entries = getEditActivityEntries();
      expect(entries.map((entry) => entry.label)).toEqual(["타일 편집", "제목 변경"]);
      // updateMap 은 맵 스코프 + 셀 수를 남긴다 — 어느 맵의 몇 칸인지 알 수 있어야 한다.
      const tileEntry = entries[0]!;
      expect(tileEntry.scope).toBe("map");
      expect(tileEntry.mapId).toBe(mapId);
      expect(tileEntry.cellCount).toBe(1);
    });

    it("라벨 없는 mutation 을 별도로 집계한다", () => {
      store.update((project) => {
        project.meta.title = "라벨 없음";
      });
      expect(unlabeledEditActivityCount()).toBe(1);
      expect(getEditActivityEntries()[0]?.label).toBeNull();
    });

    it("database 스코프는 컬렉션 이름을 남긴다", () => {
      store.update((project) => {
        project.database.items = [];
      }, { scope: "database", collection: "items", label: "아이템 초기화" });
      const entry = getEditActivityEntries()[0]!;
      expect(entry.scope).toBe("database");
      expect(entry.collection).toBe("items");
    });
  });
  describe("NPC 편집 세션 (원래 증상 재현 시나리오)", () => {
    it("생성·이름변경·커맨드추가·적용이 각각 기록되고 적용 기록이 필드 경로를 담는다", () => {
      const mapId = store.getCurrent().startMapId;

      // 1. NPC 생성
      const eventId = createEventDraft(mapId, 4, 5);
      expect(eventId).not.toBe("");
      expect(editActivityEntryCount()).toBeGreaterThan(0);
      expect(labels()[0]).toContain("이벤트 생성");

      // 드래프트를 적용해 기존 이벤트로 만든다(이후 단계가 "수정" 이 되게).
      saveEventDraft(mapId, eventId);
      _resetEditActivityForTest();

      // 2. 편집 시작 → 3. 이름 변경 → 4. 커맨드 추가
      expect(beginExistingEventDraft(mapId, eventId)).toBe(true);
      const pageId = store.getCurrent().maps[mapId]!.events.find((e) => e.id === eventId)!.pages![0]!.id;
      updateEventPage(mapId, eventId, pageId, { name: "촌장" });
      setEventPageTextCommand(mapId, eventId, pageId, undefined, "안녕하세요");

      // 편집 중 단계들도 기록에 남아야 한다 — 예전에는 여기까지 0건이었다.
      const midSession = editActivityEntryCount();
      expect(midSession).toBeGreaterThan(1);

      // 5. 적용
      const diff = saveEventDraft(mapId, eventId);
      expect(diff).not.toBeNull();

      const applied = getEditActivityEntries().find((entry) => entry.label?.startsWith("이벤트 편집:"));
      expect(applied, "적용 기록이 있어야 한다").toBeDefined();
      // 핵심: 어떤 NPC 인지 라벨에 있어야 한다.
      expect(applied!.label).toContain("촌장");
      expect(applied!.eventId).toBe(eventId);
      // 핵심: 어느 필드가 바뀌었는지 경로가 남아야 한다.
      const paths = (applied!.fields ?? []).map((field) => field.path);
      expect(paths.some((path) => path.includes("name"))).toBe(true);
      expect(paths.some((path) => path.includes("commands"))).toBe(true);
    });

    it("편집 취소도 기록에 남는다", () => {
      const mapId = store.getCurrent().startMapId;
      const eventId = createEventDraft(mapId, 6, 6);
      saveEventDraft(mapId, eventId);
      beginExistingEventDraft(mapId, eventId);
      _resetEditActivityForTest();

      discardEventDraft(mapId, eventId);
      expect(labels().some((label) => label.includes("이벤트 편집 취소"))).toBe(true);
    });
  });
  describe("연속 편집 병합", () => {
    it("같은 라벨의 연속 맵 편집을 한 엔트리로 합치고 셀 수를 누적한다", () => {
      const mapId = store.getCurrent().startMapId;
      for (let x = 0; x < 12; x += 1) {
        store.updateMap(mapId, (map) => {
          map.lowerTiles[x] = 7;
        }, { label: "타일 편집", cells: [{ x, y: 0, layer: "lower" }] });
      }
      const entries = getEditActivityEntries({ scope: "map" });
      // 드래그 12칸이 12줄이 되면 로그가 스트로크 노이즈로 덮인다.
      expect(entries).toHaveLength(1);
      expect(entries[0]!.cellCount).toBe(12);
      expect(entries[0]!.mergedCount).toBe(12);
    });

    it("필드 상세가 붙은 엔트리는 병합하지 않는다", () => {
      recordEditActivity({ scope: "map", mapId: "m", label: "이벤트 편집", generation: 1, fields: [{ path: "a" }] });
      recordEditActivity({ scope: "map", mapId: "m", label: "이벤트 편집", generation: 2, fields: [{ path: "b" }] });
      expect(getEditActivityEntries()).toHaveLength(2);
    });
  });
  describe("EventDiff 라벨", () => {
    it("경로를 커맨드/페이지 단위까지 줄인다", () => {
      expect(shortEventPath("event.pages[0].commands[2].body.text")).toBe("pages[0].commands[2]");
      expect(shortEventPath("event.pages[0].name")).toBe("pages[0].name");
      expect(shortEventPath("event")).toBe("전체");
    });

    it("생성/수정을 구분하고 이름을 담는다", () => {
      expect(describeEventDiff({ mapId: "m", eventId: "e", kind: "created", changes: [] }, "촌장")).toBe("이벤트 생성: 촌장");
      const updated = describeEventDiff(
        {
          mapId: "m",
          eventId: "e",
          kind: "updated",
          changes: [
            { path: "event.pages[0].name", before: "페이지 1", after: "촌장" },
            { path: "event.pages[0].commands[0]", before: undefined, after: {} },
          ],
        },
        "촌장",
      );
      expect(updated).toContain("촌장");
      expect(updated).toContain("pages[0].name");
    });

    it("diff 가 없으면 일반 라벨로 떨어진다", () => {
      expect(describeEventDiff(null)).toBe("이벤트 편집");
    });
  });
});
