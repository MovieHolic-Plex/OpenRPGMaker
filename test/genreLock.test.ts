import { describe, expect, it, beforeEach } from "vitest";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { AUTHORABLE_FACESET_FACE_ASSETS } from "@/assets/facesetFaceAssets";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { reconcileFaceWithCharset, reviewedCharsetFaceRow, reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { defaultActorFaceResourceId } from "@/project/actorFaceDefaults";
import { createBlankProject, DEFAULT_TILESET_ID } from "@/project/defaults";
import { repairFaceMatches } from "@/project/faceMatchRepair";
import { deserialize, serialize } from "@/project/io";
import type { Command, GameEvent } from "@/project/types";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { applyGenrePreset } from "@/project/genrePresets";
import { disableGenreLock, enableGenreLock, genreLockReport, genreLockViolations } from "@/project/genreLock";
import { isolateTimers } from "./mergedTeardown";

// 얼굴 짝 전수 조사(2026-09-28) 회귀. 얼굴이 틀어지던 네 경로를 실제 도구·로더로 고정한다:
// 조수가 직접 넘긴 얼굴 · 기본값(파티·배우 기본 얼굴·시작 마을) · 억지 근사 칸 · 저장본 교정.
describe("faceMatchAudit", () => {
  isolateTimers();
  const OLD_MAN = { textureKey: "tex_easyrpg_charset_people1", characterIndex: 6 } as const;   // 짝: people1-06
  const SLIME_FACE = "easyrpg-faceset-monster-00";
  const CUSTOM_FACE = "shared-brown-headband-expressions-01";
  function faces(event: GameEvent | undefined): string[] {
    return (event?.pages ?? []).flatMap((page) => page.commands).filter((c): c is Extract<Command, { kind: "changeFace" }> => c.kind === "changeFace").map((c) => c.resourceId);
  }
  function run(ctx: ToolContext, tool: string, args: Record<string, unknown>) {
    const result = runTool(ctx, tool, args);
    expect(result.ok, result.summary).toBe(true);
    return result;
  }
  /** 쓰기 도구의 경고는 runner 가 diff.warnings 로 옮긴다. */
  function warningsOf(result: ReturnType<typeof run>): string {
    return [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])].join(" ");
  }
  describe("조수가 직접 넘긴 얼굴은 걷기 그림의 짝으로 교정된다", () => {
    it.each([
      ["place_npc face", "place_npc", { x: 2, y: 2, face: { resourceId: SLIME_FACE }, pages: [{ lines: ["안녕"] }] }],
      ["place_npc page.face", "place_npc", { x: 3, y: 2, pages: [{ lines: ["안녕"], face: { resourceId: SLIME_FACE } }] }],
      ["make_villager face", "make_villager", { home: { x: 4, y: 2 }, face: { resourceId: SLIME_FACE }, dialogue: [{ text: "안녕" }] }],
    ])("%s", (_label, tool, extra) => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = run(ctx, tool, { mapId: ctx.project.startMapId, name: "노인", graphic: OLD_MAN, ...extra });
      const event = ctx.project.maps[ctx.project.startMapId]!.events.find((e) => e.id === (result.data as { eventId: string }).eventId);
      expect(faces(event)).toEqual(["easyrpg-faceset-people1-06"]);
      expect(warningsOf(result)).toContain("짝 얼굴 easyrpg-faceset-people1-06");
    });

    it("얼굴 없음 그림에는 넘긴 번들 얼굴을 붙이지 않는다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      // Object1 #6 보물 상자 — 얼굴이 없는 게 맞는 그림.
      const result = run(ctx, "place_npc", { mapId: ctx.project.startMapId, name: "말하는 상자", x: 2, y: 2,
        graphic: { textureKey: "tex_easyrpg_charset_object1", characterIndex: 6 }, face: { resourceId: "easyrpg-faceset-people2-06" }, pages: [{ lines: ["덜컹"] }] });
      const event = ctx.project.maps[ctx.project.startMapId]!.events.find((e) => e.id === (result.data as { eventId: string }).eventId);
      expect(faces(event)).toEqual([]);
      expect(warningsOf(result)).toContain("맞는 얼굴이 없어");
    });

    it("업로드·생성 얼굴처럼 대응표 밖 얼굴은 작가 선택으로 둔다", () => {
      expect(reconcileFaceWithCharset(CUSTOM_FACE, OLD_MAN.textureKey, OLD_MAN.characterIndex)).toEqual({ faceResourceId: CUSTOM_FACE });
    });

    it("컷신 say.face 는 화자가 이 맵 NPC 면 그 걷기 그림의 짝으로 바뀐다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      run(ctx, "place_npc", { mapId, name: "노인", id: "ev_old", x: 2, y: 2, graphic: OLD_MAN, pages: [{ lines: ["안녕"] }] });
      const result = run(ctx, "script_cutscene", { mapId, x: 6, y: 2, beats: [
        { kind: "say", speaker: "노인", face: { resourceId: SLIME_FACE }, text: "옛날 이야기다." },
        { kind: "say", speaker: "나레이션", face: { resourceId: SLIME_FACE }, text: "맵 밖 화자는 건드리지 않는다." },
      ] });
      const event = ctx.project.maps[mapId]!.events.find((e) => e.id === (result.data as { eventId: string }).eventId);
      expect(faces(event)).toEqual(["easyrpg-faceset-people1-06", SLIME_FACE]);
    });

    it("upsert_actor 는 넘긴 얼굴과 그림만 바꾼 경우 모두 짝을 따른다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      run(ctx, "upsert_actor", { actor: { id: "actor_hero", characterResourceId: "easyrpg-charset-actor2", characterIndex: 0, faceResourceId: SLIME_FACE } });
      expect(ctx.project.database.actors.find((a) => a.id === "actor_hero")?.faceResourceId).toBe("easyrpg-faceset-actor1-08");
      run(ctx, "upsert_actor", { actor: { id: "actor_hero", characterResourceId: "easyrpg-charset-actor3", characterIndex: 1 } });
      expect(ctx.project.database.actors.find((a) => a.id === "actor_hero")?.faceResourceId).toBe("easyrpg-faceset-actor2-01");
    });

    it("list_resources 가 faceset 을 라벨과 짝 걷기 그림으로 찾는다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = run(ctx, "list_resources", { kind: "faceset", query: "흰 수염" });
      const matches = (result.data as { matches: { id: string; description?: string }[] }).matches;
      const oldMan = matches.find((m) => m.id === "easyrpg-faceset-people1-06");
      expect(oldMan?.description).toContain("tex_easyrpg_charset_people1#6");
      const npc = run(ctx, "list_npc_graphics", { query: "할머니" });
      const first = (npc.data as { matches: { textureKey: string; characterIndex: number; face: { resourceId: string } | null }[] }).matches[0]!;
      expect(first.face?.resourceId ?? null).toBe(reviewedFaceIdForCharset(first.textureKey, first.characterIndex) ?? null);
    });
  });
  describe("기본값은 걷기 그림의 짝이다", () => {
    it("새 프로젝트의 배우 전원과 시작 마을 NPC", () => {
      const project = createBlankProject();
      for (const actor of project.database.actors) {
        if (!actor.characterResourceId || !actor.faceResourceId) continue;
        expect(actor.faceResourceId, actor.id).toBe(reviewedFaceIdForCharset(actor.characterResourceId, actor.characterIndex ?? 0));
      }
      for (const event of Object.values(project.maps).flatMap((map) => map.events)) {
        const page = event.pages?.[0];
        const face = faces(event)[0];
        if (!face || !page?.graphic.sprite?.id) continue;
        const index = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => charsetFrameIndex({ characterIndex: i, direction: "down", pattern: 1 }) === page.graphic.pattern) ?? 0;
        expect(face, event.id).toBe(reviewedFaceIdForCharset(page.graphic.sprite.id, index));
      }
    });

    it("배우 기본 얼굴은 이름이 같은 시트가 아니라 짝을 쓴다", () => {
      expect(defaultActorFaceResourceId({ id: "x", characterResourceId: "easyrpg-charset-actor2" })).toBe("easyrpg-faceset-actor1-08");
      expect(defaultActorFaceResourceId({ id: "x", characterResourceId: "easyrpg-charset-actor4", characterIndex: 3 })).toBe("easyrpg-faceset-actor2-11");
      expect(defaultActorFaceResourceId({ id: "x", characterResourceId: "easyrpg-charset-people4", characterIndex: 5 })).toBe("generated-faceset-missing-people-05");
      expect(defaultActorFaceResourceId({ id: "x", characterResourceId: "easyrpg-charset-vehicles", characterIndex: 1 })).toBeUndefined();
    });
  });
  describe("원본에 얼굴이 없던 인물은 생성 짝 얼굴을 쓴다", () => {
    // 억지 근사 7칸 + 원래 얼굴 없음이던 사람·몬스터·Scarloxy 18칸. 생성 얼굴은 파일이 있어야 한다.
    it.each([
      ["tex_easyrpg_charset_people4", 1, "generated-faceset-missing-people-01"],
      ["tex_easyrpg_charset_people4", 5, "generated-faceset-missing-people-05"],
      ["tex_easyrpg_charset_people5", 3, "generated-faceset-missing-people-08"],
      ["tex_easyrpg_charset_actor3", 5, "generated-faceset-missing-people-10"],
      ["tex_easyrpg_charset_monster3", 2, "generated-faceset-missing-people-14"],
      ["tex_scarloxy_charset_people1", 0, "generated-faceset-missing-scarloxy-00"],
      ["tex_scarloxy_charset_people2", 1, "generated-faceset-missing-scarloxy-09"],
      ["tex_easyrpg_charset_animal", 1, "generated-faceset-missing-people-11"],
      ["tex_easyrpg_charset_monster3", 5, "generated-faceset-missing-monster-01"],
    ] as const)("%s #%i → %s", (textureKey, index, faceId) => {
      expect(reviewedCharsetFaceRow(textureKey, index)).toMatchObject({ status: "mapped", faceResourceId: faceId });
      expect(resolveAssetResourceUrl(faceId)).toMatch(/^\/assets\/generated\/faceset\/missing-(people|scarloxy|monster)\/\d{2}\.png$/);
    });
    it("사물·탈것·빈 칸은 계속 얼굴이 없고, 빈 생성 칸은 얼굴 목록에 없다", () => {
      for (const [textureKey, index] of [["tex_easyrpg_charset_object1", 6], ["tex_easyrpg_charset_vehicles", 1], ["tex_scarloxy_charset_people2", 2]] as const) {
        expect(reviewedCharsetFaceRow(textureKey, index)?.status).toBe("no-face");
      }
      const authorable = new Set(AUTHORABLE_FACESET_FACE_ASSETS.map((face) => face.id));
      expect(authorable.has("generated-faceset-missing-people-00")).toBe(true);
      expect(authorable.has("generated-faceset-missing-people-11")).toBe(true);
      expect(authorable.has("generated-faceset-missing-scarloxy-10")).toBe(false);
      expect(authorable.has("generated-faceset-missing-monster-03")).toBe(false);
    });
    it("place_npc 는 생성 짝 얼굴을 자동으로 붙이고, 틀린 번들 얼굴은 생성 짝으로 교정한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const auto = run(ctx, "place_npc", { mapId, name: "상인", x: 2, y: 2, graphic: { textureKey: "tex_easyrpg_charset_people4", characterIndex: 5 }, pages: [{ lines: ["어서 오세요"] }] });
      expect(faces(ctx.project.maps[mapId]!.events.find((e) => e.id === (auto.data as { eventId: string }).eventId))).toEqual(["generated-faceset-missing-people-05"]);
      const fixed = run(ctx, "place_npc", { mapId, name: "상인둘", x: 4, y: 2, graphic: { textureKey: "tex_easyrpg_charset_people4", characterIndex: 5 }, face: { resourceId: "easyrpg-faceset-people2-06" }, pages: [{ lines: ["어서 오세요"] }] });
      expect(faces(ctx.project.maps[mapId]!.events.find((e) => e.id === (fixed.data as { eventId: string }).eventId))).toEqual(["generated-faceset-missing-people-05"]);
    });
  });
  describe("저장본은 불러올 때 짝으로 교정된다", () => {
    it("옛 기본값 배우 얼굴과 NPC 첫 얼굴을 고치고, 다른 화자 얼굴과 업로드 얼굴은 둔다", () => {
      const project = createBlankProject();
      const guardian = project.database.actors.find((a) => a.id === "actor_guardian")!;
      guardian.faceResourceId = "easyrpg-faceset-actor2-00"; // 옛 "이름이 같은 시트" 기본값
      // 대응표 밖 얼굴(생성 표정 세트)은 작가 선택이라 그대로 둔다.
      const custom = project.database.actors.find((a) => a.id === "actor_hero")!;
      custom.faceResourceId = CUSTOM_FACE;
      const map = project.maps[project.startMapId]!;
      // people2#0(중절모 신사)은 2026-10-31 부터 얼굴 없음이다(근사 짝을 빌리지 않는다) — 짝이 있는 people2#1(수녀 → people1-09)로 확인한다.
      const pattern = charsetFrameIndex({ characterIndex: 1, direction: "down", pattern: 1 });
      map.events.push({ id: "ev_saved_npc", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{
        id: "p0", name: "신사", conditions: [], trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people2" }, direction: "down", pattern },
        commands: [
          { kind: "changeFace", resourceId: "easyrpg-faceset-people1-00", position: "left", flipHorizontally: false },
          { kind: "text", speaker: "신사", body: "안녕" },
          { kind: "changeFace", resourceId: "easyrpg-faceset-actor1-00", position: "right", flipHorizontally: false },
          { kind: "text", speaker: "용사", body: "네" },
        ],
      }] });
      const result = repairFaceMatches(project);
      expect(result.actors).toBeGreaterThanOrEqual(1);
      expect(result.eventFaces).toBeGreaterThanOrEqual(1);
      expect(guardian.faceResourceId).toBe("easyrpg-faceset-actor1-08");
      expect(custom.faceResourceId).toBe(CUSTOM_FACE);
      const saved = map.events.find((e) => e.id === "ev_saved_npc");
      expect(faces(saved)).toEqual(["easyrpg-faceset-people1-09", "easyrpg-faceset-actor1-00"]);
      // 저장 → 다시 불러오기 → 두 번째 교정은 아무것도 바꾸지 않는다(멱등).
      const reloaded = deserialize(serialize(project));
      expect(repairFaceMatches(reloaded)).toEqual({ actors: 0, eventFaces: 0 });
      expect(faces(reloaded.maps[project.startMapId]!.events.find((e) => e.id === "ev_saved_npc"))[0]).toBe("easyrpg-faceset-people1-09");
    });

    it("얼굴 없음 그림의 첫 얼굴은 뺀다", () => {
      const project = createBlankProject();
      const pattern = charsetFrameIndex({ characterIndex: 6, direction: "down", pattern: 1 });
      project.maps[project.startMapId]!.events.push({ id: "ev_no_face", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{
        id: "p0", name: "보물 상자", conditions: [], trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" }, direction: "down", pattern },
        commands: [
          { kind: "changeFace", resourceId: "easyrpg-faceset-people2-09", position: "left", flipHorizontally: false },
          { kind: "text", speaker: "보물 상자", body: "덜컹" },
        ],
      }] });
      expect(repairFaceMatches(project).eventFaces).toBe(1);
      expect(faces(project.maps[project.startMapId]!.events.find((e) => e.id === "ev_no_face"))).toEqual([]);
    });
  });
});

describe("findSimilarTiles", () => {
  isolateTimers();
  type FindSimilarTilesData = {
    readonly tileId: number;
    readonly tiles: readonly number[];
    readonly tilesetId: string;
  };
  function findSimilarTilesData(value: unknown): FindSimilarTilesData {
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("find_similar_tiles data must be an object");
    const tileId = Reflect.get(value, "tileId");
    const tiles = Reflect.get(value, "tiles");
    const tilesetId = Reflect.get(value, "tilesetId");
    if (!Number.isInteger(tileId) || !Array.isArray(tiles) || !tiles.every(Number.isInteger) || typeof tilesetId !== "string") {
      throw new Error("find_similar_tiles data shape mismatch");
    }
    return { tileId, tiles, tilesetId };
  }
  function projectWithTileSemantics(): ReturnType<typeof createBlankProject> {
    const project = createBlankProject();
    const tileset = project.tilesets[DEFAULT_TILESET_ID];
    if (!tileset) throw new Error("default tileset missing");
    // 2026-10-07 저작권 정리로 새 프로젝트 기본 칩셋이 합본 마을 → beodeul_city 로 바뀌었다. 픽스처는 메타·지형을 통째로
    // 덮어쓰는 일반 동작 시험이라 기본 칩셋을 쓰고, 그 칩셋의 실제 그룹이 점수에 끼지 않게 비운다.
    tileset.tileGroups = [];
    tileset.count = 40;
    tileset.tilesPerRow = 10;
    tileset.terrain = Array.from({ length: tileset.count }, () => 0);
    tileset.tileMeta = Array.from({ length: tileset.count }, () => ({ description: "", label: "", source: "unknown" }));
    tileset.tileMeta[22] = { description: "붉은 기와 지붕 기준", label: "붉은 지붕 중앙", role: "roof", source: "user", terrainTag: 7 };
    tileset.tileMeta[21] = { description: "붉은 기와 지붕 왼쪽", label: "붉은 지붕 왼쪽", role: "roof", source: "user", terrainTag: 7 };
    tileset.tileMeta[23] = { description: "붉은 기와 지붕 오른쪽", label: "붉은 지붕 오른쪽", role: "roof", source: "user", terrainTag: 7 };
    tileset.tileMeta[32] = { description: "붉은 기와 지붕 아래", label: "붉은 지붕 아래", role: "roof", source: "user", terrainTag: 7 };
    tileset.tileMeta[12] = { description: "물가 바닥", label: "물 바닥", role: "water", source: "user", terrainTag: 1 };
    tileset.tileMeta[24] = { description: "돌 벽", label: "벽", role: "wall", source: "user", terrainTag: 4 };
    tileset.tileMeta[37] = { description: "먼 지붕", label: "붉은 지붕 장식", role: "roof", source: "user", terrainTag: 7 };
    return project;
  }
  describe("find_similar_tiles", () => {
    it("ranks nearby role and terrain matches first", () => {
      const project = projectWithTileSemantics();

      const result = runTool({ project }, "find_similar_tiles", { limit: 4, tileId: 22, tilesetId: DEFAULT_TILESET_ID });

      expect(result.ok, result.summary).toBe(true);
      const data = findSimilarTilesData(result.data);
      expect(data).toMatchObject({ tileId: 22, tilesetId: DEFAULT_TILESET_ID });
      expect(data.tiles).toHaveLength(4);
      expect(data.tiles).not.toContain(22);
      expect(data.tiles.slice(0, 3)).toEqual([21, 23, 32]);
    });

    it("honors limit and excludes the source tile", () => {
      const project = projectWithTileSemantics();

      const result = runTool({ project }, "find_similar_tiles", { limit: 2, tileId: 22, tilesetId: DEFAULT_TILESET_ID });

      expect(result.ok, result.summary).toBe(true);
      const data = findSimilarTilesData(result.data);
      expect(data.tiles).toEqual([21, 23]);
    });
  });
});

// 2026-09-24 연애 도그푸딩: 모델이 조건 분기를 페이지 조건처럼 `conditions:[…]` 로 쓰거나, then 없이 뒤따르는
// 형제 명령으로 썼다 — 「condition가 객체가 아닙니다」 뒤에 text 예시만 받아 침대 이벤트를 고치지 못하고 새로 만들었다.
describe("forkConditionShape", () => {
  isolateTimers();
  const DAY_GE_6 = { kind: "variable", variableId: "var_day", op: ">=", value: 6 };
  describe("fork 조건 표기", () => {
    it("conditions 배열을 condition 으로 옮긴다(여럿이면 all)", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const result = runTool(ctx, "upsert_event", {
        mapId,
        event: {
          id: "ev_bed", x: 2, y: 2, commands: [],
          pages: [{ trigger: { kind: "action" }, graphic: { transparent: true }, commands: [
            { kind: "fork", conditions: [DAY_GE_6], then: [{ kind: "text", body: "축제다" }] },
            { kind: "fork", conditions: [DAY_GE_6, { kind: "switch", switchId: "sw_x", value: true }], thenBranch: [{ kind: "text", body: "둘 다" }], elseBranch: [] },
          ] }],
        },
      });
      expect(result.ok, result.summary).toBe(true);
      const commands = ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_bed")!.pages![0]!.commands;
      expect(commands[0]).toMatchObject({ kind: "fork", condition: DAY_GE_6 });
      expect(commands[1]).toMatchObject({ kind: "fork", condition: { kind: "all" }, then: [{ kind: "text" }], else: [] });
    });

    it("then 없는 fork 는 올바른 fork 예시와 함께 거부한다", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "upsert_event", {
        mapId: ctx.project.startMapId,
        event: { id: "ev_bed2", x: 2, y: 2, commands: [], pages: [{ trigger: { kind: "action" }, graphic: { transparent: true }, commands: [
          { kind: "fork", conditions: [DAY_GE_6] }, { kind: "text", body: "축제다" },
        ] }] },
      });
      expect(result.ok).toBe(false);
      const message = (result.issues ?? []).map((issue) => issue.message).join("\n");
      expect(message).toContain("then 배열");
      expect(message).toContain('kind:"fork",condition:');
    });
  });
});

// 장르 칩셋 잠금(2026-10-15) — 옵트인 판정·실행기 거부·무음 대체 금지·사용자 경로 불간섭·직렬화 왕복.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
describe("genreLock", () => {
  isolateTimers();
  beforeEach(() => resetMapEditHistory());
  function lockedProject() {
    const project = createBlankProject();
    applyGenrePreset(project, "monster-collect");
    return project;
  }
  const create = (ctx: ToolContext, name: string, tilesetId?: string, extra: Record<string, unknown> = {}) =>
    runTool(ctx, "create_map", { name, width: 24, height: 18, ...(tilesetId ? { tilesetId } : {}), ...extra }, { dryRun: false });
  describe("장르 칩셋 잠금", () => {
    it("옵트인이다 — 몬스터 프리셋이 없으면 필드도 직렬화 바이트도 없다", () => {
      const project = createBlankProject();
      expect(project.system.genreLock).toBeUndefined();
      expect(serialize(project)).not.toContain("genreLock");
      const ctx: ToolContext = { project, assistantRun: true };
      expect(create(ctx, "사막", "desert_east").ok).toBe(true);
    });

    it("몬스터 프리셋이 잠금을 켜고 직렬화·역직렬화를 거쳐 보존된다", () => {
      const project = lockedProject();
      expect(project.system.genreLock).toMatchObject({ preset: "monster-collect", mode: "enforce" });
      expect(project.system.genreLock!.allowedFamilies).toContain("oprn-monster");
      const reloaded = deserialize(serialize(project));
      expect(reloaded.system.genreLock).toEqual(project.system.genreLock);
    });

    it("조수의 허용 밖 칩셋은 거부되고 허용 칩셋·대안 이름이 메시지에 있으며 맵은 생기지 않는다", () => {
      const ctx: ToolContext = { project: lockedProject(), currentMapId: "map_blank_start", assistantRun: true };
      const desert = create(ctx, "사막 마을", "desert_east");
      expect(desert.ok).toBe(false);
      expect(desert.issues?.[0]?.code).toBe("genre-lock");
      expect(desert.issues?.[0]?.message).toContain("monster_climate");
      const campus = create(ctx, "벚꽃 캠퍼스", "modern_campus");
      expect(campus.ok).toBe(false);
      expect(campus.issues?.[0]?.message).toContain("monster_overworld");
      expect(Object.values(ctx.project.maps).map((map) => map.name)).not.toContain("사막 마을");
    });

    it("themeScene 우회와 비허용 전용 도구도 거부된다", () => {
      const ctx: ToolContext = { project: lockedProject(), currentMapId: "map_blank_start", assistantRun: true };
      const themed = create(ctx, "캠퍼스", undefined, { width: 60, height: 44, themeScene: "campus:school" });
      expect(themed.ok).toBe(false);
      const hidden = runTool(ctx, "author_beodeul_town", { mapId: "map_blank_start", theme: "river" });
      expect(hidden.ok).toBe(false);
      expect(hidden.issues?.[0]?.code).toBe("genre-lock");
    });

    it("tilesetId 를 생략하면 허용 칩셋으로 대체하고 그 사실을 경고로 남긴다(무음 아님)", () => {
      const project = lockedProject();
      project.maps.map_blank_start!.tilesetId = "beodeul_city";   // 보는 맵이 잠금 밖 계열이어도 기본값은 허용 칩셋이다
      const ctx: ToolContext = { project, currentMapId: "map_blank_start", assistantRun: true };
      const result = create(ctx, "별싹 마을");
      expect(result.ok).toBe(true);
      const made = Object.values(ctx.project.maps).find((map) => map.name === "별싹 마을")!;
      expect(made.tilesetId).toBe("monster_overworld");
      expect(JSON.stringify(result.diff?.warnings ?? [])).toContain("장르 잠금");
    });

    it("사용자 손 편집 경로(assistantRun 아님)는 막지 않고, 검사 도구는 잠금 이후 위반으로 보고한다", () => {
      const ctx: ToolContext = { project: lockedProject() };
      expect(create(ctx, "사용자 사막", "desert_east").ok).toBe(true);
      const report = genreLockReport(ctx.project);
      expect(report.violations.map((violation) => violation.mapName)).toEqual(["사용자 사막"]);
      expect(report.preexisting).toEqual([]);
    });

    it("사용자가 카드로 승인한 계열은 그 계열 한정으로 통과한다", () => {
      const ctx: ToolContext = { project: lockedProject(), currentMapId: "map_blank_start", assistantRun: true, approvedTilesetFamilies: ["oprn-campus"] };
      expect(create(ctx, "승인된 캠퍼스", "modern_campus").ok).toBe(true);
      expect(create(ctx, "승인 안 된 사막", "desert_east").ok).toBe(false);
    });

    it("켜기 전부터 있던 허용 밖 맵은 따로 보고하고 막지 않는다", () => {
      const project = createBlankProject();   // 버들항 빈 시작 맵
      expect(enableGenreLock(project, "monster-collect")).toBe(true);
      const violations = genreLockViolations(project);
      expect(violations).toHaveLength(1);
      expect(violations[0]!.preexisting).toBe(true);
      expect(genreLockReport(project).violations).toEqual([]);
      const ctx: ToolContext = { project, currentMapId: "map_blank_start", assistantRun: true };
      expect(runTool(ctx, "set_map_properties", { mapId: "map_blank_start", name: "이름만 바꿈" }, { dryRun: false }).ok).toBe(true);
    });

    it("configure_monster_system(enabled:false) 는 잠금을 풀면서 「장르 잠금 해제됨」 경고를 남긴다", () => {
      const ctx: ToolContext = { project: lockedProject(), assistantRun: true };
      const result = runTool(ctx, "configure_monster_system", { enabled: false }, { dryRun: false });
      expect(result.ok).toBe(true);
      expect(ctx.project.system.genreLock).toBeUndefined();
      expect(JSON.stringify(result.diff?.warnings ?? [])).toContain("장르 잠금 해제됨");
    });

    it("configure_monster_system(enabled:true) 는 잠금을 켠다", () => {
      const project = createBlankProject();
      // 역방향 잠금(#2812): 몬스터 게임이 아닌 프로젝트에서는 몬스터 수집 요청 턴(monsterTurn)에만 몬스터 도구가 풀린다.
      const ctx: ToolContext = { project, assistantRun: true, monsterTurn: true };
      expect(runTool(ctx, "configure_monster_system", { enabled: true }, { dryRun: false }).ok).toBe(true);
      expect(ctx.project.system.genreLock?.preset).toBe("monster-collect");
    });

    it("disableGenreLock 은 잠금이 없으면 false", () => {
      expect(disableGenreLock(createBlankProject())).toBe(false);
    });

    it("find_tools 는 잠금 중 비허용 계열 전용 도구를 결과에서 뺀다", () => {
      const ctx: ToolContext = { project: lockedProject(), assistantRun: true };
      const result = runTool(ctx, "find_tools", { query: "author_beodeul_town" });
      const names = ((result.data as { matches: { name: string }[] }).matches ?? []).map((match) => match.name);
      expect(names).not.toContain("author_beodeul_town");
      expect(result.summary).toContain("장르 잠금");
    });
  });
});

// 2026-09-24 연애 도그푸딩: 「선물을 건넨다」 분기가 changeItem -= 1 뒤에 호감 +3 을 주는데 소지 조건이 없어,
// 잡화점에 가지 않고도 선물 효과를 받았다. 거부하지 않고 presentItem / 소지 조건 fork 를 알려 준다.
describe("giftItemGuardWarning", () => {
  isolateTimers();
  const gift = (branch: unknown[]) => ({ kind: "choices", options: [{ text: "사탕을 준다", branch }, { text: "그만둔다", branch: [{ kind: "text", body: "다음에." }] }] });
  const spend = { kind: "changeItem", itemId: "item_candy", op: "-=", amount: 1 };
  const love = { kind: "setVariable", variableId: "var_love", op: "+=", value: 3 };
  function warningsFor(commands: unknown[]): string {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_event", {
      mapId: ctx.project.startMapId,
      event: { id: "ev_summer", x: 3, y: 3, commands: [], pages: [{ trigger: { kind: "action" }, graphic: { transparent: true }, commands }] },
    });
    expect(result.ok, result.summary).toBe(true);
    return (result.diff?.warnings ?? []).join("\n");
  }
  describe("소지 조건 없는 선물", () => {
    it("선택지 분기가 소지 확인 없이 아이템을 빼면 경고한다", () => {
      expect(warningsFor([gift([spend, love])])).toContain("presentItem");
    });
    it("소지 조건 fork 로 감싸면 경고하지 않는다", () => {
      const guarded = gift([{ kind: "fork", condition: { kind: "item", itemId: "item_candy", present: true }, then: [spend, love], else: [{ kind: "text", body: "사탕이 없다." }] }]);
      expect(warningsFor([guarded])).not.toContain("소지 여부를 보지 않습니다");
    });
  });
});
