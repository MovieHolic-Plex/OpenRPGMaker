// editor/tools/lockDoorTools.ts
// lock_door — 이미 있는 이동 문(create_transfer_pair / build_* 맵 빌더가 만든 transfer 이벤트)을 이야기 조건이 참일 때까지 잠근다.
// create_time_gate 의 unlockWhen 은 새로 만드는 시간 문에만, duplicate_map 의 lockedDoorText 는 복제본에만 있어
// 「연회가 끝나야 복도 문이 열린다」 같은 기존 문 잠금은 페이지를 손으로 짜야 했다.
//
// 페이지 순서는 [잠김, 열림1, 열림2…]. 런타임은 조건이 모두 맞는 **마지막** 페이지를 쓰므로(activePageNumber)
// 조건 없는 잠김 페이지가 맨 앞(가장 낮은 우선)에 오고, 열림 페이지는 그 뒤에 조건을 달고 선다.
// 다시 부르면 이전 잠금 페이지(id 가 _locked / _open_N 로 끝남)를 바꿔 끼우므로 반복해도 쌓이지 않는다.

import { isPassable } from "@/project/collision";
import type { Command, Condition, Dir, EventPage, GameEvent, GameMap } from "@/project/types";
import { unlockCondition } from "./timeGateTools";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const ALLOWED_ARGS = new Set(["mapId", "x", "y", "unlockWhen", "unlockWhenAny", "lockedText", "stepBack", "speaker", "unlock"]);
const LOCK_PAGE_NAME = "잠김";
const COND_PROPS = {
  switchId: { type: "string" },
  storyFlagId: { type: "string" },
  variableId: { type: "string" },
  op: { type: "string", enum: ["==", ">=", "<=", ">", "<", "!="] },
  value: { type: "number" },
} as const;
const DIRS: ReadonlyArray<{ readonly dir: Dir; readonly dx: number; readonly dy: number }> = [
  { dir: "up", dx: 0, dy: -1 },
  { dir: "down", dx: 0, dy: 1 },
  { dir: "left", dx: -1, dy: 0 },
  { dir: "right", dx: 1, dy: 0 },
];

function pageHasTransfer(page: EventPage): boolean {
  return page.commands.some((command) => command.kind === "transfer");
}

function isTransferEvent(event: GameEvent): boolean {
  return (event.pages ?? []).some(pageHasTransfer);
}

/** 이 도구가 만든 페이지(id 끝 _locked / _open_N) 또는 create_time_gate 의 「(잠김)」 안내 페이지. */
function isLockPage(page: EventPage): boolean {
  return /_locked$/u.test(page.id) || /_open_\d+$/u.test(page.id) || (!pageHasTransfer(page) && /\(잠김\)$/u.test(page.name ?? ""));
}

/** 시작 칸에서 1칸 이내의 이동 이벤트 + 그와 맞닿은 이동 이벤트(같은 줄/열) — 두 칸 폭 문의 양쪽 반쪽이 함께 잠긴다. */
function findGateEvents(map: GameMap, x: number, y: number): GameEvent[] {
  const transfers = map.events.filter(isTransferEvent);
  const seeds = transfers.filter((event) => Math.abs(event.x - x) + Math.abs(event.y - y) <= 1);
  if (seeds.length === 0) return [];
  const group = new Set<GameEvent>(seeds);
  const anchor = seeds.find((event) => event.x === x && event.y === y) ?? seeds[0]!;
  let grew = true;
  while (grew) {
    grew = false;
    for (const event of transfers) {
      if (group.has(event)) continue;
      const sameLine = event.x === anchor.x || event.y === anchor.y;
      if (!sameLine) continue;
      for (const member of group) {
        if (Math.abs(member.x - event.x) + Math.abs(member.y - event.y) === 1) {
          group.add(event);
          grew = true;
          break;
        }
      }
    }
  }
  return [...group].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** 문에서 한 걸음 물러설 방향. 준 칸이 문 앞 칸이면 그쪽, 아니면 가장자리에서 먼 걷기 가능 이웃. */
function stepBackDir(project: Parameters<typeof isPassable>[0], map: GameMap, gate: GameEvent, hint: { x: number; y: number }, gateCells: ReadonlySet<string>): Dir | undefined {
  const open = DIRS.filter(({ dx, dy }) => {
    const nx = gate.x + dx;
    const ny = gate.y + dy;
    return nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && !gateCells.has(`${nx},${ny}`) && isPassable(project, map, nx, ny);
  });
  if (open.length === 0) return undefined;
  const hinted = open.find(({ dx, dy }) => gate.x + dx === hint.x && gate.y + dy === hint.y);
  if (hinted) return hinted.dir;
  const edgeDistance = (px: number, py: number): number => Math.min(px, py, map.width - 1 - px, map.height - 1 - py);
  let best = open[0]!;
  for (const candidate of open) {
    if (edgeDistance(gate.x + candidate.dx, gate.y + candidate.dy) > edgeDistance(gate.x + best.dx, gate.y + best.dy)) best = candidate;
  }
  return best.dir;
}

function parseAlternatives(project: Parameters<typeof unlockCondition>[0], raw: unknown): { alternatives: Condition[][]; notes: string[] } {
  const notes: string[] = [];
  const items = Array.isArray(raw) ? raw : [raw];
  if (items.length === 0) throw new ToolError("unlockWhen 배열이 비어 있습니다 — 조건을 하나 이상 주세요.", { code: "invalid-args" });
  const alternatives = items.map((item) => {
    const ands = Array.isArray(item) ? item : [item];
    if (ands.length === 0) throw new ToolError("unlockWhen 안쪽 배열(AND)이 비어 있습니다.", { code: "invalid-args" });
    return ands.map((entry) => {
      const parsed = unlockCondition(project, entry);
      if (parsed.note) notes.push(parsed.note);
      return parsed.condition;
    });
  });
  return { alternatives, notes };
}

function openGate(event: GameEvent): { base: EventPage; others: EventPage[] } {
  const pages = event.pages ?? [];
  const mine = pages.filter(isLockPage);
  const rest = pages.filter((page) => !isLockPage(page));
  const candidates = rest.filter(pageHasTransfer);
  // 이전 잠금의 첫 열림 페이지는 원래 id 를 유지한다. 열림 페이지가 모두 사라졌다면 _open_ 페이지에서 복원한다.
  const base = candidates[candidates.length - 1] ?? mine.find((page) => pageHasTransfer(page) && /_open_\d+$/u.test(page.id));
  if (!base) throw new ToolError(`문 이벤트 ${event.id} 에서 이동 명령이 있는 페이지를 찾지 못했습니다.`, { code: "no-door", mapId: undefined });
  return { base, others: rest.filter((page) => page !== base) };
}

const lockDoor: ToolDefinition = {
  name: "lock_door",
  description:
    "이미 있는 이동 문(create_transfer_pair · build_* 맵 빌더가 만든 transfer 이벤트)을 이야기 조건이 참일 때까지 잠근다 — 「이야기 진행 전엔 못 나가는 문」, 「연회 끝나야 복도 문이 열린다」."
    + " {mapId, x, y, unlockWhen|unlockWhenAny, lockedText, stepBack?, speaker?, unlock?} — (x,y)는 문 칸이거나 그 앞 칸(1칸 이내의 이동 이벤트를 찾고, 두 칸 폭 문은 맞닿은 반쪽까지 함께 잠근다)."
    + " unlockWhen 은 {switchId}|{storyFlagId}|{variableId,op,value} 하나. 여럿 중 하나라도(OR)는 unlockWhenAny 에 [[AND 조건들],[AND 조건들]] 로 준다."
    + " 조건이 안 맞으면 lockedText(+speaker) 가 뜨고 stepBack(기본 true)이면 플레이어가 문 앞으로 한 걸음 물러난다. 알 수 없는 키는 거절한다."
    + " 같은 문에 다시 부르면 이전 잠금을 바꿔 끼운다(쌓이지 않음). unlock:true 는 잠금을 풀어 조건 없는 이동 페이지 하나로 되돌린다."
    + " 시간 문을 새로 만들 때는 create_time_gate 의 unlockWhen. 문 자체가 없으면 create_transfer_pair 로 먼저 만든다(no-door).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "문이 있는 맵 id" },
      x: { type: "integer", description: "문 칸 또는 문 앞 칸의 x" },
      y: { type: "integer", description: "문 칸 또는 문 앞 칸의 y" },
      unlockWhen: {
        type: "object",
        description: "열리는 조건 하나: {switchId} | {storyFlagId} | {variableId, op(==,>=,<=,>,<,!=), value}",
        properties: COND_PROPS,
      },
      unlockWhenAny: {
        type: "array",
        description: "여럿 중 하나라도 참이면 열린다(OR). 항목 하나는 조건 객체들의 배열(그 안은 모두 참이어야 하는 AND). 예: [[{switchId:\"a\"}],[{switchId:\"b\"},{variableId:\"v\",op:\">=\",value:2}]]. unlockWhen 과 함께 쓰지 않는다",
        items: { type: "array", items: { type: "object", properties: COND_PROPS } },
      },
      lockedText: { type: "string", description: "잠겨 있을 때 뜨는 안내문(unlock:true 가 아니면 필수)" },
      stepBack: { type: "boolean", description: "잠겨 있을 때 문 앞으로 한 걸음 물러나게 한다. 기본 true" },
      speaker: { type: "string", description: "안내문 화자(생략하면 화자 없는 안내문)" },
      unlock: { type: "boolean", description: "true 면 잠금을 풀고 조건 없는 이동 페이지 하나로 되돌린다" },
    },
    required: ["mapId", "x", "y"],
    additionalProperties: false,
  },
  invalidArgsExample: { mapId: "map_hall", x: 10, y: 0, unlockWhen: { switchId: "sw_banquet_done" }, lockedText: "연회가 끝나기 전에는 나갈 수 없다.", stepBack: true },
  run(draft, args): ToolExecResult {
    const unknown = Object.keys(args).filter((key) => !ALLOWED_ARGS.has(key));
    if (unknown.length > 0) {
      throw new ToolError(`lock_door 에 알 수 없는 인자: ${unknown.join(", ")} — 허용: ${[...ALLOWED_ARGS].join(", ")}.`, { code: "invalid-args" });
    }
    if (typeof args.mapId !== "string" || !args.mapId.trim()) throw new ToolError("mapId 가 필요합니다.", { code: "invalid-args" });
    if (!Number.isInteger(args.x) || !Number.isInteger(args.y)) throw new ToolError("x, y 는 정수여야 합니다.", { code: "invalid-args" });
    const map = requireMap(draft, args.mapId);
    const x = args.x as number;
    const y = args.y as number;
    const unlock = args.unlock === true;
    const hasOne = args.unlockWhen !== undefined;
    const hasAny = args.unlockWhenAny !== undefined;
    if (!unlock) {
      if (hasOne === hasAny) throw new ToolError("unlockWhen(조건 하나) 또는 unlockWhenAny(OR 목록) 중 정확히 하나가 필요합니다(잠금을 풀려면 unlock:true).", { code: "invalid-args" });
      if (hasAny && (!Array.isArray(args.unlockWhenAny) || args.unlockWhenAny.length === 0)) throw new ToolError("unlockWhenAny 는 비어 있지 않은 배열이어야 합니다.", { code: "invalid-args" });
      if (typeof args.lockedText !== "string" || !args.lockedText.trim()) throw new ToolError("lockedText(잠겼을 때 안내문)가 필요합니다.", { code: "invalid-args" });
    } else if (hasOne || hasAny) {
      throw new ToolError("unlock:true 와 unlockWhen/unlockWhenAny 는 함께 쓰지 않습니다.", { code: "invalid-args" });
    }
    const gates = findGateEvents(map, x, y);
    if (gates.length === 0) {
      throw new ToolError(`${map.name}(${map.id}) 의 (${x},${y}) 근처에 이동(transfer) 이벤트가 없습니다 — find_events 로 문 자리를 확인하거나 create_transfer_pair 로 문을 먼저 만드세요.`, { code: "no-door", mapId: map.id, x, y });
    }
    const parsed = unlock ? undefined : parseAlternatives(draft, hasAny ? args.unlockWhenAny : [args.unlockWhen]);
    const stepBack = args.stepBack !== false;
    const speaker = typeof args.speaker === "string" && args.speaker.trim() ? args.speaker.trim() : undefined;
    const gateCells = new Set(gates.map((gate) => `${gate.x},${gate.y}`));
    const warnings: string[] = [...(parsed?.notes ?? [])];
    const pagesOut: Array<{ eventId: string; pageIds: string[] }> = [];

    for (const gate of gates) {
      const { base, others } = openGate(gate);
      const baseCommands = base.commands;
      if (unlock) {
        base.conditions = [];
        gate.pages = [...others, base];
        pagesOut.push({ eventId: gate.id, pageIds: [base.id] });
        continue;
      }
      const alternatives = parsed!.alternatives;
      const openPages: EventPage[] = alternatives.map((conditions, index) => {
        if (index === 0) {
          base.conditions = conditions.map((condition) => structuredClone(condition));
          return base;
        }
        return {
          ...structuredClone(base),
          id: `${gate.id}_open_${index + 1}`,
          conditions: conditions.map((condition) => structuredClone(condition)),
          commands: structuredClone(baseCommands),
        };
      });
      const commands: Command[] = [{ kind: "text", ...(speaker ? { speaker } : {}), body: (args.lockedText as string).trim() }];
      if (stepBack) {
        const dir = stepBackDir(draft, map, gate, { x, y }, gateCells);
        if (dir) commands.push({ kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "move", dir }], repeat: false, wait: true } });
        else warnings.push(`문 (${gate.x},${gate.y}) 주변에 걸어서 물러설 칸이 없어 stepBack 을 넣지 않았습니다.`);
      }
      const lockedPage: EventPage = {
        ...structuredClone(base),
        id: `${gate.id}_locked`,
        name: LOCK_PAGE_NAME,
        conditions: [],
        commands,
      };
      gate.pages = [...others, lockedPage, ...openPages];
      pagesOut.push({ eventId: gate.id, pageIds: gate.pages.map((page) => page.id) });
    }

    const where = `${map.name}(${gates.map((gate) => `${gate.x},${gate.y}`).join(" · ")})`;
    return {
      summary: unlock
        ? `문 잠금 해제: ${where} — 조건 없는 이동 페이지로 되돌림`
        : `문 잠금: ${where} ${gates.length}칸 — ${parsed!.alternatives.length > 1 ? `${parsed!.alternatives.length}가지 중 하나` : "조건"}이 참일 때만 열림${stepBack ? " · 못 열면 한 걸음 물러남" : ""}`,
      data: { eventIds: gates.map((gate) => gate.id), pages: pagesOut, ...(parsed ? { unlockWhen: parsed.alternatives } : {}) },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const LOCK_DOOR_TOOLS: readonly ToolDefinition[] = [lockDoor];
