import { startSession } from "@/project/session";
import {
  cleanStoryFlagId,
  isStoryFlagKind,
  normalizeStoryFlagTags,
  normalizeStoryFlagTargetId,
  recordsForStoryFlagKind,
  STORY_FLAG_ID_PATTERN,
  storyFlagById,
  storyFlagForTarget,
  storyFlagListLabel,
  storyFlagTargetKey,
  targetShortLabel,
} from "@/project/storyFlags";
import { explainEvent } from "@/project/storyEventExplain";
import { buildStoryFlagUsageIndex, usageBucketFor } from "@/project/storyFlagUsage";
import type { Project, StoryFlagDef, StoryFlagKind, SwitchDef, VariableDef } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type DeclareStoryFlagAction = "declare" | "rename" | "retire";

const STORY_FLAG_ACTIONS = ["declare", "rename", "retire"] as const;
const STORY_FLAG_KINDS = ["switch", "variable"] as const;

const declareStoryFlag: ToolDefinition = {
  name: "declare_story_flag",
  description: "스위치/변수 번호에 서사 의미를 등록한다. action=declare/rename/retire 지원. targetId 생략 시 미사용 슬롯을 자동 할당한다.",
  mode: "write",
  domains: ["event", "quest", "system"],
  invalidArgsExample: { id: "met-mayor", kind: "switch", description: "시장과 처음 만남" },
  invalidArgsHint: "새 플래그는 id/kind/description이 필요하고, rename은 id+newId, retire는 id가 필요합니다.",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: STORY_FLAG_ACTIONS as unknown as string[] },
      id: { type: "string", description: "kebab-case story flag id" },
      newId: { type: "string", description: "action=rename 때 새 id" },
      kind: { type: "string", enum: STORY_FLAG_KINDS as unknown as string[] },
      description: { type: "string" },
      questId: { type: "string" },
      targetId: { type: "string", description: "스위치/변수 id 또는 번호 문자열(예: sw_0003, S3, 3)" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["id"],
  },
  run(project, args): ToolExecResult {
    const action = parseAction(args.action);
    if (action === "rename") return renameStoryFlag(project, args);
    if (action === "retire") return retireStoryFlag(project, args);
    return createStoryFlag(project, args);
  },
};

const getStoryState: ToolDefinition = {
  name: "get_story_state",
  description: "서사 플래그 레지스트리를 한 줄 요약으로 반환한다(설명, 현재 값, read/write 수). 이벤트 JSON 원문 조회를 줄이는 용도.",
  mode: "read",
  domains: ["event", "quest", "system"],
  parameters: { type: "object", properties: {} },
  run(project): ToolExecResult {
    const index = buildStoryFlagUsageIndex(project);
    const { session, source, note } = runtimeSession(project);
    const flags = (project.storyFlags ?? []).map((flag) => {
      const usage = usageBucketFor(index, flag.kind, flag.targetId);
      const target = targetShortLabel(project, flag.kind, flag.targetId);
      const value = flag.kind === "switch"
        ? session.switches[flag.targetId] === true
        : session.variables[flag.targetId] ?? 0;
      const valueText = flag.kind === "switch" ? (value ? "on" : "off") : String(value);
      const retired = flag.retired === true ? " retired" : "";
      return {
        id: flag.id,
        kind: flag.kind,
        targetId: flag.targetId,
        questId: flag.questId,
        retired: flag.retired === true,
        description: flag.description,
        value,
        reads: usage.reads.length,
        writes: usage.writes.length,
        line: `${flag.id} ${target}=${valueText} r${usage.reads.length}/w${usage.writes.length}${retired} - ${flag.description}`,
      };
    });
    return {
      summary: `story state ${flags.length} flags (${source})`,
      data: { sessionSource: source, note, flags },
    };
  },
};

const findFlagUsage: ToolDefinition = {
  name: "find_flag_usage",
  description: "서사 플래그 또는 스위치/변수 target의 read/write 사용처를 전 맵/공통 이벤트/트룹 이벤트에서 찾는다.",
  mode: "read",
  domains: ["event", "quest", "system"],
  invalidArgsExample: { flagId: "met-mayor" },
  parameters: {
    type: "object",
    properties: {
      flagId: { type: "string" },
      switchId: { type: "string" },
      variableId: { type: "string" },
    },
  },
  run(project, args): ToolExecResult {
    const target = usageTargetFromArgs(project, args);
    const index = buildStoryFlagUsageIndex(project);
    const usage = usageBucketFor(index, target.kind, target.targetId);
    const sites = [...usage.reads, ...usage.writes].map((site) => ({
      access: site.access,
      label: site.label,
      detail: site.detail,
      source: site.source,
      mapId: site.mapId,
      eventId: site.eventId,
      pageNumber: site.pageNumber,
      commonEventId: site.commonEventId,
      troopId: site.troopId,
      commandPath: site.commandPath,
      conditionPath: site.conditionPath,
    }));
    return {
      summary: `${target.label} 사용처 read ${usage.reads.length} / write ${usage.writes.length}`,
      data: {
        target,
        counts: { reads: usage.reads.length, writes: usage.writes.length },
        sites,
      },
    };
  },
};

const explainEventTool: ToolDefinition = {
  name: "explain_event",
  description: "맵 이벤트 페이지 조건을 현재 세션값(없으면 에디터 기본값)으로 평가해 비활성 원인과 최종 활성 페이지를 설명한다.",
  mode: "read",
  domains: ["event", "quest", "system"],
  invalidArgsExample: { mapId: "map_blank_start", eventId: "ev_mayor" },
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      eventId: { type: "string" },
    },
    required: ["mapId", "eventId"],
  },
  run(project, args): ToolExecResult {
    const { session, source } = runtimeSession(project);
    try {
      const data = explainEvent(project, args.mapId as string, args.eventId as string, session, source);
      return { summary: data.summary, data };
    } catch (cause) {
      throw new ToolError(cause instanceof Error ? cause.message : String(cause), { code: "event-explain-failed" });
    }
  },
};

export const STORY_TOOLS: readonly ToolDefinition[] = [
  declareStoryFlag,
  getStoryState,
  findFlagUsage,
  explainEventTool,
];

function parseAction(value: unknown): DeclareStoryFlagAction {
  if (value === undefined) return "declare";
  if (value === "declare" || value === "rename" || value === "retire") return value;
  throw new ToolError("action은 declare/rename/retire 중 하나여야 합니다.", { code: "story-flag-action" });
}

function createStoryFlag(project: Project, args: Record<string, unknown>): ToolExecResult {
  const id = requiredStoryFlagId(args.id);
  if (storyFlagById(project, id, { includeRetired: true })) {
    throw new ToolError(`story flag id가 이미 존재합니다: ${id}`, { code: "story-flag-duplicate-id" });
  }
  const kind = parseKind(args.kind);
  const description = requiredNonEmptyString(args.description, "description");
  const targetId = resolveTargetForDeclare(project, kind, args.targetId);
  if (storyFlagForTarget(project, kind, targetId, { includeRetired: true })) {
    throw new ToolError(`story flag target이 이미 등록되어 있습니다: ${storyFlagTargetKey(kind, targetId)}`, {
      code: "story-flag-duplicate-target",
    });
  }
  ensureTargetSlot(project, kind, targetId, description);
  const flag: StoryFlagDef = {
    id,
    kind,
    targetId,
    description,
    ...(cleanOptionalString(args.questId) ? { questId: cleanOptionalString(args.questId) } : {}),
    ...(normalizeStoryFlagTags(args.tags) ? { tags: normalizeStoryFlagTags(args.tags) } : {}),
  };
  project.storyFlags ??= [];
  project.storyFlags.push(flag);
  return {
    summary: `서사 플래그 등록: ${storyFlagListLabel(project, flag)} — ${description}`,
    data: { flag },
  };
}

function renameStoryFlag(project: Project, args: Record<string, unknown>): ToolExecResult {
  const id = requiredStoryFlagId(args.id);
  const newId = requiredStoryFlagId(args.newId);
  if (storyFlagById(project, newId, { includeRetired: true })) {
    throw new ToolError(`story flag id가 이미 존재합니다: ${newId}`, { code: "story-flag-duplicate-id" });
  }
  const flag = storyFlagById(project, id, { includeRetired: true });
  if (!flag) throw new ToolError(`story flag를 찾을 수 없습니다: ${id}`, { code: "story-flag-not-found" });
  flag.id = newId;
  return { summary: `서사 플래그 이름 변경: ${id} -> ${newId}`, data: { flag } };
}

function retireStoryFlag(project: Project, args: Record<string, unknown>): ToolExecResult {
  const id = requiredStoryFlagId(args.id);
  const flag = storyFlagById(project, id, { includeRetired: true });
  if (!flag) throw new ToolError(`story flag를 찾을 수 없습니다: ${id}`, { code: "story-flag-not-found" });
  flag.retired = true;
  const index = buildStoryFlagUsageIndex(project);
  const usage = usageBucketFor(index, flag.kind, flag.targetId);
  const totalUsage = usage.reads.length + usage.writes.length;
  const warnings = totalUsage > 0
    ? [`retire된 서사 플래그 '${id}' target에 사용처 ${totalUsage}건이 남아 있습니다.`]
    : undefined;
  return {
    summary: `서사 플래그 retire: ${storyFlagListLabel(project, flag)}`,
    warnings,
    data: { flag, usageCount: totalUsage },
  };
}

function resolveTargetForDeclare(project: Project, kind: StoryFlagKind, rawTargetId: unknown): string {
  if (typeof rawTargetId === "string" && rawTargetId.trim().length > 0) {
    const targetId = normalizeStoryFlagTargetId(project, kind, rawTargetId);
    if (!targetId) throw new ToolError(`targetId를 찾을 수 없습니다: ${rawTargetId}`, { code: "story-flag-target-not-found" });
    return targetId;
  }
  return allocateUnusedTarget(project, kind);
}

function allocateUnusedTarget(project: Project, kind: StoryFlagKind): string {
  const index = buildStoryFlagUsageIndex(project);
  const registeredTargets = new Set((project.storyFlags ?? []).map((flag) => storyFlagTargetKey(flag.kind, flag.targetId)));
  const records = recordsForStoryFlagKind(project, kind);
  for (const record of records) {
    if (record.name.trim().length > 0) continue;
    if (registeredTargets.has(storyFlagTargetKey(kind, record.id))) continue;
    const usage = usageBucketFor(index, kind, record.id);
    if (usage.reads.length === 0 && usage.writes.length === 0) return record.id;
  }
  const next = nextRecordId(records, kind === "switch" ? "sw" : "var");
  if (kind === "switch") {
    project.switches.push({ id: next, name: "" });
    project.session.switches[next] = false;
  } else {
    project.variables.push({ id: next, name: "" });
    project.session.variables[next] = 0;
  }
  return next;
}

function ensureTargetSlot(project: Project, kind: StoryFlagKind, targetId: string, description: string): void {
  if (kind === "switch") {
    const record = mutableRecord(project.switches, targetId);
    if (!record) throw new ToolError(`스위치를 찾을 수 없습니다: ${targetId}`, { code: "story-flag-target-not-found" });
    if (!record.name.trim()) record.name = description;
    project.session.switches[targetId] ??= false;
    return;
  }
  const record = mutableRecord(project.variables, targetId);
  if (!record) throw new ToolError(`변수를 찾을 수 없습니다: ${targetId}`, { code: "story-flag-target-not-found" });
  if (!record.name.trim()) record.name = description;
  project.session.variables[targetId] ??= 0;
}

function mutableRecord<TRecord extends SwitchDef | VariableDef>(records: TRecord[], id: string): TRecord | undefined {
  return records.find((record) => record.id === id);
}

function usageTargetFromArgs(project: Project, args: Record<string, unknown>): { kind: StoryFlagKind; targetId: string; flagId?: string; label: string } {
  if (typeof args.flagId === "string" && args.flagId.trim()) {
    const flag = storyFlagById(project, args.flagId, { includeRetired: true });
    if (!flag) throw new ToolError(`story flag를 찾을 수 없습니다: ${args.flagId}`, { code: "story-flag-not-found" });
    return { kind: flag.kind, targetId: flag.targetId, flagId: flag.id, label: storyFlagListLabel(project, flag) };
  }
  if (typeof args.switchId === "string" && args.switchId.trim()) {
    return { kind: "switch", targetId: args.switchId.trim(), label: targetShortLabel(project, "switch", args.switchId.trim()) };
  }
  if (typeof args.variableId === "string" && args.variableId.trim()) {
    return { kind: "variable", targetId: args.variableId.trim(), label: targetShortLabel(project, "variable", args.variableId.trim()) };
  }
  throw new ToolError("flagId, switchId, variableId 중 하나가 필요합니다.", { code: "story-flag-usage-target" });
}

function runtimeSession(project: Project): { session: PlaySessionLike; source: "live-play-session" | "editor-default"; note?: string } {
  const base = startSession(project);
  const live = liveDebugState();
  if (!live) {
    return {
      session: base,
      source: "editor-default",
      note: "플레이 세션 없음: 스위치 OFF/변수 0 기본값으로 평가",
    };
  }
  return {
    session: {
      ...base,
      ...live,
      switches: live.switches ? { ...base.switches, ...live.switches } : base.switches,
      variables: live.variables ? { ...base.variables, ...live.variables } : base.variables,
      selfSwitches: live.selfSwitches ? { ...base.selfSwitches, ...live.selfSwitches } : base.selfSwitches,
      timers: live.timers ? { ...base.timers, ...live.timers } : base.timers,
      inventory: live.inventory ? { ...base.inventory, ...live.inventory } : base.inventory,
      npcActivities: live.npcActivities ? { ...base.npcActivities, ...live.npcActivities } : base.npcActivities,
      friendship: live.friendship ? { ...base.friendship, ...live.friendship } : base.friendship,
    },
    source: "live-play-session",
  };
}

function liveDebugState(): Partial<PlaySessionLike> | undefined {
  if (typeof window === "undefined") return undefined;
  const debug = (window as Window & {
    __rpgzzuDebug?: { readState?: () => Partial<PlaySessionLike> };
  }).__rpgzzuDebug;
  if (!debug?.readState) return undefined;
  try {
    const state = debug.readState();
    return state && typeof state === "object" ? state : undefined;
  } catch {
    return undefined;
  }
}

function parseKind(value: unknown): StoryFlagKind {
  if (!isStoryFlagKind(value)) throw new ToolError("kind는 switch 또는 variable이어야 합니다.", { code: "story-flag-kind" });
  return value;
}

function requiredStoryFlagId(value: unknown): string {
  if (typeof value !== "string") throw new ToolError("id 문자열이 필요합니다.", { code: "story-flag-id" });
  const id = cleanStoryFlagId(value);
  if (!STORY_FLAG_ID_PATTERN.test(id)) {
    throw new ToolError(`id는 kebab-case 슬러그여야 합니다: ${value}`, { code: "story-flag-id" });
  }
  return id;
}

function requiredNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolError(`${label} 문자열이 필요합니다.`, { code: "story-flag-required" });
  }
  return value.trim();
}

function cleanOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function nextRecordId(records: readonly { readonly id: string }[], prefix: "sw" | "var"): string {
  const ids = new Set(records.map((record) => record.id));
  let slot = records.length + 1;
  while (ids.has(`${prefix}_${String(slot).padStart(4, "0")}`)) slot += 1;
  return `${prefix}_${String(slot).padStart(4, "0")}`;
}
