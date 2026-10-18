// editor/spacePresetCatalog.ts
// AI 참고 청사진(공간 청사진) — 조수·바로 깔기가 「오피스 로비」「대학 강의실」「강변 산책로」「왕성 알현실」 같은 공간을 지을 때 읽는 규칙집.
//
// 왜 (2026-10-18 사용자 반려: 「프리셋을 사용자가 직접 선택하고 바로 깔게 하는 것보다 AI 가 참고해서 깔게 하는 게 맞겠지. 똑같이 깔지 말고」):
//   #2874 는 20종 프리셋을 새 맵 모달·좌측 패널 버튼으로 내놓고 누르면 같은 견본을 찍었다. 그 버튼은 걷어 냈다.
//   여기 남은 것은 공간마다의 청사진(구역 비율·중심 초점·필수 가구 무리·융단 동선·벽 리듬)과, 요청 문장 + 새 씨앗으로
//   매번 다른 배치를 짜는 실행기다. 실내 청사진 셋(로비·강의동·알현실)은 handInterior/blueprintComposers 가 규칙대로 새로 짜고,
//   나머지는 각 구성기 도구에 씨앗·요청 뉘앙스를 넘긴다.

import type { ToolDefinition } from "@/editor/tools/types";
import { createDraft, finishDraftTilesets } from "@/editor/tools/changeset";
import { createBlankMap } from "@/project/defaults";
import { defaultOutdoorTilesetId } from "@/project/defaults/outdoorTileset";
import { paintRiversidePromenade } from "@/project/startRoutePaint";
import { allowedVillageForms } from "@/editor/tools/beodeulVillage";
import { allowedVillageTerrains } from "@/editor/tools/beodeulTerrain";
import type { GameMap, MapId, Project } from "@/project/types";

export type SpaceBlueprintCategory = "modern_interior" | "modern_outdoor" | "fantasy_murim_dungeon";

/** 청사진 — 조수가 읽고 따르는 공간 문법. 좌표가 아니라 규칙이다. */
export interface SpaceBlueprintGuide {
  /** 구역과 대략의 면적 비율. */
  readonly zones: string;
  /** 시선이 모이는 중심(입구에서 보이는 것). */
  readonly focal: string;
  /** 반드시 있어야 하는 가구·소품 무리. */
  readonly clusters: string;
  /** 융단·통로·길의 동선. */
  readonly paths: string;
  /** 벽·창·기둥·가로등의 반복 리듬. */
  readonly rhythm: string;
}

export type SpaceBlueprintEngine =
  | { readonly kind: "hand_interior"; readonly program: string }
  | { readonly kind: "riverside_promenade" }
  | { readonly kind: "modern_city_street"; readonly shopPools: readonly (readonly string[])[] }
  | { readonly kind: "jp_city_street"; readonly styles: readonly ("shotengai" | "station" | "residential")[]; readonly shopPools: readonly (readonly string[])[] }
  | { readonly kind: "campus_grounds"; readonly styles: readonly ("university" | "school")[] }
  | { readonly kind: "beodeul_town"; readonly themes: readonly ("river" | "coast" | "city" | "snow")[]; readonly forms: readonly ("plaza" | "street" | "riverbank" | "scatter")[]; readonly terrains: readonly ("terraces" | "hillside" | "flat")[] }
  | { readonly kind: "dungeon"; readonly genres: readonly string[]; readonly sizes: readonly ("small" | "medium" | "large")[] };

export interface SpaceBlueprint {
  readonly id: string;
  readonly category: SpaceBlueprintCategory;
  readonly name: string;
  /** 요청 문장에서 이 청사진을 고르는 낱말. */
  readonly keywords: RegExp;
  readonly tilesetId: string;
  /** 바닥 크기 기준(칸). 구성기가 규모·씨앗에 따라 넓히거나 줄인다. */
  readonly width: number;
  readonly height: number;
  readonly guide: SpaceBlueprintGuide;
  readonly engine: SpaceBlueprintEngine;
}

export const SPACE_BLUEPRINTS: readonly SpaceBlueprint[] = [
  // ─── 현대 실내 ───
  {
    id: "office-lobby", category: "modern_interior", name: "오피스 로비", tilesetId: "modern_city", width: 34, height: 24,
    keywords: /오피스\s*로비|본사\s*로비|사옥|빌딩\s*로비|회사\s*로비|로비|office\s*lobby/iu,
    guide: {
      zones: "로비 홀 55% · 업무 윙 25% · 회의실 12% · 탕비실 8%(소형이면 생략)",
      focal: "정문 축 정면의 안내 데스크(양옆 보안 게이트) 뒤로 엘리베이터 뱅크",
      clusters: "깔개 위 소파+탁자+안락의자 대기 라운지 · 카페 대기석 · 마주 보는 업무 책상 섬 · 긴 회의 탁자+의자+발표 화면 · 조리대+커피 머신+냉장고",
      paths: "정문→안내 데스크까지 3칸 폭 중앙 융단, 융단 양옆 화분 기둥",
      rhythm: "북벽 창·액자·게시판 4칸 리듬, 엘리베이터 양옆 키 큰 화분",
    },
    engine: { kind: "hand_interior", program: "lobby" },
  },
  {
    id: "office-floor", category: "modern_interior", name: "본사 오피스 층", tilesetId: "modern_city", width: 28, height: 20,
    keywords: /오피스\s*층|사무실|사무층|오피스|office/iu,
    guide: { zones: "오픈 오피스 60% · 회의실 20% · 탕비실 10% · 복도 10%", focal: "창가 쪽 팀장석과 화이트보드", clusters: "파티션 책상 섬 · 회의 탁자 · 탕비 라운지", paths: "책상 섬 사이 2칸 통로", rhythm: "블라인드 창 리듬" },
    engine: { kind: "hand_interior", program: "office-floor" },
  },
  {
    id: "university-lecture", category: "modern_interior", name: "대학 강의실·세미나동", tilesetId: "modern_campus", width: 30, height: 22,
    keywords: /강의실|강의동|세미나|대학\s*교실|lecture|seminar/iu,
    guide: {
      zones: "대강의실 60% · 세미나·동아리실 40% · 남쪽 복도 띠",
      focal: "북벽 넓은 칠판·영사막과 교단 위 강의대",
      clusters: "중앙 통로 좌우로 정렬된 장책상 줄 · 마주 앉는 토의 탁자+서가+독서 소파 · 사물함·게시판·음수대",
      paths: "출입문→교단까지 3칸 중앙 통로(다른 바닥), 교단 앞 가로 통로",
      rhythm: "교실 창 3칸 리듬, 복도 게시판 4칸 리듬",
    },
    engine: { kind: "hand_interior", program: "university-lecture-wing" },
  },
  {
    id: "department-store", category: "modern_interior", name: "백화점", tilesetId: "modern_city", width: 34, height: 22,
    keywords: /백화점|면세점|아울렛|department\s*store/iu,
    guide: { zones: "아트리움 30% · 화장품관 25% · 패션관 25% · VIP 라운지 20%", focal: "중앙 에스컬레이터 아트리움", clusters: "쇼케이스 · 마네킹 단상 · 의류 행거 · 컨시어지", paths: "아트리움에서 각 관으로 퍼지는 통로", rhythm: "쇼윈도 리듬" },
    engine: { kind: "hand_interior", program: "department-store" },
  },
  {
    id: "supermarket-mart", category: "modern_interior", name: "대형 마트", tilesetId: "modern_city", width: 30, height: 20,
    keywords: /마트|슈퍼마켓|식자재|supermarket|mart/iu,
    guide: { zones: "진열 홀 60% · 신선 코너 25% · 창고 15%", focal: "입구 앞 계산대 줄", clusters: "곤돌라 진열대 줄 · 냉장 쇼케이스 · 계산대", paths: "곤돌라 사이 통로", rhythm: "냉장고 벽 리듬" },
    engine: { kind: "hand_interior", program: "supermarket-mart" },
  },
  {
    id: "subway-station", category: "modern_interior", name: "지하철역", tilesetId: "modern_city", width: 34, height: 20,
    keywords: /지하철|전철역|승강장|개찰구|대합실|subway|station/iu,
    guide: { zones: "대합실 45% · 승강장 40% · 역무실 15%", focal: "개찰구 줄", clusters: "발권기 · 매점 · 승강장 벤치 · 안전선", paths: "출입구→개찰구→승강장 계단", rhythm: "노선도·기둥 리듬" },
    engine: { kind: "hand_interior", program: "subway-station" },
  },
  {
    id: "hospital-ward", category: "modern_interior", name: "종합병원 병동", tilesetId: "modern_city", width: 32, height: 20,
    keywords: /병원|병동|입원실|진료실|hospital|ward/iu,
    guide: { zones: "병실 40% · 진료실 30% · 접수·대기 30%", focal: "원무 접수 카운터", clusters: "병상+커튼 · 진찰대 · 대기 소파", paths: "접수→복도→병실", rhythm: "병상 간격" },
    engine: { kind: "hand_interior", program: "hospital-ward" },
  },
  {
    id: "cinema-arcade", category: "modern_interior", name: "영화관·오락실", tilesetId: "modern_city", width: 32, height: 22,
    keywords: /영화관|시네마|상영관|오락실|아케이드|cinema|arcade/iu,
    guide: { zones: "상영관 45% · 게임존 30% · 매표 로비 25%", focal: "대형 스크린", clusters: "좌석 줄 · 게임기 줄 · 스낵바", paths: "로비→상영관 통로", rhythm: "좌석 줄" },
    engine: { kind: "hand_interior", program: "cinema-arcade" },
  },
  {
    id: "restaurant-bar", category: "modern_interior", name: "레스토랑·바", tilesetId: "modern_city", width: 30, height: 20,
    keywords: /레스토랑|다이닝|비스트로|와인\s*바|restaurant/iu,
    guide: { zones: "다이닝 홀 55% · 바·키친 30% · 무대 15%", focal: "피아노 무대", clusters: "식탁+의자 · 바 카운터 · 오픈 키친", paths: "입구→홀 중앙 통로", rhythm: "식탁 간격" },
    engine: { kind: "hand_interior", program: "restaurant-bar" },
  },
  {
    id: "museum-gallery", category: "modern_interior", name: "미술관·박물관", tilesetId: "modern_city", width: 32, height: 20,
    keywords: /미술관|박물관|전시실|갤러리|museum|gallery/iu,
    guide: { zones: "회화관 35% · 조각관 30% · 로비 20% · 숍 15%", focal: "조각 좌대", clusters: "액자 벽 · 벨벳 차단봉 · 안내 데스크", paths: "로비→전시실 순환 동선", rhythm: "액자 간격" },
    engine: { kind: "hand_interior", program: "museum-gallery" },
  },
  // ─── 현대·일본 야외 ───
  {
    id: "riverside-promenade", category: "modern_outdoor", name: "강변 산책로·수변 공원", tilesetId: "modern_city", width: 30, height: 24,
    keywords: /강변|수변|호숫가|산책로|riverside|promenade/iu,
    guide: {
      zones: "북쪽 굽은 강 20% · 물가 가로수 띠 15% · 산책로 17% · 남쪽 공원·거리 48%",
      focal: "물로 나간 돌 전망 부두와 남쪽 분수 광장",
      clusters: "분수+벤치 광장 · 테라스 자리+매점 카페 · 굽은 오솔길 꽃 정원(철쭉·벚나무)",
      paths: "끊기지 않는 4줄 산책로, 남쪽으로 내려가는 굽은 모래 오솔길, 맨 아래 가로등 보도",
      rhythm: "가로수와 가로등 교대, 아래 보도 6칸 가로등",
    },
    engine: { kind: "riverside_promenade" },
  },
  {
    id: "modern-city-street", category: "modern_outdoor", name: "현대 번화가", tilesetId: "modern_city", width: 56, height: 44,
    keywords: /번화가|사거리|도심|시내|city\s*street|downtown/iu,
    guide: { zones: "도로망 30% · 건물 블록 55% · 보도 15%", focal: "신호등 교차로", clusters: "빌딩·상점 블록 · 가로수 · 차량", paths: "왕복 차도와 횡단보도", rhythm: "가로수·가로등 간격" },
    engine: { kind: "modern_city_street", shopPools: [["사무실", "백화점", "카페", "편의점", "은행", "병원"], ["백화점", "호텔", "카페", "이자카야", "빵집", "편의점"], ["은행", "우체국", "경찰서", "카페", "편의점", "아파트"]] },
  },
  {
    id: "jp-city-street", category: "modern_outdoor", name: "일본 상점가 거리", tilesetId: "jp_city", width: 48, height: 32,
    keywords: /상점가|역앞|일본\s*거리|shotengai/iu,
    guide: { zones: "상점 줄 60% · 거리 30% · 건널목 10%", focal: "아케이드 간판", clusters: "자판기 · 전봇대 · 상점", paths: "상점가 중앙 길", rhythm: "간판 리듬" },
    engine: { kind: "jp_city_street", styles: ["station", "shotengai", "residential"], shopPools: [["편의점", "규동", "이자카야", "서점", "약국", "카페"], ["라면", "이자카야", "노래방", "오락실", "편의점", "빵집"], ["편의점", "세탁소", "목욕탕", "꽃집", "서점", "카페"]] },
  },
  {
    id: "campus-grounds", category: "modern_outdoor", name: "대학 캠퍼스", tilesetId: "modern_campus", width: 52, height: 40,
    keywords: /캠퍼스|교정|학교\s*운동장|campus/iu,
    guide: { zones: "건물 40% · 광장·길 35% · 운동장 25%", focal: "정문에서 보이는 본관", clusters: "강의동 · 도서관 · 식당 · 운동장", paths: "정문→본관 가로수 길", rhythm: "가로수 간격" },
    engine: { kind: "campus_grounds", styles: ["university", "school"] },
  },
  // ─── 판타지·무림·던전 ───
  {
    id: "fantasy-inn", category: "fantasy_murim_dungeon", name: "여관", tilesetId: "atlas_biome_interior", width: 27, height: 23,
    keywords: /여관|주막|선술집|inn|tavern/iu,
    guide: { zones: "주점 홀 45% · 주방 20% · 객실 35%", focal: "난로와 카운터", clusters: "식탁+의자 · 맥주통 · 침대", paths: "입구→카운터", rhythm: "식탁 간격" },
    engine: { kind: "hand_interior", program: "inn" },
  },
  {
    id: "fantasy-smithy", category: "fantasy_murim_dungeon", name: "무기점·대장간", tilesetId: "atlas_biome_interior", width: 21, height: 11,
    keywords: /대장간|무기점|무기상|smithy|blacksmith/iu,
    guide: { zones: "작업장 50% · 매장 35% · 침실 15%", focal: "용광로와 모루", clusters: "무기 진열 · 카운터 · 담금질 수조", paths: "입구→카운터", rhythm: "무기 걸이" },
    engine: { kind: "hand_interior", program: "smithy" },
  },
  {
    id: "fantasy-throne", category: "fantasy_murim_dungeon", name: "왕성 알현실", tilesetId: "atlas_biome_interior", width: 43, height: 33,
    keywords: /알현실|왕좌|옥좌|왕성|궁전|throne|palace/iu,
    guide: {
      zones: "세로로 아주 긴 알현 회랑 40% (정문→왕좌 28~36줄) · 양 윙 위·가운데·아래 세 방씩: 어전 회의실·보물고·근위대 대기실 / 도서관 또는 무기고·왕실 예배당·접견 대기실",
      focal: "대리석 단상 위 왕좌, 뒤 벽 태피스트리와 왕실 깃발",
      clusters: "단상 양옆 화로·근위 갑옷 · 긴 회의 탁자+의자+작전 지도 · 왕관 단상+보물 더미 · 제단+장의자 · 침상+작전 탁자 · 응접 소파+다과 탁자",
      paths: "정문→단상 3칸 융단이 회랑 끝까지, 양 윙 바닥 깔개",
      rhythm: "융단 바로 옆(중심 ±3) 쌍기둥 3줄 간격, 기둥 바깥 화로·갑옷 교대, 바깥 통로 신하석, 높은 스테인드글라스",
    },
    engine: { kind: "hand_interior", program: "throne" },
  },
  {
    id: "murim-dojo", category: "fantasy_murim_dungeon", name: "무림 도장", tilesetId: "sengoku_edo", width: 18, height: 14,
    keywords: /도장|연무관|무림|dojo/iu,
    guide: { zones: "연무장 70% · 사범 서재 30%", focal: "족자와 신단", clusters: "목검·창 거치대 · 다다미", paths: "입구→연무장 중앙", rhythm: "거치대 리듬" },
    engine: { kind: "hand_interior", program: "dojo" },
  },
  {
    id: "beodeul-town", category: "fantasy_murim_dungeon", name: "버들항 마을", tilesetId: "beodeul_city", width: 56, height: 44,
    keywords: /마을|항구\s*마을|village|town/iu,
    guide: { zones: "광장 20% · 건물 45% · 길·물가 35%", focal: "광장 분수", clusters: "여관·상점·대장간", paths: "광장으로 모이는 길", rhythm: "가로수" },
    engine: { kind: "beodeul_town", themes: ["river", "coast", "city", "snow"], forms: ["riverbank", "plaza", "street", "scatter"], terrains: ["terraces", "flat", "hillside"] },
  },
  {
    id: "fantasy-dungeon", category: "fantasy_murim_dungeon", name: "고대 유적 던전", tilesetId: "beodeul_dungeon", width: 52, height: 36,
    keywords: /던전|유적|미궁|카타콤|dungeon/iu,
    guide: { zones: "입구 홀 · 갈림길 · 보물방 · 기믹방 · 보스방", focal: "보스 결전장", clusters: "보물상자 · 봉인 기믹", paths: "갈림길 회랑", rhythm: "횃불 간격" },
    engine: { kind: "dungeon", genres: ["중세 판타지 고대 유적", "지하 카타콤·봉인 신전", "화산 용암 성채 지하", "심해 침수 유적 미궁"], sizes: ["medium", "medium", "large"] },
  },
];

export function findSpaceBlueprint(id: string): SpaceBlueprint | undefined {
  return SPACE_BLUEPRINTS.find((bp) => bp.id === id);
}

/** 요청 문장과 가장 많이 맞는 청사진. 칩셋을 주면 그 칩셋 청사진만 본다. 낱말이 하나도 안 맞으면 undefined. */
export function matchSpaceBlueprint(request: string, tilesetId?: string): SpaceBlueprint | undefined {
  let best: SpaceBlueprint | undefined;
  let bestLen = 0;
  for (const bp of SPACE_BLUEPRINTS) {
    if (tilesetId && bp.tilesetId !== tilesetId) continue;
    const hit = request.match(bp.keywords);
    if (hit && hit[0].length > bestLen) { best = bp; bestLen = hit[0].length; }
  }
  return best;
}

/** 조수에게 보이는 청사진 한 줄 — 「구역 · 중심 · 무리 · 동선 · 리듬」. */
export function spaceBlueprintBrief(bp: SpaceBlueprint): string {
  const g = bp.guide;
  return `${bp.name}: 구역 ${g.zones} / 중심 ${g.focal} / 무리 ${g.clusters} / 동선 ${g.paths} / 리듬 ${g.rhythm}`;
}

export interface SpaceBlueprintComposeOptions {
  /** 사용자 요청 문장 — 규모(작은·대형)·분위기(아늑·모던·어두운)·선택 구역(카페·도서관·무기고…)을 읽는다. */
  readonly request: string;
  /** 고를 청사진. 없으면 request 로 고른다. */
  readonly blueprintId?: string;
  /** 같은 씨앗이면 같은 배치. 없으면 새 씨앗. */
  readonly seed?: number;
}

export interface SpaceBlueprintComposeResult {
  readonly blueprintId: string;
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly summary: string;
}

/** mapId 자리를 청사진 칩셋의 빈 맵으로 바꾼다(구성기 도구는 맵 칩셋이 맞아야 짓는다). 야외는 기존 이벤트를 맵 안으로 당겨 남긴다. */
function resetBlueprintMap(draft: Project, mapId: MapId, name: string, tilesetId: string, width: number, height: number, keepEvents = false): GameMap {
  const existing = draft.maps[mapId];
  const resolved = draft.tilesets[tilesetId] ? tilesetId : defaultOutdoorTilesetId(draft);
  const blank = createBlankMap(name, width, height, resolved, undefined, draft.tilesets[resolved]);
  blank.id = mapId;
  if (keepEvents && existing?.events.length) {
    blank.events = structuredClone(existing.events)
      .filter((ev) => !ev.id.startsWith(`${mapId}-link-`) && !ev.id.startsWith("ev_mc_enter_"))
      .map((ev) => ({ ...ev, x: Math.max(1, Math.min(width - 2, ev.x)), y: Math.max(1, Math.min(height - 2, ev.y)) }));
  }
  draft.maps[mapId] = blank;
  return blank;
}

// 도구 레지스트리가 getTool 을 묶어 준다 — 레지스트리 ↔ compose_space_blueprint 도구 ↔ 이 모듈의 순환 import 를 끊는다(themeScenes 와 같은 방식).
let lookup: (name: string) => ToolDefinition | undefined = () => undefined;
export function bindSpaceBlueprintToolLookup(fn: (name: string) => ToolDefinition | undefined): void { lookup = fn; }

function runTool(draft: Project, name: string, args: Record<string, unknown>): string {
  const tool = lookup(name);
  if (!tool) throw new Error(`${name} 도구를 찾을 수 없습니다.`);
  return tool.run(draft, args).summary;
}

/**
 * 청사진을 참고해 draft 의 mapId 에 공간을 새로 짓는다 — 같은 청사진이라도 요청 뉘앙스와 씨앗에 따라 방 비율·좌우·구역·가구 무리·팔레트가 달라진다.
 * 맵은 청사진 칩셋의 새 맵으로 갈아 끼운다(이름만 유지).
 */
export function composeSpaceFromBlueprintOnDraft(draft: Project, mapId: MapId, options: SpaceBlueprintComposeOptions): SpaceBlueprintComposeResult {
  const bp = options.blueprintId ? findSpaceBlueprint(options.blueprintId) : matchSpaceBlueprint(options.request);
  if (!bp) throw new Error(`요청 「${options.request}」에 맞는 공간 청사진이 없습니다 — ${SPACE_BLUEPRINTS.map((b) => b.name).join(", ")}`);
  const seed = Math.max(0, Math.floor(options.seed ?? Math.random() * 10_000));
  const name = options.request.trim() || draft.maps[mapId]?.name || bp.name;
  const pick = <T>(xs: readonly T[], salt: number): T => xs[(seed + salt) % xs.length]!;
  const grand = /대형|거대|웅장|넓은|큰|grand|large/iu.test(options.request);
  const compact = /작은|아담|소형|좁은|compact|small/iu.test(options.request);
  const scaled = (n: number) => Math.round(n * (grand ? 1.2 : compact ? 0.85 : 1));
  const e = bp.engine;
  let summary: string;
  switch (e.kind) {
    case "hand_interior":
      resetBlueprintMap(draft, mapId, name, bp.tilesetId, bp.width, bp.height);
      summary = runTool(draft, "build_hand_interior_room", { mapId, name, tileset: bp.tilesetId, replace: true, layout: { program: e.program, seed, variant: seed % 4 } });
      break;
    case "riverside_promenade": {
      const target = resetBlueprintMap(draft, mapId, name, bp.tilesetId, scaled(bp.width) + (seed % 3) * 2, Math.max(15, scaled(bp.height) + (seed % 2) * 2), true);
      paintRiversidePromenade(draft, target, { seed });
      summary = `강변 산책로 '${name}' (${target.width}×${target.height}, 씨앗 ${seed})`;
      break;
    }
    case "modern_city_street":
      resetBlueprintMap(draft, mapId, name, bp.tilesetId, Math.max(48, scaled(bp.width)), Math.max(36, scaled(bp.height)), true);
      summary = runTool(draft, "compose_modern_city_street", { mapId, replace: true, seed, shops: [...pick(e.shopPools, 0)] });
      break;
    case "jp_city_street":
      resetBlueprintMap(draft, mapId, name, bp.tilesetId, Math.max(44, scaled(bp.width)), Math.max(30, scaled(bp.height)), true);
      summary = runTool(draft, "compose_jp_city_street", { mapId, replace: true, style: pick(e.styles, 0), seed, shops: [...pick(e.shopPools, 1)] });
      break;
    case "campus_grounds": {
      const style = /고등|중학|학교/u.test(options.request) ? "school" : /대학/u.test(options.request) ? "university" : pick(e.styles, 0);
      resetBlueprintMap(draft, mapId, name, bp.tilesetId, style === "university" ? 52 : 44, style === "university" ? 40 : 34, true);
      summary = runTool(draft, "compose_campus_grounds", { mapId, replace: true, style, seed });
      break;
    }
    case "beodeul_town": {
      const w = Math.max(48, scaled(bp.width)), h = Math.max(38, scaled(bp.height));
      resetBlueprintMap(draft, mapId, name, bp.tilesetId, w, h);
      // 요청 문구가 기후·물가를 말하면 그 theme, 아니면 씨앗. form·terrain 은 엔진이 그 theme 에 허용하는 것만 고른다
      // (씨앗 7 이 snow + riverbank 를 골라 시공이 터졌다 — 2026-10-18 VQA 4회차).
      const theme = /눈|설원|겨울|snow/iu.test(options.request) ? "snow" : /바다|포구|항구|해안|coast|harbou?r/iu.test(options.request) ? "coast" : /강가|강변|river/iu.test(options.request) ? "river" : /도시|성곽|city/iu.test(options.request) ? "city" : pick(e.themes, 0);
      // 형태도 요청을 먼저 읽는다. 흩어진(scatter) 마을은 56×44 맵에 집 한 줄만 서고 남쪽 45% 가 빈 설원이 됐다
      // (2026-10-18 사용자 반려 「눈 덮인 마을은 엉망진창」) — 요청이 외딴·흩어진 마을을 말할 때만 고른다.
      const askedForm = /광장|plaza/iu.test(options.request) ? "plaza" : /거리|상점가|street/iu.test(options.request) ? "street" : /흩어진|외딴|산골|scatter/iu.test(options.request) ? "scatter" : /강둑|물가|riverbank/iu.test(options.request) ? "riverbank" : undefined;
      const villageArgs = theme === "city" ? {} : (() => {
        const allowedForms = e.forms.filter((f) => allowedVillageForms(theme).includes(f));
        return {
          form: askedForm && allowedForms.includes(askedForm) ? askedForm : pick(allowedForms.filter((f) => f !== "scatter"), 1),
          terrain: pick(e.terrains.filter((t) => allowedVillageTerrains(theme).includes(t)), 2),
        };
      })();
      summary = runTool(draft, "author_beodeul_town", { mapId, name, width: w, height: h, theme, ...villageArgs, seed });
      break;
    }
    case "dungeon":
      resetBlueprintMap(draft, mapId, name, bp.tilesetId, bp.width, bp.height);
      summary = runTool(draft, "author_dungeon", { mapId, name, genre: pick(e.genres, 0), size: grand ? "large" : compact ? "small" : pick(e.sizes, 1), seed });
      break;
  }
  const built = draft.maps[mapId]!;
  built.name = name;
  return { blueprintId: bp.id, seed, width: built.width, height: built.height, summary };
}

/** 렌더·시험용: 빈 프로젝트 사본에 청사진 하나를 지어 돌려준다. */
export function composeSpaceFromBlueprint(base: Project, options: SpaceBlueprintComposeOptions & { readonly mapId?: MapId }): { readonly project: Project; readonly mapId: MapId; readonly result: SpaceBlueprintComposeResult } {
  const draft = createDraft(base);
  const mapId = options.mapId ?? ("map_blueprint" as MapId);
  const result = composeSpaceFromBlueprintOnDraft(draft, mapId, options);
  finishDraftTilesets(draft);
  return { project: draft, mapId, result };
}
