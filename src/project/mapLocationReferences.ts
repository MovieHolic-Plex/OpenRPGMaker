// project/mapLocationReferences.ts
// 명명 로케이션을 **가리키는 쪽**의 계약. 참조 수집 → 진단 → 복구(repair) 를 한 모듈에 모은다.
//
// 왜 삭제 시 참조를 자동으로 지우지 않는가 (OPRN-OUT-020 결정):
// 조용한 삭제는 저작자가 무엇을 잃었는지 모르게 만든다. 그래서
//   1. 로케이션 삭제/무효화는 참조를 **그대로 남긴다**(고아 참조).
//   2. `collectMapLocationReferenceIssues` 가 그것을 눈에 보이는 진단으로 올린다
//      (projectLint → 편집기 문제 목록 / 조수 진단).
//   3. `repairMapLocationReferences` 가 명시적 복구 경로다 — 다른 로케이션으로 재지정(remap)
//      하거나 조건을 떼어낸다(detach). 저작자가 고를 때까지 아무것도 지워지지 않는다.
//
// 참조 지점(2026-09-10 실측 전량):
//   - `map.encounterTable[].conditions.locationId`
//   - 이벤트/공통 이벤트/전투 페이지 명령의 `fork` 조건 트리 안 `insideLocation`
//   - 이벤트 페이지 출현 조건(`page.conditions[]`) 과 레거시 `event.condition` 안 `insideLocation`
// 조건은 같은 맵의 로케이션만 가리킨다(맵 경계를 넘지 않는다) — 그래서 맵 복사가 안전하다.

import { findLocationById, mapLocations } from "./mapNamedLocations";
import type { Command, Condition, GameMap, Project } from "./types";

export type MapLocationReferenceSite =
  | { readonly kind: "encounter"; readonly mapId: string; readonly entryIndex: number }
  | {
      readonly kind: "condition";
      readonly mapId: string;
      readonly eventId?: string;
      readonly pageId?: string;
      readonly commonEventId?: string;
      readonly troopId?: string;
      /** 사람이 읽을 위치 경로. 진단 메시지에 그대로 실린다. */
      readonly path: string;
    };

export type MapLocationReference = {
  readonly locationId: string;
  readonly site: MapLocationReferenceSite;
};

export type MapLocationIssue = {
  readonly severity: "error" | "warning";
  readonly code: "map-location-missing-ref" | "map-location-degenerate" | "map-location-duplicate-name";
  readonly mapId: string;
  readonly locationId: string;
  readonly message: string;
};

/** 프로젝트 전체의 로케이션 참조를 모은다(맵 경계 안에서만 유효). */
export function collectMapLocationReferences(project: Project): MapLocationReference[] {
  const refs: MapLocationReference[] = [];
  for (const map of Object.values(project.maps)) {
    for (const [entryIndex, entry] of (map.encounterTable ?? []).entries()) {
      const locationId = entry.conditions?.locationId;
      if (locationId) refs.push({ locationId, site: { kind: "encounter", mapId: map.id, entryIndex } });
    }
    for (const event of map.events) {
      const base = { mapId: map.id, eventId: event.id } as const;
      if (event.condition) {
        collectConditionRefs(event.condition, refs, { kind: "condition", ...base, path: `이벤트 ${event.id} 출현 조건` });
      }
      collectCommandRefs(event.commands, refs, { kind: "condition", ...base, path: `이벤트 ${event.id} 명령` });
      for (const page of event.pages ?? []) {
        for (const condition of page.conditions ?? []) {
          collectConditionRefs(condition, refs, {
            kind: "condition",
            ...base,
            pageId: page.id,
            path: `이벤트 ${event.id} 페이지 ${page.id} 출현 조건`,
          });
        }
        collectCommandRefs(page.commands, refs, {
          kind: "condition",
          ...base,
          pageId: page.id,
          path: `이벤트 ${event.id} 페이지 ${page.id} 명령`,
        });
      }
    }
  }
  return refs;
}

/**
 * 진단. 고아 참조는 error(런타임에서 조용히 거짓이 되어 이벤트가 안 도는 결함),
 * 퇴화한 기하와 같은 이름 중복은 warning(동작은 하지만 저작 의도가 흐려진다).
 */
export function collectMapLocationReferenceIssues(project: Project): MapLocationIssue[] {
  const issues: MapLocationIssue[] = [];
  for (const ref of collectMapLocationReferences(project)) {
    const map = project.maps[ref.site.mapId];
    if (!map || findLocationById(map, ref.locationId)) continue;
    issues.push({
      severity: "error",
      code: "map-location-missing-ref",
      mapId: ref.site.mapId,
      locationId: ref.locationId,
      message:
        ref.site.kind === "encounter"
          ? `인카운터 ${ref.site.entryIndex + 1}번이 없는 로케이션 '${ref.locationId}' 을 가리킵니다. 로케이션 레이어에서 다시 지정하거나 조건을 떼어 주세요.`
          : `${ref.site.path} 가 없는 로케이션 '${ref.locationId}' 을 가리킵니다. 로케이션 레이어에서 다시 지정하거나 조건을 떼어 주세요.`,
    });
  }
  for (const map of Object.values(project.maps)) {
    const seenNames = new Map<string, string>();
    for (const location of mapLocations(map)) {
      if (location.w <= 1 && location.h <= 1 && (location.x >= map.width - 1 || location.y >= map.height - 1)) {
        issues.push({
          severity: "warning",
          code: "map-location-degenerate",
          mapId: map.id,
          locationId: location.id,
          message: `로케이션 '${location.name}' 이 맵 축소로 경계 1×1 까지 눌렸습니다. 크기를 다시 잡아 주세요.`,
        });
      }
      const key = location.name.replace(/\s+/g, "").toLowerCase();
      const previous = seenNames.get(key);
      if (previous) {
        issues.push({
          severity: "warning",
          code: "map-location-duplicate-name",
          mapId: map.id,
          locationId: location.id,
          message: `로케이션 이름 '${location.name}' 이 '${previous}' 와 중복입니다. 조수가 이름으로 가리킬 때 앞의 것이 먼저 뽑힙니다.`,
        });
      } else {
        seenNames.set(key, location.id);
      }
    }
  }
  return issues;
}

export type LocationRepairPlan =
  /** 다른 로케이션으로 재지정. 참조 형태는 그대로 남는다(권장 경로). */
  | { readonly kind: "remap"; readonly locationId: string }
  /** 로케이션 참조만 떼어낸다. 인카운터는 맵 전체 조건이 되고, 조건은 항상-참으로 대체된다. */
  | { readonly kind: "detach" }
  /** 삭제 직전의 사각형을 그 자리에 굳힌다(레거시 raw 사각형으로 강등). 인카운터만 지원. */
  | { readonly kind: "freezeRect"; readonly rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number } };

export type LocationRepairResult = {
  readonly repaired: number;
  readonly notes: readonly string[];
};

/**
 * 명시적 복구. `project` 를 제자리에서 바꾼다(store.update 안에서 호출).
 * `missingLocationId` 를 가리키는 모든 참조에 같은 계획을 적용한다.
 */
export function repairMapLocationReferences(
  project: Project,
  missingLocationId: string,
  plan: LocationRepairPlan,
): LocationRepairResult {
  const notes: string[] = [];
  let repaired = 0;
  for (const map of Object.values(project.maps)) {
    for (const [entryIndex, entry] of (map.encounterTable ?? []).entries()) {
      if (entry.conditions?.locationId !== missingLocationId) continue;
      const conditions = { ...entry.conditions };
      if (plan.kind === "remap") {
        conditions.locationId = plan.locationId;
      } else if (plan.kind === "freezeRect") {
        delete conditions.locationId;
        conditions.region = { ...plan.rect };
      } else {
        delete conditions.locationId;
      }
      const hasAny = Object.keys(conditions).length > 0;
      map.encounterTable![entryIndex] = hasAny ? { ...entry, conditions } : { troopId: entry.troopId, weight: entry.weight };
      repaired += 1;
      notes.push(`${map.name} 인카운터 ${entryIndex + 1}번`);
    }
    for (const event of map.events) {
      if (event.condition) {
        const next = repairCondition(event.condition, missingLocationId, plan);
        if (next.changed) {
          if (next.condition) event.condition = next.condition;
          else delete event.condition;
          repaired += next.changed;
          notes.push(`${map.name} 이벤트 ${event.id} 출현 조건`);
        }
      }
      const eventCommands = repairCommands(event.commands, missingLocationId, plan);
      if (eventCommands.changed) {
        event.commands = eventCommands.commands;
        repaired += eventCommands.changed;
        notes.push(`${map.name} 이벤트 ${event.id} 명령`);
      }
      for (const page of event.pages ?? []) {
        if (page.conditions) {
          const nextConditions: Condition[] = [];
          let pageChanged = 0;
          for (const condition of page.conditions) {
            const next = repairCondition(condition, missingLocationId, plan);
            pageChanged += next.changed;
            if (next.condition) nextConditions.push(next.condition);
          }
          if (pageChanged) {
            page.conditions = nextConditions;
            repaired += pageChanged;
            notes.push(`${map.name} 이벤트 ${event.id} 페이지 ${page.id} 출현 조건`);
          }
        }
        const pageCommands = repairCommands(page.commands, missingLocationId, plan);
        if (pageCommands.changed) {
          page.commands = pageCommands.commands;
          repaired += pageCommands.changed;
          notes.push(`${map.name} 이벤트 ${event.id} 페이지 ${page.id} 명령`);
        }
      }
    }
  }
  return { repaired, notes };
}

// ───────────────────────────────────────────────────────────── 내부 순회

function collectConditionRefs(
  condition: Condition,
  refs: MapLocationReference[],
  site: MapLocationReferenceSite,
): void {
  if (condition.kind === "insideLocation") {
    refs.push({ locationId: condition.locationId, site });
    return;
  }
  if (condition.kind === "all" || condition.kind === "any") {
    for (const child of condition.conditions) collectConditionRefs(child, refs, site);
    return;
  }
  if (condition.kind === "not") collectConditionRefs(condition.condition, refs, site);
}

function collectCommandRefs(
  commands: readonly Command[],
  refs: MapLocationReference[],
  site: MapLocationReferenceSite,
): void {
  for (const command of commands) {
    if (command.kind === "fork") {
      collectConditionRefs(command.condition, refs, site);
      collectCommandRefs(command.then, refs, site);
      collectCommandRefs(command.else ?? [], refs, site);
      continue;
    }
    for (const branch of commandBranches(command)) collectCommandRefs(branch, refs, site);
  }
}

function commandBranches(command: Command): readonly Command[][] {
  switch (command.kind) {
    case "choices":
      return [...command.options.map((option) => option.branch), command.cancelBranch ?? []];
    case "loop":
      return [command.body];
    case "shop":
      return [command.transactionBranch ?? [], command.failedTransactionBranch ?? []];
    case "inn":
      return [command.notEnoughBranch ?? []];
    default:
      return [];
  }
}

type ConditionRepair = { readonly condition: Condition | undefined; readonly changed: number };

function repairCondition(condition: Condition, missingId: string, plan: LocationRepairPlan): ConditionRepair {
  if (condition.kind === "insideLocation") {
    if (condition.locationId !== missingId) return { condition, changed: 0 };
    if (plan.kind === "remap") return { condition: { ...condition, locationId: plan.locationId }, changed: 1 };
    // detach / freezeRect: 조건 자체를 떼어낸다. 조건 목록에서 사라지면 그 축의 제한이 없어진다.
    return { condition: undefined, changed: 1 };
  }
  if (condition.kind === "all" || condition.kind === "any") {
    const children: Condition[] = [];
    let changed = 0;
    for (const child of condition.conditions) {
      const next = repairCondition(child, missingId, plan);
      changed += next.changed;
      if (next.condition) children.push(next.condition);
    }
    if (!changed) return { condition, changed: 0 };
    if (children.length === 0) return { condition: undefined, changed };
    return { condition: { ...condition, conditions: children }, changed };
  }
  if (condition.kind === "not") {
    const next = repairCondition(condition.condition, missingId, plan);
    if (!next.changed) return { condition, changed: 0 };
    if (!next.condition) return { condition: undefined, changed: next.changed };
    return { condition: { ...condition, condition: next.condition }, changed: next.changed };
  }
  return { condition, changed: 0 };
}

function repairCommands(
  commands: readonly Command[],
  missingId: string,
  plan: LocationRepairPlan,
): { readonly commands: Command[]; readonly changed: number } {
  let changed = 0;
  const next = commands.map((command): Command => {
    if (command.kind === "fork") {
      const condition = repairCondition(command.condition, missingId, plan);
      const then = repairCommands(command.then, missingId, plan);
      const otherwise = repairCommands(command.else ?? [], missingId, plan);
      changed += condition.changed + then.changed + otherwise.changed;
      // 조건이 통째로 떨어진 fork 는 항상 참으로 굳힌다 — 명령 자체를 지우면 저작자가
      // 만든 then 분기가 조용히 사라진다.
      return {
        ...command,
        condition: condition.condition ?? { kind: "all", conditions: [] },
        then: then.commands,
        ...(command.else === undefined ? {} : { else: otherwise.commands }),
      };
    }
    if (command.kind === "choices") {
      const options = command.options.map((option) => {
        const branch = repairCommands(option.branch, missingId, plan);
        changed += branch.changed;
        return { ...option, branch: branch.commands };
      });
      const cancel = command.cancelBranch ? repairCommands(command.cancelBranch, missingId, plan) : undefined;
      if (cancel) changed += cancel.changed;
      return { ...command, options, ...(cancel === undefined ? {} : { cancelBranch: cancel.commands }) };
    }
    if (command.kind === "loop") {
      const body = repairCommands(command.body, missingId, plan);
      changed += body.changed;
      return { ...command, body: body.commands };
    }
    if (command.kind === "shop") {
      const transaction = command.transactionBranch ? repairCommands(command.transactionBranch, missingId, plan) : undefined;
      const failed = command.failedTransactionBranch ? repairCommands(command.failedTransactionBranch, missingId, plan) : undefined;
      if (transaction) changed += transaction.changed;
      if (failed) changed += failed.changed;
      return {
        ...command,
        ...(transaction === undefined ? {} : { transactionBranch: transaction.commands }),
        ...(failed === undefined ? {} : { failedTransactionBranch: failed.commands }),
      };
    }
    if (command.kind === "inn" && command.notEnoughBranch) {
      const branch = repairCommands(command.notEnoughBranch, missingId, plan);
      changed += branch.changed;
      return { ...command, notEnoughBranch: branch.commands };
    }
    return command;
  });
  return { commands: next, changed };
}

/** 그 로케이션을 가리키는 참조 수. 삭제 확인 대화창이 "이만큼 끊깁니다" 를 보여줄 때 쓴다. */
export function countLocationReferences(project: Project, locationId: string): number {
  return collectMapLocationReferences(project).filter((ref) => ref.locationId === locationId).length;
}

/** 삭제 전 영향 요약. UI 가 사람이 읽을 문장으로 바로 쓴다. */
export function describeLocationReferenceImpact(project: Project, map: GameMap, locationId: string): string[] {
  return collectMapLocationReferences(project)
    .filter((ref) => ref.locationId === locationId && ref.site.mapId === map.id)
    .map((ref) => (ref.site.kind === "encounter" ? `인카운터 ${ref.site.entryIndex + 1}번` : ref.site.path));
}
