import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { newCommand } from "@/editor/eventCommandFactory";
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { timerIdLabel } from "@/editor/panels/eventEditor/options";
import type { JsonSchema } from "@/editor/tools/types";
import { commandGuarantee } from "@/project/commandGuaranteeRegistry";
import {
  EventCommandEditError, insertEventCommand, updateEventCommand,
} from "@/project/eventCommands/singleCommandOps";
import { eventDisplayName } from "@/project/eventDisplayName";
import { DEFAULT_ENEMY_FACTION_ID, PLAYER_FACTION_ID } from "@/project/factions";
import { MAX_DAYS_PER_SEASON, resolveTimeSystem, SEASONS } from "@/project/gameTime";
import { RELATIONSHIP_STATES, relationshipStateName } from "@/project/relationshipState";
import { findSchedule, SCHEDULE_SLOT_LIMIT } from "@/project/schedule";
import { ANY_FRIENDSHIP_KEY, FRIENDSHIP_MAX } from "@/project/session";
import { resolveSocialKey } from "@/project/socialKey";
import type { Command, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
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

// The runtime processes each crossed day and each day of crop growth individually.
const MAX_ADVANCE_DAYS = SEASONS.length * MAX_DAYS_PER_SEASON;
const MAX_ADVANCE_HOURS = MAX_ADVANCE_DAYS * 48;

const count = (description: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): JsonSchema =>
  ({ type: "integer", minimum, maximum, description });
const text = (description: string): JsonSchema => ({ type: "string", pattern: "\\S", description });
const choice = (description: string, values: readonly string[]): JsonSchema =>
  ({ type: "string", enum: values, description });
const npcKey: JsonSchema = {
  type: "string",
  description: "인물의 호감도 기록에 쓰는 이름표. 이 이벤트의 인물을 쓰려면 빈 문자열.",
};
const scheduleId = text("자료집에서 확인한 일정표의 식별자.");
const slotVariableId: JsonSchema = {
  ...text("현재 순번을 저장할 변수의 식별자. 저장하지 않으려면 null."),
  type: ["string", "null"],
};

const commands: Record<Kind, { title: string; fields: Fields; required?: readonly string[] }> = {
  timer: {
    title: "타이머",
    fields: {
      action: choice("시간 설정, 시작, 정지 가운데 하나.", ["set", "start", "stop"]),
      seconds: { ...count("타이머를 맞출 시간(초). 시작할 때 남은 시간을 쓰려면 null."), type: ["integer", "null"] },
      timerId: choice("첫째 또는 둘째 타이머.", ["timer1", "timer2"]),
    },
  },
  advanceTime: {
    title: "시간 진행",
    fields: {
      days: count("지나갈 날 수.", 0, MAX_ADVANCE_DAYS),
      hours: count("더 흐를 시간 수.", 0, MAX_ADVANCE_HOURS),
      minutes: count("더 흐를 분 수. 강제 취침이 켜져 있으면 시·분 진행 중 하루가 끝날 때 다음 날 아침에 멈춥니다.", 0, MAX_ADVANCE_HOURS * 60),
    },
  },
  advanceCropGrowth: {
    title: "작물 성장 진행",
    fields: { days: count("작물이 자랄 날 수.", 0, MAX_ADVANCE_DAYS) },
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
      slotCount: { ...count("앞에서부터 채울 칸 수. 모든 칸을 쓰려면 null.", 1, SCHEDULE_SLOT_LIMIT), type: ["integer", "null"] },
    },
    required: ["scheduleId"],
  },
  runSchedule: { title: "일정표 실행", fields: { scheduleId, slotVariableId }, required: ["scheduleId"] },
  changeFriendship: {
    title: "호감도 변경",
    fields: { npcKey, delta: count("호감도를 바꿀 점수. 낮추려면 음수.", -FRIENDSHIP_MAX, FRIENDSHIP_MAX) },
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
      value: { type: "number", minimum: -2, maximum: 4, description: "지정할 태도 점수는 -2~2, 올리거나 내릴 점수는 0~4." },
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

function checkCommand(project: Project, event: GameEvent, command: TimeSocialCommand): void {
  // Explicit names are the runtime's author-defined social keys. Self requires a character identity.
  if (command.kind === "changeFriendship" || command.kind === "getFriendship" || command.kind === "setRelationship") {
    const key = resolveSocialKey(event, command.npcKey);
    if (!key) {
      throw new PrimitiveError("이 이벤트에 연결된 인물이 없어요. 명령을 적용할 인물을 지정해 주세요.");
    }
    if (Object.hasOwn(Object.prototype, key)) {
      throw new PrimitiveError("이 이름표는 호감도나 관계 기록에 쓸 수 없어요. 인물의 이름표를 확인해 주세요.");
    }
    if (key === ANY_FRIENDSHIP_KEY && command.kind !== "getFriendship") {
      throw new PrimitiveError("별표는 가장 높은 호감도를 읽을 때 쓸 수 있어요. 호감도나 관계를 바꿀 인물을 지정해 주세요.");
    }
  }
  switch (command.kind) {
    case "advanceTime":
    case "setTime":
    case "sleepUntilMorning": {
      const system = resolveTimeSystem(project);
      if (!system) {
        throw new PrimitiveError("게임의 시간 시스템이 꺼져 있어요. 자료집의 시스템 설정에서 먼저 켜 주세요.");
      }
      if (command.kind === "advanceTime") {
        const minutesPerDay = 60 * (system.dayEndHour - system.dayStartHour);
        const minutes = (command.hours ?? 0) * 60 + (command.minutes ?? 0);
        if ((command.days ?? 0) + Math.ceil(minutes / minutesPerDay) > MAX_ADVANCE_DAYS) {
          throw new PrimitiveError(`한 명령에서 최대 ${MAX_ADVANCE_DAYS}일을 진행할 수 있어요. 일·시간·분을 줄여 주세요.`);
        }
      } else if (command.kind === "setTime") {
        const maxHour = Math.max(23, system.dayEndHour);
        if (command.hour > maxHour) {
          throw new PrimitiveError(`이 프로젝트에서는 시각을 ${maxHour}시까지 설정할 수 있어요.`);
        }
      }
      return;
    }
    case "planSchedule":
    case "runSchedule": {
      const schedule = findSchedule(project.database, command.scheduleId);
      if (!schedule) throw new PrimitiveError("자료집에서 일정표를 찾을 수 없어요.");
      if (command.kind === "planSchedule") {
        if (!schedule.slots.length) throw new PrimitiveError("일정표에 칸이 없어요. 자료집에서 칸을 만들어 주세요.");
        if (command.slotCount !== undefined && command.slotCount > schedule.slots.length) {
          throw new PrimitiveError(`이 일정표에는 ${schedule.slots.length}칸이 있어요. 사용할 칸 수를 줄여 주세요.`);
        }
      } else if (command.slotVariableId !== undefined && !project.variables.some(row => row.id === command.slotVariableId)) {
        throw new PrimitiveError("순번을 저장할 변수를 찾을 수 없어요.");
      }
      const commonEventIds = new Set(project.commonEvents.map(row => row.id));
      if (schedule.activities.some(activity => !commonEventIds.has(activity.commonEventId))) {
        throw new PrimitiveError("일정표 활동에 연결된 공용 이벤트를 찾을 수 없어요. 자료집에서 활동을 확인해 주세요.");
      }
      return;
    }
    case "changeFactionStance": {
      const known = (id: string) => id === PLAYER_FACTION_ID || id === DEFAULT_ENEMY_FACTION_ID
        || project.factions?.defs.some(row => row.id === id);
      if (!known(command.a) || !known(command.b)) throw new PrimitiveError("설정된 진영을 찾을 수 없어요.");
      if (command.op === "=" ? command.value < -2 || command.value > 2 : command.value < 0 || command.value > 4) {
        throw new PrimitiveError(command.op === "="
          ? "지정할 태도 점수는 -2에서 2 사이로 입력해 주세요."
          : "올리거나 내릴 태도 점수는 0에서 4 사이로 입력해 주세요.");
      }
      return;
    }
    case "getFriendship":
      if (!project.variables.some(row => row.id === command.variableId)) {
        throw new PrimitiveError("호감도를 저장할 변수를 찾을 수 없어요.");
      }
      return;
  }
}

function displayName(name: string | undefined, id: string, fallback: string): string {
  if (!name || name.trim() === id || /[{}\[\]]/u.test(name)) return fallback;
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
      const timer = timerIdLabel(command.timerId ?? "timer1");
      if (command.action === "stop") return `‘${timer}’ 작동을 멈추는`;
      if (command.action === "set") return `‘${timer}’ 시간을 ${command.seconds ?? 0}초로 맞추는`;
      return command.seconds === undefined
        ? `‘${timer}’를 남은 시간으로 시작하는`
        : `‘${timer}’ 시간을 ${command.seconds}초로 맞춰 시작하는`;
    }
    case "advanceTime": {
      const duration = [command.days && `${command.days}일`, command.hours && `${command.hours}시간`,
        command.minutes && `${command.minutes}분`].filter(Boolean).join(" ");
      return `시간을 ${duration || "0분"} 진행하는`;
    }
    case "advanceCropGrowth":
      return `작물을 ${command.days}일만큼 자라게 하는`;
    case "setTime": {
      const hour = String(command.hour).padStart(2, "0");
      const minute = String(command.minute ?? 0).padStart(2, "0");
      return `시각을 ${hour}:${minute}으로 맞추는`;
    }
    case "planSchedule":
    case "runSchedule": {
      const id = command.scheduleId;
      const name = displayName(findSchedule(project.database, id)?.title, id, "선택한 일정표");
      if (command.kind === "planSchedule") {
        const slots = command.slotCount === undefined ? "모든 칸" : `앞 ${command.slotCount}칸`;
        return `일정표 ‘${name}’에서 ${slots}의 활동을 고르는`;
      }
      const run = `일정표 ‘${name}’의 활동을 실행`;
      return command.slotVariableId === undefined
        ? `${run}하는`
        : `${run}하고 순번을 변수 ‘${variableName(project, command.slotVariableId)}’에 저장하는`;
    }
    case "changeFriendship":
      return `‘${socialName(project, event, command.npcKey)}’의 호감도를 ${Math.abs(command.delta)}점 ${command.delta < 0 ? "내리는" : "올리는"}`;
    case "setRelationship":
      return `‘${socialName(project, event, command.npcKey)}’의 관계를 ‘${relationshipStateName(command.state)}’ 상태로 설정하는`;
    case "changeFactionStance": {
      const factionName = (id: string) => displayName(
        project.factions?.defs.find(row => row.id === id)?.name, id,
        id === PLAYER_FACTION_ID ? "플레이어 진영" : id === DEFAULT_ENEMY_FACTION_ID ? "기본 적 진영" : "선택한 진영",
      );
      const pair = `‘${factionName(command.a)}’와 ‘${factionName(command.b)}’ 사이의 태도 점수를`;
      if (command.op === "=") return `${pair} ${command.value}로 정하는`;
      return `${pair} ${command.value}점 ${command.op === "+=" ? "올리는" : "내리는"}`;
    }
    case "getFriendship": {
      const name = variableName(project, command.variableId);
      return resolveSocialKey(event, command.npcKey) === ANY_FRIENDSHIP_KEY
        ? `가장 높은 호감도를 ‘${name}’에 저장하는`
        : `‘${socialName(project, event, command.npcKey)}’의 호감도를 ‘${name}’에 저장하는`;
    }
    case "sleepUntilMorning":
      return "다음 날 아침까지 자는";
  }
}

function variableName(project: Project, id: string): string {
  return displayName(project.variables.find(row => row.id === id)?.name, id, "선택한 변수");
}

function prepareEdit(ctx: PrimitiveContext, args: Record<string, unknown>, kind: Kind, operation: Operation) {
  const { event, page } = scopedPage(ctx);
  const branch = (args.branchPath as number[] | undefined) ?? [];
  // The native insert creates missing optional branches on its own copy of the page.
  const list = operation === "insert" ? resolveCommandListAtPath(page.commands, [...branch, 0]) : commandListAt(page, branch);
  const length = list?.length ?? 0;
  const index = (args.index as number | undefined) ?? length;
  if (index >= length + Number(operation === "insert")) {
    throw new PrimitiveError("그 줄을 찾을 수 없어요. 명령 목록을 다시 확인해 주세요.");
  }
  const path = [...branch, index];
  const current = operation === "update" ? list?.[index] : undefined;
  if (operation === "update" && current?.kind !== kind) {
    throw new PrimitiveError(`그 줄은 ‘${commands[kind].title}’ 명령이 아니에요. 고칠 줄을 다시 확인해 주세요.`);
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
  try {
    return updateScopedPage(ctx, page => {
      const edited = current
        ? updateEventCommand(page, path, fields, args.expectedHash as string)
        : insertEventCommand(page, path, command);
      if (command.kind === "timer") {
        if (command.action === "stop" && typeof args.seconds === "number") {
          throw new PrimitiveError("타이머를 멈출 때는 초를 지정할 수 없어요. 남은 시간이 그대로 유지돼요.");
        }
        // Keep the implicit zero in legacy set commands when patching unrelated fields.
        const alreadySet = current?.kind === "timer" && current.action === "set";
        if (command.action === "set" && command.seconds === undefined && (!alreadySet || args.seconds === null)) {
          throw new PrimitiveError("타이머의 시간을 맞추려면 몇 초인지 입력해 주세요.");
        }
      }
      checkCommand(ctx.project, event, command);
      return current && jsonEqual(current, command) ? page : edited;
    });
  } catch (error) {
    if (!(error instanceof EventCommandEditError) || error.code === "stale-event-command") throw error;
    throw new PrimitiveError("명령의 분기 위치와 입력값을 확인해 주세요.");
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
        ...(update ? { expectedHash: text("get_event에서 includeCommandHashes를 켜고 받은 줄의 지문. 읽은 줄이 그대로일 때만 수정.") } : {}),
        ...fields,
      },
      required: update ? ["index", "expectedHash"] : required,
      additionalProperties: false,
    },
    scope: eventPageScope,
    describe(ctx, args) {
      const { event, command, current } = prepareEdit(ctx, args, kind, operation);
      const detail = summary(ctx.project, event, command);
      if (current && jsonEqual(current, command)) return koreanSentence(`${detail} 명령을 그대로 둡니다.`);
      const forcedSleep = command.kind === "advanceTime" && ((command.hours ?? 0) > 0 || (command.minutes ?? 0) > 0)
        && resolveTimeSystem(ctx.project)?.forceSleep;
      const notice = forcedSleep ? " 시·분 진행 중 하루가 끝나면 다음 날 아침에 멈춰요." : "";
      return koreanSentence(`${detail} 명령을 ${action}합니다.${notice}`);
    },
    apply(ctx, args) {
      return edit(ctx, args, kind, operation);
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = (Object.keys(commands) as Kind[]).flatMap(kind =>
  [makePrimitive(kind, "insert"), makePrimitive(kind, "update")],
);
