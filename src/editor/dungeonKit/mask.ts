// 던전 바닥 마스크 — 배치(layout)에서 「열린 칸·액체·다리·문 앞」 마스크까지(2026-10-15 장르별 던전 분리).
// 이 파일은 칩셋을 모른다. 버들항 어댑터(compose.ts)와 몬스터 키트 어댑터(dungeonKit/monsterAdapter.ts)가 같은 마스크를 받아
// 각자의 조각으로 칠한다 — 「배치 문법」과 「키트 어댑터」가 갈라지는 경계다.
//   입력: DungeonLayout(방·통로 사각형 또는 이미 만든 Grid) + 종류 프로필
//   출력: Grid(열린 칸 floor · 방 번호 roomAt · 액체 liquid · 다리 bridge · 문 앞 protect) + 칸막이 + 입구 칸
// 불변식은 grid.ts(fixThickness·thinWalls·settle)가 지킨다. compose.ts 에서 옮겨 왔을 뿐 rooms 문법의 출력은 그대로다.
import type { DungeonLayout, DungeonSpec, DungeonType, PlacedRoom } from "./types";
import { DungeonComposeError } from "./errors";
import { Grid, edgeDistance, rng, settle, vnoise, type Rect } from "./grid";
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
    if (r.shape === "round" || r.shape === "apse") {
      const k = Math.max(2, Math.floor(Math.min(r.w, r.h) / 3));
      for (let dy = 0; dy < k; dy += 1) for (let dx = 0; dx + dy < k; dx += 1) {
        const top = r.shape === "round" ? [[r.x + dx, r.y + dy], [r.x + r.w - 1 - dx, r.y + dy]] as const : [];
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
  if (type === "sewer") bridgeCount += addCrossings(g, rooms as readonly PlacedRoom[], seed);
  return { grid: g, partitions, bridgeCount, warnings, entranceStart };
}

/**
 * 물에 잠긴 던전(2026-10-22, 「물에 잠긴 옛 신전」 기준선: 조수가 fill_region 으로 네모 물웅덩이를 벽에 붙여 칠했다).
 * 큰 방(가로 8·세로 6 이상, 입구·보물 방 제외) 바닥 안쪽이 물에 잠긴다: 벽에서 두 칸 안쪽, 잡음으로 가장자리가 흔들리고,
 * 방 가운데를 가로·세로로 지나는 폭 3 둑길과 문 앞(protect)은 마른 땅으로 남는다. 갈라진 바닥은 settle 이 다리로 잇는다.
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
    const fw = fx1 - fx0 + 1, fh = fy1 - fy0 + 1;
    if (fw < 7 || fh < 5) return;
    const cx = fx0 + (fw - 1) / 2, cy = fy0 + (fh - 1) / 2;
    // 둑길: 긴 축 방향 한 줄은 늘 남기고, 짧은 축 둑은 큰 방에만(방이 네 웅덩이로 갈린다)
    const along = fw >= fh;
    // 가로지르는 둘째 둑길은 뺐다 — 방이 네모 웅덩이 넷으로 갈려 「잠긴 방」이 아니라 수조로 읽혔다(2026-10-23). 갈린 문은 settle 의 다리가 잇는다.
    const cross = false;
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
      const i = g.idx(x, y);
      if (!g.floor[i] || g.roomAt[i] !== ri || g.protect[i]) continue;
      // 벽 앞 한 줄만 마른 턱으로 남긴다 — 두 줄을 남기면 물이 방 가운데 웅덩이 몇 개로만 읽혔다(2026-10-23 VQA 「물에 잠긴 신전으로 안 읽힘」).
      if (ed[i]! < 1) continue;
      // 둑길은 곧은 줄이 아니라 굽이친다(물에 잠긴 바닥 위로 남은 옛 길) — 반듯한 수조 넷처럼 읽히던 것(2026-10-22 VQA).
      const bend = (t: number, k: number) => Math.round((vnoise(t, k, 5, seed * 23 + ri) - 0.5) * 3);
      const onSpine = along ? Math.abs(y - (cy + bend(x, 1))) <= 1 : Math.abs(x - (cx + bend(y, 2))) <= 1;
      const onCross = cross && (along ? Math.abs(x - (cx + bend(y, 3))) <= 1 : Math.abs(y - (cy + bend(x, 4))) <= 1);
      if (onSpine || onCross) continue;
      // 물 가장자리는 방 모양(네모)이 아니라 흔들리는 타원 덩이다(2026-10-23 assistant-dungeons-2, VQA 「사각 수조」).
      // 흔들림은 0.15 이하(PR #1450: 0.25 이상이면 덩이가 부서진다). 모서리·벽 쪽은 마른 바닥으로 남는다.
      // 둑길 양쪽 반쪽마다 엇갈린 타원 두 덩이(잎)를 겹친다 — 방 하나를 꽉 채운 한 타원은 벽을 따라 곧은 가장자리가 생겨 「돌 테 수조」로 읽혔다
      // (2026-10-23 dg2-r1 VQA). 잎 사이·모서리는 마른 바닥으로 남아 가장자리가 들쭉날쭉하다.
      const side = along ? (y < cy ? -1 : 1) : (x < cx ? -1 : 1);
      let dMin = Infinity;
      for (let lobe = 0; lobe < 2; lobe += 1) {
        const jit = (vnoise(lobe * 7 + side * 3, ri, 1, seed * 31) - 0.5) * 0.25;
        const off = (lobe === 0 ? -1 : 1) * (0.2 + jit);
        const lx = along ? cx + off * fw : cx + side * fw / 4;
        const ly = along ? cy + side * fh / 4 : cy + off * fh;
        const lrx = along ? Math.max(2.4, fw * 0.34) : Math.max(2, fw / 4 + 1.1);
        const lry = along ? Math.max(2, fh / 4 + 1.1) : Math.max(2.4, fh * 0.34);
        dMin = Math.min(dMin, ((x - lx) / lrx) ** 2 + ((y - ly) / lry) ** 2);
      }
      if (dMin > 1 + (vnoise(x, y, 2.5, seed * 19 + ri) - 0.5) * 0.3) continue;
      g.liquid[i] = 1; cells += 1;
    }
  });
  return cells;
}
