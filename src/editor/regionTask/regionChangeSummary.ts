// 영역 작업 제안의 **타일이 아닌 변경**을 사람이 읽을 목록으로 만든다.
//
// 왜 필요한가: 승인 UI 가 타일 모양이었다. 미리보기는 타일 스냅샷이고(이벤트는 파란 점 하나),
// 부분 적용 트리는 lowerTiles/upperTiles 만 본다. 그래서 AI 가 상인을 배치하거나 조명을 바꾸면
// before/after 그림이 거의 같아 "아무것도 안 했다"로 읽혔다. 요약에는 "이벤트 N건" 숫자만 떴다.
//
// 그리고 더 중요한 문제: clipToRegion 은 **지정 사각형 밖의 타일·이벤트만** 되돌린다
// (그 파일 헤더가 직접 밝힌다 — "다른 맵·타일셋·그룹 등 프로젝트 변경은 통과시킨다").
// 즉 아이템 신규 등록, 퀘스트 정의, create_transfer_pair 의 상대 맵 변경은 미리보기도 승인도
// 없이 그대로 반영된다. 최소한 목록에 드러내야 한다.
//
// 순수 함수 — store/DOM 의존 없음.
import { eventDisplayName } from "@/editor/eventMarkerUx";
import type { SvgIconName } from "@/editor/panels/tileToolbarIcons";
import type { GameEvent, MapId, Project } from "@/project/types";
import type { RegionRect } from "./clipToRegion";
import { inRegion } from "./clipToRegion";

export type RegionEventChangeKind = "added" | "removed" | "moved" | "modified";

export interface RegionEventChange {
  readonly kind: RegionEventChangeKind;
  readonly eventId: string;
  readonly name: string;
  /** 맵 좌표(절대). 영역 로컬 좌표가 필요하면 호출부가 region 으로 환산한다. */
  readonly x: number;
  readonly y: number;
  /** 목록 앞에 붙일 아이콘 — 무엇이 놓이는지 한눈에. */
  readonly icon: SvgIconName;
}

const KIND_LABEL: Readonly<Record<RegionEventChangeKind, string>> = {
  added: "새로 놓임",
  removed: "지워짐",
  moved: "옮겨짐",
  modified: "내용 바뀜",
};

export function regionEventChangeLabel(change: RegionEventChange): string {
  return `${change.name} (${change.x},${change.y}) — ${KIND_LABEL[change.kind]}`;
}

/**
 * 이벤트 종류를 이름·명령에서 추정해 아이콘을 고른다.
 * 정확한 분류가 목적이 아니라 목록에서 서로 구분되게 하는 것이 목적이다 —
 * 못 알아보면 일반 이벤트(pin)로 둔다.
 */
function eventIcon(event: GameEvent, name: string): SvgIconName {
  const haystack = `${event.id} ${name}`.toLowerCase();
  if (/(chest|보물|상자)/.test(haystack)) return "chest";
  if (/(save|세이브|저장)/.test(haystack)) return "save";
  if (/(trap|함정)/.test(haystack)) return "warning";
  if (/(door|transfer|입구|출구|계단|포탈)/.test(haystack)) return "door";
  if (/(sign|표지판|제단|사당)/.test(haystack)) return "sign";
  if (/(shop|상점|상인|잡화)/.test(haystack)) return "shop";
  if (/(npc|villager|주민|경비|손님|guard)/.test(haystack)) return "npc";
  // sprite 가 있으면 캐릭터로 본다(대부분 NPC).
  if (event.sprite) return "npc";
  return "pin";
}

/** 두 이벤트가 좌표 말고 내용이 같은가. 좌표만 다르면 "옮겨짐"으로 본다. */
function sameEventContent(a: GameEvent, b: GameEvent): boolean {
  const strip = (event: GameEvent): string => {
    const { x: _x, y: _y, draft: _draft, ...rest } = event;
    return JSON.stringify(rest);
  };
  return strip(a) === strip(b);
}

/**
 * 영역 안 이벤트의 추가/삭제/이동/수정을 목록으로. base/proposed 는 변형하지 않는다.
 *
 * 영역 밖으로 나간/들어온 이벤트도 잡는다: 한쪽에서만 영역 안이면 그 자체가 변경이다.
 * (clipToRegion 이 영역 밖 이벤트는 base 로 되돌리므로, 실제로 남는 변경만 여기 보인다.)
 */
export function summarizeRegionEventChanges(
  base: Project,
  proposed: Project,
  mapId: MapId,
  region: RegionRect,
): RegionEventChange[] {
  const baseEvents = base.maps[mapId]?.events ?? [];
  const nextEvents = proposed.maps[mapId]?.events ?? [];
  const baseById = new Map(baseEvents.map((event) => [event.id, event]));
  const nextById = new Map(nextEvents.map((event) => [event.id, event]));
  const changes: RegionEventChange[] = [];

  for (const event of nextEvents) {
    const before = baseById.get(event.id);
    const insideNow = inRegion(event.x, event.y, region);
    if (!before) {
      if (insideNow) {
        const name = eventDisplayName(event);
        changes.push({ kind: "added", eventId: event.id, name, x: event.x, y: event.y, icon: eventIcon(event, name) });
      }
      continue;
    }
    const insideBefore = inRegion(before.x, before.y, region);
    if (!insideNow && !insideBefore) continue;
    if (before.x !== event.x || before.y !== event.y) {
      const name = eventDisplayName(event);
      changes.push({ kind: "moved", eventId: event.id, name, x: event.x, y: event.y, icon: eventIcon(event, name) });
      continue;
    }
    if (!sameEventContent(before, event)) {
      const name = eventDisplayName(event);
      changes.push({ kind: "modified", eventId: event.id, name, x: event.x, y: event.y, icon: eventIcon(event, name) });
    }
  }

  for (const event of baseEvents) {
    if (nextById.has(event.id)) continue;
    if (!inRegion(event.x, event.y, region)) continue;
    const name = eventDisplayName(event);
    changes.push({ kind: "removed", eventId: event.id, name, x: event.x, y: event.y, icon: eventIcon(event, name) });
  }

  // 목록 순서는 좌표순 — 같은 입력에 같은 순서(스냅샷 테스트 안정성).
  return changes.sort((a, b) => (a.y - b.y) || (a.x - b.x) || a.eventId.localeCompare(b.eventId));
}

export interface RegionOutsideChange {
  /** 어떤 최상위 항목이 바뀌었나(디버그·테스트용 키). */
  readonly kind: string;
  /** 사용자에게 보일 한 줄. */
  readonly label: string;
}

/** 배열/레코드의 개수 차이를 "N개 → M개" 로. 개수가 같으면 undefined(내용만 바뀐 경우). */
function countDelta(before: unknown, after: unknown): string | undefined {
  const size = (value: unknown): number | null => {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
    return null;
  };
  const a = size(before);
  const b = size(after);
  if (a === null || b === null || a === b) return undefined;
  return `${a}개 → ${b}개`;
}

// 검사 대상 — 게임 내용에 영향을 주는 최상위 항목만.
// 일부러 제외한 것:
//   tilesets  : clipToRegion 이 "배치에 필요한 그룹 정의"로 통과시키는 보조 데이터.
//               타일 어휘 도구가 거의 매번 손대므로 경고로 띄우면 소음이 되어 무시하게 된다.
//   aiDocuments: present_doc 산출물(설명 문서) — 게임 내용이 아니다.
//   session   : 런타임 상태.
const OUTSIDE_FIELDS: readonly { readonly key: keyof Project; readonly label: string }[] = [
  { key: "database", label: "데이터베이스(아이템·적·스킬 등)" },
  { key: "quests", label: "퀘스트 정의" },
  { key: "storyFlags", label: "스토리 플래그" },
  { key: "switches", label: "스위치" },
  { key: "variables", label: "변수" },
  { key: "commonEvents", label: "공통 이벤트" },
  { key: "endings", label: "엔딩" },
  { key: "mapConnections", label: "맵 연결" },
  { key: "characters", label: "캐릭터 프로필" },
  { key: "world", label: "월드 설정" },
  { key: "worldGraph", label: "월드 그래프" },
  { key: "mapTree", label: "맵 트리" },
];

/**
 * **지정 영역 밖**에서 일어나는 변경 목록. clipToRegion 이 되돌리지 않고 통과시키는 것들이다.
 * 비어 있으면 이 제안은 정말로 그 사각형 안에서만 끝난다.
 */
export function summarizeOutsideRegionChanges(
  base: Project,
  proposed: Project,
  mapId: MapId,
): RegionOutsideChange[] {
  const changes: RegionOutsideChange[] = [];

  // 대상 맵을 뺀 다른 맵들 — 신규 생성/삭제/변경.
  const baseMapIds = Object.keys(base.maps ?? {}).filter((id) => id !== mapId);
  const nextMapIds = Object.keys(proposed.maps ?? {}).filter((id) => id !== mapId);
  const addedMaps = nextMapIds.filter((id) => !baseMapIds.includes(id));
  const removedMaps = baseMapIds.filter((id) => !nextMapIds.includes(id));
  const touchedMaps = nextMapIds.filter(
    (id) => baseMapIds.includes(id) && JSON.stringify(base.maps[id]) !== JSON.stringify(proposed.maps[id]),
  );
  for (const id of addedMaps) {
    changes.push({ kind: "map-added", label: `새 맵 "${proposed.maps[id]?.name ?? id}"` });
  }
  for (const id of removedMaps) {
    changes.push({ kind: "map-removed", label: `맵 삭제 "${base.maps[id]?.name ?? id}"` });
  }
  for (const id of touchedMaps) {
    changes.push({ kind: "map-changed", label: `다른 맵 변경 "${proposed.maps[id]?.name ?? id}"` });
  }

  for (const field of OUTSIDE_FIELDS) {
    const before = base[field.key];
    const after = proposed[field.key];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const delta = countDelta(before, after);
    changes.push({ kind: String(field.key), label: delta ? `${field.label} ${delta}` : `${field.label} 변경` });
  }

  return changes;
}
