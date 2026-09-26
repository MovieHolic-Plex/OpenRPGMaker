// editor/tools/troopBattlePageTools.ts
// 트룹 전투 이벤트 페이지(= 보스 페이즈) 저작 툴.
//
// 왜 별도 툴인가: `upsert_troop` 의 battleEventPages 는 `additionalProperties:true` 자유 객체였다.
// 조건 kind 오타·빈 commands·무한 반복 조합이 아무 검증 없이 저장되고, 런타임은 조용히 페이지를
// 무시하거나(unsupported) 매 라운드 같은 메시지를 도배한다. 저작자는 "성공" 요약만 보고 넘어간다.
// 그래서 페이지는 페이지 단위 upsert 로 분리하고, 조건·커맨드·반복 안전성을 여기서 전부 검증한다.
//
// 발동 검증은 `simulate_battle` 의 phaseCoverage 가 담당한다(N판 중 몇 판에서 떴는지).
import { countLimitedRuntimeSupportCommands } from "@/project/lint/projectLint";
import { CONDITION_KINDS } from "@/project/commandKindRegistry";
import type {
  BattleEventCondition,
  BattleEventPageRecord,
  BattleEventSpan,
  Command,
  EnemyRecord,
  Project,
  TroopRecord,
} from "@/project/types";
import { normalizeLowLevelCommandArray, validateLowLevelCommandArray } from "./commandArgs";
import { assertPartyActorReferences } from "./partyActorReferences";
import { ensureNamedSwitch } from "./flagHelpers";
import { COMMAND_SCHEMA } from "./schemaShapes";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

const SPANS: readonly BattleEventSpan[] = ["battle", "turn", "moment"];

/** 라운드 조건 — 런타임이 `page:turn` 키로 라운드당 1회만 발동시키는 kind 들. */
const ROUND_CADENCE_KINDS = new Set(["turn", "onRound", "everyRound", "enemyTurn", "actorTurn"]);

/** 전투 전용 조건 kind. 나머지는 일반 이벤트 조건(CONDITION_KINDS)을 그대로 받는다. */
const BATTLE_CONDITION_KINDS = [
  "turn", "onRound", "everyRound", "enemyHp", "enemyHpBelow", "actorHp", "enemyTurn", "actorTurn", "actorCommand",
] as const;

const BATTLE_CONDITION_SCHEMA: JsonSchema = {
  type: "object",
  description:
    "전투 이벤트 조건. 전투 전용 kind: turn{start,interval} / onRound{round} / everyRound{start,interval} / " +
    "enemyHp{enemyId,minPercent,maxPercent} / enemyHpBelow{enemyId?,percent} / actorHp{actorId,minPercent,maxPercent} / " +
    "enemyTurn{enemyId,turn} / actorTurn{actorId,turn} / actorCommand{actorId,commandId}. switch/variable 등 일반 조건도 쓸 수 있다.",
  properties: {
    kind: { type: "string", enum: [...new Set<string>([...BATTLE_CONDITION_KINDS, ...CONDITION_KINDS])] },
    enemyId: { type: "string" },
    actorId: { type: "string" },
    percent: { type: "integer", description: "enemyHpBelow — 이 % 이하일 때" },
    minPercent: { type: "integer" },
    maxPercent: { type: "integer" },
    round: { type: "integer" },
    turn: { type: "integer" },
    start: { type: "integer" },
    interval: { type: "integer" },
    commandId: { type: "string" },
    switchId: { type: "string" },
    variableId: { type: "string" },
    value: { type: "integer" },
  },
  required: ["kind"],
};

const PAGE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "페이지 id. 같은 id 면 교체, 없으면 추가" },
    name: { type: "string" },
    conditions: { type: "array", items: BATTLE_CONDITION_SCHEMA },
    span: { type: "string", enum: [...SPANS], description: "battle=전투당 1회, turn=라운드당, moment=조건 충족 즉시" },
    runOnce: { type: "boolean", description: "생략 시 span==='battle' 이면 true" },
    commands: { type: "array", items: COMMAND_SCHEMA, description: "Command[]. 빈 배열은 거부(저작 도구는 실행할 명령을 요구한다)" },
  },
  required: ["id", "commands"],
};

function requireTroop(project: Project, troopId: unknown): TroopRecord {
  if (typeof troopId !== "string" || troopId.trim().length === 0) {
    throw new ToolError("troopId(문자열)가 필요합니다.", { code: "invalid-args" });
  }
  const troop = project.database.troops.find((entry) => entry.id === troopId);
  if (!troop) {
    const known = project.database.troops.map((entry) => entry.id).slice(0, 12).join(", ") || "없음";
    throw new ToolError(`트룹을 찾을 수 없습니다: ${troopId} — 보유 트룹: ${known}`, { code: "troop-not-found" });
  }
  return troop;
}

/** 트룹에 실제로 출전하는 적 id 집합(enemyIds + members). */
function troopEnemyIds(troop: TroopRecord): Set<string> {
  return new Set([...(troop.enemyIds ?? []), ...(troop.members ?? []).map((member) => member.enemyId)]);
}

function integerField(raw: Record<string, unknown>, key: string, label: string): number {
  const value = raw[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ToolError(`${label}.${key}(숫자)가 필요합니다.`, { code: "invalid-battle-condition" });
  }
  return Math.trunc(value);
}

function percentField(raw: Record<string, unknown>, key: string, label: string): number {
  const value = integerField(raw, key, label);
  if (value < 0 || value > 100) {
    throw new ToolError(`${label}.${key}는 0~100 이어야 합니다: ${value}`, { code: "invalid-battle-condition" });
  }
  return value;
}

function requireTroopEnemy(troop: TroopRecord, enemyId: unknown, label: string, allowSlot = false): string {
  if (typeof enemyId !== "string" || enemyId.trim().length === 0) {
    throw new ToolError(`${label}.enemyId(문자열)가 필요합니다.`, { code: "invalid-battle-condition" });
  }
  const ids = troopEnemyIds(troop);
  if (allowSlot) troop.enemyIds.forEach((_, index) => ids.add(`enemy-${index + 1}`));
  if (!ids.has(enemyId)) {
    throw new ToolError(
      `${label}.enemyId '${enemyId}'는 트룹 '${troop.id}'의 적이 아닙니다 — 이 트룹의 적: ${[...ids].join(", ") || "없음"}. ` +
        `조건은 전투에 나온 적만 볼 수 있습니다(upsert_troop 으로 먼저 편성하세요).`,
      { code: "enemy-not-in-troop" },
    );
  }
  return enemyId;
}

function requireActor(project: Project, actorId: unknown, label: string): string {
  if (typeof actorId !== "string" || actorId.trim().length === 0) {
    throw new ToolError(`${label}.actorId(문자열)가 필요합니다.`, { code: "invalid-battle-condition" });
  }
  if (!project.database.actors.some((actor) => actor.id === actorId)) {
    const known = project.database.actors.map((actor) => actor.id).slice(0, 12).join(", ") || "없음";
    throw new ToolError(`${label}.actorId를 찾을 수 없습니다: ${actorId} — 보유 액터: ${known}`, { code: "actor-not-found" });
  }
  return actorId;
}

/**
 * 전투 조건 하나를 검증해 정규화한다. 전투 전용 kind 는 필수 필드까지 보고,
 * 일반 조건(switch/variable 등)은 kind 만 확인하고 그대로 통과시킨다(이벤트 조건과 같은 계약).
 */
function normalizeBattleCondition(project: Project, troop: TroopRecord, raw: unknown, label: string): BattleEventCondition {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ToolError(`${label}는 조건 객체여야 합니다.`, { code: "invalid-battle-condition" });
  }
  const record = raw as Record<string, unknown>;
  const kind = record.kind;
  if (typeof kind !== "string") throw new ToolError(`${label}.kind(문자열)가 필요합니다.`, { code: "invalid-battle-condition" });
  switch (kind) {
    case "turn":
      return { kind: "turn", start: integerField(record, "start", label), interval: integerField(record, "interval", label) };
    case "onRound":
      return { kind: "onRound", round: integerField(record, "round", label) };
    case "everyRound": {
      const start = record.start === undefined ? undefined : integerField(record, "start", label);
      const interval = record.interval === undefined ? undefined : integerField(record, "interval", label);
      return { kind: "everyRound", ...(start === undefined ? {} : { start }), ...(interval === undefined ? {} : { interval }) };
    }
    case "enemyHp":
      return {
        kind: "enemyHp",
        enemyId: requireTroopEnemy(troop, record.enemyId, label, true),
        minPercent: percentField(record, "minPercent", label),
        maxPercent: percentField(record, "maxPercent", label),
      };
    case "enemyHpBelow":
      return {
        kind: "enemyHpBelow",
        ...(record.enemyId === undefined ? {} : { enemyId: requireTroopEnemy(troop, record.enemyId, label, true) }),
        percent: percentField(record, "percent", label),
      };
    case "actorHp":
      return {
        kind: "actorHp",
        actorId: requireActor(project, record.actorId, label),
        minPercent: percentField(record, "minPercent", label),
        maxPercent: percentField(record, "maxPercent", label),
      };
    case "enemyTurn":
      return { kind: "enemyTurn", enemyId: requireTroopEnemy(troop, record.enemyId, label), turn: integerField(record, "turn", label) };
    case "actorTurn":
      return { kind: "actorTurn", actorId: requireActor(project, record.actorId, label), turn: integerField(record, "turn", label) };
    case "actorCommand": {
      const commandId = record.commandId;
      if (typeof commandId !== "string" || commandId.trim().length === 0) {
        throw new ToolError(`${label}.commandId(문자열)가 필요합니다.`, { code: "invalid-battle-condition" });
      }
      return { kind: "actorCommand", actorId: requireActor(project, record.actorId, label), commandId };
    }
    default: {
      if (!(CONDITION_KINDS as readonly string[]).includes(kind)) {
        throw new ToolError(
          `${label}.kind를 알 수 없습니다: ${kind} — 전투 전용 kind: ${BATTLE_CONDITION_KINDS.join(", ")} (그 외 일반 조건도 사용 가능).`,
          { code: "invalid-battle-condition" },
        );
      }
      return record as unknown as BattleEventCondition;
    }
  }
}

/** Reject unrestricted evaluation loops; turn span and round conditions are throttled by runtime. */
function assertNotRepeatingForever(page: BattleEventPageRecord, label: string): void {
  const runsOnce = page.runOnce ?? page.span === "battle";
  if (runsOnce || page.span === "turn") return;
  if (page.conditions.some((condition) => ROUND_CADENCE_KINDS.has(condition.kind))) return;
  throw new ToolError(
    `${label}: 이 페이지는 조건이 참인 동안 무한 반복 발동합니다(같은 대사·연출이 도배됩니다). ` +
      `span:"battle" 또는 runOnce:true 로 1회성으로 만들거나, span:"turn" 또는 turn/onRound/everyRound 조건으로 라운드당 1회로 제한하세요.`,
    { code: "battle-page-repeats-forever" },
  );
}

function normalizePage(project: Project, troop: TroopRecord, raw: unknown, warnings: string[]): BattleEventPageRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ToolError("page 객체가 필요합니다.", { code: "invalid-args" });
  }
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!id) throw new ToolError("page.id(문자열)가 필요합니다.", { code: "invalid-args" });
  const label = `page '${id}'`;
  const span = SPANS.includes(record.span as BattleEventSpan) ? (record.span as BattleEventSpan) : "battle";
  if (record.span !== undefined && !SPANS.includes(record.span as BattleEventSpan)) {
    warnings.push(`${label}.span '${String(record.span)}'을 알 수 없어 'battle'로 처리했습니다(허용: ${SPANS.join(", ")}).`);
  }
  const conditionsRaw = Array.isArray(record.conditions) ? record.conditions : record.conditions === undefined ? [] : [record.conditions];
  const conditions = conditionsRaw.map((entry, index) => normalizeBattleCondition(project, troop, entry, `${label}.conditions[${index}]`));
  const commands = normalizeLowLevelCommandArray(record.commands, `${label}.commands`, warnings);
  if (commands.length === 0) {
    throw new ToolError(
      `${label}.commands가 비었습니다. 이 저작 도구는 실행할 명령을 요구합니다 — ` +
        `text/setSwitch/m2Command 등 최소 1개를 넣으세요.`,
      { code: "battle-page-empty" },
    );
  }
  validateLowLevelCommandArray(`${label}.commands`, commands);
  assertPartyActorReferences(project, commands, `${label}.commands`);
  const page: BattleEventPageRecord = {
    id,
    name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : id,
    conditions,
    span,
    ...(record.runOnce === undefined ? {} : { runOnce: record.runOnce === true }),
    commands: [...commands],
  };
  assertNotRepeatingForever(page, label);
  return page;
}

function upsertPage(troop: TroopRecord, page: BattleEventPageRecord): "added" | "modified" {
  const pages = troop.battleEventPages ?? (troop.battleEventPages = []);
  const index = pages.findIndex((entry) => entry.id === page.id);
  if (index >= 0) {
    pages[index] = page;
    return "modified";
  }
  pages.push(page);
  return "added";
}

const upsertTroopBattlePage: ToolDefinition = {
  name: "upsert_troop_battle_page",
  description:
    "트룹의 전투 이벤트 페이지(보스 페이즈/전투 스크립트)를 페이지 단위로 등록·수정한다. " +
    "조건·커맨드·무한반복을 검증하며, 저작 후 simulate_battle 의 phaseCoverage 로 실제 발동을 확인해야 한다. " +
    "여러 페이즈를 한 번에 깔려면 author_boss_phases 를 먼저 보라. " +
    "적 이동: {kind:\"m2Command\", commandId:\"m2-218-move-enemy\", fields:{target:\"enemy-1\"(또는 적 id), x, y, durationMs}} — 좌표는 트룹 members 와 같고 위치 범위기가 새 위치를 본다.",
  mode: "write",
  domains: ["battle", "database"],
  parameters: {
    type: "object",
    properties: { troopId: { type: "string" }, page: PAGE_SCHEMA },
    required: ["troopId", "page"],
    additionalProperties: false,
  },
  invalidArgsExample: {
    troopId: "troop_boss",
    page: {
      id: "boss_phase2",
      name: "2페이즈 광폭화",
      span: "battle",
      conditions: [{ kind: "enemyHpBelow", enemyId: "enemy_boss", percent: 50 }],
      commands: [{ kind: "text", body: "크아악…! 이제 진심이다!" }],
    },
  },
  run(draft, args): ToolExecResult {
    const troop = requireTroop(draft, args.troopId);
    const warnings: string[] = [];
    const page = normalizePage(draft, troop, args.page, warnings);
    const outcome = upsertPage(troop, page);
    const unsupported = countLimitedRuntimeSupportCommands(page.commands, "troop");
    if (unsupported > 0) {
      warnings.push(
        `전투 컨텍스트에서 런타임 지원이 제한된 커맨드 ${unsupported}건 — 전투 중에는 조용히 생략됩니다(맵 이벤트로 옮기세요).`,
      );
    }
    return {
      summary: `트룹 '${troop.name}' 전투 이벤트 페이지 '${page.name}' ${outcome === "added" ? "추가" : "수정"}(조건 ${page.conditions.length}개, 커맨드 ${page.commands.length}개)`,
      data: {
        troopId: troop.id,
        pageId: page.id,
        outcome,
        pageCount: troop.battleEventPages.length,
        unsupportedCommands: unsupported,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const deleteTroopBattlePage: ToolDefinition = {
  name: "delete_troop_battle_page",
  description: "트룹의 전투 이벤트 페이지 하나를 삭제한다.",
  mode: "write",
  domains: ["battle", "database"],
  parameters: {
    type: "object",
    properties: { troopId: { type: "string" }, pageId: { type: "string" } },
    required: ["troopId", "pageId"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const troop = requireTroop(draft, args.troopId);
    const pageId = args.pageId as string;
    const pages = troop.battleEventPages ?? [];
    const index = pages.findIndex((entry) => entry.id === pageId);
    if (index < 0) {
      throw new ToolError(
        `전투 이벤트 페이지를 찾을 수 없습니다: ${pageId} — 이 트룹의 페이지: ${pages.map((entry) => entry.id).join(", ") || "없음"}`,
        { code: "battle-page-not-found" },
      );
    }
    const [removed] = pages.splice(index, 1);
    return {
      summary: `트룹 '${troop.name}' 전투 이벤트 페이지 '${removed.name}'(${removed.id}) 삭제`,
      data: { troopId: troop.id, pageId: removed.id, pageCount: pages.length },
    };
  },
};

// ── author_boss_phases ──────────────────────────────────────────────────────
// 페이즈 하나 = HP 임계 + 연출(대사/애니메이션) + 판돌리기(상태 부여/회복/추가 등장/스위치).
// 적 스탯을 직접 바꾸는 커맨드는 엔진에 없다 — RM2K3 계열 m2 커맨드(changeEnemyState/HP/encounter)가
// 유일한 경로이므로 façade 가 그 배선을 맡는다(모델이 commandId 를 외우게 하지 않는다).

const PHASE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    atHpPercent: { type: "integer", description: "대상 적 HP가 이 % 이하로 떨어지면 페이즈 진입(1~100)" },
    name: { type: "string" },
    message: { type: "string", description: "페이즈 진입 대사(보스 대사)" },
    enrageStateId: { type: "string", description: "적에게 부여할 상태 id(광폭화·방어강화 등). database.states 참조" },
    healPercent: { type: "integer", description: "적 HP를 최대치의 이 %만큼 회복(부활 연출)" },
    summonEnemyId: { type: "string", description: "등장시킬 숨은 트룹 멤버 적 id(members 의 hidden:true 항목)" },
    animationId: { type: "string", description: "적에게 재생할 전투 애니메이션 id" },
    switchId: { type: "string", description: "페이즈 진입 시 ON 할 스위치 id(없으면 자동 등록)" },
  },
  required: ["atHpPercent"],
};

interface BossPhaseInput {
  readonly atHpPercent: number;
  readonly name?: string;
  readonly message?: string;
  readonly enrageStateId?: string;
  readonly healPercent?: number;
  readonly summonEnemyId?: string;
  readonly animationId?: string;
  readonly switchId?: string;
}

function parsePhases(raw: unknown): BossPhaseInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ToolError("phases 배열(1개 이상)이 필요합니다.", { code: "invalid-args" });
  }
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ToolError(`phases[${index}]는 객체여야 합니다.`, { code: "invalid-args" });
    }
    const record = entry as Record<string, unknown>;
    const atHpPercent = record.atHpPercent;
    if (typeof atHpPercent !== "number" || !Number.isFinite(atHpPercent) || atHpPercent < 1 || atHpPercent > 100) {
      throw new ToolError(`phases[${index}].atHpPercent는 1~100 정수여야 합니다.`, { code: "invalid-args" });
    }
    const optionalString = (key: keyof BossPhaseInput): string | undefined => {
      const value = record[key];
      return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
    };
    const healPercent = record.healPercent;
    if (healPercent !== undefined && (typeof healPercent !== "number" || healPercent <= 0 || healPercent > 100)) {
      throw new ToolError(`phases[${index}].healPercent는 1~100 이어야 합니다.`, { code: "invalid-args" });
    }
    return {
      atHpPercent: Math.trunc(atHpPercent),
      ...(optionalString("name") ? { name: optionalString("name") } : {}),
      ...(optionalString("message") ? { message: optionalString("message") } : {}),
      ...(optionalString("enrageStateId") ? { enrageStateId: optionalString("enrageStateId") } : {}),
      ...(healPercent === undefined ? {} : { healPercent: Math.trunc(healPercent) }),
      ...(optionalString("summonEnemyId") ? { summonEnemyId: optionalString("summonEnemyId") } : {}),
      ...(optionalString("animationId") ? { animationId: optionalString("animationId") } : {}),
      ...(optionalString("switchId") ? { switchId: optionalString("switchId") } : {}),
    };
  });
}

/** 페이즈 임계는 내림차순이어야 한다 — 같은 값 둘이면 한 라운드에 두 페이즈가 겹쳐 터진다. */
function assertDescendingThresholds(phases: readonly BossPhaseInput[]): void {
  for (let index = 1; index < phases.length; index += 1) {
    const previous = phases[index - 1].atHpPercent;
    const current = phases[index].atHpPercent;
    if (current >= previous) {
      throw new ToolError(
        `phases 의 atHpPercent 는 내림차순이어야 합니다(높은 HP 임계가 먼저): phases[${index - 1}]=${previous}% → phases[${index}]=${current}%. ` +
          `같은 값이거나 올라가면 페이즈가 동시에 발동하거나 영원히 안 뜹니다.`,
        { code: "boss-phase-threshold-order" },
      );
    }
  }
}

function bossEnemy(project: Project, troop: TroopRecord, enemyId: unknown): EnemyRecord {
  const ids = troopEnemyIds(troop);
  const resolved = typeof enemyId === "string" && enemyId.trim().length > 0 ? enemyId.trim() : [...ids][0];
  if (!resolved) {
    throw new ToolError(`트룹 '${troop.id}'에 적이 없습니다 — upsert_troop 으로 먼저 편성하세요.`, { code: "troop-empty" });
  }
  if (!ids.has(resolved)) {
    throw new ToolError(
      `enemyId '${resolved}'는 트룹 '${troop.id}'의 적이 아닙니다 — 이 트룹의 적: ${[...ids].join(", ")}`,
      { code: "enemy-not-in-troop" },
    );
  }
  const record = project.database.enemies.find((entry) => entry.id === resolved);
  if (!record) throw new ToolError(`적 레코드를 찾을 수 없습니다: ${resolved}`, { code: "enemy-not-found" });
  return record;
}

function m2(commandId: string, fields: Record<string, string | number | boolean>): Command {
  return { kind: "m2Command", commandId, fields };
}

function phaseCommands(draft: Project, enemy: EnemyRecord, troop: TroopRecord, phase: BossPhaseInput, index: number): Command[] {
  const commands: Command[] = [];
  if (phase.message) commands.push({ kind: "text", speaker: enemy.name, body: phase.message });
  if (phase.animationId) {
    if (!draft.database.battleAnimations.some((animation) => animation.id === phase.animationId)) {
      const known = draft.database.battleAnimations.map((animation) => animation.id).slice(0, 8).join(", ") || "없음";
      throw new ToolError(
        `phases[${index}].animationId를 찾을 수 없습니다: ${phase.animationId} — 보유 전투 애니메이션: ${known}`,
        { code: "animation-not-found" },
      );
    }
    commands.push(m2("m2-103-show-animation", { target: enemy.id, animationId: phase.animationId }));
  }
  if (phase.enrageStateId) {
    if (!draft.database.states.some((state) => state.id === phase.enrageStateId)) {
      const known = draft.database.states.map((state) => state.id).slice(0, 8).join(", ") || "없음";
      throw new ToolError(
        `phases[${index}].enrageStateId를 찾을 수 없습니다: ${phase.enrageStateId} — 보유 상태: ${known}. ` +
          `upsert_state 로 먼저 만들고(runtimeEffects.attackMultiplier 등) 연결하세요.`,
        { code: "state-not-found" },
      );
    }
    commands.push(m2("m2-100-change-enemy-state", { target: enemy.id, operation: "add", value: phase.enrageStateId }));
  }
  if (phase.healPercent !== undefined) {
    // changeEnemyHp 는 절대값 계약이다 — 저작 시점에 maxHp 로 환산해 준다.
    const amount = Math.max(1, Math.round((enemy.stats.maxHp * phase.healPercent) / 100));
    commands.push(m2("m2-098-change-enemy-hp", { target: enemy.id, operation: "add", value: amount }));
  }
  if (phase.summonEnemyId) {
    const hidden = (troop.members ?? []).find((member) => member.enemyId === phase.summonEnemyId && member.hidden === true);
    if (!hidden) {
      throw new ToolError(
        `phases[${index}].summonEnemyId '${phase.summonEnemyId}'는 트룹 '${troop.id}'의 숨은 멤버가 아닙니다. ` +
          `등장 연출은 숨은 멤버를 드러내는 방식이므로 upsert_troop 으로 members 에 {enemyId:"${phase.summonEnemyId}", x, y, hidden:true} 를 먼저 넣으세요.`,
        { code: "summon-not-hidden-member" },
      );
    }
    commands.push(m2("m2-101-enemy-encounter", { target: phase.summonEnemyId }));
  }
  if (phase.switchId) {
    ensureNamedSwitch(draft, phase.switchId, `보스 페이즈 진입: ${troop.name} ${index + 1}페이즈`);
    commands.push({ kind: "setSwitch", switchId: phase.switchId, value: true });
  }
  if (commands.length === 0) {
    throw new ToolError(
      `phases[${index}]에 실제 효과가 없습니다 — message/enrageStateId/healPercent/summonEnemyId/animationId/switchId 중 최소 1개가 필요합니다.`,
      { code: "boss-phase-empty" },
    );
  }
  return commands;
}

const PHASE_PAGE_PREFIX = "phase";

function phasePageId(troopId: string, index: number): string {
  return `${troopId}_${PHASE_PAGE_PREFIX}${index + 1}`;
}

const authorBossPhases: ToolDefinition = {
  name: "author_boss_phases",
  description:
    "보스 페이즈를 선언적으로 깐다. 각 페이즈는 'HP x% 이하' 진입 조건 + 대사·애니메이션·상태부여(광폭화)·HP회복·숨은 적 등장·스위치를 " +
    "전투 이벤트 페이지로 컴파일한다(1회성). 같은 트룹에 다시 호출하면 이전에 이 툴이 만든 페이즈 페이지만 교체하고 수동 페이지는 보존한다. " +
    "저작 후 simulate_battle 로 phaseCoverage(발동 여부)를 확인하라.",
  mode: "write",
  domains: ["battle", "database"],
  parameters: {
    type: "object",
    properties: {
      troopId: { type: "string" },
      enemyId: { type: "string", description: "페이즈 기준이 되는 보스 적 id. 생략 시 트룹의 첫 적" },
      phases: { type: "array", items: PHASE_SCHEMA, description: "atHpPercent 내림차순" },
    },
    required: ["troopId", "phases"],
    additionalProperties: false,
  },
  invalidArgsExample: {
    troopId: "troop_boss",
    enemyId: "enemy_boss",
    phases: [
      { atHpPercent: 70, name: "1차 각성", message: "제법이군…", enrageStateId: "state_rage" },
      { atHpPercent: 30, name: "광폭화", message: "끝이다!", healPercent: 20, summonEnemyId: "enemy_boss_add" },
    ],
  },
  run(draft, args): ToolExecResult {
    const troop = requireTroop(draft, args.troopId);
    const phases = parsePhases(args.phases);
    assertDescendingThresholds(phases);
    const enemy = bossEnemy(draft, troop, args.enemyId);
    const pages = phases.map((phase, index) => {
      const page: BattleEventPageRecord = {
        id: phasePageId(troop.id, index),
        name: phase.name ?? `${index + 1}페이즈 (HP ${phase.atHpPercent}%)`,
        conditions: [{ kind: "enemyHpBelow", enemyId: enemy.id, percent: phase.atHpPercent }],
        span: "battle",
        runOnce: true,
        commands: phaseCommands(draft, enemy, troop, phase, index),
      };
      assertNotRepeatingForever(page, `phases[${index}]`);
      return page;
    });
    // 재호출은 멱등이어야 한다 — 이 툴이 만든 페이지만 지우고 수동 저작 페이지는 남긴다.
    const generatedIds = new Set(pages.map((page) => page.id));
    const previousGenerated = new RegExp(`^${troop.id}_${PHASE_PAGE_PREFIX}\\d+$`);
    troop.battleEventPages = [
      ...(troop.battleEventPages ?? []).filter((page) => !generatedIds.has(page.id) && !previousGenerated.test(page.id)),
      ...pages,
    ];
    const unsupported = pages.reduce((sum, page) => sum + countLimitedRuntimeSupportCommands(page.commands, "troop"), 0);
    const warnings: string[] = [
      `페이즈가 실제로 발동하는지는 저작만으로 알 수 없습니다 — simulate_battle { troopId:"${troop.id}", heroLevel:<기준 레벨> } 로 ` +
        `phaseCoverage 의 firedRuns 가 전 페이지 1 이상인지 확인하세요.`,
    ];
    if (unsupported > 0) warnings.push(`전투에서 지원이 제한된 커맨드 ${unsupported}건이 포함됐습니다.`);
    return {
      summary: `보스 '${enemy.name}' 페이즈 ${pages.length}개 저작(${phases.map((phase) => `${phase.atHpPercent}%`).join(" → ")})`,
      data: {
        troopId: troop.id,
        enemyId: enemy.id,
        pages: pages.map((page) => ({ id: page.id, name: page.name, commands: page.commands.length })),
        pageCount: troop.battleEventPages.length,
        unsupportedCommands: unsupported,
      },
      warnings,
    };
  },
};

export const TROOP_BATTLE_PAGE_TOOLS: readonly ToolDefinition[] = [
  authorBossPhases,
  upsertTroopBattlePage,
  deleteTroopBattlePage,
];
