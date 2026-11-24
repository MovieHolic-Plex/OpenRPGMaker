import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { applyCharacterGraphicsImport, exportCharacterGraphics, listCharacterSprites, listCharacterFaces, NPC_FACE_MAPPING_SCHEMA, parseCharacterGraphicsImport, seedGraphicAttributes } from "@/project/characterGraphics";
import { characterIdExists, findCharacterIdEntry, listCharacterIdIndex } from "@/project/characterIdIndex";
import type { GameEvent, Project, TilesetDef } from "@/project/types";
import { clampCinematicTextSize, parseCinematicPresentation, hasAuthoredTextOpening } from "@/project/cinematicPresentation";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { canMove, cellPassability, isPassable, layeredPassability, passabilityOf, tilePassability } from "@/project/collision";
import { setLayerTileAt } from "@/project/mapLayers";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { deadAlleyMouths, type AlleyBoard } from "@/project/composerDeadAlleys";
import { exitRoadCells, exitRoadThroughWild, roadReachesEdge, type ExitRoadBoard } from "@/project/composerExitRoads";
import { CONCEPT_TAGS, conceptSlug, normalizeGameConcept } from "@/concepts/format";
import { conceptBrief } from "@/concepts/brief";
import { conceptArtPrompt, conceptForbiddenNameHits } from "@/concepts/art";
import { normalizeGameDesignBrief } from "@/project/gameDesignBrief";
import { isolateTimers } from "./mergedTeardown";

describe("characterGraphics", () => {
  isolateTimers();
  const textureKey = "tex_easyrpg_charset_people1";
  const faceResourceId = "easyrpg-faceset-actor2-15";
  const row = (characterIndex = 0) => ({ textureKey, characterIndex, label: "수정한 이름", note: "수동 검토", status: "pending", faceResourceId: null });
  // 2026-09 제품명 스윕 전 카탈로그가 내보낸 v1 문서 — schema id 가 옛 이름이다. 사용자 디스크의 그 파일이 계속 열려야 하므로
  // 이 fixture 는 일부러 옛 id 를 든다(옛 id 수용 검사). 새 id 는 아래 "schema id" 테스트가 고정한다.
  const documentV1 = (mappings: unknown[]) => ({ schema: "rpg-zzu-npc-face-mapping", version: 1, sourceCommit: "old-catalog", mappings });
  describe("character graphics metadata", () => {
    it("imports pending labels independently, preserves explicit no-face and exact mapped IDs through project reload", () => {
      const project = createBlankProject();
      const events = JSON.stringify(project.maps);
      applyCharacterGraphicsImport(project, parseCharacterGraphicsImport(documentV1([
        row(), { ...row(1), status: "no-face" }, { ...row(2), status: "mapped", faceResourceId },
      ]), project));
      const loaded = deserialize(serialize(project));
      const sprites = listCharacterSprites(loaded).filter((sprite) => sprite.textureKey === textureKey);
      expect(sprites[0]).toMatchObject({ label: "수정한 이름", status: "pending", faceResourceId: null, note: "수동 검토", quality: "unspecified" });
      expect(sprites[1]).toMatchObject({ status: "no-face", faceResourceId: null });
      expect(sprites[2]).toMatchObject({ status: "mapped", faceResourceId });
      expect(loaded.charsetLabels?.find((entry) => entry.characterIndex === 0 && entry.textureKey === textureKey)?.label).toBe("수정한 이름");
      expect(JSON.stringify(project.maps)).toBe(events);
    });

    it("exports the oprn schema id, re-imports it, still accepts the legacy id, and rejects anything else", () => {
      const project = createBlankProject();
      const exported = exportCharacterGraphics(project);
      expect(NPC_FACE_MAPPING_SCHEMA).toBe("oprn-npc-face-mapping");
      expect(exported.schema).toBe("oprn-npc-face-mapping");
      expect(() => parseCharacterGraphicsImport(exported, project)).not.toThrow();
      expect(() => parseCharacterGraphicsImport({ ...exported, schema: "rpg-zzu-npc-face-mapping" }, project)).not.toThrow();
      expect(() => parseCharacterGraphicsImport(documentV1([row()]), project)).not.toThrow();
      expect(() => parseCharacterGraphicsImport({ ...exported, schema: "someone-elses-mapping" }, project)).toThrow();
    });

    it("rejects a bad final row or duplicate before any mutation", () => {
      const project = createBlankProject();
      const before = serialize(project);
      for (const rows of [
        [row(), { ...row(1), status: "mapped", faceResourceId: "unknown-face" }],
        [row(), row()],
        [{ ...row(), characterIndex: 8 }],
        [{ ...row(), status: "no-face", faceResourceId }],
        [{ ...row(), quality: "invented" }],
      ]) {
        expect(() => applyCharacterGraphicsImport(project, parseCharacterGraphicsImport(documentV1(rows), project))).toThrow();
        expect(serialize(project)).toBe(before);
      }
    });

    it("roundtrips v2 independent attributes and keeps unspecified quality", () => {
      const project = createBlankProject();
      const payload = { ...documentV1([{ ...row(), attributes: { skin: "어두운", role: "상인" }, quality: "unspecified" }]), version: 2,
        faces: [{ resourceId: faceResourceId, label: "직접 고친 얼굴", note: "얼굴 메모", attributes: { skin: "밝은", hair: "금발" } }] };
      applyCharacterGraphicsImport(project, parseCharacterGraphicsImport(payload, project));
      const exported = exportCharacterGraphics(deserialize(serialize(project)));
      expect(exported.mappings.find((entry) => entry.textureKey === textureKey && entry.characterIndex === 0)).toMatchObject({ attributes: { skin: "어두운", role: "상인" }, status: "pending", quality: "unspecified" });
      expect(exported.faces.find((entry) => entry.resourceId === faceResourceId)).toMatchObject({ label: "직접 고친 얼굴", attributes: { skin: "밝은", hair: "금발" } });
      const second = createBlankProject();
      applyCharacterGraphicsImport(second, parseCharacterGraphicsImport(exported, second));
      expect(exportCharacterGraphics(second)).toEqual(exported);
      expect(listCharacterFaces(second).find((face) => face.resourceId === faceResourceId)?.attributes.role).toBeUndefined();
    });

    it("does not let the bundled resource-ID alias hide an edited texture-key profile", () => {
      const project = createBlankProject();
      expect(project.resourceProfiles.some((profile) => profile.assetId === "easyrpg-charset-people1")).toBe(true);
      applyCharacterGraphicsImport(project, parseCharacterGraphicsImport(documentV1([row()]), project));
      expect(listCharacterSprites(project).find((entry) => entry.textureKey === textureKey && entry.characterIndex === 0)?.note).toBe("수동 검토");
    });

    it("rejects malformed or duplicate v2 face rows atomically", () => {
      const project = createBlankProject();
      const before = serialize(project);
      const face = { resourceId: faceResourceId, label: "얼굴", note: "", attributes: { hair: "금발" } };
      for (const faces of [[face, face], [{ ...face, resourceId: "missing" }], [{ ...face, attributes: { hair: 4 } }]]) {
        expect(() => parseCharacterGraphicsImport({ ...documentV1([row()]), version: 2, faces }, project)).toThrow();
        expect(serialize(project)).toBe(before);
      }
    });

    it("preserves explicitly blank and whitespace labels rather than resetting them to bundled labels", () => {
      const project = createBlankProject();
      applyCharacterGraphicsImport(project, parseCharacterGraphicsImport(documentV1([{ ...row(), label: "" }, { ...row(1), label: "  이름  " }]), project));
      const sprites = listCharacterSprites(deserialize(serialize(project))).filter((entry) => entry.textureKey === textureKey);
      expect(sprites[0]?.label).toBe("");
      expect(sprites[1]?.label).toBe("  이름  ");
    });

    it("keeps legacy projects metadata-free and only seeds explicit written traits", () => {
      const project = deserialize(serialize(createBlankProject()));
      expect(project.resourceProfiles.some((profile) => profile.characterSlots || profile.graphicAttributes)).toBe(false);
      expect(seedGraphicAttributes("정체불명 4번")).toEqual({});
      expect(seedGraphicAttributes("금발 노파 상인")).toMatchObject({ hair: "금발", age: "노년", gender: "여성", role: "상인" });
      expect(seedGraphicAttributes("젊은 중년 남성 여성").age).toBeUndefined();
      expect(seedGraphicAttributes("젊은 중년 남성 여성").gender).toBeUndefined();
    });

    it("rejects malformed persisted metadata, duplicates and dangling face IDs on load", () => {
      const project = createBlankProject();
      const profile = project.resourceProfiles.find((entry) => entry.kind === "charset" && entry.assetId === textureKey)!;
      const slot = { characterIndex: 0, status: "mapped", faceResourceId: "missing", quality: "exact", note: "", graphicAttributes: {} };
      Object.assign(profile, { characterSlots: [slot] });
      expect(() => deserialize(serialize(project))).toThrow();
      Object.assign(profile, { characterSlots: [{ ...slot, faceResourceId }, { ...slot, faceResourceId }] });
      expect(() => deserialize(serialize(project))).toThrow();
      Object.assign(profile, { characterSlots: [{ ...slot, faceResourceId, graphicAttributes: { age: 4 } }] });
      expect(() => deserialize(serialize(project))).toThrow();
    });
  });
});

describe("characterIdIndex", () => {
  isolateTimers();
  function event(partial: Partial<GameEvent> & Pick<GameEvent, "id">): GameEvent {
    return {
      id: partial.id,
      x: partial.x ?? 1,
      y: partial.y ?? 1,
      trigger: partial.trigger ?? { kind: "action" },
      commands: partial.commands ?? [],
      pages: partial.pages ?? [{ id: "p1", conditions: [], commands: [] }],
      ...partial,
    };
  }
  function projectWith(
    events: readonly GameEvent[],
    characters?: Project["characters"]
  ): Project {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId] = {
      ...project.maps[mapId],
      events: [...events],
    };
    if (characters) project.characters = characters;
    return project;
  }
  describe("characterIdIndex", () => {
    it("unions project.characters keys and event characterIds", () => {
      const project = projectWith(
        [event({ id: "ev_a", characterId: "char_used" })],
        {
          char_used: { displayName: "Used" },
          char_only_profile: { displayName: "Profile Only" },
        }
      );
      project.maps["map_extra"] = {
        ...project.maps[project.startMapId],
        id: "map_extra",
        name: "Extra",
        events: [event({ id: "ev_b", characterId: "char_orphan" })],
      };

      const index = listCharacterIdIndex(project);
      const byId = Object.fromEntries(index.map((entry) => [entry.characterId, entry]));

      expect(Object.keys(byId).sort()).toEqual(["char_only_profile", "char_orphan", "char_used"]);
      expect(byId.char_used).toMatchObject({
        hasProfile: true,
        usageCount: 1,
        mapCount: 1,
        isOrphan: false,
        isUnusedProfile: false,
      });
      expect(byId.char_only_profile).toMatchObject({
        hasProfile: true,
        usageCount: 0,
        isOrphan: false,
        isUnusedProfile: true,
      });
      expect(byId.char_orphan).toMatchObject({
        hasProfile: false,
        usageCount: 1,
        isOrphan: true,
        isUnusedProfile: false,
      });
      expect(byId.char_used.hosts[0]).toMatchObject({
        mapId: project.startMapId,
        eventId: "ev_a",
      });
    });

    it("ignores blank characterIds and counts multi-map usage", () => {
      const project = projectWith([
        event({ id: "ev_blank", characterId: "   " }),
        event({ id: "ev_one", characterId: "shared" }),
      ]);
      project.maps["map_two"] = {
        ...project.maps[project.startMapId],
        id: "map_two",
        name: "Two",
        events: [event({ id: "ev_two", characterId: " shared " })],
      };

      const entry = findCharacterIdEntry(project, "shared");
      expect(entry?.usageCount).toBe(2);
      expect(entry?.mapCount).toBe(2);
      expect(characterIdExists(project, "shared")).toBe(true);
      expect(characterIdExists(project, "missing")).toBe(false);
      expect(listCharacterIdIndex(project).some((item) => item.characterId === "")).toBe(false);
    });
  });
});

describe("cinematicPresentation", () => {
  isolateTimers();
  describe('authored opening typography persistence', () => {
    it('preserves text/image/video presentation in disabled opening and game-over records', () => {
      const project = createBlankProject();
      // 새 프로젝트는 기본 전투 스킨(battleUiStyle: retro2003)을 명시해 두고 로드 정규화가 그것을 지운다 — 이 시험과 무관한
      // 그 정규화를 먼저 적용해 바이트 비교의 전제를 맞춘다(autotileGroupPersistence 와 같은 방식).
      project.system = normalizeSystemRecords(project.system);
      const presentation = parseCinematicPresentation({ preset: 'memory', text: { animation: 'typewriter', color: '#aAbBcC', revealMs: 1700 }, transition: { enter: 'wipe', exitMs: 500 } });
      const scene = { id: 'letter', kind: 'text' as const, narration: '가족 👨‍👩‍👧‍👦 é <b>기억</b>', durationMs: 0, presentation };
      project.assets.uploaded.still = { id: 'still', name: 'Still', kind: 'picture', meta: {}, dataUrl: 'data:image/png;base64,AQID' };
      project.assets.uploaded.movie = { id: 'movie', name: 'Movie', kind: 'movie', meta: {}, dataUrl: 'data:video/mp4;base64,AQID' };
      project.system.opening = { enabled: false, skippable: true, scenes: [scene,
        { ...scene, id: 'still', kind: 'image', resourceId: 'still', motion: 'none' },
        { ...scene, id: 'movie', kind: 'video', resourceId: 'movie' },
      ] };
      project.system.gameOver = { sequence: structuredClone(project.system.opening) };
      const restored = deserialize(serialize(project));
      expect(restored.system.opening).toEqual(project.system.opening);
      expect(restored.system.gameOver).toEqual(project.system.gameOver);
      expect(serialize(restored)).toEqual(serialize(project));
    });

    it.each([
      { preset: 'invented' }, { text: { animation: 'script' } }, { text: { revealMs: Infinity } },
      { text: { revealMs: 0.5 } }, { text: { color: 'url(secret)' } }, { letterbox: 21 },
      { transition: { enterMs: 5001 } }, { text: { html: '<script>' } },
    ])('rejects malformed presentation at project load: %j', presentation => {
      const project = createBlankProject();
      const wire = JSON.parse(serialize(project));
      wire.system.opening = { enabled: true, skippable: true, scenes: [{ id: 'bad', kind: 'text', narration: 'bad', durationMs: 3000, presentation }] };
      expect(() => deserialize(JSON.stringify(wire))).toThrow();
    });

    it('keeps a title-card size the opening form can save', () => {
      expect(parseCinematicPresentation({ preset: 'chapter', text: { size: 40 } }).text?.size).toBe(40);
      expect(parseCinematicPresentation({ preset: 'credits', text: { size: 11 } }).text?.size).toBe(11);
      expect(clampCinematicTextSize(40)).toBe(40);
      expect(clampCinematicTextSize(11)).toBe(11);
      expect(clampCinematicTextSize(4)).toBe(8);
      expect(clampCinematicTextSize(80)).toBe(64);
      expect(() => parseCinematicPresentation({ text: { size: 65 } })).toThrow(/8\.\.64/);
    });

    it('accepts intentional varied typography and rejects unstyled black text', () => {
      const scenes = [{ kind: 'text', narration: '편지가 왔다.', presentation: { preset: 'prologue' as const } }, { kind: 'text', narration: '첫 번째 기억', presentation: { preset: 'chapter' as const } }];
      expect(hasAuthoredTextOpening(scenes)).toBe(true);
      expect(hasAuthoredTextOpening(scenes.map(scene => ({ ...scene, presentation: undefined })))).toBe(false);
      expect(hasAuthoredTextOpening([scenes[0], scenes[0]])).toBe(false);
    });
  });
});

describe("collisionLayers", () => {
  isolateTimers();
  function setup() {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const tileset = project.tilesets[map.tilesetId];
    const find = (mark: "o" | "x" | "star") => {
      for (let t = 0; t < tileset.count; t++) if (passageMarkForTile(tileset, t) === mark) return t;
      throw new Error(`no ${mark} tile`);
    };
    return { project, map, tileset, O: find("o"), X: find("x"), STAR: find("star") };
  }
  describe("layeredPassability", () => {
    it("두 층이면 기존 tilePassability 와 같다", () => {
      const { tileset, O, X, STAR } = setup();
      for (const lower of [O, X]) for (const upper of [-1, O, X, STAR]) {
        expect(layeredPassability(tileset, [lower, -1, upper, -1])).toEqual(tilePassability(tileset, lower, upper));
      }
    });
    it("맨 위의 ★ 아닌 타일이 정한다 — 4층 X 는 3층 O 를 막는다", () => {
      const { tileset, O, X } = setup();
      expect(layeredPassability(tileset, [O, -1, O, X]).up).toBe(false);
    });
    it("★ 는 건너뛴다 — 4층 ★ 아래 2층 X 가 정한다", () => {
      const { tileset, O, X, STAR } = setup();
      expect(layeredPassability(tileset, [O, X, -1, STAR]).up).toBe(false);
    });
    it("2층 O 는 1층 X 위에서 통행을 연다(MZ 와 같음)", () => {
      const { tileset, O, X } = setup();
      expect(layeredPassability(tileset, [X, O, -1, -1]).up).toBe(true);
    });
    it("1층이 비면 막힘", () => {
      const { tileset, O } = setup();
      expect(layeredPassability(tileset as TilesetDef, [-1, O, -1, -1])).toEqual({ up: false, down: false, left: false, right: false });
    });
    it("isPassable 이 4층을 본다", () => {
      const { project, map, O, X } = setup();
      setLayerTileAt(map, 1, 0, O);
      expect(isPassable(project, map, 0, 0)).toBe(true);
      setLayerTileAt(map, 4, 0, X);
      expect(isPassable(project, map, 0, 0)).toBe(false);
    });
  });
  describe("배열 없는 통행 읽기", () => {
    it("passabilityOf 는 layeredPassability 와 같다 — ★·빈칸·범위 밖 번호 포함", () => {
      const { tileset, O, X, STAR } = setup();
      const ids = [-1, O, X, STAR, tileset.count + 5];
      for (const a of ids) for (const b of ids) for (const c of ids) for (const d of ids) {
        expect(passabilityOf(tileset, a, b, c, d)).toEqual(layeredPassability(tileset, [a, b, c, d]));
      }
    });
    it("cellPassability 와 canMove 가 4층을 읽는다", () => {
      const { project, map, tileset, O, X } = setup();
      for (let i = 0; i < 2; i++) setLayerTileAt(map, 1, i, O);
      expect(cellPassability(tileset, map, 1)).toEqual(layeredPassability(tileset, [O, -1, map.upperTiles[1], -1]));
      expect(canMove(project, map, 0, 0, 1, 0)).toBe(true);
      setLayerTileAt(map, 4, 1, X);
      expect(cellPassability(tileset, map, 1)).toEqual(layeredPassability(tileset, [O, -1, map.upperTiles[1], X]));
      expect(canMove(project, map, 0, 0, 1, 0)).toBe(false);
      expect(canMove(project, map, 0, 0, -1, 0)).toBe(false);
    });
  });
});

// 구성기 공용 막다른 골목 찾기(composerDeadAlleys) — 어디로도 가지 않는 한 칸 폭 골목의 어귀만 고른다.
describe("composerDeadAlleys", () => {
  isolateTimers();
  /** '#' 길(쓰임 있는 칸) · '.' 맨땅 · 그 밖은 막힌 칸. */
  const board = (rows: readonly string[]): AlleyBoard => ({
    W: rows[0]!.length, H: rows.length,
    walk: (x, y) => rows[y]?.[x] === "#" || rows[y]?.[x] === ".",
    plain: (x, y) => rows[y]?.[x] === ".",
  });
  const START = { x: 0, y: 5 };
  describe("composerDeadAlleys", () => {
    it("집 사이 틈으로만 닿는 성벽 밑 띠는 틈의 길 쪽 어귀를 막는다", () => {
      const rows = [
        "XXXXXXXXXXXX",
        "X..........X",   // 성벽 밑 맨땅 띠
        "XHH.HHH.HHHX",   // 집 줄(틈 x=3, x=7)
        "XHH.HHH.HHHX",
        "XHH.HHH.HHHX",
        "############",   // 길
      ];
      expect(deadAlleyMouths(board(rows), START).map((c) => `${c.x},${c.y}`).sort()).toEqual(["3,4", "7,4"]);
    });

    it("길과 길을 잇는 골목은 지나가는 길이라 그대로 둔다", () => {
      const rows = [
        "############",
        "XHH.HHHHHHHX",
        "XHH.HHHHHHHX",
        "XHH.HHHHHHHX",
        "XHH.HHHHHHHX",
        "############",
      ];
      expect(deadAlleyMouths(board(rows), START)).toEqual([]);
    });

    it("넓은 빈터로 나가는 골목과 한 칸짜리 구석은 막지 않는다", () => {
      const wide = ["XXXXXXXXXXXXXX", ...Array.from({ length: 6 }, () => "X............X"), "XHHHHHH.HHHHHX", "##############"];
      expect(deadAlleyMouths(board(wide), { x: 0, y: 8 })).toEqual([]);
      const nook = ["XXXXXX", "XHH.HX", "######"];
      expect(deadAlleyMouths(board(nook), { x: 0, y: 2 })).toEqual([]);
    });
  });
});

// 구성기 공용 출구 길 찾기(composerExitRoads) — 길 그물에서 맵 가장자리까지의 띠.
describe("composerExitRoads", () => {
  isolateTimers();
  /** '#' 길 · '.' 빈 땅 · 그 밖은 막힌 칸. */
  const board = (rows: readonly string[]): ExitRoadBoard => ({
    W: rows[0]!.length, H: rows.length,
    isRoad: (x, y) => rows[y]?.[x] === "#",
    canPave: (x, y) => rows[y]?.[x] === ".",
  });
  // 남쪽 끝으로만 나가는 두 칸 폭 길(12×10).
  const SOUTH_ROAD = ["............", "............", "............", "............", "....##......", "....##......", "....##......", "....##......", "....##......", "....##......"];
  const withColumn = (rows: readonly string[], x: number, cell: (y: number) => string): string[] => rows.map((row, y) => row.slice(0, x) + cell(y) + row.slice(x + 1));
  describe("composerExitRoads", () => {
    it("이미 길이 닿은 변에는 아무것도 내지 않는다", () => {
      expect(roadReachesEdge(board(SOUTH_ROAD), "south")).toBe(true);
      expect(roadReachesEdge(board(SOUTH_ROAD), "east")).toBe(false);
      expect(exitRoadCells(board(SOUTH_ROAD), "south")).toEqual([]);
    });

    it("길 그물에서 그 변의 가장자리까지 두 칸 폭의 곧은 띠를 낸다", () => {
      const cells = exitRoadCells(board(SOUTH_ROAD), "east")!;
      expect(cells.length).toBeGreaterThanOrEqual(12);
      expect(new Set(cells.map((c) => c.y)).size).toBe(2);
      expect(Math.max(...cells.map((c) => c.x))).toBe(11);
      // 남쪽 가장자리를 따라 붙어 가지 않는다(여백).
      expect(Math.max(...cells.map((c) => c.y))).toBeLessThanOrEqual(6);
      const paved = SOUTH_ROAD.map((row, y) => [...row].map((ch, x) => (cells.some((c) => c.x === x && c.y === y) ? "#" : ch)).join(""));
      expect(roadReachesEdge(board(paved), "east")).toBe(true);
    });

    it("막힌 줄은 돌아가고, 돌아갈 틈이 없으면 내지 않는다", () => {
      const wall = withColumn(SOUTH_ROAD, 8, () => "X");
      expect(exitRoadCells(board(wall), "east")).toBeUndefined();
      const gap = withColumn(SOUTH_ROAD, 8, (y) => (y <= 1 ? "." : "X"));
      const detour = exitRoadCells(board(gap), "east")!;
      expect(detour.some((c) => c.y === 0)).toBe(true);
      expect(detour.every((c) => gap[c.y]![c.x] === ".")).toBe(true);
    });

    it("흩어 둔 소품은 지나가며 걷을 번호를 돌려준다", () => {
      const rows = withColumn(SOUTH_ROAD, 8, (y) => (y === 4 || y === 5 ? "T" : "X"));
      expect(exitRoadCells(board(rows), "east")).toBeUndefined();
      const road = exitRoadThroughWild(board(rows), "east", [{ x: 8, y: 4, w: 1, h: 2 }, { x: 1, y: 1, w: 1, h: 1 }])!;
      expect(road.drop).toEqual([0]);
      expect(road.cells.filter((c) => c.x === 8).map((c) => c.y).sort()).toEqual([4, 5]);
    });
  });
});

describe("concepts", () => {
  isolateTimers();
  const RAW = {
    slug: "body-swap-villainess",
    title: "몸이 뒤바뀐 악역영애",
    hook: "처형 3일 전, 눈을 떠 보니 그 아이의 몸이었다.",
    description: "왕립 아카데미 무도회에서 시작하는 뒤바뀐 두 사람의 이야기.",
    tags: ["웹소설", "연애"],
    presetId: "story-cutscene",
    protagonist: "악역영애(평민 소녀의 몸)",
    stage: "왕립 아카데미",
    firstScene: "무도회장 거울 앞",
    brief: { experience: "뒤바뀐 몸으로 처형을 피한다", activity: "대화·조사", progression: "3일 카운트다운", detail: "거울·무도회", scope: "첫날 밤까지" },
    thumb: { full: "/assets/concepts/body-swap-villainess.full.webp", card: "/assets/concepts/body-swap-villainess.card.webp" },
    source: "official",
    aiGenerated: true,
  };
  describe("concept format", () => {
    it("normalizes a valid concept", () => {
      const concept = normalizeGameConcept(RAW);
      expect(concept.presetId).toBe("story-cutscene");
      expect(concept.tags).toEqual(["웹소설", "연애"]);
      expect(concept.aiGenerated).toBe(true);
    });

    it("rejects unknown preset, tag, too-long title and an empty brief slot", () => {
      expect(() => normalizeGameConcept({ ...RAW, presetId: "rts" })).toThrow();
      expect(() => normalizeGameConcept({ ...RAW, tags: ["없는분류"] })).toThrow();
      expect(() => normalizeGameConcept({ ...RAW, title: "가".repeat(41) })).toThrow();
      expect(() => normalizeGameConcept({ ...RAW, brief: { ...RAW.brief, scope: "" } })).toThrow();
      expect(() => normalizeGameConcept({ ...RAW, slug: "Bad Slug" })).toThrow();
    });

    it("offers the user's categories", () => {
      for (const tag of ["웹소설", "패러디", "퓨전 사극", "정통 JRPG", "몬스터 수집", "추리", "연애", "호러", "힐링"]) {
        expect(CONCEPT_TAGS).toContain(tag);
      }
    });

    it("makes ascii kebab slugs, also for hangul-only titles", () => {
      expect(conceptSlug("마법사 in 조선")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(conceptSlug("몸이 뒤바뀐 악역영애")).toMatch(/^concept-[a-z0-9]{6}$/);
      expect(conceptSlug("같은 제목", "a")).not.toBe(conceptSlug("같은 제목", "b"));
    });
  });
  describe("conceptBrief", () => {
    it("maps the five brief slots and survives brief normalization", () => {
      const brief = conceptBrief(normalizeGameConcept(RAW));
      expect(brief.presetId).toBe("story-cutscene");
      expect(brief.answers.experience.text).toBe("뒤바뀐 몸으로 처형을 피한다");
      expect(brief.answers.experience.source).toBe("recommended");
      expect(brief.concept).toEqual({ slug: "body-swap-villainess", title: "몸이 뒤바뀐 악역영애", hook: RAW.hook });
      expect(normalizeGameDesignBrief(brief)).toEqual(brief);
    });

    it("keeps a cleaned 300-char tweak as the last summary line", () => {
      const brief = conceptBrief(normalizeGameConcept(RAW), "  주인공을 고양이로\n<b>x</b>" + "가".repeat(400));
      const last = brief.summary.split("\n").at(-1)!;
      expect(last.startsWith("사용자 변경: 주인공을 고양이로 <b>x</b>")).toBe(true);
      expect(brief.concept!.tweak!.length).toBe(300);
      expect(normalizeGameDesignBrief(brief).concept!.tweak).toBe(brief.concept!.tweak);
    });

    it("keeps the tweak even when the brief slots are at their limit", () => {
      const long = { ...RAW, brief: Object.fromEntries(Object.keys(RAW.brief).map((slot) => [slot, "나".repeat(1000)])) };
      const brief = conceptBrief(normalizeGameConcept(long), "엔딩은 해피엔딩");
      expect(brief.summary.length).toBeLessThanOrEqual(4000);
      expect(brief.summary.endsWith("사용자 변경: 엔딩은 해피엔딩")).toBe(true);
      expect(() => normalizeGameDesignBrief(brief)).not.toThrow();
    });
  });
  describe("concept art", () => {
    it("carries the SNES pixel contract and the no-text rule", () => {
      const prompt = conceptArtPrompt(normalizeGameConcept(RAW));
      expect(prompt).toContain("16-bit SNES");
      expect(prompt).toContain("No letters");
    });

    it("flags original IP names and passes parody names", () => {
      expect(conceptForbiddenNameHits("TS 말포이와 호그와트")).toEqual(["호그와트", "말포이"]);
      expect(conceptForbiddenNameHits("TS 금발 라이벌 도련님")).toEqual([]);
      expect(conceptForbiddenNameHits("파이널 판타지아 999")).toEqual([]);
      expect(conceptForbiddenNameHits("파이널 판타지 999")).toEqual(["파이널 판타지"]);
    });
  });
});
