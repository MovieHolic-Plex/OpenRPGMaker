// 던전 바닥 마스크 — 배치(layout)에서 「열린 칸·액체·다리·문 앞」 마스크까지(2026-10-15 장르별 던전 분리).
// 이 파일은 칩셋을 모른다. 버들항 어댑터(compose.ts)와 몬스터 키트 어댑터(dungeonKit/monsterAdapter.ts)가 같은 마스크를 받아
// 각자의 조각으로 칠한다 — 「배치 문법」과 「키트 어댑터」가 갈라지는 경계다.
//   입력: DungeonLayout(방·통로 사각형 또는 이미 만든 Grid) + 종류 프로필
//   출력: Grid(열린 칸 floor · 방 번호 roomAt · 액체 liquid · 다리 bridge · 문 앞 protect) + 칸막이 + 입구 칸
// 불변식은 grid.ts(fixThickness·thinWalls·settle)가 지킨다. compose.ts 에서 옮겨 왔을 뿐 rooms 문법의 출력은 그대로다.
import type { DungeonLayout, DungeonSpec, DungeonType, PlacedRoom } from "./types";
import { DungeonComposeError } from "./errors";
import { Grid, WALL_ROWS, edgeDistance, fixThickness, rng, settle, vnoise, type Rect } from "./grid";
import { addCrossings, carveSewer } from "./layouts";
import type { GrammarInfo } from "./grammar";

export interface DungeonMask {
  readonly grid: Grid;
  /** 감방 칸막이(벽 앞면 3줄로 서는 1칸 폭 기둥). */
  readonly partitions: { room: string; x: number; y: number; h: number }[];
  readonly bridgeCount: number;
  readonly warnings: string[];
  /** 입구 방의 걸을 수 있는 칸(Grid 인덱스) — 연결 검사의 시작점. */
  readonly entranceStart: number;
}

export function buildMask(layout: DungeonLayout, profile: GrammarInfo, type: DungeonType, spec: DungeonSpec, seed: number): DungeonMask {
  const { width: W, height: H, rooms, corridors } = layout;
  const idx = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const g = layout.grid ?? new Grid(W, H);
  const floorMask = g.floor;
  const roomAt = g.roomAt;
  const liquid = g.liquid;
  const bridge = g.bridge;
  const warnings: string[] = [...layout.notes];
  if (layout.grid && spec.rooms?.length) warnings.push(`${profile.label} 은 방 목록(rooms)을 받지 않는다 — 방은 코드가 정한다(rooms 무시). 방 수·크기는 size·width·height 로 고른다.`);
  if (!layout.grid) {
    const odd = [...new Set(rooms.filter((r) => !profile.roomKinds.includes(r.kind)).map((r) => r.kind))];
    if (odd.length) warnings.push(`방 종류 ${odd.join("·")} 은(는) ${profile.label}(${type}) 에 맞는 종류가 아니다 — 그 방은 장식이 비어 있다. ${type} 의 방 종류: ${profile.roomKinds.join(" ")}.`);
  }

  // ---- 바닥 마스크: 통로 → 방(방 모양 흔들기: 모따기·감방 칸막이) ----
  const markRect = (r: Rect, roomIndex: number, v = 1) => {
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
      if (!inb(x, y)) continue;
      floorMask[idx(x, y)] = v; roomAt[idx(x, y)] = v ? roomIndex : -1;
      if (!v) { liquid[idx(x, y)] = 0; bridge[idx(x, y)] = 0; }
    }
  };
  if (!layout.grid) {
    for (const c of corridors) markRect(c.rect, -1);
    rooms.forEach((room, i) => markRect(room, i));
  }
  // 통로가 방에 닿는 문 칸(방 안쪽 첫 칸 + 한 칸 더) — 모따기·칸막이·물건이 막지 않는다.
  const doorstep = g.protect;
  for (const c of corridors) {
    const r = c.rect;
    const mark = (x: number, y: number) => { if (inb(x, y)) doorstep[idx(x, y)] = 1; };
    for (let k = -1; k <= 2; k += 1) {
      if (c.dir === "N" || c.dir === "S") for (let x = r.x - 1; x <= r.x + r.w; x += 1) { mark(x, r.y - 1 - k); mark(x, r.y + r.h + k); }
      else for (let y = r.y - 1; y <= r.y + r.h; y += 1) { mark(r.x - 1 - k, y); mark(r.x + r.w + k, y); }
    }
  }
  const notchable = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) if (!inb(x, y) || doorstep[idx(x, y)]) return false;
    return true;
  };
  const partitions: { room: string; x: number; y: number; h: number }[] = [];
  (layout.grid ? [] : rooms).forEach((r, i) => {
    const rs = rng(seed * 31 + i * 977 + 5);
    // 둥근 방(탑 층): 네 모서리를 비스듬히 깎아 팔각으로 — 탑이 「넓은 지하 감옥」으로 읽히던 것(2026-10-23 VQA). 문 앞 칸은 깎지 않는다.
    if (r.shape === "round" || r.shape === "apse" || r.shape === "ring") {
      const k = Math.max(2, Math.floor(Math.min(r.w, r.h) / 3));
      for (let dy = 0; dy < k; dy += 1) for (let dx = 0; dx + dy < k; dx += 1) {
        const top = r.shape !== "apse" ? [[r.x + dx, r.y + dy], [r.x + r.w - 1 - dx, r.y + dy]] as const : [];
        for (const [x, y] of [...top, [r.x + dx, r.y + r.h - 1 - dy], [r.x + r.w - 1 - dx, r.y + r.h - 1 - dy]] as const) {
          if (!inb(x, y) || doorstep[idx(x, y)]) continue;
          markRect({ x, y, w: 1, h: 1 }, -1, 0);
        }
      }
      return;
    }
    // 모서리 모따기: 큰 방의 모서리 한두 곳을 1~2칸 깎는다(벽이 한 단 앞으로 나온다). 같은 종류 방이 판박이가 되지 않게.
    if (r.w >= 10 && r.h >= 7 && r.kind !== "cell") {
      const corners: [number, number, boolean][] = [[r.x, r.y, true], [r.x + r.w, r.y, true], [r.x, r.y + r.h, false], [r.x + r.w, r.y + r.h, false]];
      let cut = 0;
      for (const [cx, , top] of corners.sort(() => rs() - 0.5)) {
        if (cut >= (r.w >= 14 ? 2 : 1) || rs() < 0.35) continue;
        const nw = rs() < 0.5 ? 1 : 2, nh = top ? 1 + (rs() < 0.4 ? 1 : 0) : 1;
        const x0 = cx === r.x ? r.x : r.x + r.w - nw, y0 = top ? r.y : r.y + r.h - nh;
        if (!notchable(x0 - 1, y0 - 1, nw + 2, nh + 2)) continue;
        markRect({ x: x0, y: y0, w: nw, h: nh }, -1, 0);
        cut += 1;
      }
    }
    // 감방: 북쪽 벽에 붙은 칸막이(천장 1칸 폭, 3줄)로 폭 3 감방을 나눈다 — 칸막이는 벽 앞면 3줄로 선다.
    if (r.kind === "cell" && r.w >= 9 && r.h >= 6) {
      for (let x = r.x + 3; x < r.x + r.w - 2; x += 4) {
        if (!notchable(x, r.y, 1, 3)) continue;
        markRect({ x, y: r.y, w: 1, h: 3 }, -1, 0);
        partitions.push({ room: r.id, x, y: r.y, h: 3 });
      }
    }
  });

  // ---- 액체(수로·저수조) + 벽 두께·연결 정리: 물·용암은 걸을 수 없는 열린 칸, 갈라진 바닥은 다리로 잇는다. ----
  let bridgeCount = 0;
  const entranceStart = ((): number => {
    const e = rooms[0]!;
    for (let r = 0; r < 12; r += 1) for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
      const x = e.x + Math.floor(e.w / 2) + dx, y = e.y + e.h - 2 + dy;
      if (g.walk(x, y)) return idx(x, y);
    }
    throw new DungeonComposeError("입구 방에 걸을 수 있는 바닥이 없다.", "no-entrance");
  })();
  if (type === "sewer") carveSewer(g, rooms as readonly PlacedRoom[], seed);
  const flooded = !!spec.flooded && !profile.liquid && !layout.thin;
  if (flooded) carveFlood(g, rooms as readonly PlacedRoom[], seed);
  if ((profile.liquid || layout.grid || flooded) && !layout.thin) {
    const st = settle(g, entranceStart, rng(seed * 313 + 7));
    bridgeCount += st.bridges;
    if (st.removed) warnings.push(`닿지 않는 바닥 ${st.removed}칸을 막았다(액체로 갈라져 다리를 놓을 수 없는 조각).`);
  }
  // 방+통로 배치도 두께 규칙만은 늘 맞춘다 — 나란한 방·통로 사이 한 칸 벽(천장 1칸 + 앞면)이 두 벽 사이 검은 틈 기둥으로 읽혔다(2026-10-25 floor VQA r4 catacomb·castle).
  else if (!layout.thin) fixThickness(g);
  if (type === "sewer") bridgeCount += addCrossings(g, rooms as readonly PlacedRoom[], seed);
  return { grid: g, partitions, bridgeCount, warnings, entranceStart };
}

/**
 * 물에 잠긴 던전(2026-10-22, 「물에 잠긴 옛 신전」 기준선: 조수가 fill_region 으로 네모 물웅덩이를 벽에 붙여 칠했다).
 * 큰 방(입구·보물 방 제외, 벽 둘레 2칸 안쪽이 6×4 이상) 가운데가 겹친 둥근 덩이(메타볼)로 잠긴다. 벽 둘레 두 칸 회랑과 문 앞(protect)은
 * 마른 땅으로 남아 모든 문이 이어진다(2026-10-23 assistant-dungeons-2: 둑길로 가르던 판은 「돌 테 수조」로 읽혔다).
 */
export function carveFlood(g: Grid, rooms: readonly PlacedRoom[], seed: number): number {
  const ed = edgeDistance(g, 4);
  let cells = 0;
  rooms.forEach((r, ri) => {
    if (r.kind === "entrance" || r.kind === "vault" || r.w < 7 || r.h < 5) return;
    // 중심·크기는 방 사각형이 아니라 그 방의 실제 바닥 상자로 잰다 — 방 사각형은 북쪽 벽 앞면 줄을 품어 물 덩이가 북벽에 붙어 잘렸고,
    // 그 잘린 곧은 윗변이 「돌 테 수조」로 읽혔다(2026-10-23 dg2-r1 VQA).
    let fx0 = Infinity, fy0 = Infinity, fx1 = -1, fy1 = -1;
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
      const i = g.idx(x, y);
      if (!g.floor[i] || g.roomAt[i] !== ri) continue;
      fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); fy0 = Math.min(fy0, y); fy1 = Math.max(fy1, y);
    }
    if (fx1 < 0) return;
    // 이 단계의 바닥 마스크는 방 사각형 맨 위 벽 앞면 줄(WALL_ROWS)까지 품는다 — 그 줄은 벽이 된다. 걷는 바닥은 그 아래부터.
    fy0 += WALL_ROWS;
    const fw = fx1 - fx0 + 1, fh = fy1 - fy0 + 1;
    if (fw < 7 || fh < 5) return;
    const rnd = rng(seed * 977 + ri * 131 + 5);
    // 덩이는 회랑(벽 둘레 2칸) 안쪽 넓이보다 작아야 가장자리가 둥글다 — 크면 회랑에 잘려 다시 네모가 됐다.
    // 회랑: 북쪽(벽 앞면 아래) 두 줄, 나머지 세 변은 한 줄.
    const iw = fw - 2, ih = fh - 3;
    if (iw < 8 || ih < 5) return;   // 안쪽이 좁은 방(보스 제단방·곁방)은 마른 채로 — 작은 못은 네모 수조로만 읽혔다
    // 덩이 묶음 후보 12개 중 안쪽 넓이의 8할쯤을 덮는 묶음을 고른다 — 다 덮으면 안쪽 사각형 그대로(네모 수조)였다.
    const inBlob = (bs: { x: number; y: number; r: number }[], x: number, y: number) => bs.some((b) => Math.hypot(x - b.x, (y - b.y) * 1.15) / b.r < 1 + (vnoise(x, y, 2.2, seed * 19 + ri) - 0.5) * 0.3);
    let blobs: { x: number; y: number; r: number }[] = [];
    let bestCov = Infinity;
    for (let t = 0; t < 12; t += 1) {
      const n = 3 + Math.floor(rnd() * 2) + (iw * ih >= 60 ? 1 : 0);
      const cand = Array.from({ length: n }, () => {
        const r0 = Math.max(1.6, (Math.min(iw, ih) / 2) * (0.45 + rnd() * 0.35) + 0.5);
        return { x: fx0 + 1 + rnd() * (iw - 1), y: fy0 + 2 + rnd() * (ih - 1), r: r0 };
      });
      let cov = 0;
      for (let y = fy0 + 2; y < fy0 + 2 + ih; y += 1) for (let x = fx0 + 1; x < fx0 + 1 + iw; x += 1) if (inBlob(cand, x, y)) cov += 1;
      const d = Math.abs(cov / (iw * ih) - 0.72);
      if (d < bestCov) { bestCov = d; blobs = cand; }
    }
    // 물은 벽까지 차오르게(minEd 0) 먼저 해 보고, 마른 바닥이 문들 사이에서 갈리면(다리가 필요하면) 벽가 길 한 칸(1)·두 칸(2)으로 물러난다.
    // 다리 칸은 계단처럼 읽혀 「물속 가짜 계단」이 됐고(2026-10-23 dg2-r7 VQA M3), 벽가 마른 길이 늘 둘러 있으면 「가운데 장식 못」으로 읽혔다(M6).
    const clearRoom = () => { for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) { const i = g.idx(x, y); if (g.roomAt[i] === ri) g.liquid[i] = 0; } };
    const carve = (minEd: number) => {
      for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
        const i = g.idx(x, y);
        if (!g.floor[i] || g.roomAt[i] !== ri || g.protect[i]) continue;
        // 벽 둘레 두 칸은 마른 회랑으로 남기고(문·벽가 길), 물은 방 가운데 둥근 덩이로 고인다. 둑길로 방을 가르면 물이 벽에 붙은 곧은 띠 둘이 되어
        // 「돌 테 수조」로 읽혔다(2026-10-23 dg2-r1·r4 VQA). 회랑이 늘 이어지므로 다리 없이도 모든 문에 닿는다.
        if (ed[i]! < minEd || y < fy0 + 2) continue;
        // 물은 방 안에 겹친 둥근 덩이 여럿(메타볼)의 합집합이다 — 한 타원·두 잎은 직사각형 방 안에서 곧은 변이 생겨 「돌 테 수조」로 읽혔다
        // (2026-10-23 dg2-r1·r4 VQA). 덩이 가장자리 흔들림은 ≤0.15(PR #1450). 같은 운하 오토타일로 동굴 호수는 불규칙하게 읽혔다.
        if (!inBlob(blobs, x, y)) continue;
        g.liquid[i] = 1;
      }
      // 한 칸 폭 물줄(물 이웃이 하나 이하)은 마른 바닥으로 — 덩이 가장자리 잡음이 남긴 실선 물길(두 번).
      for (let pass = 0; pass < 2; pass += 1) for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
        const i0 = g.idx(x, y);
        if (!g.liquid[i0] || g.roomAt[i0] !== ri) continue;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => g.inb(x + dx!, y + dy!) && g.liquid[g.idx(x + dx!, y + dy!)]).length;
        const hz = (g.inb(x - 1, y) && g.liquid[g.idx(x - 1, y)]) || (g.inb(x + 1, y) && g.liquid[g.idx(x + 1, y)]);
        const vt = (g.inb(x, y - 1) && g.liquid[g.idx(x, y - 1)]) || (g.inb(x, y + 1) && g.liquid[g.idx(x, y + 1)]);
        if (nb <= 1 || !hz || !vt) { g.liquid[i0] = 0; }
      }
      // 한두 칸짜리 웅덩이(6칸 미만)는 마른 바닥으로 — 「외딴 한 칸 물웅덩이」(2026-10-23 dg2-r4 VQA).
      const seenL = new Set<number>();
      for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
        const i0 = g.idx(x, y);
        if (!g.liquid[i0] || seenL.has(i0) || g.roomAt[i0] !== ri) continue;
        const comp = [i0]; seenL.add(i0);
        for (let k = 0; k < comp.length; k += 1) {
          const c = comp[k]!, X = c % g.W, Y = (c / g.W) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const n = g.idx(X + dx, Y + dy); if (g.inb(X + dx, Y + dy) && g.liquid[n] && !seenL.has(n)) { seenL.add(n); comp.push(n); } }
        }
        if (comp.length < 6) for (const c of comp) g.liquid[c] = 0;
      }
    };
    const dryConnected = (): boolean => {
      // 문턱(방 밖 바닥과 닿는 칸·보호 칸)이 모두 한 마른 덩이에 있으면 통과. 문이 없는 마른 주머니(물에 갇힌 벽가 띠)는 물로 채운다 — 벽까지 찬 물.
      const isDry = (i: number) => g.floor[i] && g.roomAt[i] === ri && !g.liquid[i];
      const comp = new Int32Array(g.W * g.H).fill(-1);
      const doorComps = new Set<number>();
      let nc = 0;
      for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
        const s0 = g.idx(x, y);
        if (!isDry(s0) || comp[s0]! >= 0) continue;
        const q = [s0]; comp[s0] = nc;
        for (let k = 0; k < q.length; k += 1) {
          const c = q[k]!, X = c % g.W, Y = (c / g.W) | 0;
          if (g.protect[c]) doorComps.add(nc);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            if (!g.inb(X + dx, Y + dy)) continue;
            const n = g.idx(X + dx, Y + dy);
            if (g.floor[n] && g.roomAt[n] !== ri) doorComps.add(nc);
            if (isDry(n) && comp[n]! < 0) { comp[n] = nc; q.push(n); }
          }
        }
        nc += 1;
      }
      if (doorComps.size !== 1) return false;
      const keep = [...doorComps][0]!;
      for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) { const i = g.idx(x, y); if (comp[i]! >= 0 && comp[i] !== keep && !g.protect[i]) g.liquid[i] = 1; }
      return true;
    };
    let ok = false;
    for (const minEd of [0, 1, 2]) { clearRoom(); carve(minEd); if (dryConnected()) { ok = true; break; } }
    if (!ok) clearRoom();
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) if (g.liquid[g.idx(x, y)] && g.roomAt[g.idx(x, y)] === ri) cells += 1;
  });
  return cells;
}
