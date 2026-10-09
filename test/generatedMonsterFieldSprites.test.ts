import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBundledAssets } from "@/assets/bundled";
import { generatedMonsterSpriteUrl } from "@/assets/generatedMonsterSprites";
import { registerInlineAssets } from "@/assets/inlineAssetStore";
import { createBlankProject, DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { collectWebExportAssets } from "@/project/webExportAssets";
import { eventSpriteFrameForDirection, eventSpriteScale, resolveEventSpriteTexture, setEventSpritePattern } from "@/player/eventSpriteResources";
import { createFieldSpawnRuntime, syncFieldSpawnEventsIntoMap } from "@/player/fieldSpawns";
import { renderEventLayer } from "@/player/playSceneMapRuntime";
import { setNpcIdleFrame, setNpcWalkFrame } from "@/player/playSceneAutonomousSprites";
import { applyMoveRouteGraphicChange } from "@/player/playSceneAutonomousRouteEffects";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { mockSprite, mockTileImage } from "./runtimeEventPageFixtures";

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
    expect(resolveEventSpriteTexture(project, monsterId, 5)).toEqual({ texture: monsterId, frame: "__BASE", fitSize: 32 });
    expect(preload(project)).toHaveBeenCalledWith(monsterId, "data:image/png;base64,AA==");
    const charset = resolveEventSpriteTexture(project, DEFAULT_EASYRPG_CHARSET_ID, 0);
    expect(charset).toEqual({ texture: DEFAULT_EASYRPG_CHARSET_ID, frame: 0 });
    expect(eventSpriteScale(charset, { width: 24, height: 32 }, 2)).toBe(2);
  });
});
