/** Publish the image-faithful reference board plus reusable castle spatial designs. */
import { loadEnv } from "vite";
import { createCastleReferenceTileset } from "../src/project/defaults/castleReferenceTileset";
import { createCastleStructureKits } from "../src/project/defaults/castleStructureKits";
import { createCastleTileset } from "../src/project/defaults/castleTileset";
import {
  CASTLE_REFERENCE_TILESET_ID,
  CASTLE_REFERENCE_TILESET_TEXTURE_KEY,
  CASTLE_TILESET_ID,
} from "../src/project/defaults/constants";

const PROJECT_ID = process.env.VITE_SUPABASE_PROJECT_ID ?? loadEnv("development", process.cwd(), "").VITE_SUPABASE_PROJECT_ID ?? "";
const env = loadEnv("development", process.cwd(), "");
const baseUrl = (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY ?? "";
const projectId = PROJECT_ID;
const MAP_ID = "map_castle_reference_95_20260919";
const MAP_NAME = "성채 참고 이미지 · 큰 돌다리 제거";
const COMPARISON_MAP_ID = "map_castle_reference_20260919";
const EDITABLE_MAP_ID = "map_castle_editable_20260919";
const REFERENCE_SIZE = 140;
if (!baseUrl || !key || !projectId) throw new Error("Supabase URL/anon key/project id가 필요합니다.");

const readHeaders = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
  "Accept-Profile": "rpg_zzu",
};
const writeHeaders = {
  ...readHeaders,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates,return=representation",
  "Content-Profile": "rpg_zzu",
};

async function loadProject(): Promise<{ row: any; project: any }> {
  const response = await fetch(`${baseUrl}/rest/v1/projects?select=current_json,current_sha256,title&project_id=eq.${encodeURIComponent(projectId)}`, { headers: readHeaders });
  if (!response.ok) throw new Error(`Supabase load ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const rows = await response.json() as any[];
  if (!rows[0]?.current_json) throw new Error(`프로젝트를 찾지 못했습니다: ${projectId}`);
  return { row: rows[0], project: rows[0].current_json };
}

const source = (kind: string, id: string) => ({ kind, id });
const port = (id: string, name: string, x: number, y: number) => ({ id, name, x, y });
const provenance = (sourceId: string) => ({ origin: "ai", sourceId });

function castleObjects(): Record<string, any> {
  const specs = [
    ["gatehouse", "성채 정문 외형", "castle-ref-gatehouse", 5, 9, ["성문", "중앙 건물"]],
    ["roof", "갈색 기와 지붕 단면", "castle-ref-roof-terrace", 4, 2, ["지붕", "옥상"]],
    ["wall", "외곽 성벽 단면", "castle-ref-wall-segment", 4, 2, ["성벽", "회랑"]],
    ["tower", "강변 망루", "castle-ref-watchtower", 3, 9, ["망루", "성벽"]],
    ["bridge", "강변 돌다리", "castle-ref-stone-bridge", 5, 2, ["다리", "수로"]],
    ["waterfall", "북쪽 폭포 절벽", "castle-ref-waterfall", 2, 5, ["폭포", "강"]],
    ["market-stall", "성채 시장 가판대", "castle-ref-market-stall", 3, 3, ["시장", "가판대", "장터"]],
    ["farm-plot", "강변 경작지", "castle-ref-farm-plot", 3, 3, ["밭", "농경지", "작물"]],
    ["tree-landmark", "강변 큰나무", "castle-ref-tree-landmark", 2, 5, ["나무", "숲", "랜드마크"]],
    ["statue", "성채 석상", "castle-ref-statue-plinth", 1, 4, ["석상", "장식", "안뜰"]],
    ["wooden-dock", "강변 나무 선착장", "castle-ref-wooden-dock", 4, 2, ["선착장", "나무", "강"]],
    ["river-boat", "강변 나룻배", "castle-ref-river-boat", 3, 2, ["배", "보트", "수로"]],
  ] as const;
  return Object.fromEntries(specs.map(([slug, name, kitId, ax, ay, tags]) => {
    const id = `castle-reference:object:${slug}`;
    return [id, {
      id,
      name,
      tags: ["성채 참고 이미지", "재사용 오브젝트", ...tags],
      revision: 1,
      provenance: provenance("castle-reference-20260919"),
      graphic: { tilesetId: CASTLE_TILESET_ID, kitId },
      anchors: [port("anchor", "기준점", ax, ay)],
      chips: ["castle", ...tags],
      exteriorStories: 1,
    }];
  }));
}

function castleSpace(objectIds: Record<string, any>): any {
  return {
    id: "castle-reference:space:outer-yard",
    name: "성채 외곽 마당과 강변 회랑",
    tags: ["성채 참고 이미지", "야외", "오브젝트 배치 공간"],
    revision: 1,
    provenance: provenance("castle-reference-20260919"),
    tilesetId: CASTLE_TILESET_ID,
    shape: "rect",
    width: 44,
    height: 36,
    floor: "grass",
    wall: "castle-stone",
    environment: "outdoor",
    floorAreas: [{ kind: "rect", material: "grass", x: 0, y: 0, width: 44, height: 36 }],
    ports: [port("south-gate", "남쪽 정문", 22, 35), port("river-dock", "강변 선착장", 43, 18)],
    objectSlots: [
      ["gatehouse", "gatehouse", 17, 2, true], ["tower-west", "tower", 2, 3, false], ["tower-east", "tower", 36, 3, false],
      ["bridge", "bridge", 34, 18, true], ["waterfall", "waterfall", 40, 0, false],
      ["market-stall", "market-stall", 7, 17, false], ["statue", "statue", 23, 20, false],
    ].map(([id, objectKey, x, y, required]) => ({
      id, objectDesignId: objectIds[`castle-reference:object:${objectKey}`].id,
      quantity: 1, required, placement: { mode: "fixed", x, y },
    })),
  };
}

function castleSpatialLibrary(project: any): void {
  const library = project.spatialAuthoring.library;
  const objects = castleObjects();
  const objectIds = objects;
  const space = castleSpace(objects);
  const fortressId = "castle-reference:place:fortress";
  const riverfrontId = "castle-reference:place:riverfront";
  const marketId = "castle-reference:place:market-square";
  const farmId = "castle-reference:place:south-farm";
  const dockId = "castle-reference:place:river-dock";
  const dockSpaceId = "castle-reference:space:river-dock";
  const farmSpaceId = "castle-reference:space:south-farmland";
  const regionId = "castle-reference:region:river-castle";
  const worldId = "castle-reference:world:kingdom";
  library.objects = { ...library.objects, ...objects };
  library.spaces = {
    ...library.spaces,
    [space.id]: space,
    [dockSpaceId]: {
      id: dockSpaceId, name: "강변 선착장과 나룻배", tags: ["성채 참고 이미지", "야외", "선착장", "배"], revision: 1,
      provenance: provenance("castle-reference-20260919"), tilesetId: CASTLE_TILESET_ID, shape: "rect", width: 20, height: 12,
      floor: "water-edge", wall: "river-bank", environment: "outdoor",
      floorAreas: [{ kind: "rect", material: "water-edge", x: 0, y: 0, width: 20, height: 12 }],
      ports: [port("land", "육지 길", 2, 6), port("water", "강 수면", 18, 6)],
      objectSlots: [
        ["dock", "wooden-dock", 3, 4, true], ["boat", "river-boat", 12, 6, false], ["bridge", "bridge", 0, 1, false],
      ].map(([id, objectKey, x, y, required]) => ({ id, objectDesignId: objectIds[`castle-reference:object:${objectKey}`].id, quantity: 1, required, placement: { mode: "fixed", x, y } })),
    },
    [farmSpaceId]: {
      id: farmSpaceId, name: "남쪽 성채 농경지", tags: ["성채 참고 이미지", "야외", "밭", "작물"], revision: 1,
      provenance: provenance("castle-reference-20260919"), tilesetId: CASTLE_TILESET_ID, shape: "rect", width: 28, height: 18,
      floor: "crop", wall: "grass-edge", environment: "outdoor",
      floorAreas: [{ kind: "rect", material: "crop", x: 0, y: 0, width: 28, height: 18 }],
      ports: [port("road", "남쪽 왕도", 14, 17)],
      objectSlots: [
        ["plot-a", "farm-plot", 2, 2], ["plot-b", "farm-plot", 10, 2], ["tree", "tree-landmark", 21, 3],
      ].map(([id, objectKey, x, y]) => ({ id, objectDesignId: objectIds[`castle-reference:object:${objectKey}`].id, quantity: 1, required: false, placement: { mode: "fixed", x, y } })),
    },
  };
  library.places = {
    ...library.places,
    [fortressId]: {
      id: fortressId, name: "중앙 성채와 안뜰", kind: "facility",
      tags: ["성채 참고 이미지", "장소", "왕궁", "정문"], revision: 1,
      provenance: provenance("castle-reference-20260919"), layout: "manual",
      children: [{ id: "outer-yard", source: source("space", space.id), x: 0, y: 0, level: 0 }],
      ports: [port("entrance", "성채 남문", 22, 35), port("river-side", "강변 회랑", 43, 18)],
      connections: [], exterior: { tilesetId: CASTLE_TILESET_ID, kitId: "castle-ref-gatehouse" },
    },
    [riverfrontId]: {
      id: riverfrontId, name: "폭포와 강변 선착장", kind: "natural",
      tags: ["성채 참고 이미지", "장소", "강", "폭포", "선착장"], revision: 1,
      provenance: provenance("castle-reference-20260919"), layout: "manual", children: [],
      ports: [port("dock", "나무 선착장", 0, 0), port("falls", "북쪽 폭포", 0, 0)], connections: [],
    },
    [marketId]: {
      id: marketId, name: "성문 시장 광장", kind: "facility",
      tags: ["성채 참고 이미지", "장소", "시장", "광장", "가판대"], revision: 1,
      provenance: provenance("castle-reference-20260919"), layout: "manual",
      children: [{ id: "market-yard", source: source("space", space.id), x: 0, y: 0, level: 0 }],
      ports: [port("gate", "성문 방향", 0, 0), port("yard", "안뜰 방향", 20, 18)], connections: [],
      exterior: { tilesetId: CASTLE_TILESET_ID, kitId: "castle-ref-market-stall" },
    },
    [farmId]: {
      id: farmId, name: "남쪽 성채 농경지", kind: "facility",
      tags: ["성채 참고 이미지", "장소", "농경지", "밭", "작물"], revision: 1,
      provenance: provenance("castle-reference-20260919"), layout: "manual",
      children: [{ id: "farmland", source: source("space", farmSpaceId), x: 0, y: 0, level: 0 }],
      ports: [port("road", "남쪽 왕도", 14, 17)], connections: [],
      exterior: { tilesetId: CASTLE_TILESET_ID, kitId: "castle-ref-farm-plot" },
    },
    [dockId]: {
      id: dockId, name: "강변 선착장", kind: "natural",
      tags: ["성채 참고 이미지", "장소", "강", "선착장", "나룻배"], revision: 1,
      provenance: provenance("castle-reference-20260919"), layout: "manual",
      children: [{ id: "dock-yard", source: source("space", dockSpaceId), x: 0, y: 0, level: 0 }],
      ports: [port("land", "강변 길", 2, 6), port("water", "강 수면", 18, 6)], connections: [],
    },
  };
  const fortressSlot = { id: "fortress", source: source("place", fortressId), x: 30, y: 36, level: 0 };
  const riverSlot = { id: "riverfront", source: source("place", riverfrontId), x: 104, y: 38, level: 0 };
  const marketSlot = { id: "market", source: source("place", marketId), x: 20, y: 82, level: 0 };
  const farmSlot = { id: "farm", source: source("place", farmId), x: 28, y: 104, level: 0 };
  const dockSlot = { id: "dock", source: source("place", dockId), x: 86, y: 50, level: 0 };
  library.regions = {
    ...library.regions,
    [regionId]: {
      id: regionId, name: "성채 강변 지역", tags: ["성채参考 이미지", "지역", "강변", "왕국 중심부"], revision: 1,
      provenance: provenance("castle-reference-20260919"),
      terrain: { tilesetId: CASTLE_REFERENCE_TILESET_ID, width: REFERENCE_SIZE, height: REFERENCE_SIZE, floor: "reference", areas: [{ kind: "rect", material: "reference", x: 0, y: 0, width: REFERENCE_SIZE, height: REFERENCE_SIZE }] },
      places: [fortressSlot, riverSlot, marketSlot, farmSlot, dockSlot],
      ports: [port("south-road", "남쪽 왕도", 30, 130), port("north-falls", "북쪽 폭포 길", 104, 8)],
      routes: [
        { id: "fortress-to-river", from: { childId: fortressSlot.id, portId: "river-side" }, to: { childId: riverSlot.id, portId: "dock" }, bidirectional: true, points: [{ x: 30, y: 36 }, { x: 70, y: 36 }, { x: 104, y: 38 }] },
        { id: "fortress-to-market", from: { childId: fortressSlot.id, portId: "entrance" }, to: { childId: marketSlot.id, portId: "gate" }, bidirectional: true, points: [{ x: 30, y: 71 }, { x: 20, y: 82 }] },
        { id: "market-to-farm", from: { childId: marketSlot.id, portId: "yard" }, to: { childId: farmSlot.id, portId: "road" }, bidirectional: true, points: [{ x: 20, y: 100 }, { x: 28, y: 104 }] },
        { id: "dock-to-fortress", from: { childId: dockSlot.id, portId: "land" }, to: { childId: fortressSlot.id, portId: "river-side" }, bidirectional: true, points: [{ x: 86, y: 56 }, { x: 70, y: 50 }, { x: 43, y: 54 }] },
      ],
    },
  };
  library.worlds = {
    ...library.worlds,
    [worldId]: {
      id: worldId, name: "성채 강변 왕국", tags: ["성채 참고 이미지", "세계", "왕국"], revision: 1,
      provenance: provenance("castle-reference-20260919"),
      terrain: { tilesetId: CASTLE_REFERENCE_TILESET_ID, width: REFERENCE_SIZE, height: REFERENCE_SIZE, floor: "reference", areas: [{ kind: "rect", material: "reference", x: 0, y: 0, width: REFERENCE_SIZE, height: REFERENCE_SIZE }] },
      regions: [{ id: "river-castle-region", source: source("region", regionId), x: 70, y: 70, level: 0 }],
      ports: [port("entry", "왕국 입구", 70, 10)], connections: [], entryPort: { childId: null, portId: "entry" },
    },
  };
}

const layoutRegions = [
  { id: "reference-river", role: "river", label: "오른쪽 강과 폭포", x: 84, y: 0, w: 56, h: 140, shape: "rect", tags: ["강", "폭포", "보트"] },
  { id: "reference-fortress", role: "fortress", label: "중앙 성채", x: 10, y: 10, w: 70, h: 116, shape: "rect", tags: ["성벽", "정문", "안뜰"] },
  { id: "reference-courtyard", role: "plaza", label: "성채 중앙 안뜰", x: 24, y: 36, w: 46, h: 42, shape: "rect", tags: ["광장", "오브젝트"] },
  { id: "reference-dock", role: "dock", label: "강변 선착장", x: 74, y: 42, w: 18, h: 16, shape: "rect", tags: ["선착장", "다리"] },
  { id: "reference-south-road", role: "road", label: "남쪽 왕도", x: 16, y: 118, w: 70, h: 20, shape: "path", tags: ["왕도", "남문"] },
];

function locationRows() {
  return layoutRegions.map((region) => ({ id: region.id, name: region.label, x: region.x, y: region.y, w: region.w, h: region.h, note: `참고 이미지 기준 ${region.label}`, tags: region.tags, color: region.role === "river" ? "#28547f" : region.role === "fortress" ? "#7b5b3e" : "#4d7e48" }));
}

const { row, project } = await loadProject();
if (!project.spatialAuthoring) throw new Error("이 프로젝트는 공간 저작이 활성화되어 있지 않습니다.");
project.tilesets[CASTLE_TILESET_ID] = createCastleTileset();
project.tilesets[CASTLE_REFERENCE_TILESET_ID] = createCastleReferenceTileset();
const profiles = project.resourceProfiles ?? (project.resourceProfiles = []);
if (!profiles.some((profile: any) => profile.assetId === CASTLE_REFERENCE_TILESET_TEXTURE_KEY)) profiles.push({ kind: "chipset", name: "성채 참고 이미지 · 큰 돌다리 제거", assetId: CASTLE_REFERENCE_TILESET_TEXTURE_KEY, tileWidth: 16, tileHeight: 16, imageWidth: 2240, imageHeight: 2240 });

const lower = Array.from({ length: REFERENCE_SIZE * REFERENCE_SIZE }, (_, index) => index);
const referenceMap = {
  id: MAP_ID, name: MAP_NAME, width: REFERENCE_SIZE, height: REFERENCE_SIZE,
  tilesetId: CASTLE_REFERENCE_TILESET_ID, tileSize: 16, lowerTiles: lower,
  upperTiles: new Array<number>(REFERENCE_SIZE * REFERENCE_SIZE).fill(-1), events: [],
  locations: locationRows(),
  layoutPlan: { version: 1, kind: "castle-reference", seed: 20260919, generatedAt: "2026-09-19T00:00:00.000Z", regions: layoutRegions, notes: "사용자 참고 이미지의 140×140 16px 격자를 보존한 시각 기준 보드. 실제 편집용 성채 맵은 별도 맵에 있다." },
};
project.maps[MAP_ID] = referenceMap;
const existingComparisonMap = project.maps[COMPARISON_MAP_ID];
if (!project.maps[EDITABLE_MAP_ID] && existingComparisonMap?.tilesetId === CASTLE_TILESET_ID) {
  const editableMap = structuredClone(existingComparisonMap);
  editableMap.id = EDITABLE_MAP_ID;
  editableMap.name = "성채 강변 · 원본 타일 편집 맵";
  project.maps[EDITABLE_MAP_ID] = editableMap;
}
const editableMap = project.maps[EDITABLE_MAP_ID];
if (editableMap) {
  // Keep the editable 16px map visibly tied to the reference: add the smaller
  // market, farm, tree, statue, dock, and boat landmarks around the castle
  // while retaining the original river/keep composition.
  const actualTileXY = (sourceTile: number, subX: number, subY: number): number => {
    const sourceX = sourceTile % 16;
    const sourceY = Math.floor(sourceTile / 16);
    return (sourceY * 2 + subY) * 32 + sourceX * 2 + subX;
  };
  const stampActual32 = (x: number, y: number, sourceTile: number, layer: "lower" | "upper" = "upper"): void => {
    const target = layer === "lower" ? editableMap.lowerTiles : editableMap.upperTiles;
    for (let sy = 0; sy < 2; sy += 1) for (let sx = 0; sx < 2; sx += 1) {
      const tx = x + sx;
      const ty = y + sy;
      if (tx < 0 || ty < 0 || tx >= editableMap.width || ty >= editableMap.height) continue;
      target[ty * editableMap.width + tx] = actualTileXY(sourceTile, sx, sy);
    }
  };
  const fillActual32 = (x: number, y: number, w: number, h: number, sourceTile: number, layer: "lower" | "upper" = "lower"): void => {
    for (let yy = y; yy < y + h; yy += 2) for (let xx = x; xx < x + w; xx += 2) stampActual32(xx, yy, sourceTile, layer);
  };
  fillActual32(4, 4, 8, 8, 194, "lower");
  stampActual32(7, 5, 188, "upper");
  fillActual32(6, 26, 6, 4, 144, "upper");
  stampActual32(11, 27, 219, "upper");
  fillActual32(10, 54, 14, 6, 208, "lower");
  fillActual32(12, 54, 6, 4, 208, "upper");
  stampActual32(22, 53, 188, "upper");
  fillActual32(52, 26, 8, 4, 216, "upper");
  stampActual32(57, 30, 233, "upper");
  stampActual32(45, 36, 219, "upper");
  editableMap.locations = [
    { id: "actual-fortress", name: "중앙 성채", x: 12, y: 8, w: 38, h: 44, note: "실제 성채 타일 배치", tags: ["성벽", "정문"] },
    { id: "actual-river", name: "우측 강", x: 56, y: 0, w: 24, h: 64, note: "실제 물 타일 배치", tags: ["강", "수로"] },
    { id: "actual-bridge", name: "강변 돌다리", x: 48, y: 28, w: 16, h: 6, note: "성채와 강변을 잇는 건널목", tags: ["다리", "길"] },
    { id: "actual-market", name: "성문 시장", x: 4, y: 24, w: 16, h: 10, note: "참고 이미지의 시장 가판대", tags: ["시장", "가판대"] },
    { id: "actual-farm", name: "남쪽 경작지", x: 8, y: 52, w: 28, h: 10, note: "참고 이미지의 작물 밭", tags: ["밭", "작물"] },
    { id: "actual-dock", name: "강변 선착장", x: 52, y: 24, w: 12, h: 10, note: "참고 이미지의 선착장과 배", tags: ["선착장", "배"] },
  ];
  editableMap.layoutPlan = { version: 1, kind: "castle-reference-tile-layout", seed: 20260919, regions: editableMap.locations.map((item: any) => ({ id: item.id, role: item.id.includes("river") ? "river" : item.id.includes("bridge") ? "bridge" : "fortress", label: item.name, x: item.x, y: item.y, w: item.w, h: item.h, tags: item.tags })), notes: "OpenGameArt 성채 참고 이미지의 중앙 성채·우측 강·돌다리 구도를 실제 성채 타일로 재구성한 원본 타일 편집 맵." };
}
const comparisonMap = {
  ...referenceMap,
  id: COMPARISON_MAP_ID,
  name: "성채 강변 · 16구역 비교 기준",
  layoutPlan: {
    ...referenceMap.layoutPlan,
    kind: "castle-reference-16-section-comparison",
    comparisonGrid: Array.from({ length: 16 }, (_, index) => ({
      id: `comparison-${index + 1}`,
      row: Math.floor(index / 4),
      col: index % 4,
      x: (index % 4) * 35,
      y: Math.floor(index / 4) * 35,
      w: 35,
      h: 35,
      similarityTarget: 0.95,
    })),
    notes: "참고 이미지를 4×4, 총 16구역으로 비교하는 기준 맵. 각 구역의 목표 유사도는 95% 이상이다.",
  },
};
project.maps[COMPARISON_MAP_ID] = comparisonMap;
castleSpatialLibrary(project);
for (const mapId of [EDITABLE_MAP_ID, COMPARISON_MAP_ID, MAP_ID]) {
  if (!project.mapTree.children.some((child: any) => child.mapId === mapId)) project.mapTree.children.push({ mapId, children: [] });
}
const expectedSha256 = row.current_sha256;
const publish = await fetch(`${baseUrl}/rest/v1/rpc/publish_spatial_project`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ p_project_id: projectId, p_expected_sha256: expectedSha256, p_project: project, p_operation: "update" }) });
if (!publish.ok) throw new Error(`Supabase publication ${publish.status}: ${(await publish.text()).slice(0, 1200)}`);
const publication = await publish.json() as any;
const acceptedSha256 = publication.sha256 ?? publication[0]?.sha256;
if (!acceptedSha256) throw new Error("publication RPC가 SHA를 반환하지 않았습니다.");
const mirror = await fetch(`${baseUrl}/rest/v1/rpc/sync_spatial_mirrors`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ p_project_id: projectId, p_expected_sha256: acceptedSha256 }) });
if (!mirror.ok) throw new Error(`Supabase mirror sync ${mirror.status}: ${(await mirror.text()).slice(0, 1200)}`);
const verifyResponse = await fetch(`${baseUrl}/rest/v1/projects?select=current_json,current_sha256,map_count,tileset_count&project_id=eq.${encodeURIComponent(projectId)}`, { headers: readHeaders });
if (!verifyResponse.ok) throw new Error(`Supabase verify ${verifyResponse.status}: ${(await verifyResponse.text()).slice(0, 500)}`);
const verified = (await verifyResponse.json() as any[])[0];
const verifiedMap = verified.current_json.maps[MAP_ID];
const verifiedComparisonMap = verified.current_json.maps[COMPARISON_MAP_ID];
const verifiedEditableMap = verified.current_json.maps[EDITABLE_MAP_ID];
const verifiedLibrary = verified.current_json.spatialAuthoring.library;
if (!verifiedMap || verifiedMap.lowerTiles.length !== REFERENCE_SIZE * REFERENCE_SIZE || verifiedMap.tilesetId !== CASTLE_REFERENCE_TILESET_ID) throw new Error("참고 보드 재로드 검증 실패");
if (!verifiedComparisonMap || verifiedComparisonMap.tilesetId !== CASTLE_REFERENCE_TILESET_ID || verifiedComparisonMap.width !== REFERENCE_SIZE || verifiedComparisonMap.height !== REFERENCE_SIZE || verifiedComparisonMap.lowerTiles.length !== REFERENCE_SIZE * REFERENCE_SIZE) throw new Error("16구역 비교 맵 재로드 검증 실패");
if (!verifiedEditableMap || verifiedEditableMap.tilesetId !== CASTLE_TILESET_ID || (verifiedEditableMap.locations?.length ?? 0) < 6) throw new Error("원본 타일 편집 맵 재로드 검증 실패");
for (const [collection, ids] of [
  ["objects", ["gatehouse", "roof", "wall", "tower", "bridge", "waterfall", "market-stall", "farm-plot", "tree-landmark", "statue", "wooden-dock", "river-boat"]],
  ["spaces", ["outer-yard", "river-dock", "south-farmland"]],
  ["places", ["fortress", "riverfront", "market-square", "south-farm", "river-dock"]],
  ["regions", ["river-castle"]],
  ["worlds", ["kingdom"]],
] as const) for (const slug of ids) {
  const id = `castle-reference:${collection === "objects" ? "object" : collection === "spaces" ? "space" : collection.slice(0, -1)}:${slug}`;
  if (!verifiedLibrary[collection][id]) throw new Error(`${collection}.${id} 재로드 검증 실패`);
}
console.log(JSON.stringify({ projectId, mapId: MAP_ID, mapName: MAP_NAME, size: `${REFERENCE_SIZE}x${REFERENCE_SIZE}`, comparisonMapId: COMPARISON_MAP_ID, editableMapId: EDITABLE_MAP_ID, tilesetId: CASTLE_REFERENCE_TILESET_ID, castleObjectCount: Object.keys(verifiedLibrary.objects).filter((id: string) => id.startsWith("castle-reference:")).length, castlePlaceCount: Object.keys(verifiedLibrary.places).filter((id: string) => id.startsWith("castle-reference:")).length, castleRegionCount: Object.keys(verifiedLibrary.regions).filter((id: string) => id.startsWith("castle-reference:")).length, castleWorldCount: Object.keys(verifiedLibrary.worlds).filter((id: string) => id.startsWith("castle-reference:")).length, mapCount: Object.keys(verified.current_json.maps).length, tilesetCount: Object.keys(verified.current_json.tilesets).length, sha256: verified.current_sha256, published: true, mirrorsSynced: true, saved: true, verified: true }, null, 2));
