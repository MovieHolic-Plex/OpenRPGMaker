// 던전 바닥 마스크 — 배치(layout)에서 「열린 칸·액체·다리·문 앞」 마스크까지(2026-10-15 장르별 던전 분리).
// 이 파일은 칩셋을 모른다. 버들항 어댑터(compose.ts)와 몬스터 키트 어댑터(dungeonKit/monsterAdapter.ts)가 같은 마스크를 받아
// 각자의 조각으로 칠한다 — 「배치 문법」과 「키트 어댑터」가 갈라지는 경계다.
//   입력: DungeonLayout(방·통로 사각형 또는 이미 만든 Grid) + 종류 프로필
//   출력: Grid(열린 칸 floor · 방 번호 roomAt · 액체 liquid · 다리 bridge · 문 앞 protect) + 칸막이 + 입구 칸
// 불변식은 grid.ts(fixThickness·thinWalls·settle)가 지킨다. compose.ts 에서 옮겨 왔을 뿐 rooms 문법의 출력은 그대로다.
import type { DungeonLayout, DungeonSpec, DungeonType, PlacedRoom } from "./types";
import { DungeonComposeError } from "./errors";
import { Grid, rng, settle, type Rect } from "./grid";
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
  if ((profile.liquid || layout.grid) && !layout.thin) {
    const st = settle(g, entranceStart, rng(seed * 313 + 7));
    bridgeCount += st.bridges;
    if (st.removed) warnings.push(`닿지 않는 바닥 ${st.removed}칸을 막았다(액체로 갈라져 다리를 놓을 수 없는 조각).`);
  }
  if (type === "sewer") bridgeCount += addCrossings(g, rooms as readonly PlacedRoom[], seed);
  return { grid: g, partitions, bridgeCount, warnings, entranceStart };
}
