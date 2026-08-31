// ai/volumeContract.ts
//
// 중형 RPG / 마을 / 상태별 NPC 요청을 **코드가** 끝낼지 정한다.
// 모델이 "됐습니다" 하고 나가거나 planner:direct 로 하네스를 건너뛰면, 산출물 볼륨이
// 요청 최소치를 채울 때까지 Ralph 와 같은 재주입을 한다. 사용자 「계속」에 맡기지 않는다.
//
// 자연어 doneWhen 을 파싱하지 않는다 — 턴 시작 스냅샷 대비 프로젝트 델타만 본다.

import { requestLikelyModifiesExisting, stripContextFooter } from "./modifyIntent";
import { isUnauthoredMap } from "./workItemOutcome";
import { workPlanFromOrchestratorDecision, type WorkPlan } from "./workPlan";
import type { Command, GameEvent, Project } from "@/project/types";

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

export const MAX_VOLUME_CONTINUES_PER_TURN = 8;

const RPG_RE = /RPG|알피지|캠페인|시나리오|중형|어드벤처|\badventure\b|게임\s*을?\s*만들|게임을\s*만들|여러\s*맵|맵을\s*\d/iu;
const SETTLEMENT_RE = /마을|정착지|도시|\bvillage\b|\btown\b|\bcity\b|\bsettlement\b/iu;
const NPC_RE = /npc|주민|상인|촌장|퀘스트\s*주는/iu;
const SHOP_RE = /상점|가게|재고|\bshop\b|\bmerchant\b/iu;
const QUEST_RE = /퀘스트|의뢰|\bquest\b/iu;

export function requestNeedsVolumePlan(rawText: string): boolean {
  const text = stripContextFooter(rawText).trim();
  if (!text) return false;
  if (requestLikelyModifiesExisting(text) && !RPG_RE.test(text)) return false;
  return RPG_RE.test(text) || SETTLEMENT_RE.test(text);
}

export function volumeBarForRequest(rawText: string): VolumeBar | null {
  const text = stripContextFooter(rawText).trim();
  if (!text) return null;
  // 기존 산출물 수정은 그린필드 마을/RPG 막대를 씌우지 않는다 — "이 마을에 상인 추가"가
  // 맵 3장·NPC 6명을 요구하면 보수 요청이 신축 런이 된다. RPG 캠페인 요청만 예외.
  if (requestLikelyModifiesExisting(text) && !RPG_RE.test(text)) {
    if (NPC_RE.test(text) || SHOP_RE.test(text) || QUEST_RE.test(text)) {
      return {
        authoredMaps: 0,
        multiPageNpcs: NPC_RE.test(text) ? 1 : 0,
        shops: SHOP_RE.test(text) ? 1 : 0,
        quests: QUEST_RE.test(text) ? 1 : 0,
      };
    }
    return null;
  }
  if (RPG_RE.test(text)) {
    return { authoredMaps: 3, multiPageNpcs: 6, shops: 1, quests: 1 };
  }
  if (SETTLEMENT_RE.test(text)) {
    return { authoredMaps: 1, multiPageNpcs: 3, shops: 1, quests: QUEST_RE.test(text) ? 1 : 0 };
  }
  if (NPC_RE.test(text) || SHOP_RE.test(text) || QUEST_RE.test(text)) {
    return {
      authoredMaps: 0,
      multiPageNpcs: NPC_RE.test(text) ? 1 : 0,
      shops: SHOP_RE.test(text) ? 1 : 0,
      quests: QUEST_RE.test(text) ? 1 : 0,
    };
  }
  return null;
}

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

export function buildVolumeWorkPlan(goal: string, now = new Date()): WorkPlan {
  const bar = volumeBarForRequest(goal) ?? { authoredMaps: 1, multiPageNpcs: 3, shops: 1, quests: 0 };
  const items: Array<{
    title: string;
    instruction: string;
    doneWhen: string;
    successTools: readonly string[];
  }> = [
    {
      title: "허브 맵",
      instruction:
        "author_village 또는 fill_region+author_house+paint_road 로 허브 맵을 채운다. 빈 create_map 만 하고 끝내지 말 것.",
      doneWhen: "허브 맵에 지형·길이 있고 빈 잔디가 아니다",
      successTools: bar.authoredMaps > 0 ? ["author_village"] : ["fill_region"],
    },
    {
      title: "상태별 NPC",
      instruction:
        `find_events/get_event/get_story_state 로 기존 플래그를 본 뒤 place_npc 로 상태별 페이지 NPC를 최소 ${bar.multiPageNpcs}명 만든다. 한 줄 인사 금지.`,
      doneWhen: `조건이 다른 페이지를 가진 NPC ${bar.multiPageNpcs}명`,
      successTools: ["place_npc"],
    },
  ];
  if (bar.shops > 0) {
    items.push({
      title: "상점",
      instruction: "get_database_records 로 아이템 id 를 확인한 뒤 make_villager({shop}) 또는 set_shop_stock. 모든 활성 페이지에 shop 명령.",
      doneWhen: "플레이에서 열리는 상점 1곳",
      successTools: ["set_shop_stock"],
    });
  }
  if (bar.quests > 0) {
    items.push({
      title: "퀘스트",
      instruction: "define_quest 로 등록하고 verify_quest 로 완주 가능한지 확인한다. upsert_event 로 퀘스트를 손으로 조립하지 말 것.",
      doneWhen: "verify_quest 통과 퀘스트 1개",
      successTools: ["define_quest", "verify_quest"],
    });
  }
  return workPlanFromOrchestratorDecision(
    {
      action: "new_plan",
      goal: goal.slice(0, 400),
      plannerNote: "volume-contract (code-forced; planner direct rejected)",
      layers: [{ title: "볼륨", items }],
    },
    now,
  );
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
): { ok: true } | { ok: false; reason: string } {
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
      `한 줄 인사는 완료가 아닙니다.`,
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
    } else if (command.kind === "fork") {
      if (commandsHaveShop(command.then) || commandsHaveShop(command.else)) return true;
    } else if (command.kind === "loop") {
      if (commandsHaveShop(command.body)) return true;
    }
  }
  return false;
}
