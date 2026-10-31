// ai/gameStructureGuard.ts
// 조수가 「완성」이라고 말하기 전에 막는 구조 가드 — 시작 맵·맵 도달성·엔딩 호출.
//
// 왜 필요한가 (2026-10-15 CT 감사): 조수 3판 모두 맵 3개와 전투 일부는 만들었지만 `qa:game check` 가 막혔다 —
// 시작 위치가 여전히 빈 시드 맵이거나, 만든 맵이 시작 맵에서 문으로 닿지 않거나, 엔딩을 부르는 이벤트가 없었다.
// 이 셋은 「맵을 더 칠하면」 풀리지 않고 **특정 도구 한 번**으로 풀린다. 그래서 메시지가 다음 도구와 인자를 이름으로 준다.
// 순수 함수다(프로젝트만 읽는다). adventureCompletionProblems 가 부른다.

import { isPassable } from "@/project/collision";
import { isUntouchedMap } from "@/project/projectBlankness";
import { buildMapGraph } from "@/qa/gameCheck/mapGraph";
import { projectScriptMentionsCmdKind } from "@/project/script/effects";
import { visitAllCommands } from "@/qa/gameCheck/walk";
import type { GameMap, Project } from "@/project/types";

/** 시드 빈 맵 id(createBlankProject 가 만든다). */
const SEED_MAP_ID = "map_blank_start";

function authoredMaps(project: Project): GameMap[] {
  return Object.values(project.maps).filter((map) => !(map.id === SEED_MAP_ID && isUntouchedMap(map)));
}

/** 맵에서 걸어 설 수 있는 첫 칸(중앙에서 가까운 순). 없으면 undefined. */
function firstStandableCell(project: Project, map: GameMap): { x: number; y: number } | undefined {
  const cx = Math.floor(map.width / 2), cy = Math.floor(map.height / 2);
  let best: { x: number; y: number; d: number } | undefined;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!isPassable(project, map, x, y)) continue;
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  return best ? { x: best.x, y: best.y } : undefined;
}

function mapLabel(map: GameMap): string {
  return `'${map.name}'(${map.id})`;
}

/**
 * 구조 문제 목록. 맵이 둘 이상 저작된 프로젝트에서만 의미가 있어 그 밖이면 빈 배열이다.
 * 메시지마다 **다음에 부를 도구와 인자**를 담는다 — 모델이 어느 도구로 고칠지 추측하지 않게.
 */
export function gameStructureProblems(project: Project): string[] {
  const maps = authoredMaps(project);
  if (maps.length < 2) return [];
  const problems: string[] = [];
  const start = project.maps[project.startMapId];

  // 1) 시작 맵 — 빈 시드 맵이 시작으로 남았다.
  if (!start || (start.id === SEED_MAP_ID && isUntouchedMap(start))) {
    const target = maps.find((map) => map.events.length > 0) ?? maps[0]!;
    const cell = firstStandableCell(project, target);
    problems.push(
      `게임 시작 위치가 아직 ${start ? `빈 시드 맵 ${mapLabel(start)}` : "없는 맵"}입니다 — 플레이를 누르면 지은 게임이 아니라 빈 방에서 시작합니다. `
      + `set_start_position({mapId:"${target.id}"${cell ? `, x:${cell.x}, y:${cell.y}` : ", x, y"}}) 을 부르세요.`,
    );
  }

  // 2) 맵 도달성 — 시작 맵에서 문으로 갈 수 없는 저작 맵.
  const graph = buildMapGraph(project);
  const startId = start && !(start.id === SEED_MAP_ID && isUntouchedMap(start)) ? start.id : maps[0]!.id;
  // 시작을 고쳐야 하는 경우엔 고칠 시작 맵 기준으로 도달성을 다시 센다.
  const reachable = startId === project.startMapId ? graph.reachable : reachFrom(graph.edges, startId, project);
  const stranded = maps.filter((map) => map.id !== startId && !reachable.has(map.id));
  // 스크립트가 계산된 맵 id 로 game.transfer 하면 도달성을 증명할 수 없다 — 막지 않는다(qa:game 은 info 로 남긴다).
  if (stranded.length > 0 && !graph.dynamicScriptTransfers) {
    const anchor = project.maps[startId]!;
    const anchorCell = firstStandableCell(project, anchor);
    const lines = stranded.slice(0, 6).map((map) => {
      const cell = firstStandableCell(project, map);
      return `${mapLabel(map)} → create_transfer_pair({a:{mapId:"${anchor.id}", x:${anchorCell?.x ?? "x"}, y:${anchorCell?.y ?? "y"}}, b:{mapId:"${map.id}", x:${cell?.x ?? "x"}, y:${cell?.y ?? "y"}}})`
        + `(시대를 건너는 문이면 create_time_gate 같은 인자, 이미 지나온 맵을 거친다면 a 를 그 맵으로)`;
    });
    problems.push(`시작 맵 ${mapLabel(anchor)} 에서 문으로 닿지 않는 맵 ${stranded.length}개가 있습니다 — 플레이어는 거기 갈 수 없습니다. ${lines.join(" / ")}`);
  }

  // 3) 엔딩 — 정의가 없거나 부르는 이벤트가 없다.
  let triggers = 0;
  visitAllCommands(project, ({ command }) => { if (command.kind === "triggerEnding" || command.kind === "ending") triggers += 1; });
  // 스크립트의 game.cmd({kind:"triggerEnding"}) 도 엔딩 호출이다(effects 에는 명령 종류가 남지 않아 글로 본다).
  if (triggers === 0 && !projectScriptMentionsCmdKind(project, "triggerEnding") && !projectScriptMentionsCmdKind(project, "ending")) {
    const endings = project.endings ?? [];
    problems.push(
      endings.length > 0
        ? `엔딩 ${endings.length}개(${endings.slice(0, 3).map((ending) => ending.id).join(", ")})가 정의만 있고 부르는 이벤트가 없어 게임을 끝낼 수 없습니다 — 마지막 사건 이벤트의 commands 끝에 upsert_event/patch_event_page 로 {kind:"triggerEnding", endingId:"${endings[0]!.id}"} 를 넣으세요.`
        : `게임을 끝내는 엔딩이 없습니다 — define_ending({id, name, conditions:[], epilogue?}) 으로 정의한 뒤, 마지막 사건 이벤트의 commands 끝에 {kind:"triggerEnding", endingId} 를 upsert_event/patch_event_page 로 넣으세요.`,
    );
  }
  return problems;
}

type Edge = ReturnType<typeof buildMapGraph>["edges"][number];

function reachFrom(edges: readonly Edge[], startId: string, project: Project): Set<string> {
  const seen = new Set<string>();
  const queue = [startId];
  const anywhere = edges.filter((edge) => edge.from === null).map((edge) => edge.to);
  let anywhereAdded = false;
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of edges) if (edge.from === id && project.maps[edge.to] && !seen.has(edge.to)) queue.push(edge.to);
    if (!anywhereAdded) { anywhereAdded = true; queue.push(...anywhere.filter((to) => project.maps[to])); }
  }
  return seen;
}
