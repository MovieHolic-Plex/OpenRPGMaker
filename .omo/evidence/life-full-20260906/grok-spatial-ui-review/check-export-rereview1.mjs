import { writeFile } from "node:fs/promises";
import { loadBundledAssets } from "@/assets/bundled";
import { EASYRPG_PICTURE_ASSETS } from "@/assets/easyrpgRtp";
import { PLAYER_RUNTIME_ASSET_PATHS } from "@/project/playerDeploymentPaths";
import { collectWebExportAssets, prepareWebExport } from "@/project/webExport";
import { resolveEventSpriteTexture, resolveSpatialGraphicTexture } from "@/player/eventSpriteResources";
import { renderPlaceableOverlays } from "@/player/playScenePlaceables";
import { createBlankProject } from "@/project/defaults";
import { serialize, deserialize } from "@/project/io";
import { startSession } from "@/project/session";
import { store } from "@/project/store";

const CLOUD = "easyrpg-picture-cloud";
const CLOUD_PATH = "assets/easyrpg/picture/Cloud.png";
const CHARSET = "tex_easyrpg_charset_object1";

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

function stripCloudProfiles(project) {
  project.resourceProfiles = project.resourceProfiles.filter((profile) => profile.assetId !== CLOUD);
  return project;
}

function profileHasCloud(project) {
  return project.resourceProfiles.some((profile) => profile.assetId === CLOUD);
}

function itemId(project) {
  const id = project.database.items?.[0]?.id;
  if (!id) throw new Error("blank project has no items");
  return id;
}

function withDecoration(project, options = {}) {
  project.database.homeDecorationTypes = [{
    id: "rug",
    name: "Rug",
    placementItemId: itemId(project),
    footprint: { width: 1, height: 1 },
    blocksMovement: false,
    allowedOrientations: ["down", "left", "right", "up"],
    graphicResourceId: options.orientationOnly ? CHARSET : CLOUD,
    ...(options.orientationOnly ? { orientationGraphicResourceIds: { left: CLOUD } } : {}),
  }];
  return project;
}

function withBuildingLevels(project) {
  project.database.farmBuildingTypes = [{
    id: "shed",
    name: "Shed",
    levels: [
      { level: 1, footprint: { width: 1, height: 1 }, capacity: 1, graphicResourceId: CHARSET },
      { level: 2, footprint: { width: 2, height: 1 }, capacity: 2, graphicResourceId: CLOUD },
    ],
  }];
  return project;
}

function decorationReferenced(options = {}) {
  return withDecoration(stripCloudProfiles(createBlankProject()), options);
}

function buildingLevelTwoReferenced() {
  return withBuildingLevels(stripCloudProfiles(createBlankProject()));
}

function zipHasCloud(project) {
  return collectWebExportAssets(project).some((asset) => asset.zipPath === CLOUD_PATH);
}

function loadHasCloud(project) {
  const { scene, images } = fakeLoadScene();
  loadBundledAssets(scene, project);
  return images.some((image) => image.key === CLOUD && image.url === CLOUD_PATH);
}

const blank = createBlankProject();
const blankStripped = stripCloudProfiles(createBlankProject());
const decorationStripped = decorationReferenced();
const orientationStripped = decorationReferenced({ orientationOnly: true });
const buildingStripped = buildingLevelTwoReferenced();

let roundTrip = null;
let roundTripError = null;
try {
  roundTrip = deserialize(serialize(decorationStripped));
} catch (error) {
  roundTripError = String(error?.stack ?? error);
}

let prepared = null;
let preparedError = null;
try {
  prepared = prepareWebExport(decorationStripped);
} catch (error) {
  preparedError = String(error?.stack ?? error);
}

const overlayProject = decorationReferenced();
const session = startSession(overlayProject, 45);
session.homeDecorationPlacements = {
  rug1: {
    instanceId: "rug1",
    typeId: "rug",
    mapId: overlayProject.startMapId,
    x: 4,
    y: 5,
    orientation: "down",
  },
};
store.replaceProject(overlayProject);
const overlayCalls = [];
renderPlaceableOverlays({
  map: overlayProject.maps[overlayProject.startMapId],
  session,
  tileLayer: { add() {} },
  add: {
    sprite: (...args) => {
      overlayCalls.push(args);
      return { setOrigin() {}, setDisplaySize() {}, setDepth() {} };
    },
  },
});

const report = {
  criterion: "export-evidence-rereview1",
  originalFailureUnchanged: {
    files: ["export-decoration.json", "commands.json", "check-export-decoration.mjs"],
    ok: false,
    exit: 1,
    cause: "extra assertion blankHasCloud === false contradicted default resourceProfiles image-catalog export",
  },
  catalog: {
    onlyPicture: EASYRPG_PICTURE_ASSETS.map((asset) => ({ id: asset.id, path: asset.path })),
    runtimeInventoryIncludesCloud: PLAYER_RUNTIME_ASSET_PATHS.includes(CLOUD_PATH),
  },
  schema: {
    note: "validateResourceProfiles requires kind+name only. collectResourceIds always includes EASYRPG_RTP_ASSETS, so Cloud graphicResourceId remains a known id without a profile row. ensureBundledResourceProfiles is editor store normalize, not deserialize.",
    deserializeSerializeWithoutCloudProfile: roundTripError === null,
    roundTripError,
    roundTripStillOmitsCloudProfile: roundTrip ? profileHasCloud(roundTrip) === false : null,
    roundTripExportIncludesCloud: roundTrip ? zipHasCloud(roundTrip) : null,
  },
  phaserPreload: {
    policy: "blank must not load unreferenced Cloud",
    blankDefaultDoesNotLoadCloud: loadHasCloud(blank) === false,
    blankStrippedDoesNotLoadCloud: loadHasCloud(blankStripped) === false,
    decorationStrippedLoadsCloud: loadHasCloud(decorationStripped) === true,
    orientationStrippedLoadsCloud: loadHasCloud(orientationStripped) === true,
    buildingLevelTwoStrippedLoadsCloud: loadHasCloud(buildingStripped) === true,
  },
  exportProfiles: {
    policy: "blank may export Cloud via default image resourceProfiles",
    blankDefaultMayExportCloud: zipHasCloud(blank) === true,
    blankStrippedDoesNotExportCloud: zipHasCloud(blankStripped) === false,
  },
  exportReferencedWithoutProfileFallback: {
    decorationStrippedProfileHasCloud: profileHasCloud(decorationStripped),
    decorationStrippedExportsCloud: zipHasCloud(decorationStripped),
    orientationStrippedExportsCloud: zipHasCloud(orientationStripped),
    buildingLevelTwoStrippedExportsCloud: zipHasCloud(buildingStripped),
    prepareWebExportError: preparedError,
    prepareWebExportStillOmitsCloudProfile: prepared ? profileHasCloud(prepared.project) === false : null,
    prepareWebExportIncludesCloud: prepared ? zipHasCloud(prepared.project) : null,
  },
  resolve: {
    spatial: resolveSpatialGraphicTexture(decorationStripped, CLOUD),
    event: resolveEventSpriteTexture(decorationStripped, CLOUD, 0),
    overlayTextureKeys: overlayCalls.map((args) => args[2]),
  },
};

const ok = report.catalog.runtimeInventoryIncludesCloud === false
  && report.schema.deserializeSerializeWithoutCloudProfile
  && report.schema.roundTripStillOmitsCloudProfile
  && report.schema.roundTripExportIncludesCloud
  && report.phaserPreload.blankDefaultDoesNotLoadCloud
  && report.phaserPreload.blankStrippedDoesNotLoadCloud
  && report.phaserPreload.decorationStrippedLoadsCloud
  && report.phaserPreload.orientationStrippedLoadsCloud
  && report.phaserPreload.buildingLevelTwoStrippedLoadsCloud
  && report.exportProfiles.blankDefaultMayExportCloud
  && report.exportProfiles.blankStrippedDoesNotExportCloud
  && report.exportReferencedWithoutProfileFallback.decorationStrippedProfileHasCloud === false
  && report.exportReferencedWithoutProfileFallback.decorationStrippedExportsCloud
  && report.exportReferencedWithoutProfileFallback.orientationStrippedExportsCloud
  && report.exportReferencedWithoutProfileFallback.buildingLevelTwoStrippedExportsCloud
  && preparedError === null
  && report.exportReferencedWithoutProfileFallback.prepareWebExportStillOmitsCloudProfile
  && report.exportReferencedWithoutProfileFallback.prepareWebExportIncludesCloud
  && report.resolve.spatial?.texture === CLOUD
  && report.resolve.event === null
  && report.resolve.overlayTextureKeys[0] === CLOUD;

report.ok = ok;
const out = process.env.REVIEW_OUT || "/dev/shm/st_01a078fa-rereview1/export-rereview1.json";
await writeFile(out, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (!ok) process.exit(1);
