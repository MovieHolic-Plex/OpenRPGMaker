// 세계 장소 맵 사이 문의 도착 칸을 결정적으로 맞춘다. 순수 모듈 — 팀 첫 MVP finish(scripts/lib/piTeamRuntime.ts)와
// 뼈대 맵을 다시 지은 author_dungeon(src/editor/tools/dungeonTools.ts)이 부른다.
//
// 왜(2026-11-24 team-mvp-revive): 팀장이 build_world 로 장소 맵과 문을 먼저 선언하고(계약), 맵 담당은 자기 맵만 따로 짓는다.
// 담당이 생성기로 맵을 다시 지으면 맵 크기·길이 바뀌어, 다른 맵의 문이 가리키던 도착 칸이 벽·맵 밖이 된다.
// 예전엔 그 이음새를 팀장이 검수 → 수정 배정으로 LLM 왕복하며 고쳤고(실측: 숲→동굴 문 수정 두 번, 10분 넘게), finish 에 못 닿았다.
// 문 자체(이벤트·목적지 맵)는 계약 그대로 두고, 도착 칸만 «목적지 맵에서 돌아오는 문 바로 옆의 내려서 움직일 수 있는 칸» 으로 옮긴다.
import { isPassableLanding } from "@/project/collision";
import type { Command, GameEvent, GameMap, Project } from "@/project/types";

type Pt = { readonly x: number; readonly y: number };
type TransferCommand = Extract<Command, { kind: "transfer" }>;

const LAND_TAG = /^land:(\d+),(\d+)$/;
const GATE_TAG = /^gate:(\d+),(\d+)$/;
/** 돌아오는 문에서 이만큼(체비셰프) 안의 내려설 수 있는 칸이면 이미 맞는 도착 칸으로 둔다. */
const NEAR_RETURN = 2;
const RINGS: readonly Pt[] = [
  { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
  { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 },
  { x: 0, y: 2 }, { x: 0, y: -2 }, { x: 2, y: 0 }, { x: -2, y: 0 },
];

function transfersOf(event: GameEvent): TransferCommand[] {
  const lists = event.pages?.length ? event.pages.map((page) => page.commands ?? []) : [event.commands ?? []];
  return lists.flat().filter((command): command is TransferCommand => command.kind === "transfer");
}

function inside(map: GameMap, p: Pt): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height;
}

function standable(project: Project, map: GameMap, p: Pt): boolean {
  return inside(map, p) && isPassableLanding(project, map, p.x, p.y) && !map.events.some((event) => event.x === p.x && event.y === p.y);
}

/** 돌아오는 문 옆의 도착 칸. 던전 입구 표식에 도착 칸이 적혀 있으면 그 칸이 먼저다. */
function landingBeside(project: Project, map: GameMap, gate: Pt): Pt | null {
  for (const location of map.locations ?? []) {
    const tags = location.tags ?? [];
    const g = tags.map((tag) => GATE_TAG.exec(tag)).find(Boolean);
    const l = tags.map((tag) => LAND_TAG.exec(tag)).find(Boolean);
    if (g && l && Number(g[1]) === gate.x && Number(g[2]) === gate.y) {
      const p = { x: Number(l[1]), y: Number(l[2]) };
      if (standable(project, map, p)) return p;
    }
  }
  for (const d of RINGS) {
    const p = { x: gate.x + d.x, y: gate.y + d.y };
    if (standable(project, map, p)) return p;
  }
  return null;
}

/** 세계 그래프(build_world)의 장소 맵 — 프로젝트에 실제로 있는 맵만. */
function worldPlaceIds(project: Pick<Project, "maps" | "worldGraph">): Set<string> {
  return new Set((project.worldGraph?.nodes ?? []).map((node) => node.mapId).filter((id) => Boolean(project.maps[id])));
}

/**
 * 세계 장소 맵 사이 문의 도착 칸을 고친다(제자리). 고친 문마다 한 줄을 돌려준다.
 * `toMapId` 를 주면 그 맵으로 들어오는 문만 본다(그 맵을 방금 다시 지었을 때).
 * 목적지 맵에 돌아오는 문이 없거나 그 옆에 내려설 칸이 없으면 건드리지 않는다(이음새 검사가 보고한다).
 */
export function repairWorldTransfers(project: Project, options: { readonly toMapId?: string } = {}): string[] {
  const nodes = worldPlaceIds(project);
  const fixed: string[] = [];
  for (const fromId of nodes) {
    const from = project.maps[fromId]!;
    for (const event of from.events) {
      for (const command of transfersOf(event)) {
        const toId = command.mapId;
        if (!toId || toId === fromId || !nodes.has(toId) || (options.toMapId && toId !== options.toMapId)) continue;
        const to = project.maps[toId]!;
        const returns = to.events.filter((candidate) => transfersOf(candidate).some((back) => back.mapId === fromId));
        if (returns.length === 0) continue;
        const target = { x: command.x, y: command.y };
        const nearest = [...returns].sort((a, b) => (Math.abs(a.x - target.x) + Math.abs(a.y - target.y)) - (Math.abs(b.x - target.x) + Math.abs(b.y - target.y)))[0]!;
        const near = Math.max(Math.abs(nearest.x - target.x), Math.abs(nearest.y - target.y));
        if (near > 0 && near <= NEAR_RETURN && standable(project, to, target)) continue;
        const landing = landingBeside(project, to, nearest);
        if (!landing) continue;
        command.x = landing.x;
        command.y = landing.y;
        fixed.push(`${from.name ?? fromId} 문(${event.x},${event.y}) → ${to.name ?? toId} 도착 (${target.x},${target.y})→(${landing.x},${landing.y})`);
      }
    }
  }
  return fixed;
}
