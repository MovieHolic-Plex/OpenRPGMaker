// 검토된 완성 실내 프리셋(편집기 「장소」 탭 — 버드나무 여관·어부의 집 등)을 실내 설계 도구가 함께 보게 한다.
//
// 실측(2026-09-28): get_concept_facility → place_concept 경로는 개념 꾸러미 템플릿·물건 어휘만 돌려주고,
// reviewedPlaceIndex 의 「공간형태:건물 내부」 36곳은 list_spatial_designs(data.shared)에만 있었다. 실내 요청은
// 그 도구를 거치지 않으므로 AI 가 「여관」을 지을 때 버드나무 여관(3층·18×13/19×14)을 한 번도 보지 못했다.
// 여기서는 요청 시설명·용도에 맞는 프리셋의 층별 크기·출입구·재료·가구 목록(타일 그룹 이름)을 뽑고,
// 첫 예시의 층별 미리보기 PNG 를 모델 입력으로 붙인다. 좌표 배열이나 자동 배치는 주지 않는다.
import { reviewedPlaceIndex, type ReviewedPlaceSummary } from "@/project/defaults/spatial/reviewedPlaceIndex";
import { isBundledReviewedPlace, reviewedPlaceDesign, reviewedPlaceMaps } from "@/project/defaults/spatial/reviewedPlaceCatalog";
import { resolveReferenceImageDataUrl } from "@/project/bundledReferenceImages";
import { sharedPlacePreview } from "@/project/sharedContent";
import type { GameMap, TilesetDef } from "@/project/types";

const INTERIOR_TAG = "공간형태:건물 내부";
const MAX_EXAMPLES = 3;
const MAX_IMAGE_FLOORS = 3;

/** 시설 낱말 → 프리셋의 「용도:」 태그. 이름에 낱말이 없어도 같은 용도의 프리셋을 찾는다. */
const PURPOSE_WORDS: readonly (readonly [RegExp, readonly string[]])[] = [
  [/여관|숙소|숙박|여인숙|주막|객잔|inn|lodg/iu, ["숙박"]],
  [/집|민가|주택|가정|살림|house|home/iu, ["주거", "주택"]],
  [/상점|가게|점포|전당|shop|store/iu, ["상점"]],
  [/길드|조합|회관|guild/iu, ["조합 회관"]],
];

export interface InteriorPresetFloor {
  readonly placeId: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly exits: readonly string[];
  readonly materials: readonly string[];
  readonly objects: readonly string[];
}

export interface InteriorPresetExample {
  readonly id: string;
  readonly name: string;
  readonly purpose: string | null;
  readonly exactName: boolean;
  readonly floors: readonly InteriorPresetFloor[];
  readonly use: string;
}

export interface InteriorPresetContext {
  readonly presetHint: string;
  readonly presetExamples?: readonly InteriorPresetExample[];
  readonly presetCatalog?: readonly string[];
}

const PRESET_HINT = "presetExamples 는 사람이 검토한 완성 실내 프리셋이다. 새 실내를 설계할 때 층 수·층별 크기·출입구·재료·가구 종류와 개수를 "
  + "규모와 밀도의 기준으로 삼아라(첫 예시는 층별 그림이 함께 온다). objects 는 타일 그림 이름이라 plan 에는 vocabulary 의 가장 가까운 id 로 옮긴다. "
  + "사용자가 그 프리셋 이름(예: 버드나무 여관)을 그대로 원하면 새로 설계하지 말고 use 의 import_region_reference 한 번으로 가져온다.";

const fold = (value: string) => value.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");
const coreName = (name: string) => fold(name.split("·")[0] ?? name);
const purposeOf = (place: ReviewedPlaceSummary) => place.tags.find(tag => tag.startsWith("용도:"))?.slice("용도:".length) ?? null;

function interiorPresets(): readonly ReviewedPlaceSummary[] {
  return reviewedPlaceIndex().filter(place => place.tags.includes(INTERIOR_TAG));
}

/** 0 = 무관. 이름 일치 > 용도 태그 > 이름 낱말 일부. */
function presetScore(place: ReviewedPlaceSummary, query: string): number {
  const q = fold(query);
  if (!q) return 0;
  const name = fold(place.name), core = coreName(place.name);
  if (name.includes(q) || (core.length >= 2 && q.includes(core))) return 100;
  const purpose = purposeOf(place);
  if (purpose && PURPOSE_WORDS.some(([pattern, purposes]) => pattern.test(query) && purposes.includes(purpose))) return 50;
  const words = query.split(/[\s,·]+/u).map(fold).filter(word => word.length >= 2);
  return words.some(word => name.includes(word)) ? 30 : 0;
}

function floorSummary(map: GameMap, tileset: TilesetDef): InteriorPresetFloor {
  const counts = new Map<number, number>();
  for (const tile of [...map.lowerTiles, ...map.upperTiles]) if (tile >= 0) counts.set(tile, (counts.get(tile) ?? 0) + 1);
  const materials: string[] = [];
  const objects: string[] = [];
  for (const group of tileset.tileGroups ?? []) {
    if (group.tileIds.length === 0) continue;
    const present = group.tileIds.filter(tile => counts.has(tile)).length;
    if (group.role === "terrain" || group.role === "wall") {
      if (present * 2 >= group.tileIds.length) materials.push(group.name);
    } else if (present === group.tileIds.length) {
      // 여러 칸 물건은 가장 적게 쓰인 칸의 횟수가 놓인 개수다.
      const placed = Math.min(...group.tileIds.map(tile => counts.get(tile) ?? 0));
      objects.push(placed > 1 ? `${group.name}×${placed}` : group.name);
    }
  }
  const exits = (reviewedPlaceDesign(map.id)?.ports ?? []).map(port => `${port.name}(${port.x},${port.y})`);
  return { placeId: map.id, name: map.name, width: map.width, height: map.height, exits, materials, objects };
}

const examples = new Map<string, Omit<InteriorPresetExample, "exactName"> | null>();

function presetExample(place: ReviewedPlaceSummary): Omit<InteriorPresetExample, "exactName"> | null {
  const cached = examples.get(place.id);
  if (cached !== undefined) return cached;
  let example: Omit<InteriorPresetExample, "exactName"> | null = null;
  try {
    const floors = reviewedPlaceMaps(place.id).map(({ map, tileset }) => floorSummary(map, tileset));
    if (floors.length > 0) {
      example = { id: `reviewed:${place.id}`, name: place.name, purpose: purposeOf(place), floors,
        use: `import_region_reference({id:'reviewed:${place.id}'}) — 이 프리셋 그대로 가져올 때만` };
    }
  } catch {
    // 래스터가 빠진 프리셋은 예시에서 뺀다 — 설계 도구 자체를 실패시키지 않는다.
  }
  examples.set(place.id, example);
  return example;
}

/** get_concept_facility 가 함께 돌려주는 프리셋 문맥. 맞는 예시가 없으면 이름 목록만 준다. */
export function interiorPresetContext(query: string): InteriorPresetContext {
  const presets = interiorPresets();
  if (presets.length === 0) return { presetHint: PRESET_HINT, presetCatalog: [] };
  const ranked = presets.map((place, index) => ({ place, index, score: presetScore(place, query) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const found: InteriorPresetExample[] = [];
  for (const { place, score } of ranked) {
    if (found.length >= MAX_EXAMPLES) break;
    const example = presetExample(place);
    if (example) found.push({ ...example, exactName: score >= 100 });
  }
  if (found.length === 0) return { presetHint: PRESET_HINT, presetCatalog: presets.map(place => place.name) };
  return { presetHint: PRESET_HINT, presetExamples: found };
}

function previewSource(placeId: string): string | undefined {
  const shared = sharedPlacePreview(placeId);
  if (shared?.startsWith("data:image/")) return shared;
  return isBundledReviewedPlace(placeId) ? `/assets/reviewed-places/${placeId}.png` : undefined;
}

/** 첫 예시의 층별 미리보기 PNG — 모델이 숫자 목록이 아니라 실제 배치를 본다. 못 읽은 그림은 건너뛴다. */
export async function interiorPresetImages(data: unknown): Promise<{ dataUrl: string; label: string }[]> {
  const first = (data as { presetExamples?: readonly InteriorPresetExample[] } | undefined)?.presetExamples?.[0];
  if (!first) return [];
  const images: { dataUrl: string; label: string }[] = [];
  for (const floor of first.floors.slice(0, MAX_IMAGE_FLOORS)) {
    const source = previewSource(floor.placeId);
    if (!source) continue;
    try {
      images.push({ dataUrl: await resolveReferenceImageDataUrl(source), label: `프리셋 「${first.name}」 · ${floor.name} (${floor.width}×${floor.height})` });
    } catch {
      // 그림 없이도 크기·가구 목록은 텍스트로 남는다.
    }
  }
  return images;
}
