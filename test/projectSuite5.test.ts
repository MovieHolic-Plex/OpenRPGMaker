// @vitest-environment happy-dom

import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBlankProject } from "@/project/defaults";
import { buildOprnPakArchive, createDesktopSteamExportPackage, desktopSteamExportFileName, readOprnPakArchive } from "@/project/desktopGameExport";
import { createRuntimeManifest, jsonBytes } from "@/project/gameRelease";
import { readStoredZipEntry, readStoredZipEntryNames, readStoredZipUnixMode } from "@/project/packageZip";
import { preparePublication } from "@/project/publication";
import { installDesktopShellBridge, mirrorDesktopSaveFile, saveStorageKeyToDesktopFilePath } from "@/player/desktopShellBridge";
import * as combat from "@/player/playSceneActionCombat";
import { createFieldSpawnRuntime } from "@/player/fieldSpawns";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { GameMap, Project, EventPage, GameEvent, MoveCommand } from "@/project/types";
import type { ActionCombatObservation } from "@/testing/actionCombatProof";
import { adjacentFoes, createTacticsState, partyTacticsSeeds, reachableTiles, runEnemyTurn, tacticsAttack, tacticsDamage, tacticsMove, tacticsWait, troopTacticsSeeds, writeTacticsVitals, type TacticsUnitSeed } from "@/player/tacticsBattle";
import { mountTacticsBattle } from "@/player/tacticsBattleOverlay";
import { deserialize, serialize } from "@/project/io";
import { isInputCapturingSurfaceActive } from "@/player/keyBindings";
import { isolateTimers } from "./mergedTeardown";
import { updatePlayScene, startPlayerRoute } from "@/player/playSceneMovement";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { DEFAULT_FALL_DURATION_MS, DEFAULT_FALL_HEIGHT_PX, DEFAULT_JUMP_DURATION_MS, DEFAULT_JUMP_PEAK_PX, fallLiftPx } from "@/player/characterHop";

describe("desktopGameExport", () => {
  isolateTimers();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  describe("Desktop & Steam Depot Game Export", () => {
    it("packs game data and assets into a verified OPAK binary archive (resources/game.pak) and round-trips entries", async () => {
      const entries = [
        { name: "project.json", bytes: encoder.encode('{"title":"Chrono Bell"}') },
        { name: "assets/hero.png", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]) },
      ];
      const { bytes, manifest } = await buildOprnPakArchive("시간의 종소리와 무너진 별", entries);
      expect(manifest.magic).toBe("OPAK");
      expect(manifest.entryCount).toBe(2);

      const unpacked = readOprnPakArchive(bytes);
      expect(unpacked.manifest.gameTitle).toBe("시간의 종소리와 무너진 별");
      const projectJson = decoder.decode(unpacked.readEntry("project.json")!);
      expect(projectJson).toBe('{"title":"Chrono Bell"}');
      const heroPng = unpacked.readEntry("assets/hero.png")!;
      expect([...heroPng]).toEqual([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    });

    it("generates a complete Windows x64 Steam Depot ZIP with .exe launcher, resources/game.pak, saves/ Auto-Cloud, and SteamPipe VDFs", async () => {
      const project = createBlankProject();
      project.meta.title = "ChronoBell";
      const runtime = await createRuntimeManifest(
        [
          { name: "web/player.html", bytes: encoder.encode("<!doctype html><html><head></head><body><div id='app'></div></body></html>") },
          { name: "web/player.js", bytes: encoder.encode("console.log('player');") },
          { name: "web/dependency-collector.js", bytes: encoder.encode("var OPRN_RELEASE_COLLECTOR={collectReleaseDependencies:()=>[]};") },
        ],
        [],
      );
      project.meta.publication = preparePublication(runtime.runtimeTarget);

      const fileMap = new Map<string, Uint8Array>([
        ["/runtime-archive/default.json", jsonBytes({ runtimeTarget: runtime.runtimeTarget })],
        [`/runtime-archive/${runtime.runtimeTarget}/runtime.json`, jsonBytes(runtime)],
        [`/runtime-archive/${runtime.runtimeTarget}/web/player.html`, encoder.encode("<!doctype html><html><head></head><body><div id='app'></div></body></html>")],
        [`/runtime-archive/${runtime.runtimeTarget}/web/player.js`, encoder.encode("console.log('player');")],
        [`/runtime-archive/${runtime.runtimeTarget}/web/dependency-collector.js`, encoder.encode("var OPRN_RELEASE_COLLECTOR={collectReleaseDependencies:()=>[]};")],
      ]);

      const result = await createDesktopSteamExportPackage(project, {
        platform: "win64-steam",
        steamAppId: 480,
        steamDepotId: 481,
        displayMode: "fullscreen",
        versionLabel: "1.2.0",
        fetchBytes: async (path) => {
          const hit = fileMap.get(path);
          if (!hit) throw new Error(`Missing fixture path: ${path}`);
          return hit;
        },
      });

      expect(result.fileName).toBe(
        desktopSteamExportFileName(project, { platform: "win64-steam", versionLabel: "1.2.0" }),
      );
      expect(result.summary.executablePath).toBe("ChronoBell.exe");
      expect(result.summary.pakArchivePath).toBe("resources/game.pak");

      const zipBytes = new Uint8Array(await result.blob.arrayBuffer());
      const entryNames = readStoredZipEntryNames(zipBytes);

      expect(entryNames).toContain("ChronoBell.exe");
      expect(entryNames).toContain("Launch-ChronoBell.bat");
      expect(entryNames).toContain("steam_appid.txt");
      expect(entryNames).toContain("resources/game.pak");
      expect(entryNames).toContain("resources/desktop-runtime.json");
      expect(entryNames).toContain("resources/app/index.html");
      expect(entryNames).toContain("saves/config.json");
      expect(entryNames).toContain("saves/slot-01.oprn-save.json");
      expect(entryNames).toContain("saves/README-STEAM-CLOUD.txt");
      expect(entryNames).toContain("steamworks/app_build_480.vdf");
      expect(entryNames).toContain("steamworks/depot_build_481.vdf");
      expect(entryNames).toContain("steamworks/steam_input_manifest.vdf");
      expect(entryNames).toContain("steamworks/STEAM_LAUNCH_CHECKLIST.md");

      // Verify PE64 MZ + PE header stub on ChronoBell.exe
      const exeBytes = readStoredZipEntry(zipBytes, "ChronoBell.exe")!;
      expect(exeBytes[0]).toBe(0x4d); // 'M'
      expect(exeBytes[1]).toBe(0x5a); // 'Z'
      expect(exeBytes[0x40]).toBe(0x50); // 'P'
      expect(exeBytes[0x41]).toBe(0x45); // 'E'

      // Verify steam_appid.txt
      const appIdText = decoder.decode(readStoredZipEntry(zipBytes, "steam_appid.txt")!);
      expect(appIdText.trim()).toBe("480");
    });

    async function runtimeFixtureFetch(project: ReturnType<typeof createBlankProject>) {
      const runtime = await createRuntimeManifest(
        [
          { name: "web/player.html", bytes: encoder.encode("<!doctype html><html><head></head><body><div id='app'></div></body></html>") },
          { name: "web/player.js", bytes: encoder.encode("console.log('player');") },
          { name: "web/dependency-collector.js", bytes: encoder.encode("var OPRN_RELEASE_COLLECTOR={collectReleaseDependencies:()=>[]};") },
        ],
        [],
      );
      project.meta.publication = preparePublication(runtime.runtimeTarget);
      const html = encoder.encode("<!doctype html><html><head></head><body><div id='app'></div></body></html>");
      const player = encoder.encode("console.log('player');");
      const collector = encoder.encode("var OPRN_RELEASE_COLLECTOR={collectReleaseDependencies:()=>[]};");
      const fileMap = new Map<string, Uint8Array>([
        ["/runtime-archive/default.json", jsonBytes({ runtimeTarget: runtime.runtimeTarget })],
        [`/runtime-archive/${runtime.runtimeTarget}/runtime.json`, jsonBytes(runtime)],
        [`/runtime-archive/${runtime.runtimeTarget}/web/player.html`, html],
        [`/runtime-archive/${runtime.runtimeTarget}/web/player.js`, player],
        [`/runtime-archive/${runtime.runtimeTarget}/web/dependency-collector.js`, collector],
      ]);
      const fetchBytes = async (path: string) => {
        const hit = fileMap.get(path);
        if (!hit) throw new Error(`Missing fixture path: ${path}`);
        return hit;
      };

      return fetchBytes;
    }

    it("starts the Linux and macOS desktop launchers instead of flatpak-spawn", async () => {
      const project = createBlankProject();
      project.meta.title = "ChronoBell";
      const fetchBytes = await runtimeFixtureFetch(project);

      const linux = await createDesktopSteamExportPackage(project, { platform: "linux64-steamos", fetchBytes });
      const linuxZip = new Uint8Array(await linux.blob.arrayBuffer());
      const script = decoder.decode(readStoredZipEntry(linuxZip, "Launch-ChronoBell.sh")!);
      expect(script).not.toContain("flatpak-spawn");
      expect(script).toContain('APP_URL="file://${APP_PATH// /%20}"');
      expect(script).toContain('exec xdg-open "${APP_PATH}"');
      expect(script).toContain('exec "$BROWSER" --app="${APP_URL}" --start-fullscreen --window-size=1280,720');
      expect(script).toContain("exit 1");
      expect(readStoredZipUnixMode(linuxZip, "Launch-ChronoBell.sh")).toBe(0o100755);
      expect(readStoredZipUnixMode(linuxZip, "ChronoBell.x86_64")).toBe(0o100755);
      expect(readStoredZipUnixMode(linuxZip, "steam_appid.txt")).toBeUndefined();
      const syntaxDir = mkdtempSync(join(tmpdir(), "oprn-launch-"));
      try {
        const scriptPath = join(syntaxDir, "Launch-ChronoBell.sh");
        writeFileSync(scriptPath, script);
        execFileSync("bash", ["-n", scriptPath]);
      } finally {
        rmSync(syntaxDir, { recursive: true, force: true });
      }

      const mac = await createDesktopSteamExportPackage(project, { platform: "macos-universal", fetchBytes });
      const macZip = new Uint8Array(await mac.blob.arrayBuffer());
      const macScript = decoder.decode(readStoredZipEntry(macZip, "ChronoBell.app/Contents/MacOS/ChronoBell")!);
      expect(macScript).toContain('APP_URL="file://${APP_PATH// /%20}"');
      expect(macScript).toContain('open -a "Google Chrome" --args --app="${APP_URL}" --start-fullscreen --window-size=1280,720 || open "${APP_PATH}"');
      expect(readStoredZipUnixMode(macZip, "ChronoBell.app/Contents/MacOS/ChronoBell")).toBe(0o100755);
      expect(readStoredZipUnixMode(macZip, "ChronoBell.app/Contents/Info.plist")).toBeUndefined();
    });

    it("escapes cmd and Steam VDF metacharacters in the game title", async () => {
      const project = createBlankProject();
      project.meta.title = "Dungeons & Dragons\n%PATH%";
      const fetchBytes = await runtimeFixtureFetch(project);
      const result = await createDesktopSteamExportPackage(project, {
        platform: "win64-steam",
        versionLabel: '1.0 "beta"',
        executableName: "ChronoBell",
        fetchBytes,
      });
      const zipBytes = new Uint8Array(await result.blob.arrayBuffer());
      const bat = decoder.decode(readStoredZipEntry(zipBytes, "Launch-ChronoBell.bat")!);
      const titleLine = bat.split(/\r?\n/).find((line) => line.startsWith("title "));
      // `%` is doubled so cmd does not expand PATH, and `&` is caret-escaped so it is not a new command.
      expect(titleLine).toBe('title Dungeons ^& Dragons %%PATH%% (v1.0 "beta")');
      const vdf = decoder.decode(readStoredZipEntry(zipBytes, "steamworks/app_build_480.vdf")!);
      expect(vdf).toContain(String.raw`"Desc" "Dungeons & Dragons %PATH% (win64-steam) v1.0 \"beta\""`);
      const input = decoder.decode(readStoredZipEntry(zipBytes, "steamworks/steam_input_manifest.vdf")!);
      expect(input).toContain(String.raw`"Set_GameControls" "Dungeons & Dragons %PATH% 기본 조작"`);
      expect(vdf.split("\n").filter((line) => line.includes('"Desc"'))).toHaveLength(1);
    });

    it("bridges localStorage save slots into saves/*.oprn-save.json for Steam Auto-Cloud", () => {
      expect(saveStorageKeyToDesktopFilePath("oprn:save-slot:v5:1")).toBe("saves/slot-01.oprn-save.json");
      expect(saveStorageKeyToDesktopFilePath("oprn:save-slot:v5:auto")).toBe("saves/autosave.oprn-save.json");
      expect(saveStorageKeyToDesktopFilePath("oprn:clear-record:v1")).toBe("saves/clear-record.oprn-save.json");

      const root = document.createElement("div");
      document.body.append(root);
      const cleanup = installDesktopShellBridge(root, {
        enabled: true,
        platform: "win64-steam",
        steamAppId: 480,
        displayMode: "fullscreen",
      });

      const mirrored = mirrorDesktopSaveFile("oprn:save-slot:v5:1", '{"schemaVersion":5,"gold":777}');
      expect(mirrored?.filePath).toBe("saves/slot-01.oprn-save.json");
      expect(window.__oprnDesktopShellState?.syncedSaveFiles["saves/slot-01.oprn-save.json"]?.json).toContain('"gold":777');
      cleanup();
    });
  });
});

describe("mgL8TacticsBattle", () => {
  isolateTimers();
  describe("actionCombatRuntimeProof", () => {
    isolateTimers();
    function graphicsStub() {
      const api = {
        clear: vi.fn(), fillStyle: vi.fn(), fillRect: vi.fn(), fillPoints: vi.fn(),
        setDepth: vi.fn(), destroy: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
        fillPath: vi.fn(), lineStyle: vi.fn(), strokePath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), setAlpha: vi.fn(),
      };
      return api as unknown as Phaser.GameObjects.Graphics;
    }
    function spriteStub(x: number, y: number) {
      const sprite = {
        x, y, displayWidth: 16, displayHeight: 16, originX: 0.5, originY: 1,
        scaleX: 1, scaleY: 1, alpha: 1,
        texture: { key: "stub" }, frame: { name: 0 },
        setTintFill: vi.fn(), clearTint: vi.fn(), setPosition: vi.fn(), setOrigin: vi.fn(),
        setDisplaySize: vi.fn(), setDepth: vi.fn(), setScale: vi.fn(), destroy: vi.fn(),
        setAlpha: vi.fn(), setVisible: vi.fn(), setFrame: vi.fn(), setFlipX: vi.fn(),
        // Phaser chains setTint(...).setTintMode(...) on a hit flash (playSceneActionCombat.ts).
        setTint: vi.fn((): unknown => sprite), setTintMode: vi.fn((): unknown => sprite),
      };
      return sprite;
    }
    /**
     * 최소 PlaySceneContext 대역. Phaser 표면(tweens/add/cameras)만 스텁이고
     * 진영·타깃·피해 규칙은 전부 실제 코드가 돈다 — 목을 통과해도 통합이 깨지면 실패해야 한다.
     */
    function fakeScene(project: Project, map: GameMap, playerAt: { x: number; y: number }) {
      const session = startSession(project);
      session.x = playerAt.x;
      session.y = playerAt.y;
      const fieldSpawnState = createFieldSpawnRuntime(project, map, playerAt);
      const eventPositions: Record<string, { x: number; y: number; direction: "down" }> = {};
      const eventSprites = new Map<string, ReturnType<typeof spriteStub>>();
      for (const entry of fieldSpawnState.entries) {
        for (const instance of entry.alive) {
          eventPositions[instance.eventId] = { x: instance.x, y: instance.y, direction: "down" };
          eventSprites.set(instance.eventId, spriteStub(instance.x * 16, instance.y * 16));
        }
      }
      const scene = {
        map,
        session,
        fieldSpawnState,
        eventPositions,
        eventSprites,
        autonomousNPCs: new Map(),
        actionCombatState: null,
        tileX: playerAt.x,
        tileY: playerAt.y,
        movingTo: { x: playerAt.x, y: playerAt.y },
        moving: false,
        running: false,
        dashing: false,
        inputEnabled: true,
        facing: "down" as const,
        player: spriteStub(playerAt.x * 16, playerAt.y * 16),
        input_: {
          setAttackMode: vi.fn(),
          isGuardHeld: () => false,
          consumeSkillCycleEdge: () => false,
        },
        tweens: { add: vi.fn(() => ({ stop: vi.fn() })), killTweensOf: vi.fn() },
        add: {
          graphics: vi.fn(graphicsStub),
          circle: vi.fn(() => ({ setDepth: vi.fn(), setStrokeStyle: vi.fn(), setPosition: vi.fn(), destroy: vi.fn() })),
          text: vi.fn(() => ({ setOrigin: vi.fn(), setDepth: vi.fn(), setScale: vi.fn(), destroy: vi.fn() })),
          sprite: vi.fn(() => spriteStub(0, 0)),
        },
        cameras: { main: { shake: vi.fn() } },
        // Action skills register a shutdown cleanup on scene.events (playSceneActionSkills.ts).
        events: { once: vi.fn(), off: vi.fn(), on: vi.fn() },
        game: { registry: { get: () => true }, canvas: { closest: () => null } },
        renderTiles: vi.fn(),
        registerPageMoveRoutes: vi.fn(),
        showGameOverScreen: vi.fn(),
        refreshRuntimeSurfaces: vi.fn(),
        setInputEnabled: vi.fn(),
      };
      return scene as unknown as PlaySceneContext & { showGameOverScreen: ReturnType<typeof vi.fn> };
    }
    function setup() {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      project.system.actionCombat = { enabled: true, dodgeIframesMs: 300, dodgeStaminaCost: 25 };
      map.actionCombat = true;
      map.safeZones = [];
      project.database.enemies.push(normalizeEnemyRecord({
        id: "proof_enemy", name: "Proof enemy",
        stats: { maxHp: 1, maxMp: 0, attack: 20, defense: 0, mind: 0, agility: 10 },
        rewards: { exp: 2, gold: 3, dropRatePercent: 0 },
        actionProfile: { attack: { kind: "melee", windupMs: 100, recoverMs: 100, damage: 5, range: 1, cooldownMs: 1000 } },
      }));
      project.database.troops.push({ id: "proof_troop", name: "Proof", enemyIds: ["proof_enemy"], members: [{ enemyId: "proof_enemy", x: 0, y: 0 }], autoAlign: true, battleEventPages: [] });
      map.fieldSpawns = [{ id: "proof_spawn", troopId: "proof_troop", area: { x: 2, y: 2, w: 1, h: 1 }, maxAlive: 1, chase: true }];
      store.replace(project);
      const scene = fakeScene(project, map, { x: 2, y: 3 });
      combat.initializeActionCombatForScene(scene);
      return scene;
    }
    describe("action dispatcher observations", () => {
      // The Phaser 4 port reads the global namespace for tint modes (d7f9e4bb82); the scene stub has no Phaser runtime.
      beforeEach(() => { vi.stubGlobal("Phaser", { TintModes: { FILL: 1 }, Math: { DegToRad: (deg: number) => deg * Math.PI / 180 } }); });
      afterEach(() => { vi.unstubAllGlobals(); });
      it("stationary Shift takes damage; the same strike is rejected only by an actual dodge", () => {
        const run = (moving: boolean) => {
          const scene = setup();
          const observations: ActionCombatObservation[] = [];
          const stop = combat.subscribeActionCombatObservations(scene, entry => observations.push(entry));
          scene.dashing = true;
          scene.moving = moving;
          scene.movingTo = { x: 3, y: 3 };
          combat.updateActionCombatForScene(scene, 1);
          combat.updateActionCombatForScene(scene, 100);
          stop();
          return observations;
        };
        const stationary = run(false);
        const dodging = run(true);
        const hit = stationary.find(entry => entry.outcome === "player-damage");
        const rejected = dodging.find(entry => entry.outcome === "dodge-rejection");
        expect(hit).toBeDefined();
        expect(hit!.before).toBeGreaterThan(hit!.after);
        expect(stationary.some(entry => entry.outcome === "dodge-rejection")).toBe(false);
        expect(rejected).toBeDefined();
        expect(rejected!.before).toBe(rejected!.after);
        expect(rejected!.attackId).toBe(hit!.attackId);
        expect(dodging.some(entry => entry.outcome === "player-damage")).toBe(false);
        expect(dodging.some(entry => entry.outcome === "stamina-spent")).toBe(true);
      });

      it("reports actual swing, kill, reward and stamina deltas then unsubscribes", () => {
        const scene = setup();
        scene.facing = "up";
        const observations: ActionCombatObservation[] = [];
        const stop = combat.subscribeActionCombatObservations(scene, entry => observations.push(entry));
        combat.tryActionCombatSwing(scene);
        combat.updateActionCombatForScene(scene, 100);
        combat.updateActionCombatForScene(scene, 100);
        expect(observations.map(entry => entry.outcome)).toEqual(expect.arrayContaining(["swing-hit", "enemy-defeat", "reward-granted", "stamina-spent", "stamina-recovered"]));
        expect(observations.every(entry => entry.mapId === scene.map.id)).toBe(true);
        const count = observations.length;
        stop();
        combat.updateActionCombatForScene(scene, 100);
        expect(observations).toHaveLength(count);
      });

      it("does not confuse hurt invulnerability with dodge rejection", () => {
        const scene = setup();
        const observations: ActionCombatObservation[] = [];
        const stop = combat.subscribeActionCombatObservations(scene, entry => observations.push(entry));
        scene.actionCombatState!.playerIframesMs = 1000;
        scene.actionCombatState!.dodgeIframesMs = 1000;
        combat.updateActionCombatForScene(scene, 1);
        combat.updateActionCombatForScene(scene, 100);
        stop();
        expect(observations.some(entry => entry.outcome === "dodge-rejection")).toBe(false);
      });

      it("does not count positive dodge frames or moving out of range as rejected damage", () => {
        const scene = setup();
        const observations: ActionCombatObservation[] = [];
        const stop = combat.subscribeActionCombatObservations(scene, entry => observations.push(entry));
        combat.updateActionCombatForScene(scene, 1);
        scene.tileX = 12;
        scene.tileY = 12;
        scene.actionCombatState!.dodgeIframesMs = 1000;
        combat.updateActionCombatForScene(scene, 100);
        stop();
        expect(scene.actionCombatState!.dodgeIframesMs).toBeGreaterThan(0);
        expect(observations.some(entry => entry.outcome === "dodge-rejection")).toBe(false);
        expect(observations.some(entry => entry.outcome === "player-damage")).toBe(false);
      });

      it("records projectiles only after the authored enemy dispatcher creates them", () => {
        const scene = setup();
        const enemy = [...scene.actionCombatState!.enemies.values()][0]!;
        enemy.actionAttack = { kind: "projectile", windupMs: 100, recoverMs: 100, damage: 5, range: 5, cooldownMs: 1000 };
        scene.tileY = 5;
        const observations: ActionCombatObservation[] = [];
        const stop = combat.subscribeActionCombatObservations(scene, entry => observations.push(entry));
        combat.updateActionCombatForScene(scene, 1);
        expect(observations.some(entry => entry.outcome === "enemy-projectile")).toBe(false);
        combat.updateActionCombatForScene(scene, 100);
        stop();
        expect(observations.find(entry => entry.outcome === "enemy-projectile"))
          .toMatchObject({ eventId: enemy.eventId, before: 0, after: 1 });
        expect(scene.actionCombatState!.projectiles).toHaveLength(1);
      });

      it("installs no observation subscription when the QA boot capability is absent", () => {
        const scene = setup();
        vi.spyOn(scene.game.registry, "get").mockReturnValue(false);
        const receive = vi.fn();
        const stop = combat.subscribeActionCombatObservations(scene, receive);
        combat.updateActionCombatForScene(scene, 1);
        combat.updateActionCombatForScene(scene, 100);
        stop();
        expect(receive).not.toHaveBeenCalled();
      });

      it("records defeat using the actual pre-hit HP, not the enemy maximum", () => {
        const scene = setup();
        const enemy = [...scene.actionCombatState!.enemies.values()][0]!;
        enemy.maxHp = 100;
        scene.facing = "up";
        const observations: ActionCombatObservation[] = [];
        const stop = combat.subscribeActionCombatObservations(scene, entry => observations.push(entry));
        combat.tryActionCombatSwing(scene);
        stop();
        expect(observations.find(entry => entry.outcome === "enemy-defeat")).toMatchObject({ before: 1, after: 0 });
      });
    });
  });
  // 전술(격자) 전투 tacticsBattle: 규칙 상태기계 · 키보드 오버레이 · 프로젝트 유닛 · 결과 분기.
  describe("mgL8TacticsBattle", () => {
    isolateTimers();
    const seed = (name: string, stats: Partial<TacticsUnitSeed> = {}): TacticsUnitSeed => ({
      sourceId: name, name, hp: 10, maxHp: 10, attack: 5, defense: 0, move: 3, ...stats,
    });
    describe("격자 규칙", () => {
      it("파티는 왼쪽 열, 적은 오른쪽 열에 선다", () => {
        const state = createTacticsState([seed("a"), seed("b")], [seed("x")], { width: 6, height: 4 });
        expect(state.units.map((u) => [u.id, u.x, u.y])).toEqual([["party:0", 0, 0], ["party:1", 0, 1], ["enemy:0", 5, 0]]);
        expect(state.turn).toBe("party");
      });

      it("이동 범위는 맨해튼 이동력 안이고 유닛 칸은 막는다", () => {
        const state = createTacticsState([seed("a", { move: 2 }), seed("b")], [seed("x")], { width: 6, height: 4 });
        const a = state.units[0]!;
        const tiles = reachableTiles(state, a).map((t) => `${t.x},${t.y}`);
        expect(tiles).toContain("2,0");
        expect(tiles).toContain("1,1");
        expect(tiles).not.toContain("0,1"); // b 가 서 있다
        expect(tiles).not.toContain("3,0"); // 3칸
        expect(tacticsMove(state, a.id, 3, 0)).toBe(false);
        expect(tacticsMove(state, a.id, 2, 0)).toBe(true);
        // 한 번 움직였으면 다시는 못 움직인다.
        expect(tacticsMove(state, a.id, 2, 1)).toBe(false);
      });

      it("인접한 적만 공격할 수 있고 피해는 공격-방어/2(최소 1)", () => {
        expect(tacticsDamage({ attack: 5 }, { defense: 4 })).toBe(3);
        expect(tacticsDamage({ attack: 1 }, { defense: 10 })).toBe(1);
        const state = createTacticsState([seed("a", { move: 4 })], [seed("x", { hp: 4 })], { width: 5, height: 2 });
        const a = state.units[0]!;
        const x = state.units[1]!;
        expect(tacticsAttack(state, a.id, x.id)).toBeUndefined();
        tacticsMove(state, a.id, 3, 0);
        expect(adjacentFoes(state, a).map((u) => u.id)).toEqual([x.id]);
        expect(tacticsAttack(state, a.id, x.id)).toBe(5);
        expect(x.hp).toBe(0);
        expect(state.result).toBe("victory");
      });

      it("아군이 모두 행동하면 적 차례, 적 AI 는 다가와 친다, 다음 라운드는 아군 차례", () => {
        const state = createTacticsState([seed("a", { hp: 20, maxHp: 20 })], [seed("x", { move: 3, attack: 7 })], { width: 5, height: 1 });
        const a = state.units[0]!;
        expect(tacticsWait(state, a.id)).toBe(true);
        expect(state.turn).toBe("enemy");
        runEnemyTurn(state);
        const x = state.units[1]!;
        expect(x.x).toBe(1);
        expect(a.hp).toBe(13);
        expect(state.turn).toBe("party");
        expect(state.round).toBe(2);
        expect(a.acted).toBe(false);
      });

      it("파티가 전멸하면 패배", () => {
        const state = createTacticsState([seed("a", { hp: 3 })], [seed("x", { attack: 9, move: 5 })], { width: 4, height: 1 });
        tacticsWait(state, state.units[0]!.id);
        runEnemyTurn(state);
        expect(state.result).toBe("defeat");
      });
    });
    describe("키보드 오버레이", () => {
      it("방향키·결정으로 고르고 이동하고 공격해 이기면 onEnd(victory) 한 번", () => {
        const host = document.createElement("div");
        document.body.append(host);
        const state = createTacticsState([seed("a", { attack: 99 })], [seed("x")], { width: 4, height: 1 });
        const onEnd = vi.fn();
        const controller = mountTacticsBattle(host, state, onEnd);
        expect(isInputCapturingSurfaceActive(host)).toBe(true);
        const press = (key: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }));
        press("z"); // a 고르기
        expect(controller.root.dataset.phase).toBe("move");
        press("ArrowRight");
        press("ArrowRight");
        press("z"); // (2,0) 으로 이동
        expect(state.units[0]!.x).toBe(2);
        expect(controller.root.dataset.phase).toBe("target");
        press("ArrowRight");
        press("Enter"); // x 공격
        expect(state.result).toBe("victory");
        expect(onEnd).toHaveBeenCalledTimes(1);
        expect(onEnd).toHaveBeenCalledWith("victory");
        press("z");
        expect(onEnd).toHaveBeenCalledTimes(1);
        controller.destroy();
        expect(host.querySelector("[data-testid='tactics-battle']")).toBeNull();
      });

      it("취소는 선택을 되돌리고, 제자리 결정은 대기로 적 차례를 넘긴다", () => {
        const host = document.createElement("div");
        const state = createTacticsState([seed("a", { hp: 50, maxHp: 50 })], [seed("x", { move: 1 })], { width: 6, height: 1 });
        const controller = mountTacticsBattle(host, state, vi.fn());
        controller.press("z");
        controller.press("x");
        expect(controller.root.dataset.phase).toBe("select");
        controller.press("z"); // 고르기
        controller.press("z"); // 제자리 = 이동 없음 → 공격 단계
        controller.press("z"); // 제자리 = 대기
        // 적 차례가 자동으로 돌고 다시 아군 차례
        expect(state.units[1]!.x).toBe(4);
        expect(state.turn).toBe("party");
        expect(host.querySelector("[data-testid='tactics-status']")?.textContent).toContain("2턴");
        controller.destroy();
      });

      it("한글 IME 의 Process 키로도 고르고 이동한다", () => {
        const host = document.createElement("div");
        document.body.append(host);
        const state = createTacticsState([seed("a", { attack: 99 })], [seed("x")], { width: 4, height: 1 });
        const controller = mountTacticsBattle(host, state, vi.fn());
        const press = (code: string, init: KeyboardEventInit = {}) => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Process", code, cancelable: true, ...init }));
        };
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "가", isComposing: true, cancelable: true }));
        expect(controller.root.dataset.phase).toBe("select");
        press("KeyZ");
        expect(controller.root.dataset.phase).toBe("move");
        press("ArrowRight");
        press("ArrowRight");
        press("KeyZ");
        expect(state.units[0]!.x).toBe(2);
        expect(controller.root.dataset.phase).toBe("target");
        controller.destroy();
      });
    });
    describe("프로젝트 → 유닛 · 세션 되쓰기 · 저장 왕복", () => {
      it("파티 HP·능력치와 트룹 적을 유닛으로 만들고 끝난 HP 를 세션에 되돌린다", () => {
        const project = createBlankProject();
        project.database.enemies.push(normalizeEnemyRecord({
          id: "slime", name: "슬라임", stats: { maxHp: 12, maxMp: 0, attack: 4, defense: 1, mind: 0, agility: 1 },
          rewards: { exp: 0, gold: 0, dropRatePercent: 0 },
        }));
        project.database.troops.push({ id: "t", name: "T", enemyIds: ["slime", "slime"], autoAlign: true, battleEventPages: [] });
        const session = startSession(project);
        const party = partyTacticsSeeds(project, session);
        expect(party.length).toBe(session.partyActorIds.length);
        expect(party[0]!.hp).toBeGreaterThan(0);
        const foes = troopTacticsSeeds(project, "t");
        expect(foes.map((f) => [f.name, f.hp, f.attack])).toEqual([["슬라임", 12, 4], ["슬라임", 12, 4]]);
        expect(troopTacticsSeeds(project, "missing")).toEqual([]);
        const state = createTacticsState(party, foes);
        state.units[0]!.hp = 1;
        writeTacticsVitals(project, session, state);
        expect(session.actorVitals[session.partyActorIds[0]!]!.hp).toBe(1);
      });

      it("tacticsBattle 명령과 옆보기·동료 필드가 저장/불러오기에서 살아남는다", () => {
        const project = createBlankProject();
        project.database.troops.push({ id: "t", name: "T", enemyIds: [], autoAlign: true, battleEventPages: [] });
        const map = project.maps[project.startMapId]!;
        map.sideView = true;
        map.sideViewJumpTiles = 3;
        project.system.actionCombat = { enabled: true, allies: true };
        map.events.push({
          id: "ev_tactics", x: 1, y: 1, trigger: { kind: "action" },
          commands: [{ kind: "tacticsBattle", troopId: "t", width: 7, canLose: true, victoryBranch: [{ kind: "setFlag", flag: "won", value: true }], defeatBranch: [] }],
        });
        const restored = deserialize(serialize(project));
        const restoredMap = restored.maps[restored.startMapId]!;
        expect(restoredMap.sideView).toBe(true);
        expect(restoredMap.sideViewJumpTiles).toBe(3);
        expect(restored.system.actionCombat?.allies).toBe(true);
        expect(restoredMap.events.find((e) => e.id === "ev_tactics")?.commands[0]).toMatchObject({ kind: "tacticsBattle", troopId: "t", width: 7, canLose: true });
      });
    });
  });
});

describe("runtimePlayer", () => {
  isolateTimers();
  // 대각으로 걸을 때 모서리 칸의 사람(같은 층·겹침 금지)을 직선으로 가로지르지 않는다.
  // 벽 모서리는 resolveDiagonalStep 이 이미 미끄러지지만, 인물은 목적지 칸에서만 봤다.
  describe("runtimePlayerDiagonalCorner", () => {
    isolateTimers();
    const FRAME_MS = 1000 / 60;
    function solid(id: string, x: number, y: number, trigger: EventPage["trigger"] = { kind: "action" }): GameEvent {
      return {
        id,
        x,
        y,
        trigger,
        commands: [],
        pages: [{
          id: `${id}_p`,
          name: id,
          conditions: [],
          graphic: {},
          trigger,
          priority: "same",
          overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        }],
      };
    }
    function cornerScene(events: GameEvent[], input: { x: number; y: number; dir: "right" | "down" }): {
      scene: PlaySceneContext;
      ran: string[];
    } {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      map.events = events;
      store.replace(project);
      const ran: string[] = [];
      const scene = {
        game: { canvas: { parentElement: null, ownerDocument: { querySelector: () => null } } },
        session: startSession(project),
        map,
        eventPositions: initialRuntimeEventPositions(map.events),
        player: {
          x: 0, y: 0, setFrame: () => undefined, setPosition: () => undefined, setVisible: () => undefined,
          setDepth: () => undefined, setOrigin: () => undefined,
        },
        playerSprite: { idleFrameFor: () => 1, walkFrameFor: () => 2, walkFrameCount: 3 },
        input_: {
          update: () => ({ x: input.x, y: input.y, dir: input.dir, dash: false, actionPressed: false, attackPressed: false, skillPressed: false }),
          resetEdges: () => undefined,
          clearDirectionTaps: () => undefined,
        },
        followerSprites: new Map(),
        autonomousNPCs: new Map(),
        tileX: 4,
        tileY: 4,
        movingFrom: { x: 4, y: 4 },
        movingTo: { x: 4, y: 4 },
        moving: false,
        moveProgress: 0,
        moveDurationMs: 160,
        logicTickAccumulatorMs: 0,
        dashing: false,
        facing: "down",
        walkFrame: 0,
        walkTimer: 0,
        lastActionTargetKey: "",
        playerRoute: null,
        playerHop: null,
        running: false,
        inputEnabled: true,
        runEvent: async (id: string) => { ran.push(id); },
        updateAutonomousNPCs: () => undefined,
        updateParallelEvents: () => undefined,
        updateTimers: () => undefined,
        updateFieldSpawns: () => undefined,
        syncRuntimeState: () => undefined,
      } as unknown as PlaySceneContext;
      return { scene, ran };
    }
    describe("대각 걸음은 모서리의 사람을 가로지르지 않는다", () => {
      it("오른쪽 모서리에 사람이 있으면 아래로 미끄러진다", () => {
        const { scene, ran } = cornerScene([solid("npc", 5, 4)], { x: 1, y: 1, dir: "right" });
        updatePlayScene(scene, FRAME_MS);
        expect(scene.moving).toBe(true);
        expect(scene.movingTo).toEqual({ x: 4, y: 5 });
        expect(scene.facing).toBe("down");
        expect(ran).toEqual([]);
      });

      it("발밑 이벤트(아래 층)는 모서리를 막지 않는다", () => {
        const rug = solid("rug", 5, 4);
        rug.pages![0]!.priority = "below";
        rug.pages![0]!.overlapForbidden = false;
        const { scene } = cornerScene([rug], { x: 1, y: 1, dir: "right" });
        updatePlayScene(scene, FRAME_MS);
        expect(scene.movingTo).toEqual({ x: 5, y: 5 });
      });

      it("양쪽 모서리가 사람이면 대각으로 들어가지 않고 바라보는 쪽에게 부딪힌다", () => {
        const { scene, ran } = cornerScene(
          [solid("side", 5, 4, { kind: "playerTouch" }), solid("ahead", 4, 5, { kind: "playerTouch" })],
          { x: 1, y: 1, dir: "right" },
        );
        updatePlayScene(scene, FRAME_MS);
        expect(scene.moving).toBe(false);
        expect(scene.tileX).toBe(4);
        expect(scene.tileY).toBe(4);
        expect(scene.facing).toBe("right");
        expect(ran).toEqual(["side"]);
      });

      it("대각 목적지 칸의 사람에게는 미끄러지지 않고 그 자리에서 부딪힌다", () => {
        const { scene, ran } = cornerScene([solid("npc", 5, 5, { kind: "playerTouch" })], { x: 1, y: 1, dir: "right" });
        updatePlayScene(scene, FRAME_MS);
        expect(scene.moving).toBe(false);
        expect(scene.tileX).toBe(4);
        expect(scene.tileY).toBe(4);
        expect(ran).toEqual(["npc"]);
      });

      it("정면의 사람에게 똑바로 걸으면 여전히 부딪혀 접촉이 발동한다", () => {
        const { scene, ran } = cornerScene([solid("npc", 5, 4, { kind: "playerTouch" })], { x: 1, y: 0, dir: "right" });
        updatePlayScene(scene, FRAME_MS);
        expect(scene.moving).toBe(false);
        expect(ran).toEqual(["npc"]);
      });
    });
  });
  describe("runtimePlayerHop", () => {
    isolateTimers();
    type PlayerMock = {
      x: number;
      y: number;
      depth: number;
      frame: string | number;
      origin: readonly [number, number];
      readonly height: number;
      readonly scaleY: number;
      setFrame(frame: string | number): void;
      setOrigin(x: number, y: number): void;
      setPosition(x: number, y: number): void;
      setDepth(depth: number): void;
    };
    function playerMock(): PlayerMock {
      return {
        x: 0,
        y: 0,
        depth: 0,
        frame: 0,
        origin: [0.5, 1],
        height: 32,
        scaleY: 1,
        setFrame(frame) {
          this.frame = frame;
          // Phaser 의 setFrame 은 displayOrigin 을 기본값으로 되돌린다 — 리프트 계약을 재현한다.
          this.origin = [0.5, 1];
        },
        setOrigin(x, y) {
          this.origin = [x, y];
        },
        setPosition(x, y) {
          this.x = x;
          this.y = y;
        },
        setDepth(depth) {
          this.depth = depth;
        },
      };
    }
    function hopScene(): { readonly scene: PlaySceneContext; readonly player: PlayerMock } {
      const project = createBlankProject();
      store.replace(project);
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      const player = playerMock();
      const scene = {
        game: { canvas: { parentElement: null, ownerDocument: { querySelector: () => null } } },
        session: startSession(project),
        map,
        eventPositions: initialRuntimeEventPositions(map.events),
        player,
        playerSprite: {
          idleFrameFor: () => 1,
          walkFrameFor: (_dir: string, frame: number) => 10 + frame,
          walkFrameCount: 3,
        },
        input_: {
          update: () => ({
            x: 0,
            y: 0,
            dir: null,
            dash: false,
            actionPressed: false,
            attackPressed: false,
            skillPressed: false,
          }),
          resetEdges: () => undefined,
        },
        followerSprites: new Map(),
        autonomousNPCs: new Map(),
        tileX: 4,
        tileY: 4,
        movingFrom: { x: 4, y: 4 },
        movingTo: { x: 4, y: 4 },
        moving: false,
        moveProgress: 0,
        moveDurationMs: 160,
        logicTickAccumulatorMs: 0,
        dashing: false,
        facing: "right",
        walkFrame: 0,
        walkTimer: 0,
        lastActionTargetKey: "",
        playerRoute: null,
        playerHop: null,
        running: false,
        inputEnabled: true,
        runEvent: async () => undefined,
        updateAutonomousNPCs: () => undefined,
        updateParallelEvents: () => undefined,
        updateTimers: () => undefined,
        updateFieldSpawns: () => undefined,
        syncRuntimeState: () => undefined,
      } as unknown as PlaySceneContext;
      return { scene, player };
    }
    /** 원점 Y 에 실린 리프트를 월드 px 로 되읽는다. */
    function liftPx(player: PlayerMock): number {
      return (player.origin[1] - 1) * player.height * player.scaleY;
    }
    function route(scene: PlaySceneContext, moves: MoveCommand[]): void {
      startPlayerRoute(scene, moves, false);
    }
    /** 논리 프레임(60Hz). 점프·낙하도 걸음과 같은 틱으로 진행되므로 시간이 아니라 프레임 수로 말한다. */
    const FRAME_MS = 1000 / 60;
    const frames = (count: number): number => count * FRAME_MS;
    const framesFor = (durationMs: number): number => Math.round(durationMs / FRAME_MS);
    describe("주인공 점프", () => {
      it("바라보는 방향으로 두 칸을 아크로 건너뛴다", () => {
        const { scene, player } = hopScene();
        route(scene, [{ kind: "jump", dx: 0, dy: 0 }]);
        const total = framesFor(DEFAULT_JUMP_DURATION_MS);

        updatePlayScene(scene, frames(1));
        expect(scene.moving).toBe(true);
        expect(scene.movingTo).toEqual({ x: 6, y: 4 });
        expect(scene.playerHop).not.toBeNull();

        updatePlayScene(scene, frames(total / 2 - 1));
        expect(liftPx(player)).toBeCloseTo(DEFAULT_JUMP_PEAK_PX, 6);
        // 접지 y 는 아크 내내 타일 경계에 남는다(depth·카메라·조명이 이 값을 읽는다).
        expect(player.y).toBe(5 * 16);

        updatePlayScene(scene, frames(total / 2));
        expect(scene.moving).toBe(false);
        expect(scene.playerHop).toBeNull();
        expect(liftPx(player)).toBe(0);
        expect(scene.tileX).toBe(6);
        expect(scene.tileY).toBe(4);
        expect(scene.session.x).toBe(6);
      });

      it("저작 좌표·높이를 그대로 쓴다", () => {
        const { scene, player } = hopScene();
        route(scene, [{ kind: "jump", dx: -1, dy: 2, heightPx: 40, durationMs: 400 }]);
        const total = framesFor(400);

        updatePlayScene(scene, frames(1));
        expect(scene.movingTo).toEqual({ x: 3, y: 6 });
        updatePlayScene(scene, frames(total / 2 - 1));
        expect(liftPx(player)).toBeCloseTo(40, 6);
        updatePlayScene(scene, frames(total / 2));
        expect(scene.tileX).toBe(3);
        expect(scene.tileY).toBe(6);
        expect(liftPx(player)).toBe(0);
      });

      it("맵 밖으로는 뛰지 않고 다음 명령으로 넘어간다", () => {
        const { scene } = hopScene();
        route(scene, [{ kind: "jump", dx: 0, dy: -99 }, { kind: "turn", dir: "up" }]);

        updatePlayScene(scene, frames(1));
        expect(scene.moving).toBe(false);
        expect(scene.playerHop).toBeNull();
        expect(scene.tileY).toBe(4);
        expect(scene.facing).toBe("up");
      });
    });
    describe("주인공 낙하 등장", () => {
      it("타일 이동 없이 위에서 떨어진다", () => {
        const { scene, player } = hopScene();
        route(scene, [{ kind: "dropIn" }]);
        const total = framesFor(DEFAULT_FALL_DURATION_MS);

        updatePlayScene(scene, frames(1));
        expect(scene.moving).toBe(false);
        expect(scene.playerHop).not.toBeNull();
        // 곡선 자체는 characterHop.test.ts 가 잠근다 — 여기서는 런타임이 그 곡선을 프레임 진행률로 쓰는지만 본다.
        expect(liftPx(player)).toBe(Math.round(fallLiftPx(1 / total, DEFAULT_FALL_HEIGHT_PX)));

        const midpoint = Math.floor(total / 2);
        updatePlayScene(scene, frames(midpoint - 1));
        expect(liftPx(player)).toBe(Math.round(fallLiftPx(midpoint / total, DEFAULT_FALL_HEIGHT_PX)));
        expect(scene.tileX).toBe(4);
        expect(scene.tileY).toBe(4);

        updatePlayScene(scene, frames(total - midpoint));
        expect(scene.playerHop).toBeNull();
        expect(liftPx(player)).toBe(0);
        expect(player.origin).toEqual([0.5, 1]);
      });

      it("낙하가 끝날 때까지 다음 이동 명령을 소비하지 않는다", () => {
        const { scene } = hopScene();
        route(scene, [{ kind: "dropIn", durationMs: 200 }, { kind: "move", dir: "right" }]);
        const total = framesFor(200);

        updatePlayScene(scene, frames(1));
        updatePlayScene(scene, frames(total / 2 - 1));
        // 아직 공중이므로 다음 걸음이 시작되지 않았다.
        expect(scene.moving).toBe(false);
        expect(scene.tileX).toBe(4);

        updatePlayScene(scene, frames(total / 2));
        expect(scene.playerHop).toBeNull();
        updatePlayScene(scene, frames(1));
        expect(scene.moving).toBe(true);
        expect(scene.movingTo).toEqual({ x: 5, y: 4 });
      });
    });
  });
});
