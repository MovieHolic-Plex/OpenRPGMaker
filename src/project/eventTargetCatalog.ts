// project/eventTargetCatalog.ts — 「이동 경로 설정(moveEvent)」 대상의 **공용** 카탈로그·해석기.
//
// 왜 한 곳인가 (OPRN-OUT-012): 이 대상을 정하는 저작 경로가 셋(조수 프롬프트 · 조수 출력 검증 ·
// 수동 편집기)인데 셋이 서로를 몰랐다. 그래서 조수는 `eventId:"this"` 를 냈고(현재 맵 이벤트
// 목록도, 특수값 계약도 프롬프트에 없었다), 검증은 moveEvent 대상을 아예 보지 않았고,
// 수동 편집기는 자유 입력 상자만 줘서 사용자가 `ev_npc_…` 를 손으로 찾아 붙여넣어야 했다.
// 실측 증상: 스튜디오 요약 «이동 경로 설정 this (없음)», 테스트 플레이에서 대상 NPC 정지.
// 목록을 셋으로 나눠 만들면 같은 결함이 되살아난다 — 세 소비자가 이 파일 하나를 본다.
//
// 저장 형태(정본)는 바꾸지 않는다:
//   ""              = 이 이벤트 (명령을 실행하는 이벤트 자신)
//   "@player"       = 주인공 (PLAYER_MOVE_TARGET)
//   그 외 문자열     = 이 맵의 이벤트 id
// 런타임(playSceneSchedulers.registerAutonomousMover)은 **현재 맵**의 이벤트만 움직인다.
// 그래서 다른 맵의 id 는 「문법상 그럴듯한데 절대 안 움직이는」 값이고, 여기서 따로 지목한다.
import { eventDisplayName } from "@/project/eventDisplayName";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import type { GameEvent, Project } from "@/project/types";

/** 「이 이벤트」의 저장 형태. 빈 문자열이 정본이며 `"this"` 같은 낱말은 대상이 아니다. */
export const THIS_EVENT_MOVE_TARGET = "";

/** 목록/프롬프트에 실을 상한. 프롬프트 예산을 지키고, 편집기 드롭다운도 같은 상한을 쓴다. */
export const MAX_EVENT_TARGET_ENTRIES = 40;

export type EventTargetEntry = {
  /** 저장되는 정본 id (`event.id`). */
  readonly id: string;
  /** 표시 이름(`eventDisplayName`) 그대로. */
  readonly name: string;
  /** 이름이 겹칠 때 좌표까지 붙인 구분 라벨. 겹치지 않으면 `name` 과 같다. */
  readonly label: string;
  readonly x: number;
  readonly y: number;
};

/** 다른 맵에 있는 이벤트. 이동 경로로는 움직일 수 없지만 «어디 있는지»는 말해 줘야 한다. */
export type ForeignEventTarget = {
  readonly id: string;
  readonly name: string;
  readonly mapId: string;
  readonly mapName: string;
};

export type EventTargetCatalog = {
  readonly mapId: string;
  readonly mapName: string;
  readonly entries: readonly EventTargetEntry[];
  readonly foreign: readonly ForeignEventTarget[];
};

export type MoveTargetResolution =
  | { readonly kind: "this"; readonly storedValue: typeof THIS_EVENT_MOVE_TARGET }
  | { readonly kind: "player"; readonly storedValue: typeof PLAYER_MOVE_TARGET }
  | { readonly kind: "event"; readonly storedValue: string; readonly entry: EventTargetEntry }
  | {
      readonly kind: "unresolved";
      /** 저장돼 있던 값을 그대로 돌려준다 — 해석 실패는 값을 버릴 이유가 아니다. */
      readonly storedValue: string;
      readonly reason: "unknown" | "ambiguous" | "foreignMap";
      readonly candidates: readonly EventTargetEntry[];
      readonly foreign?: ForeignEventTarget;
    };

// 조수·사람이 «이 이벤트»/«주인공»을 뜻하며 실제로 써 온 낱말들. 실측 결함이 `"this"` 였다.
// 정본 id 대조를 **먼저** 하므로, 하필 id 가 "self" 인 이벤트가 있어도 그 이벤트가 이긴다.
const THIS_ALIASES = new Set(["this", "thisevent", "this_event", "self", "me", "이이벤트", "이벤트자신", "자신"]);
const PLAYER_ALIASES = new Set(["player", "hero", "주인공", "플레이어", "영웅"]);

function aliasKey(raw: string): string {
  // 선행 `@` 는 센티넬 흉내(`@this`)라 벗기고, 대소문자·공백은 무시한다.
  return raw.trim().replace(/^@/u, "").replace(/\s+/gu, "").toLowerCase();
}

function entriesOf(events: readonly GameEvent[]): readonly EventTargetEntry[] {
  const names = new Map<string, number>();
  for (const event of events) {
    const name = eventDisplayName(event);
    names.set(name, (names.get(name) ?? 0) + 1);
  }
  return events.map((event) => {
    const name = eventDisplayName(event);
    // 이름이 겹치면 좌표를 붙인다. 같은 이름 둘이 목록에 나란히 뜨면 어느 쪽인지 고를 수 없다.
    const label = (names.get(name) ?? 0) > 1 ? `${name} (${event.x},${event.y})` : name;
    return { id: event.id, name, label, x: event.x, y: event.y };
  });
}

/**
 * 현재 맵 기준 대상 카탈로그.
 *
 * @param mapId 이동 경로가 실제로 돌아갈 맵. 런타임이 이 맵의 이벤트만 움직인다.
 */
export function buildEventTargetCatalog(project: Project, mapId: string): EventTargetCatalog {
  const map = project.maps[mapId];
  const foreign: ForeignEventTarget[] = [];
  for (const [otherId, otherMap] of Object.entries(project.maps)) {
    if (otherId === mapId) continue;
    for (const event of otherMap.events ?? []) {
      foreign.push({
        id: event.id,
        name: eventDisplayName(event),
        mapId: otherId,
        mapName: otherMap.name || otherId,
      });
    }
  }
  return {
    mapId,
    mapName: map?.name || mapId,
    entries: entriesOf(map?.events ?? []),
    foreign,
  };
}

/** 저장값(또는 조수가 낸 값) 하나를 해석한다. 값을 절대 버리지 않는다. */
export function resolveMoveTarget(raw: string, catalog: EventTargetCatalog): MoveTargetResolution {
  if (raw === THIS_EVENT_MOVE_TARGET) return { kind: "this", storedValue: THIS_EVENT_MOVE_TARGET };
  if (raw === PLAYER_MOVE_TARGET) return { kind: "player", storedValue: PLAYER_MOVE_TARGET };

  // 1) 정본 id 우선. 별칭·이름 규칙이 실재하는 id 를 가리는 일이 없어야 한다.
  const exact = catalog.entries.find((entry) => entry.id === raw);
  if (exact) return { kind: "event", storedValue: exact.id, entry: exact };

  // Exact foreign IDs also precede aliases/names: an event named by ID must
  // never silently become the executing event, player, or a local namesake.
  const foreign = catalog.foreign.find((entry) => entry.id === raw);
  if (foreign) {
    return { kind: "unresolved", storedValue: raw, reason: "foreignMap", candidates: [], foreign };
  }

  // 2) 별칭(특수값의 사람 말). 조수가 실제로 냈던 `"this"` 가 여기서 잡힌다.
  const key = aliasKey(raw);
  if (THIS_ALIASES.has(key)) return { kind: "this", storedValue: THIS_EVENT_MOVE_TARGET };
  if (PLAYER_ALIASES.has(key)) return { kind: "player", storedValue: PLAYER_MOVE_TARGET };

  // 3) 표시 이름. 유일할 때만 옮긴다 — 둘 이상이면 사람이 골라야 하는 모호다.
  const trimmed = raw.trim().toLowerCase();
  const byName = catalog.entries.filter((entry) => entry.name.trim().toLowerCase() === trimmed);
  if (byName.length === 1) return { kind: "event", storedValue: byName[0].id, entry: byName[0] };
  if (byName.length > 1) {
    return { kind: "unresolved", storedValue: raw, reason: "ambiguous", candidates: byName };
  }

  return { kind: "unresolved", storedValue: raw, reason: "unknown", candidates: [] };
}

/** 해석 가능하면 저장할 정본값, 아니면 null. 저작 경로 셋이 같은 값을 쓰게 하는 지점이다. */
export function canonicalMoveTargetValue(raw: string, catalog: EventTargetCatalog): string | null {
  const resolved = resolveMoveTarget(raw, catalog);
  return resolved.kind === "unresolved" ? null : resolved.storedValue;
}

/** 검색: 표시 이름과 id 를 **둘 다** 맞춘다. 빈 질의는 전체(상한까지). */
export function matchEventTargets(
  catalog: EventTargetCatalog,
  query: string,
  limit = MAX_EVENT_TARGET_ENTRIES,
): readonly EventTargetEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return catalog.entries.slice(0, limit);
  return catalog.entries
    .filter((entry) => `${entry.id} ${entry.name} ${entry.label}`.toLowerCase().includes(needle))
    .slice(0, limit);
}

function candidateList(catalog: EventTargetCatalog, limit = 8): string {
  const shown = catalog.entries.slice(0, limit);
  if (shown.length === 0) return "(이 맵에는 이동시킬 다른 이벤트가 없습니다)";
  const rest = catalog.entries.length - shown.length;
  const body = shown.map((entry) => `${entry.id}(${entry.label})`).join(", ");
  return rest > 0 ? `${body} …외 ${rest}개` : body;
}

/**
 * 사람과 자가수정 루프가 **그대로 실행할 수 있는** 진단 문구.
 * 무엇이 틀렸는지 + 특수값 둘 + 이 맵의 후보 id 를 한 문장에 담는다.
 */
export function moveTargetIssueMessage(raw: string, catalog: EventTargetCatalog): string {
  const resolved = resolveMoveTarget(raw, catalog);
  if (resolved.kind !== "unresolved") return "";
  const contract = `이 이벤트 자신은 ""(빈 문자열), 주인공은 "${PLAYER_MOVE_TARGET}" 를 씁니다.`;
  switch (resolved.reason) {
    case "foreignMap":
      return (
        `이동 대상 «${raw}» 는 다른 맵 «${resolved.foreign?.mapName ?? "?"}» 의 이벤트라 ` +
        `이 맵(«${catalog.mapName}»)의 이동 경로로는 움직이지 않습니다. ` +
        `이 맵의 이벤트 id 중에서 고르세요: ${candidateList(catalog)}`
      );
    case "ambiguous":
      return (
        `이동 대상 «${raw}» 라는 이름의 이벤트가 이 맵에 ${resolved.candidates.length}개 있습니다. ` +
        `id 로 지목하세요: ${resolved.candidates.map((entry) => `${entry.id}(${entry.label})`).join(", ")}`
      );
    default:
      return (
        `이동 대상 «${raw}» 는 맵 «${catalog.mapName}» 의 이벤트가 아닙니다. ${contract} ` +
        `다른 이벤트를 움직이려면 이 맵의 id 를 쓰세요: ${candidateList(catalog)}`
      );
  }
}

/** 조수 프롬프트 절. 특수값 둘 + 현재 맵 이벤트 목록을 함께 싣는다. */
export function moveTargetPromptSection(catalog: EventTargetCatalog): string {
  const lines = catalog.entries
    .slice(0, MAX_EVENT_TARGET_ENTRIES)
    .map((entry) => `- ${entry.id}: ${entry.label} (x=${entry.x}, y=${entry.y})`);
  if (catalog.entries.length > MAX_EVENT_TARGET_ENTRIES) {
    lines.push(`- …외 ${catalog.entries.length - MAX_EVENT_TARGET_ENTRIES}개 생략(위 목록의 id만 사용)`);
  }
  return [
    "## 이동 경로 설정(moveEvent)의 대상 — eventId 는 아래 셋 중 하나만 쓴다",
    '1. 명령을 실행하는 이벤트 자신: `""` (빈 문자열). "this"·"self" 같은 낱말은 대상이 아니다.',
    `2. 주인공(플레이어): \`"${PLAYER_MOVE_TARGET}"\``,
    "3. 이 맵의 다른 이벤트: 아래 목록의 id 를 **그대로 복사**한다. 이름이나 추측 id 금지.",
    `### 맵 «${catalog.mapName}» 의 이벤트 id`,
    ...(lines.length ? lines : ["- (없음 — 다른 이벤트를 대상으로 삼는 moveEvent 를 만들지 말 것)"]),
    "다른 맵의 이벤트는 이 명령으로 움직일 수 없다.",
  ].join("\n");
}
