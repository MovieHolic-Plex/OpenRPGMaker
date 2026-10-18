// jp_city 빈터 측정 — 건물도 도로·보도·물도 아닌 칸 중, 반경 2칸(체비셰프) 안에 소품(건물 아님)이 하나도 없는 칸의 비율.
// 「빈 땅이 거슬린다」(2026-10-14 사용자)를 숫자로 잰다. 목표 ≤ 8%. 건물 벽에 붙은 맨 자갈도 「빈칸」으로 센다 — 건물은 쓰임이 아니다.
//   import { measureLotEmptiness } from "./jpLotEmptiness.mts"
// 칸 분류는 타일 번호로만 한다(구성기 기록 없이 조수가 만든 지도에도 같은 잣대).
import type { GameMap, Project } from "../../src/project/types.ts";

const INFRA_AUTOTILES = ["jp-sidewalk-curb", "jp-lane-road", "jp-water-canal", "jp-rail-track", "jp-lane-center", "jp-lane-dash", "jp-crosswalk-ew", "jp-crosswalk-ns", "jp-tactile"];
const INFRA_GROUPS = ["jp:street:sidewalk", "jp:street:road", "jp:street:crosswalk", "jp:street:lane", "jp:street:rail", "jp:street:water", "jp:shita-slab", "jp:shita-asphalt", "jp:shita-shade"];
const EDGE_AUTOTILES = ["jp-wall-block", "jp-hedge", "jp-fence-mesh", "jp-guardrail"];      // 담·생울타리: 경계일 뿐 쓰임이 아니다(분모에서 뺀다)
const FEATURE_AUTOTILES = ["jp-water-pond"];
const BUILT_KIT = /^jp-(bldg|sf|recipe|house|shop|apt|mansion|office|tower|school|station|temple|shrine-hall|gas-office)/;
const INFRA_KIT = /^jp-(river|water|bank|bridge|mark|crosswalk|road-lane|foot-shadow|wall-drain|rail|via|tram|subway-track|platform|gnd-)/;

export interface LotEmptiness { readonly lot: number; readonly empty: number; readonly ratio: number; readonly mask: Uint8Array /* 0 제외 · 1 쓰임 있음 · 2 빈칸 */ }

type Ts = { autotileGroups?: { id: string; memberTileIds?: number[] }[]; tileGroups?: { id: string; tileIds?: number[] }[]; structureKits?: { id: string; rows?: { tiles?: number[]; upperTiles?: number[] }[] }[] };
const cache = new WeakMap<object, { infra: Set<number>; edge: Set<number>; feature: Set<number>; built: Set<number>; infraKit: Set<number> }>();

function classes(ts: Ts) {
  const hit = cache.get(ts);
  if (hit) return hit;
  const infra = new Set<number>(), edge = new Set<number>(), feature = new Set<number>(), built = new Set<number>(), infraKit = new Set<number>();
  for (const a of ts.autotileGroups ?? []) {
    const add = INFRA_AUTOTILES.includes(a.id) ? infra : EDGE_AUTOTILES.includes(a.id) ? edge : FEATURE_AUTOTILES.includes(a.id) ? feature : undefined;
    if (add) for (const t of a.memberTileIds ?? []) add.add(t);
  }
  for (const g of ts.tileGroups ?? []) {
    if (INFRA_GROUPS.includes(g.id)) for (const t of g.tileIds ?? []) infra.add(t);
    if (g.id.startsWith("jp:band:") || g.id.startsWith("jp:deco:")) for (const t of g.tileIds ?? []) built.add(t);
  }
  for (const k of ts.structureKits ?? []) {
    const set = BUILT_KIT.test(k.id) ? built : INFRA_KIT.test(k.id) ? infraKit : undefined;
    if (!set) continue;
    for (const r of k.rows ?? []) for (const t of [...(r.tiles ?? []), ...(r.upperTiles ?? [])]) if (t >= 0) set.add(t);
  }
  const out = { infra, edge, feature, built, infraKit };
  cache.set(ts, out);
  return out;
}

export function measureLotEmptiness(project: Project, map: GameMap, radius = 2): LotEmptiness {
  const ts = (project.tilesets as unknown as Record<string, Ts>)[map.tilesetId]!;
  const c = classes(ts);
  const W = map.width, H = map.height, N = W * H;
  // 0 제외(건물·도로·물·담) · 1 맨땅 · 3 소품
  const kind = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const ups = [map.upperTiles[i] ?? -1, map.upperOverlayTiles?.[i] ?? -1, map.lowerOverlayTiles?.[i] ?? -1].filter((t) => t >= 0);
    const low = map.lowerTiles[i] ?? -1;
    if (ups.some((t) => c.built.has(t))) { kind[i] = 0; continue; }
    if (ups.some((t) => c.edge.has(t))) { kind[i] = 0; continue; }
    const props = ups.filter((t) => !c.infraKit.has(t));
    if (props.length || c.feature.has(low)) { kind[i] = 3; continue; }
    if (c.infra.has(low) || c.infraKit.has(low) || ups.length) { kind[i] = 0; continue; }
    kind[i] = 1;
  }
  const mask = new Uint8Array(N);
  let lot = 0, empty = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (kind[i] === 0) continue;
    lot++;
    if (kind[i] === 3) { mask[i] = 1; continue; }
    let near = false;
    for (let dy = -radius; dy <= radius && !near; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      if (kind[yy * W + xx] === 3) { near = true; break; }
    }
    if (near) mask[i] = 1; else { mask[i] = 2; empty++; }
  }
  return { lot, empty, ratio: lot ? empty / lot : 0, mask };
}
