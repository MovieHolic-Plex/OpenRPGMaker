// 조수 v2 — 실내에서 사람이 서기에 나쁜 칸의 비용(문 곁·가구의 하나뿐인 접근 칸·문틈·양탄자).
import type { GameMap, Project } from "@/project/types";
import { terrainReachability } from "@/project/terrainReachability";
import { Cell, DIRS, eventsOf, hasTransfer, transferCells, walkStart, dist, edgeExitCells, groundBlocks, tileLabel, layers, objectAt } from "./cells";

// ── 실내 사람 자리 비용 ──────────────────────────────────────────────────────
// 2026-10-29 room-vig6 tavern 88: 주인·선원·일꾼 셋이 양탄자 윗머리에 위아래로 붙어 섰다(판정 「NPC 가 겹쳐 서서 카펫 시작부를 막는다」).
// 이 칸들이 «못 서는 칸»은 아니다 — 다른 곳이 없으면 선다. 그래서 금지가 아니라 비용으로, 같은 비용 계산을 놓을 때(resolveWhere)와
// 끝맺음·다시 짓기 뒤(eventReach spreadCrowdedPeople)에 같이 쓴다. 비용 4 이상 = 길·가구·문을 막는 자리(양탄자는 이어진 칸 6 이상인 큰 것만 — 침대 밑 깔개는 괜찮다).
const RUG_LABEL = /양탄자|카펫|러그|깔개|carpet|rug/iu;

export const PERSON_SPOT_BAD = 4;

interface PersonSpotContext { readonly reach: Uint8Array; readonly doors: readonly Cell[]; readonly others: ReadonlySet<number>; readonly bigRug: ReadonlySet<number> }

/** 큰 양탄자(이어진 칸 6 이상 — 통로 러너·홀 카펫) 칸. 침대 밑 작은 깔개는 서도 된다. */
function bigRugCells(project: Project, map: GameMap): Set<number> {
  const w = map.width, n = w * map.height;
  const { lowerOverlay } = layers(map);
  const rug = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (RUG_LABEL.test(tileLabel(project, map, lowerOverlay?.[i]))) rug[i] = 1;
  const out = new Set<number>(), seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!rug[i] || seen[i]) continue;
    const comp = [i]; seen[i] = 1;
    for (let k = 0; k < comp.length; k++) {
      const j = comp[k]!, x = j % w, y = (j - x) / w;
      for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, m = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < map.height && rug[m] && !seen[m]) { seen[m] = 1; comp.push(m); } }
    }
    if (comp.length >= 6) for (const j of comp) out.add(j);
  }
  return out;
}

export function personSpotContext(project: Project, map: GameMap, exceptId?: string): PersonSpotContext {
  const start = walkStart(project, map);
  const reach = terrainReachability(project, map, start);
  const others = new Set<number>();
  for (const e of eventsOf(map)) if (e.id !== exceptId && !hasTransfer(e)) others.add(e.y * map.width + e.x);
  return { reach, doors: [...transferCells(map), ...edgeExitCells(map, reach)], others, bigRug: bigRugCells(project, map) };
}

/** 실내에서 사람이 이 칸에 서면 드는 비용(0 = 괜찮다). 문 곁 2칸 안 6 · 가구의 하나뿐인 접근 칸 6 · 가구 그림 칸 위 4 · 벽 사이 한 칸 문틈 6 · 다른 사람 바로 위·아래 4(옆 1) · 큰 양탄자(통로 러너·홀 카펫) 위 4. */
export function personSpotCost(project: Project, map: GameMap, c: Cell, ctx: PersonSpotContext): number {
  const w = map.width, h = map.height;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  let cost = 0;
  if (ctx.doors.some((d) => dist(d, c) < 2)) cost += 6;
  for (const [dx, dy] of DIRS) {
    const nx = c.x + dx, ny = c.y + dy;
    if (!inside(nx, ny) || !objectAt(map, { x: nx, y: ny })) continue;
    if (groundBlocks(project, map, { x: nx, y: ny })) continue; // 벽에 건 그림·창(바닥층이 벽인 칸)은 앞을 막아도 쓸 수 있다
    let open = 0;
    for (const [ex, ey] of DIRS) {
      const mx = nx + ex, my = ny + ey;
      if (!inside(mx, my) || (mx === c.x && my === c.y)) continue;
      const j = my * w + mx;
      if (ctx.reach[j] && !objectAt(map, { x: mx, y: my }) && !ctx.others.has(j)) open++;
    }
    if (!open) { cost += 6; break; }
  }
  // 가구 그림 칸(바 의자 줄·가구 윗칸) 위에 선 사람 — 의자에 파묻힌 것처럼 읽혔다(2026-10-29 vm4 terra mystery 「빨간 머리 NPC 가 의자와 장작에 파묻힘」).
  if (objectAt(map, c)) cost += 4;
  // 칸막이 벽 사이 한 칸 틈(방과 방을 잇는 문틈) — 양옆이 가구 아닌 벽이고 앞뒤가 열렸다. 그 자리에 선 사람은 벽에 박혀 보이고 길을 막는다
  // (2026-10-29 vm4 deepseek mystery 「흰머리 NPC 가 두 방을 가르는 벽 틈에 끼어」 major 셋). 카운터 뒤 주인 줄(앞뒤가 벽·카운터)은 가구라 아니다.
  const wallAt = (x: number, y: number) => !inside(x, y) || (!ctx.reach[y * w + x] && !objectAt(map, { x, y }));
  const openAt = (x: number, y: number) => inside(x, y) && !!ctx.reach[y * w + x];
  if ((wallAt(c.x - 1, c.y) && wallAt(c.x + 1, c.y) && openAt(c.x, c.y - 1) && openAt(c.x, c.y + 1))
    || (wallAt(c.x, c.y - 1) && wallAt(c.x, c.y + 1) && openAt(c.x - 1, c.y) && openAt(c.x + 1, c.y))) cost += 6;
  const has = (x: number, y: number) => inside(x, y) && ctx.others.has(y * w + x);
  if (has(c.x, c.y - 1) || has(c.x, c.y + 1)) cost += 4;
  else if (has(c.x - 1, c.y) || has(c.x + 1, c.y)) cost += 1;
  if (ctx.bigRug.has(c.y * w + c.x)) cost += 4;
  return cost;
}
