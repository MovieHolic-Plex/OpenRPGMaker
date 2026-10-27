/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { loadBundledAssets } from "@/assets/bundled";
import { resolveSpatialGraphicTexture } from "@/player/eventSpriteResources";
import { renderPlaceableOverlays } from "@/player/playScenePlaceables";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";

const CLOUD = "easyrpg-picture-cloud";

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
  // Retired: the EasyRPG picture library (incl. easyrpg-picture-cloud) left the bundle in the 2026-10-07 copyright purge
  // (EASYRPG_PICTURE_ASSETS is now empty, src/assets/easyrpgRtp.ts), so the three catalog-picture load/resolve cases
  // (default load, orientation-variant load, spatial texture resolve) no longer have an asset to load.

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
