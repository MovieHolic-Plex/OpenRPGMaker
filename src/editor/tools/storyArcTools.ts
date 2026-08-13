import { storyFlagById } from "@/project/storyFlags";
import type { Command, Project, StoryFlagDef } from "@/project/types";
import type { QuestGraphDef } from "@/project/quest/questDef";
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Objective = { readonly id: string; readonly text: string };
type Branch = { readonly id: string; readonly label: string; readonly lines: readonly string[] };
type Twist = { readonly enabled: boolean; readonly flagId: string; readonly description: string; readonly discoverInBranchId: string; readonly reveal: readonly string[] };

const authorStoryArc: ToolDefinition = {
  name: "author_story_arc",
  description: "결정론적 튜토리얼 목표·선택 분기·선택적 반전 템플릿을 기존 이벤트/퀘스트/스토리 플래그로 컴파일한다. 좋은 서사를 자동 판단하거나 발명하지 않는다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string" }, title: { type: "string" }, mapId: { type: "string" }, eventId: { type: "string" },
      at: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] },
      opening: { type: "array", items: { type: "string" } },
      tutorialObjectives: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" } }, required: ["id", "text"] } },
      branchChoices: { type: "array", items: { type: "object", properties: { id: { type: "string" }, label: { type: "string" }, lines: { type: "array", items: { type: "string" } } }, required: ["id", "label", "lines"] } },
      twist: { type: "object", properties: { enabled: { type: "boolean" }, flagId: { type: "string" }, description: { type: "string" }, discoverInBranchId: { type: "string" }, reveal: { type: "array", items: { type: "string" } } }, required: ["enabled", "flagId", "description", "discoverInBranchId", "reveal"] },
    },
    required: ["id", "title", "mapId", "eventId", "at", "opening", "tutorialObjectives", "branchChoices", "twist"],
  },
  run(project, args): ToolExecResult {
    const id = cleanId(args.id, "id");
    const title = requiredText(args.title, "title");
    const mapId = requiredText(args.mapId, "mapId");
    const eventId = requiredText(args.eventId, "eventId");
    const at = args.at as { readonly x: number; readonly y: number };
    const opening = cleanLines(args.opening);
    const objectives = args.tutorialObjectives as readonly Objective[];
    const branches = args.branchChoices as readonly Branch[];
    const twist = args.twist as Twist;
    if (objectives.length === 0 || objectives.length > 12 || objectives.some((objective) => !cleanText(objective.text))) throw new ToolError("튜토리얼 목표는 실행 가능한 설명을 가진 1~12개여야 합니다.", { code: "story-arc-dead-objective" });
    if (branches.length < 2 || branches.length > 6 || branches.some((branch) => !cleanText(branch.label) || cleanLines(branch.lines).length === 0)) throw new ToolError("선택 분기는 실행 가능한 본문을 가진 2~6개여야 합니다.", { code: "story-arc-dead-branch" });
    const map = project.maps[mapId];
    if (!map) throw new ToolError(`맵이 없습니다: ${mapId}`, { code: "map-not-found", mapId });
    if (at.x < 0 || at.y < 0 || at.x >= map.width || at.y >= map.height) throw new ToolError("이벤트 좌표가 맵 밖입니다.", { code: "story-arc-position", mapId, x: at.x, y: at.y });
    if (map.events.some((event) => event.id === eventId)) throw new ToolError(`이벤트 ID가 이미 있습니다: ${eventId}`, { code: "event-id-duplicate", mapId });
    const objectiveFlagIds = objectives.map((objective) => `${id}-${cleanId(objective.id, "objective.id")}`);
    const objectiveSwitchIds = objectiveFlagIds.map((flagId) => `sw_story_${flagId.replaceAll("-", "_")}`);
    const choiceFlagId = `${id}-branch-choice`;
    const choiceVariableId = `var_story_${id.replaceAll("-", "_")}_branch`;
    for (const [index, objective] of objectives.entries()) {
      const targetId = objectiveSwitchIds[index] as string;
      ensureNamedSwitch(project, targetId, `Story objective: ${objective.text}`);
      upsertFlag(project, { id: objectiveFlagIds[index] as string, kind: "switch", targetId, description: objective.text.trim(), questId: id });
    }
    ensureNamedVariable(project, choiceVariableId, `Story branch: ${title}`);
    upsertFlag(project, { id: choiceFlagId, kind: "variable", targetId: choiceVariableId, description: `Selected branch for ${title}`, questId: id });
    let twistSwitchId: string | undefined;
    if (twist.enabled) {
      if (!branches.some((branch) => branch.id === twist.discoverInBranchId) || cleanLines(twist.reveal).length === 0) throw new ToolError("반전은 존재하는 분기와 실행 가능한 reveal이 필요합니다.", { code: "story-arc-dead-branch" });
      twistSwitchId = `sw_story_${cleanId(twist.flagId, "twist.flagId").replaceAll("-", "_")}`;
      ensureNamedSwitch(project, twistSwitchId, `Story twist: ${twist.description}`);
      upsertFlag(project, { id: cleanId(twist.flagId, "twist.flagId"), kind: "switch", targetId: twistSwitchId, description: requiredText(twist.description, "twist.description"), questId: id });
    }
    const commands: Command[] = [
      ...opening.map(textCommand),
      ...objectives.flatMap((objective, index) => [textCommand(objective.text), { kind: "setSwitch" as const, switchId: objectiveSwitchIds[index] as string, value: true }]),
      { kind: "choices", prompt: title, options: branches.map((branch, index) => ({ text: branch.label.trim(), branch: [...cleanLines(branch.lines).map(textCommand), { kind: "setVariable", variableId: choiceVariableId, op: "set", value: index + 1 }, ...(twist.enabled && branch.id === twist.discoverInBranchId && twistSwitchId ? [{ kind: "setSwitch" as const, switchId: twistSwitchId, value: true }] : [])] })) },
      ...(twist.enabled && twistSwitchId ? [{ kind: "fork" as const, condition: { kind: "switch" as const, switchId: twistSwitchId, value: true }, then: cleanLines(twist.reveal).map(textCommand) }] : []),
    ];
    map.events.push({ id: eventId, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [], pages: [{ id: `${eventId}_page_1`, name: title, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands }] });
    const quest: QuestGraphDef = { kind: "graph", id, title, nodes: objectives.map((objective, index) => ({ id: cleanId(objective.id, "objective.id"), description: objective.text.trim(), completesWhen: { kind: "storyFlag", flagId: objectiveFlagIds[index] as string, value: true } })), edges: objectives.slice(1).map((objective, index) => ({ from: cleanId(objectives[index]?.id, "objective.id"), to: cleanId(objective.id, "objective.id") })) };
    project.quests = [...(project.quests ?? []).filter((candidate) => !("id" in candidate) || candidate.id !== id), quest];
    return { summary: `서사 아크 작성: ${title} (목표 ${objectives.length}, 분기 ${branches.length}${twist.enabled ? ", 반전 포함" : ""})`, data: { eventId, questId: id, objectiveFlagIds, choiceFlagId, choiceVariableId, twistFlagId: twist.enabled ? twist.flagId : undefined, twistSwitchId } };
  },
};

function cleanText(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function requiredText(value: unknown, field: string): string { const text = cleanText(value); if (!text) throw new ToolError(`${field}가 필요합니다.`, { code: "story-arc-field" }); return text; }
function cleanId(value: unknown, field: string): string { const id = requiredText(value, field).toLowerCase(); if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id)) throw new ToolError(`${field}는 소문자 kebab-case여야 합니다.`, { code: "story-arc-id" }); return id; }
function cleanLines(value: unknown): string[] { return Array.isArray(value) ? value.map(cleanText).filter(Boolean) : []; }
function textCommand(body: string): Command { return { kind: "text", body: body.trim() }; }
function upsertFlag(project: Project, flag: StoryFlagDef): void { const existing = storyFlagById(project, flag.id, { includeRetired: true }); if (existing) Object.assign(existing, flag); else project.storyFlags = [...(project.storyFlags ?? []), flag]; }

export const STORY_ARC_TOOLS: readonly ToolDefinition[] = [authorStoryArc];
