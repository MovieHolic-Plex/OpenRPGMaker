import { writeFile } from "node:fs/promises";
import { loadBundledAssets } from "@/assets/bundled";
import { EASYRPG_PICTURE_ASSETS } from "@/assets/easyrpgRtp";
import { PLAYER_RUNTIME_ASSET_PATHS } from "@/project/playerDeploymentPaths";
import { collectWebExportAssets } from "@/project/webExportAssets";
import { resolveEventSpriteTexture, resolveSpatialGraphicTexture } from "@/player/eventSpriteResources";
import { renderPlaceableOverlays } from "@/player/playScenePlaceables";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";

const CLOUD = "easyrpg-picture-cloud";
const CLOUD_PATH = "assets/easyrpg/picture/Cloud.png";
const OTHER = EASYRPG_PICTURE_ASSETS.find((asset) => asset.id !== CLOUD)?.id ?? null;

function fakeLoadScene() {
  const images = [];
  return {
    images,
    scene: {
      load: {
        image(key, url) { images.push({ key, url }); },
        on() {},
      },
    },
  };
}

function decorationProject(options = {}) {
  const project = createBlankProject();
  project.database.homeDecorationTypes = [{
    id: "rug",
    name: "Rug",
    placementItemId: "item_potion",
    footprint: { width: 1, height: 1 },
    graphicResourceId: options.graphicResourceId ?? CLOUD,
    orientationGraphicResourceIds: options.orientationId ? { left: options.orientationId } : undefined,
  }];
  return project;
}

function buildingLevelProject() {
  const project = createBlankProject();
  project.database.farmBuildingTypes = [{
    id: "shed",
    name: "Shed",
    levels: [
      { level: 1, footprint: { width: 1, height: 1 }, capacity: 1, graphicResourceId: "building-default" },
      { level: 2, footprint: { width: 2, height: 1 }, capacity: 1, graphicResourceId: CLOUD },
    ],
  }];
  return project;
}

const referenced = fakeLoadScene();
const unreferenced = fakeLoadScene();
const orientationOnly = fakeLoadScene();
const levelTwo = fakeLoadScene();
loadBundledAssets(referenced.scene, decorationProject());
loadBundledAssets(unreferenced.scene, createBlankProject());
loadBundledAssets(orientationOnly.scene, decorationProject({ graphicResourceId: "decor-default", orientationId: CLOUD }));
loadBundledAssets(levelTwo.scene, buildingLevelProject());

const project = decorationProject();
const session = startSession(project, 45);
session.homeDecorationPlacements = {
  rug1: {
    instanceId: "rug1",
    typeId: "rug",
    mapId: project.startMapId,
    x: 4,
    y: 5,
    orientation: "down",
  },
};
store.replaceProject(project);
const calls = [];
const map = project.maps[project.startMapId];
renderPlaceableOverlays({
  map,
  session,
  tileLayer: { add() {} },
  add: {
    sprite: (...args) => {
      calls.push(args);
      return { setOrigin() {}, setDisplaySize() {}, setDepth() {} };
    },
  },
});

const blankExport = collectWebExportAssets(createBlankProject()).map((asset) => asset.zipPath);
const decorExport = collectWebExportAssets(decorationProject()).map((asset) => asset.zipPath);
const buildingExport = collectWebExportAssets(buildingLevelProject()).map((asset) => asset.zipPath);
const otherPictures = EASYRPG_PICTURE_ASSETS
  .filter((asset) => asset.id !== CLOUD)
  .map((asset) => asset.path);

const report = {
  cloudCatalog: EASYRPG_PICTURE_ASSETS.some((asset) => asset.id === CLOUD && asset.path === CLOUD_PATH),
  runtimeInventoryIncludesCloud: PLAYER_RUNTIME_ASSET_PATHS.includes(CLOUD_PATH),
  runtimeInventoryPictureCount: PLAYER_RUNTIME_ASSET_PATHS.filter((path) => path.includes("easyrpg/picture")).length,
  load: {
    decorationDefault: referenced.images.some((image) => image.key === CLOUD && image.url === CLOUD_PATH),
    blankProjectLoadsCloud: unreferenced.images.some((image) => image.key === CLOUD),
    decorationOrientationOnly: orientationOnly.images.some((image) => image.key === CLOUD && image.url === CLOUD_PATH),
    buildingLevelTwoOnly: levelTwo.images.some((image) => image.key === CLOUD && image.url === CLOUD_PATH),
    otherPictureLoadedOnDecorationProject: OTHER
      ? referenced.images.some((image) => image.key === OTHER)
      : null,
  },
  resolve: {
    spatialDecoration: resolveSpatialGraphicTexture(project, CLOUD),
    eventDecoration: resolveEventSpriteTexture(project, CLOUD, 0),
  },
  overlayTextureKeys: calls.map((args) => args[2]),
  export: {
    blankHasCloud: blankExport.includes(CLOUD_PATH),
    decorationHasCloud: decorExport.includes(CLOUD_PATH),
    buildingLevelHasCloud: buildingExport.includes(CLOUD_PATH),
    decorationHasOtherPictures: otherPictures.filter((path) => decorExport.includes(path)),
  },
};

const ok = report.cloudCatalog
  && report.runtimeInventoryIncludesCloud === false
  && report.runtimeInventoryPictureCount === 0
  && report.load.decorationDefault
  && report.load.blankProjectLoadsCloud === false
  && report.load.decorationOrientationOnly
  && report.load.buildingLevelTwoOnly
  && report.load.otherPictureLoadedOnDecorationProject === false
  && report.resolve.spatialDecoration?.texture === CLOUD
  && report.resolve.eventDecoration === null
  && report.overlayTextureKeys[0] === CLOUD
  && report.export.blankHasCloud === false
  && report.export.decorationHasCloud
  && report.export.buildingLevelHasCloud
  && report.export.decorationHasOtherPictures.length === 0;

report.ok = ok;
const out = process.env.REVIEW_OUT || "/dev/shm/st_01a078fa-ui-review/export-decoration.json";
await writeFile(out, JSON.stringify(report, null, 2) + "\n");
if (!ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
