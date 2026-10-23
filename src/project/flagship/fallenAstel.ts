/**
 * 『폴른 스타』 왕도 아스텔(fs_hub)을 처음부터 짓는다 — 계획: tiledata/fallen-astel/PLAN.md · zones.png(2026-10-23).
 *
 * 옛 fs_hub 는 장 구성기의 농가 마을 위에 운하·성벽·천문대를 덧댄 것이었다(fallenTown.ts, 지웠다). 여기서는 장 구성기가 만든
 * 맵의 칸을 모두 비우고 오프닝 그림(성벽 꺾임·북 수문 운하·아치 다리·천문대 탑·둥근 원뿔 탑 성문루·포석 광장)을 설계도로
 * 칸 좌표를 정해 다시 짓는다. 남쪽 절반은 오프닝 프레임 밖이라 왕성(bd-castle)·귀족 저택·예배당을 둬 「왕도」로 읽히게 한다.
 * 모든 자리는 아래 상수로 정해져 있다 — 실내 문·포고 무대·QA 대본이 같은 좌표를 쓴다(ASTEL).
 */
import catalog from "@/assets/beodeulNatureCatalog.json";
import { planBeodeulCanopy, shapeBeodeulCanopyMask, writeBeodeulCanopy } from "@/editor/tools/beodeulForest";
import { planTownWallRing, stampTownWallCells, townWallTile, type Cells, type TownWallPlan } from "@/editor/tools/beodeulTownWall";
import type { GameEvent, Project } from "@/project/types";
import { bakeWorkshopObject, workshopAssetId } from "@/project/workshopTiles";

type Cell = { x: number; y: number };
type KitRow = { tiles: number[]; upperTiles?: number[] };
type Kit = { id: string; width: number; height: number; rows: KitRow[] };
type Shadow = { dx: number; dy: number; rows: number[][] };

/** 맵 크기와 모든 자리(칸 좌표). */
export const ASTEL = {
  W: 64, H: 69,
  canalX: 20, canalBottom: 59,
  road: 24,              // 큰길 윗줄(24·25)
  palaceStreet: 32,      // 궁전 거리 윗줄(32·33)
  avenueX: 17,           // 왕실 대로 서쪽 열(17~19)
  forecourt: 60,         // 성 앞마당 윗줄(60~62)
  castle: { x: 28, y: 34 },
  plaza: { x0: 39, y0: 18, x1: 60, y1: 31 },
  gate: { x: 55, yw: 12 }, // 성문 통로 x55·56, 동쪽 낮은 성벽 위 통로 줄 12
  observatoryDoor: { x: 27, y: 23 },
  forestExit: [{ x: 55, y: 11 }, { x: 56, y: 11 }], // 성문루 통로 맨 윗칸(문 칸) — 부딪혀 숲으로
  forestArrival: { x: 55, y: 12 }, // 돌아오면 통로 안 문 바로 앞 칸에 성문을 등지고 선다
  doors: {
    fs_inn: { x: 8, y: 15 },
    fs_bakery_home: { x: 14, y: 15 },
    fs_lisa_home: { x: 33, y: 21 },
    fs_apothecary: { x: 41, y: 23 },
    fs_stargazer_home: { x: 30, y: 31 },
  } as Record<string, Cell>,
  /** 귀족 저택 문(키트에 문 이름표가 없어 잠긴 문을 따로 단다). */
  manorDoors: [{ x: 9, y: 35 }, { x: 12, y: 45 }],
  stage: {
    dais: { x: 54, y: 26 },          // 포고 단 4×2(54~57, 26~27)
    fountain: { x: 49, y: 24 },      // 분수 4×4(49~52, 24~27)
    valen: { x: 55, y: 26 }, knight: { x: 57, y: 26 },
    escortRows: [18, 20, 22, 24],    // 호위 두 줄(x55·56) — 줄 사이 한 칸 비움
    hero: { x: 56, y: 30 },
    heroAside: [{ x: 57, y: 30 }, { x: 58, y: 30 }],
    gatekeeper: { x: 59, y: 22 },
    elder: { x: 50, y: 30 },
    crowd: [
      { x: 53, y: 29, dir: "up" }, { x: 59, y: 29, dir: "up" },
      { x: 47, y: 22, dir: "right" }, { x: 46, y: 26, dir: "right" },
      { x: 59, y: 25, dir: "left" }, { x: 48, y: 29, dir: "up" },
      { x: 51, y: 29, dir: "up" }, { x: 54, y: 30, dir: "up" }, { x: 47, y: 24, dir: "right" }, { x: 45, y: 22, dir: "right" },
      { x: 48, y: 20, dir: "right" }, { x: 60, y: 27, dir: "left" }, { x: 58, y: 24, dir: "left" }, { x: 52, y: 30, dir: "up" },
    ] as { x: number; y: number; dir: "up" | "down" | "left" | "right" }[],
  },
  baker: { x: 12, y: 19 }, kid: { x: 34, y: 27 },
  proclamationTrigger: { x: 3, y: 61 },
} as const;

export type AstelLayout = typeof ASTEL;

const GRASS = 737;
const PLAZA = 1509;
const ROAD = 3221;
const WATER = 23152;
const WATER_BY_MASK = [23025, 23040, 23048, 23056, 23064, 23072, 23080, 23088, 23096, 23104, 23112, 23120, 23128, 23136, 23144, 23152];
const ROAD_BY_MASK = [23015, 23016, 23017, 23018, 23019, 2666, 23020, 4674, 23021, 23022, 23023, 3353, 23024, 9585, 17443, 3221];
/** bd-river-bridge 키트 12줄 위층에서 아치 구멍 밑 검은 윤곽 한 줄만 지운 사본(옛 fallenTown.ts 에서 옮김, VQA r4 「다리 물선」). */
const BRIDGE_WATERLINE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAQCAYAAACm53kpAAABW0lEQVR42mOsrGr57+1jz3Du3DkGGDAyMoKzt245yNDeVsPIQCaIik76/+TpbYaQkBAU8TVr1mCI0dru48ePMzAwMDAsX7qC0c7B9v+L528YmPAZQKkDGBgYGJYtnccoI61Ksj562c1ESwcgO+TE8Yt09TyxdrMwMDAw2FjZMto52P7HlgypDdasWYOVTQ+7nz59ysDAwMCA7FcWGAM5P1IzBpBjgoEh6T+2fE+r2MdmN6zsgQU+1iywdu1ShoEC9LYbIwBOHL/IcOvmdUZaWEYoPw6E3Sz0jmF5eSWUfD516lQUeXMLm/8nTxxhpJd7WNALpBfP3zAMV3DmzHEGCUkRlMKXBZbn6OXxo8d2Mhw9thOnPDsHbSMf3Z+M9I4FWMsTVxa4d/cJAz2zANNgSqL09vyABEB7Ww3j1i0HB4XnBywF4AqEgQBMIzXpDwpQWdXy39zC5v9AugEAoqG6hUn4sXEAAAAASUVORK5CYII=";

/** 장 구성기가 만든 fs_hub 를 아스텔로 다시 짓는다. 맵은 미리 ASTEL.W×ASTEL.H 로 늘려 둔다(resize_map). */
export function buildAstel(project: Project, hubId: string, ids: { observatory: string; forest: string }): AstelLayout {
  const map = project.maps[hubId]!;
  const { W, H } = ASTEL;
  if (map.width !== W || map.height !== H) throw new Error(`[astel] 맵 크기가 ${map.width}×${map.height} 다(${W}×${H} 이어야 한다)`);
  const tsDef = project.tilesets[map.tilesetId]!;
  const ts = tsDef as unknown as {
    structureKits: Kit[]; autotileGroups: { id: string; memberTileIds: number[]; connectTileIds?: number[] }[];
    tileGrafts?: { targetTile: number; sourceChipset: string; sourceTile: number; sourceTileSize?: number; sourceTilesPerRow?: number }[];
    tileGroups: { id: string; tileIds: number[] }[]; priority: Record<number, string>; passability: Record<number, unknown>;
  };
  const at = (x: number, y: number): number => y * W + x;
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;

  // ── 0. 비운다: 바닥은 풀, 나머지 층은 빈 칸. 높이 단·옛 구조물 기록도 걷는다. ──
  map.lowerTiles = Array(W * H).fill(GRASS);
  map.upperTiles = Array(W * H).fill(-1);
  map.lowerOverlayTiles = Array(W * H).fill(-1);
  map.upperOverlayTiles = Array(W * H).fill(-1);
  delete (map as { relief?: unknown }).relief;
  (map as { structurePlacements?: unknown[] }).structurePlacements = [];
  const lo = map.lowerTiles, up = map.upperTiles, lo2 = map.lowerOverlayTiles!, up2 = map.upperOverlayTiles!;

  const kits = new Map(ts.structureKits.map((k) => [k.id, k]));
  const kit = (id: string): Kit => {
    const k = kits.get(id);
    if (!k) throw new Error(`[astel] 키트가 없다: ${id}`);
    return k;
  };
  const hasKit = (id: string): boolean => kits.has(id);
  const waterSet = new Set(WATER_BY_MASK);
  const isWater = (t: number): boolean => waterSet.has(t);
  const roadGroup = ts.autotileGroups.find((g) => g.id === "beodeul_road_autotile")!;
  const roadSet = new Set(roadGroup.memberTileIds);
  const roadLink = new Set([...roadGroup.memberTileIds, ...(roadGroup.connectTileIds ?? [])]);
  const canalGroup = ts.autotileGroups.find((g) => g.id === "beodeul_canal_lake_47")!;
  const waterLink = new Set([...canalGroup.memberTileIds, ...(canalGroup.connectTileIds ?? [])]);
  const grassSet = new Set(ts.tileGroups.find((g) => g.id === "beodeul:grass")?.tileIds ?? [GRASS]);

  const fill = (x0: number, y0: number, x1: number, y1: number, t: number): void => {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) if (inside(x, y)) lo[at(x, y)] = t;
  };
  const copyKit = (k: Kit, x0: number, y0: number, opt: { cols?: [number, number]; rows?: [number, number] } = {}): void => {
    const [c0, c1] = opt.cols ?? [0, k.width - 1];
    const [r0, r1] = opt.rows ?? [0, k.height - 1];
    for (let ky = r0; ky <= r1; ky += 1) for (let kx = c0; kx <= c1; kx += 1) {
      const x = x0 + kx - c0, y = y0 + ky - r0;
      if (!inside(x, y)) continue;
      const row = k.rows[ky]!, i = at(x, y);
      const l = row.tiles[kx] ?? -1, u = row.upperTiles?.[kx] ?? -1;
      if (l >= 0) { lo[i] = l; lo2[i] = -1; }
      if (u >= 0) { up[i] = u; up2[i] = -1; }
    }
  };
  const graftOf = new Map<number, number>();
  for (const g of ts.tileGrafts ?? []) if (g.sourceChipset === "tex_beodeul_nature") graftOf.set(g.sourceTile, g.targetTile);
  const shadows = (catalog as { shadows: Record<string, Shadow> }).shadows;
  const shade = (kitId: string, x0: number, y0: number): void => {
    const s = shadows[kitId];
    if (!s) return;
    s.rows.forEach((row, j) => row.forEach((tile, i) => {
      const x = x0 + s.dx + i, y = y0 + s.dy + j, t = graftOf.get(tile);
      if (tile < 0 || t === undefined || !inside(x, y)) return;
      const c = at(x, y);
      if (up[c]! < 0 && lo2[c]! < 0 && !isWater(lo[c]!)) lo2[c] = t;
    }));
  };
  const stamp = (kitId: string, x: number, y: number): void => { copyKit(kit(kitId), x, y); shade(kitId, x, y); };
  const retile = (members: Set<number>, link: Set<number>, table: number[]): void => {
    const next = new Map<number, number>();
    for (let i = 0; i < lo.length; i += 1) {
      if (!members.has(lo[i]!)) continue;
      const x = i % W, y = Math.floor(i / W);
      const linked = (nx: number, ny: number): boolean => !inside(nx, ny) || link.has(lo[at(nx, ny)]!) || members.has(lo[at(nx, ny)]!);
      const mask = (linked(x, y - 1) ? 1 : 0) | (linked(x + 1, y) ? 2 : 0) | (linked(x, y + 1) ? 4 : 0) | (linked(x - 1, y) ? 8 : 0);
      next.set(i, table[mask]!);
    }
    for (const [i, t] of next) lo[i] = t;
  };

  const { canalX: CX, road: RY, palaceStreet: PY, avenueX: AX, forecourt: FY, castle, plaza, gate } = ASTEL;

  // ── 1. 바닥: 운하·해자(물), 큰길·궁전 거리·왕실 대로·선창 길·성 앞마당(길), 포고 광장(판석). ──
  fill(CX, 0, CX + 3, ASTEL.canalBottom, WATER);
  fill(CX + 4, castle.y + 23, castle.x + 32, castle.y + 25, WATER);          // 해자 = 운하 물(갑문 없이 이어진다)
  fill(3, RY, plaza.x0 - 1, RY + 1, ROAD);                                    // 큰길(서쪽 성벽 ~ 광장)
  fill(CX + 4, PY, plaza.x1, PY + 1, ROAD);                                   // 궁전 거리
  fill(AX, RY + 2, AX + 2, FY + 2, ROAD);                                     // 왕실 대로
  fill(CX + 4, RY + 2, CX + 5, castle.y + 22, ROAD);                          // 선창 길(운하 동안)
  fill(3, FY, plaza.x1, FY + 2, ROAD);                                        // 성 앞마당(예배당 앞 ~ 도개교 ~ 동쪽 성벽)
  fill(9, 36, AX - 1, 36, ROAD);                                              // 첫 저택 문 → 대로
  fill(3, 16, 16, 17, ROAD);                                                  // 북서 집 앞 골목
  fill(14, 18, 15, RY - 1, ROAD);                                             // 골목 → 큰길
  fill(33, 22, 33, RY - 1, ROAD);                                             // 리사네 집 문 → 큰길
  fill(plaza.x0, plaza.y0, plaza.x1, plaza.y1, PLAZA);                        // 포고 광장
  fill(gate.x, 0, gate.x + 1, gate.yw - 2, ROAD);                             // 성문 밖 숲길

  // ── 2. 왕성: bd-castle 0~25줄(뒤 성벽·궁전·안뜰·원탑 앞 성벽·해자·도개교). 해자 칸은 운하 물로 바꾼다(도개교 세 칸만 남긴다). ──
  const castleKit = kit("bd-castle");
  copyKit(castleKit, castle.x, castle.y, { rows: [0, 25] });
  // 키트 서쪽 끝 열은 안뜰 바닥이 비어 있다(풀이 비친다) — 옆 열 바닥으로 메운다.
  for (let ky = 3; ky <= 22; ky += 1) {
    const i = at(castle.x, castle.y + ky);
    if ((castleKit.rows[ky]!.tiles[0] ?? -1) < 0) lo[i] = castleKit.rows[ky]!.tiles[1] ?? lo[i]!;
  }
  for (let ky = 23; ky <= 25; ky += 1) for (let kx = 0; kx <= 32; kx += 1) {
    const i = at(castle.x + kx, castle.y + ky);
    if (kx >= 15 && kx <= 17) { waterLink.add(lo[i]!); roadLink.add(lo[i]!); continue; }
    lo[i] = WATER; up[i] = -1; lo2[i] = -1;
  }
  retile(waterSet, waterLink, WATER_BY_MASK);
  // 왕성 서쪽 막는 성벽(키트는 옆면이 열려 있다) — 3판 성벽 세로 조각 두 열: 위 모서리 · 세로 통로 · 아래 모서리 + 앞면 넷(해자 위 끝).
  {
    const wx = castle.x - 2, top = castle.y, end = castle.y + 22;
    const put = (x: number, y: number, name: string): void => { const t = townWallTile(name); if (t !== undefined) { const i = at(x, y); up[i] = t; lo2[i] = -1; up2[i] = -1; } };
    for (let cy = 0; cy < 2; cy += 1) for (let cx = 0; cx < 2; cx += 1) put(wx + cx, top + cy, `c_nw_${cx}${cy}`);
    for (let y = top + 2; y <= end - 6; y += 1) { const r = (y * 7 + 3) % 8; put(wx, y, `vw${r}_0`); put(wx + 1, y, `vw${r}_1`); }
    for (let cy = 0; cy < 2; cy += 1) for (let cx = 0; cx < 2; cx += 1) put(wx + cx, end - 5 + cy, `c_sw_${cx}${cy}`);
    (["u", "m", "n", "l"] as const).forEach((k, i) => { put(wx, end - 3 + i, `f_${k}_endL`); put(wx + 1, end - 3 + i, `f_${k}_endR`); });
  }

  // ── 3. 아치 돌다리(큰길 24·25줄) — 버들항 강 다리 키트 8~12줄의 강 위 네 칸 + 양 끝 난간 기둥(옛 fallenTown 과 같은 조립). ──
  const riverBridge = kit("bd-river-bridge");
  const waterlineFix = new Map<number, number>();
  {
    const src = riverBridge.rows[12]!.upperTiles!.slice(7, 11);
    const before = (tsDef.tileGrafts ?? []).length;
    const baked = bakeWorkshopObject(project as unknown as Parameters<typeof bakeWorkshopObject>[0], map.tilesetId, {
      objectId: "workshop:fallen-town-bridge-waterline", title: "물선 없는 아치 다리 밑", description: "버들항 강 다리 아치 앞면 밑 줄 — 물 위 검은 윤곽을 지운 사본(폴른 스타 왕도)",
      kind: "floor", columns: 4, rows: 1, footRows: 1, risePx: 0, use: ["다리"], gridHash: "fallen-town-bridge-waterline-v1",
      asset: { id: workshopAssetId(BRIDGE_WATERLINE_PNG), dataUrl: BRIDGE_WATERLINE_PNG, width: 64, height: 16 },
      cells: [0, 1, 2, 3].map((dx) => ({ sourceTile: dx, dx, dy: 0 })),
      provenance: { aiGenerated: false, tool: "pixel erase (bd-river-bridge 6980/6989/6998/7007 row 9 under arch openings)" },
    });
    for (const g of (tsDef.tileGrafts ?? []).slice(before)) { (g as { sourceTileSize?: number }).sourceTileSize = 16; (g as { sourceTilesPerRow?: number }).sourceTilesPerRow = 4; }
    baked.rows[0]!.upperTiles!.forEach((id, dx) => {
      const from = src[dx]!;
      if (from < 0) return;
      tsDef.priority[id] = tsDef.priority[from] ?? "upper";
      if (tsDef.passability) (tsDef.passability as Record<number, unknown>)[id] = (tsDef.passability as Record<number, unknown>)[from];
      waterlineFix.set(from, id);
    });
  }
  for (let ky = 8; ky <= 12; ky += 1) for (let kx = 6; kx <= 11; kx += 1) {
    const x = CX + kx - 7, y = RY - 1 + ky - 8;
    const i = at(x, y), row = riverBridge.rows[ky]!;
    const l = row.tiles[kx] ?? -1, u0 = row.upperTiles?.[kx] ?? -1;
    const u = ky === 12 ? waterlineFix.get(u0) ?? u0 : u0;
    if (kx >= 7 && kx <= 10) {
      lo[i] = l; lo2[i] = -1; up[i] = u; up2[i] = -1;
      if (ky === 8 || ky === 12) waterLink.add(l);
      if (ky === 9 || ky === 10) roadLink.add(l);
    } else if ((ky === 8 || ky === 10) && u >= 0) { up[i] = u; up2[i] = -1; }
  }
  retile(waterSet, waterLink, WATER_BY_MASK);

  // ── 4. 성벽 고리(3판 성벽) — 서쪽 높은 고리(북벽 2~7줄)와 동쪽 낮은 고리(북벽 12~17줄)를 꺾임 열 36·37에서 잇고, 남벽은 온 고리. ──
  //    둥근 원뿔 탑 셋(꺾임 안쪽 · 성문 양옆)은 새 그림(bd-capital-round-tower)이 있으면 그것으로, 없으면 3판 망루 자리로 둔다.
  const FULL: TownWallPlan = { x0: 1, y0: 2, x1: W - 2, y1: H - 6, gates: [], gaps: [], towers: [], stairs: [] };
  const WEST: TownWallPlan = { ...FULL, x1: 37 };
  const EAST: TownWallPlan = { ...FULL, x0: 36, y0: gate.yw, gates: [{ side: "N", x: gate.x }], towers: [] };
  const rings = { F: planTownWallRing(FULL), Wr: planTownWallRing(WEST), E: planTownWallRing(EAST) };
  const southTop = FULL.y1 - 2;
  const ringFor = (x: number, y: number): "F" | "Wr" | "E" | null => {
    if (y >= southTop) return "F";
    if (x <= 35) return "Wr";
    if (x <= 37) return y <= gate.yw - 1 ? "Wr" : y <= gate.yw + 1 ? "E" : null;
    if (x === 38 && y > gate.yw + 1) return null; // 동쪽 고리의 서쪽 세로벽 그늘(꺾임 아래는 마을 안)
    return "E";
  };
  const merged: { up: Cells; lo: Cells } = { up: new Map(), lo: new Map() };
  for (const [name, r] of Object.entries(rings) as ["F" | "Wr" | "E", { up: Cells; lo: Cells }][]) {
    for (const layer of ["up", "lo"] as const) for (const [k, v] of r[layer]) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      if (ringFor(x, y) === name) merged[layer].set(k, v);
    }
  }
  stampTownWallCells(map, merged);
  const roundTowers = [{ x: 36, yw: gate.yw }, { x: gate.x - 4, yw: gate.yw }, { x: gate.x + 3, yw: gate.yw }];
  const towerKit = hasKit("bd-capital-round-tower") ? kit("bd-capital-round-tower") : undefined;
  for (const t of roundTowers) {
    if (towerKit) { copyKit(towerKit, t.x, t.yw - 4); shade("bd-capital-round-tower", t.x, t.yw - 4); continue; } // 탑 0줄 = 위 통로 줄 − 4(그림 계약)
    const p = planTownWallRing({ ...EAST, gates: [], towers: [{ side: "N", x: t.x }] });
    const only: { up: Cells; lo: Cells } = { up: new Map(), lo: new Map() };
    for (const layer of ["up", "lo"] as const) for (const [k, v] of p[layer]) if (v.startsWith("tower")) only[layer].set(k, v);
    stampTownWallCells(map, only);
  }
  // 북 수문: 운하가 서쪽 북벽 앞면(4~7줄)을 쌍아치로 지난다.
  if (hasKit("bd-capital-watergate-n")) copyKit(kit("bd-capital-watergate-n"), CX, 4);

  // ── 5. 천문대 탑(마법사의 탑 키트, 0~7열) + 곁 놋쇠 망원경(오프닝: 탑 서쪽 운하 둑). ──
  copyKit(kit("bd-pick-wizard-tower-wizard-tower"), ASTEL.observatoryDoor.x - 3, ASTEL.observatoryDoor.y - 15, { cols: [0, 7] });
  stamp("bd-pick-headland-lighthouse-telescope", CX + 4, ASTEL.observatoryDoor.y - 4);

  // ── 6. 집: 북서 여관·빵집(+물레방아), 천문대 동쪽 리사네 집, 광장 서쪽 약방, 공방 마당(별지기 집·대장간). ──
  stamp("bd-house-inn", 3, 8);
  stamp("bd-house-h106_1", 11, 8);
  stamp("bd-pick-riverside-mill-waterwheel", 17, 11);
  stamp("bd-house-h116_0", 31, 14);
  stamp("bd-house-h113_0", 39, 18);
  stamp("bd-house-h113_0", 28, 26);
  stamp("bd-house-smithy_town", 33, 26);
  // 귀족 구역: 왕실 대로 서쪽에 큰 저택 둘과 예배당(교단의 거점).
  stamp("bd-house-manor", 3, 26);
  stamp("bd-manor-tower", 3, 37);
  stamp("bd-house-cathedral", 4, 48);

  // ── 7. 광장 소품: 분수·포고 단(새 그림), 성문 축 양옆 왕실 깃발, 통행 초소, 남서 노점·우물, 가로등. ──
  const st = ASTEL.stage;
  if (hasKit("bd-capital-fountain")) stamp("bd-capital-fountain", st.fountain.x, st.fountain.y);
  else stamp("bd-prop-well_roofed", st.fountain.x + 1, st.fountain.y + 1);
  if (hasKit("bd-capital-dais")) copyKit(kit("bd-capital-dais"), st.dais.x, st.dais.y);
  const banner = hasKit("bd-capital-banner-pole") ? "bd-capital-banner-pole" : "bd-pick-walled-market-banner-teal";
  const bannerTop = 23 - kit(banner).height;
  stamp(banner, gate.x - 2, bannerTop);
  stamp(banner, gate.x + 3, bannerTop);
  stamp("bd-pick-walled-market-toll-booth", 59, 18);
  stamp("bd-prop-stall_cheese_meat", 40, 26);
  stamp("bd-prop-stall_herb_flower", 43, 26);
  stamp("bd-prop-well_roofed", 44, 30);
  const lamp = hasKit("bd-capital-lamp") ? "bd-capital-lamp" : "bd-prop-lamp_crook";
  for (const [x, y] of [[37, 21], [24, 21], [16, 21], [23, 29], [23, 42], [26, 29], [plaza.x0, 29], [AX - 1, 37], [AX - 1, 48], [42, 57], [46, 57]] as const) {
    const k = kit(lamp);
    let ok = true;
    for (let dy = 0; dy < k.height; dy += 1) if (!inside(x, y + dy) || up[at(x, y + dy)]! >= 0) ok = false;
    if (ok) stamp(lamp, x, y);
  }

  // ── 8. 성 밖 숲(성문 밖 동북 + 북벽 너머 두 줄) — 버들항 수관 오토타일. 숲길(성문 축)은 비운다. ──
  {
    const forest = new Set<number>();
    for (let y = 0; y < gate.yw - 1; y += 1) for (let x = 0; x < W; x += 1) {
      if (x >= gate.x - 1 && x <= gate.x + 2) continue;
      if (x < 38 && (y > 1 || (x >= CX && x <= CX + 3))) continue; // 북벽 너머 두 줄(운하 빼고)
      const c = at(x, y);
      if (up[c]! >= 0 || lo2[c]! >= 0 || !grassSet.has(lo[c]!)) continue;
      forest.add(c);
    }
    shapeBeodeulCanopyMask(W, H, forest, { block: 2 });
    const nature = writeBeodeulCanopy(project, map, tsDef, planBeodeulCanopy(W, H, "leaf", forest, (c) => grassSet.has(lo[c]!) && up[c]! < 0 && lo2[c]! < 0));
    void nature;
  }

  // ── 9. 마을 안 나무·정원 — 목적 있는 자리만(정원·둑·성벽 밑). ──
  const TREES = ["bd-tree-d43edd", "bd-tree-1a786c", "bd-tree-03a8f7", "bd-tree-5844f6", "bd-tree-d61d7e", "bd-tree-3e8732", "bd-tree-b1d104", "bd-tree-1e09f0", "bd-tree-a80c85", "bd-tree-bdd36e", "bd-tree-7ecdb8"];
  const SMALL = ["bd-tree-f4f319", "bd-tree-e9d9b3", "bd-tree-37f48b", "bd-tree-47e17a", "bd-tree-d105b2", "bd-tree-0f7ed1", "bd-tree-cc0fcb", "bd-tree-132848"];
  const THIN = ["bd-tree-eef4bc", "bd-tree-28ad5e", "bd-tree-c27062"];
  const hash = (x: number, y: number, salt: number): number => (((x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)) >>> 0);
  const reserved = new Set<string>();
  const reserve = (c: Cell, r = 1): void => { for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) reserved.add(`${c.x + dx},${c.y + dy}`); };
  reserve(ASTEL.observatoryDoor); for (const d of Object.values(ASTEL.doors)) reserve({ x: d.x, y: d.y + 1 });
  const freeGround = (x: number, y: number): boolean => {
    if (!inside(x, y) || reserved.has(`${x},${y}`)) return false;
    const i = at(x, y);
    return grassSet.has(lo[i]!) && up[i]! < 0 && up2[i]! < 0 && lo2[i]! < 0;
  };
  const plant = (x0: number, y0: number, x1: number, y1: number, kinds: string[], salt: number, skip = 0, gap = 0): void => {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
      const h = hash(x, y, salt);
      if (skip && h % 100 < skip) continue;
      const k = kit(kinds[(h >>> 8) % kinds.length]!);
      if (x + k.width - 1 > x1 || y + k.height - 1 > y1) continue;
      let fits = true;
      for (let dy = -gap; dy < k.height + gap && fits; dy += 1) for (let dx = -gap; dx < k.width + gap && fits; dx += 1) {
        const cx = x + dx, cy = y + dy;
        const own = dy >= 0 && dy < k.height && dx >= 0 && dx < k.width;
        if (own ? !freeGround(cx, cy) : inside(cx, cy) && up[at(cx, cy)]! >= 0) fits = false;
      }
      if (fits) stamp(k.id, x, y);
    }
  };
  // 오프닝: 운하·천문대 둘레가 나무로 푸르다. 길·문 앞은 비운다.
  const gardens: [number, number, number, number][] = [
    [3, 18, 13, 23], [16, 18, 19, 23], [24, 8, 25, 18], [31, 8, 35, 13], [34, 14, 38, 23], [24, 26, 27, 31],
    [3, 8, 19, 15], [AX, 8, 19, 15],
  ];
  for (const [x0, y0, x1, y1] of gardens) { plant(x0, y0, x1, y1, TREES, 3, 15); plant(x0, y0, x1, y1, SMALL, 5, 25); plant(x0, y0, x1, y1, THIN, 7, 40); }
  // 귀족 저택 뜰(대로 쪽 빈칸)·예배당 둘레는 작은 나무만.
  plant(3, 26, 16, 61, SMALL, 11, 55, 0); plant(3, 26, 16, 61, THIN, 13, 70, 0);

  retile(roadSet, roadLink, ROAD_BY_MASK);

  // ── 10. 이벤트 자리 — 문·출구·사람. 포고 무대(발렌·호위·백성)는 chronoBell 의 무대 단계가 ASTEL.stage 로 세운다. ──
  const events = map.events;
  const transfersTo = (target: string): GameEvent[] => events.filter((e) => String(e.id).startsWith("ev_gate_") && JSON.stringify(e).includes(`"mapId":"${target}"`));
  const obs = transfersTo(ids.observatory)[0];
  if (!obs) throw new Error("[astel] 천문대 문 이벤트가 없다");
  obs.x = ASTEL.observatoryDoor.x; obs.y = ASTEL.observatoryDoor.y;
  for (const page of obs.pages ?? []) { page.priority = "same"; (page as { overlapForbidden?: boolean }).overlapForbidden = true; }
  // 숲 출구: 성문 밖 숲길 두 칸(성문 통로를 빠져나온 자리).
  const exits = transfersTo(ids.forest);
  if (!exits[0]) throw new Error("[astel] 숲 출구 이벤트가 없다");
  map.events = events.filter((e) => !exits.slice(1).includes(e));
  const exit = exits[0];
  exit.x = ASTEL.forestExit[0]!.x; exit.y = ASTEL.forestExit[0]!.y;
  const side = JSON.parse(JSON.stringify(exit)) as GameEvent;
  side.id = `${exit.id}_e`; side.x = ASTEL.forestExit[1]!.x; side.y = ASTEL.forestExit[1]!.y;
  for (const page of side.pages ?? []) page.id = `${page.id}_e`;
  map.events.push(side);
  // 출구 칸은 성문루 통로 맨 윗칸(문 칸) — 부딪혀 나간다.
  for (const e of [exit, side]) for (const page of e.pages ?? []) { page.priority = "same"; (page as { overlapForbidden?: boolean }).overlapForbidden = true; }
  // 다른 집 문 이벤트(장 구성기 마을의 문)는 지운다 — 실내 단계가 새 문에 다시 단다.
  map.events = map.events.filter((e) => !(String(e.id).startsWith("ev_gate_") && e !== obs && e !== exit && e !== side) && !String(e.id).startsWith("ev_fs_locked_"));
  const move = (id: string, c: Cell): void => { const e = map.events.find((v) => v.id === id); if (e) { e.x = c.x; e.y = c.y; } };
  move("ev_fs_gate", st.gatekeeper); move("ev_fs_elder", st.elder);
  move("ev_fs_valen", st.valen); move("ev_fs_knight", st.knight);
  move("ev_fs_baker", ASTEL.baker); move("ev_fs_kid", ASTEL.kid);
  move("ev_fs_event", ASTEL.proclamationTrigger);
  // 귀족 저택 문 — 잠겼다.
  for (const d of ASTEL.manorDoors) {
    map.events.push({
      id: `ev_fs_manor_${d.x}_${d.y}`, name: "저택 문", x: d.x, y: d.y, trigger: { kind: "action" }, commands: [],
      pages: [{
        id: `ev_fs_manor_${d.x}_${d.y}_page`, name: "잠김", conditions: [], graphic: { transparent: true },
        movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same", trigger: { kind: "action" },
        commands: [{ kind: "text", body: "귀족 저택의 문이 잠겨 있다. 문고리에 교단의 봉인 끈이 감겨 있다.", context: "narration", position: "bottom" }],
      }],
    } as unknown as GameEvent);
  }
  return ASTEL;
}

/** 실내 단계가 쓰는 집 문 자리(맵 id → 문 칸). */
export function astelDoors(): Record<string, Cell> { return { ...ASTEL.doors }; }


