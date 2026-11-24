import { describe, it, expect, afterEach, vi } from "vitest";
import { parseCinematicDirection } from "@/project/cinematicDirection";
import { parseMusicScore, renderOriginalMusic, musicWavDataUrl } from "@/assets/originalMusic";
import { ORIGINAL_MUSIC_TOOLS } from "@/editor/tools/originalMusicTools";
import { createBlankProject } from "@/project/defaults";
import { serialize, deserialize } from "@/project/io";
import assert from "node:assert/strict";
import { runTool, getTool } from "@/editor/tools";
import { blueprintOpeningReplaceable } from "@/editor/tools/blueprintOpening";
import { parseSoundPatch, renderOriginalSound } from "@/assets/originalSound";
import { resolveMapBgm } from "@/project/mapMusic";
import { inspectFirstPresentation } from "@/ai/piAgent/firstPresentation";
import { presentationArtImages, PRESENTATION_TOOLS } from "@/editor/tools/presentationTools";
import { applyStoredCameraState } from "@/player/playSceneCamera";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { pixelSnappedCameraZoom, pixelZoomWarning } from "@/project/cameraZoom";
import { startSession, type MonsterInstance } from "@/project/session";
import { store } from "@/project/store";
import { openingCameraZoomWarning } from "@/editor/tools/openingAnimaticTools";
import type { Project, GameMap, TileGroupMetadata, TilesetDef } from "@/project/types";
import { monsterBattlers } from "@/battle/battleBattlers";
import { simulateBattle } from "@/battle/simulate";
import { MONSTER_SYSTEM_TOOLS } from "@/editor/tools/monsterSystemTools";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { monsterBattleStats, monsterStatAtLevel } from "@/project/monsterCollection";
import { placementSoftPenalty } from "@/editor/tools/placementScoring";
import { resolvePlacementStructure } from "@/editor/tools/placementStructure";
import { TILE } from "@/project/defaults/constants";
import { normalizeAdjacentSteps, splitInteractWalkSteps } from "@/editor/tools/playTools";
import reads from "./fixtures/planGridReads.json";
import { applyPlanFix, checkPlan, compilePlan, parsePlanCode, rasterShape } from "@/ai/planGrid";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { bboxDungeonCatalog, layBboxDungeon } from "@/editor/dungeonKit/bboxFloor";
import { bboxVillageCatalog, checkBboxVillage } from "@/editor/tools/bboxVillage";
import { planToDungeon } from "@/editor/tools/planGridDungeon";
import { planToVillage } from "@/editor/tools/planGridVillage";
import { planToInterior } from "@/editor/tools/planGridInterior";
import type { WidenSubject } from "@/ai/vagueWidenCatalog";
import { BUILD_FROM_PLAN_TOOL, repairUnreachableActors, setPlanGrid } from "@/editor/tools/planGridBuild";
import { buildPiRunRequest } from "@/ai/piAgent/plainTurn";
import { PROJECT_TOOLS } from "@/editor/tools/projectTools";
import { FONT_ROLES, fontOptionsForRole } from "@/project/fontRegistry";
import type { JsonSchema } from "@/editor/tools/types";
import { isolateTimers } from "./mergedTeardown";

describe("openingProduction", () => {
  isolateTimers();
  const frames = [{ at: 0, x: 0.4, y: 0.5, scale: 1, opacity: 0, rotation: 0 }, { at: 1, x: 0.6, y: 0.4, scale: 1.1, opacity: 1, rotation: 15 }];
  const layers = [{ resourceId: 'moving-watch', width: 0.2, depth: 'foreground', easing: 'ease-out', frames }];
  const score = { tempo: 80, bars: 4, tracks: [{ instrument: 'piano', gain: 0.8, pan: -0.2, notes: [{ pitch: 60, beat: 0, duration: 2, velocity: 0.7 }, { pitch: 67, beat: 8, duration: 2, velocity: 0.6 }] }] };
  describe('opening production data boundary', () => {
    it('preserves independent normalized actor frames through disabled sequence save/load', () => {
      const project = createBlankProject();
      project.assets.uploaded['moving-watch'] = { id: 'moving-watch', name: 'watch', kind: 'picture', dataUrl: 'data:image/png;base64,AAA=', meta: {} };
      project.system.opening = { enabled: false, skippable: true, scenes: [{ id: 'image', kind: 'image', resourceId: 'moving-watch', motion: 'none', narration: '', durationMs: 4000, direction: parseCinematicDirection({ layers }) }] };
      expect(deserialize(serialize(project)).system.opening).toEqual(project.system.opening);
    });
    it('rejects malformed time order, extra fields and nonfinite actor coordinates', () => {
      for (const wrong of [ { ...frames[1], at: 0 }, { ...frames[1], x: NaN }, { ...frames[1], script: 'execute' } ]) expect(() => parseCinematicDirection({ layers: [{ ...layers[0], frames: [frames[0], wrong] }] })).toThrow();
    });
    it('makes deterministic nonclipping stereo PCM and refuses an unbounded score', () => {
      const parsed = parseMusicScore(score), a = renderOriginalMusic(parsed), b = renderOriginalMusic(parsed);
      expect(a.bytes).toEqual(b.bytes);
      expect(new TextDecoder().decode(a.bytes.slice(0, 4))).toBe('RIFF');
      expect(a.durationSeconds).toBe(12); expect(a.peak).toBeLessThanOrEqual(0.81); expect(a.rms).toBeGreaterThan(0);
      expect(musicWavDataUrl(a.bytes)).toMatch(/^data:audio\/wav;base64,UklGR/);
      expect(() => parseMusicScore({ ...score, bars: 32, tempo: 40 })).toThrow();
      expect(() => parseMusicScore({ ...score, tracks: [{ ...score.tracks[0], notes: [{ ...score.tracks[0].notes[0], beat: 16 }] }] })).toThrow();
    });
    it('registers generated audio and description in the normal persistent project', () => {
      const project = createBlankProject();
      const result = ORIGINAL_MUSIC_TOOLS[0].run(project, { name: 'Clock memory', brief: 'Quiet original piano for a clock memory reveal.', score });
      const id = (result.data as { resourceId: string }).resourceId;
      expect(project.assets.uploaded[id].kind).toBe('music');
      expect(project.audioDescriptions?.music?.[id]).toContain('80 BPM');
      expect(deserialize(serialize(project)).assets.uploaded[id]).toEqual(project.assets.uploaded[id]);
    });
  });
});

describe("openingStageReplacesDefault", () => {
  isolateTimers();
  // 2026-11-11 구조 재점검 3-2: 모델이 author_opening_stage 로 무대를 지어도 끝맺음이 깐 맵 조각 장면(bp-open-*)이 앞에 남아
  // 화면 검수가 계속 그 장면만 봤고, 그림 장면을 지우면 끝맺음이 다시 깔았다.
  function fixture() {
    const ctx = { project: createBlankProject() };
    const scene = (id: string) => ({ id, kind: "text", text: id, durationMs: 1000 });
    ctx.project.system.opening = { enabled: true, skippable: true, scenes: [scene("bp-open-1"), scene("bp-open-2"), scene("my-title-card")] } as never;
    return ctx;
  }
  const BEATS = [{ kind: "wait", ms: 300 }];
  describe("author_opening_stage — 끝맺음이 깐 기본 장면을 대신한다", () => {
    it("bp-open-* 장면을 걷고 모델이 지은 장면은 남긴다", () => {
      const ctx = fixture();
      const result = runTool(ctx, "author_opening_stage", { mapId: ctx.project.startMapId, x: ctx.project.startPos.x, y: ctx.project.startPos.y, beats: BEATS });
      assert(result.ok, result.summary);
      expect(ctx.project.system.opening?.scenes.map((s) => s.id)).toEqual(["my-title-card"]);
      expect(result.data).toMatchObject({ replacedDefaultScenes: 2, pictureScenes: 1 });
    });

    it("칸을 안 주면 도구가 고른다 — 시작 맵은 시작 위치", () => {
      const ctx = fixture();
      const result = runTool(ctx, "author_opening_stage", { mapId: ctx.project.startMapId, beats: BEATS });
      assert(result.ok, result.summary);
      expect(ctx.project.system.opening?.stage).toMatchObject({ mapId: ctx.project.startMapId, x: ctx.project.startPos.x, y: ctx.project.startPos.y });
    });

    it("무대가 있으면 끝맺음은 맵 조각 오프닝을 다시 깔지 않는다(그림 장면이 0개여도)", () => {
      const ctx = fixture();
      ctx.project.system.opening!.scenes.splice(2, 1);
      expect(blueprintOpeningReplaceable(ctx.project).replace).toBe(true);
      const result = runTool(ctx, "author_opening_stage", { mapId: ctx.project.startMapId, beats: BEATS });
      assert(result.ok, result.summary);
      expect(ctx.project.system.opening?.scenes).toHaveLength(0);
      expect(blueprintOpeningReplaceable(ctx.project).replace).toBe(false);
    });
  });
});

describe("originalSoundtrack", () => {
  isolateTimers();
  const score = { tempo: 120, bars: 4, loop: true, tracks: [{ instrument: 'strings', gain: 0.6, pan: 0,
    notes: [{ pitch: 60, beat: 0, duration: 2, velocity: 0.5 }, { pitch: 67, beat: 15, duration: 1, velocity: 0.5 }] }] };
  const patch = { duration: 0.08, layers: [{ wave: 'triangle', at: 0, duration: 0.08, frequency: 900, endFrequency: 500, attack: 0.002, release: 0.06, gain: 0.15, pan: 0 }] };
  const generate = (name: string) => ORIGINAL_MUSIC_TOOLS.find(t => t.name === name)!;
  describe('authored soundtrack delivery', () => {
    it('carries the last note release over the loop boundary without a master fade to silence', () => {
      const loop = renderOriginalMusic(parseMusicScore(score));
      const intro = renderOriginalMusic(parseMusicScore({ ...score, loop: false }));
      const pcm = new DataView(loop.bytes.buffer), faded = new DataView(intro.bytes.buffer);
      const energy = (view: DataView, start: number, count: number) => {
        let sum = 0;
        for (let i = start; i < start + count; i++) sum += Math.abs(view.getInt16(44 + i * 4, true));
        return sum;
      };
      expect(energy(pcm, 0, 2205)).toBeGreaterThan(energy(faded, 0, 2205));
      expect(energy(pcm, (loop.bytes.length - 44) / 4 - 2205, 2205)).toBeGreaterThan(0);
      expect(loop.peak).toBeLessThanOrEqual(0.81);
    });
    it('preserves quiet, deterministic sound patches and rejects overruns/nonfinite inputs', () => {
      const a = renderOriginalSound(parseSoundPatch(patch)), b = renderOriginalSound(parseSoundPatch(patch));
      expect(a.bytes).toEqual(b.bytes); expect(a.durationSeconds).toBe(0.08);
      expect(a.peak).toBeGreaterThan(0); expect(a.peak).toBeLessThan(0.08);
      for (const layer of [{ ...patch.layers[0], at: 0.03 }, { ...patch.layers[0], frequency: NaN }, { ...patch.layers[0], release: 0.08 }]) {
        expect(() => parseSoundPatch({ ...patch, layers: [layer] })).toThrow();
      }
    });
    it('saves actual music and SE bytes with map/title references and plays the same map selection after reload', () => {
      const project = createBlankProject();
      const music = generate('generate_original_bgm').run(project, { name: 'Quiet study', brief: 'A repeating memory motif for the study.', score }).data as { resourceId: string };
      const sound = generate('generate_original_se').run(project, { name: 'Clock key', brief: 'A quiet clock click for the title cursor.', patch }).data as { resourceId: string };
      project.maps[project.startMapId].bgm = { mode: 'custom', resourceId: music.resourceId };
      project.system.titleScreen!.sounds = { cursorSeResourceId: sound.resourceId };
      const loaded = deserialize(serialize(project));
      expect(resolveMapBgm(loaded, loaded.startMapId)).toMatchObject({ kind: 'play', resourceId: music.resourceId });
      expect(loaded.assets.uploaded).toEqual(project.assets.uploaded);
      expect(loaded.system.titleScreen!.sounds).toEqual(project.system.titleScreen!.sounds);
      expect(loaded.audioDescriptions?.music?.[music.resourceId]).toContain('반복 경계에 강제 무음 없음');
    });
  });
});

describe("piFirstPresentation", () => {
  isolateTimers();
  function authored() {
    const project = createBlankProject();
    for (const id of ['title-art', 'opening-art', 'detail-art', 'action-art', 'memory-art', 'handoff-art']) project.assets.uploaded[id] = {
      id, name: id, kind: 'picture', dataUrl: 'data:image/png;base64,AAA=', meta: {},
    };
    project.system.titleScreen = { ...project.system.titleScreen!, title: '멈춘 시계의 기억', backgroundResourceId: 'title-art',
      backgroundFit: 'cover', logoStyle: 'gold', sequence: { logoReveal: 'rise' }, transition: { kind: 'fade' } };
    project.assets.uploaded['detail-art'] = { ...project.assets.uploaded['opening-art']!, id: 'detail-art' };
    project.system.opening = { enabled: true, skippable: true, musicResourceId: 'cc0-bgm-rtp-ttl-001', scenes: ['opening-art', 'detail-art', 'action-art', 'memory-art', 'handoff-art'].map((resourceId, index) => ({ id: `opening-${index}`, kind: 'image' as const, resourceId, narration: '멈춘 시계에 기억이 남았다.', durationMs: 4000, motion: 'none' as const, direction: { transition: { kind: 'cut' as const, durationMs: 0 } } })) };
    return project;
  }
  describe('first creation presentation boundary', () => {
    it('rejects a renamed default title and disabled opening', () => {
      const project = createBlankProject();
      project.system.titleScreen!.title = '멈춘 시계의 기억';
      project.system.opening = { enabled: false, skippable: true, scenes: [] };
      const issues = inspectFirstPresentation(project).join('\n');
      expect(issues).toContain('작품 전용 타이틀 배경');
      expect(issues).toContain('꺼져 있거나 비어');
    });
    it('requires a linked real image, automatic bounded duration and a return path', () => {
      const project = authored();
      expect(inspectFirstPresentation(project)).toEqual([]);
      expect(presentationArtImages(project).map(image => image.resourceId)).toEqual(['title-art', 'opening-art', 'detail-art', 'action-art', 'memory-art', 'handoff-art']);
      delete project.assets.uploaded['opening-art'];
      project.system.opening!.scenes[0]!.durationMs = 0;
      project.system.opening!.skippable = false;
      const issues = inspectFirstPresentation(project).join('\n');
      expect(issues).toContain('실제 그림을 검수할 수 없는');
      expect(issues).toContain('자동 진행');
      expect(issues).toContain('건너뛸');
    });
    it('does not accept text-only openings or an image name without image bytes', () => {
      const project = authored();
      project.system.opening!.scenes = [{ id: 'black-text', kind: 'text', narration: '시계를 찾는다.', durationMs: 6000 }];
      project.assets.uploaded['title-art']!.dataUrl = undefined;
      const issues = inspectFirstPresentation(project).join('\n');
      expect(issues).toContain('검은 화면의 글뿐');
      expect(issues).toContain('작품 전용 타이틀 배경');
      expect(presentationArtImages(project)).toEqual([]);
    });
    it('rejects a single zoomed image as a storyboard', () => {
      const project = authored();
      project.system.opening!.scenes = [project.system.opening!.scenes[0]!];
      expect(inspectFirstPresentation(project).join('\n')).toContain('다섯 컷');
    });
    it('preserves the content-addressed canonical asset contract', () => {
      const project = authored();
      for (const id of ['title-art', 'opening-art', 'detail-art', 'action-art', 'memory-art', 'handoff-art']) {
        const asset = project.assets.uploaded[id]!;
        asset.dataUrl = undefined;
        asset.ref = { sha256: id === 'title-art' ? 'a'.repeat(64) : 'b'.repeat(64), mime: 'image/png', bytes: 400000, extension: 'png' };
      }
      expect(inspectFirstPresentation(project)).toEqual([]);
      // Inline bytes are unavailable here. The actual image must arrive from the browser asset bridge.
      expect(presentationArtImages(project)).toEqual([]);
      const show = PRESENTATION_TOOLS.find(tool => tool.name === 'show_title_opening')!;
      expect(show.run(project, {}).summary).toContain('원화 6장');
    });
  });
});

// 도트 게임 정수 배율(2026-10-30): 1 이상 소수 저작 배율은 표시만 정수로 맞추고, 저작 도구는 경고만 한다.
describe("pixelCameraZoom", () => {
  isolateTimers();
  describe("pixelSnappedCameraZoom", () => {
    it("1 이상 소수는 가장 가까운 정수로, 정수·1 미만은 그대로", () => {
      const system = { playResolution: { width: 480, height: 270 } };
      expect(pixelSnappedCameraZoom(1.5, system)).toBe(2);
      expect(pixelSnappedCameraZoom(1.18, system)).toBe(1);
      expect(pixelSnappedCameraZoom(1.25, system)).toBe(1);
      expect(pixelSnappedCameraZoom(2.6, system)).toBe(3);
      expect(pixelSnappedCameraZoom(2, system)).toBe(2);
      expect(pixelSnappedCameraZoom(0.5, system)).toBe(0.5);
      expect(pixelSnappedCameraZoom(0.75, system)).toBe(0.75);
    });

    it("양쪽 전신 대화창(3.2배)과 고해상도 화면(1440×1080 + 4.5배)은 소수 그대로", () => {
      expect(pixelSnappedCameraZoom(3.2, { dialogueStyle: "dual-fullbody-veil" })).toBe(3.2);
      expect(pixelSnappedCameraZoom(4.5, { playResolution: { width: 1440, height: 1080 } })).toBe(4.5);
    });

    it("경고는 표시 배율이 달라질 때만", () => {
      expect(pixelZoomWarning(1.5, {})).toContain("2배");
      expect(pixelZoomWarning(2, {})).toBeNull();
      expect(pixelZoomWarning(0.5, {})).toBeNull();
    });
  });
  describe("런타임 카메라는 정수 배율로 보인다", () => {
    afterEach(() => vi.restoreAllMocks());

    function scene(project: Project, mapZoom: number | undefined) {
      const map = { ...project.maps[project.startMapId]!, cameraZoom: mapZoom };
      vi.spyOn(store, "getCurrent").mockReturnValue(project);
      const camera = {
        width: 480, height: 270, zoom: 1, zoomX: 1, zoomY: 1,
        setZoom(value: number) { this.zoom = value; this.zoomX = value; this.zoomY = value; },
        setBounds() { return undefined; },
        startFollow() { return undefined; },
        stopFollow() { return undefined; },
        centerOn() { return undefined; },
      };
      const session = startSession(project);
      const context = {
        cameras: { main: camera }, player: { x: 0, y: 0 }, eventSprites: new Map(), session, map,
        eventPositions: {}, syncRuntimeState: () => undefined,
      } as unknown as PlaySceneContext;
      return { context, camera };
    }

    it("맵 배율 1.5 는 2 로, 0.5 는 0.5 로 — 저장값은 그대로", () => {
      const project = createBlankProject();
      project.system.playResolution = { width: 480, height: 270 };
      const zoomed = scene(project, 1.5);
      applyStoredCameraState(zoomed.context);
      expect(zoomed.camera.zoom).toBe(2);
      expect((zoomed.context.map as { cameraZoom?: number }).cameraZoom).toBe(1.5);

      const far = scene(project, 0.5);
      applyStoredCameraState(far.context);
      expect(far.camera.zoom).toBe(0.5);
    });
  });
  describe("저작 도구 경고", () => {
    it("set_map_properties 는 소수 배율을 저장하고 경고한다", () => {
      const project = createBlankProject();
      const result = getTool("set_map_properties")!.run(project, { mapId: project.startMapId, zoom: 1.5 });
      expect(project.maps[project.startMapId]!.cameraZoom).toBe(1.5);
      expect(result.warnings?.join(" ")).toContain("2배");
      const clean = getTool("set_map_properties")!.run(project, { mapId: project.startMapId, zoom: 2 });
      expect(clean.warnings ?? []).toEqual([]);
    });

    it("set_project_settings 는 소수 배율을 저장하고 경고한다", () => {
      const project = createBlankProject();
      const result = getTool("set_project_settings")!.run(project, { cameraZoom: 1.25 });
      expect(project.system.cameraZoom).toBe(1.25);
      expect(result.warnings?.join(" ")).toContain("1배");
    });

    it("오프닝 카메라 줌 키가 소수면 경고한다", () => {
      expect(openingCameraZoomWarning({ zoom: 1, keys: { zoom: [{ atMs: 0, value: 1 }, { atMs: 1000, value: 1.18 }] } })).toContain("1.18");
      expect(openingCameraZoomWarning({ zoom: 1, keys: { zoom: [{ atMs: 0, value: 1 }, { atMs: 1000, value: 2 }] } })).toBeNull();
      expect(openingCameraZoomWarning(undefined)).toBeNull();
    });
  });
});

describe("pkmnCoreUnlock", () => {
  isolateTimers();
  function aqualing(project: Project, instanceId: string, level = 20): MonsterInstance {
    return {
      instanceId,
      speciesId: "species_aqualing", // water
      level,
      exp: 0,
      ivs: { hp: 0, atk: 0, def: 0, spd: 0 },
      friendship: 70,
      caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
    };
  }
  // enemy_slime 를 지정 종족/스탯으로 바꾼 프로젝트(방어 1, 초고 HP → 한 대 맞고 생존).
  function projectWithTargetSpecies(speciesId: string): Project {
    const project = createBlankProject();
    const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
    if (!enemy) throw new Error("missing enemy_slime");
    enemy.speciesId = speciesId;
    // 슬라임이 정신력 기반 「산성 침」·민첩 34 를 얻어 L20 몬스터를 먼저 쓰러뜨리므로 정신력·민첩도 1 로 묶어 무해하게 둔다.
    enemy.stats = { ...enemy.stats, maxHp: 100000, defense: 1, attack: 1, mind: 1, agility: 1 };
    return project;
  }
  function firstActorDamage(result: ReturnType<typeof simulateBattle>): number {
    return result.roundLogs[0]?.actions.find((action) => action.side === "actor")?.amount ?? 0;
  }
  // ─────────────────────────────────────────────────────────────────────────────
  // 배치 1 — 몬스터 6스탯 레벨 스케일링
  // ─────────────────────────────────────────────────────────────────────────────
  describe("batch 1 · monster stat level scaling", () => {
    it("returns base+iv at L1 (backward-compat) and scales with level", () => {
      // Pokemon-style other-stat formula: floor((2*base+iv)*level/100)+5
      expect(monsterStatAtLevel(22, 7, 1, 10)).toBe(5);
      expect(monsterStatAtLevel(22, 7, 99, 10)).toBe(55);
      expect(monsterStatAtLevel(8, 7, 99, 6)).toBe(27);
      // clamp: 최소 1, round 적용
      expect(monsterStatAtLevel(0, 0, 99, 10)).toBe(5);
      expect(monsterStatAtLevel(1, 0, 50, 10)).toBeGreaterThanOrEqual(1);
    });

    it("scales all six stats with Pokemon formula and keeps L1 near base floor", () => {
      const project = createBlankProject();
      const species = project.database.monsterSpecies?.find((s) => s.id === "species_leafling");
      if (!species) throw new Error("missing leafling");
      const leaflingL1 = monsterBattleStats(project, {
        ...aqualing(project, "leaf", 1),
        speciesId: "species_leafling",
      });
      // L1 HP = floor((2*base+iv)/100)+1+10 = 11 for base 36
      expect(leaflingL1.maxHp).toBe(11);
      expect(leaflingL1.attack).toBe(5);
      expect(leaflingL1.agility).toBe(5);

      const leaflingL99 = monsterBattleStats(project, {
        ...aqualing(project, "leaf99", 99),
        speciesId: "species_leafling",
      });
      // floor((2*36)*99/100)+99+10 = 180
      expect(leaflingL99.maxHp).toBe(180);
      expect(leaflingL99.attack).toBe(18);
      expect(leaflingL99.agility).toBe(28);
    });
  });
  // ─────────────────────────────────────────────────────────────────────────────
  // 배치 2 — 몬스터→배틀러 변환 + 모드 스위치 + 타입 대칭 (핵심 언락)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("batch 2 · monsters actually fight (headless unlock proof)", () => {
    // (a) 몬스터 배틀러가 행동 로그에 등장한다.
    it("(a) a monster battler appears in the strict-mode action log", () => {
      const project = projectWithTargetSpecies("species_cave_bat"); // fire target
      const party = [aqualing(project, "mon_water_1", 20)];
      const result = simulateBattle({
        project,
        troopId: "troop_slime",
        heroLevel: 1,
        battleFlow: "strict",
        n: 1,
        seed: 1,
        monsterParty: party,
        strictScript: [[{ actorId: "mon_water_1", command: "skill", skillId: "skill_water", target: "enemy-1" }]],
        maxSteps: 6,
      });
      const monsterAction = result.roundLogs[0]?.actions.find(
        (action) => action.side === "actor" && action.userRecordId === "mon_water_1"
      );
      expect(monsterAction, "monster battler must appear in the action log").toBeTruthy();
      expect(result.participatingActorIds).toContain("mon_water_1");
    });

    // (b) 물몬 vs 불몬(약점 2×) 데미지가 물몬 vs 물몬(내성 0.5×)보다 크다 — 상성 배율이 데미지에 반영.
    it("(b) type-chart multiplier is applied: water-vs-fire (weak) >> water-vs-water (resist)", () => {
      const script = [[{ actorId: "mon_w", command: "skill" as const, skillId: "skill_water", target: "enemy-1" }]];

      const weakProject = projectWithTargetSpecies("species_cave_bat"); // fire → water is super effective
      const weak = simulateBattle({
        project: weakProject,
        troopId: "troop_slime",
        heroLevel: 1,
        battleFlow: "strict",
        n: 1,
        seed: 3,
        monsterParty: [aqualing(weakProject, "mon_w", 20)],
        strictScript: script,
        maxSteps: 6,
      });

      const resistProject = projectWithTargetSpecies("species_aqualing"); // water → water is resisted
      const resist = simulateBattle({
        project: resistProject,
        troopId: "troop_slime",
        heroLevel: 1,
        battleFlow: "strict",
        n: 1,
        seed: 3,
        monsterParty: [aqualing(resistProject, "mon_w", 20)],
        strictScript: script,
        maxSteps: 6,
      });

      const weakDamage = firstActorDamage(weak);
      const resistDamage = firstActorDamage(resist);
      expect(weakDamage).toBeGreaterThan(0);
      expect(resistDamage).toBeGreaterThan(0);
      // 2× 약점 vs 0.5× 내성 → 순수 배율비 4× (동일 시전자·스킬·시드). 변산(±10%) 여유로 2× 이상만 확인.
      expect(weakDamage).toBeGreaterThan(resistDamage * 2);
    });

    // (c) 몬스터 파티를 넘기지 않으면 액터 경로가 그대로 유지된다(회귀 0).
    it("(c) actor path is unchanged when no monsterParty is supplied", () => {
      const project = createBlankProject();
      const actorRun = simulateBattle({ project, troopId: "troop_slime", heroLevel: 5, n: 20, seed: 1 });
      // 액터가 참가 기록에 남고, 몬스터 instanceId 는 등장하지 않는다.
      expect(actorRun.participatingActorIds).toContain("actor_hero");
      expect(actorRun.participatingActorIds.some((id) => id.startsWith("mon_"))).toBe(false);
      expect(actorRun.winRate).toBeGreaterThan(0);

      // 동일 입력 재현성(로그 불변 근거): 같은 시드 → 같은 winRate.
      const actorRunAgain = simulateBattle({ project, troopId: "troop_slime", heroLevel: 5, n: 20, seed: 1 });
      expect(actorRunAgain.winRate).toBe(actorRun.winRate);
    });

    // (d) 같은 종 2마리 파티에서 recordId(=instanceId) 유일성으로 둘 다 정상 추적된다.
    it("(d) two same-species monsters keep unique recordIds and both participate", () => {
      const project = createBlankProject();
      const battlers = monsterBattlers(project, [aqualing(project, "mon_a"), aqualing(project, "mon_b")]);
      expect(battlers.map((b) => b.recordId)).toEqual(["mon_a", "mon_b"]);
      expect(battlers.every((b) => b.speciesId === "species_aqualing")).toBe(true);
      expect(new Set(battlers.map((b) => b.recordId)).size).toBe(2); // recordId=instanceId, NOT speciesId

      const result = simulateBattle({
        project,
        troopId: "troop_slime",
        heroLevel: 1,
        battleFlow: "strict",
        n: 1,
        seed: 1,
        activeSlots: 2,
        monsterParty: [aqualing(project, "mon_a"), aqualing(project, "mon_b")],
        maxSteps: 40,
      });
      // recordId 가 speciesId 였다면 둘이 한 슬롯으로 붕괴해 1개만 참가했을 것.
      expect(result.participatingActorIds).toContain("mon_a");
      expect(result.participatingActorIds).toContain("mon_b");
    });
  });
  // ─────────────────────────────────────────────────────────────────────────────
  // 배치 3 — 포획 활성화 + 모드 토글 도구
  // ─────────────────────────────────────────────────────────────────────────────
  describe("batch 3 · configure_monster_system tool + toggle", () => {
    const tool = MONSTER_SYSTEM_TOOLS.find((entry) => entry.name === "configure_monster_system");
    if (!tool) throw new Error("missing configure_monster_system");

    it("is registered in the global tool registry", () => {
      expect(getTool("configure_monster_system")?.name).toBe("configure_monster_system");
    });

    it("enabled:true sets monsterCollection; battleParty:true sets monsterBattleParty", () => {
      const project = createBlankProject();
      tool.run(project, { enabled: true, battleParty: true });
      expect(project.system.monsterCollection).toBe(true);
      expect(project.system.monsterBattleParty).toBe(true);
    });

    it("enabled:true without battleParty leaves battle-party flag unset", () => {
      const project = createBlankProject();
      tool.run(project, { enabled: true });
      expect(project.system.monsterCollection).toBe(true);
      expect(project.system.monsterBattleParty).toBeUndefined();
    });

    it("enabled:true without battleParty keeps an existing monster battle party (monster-collect preset)", () => {
      const project = createBlankProject();
      project.system.monsterBattleParty = true;
      project.system.battleParty = "monsters";
      tool.run(project, { enabled: true });
      expect(project.system.monsterBattleParty).toBe(true);
      expect(project.system.battleParty).toBe("monsters");
      tool.run(project, { enabled: true, battleParty: false });
      expect(project.system.monsterBattleParty).toBeUndefined();
    });

    it("enabled:false removes both flags", () => {
      const project = createBlankProject();
      tool.run(project, { enabled: true, battleParty: true });
      tool.run(project, { enabled: false });
      expect(project.system.monsterCollection).toBeUndefined();
      expect(project.system.monsterBattleParty).toBeUndefined();
    });

    it("normalizeSystemRecords round-trips the monsterBattleParty flag", () => {
      const normalized = normalizeSystemRecords({ startActorIds: ["actor_hero"], monsterBattleParty: true });
      expect(normalized.monsterBattleParty).toBe(true);
      const off = normalizeSystemRecords({ startActorIds: ["actor_hero"] });
      expect(off.monsterBattleParty).toBeUndefined();
    });

    it("give_starter_monsters warns when monsterCollection is off, and not when on", () => {
      const starter = DB_TOOLS.find((entry) => entry.name === "give_starter_monsters");
      if (!starter) throw new Error("missing give_starter_monsters");

      const offProject = createBlankProject();
      const offResult = starter.run(offProject, { speciesIds: ["species_leafling", "species_sparkit", "species_aqualing"] });
      expect(offResult.warnings?.some((w) => w.includes("configure_monster_system"))).toBe(true);

      const onProject = createBlankProject();
      onProject.system.monsterCollection = true;
      const onResult = starter.run(onProject, { speciesIds: ["species_leafling", "species_sparkit", "species_aqualing"] });
      expect(onResult.warnings ?? []).toHaveLength(0);
    });
  });
});

describe("placementScoring", () => {
  isolateTimers();
  describe("placementSoftPenalty", () => {
    it("규칙이 없으면 0을 반환한다", () => {
      // Given: 소프트/미디엄 규칙이 없는 그룹.
      const group = groupWithRules();

      // When: 후보 점수를 계산한다.
      const penalty = placementSoftPenalty({ candidate: rect(0, 0), group, map: blankMap(), placed: [] });

      // Then: 배치 선호도가 중립이다.
      expect(penalty).toBe(0);
    });

    it("soft spacing은 가까운 후보에 더 큰 벌점을 주고 최소 간격 이상이면 0이다", () => {
      // Given: 빈칸 거리 3을 선호하는 소프트 간격 규칙.
      const group = groupWithRules([{ id: "gap", kind: "spacing", params: { minGap: 3 }, strength: "soft" }]);
      const placed = [rect(0, 0)];

      // When: 가까운 후보와 충분히 떨어진 후보를 비교한다.
      const near = placementSoftPenalty({ candidate: rect(2, 0), group, map: blankMap(), placed });
      const far = placementSoftPenalty({ candidate: rect(4, 0), group, map: blankMap(), placed });

      // Then: 가까운 후보만 벌점을 받는다.
      expect(near).toBeGreaterThan(far);
      expect(far).toBe(0);
    });

    it("medium spacing은 같은 위반에서 soft보다 큰 벌점을 준다", () => {
      // Given: 같은 간격 규칙을 soft와 medium 강도로 둔 두 그룹.
      const soft = groupWithRules([{ id: "soft-gap", kind: "spacing", params: { minGap: 3 }, strength: "soft" }]);
      const medium = groupWithRules([{ id: "medium-gap", kind: "spacing", params: { minGap: 3 }, strength: "medium" }]);

      // When: 같은 후보를 평가한다.
      const softPenalty = placementSoftPenalty({ candidate: rect(2, 0), group: soft, map: blankMap(), placed: [rect(0, 0)] });
      const mediumPenalty = placementSoftPenalty({ candidate: rect(2, 0), group: medium, map: blankMap(), placed: [rect(0, 0)] });

      // Then: medium 선호가 더 강하게 작동한다.
      expect(mediumPenalty).toBeGreaterThan(softPenalty);
    });

    it("count max를 넘기는 후보에는 벌점을 준다", () => {
      // Given: 맵당 최대 2개를 선호하는 그룹에 이미 2개가 놓여 있다.
      const group = groupWithRules([{ id: "max-count", kind: "count", params: { max: 2 }, strength: "soft" }]);

      // When: 새 후보를 하나 더 평가한다.
      const penalty = placementSoftPenalty({ candidate: rect(9, 9), group, map: blankMap(), placed: [rect(0, 0), rect(4, 0)] });

      // Then: 초과분만큼 벌점이 생긴다.
      expect(penalty).toBeGreaterThan(0);
    });
  });
  function rect(x: number, y: number): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
    return { h: 1, w: 1, x, y };
  }
  function groupWithRules(rules: TileGroupMetadata["rules"] = []): TileGroupMetadata {
    return {
      defaultLayer: "lower",
      description: "배치 점수 테스트 그룹",
      id: "test-group",
      name: "테스트 그룹",
      placementRules: "",
      role: "prop",
      rules,
      tileIds: [1],
    };
  }
  function blankMap(): GameMap {
    return {
      events: [],
      height: 12,
      id: "map",
      lowerTiles: Array.from({ length: 144 }, () => 0),
      name: "테스트 맵",
      tileSize: 16,
      tilesetId: "tileset",
      upperTiles: Array.from({ length: 144 }, () => -1),
      width: 12,
    };
  }
});

describe("placementStructure", () => {
  isolateTimers();
  describe("resolvePlacementStructure", () => {
    it("junctions와 overlays가 없으면 빈 배열을 반환한다", () => {
      // Given: 구조 규칙이 없는 그룹.
      const group = groupWith({ role: "roof" });

      // When: 구조 edit을 계산한다.
      const edits = resolvePlacementStructure({ group, map: blankMap(4, 4), placed: [rect(1, 1, 2, 2)], tileset: tilesetWithGroups([group]) });

      // Then: 추가 구조 edit이 없다.
      expect(edits).toEqual([]);
    });

    it("overlay ridge/eaveEnd/diagonalCorner를 인스턴스 좌표의 upper edit으로 만든다", () => {
      // Given: 여러 overlay 규칙과 맵 밖 인스턴스가 함께 있다.
      const group = groupWith({
        overlays: [
          { tileIds: [10], when: "ridge" },
          { tileIds: [20, 21], when: "eaveEnd" },
          { tileIds: [30, 31, 32, 33], when: "diagonalCorner" },
        ],
        role: "roof",
      });

      // When: 구조 edit을 계산한다.
      const edits = resolvePlacementStructure({
        group,
        map: blankMap(6, 5),
        placed: [rect(1, 1, 3, 2), rect(-4, -4, 1, 1)],
        tileset: tilesetWithGroups([group]),
      });

      // Then: 맵 안 좌표만 deterministic 순서로 나온다.
      expect(edits).toEqual([
        { layer: "upper", tile: 10, x: 2, y: 1 },
        { layer: "upper", tile: 20, x: 1, y: 2 },
        { layer: "upper", tile: 21, x: 3, y: 2 },
        { layer: "upper", tile: 30, x: 1, y: 1 },
        { layer: "upper", tile: 31, x: 3, y: 1 },
        { layer: "upper", tile: 32, x: 1, y: 2 },
        { layer: "upper", tile: 33, x: 3, y: 2 },
      ]);
    });

    it("junction omit은 인접 role 타일이 있을 때 표시 레이어를 EMPTY로 비운다", () => {
      // Given: 지붕 아래 바깥 셀에 wall 역할 타일이 놓여 있다.
      const roof = groupWith({
        junctions: [{ action: "omit", side: "below", withRole: "wall" }],
        role: "roof",
      });
      const wall = groupWith({ id: "wall", role: "wall", tileIds: [7] });
      const map = blankMap(5, 5);
      map.lowerTiles[index(map, 1, 3)] = 7;
      map.lowerTiles[index(map, 1, 2)] = 11;
      map.upperTiles[index(map, 1, 2)] = 99;

      // When: 구조 edit을 계산한다.
      const edits = resolvePlacementStructure({ group: roof, map, placed: [rect(1, 1, 2, 2)], tileset: tilesetWithGroups([roof, wall]) });

      // Then: wall과 맞닿은 지붕 경계 셀의 upper 표시만 비운다.
      expect(edits).toEqual([{ layer: "upper", tile: TILE.EMPTY, x: 1, y: 2 }]);
    });

    it("junction replace는 인접 role 타일이 있을 때 replaceWith 순서로 치환한다", () => {
      // Given: 오른쪽 바깥 셀 두 개에 wall 역할 타일이 놓여 있다.
      const roof = groupWith({
        junctions: [{ action: "replace", replaceWith: [70, 71], side: "rightOf", withRole: "wall" }],
        role: "roof",
      });
      const wall = groupWith({ id: "wall", role: "wall", tileIds: [7] });
      const map = blankMap(5, 5);
      map.lowerTiles[index(map, 3, 1)] = 7;
      map.lowerTiles[index(map, 3, 2)] = 7;
      map.lowerTiles[index(map, 2, 1)] = 11;
      map.lowerTiles[index(map, 2, 2)] = 12;

      // When: 구조 edit을 계산한다.
      const edits = resolvePlacementStructure({ group: roof, map, placed: [rect(1, 1, 2, 2)], tileset: tilesetWithGroups([roof, wall]) });

      // Then: 오른쪽 경계가 replaceWith 배열 순서로 바뀐다.
      expect(edits).toEqual([
        { layer: "lower", tile: 70, x: 2, y: 1 },
        { layer: "lower", tile: 71, x: 2, y: 2 },
      ]);
    });

    it("같은 입력은 같은 edit 배열을 반환한다", () => {
      // Given: overlay와 junction을 함께 가진 그룹.
      const roof = groupWith({
        junctions: [{ action: "replace", replaceWith: [70], side: "below", withRole: "wall" }],
        overlays: [{ tileIds: [10], when: "innerCorner" }],
        role: "roof",
      });
      const wall = groupWith({ id: "wall", role: "wall", tileIds: [7] });
      const map = blankMap(5, 5);
      map.lowerTiles[index(map, 1, 3)] = 7;

      // When: 같은 입력으로 두 번 계산한다.
      const input = { group: roof, map, placed: [rect(1, 1, 2, 2)], tileset: tilesetWithGroups([roof, wall]) };
      const first = resolvePlacementStructure(input);
      const second = resolvePlacementStructure(input);

      // Then: 결과가 완전히 동일하다.
      expect(second).toEqual(first);
    });
  });
  function rect(x: number, y: number, w: number, h: number): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
    return { h, w, x, y };
  }
  function index(map: GameMap, x: number, y: number): number {
    return y * map.width + x;
  }
  function blankMap(width: number, height: number): GameMap {
    return {
      events: [],
      height,
      id: "map",
      lowerTiles: Array.from({ length: width * height }, () => 0),
      name: "테스트 맵",
      tileSize: 16,
      tilesetId: "tileset",
      upperTiles: Array.from({ length: width * height }, () => TILE.EMPTY),
      width,
    };
  }
  function groupWith(input: {
    readonly id?: string;
    readonly junctions?: TileGroupMetadata["junctions"];
    readonly overlays?: TileGroupMetadata["overlays"];
    readonly role: TileGroupMetadata["role"];
    readonly tileIds?: readonly number[];
  }): TileGroupMetadata {
    return {
      defaultLayer: "upper",
      description: "구조 해석 테스트 그룹",
      id: input.id ?? input.role,
      junctions: input.junctions ? [...input.junctions] : undefined,
      name: input.role,
      overlays: input.overlays ? [...input.overlays] : undefined,
      placementRules: "",
      role: input.role,
      tileIds: [...(input.tileIds ?? [1])],
    };
  }
  function tilesetWithGroups(groups: readonly TileGroupMetadata[]): TilesetDef {
    return {
      count: 128,
      id: "tileset",
      image: { id: "tileset-image", type: "bundled" },
      name: "테스트 타일셋",
      passability: Array.from({ length: 128 }, () => ({ down: true, left: true, right: true, up: true })),
      priority: Array.from({ length: 128 }, () => "lower"),
      terrain: Array.from({ length: 128 }, () => 0),
      tileGroups: [...groups],
      tilesPerRow: 8,
      tileSize: 16,
    };
  }
});

describe("placeNpcHomeAndInteractTo", () => {
  isolateTimers();
  // 2026-09-24 JRPG 도그푸딩 ember-4: 상점 NPC 넷이 make_villager 모양(home:{x,y})으로 place_npc 를 불러 전부
  // 「x,y is required」로 거부됐고, 합류·엔딩 검증 run_scene_test 셋이 interact 스텝에 to/adjacent 를 써 거부됐다.
  describe("place_npc home:{x,y} · run_scene_test interact to", () => {
    it("place_npc 는 x,y 대신 home:{x,y} 를 받는다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const result = runTool(ctx, "place_npc", { mapId, name: "도구상인 홉스", home: { x: 6, y: 6 }, pages: [{ lines: ["어서 오세요."] }] });
      expect(result.ok, result.summary).toBe(true);
      const npc = ctx.project.maps[mapId]!.events.find((event) => event.name === "도구상인 홉스")!;
      expect(Math.abs(npc.x - 6) + Math.abs(npc.y - 6)).toBeLessThanOrEqual(2);
    });

    it("좌표가 전혀 없으면 x,y 또는 home 을 짚어 거부한다", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, name: "무명", pages: [{ lines: ["…"] }] });
      expect(result.ok).toBe(false);
      expect(result.summary).toMatch(/home/u);
    });

    it("interact 의 to/adjacent 는 walk + interact 로 나뉜다", () => {
      const { input, split } = splitInteractWalkSteps({
        mapId: "m", start: { x: 1, y: 1 },
        steps: [{ kind: "interact", adjacent: true, to: { x: 8, y: 6 } }, { kind: "choose", index: 0 }],
      });
      expect(split).toEqual([0]);
      expect((input as { steps: unknown[] }).steps).toEqual([
        { kind: "walk", to: { x: 8, y: 6 }, adjacent: true },
        { kind: "interact" },
        { kind: "choose", index: 0 },
      ]);
    });

    it("다른 틀린 필드가 섞이거나 to 가 좌표가 아니면 그대로 둔다", () => {
      const steps = [{ kind: "interact", to: "ev_npc" }, { kind: "walk", to: { x: 1, y: 1 } }];
      expect(splitInteractWalkSteps({ steps }).split).toEqual([]);
    });

    it("run_scene_test 가 나눈 스텝으로 NPC 를 조사한다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const placed = runTool(ctx, "place_npc", { mapId, name: "촌장", x: 8, y: 6, pages: [{ lines: ["왔구나."] }] });
      expect(placed.ok, placed.summary).toBe(true);
      const npc = ctx.project.maps[mapId]!.events.find((event) => event.name === "촌장")!;
      const result = runTool(ctx, "run_scene_test", {
        mapId, start: { x: npc.x, y: npc.y + 2 },
        steps: [{ kind: "interact", adjacent: true, to: { x: npc.x, y: npc.y } }, { kind: "expect", interactionComplete: true }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(result.warnings?.join(" ")).toMatch(/walk/u);
    });

    // 2026-10-05 스트레스 g-ashen-chase: interact {eventId, adjacent} · move {to, adjacent} 가 한 실행에서 다섯 번 거부됐다.
    it("adjacent 를 붙인 move·interact 를 walk 스텝으로 편다", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.maps[mapId]!.events.push({ id: "ev_safe", x: 8, y: 6, trigger: { kind: "action" }, commands: [] } as never);
      const { input, normalized } = normalizeAdjacentSteps(project, {
        mapId, start: { x: 1, y: 1 },
        steps: [{ kind: "move", to: { x: 3, y: 3 }, adjacent: true }, { kind: "interact", eventId: "ev_safe", adjacent: true }],
      });
      expect(normalized).toEqual([0, 1]);
      expect((input as { steps: unknown[] }).steps).toEqual([
        { kind: "walk", to: { x: 3, y: 3 }, adjacent: true },
        { kind: "walk", to: { x: 8, y: 6 }, adjacent: true },
        { kind: "interact", eventId: "ev_safe" },
      ]);
    });

    it("이벤트를 못 찾거나 다른 필드가 섞이면 그대로 둔다", () => {
      const project = createBlankProject();
      const steps = [{ kind: "interact", eventId: "ev_none", adjacent: true }, { kind: "move", dir: "up", to: { x: 1, y: 1 }, adjacent: true }];
      expect(normalizeAdjacentSteps(project, { mapId: project.startMapId, start: { x: 1, y: 1 }, steps }).normalized).toEqual([]);
    });
  });
});

describe("planGrid", () => {
  isolateTimers();
  type Fx = { subject: WidenSubject; cols: number; rows: number; read: Record<string, unknown> };
  const fx = reads as Record<string, Fx>;
  const grid = (key: string) => { const f = fx[key]!; return compilePlan(parsePlanCode(f.read, f.subject, f.cols, f.rows)!); };
  describe("planGrid", () => {
    it("rasterises rect, ellipse, polygon and ring shapes on cell centres", () => {
      const sum = (m: Uint8Array) => m.reduce((a, v) => a + v, 0);
      expect(sum(rasterShape({ rect: [1, 1, 3, 2] }, 6, 6))).toBe(6);
      expect(sum(rasterShape({ ring: [{ rect: [0, 0, 5, 5] }, { rect: [1, 1, 3, 3] }] }, 6, 6))).toBe(16);
      expect(sum(rasterShape({ poly: [[0, 0], [4, 0], [0, 4]] }, 6, 6))).toBeGreaterThan(6);
      expect(rasterShape({ ellipse: [3, 3, 2, 2] }, 7, 7)[3 * 7 + 3]).toBe(1);
    });

    it("drops shapeless zones, clamps objects, and applies a zone fix by id", () => {
      const code = parsePlanCode({ zones: [{ id: "A", kind: "room", shape: { rect: [1, 1, 4, 4] } }, { id: "B", kind: "room" }], objects: [{ name: "x", x: 99, y: 1 }], entrance: { x: 2, y: 9 } }, "dungeon", 10, 10)!;
      expect(code.zones.map((z) => z.id)).toEqual(["A"]);
      expect(code.objects).toHaveLength(0);
      const fixed = applyPlanFix(code, { replace: [{ id: "A", kind: "room", shape: { rect: [2, 2, 5, 5] } }], add: [{ id: "A", kind: "hall", shape: { rect: [0, 8, 3, 2] } }] });
      expect(fixed.changed).toBe(2);
      expect(fixed.code.zones.map((z) => z.id)).toEqual(["A", "B"]);
      expect(fixed.code.zones[0]!.shape).toEqual({ rect: [2, 2, 5, 5] });
    });

    it("reaches every walkable zone from the entrance on the real vision reads", () => {
      for (const key of Object.keys(fx)) expect(checkPlan(grid(key)), key).toMatchObject({ issues: [], connectivity: 1 });
    });

    it("turns the ring-dungeon and temple plans into floors the exact dungeon layer accepts, rooms where the plan drew them", () => {
      const ts = createBeodeulCityTileset();
      for (const [key, theme] of [["p2", "catacomb"], ["p6", "temple"]] as const) {
        const g = grid(key);
        const res = planToDungeon(g, theme, bboxDungeonCatalog(ts));
        const laid = layBboxDungeon(ts, res.layout);
        expect(laid.errors, key).toEqual([]);
        const entrance = g.code.zones.find((z) => /입구/u.test(z.name))!;
        const room = res.layout.rooms!.find((r) => r.purpose === "entrance")!;
        const box = room.rects!.reduce((b, r) => ({ x0: Math.min(b.x0, r.x), y0: Math.min(b.y0, r.y) }), { x0: 999, y0: 999 });
        const planBox = rasterShape(entrance.shape, g.cols, g.rows).findIndex((v) => v === 1);
        expect(Math.abs(box.x0 - res.dx - (planBox % g.cols)), key).toBeLessThanOrEqual(3);
      }
    });

    it("turns the plateau village plan into terrain and a layout the village checker accepts", () => {
      const ts = createBeodeulCityTileset(), cat = bboxVillageCatalog(ts);
      const res = planToVillage(grid("p1"), cat);
      const rep = res.repair((L, T) => checkBboxVillage(cat, L, T));
      expect(rep.errors).toEqual([]);
      expect(rep.layout.buildings!.length).toBeGreaterThanOrEqual(3);
      expect(res.terrain.water.filter((w) => w === 3).length).toBeGreaterThan(0);
    });

    it("build_from_plan builds the plan the run request carried and refuses loudly without one", () => {
      const f = fx.p2!;
      const project = createBlankProject();
      setPlanGrid(null);
      expect(() => BUILD_FROM_PLAN_TOOL.run(project, {})).toThrow(/읽은 도면이 없다/u);
      setPlanGrid(parsePlanCode(f.read, f.subject, f.cols, f.rows));
      const r = BUILD_FROM_PLAN_TOOL.run(project, { name: "도안 던전" }) as { data: { mapId: string; kind: string } };
      setPlanGrid(null);
      expect(r.data.kind).toBe("dungeon");
      expect(project.maps[r.data.mapId]?.name).toBe("도안 던전");
    });

    it("drops enemies and moves the boss off cells the laid floor cannot reach or stand on, then the floor lays", () => {
      const ts = createBeodeulCityTileset();
      const res = planToDungeon(grid("p2"), "catacomb", bboxDungeonCatalog(ts));
      const L = res.layout;
      const bossAt = L.boss!;
      L.enemies = [...(L.enemies ?? []), { x: 0, y: 0 }, bossAt];
      L.boss = { x: 1, y: 0 };
      expect(layBboxDungeon(ts, L).errors.some((e) => /must be on walkable floor/u.test(e))).toBe(true);
      const notes: string[] = [];
      repairUnreachableActors(ts, L, notes);
      expect(layBboxDungeon(ts, L).errors).toEqual([]);
      expect(L.boss).toEqual(bossAt);
      expect(notes.join(" ")).toMatch(/boss moved/u);
    });

    it("carries the read plan into the worker run request", () => {
      const f = fx.p8!;
      const project = createBlankProject();
      const planGrid = parsePlanCode(f.read, f.subject, f.cols, f.rows)!;
      const role = { provider: "p", model: "m", thinkingLevel: "high" } as const;
      const req = buildPiRunRequest({ team: false, readOnly: false, applyMode: "default", brain: { providerId: "p", model: "m", reasoningEffort: "high" }, deep: role, writer: role,
        modelTask: "t", executionTask: "t", mapIds: [project.startMapId], project, scopedByUser: false, mapBundleMerge: false, planGrid });
      expect(req.planGrid).toBe(planGrid);
    });

    it("turns the house plan into separated rooms with doors between drawn neighbours", () => {
      const res = planToInterior(grid("p8"), [{ id: "fireplace", ko: "벽난로", kind: "wall", w: 2, h: 1 }, { id: "bed blue", ko: "침대 파랑", kind: "wall", w: 1, h: 2 }]);
      const rooms = res.args.rooms;
      expect(rooms.length).toBeGreaterThanOrEqual(4);
      for (const a of rooms) for (const b of rooms) if (a !== b) expect(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0, `${a.id}/${b.id}`).toBe(true);
      expect(res.args.connect.length).toBeGreaterThanOrEqual(rooms.length - 1);
      expect(res.args.objects.map((o) => o.id)).toEqual(expect.arrayContaining(["fireplace", "bed blue"]));
    });
  });
});

describe("projectFontToolContract", () => {
  isolateTimers();
  const settings = PROJECT_TOOLS.find(tool => tool.name === "set_project_settings")!;
  describe("project font tool provider contract", () => {
    it("does not send empty enum members that prevent Gemini from starting any tool call", () => {
      const visit = (schema: JsonSchema): void => {
        expect(schema.enum ?? []).not.toContain("");
        for (const child of Object.values(schema.properties ?? {})) visit(child);
        for (const child of schema.oneOf ?? []) visit(child);
        if (schema.items) visit(schema.items);
      };
      visit(settings.parameters);
    });

    it("preserves role validation and the empty-string reset at execution", () => {
      const project = createBlankProject();
      settings.run(project, { fonts: { ui: "galmuri11", pixel: "galmuri9", mono: "neodgm" } });
      settings.run(project, { fonts: { ui: "" } });
      expect(project.system.fonts).toEqual({ pixel: "galmuri9", mono: "neodgm" });
      for (const role of FONT_ROLES) {
        const before = structuredClone(project.system.fonts);
        expect(() => settings.run(project, { fonts: { [role]: "unknown-font" } })).toThrow();
        expect(project.system.fonts).toEqual(before);
        const unsuitable = ["system-sans", "system-serif", "system-mono"].find(id => !fontOptionsForRole(role).some(font => font.id === id));
        if (unsuitable) expect(() => settings.run(project, { fonts: { [role]: unsuitable } })).toThrow();
      }
    });
  });
});
