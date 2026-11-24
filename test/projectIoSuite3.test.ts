import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { store } from "@/project/store";
import { buildChangeLedger } from "@/project/changeLedger";
import { validateMaps } from "@/project/io/shapeEventFields";
import { deserialize, serialize, serializePretty } from "@/project/io";
import { recordMapEditIfChanged, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { projectLint } from "@/project/lint/projectLint";
import { evalCondition, type PlaySession } from "@/project/session";
import { resolveEventPage } from "@/project/io/pageResolution";
import { validateMonsterSpeciesReferences } from "@/project/io/commandReferenceValidation";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import type { Condition, EventPage, GameEvent, Project, SpriteDef } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { validateSystem } from "@/project/io/shapeDatabaseFields";
import { SE_CUE_IDS, footstepCueForTerrain, isSeCueId, magicCueForElement, normalizeSeCues, projectSeCue, seCueFallbacks } from "@/project/seCues";
import { SYSTEM_SE_CUES } from "@/project/systemAudioOverrides";
import { authoredBattleCue, skillSeCue } from "@/player/battleJuice";
import { emitRuntimeJuice } from "@/player/runtimeJuice";
import { FOOTSTEP_MIN_INTERVAL_MS, footstepResourceAt, playFootstep, resetFootstepClock } from "@/player/footsteps";
import { ProjectFormatError } from "@/project/io/errors";
import { validateAssets } from "@/project/io/shapeResourceFields";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { setCharacterBaseOrigin } from "@/player/characterOrigin";
import { applyCharacterLift, clearCharacterLift } from "@/player/characterHop";
import { placeCharacterSprite } from "@/player/characterDepth";
import { isolateTimers } from "./mergedTeardown";

describe("mapLayersPersistence", () => {
  isolateTimers();
  beforeEach(() => {
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  function authorAllLayers(): string {
    const id = store.getCurrent().startMapId;
    store.updateMapTiles(id, (m) => {
      setLayerTileAt(m, 2, 0, 5);
      setLayerTileAt(m, 2, m.width + 2, 7);
      setLayerTileAt(m, 4, 1, 6);
      setShadowAt(m, 2, 3);
      setShadowAt(m, m.width * m.height - 1, 15);
    });
    return id;
  }
  describe("새 층 칸 — 저장 왕복", () => {
    it("serialize → deserialize 가 세 선택 층을 그대로 되살린다", () => {
      const id = authorAllLayers();
      const project = store.getCurrent();
      const loaded = deserialize(serialize(project));
      expect(loaded.maps[id]).toEqual(project.maps[id]);
      expect(loaded.maps[id].lowerOverlayTiles).toEqual(project.maps[id].lowerOverlayTiles);
      expect(loaded.maps[id].upperOverlayTiles).toEqual(project.maps[id].upperOverlayTiles);
      expect(loaded.maps[id].shadowBits).toEqual(project.maps[id].shadowBits);
      expect(deserialize(serialize(loaded))).toEqual(loaded);
    });

    it("1층을 칠하고 되돌리면 2층·4층·그림자가 그대로다", () => {
      const id = authorAllLayers();
      const before = structuredClone(store.getCurrent().maps[id]);
      expect(recordMapEditIfChanged(id, () => {
        store.updateMapTiles(id, (m) => { setLayerTileAt(m, 1, 0, 3); setLayerTileAt(m, 1, 1, 3); });
      })).toBe(true);
      expect(layerTileAt(store.getCurrent().maps[id], 1, 0)).toBe(3);
      expect(undoMapEdit()).toBe(true);
      const after = store.getCurrent().maps[id];
      expect(after.lowerTiles).toEqual(before.lowerTiles);
      expect(after.lowerOverlayTiles).toEqual(before.lowerOverlayTiles);
      expect(after.upperOverlayTiles).toEqual(before.upperOverlayTiles);
      expect(after.shadowBits).toEqual(before.shadowBits);
    });

    it("불러오기는 길이가 틀린 선택 층만 버리고 나머지를 연다", () => {
      const id = authorAllLayers();
      const raw = JSON.parse(serialize(store.getCurrent())) as { maps: Record<string, Record<string, unknown>> };
      raw.maps[id].upperOverlayTiles = [1, 2, 3];
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const loaded = deserialize(JSON.stringify(raw));
        expect("upperOverlayTiles" in loaded.maps[id]).toBe(false);
        expect(layerTileAt(loaded.maps[id], 2, 0)).toBe(5);
        expect(shadowAt(loaded.maps[id], 2)).toBe(3);
        expect(warn).toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it("저장 쪽 lint 왕복 검사는 길이가 틀린 선택 층을 오류로 보고한다", () => {
      const id = authorAllLayers();
      const project = structuredClone(store.getCurrent());
      project.maps[id].shadowBits = [0, 1];
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const issues = projectLint(project).filter((issue) => issue.code === "serialize-roundtrip");
        expect(issues.some((issue) => issue.message.includes("shadowBits"))).toBe(true);
      } finally {
        warn.mockRestore();
      }
    });
  });
  describe("새 층 칸 — 저장 경로", () => {
    it("updateMapTiles 는 2층·4층·그림자를 복사해 보존하고 이전 상태와 공유하지 않는다", () => {
      const id = store.getCurrent().startMapId;
      store.updateMapTiles(id, (m) => { setLayerTileAt(m, 2, 0, 5); setLayerTileAt(m, 4, 1, 6); setShadowAt(m, 2, 3); });
      const before = store.getCurrent().maps[id];
      store.updateMapTiles(id, (m) => { setLayerTileAt(m, 2, 0, 9); });
      const after = store.getCurrent().maps[id];
      expect(layerTileAt(before, 2, 0)).toBe(5);
      expect(layerTileAt(after, 2, 0)).toBe(9);
      expect(layerTileAt(after, 4, 1)).toBe(6);
      expect(shadowAt(after, 2)).toBe(3);
    });

    it("검증은 길이가 틀린 선택 칸을 경고와 함께 버리고, 맞는 칸과 1·3층은 그대로 둔다", () => {
      const project = structuredClone(store.getCurrent());
      const map = project.maps[project.startMapId];
      map.lowerOverlayTiles = new Array(map.width * map.height).fill(-1);
      map.shadowBits = new Array(map.width * map.height).fill(0);
      expect(() => validateMaps(project.maps)).not.toThrow();
      map.upperOverlayTiles = [1, 2, 3];
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(() => validateMaps(project.maps)).not.toThrow();
        expect("upperOverlayTiles" in map).toBe(false);
        expect(map.lowerOverlayTiles).toHaveLength(map.width * map.height);
        expect(warn.mock.calls.some(([message]) => /upperOverlayTiles/.test(String(message)) && String(message).includes(map.id))).toBe(true);
      } finally {
        warn.mockRestore();
      }
      map.upperTiles = [1, 2, 3];
      expect(() => validateMaps(project.maps)).toThrow(/upperTiles 길이 불일치/);
    });
  });
  describe("새 층 칸 — 변경 명세", () => {
    function mapDetail(before: ReturnType<typeof store.getCurrent>, after: ReturnType<typeof store.getCurrent>): readonly string[] {
      const entry = buildChangeLedger(before, after).entries.find((item) => item.area === "맵" && item.change === "changed");
      return entry?.detail ?? [];
    }

    it("옛 맵에 2층 한 칸을 칠하면 1칸 바뀜으로 센다", () => {
      const before = structuredClone(store.getCurrent());
      const after = structuredClone(before);
      const map = after.maps[after.startMapId];
      expect(map.lowerOverlayTiles).toBeUndefined();
      setLayerTileAt(map, 2, 0, 5);
      setShadowAt(map, 1, 2);
      const detail = mapDetail(before, after);
      expect(detail).toContain("2층 타일: 1칸 바뀜");
      expect(detail).toContain("그림자: 1칸 바뀜");
    });

    it("모두 빈 층이 지워지면 칸 수를 세지 않는다", () => {
      const before = structuredClone(store.getCurrent());
      const map = before.maps[before.startMapId];
      map.lowerOverlayTiles = new Array(map.width * map.height).fill(-1);
      map.shadowBits = new Array(map.width * map.height).fill(0);
      const after = structuredClone(before);
      delete after.maps[after.startMapId].lowerOverlayTiles;
      delete after.maps[after.startMapId].shadowBits;
      const detail = mapDetail(before, after);
      expect(detail).toContain("2층 타일: 빈 칸 정리");
      expect(detail).toContain("그림자: 빈 칸 정리");
      expect(detail.some((line) => /칸 바뀜/.test(line))).toBe(false);
    });
  });
});

describe("monsterSpeciesCondition", () => {
  isolateTimers();
  const owns: Condition = { kind: "monsterSpecies", speciesId: "merin", present: true };
  const page = (id: string, conditions: Condition[]): EventPage => ({
    id, name: id, conditions, graphic: {}, trigger: { kind: "action" },
    priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
  });
  describe("monster species event conditions", () => {
    it("selects the reward page for a boxed capture and returns to the request after release", () => {
      const session = {
        ...createBlankProject().session,
        monsterInstances: { captured: { speciesId: "merin" } },
        monsterParty: [], monsterBox: ["captured"],
      } as unknown as PlaySessionLike;
      const event: GameEvent = { id: "collector", x: 1, y: 1, trigger: { kind: "action" }, commands: [],
        pages: [page("request", []), page("reward", [owns])] };
      expect(evalCondition(session, owns)).toBe(true);
      expect(resolveEventPage(event, session)?.id).toBe("reward");
      session.monsterBox = [];
      expect(evalCondition(session, owns)).toBe(false);
      expect(resolveEventPage(event, session)?.id).toBe("request");
      expect(evalCondition(session, { ...owns, present: false })).toBe(true);
    });

    it("requires both the capture and a quest flag inside a nested condition", () => {
      const session = { ...createBlankProject().session, monsterInstances: {}, monsterParty: [], monsterBox: [],
        switches: { accepted: true } } as unknown as PlaySessionLike;
      const ready: Condition = { kind: "all", conditions: [owns, { kind: "switch", switchId: "accepted", value: true }] };
      expect(evalCondition(session, ready)).toBe(false);
      expect(evalCondition(session, { kind: "not", condition: ready })).toBe(true);
    });

    it("rejects missing species references inside nested conditions", () => {
      const nested: Condition = { kind: "not", condition: { kind: "any", conditions: [owns] } };
      expect(() => validateMonsterSpeciesReferences(nested, { speciesIds: new Set(["merin"]) })).not.toThrow();
      expect(() => validateMonsterSpeciesReferences(nested, { speciesIds: new Set() })).toThrow("merin");
    });

    it("rejects incomplete or mistyped authoring input rather than silently dropping it", () => {
      expect(() => validateConditionShape("condition", owns)).not.toThrow();
      expect(() => validateConditionShape("condition", { ...owns, speciesId: " " })).toThrow();
      expect(() => validateConditionShape("condition", { ...owns, present: "true" })).toThrow();
      expect(() => validateConditionShape("condition", { kind: "monsterSpecies", present: true })).toThrow();
    });
  });
});

describe("projectSeCues", () => {
  isolateTimers();
  function withCues(cues: Record<string, string>): Project {
    const project = createBlankProject();
    project.system.seCues = cues;
    return project;
  }
  describe("project.system.seCues 자리 표", () => {
    it("시스템 효과음 13자리가 모두 알려진 자리다(스토어 제작자 목록과 같은 id)", () => {
      for (const cue of SYSTEM_SE_CUES) expect(SE_CUE_IDS).toContain(cue);
      for (const cue of ["equip", "save", "load", "bossCollapse", "actorDamage", "cast", "levelUp", "itemGet", "magic-fire", "footstep-grass"]) expect(SE_CUE_IDS).toContain(cue);
    });

    it("모르는 자리 id 도 꼴만 맞으면 저장한다 — 새 스토어 자리에 코드 수정이 필요 없다", () => {
      expect(normalizeSeCues({ "footstep-lava": "snd_a", confirm: " snd_b ", "bad id": "x", empty: "  ", num: 3 })).toEqual({ "footstep-lava": "snd_a", confirm: "snd_b" });
      expect(normalizeSeCues({})).toBeUndefined();
      expect(isSeCueId("magic-fire")).toBe(true);
      expect(isSeCueId("Magic")).toBe(false);
    });

    it("저장 왕복: 정규화가 표를 지키고, 빈 표는 저장하지 않는다(옛 JSON 바이트)", () => {
      const project = createBlankProject();
      project.system.seCues = { save: "snd_save" };
      expect(normalizeSystemRecords(project.system).seCues).toEqual({ save: "snd_save" });
      delete project.system.seCues;
      expect("seCues" in normalizeSystemRecords(project.system)).toBe(false);
      expect(() => validateSystem({ startActorIds: [], seCues: { save: "snd_save" } })).not.toThrow();
      expect(() => validateSystem({ startActorIds: [], seCues: { "not ok": "x" } })).toThrow();
    });

    it("가족 물러섬: magic-<속성> → cast, attack-<종류> → attack", () => {
      expect(seCueFallbacks("magic-fire")).toEqual(["magic-fire", "cast"]);
      expect(seCueFallbacks("attack-blunt")).toEqual(["attack-blunt", "attack"]);
      expect(seCueFallbacks("footstep-snow")).toEqual(["footstep-snow"]);
      expect(projectSeCue(withCues({ cast: "snd_cast" }), "magic-ice")).toBe("snd_cast");
      expect(projectSeCue(withCues({ "magic-ice": "snd_ice", cast: "snd_cast" }), "magic-ice")).toBe("snd_ice");
    });

    it("기술 속성 → 마법 자리, 마력 기술은 cast", () => {
      const project = createBlankProject();
      expect(magicCueForElement("fire")).toBe("magic-fire");
      expect(magicCueForElement("x", "번개")).toBe("magic-thunder");
      expect(skillSeCue(project, { elementId: "ice", effect: { kind: "damage", statistic: "attack", affects: "hp" } })).toBe("magic-ice");
      expect(skillSeCue(project, { effect: { kind: "healing", statistic: "mind", affects: "hp" } })).toBe("cast");
      expect(skillSeCue(project, { effect: { kind: "damage", statistic: "attack", affects: "hp" } })).toBeUndefined();
    });
  });
  describe("전투 사건 → 자리: 세션 덮어쓰기 → 프로젝트 표 → 기본", () => {
    it("프로젝트 표가 기본을 대신하고, 세션 덮어쓰기가 표보다 먼저다", () => {
      const project = withCues({ damage: "snd_hit", critical: "snd_crit" });
      expect(authoredBattleCue("hit-damage", project, undefined)).toEqual({ resourceId: "snd_hit" });
      const session = { systemAudioOverrides: { se: { damage: { resourceId: "snd_session", volume: 80 } } } };
      expect(authoredBattleCue("hit-damage", project, session)).toEqual({ resourceId: "snd_session", volume: 80 });
      expect(authoredBattleCue("hit-miss", project, undefined)).toBeUndefined();
    });

    it("세션 덮어쓰기의 빈 소리는 무음(null)이다", () => {
      const session = { systemAudioOverrides: { se: { damage: { resourceId: "", volume: 100 } } } };
      expect(authoredBattleCue("hit-damage", withCues({ damage: "snd_hit" }), session)).toBeNull();
    });

    it("아군 피해는 actorDamage → damage, 보스 쓰러짐은 bossCollapse → faint 로 물러선다", () => {
      expect(authoredBattleCue("hit-actor", withCues({ damage: "snd_hit" }), undefined)).toEqual({ resourceId: "snd_hit" });
      expect(authoredBattleCue("hit-actor", withCues({ damage: "snd_hit", actorDamage: "snd_ouch" }), undefined)).toEqual({ resourceId: "snd_ouch" });
      expect(authoredBattleCue("boss-collapse", withCues({ faint: "snd_faint" }), undefined)).toEqual({ resourceId: "snd_faint" });
      expect(authoredBattleCue("boss-collapse", withCues({ faint: "snd_faint", bossCollapse: "snd_boss" }), undefined)).toEqual({ resourceId: "snd_boss" });
    });
  });
  describe("메뉴 사건 → 자리", () => {
    it("부른 쪽의 자리(save)가 사건의 기본 자리(confirm)보다 먼저, 없으면 confirm, 그것도 없으면 기본 소리", () => {
      const project = withCues({ save: "snd_save", confirm: "snd_ok" });
      expect(emitRuntimeJuice({ event: "menu-confirm", cue: "save", project }).soundResourceId).toBe("snd_save");
      expect(emitRuntimeJuice({ event: "menu-confirm", cue: "equip", project }).soundResourceId).toBe("snd_ok");
      expect(emitRuntimeJuice({ event: "menu-confirm", cue: "equip", project: createBlankProject() }).soundResourceId).toBe("easyrpg-sound-decision1");
    });

    it("메뉴 열기는 menuOpen 자리를 먼저 본다", () => {
      expect(emitRuntimeJuice({ event: "menu-open", project: withCues({ menuOpen: "snd_open", confirm: "snd_ok" }) }).soundResourceId).toBe("snd_open");
    });
  });
  describe("지형 발소리", () => {
    function steppingProject(terrain: { name: string; footstepSoundResourceId?: string }, cues?: Record<string, string>): Project {
      const project = createBlankProject();
      const map = Object.values(project.maps)[0]!;
      const tileset = project.tilesets[map.tilesetId]!;
      const tile = map.lowerTiles[0]!;
      // 그 칸의 지형 태그 1 = terrains[0]. tileMeta 칸이 이기므로 terrain 배열만 바꾸면 된다(tileMeta 가 있으면 그쪽도).
      const meta = tileset.tileMeta?.[tile];
      if (meta) meta.terrainTag = 1;
      tileset.terrain = [...(tileset.terrain ?? [])];
      tileset.terrain[tile] = 1;
      project.database.terrains = [{ id: "t1", damage: 0, encounterRatePercent: 0, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: false }, ...terrain }];
      if (cues) project.system.seCues = cues;
      return project;
    }

    it("지형 기록의 발소리 → 지형 이름의 footstep 자리 → 없음", () => {
      const at = (p: Project) => ({ mapId: Object.keys(p.maps)[0]!, x: 0, y: 0 });
      const own = steppingProject({ name: "풀밭", footstepSoundResourceId: "snd_own" }, { "footstep-grass": "snd_grass" });
      expect(footstepResourceAt(own, at(own))).toBe("snd_own");
      const named = steppingProject({ name: "풀밭" }, { "footstep-grass": "snd_grass" });
      expect(footstepResourceAt(named, at(named))).toBe("snd_grass");
      const silent = steppingProject({ name: "풀밭" });
      expect(footstepResourceAt(silent, at(silent))).toBeUndefined();
      expect(footstepCueForTerrain("눈 덮인 길")).toBe("footstep-snow");
    });

    it("발소리는 간격 안에 한 번만, 걸린 소리가 없으면 내지 않는다", () => {
      resetFootstepClock();
      const project = steppingProject({ name: "돌길", footstepSoundResourceId: "snd_step" });
      const at = { mapId: Object.keys(project.maps)[0]!, x: 0, y: 0 };
      expect(playFootstep(project, at, 1000)).toBe(true);
      expect(playFootstep(project, at, 1000 + FOOTSTEP_MIN_INTERVAL_MS - 1)).toBe(false);
      expect(playFootstep(project, at, 1000 + FOOTSTEP_MIN_INTERVAL_MS)).toBe(true);
      resetFootstepClock();
      expect(playFootstep(steppingProject({ name: "돌길" }), at, 5000)).toBe(false);
    });
  });
});

describe("serializeCompact", () => {
  isolateTimers();
  describe("project serialize wire format", () => {
    it("uses compact JSON for canonical serialize (no pretty indent)", () => {
      const project = createBlankProject();
      const wire = serialize(project);
      expect(wire.includes("\n  ")).toBe(false);
      expect(wire.startsWith("{")).toBe(true);
      expect(deserialize(wire).meta.title).toBe(project.meta.title);
    });

    it("keeps pretty serialize for human package dumps", () => {
      const project = createBlankProject();
      const pretty = serializePretty(project);
      expect(pretty.includes("\n  ")).toBe(true);
      expect(deserialize(pretty).version).toBe(project.version);
    });

    it("rejects a bad import without the raw English parser message", () => {
      let caught: unknown;
      try {
        deserialize("not json");
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ProjectFormatError);
      expect((caught as Error).message).toBe("이 파일은 프로젝트 JSON이 아닙니다.");
      expect((caught as Error).message).not.toMatch(/Unexpected token|JSON\.parse/i);
      expect((caught as { cause?: unknown }).cause).toBeInstanceOf(SyntaxError);
    });
  });
});

describe("spriteFrameAnchor", () => {
  isolateTimers();
  const action: SpriteDef = {
    id: "native-action", image: { type: "bundled", id: "native-action-sheet" },
    frames: 48, frameWidth: 48, frameHeight: 40, anchor: { x: 24, y: 31 },
  };
  describe("native action frame ground anchor", () => {
    it("preserves pixel anchor on save/load and resolves either definition or texture id", () => {
      const project = createBlankProject();
      project.assets.sprites[action.id] = structuredClone(action);
      const loaded = deserialize(serialize(project));
      expect(loaded.assets.sprites[action.id].anchor).toEqual({ x: 24, y: 31 });
      for (const id of [action.id, "native-action-sheet"]) {
        expect(resolveEventSpriteTexture(loaded, id, 47)).toEqual({
          texture: "native-action-sheet", frame: 47, origin: { x: 0.5, y: 31 / 40 },
        });
      }
    });

    it("resolves a native walking anchor for the player without applying it to a fallback", () => {
      const project = createBlankProject();
      const actor = project.database.actors[0];
      actor.characterResourceId = "native-walk";
      project.assets.uploaded["native-walk"] = { id: "native-walk", name: "Native walk", kind: "charset",
        dataUrl: "data:image/png;base64,", meta: { width: 288, height: 256 } };
      project.assets.sprites["native-walk"] = { ...action, id: "native-walk",
        image: { type: "uploaded", id: "native-walk" }, frames: 96,
        frameWidth: 24, frameHeight: 32, anchor: { x: 12, y: 31 } };
      const session = { ...project.session, partyActorIds: [actor.id] } as PlaySession;
      expect(resolvePlayerSpriteResource(project, session).origin).toEqual({ x: 0.5, y: 31 / 32 });
      actor.characterResourceId = "missing-resource";
      expect(resolvePlayerSpriteResource(project, session).origin).toBeUndefined();
    });

    it("keeps the same ground contact through scaled hop, landing and switching back to a walk sheet", () => {
      const sprite = { y: 112, height: 40, scaleY: 2, originX: 0, originY: 0, depth: 0,
        setOrigin(x: number, y: number) { this.originX = x; this.originY = y; },
        setDepth(depth: number) { this.depth = depth; },
      };
      setCharacterBaseOrigin(sprite, { x: 0.5, y: 31 / 40 });
      placeCharacterSprite(sprite, "same");
      const depth = sprite.depth;
      const footOnScreen = () => sprite.y - sprite.originY * 80 + 31 * 2;
      expect(footOnScreen()).toBeCloseTo(112);
      applyCharacterLift(sprite, 16);
      expect(footOnScreen()).toBeCloseTo(96);
      expect(sprite.y).toBe(112);
      expect(sprite.depth).toBe(depth);
      clearCharacterLift(sprite);
      expect(footOnScreen()).toBeCloseTo(112);
      setCharacterBaseOrigin(sprite, undefined);
      sprite.height = 32;
      placeCharacterSprite(sprite, "same");
      expect([sprite.originX, sprite.originY]).toEqual([0.5, 1]);
    });

    it("rejects corrupt/outside anchors while accepting legacy definitions without the field", () => {
      for (const anchor of [{ x: 49, y: 31 }, { x: 24, y: -1 }, { x: NaN, y: 31 }]) {
        expect(() => validateAssets({ sprites: { a: { ...action, anchor } }, uploaded: {} })).toThrow();
      }
      const { anchor: _anchor, ...legacy } = action;
      expect(() => validateAssets({ sprites: { a: legacy }, uploaded: {} })).not.toThrow();
    });
  });
});
