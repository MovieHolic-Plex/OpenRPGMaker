import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { projectJsonWithoutEventDrafts, projectWithoutEventDrafts } from "@/project/eventDrafts";
import type { GameEvent, Project, GameMap, PassFlag, TileAiMetadata, TilesetDef, ActorQueryCondition, DailyWeatherConfig } from "@/project/types";
import { projectRecoveredPathFromHref } from "@/project/projectRecoveryLocation";
import { deserialize, serialize } from "@/project/io";
import { applyCharacterGraphicsImport, exportCharacterGraphics, listCharacterSprites, listCharacterFaces, NPC_FACE_MAPPING_SCHEMA, parseCharacterGraphicsImport, seedGraphicAttributes } from "@/project/characterGraphics";
import { counterReachTarget, deriveCounterTiles, effectiveCounterTiles, isCounterCell, setCounterTile } from "@/project/counterTiles";
import { npcMoveDurationMs, npcMoveIntervalMs, npcWalkFrameMsForStep, PLAYER_WALK_STEP_MS } from "@/project/characterMotion";
import { clampCinematicTextSize, parseCinematicPresentation, hasAuthoredTextOpening } from "@/project/cinematicPresentation";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { readFileSync } from "node:fs";
import { gameOverOutcome, resolveGameOverSettings } from "@/project/cinematicSettings";
import { gameOverReferenceCounts } from "@/project/gameOverLibrary";
import { startSession } from "@/project/session";
import { createInterpreter } from "@/player/interpreter";
import { createDefeatRecovery } from "@/player/defeatRecovery";
import { DEFAULT_RELATIONSHIP_STATE, evalRelationshipCondition, getRelationshipState, normalizeRelationships, RELATIONSHIP_STATES, relationshipRank, setRelationshipState, type RelationshipHost } from "@/project/relationshipState";
import { CONDITION_KINDS } from "@/project/commandKindRegistry";
import { exitRoadCells, exitRoadThroughWild, roadReachesEdge, type ExitRoadBoard } from "@/project/composerExitRoads";
import { evalActorQueryCondition, type ActorQuerySession } from "@/project/conditionActorQueries";
import { canCraft, craftRecipe } from "@/project/craftRecipes";
import { applyDailyWeatherForDate, dailyWeatherForecast, resolveDailyWeatherForDate } from "@/project/dailyWeather";
import { isolateTimers } from "./mergedTeardown";

describe("projectJsonWithoutEventDrafts", () => {
  isolateTimers();
  function makeEvent(id: string, x: number): GameEvent {
    return {
      id,
      x,
      y: 1,
      trigger: { kind: "action" },
      commands: [{ kind: "text", text: `body of ${id}` }],
    } as unknown as GameEvent;
  }
  /** 원본 깊은복제 경로와 **바이트 단위로 같은 JSON** 이어야 한다. */
  function expectSameJson(project: Project): void {
    expect(projectJsonWithoutEventDrafts(project)).toBe(JSON.stringify(projectWithoutEventDrafts(project)));
  }
  describe("projectJsonWithoutEventDrafts", () => {
    it("matches the deep-clone projection when no event carries a draft", () => {
      const project = createBlankProject();
      project.maps[project.startMapId].events = [makeEvent("event_a", 1), makeEvent("event_b", 2)];
      expectSameJson(project);
    });

    it("matches the deep-clone projection for new drafts, edit drafts and plain events", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const edited = makeEvent("event_edit", 3);
      const original = makeEvent("event_edit", 3);
      project.maps[mapId].events = [
        makeEvent("event_plain", 1),
        { ...makeEvent("event_new", 2), draft: { kind: "new" } } as GameEvent,
        { ...edited, commands: [{ kind: "text", text: "working body" }], draft: { kind: "edit", original } } as unknown as GameEvent,
        { ...makeEvent("event_edit_no_original", 4), draft: { kind: "edit" } } as unknown as GameEvent,
      ];
      expectSameJson(project);
    });

    it("matches the deep-clone projection across several maps where only one holds drafts", () => {
      const project = createBlankProject();
      const first = project.startMapId;
      project.maps[first].events = [makeEvent("event_plain", 1)];
      project.maps.map_second = structuredClone(project.maps[first]);
      project.maps.map_second.id = "map_second";
      project.maps.map_second.events = [
        { ...makeEvent("event_new", 2), draft: { kind: "new" } } as GameEvent,
      ];
      expectSameJson(project);
    });

    // 이 함수의 존재 이유 자체 — 드래그 한 번에 2~3회 도는 경로에서 프로젝트 전체 복제는
    // 120x100 맵 기준 비용의 62%였다(.probe/attribute-paint.json).
    it("does not deep-clone the project", () => {
      const project = createBlankProject();
      project.maps[project.startMapId].events = [
        makeEvent("event_plain", 1),
        { ...makeEvent("event_new", 2), draft: { kind: "new" } } as GameEvent,
      ];
      // #5300 부터 빈 프로젝트의 번들 타일셋은 처음 읽을 때 만들어진다(만들 때 structuredClone). 예전처럼 만들어 둔 뒤에
      // 재야 «이 함수가 프로젝트를 깊게 복제하지 않는다» 만 잔다(ci-full 46024239707).
      void Object.values(project.tilesets);
      const clone = vi.spyOn(globalThis, "structuredClone");
      projectJsonWithoutEventDrafts(project);
      expect(clone).not.toHaveBeenCalled();
      clone.mockRestore();
    });

    it("leaves the caller's project untouched", () => {
      const project = createBlankProject();
      project.maps[project.startMapId].events = [
        { ...makeEvent("event_new", 2), draft: { kind: "new" } } as GameEvent,
      ];
      const before = JSON.stringify(project);
      projectJsonWithoutEventDrafts(project);
      expect(JSON.stringify(project)).toBe(before);
    });
  });
});

describe("projectRecoveryLocation", () => {
  isolateTimers();
  describe("LegacyDb recovery URL", () => {
    it("leaves fresh project mode when DB connection succeeds", () => {
      expect(projectRecoveredPathFromHref("http://127.0.0.1:5194/?freshProject=1")).toBe("/?projectRecovered=1");
    });

    it("preserves unrelated params and hash while enabling canonical LegacyDb load", () => {
      expect(projectRecoveredPathFromHref("http://127.0.0.1:5194/?freshProject=1&zoom=2#map")).toBe(
        "/?zoom=2&projectRecovered=1#map",
      );
    });
  });
});

describe("projectSuite", () => {
  isolateTimers();
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
  describe("counterTilesAndWalkSpeed", () => {
    isolateTimers();
    const OPEN: PassFlag = { up: true, down: true, left: true, right: true };
    const SHUT: PassFlag = { up: false, down: false, left: false, right: false };
    function tileset(): TilesetDef {
      const meta = (label: string): TileAiMetadata => ({ label, description: "", role: "furniture" });
      return {
        id: "t", name: "t", image: { type: "bundled", id: "x" }, tileSize: 16, tilesPerRow: 8, count: 5,
        passability: [OPEN, SHUT, OPEN, SHUT, SHUT], priority: ["lower", "upper", "upper", "upper", "upper"], terrain: [0, 0, 0, 0, 0],
        tileMeta: [meta("바닥"), meta("카운터 2×1 (0,0)"), meta("카운터 2×1 (0,-1)"), meta("바 의자 (0,0)"), meta("vegetable crate")],
      } as TilesetDef;
    }
    function map(): GameMap {
      // 3×5: 0행 벽 뒤 바닥, 1행 카운터 윗면(통과), 2행 카운터 발밑(막힘), 3·4행 바닥.
      const w = 3, h = 5;
      const lower = new Array(w * h).fill(0);
      const upper = new Array(w * h).fill(-1);
      for (let x = 0; x < w; x++) { upper[1 * w + x] = 2; upper[2 * w + x] = 1; }
      return { id: "m", width: w, height: h, lowerTiles: lower, upperTiles: upper, events: [] } as unknown as GameMap;
    }
    describe("counter tiles", () => {
      it("derives blocked counter/table furniture only — not the walkable top, stools or English substrings", () => {
        expect(deriveCounterTiles(tileset())).toEqual([1]);
      });

      it("reaches the cell beyond a counter, and stops at a non-counter cell", () => {
        const t = tileset(), m = map();
        expect(isCounterCell(t, m, 1, 2)).toBe(true);
        expect(isCounterCell(t, m, 1, 1)).toBe(false);
        const hit = counterReachTarget(t, m, { x: 1, y: 2 }, { x: 0, y: -1 }, (x, y) => x === 1 && y === 1);
        expect(hit).toEqual({ x: 1, y: 1 });
        // 정면이 카운터가 아니면 너머를 보지 않는다.
        expect(counterReachTarget(t, m, { x: 1, y: 3 }, { x: 0, y: -1 }, () => true)).toBeNull();
      });

      it("an explicit list wins; setCounterTile freezes the derived default first", () => {
        const t = tileset();
        expect(setCounterTile(t, 4, true)).toBe(true);
        expect(t.counterTiles).toEqual([1, 4]);
        setCounterTile(t, 1, false);
        setCounterTile(t, 4, false);
        expect(effectiveCounterTiles(t)).toEqual([]);
        expect(counterReachTarget(t, map(), { x: 1, y: 2 }, { x: 0, y: -1 }, () => true)).toBeNull();
      });
    });
    describe("NPC walk speed table", () => {
      it("normal NPC (3) walks at half the player's pace; chaser ranks 6-8 are unchanged", () => {
        expect(npcMoveDurationMs(3)).toBe(PLAYER_WALK_STEP_MS * 2);
        expect(npcMoveDurationMs(6)).toBe(160);
        expect(npcMoveDurationMs(7)).toBe(80);
        expect(npcMoveDurationMs(8)).toBe(80);
        for (let r = 1; r < 8; r++) expect(npcMoveDurationMs(r)).toBeGreaterThanOrEqual(npcMoveDurationMs(r + 1));
        expect(npcMoveIntervalMs(3)).toBe(560);
      });

      it("shows two walk patterns per tile so feet follow travel speed", () => {
        expect(npcWalkFrameMsForStep(npcMoveDurationMs(3))).toBe(160);
        expect(npcWalkFrameMsForStep(80)).toBe(60);
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
  describe("gameOverLibrary", () => {
    isolateTimers();
    function fixture() {
      const p = deserialize(readFileSync(new URL("./fixtures/projects/editor-authored-demo-v3.json", import.meta.url), "utf8"));
      p.system.gameOver = { title: "Legacy" };
      p.system.gameOvers = [
        { id: "caught", name: "Caught", settings: { presentation: "horror", outcome: "menu", title: "Caught", timing: { silenceMs: 1200 }, sequence: { enabled: false, skippable: false, scenes: [{ id: "last", kind: "text", narration: "Last light", durationMs: 0 }] } } },
        { id: "recover", name: "Defeated", settings: { presentation: "horror", outcome: "recover", recovery: { mapId: p.startMapId, x: 14, y: 20 } } },
        { id: "timeout", name: "Time is up", settings: { presentation: "blackout", outcome: "title", message: "Too late" } },
      ];
      p.system.defaultGameOverId = "caught";
      return p;
    }
    describe("authored game-over library", () => {
      it("round-trips all definitions and selects explicit IDs independently of the default", () => {
        const p = fixture(), restored = deserialize(serialize(p));
        expect(restored.system.gameOvers).toEqual(p.system.gameOvers);
        expect(resolveGameOverSettings(restored.system)?.title).toBe("Caught");
        expect(gameOverOutcome(resolveGameOverSettings(restored.system, "recover"))).toBe("recover");
        expect(gameOverOutcome(resolveGameOverSettings(restored.system, "timeout"))).toBe("title");
        expect(resolveGameOverSettings(restored.system, "missing")).toBeUndefined();
        delete restored.system.defaultGameOverId;
        expect(resolveGameOverSettings(restored.system)?.title).toBe("Legacy");
        expect(gameOverOutcome({ presentation: "blackout" })).toBe("recover");
      });
      it.each(["gameOver", "killPlayer"] as const)("hands %s's ID to the terminal and stops later commands", kind => {
        const p = fixture(), s = startSession(p);
        const interpreter = createInterpreter([{ kind, gameOverId: "recover" }, { kind: "setVariable", variableId: "var_lantern_shards", op: "=", value: 777 }], s, p);
        expect(interpreter.start()).toMatchObject({ kind: "gameOver", gameOverId: "recover" });
        expect(interpreter.resume(undefined)).toEqual({ kind: "done" });
        expect(s.variables.var_lantern_shards).not.toBe(777);
        const recovered = createDefeatRecovery(p, s, resolveGameOverSettings(p.system, "recover"));
        expect(recovered).toMatchObject({ x: 14, y: 20 });
      });
      it("counts nested event references and rejects dangling IDs on load", () => {
        const p = fixture(), event = p.maps[p.startMapId].events[0];
        event.pages[0].commands = [{ kind: "gameOver", gameOverId: "caught" }];
        expect(gameOverReferenceCounts(p).get("caught")).toBeGreaterThan(0);
        p.system.gameOvers = p.system.gameOvers!.filter(row => row.id !== "caught");
        delete p.system.defaultGameOverId;
        expect(() => deserialize(serialize(p))).toThrow();
      });
      it.each([
        { defaultGameOverId: "missing" },
        { gameOvers: [{ id: "x", name: "X", settings: {} }, { id: "x", name: "Y", settings: {} }] },
        { gameOvers: [{ id: "x", name: "", settings: {} }] },
        { gameOvers: [{ id: "x", name: "X", settings: { timing: { fadeOutMs: -1 } } }] },
        { gameOvers: [{ id: "x", name: "X", settings: { musicResourceId: "missing" } }] },
      ])("rejects invalid library data %j", patch => {
        const p = fixture(); Object.assign(p.system, patch);
        expect(() => deserialize(JSON.stringify(p))).toThrow();
      });
    });
  });
  describe("relationshipState", () => {
    isolateTimers();
    describe("관계 상태 권위", () => {
      it("없으면 관계 없음으로 파생된다", () => {
        expect(getRelationshipState({}, "npc_a")).toBe("single");
        expect(getRelationshipState({ relationships: {} }, "npc_a")).toBe("single");
        expect(DEFAULT_RELATIONSHIP_STATE).toBe("single");
      });

      it("단계가 순서를 가진다", () => {
        expect(RELATIONSHIP_STATES).toEqual(["single", "dating", "engaged", "married"]);
        expect(relationshipRank("single")).toBeLessThan(relationshipRank("dating"));
        expect(relationshipRank("dating")).toBeLessThan(relationshipRank("engaged"));
        expect(relationshipRank("engaged")).toBeLessThan(relationshipRank("married"));
      });

      it("기본값으로 되돌리면 항목을 남기지 않는다", () => {
        const host: RelationshipHost = {};
        setRelationshipState(host, "npc_a", "married");
        expect(host.relationships).toEqual({ npc_a: "married" });
        setRelationshipState(host, "npc_a", "single");
        expect(host.relationships).toEqual({});
      });

      it("빈 키는 저장하지 않는다", () => {
        const host: RelationshipHost = {};
        setRelationshipState(host, "   ", "married");
        expect(host.relationships ?? {}).toEqual({});
      });

      it("이상 비교는 단계 순서를 따른다", () => {
        const host: RelationshipHost = { relationships: { npc_a: "engaged" } };
        for (const [state, expected] of [
          ["single", true],
          ["dating", true],
          ["engaged", true],
          ["married", false],
        ] as const) {
          expect(evalRelationshipCondition(host, { kind: "relationshipAtLeast", state }, "npc_a")).toBe(expected);
        }
      });

      it("키가 없으면 닫힌 채로 거짓이다", () => {
        const host: RelationshipHost = { relationships: { npc_a: "married" } };
        expect(evalRelationshipCondition(host, { kind: "relationshipAtLeast", state: "dating" }, null)).toBe(false);
      });

      /* 열거 밖 문자열을 통과시키면 relationshipRank 가 -1 을 돌려 모든 이상 비교가 참이 된다.
         문자열 상태에는 수치의 clamp 대응물이 없으므로 정규화가 유일한 방어선이다. */
      it("낡거나 적대적인 세이브 값은 버린다", () => {
        expect(normalizeRelationships({ npc_a: "maried", npc_b: "dating" })).toEqual({ npc_b: "dating" });
        expect(normalizeRelationships({ npc_a: 3 })).toEqual({});
        expect(normalizeRelationships({ "  ": "married" })).toEqual({});
        expect(normalizeRelationships({ npc_a: "single" })).toEqual({});
        expect(normalizeRelationships("nope")).toBeUndefined();
      });

      it("버려진 값은 조건을 참으로 만들지 않는다", () => {
        const host: RelationshipHost = { relationships: normalizeRelationships({ npc_a: "maried" }) };
        expect(evalRelationshipCondition(host, { kind: "relationshipAtLeast", state: "married" }, "npc_a")).toBe(false);
        expect(getRelationshipState(host, "npc_a")).toBe("single");
      });

      it("조건 종류가 레지스트리에 등록돼 있다", () => {
        expect(CONDITION_KINDS).toContain("relationshipAtLeast");
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
  describe("eventSightWatchers", () => {
    isolateTimers();
    // 벽 x=3(문틈 y=5), 경비 둘이 서로 마주 본다, 문 이벤트가 문틈에 선다.
    const wall = (x: number, y: number): boolean => x === 3 && y >= 0 && y <= 9 && y !== 5;
    const events = [
      { id: "guard_a", name: "성문 경비", characterId: "guard", x: 1, y: 5, commands: [] },
      { id: "guard_b", name: "성문 경비", characterId: "guard", x: 8, y: 5, commands: [] },
      { id: "door", name: "문", x: 3, y: 5, commands: [{ kind: "transfer", mapId: "m", x: 0, y: 0 }] },
    ];
    const positions: Record<string, { x: number; y: number; direction?: "left" | "right" }> = {
      guard_a: { x: 1, y: 5, direction: "right" },
      guard_b: { x: 8, y: 5, direction: "left" },
      door: { x: 3, y: 5 },
    };
    const NIGHT = { hour: 23, minute: 0, day: 1, season: "spring" as const, year: 1 };
    const NOON = { hour: 12, minute: 0, day: 1, season: "spring" as const, year: 1 };
    function sees(condition: Partial<Extract<ActorQueryCondition, { kind: "eventSeesPlayer" }>>, x: number, y: number, extra: Partial<ActorQuerySession> = {}, ambient?: number): boolean {
      const session: ActorQuerySession = { partyActorIds: [], actorVitals: {}, x, y, flags: {}, currentMapId: "m", ...extra };
      return evalActorQueryCondition(session, { kind: "eventSeesPlayer", eventId: "", ...condition } as ActorQueryCondition, {}, {
        eventPosition: (id) => positions[id],
        blocksSight: wall,
        mapEvents: () => events,
        ambient: () => ambient,
        locations: () => [],
      });
    }
    describe("eventSeesPlayer optional fields", () => {
      it("keeps the old outcome when no new field is set", () => {
        expect(sees({ eventId: "guard_a", range: 5 }, 2, 5)).toBe(true);
        expect(sees({ eventId: "guard_a", range: 5 }, 5, 5)).toBe(true);
        expect(sees({ eventId: "guard_a", range: 5 }, 4, 3)).toBe(false);
        expect(sees({ eventId: "guard_a", range: 2 }, 4, 5)).toBe(false);
        expect(sees({ eventId: "guard_b", range: 5 }, 6, 5, { gameTime: NIGHT }, 0.9)).toBe(true);
      });

      it("doorsBlock closes the door gap", () => {
        expect(sees({ eventId: "guard_a", range: 5, doorsBlock: true }, 5, 5)).toBe(false);
      });

      it("darkness shortens sight only at night or in the dark", () => {
        expect(sees({ eventId: "guard_b", range: 5, darkness: { dark: 1 } }, 6, 5, {}, 0.9)).toBe(false);
        expect(sees({ eventId: "guard_b", range: 5, darkness: { dark: 1 } }, 6, 5, {}, 0.2)).toBe(true);
        expect(sees({ eventId: "guard_b", range: 5, darkness: { night: 1 } }, 6, 5, { gameTime: NIGHT })).toBe(false);
        expect(sees({ eventId: "guard_b", range: 5, darkness: { night: 1 } }, 6, 5, { gameTime: NOON })).toBe(true);
      });

      it("watchers pick anyone matching; not-seen means nobody sees", () => {
        expect(sees({ watchers: { name: "경비" }, range: 5 }, 7, 5)).toBe(true);
        expect(sees({ watchers: { characterId: "guard" }, range: 5 }, 2, 5)).toBe(true);
        expect(sees({ watchers: { name: "기사" }, range: 5 }, 7, 5)).toBe(false);
        expect(sees({ watchers: { name: "경비" }, range: 5, value: false }, 4, 0)).toBe(true);
        expect(sees({ watchers: { name: "경비" }, range: 5, value: false }, 7, 5)).toBe(false);
      });
    });
  });
  describe("cookingStation", () => {
    isolateTimers();
    const FRIED_EGG = {
      id: "recipe_fried_egg",
      name: "계란프라이",
      ingredients: [{ itemId: "item_egg", count: 2 }],
      outputItemId: "item_fried_egg",
      outputCount: 1,
      goldCost: 10,
    };
    function projectWithRecipe(): Project {
      const project = createBlankProject();
      const itemTemplate = project.database.items[0];
      if (!itemTemplate) throw new Error("blank project must include an item template");
      project.database.items.push(
        { ...itemTemplate, id: "item_egg", name: "달걀" },
        { ...itemTemplate, id: "item_fried_egg", name: "계란프라이" },
      );
      project.system.craftRecipes = [FRIED_EGG];
      return project;
    }
    describe("요리 레시피", () => {
      it("재료와 골드가 충분하면 제작되고 인벤토리가 정확히 갱신된다", () => {
        const project = projectWithRecipe();
        const session = startSession(project, 1);
        session.inventory.item_egg = 3;
        session.gold = 100;

        const result = craftRecipe(project, session, "recipe_fried_egg");
        expect(result.ok).toBe(true);
        expect(session.inventory.item_egg).toBe(1);
        expect(session.inventory.item_fried_egg).toBe(1);
        expect(session.gold).toBe(90);
      });

      it("재료가 모자라면 실패하고 인벤토리·골드가 변하지 않는다", () => {
        const project = projectWithRecipe();
        const session = startSession(project, 1);
        session.inventory.item_egg = 1;
        session.gold = 100;

        expect(craftRecipe(project, session, "recipe_fried_egg")).toEqual({ ok: false, reason: "missing-ingredients" });
        expect(session.inventory.item_egg).toBe(1);
        expect(session.inventory.item_fried_egg ?? 0).toBe(0);
        expect(session.gold).toBe(100);
      });

      it("골드가 모자라면 실패하고 재료가 소비되지 않는다", () => {
        const project = projectWithRecipe();
        const session = startSession(project, 1);
        session.inventory.item_egg = 3;
        session.gold = 5;

        expect(craftRecipe(project, session, "recipe_fried_egg")).toEqual({ ok: false, reason: "missing-gold" });
        expect(session.inventory.item_egg).toBe(3);
      });

      it("레시피가 없으면 시스템 자체가 비활성으로 보고된다(옵트인)", () => {
        const project = createBlankProject();
        const session = startSession(project, 1);
        expect(canCraft(project, session, "recipe_fried_egg")).toEqual({ ok: false, reason: "disabled" });
      });

      it("craftRecipes 가 저장/로드 왕복에서 보존된다", () => {
        const loaded = deserialize(serialize(projectWithRecipe()));
        expect(loaded.system.craftRecipes?.[0]).toMatchObject({ id: "recipe_fried_egg", outputItemId: "item_fried_egg" });
      });
    });
  });
  describe("p1WeatherCalendar", () => {
    isolateTimers();
    function weatherProject(): Project {
      const project = createBlankProject();
      project.system.timeSystem = { enabled: true, daysPerSeason: 28 };
      project.system.dailyWeather = {
        enabled: true,
        forecastDays: 3,
        seasons: {
          spring: [{ kind: "rain", weight: 1, intensity: 0.4 }],
          summer: [{ kind: "storm", weight: 1, intensity: 0.8 }],
          fall: [{ kind: "fog", weight: 1 }],
          winter: [{ kind: "snow", weight: 1, intensity: 0.6 }],
        },
      };
      return project;
    }
    describe("P1 deterministic daily weather", () => {
      it("derives the same authored outcome from only the session seed and calendar day key", () => {
        // Break caught: weather selection consumes a mutable RNG stream or ignores the calendar date.
        const project = weatherProject();
        project.system.dailyWeather = {
          enabled: true,
          seasons: {
            spring: [
              { kind: "none", weight: 1 },
              { kind: "rain", weight: 1, intensity: 0.7 },
              { kind: "storm", weight: 1, intensity: 0.9 },
            ],
          },
        };
        const date = { year: 2, season: "spring" as const, day: 7, hour: 6, minute: 0 };

        expect(resolveDailyWeatherForDate(project, 1234, date)).toEqual(
          resolveDailyWeatherForDate(project, 1234, date),
        );
        expect(new Set(
          Array.from({ length: 32 }, (_, index) => resolveDailyWeatherForDate(project, index + 1, date).kind),
        ).size).toBeGreaterThan(1);
        expect(new Set(
          Array.from({ length: 28 }, (_, index) => resolveDailyWeatherForDate(
            project,
            1234,
            { ...date, day: index + 1 },
          ).kind),
        ).size).toBeGreaterThan(1);
      });

      it("forecasts future days across season and year boundaries without consuming RNG state", () => {
        // Break caught: forecast calls perturb encounter/battle/movement/misc streams or include today twice.
        const project = weatherProject();
        const session = startSession(project, 20260825);
        const rngBefore = structuredClone(session.rng);

        const springBoundary = dailyWeatherForecast(project, session, {
          year: 1,
          season: "spring",
          day: 27,
          hour: 22,
          minute: 30,
        });
        expect(springBoundary).toEqual([
          { dayKey: "1:spring:28", kind: "rain", intensity: 0.4 },
          { dayKey: "1:summer:1", kind: "storm", intensity: 0.8 },
          { dayKey: "1:summer:2", kind: "storm", intensity: 0.8 },
        ]);

        const winterBoundary = dailyWeatherForecast(project, session, {
          year: 1,
          season: "winter",
          day: 28,
          hour: 6,
          minute: 0,
        });
        expect(winterBoundary[0]).toEqual({ dayKey: "2:spring:1", kind: "rain", intensity: 0.4 });
        expect(session.rng).toEqual(rngBefore);
        expect(dailyWeatherForecast(project, session, {
          year: 1,
          season: "spring",
          day: 27,
          hour: 6,
          minute: 0,
        })).toEqual(springBoundary);
        expect(session.rng).toEqual(rngBefore);
      });

      it("applies one current-day result without changing any RNG stream", () => {
        // Break caught: applying the current day advances a session stream and later forecasts change the result.
        const project = weatherProject();
        const session = startSession(project, 99);
        const rngBefore = structuredClone(session.rng);
        const date = { year: 1, season: "summer" as const, day: 3, hour: 6, minute: 0 };

        const applied = applyDailyWeatherForDate(project, session, date);
        dailyWeatherForecast(project, session, date);
        dailyWeatherForecast(project, session, date);

        expect(applied).toEqual({ dayKey: "1:summer:3", kind: "storm", intensity: 0.8 });
        expect(session.dailyWeather).toEqual(applied);
        expect(session.rng).toEqual(rngBefore);
        expect(applyDailyWeatherForDate(project, session, date)).toEqual(applied);
        expect(session.rng).toEqual(rngBefore);
      });

      it("fails closed to clear weather for empty, all-zero, and malformed direct inputs", () => {
        // Break caught: an invalid/all-zero table divides by zero, selects an invalid row, or loops unbounded.
        const project = weatherProject();
        project.system.dailyWeather = {
          enabled: true,
          forecastDays: Number.POSITIVE_INFINITY,
          seasons: {
            spring: [
              { kind: "rain", weight: 0, intensity: 0.9 },
              { kind: "storm", weight: -5, intensity: Number.NaN },
              { kind: "meteor", weight: 10, intensity: 1 },
              { kind: "snow", weight: Number.POSITIVE_INFINITY, intensity: 1 },
            ],
          },
        } as unknown as DailyWeatherConfig;
        const session = startSession(project, 7);
        const date = { year: 1, season: "spring" as const, day: 1, hour: 6, minute: 0 };

        expect(resolveDailyWeatherForDate(project, session.rng!.seed, date)).toEqual({
          dayKey: "1:spring:1",
          kind: "none",
          intensity: 0,
        });
        expect(dailyWeatherForecast(project, session, date)).toHaveLength(1);

        project.system.dailyWeather = { enabled: false, seasons: {} };
        session.dailyWeather = { dayKey: "1:spring:1", kind: "rain", intensity: 1 };
        expect(applyDailyWeatherForDate(project, session, date)).toBeUndefined();
        expect(session.dailyWeather).toBeUndefined();
        expect(dailyWeatherForecast(project, session, date)).toEqual([]);
      });
    });
  });
});
