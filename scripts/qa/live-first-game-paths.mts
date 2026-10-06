// Read-only navigation planning. Playback uses real keyboard input and checks
// every tile; this never edits the saved/exported project or runtime state.
import { readFileSync } from 'node:fs';
import { canMove } from '../../src/project/collision';
import type { Project, GameMap, GameEvent } from '../../src/project/types';

const project: Project = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));
type Point = { x: number; y: number };
const active = (event: GameEvent) => event.pages?.find(page => !page.conditions.length) ?? event.pages?.[0];
function navigate(map: GameMap, from: Point, target: GameEvent) {
  const page = active(target)!;
  const beside = page.priority === 'same';
  const goals = beside ? [
    { x: target.x - 1, y: target.y, face: 'ArrowRight' },
    { x: target.x + 1, y: target.y, face: 'ArrowLeft' },
    { x: target.x, y: target.y - 1, face: 'ArrowDown' },
    { x: target.x, y: target.y + 1, face: 'ArrowUp' },
  ] : [{ x: target.x, y: target.y, face: undefined }];
  const blocked = new Set(map.events.filter(event => active(event)?.priority === 'same')
    .map(event => `${event.x},${event.y}`));
  const key = (point: Point) => `${point.x},${point.y}`;
  const queue = [from], parent = new Map<string, { prev: Point; key: string }>();
  const visited = new Set([key(from)]);
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i]!;
    const goal = goals.find(goal => goal.x === point.x && goal.y === point.y);
    if (goal) {
      const steps: Array<Point & { key: string }> = [];
      let cursor = point;
      while (key(cursor) !== key(from)) {
        const edge = parent.get(key(cursor))!;
        steps.push({ ...cursor, key: edge.key }); cursor = edge.prev;
      }
      return { steps: steps.reverse(), position: { x: goal.x, y: goal.y },
        face: goal.face, trigger: page.trigger.kind, target: { id: target.id, x: target.x, y: target.y } };
    }
    for (const [dx, dy, arrow] of [[1, 0, 'ArrowRight'], [-1, 0, 'ArrowLeft'], [0, 1, 'ArrowDown'], [0, -1, 'ArrowUp']] as const) {
      const next = { x: point.x + dx, y: point.y + dy };
      if (visited.has(key(next)) || blocked.has(key(next)) || !canMove(project, map, point.x, point.y, next.x, next.y)) continue;
      visited.add(key(next)); parent.set(key(next), { prev: point, key: arrow }); queue.push(next);
    }
  }
  throw Error(`정상 통행 경로가 없습니다: ${map.id}/${target.id}`);
}
const start = project.maps[project.startMapId]!;
const starter = start.events.find(event => event.id === 'ev_segment_starter')!;
const route = project.maps.map_segment_route!;
const end = route.events.find(event => event.id === 'ev_segment_end')!;
const gate = start.events.find(event => event.pages?.some(page => page.commands.some(command => command.kind === 'transfer' && command.mapId === route.id)))!;
const transfer = gate.pages!.flatMap(page => page.commands).find(command => command.kind === 'transfer' && command.mapId === route.id)!;
if (transfer.kind !== 'transfer') throw Error('기억의 길 입구가 없습니다.');
const clockPath = navigate(start, project.startPos, starter);
console.log(JSON.stringify({ clock: clockPath, gate: navigate(start, clockPath.position, gate),
  ending: navigate(route, { x: transfer.x, y: transfer.y }, end), arrival: transfer }));
