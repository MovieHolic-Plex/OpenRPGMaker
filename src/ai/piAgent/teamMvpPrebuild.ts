// 첫 MVP 팀의 세계 뼈대 미리 짓기 — 팀장이 build_world 로 장소 맵과 문을 선언한 바로 뒤, 장소 맵마다 결정적 생성기(마을·던전)를 런타임이 한 번 돌린다.
// 왜(2026-11-25 team-mvp-revive r8·r9 실측, Sonnet 5.5 high):
//  - 맵 담당이 자기 맵을 생성기로 지으려다 다른 맵의 문 도착 칸(그 맵 담당 몫이라 못 고친다) 때문에 커밋이 거절됐고(«월드 그래프 transfer 목적지가 통행 불가»),
//    mapId 없이 새 맵을 지어 같은 이름 맵이 둘씩 남았다(r9 7장 · 못 닿는 맵 2). 시작 마을은 세계 문 때문에 «빈 맵» 이 아니라 마을 도구가 20×15 를 넓히지 못해
//    build_region_place 집(실내 맵이 새로 생김)으로 손 시공했다(r8 6장).
//  - 그 왕복(맵 담당 ↔ 팀장 메시지·재배정)이 판마다 10분 넘게 걸렸다.
// 런타임은 프로젝트 전체를 쓸 수 있어 생성 직후 다른 맵의 도착 칸까지 한 커밋에서 맞춘다(transferRepair). 맵 담당은 지어진 맵에 사람·끝 지점만 놓는다.
import type { GameEvent, GameMap, Project } from "@/project/types";
import { getTool } from "@/editor/tools/toolRegistry";
import { runToolDefinition } from "@/editor/tools/toolRunner";
import type { ToolDefinition } from "@/editor/tools/types";
import { isBlankMap } from "@/editor/tools/mapEmptiness";
import { isPassableLanding } from "@/project/collision";
import { repairWorldTransfers } from "@/project/world/transferRepair";
import { DUNGEON_TYPES } from "@/editor/dungeonKit/types";

export interface PrebuildNodeHint {
  readonly mapId: string;
  readonly role?: string;
  readonly label?: string;
  readonly concept?: string;
}

export interface PrebuildResult {
  readonly project: Project;
  readonly built: readonly string[];
  readonly skipped: readonly { readonly mapId: string; readonly why: string }[];
}

type Edge = "west" | "east" | "north" | "south";
type Pt = { readonly x: number; readonly y: number };

// 낱말 → 던전 종류. 장소 이름·컨셉을 읽는다(팀장이 build_world 노드에 적은 글). 순서가 우선순위다.
const TYPE_WORDS: readonly (readonly [RegExp, (typeof DUNGEON_TYPES)[number]])[] = [
  [/늪|swamp|marsh/iu, "swamp"], [/화산|용암|volcano|lava/iu, "volcano"], [/얼음|빙하|설원|ice|frozen/iu, "ice"],
  [/광산|갱도|mine/iu, "mine"], [/하수|sewer/iu, "sewer"], [/피라미드|pyramid/iu, "pyramid"], [/탑|tower/iu, "tower"],
  [/신전|사원|temple|shrine/iu, "temple"], [/성채|성 |고성|castle|fortress/iu, "castle"], [/미궁|미로|labyrinth|maze/iu, "labyrinth"],
  [/지하묘|묘지|무덤|catacomb|crypt|tomb/iu, "catacomb"], [/마계|이계|otherworld|abyss/iu, "otherworld"],
  [/동굴|굴|cave|cavern/iu, "cave"], [/숲|수풀|forest|woods/iu, "forest"],
];

export function dungeonTypeFor(role: string | undefined, text: string): (typeof DUNGEON_TYPES)[number] {
  for (const [re, type] of TYPE_WORDS) if (re.test(text)) return type;
  return role === "field" ? "forest" : "cave";
}

/** build_world 가 놓은 세계 문(ev_world_gate*)만 있는 빈 장소 맵인가. */
export function isWorldSkeletonMap(map: GameMap): boolean {
  if ((map.structurePlacements?.length ?? 0) > 0) return false;
  const gate = (event: GameEvent) => event.id.startsWith("ev_world_gate");
  return map.events.every(gate) && isBlankMap({ ...map, events: [] });
}

function edgeOf(map: GameMap, p: Pt): Edge {
  const d: [Edge, number][] = [["west", p.x], ["east", map.width - 1 - p.x], ["north", p.y], ["south", map.height - 1 - p.y]];
  return d.sort((a, b) => a[1] - b[1])[0]![0];
}

function edgeMid(map: GameMap, edge: Edge): Pt {
  const cx = Math.floor(map.width / 2), cy = Math.floor(map.height / 2);
  return edge === "west" ? { x: 0, y: cy } : edge === "east" ? { x: map.width - 1, y: cy } : edge === "north" ? { x: cx, y: 0 } : { x: cx, y: map.height - 1 };
}

function reachable(project: Project, map: GameMap, from: Pt): Pt[] {
  const seen = new Set<number>();
  const out: Pt[] = [];
  const queue: Pt[] = [];
  if (isPassableLanding(project, map, from.x, from.y)) { seen.add(from.y * map.width + from.x); queue.push(from); }
  for (let i = 0; i < queue.length; i += 1) {
    const p = queue[i]!;
    out.push(p);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = p.x + dx, y = p.y + dy, k = y * map.width + x;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || seen.has(k) || !isPassableLanding(project, map, x, y)) continue;
      seen.add(k); queue.push({ x, y });
    }
  }
  return out;
}

/**
 * 마을: 세계 문을 떼고(빈 맵이 되어 마을 도구가 시작 맵을 넓혀 짓는다) 문이 있던 가장자리로 큰길을 낸 뒤,
 * 그 가장자리 가운데에 가장 가까운, 시작 칸에서 걸어 닿는 칸에 문을 다시 놓는다. 목적지는 그대로다.
 */
function townRun(base: ToolDefinition): ToolDefinition {
  return {
    ...base,
    run(draft, args) {
      const map = draft.maps[String(args.mapId)]!;
      const gates = map.events;
      const gateEdges = gates.map((gate) => edgeOf(map, gate));
      const edges = [...new Set(gateEdges)].slice(0, 2);
      map.events = [];
      const exec = base.run(draft, edges.length ? { ...args, layout: { exits: edges } } : args);
      const built = draft.maps[map.id]!;
      const from = draft.startMapId === built.id && draft.startPos ? draft.startPos : { x: Math.floor(built.width / 2), y: Math.floor(built.height / 2) };
      const walk = reachable(draft, built, from);
      const placed: string[] = [];
      for (const [index, gate] of gates.entries()) {
        const target = edgeMid(built, gateEdges[index]!);
        const free = walk.filter((p) => !built.events.some((e) => Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 1) && !(p.x === from.x && p.y === from.y));
        const at = [...free].sort((a, b) => (Math.abs(a.x - target.x) + Math.abs(a.y - target.y)) - (Math.abs(b.x - target.x) + Math.abs(b.y - target.y)))[0];
        if (!at) throw new Error(`${built.name}: 세계 문 ${gate.id} 를 둘 걸어 닿는 칸이 없다`);
        const trigger = { kind: "playerTouch" } as GameEvent["trigger"];
        built.events.push({ ...gate, x: at.x, y: at.y, trigger, pages: (gate.pages ?? []).map((page) => ({ ...page, trigger, priority: "below" })) } as GameEvent);
        placed.push(`${gate.id}(${at.x},${at.y})`);
      }
      repairWorldTransfers(draft, { toMapId: built.id });
      return { ...exec, summary: `${exec.summary} · 세계 문 ${placed.join(", ")}` };
    },
  };
}

/** 던전: 생성기가 세계 문을 떼고 다시 놓는다(takeWorldSkeletonGates). 이 맵으로 들어오는 다른 맵 문의 도착 칸은 같은 커밋에서 맞춘다. */
function dungeonRun(base: ToolDefinition): ToolDefinition {
  return {
    ...base,
    run(draft, args) {
      const exec = base.run(draft, args);
      repairWorldTransfers(draft, { toMapId: String(args.mapId) });
      return exec;
    },
  };
}

/**
 * 세계 뼈대(build_world) 장소 맵을 생성기로 짓는다. 실내(interior) 노드는 손 도트 실내라 맵 담당이 짓는다.
 * 맵 하나라도 실패하면 그 맵만 남겨 두고 나머지는 지은 채로 돌려준다 — 커밋 관문(commitChangeset)은 도구 실행기와 같다.
 */
export function prebuildMvpWorld(project: Project, hints: readonly PrebuildNodeHint[]): PrebuildResult {
  const town = getTool("author_beodeul_town");
  const dungeon = getTool("author_dungeon");
  if (!town || !dungeon) return { project, built: [], skipped: hints.map((hint) => ({ mapId: hint.mapId, why: "생성 도구 없음" })) };
  let working = project;
  const built: string[] = [];
  const skipped: { mapId: string; why: string }[] = [];
  for (const hint of hints) {
    const map = working.maps[hint.mapId];
    const role = hint.role ?? working.worldGraph?.nodes.find((node) => node.mapId === hint.mapId)?.role;
    if (!map) { skipped.push({ mapId: hint.mapId, why: "맵 없음" }); continue; }
    if (role === "interior") { skipped.push({ mapId: hint.mapId, why: "실내는 맵 담당이 짓는다" }); continue; }
    if (!isWorldSkeletonMap(map)) { skipped.push({ mapId: hint.mapId, why: "이미 내용이 있다" }); continue; }
    const text = `${hint.label ?? ""} ${hint.concept ?? ""} ${map.name ?? ""}`;
    const name = hint.label?.trim() || undefined;
    const ctx = { project: working };
    const result = role === "town"
      ? runToolDefinition(ctx, townRun(town), { mapId: hint.mapId, ...(name ? { name } : {}), houseCount: 3 }, { advisory: false })
      : runToolDefinition(ctx, dungeonRun(dungeon), { mapId: hint.mapId, type: dungeonTypeFor(role, text), size: "small", ...(name ? { name } : {}), ...(hint.concept ? { inspiration: hint.concept.slice(0, 120) } : {}) }, { advisory: false });
    if (result.ok && ctx.project !== working) { working = ctx.project; built.push(hint.mapId); }
    else skipped.push({ mapId: hint.mapId, why: result.summary.slice(0, 200) });
  }
  return { project: working, built, skipped };
}
