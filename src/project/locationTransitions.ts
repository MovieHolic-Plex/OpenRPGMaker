// project/locationTransitions.ts
// 명명 로케이션의 **드나듦(enter/leave)** 판정. 순수 함수만 둔다(브라우저 전역·store 접근 금지).
//
// ## 왜 별도 모듈이고, 왜 기하는 여기서 다시 계산하지 않는가
//
// 「안에 있는가」의 규칙은 `mapNamedLocations.pointInLocation` 하나뿐이다(OPRN-OUT-020).
// 드나듦은 그 규칙의 **시간 미분**이다 — 새 내부/외부 판정을 만들면 조건(`insideLocation`)과
// 트리거가 서로 다른 답을 내는 순간이 생긴다. 그래서 이 모듈은 점유 집합을
// `locationsAtPoint` 로만 구하고, 두 집합의 차집합만 계산한다.
//
// ## 상태를 왜 세션에 두는가 (그리고 사각형은 왜 안 두는가)
//
// 드나듦은 «직전에 어디 안에 있었나» 를 알아야 한다. 그 «직전» 은 세이브를 건너 살아야
// 한다(안에서 저장하고 불러오면 다시 들어온 것이 아니다). 그래서 세션에
// `occupiedLocationIds[mapId] = [locationId…]` — **ID 만** 담는다. 사각형을 복사해 두면
// 저작자가 로케이션을 옮긴 뒤에도 세이브 안의 낡은 사각형이 판정을 지배한다
// (`insideLocation` 이 프로젝트에서 기하를 읽는 것과 같은 이유다).
//
// ## 결정된 경계 사례 (전부 회귀 테스트가 있다: test/locationTransitions.test.ts)
//
// | 상황 | 계약 | 근거 |
// |---|---|---|
// | 같은 칸에서 다시 «들어옴» 판정 | 발동하지 않는다 | 점유 집합이 같으면 차집합이 비어 있다 |
// | 겹친 로케이션 A 안에서 B 에 진입 | B 의 enter 만 발동(A 는 유지) | 집합 차이라서 포함관계를 특별 취급하지 않는다 |
// | 순간이동(중간 걸음 없음) | 출발지 leave + 도착지 enter 를 **같은 판정에서** 낸다 | 집합 차이는 경로를 묻지 않는다 |
// | 맵을 건너는 순간이동 | 출발 맵 점유는 통째로 leave, 도착 맵은 enter | 점유 기록이 맵별이다 |
// | 안에 서 있는데 로케이션이 삭제/축소됨 | leave 를 낸다(이벤트는 이미 없어진 로케이션을 가리키므로 발동하지 않고 lint 가 알린다) | 점유 기록에서 사라진 ID 는 «나감» 이다 |
// | 안에서 저장 → 불러오기 | 아무것도 발동하지 않는다 | 점유 기록이 세이브에 실려 그대로 복원된다 |
// | 세이브에 기록이 없는 옛 세이브 | 첫 판정에서 «현재 위치를 기준선으로 심기만» 한다 | 불러오는 순간 이벤트가 터지면 그건 저작 의도가 아니다 |

import { locationsAtPoint } from "./mapNamedLocations";
import type { GameMap } from "./types";

export type LocationTransitionKind = "enter" | "leave";

/** 세션이 들고 다니는 점유 기록. 키는 mapId, 값은 그 맵에서 **직전에** 안에 있던 로케이션 ID. */
export type LocationOccupancy = Record<string, string[]>;

export type LocationOccupancyHost = {
  occupiedLocationIds?: LocationOccupancy;
};

export type LocationTransition = {
  readonly kind: LocationTransitionKind;
  readonly locationId: string;
};

export type LocationPoint = { readonly x: number; readonly y: number };

/** 이 점을 덮는 로케이션 ID 들. 순서는 저작 순서(결정론적). */
export function occupiedLocationIdsAt(map: GameMap, point: LocationPoint): string[] {
  return locationsAtPoint(map, point).map((location) => location.id);
}

/**
 * 두 점유 집합의 차이를 드나듦 목록으로. **leave 가 먼저**다 — 겹친 구역을 빠져나가며
 * 다른 구역으로 들어가는 한 걸음에서 저작자가 기대하는 순서가 「나감 → 들어옴」이다.
 */
export function diffLocationOccupancy(
  before: readonly string[],
  after: readonly string[],
): LocationTransition[] {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const transitions: LocationTransition[] = [];
  for (const locationId of before) {
    if (!afterSet.has(locationId)) transitions.push({ kind: "leave", locationId });
  }
  for (const locationId of after) {
    if (!beforeSet.has(locationId)) transitions.push({ kind: "enter", locationId });
  }
  return transitions;
}

export type LocationTransitionUpdate = {
  readonly transitions: readonly LocationTransition[];
  /** 기준선만 심었는지(옛 세이브·첫 진입). true 면 트리거를 돌리지 않는다. */
  readonly seeded: boolean;
};

/**
 * 현재 위치로 점유 기록을 **갱신하고** 그 사이에 생긴 드나듦을 돌려준다.
 * 호출자는 돌려받은 목록으로 트리거를 돌린다 — 이 함수는 이벤트를 실행하지 않는다.
 *
 * `seed: true` 는 «지금 상태를 기준선으로 심되 아무것도 발동하지 마라» 는 뜻이다
 * (새 게임 시작, 세이브 불러오기, 옛 세이브 보정). 순간이동은 seed 가 아니다 —
 * 문으로 들어간 것도 들어간 것이다.
 */
export function updateLocationOccupancy(
  host: LocationOccupancyHost,
  map: GameMap,
  point: LocationPoint,
  options: { readonly seed?: boolean } = {},
): LocationTransitionUpdate {
  const occupancy = host.occupiedLocationIds;
  const known = occupancy?.[map.id];
  const after = occupiedLocationIdsAt(map, point);
  const seeded = options.seed === true || known === undefined;
  const transitions = seeded ? [] : diffLocationOccupancy(known, after);
  writeOccupancy(host, map.id, after);
  return { transitions, seeded };
}

/**
 * 맵을 떠날 때의 점유 정리. 순간이동은 출발 맵의 점유를 통째로 **leave** 로 내야 한다 —
 * 안 그러면 문을 통해 나간 구역의 leave 이벤트가 조용히 죽는다.
 *
 * 기록은 «비어 있음» 으로 남긴다(지우지 않는다). 지우면 그 맵으로 되돌아왔을 때 첫 판정이
 * seed 로 떨어져 도착 구역의 enter 가 한 번 씹힌다 — 같은 맵 안 순간이동에서 실제로 그랬다.
 */
export function leaveAllLocationsOnMap(host: LocationOccupancyHost, mapId: string): LocationTransition[] {
  const known = host.occupiedLocationIds?.[mapId] ?? [];
  writeOccupancy(host, mapId, []);
  return known.map((locationId) => ({ kind: "leave" as const, locationId }));
}

/**
 * 순간이동(장소 이동)의 점유 전이 — **한 번의 원자적 판정**이다.
 * 출발 맵 점유 전부가 leave 이고 도착 지점의 점유가 enter 다. 경로를 묻지 않는다.
 *
 * 두 단계를 호출자가 나눠 부르지 않게 여기 한 곳에 둔 이유: 「떠나기」가 기록을 지우고
 * 「도착」이 기록 없음을 seed 로 해석하면 enter 가 조용히 사라진다. 그 미끄러짐을
 * 이 함수 하나로 막는다.
 */
export function transferLocationOccupancy(
  host: LocationOccupancyHost,
  fromMapId: string,
  toMap: GameMap,
  point: LocationPoint,
): LocationTransition[] {
  const left = leaveAllLocationsOnMap(host, fromMapId);
  beginLocationOccupancyOnMap(host, toMap.id);
  const entered = updateLocationOccupancy(host, toMap, point);
  return [...left, ...entered.transitions];
}

/**
 * 도착 맵의 판정 기준선을 «비어 있음» 으로 열어 둔다. 순간이동 도착에만 쓴다 —
 * 기록이 없는 맵의 첫 판정은 seed(발동 없음)인데, 순간이동으로 들어온 것은 **진입이다.**
 *
 * 이미 기록이 있으면 건드리지 않는다: 같은 맵 안 순간이동에서 `leaveAllLocationsOnMap`
 * 이 방금 심어 둔 빈 기준선을 다시 쓰는 것은 무해하지만, 다른 경로가 쌓은 기준선을
 * 지우면 안 되므로 조건을 명시한다.
 */
export function beginLocationOccupancyOnMap(host: LocationOccupancyHost, mapId: string): void {
  if (host.occupiedLocationIds?.[mapId] !== undefined) return;
  writeOccupancy(host, mapId, []);
}

/** 세이브/불러오기·새 게임에서 기준선만 심는다. 트리거는 절대 나오지 않는다. */
export function seedLocationOccupancy(host: LocationOccupancyHost, map: GameMap, point: LocationPoint): void {
  updateLocationOccupancy(host, map, point, { seed: true });
}

function writeOccupancy(host: LocationOccupancyHost, mapId: string, ids: readonly string[]): void {
  if (ids.length === 0) {
    // 빈 배열도 «판정 기준선이 있다» 는 사실이므로 남긴다 — 지우면 다음 판정이 seed 로
    // 떨어져 밖 → 안 진입이 한 번 씹힌다.
    const occupancy = host.occupiedLocationIds ?? {};
    occupancy[mapId] = [];
    host.occupiedLocationIds = occupancy;
    return;
  }
  const occupancy = host.occupiedLocationIds ?? {};
  occupancy[mapId] = [...ids];
  host.occupiedLocationIds = occupancy;
}


/** 트리거가 이 드나듦에 반응하는가. 저작 트리거와 발생 사건을 맞추는 유일한 판정. */
export function triggerMatchesTransition(
  trigger: { readonly kind: string; readonly locationId?: string; readonly transition?: LocationTransitionKind },
  transition: LocationTransition,
): boolean {
  return (
    trigger.kind === "locationTransition"
    && trigger.locationId === transition.locationId
    && trigger.transition === transition.kind
  );
}
