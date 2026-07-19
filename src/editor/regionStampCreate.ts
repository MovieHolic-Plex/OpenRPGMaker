// 영역 → 스탬프 변환 + 저장 오케스트레이션.
// regionTaskModal 의 [스탬프로 만들기] 보조 동작이 호출한다.
// - extractSectionKitFromRegion / defaultStampName / isRegionEmpty 는 순수 함수(유닛 테스트).
// - saveRegionAsStamp 는 store + editorState + toast 를 묶은 오케스트레이션.
import { editorState } from "@/editor/editorState";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type {
  GameMap,
  MapId,
  Project,
  SectionStructureKitDef,
  StructureKitDef,
  TilesetDef,
} from "@/project/types";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { paletteStampFromKit } from "@/editor/harnessSuggestion/structureKitModel";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

/** 스탬프로 만들기 클릭 시 영역 직사각형 → SectionStructureKitDef. 순수 함수.
 * 맵/타일셋이 없거나 영역이 맵 밖이면 null. upperTiles 는 행 단위로,
 * 모든 셀이 비어 있으면 생략(직렬화 최소화 — structureKitFromPattern 규약과 동일). */
export function extractSectionKitFromRegion(
  project: Project,
  mapId: MapId,
  region: RegionRect,
  options: { readonly id?: string; readonly name?: string } = {},
): SectionStructureKitDef | null {
  const map = project.maps[mapId];
  if (!map) return null;
  if (region.width <= 0 || region.height <= 0) return null;
  if (region.x < 0 || region.y < 0) return null;
  if (region.x + region.width > map.width || region.y + region.height > map.height) return null;

  const rows = [];
  for (let r = 0; r < region.height; r += 1) {
    const tiles: number[] = [];
    const upperTiles: number[] = [];
    let hasUpper = false;
    for (let c = 0; c < region.width; c += 1) {
      const mapIndex = (region.y + r) * map.width + (region.x + c);
      const lower = map.lowerTiles[mapIndex] ?? TILE.EMPTY;
      tiles.push(lower);
      const upper = map.upperTiles[mapIndex] ?? TILE.EMPTY;
      upperTiles.push(upper);
      if (upper !== TILE.EMPTY) hasUpper = true;
    }
    rows.push(hasUpper ? { tiles, upperTiles } : { tiles });
  }

  return {
    id: options.id ?? genId("kit"),
    kind: "section",
    name: options.name,
    width: region.width,
    height: region.height,
    rows,
    learnedFrom: "user-paint",
    createdAt: new Date().toISOString(),
  };
}

/** 빈 영역 여부 — 모든 셀이 lower=EMPTY 이고 upper=EMPTY 면 저장 의미 없음. */
export function isRegionEmpty(map: GameMap, region: RegionRect): boolean {
  if (region.width <= 0 || region.height <= 0) return true;
  if (region.x < 0 || region.y < 0) return true;
  if (region.x + region.width > map.width || region.y + region.height > map.height) return true;
  for (let r = 0; r < region.height; r += 1) {
    for (let c = 0; c < region.width; c += 1) {
      const mapIndex = (region.y + r) * map.width + (region.x + c);
      const lower = map.lowerTiles[mapIndex] ?? TILE.EMPTY;
      const upper = map.upperTiles[mapIndex] ?? TILE.EMPTY;
      if (lower !== TILE.EMPTY || upper !== TILE.EMPTY) return false;
    }
  }
  return true;
}

/** 자동 이름: 스탬프 {w}×{h} #{N}. N = user-paint 킷 수+1.
 * 사용자는 "내 스탬프" 선반에서 나중에 이름 변경 가능. */
export function defaultStampName(tileset: TilesetDef | undefined, region: RegionRect): string {
  const userPaintCount = (tileset?.structureKits ?? []).filter(
    (kit) => kit.learnedFrom === "user-paint",
  ).length;
  return `스탬프 ${region.width}×${region.height} #${userPaintCount + 1}`;
}

/** 큰 영역 경고 임계값 — 초과해도 진행하지만 토스트로 안내. */
export const STAMP_SIZE_WARN_LIMIT = 32;

export interface SaveRegionAsStampArgs {
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly name: string;
}

export interface SaveRegionAsStampResult {
  readonly ok: true;
  readonly kit: StructureKitDef;
}

/** 모달 [스탬프로 만들기] → Enter 시 호출. 저장 + 브러시 활성화 + 토스트.
 * 실패(맵/타일셋 없음, 빈 영역, 빈 이름)시 토스트 후 null 반환. */
export function saveRegionAsStamp(
  args: SaveRegionAsStampArgs,
): SaveRegionAsStampResult | null {
  const name = args.name.trim();
  if (!name) {
    toast("스탬프 이름을 입력하세요.", "error");
    return null;
  }
  const project = store.getCurrent();
  const map = project.maps[args.mapId];
  if (!map) {
    toast("대상 맵을 찾을 수 없습니다.", "error");
    return null;
  }
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) {
    toast("대상 타일셋을 찾을 수 없습니다.", "error");
    return null;
  }
  if (isRegionEmpty(map, args.region)) {
    toast("영역이 비어 있습니다. 타일을 그린 뒤 스탬프로 만드세요.", "error");
    return null;
  }
  const kit = extractSectionKitFromRegion(project, args.mapId, args.region, { name });
  if (!kit) {
    toast("영역이 맵 밖이거나 올바르지 않습니다.", "error");
    return null;
  }
  if (args.region.width > STAMP_SIZE_WARN_LIMIT || args.region.height > STAMP_SIZE_WARN_LIMIT) {
    toast(`${STAMP_SIZE_WARN_LIMIT}×${STAMP_SIZE_WARN_LIMIT}을(를) 넘는 큰 스탬프입니다. 브러시로 찍기 어려울 수 있습니다.`, "info");
  }
  store.update(
    (draft) => {
      const ts = draft.tilesets[map.tilesetId];
      if (!ts) return;
      ts.structureKits = [...(ts.structureKits ?? []), kit];
    },
    { scope: "database", collection: "tilesets" },
  );
  editorState.set({
    activePaletteStamp: paletteStampFromKit(kit),
    activeStampId: null,
    activeStructureStampId: null,
    tool: "paint",
  });
  toast(`'${name}' 스탬프 저장 — 이제 맵에 찍어보세요 (팔레트 '내 스탬프'에서 관리)`, "ok");
  return { ok: true, kit };
}
