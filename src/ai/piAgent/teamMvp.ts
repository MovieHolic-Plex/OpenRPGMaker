// 첫 MVP 팀 실행의 규칙과 finish 관문 — v2 단일 실행이 지키는 첫 판 약속(맵 3~5장 · 엔딩 없음 · 끝 지점 mvp_reached 까지 걸어서 감)을 팀 실행도 지킨다.
// 왜(2026-11-24 assistant-measure): 첫 MVP 팀 실행(#4973)은 v1 Pi 팀으로 돌아 v2 끝맺음(엔딩 → 끝 지점 바꾸기, 3~5맵 관문)을 비켜 갔다.
// 팀장 지시문은 장르 프리셋 요청에만 첫 생성 범위를 실었다. 판정은 작은 일 다섯째 묶음 mvpStart(checksStart.ts)와 같은 셈이다.
import type { Project } from "@/project/types";
import { MVP_REACHED_SWITCH } from "@/project/gameBlueprint";
import { countMaps } from "@/ai/v2/judge/mapCount";
import { MVP_PLACES } from "@/ai/v2/judge/blueprintScale";
import { endMvpAtLastStep } from "@/ai/v2/story/shipDefaults";
import { runSwitchPlay } from "@/qa/gameCheck/autoPlay";
import { allPages, visitPageCommands } from "@/qa/gameCheck/walk";

export const FIRST_MVP_TEAM_RULES = [
  `[첫 MVP 범위] 빈 프로젝트의 첫 판이다. 맵은 ${MVP_PLACES.min}~${MVP_PLACES.max}장(시작 장소 1, 이어지는 장소 1~3, 목표 장소 1), 핵심 루프 하나(만나고 → 하고 → 끝 지점), 5~10분 분량이다.`,
  `- 엔딩·결말 이벤트·define_ending 을 만들지 않는다. 핵심 경로의 마지막 이벤트가 스위치 ${MVP_REACHED_SWITCH} 를 켠다(setSwitch ${MVP_REACHED_SWITCH} = true) — 그 담당에게 이 스위치 id 를 그대로 적어 배정한다.`,
  "- 모든 맵은 시작 맵에서 문·이동 칸으로 걸어서 닿아야 한다. 빈 맵·이어지지 않은 맵을 남기지 않는다.",
  "- finish 보고에는 만든 것, 바로 플레이해 볼 순서, 다음 요청으로 늘릴 것 세 가지(예: 「다음 지역 만들어 줘」)를 적는다.",
] as const;

/**
 * 첫 MVP 팀원 한 배정의 차례 상한. 2026-11-25 team-mvp-revive 실측(ccapi Sonnet 5.5 high, 팀 start-jrpg): 뼈대·자료 프로젝트 작업 하나가
 * 15분·도구 366번을 쓰며 메뉴 설정·시스템 검수까지 해, 맵 담당 셋이 그 뒤에야 동시에 시작했다(프로젝트 작업은 맵 작업과 배타).
 * 빈 칸은 finish 가 draft-cast 로 채우므로 프로젝트 작업은 짧게, 맵 담당은 자기 맵 하나 분량만.
 */
export const FIRST_MVP_MEMBER_TURNS = { project: 30, map: 60 } as const;

/**
 * 첫 MVP 맵 담당이 쓰는 도구 — 장소는 결정적 생성기(마을·던전·지역 장소)로 한 번에 짓고, 사람·끝 지점 이벤트만 놓는다.
 * 2026-11-25 team-mvp-revive r6: 시작 마을 담당 한 명이 find_tools·call_tool 로 손 시공·BGM·전투 모의까지 넓혀 22분을 썼다(맵 담당 도구 호출의 상위가 find_tools 20·show_map_region 19·get_database_records 17).
 * 목록 밖 도구는 find_tools/call_tool 로도 부르지 못한다(resolvePiToolShape 가 toolNames 를 지킨다).
 */
export const FIRST_MVP_BUILDER_TOOLS = [
  "author_beodeul_town", "author_dungeon", "build_region_place",
  "show_map_region", "get_map_region", "check_reachability", "find_events", "get_event",
  "place_npc", "list_npc_graphics", "upsert_event", "declare_story_flag", "set_map_properties",
] as const;

/**
 * 런타임이 생성기로 이미 지은 장소 맵(teamMvpPrebuild.ts)의 담당 도구 — 생성기·지역 장소를 뺀다. 새 맵을 만들 도구가 없어 첫 판이 3~5장을 넘지 않는다
 * (2026-11-25 r8: build_region_place 집이 실내 맵 둘을 더해 6장 · r9: mapId 없는 author_dungeon 이 같은 이름 맵을 둘 더해 7장).
 */
export const FIRST_MVP_PREBUILT_TOOLS = FIRST_MVP_BUILDER_TOOLS.filter((name) => name !== "author_beodeul_town" && name !== "author_dungeon" && name !== "build_region_place");

export interface TeamMvpCheck {
  /** finish 가 고친 것(엔딩 호출 → 끝 지점 스위치, 엔딩 정의 걷기). */
  readonly applied: string[];
  /** 아직 첫 판 약속을 못 지킨 것 — 팀장에게 돌려줄 글. */
  readonly problems: string[];
  /** 맵 하나에 묶인 문제 — 런타임이 팀장을 거치지 않고 그 맵 담당에게 바로 맡긴다. */
  readonly fixes: { readonly mapId: string; readonly task: string }[];
}

function hasEndpointOn(map: Project["maps"][string]): boolean {
  let found = false;
  const visit = (value: unknown): void => {
    if (found || !value || typeof value !== "object") return;
    if (Array.isArray(value)) { for (const item of value) visit(item); return; }
    const record = value as Record<string, unknown>;
    if (record.kind === "setSwitch" && record.switchId === MVP_REACHED_SWITCH && record.value !== false) { found = true; return; }
    for (const child of Object.values(record)) visit(child);
  };
  visit(map.events);
  return found;
}

/**
 * 맵 담당이 반납하기 전 자기 맵만 보는 첫 MVP 검사 — 걸리면 런타임이 같은 담당에게 바로 한 번 더 맡긴다(팀장 왕복 없음).
 * 2026-11-25 r6·r8: 끝 지점 없이 반납 → finish 관문 거절 → 팀장이 다시 배정하는 데 10분 넘게 걸렸다.
 */
export function mvpBuilderProblems(project: Project, mapId: string, task: string, stillSkeleton: (map: Project["maps"][string]) => boolean): string | null {
  const map = project.maps[mapId];
  if (!map) return null;
  if (stillSkeleton(map)) return `맵 '${map.name ?? mapId}'(${mapId})이 아직 비어 있다 — author_dungeon 또는 author_beodeul_town 에 mapId:"${mapId}" 를 주어 이 자리에 짓고, 사람·이벤트를 놓는다. 새 맵은 만들지 않는다.`;
  if (task.includes(MVP_REACHED_SWITCH) && !hasEndpointOn(map)) return `끝 지점이 없다 — 맵 '${map.name ?? mapId}'(${mapId})의 핵심 경로 마지막 이벤트(보스 승리 뒤·목표 대화 끝)가 스위치 ${MVP_REACHED_SWITCH} 를 켜게 upsert_event 로 넣는다({kind:"setSwitch", switchId:"${MVP_REACHED_SWITCH}", value:true}). 그 이벤트는 시작 문에서 걸어 닿는 칸에 둔다.`;
  return null;
}

const PLAY_BUDGET_MS = 90_000;
const TIMED_OUT = "자동 플레이 시간 상한 초과";

/** 엔딩을 끝 지점 스위치로 바꾸고(제자리), 맵 수·도달·끝 지점까지의 자동 플레이를 본다. */
export function checkTeamMvp(project: Project): TeamMvpCheck {
  const applied = endMvpAtLastStep(project);
  const problems: string[] = [];
  const fixes: { mapId: string; task: string }[] = [];
  const res = countMaps(project);
  const maps = Object.keys(project.maps).length;
  const unreachable = res.uncounted.filter((m) => m.reason === "unreachable").map((m) => m.name);
  if (maps < MVP_PLACES.min || maps > MVP_PLACES.max) problems.push(`맵이 ${maps}장이다 — 첫 MVP 는 ${MVP_PLACES.min}~${MVP_PLACES.max}장(${maps > MVP_PLACES.max ? "남는 맵을 remove_map 으로 지우거나 합친다" : "목표 장소까지 맵을 더 짓고 문으로 잇는다"}).`);
  for (const m of res.uncounted.filter((u) => u.reason === "unreachable")) if ((project.worldGraph?.nodes ?? []).some((node) => node.mapId === m.id)) fixes.push({ mapId: m.id, task: `이 맵은 시작 맵에서 걸어서 못 닿는다 — 세계 문(ev_world_gate*)이 내려설 수 있는 칸에 있고 그 문에서 이 맵의 이벤트까지 길이 이어지게 고친다. 다른 맵은 건드리지 않는다.` });
  if (unreachable.length) problems.push(`시작에서 걸어서 못 닿는 맵: ${unreachable.join(", ").slice(0, 160)} — 그 맵 담당에게 앞 맵과 잇는 문·이동 칸(또는 빈 맵이면 바닥과 내용)을 배정한다.`);
  let target: Parameters<typeof runSwitchPlay>[2] | undefined;
  for (const page of allPages(project)) {
    if (target || !page.map || !page.event) continue;
    visitPageCommands(page, (visit) => { if (!target && visit.command.kind === "setSwitch" && visit.command.switchId === MVP_REACHED_SWITCH && visit.command.value !== false) target = visit; });
  }
  if (!target) {
    problems.push(`끝 지점이 없다 — 핵심 경로 마지막 이벤트가 스위치 ${MVP_REACHED_SWITCH} 를 켜게 그 맵 담당에게 배정한다.`);
    const goal = (project.worldGraph?.nodes ?? []).map((node) => node.mapId).filter((id) => project.maps[id]).at(-1);
    if (goal) fixes.push({ mapId: goal, task: `이 맵이 첫 판의 목표 장소다. 끝 지점 스위치 ${MVP_REACHED_SWITCH} 를 켜는 이벤트가 없다 — 핵심 경로 마지막 이벤트(보스 승리 뒤·목표 대화 끝)에 upsert_event 로 {kind:"setSwitch", switchId:"${MVP_REACHED_SWITCH}", value:true} 를 넣는다. 그 이벤트는 세계 문에서 걸어 닿는 칸에 둔다.` });
  }
  else {
    try {
      const run = runSwitchPlay(project, "첫 판 끝 지점", target, MVP_REACHED_SWITCH, PLAY_BUDGET_MS);
      const detail = run.failure ? `${run.failure.goal}: ${run.failure.detail}` : "";
      if (!run.ok && !detail.includes(TIMED_OUT)) problems.push(`시작에서 끝 지점(${target.where.mapName ?? target.where.mapId})까지 걸어서 못 간다: ${detail.slice(0, 200)} — 막힌 길·조건을 고치게 배정한다.`);
    } catch (error) { problems.push(`끝 지점 자동 플레이 오류: ${error instanceof Error ? error.message : String(error)}`.slice(0, 200)); }
  }
  return { applied, problems, fixes };
}
