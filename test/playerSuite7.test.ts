import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { exportAssetBaseFor } from "@/player/exportAssetBase";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FARMING_LIFE_UI_ASSETS } from "@/assets/farmingLifeUi";
import runtimeAssetInventory from "@/player/runtimeAssets.json";
import { deriveFieldFoeSheet, fieldFoeGain } from "@/player/fieldFoeSprite";
import { eventSpriteScale, withDerivedFieldFoe, eventSpriteFrameForDirection, resolveEventSpriteTexture, setEventSpritePattern } from "@/player/eventSpriteResources";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { createBattleRuntime, type BattleRuntime } from "@/battle/runtime";
import type { ActorCommand } from "@/battle/types";
import { createBattleSequencer } from "@/player/battleSequencer";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { store } from "@/project/store";
import { type ActorParameterKey, type Project, type Command, type GameEvent, type GameMap, SCHEMA_VERSION } from "@/project/types";
import { loadBundledAssets } from "@/assets/bundled";
import { generatedMonsterSpriteUrl } from "@/assets/generatedMonsterSprites";
import { registerInlineAssets } from "@/assets/inlineAssetStore";
import { createBlankProject, DEFAULT_EASYRPG_CHARSET_ID, DEFAULT_ACTOR_ID } from "@/project/defaults";
import { startSession, type PlaySession, showPictureState, type PictureState } from "@/project/session";
import { collectWebExportAssets } from "@/project/webExportAssets";
import { createFieldSpawnRuntime, syncFieldSpawnEventsIntoMap } from "@/player/fieldSpawns";
import { renderEventLayer } from "@/player/playSceneMapRuntime";
import { setNpcIdleFrame, setNpcWalkFrame } from "@/player/playSceneAutonomousSprites";
import { applyMoveRouteGraphicChange } from "@/player/playSceneAutonomousRouteEffects";
import { runtimeEventViewsForMap, type RuntimeEventView } from "@/project/runtimeEventState";
import { mockSprite, mockTileImage } from "./runtimeEventPageFixtures";
import { DIRECTION_REPEAT_DELAY_MS, DIRECTION_REPEAT_INTERVAL_MS, HeldDirectionRepeat } from "@/player/heldDirectionRepeat";
import { hudYieldState } from "@/player/hudYield";
import { objectiveHome } from "@/player/objectivePlacement";
import { eventKeyCodeFromKeyboardEvent } from "@/player/eventInput";
import { keyboardEventKey, runtimeKeyFromEvent, directionForKey, isAutoBattleKey, isCancelKey, isConfirmKey, isMenuKey, isSkillKey, normalizeKey } from "@/player/keyBindings";
import { createInterpreter } from "@/player/interpreter";
import { innTextModel } from "@/player/playSceneCommerce";
import { recoverPartyVitals, type ActorVitals } from "@/project/sessionVitals";
import { resolveTerms } from "@/project/terms";
import { directionForRuntimeKey, Input, RuntimeKeyHoldTracker } from "@/player/input";
import type Phaser from "phaser";
import { ACTION_REACH_CELLS, canExamineFrom, pickNearbyActionTarget, withinActionReach } from "@/player/nearbyActionTarget";
import { isDialogueAdvanceKey } from "@/player/dialogue";
import { reduceStatusMenuKeyboard, type RuntimeMenuKey } from "@/player/runtimeKeyboardMenu";
import { type Season, advanceGameDays } from "@/project/gameTime";
import { lifeCalendarHudLines } from "@/player/lifeCalendarHud";
import * as saves from "@/player/saveSlots";
import * as old from "./fixtures/life-full/saveSlots.phase1";
import { maybeAutosave, performAutosave, resetAutosaveDebounce } from "@/player/autosave";
import { getSessionCheckpoint, restoreSessionCheckpoint, saveSessionCheckpoint } from "@/player/checkpoints";
import { isolateTimers } from "./mergedTeardown";
import { RuntimeDomOverlay } from "@/player/runtimeDom";
import { runTransitionPhase } from "@/player/transitions/transitionOverlay";
import { createSaveSnapshot, applySaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { FakeElement, installFakeDom, findByTestId, flushFakeAnimationFrames } from "./fakeDom";
import { blindBars, mosaicBlockSize, mosaicCoverAlpha, parseTransitionKind, transitionProgress, usesOverlayTransition } from "@/player/transitions/transitionModel";

describe("playerSuite7", () => {
  isolateTimers();
  describe("exportAssetBase", () => {
    isolateTimers();
    describe("exportAssetBaseFor", () => {
      it("reads public assets from the host root when the player lives in the hosted /export-player/ bundle", () => {
        expect(exportAssetBaseFor("http://mdc-server:9888/export-player/player.html?demo=fallen-star").href).toBe("http://mdc-server:9888/");
        expect(exportAssetBaseFor("http://h/sub/export-player/player.html").href).toBe("http://h/sub/");
      });

      it("keeps an exported game's assets next to its player.html", () => {
        expect(exportAssetBaseFor("http://127.0.0.1:4000/player.html").href).toBe("http://127.0.0.1:4000/");
        expect(exportAssetBaseFor("https://site/games/demo/player.html").href).toBe("https://site/games/demo/");
        expect(exportAssetBaseFor("file:///home/u/my-game/player.html").href).toBe("file:///home/u/my-game/");
        expect(exportAssetBaseFor("https://site/my-export-player/player.html").href).toBe("https://site/my-export-player/");
      });

      it("lets the editor combat probe climb out of the bundle folder", () => {
        expect(exportAssetBaseFor("http://h/bundle/player.html", { editorProbe: true }).href).toBe("http://h/");
      });
    });
  });
  describe("farmingLifeUiAssets", () => {
    isolateTimers();
    describe("farming life UI assets", () => {
      it("registers every P0-P2 journal illustration at a shipped public path", () => {
        // Break caught: a generated card exists only in a local imagegen folder or is
        // referenced with a path that the exported player cannot serve.
        expect(Object.keys(FARMING_LIFE_UI_ASSETS)).toEqual([
          "animals",
          "buildings",
          "bundles",
          "decorating",
          "fishing",
          "foraging",
          "makers",
          "museum",
        ]);
        const paths = Object.values(FARMING_LIFE_UI_ASSETS);
        expect(new Set(paths).size).toBe(paths.length);
        for (const path of paths) {
          expect(path).toMatch(/^\/assets\/farming\/life-ui\/[a-z-]+\.png$/);
          expect(existsSync(resolve("public", path.slice(1)))).toBe(true);
          expect(runtimeAssetInventory.paths).toContain(path.slice(1));
        }
      });
    });
  });
  describe("fieldFoeSprite", () => {
    isolateTimers();
    /** 64x64 battler stand-in: a 40x30 body facing right with a bright "head" block on the right edge. */
    function battler(): { w: number; h: number; data: Uint8ClampedArray } {
      const w = 64, h = 64, data = new Uint8ClampedArray(w * h * 4);
      for (let y = 30; y < 60; y += 1) for (let x = 10; x < 50; x += 1) {
        const i = (y * w + x) * 4;
        const head = x >= 42;
        data.set(head ? [230, 200, 60, 255] : [90, 96, 110, 255], i);
      }
      return { w, h, data };
    }
    describe("derived field-foe sheet", () => {
      it("halves 64px battle art exactly (40x30 body → 20x15 + 2px outline/rim each side) in a 3x4 charset grid", () => {
        const sheet = deriveFieldFoeSheet(battler())!;
        expect(sheet.frameW).toBe(20 + 4);
        expect(sheet.w).toBe(sheet.frameW * 3);
        expect(sheet.h).toBe(sheet.frameH * 4);
      });

      it("faces right in the right row and mirrored in the left row", () => {
        const sheet = deriveFieldFoeSheet(battler())!;
        const headSide = (row: number): "left" | "right" => {
          const y = row * sheet.frameH + sheet.frameH - 6;
          let left = 0, right = 0;
          for (let x = 0; x < sheet.frameW; x += 1) {
            const i = (y * sheet.w + sheet.frameW + x) * 4; // column 1 (standing)
            if (sheet.data[i] === 230) (x < sheet.frameW / 2 ? (left += 1) : (right += 1));
          }
          return right > left ? "right" : "left";
        };
        expect(headSide(1)).toBe("right");
        expect(headSide(3)).toBe("left");
      });

      it("adds a dark outline and a light outer rim around the body", () => {
        const sheet = deriveFieldFoeSheet(battler())!;
        const y = sheet.frameH + Math.floor(sheet.frameH / 2);
        const row = Array.from({ length: sheet.frameW }, (_, x) => Array.from(sheet.data.subarray((y * sheet.w + sheet.frameW + x) * 4, (y * sheet.w + sheet.frameW + x) * 4 + 4)));
        const first = row.findIndex((p) => p[3]! > 0);
        expect(row[first]![0]).toBeGreaterThan(200); // rim
        expect(row[first + 1]![0]).toBeLessThan(90); // outline
      });

      it("cuts a whole-number enlarged foe at that much more detail instead of stretching the small chip (64px art ×2 → 1:1 body)", () => {
        expect(fieldFoeGain(64, 64, 2)).toBe(2);
        expect(fieldFoeGain(128, 128, 2)).toBe(2);
        expect(fieldFoeGain(128, 128, 3)).toBe(2);
        expect(fieldFoeGain(32, 32, 2)).toBe(1);
        const sheet = deriveFieldFoeSheet(battler(), 2)!;
        expect(sheet.frameW).toBe(40 + 4);
        // the authored ×2 is divided by the gain: same size on the map, drawn from the battle art's own pixels
        const derived = { texture: "__oprn_field_foe:x@2", frame: 0, charset: true, derived: true, gain: 2 };
        const plain = { texture: "__oprn_field_foe:x", frame: 0, charset: true, derived: true };
        expect(eventSpriteScale(derived, { width: 44 }, 2, 16, "manual")).toBe(1);
        expect(eventSpriteScale(plain, { width: 24 }, 2, 16, "manual")).toBe(2);
      });

      it("returns null for fully transparent art", () => {
        expect(deriveFieldFoeSheet({ w: 8, h: 8, data: new Uint8ClampedArray(256) })).toBeNull();
      });

      it("leaves explicit charsets alone and falls back to the static battler when the source is not loaded", () => {
        const scene = { textures: { exists: () => false, get: () => undefined, addCanvas: () => null } };
        const charset = { texture: "tex_easyrpg_charset_actor1", frame: charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }) };
        expect(withDerivedFieldFoe(scene, charset)).toBe(charset);
        const monster = { texture: "generated-enemy-wolf-grey", frame: "__BASE", fitSize: 32, monster: true };
        expect(withDerivedFieldFoe(scene, monster)).toBe(monster);
      });
    });
  });
  // gen1 주요 상태는 하나만 걸린다. 화상 중인 대상에게 마비 기술이 막히면
  // 「효과가 없었다」는 빗나감으로 읽힌다. 이미 있는 상태 이름을 말한다.
  describe("gen1MajorStatusMessage", () => {
    isolateTimers();
    const previous = store.getCurrent();
    afterEach(() => {
      store.replaceProject(previous);
    });
    function setActorParam(project: Project, key: ActorParameterKey, value: number): void {
      const actor = project.database.actors.find((record) => record.id === project.system.startActorIds[0]);
      if (!actor) throw new Error("missing start actor");
      actor.parameterCurves[key] = Array.from({ length: 99 }, () => value);
    }
    function teachStatusMove(project: Project, id: string, name: string, stateId: string, kind: "support" | "damage"): void {
      const base = project.database.skills.find((skill) => skill.id === "skill_scarloxy_scratch");
      const actor = project.database.actors.find((record) => record.id === project.system.startActorIds[0]);
      if (!base || !actor) throw new Error("missing scratch skill or start actor");
      project.database.skills.push({
        ...base,
        id,
        name,
        power: kind === "damage" ? 1 : 0,
        hitRate: 100,
        successRate: 100,
        mpCost: { flat: 0, percentMax: 0 },
        maxPp: 10,
        scope: "enemy",
        effect: kind === "damage" ? { kind: "damage", statistic: "attack", affects: "hp" } : { kind: "support" },
        stateEffects: [{ stateId, chance: 100, operation: "add" }],
      });
      actor.learnedSkills = [...actor.learnedSkills, { level: 1, skillId: id }];
    }
    function battle(troopId = "troop_pkmn_grass_a"): BattleRuntime {
      const project = createScarloxyPokemonDemoProject();
      teachStatusMove(project, "skill_test_burn_status", "확정 화상", "state_burn", "support");
      teachStatusMove(project, "skill_test_para_status", "확정 마비", "state_paralysis", "support");
      teachStatusMove(project, "skill_test_burn_hit", "약한 화상", "state_burn", "damage");
      for (const enemy of project.database.enemies) {
        if (!enemy.id.startsWith("enemy_pkmn_")) continue;
        enemy.stats = { ...enemy.stats, maxHp: 80, attack: 1, agility: 1, defense: 1 };
      }
      const actorId = project.system.startActorIds[0]!;
      setActorParam(project, "maxHp", 200);
      setActorParam(project, "defense", 200);
      setActorParam(project, "agility", 999);
      store.replaceProject(project);
      return createBattleRuntime({
        project,
        troopId,
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        party: { levels: { [actorId]: 20 }, experience: {}, partyActorIds: [actorId] },
        rng: () => 0,
      });
    }
    /** 한 시퀀서가 타임라인을 이어서 읽는다. 호출마다 그 명령이 새로 남긴 문장만 돌려준다. */
    function playback(runtime: BattleRuntime): (command: ActorCommand) => string[] {
      const queue: Array<() => void> = [];
      let lines: string[] = [];
      const sequencer = createBattleSequencer(
        runtime,
        {
          onDirectorState: (state) => lines.push(...state.lines),
          onSyncView: () => undefined,
          onDamageFeedback: () => undefined,
          onResultStage: () => undefined,
          onSequenceBusy: () => undefined,
        },
        (callback) => {
          queue.push(callback);
          return queue.length;
        },
        () => undefined,
      );
      return (command) => {
        lines = [];
        const before = runtime.snapshot();
        runtime.performActorCommand(command);
        sequencer.runAfterActorCommand(command, before, runtime.snapshot());
        let guard = 0;
        while (queue.length > 0 && guard < 80) {
          queue.shift()?.();
          guard += 1;
        }
        return lines;
      };
    }
    describe("gen1 major status battle message", () => {
      it("names the status already on the target when a different major status is blocked", () => {
        const runtime = battle();
        const play = playback(runtime);
        expect(runtime.snapshot().phase).toBe("actorCommand");
        play({ kind: "skill", skillId: "skill_test_burn_status", targetEnemyId: "enemy-1" });
        const burned = runtime.snapshot().enemies.find((enemy) => enemy.id === "enemy-1");
        expect(burned?.hp).toBeGreaterThan(0);
        expect(burned?.stateIds).toContain("state_burn");
        expect(runtime.snapshot().phase).toBe("actorCommand");

        const lines = play({ kind: "skill", skillId: "skill_test_para_status", targetEnemyId: "enemy-1" });
        const enemy = runtime.snapshot().enemies.find((entry) => entry.id === "enemy-1");
        expect(enemy?.stateIds).toContain("state_burn");
        expect(enemy?.stateIds ?? []).not.toContain("state_paralysis");
        expect(lines).toContain("라르베아는 이미 화상 상태다.");
        expect(lines).not.toContain("라르베아에게는 효과가 없었다.");
      });

      it("keeps the same-status line and does not announce it for a damaging hit's secondary status", () => {
        const runtime = battle();
        const play = playback(runtime);
        play({ kind: "skill", skillId: "skill_test_burn_status", targetEnemyId: "enemy-1" });
        const again = play({ kind: "skill", skillId: "skill_test_burn_status", targetEnemyId: "enemy-1" });
        expect(again).toContain("라르베아는 이미 화상 상태다.");

        const hit = play({ kind: "skill", skillId: "skill_test_burn_hit", targetEnemyId: "enemy-1" });
        expect(hit.some((line) => line.includes("이미 화상"))).toBe(false);
        expect(runtime.snapshot().enemies.find((enemy) => enemy.id === "enemy-1")?.stateIds).toContain("state_burn");
      });

      it("refuses burn on a fire type even from a normal move, and names the type instead of another status", () => {
        const runtime = battle("troop_pkmn_new_pair");
        const play = playback(runtime);
        const emberkit = () => runtime.snapshot().enemies.find((enemy) => enemy.id === "enemy-1");
        expect(emberkit()?.name).toBe("엠버킷");

        const paralyzed = play({ kind: "skill", skillId: "skill_test_para_status", targetEnemyId: "enemy-1" });
        expect(paralyzed.some((line) => line.includes("마비에 걸렸다"))).toBe(true);
        expect(emberkit()?.stateIds).toContain("state_paralysis");

        const burned = play({ kind: "skill", skillId: "skill_test_burn_status", targetEnemyId: "enemy-1" });
        expect(emberkit()?.stateIds).toContain("state_paralysis");
        expect(emberkit()?.stateIds ?? []).not.toContain("state_burn");
        expect(burned).toContain("엠버킷은 불꽃 타입이라 화상 상태에 걸리지 않는다!");
        expect(burned.some((line) => line.includes("이미 마비"))).toBe(false);
        expect(burned).not.toContain("엠버킷에게는 효과가 없었다.");

        const hit = play({ kind: "skill", skillId: "skill_test_burn_hit", targetEnemyId: "enemy-1" });
        expect(emberkit()?.stateIds ?? []).not.toContain("state_burn");
        expect(hit.some((line) => line.includes("화상 상태에 걸리지"))).toBe(false);
      });
    });
  });
  describe("generatedMonsterFieldSprites", () => {
    isolateTimers();
    const monsterId = "generated-enemy-slime-green";
    const monsterPath = "assets/generated/pixel-enemy-portraits/slime-green.png";
    function projectWithSpawn(resourceId = monsterId) {
      const project = createBlankProject();
      const enemy = project.database.enemies[0]!;
      enemy.monsterResourceId = resourceId;
      project.database.enemies = [enemy];
      project.resourceProfiles = [];
      const troop = project.database.troops[0]!;
      troop.enemyIds = [enemy.id];
      troop.members = [{ enemyId: enemy.id, x: 160, y: 96, hidden: false }];
      project.database.troops = [troop];
      const map = project.maps[project.startMapId]!;
      map.events = [];
      map.fieldSpawns = [{ id: "catalog_monster", troopId: troop.id, area: { x: 2, y: 2, w: 1, h: 1 }, maxAlive: 1 }];
      return project;
    }
    function preload(project: ReturnType<typeof projectWithSpawn>) {
      const image = vi.fn();
      loadBundledAssets({ load: { image, on: vi.fn() } } as unknown as Parameters<typeof loadBundledAssets>[0], project);
      return image;
    }
    function spawnScene(resourceId = monsterId) {
      const project = projectWithSpawn(resourceId);
      const map = project.maps[project.startMapId]!;
      const eventPositions = {};
      const runtime = createFieldSpawnRuntime(project, map, { x: 0, y: 0 });
      syncFieldSpawnEventsIntoMap(map, runtime, eventPositions);
      store.replace(project);
      // Use the shipped PNG's IHDR dimensions, not an assumed charset cell size.
      const png = readFileSync(new URL(`../public/${monsterPath}`, import.meta.url));
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      const makeSprite = (x: number, y: number, texture: string, frame?: string | number) => {
        const sprite = Object.assign(mockSprite(x, y, texture), { width, height, scale: 1, setScale: vi.fn() });
        sprite.setFrame(frame ?? 0);
        sprite.setScale.mockImplementation((value: number) => { sprite.scale = value; });
        return sprite;
      };
      return {
        map, session: startSession(project), eventPositions,
        tileLayer: { removeAll: vi.fn(), add: vi.fn() },
        eventSprites: new Map<string, ReturnType<typeof makeSprite>>(),
        eventGraphicPatternOverrides: new Map<string, number>(),
        runtimeDom: { clearEventMarkers: vi.fn(), upsertEventMarker: vi.fn(), syncMissingResourceError: vi.fn() },
        missingResources: new Set<string>(),
        add: { image: mockTileImage, sprite: makeSprite },
        runEvent: async () => undefined, syncRuntimeState: vi.fn(),
      };
    }
    afterEach(() => registerInlineAssets(null));
    describe("generated monster field sprites", () => {
      it("preloads and exports the actual enemy art before its default field event is materialized", () => {
        const project = projectWithSpawn();
        expect(project.maps[project.startMapId]!.events).toEqual([]);
        const image = preload(project);
        expect(image.mock.calls.filter(([key]) => key === monsterId)).toEqual([[monsterId, `/${monsterPath}`]]);
        expect(image.mock.calls.some(([key]) => key === "generated-enemy-behemoth-horn")).toBe(false);
        expect(collectWebExportAssets(project)).toContainEqual(expect.objectContaining({ sourcePath: monsterPath, resourceId: monsterId }));
      });

      it("uses the inline copy of the same art in standalone exports", () => {
        const dataUrl = "data:image/png;base64,AA==";
        registerInlineAssets({ [monsterPath]: dataUrl });
        expect(preload(projectWithSpawn())).toHaveBeenCalledWith(monsterId, dataUrl);
      });

      it("renders the whole actual PNG at field size, with its feet and depth at the spawn tile", () => {
        const scene = spawnScene();
        const id = scene.map.events[0]!.id;
        renderEventLayer(scene);
        const sprite = scene.eventSprites.get(id)!;
        expect(sprite.texture.key).toBe(monsterId);
        expect(sprite.frame).toBe("__BASE");
        expect(Math.max(sprite.width, sprite.height) * sprite.scale).toBe(32);
        expect(sprite.origin).toEqual([0.5, 1]);
        expect([sprite.x, sprite.y, sprite.depth]).toEqual([40, 48, 200048]);
        expect(scene.missingResources.size).toBe(0);
        setNpcWalkFrame(sprite, 0, "left", 240, "normal", true);
        setNpcIdleFrame(sprite, 0, "right", "normal", true);
        setEventSpritePattern(store.getCurrent(), sprite, 37);
        expect(sprite.frame).toBe("__BASE");
        scene.eventGraphicPatternOverrides.set(id, 37);
        renderEventLayer(scene);
        expect(scene.eventSprites.get(id)!.frame).toBe("__BASE");
      });

      it("preserves source aspect ratio and multiplies the field fit by authored scale", () => {
        const resolved = resolveEventSpriteTexture(projectWithSpawn(), monsterId, 37)!;
        expect(eventSpriteFrameForDirection(resolved, "left")).toBe("__BASE");
        expect(eventSpriteScale(resolved, { width: 384, height: 192 }, 2)).toBe(1 / 6);
        const scene = spawnScene();
        scene.map.events[0]!.pages![0]!.graphic.scale = 2;
        renderEventLayer(scene);
        const sprite = [...scene.eventSprites.values()][0]!;
        expect(Math.max(sprite.width, sprite.height) * sprite.scale).toBe(64);
      });

      it("keeps unknown generated IDs visible as warnings with the existing fallback", () => {
        const unknown = "generated-enemy-missing-slime-resource";
        expect(generatedMonsterSpriteUrl(unknown)).toBeNull();
        expect(preload(projectWithSpawn(unknown)).mock.calls.some(([key]) => key === unknown)).toBe(false);
        const scene = spawnScene(unknown);
        renderEventLayer(scene);
        expect([...scene.eventSprites.values()][0]!.texture.key).toBe(DEFAULT_EASYRPG_CHARSET_ID);
        expect(scene.missingResources).toEqual(new Set([unknown]));
        expect(scene.runtimeDom.syncMissingResourceError).toHaveBeenCalledWith(new Set([unknown]));
      });

      it("fits a movement-route monster graphic and restores authored scale when returning to a charset", () => {
        const scene = spawnScene();
        renderEventLayer(scene);
        const sprite = [...scene.eventSprites.values()][0]!;
        const view = runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)[0]!;
        applyMoveRouteGraphicChange(monsterId, view, sprite);
        expect(sprite.frame).toBe("__BASE");
        expect(Math.max(sprite.width, sprite.height) * sprite.scale).toBe(32);
        applyMoveRouteGraphicChange(DEFAULT_EASYRPG_CHARSET_ID, view, sprite);
        expect(sprite.texture.key).toBe(DEFAULT_EASYRPG_CHARSET_ID);
        expect(sprite.scale).toBe(view.scale);
        setEventSpritePattern(store.getCurrent(), sprite, 37);
        expect(sprite.frame).toBe(37);
      });

      it("preserves project sprite, upload, and bundled charset ownership and frames", () => {
        const project = projectWithSpawn();
        const sprite = Object.values(project.assets.sprites)[0]!;
        project.assets.sprites[monsterId] = { ...sprite, image: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID } };
        expect(resolveEventSpriteTexture(project, monsterId, 5)).toEqual({ texture: DEFAULT_EASYRPG_CHARSET_ID, frame: 5 });
        expect(preload(project).mock.calls.some(([key]) => key === monsterId)).toBe(false);
        delete project.assets.sprites[monsterId];
        project.assets.uploaded[monsterId] = { id: monsterId, kind: "monster", name: "custom", dataUrl: "data:image/png;base64,AA==", meta: {} };
        expect(resolveEventSpriteTexture(project, monsterId, 5)).toEqual({ texture: monsterId, frame: "__BASE", fitSize: 32, monster: true });
        expect(preload(project)).toHaveBeenCalledWith(monsterId, "data:image/png;base64,AA==");
        const charset = resolveEventSpriteTexture(project, DEFAULT_EASYRPG_CHARSET_ID, 0);
        expect(charset).toEqual({ texture: DEFAULT_EASYRPG_CHARSET_ID, frame: 0 });
        expect(eventSpriteScale(charset, { width: 24, height: 32 }, 2)).toBe(2);
      });
    });
  });
  describe("heldDirectionRepeat", () => {
    isolateTimers();
    describe("held direction repeat", () => {
      it("waits out the delay, then repeats, and starts over when the direction changes", () => {
        const repeat = new HeldDirectionRepeat();
        const start = 10_000;

        expect(repeat.tick(["ArrowDown", "Enter", "Shift"], start)).toEqual([]);
        expect(repeat.tick(["ArrowDown"], start + DIRECTION_REPEAT_DELAY_MS - 1)).toEqual([]);
        expect(repeat.tick(["ArrowDown"], start + DIRECTION_REPEAT_DELAY_MS)).toEqual(["ArrowDown"]);
        expect(repeat.tick(["ArrowDown"], start + DIRECTION_REPEAT_DELAY_MS + DIRECTION_REPEAT_INTERVAL_MS - 1)).toEqual([]);
        expect(repeat.tick(["ArrowDown"], start + DIRECTION_REPEAT_DELAY_MS + DIRECTION_REPEAT_INTERVAL_MS)).toEqual(["ArrowDown"]);

        const changedAt = start + 2_000;
        expect(repeat.tick(["ArrowUp"], changedAt)).toEqual([]);
        expect(repeat.tick(["ArrowUp"], changedAt + DIRECTION_REPEAT_DELAY_MS - 1)).toEqual([]);
        expect(repeat.tick(["ArrowUp"], changedAt + DIRECTION_REPEAT_DELAY_MS)).toEqual(["ArrowUp"]);
      });

      it("forgets a direction that was released", () => {
        const repeat = new HeldDirectionRepeat();
        repeat.tick(["ArrowLeft"], 0);
        repeat.tick([], 10);
        expect(repeat.tick(["ArrowLeft"], DIRECTION_REPEAT_DELAY_MS)).toEqual([]);
        expect(repeat.tick(["ArrowLeft"], DIRECTION_REPEAT_DELAY_MS + DIRECTION_REPEAT_DELAY_MS)).toEqual(["ArrowLeft"]);
      });
    });
  });
  // 상시 창 비키기 — 주인공·마주 본 것을 덮은 창은 흐려지고, 잠깐 뜨는 알림과 겹친 창은 숨는다(자리는 그대로).
  describe("hudYield", () => {
    isolateTimers();
    const panel = { x: 10, y: 10, width: 90, height: 138 };
    describe("hudYieldState", () => {
      it("fades a panel while the hero's ring is under it and restores it afterwards", () => {
        const under = { x: 40, y: 100, width: 48, height: 48 };
        const away = { x: 200, y: 150, width: 48, height: 48 };
        expect(hudYieldState(panel, [under], [])).toBe("fade");
        expect(hudYieldState(panel, [away], [])).toBeNull();
      });

      it("hides a panel under a banner even when the hero is also under it", () => {
        const banner = { x: 80, y: 20, width: 160, height: 100 };
        expect(hudYieldState(panel, [{ x: 40, y: 100, width: 48, height: 48 }], [banner])).toBe("hide");
        expect(hudYieldState({ x: 250, y: 200, width: 60, height: 30 }, [], [banner])).toBeNull();
      });

      it("keeps a faded panel faded until the hero is clearly out (no flicker on the edge)", () => {
        const justOut = { x: 101, y: 50, width: 48, height: 48 }; // 판 오른쪽 끝(100)에서 1px 밖
        expect(hudYieldState(panel, [justOut], [])).toBeNull();
        expect(hudYieldState(panel, [justOut], [], "fade")).toBe("fade");
        expect(hudYieldState(panel, [{ ...justOut, x: 110 }], [], "fade")).toBeNull();
      });
    });
    describe("objectiveHome", () => {
      const stage = { width: 320, height: 240 };
      const box = { width: 120, height: 30 };

      it("is the top-right corner whatever stands under it", () => {
        expect(objectiveHome({ stage, box, margin: 4, hud: [] })).toEqual({ x: 196, y: 4, width: 120 });
        // 왼쪽 위의 동료 판은 목표 창 자리와 상관없다.
        expect(objectiveHome({ stage, box, margin: 4, hud: [panel] })).toEqual({ x: 196, y: 4, width: 120 });
      });

      it("stacks under fixed HUD boxes that already hold the top-right corner", () => {
        const clock = { x: 234, y: 10, width: 76, height: 44 };
        const gold = { x: 234, y: 58, width: 76, height: 23 };
        expect(objectiveHome({ stage, box, margin: 4, hud: [clock] })).toEqual({ x: 196, y: 58, width: 120 });
        expect(objectiveHome({ stage, box, margin: 4, hud: [gold, clock] })).toEqual({ x: 196, y: 85, width: 120 });
      });

      it("stays in the corner when the top is so full that it would land in the lower half", () => {
        const tall = { x: 200, y: 0, width: 120, height: 110 };
        expect(objectiveHome({ stage, box, margin: 4, hud: [tall] }).y).toBe(4);
      });
    });
  });
  describe("imeKeyboardKey", () => {
    isolateTimers();
    describe("IME physical keys", () => {
      it("keeps a normal key and recovers the physical key from an IME Process event", () => {
        expect(keyboardEventKey({ key: "B" })).toBe("B");
        expect(keyboardEventKey({ key: "ArrowLeft" })).toBe("ArrowLeft");
        expect(keyboardEventKey({ key: "Process", code: "KeyW", keyCode: 229 })).toBe("w");
        expect(keyboardEventKey({ key: "Process", code: "Digit1", keyCode: 229 })).toBe("1");
        expect(keyboardEventKey({ key: "Unidentified", code: "Space", keyCode: 229 })).toBe(" ");
        expect(keyboardEventKey({ key: "Process", code: "Enter", keyCode: 229 })).toBe("Enter");
        expect(keyboardEventKey({ key: "Process", keyCode: 229 })).toBe("Process");
      });

      it("does not turn typing or an unmapped composition into a gameplay key", () => {
        const input = { tagName: "INPUT", type: "text", getAttribute: () => "text" };
        expect(runtimeKeyFromEvent({ key: "w", target: input })).toBeNull();
        expect(runtimeKeyFromEvent({ key: "Process", code: "KeyW", keyCode: 229 })).toBe("w");
        expect(runtimeKeyFromEvent({ key: "Process", keyCode: 229 })).toBeNull();
        expect(runtimeKeyFromEvent({ key: "가", isComposing: true })).toBeNull();
        expect(runtimeKeyFromEvent({ key: "z" })).toBe("z");
      });

      it("does not end a key-input wait on a bare IME Process key", () => {
        expect(eventKeyCodeFromKeyboardEvent({ key: "Process", keyCode: 229 })).toBeNull();
        expect(eventKeyCodeFromKeyboardEvent({ key: "Process", code: "KeyZ", keyCode: 229 })).toBe(5);
        expect(eventKeyCodeFromKeyboardEvent({ key: "Process", code: "KeyW", keyCode: 229 })).toBe(4);
        expect(eventKeyCodeFromKeyboardEvent({ key: "z" })).toBe(5);
        expect(eventKeyCodeFromKeyboardEvent({ key: "q" })).toBe(0);
        expect(eventKeyCodeFromKeyboardEvent({ key: "z", repeat: true })).toBeNull();
        expect(eventKeyCodeFromKeyboardEvent({ key: "z", isComposing: true })).toBeNull();
        const input = { tagName: "INPUT", type: "text", getAttribute: () => "text" };
        expect(eventKeyCodeFromKeyboardEvent({ key: "Process", code: "KeyZ", keyCode: 229, target: input })).toBeNull();
      });
    });
  });
  describe("innRuntimeP1P2", () => {
    isolateTimers();
    describe("inn P1/P2 runtime contracts", () => {
      it("uses custom note/question and HP-only wake copy", () => {
        const text = innTextModel(
          {
            kind: "inn",
            price: 12,
            note: "Welcome traveler",
            question: "Stay the night?",
            recoverMp: false,
          },
          resolveTerms(createBlankProject())
        );
        expect(text.note).toBe("Welcome traveler");
        expect(text.question).toBe("Stay the night?");
        expect(text.wakeMessage).toContain("HP");
      });

      it("recovers HP only when recoverMp is false", () => {
        const vitals: Record<string, ActorVitals> = {
          [DEFAULT_ACTOR_ID]: { hp: 1, mp: 2, maxHp: 10, maxMp: 8 },
        };
        recoverPartyVitals(vitals, [DEFAULT_ACTOR_ID], { recoverMp: false });
        expect(vitals[DEFAULT_ACTOR_ID]?.hp).toBe(10);
        expect(vitals[DEFAULT_ACTOR_ID]?.mp).toBe(2);
      });

      it("pushes notEnoughBranch when inn resumes with notEnough", () => {
        const project = createBlankProject();
        const session = startSession(project);
        const commands: Command[] = [
          {
            kind: "inn",
            price: 99,
            branchOnNotEnoughGold: true,
            notEnoughBranch: [{ kind: "text", body: "not-enough-gold" }],
          },
          { kind: "text", body: "after-inn" },
        ];
        const interpreter = createInterpreter(commands, session, project);
        const pause = interpreter.start();
        expect(pause.kind).toBe("inn");
        if (pause.kind !== "inn") return;
        expect(pause.branchOnNotEnoughGold).toBe(true);

        const next = interpreter.resume("notEnough");
        expect(next.kind).toBe("text");
        if (next.kind === "text") expect(next.body).toBe("not-enough-gold");
      });
    });
  });
  describe("input", () => {
    isolateTimers();
    describe("runtime input", () => {
      it("maps arrow keys and WASD to RPG movement directions", () => {
        expect(directionForRuntimeKey("ArrowDown")).toBe("down");
        expect(directionForRuntimeKey("ArrowLeft")).toBe("left");
        expect(directionForRuntimeKey("ArrowRight")).toBe("right");
        expect(directionForRuntimeKey("ArrowUp")).toBe("up");
        expect(directionForRuntimeKey("s")).toBe("down");
        expect(directionForRuntimeKey("A")).toBe("left");
        expect(directionForRuntimeKey("d")).toBe("right");
        expect(directionForRuntimeKey("W")).toBe("up");
        expect(directionForRuntimeKey("x")).toBeNull();
      });

      it("keeps a held arrow direction active until keyup instead of waiting for key repeat", () => {
        const tracker = new RuntimeKeyHoldTracker();

        tracker.keyDown("ArrowRight");

        expect(tracker.heldDirections()).toEqual(["right"]);
        expect(tracker.heldDirections()).toEqual(["right"]);

        tracker.keyUp("ArrowRight");

        expect(tracker.heldDirections()).toEqual([]);
      });

      it("emits one action edge for a held key and waits for release before the next action", () => {
        const tracker = new RuntimeKeyHoldTracker();

        tracker.keyDown("Enter");

        expect(tracker.consumeActionEdge()).toBe(true);

        tracker.keyDown("Enter");

        expect(tracker.consumeActionEdge()).toBe(false);

        tracker.keyUp("Enter");
        tracker.keyDown("Enter");

        expect(tracker.consumeActionEdge()).toBe(true);
      });

      it("treats Z as the RPG Maker action key", () => {
        const tracker = new RuntimeKeyHoldTracker();

        tracker.keyDown("z");

        expect(tracker.consumeActionEdge()).toBe(true);

        tracker.keyUp("z");
        tracker.keyDown("Z");

        expect(tracker.consumeActionEdge()).toBe(true);
      });

      it("drops action edges captured while runtime input is disabled", () => {
        const input = new Input(sceneWithoutKeyboard());

        input.setEnabled(false);
        input.injectActionEdge();
        input.setEnabled(true);

        expect(input.update()).toMatchObject({ actionPressed: false, confirmPressed: false });

        input.resetEdges();
        input.injectActionEdge();

        expect(input.update()).toMatchObject({ actionPressed: true, confirmPressed: true });
      });
    });
    function sceneWithoutKeyboard(): Phaser.Scene {
      return { input: { keyboard: null } } as Phaser.Scene;
    }
  });
  describe("interactionReach", () => {
    isolateTimers();
    function view(id: string, left: number, top: number, right = left, bottom = top): RuntimeEventView {
      return {
        event: { id },
        trigger: { kind: "action" },
        page: { interaction: { kind: "inspect" } },
        bodyRect: { left, right, top, bottom },
      } as unknown as RuntimeEventView;
    }
    const W = 32;
    const cell = (x: number, y: number) => y * W + x;
    const body = (left: number, top: number, right: number, bottom: number): number[] => {
      const cells: number[] = [];
      for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) cells.push(cell(x, y));
      return cells;
    };
    describe("interaction reach", () => {
      it("counts only the adjacent ring, not two tiles away", () => {
        expect(ACTION_REACH_CELLS).toBe(1);
        expect(withinActionReach(10, 10, 10, 9)).toBe(true);
        expect(withinActionReach(10, 10, 11, 9)).toBe(true);
        expect(withinActionReach(10, 10, 10, 8)).toBe(false);
        expect(withinActionReach(10, 10, 8, 10)).toBe(false);
        expect(withinActionReach(10, 10, 10, 10)).toBe(false);
      });

      it("does not open a single-cell prop from two tiles away", () => {
        const single = body(10, 8, 10, 8);
        expect(canExamineFrom(single, W, 10, 10, 10, 8)).toBe(false);
        expect(canExamineFrom(single, W, 10, 9, 10, 8)).toBe(true);
      });

      it("keeps a 3x3 prop usable from its edge even though the event sits in the middle", () => {
        const shelf = body(8, 8, 10, 10);
        expect(canExamineFrom(shelf, W, 10, 11, 9, 9)).toBe(true);
        expect(canExamineFrom(shelf, W, 7, 9, 9, 9)).toBe(true);
        expect(canExamineFrom(shelf, W, 10, 12, 9, 9)).toBe(false);
      });

      it("does not reach past a prop whose body stops short of the player", () => {
        const desk = body(10, 8, 10, 8);
        expect(canExamineFrom(desk, W, 10, 10, 10, 8)).toBe(false);
      });

      it("does not pick a prop whose body starts two tiles away", () => {
        expect(pickNearbyActionTarget([view("prop-far", 10, 8)], 10, 10)).toBeUndefined();
      });

      it("still picks a multi-cell prop by the cell the player is touching", () => {
        const big = view("prop-big", 8, 8, 10, 10);
        const picked = pickNearbyActionTarget([big], 10, 11);
        expect(picked?.view.event.id).toBe("prop-big");
        expect(picked?.face).toBe("up");
      });

      it("does not reach sideways or diagonally into a door, ladder or lift that moves the player", () => {
        const travel = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
          ...view(id, x, y),
          page: { commands: [{ kind: "transfer", mapId: "m", x: 0, y: 0 }], graphic: { transparent: true }, ...extra },
        }) as unknown as RuntimeEventView;
        expect(pickNearbyActionTarget([travel("ladder-behind", 10, 9)], 10, 10)).toBeUndefined();
        expect(pickNearbyActionTarget([travel("lift-diagonal", 11, 11)], 10, 10)).toBeUndefined();
        const guide = travel("guide", 11, 10, {
          graphic: { sprite: { type: "bundled", id: "chip" } },
          commands: [{ kind: "text", speaker: "안내인", body: "가자" }, { kind: "transfer", mapId: "m", x: 0, y: 0 }],
        });
        expect(pickNearbyActionTarget([guide], 10, 10)?.view.event.id).toBe("guide");
      });

      it("prefers the adjacent prop over a farther one in the same cluster", () => {
        const near = view("prop-near", 10, 9);
        const far = view("prop-far", 10, 8);
        expect(pickNearbyActionTarget([far, near], 10, 10)?.view.event.id).toBe("prop-near");
      });
    });
  });
  // 런타임 키 계약 회귀 게이트.
  //
  // 적대적 리뷰(2026-08-03)에서 필드/대사/선택지/커서메뉴/상태메뉴/전투가 각각 다른
  // 확인·취소 집합을 들고 있는 게 드러났다. 여기서는 "각 서피스가 정본과 같은 답을
  // 낸다"를 표로 고정한다. 서피스 하나가 몰래 자기 판정을 재구현하면 여기가 깨진다.
  describe("keyBindingsContract", () => {
    isolateTimers();
    const CONFIRM_SAMPLES = ["z", "Z", "Enter", " ", "Space", "Spacebar", "e", "E"] as const;
    const CANCEL_SAMPLES = ["x", "X", "Escape", "Esc"] as const;
    const NEUTRAL_SAMPLES = ["ArrowUp", "1", "Tab", "F1"] as const;
    describe("key bindings — 정본 계약", () => {
      it("결정 키는 Z·Enter·Space(+레거시 E)이고 대소문자를 가리지 않는다", () => {
        for (const key of CONFIRM_SAMPLES) {
          expect(isConfirmKey(key), key).toBe(true);
          expect(isCancelKey(key), key).toBe(false);
        }
      });

      it("취소 키는 X·Esc 이고 대소문자를 가리지 않는다", () => {
        for (const key of CANCEL_SAMPLES) {
          expect(isCancelKey(key), key).toBe(true);
          expect(isConfirmKey(key), key).toBe(false);
        }
      });

      it("결정과 취소는 겹치지 않고, 중립 키는 어느 쪽도 아니다", () => {
        for (const key of NEUTRAL_SAMPLES) {
          expect(isConfirmKey(key), key).toBe(false);
          expect(isCancelKey(key), key).toBe(false);
        }
      });

      it("필드 메뉴 열기는 취소 키와 같다 — 플레이어가 배울 규칙은 하나다", () => {
        for (const key of CANCEL_SAMPLES) expect(isMenuKey(key), key).toBe(true);
        for (const key of CONFIRM_SAMPLES) expect(isMenuKey(key), key).toBe(false);
      });

      it("이동은 방향키와 WASD 를 모두 받는다", () => {
        expect(directionForKey("ArrowUp")).toBe("up");
        expect(directionForKey("W")).toBe("up");
        expect(directionForKey("a")).toBe("left");
        expect(directionForKey("S")).toBe("down");
        expect(directionForKey("d")).toBe("right");
        expect(directionForKey("z")).toBeNull();
      });

      it("자동전투 토글은 이동 키와 겹치지 않는다", () => {
        expect(isAutoBattleKey("f")).toBe(true);
        expect(isAutoBattleKey("F")).toBe(true);
        // A 로 두면 WASD 로 걷던 플레이어가 전투에서 좌측 이동을 누를 때 켜진다.
        expect(isAutoBattleKey("a")).toBe(false);
        expect(directionForKey("f")).toBeNull();
      });

      it("normalizeKey 가 브라우저 편차(Spacebar/Esc/대문자)를 흡수한다", () => {
        expect(normalizeKey("Spacebar")).toBe(" ");
        expect(normalizeKey("Space")).toBe(" ");
        expect(normalizeKey("Esc")).toBe("escape");
        expect(normalizeKey("Z")).toBe("z");
      });
    });
    describe("key bindings — 서피스별 일치", () => {
      it("대사창은 결정 키에서만 진행하고 취소 키에는 반응하지 않는다", () => {
        for (const key of CONFIRM_SAMPLES) expect(isDialogueAdvanceKey(key), key).toBe(true);
        for (const key of CANCEL_SAMPLES) expect(isDialogueAdvanceKey(key), key).toBe(false);
      });

      it("필드 조사 엣지가 결정 키 전체에서 잡힌다", () => {
        for (const key of CONFIRM_SAMPLES) {
          const tracker = new RuntimeKeyHoldTracker();
          tracker.keyDown(key);
          expect(tracker.consumeActionEdge(), key).toBe(true);
        }
      });

      it("상태 메뉴가 결정/취소 키 전체를 같은 뜻으로 읽는다", () => {
        for (const key of CONFIRM_SAMPLES) {
          const result = reduceStatusMenuKeyboard({ selectedCommand: "items", mode: "main" }, key as RuntimeMenuKey);
          expect(result.action, key).toBe("enter-function");
        }
        for (const key of CANCEL_SAMPLES) {
          const result = reduceStatusMenuKeyboard({ selectedCommand: "items", mode: "main" }, key as RuntimeMenuKey);
          expect(result.action, key).toBe("close");
        }
      });

      it("상태 메뉴 커서가 WASD 로도 움직인다", () => {
        const viaArrow = reduceStatusMenuKeyboard({ selectedCommand: "items", mode: "main" }, "ArrowDown");
        const viaWasd = reduceStatusMenuKeyboard({ selectedCommand: "items", mode: "main" }, "s");
        expect(viaWasd.action).toBe("select");
        expect(viaWasd.selectedCommand).toBe(viaArrow.selectedCommand);
      });
    });
    describe("key bindings — 눌림 상태 위생", () => {
      it("OS 키 리피트는 엣지를 만들지 않는다(스킬 연사 방지)", () => {
        const tracker = new RuntimeKeyHoldTracker();
        tracker.keyDown("q");
        expect(tracker.consumeSkillEdge()).toBe(true);
        tracker.keyDown("q", true);
        tracker.keyDown("q", true);
        expect(tracker.consumeSkillEdge()).toBe(false);
        tracker.keyUp("q");
        tracker.keyDown("q");
        expect(tracker.consumeSkillEdge()).toBe(true);
        expect(isSkillKey("Q")).toBe(true);
      });

      it("누른 채로 키가 유지되면 조사 엣지는 한 번만 잡힌다", () => {
        const tracker = new RuntimeKeyHoldTracker();
        tracker.keyDown("z");
        expect(tracker.consumeActionEdge()).toBe(true);
        tracker.keyDown("z");
        expect(tracker.consumeActionEdge()).toBe(false);
      });

      it("releaseAll 이 방향·대시·대기 엣지를 전부 턴다(포커스 이탈 복구)", () => {
        const tracker = new RuntimeKeyHoldTracker();
        tracker.keyDown("ArrowRight");
        tracker.keyDown("Shift");
        tracker.keyDown("z");
        expect(tracker.heldDirections()).toEqual(["right"]);
        expect(tracker.isDashing()).toBe(true);

        tracker.releaseAll();

        expect(tracker.heldDirections()).toEqual([]);
        expect(tracker.isDashing()).toBe(false);
        expect(tracker.consumeActionEdge()).toBe(false);
        expect(tracker.consumeAttackEdge()).toBe(false);
        expect(tracker.consumeSkillEdge()).toBe(false);
      });

      it("액션 전투 맵에서는 결정 키가 조사와 공격 엣지를 함께 세운다", () => {
        for (const key of ["z", " ", "Enter"] as const) {
          const tracker = new RuntimeKeyHoldTracker();
          tracker.setAttackMode(true);
          tracker.keyDown(key);
          expect(tracker.consumeActionEdge(), key).toBe(true);
          expect(tracker.consumeAttackEdge(), key).toBe(true);
        }
      });

      it("액션 전투가 아닌 맵에서는 공격 엣지가 서지 않는다", () => {
        const tracker = new RuntimeKeyHoldTracker();
        tracker.keyDown(" ");
        expect(tracker.consumeActionEdge()).toBe(true);
        expect(tracker.consumeAttackEdge()).toBe(false);
      });
    });
  });
  // 생활 달력 HUD 는 플레이어 매 프레임에 불린다. 생일 줄은 맵 이벤트를 전부 훑으므로,
  // 같은 분·같은 재료면 이벤트를 다시 돌지 않는지와 답이 그대로인지를 본다.
  describe("lifeCalendarHud", () => {
    isolateTimers();
    function event(id: string, birthday?: { readonly season: Season; readonly day: number }, characterId?: string): GameEvent {
      return {
        id,
        x: 0,
        y: 0,
        trigger: { kind: "action" },
        commands: [],
        ...(characterId ? { characterId } : {}),
        ...(birthday ? { socialCalendar: { birthday } } : {}),
      };
    }
    function watch(events: GameEvent[], walks: { n: number }): GameEvent[] {
      return new Proxy(events, {
        get(target, prop, receiver) {
          if (prop === Symbol.iterator) walks.n += 1;
          return Reflect.get(target, prop, receiver);
        },
      });
    }
    function calendarProject(): { project: Project; session: ReturnType<typeof startSession>; walks: { n: number }; home: GameEvent[] } {
      const project = createBlankProject();
      project.system.timeSystem = { enabled: true, daysPerSeason: 28 };
      project.characters = {
        bomi: { displayName: "봄이", birthday: { season: "spring", day: 1 } },
        minsu: { displayName: "민수", birthday: { season: "spring", day: 1 } },
        late: { displayName: "늦은", birthday: { season: "spring", day: 40 } },
      };
      const walks = { n: 0 };
      const home = [
        event("ev_minsu", { season: "summer", day: 1 }, "minsu"),
        ...Array.from({ length: 40 }, (_, index) => event(`ev_filler_${index}`)),
      ];
      const other = Array.from({ length: 40 }, (_, index) => event(`ev_other_${index}`));
      const map = project.maps[project.startMapId]!;
      map.events = watch(home, walks);
      const side: GameMap = { ...map, id: "map_side", name: "옆 맵", events: watch(other, walks) };
      project.maps = { ...project.maps, [side.id]: side };
      const session = startSession(project, 7);
      session.gameTime = { year: 1, season: "spring", day: 1, hour: 6, minute: 0 };
      walks.n = 0;
      return { project, session, walks, home };
    }
    describe("lifeCalendarHudLines", () => {
      it("keeps the birthday answer and does not walk map events again in the same minute", () => {
        const { project, session, walks } = calendarProject();
        const first = lifeCalendarHudLines(project, session);
        expect(first).toEqual([
          "1년 봄 1일 06:00",
          // 민수의 이벤트 생일이 프로필(봄 1일)을 덮어 여름 1일이 된다. 봄 1일 생일은 봄이만.
          // 날짜 40 은 계절 길이 28 밖이라 빠진다.
          "생일 오늘 · 봄이",
        ]);
        expect(walks.n).toBe(2);

        for (let frame = 0; frame < 60; frame += 1) expect(lifeCalendarHudLines(project, session)).toBe(first);
        expect(walks.n).toBe(2);

        session.gameTime = { ...session.gameTime!, minute: 30 };
        const nextMinute = lifeCalendarHudLines(project, session);
        expect(nextMinute).toEqual(["1년 봄 1일 06:30", "생일 오늘 · 봄이"]);
        expect(nextMinute).not.toBe(first);
        expect(walks.n).toBe(2);

        session.gameTime = { year: 1, season: "summer", day: 1, hour: 6, minute: 0 };
        expect(lifeCalendarHudLines(project, session)).toEqual(["1년 여름 1일 06:00", "생일 오늘 · 민수"]);
        expect(walks.n).toBe(2);
      });

      it("rebuilds when an events array grows, characters are replaced, or the clock config object changes", () => {
        const { project, session, walks, home } = calendarProject();
        lifeCalendarHudLines(project, session);
        expect(walks.n).toBe(2);

        home.push(event("하루", { season: "spring", day: 1 }));
        expect(lifeCalendarHudLines(project, session)[1]).toBe("생일 오늘 · 봄이, 하루");
        expect(walks.n).toBe(4);

        project.characters = {
          ...project.characters,
          bomi: { displayName: "봄", birthday: { season: "spring", day: 1 } },
        };
        expect(lifeCalendarHudLines(project, session)[1]).toBe("생일 오늘 · 봄, 하루");
        expect(walks.n).toBe(6);

        project.system.timeSystem = { enabled: true, daysPerSeason: 40 };
        // 40일 계절이 되면 「늦은」의 봄 40일 생일이 색인에 들어오지만(28일 계절에서는 범위 밖) 오늘은 봄 1일이라 오늘 줄은 그대로다.
        expect(lifeCalendarHudLines(project, session)[1]).toBe("생일 오늘 · 봄, 하루");
        expect(walks.n).toBe(8);
        session.gameTime = { year: 1, season: "spring", day: 40, hour: 6, minute: 0 };
        expect(lifeCalendarHudLines(project, session)[1]).toBe("생일 오늘 · 늦은");
      });

      it("shows the weather line from the saved day and does not rescan events while the minute holds", () => {
        const { project, session, walks } = calendarProject();
        project.system.dailyWeather = {
          enabled: true,
          forecastDays: 2,
          seasons: {
            spring: [{ kind: "rain", weight: 1, intensity: 0.4 }],
          },
        };
        session.dailyWeather = { dayKey: "1:spring:1", kind: "rain", intensity: 0.4 };
        const lines = lifeCalendarHudLines(project, session);
        expect(lines).toEqual([
          "1년 봄 1일 06:00",
          "오늘 비 · 내일 비 · 모레 비",
          "생일 오늘 · 봄이",
        ]);
        const walked = walks.n;
        expect(lifeCalendarHudLines(project, session)).toBe(lines);
        expect(walks.n).toBe(walked);

        session.dailyWeather = { dayKey: "1:spring:1", kind: "storm", intensity: 0.8 };
        expect(lifeCalendarHudLines(project, session)[1]).toBe("오늘 폭풍 · 내일 비 · 모레 비");
        expect(walks.n).toBe(walked);
      });

      it("returns no lines without a clock and no birthday line when the time system is off", () => {
        const { project, session, walks } = calendarProject();
        session.gameTime = undefined;
        expect(lifeCalendarHudLines(project, session)).toEqual([]);
        expect(walks.n).toBe(0);

        session.gameTime = { year: 1, season: "spring", day: 1, hour: 6, minute: 0 };
        project.system.timeSystem = { enabled: false };
        expect(lifeCalendarHudLines(project, session)).toEqual(["1년 봄 1일 06:00"]);
        expect(lifeCalendarHudLines(project, session)).toEqual(["1년 봄 1일 06:00"]);
        expect(walks.n).toBe(0);
      });
    });
  });
  describe("lifeCalendarHudCache", () => {
    isolateTimers();
    function clock(minute = 0) {
      return { minute, hour: 6, day: 1, season: "spring" as const, year: 1 };
    }
    function sessionAt(minute = 0): Pick<PlaySession, "gameTime" | "dailyWeather" | "rng"> {
      return { gameTime: clock(minute) };
    }
    function hudProject(events: GameEvent[] = []): Pick<Project, "system" | "characters" | "maps"> {
      return {
        system: { timeSystem: { enabled: true, daysPerSeason: 28 } },
        characters: {
          gaeul: { displayName: "가을", birthday: { season: "spring", day: 1 } },
          hana: { displayName: "하나", birthday: { season: "spring", day: 1 } },
        },
        maps: { town: { events } },
      } as unknown as Pick<Project, "system" | "characters" | "maps">;
    }
    describe("life calendar HUD frame cache", () => {
      it("reuses the same lines until the clock minute or the birthday index changes", () => {
        const events: GameEvent[] = [];
        const project = hudProject(events);
        const session = sessionAt(0);
        const names = ["가을", "하나"].sort((left, right) => left.localeCompare(right, "ko"));
        const first = lifeCalendarHudLines(project, session);
        expect(first[0]).toBe("1년 봄 1일 06:00");
        expect(first.at(-1)).toBe(`생일 오늘 · ${names.join(", ")}`);
        expect(lifeCalendarHudLines(project, session)).toBe(first);

        const later = lifeCalendarHudLines(project, sessionAt(5));
        expect(later).not.toBe(first);
        expect(later[0]).toBe("1년 봄 1일 06:05");
        expect(later.at(-1)).toBe(first.at(-1));
        expect(lifeCalendarHudLines(project, sessionAt(5))).toBe(later);

        events.push({
          id: "ev_hana",
          x: 1,
          y: 1,
          trigger: { kind: "action" },
          commands: [],
          characterId: "hana",
          socialCalendar: { birthday: { season: "winter", day: 28 } },
        });
        const moved = lifeCalendarHudLines(project, sessionAt(5));
        expect(moved).not.toBe(later);
        expect(moved.at(-1)).toBe("생일 오늘 · 가을");
        expect(lifeCalendarHudLines(project, sessionAt(5))).toBe(moved);
      });

      it("counts days to a far birthday the same way the calendar stepper does", () => {
        const project = {
          system: { timeSystem: { enabled: true, daysPerSeason: 28 } },
          characters: { end: { displayName: "끝", birthday: { season: "winter", day: 28 } } },
          maps: { town: { events: [] as GameEvent[] } },
        } as unknown as Pick<Project, "system" | "characters" | "maps">;
        const from = clock();
        const system = { enabled: true as const, daysPerSeason: 28 };
        let offset = 0;
        for (; offset < 28 * 4; offset += 1) {
          const date = advanceGameDays(from, offset, system).time;
          if (date.season === "winter" && date.day === 28) break;
        }
        const lines = lifeCalendarHudLines(project, sessionAt(0));
        expect(lines.at(-1)).toBe(`다음 생일 ${offset}일 후 · 끝`);
        expect(lifeCalendarHudLines(project, sessionAt(0))).toBe(lines);
      });

      it("picks up an in-place character birthday edit on the next read", () => {
        const characters: NonNullable<Project["characters"]> = {
          hana: { displayName: "하나", birthday: { season: "spring", day: 2 } },
        };
        const project = {
          system: { timeSystem: { enabled: true, daysPerSeason: 28 } },
          characters,
          maps: { town: { events: [] as GameEvent[] } },
        } as unknown as Pick<Project, "system" | "characters" | "maps">;
        expect(lifeCalendarHudLines(project, sessionAt(0)).at(-1)).toBe("다음 생일 1일 후 · 하나");
        characters.hana = { displayName: "하나", birthday: { season: "spring", day: 1 } };
        const today = lifeCalendarHudLines(project, sessionAt(0));
        expect(today.at(-1)).toBe("생일 오늘 · 하나");
        expect(lifeCalendarHudLines(project, sessionAt(0))).toBe(today);
      });
    });
  });
  describe("lifeSaveVersion", () => {
    isolateTimers();
    class MemoryStorage implements Storage {
      private readonly values = new Map<string, string>();
      get length(): number { return this.values.size; }
      clear(): void { this.values.clear(); }
      getItem(key: string): string | null { return this.values.get(key) ?? null; }
      key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
      removeItem(key: string): void { this.values.delete(key); }
      setItem(key: string, value: string): void { this.values.set(key, value); }
    }
    function fixture() {
      const project = createBlankProject();
      const session = startSession(project, 205);
      session.gold = 17;
      session.variables.progress = 23;
      const storage = new MemoryStorage();
      const legacy = old.createSaveSnapshot(project, session);
      const raw = JSON.stringify(legacy, null, 2) + "\n";
      return { project, session, storage, legacy, raw };
    }
    afterEach(() => {
      saves.setSaveSlotStorageNamespace(null);
      old.setSaveSlotStorageNamespace(null);
      resetAutosaveDebounce();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });
    describe("Save5 version and original ownership boundary", () => {
      it("writes independent Save5 even without life packages, leaving Project4 and live state unchanged", () => {
        const { project, session } = fixture();
        const before = structuredClone(session);
        const snapshot = saves.createSaveSnapshot(project, session);
        expect(snapshot.schemaVersion).toBe(5);
        expect(SCHEMA_VERSION).toBe(4);
        expect(project.version).toBe(4);
        expect(saves.SAVE_SCHEMA_VERSION).toBe(5);
        expect(session).toEqual(before);
      });

      it.each([null, "  exported:game-a  "])("migrates manual and auto only in memory in namespace %j", (namespace) => {
        const { project, session, storage, raw } = fixture();
        saves.setSaveSlotStorageNamespace(namespace);
        old.setSaveSlotStorageNamespace(namespace);
        const prefix = namespace?.trim() ?? "oprn";
        storage.setItem(old.saveSlotKey(2), raw);
        storage.setItem(old.autosaveKey(), raw);
        const before = storage.length;
        const manual = saves.readSaveSlot(storage, 2);
        const auto = saves.readAutosave(storage);
        expect(storage.length).toBe(before);
        expect(manual.kind).toBe("present");
        expect(auto.kind).toBe("present");
        if (manual.kind !== "present" || auto.kind !== "present") throw new Error("Missing legacy save");
        expect(manual.snapshot.schemaVersion).toBe(5);
        expect(auto.snapshot.schemaVersion).toBe(5);
        expect(saves.applySaveSnapshot(project, manual.snapshot).variables.progress).toBe(23);
        session.gold = 89;
        expect(saves.saveToSlot(storage, 2, saves.createSaveSnapshot(project, session))).toEqual({ ok: true });
        expect(performAutosave(project, session, storage, "transfer")?.schemaVersion).toBe(5);
        expect(saves.saveSlotKey(2)).toBe(`${prefix}:save-slot:v5:2`);
        expect(saves.autosaveKey()).toBe(`${prefix}:save-slot:v5:auto`);
        expect(storage.getItem(old.saveSlotKey(2))).toBe(raw);
        expect(storage.getItem(old.autosaveKey())).toBe(raw);
        expect(saves.readSaveSlot(storage, 2)).toMatchObject({ kind: "present", snapshot: { session: { gold: 89 } } });
        expect(saves.readAutosave(storage)).toMatchObject({ kind: "present", snapshot: { session: { gold: 89 } } });
        expect(old.readSaveSlot(storage, 2)).toMatchObject({ kind: "present", snapshot: { session: { gold: 17 } } });
      });

      it("runs the frozen phase1 reader on actual old/new bytes, not a simulated version predicate", () => {
        const { project, session, storage, raw } = fixture();
        storage.setItem(old.saveSlotKey(1), raw);
        expect(old.readSaveSlot(storage, 1).kind).toBe("present");
        storage.setItem(old.saveSlotKey(1), JSON.stringify(saves.createSaveSnapshot(project, session)));
        expect(old.readSaveSlot(storage, 1)).toMatchObject({ kind: "corrupt", message: "Unsupported save schema" });
      });

      it.each([3, 6, 999, "5"])("rejects unsupported wire version %j without rewriting it", (schemaVersion) => {
        const { storage, legacy } = fixture();
        const raw = JSON.stringify({ ...legacy, schemaVersion });
        storage.setItem(saves.saveSlotKey(1), raw);
        storage.setItem(saves.autosaveKey(), raw);
        expect(saves.readSaveSlot(storage, 1)).toMatchObject({ kind: "corrupt", message: "Unsupported save schema" });
        expect(saves.readAutosave(storage)).toMatchObject({ kind: "corrupt", message: "Unsupported save schema" });
        expect(storage.getItem(saves.saveSlotKey(1))).toBe(raw);
        expect(storage.getItem(saves.autosaveKey())).toBe(raw);
      });

      it.each(["", "{broken", "null", '{"schemaVersion":5}', '{"schemaVersion":6}'])("never falls back from present malformed new bytes %j", (broken) => {
        const { storage, raw } = fixture();
        storage.setItem(old.saveSlotKey(1), raw);
        storage.setItem(old.autosaveKey(), raw);
        storage.setItem("oprn:save-slot:v5:1", broken);
        storage.setItem("oprn:save-slot:v5:auto", broken);
        expect(saves.readSaveSlot(storage, 1).kind).toBe("corrupt");
        expect(saves.readAutosave(storage).kind).toBe("corrupt");
        expect(storage.getItem(old.saveSlotKey(1))).toBe(raw);
        expect(storage.getItem(old.autosaveKey())).toBe(raw);
      });

      it("does not borrow another namespace's legacy progress", () => {
        const { storage, raw } = fixture();
        storage.setItem(old.saveSlotKey(1), raw);
        storage.setItem(old.autosaveKey(), raw);
        saves.setSaveSlotStorageNamespace("other-game");
        expect(saves.readSaveSlot(storage, 1).kind).toBe("empty");
        expect(saves.readAutosave(storage).kind).toBe("empty");
      });

      it.each([false, true])("preserves legacy bytes, previous new slot and live progress on quota (existing new=%j)", (hasNew) => {
        const { project, session, storage, raw } = fixture();
        storage.setItem(old.saveSlotKey(1), raw);
        storage.setItem(old.autosaveKey(), raw);
        if (hasNew) {
          saves.saveToSlot(storage, 1, saves.createSaveSnapshot(project, session));
          performAutosave(project, session, storage, "transfer");
        }
        const manualBefore = storage.getItem(saves.saveSlotKey(1));
        const autoBefore = storage.getItem(saves.autosaveKey());
        session.gold = 99;
        const before = structuredClone(session);
        vi.spyOn(storage, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
        const warn = vi.spyOn(console, "warn");
        expect(saves.saveToSlot(storage, 1, saves.createSaveSnapshot(project, session)).ok).toBe(false);
        expect(performAutosave(project, session, storage, "transfer")).toBeNull();
        expect(warn).toHaveBeenCalledTimes(2);
        expect(session).toEqual(before);
        expect(storage.getItem(old.saveSlotKey(1))).toBe(raw);
        expect(storage.getItem(old.autosaveKey())).toBe(raw);
        expect(storage.getItem(saves.saveSlotKey(1))).toBe(manualBefore);
        expect(storage.getItem(saves.autosaveKey())).toBe(autoBefore);
      });

      it("characterizes construction failure: throws explicitly, preserves checkpoint and disk, does not debounce retry", () => {
        const { project, session, storage, raw } = fixture();
        storage.setItem(old.autosaveKey(), raw);
        const checkpoint = saveSessionCheckpoint(project, session);
        vi.stubGlobal("localStorage", storage);
        const clone = vi.spyOn(globalThis, "structuredClone").mockImplementation(() => { throw new DOMException("cannot clone", "DataCloneError"); });
        expect(() => maybeAutosave(project, session, "transfer", 10_000)).toThrow(DOMException);
        expect(() => saveSessionCheckpoint(project, session)).toThrow(DOMException);
        expect(getSessionCheckpoint(session)).toBe(checkpoint);
        expect(storage.getItem(old.autosaveKey())).toBe(raw);
        expect(storage.length).toBe(1);
        clone.mockRestore();
        expect(maybeAutosave(project, session, "transfer", 10_000)).toBe(true);
      });

      it("creates Save5 memory checkpoints and resumes an independent session without mutating the live one", () => {
        const { project, session } = fixture();
        const checkpoint = saveSessionCheckpoint(project, session);
        session.gold = 101;
        const restored = restoreSessionCheckpoint(project, session);
        expect(checkpoint.schemaVersion).toBe(5);
        expect(restored?.gold).toBe(17);
        expect(session.gold).toBe(101);
        expect(restored).not.toBe(session);
        if (!restored) throw new Error("Missing checkpoint");
        expect(getSessionCheckpoint(restored)).toBe(checkpoint);
      });
    });
  });
});

describe("playerTransitionsSuite", () => {
  isolateTimers();
  describe("pictureWeatherDom", () => {
    isolateTimers();
    // 속성 선택자([data-testid=...])를 dataset 기반으로 지원하는 테스트 host.
    class TestHost extends FakeElement {
      constructor() {
        super("div");
      }
      override querySelector(selector: string): FakeElement | null {
        const match = selector.match(/data-testid=['"]([^'"]+)['"]/);
        if (match) return findByTestId(this, match[1]!) ?? null;
        return super.querySelector(selector);
      }
    }
    class MemoryStorage implements Storage {
      private readonly values = new Map<string, string>();
      get length(): number { return this.values.size; }
      clear(): void { this.values.clear(); }
      getItem(key: string): string | null { return this.values.get(key) ?? null; }
      key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
      removeItem(key: string): void { this.values.delete(key); }
      setItem(key: string, value: string): void { this.values.set(key, value); }
    }
    let restore: (() => void) | null = null;
    beforeEach(() => {
      restore = installFakeDom();
    });
    afterEach(() => {
      restore?.();
      restore = null;
    });
    function pic(partial: Partial<PictureState>): PictureState {
      return { pictureId: "pic1", resourceId: "res", x: 0, y: 0, ...partial };
    }
    // FakeElement 기반 TestHost 를 HTMLElement 파라미터에 전달하기 위한 캐스트.
    function asHost(host: TestHost): HTMLElement {
      return host as unknown as HTMLElement;
    }
    describe("syncPictureLayer — 실 이미지 렌더", () => {
      it("해석되는 리소스는 <img>, 미해석 리소스는 텍스트 라벨로 폴백", () => {
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host));

        overlay.syncPictureLayer({
          // 「hero」 생성 그림은 2026-10-07 저작권 정리로 빠져 더는 해석되지 않는다 — 번들 CC0 아이콘으로 해석 경로를 본다.
          pic1: pic({ pictureId: "pic1", resourceId: "cc0-jetrel-clock", x: 10, y: 20 }),
          bg: pic({ pictureId: "bg", resourceId: "no-such-resource", x: 0, y: 0 }),
        });

        const imageSlot = findByTestId(host, "picture-pic1");
        expect(imageSlot).not.toBeNull();
        expect(imageSlot!.dataset.render).toBe("image");
        expect(imageSlot!.childNodes.some((child) => child instanceof FakeElement && child.tagName === "IMG")).toBe(true);
        // 위치는 left/top 로 즉시 적용(트윈 없음).
        expect(imageSlot!.style.left).toBe("10px");
        expect(imageSlot!.style.top).toBe("20px");

        const labelSlot = findByTestId(host, "picture-bg");
        expect(labelSlot!.dataset.render).toBe("label");
        expect(labelSlot!.textContent.length).toBeGreaterThan(0);
      });

      it("z-order 는 픽처 번호를 따른다", () => {
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host));
        overlay.syncPictureLayer({
          pic1: pic({ pictureId: "pic1", resourceId: "hero" }),
          pic5: pic({ pictureId: "pic5", resourceId: "hero" }),
        });
        expect(findByTestId(host, "picture-pic1")!.style.zIndex).toBe("21");
        expect(findByTestId(host, "picture-pic5")!.style.zIndex).toBe("25");
      });

      it("사라진 픽처 슬롯은 제거된다", () => {
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host));
        overlay.syncPictureLayer({ pic1: pic({ pictureId: "pic1", resourceId: "hero" }) });
        expect(findByTestId(host, "picture-pic1")).not.toBeNull();
        overlay.syncPictureLayer({});
        expect(findByTestId(host, "picture-pic1")).toBeNull();
      });

      it("durationMs=0 이면 scale/opacity 를 즉시 적용", () => {
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host));
        overlay.syncPictureLayer({ pic1: pic({ pictureId: "pic1", resourceId: "hero", scale: 200, opacity: 128 }) });
        const slot = findByTestId(host, "picture-pic1")!;
        expect(slot.style.transform).toContain("scale(2)");
        expect(Number(slot.style.opacity)).toBeCloseTo(0.502, 2);
      });
    });
    // 회귀: 첫 표시에 전환 시간이 있으면 두 분기(트윈 시작 / 즉시 적용) 모두 스킵되어
    // applyPictureTransform 이 한 번도 불리지 않았다. 픽처가 위치·확대·불투명도 없이
    // 기본 자리(left/top 미설정)에 떴다.
    describe("syncPictureLayer — 첫 표시 + 전환 시간(페이드인)", () => {
      it("첫 표시에 durationMs 가 있어도 위치·확대는 즉시 적용된다", () => {
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host));
        const session = startSession(createBlankProject());
        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 48, y: 72, scale: 150, durationMs: 300 }));

        overlay.syncPictureLayer(session.pictures);

        const slot = findByTestId(host, "picture-pic1")!;
        // 버그 시절에는 left/top/transform 이 전부 빈 문자열이었다.
        expect(slot.style.left).toBe("48px");
        expect(slot.style.top).toBe("72px");
        expect(slot.style.transform).toContain("scale(1.5)");
      });

      it("rAF 미지원 환경에서는 페이드인을 생략하고 목표 상태로 확정한다", () => {
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host));
        const session = startSession(createBlankProject());
        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", opacity: 255, durationMs: 300 }));

        overlay.syncPictureLayer(session.pictures);

        // 페이드인 시작값(0)에서 멈추면 픽처가 영구히 보이지 않는다.
        expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBe(1);
      });

      it("프레임마다 같은 상태를 동기화해도 페이드인이 목표 불투명도까지 완료된다", () => {
        restore?.();
        restore = installFakeDom({ animationFrames: "manual" });
        let clock = 0;
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
        const session = startSession(createBlankProject());
        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", opacity: 255, durationMs: 1000 }));

        overlay.syncPictureLayer(session.pictures);
        expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBe(0);

        const opacities = [0];
        for (clock = 100; clock <= 1000; clock += 100) {
          flushFakeAnimationFrames(0, 1);
          overlay.syncPictureLayer(session.pictures);
          opacities.push(Number(findByTestId(host, "picture-pic1")!.style.opacity));
        }

        expect(opacities).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
      });

      it("진행 중 새 Move Picture 목표는 현재 표시값에서 새 트윈을 시작한다", () => {
        restore?.();
        restore = installFakeDom({ animationFrames: "manual" });
        let clock = 0;
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
        const session = startSession(createBlankProject());
        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 100, durationMs: 1000 }));
        overlay.syncPictureLayer(session.pictures);

        clock = 500;
        flushFakeAnimationFrames(0, 1);
        expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBeCloseTo(0.5, 3);
        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 200, durationMs: 1000 }));
        overlay.syncPictureLayer(session.pictures);

        clock = 1000;
        flushFakeAnimationFrames(0, 1);
        expect(findByTestId(host, "picture-pic1")!.style.left).toBe("150px");
        expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBeCloseTo(0.75, 3);
      });

      it("settled slot의 새 Move Picture 목표도 duration 동안 트윈한다", () => {
        restore?.();
        restore = installFakeDom({ animationFrames: "manual" });
        let clock = 0;
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
        const session = startSession(createBlankProject());
        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 10 }));
        overlay.syncPictureLayer(session.pictures);
        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 210, durationMs: 1000 }));
        overlay.syncPictureLayer(session.pictures);

        clock = 500;
        flushFakeAnimationFrames(0, 1);

        expect(findByTestId(host, "picture-pic1")!.style.left).toBe("110px");
      });

      it("durationMs<=0 인 새 목표는 즉시 적용한다", () => {
        restore?.();
        restore = installFakeDom({ animationFrames: "manual" });
        let clock = 0;
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
        const session = startSession(createBlankProject());
        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 10 }));
        overlay.syncPictureLayer(session.pictures);

        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 210, opacity: 128, durationMs: 0 }));
        overlay.syncPictureLayer(session.pictures);

        expect(findByTestId(host, "picture-pic1")!.style.left).toBe("210px");
        expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBeCloseTo(128 / 255, 3);
        clock = 500;
        flushFakeAnimationFrames(0, 1);
        expect(findByTestId(host, "picture-pic1")!.style.left).toBe("210px");
      });

      it("두 픽처의 Move Picture 트윈은 서로 간섭하지 않는다", () => {
        restore?.();
        restore = installFakeDom({ animationFrames: "manual" });
        let clock = 0;
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
        const session = startSession(createBlankProject());
        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 0 }));
        showPictureState(session, pic({ pictureId: "pic2", resourceId: "hero", x: 20 }));
        overlay.syncPictureLayer(session.pictures);

        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 100, durationMs: 1000 }));
        showPictureState(session, pic({ pictureId: "pic2", resourceId: "hero", x: 220, durationMs: 1000 }));
        overlay.syncPictureLayer(session.pictures);
        clock = 500;
        flushFakeAnimationFrames(0, 1);

        expect(findByTestId(host, "picture-pic1")!.style.left).toBe("50px");
        expect(findByTestId(host, "picture-pic2")!.style.left).toBe("120px");
      });

      it("프레임마다 바뀌는 목표는 표시값에서 재시작하고 마지막 목표에 수렴한다", () => {
        restore?.();
        restore = installFakeDom({ animationFrames: "manual" });
        let clock = 0;
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
        const session = startSession(createBlankProject());
        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 0 }));
        overlay.syncPictureLayer(session.pictures);

        const displayed: number[] = [];
        for (const target of [100, 200, 300, 400, 500]) {
          clock += 100;
          flushFakeAnimationFrames(0, 1);
          displayed.push(Number.parseFloat(findByTestId(host, "picture-pic1")!.style.left));
          showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: target, durationMs: 1000 }));
          overlay.syncPictureLayer(session.pictures);
        }

        expect(displayed).toHaveLength(5);
        [0, 10, 29, 56.1, 90.49].forEach((expected, index) => {
          expect(displayed[index]).toBeCloseTo(expected, 6);
        });
        expect(Number.parseFloat(findByTestId(host, "picture-pic1")!.style.left)).toBeCloseTo(90.49, 6);
        clock += 1000;
        flushFakeAnimationFrames(0, 1);
        expect(findByTestId(host, "picture-pic1")!.style.left).toBe("500px");
      });

      it("Move 완료 후 같은 세션의 새 overlay는 stale fade 없이 목표를 즉시 표시한다", () => {
        restore?.();
        restore = installFakeDom({ animationFrames: "manual" });
        let clock = 0;
        const session = startSession(createBlankProject());
        const firstHost = new TestHost();
        const firstOverlay = new RuntimeDomOverlay(() => asHost(firstHost), { pictureNow: () => clock });
        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 0 }));
        firstOverlay.syncPictureLayer(session.pictures);
        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 100, opacity: 255, durationMs: 1000 }));
        firstOverlay.syncPictureLayer(session.pictures);

        clock = 500;
        flushFakeAnimationFrames(0, 1);
        expect(findByTestId(firstHost, "picture-pic1")!.style.left).toBe("50px");

        const remountedHost = new TestHost();
        const remountedOverlay = new RuntimeDomOverlay(() => asHost(remountedHost), { pictureNow: () => clock });
        remountedOverlay.syncPictureLayer(session.pictures);

        expect(findByTestId(remountedHost, "picture-pic1")!.style.left).toBe("100px");
        expect(Number(findByTestId(remountedHost, "picture-pic1")!.style.opacity)).toBe(1);
      });

      it("applySession 형태의 인게임 로드는 기존 slot에 저장 변환을 즉시 적용한다", () => {
        restore?.();
        restore = installFakeDom({ animationFrames: "manual" });
        let clock = 0;
        const project = createBlankProject();
        const liveSession = startSession(project);
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
        showPictureState(liveSession, pic({ pictureId: "pic1", resourceId: "hero", x: 0, opacity: 255 }));
        overlay.syncPictureLayer(liveSession.pictures);

        const savedSession = startSession(project);
        savedSession.pictures.pic1 = pic({ pictureId: "pic1", resourceId: "hero", x: 100, opacity: 200, durationMs: 1000 });
        const storage = new MemoryStorage();
        expect(saveToSlot(storage, 1, createSaveSnapshot(project, savedSession))).toEqual({ ok: true });
        const saved = readSaveSlot(storage, 1);
        expect(saved.kind).toBe("present");
        if (saved.kind !== "present") throw new Error("expected present save slot");
        const restored = applySaveSnapshot(project, saved.snapshot);

        overlay.syncPictureLayer(restored.pictures);

        expect(findByTestId(host, "picture-pic1")!.style.left).toBe("100px");
        expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBeCloseTo(200 / 255, 3);
        clock = 500;
        flushFakeAnimationFrames(0, 1);
        expect(findByTestId(host, "picture-pic1")!.style.left).toBe("100px");
        expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBeCloseTo(200 / 255, 3);
      });

      it("세이브를 storage 왕복해 복원한 픽처는 authored opacity로 즉시 표시된다", () => {
        restore?.();
        restore = installFakeDom({ animationFrames: "manual" });
        const project = createBlankProject();
        const session = startSession(project);
        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", opacity: 200, durationMs: 1000 }));
        const storage = new MemoryStorage();
        expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
        const saved = readSaveSlot(storage, 1);
        expect(saved.kind).toBe("present");
        if (saved.kind !== "present") throw new Error("expected present save slot");
        const restored = applySaveSnapshot(project, saved.snapshot);
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => 0 });

        overlay.syncPictureLayer(restored.pictures);

        expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBeCloseTo(200 / 255, 3);
      });

      it("이미 떠 있는 픽처의 이동은 현재 상태에서 트윈한다(0 으로 리셋하지 않는다)", () => {
        const host = new TestHost();
        const overlay = new RuntimeDomOverlay(() => asHost(host));
        const session = startSession(createBlankProject());

        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 10, y: 10 }));
        overlay.syncPictureLayer(session.pictures);
        expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBe(1);

        showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 200, y: 10, durationMs: 300 }));
        overlay.syncPictureLayer(session.pictures);

        expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBe(1);
      });
    });
    describe("runTransitionPhase — 모자이크/블라인드 오버레이", () => {
      it("rAF 미지원 환경에서 out 단계는 오버레이를 남기고 최종 프레임 적용", async () => {
        const host = new TestHost();
        await runTransitionPhase(asHost(host), "mosaic", "out", 500);
        const overlay = findByTestId(host, "runtime-transition-overlay")!;
        expect(overlay.dataset.kind).toBe("mosaic");
        expect(Number(overlay.style.opacity)).toBe(1); // out 최종 = 완전 덮힘
      });

      it("blinds in 단계는 완료 후 오버레이를 제거", async () => {
        const host = new TestHost();
        await runTransitionPhase(asHost(host), "blinds", "in", 500);
        expect(findByTestId(host, "runtime-transition-overlay")).toBeNull();
      });
    });
  });
  describe("transitionModel", () => {
    isolateTimers();
    describe("parseTransitionKind", () => {
      it("알려진 종류만 통과, 그 외 기본 fade", () => {
        expect(parseTransitionKind("mosaic")).toBe("mosaic");
        expect(parseTransitionKind("blinds")).toBe("blinds");
        expect(parseTransitionKind("fade")).toBe("fade");
        expect(parseTransitionKind("bogus")).toBe("fade");
        expect(parseTransitionKind(undefined)).toBe("fade");
      });

      it("오버레이 연출 여부", () => {
        expect(usesOverlayTransition("mosaic")).toBe(true);
        expect(usesOverlayTransition("blinds")).toBe(true);
        expect(usesOverlayTransition("fade")).toBe(false);
      });
    });
    describe("transitionProgress", () => {
      it("0~1 정규화, duration<=0 이면 1", () => {
        expect(transitionProgress(0, 0)).toBe(1);
        expect(transitionProgress(250, 500)).toBe(0.5);
        expect(transitionProgress(999, 500)).toBe(1);
      });
    });
    describe("mosaic", () => {
      it("out 은 진행할수록 블록/덮힘 증가, in 은 감소", () => {
        expect(mosaicBlockSize(0, "out")).toBe(0);
        expect(mosaicBlockSize(1, "out")).toBe(48);
        expect(mosaicBlockSize(0, "in")).toBe(48);
        expect(mosaicBlockSize(1, "in")).toBe(0);
        expect(mosaicCoverAlpha(1, "out")).toBe(1);
        expect(mosaicCoverAlpha(1, "in")).toBe(0);
      });
    });
    describe("blindBars", () => {
      it("count 개의 막대, out 진행도만큼 두께 채움", () => {
        const bars = blindBars(1, "out", 4);
        expect(bars).toHaveLength(4);
        expect(bars[0]).toEqual({ top: 0, height: 0.25 });
        expect(bars[3]).toEqual({ top: 0.75, height: 0.25 });
      });

      it("out 진행도 0 이면 막대 두께 0", () => {
        const bars = blindBars(0, "out", 4);
        expect(bars.every((bar) => bar.height === 0)).toBe(true);
      });

      it("in 은 열림(진행할수록 두께 감소)", () => {
        const closed = blindBars(0, "in", 4);
        expect(closed[0]!.height).toBeCloseTo(0.25);
        const opened = blindBars(1, "in", 4);
        expect(opened.every((bar) => bar.height === 0)).toBe(true);
      });
    });
  });
});
