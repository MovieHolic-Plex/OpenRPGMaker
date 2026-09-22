// ai/volumeContract.ts
//
// 볼륨 계약 — 플래너가 계획과 함께 선언한 최소 산출량(맵·상태별 NPC·상점·퀘스트)을 **코드가 측정**한다.
// 모델이 "됐습니다" 하고 나가면 막대가 찰 때까지 Ralph 와 같은 재주입을 한다. 사용자 「계속」에 맡기지 않는다.
//
// 막대를 세우는 쪽은 플래너다(workPlan.PlannerVolumeBar). 예전에는 「마을|RPG」 정규식이 문장에서 막대를
// 만들고 플래너의 direct 판정까지 거부했다 — 「이 마을에 상인 하나 추가해줘」가 맵 3장·NPC 6명이 됐고,
// 「마을은 만들지 말고 여관만」의 부정을 읽지 못했다(2026-09-03 실측). 그 경로는 없다.
// 자연어 doneWhen 을 파싱하지 않는다 — 턴 시작 스냅샷 대비 프로젝트 델타만 본다.

import { isUnauthoredMap } from "./workItemOutcome";
import type { Command, GameEvent, Project } from "@/project/types";
import { presentItemBranchLists } from "@/project/eventCommands/presentItemBranches";

export interface VolumeSnapshot {
  readonly authoredMaps: number;
  readonly multiPageNpcs: number;
  readonly shops: number;
  readonly quests: number;
}

export interface VolumeBar {
  readonly authoredMaps: number;
  readonly multiPageNpcs: number;
  readonly shops: number;
  readonly quests: number;
}

/**
 * 한 턴 에서 볼륨 미달로 재주입하는 횟수 (2026-09-03: 8 → 3).
 *
 * 드라이버가 턴을 다시 여는 상한(`AGENT_RUN_MAX_TOTAL_STEPS` 48)이 따로 있으므로 볼륨 압박은
 * 런 전체로는 그대로 유지된다. 한 턴 안에서 8번을 다 쓰면 사용자는 그만큼 오래 아무 보고도
 * 못 받고 기다린다 — 짧은 턴을 여러 번 돈는 편이 할 일 목록이 갱신되는 지점을 더 자주 만들고
 * 사용자 중단에도 더 발리 닿는다.
 */
export const MAX_VOLUME_CONTINUES_PER_TURN = 3;

export function measureVolume(project: Project): VolumeSnapshot {
  let authoredMaps = 0;
  let multiPageNpcs = 0;
  let shops = 0;
  for (const map of Object.values(project.maps)) {
    if (!isUnauthoredMap(map)) authoredMaps += 1;
    for (const event of map.events) {
      if (isMultiPageNpc(event)) multiPageNpcs += 1;
      if (eventHasShop(event)) shops += 1;
    }
  }
  return {
    authoredMaps,
    multiPageNpcs,
    shops,
    quests: project.quests?.length ?? 0,
  };
}

export function volumeGaps(before: VolumeSnapshot, after: VolumeSnapshot, bar: VolumeBar): string[] {
  const gaps: string[] = [];
  const gained = (key: keyof VolumeSnapshot) => after[key] - before[key];
  if (gained("authoredMaps") < bar.authoredMaps) {
    gaps.push(`채워진 맵 +${gained("authoredMaps")} (최소 +${bar.authoredMaps})`);
  }
  if (gained("multiPageNpcs") < bar.multiPageNpcs) {
    gaps.push(`상태별 다중 페이지 NPC +${gained("multiPageNpcs")} (최소 +${bar.multiPageNpcs})`);
  }
  if (gained("shops") < bar.shops) {
    gaps.push(`상점 +${gained("shops")} (최소 +${bar.shops})`);
  }
  if (gained("quests") < bar.quests) {
    gaps.push(`퀘스트 +${gained("quests")} (최소 +${bar.quests})`);
  }
  return gaps;
}

export function volumeUnmet(before: VolumeSnapshot, after: VolumeSnapshot, bar: VolumeBar): boolean {
  return volumeGaps(before, after, bar).length > 0;
}

export function formatVolumeContinueMessage(gaps: readonly string[]): string {
  return [
    "HARNESS CONTINUE: you attempted to stop, but the volume contract is unmet.",
    "Do not write a farewell. Call write tools now. Do not ask the user to continue.",
    `Missing: ${gaps.join("; ")}.`,
    "NPC pages must be state variants (distinct conditions), not one-line greetings.",
    "Shops need set_shop_stock (or make_villager shop) on every live page.",
    "Quests need define_quest then verify_quest.",
  ].join("\n");
}

export const NPC_PLACING_TOOLS: ReadonlySet<string> = new Set(["place_npc", "make_villager"]);

export function placedNpcIdFrom(name: string, data: unknown, args?: Record<string, unknown>): string | null {
  if (!NPC_PLACING_TOOLS.has(name)) return null;
  const fromData =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>).eventId : undefined;
  for (const candidate of [fromData, args?.eventId, args?.id]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export function verifyPlacedNpcsHaveStatePages(
  project: Project,
  eventIds: Iterable<string>,
  explicitlyStateful = false,
): { ok: true } | { ok: false; reason: string } {
  if (!explicitlyStateful) return { ok: true };
  const ids = [...new Set([...eventIds].filter((id) => id.trim().length > 0))];
  if (ids.length === 0) return { ok: true };
  const thin: string[] = [];
  for (const eventId of ids) {
    const event = findEvent(project, eventId);
    if (!event || !isMultiPageNpc(event)) thin.push(eventId);
  }
  if (thin.length === 0) return { ok: true };
  return {
    ok: false,
    reason:
      `산출물 미완성: NPC ${thin.join(", ")} 가 상태별 다중 페이지가 아닙니다 — ` +
      `조건이 다른 페이지(selfSwitch/switch/timePhase/friendshipAtLeast 등)를 넣은 뒤 완료하세요. ` +
      `요청된 상태별 행동을 구현해야 합니다.`,
  };
}

function findEvent(project: Project, eventId: string): GameEvent | undefined {
  for (const map of Object.values(project.maps)) {
    const event = map.events.find((entry) => entry.id === eventId);
    if (event) return event;
  }
  return undefined;
}

function isMultiPageNpc(event: GameEvent): boolean {
  const pages = event.pages ?? [];
  if (pages.length < 2) return false;
  const signatures = new Set(pages.map((page) => JSON.stringify(page.conditions ?? [])));
  return signatures.size >= 2;
}

function eventHasShop(event: GameEvent): boolean {
  for (const page of event.pages ?? []) {
    if (commandsHaveShop(page.commands)) return true;
  }
  return commandsHaveShop(event.commands);
}

function commandsHaveShop(commands: readonly Command[] | undefined): boolean {
  for (const command of commands ?? []) {
    if (command.kind === "shop") return true;
    if (command.kind === "choices") {
      for (const option of command.options) {
        if (commandsHaveShop(option.branch)) return true;
      }
      if (commandsHaveShop(command.cancelBranch)) return true;
    } else if (command.kind === "presentItem") {
      if (presentItemBranchLists(command).some((branch) => commandsHaveShop(branch))) return true;
    } else if (command.kind === "fork") {
      if (commandsHaveShop(command.then) || commandsHaveShop(command.else)) return true;
    } else if (command.kind === "loop") {
      if (commandsHaveShop(command.body)) return true;
    }
  }
  return false;
}
