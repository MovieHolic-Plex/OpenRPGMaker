import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { renderTiles } from "@/player/playSceneMapRuntime";
import {
  findBlockingRuntimeEventAt,
  initialRuntimeEventPositions,
  runtimeEventView,
} from "@/player/runtimeEventState";
import {
  event,
  isMockSprite,
  mockTileImage,
  mockSprite,
  pageWith,
  renderSceneWith,
  session,
  type MockSprite,
} from "./runtimeEventPageFixtures";

describe("runtime event page graphics", () => {
  it("exposes movement, animation, and transparent graphic controls to NPC runtime views", () => {
    const events = [
      event("controlled-npc", 2, 3, [
        pageWith({
          priority: "above",
          trigger: { kind: "eventTouch" },
          graphic: {
            sprite: { type: "bundled", id: "npc_villager" },
            transparent: true,
          },
          movement: {
            type: "random",
            speed: 5,
            frequency: 6,
          },
          animationType: "fixedGraphic",
          overlapForbidden: false,
        }),
      ]),
    ];
    const positions = initialRuntimeEventPositions(events);
    const view = runtimeEventView(events[0], session(), positions);

    expect(view.sprite).toBeUndefined();
    expect(view.transparent).toBe(true);
    expect(view.movement).toEqual({ type: "random", speed: 5, frequency: 6 });
    expect(view.animationType).toBe("fixedGraphic");
    expect(view.overlapForbidden).toBe(false);
    expect(findBlockingRuntimeEventAt(events, session(), positions, 2, 3)).toBeUndefined();
  });

  it("does not render or report missing sprite resources for transparent NPC pages", () => {
    const scene = renderSceneWith({
      graphic: {
        sprite: { type: "bundled", id: "tex_tiles_default" },
        transparent: true,
      },
    });

    renderTiles(scene);

    expect(scene.eventSprites.has("npc")).toBe(false);
    expect(scene.missingResources.has("tex_tiles_default")).toBe(false);
  });

  it("renders character sprites on the root display list with lower-screen sprites above upper-screen sprites", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.events = [
      event("upper", 1, 1, [pageWith({ graphic: { sprite: { type: "bundled", id: "npc_villager" } } })]),
      event("lower", 1, 2, [pageWith({ graphic: { sprite: { type: "bundled", id: "npc_villager" } } })]),
    ];
    store.replace(project);
    const tileLayerChildren: unknown[] = [];
    const scene = {
      map,
      session: startSession(project),
      eventPositions: initialRuntimeEventPositions(map.events),
      tileLayer: {
        removeAll: () => undefined,
        add: (image: unknown) => {
          tileLayerChildren.push(image);
        },
      },
      eventSprites: new Map<string, MockSprite>(),
      runtimeDom: {
        clearEventMarkers: () => undefined,
        upsertEventMarker: () => undefined,
        syncMissingResourceError: () => undefined,
      },
      missingResources: new Set<string>(),
      add: {
        image: () => mockTileImage(),
        sprite: (x: number, y: number) => mockSprite(x, y),
      },
      runEvent: async () => undefined,
      syncRuntimeState: () => undefined,
    };

    renderTiles(scene);

    const upper = scene.eventSprites.get("upper");
    const lower = scene.eventSprites.get("lower");
    expect(upper?.origin).toEqual([0.5, 1]);
    expect(lower?.origin).toEqual([0.5, 1]);
    expect(upper?.y).toBe(32);
    expect(lower?.y).toBe(48);
    expect(lower?.depth).toBeGreaterThan(upper?.depth ?? Number.POSITIVE_INFINITY);
    expect(tileLayerChildren.some((child) => isMockSprite(child))).toBe(false);
  });
});
