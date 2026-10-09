/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { loadBundledAssets } from "@/assets/bundled";
import { EASYRPG_PICTURE_ASSETS } from "@/assets/easyrpgRtp";
import { resolveEventSpriteTexture, resolveSpatialGraphicTexture } from "@/player/eventSpriteResources";
import { renderPlaceableOverlays } from "@/player/playScenePlaceables";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";

const CLOUD = "easyrpg-picture-cloud";
const CLOUD_PATH = "assets/easyrpg/picture/Cloud.png";

function spatialProject(options?: {
  readonly graphicResourceId?: string;
  readonly orientationId?: string;
}) {
  const project = createBlankProject();
  const graphicResourceId = options?.graphicResourceId ?? CLOUD;
  project.database.farmBuildingTypes = [{
    id: "shed",
    name: "Shed",
    levels: [{
      level: 1,
      footprint: { width: 1, height: 1 },
      capacity: 1,
      graphicResourceId,
      orientationGraphicResourceIds: options?.orientationId
        ? { left: options.orientationId }
        : undefined,
    }],
  }];
  return project;
}

function fakeLoadScene() {
  const images: { readonly key: string; readonly url: string }[] = [];
  const scene = {
    load: {
      image(key: string, url: string) {
        images.push({ key, url });
      },
      on() {},
    },
  };
  return { scene: scene as unknown as Phaser.Scene, images };
}

describe("spatial catalog picture render", () => {
  it("selects and loads the editor default picture under its catalog id, not the whole picture library", () => {
    // Given: a farm building that authors the editor default Cloud picture.
    const referenced = fakeLoadScene();
    const unreferenced = fakeLoadScene();
    expect(EASYRPG_PICTURE_ASSETS.some((asset) => asset.id === CLOUD && asset.path === CLOUD_PATH)).toBe(true);

    // When: bundled play assets load for that project versus a project with no spatial pictures.
    loadBundledAssets(referenced.scene, spatialProject());
    loadBundledAssets(unreferenced.scene, createBlankProject());

    // Then: Cloud is queued as Phaser key easyrpg-picture-cloud from its catalog path, and blank projects do not load it.
    expect(referenced.images).toContainEqual({ key: CLOUD, url: CLOUD_PATH });
    expect(unreferenced.images.some((image) => image.key === CLOUD)).toBe(false);
  });

  it("loads an orientation-variant catalog picture referenced only on one facing", () => {
    // Given: the default graphic is a non-picture id, but left facing authors Cloud.
    const { scene, images } = fakeLoadScene();

    // When: bundled assets inspect level orientation graphics.
    loadBundledAssets(scene, spatialProject({ graphicResourceId: "building-default", orientationId: CLOUD }));

    // Then: the facing variant is still selected for load.
    expect(images).toContainEqual({ key: CLOUD, url: CLOUD_PATH });
  });

  it("resolves the catalog picture for spatial sprites without treating it as an event charset", () => {
    // Given: the default Cloud id used by the editor spatial graphic field.
    const project = spatialProject();

    // When: spatial overlay resolution runs beside the existing event-sprite resolver.
    const spatial = resolveSpatialGraphicTexture(project, CLOUD);
    const event = resolveEventSpriteTexture(project, CLOUD, 0);

    // Then: the map sprite uses the catalog texture key; NPC/event charset mapping stays unchanged.
    expect(spatial).toEqual({ texture: CLOUD, frame: "__BASE" });
    expect(event).toBeNull();
  });

  it("draws the catalog picture key for a live placement instead of the raw missing fallback only", () => {
    // Given: one shed using Cloud on the current map.
    const project = spatialProject();
    const session = startSession(project, 45);
    session.farmBuildingPlacements = {
      home1: {
        instanceId: "home1",
        typeId: "shed",
        level: 1,
        mapId: project.startMapId,
        x: 3,
        y: 4,
        orientation: "down",
      },
    };
    store.replaceProject(project);
    const calls: unknown[][] = [];
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("blank project requires a start map");
    const scene = {
      map,
      session,
      tileLayer: { add() {} },
      add: {
        sprite: (...args: unknown[]) => {
          calls.push(args);
          return { setOrigin() {}, setDisplaySize() {}, setDepth() {} };
        },
      },
    };

    // When: the existing placeable overlay renderer runs.
    renderPlaceableOverlays(scene);

    // Then: Phaser is asked for the catalog picture key, not an unresolved charset id.
    expect(calls.map((args) => args[2])).toEqual([CLOUD]);
  });

  it("does not declare an unknown graphic loaded", () => {
    // Given: a spatial type that points at an id that is not a catalog picture or charset.
    const { scene, images } = fakeLoadScene();
    const project = spatialProject({ graphicResourceId: "missing_resource" });

    // When: assets load and spatial resolution runs.
    loadBundledAssets(scene, project);
    const resolved = resolveSpatialGraphicTexture(project, "missing_resource");

    // Then: no catalog picture is queued and the unknown id is not rewritten as a loaded Cloud texture.
    expect(images.some((image) => image.key === CLOUD || image.key === "missing_resource")).toBe(false);
    expect(resolved).toBeNull();
  });
});
