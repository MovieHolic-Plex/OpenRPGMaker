import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { commandRuntimeSupport } from "@/project/eventCommands/runtimeSupport";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { GOLD_MAX } from "@/project/economyValues";
import { DEFAULT_ENEMY_FACTION_ID, PLAYER_FACTION_ID } from "@/project/factions";
import { resolveTimeSystem } from "@/project/gameTime";
import { planScreenEffect } from "@/player/interpreter/screenEffectPlan";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { projectWithEventDraftAuthoredWrites } from "@/project/eventDraftAuthored";
import { hasCharacterId } from "@/project/socialKey";
import { collectNpcActivitySuggestions } from "@/editor/panels/eventEditor/options";
import { advancedConditionEntries, pageConditionField } from "@/editor/panels/eventEditor/pageConditionLayout";
import { textBodyOf } from "@/project/io/rewriteLegacyDialogue";
import type {
  Command,
  Condition,
  EventPage,
  GameEvent,
  MapId,
  MoveRoute,
  Project,
} from "@/project/types";

export type EventDraftIssueSeverity = "error" | "warning" | "info";

export type EventDraftFieldLocator = {
  readonly testId: string;
  /** Scopes reusable condition-form controls to their exact authored row. */
  readonly scopeTestId?: string;
};

export type EventDraftIssue = {
  readonly severity: EventDraftIssueSeverity;
  /** Stable machine-readable rule id. */
  readonly code: string;
  readonly message: string;
  readonly pageId: string;
  /** Path uses the same nested branch encoding as rendered command rows. */
  readonly commandPath?: readonly number[];
  readonly field?: EventDraftFieldLocator;
};

export type EventDraftValidation = {
  readonly issues: readonly EventDraftIssue[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly canCommit: boolean;
};

type ReferenceSets = ReturnType<typeof referenceSets>;
type M2CatalogEntry = NonNullable<ReturnType<typeof m2CommandById>>;

type CommandVisit = {
  readonly command: Command;
  readonly path: readonly number[];
};


function checkCallDepth(project: Project, issues: EventDraftIssue[]): void {
  const maxDepth = 8;
  const visiting = new Set<string>();
  const visit = (commands: readonly import("@/project/types").Command[], depth: number): void => {
    if (depth > maxDepth) {
      issues.push({ severity: "warning", code: "callCommonEvent.recursionDepth", message: `호출 깊이가 ${maxDepth}를 넘었습니다.`, pageId: "" });
      return;
    }
    for (const cmd of commands) {
      const kind = (cmd as { kind: string }).kind;
      if (kind === "callCommonEvent") {
        const id = (cmd as { commonEventId: string }).commonEventId;
        if (visiting.has(id)) {
          issues.push({ severity: "warning", code: "callCommonEvent.cycle", message: `다른 이벤트 ${id}가 순환 호출됩니다.`, pageId: "" });
          continue;
        }
        const ce = project.commonEvents?.find((e) => e.id === id);
        if (!ce) continue;
        visiting.add(id);
        for (const pg of (ce as { pages?: readonly { commands?: readonly import("@/project/types").Command[] }[] }).pages ?? []) {
          if (pg.commands) visit(pg.commands, depth + 1);
        }
        visiting.delete(id);
      }
      for (const branch of commandBranches(cmd as import("@/project/types").Command)) visit(branch.commands, depth);
    }
  };
  for (const page of (project.commonEvents ?? []).flatMap((ce) => (ce as { pages?: readonly { commands?: readonly import("@/project/types").Command[] }[] }).pages ?? [])) {
    if (page.commands) visit(page.commands, 1);
  }
}

export function validateEventDraft(
  project: Project,
  mapId: MapId,
  eventId: string,
): EventDraftValidation {
  const event = project.maps[mapId]?.events.find((entry) => entry.id === eventId);
  if (!event) {
    return validationFromIssues([{
      severity: "error",
      code: "event.missing",
      message: "검사할 이벤트를 찾을 수 없습니다.",
      pageId: "",
    }]);
  }
  return validateEventDraftBody(project, mapId, event);
}

export function validateEventDraftBody(
  project: Project,
  mapId: MapId,
  event: GameEvent,
): EventDraftValidation {
  const working = projectWithEventDraftAuthoredWrites(project, mapId, event.id);
  const issues: EventDraftIssue[] = [];
  const refs = referenceSets(working, mapId, event);
  const pages = event.pages ?? [];

  if (pages.length === 0) {
    issues.push({
      severity: "error",
      code: "page.missing",
      message: "이벤트에는 최소 한 개의 페이지가 필요합니다.",
      pageId: "",
      field: { testId: "event-page-tab-add" },
    });
    return validationFromIssues(issues);
  }

  const firstPageId = pages[0]!.id;
  const map = working.maps[mapId];
  if (!map || event.x < 0 || event.y < 0 || event.x >= map.width || event.y >= map.height) {
    issues.push({
      severity: "error",
      code: "event.position.out-of-bounds",
      message: `이벤트 위치 (${event.x}, ${event.y})가 맵 범위를 벗어났습니다.`,
      pageId: firstPageId,
      // 이동 문제는 헤더의 살아있는 좌표 표시로 데려간다 — 숨어 있던 identity 카드의 좌표 입력물은 삭제됐다.
      field: { testId: "event-editor-coords" },
    });
  }
  if (event.condition) validateCondition(event.condition, firstPageId, refs, issues);

  for (const page of pages) {
    validatePage(working, mapId, event, page, refs, issues);
  }
  checkCallDepth(working, issues);
  validateSchedule(working, event, refs, firstPageId, issues);
  return validationFromIssues(issues);
}

export function hasRecursivePageCondition(conditions: readonly Condition[]): boolean {
  return conditions.some(conditionHasLeaf);
}

export function eventDraftIssuesForPage(
  validation: EventDraftValidation,
  pageId: string,
): readonly EventDraftIssue[] {
  return validation.issues.filter((issue) => issue.pageId === pageId);
}

function validationFromIssues(issues: readonly EventDraftIssue[]): EventDraftValidation {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const infoCount = issues.filter((issue) => issue.severity === "info").length;
  return { issues, errorCount, warningCount, infoCount, canCommit: errorCount === 0 };
}

function referenceSets(project: Project, mapId: MapId, host: GameEvent) {
  const map = project.maps[mapId];
  return {
    actors: new Set(project.database.actors.map((entry) => entry.id)),
    animations: new Set(project.database.battleAnimations.map((entry) => entry.id)),
    classes: new Set(project.database.classes.map((entry) => entry.id)),
    commonEvents: new Set((project.commonEvents ?? []).map((entry) => entry.id)),
    endings: new Set((project.endings ?? []).map((entry) => entry.id)),
    equipment: new Set(project.database.equipment.map((entry) => entry.id)),
    factions: new Set([
      PLAYER_FACTION_ID,
      DEFAULT_ENEMY_FACTION_ID,
      ...(project.factions?.defs ?? []).map((entry) => entry.id),
    ]),
    events: new Set((map?.events ?? []).map((entry) => entry.id)),
    eventTemplates: new Set(
      Object.values(project.maps).flatMap((projectMap) => projectMap.events.map((entry) => entry.id)),
    ),
    items: new Set(project.database.items.map((entry) => entry.id)),
    lifeSkills: new Set((project.database.lifeSkills ?? []).map((entry) => entry.id)),
    maps: new Set(Object.keys(project.maps)),
    npcActivities: new Set(collectNpcActivitySuggestions(project)),
    recipes: new Set((project.system.craftRecipes ?? []).map((entry) => entry.id)),
    resources: collectResourceIds(project),
    skills: new Set(project.database.skills.map((entry) => entry.id)),
    states: new Set(project.database.states.map((entry) => entry.id)),
    species: new Set((project.database.monsterSpecies ?? []).map((entry) => entry.id)),
    switches: new Set(project.switches.map((entry) => entry.id)),
    troops: new Set(project.database.troops.map((entry) => entry.id)),
    upgrades: new Set((project.system.itemUpgrades ?? []).map((entry) => entry.id)),
    variables: new Set(project.variables.map((entry) => entry.id)),
    // 사회 기능은 이름표가 아니라 이 이벤트의 신원을 참조한다 — 같은 사전에 싣어 재긍 없이 나른다.
    hostHasCharacterId: hasCharacterId(host),
    hasTimeSystem: resolveTimeSystem(project) !== undefined,
  };
}

function validatePage(
  project: Project,
  mapId: MapId,
  event: GameEvent,
  page: EventPage,
  refs: ReferenceSets,
  issues: EventDraftIssue[],
): void {
  const graphic = page.graphic ?? {};
  const conditions = page.conditions ?? [];
  const trigger = page.trigger ?? { kind: "action" as const };
  if (graphic.sprite?.id) {
    requireReference(issues, page.id, "reference.resource.missing", "그래픽 리소스", graphic.sprite.id, refs.resources, {
      testId: "event-classic-graphic",
    });
  }

  const advanced = advancedConditionEntries({ conditions });
  conditions.forEach((condition, index) => {
    const advancedIndex = advanced.findIndex((entry) => entry.index === index);
    const switchSlot = conditions.slice(0, index).filter((entry) => entry.kind === "switch").length;
    validatePageCondition(condition, page.id, refs, issues, advancedIndex < 0 ? undefined : String(advancedIndex), switchSlot);
  });
  if (page.movement) validateMovement(project, page, refs, issues);

  const riskyTrigger = trigger.kind === "auto" || trigger.kind === "parallel";
  if (riskyTrigger && !hasRecursivePageCondition(conditions)) {
    issues.push({
      severity: "warning",
      code: "page.auto-parallel-ungated",
      message: "자동/병렬 페이지에 종료·게이트 조건이 없어 계속 반복될 수 있습니다.",
      pageId: page.id,
      field: { testId: "event-page-safety-warning" },
    });
  }

  const invisible = graphic.transparent === true || !graphic.sprite?.id;
  if (invisible && page.priority === "same" && (page.overlapForbidden ?? true)) {
    issues.push({
      severity: "warning",
      code: "page.invisible-collision",
      message: "보이지 않는 페이지가 캐릭터와 같은 높이에서 이동을 막습니다. 의도한 충돌인지 확인하세요.",
      pageId: page.id,
      field: { testId: "event-page-overlap-forbidden" },
    });
  }

  const commands = page.commands ?? [];
  if (commands.length === 0) {
    issues.push({
      severity: "info",
      code: "page.empty",
      message: "실행 명령이 없습니다. 상태 표시용 빈 페이지라면 그대로 둘 수 있습니다.",
      pageId: page.id,
    });
    return;
  }

  if (!commands.some(commandHasEffect)) {
    issues.push({
      severity: "info",
      code: "page.no-op",
      message: "이 페이지의 명령은 실행 결과를 만들지 않습니다.",
      pageId: page.id,
    });
  }

  const visits = walkCommands(commands);
  validateLabels(page.id, commands, issues);
  validateBreakLoopPlacement(commands, page.id, issues);
  validateLoopBodies(commands, page.id, issues);
  validateVariableDivideByZero(commands, page.id, issues);
  for (const visit of visits) {
    validateCommand(project, mapId, event, page.id, visit, refs, issues);
  }
}

function validateSchedule(
  project: Project,
  event: GameEvent,
  refs: ReferenceSets,
  pageId: string,
  issues: EventDraftIssue[],
): void {
  for (const [index, entry] of (event.schedule ?? []).entries()) {
    const mapField = { testId: `event-schedule-map-${index}` };
    const positionField = { testId: `event-schedule-x-${index}` };
    requireReference(
      issues,
      pageId,
      "reference.map.missing",
      "일정 목적지 맵",
      entry.at.mapId,
      refs.maps,
      mapField,
    );
    validateMapPosition(
      project,
      entry.at.mapId,
      entry.at.x,
      entry.at.y,
      pageId,
      undefined,
      "일정 목적지",
      issues,
      positionField,
    );
  }
}

function validateMovement(
  project: Project,
  page: EventPage,
  refs: ReferenceSets,
  issues: EventDraftIssue[],
): void {
  if (page.movement.type === "custom") {
    validateMoveRoute(
      project,
      page.movement.route,
      page.id,
      undefined,
      refs,
      issues,
      { testId: "event-page-custom-route" },
    );
  }
  if (page.movement.type !== "living") return;
  for (const destination of page.movement.living?.destinations ?? []) {
    requireReference(
      issues,
      page.id,
      "reference.map.missing",
      "생활 이동 맵",
      destination.mapId,
      refs.maps,
      { testId: "event-page-living-target-map" },
    );
    validateMapPosition(
      project,
      destination.mapId,
      destination.x,
      destination.y,
      page.id,
      undefined,
      "생활 이동 목적지",
      issues,
      { testId: "event-page-living-target-x" },
    );
    if (destination.switchId) {
      requireReference(
        issues,
        page.id,
        "reference.switch.missing",
        "생활 이동 스위치",
        destination.switchId,
        refs.switches,
        { testId: "event-page-living-route" },
      );
    }
  }
}

/** Keep page-condition position through recursion instead of reusing command-form anchors. */
function validatePageCondition(
  condition: Condition,
  pageId: string,
  refs: ReferenceSets,
  issues: EventDraftIssue[],
  advancedSuffix?: string,
  switchSlot = 0,
): void {
  if ((condition.kind === "all" || condition.kind === "any") && condition.conditions.length > 0) {
    condition.conditions.forEach((child, index) =>
      validatePageCondition(child, pageId, refs, issues, `${advancedSuffix}-${index}`));
    return;
  }
  if (condition.kind === "not") {
    validatePageCondition(condition.condition, pageId, refs, issues, `${advancedSuffix}-0`);
    return;
  }
  const found: EventDraftIssue[] = [];
  validateCondition(condition, pageId, refs, found);
  const field = pageConditionField(condition, advancedSuffix, switchSlot);
  issues.push(...found.map((issue) => field ? { ...issue, field } : issue));
}

function validateCondition(
  condition: Condition,
  pageId: string,
  refs: ReferenceSets,
  issues: EventDraftIssue[],
  commandPath?: readonly number[],
): void {
  switch (condition.kind) {
    case "switch":
      requireReference(issues, pageId, "reference.switch.missing", "스위치", condition.switchId, refs.switches, { testId: "event-condition-switch" }, commandPath);
      return;
    case "variable":
      requireReference(issues, pageId, "reference.variable.missing", "변수", condition.variableId, refs.variables, { testId: "event-condition-variable" }, commandPath);
      return;
    case "actor":
      requireReference(issues, pageId, "reference.actor.missing", "배우", condition.actorId, refs.actors, { testId: "event-condition-actor" }, commandPath);
      return;
    case "item":
      requireReference(issues, pageId, "reference.item.missing", "아이템", condition.itemId, refs.items, { testId: "event-condition-item" }, commandPath);
      return;
    case "all":
    case "any":
      if (condition.conditions.length === 0) {
        issues.push({
          severity: "warning",
          code: `condition.${condition.kind}.empty`,
          message: condition.kind === "all" ? "모두(AND)에 하위 조건이 없습니다. 빈 AND는 항상 참입니다." : "하나(OR)에 하위 조건이 없습니다. 빈 OR는 항상 거짓입니다.",
          pageId,
          ...(commandPath ? { commandPath: [...commandPath] } : {}),
          field: { testId: `event-condition-${condition.kind}-empty` },
        });
      }
      condition.conditions.forEach((child) => validateCondition(child, pageId, refs, issues, commandPath));
      return;
    case "not":
      validateCondition(condition.condition, pageId, refs, issues, commandPath);
      return;
    case "selfSwitch":
      return;
    case "gold": {
      const trap = goldConditionTrap(condition.op, condition.amount);
      if (trap) {
        issues.push({
          severity: "warning",
          code: "condition.gold.impossible",
          message: trap === "always-false"
            ? "소지금이 가질 수 있는 값으로는 이 비교가 항상 거짓입니다."
            : "소지금이 가질 수 있는 값으로는 이 비교가 항상 참입니다.",
          pageId,
          ...(commandPath ? { commandPath: [...commandPath] } : {}),
          field: { testId: "event-condition-gold-amount" },
        });
      }
      return;
    }
    case "timer": {
      if (condition.seconds === 0) {
        const timerLabel = condition.timerId === "timer2" ? "타이머 2" : "타이머 1";
        issues.push({
          severity: "warning",
          code: "condition.timer.always-true",
          message: `${timerLabel} · 0초 이하 조건은 타이머가 꺼져 있으면 남은 시간을 0초로 보아 항상 참입니다. 페이지가 항상 보일 수 있습니다.`,
          pageId,
          ...(commandPath ? { commandPath: [...commandPath] } : {}),
          field: {
            testId: commandPath
              ? "event-condition-timer-seconds"
              : `event-page-${condition.timerId}-condition-seconds`,
          },
        });
      }
      return;
    }
    case "timePhase":
      if (!refs.hasTimeSystem) {
        issues.push({
          severity: "warning",
          code: "condition.timePhase.no-time-system",
          message: "시간 시스템이 꺼져 있어 시간대 조건은 항상 거짓입니다.",
          pageId,
          ...(commandPath ? { commandPath: [...commandPath] } : {}),
          field: {
            testId: commandPath ? "event-condition-time-phase" : "event-page-time-phase-condition-input",
          },
        });
      }
      return;
    case "season":
      if (!refs.hasTimeSystem) {
        issues.push({
          severity: "warning",
          code: "condition.season.no-time-system",
          message: "시간 시스템이 꺼져 있어 계절 조건은 항상 거짓입니다.",
          pageId,
          ...(commandPath ? { commandPath: [...commandPath] } : {}),
          field: {
            testId: commandPath ? "event-condition-season" : "event-page-season-condition-input",
          },
        });
      }
      return;
    case "npcActivity": {
      const activity = condition.activity.trim();
      if (!activity) {
        issues.push({
          severity: "warning",
          code: "condition.npcActivity.empty",
          message: "활동 이름이 비어 있어 이 조건은 항상 거짓입니다.",
          pageId,
          ...(commandPath ? { commandPath: [...commandPath] } : {}),
          field: {
            testId: commandPath ? "event-condition-npc-activity" : "event-page-npc-activity-condition-input",
          },
        });
        return;
      }
      // 세션 활동 값을 쓰는 곳은 npcSchedules.setActivity 하나뿐이고 그 값은 일정 항목의
      // activity 에서만 온다. 그래서 어떤 일정에도 없는 이름은 매칭될 수 없다.
      if (!refs.npcActivities.has(activity)) {
        issues.push({
          severity: "warning",
          code: "condition.npcActivity.unknown",
          message: `이 프로젝트의 NPC 일정에 없는 활동입니다(${activity}). 「NPC와 일정」에서 같은 이름을 쓰거나 이름을 맞춰 주세요.`,
          pageId,
          ...(commandPath ? { commandPath: [...commandPath] } : {}),
          field: {
            testId: commandPath ? "event-condition-npc-activity" : "event-page-npc-activity-condition-input",
          },
        });
      }
      return;
    }
    case "battleResult":
      // battleResult 는 지속되는 세션 상태다 — 랜덤 인카운터·필드 스폰은 battleProcessing
      // 없이도 전투를 열고, 다른 이벤트·공통 이벤트가 남긴 결과도 살아남는다. 명령 순서나
      // 프로젝트 스캔으로 "항상 거짓"을 증명할 수 없으므로 검사하지 않는다.
      return;
    case "friendshipAtLeast":
      // 런타임 하드 게이트: NPC 키가 비었고 이 이벤트에 characterId 도 없으면 항상 거짓이다.
      if (!condition.npcKey?.trim() && !refs.hostHasCharacterId) {
        issues.push({
          severity: "warning",
          code: "condition.friendship.no-character-id",
          message: "호감도 조건에 쓸 NPC 관계가 없어 이 조건은 항상 거짓입니다. 「NPC와 일정」에서 인물을 연결하거나 NPC 키를 적으세요.",
          pageId,
          ...(commandPath ? { commandPath: [...commandPath] } : {}),
          field: { testId: "event-page-friendship-condition-npc-key" },
        });
      }
      return;
    case "relationshipAtLeast":
      if (!condition.npcKey?.trim() && !refs.hostHasCharacterId) {
        issues.push({
          severity: "warning",
          code: "condition.relationship.no-character-id",
          message: "관계 조건에 쓸 NPC 관계가 없어 이 조건은 항상 거짓입니다. 「NPC와 일정」에서 인물을 연결하거나 NPC 키를 적으세요.",
          pageId,
          ...(commandPath ? { commandPath: [...commandPath] } : {}),
          field: { testId: "event-page-relationship-condition-npc-key" },
        });
      }
      return;
    case "run":
      if (condition.query === "flag" && !condition.flag.trim()) {
        issues.push({
          severity: "error",
          code: "condition.run.flag-empty",
          message: "기억 이름이 비어 있습니다.",
          pageId,
          ...(commandPath ? { commandPath: [...commandPath] } : {}),
          field: { testId: "event-condition-run-flag" },
        });
      }
      return;
  }
  const exhaustive: never = condition;
  void exhaustive;
}

function conditionHasLeaf(condition: Condition): boolean {
  if (condition.kind === "all" || condition.kind === "any") {
    return condition.conditions.some(conditionHasLeaf);
  }
  if (condition.kind === "not") return conditionHasLeaf(condition.condition);
  return true;
}

function goldConditionTrap(
  op: Extract<Condition, { kind: "gold" }>["op"],
  amount: number,
): "always-true" | "always-false" | undefined {
  if (!Number.isFinite(amount)) return "always-false";
  switch (op) {
    case ">=":
      if (amount <= 0) return "always-true";
      if (amount > GOLD_MAX) return "always-false";
      return undefined;
    case ">":
      if (amount < 0) return "always-true";
      if (amount >= GOLD_MAX) return "always-false";
      return undefined;
    case "<=":
      if (amount >= GOLD_MAX) return "always-true";
      if (amount < 0) return "always-false";
      return undefined;
    case "<":
      if (amount > GOLD_MAX) return "always-true";
      if (amount <= 0) return "always-false";
      return undefined;
    case "==":
      if (amount < 0 || amount > GOLD_MAX) return "always-false";
      return undefined;
    case "!=":
      if (amount < 0 || amount > GOLD_MAX) return "always-true";
      return undefined;
  }
}

function validateLabels(
  pageId: string,
  commands: readonly Command[],
  issues: EventDraftIssue[],
  containerPath: readonly number[] = [],
  ancestorLabels: readonly ReadonlySet<string>[] = [],
): void {
  const labels = new Map<string, CommandVisit[]>();
  commands.forEach((command, index) => {
    if (command.kind !== "label") return;
    const path = [...containerPath, index];
    const name = command.name.trim();
    if (!name) {
      issues.push({ severity: "error", code: "label.empty", message: "라벨 이름이 비어 있습니다.", pageId, commandPath: path });
      return;
    }
    const rows = labels.get(name) ?? [];
    rows.push({ command, path });
    labels.set(name, rows);
  });

  for (const [name, rows] of labels) {
    if (rows.length < 2) continue;
    for (const row of rows) {
      issues.push({
        severity: "error",
        code: "label.duplicate",
        message: `라벨 '${name}'이(가) 같은 실행 범위에 ${rows.length}번 있습니다.`,
        pageId,
        commandPath: row.path,
      });
    }
  }

  const localLabels = new Set(labels.keys());
  commands.forEach((command, index) => {
    const path = [...containerPath, index];
    if (command.kind === "gotoLabel") {
      const name = command.name.trim();
      const visible = localLabels.has(name) || ancestorLabels.some((scope) => scope.has(name));
      if (!name || !visible) {
        issues.push({
          severity: "error",
          code: "label.target-missing",
          message: name ? `현재 실행 범위에서 이동할 라벨 '${name}'을(를) 찾을 수 없습니다.` : "이동할 라벨 이름이 비어 있습니다.",
          pageId,
          commandPath: path,
        });
      }
    }
    for (const branch of commandBranches(command)) {
      validateLabels(
        pageId,
        branch.commands,
        issues,
        [...path, branch.branchIndex],
        [localLabels, ...ancestorLabels],
      );
    }
  });
}

function validateBreakLoopPlacement(commands: readonly Command[], pageId: string, issues: EventDraftIssue[]): void {
  const loopDepthAt = (targetPath: readonly number[]): number => {
    let depth = 0;
    let list: readonly Command[] = commands;
    for (let i = 0; i < targetPath.length - 1; i += 2) {
      const cmdIndex = targetPath[i]!;
      const branchIndex = targetPath[i + 1]!;
      const cmd = list[cmdIndex];
      if (!cmd) break;
      if (cmd.kind === "loop" && branchIndex === LOOP_BODY_BRANCH_INDEX) depth += 1;
      const branch = commandBranches(cmd).find((entry) => entry.branchIndex === branchIndex);
      if (!branch) break;
      list = branch.commands;
    }
    return depth;
  };
  for (const visit of walkCommands(commands)) {
    if (visit.command.kind !== "breakLoop") continue;
    const depth = loopDepthAt(visit.path);
    if (depth <= 0) {
      issues.push({
        severity: "error",
        code: "loop.break-outside-loop",
        message: "반복 탈출은 반복 안에서만 쓸 수 있습니다. 바깥에서 쓰면 이벤트가 중단됩니다.",
        pageId,
        commandPath: [...visit.path],
        field: { testId: "event-break-loop" },
      });
    }
  }
}

function validateLoopBodies(commands: readonly Command[], pageId: string, issues: EventDraftIssue[]): void {
  for (const visit of walkCommands(commands)) {
    if (visit.command.kind !== "loop") continue;
    const body = visit.command.body;
    if (body.length === 0) {
      issues.push({
        severity: "warning",
        code: "loop.empty-body",
        message: "반복 내용이 비어 있습니다. 아무 일도 일어나지 않습니다.",
        pageId,
        commandPath: [...visit.path],
      });
      continue;
    }
    const hasBreak = walkCommands(body).some((entry) => entry.command.kind === "breakLoop");
    if (!hasBreak) {
      issues.push({
        severity: "warning",
        code: "loop.no-break",
        message: "반복 탈출이 없습니다. 무한 반복이 될 수 있으니 종료 조건을 확인하세요.",
        pageId,
        commandPath: [...visit.path],
      });
    }
  }
}

function validateVariableDivideByZero(commands: readonly Command[], pageId: string, issues: EventDraftIssue[]): void {
  for (const visit of walkCommands(commands)) {
    if (visit.command.kind !== "setVariable") continue;
    if (visit.command.op !== "/=") continue;
    const value = visit.command.value;
    if (typeof value === "number" && value === 0) {
      issues.push({
        severity: "warning",
        code: "variable.divide-by-zero",
        message: "0으로 나누기는 무시됩니다. 값을 확인하세요.",
        pageId,
        commandPath: [...visit.path],
        field: { testId: "event-variable-divide-zero" },
      });
    }
  }
}

const SCREEN_EFFECT_COMMAND_ID = "m2-202-screen-effect";

/**
 * 화면 효과의 런타임 경고를 효과 단위로 말한다(적대적 QA 3라운드 D9).
 *
 * 명령 단위 분류(m2CommandRuntimeSupport)는 이 커맨드를 map 컨텍스트에서 `runtime-partial` 로
 * 읽으므로, 모든 행에 `이 명령은 실제 게임에서 일부 효과만 실행됩니다` 가 붙었다. 그 문장은
 * fadeIn/fadeOut/flash/tint/weather 에는 거짓이다 — applyScreenEffect 가 실제 렌더 경로
 * (screen.tint / flash / weather)에 그대로 얹는다. 참인 경우는 렌더러가 없는 값(blur 등)뿐이다.
 *
 * @returns `"not-applicable"` = 화면 효과 명령이 아님(일반 규칙을 그대로 쓴다),
 *   `null` = 화면 효과이고 실제로 실행된다(경고 없음), 그 외 = 효과를 지목한 경고.
 */
function screenEffectRuntimeIssue(
  command: Command,
  pageId: string,
  path: readonly number[],
): EventDraftIssue | null | "not-applicable" {
  if (command.kind !== "m2Command" || command.commandId !== SCREEN_EFFECT_COMMAND_ID) return "not-applicable";
  const effect = String(command.fields?.effect ?? "fadeIn");
  const value = String(command.fields?.value ?? "");
  const plan = planScreenEffect(effect, value, Number(command.fields?.durationMs ?? 300));
  if (plan.kind !== "unsupported") return null;
  return {
    severity: "warning",
    code: "runtime.screenEffect.unsupported",
    message: `화면 효과 '${effect}' 는 런타임에 렌더러가 없어 실행되지 않습니다 — 페이드/플래시/색조/날씨 중에서 고르세요.`,
    pageId,
    commandPath: path,
  };
}

function validateCommand(
  project: Project,
  mapId: MapId,
  _event: GameEvent,
  pageId: string,
  visit: CommandVisit,
  refs: ReferenceSets,
  issues: EventDraftIssue[],
): void {
  const command = visit.command;
  const path = visit.path;
  try {
    const support = commandRuntimeSupport(command, "map");
    const screenEffect = screenEffectRuntimeIssue(command, pageId, path);
    if (screenEffect !== "not-applicable") {
      // 화면 효과는 고른 어떤 것을 실행하는가로 갈린다 — 행당 "일부 효과만" 가 아니다(D9).
      if (screenEffect) issues.push(screenEffect);
    } else if (support === "editor-only") {
      issues.push({ severity: "warning", code: "runtime.editor-only", message: "이 명령은 에디터 전용이며 실제 게임에서는 효과 없이 건너뜁니다.", pageId, commandPath: path });
    } else if (support === "runtime-partial") {
      issues.push({ severity: "warning", code: "runtime.partial", message: "이 명령은 실제 게임에서 일부 효과만 실행됩니다.", pageId, commandPath: path });
    }
  } catch {
    issues.push({ severity: "error", code: "runtime.unclassified", message: "이 명령은 아직 게임에서 어떻게 실행될지 모릅니다.", pageId, commandPath: path });
  }

  const require = (code: string, label: string, id: string | undefined, known: ReadonlySet<string>, allowEmpty = false) => {
    if (allowEmpty && !id?.trim()) return;
    requireReference(issues, pageId, code, label, id ?? "", known, undefined, path);
  };
  const variableOperand = (value: unknown, label: string) => {
    if (typeof value === "object" && value !== null && "kind" in value && value.kind === "var" && "id" in value) {
      require("reference.variable.missing", label, String(value.id), refs.variables);
    }
  };

  switch (command.kind) {
    case "changeFace": require("reference.resource.missing", "얼굴 리소스", command.resourceId, refs.resources, true); return;
    case "fork": validateCondition(command.condition, pageId, refs, issues, path); return;
    case "wait": require("reference.variable.missing", "대기 변수", command.variableId, refs.variables, true); return;
    case "inputWait": require("reference.variable.missing", "입력 대기 변수", command.variableId, refs.variables, true); return;
    case "inputNumber": require("reference.variable.missing", "숫자 입력 변수", command.variableId, refs.variables); return;
    case "setSwitch":
      require("reference.switch.missing", "스위치", command.switchId, refs.switches);
      variableOperand(command.value, "스위치 값 변수");
      return;
    case "setVariable":
      require("reference.variable.missing", "변수", command.variableId, refs.variables);
      variableOperand(command.value, "변수 피연산자");
      return;
    case "transfer":
      require("reference.map.missing", "맵", command.mapId, refs.maps);
      validateMapPosition(project, command.mapId, command.x, command.y, pageId, path, "맵 이동 목적지", issues);
      return;
    case "changeTile":
      require("reference.map.missing", "맵", command.mapId, refs.maps);
      validateMapPosition(project, command.mapId, command.x, command.y, pageId, path, "타일 변경 위치", issues);
      return;
    case "moveEvent":
      if (command.eventId && command.eventId !== PLAYER_MOVE_TARGET) require("reference.event.missing", "이동 대상 이벤트", command.eventId, refs.events);
      validateMoveRoute(project, command.route, pageId, path, refs, issues);
      return;
    case "setEventGraphicPattern": require("reference.event.missing", "외형 변경 이벤트", command.eventId, refs.events, true); return;
    case "callCommonEvent": require("reference.common-event.missing", "다른 이벤트", command.commonEventId, refs.commonEvents); return;
    case "callMapEvent": require("reference.event.missing", "맵 위 이벤트", command.eventId, refs.events); return;
    case "battleProcessing":
      if (command.troopSource === "variable") require("reference.variable.missing", "적 그룹 변수", command.troopVariableId, refs.variables);
      else require("reference.troop.missing", "적 그룹", command.troopId, refs.troops);
      return;
    case "learnSkill": require("reference.actor.missing", "배우", command.actorId, refs.actors, true); require("reference.skill.missing", "스킬", command.skillId, refs.skills); return;
    case "changeExp": require("reference.actor.missing", "배우", command.actorId, refs.actors, true); variableOperand(command.amount, "경험치 변수"); return;
    case "changeLevel":
    case "changeActorHp":
    case "changeActorMp":
    case "changeParty": require("reference.actor.missing", "배우", command.actorId, refs.actors); return;
    case "changeLifeSkillExp": require("reference.life-skill.missing", "생활 스킬", command.skillId, refs.lifeSkills); variableOperand(command.amount, "생활 스킬 경험치 변수"); return;
    case "promoteActor": require("reference.actor.missing", "배우", command.actorId, refs.actors); require("reference.class.missing", "전직 직업", command.toClassId, refs.classes, true); return;
    case "changeEquipment": require("reference.actor.missing", "배우", command.actorId, refs.actors); require("reference.equipment.missing", "장비", command.equipmentId, refs.equipment, true); return;
    case "recoverAll": require("reference.actor.missing", "배우", command.actorId, refs.actors, true); return;
    case "enterHeroName": require("reference.actor.missing", "배우", command.actorId, refs.actors, true); return;
    case "changeGold": variableOperand(command.amount, "골드 변수"); return;
    case "changeItem": require("reference.item.missing", "아이템", command.itemId, refs.items); variableOperand(command.amount, "아이템 수량 변수"); return;
    case "craftRecipe": require("reference.recipe.missing", "제작법", command.recipeId, refs.recipes); return;
    case "applyItemUpgrade": require("reference.upgrade.missing", "업그레이드", command.upgradeId, refs.upgrades); return;
    case "equipTool": require("reference.item.missing", "도구 아이템", command.itemId, refs.items, true); return;
    case "getFriendship": require("reference.variable.missing", "호감도 저장 변수", command.variableId, refs.variables); return;
    case "changeFactionStance":
      requireReference(
        issues,
        pageId,
        "reference.faction.missing",
        "진영 A",
        command.a,
        refs.factions,
        { testId: "event-command-faction-a" },
        path,
      );
      requireReference(
        issues,
        pageId,
        "reference.faction.missing",
        "진영 B",
        command.b,
        refs.factions,
        { testId: "event-command-faction-b" },
        path,
      );
      return;
    case "giveMonster": require("reference.species.missing", "몬스터 종", command.speciesId, refs.species); return;
    case "evolveMonster": require("reference.species.missing", "진화 대상 종", command.toSpeciesId, refs.species, true); return;
    case "addFollower":
      require("reference.actor.missing", "동료 배우", command.actorId, refs.actors, true);
      require("reference.resource.missing", "동료 그래픽", command.graphic?.sprite?.id, refs.resources, true);
      return;
    case "addLight":
      if (typeof command.source.at === "object") {
        if ("eventId" in command.source.at) {
          require("reference.event.missing", "빛 위치 이벤트", command.source.at.eventId, refs.events, true);
        } else {
          validateMapPosition(
            project,
            mapId,
            command.source.at.x,
            command.source.at.y,
            pageId,
            path,
            "빛 위치",
            issues,
          );
        }
      }
      return;
    case "showAnimation":
      require("reference.animation.missing", "전투 애니메이션", command.animationId, refs.animations);
      if (typeof command.target === "object") {
        if ("eventId" in command.target) {
          require("reference.event.missing", "애니메이션 대상 이벤트", command.target.eventId, refs.events, true);
        } else {
          validateMapPosition(
            project,
            mapId,
            command.target.x,
            command.target.y,
            pageId,
            path,
            "애니메이션 대상 위치",
            issues,
          );
        }
      }
      return;
    case "showEmote":
      if (typeof command.target === "object") {
        require("reference.event.missing", "이모트 대상 이벤트", command.target.eventId, refs.events, true);
      }
      return;
    case "showPicture": require("reference.resource.missing", "그림 리소스", command.resourceId, refs.resources); return;
    case "playAudio": require("reference.resource.missing", "오디오 리소스", command.resourceId, refs.resources); return;
    // 동영상도 그림·오디오와 같은 기준이다 — 미지정·없는 리소스는 둘 다 오류로 말한다.
    case "playMovie": require("reference.resource.missing", "동영상 리소스", command.resourceId, refs.resources); return;
    case "shop":
      if (command.itemIds.length === 0 && (command.stock?.length ?? 0) === 0) {
        issues.push({
          severity: "error",
          code: "shop.items.empty",
          message: "상점에 판매할 아이템이 없습니다.",
          pageId,
          commandPath: path,
        });
      }
      command.itemIds.forEach((id) => require("reference.item.missing", "상점 아이템", id, refs.items));
      command.stock?.forEach((entry) => require("reference.item.missing", "상점 재고 아이템", entry.itemId, refs.items));
      if (command.stock) {
        const idSet = new Set(command.itemIds);
        for (const entry of command.stock) {
          if (!idSet.has(entry.itemId)) {
            issues.push({
              severity: "warning",
              code: "shop.stock.orphan",
              message: `상점 재고 ${entry.itemId}가 판매 목록에 없습니다.`,
              pageId,
              commandPath: path,
            });
          }
        }
      }
      return;
    case "m2Command": {
      const entry = validateM2CommandReferences(command, pageId, path, refs, issues);
      if (entry) validateM2CommandCoordinates(project, mapId, command, pageId, path, entry, issues);
      return;
    }
    case "triggerEnding": require("reference.ending.missing", "엔딩", command.endingId, refs.endings, true); return;
    case "spawnFieldEnemy":
      require("reference.troop.missing", "필드 적 그룹", command.spawn.troopId, refs.troops);
      require("reference.switch.missing", "필드 적 처치 스위치", command.spawn.onKillSwitchId, refs.switches, true);
      require("reference.resource.missing", "필드 적 그래픽", command.spawn.graphic?.sprite?.id, refs.resources, true);
      validateMapRect(project, mapId, command.spawn.area, pageId, path, "필드 적 생성 영역", issues);
      return;
    case "text":
    case "choices":
    case "label":
    case "gotoLabel":
    case "loop":
    case "breakLoop":
    case "timer":
    case "advanceTime":
    case "advanceCropGrowth":
    case "setTime":
    case "sleepUntilMorning":
    case "moveMonster":
    case "openChest":
    case "changeFriendship":
    case "setRelationship":
    case "removeFollower":
    case "setLighting":
    case "removeLight":
    case "setWeather":
    case "erasePicture":
    case "stopAudio":
    case "cutsceneControl":
    case "displayTextSettings":
    case "inn":
    case "checkpointSave":
    case "openSaveMenu":
    case "despawnFieldEnemy":
    case "runControl":
    case "killPlayer":
    case "gameOver":
    case "ending":
    case "returnToTitle":
    case "setFlag":
    case "setSelfSwitch":
      return;
  }
  const exhaustive: never = command;
  void exhaustive;
}

type M2ReferenceRule = {
  readonly code: string;
  readonly label: string;
  readonly known: (refs: ReferenceSets) => ReadonlySet<string>;
};

const M2_REFERENCE_RULES: Readonly<Record<string, M2ReferenceRule>> = {
  actorId: { code: "reference.actor.missing", label: "M2 배우", known: (refs) => refs.actors },
  animationId: { code: "reference.animation.missing", label: "M2 애니메이션", known: (refs) => refs.animations },
  eventA: { code: "reference.event.missing", label: "M2 이벤트 A", known: (refs) => refs.events },
  eventB: { code: "reference.event.missing", label: "M2 이벤트 B", known: (refs) => refs.events },
  eventId: { code: "reference.event.missing", label: "M2 이벤트", known: (refs) => refs.events },
  itemId: { code: "reference.item.missing", label: "M2 아이템", known: (refs) => refs.items },
  mapId: { code: "reference.map.missing", label: "M2 맵", known: (refs) => refs.maps },
  mapVariableId: { code: "reference.variable.missing", label: "M2 맵 변수", known: (refs) => refs.variables },
  prefabId: { code: "reference.event.missing", label: "M2 생성 원본 이벤트", known: (refs) => refs.eventTemplates },
  resourceId: { code: "reference.resource.missing", label: "M2 리소스", known: (refs) => refs.resources },
  skillId: { code: "reference.skill.missing", label: "M2 스킬", known: (refs) => refs.skills },
  switchId: { code: "reference.switch.missing", label: "M2 스위치", known: (refs) => refs.switches },
  troopId: { code: "reference.troop.missing", label: "M2 적 그룹", known: (refs) => refs.troops },
  valueVariableId: { code: "reference.variable.missing", label: "M2 값 변수", known: (refs) => refs.variables },
  variableId: { code: "reference.variable.missing", label: "M2 변수", known: (refs) => refs.variables },
  xVariableId: { code: "reference.variable.missing", label: "M2 X 변수", known: (refs) => refs.variables },
  yVariableId: { code: "reference.variable.missing", label: "M2 Y 변수", known: (refs) => refs.variables },
};

function validateM2CommandReferences(
  command: Extract<Command, { kind: "m2Command" }>,
  pageId: string,
  commandPath: readonly number[],
  refs: ReferenceSets,
  issues: EventDraftIssue[],
): M2CatalogEntry | undefined {
  const entry = m2CommandById(command.commandId);
  if (!entry) return undefined;
  if (entry.title.startsWith("Change Actor ") || ["Change Parameters", "Change State", "Damage Processing", "Change Battle Commands"].includes(entry.title)) {
    const rawTarget = String(command.fields.target ?? "party");
    const legacyBattleActor = entry.title === "Change Battle Commands" && rawTarget === "actor";
    const target = legacyBattleActor ? String(command.fields.actorId ?? "") : rawTarget;
    if (legacyBattleActor || (target && target !== "party" && target !== "all")) {
      requireReference(issues, pageId, "reference.actor.missing", "배우", target, refs.actors,
        { testId: "m2-command-target-input" }, commandPath);
    }
    if (entry.title === "Change State") {
      requireReference(issues, pageId, "reference.state.missing", "상태", String(command.fields.value ?? ""), refs.states,
        { testId: "change-state-state-select" }, commandPath);
    }
  }
  for (const field of entry.fields) {
    const rule = M2_REFERENCE_RULES[field.key];
    if (!rule || !m2ReferenceFieldApplies(command, entry, field.key)) continue;
    const value = m2FieldValue(command, entry, field.key);
    requireReference(
      issues,
      pageId,
      rule.code,
      rule.label,
      typeof value === "string" ? value : String(value),
      rule.known(refs),
      { testId: `m2-command-${field.key}-input` },
      commandPath,
    );
  }
  return entry;
}

function m2ReferenceFieldApplies(
  command: Extract<Command, { kind: "m2Command" }>,
  entry: M2CatalogEntry,
  fieldKey: string,
): boolean {
  const value = String(m2FieldValue(command, entry, fieldKey)).trim();
  if (entry.title === "Change Battle Commands" && fieldKey === "actorId") return false;
  if (fieldKey === "valueVariableId") {
    return String(m2FieldValue(command, entry, "valueSource")) === "variable";
  }
  if (entry.title === "Spawn Event") {
    if (fieldKey === "eventId") return false;
    if (fieldKey === "mapId") return value.length > 0;
  }
  if (entry.title === "Remove Event" && fieldKey === "eventId") {
    // The blank value means the currently running event, and an explicit value
    // may identify an event created earlier by Spawn Event rather than project data.
    return false;
  }
  if (entry.title === "Region Trigger" && (fieldKey === "eventId" || fieldKey === "switchId")) {
    return value.length > 0;
  }
  return true;
}

function m2FieldValue(
  command: Extract<Command, { kind: "m2Command" }>,
  entry: M2CatalogEntry,
  fieldKey: string,
): string | number | boolean {
  return command.fields[fieldKey]
    ?? entry.fields.find((field) => field.key === fieldKey)?.defaultValue
    ?? "";
}

const M2_CURRENT_MAP_POSITION_TITLES = new Set([
  "Get Terrain ID",
  "Get Event ID",
  "Change Tile",
  "Pathfind Move",
]);

function m2UsesCurrentMapPosition(
  command: Extract<Command, { kind: "m2Command" }>,
  entry: M2CatalogEntry,
  x: number,
  y: number,
): boolean {
  if (M2_CURRENT_MAP_POSITION_TITLES.has(entry.title)) return true;
  if (entry.title !== "Camera Control") return false;

  const target = String(m2FieldValue(command, entry, "target"));
  if (target === "screen" || target === "position" || target === "fixed") return true;

  const authoredMode = String(m2FieldValue(command, entry, "mode"));
  const panMode = !["follow", "lock", "fixed", "return", "restore", "followPlayer"].includes(authoredMode);
  const hasEventTarget = Object.prototype.hasOwnProperty.call(command.fields, "targetEventId")
    || Object.prototype.hasOwnProperty.call(command.fields, "eventId");
  return panMode && (x !== 0 || y !== 0) && !hasEventTarget;
}

function validateM2CommandCoordinates(
  project: Project,
  currentMapId: MapId,
  command: Extract<Command, { kind: "m2Command" }>,
  pageId: string,
  commandPath: readonly number[],
  entry: M2CatalogEntry,
  issues: EventDraftIssue[],
): void {
  const fieldKeys = new Set(entry.fields.map((field) => field.key));
  if (!fieldKeys.has("x") || !fieldKeys.has("y")) return;
  const x = Number(m2FieldValue(command, entry, "x"));
  const y = Number(m2FieldValue(command, entry, "y"));
  if (fieldKeys.has("mapId")) {
    const authoredMapId = String(m2FieldValue(command, entry, "mapId")).trim();
    const destinationMapId = entry.title === "Spawn Event" && !authoredMapId
      ? currentMapId
      : authoredMapId;
    validateMapPosition(
      project,
      destinationMapId,
      x,
      y,
      pageId,
      commandPath,
      `${entry.label} 위치`,
      issues,
    );
    return;
  }
  if (m2UsesCurrentMapPosition(command, entry, x, y)) {
    validateMapPosition(
      project,
      currentMapId,
      x,
      y,
      pageId,
      commandPath,
      `${entry.label} 위치`,
      issues,
    );
  }
}

function validateMapPosition(
  project: Project,
  mapId: MapId,
  x: number,
  y: number,
  pageId: string,
  commandPath: readonly number[] | undefined,
  label: string,
  issues: EventDraftIssue[],
  field?: EventDraftFieldLocator,
): void {
  const map = project.maps[mapId];
  if (!map) return;
  if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < map.width && y < map.height) return;
  issues.push({
    severity: "error",
    code: "map.position.out-of-bounds",
    message: `${label} (${x}, ${y})가 '${map.name}' 맵 범위를 벗어났습니다.`,
    pageId,
    ...(commandPath ? { commandPath: [...commandPath] } : {}),
    ...(field ? { field } : {}),
  });
}

function validateMapRect(
  project: Project,
  mapId: MapId,
  rect: Readonly<{ x: number; y: number; w: number; h: number }>,
  pageId: string,
  commandPath: readonly number[] | undefined,
  label: string,
  issues: EventDraftIssue[],
): void {
  const map = project.maps[mapId];
  if (!map) return;
  const valid = Number.isInteger(rect.x)
    && Number.isInteger(rect.y)
    && Number.isInteger(rect.w)
    && Number.isInteger(rect.h)
    && rect.x >= 0
    && rect.y >= 0
    && rect.w > 0
    && rect.h > 0
    && rect.x + rect.w <= map.width
    && rect.y + rect.h <= map.height;
  if (valid) return;
  issues.push({
    severity: "error",
    code: "map.area.out-of-bounds",
    message: `${label} (${rect.x}, ${rect.y}, ${rect.w}, ${rect.h})가 '${map.name}' 맵 범위를 벗어났습니다.`,
    pageId,
    ...(commandPath ? { commandPath: [...commandPath] } : {}),
  });
}

function validateMoveRoute(
  project: Project,
  route: MoveRoute | undefined,
  pageId: string,
  commandPath: readonly number[] | undefined,
  refs: ReferenceSets,
  issues: EventDraftIssue[],
  field?: EventDraftFieldLocator,
): void {
  for (const move of route?.moves ?? []) {
    if (move.kind === "setSwitch") {
      requireReference(issues, pageId, "reference.switch.missing", "이동 경로 스위치", move.switchId, refs.switches, field, commandPath);
    }
    if (move.kind === "changeGraphic") {
      requireReference(issues, pageId, "reference.resource.missing", "이동 경로 그래픽", move.spriteId, refs.resources, field, commandPath);
    }
    if (move.kind === "npcTransfer") {
      requireReference(issues, pageId, "reference.map.missing", "이동 경로 목적지 맵", move.mapId, refs.maps, field, commandPath);
      validateMapPosition(project, move.mapId, move.x, move.y, pageId, commandPath, "이동 경로 목적지", issues, field);
    }
    if (move.kind === "playSe") {
      requireReference(issues, pageId, "reference.resource.missing", "이동 경로 효과음", move.resourceId, refs.resources, field, commandPath);
    }
  }
}

function requireReference(
  issues: EventDraftIssue[],
  pageId: string,
  code: string,
  label: string,
  id: string,
  known: ReadonlySet<string>,
  field?: EventDraftFieldLocator,
  commandPath?: readonly number[],
): void {
  if (id.trim() && known.has(id)) return;
  issues.push({
    severity: "error",
    code,
    message: id.trim() ? `${label} '${id}'을(를) 찾을 수 없습니다.` : `${label}이(가) 선택되지 않았습니다.`,
    pageId,
    ...(commandPath ? { commandPath: [...commandPath] } : {}),
    ...(field ? { field } : {}),
  });
}

function walkCommands(commands: readonly Command[], containerPath: readonly number[] = []): CommandVisit[] {
  const visits: CommandVisit[] = [];
  commands.forEach((command, index) => {
    const path = [...containerPath, index];
    visits.push({ command, path });
    for (const branch of commandBranches(command)) {
      visits.push(...walkCommands(branch.commands, [...path, branch.branchIndex]));
    }
  });
  return visits;
}

/**
 * 분기 열거는 `./eventCommandBranches` 가 정본이다. 얇은 어댑터로 두는 이유: 예전에 이
 * 함수가 자기 목록을 들고 상점 실패 분기를 빠뜨려, 그 안의 검증 문제를 아예 못 봤다.
 */
function commandBranches(command: Command): readonly { readonly branchIndex: number; readonly commands: readonly Command[] }[] {
  return eventCommandBranches(command).map((branch) => ({ branchIndex: branch.branchIndex, commands: branch.commands }));
}

function commandHasEffect(command: Command): boolean {
  if (command.kind === "label" || command.kind === "breakLoop") return false;
  if (command.kind === "text") return textBodyOf(command).trim().length > 0;
  if (command.kind === "m2Command" && command.commandId.endsWith("comment")) return false;
  if (command.kind === "loop") return command.body.some(commandHasEffect);
  if (command.kind === "fork") return command.then.some(commandHasEffect) || (command.else?.some(commandHasEffect) ?? false);
  return true;
}
