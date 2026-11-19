// editor/tools/genreDeviceTools.ts
// JRPG 가 아닌 게임이 되풀이해 쓰는 장치 넷을 한 호출로 짓는다: 호감(말 걸기·선물·문턱 대사·고백), 가진 물건 내밀기, 제한 시간, 화면의 수치 게이지.
// 왜(2026-11-11 셋째 묶음 Terra 기준선): 넷 다 이벤트 명령을 손으로 조립해야 했다 — 선물 36호출 · 고백 32 · 내밀기 27. 런타임은 이미 있다
// (changeFriendship · friendshipAtLeast · presentItem · timer · fieldHud 변수 위젯). 여기는 그 조립만 맡는다: 있던 대사는 그대로 두고 앞·뒤에 끼운다.
// 고리 설계(openwiki/assistant-v2-genre-tools.md)의 raise · deduce · survive 빌더가 같은 함수를 부른다.

import type { Command, Condition, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { HUD_ANCHORS, HUD_SHAPES, HUD_WIDGET_LIMIT, effectiveFieldHud, normalizeFieldHud, normalizeHudWidget, resolvedHudWidgets } from "@/project/fieldHud";
import { assertEventShape, upsertEventIntoMap } from "./eventTools";
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { requireMap } from "./mapHelpers";
import { FIXED_MOVEMENT } from "./puzzleKit";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const str = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const int = (value: unknown, fallback: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback));
const lines = (value: unknown): string[] =>
  (Array.isArray(value) ? value : typeof value === "string" ? [value] : []).filter((line): line is string => typeof line === "string" && line.trim().length > 0).map((line) => line.trim());
const fail = (message: string, code: string): never => { throw new ToolError(message, { code }); };

/** 이 도구가 끼운 토막의 앞뒤 표시 — 다시 부르면 그 사이만 갈아 끼운다(있던 대사는 건드리지 않는다). label 은 런타임에서 아무 일도 하지 않는다. */
const mark = (device: string, edge: "begin" | "end"): Command => ({ kind: "label", name: `${device}:${edge}` });
const isMark = (command: Command, device: string, edge: "begin" | "end"): boolean => command.kind === "label" && command.name === `${device}:${edge}`;
/** 페이지 명령에서 그 장치의 옛 토막을 걷어 낸 나머지. */
function withoutBlock(commands: readonly Command[], device: string): Command[] {
  const from = commands.findIndex((command) => isMark(command, device, "begin"));
  const to = commands.findIndex((command) => isMark(command, device, "end"));
  return from >= 0 && to > from ? [...commands.slice(0, from), ...commands.slice(to + 1)] : [...commands];
}

/** 고칠 페이지들 — pageIndex 를 적으면 그 하나, 안 적으면 말을 걸어 도는 페이지 전부(진행에 따라 페이지가 바뀌는 사람도 «말을 걸 때마다» 같아야 한다). */
function eventPages(draft: Project, args: Record<string, unknown>): { map: GameMap; event: GameEvent; pages: EventPage[] } {
  const map = requireMap(draft, String(args.mapId ?? ""));
  const eventId = String(args.eventId ?? "");
  const event = map.events.find((entry) => entry.id === eventId)
    ?? fail(`No event '${eventId}' on map ${map.id} — get the id from find_events. Events here: ${map.events.slice(0, 10).map((entry) => `${entry.id}(${entry.name})`).join(", ") || "none"}.`, "event-not-found");
  const all = event.pages ?? [];
  if (!all.length) fail(`Event '${eventId}' has no pages. Write its pages with upsert_event first.`, "invalid-args");
  if (typeof args.pageIndex === "number") {
    const page = all[Math.trunc(args.pageIndex)] ?? fail(`Event '${eventId}' has ${all.length} page(s); pageIndex ${args.pageIndex} does not exist.`, "invalid-args");
    return { map, event, pages: [page] };
  }
  const talk = all.filter((page) => (page.trigger?.kind ?? "action") === "action");
  return { map, event, pages: talk.length ? talk : [all[0]!] };
}

/** 아이템을 id 나 이름으로 찾는다 — 모델은 요청의 이름(「회복약」)을 그대로 적는 일이 많다. */
function itemOf(draft: Project, value: unknown, where: string): { id: string; name: string } {
  const key = str(value) ?? fail(`${where}: itemId is required.`, "invalid-args");
  const items = draft.database.items ?? [];
  const found = items.find((item) => item.id === key) ?? items.find((item) => item.name === key);
  // 고칠 길을 앞에 둔다 — 실행기가 긴 글의 끝을 자른다(목록이 길면 «먼저 만들라»가 잘려 나갔다).
  if (!found) fail(`${where}: no item '${key}' — create it with upsert_item first, or use an existing one: ${items.slice(0, 10).map((item) => `${item.id}(${item.name})`).join(", ") || "none"}.`, "item-not-found");
  return { id: found!.id, name: found!.name };
}

/** 그 페이지가 이미 쓰는 화자 이름 — 끼우는 대사도 같은 이름으로 말한다. */
function speakerOf(page: EventPage, given: unknown): string | undefined {
  if (typeof given === "string") return given.trim() || undefined;
  const walk = (commands: readonly Command[] | undefined): string | undefined => {
    for (const command of commands ?? []) if (command.kind === "text" && command.speaker) return command.speaker;
    return undefined;
  };
  return walk(page.commands);
}
const say = (body: string, speaker: string | undefined): Command => ({ kind: "text", ...(speaker ? { speaker } : {}), body });
/** 「을/를」 — 받침이 있으면 을. */
const eul = (word: string): string => {
  const code = word.charCodeAt(word.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 ? ((code - 0xac00) % 28 ? "을" : "를") : "을(를)";
};

// ── 호감 ─────────────────────────────────────────────────────────────────────

const AFFECTION = "affection";

const setNpcAffection: ToolDefinition = {
  name: "set_npc_affection",
  description:
    "있는 NPC 이벤트에 호감 장치를 끼운다 — 말을 걸 때마다 호감이 오르고(talkGain), 선물을 받고(gifts: 그 아이템을 가졌을 때만 「선물한다 / 그만둔다」가 뜨고, 건네면 하나 줄고 호감이 오른다), " +
    "호감이 문턱을 넘으면 다른 말을 하고(milestones), 고백을 받는다(confess: 문턱 전에는 거절 대사, 넘으면 수락 대사·엔딩). 있던 대사·숙박·상점 명령은 그대로 두고 그 앞에 끼운다. " +
    "같은 이벤트에 다시 부르면 호감 토막만 갈아 끼운다(전에 준 gifts·milestones 도 다시 적는다). 호감은 npcKey 하나에 쌓인다 — 조건은 {kind:'friendshipAtLeast',npcKey,value}.",
  mode: "write",
  domains: ["event"],
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      eventId: { type: "string", description: "호감을 붙일 NPC 이벤트" },
      pageIndex: { type: "integer", description: "0부터. 생략 = 말을 걸어 도는 페이지 전부" },
      npcKey: { type: "string", description: "호감이 쌓이는 열쇠. 생략 = 그 이벤트의 characterId, 없으면 이벤트 id" },
      talkGain: { type: "integer", description: "말을 걸 때마다 오르는 호감(0~100). 기본 0(말로는 안 오른다)" },
      gifts: {
        type: "array", description: "받는 선물들",
        items: {
          type: "object",
          properties: {
            itemId: { type: "string", description: "아이템 id 또는 이름" },
            gain: { type: "integer", description: "건네면 오르는 호감. 기본 1" },
            lines: { type: "array", items: { type: "string" }, description: "받고 하는 말" },
          },
          required: ["itemId"], additionalProperties: false,
        },
      },
      milestones: {
        type: "array", description: "호감이 atLeast 이상이면 (평소 말 앞에) 하는 말. 여럿이면 넘은 것 가운데 가장 높은 하나만",
        items: {
          type: "object",
          properties: { atLeast: { type: "integer" }, lines: { type: "array", items: { type: "string" } } },
          required: ["atLeast", "lines"], additionalProperties: false,
        },
      },
      confess: {
        type: "object", description: "고백 선택지",
        properties: {
          atLeast: { type: "integer", description: "이 호감 이상이면 받아 준다" },
          label: { type: "string", description: "선택지 글. 기본 「고백한다」" },
          talkLabel: { type: "string", description: "고백하지 않는 쪽 선택지 글. 기본 「이야기를 나눈다」" },
          acceptLines: { type: "array", items: { type: "string" } },
          refuseLines: { type: "array", items: { type: "string" }, description: "호감이 모자랄 때 하는 말" },
          endingId: { type: "string", description: "받아 주면 이 엔딩을 연다(define_ending 으로 먼저 만든다). 생략 = 대사만" },
          switchId: { type: "string", description: "받아 주면 켤 스위치(연인이 된 뒤의 페이지·장면이 읽는다)" },
        },
        required: ["atLeast"], additionalProperties: false,
      },
      speaker: { type: "string", description: "끼우는 대사의 화자 이름. 생략 = 그 페이지가 쓰던 이름" },
    },
    required: ["mapId", "eventId"],
    additionalProperties: false,
  },
  invalidArgsExample: { mapId: "map_village", eventId: "ev_innkeeper", talkGain: 1, milestones: [{ atLeast: 3, lines: ["오늘은 특별히 따뜻한 차를 내올게요."] }] },
  run(draft, args): ToolExecResult {
    const { map, event, pages } = eventPages(draft, args);
    const npcKey = str(args.npcKey) ?? str((event as { characterId?: unknown }).characterId) ?? event.id;
    const talkGain = int(args.talkGain, 0, 0, 100);
    const gifts = (Array.isArray(args.gifts) ? (args.gifts as Record<string, unknown>[]) : []).map((gift, i) => ({
      item: itemOf(draft, gift.itemId, `gifts[${i}]`), gain: int(gift.gain, 1, 1, 100), lines: lines(gift.lines),
    }));
    const milestones = (Array.isArray(args.milestones) ? (args.milestones as Record<string, unknown>[]) : [])
      .map((entry, i) => ({ atLeast: int(entry.atLeast, 0, 1, 1000), lines: lines(entry.lines), i }))
      .sort((a, b) => b.atLeast - a.atLeast);
    const empty = milestones.find((entry) => entry.lines.length === 0);
    if (empty) fail(`milestones[${empty.i}]: lines is empty — write what the NPC says at affection ${empty.atLeast}.`, "invalid-args");
    const confess = args.confess && typeof args.confess === "object" ? (args.confess as Record<string, unknown>) : undefined;
    if (!talkGain && !gifts.length && !milestones.length && !confess) fail("Nothing to add: give at least one of talkGain, gifts, milestones, confess.", "invalid-args");
    const warnings: string[] = [];
    if ((milestones.length || confess) && !talkGain && !gifts.length) {
      warnings.push(`Affection '${npcKey}' never rises from this call (no talkGain, no gifts) — the milestone/confession needs another source (changeFriendship with npcKey '${npcKey}').`);
    }
    const friend = (value: number): Condition => ({ kind: "friendshipAtLeast", npcKey, value } as Condition);
    const endingId = confess ? str(confess.endingId) : undefined;
    if (endingId && !(draft.endings ?? []).some((ending) => ending.id === endingId)) {
      fail(`confess.endingId '${endingId}' does not exist — create it with define_ending first, or omit endingId. Endings: ${(draft.endings ?? []).slice(0, 10).map((ending) => `${ending.id}(${ending.name})`).join(", ") || "none"}.`, "ending-not-found");
    }
    const switchId = confess ? str(confess.switchId) : undefined;
    if (switchId) ensureNamedSwitch(draft, switchId, `${event.name} 고백 수락`);
    const blockFor = (speaker: string | undefined): Command[] => {
    const block: Command[] = [mark(AFFECTION, "begin")];
    for (const gift of gifts) {
      block.push({
        kind: "fork", condition: { kind: "item", itemId: gift.item.id, present: true },
        then: [{
          kind: "choices",
          options: [
            { text: `${gift.item.name}${eul(gift.item.name)} 선물한다`, branch: [
              { kind: "changeItem", itemId: gift.item.id, op: "-=", amount: 1 },
              { kind: "changeFriendship", npcKey, delta: gift.gain },
              ...(gift.lines.length ? gift.lines : ["고마워요."]).map((body) => say(body, speaker)),
            ] },
            { text: "그만둔다", branch: [] },
          ],
        } as Command],
        else: [],
      } as Command);
    }
    if (confess) {
      const atLeast = int(confess.atLeast, 1, 1, 1000);
      const accept = lines(confess.acceptLines), refuse = lines(confess.refuseLines);
      // 고백이 있으면 말로 오르는 호감은 «이야기를 나눈다» 쪽에만 — 거절당한 고백으로는 오르지 않는다.
      block.push({
        kind: "choices",
        options: [
          { text: str(confess.talkLabel) ?? "이야기를 나눈다", branch: talkGain ? [{ kind: "changeFriendship", npcKey, delta: talkGain } as Command] : [] },
          { text: str(confess.label) ?? "고백한다", branch: [{
            kind: "fork", condition: friend(atLeast),
            then: [
              ...(accept.length ? accept : endingId ? [] : ["……저도 같은 마음이에요."]).map((body) => say(body, speaker)),
              ...(switchId ? [{ kind: "setSwitch", switchId, value: true } as Command] : []),
              ...(endingId ? [{ kind: "triggerEnding", endingId } as Command] : []),
            ],
            else: (refuse.length ? refuse : ["아직은 마음의 준비가 안 됐어요."]).map((body) => say(body, speaker)),
          } as Command] },
        ],
      } as Command);
    } else if (talkGain) block.push({ kind: "changeFriendship", npcKey, delta: talkGain });
    // 넘은 문턱 가운데 가장 높은 하나만 — 높은 것부터 안으로 접는다.
    const fold = (rest: typeof milestones): Command[] => (rest.length
      ? [{ kind: "fork", condition: friend(rest[0]!.atLeast), then: rest[0]!.lines.map((body) => say(body, speaker)), else: fold(rest.slice(1)) } as Command]
      : []);
    block.push(...fold(milestones), mark(AFFECTION, "end"));
    return block;
    };
    for (const page of pages) page.commands = [...blockFor(speakerOf(page, args.speaker)), ...withoutBlock(page.commands ?? [], AFFECTION)];
    assertEventShape(event, warnings, event, draft);
    return {
      summary: `${event.name}: affection '${npcKey}' — ${[
        talkGain ? `+${talkGain} per talk` : "", ...gifts.map((gift) => `gift ${gift.item.name} +${gift.gain}`),
        ...milestones.map((entry) => `new lines at ${entry.atLeast}`), confess ? `confession at ${int(confess.atLeast, 1, 1, 1000)}` : "",
      ].filter(Boolean).join(" · ")}. Added to ${pages.length} page(s); the existing commands stay after it.`,
      ...(warnings.length ? { warnings } : {}),
      data: { mapId: map.id, eventId: event.id, npcKey, condition: { kind: "friendshipAtLeast", npcKey, value: milestones[0]?.atLeast ?? 1 } },
    };
  },
};

// ── 가진 물건 내밀기 ─────────────────────────────────────────────────────────

const PRESENT = "present";

const setPresentReactions: ToolDefinition = {
  name: "set_present_reactions",
  description:
    "있는 이벤트에 「가진 물건을 골라 내민다」를 끼운다(증거 내밀기 · 물건 보여 주기) — 평소 말이 끝난 뒤 소지품 목록이 뜨고, reactions 의 아이템을 내밀면 그 대사(와 스위치), " +
    "다른 것을 내밀면 otherLines, 내밀 것이 없거나 닫으면 아무 일도 없다. 있던 대사는 그대로다. 다시 부르면 이 토막만 갈아 끼운다.",
  mode: "write",
  domains: ["event"],
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      eventId: { type: "string" },
      pageIndex: { type: "integer", description: "0부터. 생략 = 말을 걸어 도는 페이지 전부" },
      prompt: { type: "string", description: "목록 위 안내 글. 기본 「무엇을 내밀까?」" },
      reactions: {
        type: "array", description: "아이템마다의 반응",
        items: {
          type: "object",
          properties: {
            itemId: { type: "string", description: "아이템 id 또는 이름" },
            lines: { type: "array", items: { type: "string" }, description: "그것을 내밀면 하는 말" },
            switchId: { type: "string", description: "내밀면 켤 스위치(자백·단서 확보를 다른 장면이 읽는다)" },
            consume: { type: "boolean", description: "true 면 내민 것을 하나 가져간다. 기본 false" },
          },
          required: ["itemId", "lines"], additionalProperties: false,
        },
      },
      otherLines: { type: "array", items: { type: "string" }, description: "reactions 에 없는 것을 내밀었을 때 하는 말" },
      onlyListed: { type: "boolean", description: "true 면 목록에 reactions 의 아이템만 올린다. 기본 false(소지품 전체 — 틀린 것도 내밀 수 있다)" },
      position: { type: "string", enum: ["after", "before"], description: "평소 말 뒤(기본) 또는 앞" },
      speaker: { type: "string", description: "끼우는 대사의 화자 이름. 생략 = 그 페이지가 쓰던 이름" },
    },
    required: ["mapId", "eventId", "reactions"],
    additionalProperties: false,
  },
  invalidArgsExample: { mapId: "map_village", eventId: "ev_guard", reactions: [{ itemId: "item_old_key", lines: ["그 열쇠… 내가 숨긴 게 맞다."] }], otherLines: ["그건 나와 상관없는 물건이야."] },
  run(draft, args): ToolExecResult {
    const { map, event, pages } = eventPages(draft, args);
    const raw = Array.isArray(args.reactions) ? (args.reactions as Record<string, unknown>[]) : [];
    if (!raw.length) fail("reactions is empty — list at least one item and what the NPC says when it is shown.", "invalid-args");
    const reactions = raw.map((entry, i) => {
      const said = lines(entry.lines);
      if (!said.length) fail(`reactions[${i}]: lines is empty.`, "invalid-args");
      const switchId = str(entry.switchId);
      const item = itemOf(draft, entry.itemId, `reactions[${i}]`);
      if (switchId) ensureNamedSwitch(draft, switchId, `${event.name}: ${item.name} 내밀기`);
      return { item, said, switchId, consume: entry.consume === true };
    });
    const other = lines(args.otherLines);
    const presentFor = (speaker: string | undefined): Command => ({
      kind: "presentItem", prompt: str(args.prompt) ?? "무엇을 내밀까?",
      ...(args.onlyListed === true ? { itemIds: reactions.map((reaction) => reaction.item.id) } : {}),
      options: reactions.map((reaction) => ({
        itemId: reaction.item.id,
        branch: [
          ...reaction.said.map((body) => say(body, speaker)),
          ...(reaction.consume ? [{ kind: "changeItem", itemId: reaction.item.id, op: "-=", amount: 1 } as Command] : []),
          ...(reaction.switchId ? [{ kind: "setSwitch", switchId: reaction.switchId, value: true } as Command] : []),
        ],
      })),
      otherwiseBranch: other.map((body) => say(body, speaker)),
      cancelBranch: [],
    } as Command);
    for (const page of pages) {
      const block = [mark(PRESENT, "begin"), presentFor(speakerOf(page, args.speaker)), mark(PRESENT, "end")];
      const kept = withoutBlock(page.commands ?? [], PRESENT);
      page.commands = args.position === "before" ? [...block, ...kept] : [...kept, ...block];
    }
    const warnings: string[] = [];
    if (!other.length && args.onlyListed !== true) warnings.push("otherLines is empty — showing any other item does nothing. Give otherLines, or onlyListed:true to list only the items that react.");
    assertEventShape(event, warnings, event, draft);
    return {
      summary: `${event.name}: show an item — ${reactions.map((reaction) => `${reaction.item.name} → «${reaction.said[0]}»${reaction.switchId ? ` (+${reaction.switchId})` : ""}`).join(" · ")}${other.length ? ` · anything else → «${other[0]}»` : ""}. Added to ${pages.length} page(s); the existing commands stay ${args.position === "before" ? "after" : "before"} it.`,
      ...(warnings.length ? { warnings } : {}),
      data: { mapId: map.id, eventId: event.id, itemIds: reactions.map((reaction) => reaction.item.id) },
    };
  },
};

// ── 제한 시간 ────────────────────────────────────────────────────────────────

const hidden = (id: string, name: string, conditions: Condition[], trigger: "auto" | "parallel", commands: Command[]): EventPage => ({
  id, name, conditions,
  graphic: { transparent: true } as EventPage["graphic"],
  trigger: { kind: trigger } as EventPage["trigger"],
  priority: "below", overlapForbidden: false, animationType: "fixedGraphic", movement: FIXED_MOVEMENT,
  commands,
});
/** 보이지 않는 진행 이벤트를 둘 칸 — 다른 이벤트가 없는 칸을 왼쪽 위부터. */
function spareCell(map: GameMap, taken: Set<string>): { x: number; y: number } {
  const used = new Set([...map.events.map((entry) => `${entry.x},${entry.y}`), ...taken]);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (!used.has(`${x},${y}`)) { taken.add(`${x},${y}`); return { x, y }; }
  return { x: 0, y: 0 };
}

const setTimeLimit: ToolDefinition = {
  name: "set_time_limit",
  description:
    "그 맵에 들어서면 제한 시간(초)이 화면에 뜨고 줄어든다. 다 되면 게임 오버(기본) 또는 엔딩(endingId). stopSwitchId 가 켜지면(목표 달성) 타이머가 멈추고 끝난다. " +
    "같은 맵에 다시 부르면 새로 짓는다. 무너지는 바닥까지 있는 탈출은 make_timed_escape, 날짜 기한은 set_deadline_ending.",
  mode: "write",
  domains: ["event", "map"],
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "들어서면 시간이 돌기 시작하는 맵" },
      seconds: { type: "integer", description: "제한 시간(초, 5~3600)" },
      endingId: { type: "string", description: "시간이 다 되면 여는 엔딩. 생략 = 게임 오버" },
      expireLines: { type: "array", items: { type: "string" }, description: "시간이 다 됐을 때 대사. 기본 「시간이 다 됐다……」" },
      startLines: { type: "array", items: { type: "string" }, description: "시작할 때 대사(생략 가능)" },
      stopSwitchId: { type: "string", description: "이 스위치가 켜지면 타이머를 멈춘다(열쇠를 찾았다 · 출구에 닿았다). 그 스위치를 켜는 일은 다른 이벤트가 한다" },
      timerId: { type: "string", enum: ["timer1", "timer2"], description: "기본 timer1" },
    },
    required: ["mapId", "seconds"],
    additionalProperties: false,
  },
  invalidArgsExample: { mapId: "map_field", seconds: 30 },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, String(args.mapId ?? ""));
    if (typeof args.seconds !== "number") fail("seconds is required (5~3600).", "invalid-args");
    const seconds = int(args.seconds, 60, 5, 3600);
    const timerId = args.timerId === "timer2" ? "timer2" : "timer1";
    const endingId = str(args.endingId);
    if (endingId && !(draft.endings ?? []).some((ending) => ending.id === endingId)) {
      fail(`endingId '${endingId}' does not exist — create it with define_ending first, or omit endingId for a game over. Endings: ${(draft.endings ?? []).slice(0, 10).map((ending) => `${ending.id}(${ending.name})`).join(", ") || "none"}.`, "ending-not-found");
    }
    const base = `ev_timelimit_${map.id.replace(/[^A-Za-z0-9_]/g, "_")}`;
    const running = `sw_timelimit_${map.id.replace(/[^A-Za-z0-9_]/g, "_")}`;
    ensureNamedSwitch(draft, running, `${map.name} 제한 시간 진행 중`);
    const stopSwitchId = str(args.stopSwitchId);
    if (stopSwitchId) ensureNamedSwitch(draft, stopSwitchId, `${map.name} 제한 시간 멈춤`);
    map.events = map.events.filter((entry) => entry.id !== `${base}_start` && entry.id !== `${base}_end`);
    const taken = new Set<string>();
    const on = (switchId: string, value = true): Condition => ({ kind: "switch", switchId, value });
    const expire = lines(args.expireLines);
    const start: GameEvent = {
      id: `${base}_start`, name: "제한 시간 시작", ...spareCell(map, taken), trigger: { kind: "auto" }, commands: [],
      pages: [hidden(`${base}_start_p0`, "제한 시간 시작", [{ kind: "selfSwitch", key: "A", value: false } as Condition], "auto", [
        { kind: "timer", action: "set", seconds, timerId },
        { kind: "timer", action: "start", timerId },
        ...lines(args.startLines).map((body) => say(body, undefined)),
        { kind: "setSwitch", switchId: running, value: true },
        { kind: "setSelfSwitch", key: "A", value: true } as Command,
      ])],
    } as GameEvent;
    // 진행 스위치를 먼저 끈다 — 대사가 뜬 사이 같은 페이지가 다시 돌지 않게.
    const end: GameEvent = {
      id: `${base}_end`, name: "시간 초과", ...spareCell(map, taken), trigger: { kind: "parallel" }, commands: [],
      pages: [
        hidden(`${base}_end_p0`, "시간 초과", [on(running), { kind: "timer", timerId, seconds: 0, op: "<=" }], "parallel", [
          { kind: "setSwitch", switchId: running, value: false },
          ...(expire.length ? expire : ["시간이 다 됐다……"]).map((body) => say(body, undefined)),
          (endingId ? { kind: "triggerEnding", endingId } : { kind: "gameOver" }) as Command,
        ]),
        ...(stopSwitchId ? [hidden(`${base}_end_p1`, "제한 시간 멈춤", [on(running), on(stopSwitchId)], "parallel", [
          { kind: "timer", action: "stop", timerId },
          { kind: "setSwitch", switchId: running, value: false },
        ])] : []),
      ],
    } as GameEvent;
    const warnings: string[] = [];
    for (const event of [start, end]) { assertEventShape(event, warnings, event, draft); upsertEventIntoMap(map, event); }
    return {
      summary: `${map.name}: entering starts a ${seconds}s countdown (${timerId}); at 0 → ${endingId ? `ending ${endingId}` : "game over"}${stopSwitchId ? `; switch ${stopSwitchId} stops it` : ""}.`,
      ...(warnings.length ? { warnings } : {}),
      data: { mapId: map.id, eventIds: [start.id, end.id], timerId, runningSwitchId: running, timerCondition: { kind: "timer", timerId, seconds: 0, op: "<=" } },
    };
  },
};

// ── 화면의 수치 게이지 ───────────────────────────────────────────────────────

const addHudGauge: ToolDefinition = {
  name: "add_hud_gauge",
  description:
    "수치 하나(배고픔 · 산소 · 평판 · 모은 수)를 변수로 만들고 탐색 화면에 게이지로 띄운다 — 변수(시작 값 initial) + HUD 위젯 하나. 지금 화면에 뜨는 다른 HUD 는 그대로 둔다. " +
    "값을 바꾸는 것은 이벤트 명령 {kind:'setVariable',variableId,op:'+='|'-=',value}. 같은 variableId 로 다시 부르면 그 게이지를 고친다. 꽃잎 체력은 set_life_flower.",
  mode: "write",
  domains: ["system"],
  parameters: {
    type: "object",
    properties: {
      label: { type: "string", description: "게이지 이름표(변수 이름으로도 쓴다). 예: 배고픔" },
      initial: { type: "integer", description: "게임을 시작할 때의 값. 기본 = max" },
      max: { type: "integer", description: "게이지의 최댓값. 기본 100" },
      variableId: { type: "string", description: "쓸 변수 id. 생략 = 새로 만든다(var_gauge_N)" },
      shape: { type: "string", enum: Object.keys(HUD_SHAPES).filter((shape) => shape !== "petals"), description: "bar(기본) · vertical · hearts · ring · number" },
      anchor: { type: "string", enum: Object.keys(HUD_ANCHORS), description: "화면 자리. 기본 top-left(이미 있는 것 아래에 놓는다)" },
      color: { type: "string", description: "#rrggbb" },
    },
    required: ["label"],
    additionalProperties: false,
  },
  invalidArgsExample: { label: "배고픔", initial: 100, max: 100 },
  run(draft, args): ToolExecResult {
    const label = str(args.label) ?? fail("label is required (the gauge's name on screen).", "invalid-args");
    const max = int(args.max, 100, 1, 999_999);
    const initial = int(args.initial, max, 0, 999_999);
    let variableId = str(args.variableId);
    if (!variableId) {
      const named = draft.variables.find((entry) => entry.name === label);
      let n = 1;
      while (!named && draft.variables.some((entry) => entry.id === `var_gauge_${n}`)) n++;
      variableId = named?.id ?? `var_gauge_${n}`;
    }
    ensureNamedVariable(draft, variableId, label);
    draft.session.variables[variableId] = initial;
    const hud = normalizeFieldHud(effectiveFieldHud(draft) ?? draft.system.fieldHud);
    const widgetId = `gauge-${variableId}`;
    const shown = resolvedHudWidgets(hud).filter((widget) => widget.id !== widgetId);
    if (shown.length >= HUD_WIDGET_LIMIT) fail(`The HUD already has ${shown.length} widgets (limit ${HUD_WIDGET_LIMIT}). Remove one with set_project_settings.fieldHud.widgets first.`, "hud-full");
    const anchor = typeof args.anchor === "string" && Object.hasOwn(HUD_ANCHORS, args.anchor) ? args.anchor : "top-left";
    // 같은 모서리에 이미 있는 것 아래에 놓는다 — 겹치면 둘 다 읽을 수 없다.
    const below = shown.filter((widget) => widget.enabled && widget.anchor === anchor).reduce((y, widget) => Math.max(y, widget.y + widget.height + 6), 10);
    const widget = normalizeHudWidget({
      id: widgetId, kind: "gauge", source: "variable", variableId, max, label,
      shape: typeof args.shape === "string" && Object.hasOwn(HUD_SHAPES, args.shape) && args.shape !== "petals" ? args.shape : "bar",
      anchor, y: below, width: 110, height: 28, panel: "dark", showValue: true,
      ...(typeof args.color === "string" && /^#[\da-f]{6}$/i.test(args.color) ? { color: args.color } : {}),
    });
    draft.system.fieldHud = { ...hud, widgets: [...shown, widget] };
    return {
      summary: `HUD gauge «${label}» = ${initial}/${max} on variable ${variableId} (${anchor}). Change it with {kind:"setVariable",variableId:"${variableId}",op:"-=",value:N}.`,
      data: { variableId, widgetId, initial, max, onScreen: [...shown, widget].filter((entry) => entry.enabled).map((entry) => entry.id) },
    };
  },
};

export const GENRE_DEVICE_TOOLS: readonly ToolDefinition[] = [setNpcAffection, setPresentReactions, setTimeLimit, addHudGauge];
