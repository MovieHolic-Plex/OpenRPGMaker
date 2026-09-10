// project/mapLocationAdoption.ts
// 「빌더 설계 영역 → 명명 로케이션」 **일괄 승격 도구**의 순수 규칙. 브라우저 전역·store 접근 금지.
//
// ## 왜 이 모듈이 따로 있는가 (LOC-ADOPT, 2026-09-10)
//
// OPRN-OUT-020 은 한 맵짜리 원시 동작(`adoptLayoutRegionsAsLocations`)만 남기고 **기존 빌더 맵의
// 일괄 이관을 제품 책임자에게 미뤄 뒀다**. 미룬 이유는 능력 부족이 아니라 위험이었다:
// 프로젝트를 열자마자 수십 개의 사용자-가시 이름이 자동으로 생기면 저작자가 쓰지 않은 낱말이
// 게임에 실린다. 책임자가 이관 경로 구축을 승인했으므로 그 위험을 **행위로 옮긴다** —
// 자동이 아니라 사람이 보고 고르는 도구로.
//
// 그래서 이 모듈은 두 가지만 한다.
//   1. `surveyProjectAdoption` — **읽기 전용 조사**. 무엇이 승격 가능하고, 무엇이 이미 승격됐고,
//      무엇이 이름 충돌이고, 무엇이 재시공으로 고아가 됐는지 센다. 프로젝트를 한 바이트도 바꾸지 않는다.
//   2. `adoptLayoutRegionsForMaps` — **명시적 계획 실행**. 맵을 골라서만 적용하고, 멱등이며,
//      `layoutPlan` 은 읽기만 하고, 되돌림 1건으로 묶이도록 한 번의 순회로 끝난다.
//
// ## 멱등성이 두 겹인 이유 (재시공 함정)
//
// 원시 동작의 멱등 판정은 `origin.regionId` 하나다. 그런데 빌더는 재시공마다 `regions` 배열을
// **통째로 갈아치우고**, `uniqueHouseRegionId` 는 그때 살아 있는 배열만 보고 번호를 매긴다.
// 즉 같은 자리에 있던 집이 재시공 후 다른 region ID 를 받을 수 있다. ID 만 보면 그 집은
// "새 영역" 으로 보여 **같은 장소가 두 번 승격된다**. 그래서 여기서는 두 번째 자물쇠를 건다:
// **같은 사각형(x,y,w,h)을 이미 승격된 로케이션이 덮고 있으면 다시 승격하지 않는다** —
// 대신 그 로케이션의 `origin.regionId` 를 새 ID 로 **다시 묶어(rebind)** 이후 조사가 고아로
// 보고하지 않게 한다. 로케이션 ID 는 건드리지 않으므로 기존 참조는 전부 살아 있다.
//
// ## 이름 충돌을 조용히 해결하지 않는다
//
// 원시 동작은 `layoutRegionDisplayName` 이 「상점 2」처럼 뒤에 숫자를 붙여 조용히 피한다. 일괄
// 이관에서는 그게 위험하다 — 수십 개가 한 번에 들어오면 저작자가 어느 이름이 밀려났는지 모른다.
// 조사는 충돌을 **미리 세어서 보여 주고**, 실행은 정책을 강제로 고르게 한다:
//   - `suffix`  기본. 「상점 2」로 만들되 **결과 목록에 renamed 로 보고**한다(조용하지 않다).
//   - `skip`    충돌하는 영역을 승격하지 않는다. 사람이 먼저 정리한 뒤 다시 돌린다.
// 어느 쪽이든 **기존 로케이션의 이름은 절대 바뀌지 않는다.** 사람이 쓴 낱말이 항상 이긴다.

import type { GameMap, MapLayoutRegion, MapNamedLocation, Project } from "./types";
import { addMapLocation, mapLocations, sanitizeName } from "./mapNamedLocations";

/**
 * 기본 승격 대상 역할. **시공 전용 낱말은 뺀다.**
 *
 * 근거는 취향이 아니라 코드다. `houseProtection.ts:53` 과 `villageEvaluate.ts:704` 는
 * `role === "house"` 를 **시공 사실**(집 롯의 보호·검증 단위)로 읽는다. 한 마을에 집 롯이
 * 20~40개 나오므로 이걸 기본으로 켜면 「파랑 지붕 석벽 집 (ㄱ자)」 같은 이름이 수십 개
 * 한꺼번에 사용자-가시 장소가 된다 — 저작자가 쓰지 않은 낱말로 게임을 채우는 짓이다.
 * `river`/`lake`/`forest` 도 마찬가지로 지형 기록이지 사람이 가리키는 장소가 아니다.
 *
 * 남는 것은 `plaza` 와 `market` 뿐이고, 이 둘만 남기는 근거도 코드에 있다:
 * `villageEvaluate.ts:649` 가 이 둘을 **"planned commons"**, 즉 마을의 공용 생활 공간으로
 * 묶어 센다. 사람이 "광장에서 만나자", "장터로 가" 라고 말하는 층이 정확히 그것이다.
 * 나머지는 조사 화면에 전부 보이고 체크 한 번으로 켤 수 있다 — 숨기지 않고, 기본만 좁혔다.
 */
export const DEFAULT_ADOPTION_ROLES: readonly string[] = ["plaza", "market"];

/** 역할 낱말을 사람 말로. 조사 표와 실행 요약이 같은 문장을 쓰게 한다. */
const ROLE_LABELS: Readonly<Record<string, string>> = {
  plaza: "광장",
  market: "장터·상점가",
  house: "집 롯",
  forest: "숲",
  river: "강",
  lake: "호수",
};

export function adoptionRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** 이 역할이 기본 선택에서 빠진 이유(툴팁·조수 답변이 같은 문장을 쓴다). 기본 역할이면 undefined. */
export function adoptionRoleCaution(role: string): string | undefined {
  if (DEFAULT_ADOPTION_ROLES.includes(role)) return undefined;
  if (role === "house") return "집 롯은 시공·보호 단위입니다(houseProtection). 수십 개가 한꺼번에 장소 이름이 됩니다.";
  if (role === "river" || role === "lake" || role === "forest") return "지형 기록입니다. 사람이 가리키는 장소가 아니라면 켜지 마세요.";
  return "빌더가 시공용으로 남긴 낱말입니다. 사용자에게 보일 이름인지 확인하세요.";
}

// ────────────────────────────────────────────────────────────────── 조사(읽기 전용)

/** 한 영역의 조사 결과. 조사는 프로젝트를 절대 바꾸지 않는다. */
export type RegionAdoptionStatus =
  /** 아직 로케이션이 없다. 승격 후보. */
  | { readonly kind: "adoptable"; readonly nameCollision?: string }
  /** 같은 region ID 를 출처로 가진 로케이션이 이미 있다. */
  | { readonly kind: "adopted"; readonly locationId: string }
  /** region ID 는 다르지만 같은 사각형을 이미 승격된 로케이션이 덮는다(재시공으로 ID 가 바뀐 경우). */
  | { readonly kind: "rebindable"; readonly locationId: string; readonly previousRegionId: string };

export type RegionAdoptionEntry = {
  readonly regionId: string;
  readonly role: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly status: RegionAdoptionStatus;
};

export type MapAdoptionSurvey = {
  readonly mapId: string;
  readonly mapName: string;
  readonly planKind?: string;
  readonly regions: readonly RegionAdoptionEntry[];
  /** 역할별 (전체 / 아직 승격 안 된) 수. 조사 표의 한 줄이 된다. */
  readonly roleCounts: readonly { readonly role: string; readonly total: number; readonly adoptable: number }[];
  /** 현재 선택된 역할 필터 기준으로 이 맵이 기여할 로케이션 수. */
  readonly adoptableCount: number;
  /** 이미 승격돼 건너뛸 수(멱등 증거). */
  readonly adoptedCount: number;
  /** 재시공으로 region ID 가 바뀌어 다시 묶기만 하면 되는 수. 새 로케이션을 만들지 않는다. */
  readonly rebindableCount: number;
  /** 기존 로케이션과 표시명이 부딪히는 영역들(승격 전에 눈에 보여야 한다). */
  readonly collisions: readonly { readonly regionId: string; readonly name: string }[];
  /**
   * 출처 영역이 사라진 승격본. 빌더 재시공 뒤 남는 잔여물이며 **자동으로 지우지 않는다** —
   * 사람이 이름을 붙였을 수 있고, 조건·인카운터가 가리키고 있을 수 있다.
   */
  readonly orphanedLocations: readonly { readonly locationId: string; readonly name: string; readonly regionId: string }[];
};

export type AdoptionSurveyOptions = {
  /** 이 역할만 센다. 생략하면 `DEFAULT_ADOPTION_ROLES`. 빈 배열은 "역할 필터 없음"이 아니라 "아무것도 안 고름". */
  readonly roles?: readonly string[];
};

export type ProjectAdoptionSurvey = {
  readonly maps: readonly MapAdoptionSurvey[];
  /** 프로젝트 전체에서 관측된 역할 낱말 전량(정렬됨). 필터 UI 가 이걸로 체크박스를 만든다. */
  readonly roles: readonly string[];
  /** 선택된 역할 기준 총 승격 후보 수. */
  readonly totalAdoptable: number;
  readonly selectedRoles: readonly string[];
};

function regionKey(region: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): string {
  return `${region.x},${region.y},${region.w},${region.h}`;
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, "").trim().toLowerCase();
}

function adoptedIndex(map: GameMap): {
  readonly byRegionId: ReadonlyMap<string, MapNamedLocation>;
  readonly byRect: ReadonlyMap<string, MapNamedLocation>;
} {
  const byRegionId = new Map<string, MapNamedLocation>();
  const byRect = new Map<string, MapNamedLocation>();
  for (const location of mapLocations(map)) {
    if (location.origin?.kind !== "layoutRegion") continue;
    byRegionId.set(location.origin.regionId, location);
    // 첫 번째가 이긴다 — 저작 순서가 결정론적 승자를 준다.
    if (!byRect.has(regionKey(location))) byRect.set(regionKey(location), location);
  }
  return { byRegionId, byRect };
}

/** 승격했을 때 쓰일 기본 표시명(충돌 회피 전의 날 이름). 조사와 실행이 반드시 같은 문장을 쓴다. */
export function adoptionBaseName(region: MapLayoutRegion): string {
  return sanitizeName(region.label) || sanitizeName(region.role) || "구역";
}

/** 맵 하나 조사. 프로젝트를 바꾸지 않는다. */
export function surveyMapAdoption(map: GameMap, options: AdoptionSurveyOptions = {}): MapAdoptionSurvey {
  const roles = options.roles ?? DEFAULT_ADOPTION_ROLES;
  const regions = map.layoutPlan?.regions ?? [];
  const index = adoptedIndex(map);
  const existingNames = new Set(mapLocations(map).map((location) => normalizeName(location.name)));

  const entries: RegionAdoptionEntry[] = [];
  const collisions: { regionId: string; name: string }[] = [];
  const roleTotals = new Map<string, { total: number; adoptable: number }>();
  let adoptableCount = 0;
  let adoptedCount = 0;
  let rebindableCount = 0;

  for (const region of regions) {
    const already = index.byRegionId.get(region.id);
    const sameRect = already ? undefined : index.byRect.get(regionKey(region));
    const status: RegionAdoptionStatus = already
      ? { kind: "adopted", locationId: already.id }
      : sameRect
        ? {
          kind: "rebindable",
          locationId: sameRect.id,
          previousRegionId: sameRect.origin?.kind === "layoutRegion" ? sameRect.origin.regionId : "",
        }
        : { kind: "adoptable" };

    const selected = roles.includes(region.role);
    const bucket = roleTotals.get(region.role) ?? { total: 0, adoptable: 0 };
    bucket.total += 1;
    if (status.kind === "adoptable") bucket.adoptable += 1;
    roleTotals.set(region.role, bucket);

    let collisionName: string | undefined;
    if (status.kind === "adoptable") {
      const base = adoptionBaseName(region);
      if (existingNames.has(normalizeName(base))) collisionName = base;
    }

    entries.push({
      regionId: region.id,
      role: region.role,
      label: region.label,
      x: region.x,
      y: region.y,
      w: region.w,
      h: region.h,
      status: collisionName ? { kind: "adoptable", nameCollision: collisionName } : status,
    });

    if (!selected) continue;
    if (status.kind === "adoptable") {
      adoptableCount += 1;
      if (collisionName) collisions.push({ regionId: region.id, name: collisionName });
    } else if (status.kind === "adopted") adoptedCount += 1;
    else rebindableCount += 1;
  }

  const liveRegionIds = new Set(regions.map((region) => region.id));
  const orphanedLocations = mapLocations(map)
    .filter((location) => location.origin?.kind === "layoutRegion" && !liveRegionIds.has(location.origin.regionId))
    // 재시공으로 ID 만 바뀐 경우는 실행이 다시 묶으므로 고아가 아니다.
    .filter((location) => !regions.some((region) => regionKey(region) === regionKey(location)))
    .map((location) => ({
      locationId: location.id,
      name: location.name,
      regionId: location.origin?.kind === "layoutRegion" ? location.origin.regionId : "",
    }));

  return {
    mapId: map.id,
    mapName: map.name,
    ...(map.layoutPlan?.kind === undefined ? {} : { planKind: map.layoutPlan.kind }),
    regions: entries,
    roleCounts: [...roleTotals.entries()]
      .map(([role, counts]) => ({ role, total: counts.total, adoptable: counts.adoptable }))
      .sort((a, b) => a.role.localeCompare(b.role)),
    adoptableCount,
    adoptedCount,
    rebindableCount,
    collisions,
    orphanedLocations,
  };
}

/**
 * 프로젝트 전체 조사. **읽기 전용** — 화면을 열기만 해서는 아무것도 바뀌지 않는다는 계약이
 * 이 함수의 존재 이유다. `layoutPlan.regions` 가 있는 맵만 돌려준다.
 */
export function surveyProjectAdoption(project: Project, options: AdoptionSurveyOptions = {}): ProjectAdoptionSurvey {
  const selectedRoles = [...(options.roles ?? DEFAULT_ADOPTION_ROLES)];
  const maps = Object.values(project.maps)
    .filter((map) => (map.layoutPlan?.regions.length ?? 0) > 0)
    .map((map) => surveyMapAdoption(map, { roles: selectedRoles }))
    .sort((a, b) => a.mapId.localeCompare(b.mapId));
  const roles = new Set<string>();
  for (const map of maps) for (const entry of map.regions) roles.add(entry.role);
  return {
    maps,
    roles: [...roles].sort(),
    totalAdoptable: maps.reduce((sum, map) => sum + map.adoptableCount, 0),
    selectedRoles,
  };
}

// ────────────────────────────────────────────────────────────────────── 실행

/** 표시명 충돌 정책. 기본은 `suffix` 지만 어느 쪽이든 결과에 보고된다. */
export type AdoptionCollisionPolicy = "suffix" | "skip";

export type AdoptionPlan = {
  /** 적용할 맵 ID. **비어 있으면 아무것도 하지 않는다** — 프로젝트 전체 자동 적용은 없다. */
  readonly mapIds: readonly string[];
  readonly roles?: readonly string[];
  readonly collisionPolicy?: AdoptionCollisionPolicy;
  /** 지정하면 이 region ID 만 승격한다(맵 안에서 더 좁히는 선택). */
  readonly regionIds?: readonly string[];
};

export type AdoptedLocationRecord = {
  readonly mapId: string;
  readonly regionId: string;
  readonly locationId: string;
  readonly name: string;
  /** 충돌 회피로 이름이 밀렸다면 원래 쓰려던 이름. 조용한 개명을 막는 보고 필드. */
  readonly renamedFrom?: string;
};

export type AdoptionOutcome = {
  readonly adopted: readonly AdoptedLocationRecord[];
  /** 이미 같은 region 을 출처로 가진 로케이션이 있어 건너뛴 것(멱등 증거). */
  readonly skippedAlreadyAdopted: readonly { readonly mapId: string; readonly regionId: string }[];
  /** 이름 충돌로 `skip` 정책이 건너뛴 것. 사람이 정리한 뒤 다시 돌릴 대상. */
  readonly skippedNameCollision: readonly { readonly mapId: string; readonly regionId: string; readonly name: string }[];
  /**
   * 재시공으로 region ID 가 바뀌어 기존 로케이션의 출처만 다시 묶은 것. 새 로케이션은 만들지 않았고
   * 로케이션 ID 도 그대로다 — 기존 참조가 전부 살아 있다는 뜻이다.
   */
  readonly rebound: readonly { readonly mapId: string; readonly locationId: string; readonly fromRegionId: string; readonly toRegionId: string }[];
};

export function emptyAdoptionOutcome(): AdoptionOutcome {
  return { adopted: [], skippedAlreadyAdopted: [], skippedNameCollision: [], rebound: [] };
}

export function adoptionOutcomeIsNoop(outcome: AdoptionOutcome): boolean {
  return outcome.adopted.length === 0 && outcome.rebound.length === 0;
}

/**
 * 계획 실행. **프로젝트를 제자리에서 바꾼다** — 호출자가 `store.update` 안에서, 스냅샷 1건을
 * 먼저 찍고 부른다(되돌림이 한 덩어리가 되는 이유는 여기가 한 번의 순회이기 때문이다).
 *
 * 계약:
 *  - `map.layoutPlan` 은 **읽기만 한다.** 실행 전후로 바이트 동일.
 *  - 같은 계획을 두 번 돌리면 두 번째는 아무것도 만들지 않는다.
 *  - 기존 로케이션의 이름·ID 는 절대 바뀌지 않는다.
 */
export function adoptLayoutRegionsForMaps(project: Project, plan: AdoptionPlan): AdoptionOutcome {
  const roles = plan.roles ?? DEFAULT_ADOPTION_ROLES;
  const policy = plan.collisionPolicy ?? "suffix";
  const adopted: AdoptedLocationRecord[] = [];
  const skippedAlreadyAdopted: { mapId: string; regionId: string }[] = [];
  const skippedNameCollision: { mapId: string; regionId: string; name: string }[] = [];
  const rebound: { mapId: string; locationId: string; fromRegionId: string; toRegionId: string }[] = [];

  for (const mapId of plan.mapIds) {
    const map = project.maps[mapId];
    const regions = map?.layoutPlan?.regions;
    if (!map || !regions?.length) continue;
    const index = adoptedIndex(map);
    // 이 맵 안에서 이번 실행이 새로 만든 이름까지 누적해야 한 번의 실행 안에서도 충돌을 본다.
    const usedNames = new Set(mapLocations(map).map((location) => normalizeName(location.name)));

    for (const region of regions) {
      if (!roles.includes(region.role)) continue;
      if (plan.regionIds && !plan.regionIds.includes(region.id)) continue;

      if (index.byRegionId.has(region.id)) {
        skippedAlreadyAdopted.push({ mapId, regionId: region.id });
        continue;
      }
      const sameRect = index.byRect.get(regionKey(region));
      if (sameRect) {
        // 재시공으로 ID 만 바뀐 같은 장소. 로케이션을 **다시 만들지 않고** 출처만 갱신한다.
        const from = sameRect.origin?.kind === "layoutRegion" ? sameRect.origin.regionId : "";
        sameRect.origin = {
          kind: "layoutRegion",
          regionId: region.id,
          ...(map.layoutPlan?.kind === undefined ? {} : { planKind: map.layoutPlan.kind }),
        };
        rebound.push({ mapId, locationId: sameRect.id, fromRegionId: from, toRegionId: region.id });
        continue;
      }

      const base = adoptionBaseName(region);
      const collides = usedNames.has(normalizeName(base));
      if (collides && policy === "skip") {
        skippedNameCollision.push({ mapId, regionId: region.id, name: base });
        continue;
      }
      const name = collides ? uniqueSuffixedName(base, usedNames) : base;
      const result = addMapLocation(map, {
        name,
        x: region.x,
        y: region.y,
        w: region.w,
        h: region.h,
        tags: [`role:${region.role}`, ...(region.tags ?? [])],
      });
      if (!result.ok) continue;
      result.location.origin = {
        kind: "layoutRegion",
        regionId: region.id,
        ...(map.layoutPlan?.kind === undefined ? {} : { planKind: map.layoutPlan.kind }),
      };
      usedNames.add(normalizeName(name));
      adopted.push({
        mapId,
        regionId: region.id,
        locationId: result.location.id,
        name,
        ...(collides ? { renamedFrom: base } : {}),
      });
    }
  }

  return { adopted, skippedAlreadyAdopted, skippedNameCollision, rebound };
}

function uniqueSuffixedName(base: string, used: ReadonlySet<string>): string {
  for (let suffix = 2; suffix <= used.size + 2; suffix += 1) {
    const candidate = sanitizeName(`${base} ${suffix}`);
    if (!used.has(normalizeName(candidate))) return candidate;
  }
  return sanitizeName(`${base} ${used.size + 2}`);
}

/** 실행 결과 한 줄 요약. 토스트·조수 답변·증거 기록이 같은 문장을 쓴다. */
export function describeAdoptionOutcome(outcome: AdoptionOutcome): string {
  if (adoptionOutcomeIsNoop(outcome)) {
    if (outcome.skippedNameCollision.length > 0) {
      return `새로 만든 구역이 없습니다 — 이름이 겹쳐 ${outcome.skippedNameCollision.length}개를 건너뛰었습니다.`;
    }
    if (outcome.skippedAlreadyAdopted.length > 0) {
      return `이미 전부 승격돼 있습니다(${outcome.skippedAlreadyAdopted.length}개 건너뜀). 두 번 돌려도 늘지 않습니다.`;
    }
    return "승격할 설계 영역이 없습니다.";
  }
  const parts: string[] = [];
  if (outcome.adopted.length > 0) parts.push(`구역 ${outcome.adopted.length}개 생성`);
  const renamed = outcome.adopted.filter((entry) => entry.renamedFrom).length;
  if (renamed > 0) parts.push(`이름 충돌 ${renamed}건은 뒤에 번호를 붙였습니다`);
  if (outcome.rebound.length > 0) parts.push(`재시공으로 ID 가 바뀐 ${outcome.rebound.length}개는 기존 구역에 다시 묶었습니다(중복 없음)`);
  if (outcome.skippedAlreadyAdopted.length > 0) parts.push(`이미 있던 ${outcome.skippedAlreadyAdopted.length}개 건너뜀`);
  if (outcome.skippedNameCollision.length > 0) parts.push(`이름 충돌로 ${outcome.skippedNameCollision.length}개 건너뜀`);
  return `${parts.join(" · ")}.`;
}
