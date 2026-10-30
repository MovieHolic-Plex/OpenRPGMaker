import { normalizeTimeSystemConfig } from "@/project/databaseRecordModel";
import { DEFAULT_DAY_END_HOUR, DEFAULT_DAY_START_HOUR, DEFAULT_DAYS_PER_SEASON, DEFAULT_TIME_MINUTES_PER_REAL_SECOND, initialGameTime } from "@/project/gameTime";
import { npcScheduleTargetForEvent } from "@/project/npcSchedule";
import { fieldMenu } from "@/project/fieldMenu";
import type { Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { REST_ALLOW_ON_MAPS, REST_TARGETS, REST_TARGET_LABELS, isRestTarget, normalizeRestMenu, resolveRestMenu, type RestMenuConfig } from "@/project/restMenu";

const configureTimeSystem: ToolDefinition = {
  name: "configure_time_system",
  description:
    "게임 시간/달력 시스템을 설정한다. enabled:false면 system.timeSystem을 제거해 기존 프로젝트와 같은 완전 비활성 상태로 둔다. " +
    "restMenu 를 주면 ESC 메뉴에 「쉬기」가 생겨 플레이어가 아침(6시)·정오·저녁(18시)·자정 중 고른 시각까지 시간을 흘린다(밤까지 기다려 밤에만 나오는 적을 사냥하는 식). " +
    "쉬면 페이드 뒤 맵 이벤트 페이지의 시간대 조건과 필드 스폰의 timePhases 가 다시 평가된다. 추격 중에는 늘 거절된다. 생략하면 기존 쉬기 설정을 그대로 둔다.",
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
      restMenu: {
        type: "object",
        additionalProperties: false,
        description: "ESC 메뉴 「쉬기」. {enabled:false} 면 항목을 없앤다.",
        properties: {
          enabled: { type: "boolean" },
          allowOnMaps: { type: "string", enum: ["all", "safe"], description: "all(기본)=어디서나. safe=필드 스폰·랜덤 인카운터가 없는 맵이나 safeZones 안에서만" },
          targets: { type: "array", items: { type: "string", enum: ["morning", "noon", "evening", "midnight"] }, description: "고를 수 있는 목표 시각. 생략하면 넷 다" },
          recoverHp: { type: "boolean", description: "쉬면 파티 HP 를 모두 채운다. 기본 false" },
        },
        required: ["enabled"],
      },
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
      restMenu: restMenuArg(args.restMenu, draft.system.timeSystem?.restMenu),
    });
    if (!normalized) throw new ToolError("시간 시스템 설정 정규화에 실패했습니다.", { code: "invalid-time-system" });
    draft.system.timeSystem = normalized;
    const relocated = scheduleRelocations(draft);
    const warnings: string[] = [];
    if (relocated.length > 0) warnings.push(`시간 시스템을 켜면 시간표가 NPC ${relocated.length}명을 배치한 자리에서 옮긴다: ${relocated.join("; ")} — 배치 자리를 지키려면 set_npc_schedule 로 시간표를 고쳐라.`);
    const menu = fieldMenu(draft);
    if (resolveRestMenu(draft) && menu && !menu.entries.some((entry) => entry.command === "rest")) {
      warnings.push('저작된 ESC 메뉴에 「쉬기」 항목이 없어 쉬기를 열 수 없다. configure_field_menu {preset:"custom", add:[{command:"rest",label:"쉬기"}]} 로 넣어라.');
    }
    return {
      summary: `시간 시스템을 활성화했습니다. 시작 ${normalized.dayStartHour}:00, 종료 ${normalized.dayEndHour}:00, 배속 ${normalized.minutesPerRealSecond}분/초${restSummary(draft)}`,
      data: normalized,
      ...(warnings.length > 0 ? { warnings } : {}),
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

function restSummary(project: Project): string {
  const rest = resolveRestMenu(project);
  if (!rest) return "";
  return ` · ESC 「쉬기」 ${rest.targets.map((target) => REST_TARGET_LABELS[target]).join("/")}${rest.allowOnMaps === "safe" ? " (안전한 맵에서만)" : ""}${rest.recoverHp ? " · HP 회복" : ""}`;
}

function restMenuArg(value: unknown, current: RestMenuConfig | undefined): RestMenuConfig | undefined {
  if (value === undefined) return current;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ToolError("restMenu 는 {enabled, allowOnMaps?, targets?, recoverHp?} 객체입니다.", { code: "invalid-args" });
  const raw = value as Record<string, unknown>;
  if (typeof raw.enabled !== "boolean") throw new ToolError("restMenu.enabled 는 true/false 입니다.", { code: "invalid-args" });
  if (raw.allowOnMaps !== undefined && !(REST_ALLOW_ON_MAPS as readonly unknown[]).includes(raw.allowOnMaps)) {
    throw new ToolError(`restMenu.allowOnMaps 는 ${REST_ALLOW_ON_MAPS.join("|")} 입니다.`, { code: "invalid-args" });
  }
  if (raw.targets !== undefined && (!Array.isArray(raw.targets) || raw.targets.length === 0 || !raw.targets.every(isRestTarget))) {
    throw new ToolError(`restMenu.targets 는 ${REST_TARGETS.join("|")} 중 하나 이상입니다.`, { code: "invalid-args" });
  }
  if (!raw.enabled) return undefined;
  return normalizeRestMenu(raw);
}

function numberArg(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function integerArg(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

export const TIME_TOOLS: readonly ToolDefinition[] = [configureTimeSystem];
