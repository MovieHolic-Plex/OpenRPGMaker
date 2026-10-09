// 영역 다듬기의 지시문 — "이 사각형을 주변에 이어붙인 듯 보이게 다시 짜라" 를 모델에게 준다.
//
// 일반 영역 작업과 무엇이 다른가:
//   - 무엇을 만들지가 아니라 **주변에 맞추는 것**이 목표다. 그래서 주변 브리핑
//     (regionSurroundings)이 지시의 본문이고, 연결 지점 좌표가 검사 항목이 된다.
//   - 영역 안 전권이다. 타일은 전부 갈아도 되고 이벤트는 옮기거나 지워도 된다
//     (사용자 결정 2026-08-31). 되돌리기는 승인 게이트 + undo 1개가 보장한다.
//
// 순수 함수. runRegionTask 에 의존하지 않는다 — 재료 라벨 힌트·의도 가이드는 호출부가 넣어 준다
// (그쪽이 타일셋 어휘를 아는 곳이고, 여기서 되짚으면 import 순환이 된다).
import type { MapId } from "@/project/types";
import type { RegionRect } from "./clipToRegion";
import { formatRegionSurroundingsBrief, type RegionSurroundings } from "./regionSurroundings";

/**
 * 자유 입력이 다듬기 경로인가. **명시적 어휘만** 잡는다 —
 * "자연스럽게 흩뿌려줘"(기존 꽃밭 칩) 같은 문장까지 삼키면 소품 산포 요청이
 * 전권 재구성으로 바뀐다.
 */
export const POLISH_KEYWORDS: readonly string[] = [
  "어울리", "어울려", "어우러", "조화롭", "주변과", "주변에 맞", "이음새", "경계 다듬", "polish",
];

export function isRegionPolishRequest(instruction: string): boolean {
  const normalized = instruction.toLowerCase().replace(/\s+/g, " ");
  if (!normalized.trim()) return false;
  return POLISH_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export interface RegionPolishMessageInput {
  readonly instruction: string;
  readonly mapName: string;
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly surroundings: RegionSurroundings | null;
  /** runRegionTask.formatMaterialLabelHint 결과 — 이 맵 타일셋에서 쓸 수 있는 재료 라벨. */
  readonly materialHint: string;
  /** regionIntentGuideLines 결과 등 추가 가이드 줄. */
  readonly extraGuides?: readonly string[];
}

/**
 * 다듬기 한 턴의 사용자 메시지.
 *
 * footer 는 일반 영역 작업과 **같은 포맷**을 유지한다 — buildSpec 의 정규식이 이 라인을 파싱해
 * 선택 영역을 이번 턴의 암묵적 명세로 잡는다. 포맷이 달라지면 구간 격리가 조용히 꺼진다.
 */
export function buildRegionPolishMessage(input: RegionPolishMessageInput): string {
  const { region, mapId, mapName } = input;
  const footer = `[컨텍스트] 현재 맵: ${mapName} (${mapId}) · 사용자 선택 영역: (${region.x},${region.y}) ${region.width}×${region.height}`;
  const brief = input.surroundings ? formatRegionSurroundingsBrief(input.surroundings) : "";
  const crossings = input.surroundings?.crossings ?? [];
  const entrances = input.surroundings?.entrances ?? [];

  const authority = [
    "이번 작업은 「다듬기」다 — 새로 무엇을 세우는 것이 아니라, 이 영역이 주변에 이어붙인 듯 보이게 만드는 것이 목표다.",
    "영역 안에서는 전권이다:",
    "- 바닥·지형을 전부 갈아도 된다 (fill_region / paint_road / tile_erase). 주변 우세 재료를 영역 안까지 끌고 들어와라",
    "- 소품은 다시 배치해도 된다 (place_props). 주변에 나무가 있으면 영역 경계 쪽에도 나무를 물려 심어 띠가 끊기지 않게 한다",
    "- 영역 안 이벤트(NPC·상자)는 move_event 로 옮기거나 필요하면 지워도 된다. 단 **영역 밖으로는 옮기지 말 것** — 밖으로 나간 좌표는 원위치로 되돌려진다",
    "지켜야 할 것:",
    "- 영역 밖 타일·이벤트는 수정하지 말 것 (경계 오토타일 이음새는 시스템이 자동으로 마감한다)",
    "- 주변에 없는 재료를 새로 들여오지 말 것. 지금 주변에 깔린 재료로 맞춰라",
    "- 통행을 막지 말 것 — 바깥에서 걸어 들어오는 칸은 영역 안에서도 걸을 수 있어야 한다",
  ];
  if (crossings.length > 0) {
    const road = crossings.filter((crossing) => crossing.kind === "road");
    const water = crossings.filter((crossing) => crossing.kind === "water");
    if (road.length > 0) {
      authority.push(
        `- 길 연결 필수: ${road.slice(0, 6).map((point) => `(${point.x},${point.y})`).join(" ")} 칸은 영역 안에서 길로 이어져야 한다. paint_road 의 points 에 이 좌표를 포함시켜라`,
      );
    }
    if (water.length > 0) {
      authority.push(
        `- 물 연결 필수: ${water.slice(0, 6).map((point) => `(${point.x},${point.y})`).join(" ")} 칸은 영역 안에서도 물이어야 한다. 물 위에는 소품·NPC 를 놓지 말 것`,
      );
    }
  }
  if (entrances.length > 0) {
    authority.push(
      `- 진입 유지: ${entrances.slice(0, 8).map((point) => `(${point.x},${point.y})`).join(" ")} 는 통행 가능해야 한다`,
    );
  }

  const toolGuide = [
    "다듬기 도구 규칙:",
    "- 먼저 get_map_region 으로 영역과 그 주변을 한 번 확인한 뒤 손대라(아래 브리핑으로 부족할 때만)",
    "- 지면/수역: fill_region { material:\"잔디\"|\"물\" … } — 원형·둥근 지형은 shape=circle",
    "- 길: paint_road { mapId, style:\"dirt\"|\"sand\", points:[{x,y},…] }",
    "- 소품: place_props + material(타일 라벨, 예 \"침엽수\"·\"꽃\"). 그룹 id·가방 금지. 물 칸 위 금지. 숲=density:\"dense\", 울창/통행 불가=density:\"impassable\"(문장을 코드가 읽지 않음)",
    input.materialHint,
    `- tile_query ask:"labels" 는 mapId:"${mapId}" 를 넣어 이 맵 타일셋 라벨만 조회`,
    ...(input.extraGuides ?? []),
    "- 새 맵을 만들지 말 것 (create_map / duplicate_map / start_interior_room_session 금지). 대상은 지금 열린 이 맵뿐이다",
    "- 지원하지 않는 요청 부분은 시도하지 말고, 마지막 응답에 '못 한 것: …' 한 줄로 명시하라",
    "- 결과는 사용자 승인 후에만 반영된다. propose_tile_vocabulary 댄스는 하지 말 것",
  ];

  // 도메인 시드 — 도구 노출 스코핑용 키워드(assistantToolMode). 다듬기는 타일·소품·이벤트 축이다.
  const domainSeed = "(영역 다듬기: 타일 지형 길 물 나무 소품 이벤트 npc)";
  return [
    input.instruction.trim(),
    "",
    domainSeed,
    authority.join("\n"),
    "",
    toolGuide.join("\n"),
    ...(brief ? ["", brief] : []),
    "",
    "이 작업은 아래 선택 영역 안에서만 수행하라.",
    footer,
  ].join("\n");
}
