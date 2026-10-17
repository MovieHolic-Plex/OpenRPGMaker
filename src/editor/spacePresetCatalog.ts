// editor/spacePresetCatalog.ts
// 에디터 UI (「새 맵 만들기」 모달 & 좌측 「맵」 패널 바로 깔기 갤러리)에서 1클릭으로 탐색·적용하는
// 20종 공간 프리셋 카탈로그 및 파라메트릭 변형(Variant A/B/C/D · Seed) 실행기.

import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { selectEditorMap } from "@/editor/mapSelection";
import { createDraft, finishDraftTilesets } from "@/editor/tools/changeset";
import { getTool } from "@/editor/tools/toolRegistry";
import { createBlankMap } from "@/project/defaults";
import { defaultOutdoorTilesetId } from "@/project/defaults/outdoorTileset";
import { clampMapSize } from "@/project/mapCreateSpec";
import { findParentMapId, insertTreeNode } from "@/project/mapTree";
import { paintRiversidePromenade } from "@/project/startRoutePaint";
import { store } from "@/project/store";
import type { GameMap, MapId, Project } from "@/project/types";
import { toast } from "@/util/toast";
import { genId } from "@/util/id";

export type SpacePresetCategoryId = "modern_interior" | "modern_outdoor" | "fantasy_murim_dungeon";
export type SpacePresetStyleVariant = "A" | "B" | "C" | "D";

export interface SpacePresetCategoryMeta {
  readonly id: SpacePresetCategoryId;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
}

export interface SpacePresetStyleVariantMeta {
  readonly id: SpacePresetStyleVariant;
  readonly label: string;
  readonly shortLabel: string;
  readonly summary: string;
}

export type SpacePresetEngineSpec =
  | {
      readonly kind: "hand_interior";
      readonly program: string;
    }
  | {
      readonly kind: "riverside_promenade";
    }
  | {
      readonly kind: "modern_city_street";
      readonly shopsByVariant: Readonly<Record<SpacePresetStyleVariant, readonly string[]>>;
    }
  | {
      readonly kind: "jp_city_street";
      readonly styleByVariant: Readonly<Record<SpacePresetStyleVariant, "shotengai" | "station" | "residential">>;
      readonly shopsByVariant: Readonly<Record<SpacePresetStyleVariant, readonly string[]>>;
    }
  | {
      readonly kind: "campus_grounds";
      readonly styleByVariant: Readonly<Record<SpacePresetStyleVariant, "university" | "school">>;
    }
  | {
      readonly kind: "beodeul_town";
      readonly themeByVariant: Readonly<Record<SpacePresetStyleVariant, "river" | "coast" | "city" | "snow">>;
      readonly formByVariant: Readonly<Record<SpacePresetStyleVariant, "plaza" | "street" | "riverbank" | "scatter">>;
      readonly terrainByVariant: Readonly<Record<SpacePresetStyleVariant, "terraces" | "hillside" | "flat">>;
    }
  | {
      readonly kind: "dungeon";
      readonly genreByVariant: Readonly<Record<SpacePresetStyleVariant, string>>;
      readonly sizeByVariant: Readonly<Record<SpacePresetStyleVariant, "small" | "medium" | "large">>;
    };

export interface SpacePresetItem {
  readonly id: string;
  readonly category: SpacePresetCategoryId;
  readonly name: string;
  readonly shortName: string;
  readonly badge: string;
  readonly tilesetId: string;
  readonly defaultWidth: number;
  readonly defaultHeight: number;
  readonly zonesSummary: string;
  readonly description: string;
  readonly previewColors: readonly [string, string, string];
  readonly engine: SpacePresetEngineSpec;
}

export interface SpacePresetApplyOptions {
  readonly variantSeed?: number;
  readonly styleVariant?: SpacePresetStyleVariant;
  readonly customName?: string;
  readonly parentId?: MapId | "";
  readonly requestedWidth?: number;
  readonly requestedHeight?: number;
}

export interface SpacePresetApplyResult {
  readonly ok: boolean;
  readonly mapId: MapId;
  readonly width: number;
  readonly height: number;
  readonly styleVariant: SpacePresetStyleVariant;
  readonly variantSeed: number;
  readonly summary: string;
}

export const SPACE_PRESET_CATEGORIES: readonly SpacePresetCategoryMeta[] = [
  {
    id: "modern_interior",
    label: "현대 실내 (10종)",
    shortLabel: "현대 실내",
    description: "오피스 로비·강의실·백화점·마트·지하철역·병원·영화관·레스토랑·미술관 다구역 실내",
  },
  {
    id: "modern_outdoor",
    label: "현대·일본 야외 (4종)",
    shortLabel: "현대·일본 야외",
    description: "강변 산책로·현대 번화가 사거리·일본 상점가 거리·벚꽃 대학 캠퍼스",
  },
  {
    id: "fantasy_murim_dungeon",
    label: "판타지·무림·던전 (6종)",
    shortLabel: "판타지·무림·던전",
    description: "여관·무기점·왕성 알현실·무림 도장·버들항 마을·고대 유적 던전",
  },
] as const;

export const SPACE_PRESET_STYLE_VARIANTS: readonly SpacePresetStyleVariantMeta[] = [
  {
    id: "A",
    label: "구조 A · 기본 정석",
    shortLabel: "A 정석",
    summary: "표준 서→동 구획 배치 · 기본 바닥/벽 팔레트",
  },
  {
    id: "B",
    label: "구조 B · 동↔서 반전·웜 우드",
    shortLabel: "B 반전·웜톤",
    summary: "동↔서 윙 좌우 반전 · 따뜻한 원목/벽돌 색감 · 가구 대칭 배치",
  },
  {
    id: "C",
    label: "구조 C · 광폭 오픈·쿨 스톤",
    shortLabel: "C 광폭·쿨톤",
    summary: "광폭 로비/중앙 홀 확장 · 쿨 스톤/모던 타일 색감 · 와이드 개구부",
  },
  {
    id: "D",
    label: "구조 D · 비대칭 코너·다크 톤",
    shortLabel: "D 비대칭·다크",
    summary: "비대칭 코너 윙 + 깊은 홀 · 다크 헤링본/프리미엄 벽돌 색감",
  },
] as const;

export const SPACE_PRESET_CATALOG: readonly SpacePresetItem[] = [
  // ─── 1. 현대 실내 (10종) ───
  {
    id: "office-lobby",
    category: "modern_interior",
    name: "오피스 로비",
    shortName: "오피스 로비",
    badge: "30×20 · 3구역",
    tilesetId: "modern_city",
    defaultWidth: 30,
    defaultHeight: 20,
    zonesSummary: "엘리베이터 홀 · 라운지 · 정문 안내 로비",
    description: "엘리베이터 4기·출입 게이트·안내 데스크·대기 소파 라운지가 완비된 본사 1층 로비",
    previewColors: ["#3b82f6", "#1e293b", "#93c5fd"],
    engine: { kind: "hand_interior", program: "lobby" },
  },
  {
    id: "office-floor",
    category: "modern_interior",
    name: "본사 오피스 층",
    shortName: "본사 오피스",
    badge: "28×20 · 4구역",
    tilesetId: "modern_city",
    defaultWidth: 28,
    defaultHeight: 20,
    zonesSummary: "오픈 오피스 · 대회의실 · 탕비실 · 복도",
    description: "파티션 업무 데스크군·유리문 회의실·탕비 라운지가 연결된 현대 오피스 플로어",
    previewColors: ["#2563eb", "#0f172a", "#60a5fa"],
    engine: { kind: "hand_interior", program: "office-floor" },
  },
  {
    id: "university-lecture",
    category: "modern_interior",
    name: "대학 강의실·세미나동",
    shortName: "대학 강의실",
    badge: "29×18 · 3구역",
    tilesetId: "modern_campus",
    defaultWidth: 29,
    defaultHeight: 18,
    zonesSummary: "계단식 대강의실 · 세미나실 · 캠퍼스 복도",
    description: "연단·칠판·장테이블이 정렬된 대강의실과 분임 토의 세미나실, 사물함 복도",
    previewColors: ["#10b981", "#1e293b", "#6ee7b7"],
    engine: { kind: "hand_interior", program: "university-lecture-wing" },
  },
  {
    id: "department-store",
    category: "modern_interior",
    name: "백화점 (아트리움·VIP)",
    shortName: "백화점",
    badge: "34×22 · 4구역",
    tilesetId: "modern_city",
    defaultWidth: 34,
    defaultHeight: 22,
    zonesSummary: "VIP 라운지 · 화장품관 · 중앙 아트리움 · 패션관",
    description: "에스컬레이터 아트리움을 중심으로 화장품 쇼케이스·패션 부티크·VIP 컨시어지가 배치된 백화점",
    previewColors: ["#ec4899", "#1f2937", "#f9a8d4"],
    engine: { kind: "hand_interior", program: "department-store" },
  },
  {
    id: "supermarket-mart",
    category: "modern_interior",
    name: "대형 마트·식자재관",
    shortName: "대형 마트",
    badge: "30×20 · 3구역",
    tilesetId: "modern_city",
    defaultWidth: 30,
    defaultHeight: 20,
    zonesSummary: "청과·베이커리 코너 · 물류 창고 · 중앙 진열·계산대",
    description: "신선 식품 쇼케이스·진열 곤돌라·계산대 라인과 후방 물류 창고가 연결된 대형 마트",
    previewColors: ["#22c55e", "#14532d", "#86efac"],
    engine: { kind: "hand_interior", program: "supermarket-mart" },
  },
  {
    id: "subway-station",
    category: "modern_interior",
    name: "지하철역 대합실·승강장",
    shortName: "지하철역",
    badge: "34×20 · 3구역",
    tilesetId: "modern_city",
    defaultWidth: 34,
    defaultHeight: 20,
    zonesSummary: "개찰구 대합실 · 역무실·키오스크 · 지하 승강장",
    description: "교통카드 개찰구·발권기·매점 키오스크와 안전선·벤치가 놓인 지하철 승강장",
    previewColors: ["#06b6d4", "#0f172a", "#67e8f9"],
    engine: { kind: "hand_interior", program: "subway-station" },
  },
  {
    id: "hospital-ward",
    category: "modern_interior",
    name: "종합병원 병동·진료실",
    shortName: "병원 병동",
    badge: "32×20 · 4구역",
    tilesetId: "modern_city",
    defaultWidth: 32,
    defaultHeight: 20,
    zonesSummary: "입원 병실 · 제1·2진료실 · 원무 접수·대기실",
    description: "다인 입원 병상·커튼 파티션·진찰실 2곳·원무 접수 카운터와 대기 소파를 갖춘 병원",
    previewColors: ["#14b8a6", "#134e4a", "#5eead4"],
    engine: { kind: "hand_interior", program: "hospital-ward" },
  },
  {
    id: "cinema-arcade",
    category: "modern_interior",
    name: "영화관·오락실",
    shortName: "영화관·오락실",
    badge: "32×22 · 3구역",
    tilesetId: "modern_city",
    defaultWidth: 32,
    defaultHeight: 22,
    zonesSummary: "계단식 상영관 · 아케이드 게임존 · 팝콘 매표 로비",
    description: "대형 스크린 상영관 좌석·레트로 아케이드 게임기 구역·매표 및 스낵바 로비",
    previewColors: ["#a855f7", "#2e1065", "#d8b4fe"],
    engine: { kind: "hand_interior", program: "cinema-arcade" },
  },
  {
    id: "restaurant-bar",
    category: "modern_interior",
    name: "레스토랑·다이닝 바",
    shortName: "레스토랑·바",
    badge: "30×20 · 3구역",
    tilesetId: "modern_city",
    defaultWidth: 30,
    defaultHeight: 20,
    zonesSummary: "오픈 키친·바 카운터 · 라이브 스테이지 · 메인 다이닝 홀",
    description: "그랜드 피아노 라이브 무대·바 카운터·메인 다이닝 테이블을 갖춘 레스토랑 & 바",
    previewColors: ["#f59e0b", "#451a03", "#fcd34d"],
    engine: { kind: "hand_interior", program: "restaurant-bar" },
  },
  {
    id: "museum-gallery",
    category: "modern_interior",
    name: "시립 미술관·박물관",
    shortName: "미술관",
    badge: "32×20 · 4구역",
    tilesetId: "atlas_biome_interior",
    defaultWidth: 32,
    defaultHeight: 20,
    zonesSummary: "회화 전시실 · 조각 전시실 · 중앙 로비 · 뮤지엄 숍",
    description: "명화 갤러리·조각상 전시 단상·안내 로비와 기념품 숍이 이어진 미술관",
    previewColors: ["#eab308", "#3f2e05", "#fde047"],
    engine: { kind: "hand_interior", program: "museum-gallery" },
  },

  // ─── 2. 현대·일본 야외 (4종) ───
  {
    id: "riverside-promenade",
    category: "modern_outdoor",
    name: "강변 산책로·수변 공원",
    shortName: "강변 산책로",
    badge: "24×15 · 야외 수변",
    tilesetId: "modern_city",
    defaultWidth: 24,
    defaultHeight: 15,
    zonesSummary: "북쪽 강물 · 석축 제방 · 가로수·가로등 잔디밭 · 연속 돌 산책로",
    description: "물결치는 강변과 석축 제방, 은행나무·느티나무 가로수길과 공원 벤치가 이어지는 산책로",
    previewColors: ["#0ea5e9", "#0c4a6e", "#7dd3fc"],
    engine: { kind: "riverside_promenade" },
  },
  {
    id: "modern-city-street",
    category: "modern_outdoor",
    name: "현대 번화가 사거리",
    shortName: "현대 번화가",
    badge: "56×44 · 도시 블록",
    tilesetId: "modern_city",
    defaultWidth: 56,
    defaultHeight: 44,
    zonesSummary: "교차로·횡단보도 · 오피스·백화점·카페·편의점·병원 빌딩 블록 · 주행 차량",
    description: "왕복 차도와 신호등 횡단보도, 고층 빌딩·상점 블록과 도심 소품이 배치된 현대 번화가",
    previewColors: ["#6366f1", "#1e1b4b", "#a5b4fc"],
    engine: {
      kind: "modern_city_street",
      shopsByVariant: {
        A: ["사무실", "백화점", "카페", "편의점", "은행", "병원"],
        B: ["백화점", "호텔", "카페", "이자카야", "빵집", "편의점"],
        C: ["사무실", "병원", "은행", "우체국", "경찰서", "카페"],
        D: ["호텔", "백화점", "이자카야", "카페", "빵집", "사무실"],
      },
    },
  },
  {
    id: "jp-city-street",
    category: "modern_outdoor",
    name: "일본 상점가 거리",
    shortName: "일본 상점가",
    badge: "48×32 · 상점가",
    tilesetId: "jp_city",
    defaultWidth: 48,
    defaultHeight: 32,
    zonesSummary: "역앞 상점가 · 편의점·규동집·이자카야·서점·약국·전철 건널목",
    description: "아케이드 간판과 자판기·전봇대·건널목이 어우러진 일본풍 역앞 상점가 거리",
    previewColors: ["#f43f5e", "#4c0519", "#fda4af"],
    engine: {
      kind: "jp_city_street",
      styleByVariant: {
        A: "station",
        B: "shotengai",
        C: "residential",
        D: "station",
      },
      shopsByVariant: {
        A: ["편의점", "규동", "이자카야", "서점", "약국", "카페"],
        B: ["라면", "이자카야", "노래방", "오락실", "편의점", "빵집"],
        C: ["편의점", "세탁소", "목욕탕", "꽃집", "서점", "카페"],
        D: ["백화점", "영화관", "서점", "카페", "이자카야", "편의점"],
      },
    },
  },
  {
    id: "campus-grounds",
    category: "modern_outdoor",
    name: "벚꽃 대학 캠퍼스",
    shortName: "벚꽃 캠퍼스",
    badge: "52×40 · 캠퍼스",
    tilesetId: "modern_campus",
    defaultWidth: 52,
    defaultHeight: 40,
    zonesSummary: "정문 교문 · 대학 본관 · 중앙도서관 · 학생식당 · 체육관 · 운동장",
    description: "가로수 산책로와 정문, 강의동·도서관·학생회관·운동장이 짜임새 있게 놓인 캠퍼스 야외",
    previewColors: ["#ec4899", "#064e3b", "#fbcfe8"],
    engine: {
      kind: "campus_grounds",
      styleByVariant: {
        A: "university",
        B: "school",
        C: "university",
        D: "school",
      },
    },
  },

  // ─── 3. 판타지·무림·던전 (6종) ───
  {
    id: "fantasy-inn",
    category: "fantasy_murim_dungeon",
    name: "여관·주막 실내",
    shortName: "여관·주막",
    badge: "27×23 · 8구역",
    tilesetId: "atlas_biome_interior",
    defaultWidth: 27,
    defaultHeight: 23,
    zonesSummary: "1층 주점 홀 · 주방 · 지하 창고 · 복도 · 숙박 객실 3실",
    description: "맥주통과 난로가 있는 활기찬 주점 홀, 주방·식자재 창고와 여행자 객실이 갖춰진 여관",
    previewColors: ["#d97706", "#3b1d06", "#fcd34d"],
    engine: { kind: "hand_interior", program: "inn" },
  },
  {
    id: "fantasy-smithy",
    category: "fantasy_murim_dungeon",
    name: "무기점·대장간",
    shortName: "무기점·대장간",
    badge: "21×11 · 3구역",
    tilesetId: "atlas_biome_interior",
    defaultWidth: 21,
    defaultHeight: 11,
    zonesSummary: "용광로·모루 작업장 · 무기·방어구 진열 매장 · 대장장이 침실",
    description: "타오르는 화로와 모루·담금질 수조가 있는 작업장과 검·갑옷 진열 카운터",
    previewColors: ["#ef4444", "#450a0a", "#fca5a5"],
    engine: { kind: "hand_interior", program: "smithy" },
  },
  {
    id: "fantasy-throne",
    category: "fantasy_murim_dungeon",
    name: "왕성 알현실·홀",
    shortName: "왕성 알현실",
    badge: "27×18 · 4구역",
    tilesetId: "atlas_biome_interior",
    defaultWidth: 27,
    defaultHeight: 18,
    zonesSummary: "붉은 융단 왕좌 알현실 · 근위병 대기실 · 왕실 서재 · 접견실",
    description: "단상 위 왕좌와 기둥 회랑, 근위병 초소와 왕실 고문서 서재가 연결된 왕성 중심부",
    previewColors: ["#eab308", "#450a0a", "#fde047"],
    engine: { kind: "hand_interior", program: "throne" },
  },
  {
    id: "murim-dojo",
    category: "fantasy_murim_dungeon",
    name: "무림 도장·연무관",
    shortName: "무림 도장",
    badge: "18×14 · 2구역",
    tilesetId: "sengoku_edo",
    defaultWidth: 18,
    defaultHeight: 14,
    zonesSummary: "다다미 대연무장 · 무구 거치대 · 사범 서재·다실",
    description: "목검·창 거치대와 족자가 걸린 다다미 수련장과 사범의 서재가 이어진 전통 무림 도장",
    previewColors: ["#84cc16", "#1a2e05", "#bef264"],
    engine: { kind: "hand_interior", program: "dojo" },
  },
  {
    id: "beodeul-town",
    category: "fantasy_murim_dungeon",
    name: "버들항 마을",
    shortName: "버들항 마을",
    badge: "56×44 · 마을 야외",
    tilesetId: "beodeul_city",
    defaultWidth: 56,
    defaultHeight: 44,
    zonesSummary: "중앙 분수 광장 · 여관·대장간·상점 거리 · 수변 다리 · 성당 언덕",
    description: "강줄기와 돌다리, 지붕 건물들과 장터 광장·가로수가 어우러진 판타지 거점 마을",
    previewColors: ["#16a34a", "#052e16", "#86efac"],
    engine: {
      kind: "beodeul_town",
      themeByVariant: { A: "river", B: "coast", C: "city", D: "snow" },
      formByVariant: { A: "riverbank", B: "plaza", C: "street", D: "scatter" },
      terrainByVariant: { A: "terraces", B: "flat", C: "flat", D: "hillside" },
    },
  },
  {
    id: "fantasy-dungeon",
    category: "fantasy_murim_dungeon",
    name: "고대 유적 던전",
    shortName: "고대 던전",
    badge: "52×36 · 다중 방 던전",
    tilesetId: "beodeul_dungeon",
    defaultWidth: 52,
    defaultHeight: 36,
    zonesSummary: "입구 홀 · 갈림길 회랑 · 보물상자 방 · 봉인 기믹 방 · 보스 결전장",
    description: "입구에서 갈림길·보물방·기믹방을 거쳐 보스 결전장으로 이어지는 다중 방 던전",
    previewColors: ["#8b5cf6", "#1e1b4b", "#c4b5fd"],
    engine: {
      kind: "dungeon",
      genreByVariant: {
        A: "중세 판타지 고대 유적",
        B: "지하 카타콤·봉인 신전",
        C: "화산 용암 성채 지하",
        D: "심해 침수 유적 미궁",
      },
      sizeByVariant: {
        A: "medium",
        B: "medium",
        C: "large",
        D: "medium",
      },
    },
  },
] as const;

export function findSpacePresetById(id: string | undefined): SpacePresetItem | undefined {
  if (!id) return undefined;
  return SPACE_PRESET_CATALOG.find((item) => item.id === id);
}

export function presetsByCategory(category: SpacePresetCategoryId): readonly SpacePresetItem[] {
  return SPACE_PRESET_CATALOG.filter((item) => item.category === category);
}

export function nextSpacePresetStyleVariant(current: SpacePresetStyleVariant): SpacePresetStyleVariant {
  return current === "A" ? "B" : current === "B" ? "C" : current === "C" ? "D" : "A";
}

export function styleVariantIndex(sv: SpacePresetStyleVariant): number {
  return sv === "A" ? 0 : sv === "B" ? 1 : sv === "C" ? 2 : 3;
}

export function resolveStyleVariant(options?: SpacePresetApplyOptions): SpacePresetStyleVariant {
  if (options?.styleVariant) return options.styleVariant;
  const seed = Math.max(1, Math.floor(options?.variantSeed ?? 1));
  const idx = (seed - 1) % 4;
  return idx === 0 ? "A" : idx === 1 ? "B" : idx === 2 ? "C" : "D";
}

function resetTargetMapForPreset(
  draft: Project,
  mapId: MapId,
  name: string,
  tilesetId: string,
  width: number,
  height: number,
  preserveEvents: boolean,
): GameMap {
  const existing = draft.maps[mapId];
  const resolvedTilesetId = draft.tilesets[tilesetId] ? tilesetId : defaultOutdoorTilesetId(draft);
  const blank = createBlankMap(
    name,
    width,
    height,
    resolvedTilesetId,
    undefined,
    draft.tilesets[resolvedTilesetId],
  );
  blank.id = mapId;
  if (existing && preserveEvents && existing.events.length > 0) {
    blank.events = structuredClone(existing.events)
      .filter((e) => !e.id.startsWith(`${mapId}-link-`) && !e.id.startsWith("ev_mc_enter_"))
      .map((e) => ({
        ...e,
        x: Math.max(1, Math.min(width - 2, e.x)),
        y: Math.max(1, Math.min(height - 2, e.y)),
      }));
  }
  draft.maps[mapId] = blank;
  return blank;
}

/**
 * draft 프로젝트의 지정 mapId 에 공간 프리셋을 실행한다.
 * 새 맵 생성과 기존 맵 "바로 깔기" 양쪽이 이 단일 실행 경로를 공유한다.
 */
export function executeSpacePresetOnDraft(
  draft: Project,
  preset: SpacePresetItem,
  mapId: MapId,
  options?: SpacePresetApplyOptions & { readonly preserveEvents?: boolean },
): { readonly summary: string; readonly width: number; readonly height: number; readonly styleVariant: SpacePresetStyleVariant; readonly variantSeed: number } {
  const styleVariant = resolveStyleVariant(options);
  const vIdx = styleVariantIndex(styleVariant);
  const variantSeed = Math.max(1, Math.floor(options?.variantSeed ?? (vIdx + 1)));
  const mapName = options?.customName?.trim() || draft.maps[mapId]?.name || preset.name;
  const reqW = clampMapSize(options?.requestedWidth ?? preset.defaultWidth, preset.defaultWidth);
  const reqH = clampMapSize(options?.requestedHeight ?? preset.defaultHeight, preset.defaultHeight);
  const width = Math.max(preset.defaultWidth, reqW);
  const height = Math.max(preset.defaultHeight, reqH);

  const engine = preset.engine;
  switch (engine.kind) {
    case "hand_interior": {
      resetTargetMapForPreset(draft, mapId, mapName, preset.tilesetId, width, height, options?.preserveEvents ?? false);
      const tool = getTool("build_hand_interior_room");
      if (!tool) throw new Error("build_hand_interior_room 도구를 찾을 수 없습니다.");
      const res = tool.run(draft, {
        mapId,
        name: mapName,
        tileset: preset.tilesetId,
        replace: true,
        layout: {
          program: engine.program,
          variant: vIdx,
          styleVariant,
          seed: variantSeed,
        },
      });
      const built = draft.maps[mapId]!;
      return {
        summary: res.summary,
        width: built.width,
        height: built.height,
        styleVariant,
        variantSeed,
      };
    }

    case "riverside_promenade": {
      const target = resetTargetMapForPreset(
        draft,
        mapId,
        mapName,
        preset.tilesetId,
        Math.max(24, width),
        Math.max(15, height),
        options?.preserveEvents ?? true,
      );
      paintRiversidePromenade(draft, target, {
        seed: variantSeed,
        styleVariant,
      });
      if (draft.startMapId === mapId) {
        const walkY = styleVariant === "B" ? 11 : styleVariant === "C" ? 9 : 10;
        draft.startPos = { x: Math.floor(target.width / 2), y: walkY };
      }
      return {
        summary: `강변 산책로 '${mapName}' (${target.width}×${target.height}, 변형 ${styleVariant}·시드 ${variantSeed}) 적용 완료`,
        width: target.width,
        height: target.height,
        styleVariant,
        variantSeed,
      };
    }

    case "modern_city_street": {
      const w = Math.max(48, width) + (styleVariant === "C" ? 4 : styleVariant === "D" ? 2 : 0);
      const h = Math.max(36, height) + (styleVariant === "B" ? 4 : styleVariant === "D" ? 2 : 0);
      resetTargetMapForPreset(draft, mapId, mapName, preset.tilesetId, w, h, options?.preserveEvents ?? true);
      const tool = getTool("compose_modern_city_street");
      if (!tool) throw new Error("compose_modern_city_street 도구를 찾을 수 없습니다.");
      const res = tool.run(draft, {
        mapId,
        replace: true,
        seed: variantSeed + vIdx * 7,
        shops: [...engine.shopsByVariant[styleVariant]],
      });
      const built = draft.maps[mapId]!;
      return {
        summary: res.summary,
        width: built.width,
        height: built.height,
        styleVariant,
        variantSeed,
      };
    }

    case "jp_city_street": {
      const w = Math.max(44, width) + (styleVariant === "C" ? 4 : 0);
      const h = Math.max(30, height) + (styleVariant === "B" ? 4 : 0);
      resetTargetMapForPreset(draft, mapId, mapName, preset.tilesetId, w, h, options?.preserveEvents ?? true);
      const tool = getTool("compose_jp_city_street");
      if (!tool) throw new Error("compose_jp_city_street 도구를 찾을 수 없습니다.");
      const res = tool.run(draft, {
        mapId,
        replace: true,
        style: engine.styleByVariant[styleVariant],
        seed: variantSeed + vIdx * 5,
        shops: [...engine.shopsByVariant[styleVariant]],
      });
      const built = draft.maps[mapId]!;
      return {
        summary: res.summary,
        width: built.width,
        height: built.height,
        styleVariant,
        variantSeed,
      };
    }

    case "campus_grounds": {
      const campusStyle = engine.styleByVariant[styleVariant];
      const minW = campusStyle === "university" ? 52 : 44;
      const minH = campusStyle === "university" ? 40 : 34;
      const w = Math.max(minW, width) + (styleVariant === "C" ? 4 : 0);
      const h = Math.max(minH, height) + (styleVariant === "D" ? 4 : 0);
      resetTargetMapForPreset(draft, mapId, mapName, preset.tilesetId, w, h, options?.preserveEvents ?? true);
      const tool = getTool("compose_campus_grounds");
      if (!tool) throw new Error("compose_campus_grounds 도구를 찾을 수 없습니다.");
      const res = tool.run(draft, {
        mapId,
        replace: true,
        style: campusStyle,
        seed: variantSeed + vIdx * 11,
      });
      const built = draft.maps[mapId]!;
      return {
        summary: res.summary,
        width: built.width,
        height: built.height,
        styleVariant,
        variantSeed,
      };
    }

    case "beodeul_town": {
      const w = Math.max(48, width);
      const h = Math.max(38, height);
      resetTargetMapForPreset(draft, mapId, mapName, preset.tilesetId, w, h, false);
      const tool = getTool("author_beodeul_town");
      if (!tool) throw new Error("author_beodeul_town 도구를 찾을 수 없습니다.");
      const res = tool.run(draft, {
        mapId,
        name: mapName,
        width: w,
        height: h,
        theme: engine.themeByVariant[styleVariant],
        form: engine.formByVariant[styleVariant],
        terrain: engine.terrainByVariant[styleVariant],
        harbour: styleVariant === "B",
        seed: variantSeed + vIdx * 13,
      });
      const built = draft.maps[mapId]!;
      built.name = mapName;
      return {
        summary: res.summary,
        width: built.width,
        height: built.height,
        styleVariant,
        variantSeed,
      };
    }

    case "dungeon": {
      resetTargetMapForPreset(draft, mapId, mapName, preset.tilesetId, width, height, false);
      const tool = getTool("author_dungeon");
      if (!tool) throw new Error("author_dungeon 도구를 찾을 수 없습니다.");
      const res = tool.run(draft, {
        mapId,
        name: mapName,
        genre: engine.genreByVariant[styleVariant],
        size: engine.sizeByVariant[styleVariant],
        seed: variantSeed + vIdx * 17,
      });
      const built = draft.maps[mapId]!;
      built.name = mapName;
      return {
        summary: res.summary,
        width: built.width,
        height: built.height,
        styleVariant,
        variantSeed,
      };
    }
  }
}

/**
 * 「새 맵 만들기」 모달에서 선택한 공간 프리셋으로 완성된 다구역 맵을 즉시 생성한다 (1단계 실행 취소 지원).
 */
export function createMapWithSpacePreset(
  preset: SpacePresetItem,
  options?: SpacePresetApplyOptions,
): SpacePresetApplyResult {
  const newMapId = genId("map");
  const styleVariant = resolveStyleVariant(options);
  const variantSeed = Math.max(1, Math.floor(options?.variantSeed ?? (styleVariantIndex(styleVariant) + 1)));
  let finalWidth = preset.defaultWidth;
  let finalHeight = preset.defaultHeight;
  let summary = "";

  recordProjectSnapshot(`새 공간 프리셋 맵 (${preset.name} · ${styleVariant})`);
  try {
    store.update((project) => {
      const draft = createDraft(project);
      const mapName = options?.customName?.trim() || preset.name;
      resetTargetMapForPreset(draft, newMapId, mapName, preset.tilesetId, preset.defaultWidth, preset.defaultHeight, false);
      const parentId = options?.parentId ?? "";
      if (!insertTreeNode(draft.mapTree, { mapId: newMapId, children: [] }, parentId, undefined)) {
        insertTreeNode(draft.mapTree, { mapId: newMapId, children: [] }, "", undefined);
      }
      const res = executeSpacePresetOnDraft(draft, preset, newMapId, {
        ...options,
        customName: mapName,
        styleVariant,
        variantSeed,
        preserveEvents: false,
      });
      finishDraftTilesets(draft);
      project.maps = draft.maps;
      project.mapTree = draft.mapTree;
      project.tilesets = draft.tilesets;
      project.startMapId = draft.startMapId;
      project.startPos = draft.startPos;
      finalWidth = res.width;
      finalHeight = res.height;
      summary = res.summary;
    }, { scope: "project" });
    selectEditorMap(newMapId);
    toast(`「${preset.name}」 (${finalWidth}×${finalHeight} · 구조 ${styleVariant}) 새 맵을 만들었습니다.`, "info");
    return {
      ok: true,
      mapId: newMapId,
      width: finalWidth,
      height: finalHeight,
      styleVariant,
      variantSeed,
      summary,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    toast(`프리셋 맵 생성 실패: ${msg}`, "error");
    return {
      ok: false,
      mapId: "",
      width: 0,
      height: 0,
      styleVariant,
      variantSeed,
      summary: msg,
    };
  }
}

/**
 * 좌측 사이드바 「맵 / 바로 깔기」 패널에서 현재 선택된 맵에 공간 프리셋을 1클릭으로 즉시 적용한다 (Ctrl+Z 실행 취소 지원).
 */
export function applySpacePresetToMap(
  mapId: MapId,
  preset: SpacePresetItem,
  options?: SpacePresetApplyOptions,
): SpacePresetApplyResult {
  const currentProject = store.getCurrent();
  const existing = currentProject.maps[mapId];
  const styleVariant = resolveStyleVariant(options);
  const variantSeed = Math.max(1, Math.floor(options?.variantSeed ?? (styleVariantIndex(styleVariant) + 1)));
  if (!existing) {
    return createMapWithSpacePreset(preset, options);
  }

  let finalWidth = existing.width;
  let finalHeight = existing.height;
  let summary = "";

  recordProjectSnapshot(`공간 프리셋 바로 깔기 (${preset.name} · ${styleVariant})`, mapId);
  try {
    store.update((project) => {
      const draft = createDraft(project);
      const keepParent = findParentMapId(draft.mapTree, mapId);
      const mapName = options?.customName?.trim() || existing.name || preset.name;
      const res = executeSpacePresetOnDraft(draft, preset, mapId, {
        ...options,
        customName: mapName,
        styleVariant,
        variantSeed,
        preserveEvents: true,
      });
      if (keepParent !== null && findParentMapId(draft.mapTree, mapId) === null) {
        insertTreeNode(draft.mapTree, { mapId, children: [] }, keepParent, undefined);
      }
      finishDraftTilesets(draft);
      project.maps = draft.maps;
      project.mapTree = draft.mapTree;
      project.tilesets = draft.tilesets;
      project.startMapId = draft.startMapId;
      project.startPos = draft.startPos;
      finalWidth = res.width;
      finalHeight = res.height;
      summary = res.summary;
    }, { scope: "project" });
    selectEditorMap(mapId);
    toast(`현재 맵에 「${preset.name}」 (${finalWidth}×${finalHeight} · 구조 ${styleVariant}) 프리셋을 적용했습니다.`, "info");
    return {
      ok: true,
      mapId,
      width: finalWidth,
      height: finalHeight,
      styleVariant,
      variantSeed,
      summary,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    toast(`프리셋 적용 실패: ${msg}`, "error");
    return {
      ok: false,
      mapId,
      width: existing.width,
      height: existing.height,
      styleVariant,
      variantSeed,
      summary: msg,
    };
  }
}
