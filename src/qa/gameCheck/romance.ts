// 연애(관계) 게임 부합 검사 — 「막힘 0 · 엔딩 도달」 만으로는 못 잡는 구멍을 데이터로 짚는다.
//
// 오프라인 QA 도구다(조수 경로의 게이트가 아니다). 전부 경고다.
// 2026-10-16 실제 Argon(8318) 연애 시험에서 qa:game check 가 「막힘 0 · 경고 0」 으로 통과시킨 것들:
//  - 뼈대가 깐 「기억의 조각 / 기억의 길 / 구간 끝 / 첫 구간 끝」 자리표시를 그대로 둔 채 끝(연애와 무관한 맵·엔딩이 통과)
//  - 호감이 쌓이는 인물도, 인물 엔딩도 없이 뼈대 엔딩 하나만 닿음
//  - 인물 NPC 가 전부 투명 이벤트(화면에 아무도 안 보임) · 서로 다른 인물이 같은 칩
//  - 대사 본문 앞에 「[이름]」 이 또 붙은 줄

import { affectionVariableOwners, unmappedAffectionVariables } from "@/project/affectionVariables";
import { isTalkFriendshipEnabled } from "@/project/friendship";
import { ROMANCE_PLACEHOLDER_NAMES, SEGMENT_END_ENDING_ID, SEGMENT_END_EVENT_ID, SEGMENT_ROUTE_MAP_ID, SEGMENT_STARTER_EVENT_ID } from "@/project/playableSegmentContract";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { briefTextOf } from "./brief";
import type { Finding } from "./types";
import { checkPerHeroineEndings, checkRomanceEndings } from "./romanceEndings";
import { allPages, visitPageCommands } from "./walk";

const ROMANCE_BRIEF = /연애|로맨스|호감|고백|romance|dating/iu;
/** 뼈대가 깔아 두는 자리표시 이름 — 기획에 맞게 바꿨어야 하는 것들. */
const PLACEHOLDER_NAMES = new Set<string>(["기억의 길", "기억의 조각", "구간 끝", "첫 구간 끝", ...ROMANCE_PLACEHOLDER_NAMES.slice(1)]); // 첫 이름(길 맵 「산책로」)은 그대로 써도 어색하지 않아 자리표시로 치지 않는다
/** 빈 프로젝트·인터뷰 시작이 남기는 기본 제목 — 연애 게임은 이 게임의 이름을 가져야 한다. */
const PLACEHOLDER_TITLES = new Set(["", "새 게임", "새 프로젝트"]);
const AFFECTION_VARIABLE = /호감|friendship|affection|favou?r/iu;

/** 연애 프로젝트인가 — 호감 하트 HUD(연애 기본값)·인터뷰 장르·기획 문장 중 하나. */
export function isRomanceCheckTarget(project: Project, briefText = briefTextOf(project)): boolean {
  if (project.gameDesignBrief?.interview?.genre === "romance") return true;
  if (project.system?.fieldHud?.theme === "hearts") return true;
  return ROMANCE_BRIEF.test(briefText);
}

function chipOf(page: EventPage): string | undefined {
  const g = page.graphic as { sprite?: { type?: string; id?: string }; characterResourceId?: string; appearanceId?: string; pattern?: number; direction?: string } | undefined;
  if (!g) return undefined;
  if (g.appearanceId) return `appearance:${g.appearanceId}`;
  if (g.characterResourceId) return `character:${g.characterResourceId}`;
  if (g.sprite?.id) return `sprite:${g.sprite.type ?? ""}:${g.sprite.id}:${g.pattern ?? 0}`;
  return undefined;
}

/** 한 사람을 가리키는 키 — 이름(「한서연 선배」)을 우선하고, 이름이 없으면 characterId·이벤트 id. 맵마다 characterId 에 _2 를 붙여도 같은 이름이면 한 사람이다. */
function personKey(event: GameEvent): string {
  const name = event.name?.trim();
  return name || event.characterId?.trim() || event.id;
}

function isPersonEvent(event: GameEvent): boolean {
  return Boolean(event.characterId?.trim()) || /^(ev_)?npc[_-]/u.test(event.id);
}

export function checkRomance(project: Project, briefText = briefTextOf(project)): Finding[] {
  if (!isRomanceCheckTarget(project, briefText)) return [];
  const findings: Finding[] = [];
  const maps = Object.values(project.maps);

  // 1) 뼈대 자리표시가 그대로 남았나.
  const leftovers: string[] = [];
  const routeMap = project.maps[SEGMENT_ROUTE_MAP_ID];
  if (routeMap && PLACEHOLDER_NAMES.has(routeMap.name)) leftovers.push(`맵 「${routeMap.name}」(${SEGMENT_ROUTE_MAP_ID})`);
  for (const map of maps) for (const event of map.events) {
    const placeholderEvent = event.id === SEGMENT_STARTER_EVENT_ID || event.id === SEGMENT_END_EVENT_ID;
    if (placeholderEvent && event.name && PLACEHOLDER_NAMES.has(event.name)) leftovers.push(`이벤트 「${event.name}」(${map.name})`);
  }
  const skeletonEnding = (project.endings ?? []).find((ending) => ending.id === SEGMENT_END_ENDING_ID);
  if (skeletonEnding && PLACEHOLDER_NAMES.has(skeletonEnding.name)) leftovers.push(`엔딩 「${skeletonEnding.name}」`);
  if (leftovers.length > 0) {
    findings.push({
      severity: "warning", code: "romance-skeleton-leftover",
      message: `연애 게임인데 첫 구간 뼈대의 자리표시가 그대로 남았습니다: ${leftovers.join(" · ")} — 이름·대사를 이 게임에 맞게 바꾸거나 쓰지 않을 거면 지우세요(뼈대 이벤트 id·연결은 유지).`,
    });
  }

  if (PLACEHOLDER_TITLES.has((project.meta?.title ?? "").trim()) || PLACEHOLDER_TITLES.has((project.system?.titleScreen?.title ?? "").trim())) {
    findings.push({
      severity: "warning", code: "romance-default-title",
      message: `게임 제목이 기본값 「${(project.system?.titleScreen?.title || project.meta?.title || "").trim() || "(비어 있음)"}」 그대로입니다 — set_title_screen {title} 로 이 게임의 이름을 정하세요(타이틀 화면에 그대로 나옵니다).`,
    });
  }

  // 2) 호감이 쌓이는 인물 · 인물 엔딩.
  const people: { readonly map: GameMap; readonly event: GameEvent }[] = [];
  for (const map of maps) for (const event of map.events) if (isPersonEvent(event)) people.push({ map, event });
  const friendly = people.filter(({ event }) => isTalkFriendshipEnabled(event));
  const hasAffectionVariable = (project.variables ?? []).some((variable) => AFFECTION_VARIABLE.test(variable.name ?? ""));
  const touchesRelationship = allPages(project).some((page) => {
    let hit = false;
    visitPageCommands(page, (visit) => { if (visit.command.kind === "changeFriendship" || visit.command.kind === "talkFriendship") hit = true; });
    return hit;
  });
  findings.push(...checkPerHeroineEndings(project, [...new Set(friendly.map(({ event }) => personKey(event)))]));
  if (friendly.length === 0 && !hasAffectionVariable && !touchesRelationship) {
    findings.push({
      severity: "warning", code: "romance-no-relationship",
      message: "연애 게임인데 호감이 쌓이는 인물(talkFriendship)도 호감 변수·호감 변경 명령도 없습니다 — 관계가 어떻게 변하는지 플레이어가 느낄 수 없습니다.",
    });
  }
  // 호감을 「호감 변수」 로 올리는 저작: 이름이 「인물 호감」 모양이면 런타임이 같은 인물 friendship 에 변화량을 더해 ESC·HUD·엔딩에 보인다.
  // 인물을 못 정한 호감 변수는 ESC·HUD 에 안 나오니 완료 조건이다(romance-real-2 R02).
  const usedVariables = new Set<string>();
  for (const page of allPages(project)) visitPageCommands(page, (visit) => { if (visit.command.kind === "setVariable" && typeof visit.command.variableId === "string") usedVariables.add(visit.command.variableId); });
  const unmapped = unmappedAffectionVariables(project).filter((variable) => usedVariables.has(variable.id));
  if (unmapped.length > 0) {
    findings.push({
      severity: "warning", code: "romance-affection-variable-unmapped",
      message: `호감 변수 ${unmapped.slice(0, 4).map((variable) => `「${variable.name}」(${variable.id})`).join(", ")} 이(가) 어느 인물의 호감인지 알 수 없어 ESC 관계 화면·호감 HUD·호감 엔딩에 나오지 않습니다 — changeFriendship(npcKey=인물 characterId, delta) 로 바꾸거나 변수 이름을 「인물 이름 호감도」 로 정하세요.`,
    });
  } else if (usedVariables.size > 0 && affectionVariableOwners(project).size > 0 && ![...affectionVariableOwners(project).keys()].every((id) => !usedVariables.has(id))) {
    findings.push({
      severity: "info", code: "romance-affection-variable-compat",
      message: "호감을 변수(setVariable)로 올리는 곳이 있습니다 — 읽기 호환으로 ESC·HUD·엔딩에는 반영되지만, 새 저작은 changeFriendship 을 쓰세요.",
    });
  }
  const endings = project.endings ?? [];
  findings.push(...checkRomanceEndings(project));
  if (endings.length > 0 && endings.every((ending) => ending.id === SEGMENT_END_ENDING_ID)) {
    findings.push({
      severity: "warning", code: "romance-only-skeleton-ending",
      message: "엔딩이 뼈대의 자리표시 엔딩(ending_first_segment) 하나뿐입니다 — 연애 게임인데 관계에 따른 엔딩(고백 성공·실패·혼자)이 없습니다.",
    });
  }

  // 3) 인물이 화면에 보이나 · 서로 다른 인물이 같은 칩인가.
  const invisible = people.filter(({ event }) => !(event.pages ?? []).some((page) => page.graphic?.transparent !== true && chipOf(page) !== undefined));
  if (invisible.length > 0) {
    const names = invisible.slice(0, 6).map(({ event }) => event.name ?? event.id).join(", ");
    findings.push({
      severity: "warning", code: "romance-npc-invisible",
      message: `인물 ${invisible.length}/${people.length}명이 그림 없는 투명 이벤트입니다(${names}${invisible.length > 6 ? " …" : ""}) — 화면에는 아무도 보이지 않습니다.`,
    });
  }
  // 같은 인물이 맵마다 같은 모습으로 서는 것은 일관성이다(characterId 가 맵마다 달라도 같은 이름이면 한 사람) — 서로 다른 사람이 한 칩일 때만 중복이다.
  const byChip = new Map<string, Set<string>>();
  for (const { event } of people) {
    const chip = (event.pages ?? []).map(chipOf).find((c): c is string => c !== undefined);
    if (!chip) continue;
    const who = personKey(event);
    byChip.set(chip, (byChip.get(chip) ?? new Set()).add(who));
  }
  for (const [chip, who] of byChip) {
    if (who.size < 2) continue;
    findings.push({
      severity: "warning", code: "romance-npc-duplicate-chip",
      message: `서로 다른 인물 ${who.size}명(${[...who].slice(0, 5).join(", ")})이 같은 캐릭터 칩(${chip})입니다 — 화면에서 구분되지 않습니다. list_npc_graphics 에서 인물마다 다른 칩을 고르세요.`,
    });
  }

  // 4) 대사 본문 앞에 화자 표기가 또 붙은 줄(「[이름]」 이중 표기·바깥 따옴표).
  let doubled = 0;
  let example = "";
  for (const page of allPages(project)) visitPageCommands(page, (visit) => {
    const command = visit.command;
    if (command.kind !== "text" || typeof command.body !== "string") return;
    if (/^\s*["“]?\s*\[[^\]\n]{1,20}\]\s*\n/u.test(command.body)) { doubled += 1; if (!example) example = command.body.slice(0, 30).replace(/\n/gu, "↵"); }
  });
  if (doubled > 0) {
    findings.push({
      severity: "warning", code: "romance-speaker-in-body",
      message: `대사 ${doubled}줄의 본문이 「[이름]」 으로 시작합니다(예: ${example}) — 화자는 speaker 칸에 있으니 본문에서 빼세요. 대사창에 이름이 두 번 보입니다.`,
    });
  }
  return findings;
}

/** 「끝낸 것으로 칠 수 없는」 연애 게임의 빈칸 — 팀의 finish 가 이것을 막는다(scripts/lib/piTeamRuntime.ts). 경고 코드 중 이 목록만 완료 조건이다. */
const COMPLETION_CODES = new Set(["romance-skeleton-leftover", "romance-only-skeleton-ending", "romance-default-title", "romance-endings-unbranched", "romance-ending-shadowed", "romance-affection-variable-unmapped", "romance-endings-not-per-heroine"]);
export function romanceCompletionGaps(project: Project): string[] {
  if (project.gameDesignBrief?.interview?.genre !== "romance") return [];
  return checkRomance(project).filter((finding) => COMPLETION_CODES.has(finding.code)).map((finding) => finding.message);
}
