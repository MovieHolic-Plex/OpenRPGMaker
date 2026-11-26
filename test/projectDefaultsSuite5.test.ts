import { describe, expect, it } from "vitest";
import { applyEditedGameTitle, briefOpeningMotive, briefOpeningSequence, defaultOpeningSequence, isUntouchedDefaultOpening } from "@/project/defaults/defaultOpeningSequence";
import { type CinematicSequence, type Command, type GameEvent, type Project, SCHEMA_VERSION, type TilesetDef } from "@/project/types";
import { runTool } from "@/editor/tools";
import { createBlankProject, ensureSwitchVariableSlots, createBlankMap, createStarterMap, TILE, COMBINED_TOWN_TILESET_ID, DEFAULT_TILESET_ID, DEFAULT_TILESET_NAME, DEFAULT_TILESET_TEXTURE_KEY, DEFAULT_TILE_SIZE, DEFAULT_EASYRPG_CHARSET_ID, LEGACY_RM_TILESET_ID, LEGACY_RM_TILESET_TEXTURE_KEY, ensureBundledResourceProfiles, removeLegacyRmTileset } from "@/project/defaults";
import { loadHeadlessProject } from "@/headless";
import { changeParty, startSession } from "@/project/session";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { TilesetReferenceEvidence } from "@/ai/tilesetReferenceEvidence";
import { compileCutscene } from "@/editor/cutscene";
import { resolveBattleBackdrop } from "@/battle/battleBackdrop";
import { isolateTimers } from "./mergedTeardown";
import { TERRAIN_TAG, describeChipsetTile, dirtLikeTiles, tileLabelForIndex } from "@/project/defaults/chipsetMapping";
import { TILE_SIZE as RUNTIME_TILE_SIZE } from "@/assets/bundled";
import { GENERATED_FACESET_FACE_IDS } from "@/assets/facesetFaceAssets";
import { ATLAS_CARTOGRAPHY_ID } from "@/project/defaults/atlasCartography";
import { TILE_SIZE as PREVIEW_TILE_SIZE } from "@/assets/tilePreview";
import { serialize } from "@/project/io";
import sampleProject from "./fixtures/projects/oprn-sample-v3.json";
import { retiredEasyRpgTileset, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { createDungeonTerrainAutotileGroups, DUNGEON_TERRAIN_AUTOTILE_PREFIX } from "@/project/defaults/dungeonTerrainAutotiles";
import { applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness";
import { composeCombinedTownRetroWorldTileset } from "@/project/defaults/combinedTownRetroWorld";

describe("defaultOpeningSequence", () => {
  isolateTimers();
  describe("gameTitle", () => {
    isolateTimers();
    function titleCard(narration: string): CinematicSequence {
      return {
        enabled: true,
        skippable: true,
        scenes: [{ id: "card", kind: "text", narration, durationMs: 1000 }],
      };
    }
    describe("applyEditedGameTitle", () => {
      it("자료집 게임 타이틀을 고치면 프로젝트 이름과 씨앗 제목 카드도 따라간다", () => {
        const project = {
          meta: { title: "새 게임" },
          system: { opening: titleCard("— 새 게임 —") },
        };
        applyEditedGameTitle(project, "새 프로젝트", "달빛 항구");
        expect(project.meta.title).toBe("달빛 항구");
        expect(project.system.opening.scenes[0]).toMatchObject({ narration: "— 달빛 항구 —" });
      });

      it("칸을 비우는 중간에는 프로젝트 이름을 지우지 않는다", () => {
        const project = { meta: { title: "달빛 항구" }, system: { opening: titleCard("— 달빛 항구 —") } };
        applyEditedGameTitle(project, "달빛 항구", "   ");
        expect(project.meta.title).toBe("달빛 항구");
        expect(project.system.opening.scenes[0]).toMatchObject({ narration: "— 달빛 항구 —" });
      });

      it("장면이 여러 개인 오프닝 글은 그대로 둔다", () => {
        const opening = titleCard("숲으로 들어가자");
        opening.scenes.push({ id: "next", kind: "text", narration: "그리고 밤이 왔다", durationMs: 1000 });
        const project = { meta: { title: "새 게임" }, system: { opening } };
        applyEditedGameTitle(project, "새 게임", "달빛 항구");
        expect(project.meta.title).toBe("달빛 항구");
        expect(project.system.opening.scenes[0]).toMatchObject({ narration: "숲으로 들어가자" });
      });
    });
  });
  // 2026-09-23 도그푸딩 「등대지기의 겨울」(모험 JRPG, Pi 조수)에서 나온 생성·저작 도구 결함 회귀.
  describe("jrpgDogfoodLighthouseRegressions", () => {
    isolateTimers();
    /** runTool 은 성공하면 ctx.project 를 새 초안으로 갈아 끼운다 — 결과는 항상 ctx.project 에서 읽는다. */
    function blank(): { ctx: { project: Project }; mapId: string } {
      const project = createBlankProject();
      return { ctx: { project }, mapId: project.startMapId };
    }
    function talkEvent(id: string, x: number, y: number, commands: unknown[]): Record<string, unknown> {
      return {
        id, x, y, trigger: { kind: "action" }, commands: [],
        pages: [{
          id: `${id}_p0`, name: id, conditions: [], trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, pattern: 0 },
          commands,
        }],
      };
    }
    function eventOf(project: Project, mapId: string, id: string): GameEvent {
      const event = project.maps[mapId]!.events.find(entry => entry.id === id);
      if (!event) throw new Error(`missing event ${id}`);
      return event;
    }
    describe("defect 1 — changeParty op/action drift", () => {
      it("upsert_event canonicalizes {op:'+='} to action:'add' and warns", () => {
        const { ctx, mapId } = blank();
        const result = runTool(ctx, "upsert_event", {
          mapId, event: talkEvent("ev_kyle", 3, 3, [{ kind: "text", body: "같이 가자!" }, { kind: "changeParty", actorId: "actor_guardian", op: "+=" }]),
        });
        expect(result.ok, result.summary).toBe(true);
        const command = eventOf(ctx.project, mapId, "ev_kyle").pages![0]!.commands[1] as Record<string, unknown>;
        expect(command).toEqual({ kind: "changeParty", actorId: "actor_guardian", action: "add" });
        expect((result as { diff?: { warnings?: string[] } }).diff?.warnings?.join(" ")).toContain('action:"add"');
      });

      it("rejects a changeParty whose direction cannot be read, naming the field", () => {
        const { ctx, mapId } = blank();
        const result = runTool(ctx, "upsert_event", {
          mapId, event: talkEvent("ev_kyle", 3, 3, [{ kind: "changeParty", actorId: "actor_guardian" }]),
        });
        expect(result.ok).toBe(false);
        expect(result.summary).toContain("changeParty");
        expect(result.summary).toContain("action");
      });

      it("maps action aliases on amount commands to op instead of blindly filling +=", () => {
        const { ctx, mapId } = blank();
        const itemId = ctx.project.database.items[0]!.id;
        const result = runTool(ctx, "upsert_event", {
          mapId, event: talkEvent("ev_pay", 3, 3, [{ kind: "changeItem", itemId, action: "remove", amount: 1 }]),
        });
        expect(result.ok, result.summary).toBe(true);
        expect(eventOf(ctx.project, mapId, "ev_pay").pages![0]!.commands[0]).toMatchObject({ kind: "changeItem", op: "-=" });
      });

      it("loading a saved project repairs legacy op:'+=' and the runtime never treats unknown actions as remove", () => {
        const { ctx, mapId } = blank();
        ctx.project.maps[mapId]!.events.push(talkEvent("ev_kyle", 3, 3, [{ kind: "changeParty", actorId: "actor_guardian", op: "+=" }]) as unknown as GameEvent);
        const loaded = loadHeadlessProject(JSON.stringify(ctx.project));
        expect(eventOf(loaded, mapId, "ev_kyle").pages![0]!.commands[0]).toEqual({ kind: "changeParty", actorId: "actor_guardian", action: "add" });

        const session = { partyActorIds: ["actor_hero"] } as Parameters<typeof changeParty>[0];
        changeParty(session, "actor_hero", undefined as never);
        expect(session.partyActorIds).toEqual(["actor_hero"]);
      });
    });
    describe("defect 2 — scene test can see party membership", () => {
      function sceneFor(project: Project, mapId: string, expect: Record<string, unknown>) {
        return runSceneTest(project, {
          mapId, start: { x: 3, y: 4 },
          steps: [{ kind: "face", dir: "up" }, { kind: "interact", eventId: "ev_kyle" }, { kind: "wait", ticks: 30 }, { kind: "expect", ...expect } as never],
        });
      }

      it("addFollower alone does not satisfy partyIncludes; changeParty add does, and finalState reports the party", () => {
        const followerOnly = blank();
        expect(runTool(followerOnly.ctx, "upsert_event", {
          mapId: followerOnly.mapId, event: talkEvent("ev_kyle", 3, 3, [{ kind: "addFollower", actorId: "actor_guardian", name: "카일" }]),
        }).ok).toBe(true);
        const fake = sceneFor(followerOnly.ctx.project, followerOnly.mapId, { partyIncludes: "actor_guardian" });
        expect(fake.ok).toBe(false);
        expect(fake.failureReason).toContain("addFollower");
        expect(fake.finalState.partyActorIds).toEqual(["actor_hero"]);

        const joined = blank();
        expect(runTool(joined.ctx, "upsert_event", {
          mapId: joined.mapId, event: talkEvent("ev_kyle", 3, 3, [{ kind: "changeParty", actorId: "actor_guardian", action: "add" }]),
        }).ok).toBe(true);
        const real = sceneFor(joined.ctx.project, joined.mapId, { partyIncludes: "actor_guardian" });
        expect(real.ok, real.failureReason).toBe(true);
        expect(real.finalState.partyActorIds).toContain("actor_guardian");
      });

      it("add_companion on an existing event warns that a follower is not a party member", () => {
        const { ctx, mapId } = blank();
        runTool(ctx, "upsert_event", { mapId, event: talkEvent("ev_kyle", 3, 3, [{ kind: "text", body: "같이 가자!" }]) });
        const result = runTool(ctx, "add_companion", { who: { actorId: "actor_guardian" }, target: { eventId: "ev_kyle" } });
        expect(result.ok, result.summary).toBe(true);
        expect(JSON.stringify(result)).toContain("partyIncludes");
      });
    });
    describe("defect 4 — dungeons are not renamed house interiors", () => {
      it("a new-dungeon pipeline picks its tiles in code, so it demands no tileset reference reading", () => {
        const { ctx } = blank();
        expect(new TilesetReferenceEvidence().beforeWrite(ctx.project, "run_dungeon_room_pipeline", { mapId: "map_frozen_cave", theme: "ice" })).toBeNull();
      });

      it("set_map_properties refuses to give a map the name another map already has", () => {
        const { ctx } = blank();
        expect(runTool(ctx, "create_map", { id: "map_frozen_cave", name: "얼어붙은 해안 동굴", width: 30, height: 20 }).ok).toBe(true);
        expect(runTool(ctx, "create_map", { id: "map_house_9", name: "은선의 집 내부", width: 13, height: 18 }).ok).toBe(true);
        const renamed = runTool(ctx, "set_map_properties", { mapId: "map_house_9", name: "얼어붙은 해안 동굴" });
        expect(renamed.ok).toBe(false);
        expect(renamed.summary).toContain("map_frozen_cave");
        expect(ctx.project.maps.map_house_9!.name).toBe("은선의 집 내부");
        expect(runTool(ctx, "set_map_properties", { mapId: "map_frozen_cave", name: "얼어붙은 해안 동굴" }).ok).toBe(true);
      });
    });
    describe("defect 5 — ending faces follow the speaker", () => {
      it("resetFace clears the caller's face and a different faceless speaker clears the previous face", () => {
        const commands = compileCutscene([
          { kind: "say", speaker: "루미아", text: "할아버지!" },
          { kind: "say", speaker: "에릭 할아버지", face: { resourceId: "easyrpg-faceset-people1-06" }, text: "오오." },
          { kind: "say", speaker: "에릭 할아버지", text: "잘 했다." },
          { kind: "say", speaker: "내레이션", text: "불이 켜졌다." },
          { kind: "say", speaker: "에릭 할아버지", text: "고맙구나." },
        ], { resetFace: true });
        const faces = commands.flatMap(command => command.kind === "changeFace" ? [command.resourceId] : command.kind === "text" ? [`>${command.speaker}`] : []);
        expect(faces).toEqual([
          "", ">루미아",
          "easyrpg-faceset-people1-06", ">에릭 할아버지", ">에릭 할아버지",
          "", ">내레이션",
          "easyrpg-faceset-people1-06", ">에릭 할아버지",
        ]);
      });

      it("without resetFace an inherited face is left alone (page-appearance NPC cutscenes)", () => {
        const commands: Command[] = compileCutscene([{ kind: "say", speaker: "리나", text: "기억나." }]);
        expect(commands.some(command => command.kind === "changeFace")).toBe(false);
      });
    });
    describe("defect 6 — interactive events replace auto furniture inspects", () => {
      it("place_chest on an ev_inspect_ tile removes the inspect event", () => {
        const { ctx, mapId } = blank();
        ctx.project.maps[mapId]!.events.push(talkEvent("ev_inspect_map_x_5", 3, 3, [{ kind: "text", body: "술통을 두드려 본다." }]) as unknown as GameEvent);
        const result = runTool(ctx, "place_chest", { mapId, x: 3, y: 3, contents: { gold: 10 } });
        expect(result.ok, result.summary).toBe(true);
        const at = ctx.project.maps[mapId]!.events.filter(event => event.x === 3 && event.y === 3).map(event => event.id);
        expect(at).toEqual([(result.data as { eventId: string }).eventId]);
        expect(JSON.stringify(result)).toContain("ev_inspect_map_x_5");
      });
    });
    describe("defect 7 — a boss that can never hurt the start party is reported", () => {
      it("upsert_troop warns with party and enemy numbers", () => {
        const { ctx } = blank();
        const enemy = runTool(ctx, "upsert_enemy", { enemy: {
          id: "enemy_blizzard_spirit", name: "눈보라 정령", monsterResourceId: "generated-enemy-sylph-air", stats: { maxHp: 280, maxMp: 50, attack: 22, defense: 12, mind: 12, agility: 8 },
          rewards: { exp: 100, gold: 150 },
        } });
        expect(enemy.ok, enemy.summary).toBe(true);
        const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_blizzard_spirit_boss", name: "눈보라 정령", enemyIds: ["enemy_blizzard_spirit"] } });
        expect(result.ok, result.summary).toBe(true);
        const text = JSON.stringify(result);
        expect(text).toContain("밸런스");
        expect(text).toContain("tune_enemy");
      });
    });
    describe("defect 8 — backdrop and opening do not contradict the plan", () => {
      it("a battle in an interior under a snowy map uses the snow backdrop", () => {
        const { ctx, mapId } = blank();
        expect(runTool(ctx, "create_map", { id: "map_lighthouse_top", name: "등대 꼭대기", width: 20, height: 16 }).ok).toBe(true);
        const project = ctx.project;
        project.maps[mapId]!.climate = { mode: "fixed", weather: "snow", intensity: 0.8 };
        project.mapTree = { mapId, children: [{ mapId: "map_lighthouse_top", children: [] }] } as Project["mapTree"];
        project.database.troops.push({ id: "troop_boss", name: "보스", enemyIds: [project.database.enemies[0]!.id], battleEventPages: [] } as never);
        expect(resolveBattleBackdrop({ project, troopId: "troop_boss", location: { mapId: "map_lighthouse_top", x: 3, y: 3 } })).toBe("scarloxy-backdrop-ice");
      });

      it("the stock opening is recognised and replaced by the brief's own motive text", () => {
        const stock = defaultOpeningSequence("등대지기의 겨울");
        expect(isUntouchedDefaultOpening(stock, "등대지기의 겨울")).toBe(true);
        const motive = "눈보라가 그치지 않는 항구 마을에서, 등대지기 할아버지가 사라졌다.";
        const opened = briefOpeningSequence(stock, motive, "등대지기의 겨울");
        expect(opened.scenes.map(scene => scene.narration)).toEqual([motive, "— 등대지기의 겨울 —"]);
        expect(opened.scenes.every(scene => scene.kind === "text")).toBe(true);
        expect(isUntouchedDefaultOpening(opened, "등대지기의 겨울")).toBe(false);
      });

      // 2026-09-24 추리 도그푸딩: 회상 스토리의 첫 답(「내 말로 답하기」 기획 설명 400자)이 오프닝 첫 장면이 되어 범인을 누설했다.
      it("발단을 묻는 프리셋의 답만 오프닝에 옮기고, 나머지는 제목 카드만 둔다", () => {
        const answers = (text: string) => ({ experience: { question: "q", label: "l", text, source: "user" as const } });
        const pitch = "추리 게임이에요. 폭풍우 밤 저택에서 백작이 독살됩니다. 진범은 모로 박사예요.";
        expect(briefOpeningMotive({ presetId: "story-cutscene", answers: answers(pitch) })).toBe("");
        const stock = defaultOpeningSequence("안개 저택");
        const opened = briefOpeningSequence(stock, "", "안개 저택");
        expect(opened.scenes.map(scene => scene.narration)).toEqual(["— 안개 저택 —"]);
        expect(isUntouchedDefaultOpening(opened, "안개 저택")).toBe(false);
        // 발단 답은 앞 문장만, 90자 안에서.
        const long = "눈보라가 그치지 않는 항구 마을에서 겨울마다 불을 밝히던 등대지기 할아버지가 사라졌다. 손녀가 그 이유를 찾아 떠난다. 그리고 아주 긴 설명이 이어진다 — 동료·보스·엔딩까지 모두 정해 두었다.";
        const motive = briefOpeningMotive({ presetId: "adventure-jrpg", answers: answers(long) });
        expect(motive.length).toBeLessThanOrEqual(90);
        expect(motive.startsWith("눈보라가 그치지 않는")).toBe(true);
        expect(briefOpeningMotive({ presetId: "adventure-jrpg", answers: answers("짧은 발단.") })).toBe("짧은 발단.");
      });
    });
  });
  describe("openingMotivePlaceholder", () => {
    isolateTimers();
    // jrpg-real-1 J12: 씨앗 brief 의 자리표시 답이 오프닝 첫 글자로 떴다.
    const brief = (text: string) => ({ presetId: "adventure-jrpg", answers: { experience: { question: "q", label: "l", text, source: "user" } } }) as never;
    describe("briefOpeningMotive placeholder answers (J12)", () => {
      it.each(["(채팅에서 정함)", "채팅에서 정할게요", "미정", "TBD"])("drops %s", (text) => {
        expect(briefOpeningMotive(brief(text))).toBe("");
      });

      it("keeps a real motive", () => {
        expect(briefOpeningMotive(brief("잃어버린 누이를 찾으러 길을 나선다."))).toBe("잃어버린 누이를 찾으러 길을 나선다.");
      });
    });
  });
});

// test/defaults.test.ts
// 빈 프로젝트 무결성 검증 — v2 스키마(3레이어/Database/Map Tree).
describe("defaults", () => {
  isolateTimers();
  const STARTER_VILLAGE_SMALL_HOUSE_PATTERN = [
    [374, 375, 374, 375, 374],
    [404, 405, 404, 405, 404],
    [102, 103, 103, 103, 104],
    [132, 133, 329, 133, 134],
    [162, 163, 359, 163, 164],
  ] as const;
  // 옛 시작 마을(합본 마을 칩셋)의 주민 이벤트 id — 지금 createStarterMap 은 이들을 만들지 않는다.
  const RETIRED_STARTER_VILLAGE_NPC_IDS = ["event_starter_mina", "event_starter_rowen", "event_starter_sera"] as const;
  type PatternSubject = {
    readonly tiles: readonly number[];
    readonly mapWidth: number;
    readonly mapHeight: number;
  };
  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function tileSizesIn(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value.flatMap((entry) => tileSizesIn(entry));
    }
    if (!isRecord(value)) return [];
    return Object.entries(value).flatMap(([key, entry]) => {
      if (key === "tileSize" && typeof entry === "number") return [entry];
      return tileSizesIn(entry);
    });
  }
  describe("createBlankProject", () => {
    it("진짜 빈 프로젝트 shape를 만든다", () => {
      const p = createBlankProject();
      const maps = Object.values(p.maps);
      const startMap = p.maps[p.startMapId];

      expect(maps).toHaveLength(1);
      expect(startMap).toBeDefined();
      if (!startMap) throw new Error("missing blank start map");
      expect(startMap.name).toBe("빈 맵");
      expect(startMap.width).toBe(20);
      expect(startMap.height).toBe(15);
      expect(startMap.tilesetId).toBe(DEFAULT_TILESET_ID);
      expect(startMap.events).toHaveLength(0);
      expect(startMap.lowerTiles).toHaveLength(20 * 15);
      expect(startMap.upperTiles).toHaveLength(20 * 15);
      // 버들항의 민무늬 풀 칸(737). TILE.GRASS(240)는 합본 마을 번호라 버들항에서는 벽이다.
      expect(startMap.lowerTiles.every((tile) => tile === 737)).toBe(true);
      expect(startMap.upperTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
      expect(p.mapTree).toEqual({ mapId: p.startMapId, children: [] });
      expect(p.villageInfoDocuments).toEqual([]);
      expect(p.system.startActorIds).toEqual(["actor_hero"]);
      expect(p.session.partyActorIds).toEqual(["actor_hero"]);
    });

    it("스키마 버전 3을 가진다", () => {
      const p = createBlankProject();
      expect(p.version).toBe(SCHEMA_VERSION);
      expect(SCHEMA_VERSION).toBe(4);
    });

    it("startMapId가 maps에 존재한다", () => {
      const p = createBlankProject();
      expect(p.maps[p.startMapId]).toBeDefined();
    });

    it("startPos가 시작 맵 경계 안에 있다", () => {
      const p = createBlankProject();
      const m = p.maps[p.startMapId];
      expect(p.startPos.x).toBeGreaterThanOrEqual(0);
      expect(p.startPos.x).toBeLessThan(m.width);
      expect(p.startPos.y).toBeGreaterThanOrEqual(0);
      expect(p.startPos.y).toBeLessThan(m.height);
    });

    it("빈 프로젝트로 헤드리스 런타임 세션을 시작할 수 있다", () => {
      const p = createBlankProject();
      const session = startSession(p);

      expect(session.currentMapId).toBe(p.startMapId);
      expect(session.x).toBe(p.startPos.x);
      expect(session.y).toBe(p.startPos.y);
      expect(p.maps[session.currentMapId]).toBeDefined();
    });

    it("Database 구조가 있다(switches/variables/commonEvents/tilesets)", () => {
      const p = createBlankProject();
      expect(Array.isArray(p.switches)).toBe(true);
      expect(Array.isArray(p.variables)).toBe(true);
      expect(Array.isArray(p.commonEvents)).toBe(true);
      expect(p.tilesets[DEFAULT_TILESET_ID]).toBeDefined();
    });

    // Break caught: reintroducing the fixed 1,000-slot seed makes a new project
    // look capped and bloats every project/session beyond the first-use picker block.
    it("starts with one small picker block instead of 1000 preallocated slots", () => {
      const p = createBlankProject();

      // 번호 슬롯은 고르기 한 블록(20개)뿐이고, 그 밖의 스위치는 아이템이 켜는 스위치를 선언한 것뿐이다(#777 `ensureItemSwitchDefs` — 아이템마다 하나).
      // 전에는 총수 31(20 + 기동석 11)을 못박았는데, 기본 아이템의 스위치가 15개가 된 공개 기준선(0d4f13e7c)부터 35 라 떨어졌다 — 수가 아니라 구성을 본다.
      const numbered = p.switches.filter((entry) => /^sw_\d{4}$/u.test(entry.id));
      const named = p.switches.filter((entry) => !/^sw_\d{4}$/u.test(entry.id));
      const itemSwitchIds = [...new Set(p.database.items.flatMap((item) => (item.switchId ? [item.switchId] : [])))];
      expect(numbered).toHaveLength(20);
      expect(itemSwitchIds.length).toBeGreaterThan(0);
      expect(named.map((entry) => entry.id).sort()).toEqual([...itemSwitchIds].sort());
      expect(named.every((entry) => entry.name.length > 0)).toBe(true);
      expect(p.variables).toHaveLength(20);
      expect(p.switches[0]).toEqual({ id: "sw_0001", name: "" });
      expect(p.variables[0]).toEqual({ id: "var_0001", name: "" });
      expect(p.switches.some((entry) => entry.id === "sw_1000")).toBe(false);
      expect(p.variables.some((entry) => entry.id === "var_1000")).toBe(false);
      expect(p.session.switches.sw_0020).toBe(false);
      expect(p.session.variables.var_0020).toBe(0);
    });

    // Break caught: removing fixed-slot allocation must not discard legacy/authored
    // start-state ids that still need editable definitions.
    it("keeps start-state switch and variable ids without filling artificial blank slots", () => {
      const p = createBlankProject();
      p.switches = [];
      p.variables = [];
      p.session.switches = { sw_legacy_gate: true };
      p.session.variables = { var_legacy_score: 5 };

      const changed = ensureSwitchVariableSlots(p);

      expect(changed).toBe(true);
      // 아이템이 있는 한 기동석 스위치도 함께 선언된다 — 여기서 보는 것은 "인공적인 빈
      // 슬롯(sw_NNNN)이 끼어들지 않는가" 이므로 그 축만 본다.
      expect(p.switches.filter((entry) => entry.id === "sw_legacy_gate")).toHaveLength(1);
      expect(p.switches.filter((entry) => /^sw_\d{4}$/u.test(entry.id))).toEqual([]);
      expect(p.variables).toEqual([{ id: "var_legacy_score", name: "" }]);
      expect(p.session.switches.sw_legacy_gate).toBe(true);
      // 아이템 기동석 세션 값은 함께 실린다 — 인공적인 빈 숫자 슬롯만 없으면 된다.
      expect(Object.keys(p.session.switches).filter((id) => /^sw_\d{4}$/u.test(id))).toEqual([]);
      expect(p.session.variables).toEqual({ var_legacy_score: 5 });
    });

    it("uses Beodeul City as the project-wide default chipset; the retired Combined Town sheet is no longer bundled", () => {
      const p = createBlankProject();
      const defaultTileset = p.tilesets[DEFAULT_TILESET_ID];
      const chipsetProfiles = p.resourceProfiles.filter((profile) => profile.kind === "chipset");

      expect(DEFAULT_TILESET_ID).toBe("beodeul_city");
      // 합본 마을 시트는 2026-10-07 저작권 정리로 번들에서 빠졌다 — 새 프로젝트에는 없고, 옛 저장본이 든 정의만 편집기가 계속 읽는다(retiredEasyRpgTilesets).
      expect(p.tilesets[COMBINED_TOWN_TILESET_ID]).toBeUndefined();
      expect(defaultTileset?.name).toBe(DEFAULT_TILESET_NAME);
      expect(defaultTileset?.image).toEqual({ type: "bundled", id: DEFAULT_TILESET_TEXTURE_KEY });
      expect(p.maps[p.startMapId].tilesetId).toBe(DEFAULT_TILESET_ID);
      expect(chipsetProfiles[0]?.assetId).toBe(DEFAULT_TILESET_TEXTURE_KEY);
      expect(chipsetProfiles.filter((profile) => profile.assetId === DEFAULT_TILESET_TEXTURE_KEY)).toHaveLength(1);
      expect(chipsetProfiles.some((profile) => profile.assetId === LEGACY_RM_TILESET_TEXTURE_KEY)).toBe(false);
      expect(p.tilesets[LEGACY_RM_TILESET_ID]).toBeUndefined();
    });

    it("removes legacy RM sample tilesets and rewires old maps to bundled EasyRPG chipsets", () => {
      const p = createBlankProject();
      p.tilesets[LEGACY_RM_TILESET_ID] = {
        ...p.tilesets[DEFAULT_TILESET_ID],
        id: LEGACY_RM_TILESET_ID,
        name: "기본 타일셋",
        image: { type: "bundled", id: LEGACY_RM_TILESET_TEXTURE_KEY },
      };
      p.maps.map_town = { ...p.maps[p.startMapId], id: "map_town", name: "샘플 마을", tilesetId: LEGACY_RM_TILESET_ID };
      p.maps.map_dungeon = { ...p.maps[p.startMapId], id: "map_dungeon", name: "샘플 던전", tilesetId: LEGACY_RM_TILESET_ID };
      p.maps.map_interior = { ...p.maps[p.startMapId], id: "map_interior", name: "샘플 실내", tilesetId: LEGACY_RM_TILESET_ID };

      expect(removeLegacyRmTileset(p)).toBe(true);

      expect(p.tilesets[LEGACY_RM_TILESET_ID]).toBeUndefined();
      expect(p.maps.map_town.tilesetId).toBe(COMBINED_TOWN_TILESET_ID);
      expect(p.maps.map_dungeon.tilesetId).toBe("easyrpg_chipset_dungeon");
      expect(p.maps.map_interior.tilesetId).toBe("easyrpg_chipset_interior");
    });

    it("removes the legacy RM sample chipset resource profile", () => {
      const p = createBlankProject();
      p.resourceProfiles.push({
        kind: "chipset",
        name: "기본 타일셋",
        tileWidth: 16,
        tileHeight: 16,
        imageWidth: 480,
        imageHeight: 256,
        assetId: LEGACY_RM_TILESET_TEXTURE_KEY,
      });

      expect(ensureBundledResourceProfiles(p)).toBe(true);

      expect(p.resourceProfiles.some((profile) => profile.assetId === LEGACY_RM_TILESET_TEXTURE_KEY)).toBe(false);
    });

    it("ensureBundledResourceProfiles 가 저장본의 생성 얼굴 프로필을 걷어낸다", () => {
      const p = createBlankProject();
      // 예전 저장본처럼 생성 시리즈 낱장 프로필이 남아 있는 상태를 만든다. 지금 생성 시리즈로 등록된 낱장(GENERATED_FACESET_FACE_IDS)의 하나를 쓴다 —
      // 전에 쓰던 generated-actor-hero-01-face-01 은 그 그림과 함께 목록에서 빠져(공개 기준선부터) 걷어낼 대상으로 알아보지 못했다.
      const generatedFaceId = [...GENERATED_FACESET_FACE_IDS][0]!;
      expect(p.resourceProfiles.some((profile) => profile.assetId === generatedFaceId)).toBe(false);
      p.resourceProfiles.push({
        kind: "faceset",
        name: "빈 칸 · 생성",
        assetId: generatedFaceId,
        imageWidth: 48,
        imageHeight: 48,
      });

      expect(ensureBundledResourceProfiles(p)).toBe(true);

      expect(p.resourceProfiles.some((profile) => profile.assetId === generatedFaceId)).toBe(false);
      // 저작 목록에 다시 끼어들지도 않아야 한다.
      expect(p.resourceProfiles.some((profile) => profile.kind === "faceset" && GENERATED_FACESET_FACE_IDS.has(profile.assetId ?? ""))).toBe(false);
    });

    it("Map Tree가 있고 루트가 startMapId", () => {
      const p = createBlankProject();
      expect(p.mapTree.mapId).toBe(p.startMapId);
      expect(Array.isArray(p.mapTree.children)).toBe(true);
    });

    it("does not ship a legacy default NPC sprite in assets.sprites", () => {
      const p = createBlankProject();
      expect(p.assets.sprites.hero).toBeUndefined();
      expect(p.assets.sprites).toEqual({});
      expect(p.assets.uploaded).toBeDefined();
    });

    it("keeps removed legacy character tokens out of the default project export", () => {
      const p = createBlankProject();
      const exported = serialize(p);
      const forbiddenTokens = [
        ["npc", "villager"].join("_"),
        ["tex", "npc", "villager"].join("_"),
        ["DEFAULT", "SPRITE", "NPC"].join("_"),
        ["TEX", "NPC"].join("_"),
      ];
      const charsetProfiles = p.resourceProfiles.filter((profile) => profile.kind === "charset");

      for (const token of forbiddenTokens) {
        expect(exported.includes(token)).toBe(false);
      }
      expect(DEFAULT_EASYRPG_CHARSET_ID).toBe("tex_easyrpg_charset_people1");
      expect(charsetProfiles.some((profile) => profile.assetId === DEFAULT_EASYRPG_CHARSET_ID)).toBe(true);
    });

    it("meta.terms가 있다", () => {
      const p = createBlankProject();
      expect(typeof p.meta.terms.gold).toBe("string");
    });

    it("uses RM2K3 16x16 tiles for runtime, defaults, export, and sample fixtures", () => {
      const p = createBlankProject();
      const exported = JSON.parse(serialize(p));

      expect(DEFAULT_TILE_SIZE).toBe(16);
      expect(RUNTIME_TILE_SIZE).toBe(16);
      expect(PREVIEW_TILE_SIZE).toBe(16);
      expect(p.tilesets[DEFAULT_TILESET_ID].tileSize).toBe(16);
      expect(p.maps[p.startMapId].tileSize).toBe(16);
      // 지도 기호 시트(atlas_cartography)만 32px 칸이다 — 월드맵에 얹는 기호 그림 시트라 맵이 깔리는 칩셋이 아니다(공개 기준선부터 새 프로젝트에 실린다).
      // 그 밖의 모든 타일셋·맵·킷은 16px 이다.
      const { [ATLAS_CARTOGRAPHY_ID]: cartography, ...mapTilesets } = exported.tilesets as Record<string, unknown>;
      expect(new Set(tileSizesIn(cartography))).toEqual(new Set([32]));
      expect(Object.keys(mapTilesets).length).toBeGreaterThan(0);
      expect(tileSizesIn({ ...exported, tilesets: mapTilesets }).every((tileSize) => tileSize === 16)).toBe(true);
      expect(tileSizesIn(sampleProject).every((tileSize) => tileSize === 16)).toBe(true);
    });

    it("maps bundled chipset terrain, priority, and passability by atlas index", () => {
      // TILE.* 는 합본 마을 시트의 칸 번호다 — 기본 타일셋(버들항)이 아니라 합본 마을로 확인한다.
      // 그 시트는 새 프로젝트에 없다(2026-10-07 정리) — 옛 저장본이 든 정의(편집기가 계속 읽는 것)로 본다.
      const tileset = retiredEasyRpgTileset(COMBINED_TOWN_TILESET_ID);
      const passable = { up: true, down: true, left: true, right: true };
      const solid = { up: false, down: false, left: false, right: false };

      expect(tileset.terrain[TILE.WATER]).toBe(TERRAIN_TAG.WATER);
      expect(tileset.terrain[TILE.PATH]).toBe(TERRAIN_TAG.NORMAL);
      expect(tileset.passability[TILE.WATER]).toEqual(solid);
      expect(tileset.passability[TILE.PATH]).toEqual(passable);
      // Tree bases occupy lower; the renderer composites ground beneath their transparency.
      // Canopies and other transparent props remain upper-layer tiles.
      expect(tileset.priority[TILE.TREE]).toBe("lower");
      expect(tileset.passability[TILE.TREE]).toEqual(solid);
      expect(tileset.priority[TILE.FLOWERS]).toBe("upper");
      expect(tileset.passability[TILE.FLOWERS]).toEqual(passable);
      expect(tileset.priority[85]).toBe("upper");
      expect(tileset.priority[378]).toBe("upper");
      expect(tileset.priority[374]).toBe("lower");
      const passableRoofTiles = [374, 375, 376, 377, 384, 385, 386, 387, 404, 405, 406, 407, 436, 437].filter((tile) => !(
        tileset.passability[tile]?.up === false &&
        tileset.passability[tile]?.down === false &&
        tileset.passability[tile]?.left === false &&
        tileset.passability[tile]?.right === false
      ));
      expect(passableRoofTiles).toEqual([]);
      expect(tileLabelForIndex(TILE.PATH)).toBe("Dirt road");
    });

    it("describes one chipset cell as the smallest mapping unit", () => {
      expect(describeChipsetTile(TILE.PATH)).toMatchObject({
        index: TILE.PATH,
        column: 0,
        row: 12,
        label: "Dirt road",
        layer: "lower",
        passage: "passable",
        terrainTag: TERRAIN_TAG.NORMAL,
        repeatRole: "body",
        confirmed: true,
      });
      expect(describeChipsetTile(TILE.TREE)).toMatchObject({
        label: "Tree",
        layer: "upper",
        passage: "solid",
        repeatRole: "object",
        confirmed: true,
      });
      expect(describeChipsetTile(390)).toMatchObject({
        label: "Dirt corner",
        repeatRole: "edge",
        confirmed: true,
      });
    });

  });
  describe("createBlankMap", () => {
    it("lowerTiles/upperTiles 길이 = width*height", () => {
      const m = createBlankMap("테스트", 5, 4);
      expect(m.lowerTiles.length).toBe(20);
      expect(m.upperTiles.length).toBe(20);
    });

    it("기본 lower는 전부 잔디, upper는 전부 빈 칸", () => {
      const m = createBlankMap("테스트", 3, 3);
      expect(m.lowerTiles.every((t: number) => t === 737)).toBe(true);
      // 다른 칩셋의 빈 맵은 그 칩셋의 맨 풀로 채운다 — 번들에 없는 칩셋(옛 저장본의 합본 마을)은 그 정의를 넘겨야 바닥을 고른다.
      const town = createBlankMap("테스트", 3, 3, COMBINED_TOWN_TILESET_ID, DEFAULT_TILE_SIZE, retiredEasyRpgTileset(COMBINED_TOWN_TILESET_ID));
      expect(town.lowerTiles.every((t: number) => t === TILE.GRASS)).toBe(true);
      expect(town.upperTiles.every((t: number) => t === TILE.EMPTY)).toBe(true);
      expect(m.upperTiles.every((t: number) => t === TILE.EMPTY)).toBe(true);
    });

    it("tilesetId가 기본 타일셋", () => {
      const m = createBlankMap("테스트", 3, 3);
      expect(m.tilesetId).toBe(DEFAULT_TILESET_ID);
    });
  });
  describe("createStarterMap", () => {
    // createStarterMap() 은 기본 칩셋이 버들항이 된 뒤(2026-09-30)로 빈 30×30 맵이다. 집 세 채·흙길·주민 셋이 있던 합본 마을은 여기서 더 짓지 않는다 —
    // 시작 마을은 editor/content/beodeulStarterMap.ts 가 짓고(beodeulStarterMap.test.ts), 빈 맵의 바닥·가장자리는 starterVillage.test.ts 가 본다.
    // 전에는 이 묶음의 세 경우(집 무늬 374… 세 채와 이어진 길 · 흙길 칸 · 주민 이벤트 셋)가 그 옛 마을을 찾았고 공개 기준선(0d4f13e7c)부터 떨어졌다.
    // 세 경우가 보던 것이 모두 없어져 한 경우로 모은다: 크기·이름은 그대로이고, 옛 마을의 집·길·주민이 이 맵에 없다.
    it("builds the default 마을 as a blank 30x30 map: no combined-town houses, dirt roads or starter NPCs are authored here", () => {
      const m = createStarterMap();

      expect(m.name).toBe("마을");
      expect(m.width).toBe(30);
      expect(m.height).toBe(30);
      expect(m.tilesetId).toBe(DEFAULT_TILESET_ID);
      expect(m.lowerTiles.length).toBe(30 * 30);
      expect(m.upperTiles.length).toBe(30 * 30);
      expect(countPatternOccurrences({ tiles: m.lowerTiles, mapWidth: m.width, mapHeight: m.height }, STARTER_VILLAGE_SMALL_HOUSE_PATTERN)).toBe(0);
      const roadTiles = new Set<number>(dirtLikeTiles());
      expect(roadTiles.has(TILE.PATH)).toBe(true);
      expect(m.lowerTiles.filter((tile) => roadTiles.has(tile))).toEqual([]);
      expect(m.events.filter((event) => (RETIRED_STARTER_VILLAGE_NPC_IDS as readonly string[]).includes(event.id))).toEqual([]);
      expect(m.events).toEqual([]);
    });

    it("keeps the compact village boundary open grass (no wall frame)", () => {
      const m = createStarterMap();
      for (let x = 0; x < m.width; x++) {
        expect(m.lowerTiles[0 * m.width + x]).not.toBe(TILE.WALL);
        expect(m.lowerTiles[(m.height - 1) * m.width + x]).not.toBe(TILE.WALL);
      }
      for (let y = 0; y < m.height; y++) {
        expect(m.lowerTiles[y * m.width + 0]).not.toBe(TILE.WALL);
        expect(m.lowerTiles[y * m.width + (m.width - 1)]).not.toBe(TILE.WALL);
      }
    });
  });
  function countPatternOccurrences(
    subject: PatternSubject,
    pattern: readonly (readonly number[])[]
  ): number {
    let count = 0;
    const patternHeight = pattern.length;
    const patternWidth = pattern[0]?.length ?? 0;
    for (let y = 0; y <= subject.mapHeight - patternHeight; y += 1) {
      for (let x = 0; x <= subject.mapWidth - patternWidth; x += 1) {
        if (matchesPatternAt(subject, pattern, { x, y })) count += 1;
      }
    }
    return count;
  }
  function matchesPatternAt(
    subject: PatternSubject,
    pattern: readonly (readonly number[])[],
    origin: { readonly x: number; readonly y: number }
  ): boolean {
    for (let y = 0; y < pattern.length; y += 1) {
      const row = pattern[y];
      if (!row) return false;
      for (let x = 0; x < row.length; x += 1) {
        const tile = row[x];
        if (tile !== undefined && tile >= 0 && subject.tiles[(origin.y + y) * subject.mapWidth + origin.x + x] !== tile) return false;
      }
    }
    return true;
  }
});

describe("dungeonTerrainAutotiles", () => {
  isolateTimers();
  describe("dungeon terrain autotiles (RM2k3 blocks ×12 + 카펫)", () => {
    it("블랭크 프로젝트의 던전 타일셋에 지형 그룹 13종이 시드된다 (재적용은 idempotent)", () => {
      const dungeon = withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_dungeon;
      const ids = (dungeon.autotileGroups ?? []).map((group) => group.id);
      for (const key of [
        "stone", "chasm", "redrock", "lava", "pit-pale", "pit-gold",
        "snow", "ice", "dirt", "moss", "abyss-blue", "abyss-gray", "red-carpet",
      ]) {
        expect(ids).toContain(`${DUNGEON_TERRAIN_AUTOTILE_PREFIX}${key}`);
      }
      expect(applyEasyRpgThemeMetadataPacks(dungeon)).toBe(false);
    });

    it("용암: 몸통 304 blob이 변/모서리로 성형되고 1칸은 고립 243, 구멍 주변은 오목 245", () => {
      const group = createDungeonTerrainAutotileGroups().find((g) => g.id.endsWith("lava"))!;
      const W = 9;
      const H = 9;
      const BODY = 304;
      const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(271) };
      const points: { x: number; y: number }[] = [];
      // 4×4 blob + 외딴 1칸
      for (let y = 2; y <= 5; y += 1) {
        for (let x = 2; x <= 5; x += 1) {
          map.lowerTiles[y * W + x] = BODY;
          points.push({ x, y });
        }
      }
      map.lowerTiles[1 * W + 7] = BODY;
      points.push({ x: 7, y: 1 });
      // 구멍(오목 코너 유발)
      map.lowerTiles[3 * W + 3] = 271;
      shapeAutotileGroupAround(map, group, points);

      const at = (x: number, y: number) => map.lowerTiles[y * W + x];
      expect(at(2, 2)).toBe(273); //   NW 코너
      expect(at(5, 2)).toBe(275); //   NE 코너
      expect(at(2, 5)).toBe(333); //   SW 코너
      expect(at(5, 5)).toBe(335); //   SE 코너
      expect(at(4, 2)).toBe(274); //   북 변
      expect(at(2, 4)).toBe(303); //   서 변
      expect(at(4, 4)).toBe(245); //   구멍 대각 → 오목 코너 소스
      expect(at(7, 1)).toBe(243); //   고립 1칸
      // 바탕 칸(적암 244)은 멤버가 아니다
      expect(group.memberTileIds).not.toContain(244);
    });

    it("붉은 카펫(9-슬라이스): 고립/오목은 몸통 169로 폴백, 3×3 성형은 정상", () => {
      const group = createDungeonTerrainAutotileGroups().find((g) => g.id.endsWith("red-carpet"))!;
      const W = 7;
      const H = 7;
      const BODY = 169;
      const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(157) };
      const points: { x: number; y: number }[] = [];
      for (let y = 2; y <= 4; y += 1) {
        for (let x = 2; x <= 4; x += 1) {
          map.lowerTiles[y * W + x] = BODY;
          points.push({ x, y });
        }
      }
      map.lowerTiles[1 * W + 6] = BODY; // 외딴 1칸 → 몸통 169 유지
      points.push({ x: 6, y: 1 });
      shapeAutotileGroupAround(map, group, points);
      const at = (x: number, y: number) => map.lowerTiles[y * W + x];
      expect(at(2, 2)).toBe(138); // NW
      expect(at(3, 2)).toBe(139); // N
      expect(at(4, 4)).toBe(200); // SE
      expect(at(3, 3)).toBe(169); // 몸통
      expect(at(6, 1)).toBe(169); // 고립 = 몸통 폴백
      // 계단(228~230)은 카펫 그룹 멤버가 아니다
      expect(group.memberTileIds).not.toContain(228);
      expect(group.memberTileIds).not.toContain(229);
      expect(group.memberTileIds).not.toContain(230);
    });

    it("호스트 지형은 오버레이 블록을 연결로 본다 (흙→이끼: 이끼 옆 흙은 몸통 유지)", () => {
      const groups = createDungeonTerrainAutotileGroups();
      const dirt = groups.find((g) => g.id.endsWith("-dirt"))!;
      const moss = groups.find((g) => g.id.endsWith("-moss"))!;
      // 이끼 바탕 아트 = 흙이므로 전환 테두리는 이끼 쪽이 그린다 — 흙은 이끼를 연결로 취급.
      for (const tile of moss.memberTileIds) expect(dirt.connectTileIds).toContain(tile);
      expect(moss.connectTileIds).not.toContain(421); // 역방향은 아니다(이끼는 흙 옆에서 테두리를 그린다)

      // 흙밭 한가운데 이끼를 얹고 흙을 재성형해도 이끼 인접 흙은 몸통(421)을 유지한다.
      const W = 7;
      const H = 7;
      const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(421) };
      map.lowerTiles[3 * W + 3] = 424; // 중앙 이끼 몸통
      const points: { x: number; y: number }[] = [];
      for (let y = 1; y <= 5; y += 1) for (let x = 1; x <= 5; x += 1) points.push({ x, y });
      shapeAutotileGroupAround(map, dirt, points);
      expect(map.lowerTiles[3 * W + 2]).toBe(421);
      expect(map.lowerTiles[2 * W + 3]).toBe(421);
      expect(map.lowerTiles[2 * W + 2]).toBe(421);
    });

    it("심연(푸른 테두리): 몸통 427 blob의 변/모서리 성형", () => {
      const group = createDungeonTerrainAutotileGroups().find((g) => g.id.endsWith("abyss-blue"))!;
      const W = 7;
      const H = 7;
      const BODY = 427;
      const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(157) };
      const points: { x: number; y: number }[] = [];
      for (let y = 2; y <= 4; y += 1) {
        for (let x = 2; x <= 4; x += 1) {
          map.lowerTiles[y * W + x] = BODY;
          points.push({ x, y });
        }
      }
      shapeAutotileGroupAround(map, group, points);
      const at = (x: number, y: number) => map.lowerTiles[y * W + x];
      expect(at(2, 2)).toBe(396); // NW
      expect(at(3, 2)).toBe(397); // N
      expect(at(4, 2)).toBe(398); // NE
      expect(at(3, 3)).toBe(427); // 몸통
      expect(at(3, 4)).toBe(457); // 남 변
    });

    it("던전 하네스 그룹은 타일 중복 없이 시드된다 (재적용 idempotency 전제)", () => {
      const dungeon = withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_dungeon;
      const seen = new Map<number, string>();
      for (const group of dungeon.tileGroups ?? []) {
        for (const tile of group.tileIds) {
          expect(seen.has(tile), `tile ${tile} in ${seen.get(tile)} and ${group.id}`).toBe(false);
          seen.set(tile, group.id);
        }
      }
      // 물(1)은 통행 불가, 적암 바닥(270)은 통행 가능 계약
      expect(dungeon.passability[1]).toEqual({ up: false, down: false, left: false, right: false });
      expect(dungeon.passability[270]).toEqual({ up: true, down: true, left: true, right: true });
      // 투명 배경 소품은 상위 레이어
      expect(dungeon.priority[262]).toBe("upper");
      expect(dungeon.priority[327]).toBe("upper");
    });
  });
});

/**
 * 숲 나무 확장 띠(forest-trees:*) 물체를 place_props 로 놓으면 물체 모양 그대로 찍혀야 한다.
 *
 * 2026-09-27 「작은 숲속에 오두막 하나」 실측: 그룹의 sourceRect 는 픽셀 단위(숲 벽 160×96)인데 발자국
 * 계산이 칸 단위로 읽어 실패했고, 표본 빌더가 타일 앞 6개를 가로 한 줄로 늘어놓았다. 그래서 큰 참나무·활엽수는
 * 수관 조각 한 줄, 숲 벽은 밑동 한 줄이 되어 맵에 잎 없는 줄기만 남았다.
 */
describe("forestTreeObjectPlacement", () => {
  isolateTimers();
  const MAP_ID = "map_blank_start";
  /**
   * 숲 나무 확장 띠 그룹(forest-trees:*)을 지닌 혼합 칩셋(합본 마을+레트로 월드맵+숲 나무 띠).
   * 이 그룹을 들고 있던 숲마을(forest_harmony)·합본 마을 칩셋은 2026-10-07 저작권 정리로 새 프로젝트에서 빠졌다.
   * 옛 저장본이 들고 있는 정의를 되살려 조립기(composeCombinedTownRetroWorldTileset)로 같은 그룹을 다시 만든다.
   */
  function forestTreesTileset(): TilesetDef {
    return composeCombinedTownRetroWorldTileset(
      retiredEasyRpgTileset("easyrpg_chipset_combined_town"),
      retiredEasyRpgTileset("easyrpg_chipset_retro_world"),
    );
  }
  function project(width = 40, height = 20): { project: Project } {
    const ctx = { project: createBlankProject() };
    const tileset = forestTreesTileset();
    ctx.project.tilesets[tileset.id] = tileset;
    const start = ctx.project.maps[MAP_ID]!;
    start.tilesetId = tileset.id;
    start.lowerTiles.fill(TILE.GRASS);
    start.upperTiles.fill(TILE.EMPTY);
    expect(runTool(ctx, "resize_map", { mapId: MAP_ID, width, height }).ok).toBe(true);
    return ctx;
  }
  function forestTreesGroups(project: Project) {
    return Object.values(project.tilesets).find((tileset) => tileset.tileGroups?.some((group) => group.id.startsWith("forest-trees:")))!.tileGroups!;
  }
  function bounds(cells: readonly number[], width: number) {
    const xs = cells.map((index) => index % width), ys = cells.map((index) => Math.floor(index / width));
    return { w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
  }
  describe("forest-trees 물체 place_props", () => {
    it.each([
      ["숲 나무 · 큰 참나무", "forest-trees:big-oak"],
      ["숲 나무 · 활엽수", "forest-trees:tree"],
    ])("%s 는 previewMap 모양대로 수관(상위)과 밑동(하위)을 함께 찍는다", (material, groupId) => {
      const ctx = project();
      const group = forestTreesGroups(ctx.project).find((g) => g.id === groupId)!;
      const preview = group.previewMap!;
      const canopy = new Set(preview.upperTiles.filter((tile) => tile >= 0));
      const trunk = new Set(preview.lowerTiles.filter((tile) => group.tileIds.includes(tile)));
      const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 0, y: 0, w: 40, h: 20 }, material, count: 1, seed: 3 });
      expect(result.ok).toBe(true);
      const map = ctx.project.maps[MAP_ID]!;
      const upperCells = map.upperTiles.flatMap((tile, index) => (canopy.has(tile) ? [index] : []));
      const lowerCells = map.lowerTiles.flatMap((tile, index) => (trunk.has(tile) ? [index] : []));
      // 옛 버그: 수관 조각 6칸이 가로 1줄. 이제 수관 칸 수와 높이가 원본과 같다.
      expect(upperCells).toHaveLength(canopy.size);
      expect(lowerCells).toHaveLength(trunk.size);
      expect(bounds([...upperCells, ...lowerCells], map.width)).toEqual({ w: preview.width, h: preview.height });
    });

    // 「숲 벽·숲 기둥 낱개 거절 → density 안내」·「숲 벽 + density → 굽이숲 수관」 두 사례는 은퇴: 굽이숲 수관(forestGrove)은
    // 숲마을(forest_harmony) 칩셋 전용 경로로 2026-10-07 저작권 정리 때 칩셋과 함께 지웠다(wildRouteTool.ts 주석).
  });
});
