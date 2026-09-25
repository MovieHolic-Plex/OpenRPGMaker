// Shared object catalog sources (build side). scripts/content/build-shared-object-catalog.mjs bundles this entry, renders
// a preview per object and writes src/assets/sharedObjectCatalog.json. The editor 오브젝트 tab and the assistant's
// list_spatial_designs / stamp_object read that manifest.
import { createHeadlessBlankProject, setHeadlessPublicRoot } from "@/headless";
import { preloadRegionReferenceScene, type RegionReferenceScene } from "@/project/regionReferenceImport";
import { AUTHORED_HOUSE_FORM_DEFS } from "@/project/defaults/authoredHouseFormCatalog";
import { OUTDOOR_OBJECT_CATALOG } from "@/project/defaults/spatial/outdoorObjectCatalog";
import sharedObjectIndex from "@/assets/sharedObjectIndex.json";
import type { Project, TilesetDef } from "@/project/types";
import { BUNDLED_IMAGE_ASSETS } from "@/assets/bundled";

/** Bundled texture key → public path, for previews. */
export const TEXTURE_PATHS: Record<string, string> = Object.fromEntries(BUNDLED_IMAGE_ASSETS.map(asset => [asset.textureKey, asset.path]));

export type Category = "tree" | "volcano" | "gate" | "terrain" | "harbor" | "house" | "prop" | "furniture" | "vehicle" | "landmark";
/** Categories a `tiledata/<pipeline>/shared-objects.json` entry may use. */
export const TILEDATA_CATEGORIES: readonly Category[] = ["house", "gate", "prop", "terrain", "harbor", "tree", "volcano", "furniture", "vehicle", "landmark"];
export type Source =
  | { kind: "tileset"; tilesetId: string }
  | { kind: "place-kit"; referenceId: string; kitId: string }
  | { kind: "place-rect"; referenceId: string; rect: { x: number; y: number; width: number; height: number } };
export interface BuiltObject {
  id: string; name: string; category: Category; tags: string[]; owner: string;
  tilesetId: string; source: Source; width: number; height: number;
  lower: number[]; upper: number[]; defaultLayers: "both" | "upper" | "lower";
  /** Tileset whose numbers `lower`/`upper` use (grafts + passability), for previews and passability. */
  sourceTileset: TilesetDef;
  assets: Project["assets"]["uploaded"];
  /** Map the object was cut from (tiledata entries). */
  sourceMap?: string;
}

/**
 * One entry of `tiledata/<pipeline>/shared-objects.json` (공통 지침 형식). `id` is `<분야>/<kebab>`; the catalog id
 * becomes `obj:<category>/<분야>/<kebab>`. Cells use the numbering of the **bundled** tileset `tilesetId` (not a
 * shared_ copy); -1 leaves the map cell.
 */
export interface TiledataObjectEntry {
  id: string; name: string; category: string; tags?: string[]; tilesetId: string;
  width: number; height: number; lower: number[]; upper: number[]; owner: string;
  sourceMap?: string; defaultLayers?: "both" | "upper" | "lower";
}
/** Parsed file, `file` relative to the repo root (for error messages and the source tag). */
export interface TiledataObjectFile { file: string; pipeline: string; objects: TiledataObjectEntry[] }

const kitPattern = (kit: NonNullable<TilesetDef["structureKits"]>[number]) => ({
  width: kit.width, height: kit.height,
  lower: kit.rows.flatMap(row => [...row.tiles]),
  upper: kit.rows.flatMap(row => [...(row.upperTiles ?? new Array(kit.width).fill(-1))]),
});

// ── 주인 규칙(어디 곁에 두나) ──────────────────────────────────────────────
const TREE_OWNER = "기후 맵 빈 땅에 덩이로 — 큰·중간 1그루 + 곁나무 1~2그루 + 밑동 옆 바위·마른 덤불. 길·문·집에서 2칸 띄우고, 맵 가장자리 한 줄에 일렬로 세우지 않는다.";
const SHRUB_OWNER = "고목 밑동 옆에 1~2개. 빈 땅에 낱개로 흩뿌리지 않는다.";
/** The user does not want these in default desert dressing (climate maps keep them off too); stamp only on request. */
const REQUEST_ONLY = new Set(["mesa", "bones"]);
const TERRAIN_OWNER: Record<string, string> = {
  sulfur: "용암 균열·웅덩이·분기공 곁에만 — 빈 재 한가운데에 두지 않는다.",
  obsidian: "용암 균열 위나 바로 곁에 드물게 하나.",
  "ash-heap": "균열 끝이나 분기공 곁에 드물게.",
  fumarole: "작은 용암 웅덩이 곁에 한두 개(연기 2프레임), 유황 얼룩과 함께.",
  basalt: "화산 빈 땅에 한 무리 — 용암 판·웅덩이 곁. 길·입구에서 2칸.",
  cactus: "사막 모래 위 3~4곳에 2~3개씩 덩이로. 물·길·문에서 떨어져.",
  bones: "사용자가 짐승 뼈를 직접 요청했을 때만 찍는다 — 사막 기본 꾸밈에 넣지 않는다(기후 맵도 기본 꺼짐).",
  "buried-column": "길 없는 외딴 모래 한두 곳에만, 드물게. 짐승 뼈는 곁들이지 않는다(요청 시에만).",
  dune: "사막 빈 땅·가장자리 띠에 여러 개를 이어서 사구 바다처럼. 길·집 곁은 비운다.",
  mesa: "사용자가 메사·바위 언덕을 직접 요청했을 때만 찍는다 — 사막 기본 꾸밈에 넣지 않는다(기후 맵도 기본 꺼짐).",
  ripple: "빈 모래 바닥의 물결 변형 — 넓은 빈칸을 끊어 줄 때만, 길·집 곁 아님.",
  "lava-pool": "화산 빈 재 땅에 한두 곳 — 분기공·유황 얼룩을 곁에. 길·다리에서 2칸.",
  "lava-plate": "용암 강·웅덩이 가장자리를 따라 띠처럼. 3×3 이상 덩이로.",
};
const VILLAGE_PROP_OWNER: [RegExp, string][] = [
  [/우물/, "광장이나 집 사이 길가 — 둘레 한 칸은 걸을 수 있게."],
  [/게시판|표지판|팻말/, "길 갈림목·마을 입구·광장 가장자리."],
  [/등불|돌등|돌기둥|lamp/, "길가·문 곁·다리 끝에 간격을 두고."],
  [/채소밭|허수아비|씨앗|옥수수|토마토|텃밭/, "밭 안이나 밭 곁 — 집 뒤 마당."],
  [/빨랫줄/, "집 옆 마당 — 문 앞을 막지 않게."],
  [/꽃 화단|꽃 덤불|화분|약초/, "집 앞 마당·창 아래에 한두 개."],
  [/새집/, "나무 곁이나 집 벽 곁."],
  [/바구니|통|상자|자루|포대|장작|짐|짚단|건초/, "집 앞·가게 앞·창고 곁에 한 덩이로 붙여서."],
  [/아치/, "정원·마당 입구 길 위."],
  [/징검돌/, "물가나 풀밭을 가로지르는 길 대신."],
  [/울타리|난간/, "밭·마당 둘레 — 길과 문 칸은 비운다."],
  [/벤치/, "광장 가장자리·길가 나무 아래."],
  [/다리|계단|선착장|부두/, "물·단차를 건너는 길 위 — 양끝이 땅·길과 이어지게."],
  [/성문/, "성·마을 입구 길 끝, 양옆은 담으로."],
  [/나무|수목|소나무|활엽수|침엽수|그루터기|덤불/, "마을 가장자리·숲 가에 덩이로, 길·문 곁은 비운다."],
  [/바위|돌무더기|석상/, "들판·숲 가에 덩이로 — 길 한가운데·문 앞 금지."],
  [/버섯|갈대|들꽃|풀/, "숲 가·물가 풀밭에 작은 무리로."],
];
function propOwner(name: string): string {
  return VILLAGE_PROP_OWNER.find(([re]) => re.test(name))?.[1] ?? "마을 안 쓰임새에 맞는 자리 — 길·문 앞을 막지 않게.";
}
const HOUSE_OWNER = "마을 집터 — 문 칸 앞이 길로 이어지게 둔다. 외형만 찍히므로 문 이벤트·실내는 author_house 나 place_door 로.";
const GENERATED_OWNER: Record<string, string> = {
  gatehouse: "마을 입구 길 끝 — 문 칸이 안팎 길과 이어지게, 양옆은 담·숲으로 막는다.",
  watchtower: "마을 가장자리·입구 곁 높은 자리에 하나.",
  magetower: "마을 외곽 한 자리 — 광장에서 떨어진 곳.",
  windmill: "밭 곁 트인 곳에 하나.",
  watermill: "강·수로 곁 — 물레가 물에 닿게.",
  coop: "농가 마당 곁.",
  barn: "밭 곁·농가 뒤.",
  chapel: "광장 가까이 한 자리.",
  smithy: "마을 입구 쪽 길가.",
  inn: "광장이나 큰길 가.",
  shop: "광장·큰길 가.",
  guild: "광장이나 큰길 가.",
};

// ── 모으기 ───────────────────────────────────────────────────────────────
export async function collectSharedObjects(publicDir: string, tiledataFiles: readonly TiledataObjectFile[] = []): Promise<BuiltObject[]> {
  setHeadlessPublicRoot(publicDir);
  const project = createHeadlessBlankProject();
  const ts = (id: string) => {
    const tileset = project.tilesets[id];
    if (!tileset) throw new Error(`new project lacks tileset ${id}`);
    return tileset;
  };
  const out: BuiltObject[] = [];
  const push = (entry: Omit<BuiltObject, "assets"> & { assets?: BuiltObject["assets"] }) => out.push({ assets: {}, ...entry });

  // (1) 잎 없는 고목 — 기후 타일셋마다.
  const climateName: Record<string, string> = { forest_harmony_snow: "설원", forest_harmony_volcano: "화산", forest_harmony_desert: "사막" };
  for (const tilesetId of Object.keys(climateName)) {
    const tileset = ts(tilesetId);
    for (const group of tileset.tileGroups ?? []) {
      if (!group.id.startsWith("bare-trees:") || !group.previewMap) continue;
      const key = group.id.slice("bare-trees:".length);
      const shrub = key.startsWith("shrub");
      push({ id: `obj:tree/${tilesetId.replace("forest_harmony_", "")}/${key}`, name: `${climateName[tilesetId]} · ${group.name}`, category: "tree",
        tags: ["잎 없는 나무", "고목", climateName[tilesetId]!, shrub ? "마른 덤불" : key.split("-")[0]!, group.id], owner: shrub ? SHRUB_OWNER : TREE_OWNER,
        tilesetId, source: { kind: "tileset", tilesetId }, width: group.previewMap.width, height: group.previewMap.height,
        lower: group.previewMap.lowerTiles.map(t => t === 240 ? -1 : t), upper: [...group.previewMap.upperTiles], defaultLayers: "both", sourceTileset: tileset });
    }
  }

  // (2) 화산 봉우리.
  const volcano = ts("forest_harmony_volcano");
  const peak = (id: string, name: string, width: number, upper: number[], tags: string[]) => push({ id, name, category: "volcano", tags: ["화산", "봉우리", ...tags],
    owner: "화산 맵의 맨 재(240) 땅 위 — 둘레 한 칸을 비우고 입구·길·문에서 6칸 이상. 통행 불가.",
    tilesetId: volcano.id, source: { kind: "tileset", tilesetId: volcano.id }, width, height: 2, lower: new Array(width * 2).fill(-1), upper, defaultLayers: "upper", sourceTileset: volcano });
  peak("obj:volcano/peak-dormant", "잠든 화산 봉우리", 2, [858, 859, 888, 889], ["잠든"]);
  peak("obj:volcano/peak-erupting", "분화하는 화산 봉우리", 2, [918, 919, 948, 949], ["분화", "용암"]);
  peak("obj:volcano/peak-pair", "화산 봉우리 한 쌍(잠든·분화)", 4, [858, 859, 918, 919, 888, 889, 948, 949], ["잠든", "분화", "쌍"]);

  // (4) 기후 지형 부품(3030~, #1489).
  for (const tilesetId of ["forest_harmony_volcano", "forest_harmony_desert"]) {
    const tileset = ts(tilesetId);
    for (const group of tileset.tileGroups ?? []) {
      if (!group.id.startsWith("climate-terrain:") || !group.previewMap) continue;
      const key = group.id.slice("climate-terrain:".length);
      const kind = Object.keys(TERRAIN_OWNER).find(k => key.startsWith(k)) ?? key;
      push({ id: `obj:terrain/${tilesetId.replace("forest_harmony_", "")}/${key}`, name: group.name, category: "terrain",
        tags: [climateName[tilesetId]!, "기후 지형", group.name.split("·").pop()!.trim().replace(/ [a-z0-9-]+$/, ""), group.id, ...(REQUEST_ONLY.has(kind) ? ["요청 시에만"] : [])],
        owner: TERRAIN_OWNER[kind] ?? "기후 맵 빈 땅에 덩이로.", tilesetId, source: { kind: "tileset", tilesetId },
        width: group.previewMap.width, height: group.previewMap.height,
        lower: group.previewMap.lowerTiles.map(t => t === 240 ? -1 : t), upper: [...group.previewMap.upperTiles], defaultLayers: "both", sourceTileset: tileset });
    }
  }
  // Lava pool / cooled plate from the volcano autotiles (47-blob masks).
  const blob = (autotileId: string, rows: string[]) => {
    const group = volcano.autotileGroups?.find(g => g.id === autotileId);
    if (!group) return null;
    const h = rows.length, w = rows[0]!.length, inside = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && rows[y]![x] === "#";
    const lower: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) { lower.push(-1); continue; }
      const n = inside(x, y - 1), e = inside(x + 1, y), s = inside(x, y + 1), wv = inside(x - 1, y);
      const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (wv ? 8 : 0)
        | (n && e && inside(x + 1, y - 1) ? 16 : 0) | (s && e && inside(x + 1, y + 1) ? 32 : 0)
        | (s && wv && inside(x - 1, y + 1) ? 64 : 0) | (n && wv && inside(x - 1, y - 1) ? 128 : 0);
      lower.push(group.variantMap[String(mask)] ?? group.variantMap["255"]!);
    }
    return { w, h, lower };
  };
  const pool = blob("volcano_lava_pool_47", [".##.", "####", "####", ".##."]);
  if (pool) push({ id: "obj:terrain/volcano/lava-pool", name: "화산 지형 · 작은 용암 웅덩이", category: "terrain", tags: ["화산", "기후 지형", "용암 웅덩이", "용암"],
    owner: TERRAIN_OWNER["lava-pool"]!, tilesetId: volcano.id, source: { kind: "tileset", tilesetId: volcano.id }, width: pool.w, height: pool.h,
    lower: pool.lower, upper: new Array(pool.w * pool.h).fill(-1), defaultLayers: "lower", sourceTileset: volcano });
  const plate = blob("volcano_lava_plate_47", ["###.", "####", ".###"]);
  if (plate) push({ id: "obj:terrain/volcano/lava-plate", name: "화산 지형 · 식은 용암 판", category: "terrain", tags: ["화산", "기후 지형", "용암 판", "현무암"],
    owner: TERRAIN_OWNER["lava-plate"]!, tilesetId: volcano.id, source: { kind: "tileset", tilesetId: volcano.id }, width: plate.w, height: plate.h,
    lower: plate.lower, upper: new Array(plate.w * plate.h).fill(-1), defaultLayers: "lower", sourceTileset: volcano });

  // (5) 항구 부품 — 숲마을 이식 칸(harbor-kit, 2657~2722).
  const forest = ts("forest_harmony");
  const boat = [2657, 2658, 2659, 2660, 2661, 2662, 2663, 2664, 2665, 2666, 2667, 2668, 2669, 2695, 2696, 2697, 2698, 2699, 2703, 2704, 2705, 2706, 2707, 2708, 2709, 2710, 2711, 2712, 2713, 2714, 2715, 2716];
  const harbor = (id: string, name: string, width: number, height: number, upper: number[], tags: string[], owner: string) => push({ id, name, category: "harbor", tags: ["항구", ...tags],
    owner, tilesetId: forest.id, source: { kind: "tileset", tilesetId: forest.id }, width, height, lower: new Array(width * height).fill(-1), upper, defaultLayers: "upper", sourceTileset: forest });
  harbor("obj:harbor/rowboat", "나룻배(뱃머리 왼쪽, 8×4)", 8, 4, boat, ["배", "나룻배", "물"], "부두 바다 쪽 끝 옆 물 위에 한 칸 띄워 댄다 — 물 위 윗레이어, 통행 불가.");
  harbor("obj:harbor/mooring-post", "계류 말뚝", 1, 1, [2717], ["말뚝", "계류"], "부두 가장자리 물 칸에 3~4칸 간격으로.");
  harbor("obj:harbor/rope-anchor", "감긴 밧줄과 닻", 2, 1, [2718, 2719], ["밧줄", "닻", "짐"], "부두 뿌리 땅에 짐 더미와 한 덩이로.");
  harbor("obj:harbor/cargo", "부두 짐 더미(오크통·상자·열린 통)", 3, 1, [2720, 2721, 2722], ["짐", "오크통", "나무 상자"], "부두 뿌리 땅에 한 덩이로 붙여 모은다 — 들판 한가운데 금지.");
  harbor("obj:harbor/cargo-pile", "부두 짐 무더기(2×2)", 2, 2, [2720, 2721, 2718, 2722], ["짐", "오크통", "밧줄"], "부두 뿌리 땅에 한 덩이로 붙여 모은다 — 들판 한가운데 금지.");

  // (3)(5)(6) 장소 안 킷 — 생성 건물(fft), 성채 항구.
  const scenes = new Map<string, RegionReferenceScene>();
  for (const kit of (sharedObjectIndex as { refKits: { id: string; name: string; referenceId: string; kitId: string; tilesetId: string }[] }).refKits) {
    let scene = scenes.get(kit.referenceId);
    if (!scene) { scene = await preloadRegionReferenceScene(kit.referenceId); scenes.set(kit.referenceId, scene); }
    const def = scene.tileset.structureKits?.find(k => k.id === kit.kitId);
    if (!def) continue;
    const pattern = kitPattern(def);
    const fft = kit.kitId.startsWith("fft-bp");
    const role = Object.keys(GENERATED_OWNER).find(k => kit.kitId.includes(k));
    const castle = kit.referenceId === "castle-courtyard";
    const category: Category = role === "gatehouse" ? "gate" : fft ? "house" : castle && /boat|dock|sacks|firewood/.test(kit.kitId) ? "harbor" : "prop";
    const name = kit.name;
    push({ id: `obj:${category}/${kit.kitId}`, name, category,
      tags: [fft ? "생성 건물" : castle ? "성채 항구" : "생성 소품", ...(fft ? ["건물 외형"] : []), ...(role === "gatehouse" ? ["문루", "성문"] : [])],
      owner: role ? GENERATED_OWNER[role]! : fft ? HOUSE_OWNER : castle && /boat/.test(kit.kitId) ? "부두 끝 옆 물 위에 댄다(물 위 윗레이어)." : castle && /dock/.test(kit.kitId) ? "물가 — 판자 끝이 물로 나가게, 뿌리는 땅·길과 이어지게." : propOwner(name),
      tilesetId: "forest_harmony", source: { kind: "place-kit", referenceId: kit.referenceId, kitId: kit.kitId },
      width: pattern.width, height: pattern.height, lower: pattern.lower, upper: pattern.upper, defaultLayers: castle && /boat/.test(kit.kitId) ? "upper" : "both",
      sourceTileset: scene.tileset, assets: scene.assets });
  }

  // (6) 저작 집 형태(합본 마을 · ref-walled / ref-castle 박공 집 포함).
  const town = ts("easyrpg_chipset_combined_town");
  for (const form of AUTHORED_HOUSE_FORM_DEFS) {
    push({ id: `obj:house/${form.id}`, name: `건물 외형 · ${form.name}`, category: "house", tags: ["건물 외형", "집", `${form.stories}층`, ...(form.id.startsWith("ref-") ? ["참고 사례"] : [])],
      owner: HOUSE_OWNER, tilesetId: town.id, source: { kind: "tileset", tilesetId: town.id }, width: form.w, height: form.h,
      lower: form.rows.flatMap(row => [...row.tiles]), upper: form.rows.flatMap(row => [...(row.upperTiles ?? new Array(form.w).fill(-1))]), defaultLayers: "both", sourceTileset: town });
  }

  // (7) 마을 소품 — 숲마을 선별 소품(19종, forest_harmony 킷)과 합본 마을 실외 오브젝트(20종).
  for (const kit of forest.structureKits ?? []) {
    if (!kit.id.startsWith("dewbank:")) continue;
    const pattern = kitPattern(kit);
    push({ id: `obj:prop/forest/${kit.id.split(":").pop()}-${kit.id.split(":")[2]}`, name: kit.name ?? kit.id, category: kit.name?.includes("우물") ? "prop" : "prop",
      tags: ["마을 소품", "숲마을"], owner: propOwner(kit.name ?? ""), tilesetId: forest.id, source: { kind: "tileset", tilesetId: forest.id },
      width: pattern.width, height: pattern.height, lower: pattern.lower, upper: pattern.upper, defaultLayers: "both", sourceTileset: forest });
  }
  for (const def of OUTDOOR_OBJECT_CATALOG) {
    const lower = new Array(def.width * def.height).fill(-1), upper = new Array(def.width * def.height).fill(-1);
    for (const cell of def.cells) (cell.layer === "lower" ? lower : upper)[cell.dy * def.width + cell.dx] = cell.tile;
    push({ id: `obj:prop/town/${def.id.replace(/^outdoor-/, "")}`, name: def.label, category: def.id === "outdoor-gate" ? "gate" : "prop",
      tags: ["마을 소품", "합본 마을", ...def.families], owner: propOwner(def.label), tilesetId: town.id, source: { kind: "tileset", tilesetId: town.id },
      width: def.width, height: def.height, lower, upper, defaultLayers: "both", sourceTileset: town });
  }
  // Unique ids (the entries above keep their historical de-duplication suffixes).
  const seen = new Set<string>();
  for (const entry of out) {
    let id = entry.id, n = 2;
    while (seen.has(id)) id = `${entry.id}-${n++}`;
    entry.id = id; seen.add(id);
  }

  // (8) 파이프라인이 뽑은 오브젝트 — tiledata/*/shared-objects.json. Appended after every entry above so the
  // existing ids, order and previews stay as they were. Invalid entries fail the build with every problem listed.
  const problems: string[] = [];
  for (const file of tiledataFiles) {
    file.objects.forEach((entry, index) => {
      const where = `${file.file}[${index}]${entry && typeof entry.id === "string" ? ` ${entry.id}` : ""}`;
      const built = tiledataObject(project, file, entry, where, problems);
      if (!built) return;
      if (seen.has(built.id)) { problems.push(`${where}: 카탈로그 id ${built.id} 가 이미 있다`); return; }
      seen.add(built.id);
      out.push(built);
    });
  }
  if (problems.length) throw new Error(`shared-objects.json 항목 ${problems.length}건이 잘못됐다:\n  ${problems.join("\n  ")}`);
  return out;
}

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

function tiledataObject(project: Project, file: TiledataObjectFile, entry: TiledataObjectEntry, where: string, problems: string[]): BuiltObject | null {
  const before = problems.length;
  const fail = (message: string) => problems.push(`${where}: ${message}`);
  if (!entry || typeof entry !== "object") { fail("객체가 아니다"); return null; }
  if (typeof entry.id !== "string" || !KEBAB_ID.test(entry.id)) fail(`id 는 "<분야>/<kebab>" 여야 한다 (받은 값 ${JSON.stringify(entry.id)})`);
  if (typeof entry.name !== "string" || !entry.name.trim()) fail("name 이 비었다");
  if (typeof entry.owner !== "string" || !entry.owner.trim()) fail("owner(어디 곁에 두는지) 가 비었다");
  if (!TILEDATA_CATEGORIES.includes(entry.category as Category)) fail(`category ${JSON.stringify(entry.category)} 는 ${TILEDATA_CATEGORIES.join("|")} 중 하나여야 한다`);
  if (entry.tags !== undefined && (!Array.isArray(entry.tags) || entry.tags.some(tag => typeof tag !== "string"))) fail("tags 는 문자열 배열이어야 한다");
  if (entry.defaultLayers !== undefined && !["both", "upper", "lower"].includes(entry.defaultLayers)) fail(`defaultLayers ${JSON.stringify(entry.defaultLayers)}`);
  const tileset = typeof entry.tilesetId === "string" ? project.tilesets[entry.tilesetId] : undefined;
  if (!tileset) fail(`tilesetId ${JSON.stringify(entry.tilesetId)} 는 새 프로젝트의 번들 타일셋이 아니다 (shared_ 사본 말고 번들 id)`);
  const { width, height } = entry;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) fail(`width×height ${width}×${height}`);
  const cells = Number.isInteger(width) && Number.isInteger(height) ? width * height : -1;
  for (const layer of ["lower", "upper"] as const) {
    const tiles = entry[layer];
    if (!Array.isArray(tiles) || tiles.length !== cells) { fail(`${layer} 는 길이 ${cells}(width*height) 배열이어야 한다 (받은 길이 ${Array.isArray(tiles) ? tiles.length : "없음"})`); continue; }
    const bad = tiles.find(tile => !Number.isInteger(tile) || tile < -1 || (tileset && tile >= tileset.count));
    if (bad !== undefined) fail(`${layer} 에 ${tileset?.id ?? "?"} 에 없는 칸 번호 ${bad} (count ${tileset?.count ?? "?"})`);
  }
  if (problems.length > before || !tileset) return null;
  if ([...entry.lower, ...entry.upper].every(tile => tile < 0)) { fail("모든 칸이 -1 이다"); return null; }
  const lowerEmpty = entry.lower.every(tile => tile < 0), upperEmpty = entry.upper.every(tile => tile < 0);
  return {
    id: `obj:${entry.category}/${entry.id}`, name: entry.name.trim(), category: entry.category as Category,
    tags: [...new Set([...(entry.tags ?? []), file.pipeline])], owner: entry.owner.trim(),
    tilesetId: tileset.id, source: { kind: "tileset", tilesetId: tileset.id }, width, height,
    lower: [...entry.lower], upper: [...entry.upper],
    defaultLayers: entry.defaultLayers ?? (lowerEmpty ? "upper" : upperEmpty ? "lower" : "both"),
    sourceTileset: tileset, assets: {}, ...(entry.sourceMap ? { sourceMap: entry.sourceMap } : {}),
  };
}
