// 연애 엔딩 분기 검사(2026-10-16 romance-fix-4 R01). 「엔딩 1개 · 호감과 무관」 을 데이터로 짚고, 호감 문턱으로 갈리는 엔딩이
// 실제로 각각 열릴 수 있는지 모의한다. 런타임을 돌리지 않는 순수 검사다(느린 자동 플레이는 deadline.ts·autoPlay.ts 가 따로 한다).
//
// 모의: 엔딩이 이름 없는 triggerEnding(조건·priority 로 고르기)으로 열리는 경우, 호감 상태 몇 가지(아무도 / 한 사람이 문턱만큼 / 모두 문턱만큼)에서
// 조건을 만족한 엔딩 중 priority 가 가장 높은 것을 고른다. 어떤 상태에서도 못 이기는 엔딩은 가려진 것이다.
// 이름으로 부르는 호출(기한 엔딩의 fork)이 있는 엔딩은 이 모의로 판정하지 않는다 — 그 길은 fork 조건이 정한다.
import { affectionVariableOwners } from "@/project/affectionVariables";
import { isTalkFriendshipEnabled } from "@/project/friendship";
import { ANY_FRIENDSHIP_KEY, clampFriendship, friendshipValueOf } from "@/project/session";
import { resolveSocialKey } from "@/project/socialKey";
import type { EndingCondition, EndingDef, Project } from "@/project/types";
import type { Finding } from "./types";
import { conditionLeaves, visitAllCommands } from "./walk";

type FriendshipLeaf = { readonly npcKey: string; readonly value: number };

function friendshipLeaves(condition: EndingCondition): FriendshipLeaf[] {
  return conditionLeaves(condition).flatMap((leaf) => leaf.kind === "friendshipAtLeast" && typeof leaf.value === "number"
    ? [{ npcKey: typeof leaf.npcKey === "string" && leaf.npcKey.trim() ? leaf.npcKey.trim() : ANY_FRIENDSHIP_KEY, value: leaf.value }]
    : []);
}

export function isFriendshipGatedEnding(ending: EndingDef): boolean {
  return ending.conditions.some((condition) => friendshipLeaves(condition).length > 0);
}

/** 호감 상태에서 이 엔딩의 호감 조건이 모두 맞는가(호감 아닌 조건은 맞는 것으로 가정 — 스위치·변수는 플레이가 채운다). */
function metAt(ending: EndingDef, friendship: Record<string, number>): boolean {
  return ending.conditions.every((condition) => friendshipLeaves(condition).every((leaf) => friendshipValueOf(friendship, leaf.npcKey) >= clampFriendship(leaf.value)));
}

export interface EndingCallSites {
  /** 이름 없는 triggerEnding 이 하나라도 있는가(조건 선택형). */
  readonly bare: boolean;
  /** 이름으로 부르는 엔딩 id. */
  readonly named: ReadonlySet<string>;
  /** 호감 fork 안(then/else)에서 부르는 엔딩 id — 기한 엔딩 같은 호감 갈림 호출. */
  readonly friendshipForked: ReadonlySet<string>;
}

export function endingCallSites(project: Project): EndingCallSites {
  let bare = false;
  const named = new Set<string>();
  const friendshipForked = new Set<string>();
  visitAllCommands(project, (visit) => {
    if (visit.command.kind !== "triggerEnding") return;
    const id = typeof visit.command.endingId === "string" && visit.command.endingId ? visit.command.endingId : undefined;
    if (!id) { bare = true; return; }
    named.add(id);
    const underFriendshipFork = visit.segments.some((segment) => segment.kind === "fork"
      && conditionLeaves(segment.command.condition).some((leaf) => leaf.kind === "friendshipAtLeast"));
    if (underFriendshipFork) friendshipForked.add(id);
  });
  return { bare, named, friendshipForked };
}

/** 호감으로 갈리는 서로 다른 엔딩 수 — 엔딩 자체의 호감 조건 + 호감 fork 로 부르는 엔딩 + 호감 문턱 없는 기본 결말 하나. */
export function friendshipBranchCount(project: Project, sites: EndingCallSites = endingCallSites(project)): number {
  const endings = project.endings ?? [];
  const gated = endings.filter(isFriendshipGatedEnding).map((ending) => ending.id);
  const ids = new Set<string>([...gated, ...sites.friendshipForked]);
  // 기본 결말 — 이름 없는 호출이 있으면 조건 없는 엔딩이 기본이고, 호감 fork 의 else 끝도 이미 friendshipForked 에 들어 있다.
  if (sites.bare && gated.length > 0) {
    const fallback = endings.find((ending) => !isFriendshipGatedEnding(ending) && ending.conditions.length === 0);
    if (fallback) ids.add(fallback.id);
  }
  return ids.size;
}

/** 이름 없는 triggerEnding 으로 열리는 엔딩 중 어떤 호감 상태에서도 못 이기는 것(가려진 것). */
export function shadowedBareEndings(project: Project, sites: EndingCallSites = endingCallSites(project)): EndingDef[] {
  if (!sites.bare) return [];
  const endings = project.endings ?? [];
  const keys = new Set<string>();
  const thresholds = new Set<number>([0]);
  for (const ending of endings) for (const condition of ending.conditions) for (const leaf of friendshipLeaves(condition)) {
    if (leaf.npcKey !== ANY_FRIENDSHIP_KEY) keys.add(leaf.npcKey);
    thresholds.add(clampFriendship(leaf.value));
  }
  const people = keys.size ? [...keys] : ["__someone"];
  const states: Record<string, number>[] = [];
  for (const value of thresholds) {
    for (const key of people) states.push({ [key]: value });
    states.push(Object.fromEntries(people.map((key) => [key, value])));
  }
  const wins = new Set<string>();
  for (const state of states) {
    const winner = endings.filter((ending) => metAt(ending, state)).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
    if (winner) wins.add(winner.id);
  }
  return endings.filter((ending) => !wins.has(ending.id) && !sites.named.has(ending.id));
}

export function checkRomanceEndings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const sites = endingCallSites(project);
  const branches = friendshipBranchCount(project, sites);
  if (branches < 3) {
    findings.push({
      severity: "warning", code: "romance-endings-unbranched",
      message: `호감으로 갈리는 엔딩이 ${branches}개뿐입니다(해피·평범·혼자처럼 최소 3개 필요) — 연애 게임인데 누적 호감이 결말을 가르지 않습니다. `
        + "set_deadline_ending(tiers 생략하면 해피≥60·평범≥25·혼자) 로 기한 결말을 걸거나, define_ending 에 friendshipAtLeast 조건과 priority 를 달고 구간 끝 이벤트는 endingId 없는 triggerEnding 으로 부르세요.",
    });
  }
  const shadowed = shadowedBareEndings(project, sites);
  if (shadowed.length > 0) {
    findings.push({
      severity: "warning", code: "romance-ending-shadowed",
      message: `엔딩 ${shadowed.map((ending) => `「${ending.name}」(${ending.id})`).join(", ")} 은(는) 어떤 호감 상태에서도 열리지 않습니다 — 더 높은 priority 엔딩이 조건이 약해 항상 먼저 열립니다. 문턱이 높은 엔딩일수록 priority 를 높이세요.`,
    });
  }
  return findings;
}

/** 엔딩 조건·기한 판정 fork 가 이름으로 겨눈 인물 키(「*」 제외). */
export function endingFriendshipKeys(project: Project): Set<string> {
  const keys = new Set<string>();
  for (const ending of project.endings ?? []) for (const condition of ending.conditions) for (const leaf of friendshipLeaves(condition)) if (leaf.npcKey !== ANY_FRIENDSHIP_KEY) keys.add(leaf.npcKey);
  visitAllCommands(project, (visit) => {
    if (visit.command.kind !== "fork") return;
    for (const leaf of conditionLeaves(visit.command.condition)) {
      if (leaf.kind === "friendshipAtLeast" && typeof leaf.npcKey === "string" && leaf.npcKey.trim() && leaf.npcKey.trim() !== ANY_FRIENDSHIP_KEY) keys.add(leaf.npcKey.trim());
    }
  });
  return keys;
}

/** 호감 대화 인물(서로 다른 이름) 둘 이상인데 어느 엔딩도 특정 인물을 겨누지 않는가 — 히로인별 결말이 없다. */
export function checkPerHeroineEndings(project: Project, heroineNames: readonly string[]): Finding[] {
  if (heroineNames.length < 2) return [];
  if (endingFriendshipKeys(project).size > 0) return [];
  return [{
    severity: "warning", code: "romance-endings-not-per-heroine",
    message: `호감 대화 인물이 ${heroineNames.length}명(${heroineNames.slice(0, 4).join(", ")})인데 어느 엔딩도 특정 인물의 호감을 보지 않습니다 — 누구와 가까워졌는지와 무관하게 같은 결말입니다. `
      + "인물마다 define_ending(예: 「OO와 함께」)을 만들고 set_deadline_ending 의 tiers 에 {endingId, friendshipAtLeast, characterId} 로 인물 항목을 얹으세요(맨 끝은 혼자·평범 기본 결말).",
  }];
}

/** 호감을 실제로 올릴 수 있는 인물 키 — 호감 대화(talkFriendship) 인물 · changeFriendship 대상 · 「인물 호감」 변수 주인. */
function friendshipWriterKeys(project: Project): Set<string> {
  const keys = new Set<string>();
  for (const map of Object.values(project.maps)) for (const event of map.events) {
    if (!isTalkFriendshipEnabled(event)) continue;
    const key = resolveSocialKey(event);
    if (key) keys.add(key);
  }
  visitAllCommands(project, (visit) => {
    if (visit.command.kind !== "changeFriendship") return;
    const explicit = typeof visit.command.npcKey === "string" ? visit.command.npcKey.trim() : "";
    const key = explicit || (visit.page.event ? resolveSocialKey(visit.page.event) : null);
    if (key) keys.add(key);
  });
  for (const key of affectionVariableOwners(project).values()) keys.add(key);
  return keys;
}

/** 엔딩·기한 판정이 겨눈 인물 키 중 어디서도 호감이 오르지 않는 것 — 그 인물 엔딩은 영영 못 본다(romance-loop-2 rom-b: 하루·유우 엔딩은 선택지가 스위치만 켜서 호감 0). */
export function checkEndingNpcReachable(project: Project): Finding[] {
  const targeted = endingFriendshipKeys(project);
  if (targeted.size === 0) return [];
  const writers = friendshipWriterKeys(project);
  const dead = [...targeted].filter((key) => !writers.has(key));
  if (dead.length === 0) return [];
  return [{
    severity: "warning", code: "romance-ending-npc-unreachable",
    message: `엔딩이 호감을 보는 인물 ${dead.slice(0, 5).map((key) => `「${key}」`).join(", ")} 은(는) 호감이 오르는 곳이 없습니다(호감 대화 인물·changeFriendship·「인물 호감」 변수 어디에도 없음) — 그 인물 엔딩은 열리지 않습니다. `
      + "그 인물 이벤트에 talkFriendship 을 켜거나 선택지에 changeFriendship(npcKey=그 characterId) 를 넣고, 엔딩 조건의 characterId 가 이벤트 characterId 와 같은지 확인하세요.",
  }];
}

function deadlineChainEndingIds(project: Project): string[] | undefined {
  const hook = project.system?.timeSystem?.onDayEnd;
  const common = hook ? (project.commonEvents ?? []).find((entry) => entry.id === hook) : undefined;
  if (!common) return undefined;
  const ids: string[] = [];
  const walk = (commands: readonly unknown[] | undefined): void => {
    for (const command of (commands ?? []) as { kind?: string; endingId?: string; then?: unknown[]; else?: unknown[] }[]) {
      if (command.kind === "triggerEnding" && command.endingId) ids.push(command.endingId);
      if (command.kind === "fork") { walk(command.then); walk(command.else); }
    }
  };
  walk(common.commands);
  return ids;
}

/** 특정 인물의 호감을 보는 엔딩이 둘 이상 있는데 기한 판정이 그 엔딩을 하나도 부르지 않는 경우 — 인물 엔딩이 있어도 기한에는 모두 같은 「해피」로 끝난다(romance-loop-3 rom-c: 병합 뒤 기한 판정에 인물 엔딩이 안 얹혔다). */
export function checkHeroineEndingsCalled(project: Project): Finding[] {
  const heroineEndings = (project.endings ?? []).filter((ending) => ending.conditions.some((condition) => friendshipLeaves(condition).some((leaf) => leaf.npcKey !== ANY_FRIENDSHIP_KEY)));
  if (heroineEndings.length < 2) return [];
  const called = deadlineChainEndingIds(project);
  if (called === undefined || called.length === 0) return [];
  const uncalled = heroineEndings.filter((ending) => !called.includes(ending.id));
  if (uncalled.length < 2 || uncalled.length < heroineEndings.length) return [];
  return [{
    severity: "warning", code: "romance-heroine-endings-uncalled",
    message: `인물 엔딩 ${uncalled.slice(0, 4).map((ending) => `「${ending.name}」(${ending.id})`).join(", ")} 이(가) 있는데 기한 판정(${project.system?.timeSystem?.onDayEnd})이 하나도 부르지 않습니다 — 기한이 와도 모두 같은 결말입니다. `
      + "set_deadline_ending 을 tiers 없이 한 번 부르면 인물 엔딩이 기한 판정 맨 위에 얹힙니다(또는 tiers 에 {endingId, friendshipAtLeast, characterId} 로 직접).",
  }];
}
