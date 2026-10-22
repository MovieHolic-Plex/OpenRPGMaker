// 손 도트 실내 구성 검사 — build_hand_interior_room 이 지은 직후 돌려주는 「1배 화면에서 싸 보이는 것」 경고.
//
// 왜(2026-10-22 조수 실력 시험, 폴른 스타 세 방): 코딩 에이전트는 같은 세 방을 독립 Opus VQA 28바퀴로 다듬어 8.2/8.2/8.1 을 받았고,
// 조수(Sonnet 5.5 high 대용)는 같은 요청을 자연어로 받아 5/5/5 를 받았다. 조수가 받은 신호는 통행 BFS 와 칸 겹침뿐이었고,
// 검수자가 major 로 잡은 것은 모두 그 밖이었다 —
//   · 빈 바닥 30~55%(실내 기준 화면의 15% 이하): 코딩 에이전트는 VQA r9·r11 에서 빈 띠를 '#' 로 들여 쌓아 방을 좁혔다.
//   · 같은 걸이 반복(별자리표 다섯 — 검수 minor). 바닥 가구 반복(망원경 둘)은 합격 판도 쓰임별로 반복하므로 스킬 규칙으로만 둔다.
//   · 북벽을 파 넣은 '#' 덩이 속 허공(「관측 틈」 흉내) → 1배에서 방 안의 검은 구멍.
//   · 단 위에 마법진(flat) → 지워졌다 — 빌더가 단 위 바닥 무늬를 3층으로 올려 얹도록 고쳤다(builder.ts base).
// 거부하지 않는다 — 경고에 좌표와 고치는 법을 붙여 다음 짓기에서 고치게 한다.
import type { GameMap, Project } from "@/project/types";
import { measureLayoutQuality } from "@/ai/piAgent/layoutQuality";
import type { HandInteriorInput, HandInteriorSpec } from "./builder";

/** 실내 빈 바닥 한도(%) — 검수 기준(vqa-rubric 축 1: 빈 바닥·허공 ≤ 화면의 15%)에 맞춘다. 끝 검사(layoutQuality 30%)보다 엄하다. */
export const INTERIOR_BARE_FLOOR_MAX = 15;

/**
 * 같은 걸이가 이만큼 넘으면 벽지 무늬처럼 읽힌다(창·횃불·깃발은 예외). 바닥 가구 반복은 묻지 않는다 —
 * 검수 합격 판(폴른 r28)도 쓰임별 묶음 안에서 도표 탁자 셋·유물 진열장 여섯을 반복했다. 「작은 주인공 물건을 여럿 흩뿌려 크기를 대신하기」는 스킬 규칙이다.
 */
const HANG_REPEAT_MAX = 3;
const HANG_REPEATABLE = /^(window|wall torch|wall sconce|banner|tapestry|lantern|sconce|torch)/u;

/** 방 밖 허공 한도(%). 검수 합격 판(폴른 r28) 화로 방·지하 방 10%, 돔 그림으로 덮은 관측 홀 24%. */
const VOID_MAX = 20;
/** 돌 바닥 재질 가족 — 가족 안에서만 바꾼다. 나무·흙·타일은 묻지 않는다(서재 마루·부엌 타일은 정상). */
const STONE_FAMILY: Readonly<Record<string, string>> = {
  flag: "grey", grey: "grey", cobble: "grey", sandstone: "grey", dwarf: "grey",
  dungeon: "dark", wetstone: "dark", cave: "dark", slum: "dark",
  marble: "polished", check: "polished", elfstone: "polished",
};
const STONE_FAMILY_KO: Readonly<Record<string, string>> = { grey: "회색 판석 가족", dark: "감옥·젖은 돌 가족(1배에서 갈색 벽돌·흙)", polished: "대리석 가족(궁전)" };

export interface CompositionLint { readonly errors: string[]; readonly warnings: string[]; readonly bareFloor?: number }

export function handInteriorCompositionLint(project: Project, map: GameMap, input: HandInteriorInput, spec: HandInteriorSpec, options: { composed: boolean }): CompositionLint {
  const errors: string[] = [];
  const warnings: string[] = [];
  const objects = input.objects ?? [];

  // ② 같은 걸이 반복.
  const counts = new Map<string, string[]>();
  for (const o of objects) {
    if (spec.objects[o.id]?.kind !== "hang" || HANG_REPEATABLE.test(o.id)) continue;
    counts.set(o.id, [...(counts.get(o.id) ?? []), `(${o.x},${o.y})`]);
  }
  const repeats = [...counts].filter(([, at]) => at.length > HANG_REPEAT_MAX).map(([id, at]) => `${spec.objects[id]!.ko}(${id}) ×${at.length} ${at.slice(0, 6).join(" ")}`);
  if (repeats.length) warnings.push(`같은 걸이를 ${HANG_REPEAT_MAX}번 넘게 걸었다 — ${repeats.join(" / ")}. 1배에서 벽지 무늬처럼 반복돼 방마다의 쓰임이 흐려진다. 방마다 한두 개만 두고 나머지 벽은 그 방 쓰임의 다른 걸이·가구로 바꾸거나 비운다`);

  // ③ '#' 덩이 속 허공 — 실내에 닿지 않는 막힌 칸인데 같은 줄 양옆 3칸 안에 실내가 있다(방 안의 검은 구멍).
  const plan = input.plan;
  const H = plan.length, W = plan[0]?.length ?? 0;
  const inner = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && plan[y]![x] !== "#";
  const holes: string[] = [];
  for (let y = 1; y < H - 1; y++) {
    let run = -1;
    for (let x = 0; x <= W; x++) {
      let hole = false;
      if (x < W && plan[y]![x] === "#") {
        let touches = false;
        for (let dy = -1; dy <= 1 && !touches; dy++) for (let dx = -1; dx <= 1; dx++) if (inner(x + dx, y + dy)) { touches = true; break; }
        if (!touches) {
          let left = false, right = false;
          for (let k = 1; k <= 3; k++) { if (inner(x - k, y)) left = true; if (inner(x + k, y)) right = true; }
          hole = left && right;
        }
      }
      if (hole && run < 0) run = x;
      if (!hole && run >= 0) { holes.push(`(${run}~${x - 1},${y})`); run = -1; }
    }
  }
  if (holes.length) warnings.push(`평면의 '#' 덩이 속이 허공이다 ${holes.slice(0, 6).join(" ")} — 천장 띠도 벽면도 아닌 검은 칸이 방 한가운데 구멍으로 보인다. 지붕 틈·천창·돔을 평면 홈으로 흉내 내지 않는다(그런 그림이 없으면 없다고 말한다). 칸막이는 1칸 두께로 줄이거나 덩이를 걷어 바닥으로 만든다`);

  // ⑤ 돌 바닥 재질 가족 섞기 — 한 건물에 회색 판석·갈색 감옥 돌·흰 대리석을 섞으면 다른 건물을 이어 붙인 것처럼(방 안 이음매로) 읽힌다.
  //    (검수 major: 「grey stone on top and dark brown brick below inside the same room」 — 감옥 돌바닥 dungeon 은 1배에서 갈색 벽돌로 보인다.)
  const floorFamily = (id: string): string | undefined => STONE_FAMILY[id];
  const floorsUsed = new Map<string, Set<string>>();
  for (const id of [input.floor, ...(input.zones ?? []).map((z) => z.floor)]) {
    const fam = id ? floorFamily(id) : undefined;
    if (fam && id) floorsUsed.set(fam, (floorsUsed.get(fam) ?? new Set()).add(id));
  }
  if (floorsUsed.size > 1) {
    const list = [...floorsUsed].map(([fam, ids]) => `${STONE_FAMILY_KO[fam]}: ${[...ids].map((id) => `${id}(${spec.floors[id]?.ko ?? id})`).join("·")}`).join(" / ");
    warnings.push(`돌 바닥 재질 가족이 섞였다 — ${list}. 한 건물의 돌 바닥은 한 가족 안에서만 바꾼다(회색 판석 flag·grey·cobble·sandstone 끼리). 감옥 돌바닥(dungeon)·젖은 돌·동굴 바닥은 1배에서 갈색 벽돌·흙으로, 대리석·체크는 궁전으로 읽혀 방 안 이음매·딴 건물처럼 보인다`);
  }

  // ⑥ 방 밖 허공 — 실내에 닿지 않는 막힌 칸(천장 띠도 벽면도 아닌 검은 칸)의 비율. 큰 덩이는 맵을 줄이거나 곁방으로 쓴다.
  let voidCells = 0;
  const seen = new Uint8Array(W * H);
  const isVoid = (x: number, y: number) => {
    if (plan[y]![x] !== "#") return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inner(x + dx, y + dy)) return false;
    return true;
  };
  const blobs: { n: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!isVoid(x, y)) continue;
    voidCells += 1;
    if (seen[y * W + x]) continue;
    const blob = { n: 0, x0: x, y0: y, x1: x, y1: y };
    const stack = [[x, y]];
    seen[y * W + x] = 1;
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      blob.n += 1; blob.x0 = Math.min(blob.x0, cx!); blob.x1 = Math.max(blob.x1, cx!); blob.y0 = Math.min(blob.y0, cy!); blob.y1 = Math.max(blob.y1, cy!);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx! + dx, ny = cy! + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !isVoid(nx, ny)) continue;
        seen[ny * W + nx] = 1; stack.push([nx, ny]);
      }
    }
    blobs.push(blob);
  }
  const voidPct = W * H ? Math.round(100 * voidCells / (W * H)) : 0;
  if (voidPct > VOID_MAX && blobs.length) {
    const big = blobs.sort((a, b) => b.n - a.n).slice(0, 3).map((b) => `(${b.x0},${b.y0})~(${b.x1},${b.y1}) ${b.n}칸`).join(" · ");
    warnings.push(`방 밖 허공 ${voidPct}% (기준 ≤${VOID_MAX}% — 천장 띠도 벽면도 아닌 검은 칸) — 큰 덩이: ${big}. 1배 화면에서 검은 사분면으로 보인다. 그 덩이가 맵 가장자리면 맵을 줄이고, 방 사이면 그 자리에 쓰임 있는 곁방·알코브를 두거나 이웃 방을 넓혀 메운다`);
  }

  // ⑦ 빈 단 — 단 넓이에 비해 위에 선 가구가 거의 없다(1칸 망원경 하나가 5×4 단 위에 → 「빈 받침대 위 장식」).
  for (const d of input.daises ?? []) {
    const area = d.w * d.h;
    if (area < 9) continue;
    let occupied = 0;
    for (const o of objects) {
      const so = spec.objects[o.id];
      if (!so || so.kind === "flat" || so.kind === "hang") continue;
      for (let j = 0; j < Math.max(1, so.h); j++) for (let i = 0; i < Math.max(1, so.w); i++) {
        const cx = o.x + i, cy = o.y + j;
        if (cx >= d.x && cx < d.x + d.w && cy >= d.y && cy < d.y + d.h) occupied += 1;
      }
    }
    if (occupied / area < 0.2) warnings.push(`단(${d.id}) @(${d.x},${d.y}) ${d.w}×${d.h} 위가 거의 비었다(가구 ${occupied}칸 / ${area}칸) — 1배에서 빈 받침대로 읽힌다. 단을 주인공 크기 + 둘레 1칸(1칸 물건이면 3×2)으로 줄이거나, 단 모서리에 짝(기둥·큰 촛대·석상·화로)을 세운다`);
  }

  // ⑧ 앞 턱 없는 돌 단 — 단 윗면만 깔면 1배에서 바닥 무늬로 읽힌다(검수 major 「dais reads flat」). 폴른 r28 은 맨 아랫줄에 앞 턱·오르는 계단을 찍었다.
  if (spec.objects["dais riser stone"]) for (const d of input.daises ?? []) {
    if (d.id !== "dais stone" || d.h < 2 || d.w < 3) continue;
    const bottom = d.y + d.h - 1;
    const riser = objects.some((o) => /^dais (riser|steps) stone/u.test(o.id) && o.y === bottom && o.x >= d.x && o.x < d.x + d.w);
    if (!riser) warnings.push(`돌 단 @(${d.x},${d.y}) ${d.w}×${d.h} 에 앞 턱이 없다 — 1배에서 높이 없는 바닥 무늬로 읽힌다. 맨 아랫줄(y=${bottom})에 objects 로 dais riser stone L(x=${d.x}) · dais riser stone(가운데 칸마다) · dais riser stone R(x=${d.x + d.w - 1}) 을 찍고, 오르는 곳 두 칸은 dais steps stone(2칸) 으로 바꾼다(빌더가 단 위에 얹는다)`);
  }

  // ④ 빈 바닥 — 구성기(layout program·rooms 견본) 맵은 복도·동선의 빈칸이 쓰임이라 묻지 않는다.
  let bareFloor: number | undefined;
  if (!options.composed) {
    const q = measureLayoutQuality(project, map);
    if (q && q.floorCells >= 40) {
      bareFloor = q.empty;
      if (q.empty > INTERIOR_BARE_FLOOR_MAX) {
        const where = q.emptiestWindows.map((r) => `(${r.x},${r.y}) ${r.w}×${r.h}칸 중 빈 칸 ${r.emptyCells}`).join(" · ");
        warnings.push(`빈 바닥 ${q.empty}% (실내 기준 ≤${INTERIOR_BARE_FLOOR_MAX}% — 가구·깔개 3×3 안에 아무것도 없는 바닥)${where ? ` — 가장 빈 곳: ${where}` : ""}${q.square > 4 && q.squareAt ? `, 소품 없는 빈 정사각형 ${q.square}×${q.square} (왼위 ${q.squareAt.x},${q.squareAt.y})` : ""}. 낱개 소품을 흩뿌려 메우지 마라. 고치는 법 둘 중 하나: ① 그 빈 띠를 plan 에서 '#' 로 들여 쌓는다(방 가장자리 빈 줄을 벽으로, 깊은 알코브는 얕게, 넓은 홀은 칸막이로 두 방) ② 그 구역에 쓰임 하나를 정하고 그 쓰임의 가구 한 벌(앵커 + 짝 2점 이상, 깔개·탁상 물건 포함)을 둔다. 통로·주인공 물건 앞 한두 줄은 비워도 된다`);
      }
    }
  }
  return { errors, warnings, ...(bareFloor !== undefined ? { bareFloor } : {}) };
}
