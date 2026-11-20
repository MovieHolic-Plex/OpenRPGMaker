import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { newCommand } from "@/editor/eventCommandFactory";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { timerIdLabel } from "@/editor/panels/eventEditor/options";
import type { JsonSchema } from "@/editor/tools/types";
import { commandGuarantee } from "@/project/commandGuaranteeRegistry";
import {
  eventCommandHash, EventCommandEditError, insertEventCommand, updateEventCommand,
} from "@/project/eventCommands/singleCommandOps";
import { eventDisplayName } from "@/project/eventDisplayName";
import { DEFAULT_ENEMY_FACTION_ID, PLAYER_FACTION_ID } from "@/project/factions";
import { validateCommands, type ReferenceContext } from "@/project/io/commandReferenceValidation";
import { RELATIONSHIP_STATES, relationshipStateName } from "@/project/relationshipState";
import { resolveSocialKey } from "@/project/socialKey";
import type { Command, GameEvent, Project } from "@/project/types";
import { displayText } from "../../target";
import { commandListAt, koreanSentence, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "08-cmd-time-social";

type Fields = Record<string, JsonSchema>;
type Kind =
  | "timer" | "advanceTime" | "advanceCropGrowth" | "setTime" | "sleepUntilMorning"
  | "planSchedule" | "runSchedule" | "changeFriendship" | "setRelationship" | "changeFactionStance" | "getFriendship";
type TimeSocialCommand = Extract<Command, { kind: Kind }>;
type Operation = "insert" | "update";

const count = (description: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): JsonSchema =>
  ({ type: "integer", minimum, maximum, description });
const text = (description: string): JsonSchema => ({ type: "string", minLength: 1, description });
const choice = (description: string, values: readonly string[]): JsonSchema =>
  ({ type: "string", enum: values, description });
const npcKey: JsonSchema = {
  type: "string",
  description: "인물의 호감도 기록에 쓰는 이름표. 이 이벤트의 인물을 쓰려면 빈 문자열.",
};
const scheduleId = text("자료집에서 확인한 일정표의 식별자.");
const slotVariableId: JsonSchema = {
  type: ["string", "null"],
  description: "현재 순번을 저장할 변수의 식별자. 저장하지 않으려면 빈 값.",
};

const commands: Record<Kind, { title: string; fields: Fields; required?: readonly string[] }> = {
  timer: {
    title: "타이머",
    fields: {
      action: choice("시간 설정, 시작, 정지 가운데 하나.", ["set", "start", "stop"]),
      seconds: { ...count("두려는 시간(초). 설정해 둔 시간으로 시작하려면 빈 값."), type: ["integer", "null"] },
      timerId: choice("첫째 또는 둘째 타이머.", ["timer1", "timer2"]),
    },
  },
  advanceTime: {
    title: "시간 진행",
    fields: { days: count("지나갈 날 수."), hours: count("더 흐를 시간 수."), minutes: count("더 흐를 분 수.") },
  },
  advanceCropGrowth: {
    title: "작물 성장 진행",
    fields: { days: count("작물이 자랄 날 수.") },
  },
  setTime: {
    title: "시각 설정",
    fields: { hour: count("설정할 시. 자정을 넘는 시각은 하루 종료 시각 기준.", 0, 48), minute: count("설정할 분.", 0, 59) },
  },
  sleepUntilMorning: { title: "다음 날 아침까지 취침", fields: {} },
  planSchedule: {
    title: "일정표 짜기",
    fields: {
      scheduleId,
      slotCount: { ...count("앞에서부터 채울 칸 수. 모든 칸을 쓰려면 빈 값.", 1), type: ["integer", "null"] },
    },
    required: ["scheduleId"],
  },
  runSchedule: { title: "일정표 실행", fields: { scheduleId, slotVariableId }, required: ["scheduleId"] },
  changeFriendship: {
    title: "호감도 변경",
    fields: { npcKey, delta: { type: "number", description: "호감도 변화량. 떨어뜨리려면 음수." } },
  },
  setRelationship: {
    title: "관계 설정",
    fields: { npcKey, state: choice("관계 없음, 연인, 약혼, 부부 가운데 하나.", RELATIONSHIP_STATES) },
  },
  changeFactionStance: {
    title: "진영 태도 변경",
    fields: {
      a: text("첫 번째 진영의 식별자."), b: text("두 번째 진영의 식별자."),
      op: choice("값 지정, 올리기, 내리기 가운데 하나.", ["=", "+=", "-="]),
      value: { type: "number", description: "지정할 태도 점수 또는 바꿀 점수." },
    },
  },
  getFriendship: {
    title: "호감도 읽기",
    fields: {
      npcKey: { ...npcKey, description: "인물의 이름표. 이 이벤트의 인물은 빈 문자열, 가장 높은 호감도는 별표." },
      variableId: text("호감도를 담을 변수의 식별자."),
    },
    required: ["variableId"],
  },
};

function eventPageScope(ctx: PrimitiveContext): Extract<SmallTaskScope, { kind: "eventPage" }> {
  const { map, event, page } = scopedPage(ctx);
  return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id };
}

const noIds = new Set<string>();
const unusedReferences = {
  actorIds: noIds, classIds: noIds, enemyIds: noIds, itemIds: noIds, equipmentIds: noIds, skillIds: noIds,
  animationIds: noIds, switchIds: noIds, commonEventIds: noIds, endingIds: noIds, mapIds: noIds,
  troopIds: noIds, speciesIds: noIds, resourceIds: noIds,
} satisfies Omit<ReferenceContext, "variableIds">;

function checkReferences(project: Project, event: GameEvent, command: TimeSocialCommand): void {
  // Explicit names are the runtime's author-defined social keys. Self requires a character identity.
  if (command.kind === "changeFriendship" || command.kind === "getFriendship" || command.kind === "setRelationship") {
    if (!resolveSocialKey(event, command.npcKey)) {
      throw new PrimitiveError("이 이벤트에 연결된 인물이 없어요. 호감도를 기록할 인물을 지정해 주세요.");
    }
  }
  let reason: string;
  switch (command.kind) {
    case "planSchedule":
      reason = "자료집에서 일정표를 찾을 수 없어요.";
      break;
    case "runSchedule":
      reason = "일정표나 순번을 저장할 변수를 찾을 수 없어요.";
      break;
    case "changeFactionStance":
      reason = "설정된 진영을 찾을 수 없어요.";
      break;
    case "getFriendship":
      reason = "호감도를 저장할 변수를 찾을 수 없어요.";
      break;
    default:
      return;
  }
  try {
    validateCommands([command], {
      ...unusedReferences,
      variableIds: new Set(project.variables.map(row => row.id)),
      scheduleIds: new Set(project.database.schedules?.map(row => row.id)),
      factionIds: new Set([PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID, ...(project.factions?.defs ?? []).map(row => row.id)]),
    });
  } catch {
    throw new PrimitiveError(reason);
  }
}

function displayName(name: string | undefined, id: string, fallback: string): string {
  if (!name || name.trim() === id || /[{}]/u.test(name)) return fallback;
  const shown = displayText(name, fallback);
  return shown.length > 18 ? shown.slice(0, 17) + "…" : shown;
}

function socialName(project: Project, event: GameEvent, key?: string): string {
  const explicit = key?.trim();
  if (!explicit) return displayName(eventDisplayName(event), event.id, "이 인물");
  const profileName = project.characters?.[explicit]?.displayName;
  if (profileName) return displayName(profileName, explicit, "지정한 인물");
  for (const map of Object.values(project.maps)) {
    const host = map.events.find(candidate => resolveSocialKey(candidate) === explicit);
    if (host) return displayName(eventDisplayName(host), host.id, "지정한 인물");
  }
  return "지정한 인물";
}

function summary(project: Project, event: GameEvent, command: TimeSocialCommand): string {
  switch (command.kind) {
    case "timer": {
      const seconds = command.action === "stop" ? undefined : command.action === "set" ? command.seconds ?? 0 : command.seconds;
      const line = commandSummary({ ...command, seconds }).replace(/^타이머/u, timerIdLabel(command.timerId ?? "timer1"));
      return command.action === "start" && seconds === undefined ? `${line} · 설정된 시간` : line;
    }
    case "planSchedule":
    case "runSchedule": {
      const id = command.scheduleId;
      const name = displayName(project.database.schedules?.find(row => row.id === id)?.title, id, "선택한 일정표");
      const line = commandSummary({ ...command, scheduleId: name });
      if (command.kind === "planSchedule") {
        return `${line} · ${command.slotCount === undefined ? "모든 칸" : `앞 ${command.slotCount}칸`}`;
      }
      return command.slotVariableId === undefined
        ? line
        : `${line} · 순번을 ‘${variableName(project, command.slotVariableId)}’에 저장하는`;
    }
    case "changeFriendship":
      return commandSummary({ ...command, npcKey: socialName(project, event, command.npcKey) });
    case "setRelationship":
      return `${socialName(project, event, command.npcKey)} · 관계 설정 ‘${relationshipStateName(command.state)}’`;
    case "changeFactionStance": {
      const factionName = (id: string) => displayName(
        project.factions?.defs.find(row => row.id === id)?.name, id,
        id === PLAYER_FACTION_ID ? "플레이어 진영" : id === DEFAULT_ENEMY_FACTION_ID ? "기본 적 진영" : "선택한 진영",
      );
      return commandSummary({ ...command, a: factionName(command.a), b: factionName(command.b) });
    }
    case "getFriendship": {
      const name = variableName(project, command.variableId);
      const owner = socialName(project, event, command.npcKey);
      return command.npcKey?.trim() === "*"
        ? `가장 높은 호감도를 ‘${name}’에 저장하는`
        : `‘${owner}’의 호감도를 ‘${name}’에 저장하는`;
    }
    default:
      return commandSummary(command);
  }
}

function variableName(project: Project, id: string): string {
  return displayName(project.variables.find(row => row.id === id)?.name, id, "선택한 변수");
}

function prepareEdit(ctx: PrimitiveContext, args: Record<string, unknown>, kind: Kind, operation: Operation) {
  const { event, page } = scopedPage(ctx);
  const branch = (args.branchPath as number[] | undefined) ?? [];
  const list = commandListAt(page, branch);
  const index = (args.index as number | undefined) ?? list.length;
  const path = [...branch, index];
  const current = operation === "update" ? list[index] : undefined;
  if (operation === "update" && current?.kind !== kind) {
    throw new PrimitiveError("고르신 줄에 같은 종류의 명령이 없어요.");
  }

  const fields: Record<string, unknown> = {};
  for (const field of Object.keys(commands[kind].fields)) {
    if (!Object.hasOwn(args, field)) continue;
    fields[field] = args[field] ?? undefined;
  }
  if (typeof fields.npcKey === "string") fields.npcKey = fields.npcKey.trim();
  const defaults = current ?? newCommand(kind);
  if (!current && kind === "advanceTime" && Object.keys(fields).length > 0) {
    if (!Object.hasOwn(fields, "minutes")) fields.minutes = undefined;
  }
  if (!current && kind === "timer" && fields.action && fields.action !== "set" && !Object.hasOwn(fields, "seconds")) {
    fields.seconds = undefined;
  }
  const command = { ...defaults, ...fields } as TimeSocialCommand;
  return { event, path, current, fields, command };
}

function edit(ctx: PrimitiveContext, args: Record<string, unknown>, kind: Kind, operation: Operation): Project {
  const { event, path, current, fields, command } = prepareEdit(ctx, args, kind, operation);
  checkReferences(ctx.project, event, command);
  try {
    return updateScopedPage(ctx, page => current
      ? updateEventCommand(page, path, fields, (args.expectedHash as string | undefined) ?? eventCommandHash(current))
      : insertEventCommand(page, path, command));
  } catch (error) {
    if (!(error instanceof EventCommandEditError)) throw error;
    if (error.code === "stale-event-command") throw new PrimitiveError("그 줄의 내용이 바뀌었어요. 다시 읽은 뒤 수정해 주세요.");
    throw new PrimitiveError("명령의 줄 위치와 입력값을 확인해 주세요.");
  }
}

function makePrimitive(kind: Kind, operation: Operation): SmallTaskPrimitive {
  const { title, fields, required = [] } = commands[kind];
  const update = operation === "update";
  const action = update ? "수정" : "추가";
  return {
    id: `cmd.${kind}.${operation}`,
    unit: UNIT,
    title: `${title} ${action}`,
    covers: { commandKinds: [kind] },
    targets: ["event"],
    ...(commandGuarantee(kind).authoringSurfaces.includes("ai") ? {} : { hidden: true }),
    args: {
      type: "object",
      description: update ? "기존 명령에서 지정한 값만 수정합니다." : "이벤트 페이지에 명령을 추가합니다. 생략한 값은 명령의 기본값을 씁니다.",
      properties: {
        index: count(update ? "고칠 줄 번호. 첫 줄은 0." : "끼워 넣을 줄 번호. 첫 줄은 0이며 생략하면 맨 뒤에 추가."),
        branchPath: { type: "array", items: { type: "integer" }, description: "읽어 온 분기 경로. 바깥 목록이면 생략." },
        ...(update ? { expectedHash: text("미리 읽은 명령의 지문. 입력하면 읽은 줄이 그대로일 때만 수정.") } : {}),
        ...fields,
      },
      required: update ? ["index"] : required,
      additionalProperties: false,
    },
    scope: eventPageScope,
    describe(ctx, args) {
      const { event, command } = prepareEdit(ctx, args, kind, operation);
      if (kind === "sleepUntilMorning" && update) return "다음 날 아침까지 자는 명령을 유지합니다.";
      const detail = summary(ctx.project, event, command);
      return koreanSentence(`${detail} 명령을 ${action}합니다.`);
    },
    apply(ctx, args) {
      return edit(ctx, args, kind, operation);
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = (Object.keys(commands) as Kind[]).flatMap(kind =>
  [makePrimitive(kind, "insert"), makePrimitive(kind, "update")],
);
