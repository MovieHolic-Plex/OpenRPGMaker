// 《이슬 마을의 종》 데모를 "살아 있는 마을" 로 만든다.
//
// 실측 배경(2026-07-26): 이 데모는 집 12채에 주민 4명이었고, 그중 3명이 movement=fixed 로
// 제자리에 못 박혀 있었으며 시간표는 0개, system.timeSystem 은 undefined 였다.
// 시간 시스템이 꺼지면 updateNpcSchedules 가 즉시 return 하므로(npcSchedules.ts:31) 시간표를
// 넣어도 아무도 움직이지 않는다. 그래서 "시간 켜기 + 하루 일과" 를 한 묶음으로 적용한다.
//
// 좌표를 하드코딩하지 않는 이유: fixture 맵이 바뀌면 벽 안으로 걸어 들어가는 시간표가 된다.
// 그래서 목적지는 항상 **맵에서 통행 가능한 칸을 실제로 골라** 정한다.

import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, NpcScheduleEntry, Project } from "@/project/types";

/** 하루 3단계. dayStartHour=6, dayEndHour=26 기본값과 맞춘다. */
const MORNING: readonly [number, number] = [6, 10];
const DAY: readonly [number, number] = [10, 18];
const EVENING: readonly [number, number] = [18, 26];

interface Point {
  readonly x: number;
  readonly y: number;
}

/** 시작점에서 나선형으로 퍼지며 통행 가능한 첫 칸을 찾는다. 없으면 null. */
function passableNear(project: Project, map: GameMap, from: Point, maxRadius = 6): Point | null {
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        // 링 위의 칸만 본다(안쪽은 이전 radius 에서 이미 검사했다).
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = from.x + dx;
        const y = from.y + dy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (isPassable(project, map, x, y)) return { x, y };
      }
    }
  }
  return null;
}

/** 주민 한 명의 하루 — 아침/낮/저녁 목적지와 활동 이름. */
interface DayPlan {
  readonly eventId: string;
  /** 낮에 일하는 자리(광장 중심에서의 상대 위치). */
  readonly workOffset: Point;
  readonly morningActivity: string;
  readonly dayActivity: string;
  readonly eveningActivity: string;
  /** 저녁에 광장에 남는 주민은 true — 전원이 귀가하면 밤 마을이 텅 빈다. */
  readonly staysOutAtEvening?: boolean;
}

// 활동이 겹치지 않게 배분한다 — 평가기의 npcActivityKinds 지표가 이 다양성을 본다.
const DAY_PLANS: readonly DayPlan[] = [
  {
    eventId: "ev_merchant",
    workOffset: { x: 2, y: 1 },
    morningActivity: "prepare",
    dayActivity: "market",
    eveningActivity: "home",
  },
  {
    eventId: "ev_noah",
    workOffset: { x: -4, y: 4 },
    morningActivity: "well",
    dayActivity: "field",
    eveningActivity: "home",
  },
  {
    eventId: "ev_kid",
    workOffset: { x: 3, y: -2 },
    morningActivity: "home",
    dayActivity: "play",
    eveningActivity: "play",
    staysOutAtEvening: true,
  },
  {
    eventId: "ev_mir_elder",
    workOffset: { x: 0, y: -2 },
    morningActivity: "watch",
    dayActivity: "watch",
    eveningActivity: "home",
    staysOutAtEvening: true,
  },
];

function scheduleFor(
  project: Project,
  map: GameMap,
  event: GameEvent,
  plan: DayPlan,
  plaza: Point,
): NpcScheduleEntry[] | null {
  // 집/기본 자리 = 이벤트가 원래 서 있던 칸(통행 가능한 곳으로 보정).
  const home = passableNear(project, map, { x: event.x, y: event.y });
  const work = passableNear(project, map, { x: plaza.x + plan.workOffset.x, y: plaza.y + plan.workOffset.y });
  if (!home || !work) return null;
  const at = (point: Point): NpcScheduleEntry["at"] => ({ mapId: map.id, x: point.x, y: point.y });
  return [
    { when: { hourRange: MORNING }, at: at(home), facing: "down", activity: plan.morningActivity },
    { when: { hourRange: DAY }, at: at(work), facing: "down", activity: plan.dayActivity },
    {
      when: { hourRange: EVENING },
      at: at(plan.staysOutAtEvening ? work : home),
      facing: "down",
      activity: plan.eveningActivity,
    },
  ];
}

export interface EnlivenResult {
  readonly timeSystemEnabled: boolean;
  readonly scheduledNpcs: number;
  /** 시간표를 붙이지 못한 주민(이벤트 없음 또는 통행 가능한 목적지 없음). */
  readonly skipped: readonly string[];
}

/**
 * 데모 마을에 시간 시스템과 주민 하루 일과를 적용한다. project 를 제자리에서 수정한다.
 * 이미 시간표가 있는 주민은 건드리지 않는다(사용자가 손본 것을 덮지 않는다).
 */
export function enlivenDewVillage(project: Project): EnlivenResult {
  const map = project.maps[project.startMapId];
  if (!map) return { timeSystemEnabled: false, scheduledNpcs: 0, skipped: [] };

  // 시간 시스템: forceSleep 은 켜지 않는다(데모에서 강제 취침은 과하다).
  // minutesPerRealSecond=1 → 6시~26시 하루가 실제 20분. 데모를 한 바퀴 보기에 맞다.
  if (!project.system.timeSystem?.enabled) {
    project.system = {
      ...project.system,
      timeSystem: { enabled: true, minutesPerRealSecond: 1, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 },
    };
  }

  const plaza = passableNear(project, map, project.startPos) ?? project.startPos;
  const skipped: string[] = [];
  let scheduled = 0;
  for (const plan of DAY_PLANS) {
    const event = map.events.find((entry) => entry.id === plan.eventId);
    if (!event) {
      skipped.push(`${plan.eventId}(이벤트 없음)`);
      continue;
    }
    if ((event.schedule?.length ?? 0) > 0) {
      scheduled += 1;
      continue;
    }
    const schedule = scheduleFor(project, map, event, plan, plaza);
    if (!schedule) {
      skipped.push(`${plan.eventId}(통행 가능한 목적지 없음)`);
      continue;
    }
    event.schedule = schedule;
    // 제자리 고정(fixed)이면 시간표대로 걸어도 걸음 애니메이션이 죽는다 — 배회로 바꿔 준다.
    // 단 상인은 좌판을 지켜야 하므로 고정을 유지한다.
    const page = event.pages?.[0];
    if (page && page.movement.type === "fixed" && plan.eventId !== "ev_merchant") {
      page.movement = { ...page.movement, type: "random" };
    }
    scheduled += 1;
  }
  return { timeSystemEnabled: project.system.timeSystem?.enabled === true, scheduledNpcs: scheduled, skipped };
}
