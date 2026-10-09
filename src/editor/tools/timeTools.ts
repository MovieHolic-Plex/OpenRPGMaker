import { normalizeTimeSystemConfig } from "@/project/databaseRecordModel";
import { DEFAULT_DAY_END_HOUR, DEFAULT_DAY_START_HOUR, DEFAULT_DAYS_PER_SEASON, DEFAULT_TIME_MINUTES_PER_REAL_SECOND, initialGameTime } from "@/project/gameTime";
import { npcScheduleTargetForEvent } from "@/project/npcSchedule";
import type { Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const configureTimeSystem: ToolDefinition = {
  name: "configure_time_system",
  description:
    "게임 시간/달력 시스템을 설정한다. enabled:false면 system.timeSystem을 제거해 기존 프로젝트와 같은 완전 비활성 상태로 둔다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      enabled: { type: "boolean" },
      minutesPerRealSecond: { type: "number", description: "기본 1. 1초마다 몇 게임 분이 흐르는지" },
      dayStartHour: { type: "integer", description: "기본 6" },
      dayEndHour: { type: "integer", description: "기본 26(새벽 2시)" },
      daysPerSeason: { type: "integer", description: "계절당 일수. 기본 28" },
      forceSleep: { type: "boolean", description: "dayEndHour 도달 시 강제 취침. 기본 false" },
      onDayEnd: { type: "string", description: "다음날 시작 직전 실행할 공통 이벤트 id" },
    },
    required: ["enabled"],
  },
  run(draft, args): ToolExecResult {
    if (args.enabled !== true) {
      delete draft.system.timeSystem;
      return { summary: "시간 시스템을 비활성화했습니다.", data: { enabled: false } };
    }
    const onDayEnd = typeof args.onDayEnd === "string" && args.onDayEnd.trim().length > 0 ? args.onDayEnd.trim() : undefined;
    if (onDayEnd && !draft.commonEvents.some((event) => event.id === onDayEnd)) {
      throw new ToolError(`onDayEnd 공통 이벤트를 찾을 수 없습니다: ${onDayEnd}`, { code: "common-event-not-found" });
    }
    const normalized = normalizeTimeSystemConfig({
      enabled: true,
      minutesPerRealSecond: numberArg(args.minutesPerRealSecond, DEFAULT_TIME_MINUTES_PER_REAL_SECOND),
      dayStartHour: integerArg(args.dayStartHour, DEFAULT_DAY_START_HOUR),
      dayEndHour: integerArg(args.dayEndHour, DEFAULT_DAY_END_HOUR),
      daysPerSeason: integerArg(args.daysPerSeason, DEFAULT_DAYS_PER_SEASON),
      forceSleep: args.forceSleep === true,
      onDayEnd,
    });
    if (!normalized) throw new ToolError("시간 시스템 설정 정규화에 실패했습니다.", { code: "invalid-time-system" });
    draft.system.timeSystem = normalized;
    const relocated = scheduleRelocations(draft);
    return {
      summary: `시간 시스템을 활성화했습니다. 시작 ${normalized.dayStartHour}:00, 종료 ${normalized.dayEndHour}:00, 배속 ${normalized.minutesPerRealSecond}분/초`,
      data: normalized,
      ...(relocated.length > 0 ? { warnings: [
        `시간 시스템을 켜면 시간표가 NPC ${relocated.length}명을 배치한 자리에서 옮긴다: ${relocated.join("; ")} — 배치 자리를 지키려면 set_npc_schedule 로 시간표를 고쳐라.`,
      ] } : {}),
    };
  },
};

/**
 * 시간표는 시간 시스템이 켜져 있을 때만 NPC 를 움직인다(npcSchedules.updateNpcSchedules). 끝에 시간 시스템을
 * 켜면 그때까지 검증한 배치가 조용히 무너진다(2026-09-23 추리 도그푸딩: 지목 NPC 가 옛 자리로 돌아감).
 * 게임 시작 시각 기준으로 끌려갈 NPC 를 센다.
 */
function scheduleRelocations(project: Project): string[] {
  const time = initialGameTime(project.system.timeSystem);
  const moves: string[] = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const target = npcScheduleTargetForEvent(map.id, event, time);
      if (!target?.matched || (target.mapId === map.id && target.x === event.x && target.y === event.y)) continue;
      const where = target.mapId === map.id ? `(${target.x}, ${target.y})` : `${target.mapId} (${target.x}, ${target.y})`;
      moves.push(`${event.name ?? event.id} ${map.id} (${event.x}, ${event.y}) → ${where}${target.activity ? ` ${target.activity}` : ""}`);
    }
  }
  return moves;
}

function numberArg(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function integerArg(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

export const TIME_TOOLS: readonly ToolDefinition[] = [configureTimeSystem];
