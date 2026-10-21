/**
 * 『폴른 스타』 왕도 아스텔(fs_hub)을 오프닝 그림과 같은 곳으로 다시 다듬는다(2026-10-21 사용자 머지 차단 지적 —
 * 「오프닝의 마을과 플레이하는 마을이 다르다」).
 *
 * 오프닝에는 운하 곁 둥근 돌 천문대 탑·아치 돌다리·성벽 성문과 포석 광장이 있었는데 마을은 농가 마을(밭·평평한 다리·
 * 재단사 집이 천문대 입구·길 끝이 동쪽 출구)이었다. 새 그림은 그리지 않는다 — 버들항 시트에 있는 키트·칸만 쓴다.
 * - 강 → 돌 둑 운하(「버들항 물」 오토타일), 평평한 다리 → `bd-bridge-arch`(아치 둘).
 * - 천문대 입구: 재단사 집 → `bd-pick-wizard-tower-wizard-tower`(둥근 돌 탑) + 곁에 삼각대 놋쇠 망원경.
 * - 동문: 왕성 키트(`bd-castle`)의 앞 성벽 줄(원탑·창살 성문루·원탑)을 그대로 옮겨 동쪽 성벽으로 세우고,
 *   성문 통로를 숲으로 나가는 출구로 쓴다. 성벽 밖은 숲.
 * - 성문 앞 포석 광장, 마을 가운데 밭은 정원·나무로.
 */
import catalog from "@/assets/beodeulNatureCatalog.json";
import { isPassable } from "@/project/collision";
import type { GameEvent, Project } from "@/project/types";
import { bakeWorkshopObject, workshopAssetId } from "@/project/workshopTiles";

/**
 * 성문 창살을 걷어 올린 그림 — 왕성 키트 성문 아래 줄 세 칸(3277·3278·3279)에서 창살 아랫부분을 지우고 창살 끝(가로대·뾰족 끝)을
 * 칸 맨 위로 올렸다(손 도트, 다른 색 없음). 닫힌 창살 사이로 드나드는 것처럼 보였다(적대 VQA r2 M2).
 * 공방 칸(tileGrafts, 업로드 그림판)으로 버들항 칩셋에 덧붙인다 — 번들 시트는 그대로.
 */
/** bd-river-bridge 키트 12줄 위층(6980·6989·6998·7007)에서 아치 구멍 밑(위·아래가 비어 있는 칸)의 검은 윤곽 한 줄만 지운 사본 —
 *  운하 물 위에 곧은 검은 줄로 읽혔다(VQA r4 「다리 물선」). 화소를 지우기만 했다(새 색 없음). */
const BRIDGE_WATERLINE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAQCAYAAACm53kpAAABW0lEQVR42mOsrGr57+1jz3Du3DkGGDAyMoKzt245yNDeVsPIQCaIik76/+TpbYaQkBAU8TVr1mCI0dru48ePMzAwMDAsX7qC0c7B9v+L528YmPAZQKkDGBgYGJYtnccoI61Ksj562c1ESwcgO+TE8Yt09TyxdrMwMDAw2FjZMto52P7HlgypDdasWYOVTQ+7nz59ysDAwMCA7FcWGAM5P1IzBpBjgoEh6T+2fE+r2MdmN6zsgQU+1iywdu1ShoEC9LYbIwBOHL/IcOvmdUZaWEYoPw6E3Sz0jmF5eSWUfD516lQUeXMLm/8nTxxhpJd7WNALpBfP3zAMV3DmzHEGCUkRlMKXBZbn6OXxo8d2Mhw9thOnPDsHbSMf3Z+M9I4FWMsTVxa4d/cJAz2zANNgSqL09vyABEB7Ww3j1i0HB4XnBywF4AqEgQBMIzXpDwpQWdXy39zC5v9AugEAoqG6hUn4sXEAAAAASUVORK5CYII=";
const RAISED_GATE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAQCAYAAABQrvyxAAABSElEQVR4nNWWsUrDUBSGv1sudXWoCEqJQnVxq9N9hrq5GFw6ODTPkLlv4CP0FZz6ABccHKRKC1ETWhepcXBKljgkwXSqrbcp+eAM9yT8/znJOXDFq/+SADg9h85FB601RZRSK+VOrHMARo+nC8+9tzsAbpyzf3sUz7XiC+12m8l4shCr5pZhwiMPAGFfXyUAvu8vNf8Le7vpl5ficiF//3ALQPP424gPgG3byH6/j9NziOPYiOj7xwiAJD7gqKkA8Kea/cNPAAzZUBPp8Mg8IRBmlHO9+hB/mpnVh2BYH0Br/dvABvSp7QzNixZQSiFd1yX8ChFiAx2UgARotVrGlrhMtNaI5/FT0u12t13LWgwGA2QYhsYXuCyiKMqWuJr1M5/P0waqusCNRiNroKq/AKo9QgByNptVdoQ8z0svc0EQbLuWtbAsix9fUbM2e2tIGQAAAABJRU5ErkJggg==";

type KitRow = { tiles: number[]; upperTiles?: number[] };
type Kit = { id: string; width: number; height: number; rows: KitRow[] };
type Shadow = { dx: number; dy: number; rows: number[][] };

export type FallenTownResult = {
  observatoryDoor: { x: number; y: number };
  gate: { x: number; y: number };
  guardSpot: { x: number; y: number };
};

const GRASS = 737;
const PLAZA = 1509;
/** 「버들항 물」 오토타일 — 이웃 물 방향 합(N1 E2 S4 W8) → 칸(bd-autotiles.md). */
const WATER_BY_MASK = [23025, 23040, 23048, 23056, 23064, 23072, 23080, 23088, 23096, 23104, 23112, 23120, 23128, 23136, 23144, 23152];
/** 「버들항 길 포석」 오토타일. */
const ROAD_BY_MASK = [23015, 23016, 23017, 23018, 23019, 2666, 23020, 4674, 23021, 23022, 23023, 3353, 23024, 9585, 17443, 3221];

export function reworkFallenTown(project: Project, hubId: string, ids: { observatory: string; forest: string }): FallenTownResult {
  const map = project.maps[hubId]!;
  const ts = project.tilesets[map.tilesetId] as unknown as {
    structureKits: Kit[]; autotileGroups: { id: string; memberTileIds: number[]; connectTileIds?: number[] }[];
    tileGrafts?: { targetTile: number; sourceChipset: string; sourceTile: number }[];
  };
  const W = map.width, H = map.height;
  const at = (x: number, y: number): number => y * W + x;
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  map.lowerOverlayTiles ??= Array(W * H).fill(-1);
  map.upperOverlayTiles ??= Array(W * H).fill(-1);
  const lo = map.lowerTiles, up = map.upperTiles, lo2 = map.lowerOverlayTiles!, up2 = map.upperOverlayTiles!;
  const kit = (id: string): Kit => {
    const found = ts.structureKits.find((k) => k.id === id);
    if (!found) throw new Error(`[fallen-town] 키트가 없다: ${id}`);
    return found;
  };
  const level = (x: number, y: number): number => map.relief?.levels?.[at(x, y)] ?? 0;

  /** 칸을 풀밭으로 비운다(네 층). */
  const clear = (x: number, y: number, ground = GRASS): void => {
    if (!inside(x, y)) return;
    const i = at(x, y);
    lo[i] = ground; up[i] = -1; lo2[i] = -1; up2[i] = -1;
  };
  const clearRect = (x0: number, y0: number, x1: number, y1: number, keep?: (x: number, y: number) => boolean): void => {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) if (!keep?.(x, y)) clear(x, y);
    map.structurePlacements = (map.structurePlacements ?? []).filter((p: { x: number; y: number; w: number; h: number }) =>
      p.x + p.w - 1 < x0 || p.x > x1 || p.y + p.h - 1 < y0 || p.y > y1);
  };
  /** 키트 칸을 그대로 옮겨 찍는다. cols/rows 로 키트 안 부분만, lowerRows 로 아래층을 옮길 키트 줄만 고른다. */
  const copyKit = (
    k: Kit, x0: number, y0: number,
    opt: { cols?: [number, number]; rows?: [number, number]; lower?: (kx: number, ky: number) => boolean; upper?: (kx: number, ky: number) => boolean } = {},
  ): void => {
    const [c0, c1] = opt.cols ?? [0, k.width - 1];
    const [r0, r1] = opt.rows ?? [0, k.height - 1];
    for (let ky = r0; ky <= r1; ky += 1) for (let kx = c0; kx <= c1; kx += 1) {
      const x = x0 + kx - c0, y = y0 + ky - r0;
      if (!inside(x, y)) continue;
      const row = k.rows[ky]!;
      const l = row.tiles[kx] ?? -1, u = row.upperTiles?.[kx] ?? -1;
      const i = at(x, y);
      if (l >= 0 && (opt.lower?.(kx, ky) ?? true)) { lo[i] = l; lo2[i] = -1; }
      if (u >= 0 && (opt.upper?.(kx, ky) ?? true)) { up[i] = u; up2[i] = -1; }
    }
  };
  // 그림자(beodeul_nature 덧그림) — 마을 시공기와 같은 그림자를 키트 원점 기준으로 2층에 얹는다.
  const graftOf = new Map<number, number>();
  for (const g of ts.tileGrafts ?? []) if (g.sourceChipset === "tex_beodeul_nature") graftOf.set(g.sourceTile, g.targetTile);
  const shadows = (catalog as { shadows: Record<string, Shadow> }).shadows;
  const shade = (kitId: string, x0: number, y0: number): void => {
    const s = shadows[kitId];
    if (!s) return;
    s.rows.forEach((row, j) => row.forEach((tile, i) => {
      const x = x0 + s.dx + i, y = y0 + s.dy + j;
      const t = graftOf.get(tile);
      if (tile < 0 || t === undefined || !inside(x, y)) return;
      const c = at(x, y);
      if (up[c]! < 0 && lo2[c]! < 0 && !isWater(lo[c]!)) lo2[c] = t;
    }));
  };
  const stamp = (kitId: string, x: number, y: number): void => { copyKit(kit(kitId), x, y); shade(kitId, x, y); };

  const grassSet = new Set<number>((ts as unknown as { tileGroups: { id: string; tileIds: number[] }[] }).tileGroups.find((g) => g.id === "beodeul:grass")?.tileIds ?? [GRASS]);
  const plazaSet = new Set<number>((ts as unknown as { tileGroups: { id: string; tileIds: number[] }[] }).tileGroups.find((g) => g.id === "beodeul:plaza")?.tileIds ?? [PLAZA]);
  const waterSet = new Set<number>(WATER_BY_MASK);
  const isWater = (t: number): boolean => waterSet.has(t);
  const roadGroup = ts.autotileGroups.find((g) => g.id === "beodeul_road_autotile")!;
  const roadSet = new Set(roadGroup.memberTileIds);
  const roadLink = new Set([...roadGroup.memberTileIds, ...(roadGroup.connectTileIds ?? [])]);
  const canalGroup = ts.autotileGroups.find((g) => g.id === "beodeul_canal_lake_47")!;
  const waterLink = new Set([...canalGroup.memberTileIds, ...(canalGroup.connectTileIds ?? [])]);
  /** 오토타일 칸을 이웃에 맞춰 다시 고른다(맵 밖 = 이어짐). */
  const retile = (members: Set<number>, link: Set<number>, table: number[], cells?: Iterable<number>): void => {
    const todo = cells ? [...cells] : lo.map((_, i) => i);
    const next = new Map<number, number>();
    for (const i of todo) {
      if (!members.has(lo[i]!)) continue;
      const x = i % W, y = Math.floor(i / W);
      const linked = (nx: number, ny: number): boolean => !inside(nx, ny) || link.has(lo[at(nx, ny)]!) || members.has(lo[at(nx, ny)]!);
      const mask = (linked(x, y - 1) ? 1 : 0) | (linked(x + 1, y) ? 2 : 0) | (linked(x, y + 1) ? 4 : 0) | (linked(x - 1, y) ? 8 : 0);
      next.set(i, table[mask]!);
    }
    for (const [i, t] of next) lo[i] = t;
  };

  const events = map.events;
  const transferTo = (target: string): GameEvent | undefined => events.find((e) => JSON.stringify(e).includes(`"mapId":"${target}"`));

  // ── 1. 운하: 마을 시공기의 굽이진 흙 둑 강을 돌 둑 운하로. 한 칸씩 어긋나던 굽이는 돌 둑에서 계단처럼 보여
  //    곧게 편다 — 마을 안(0~34줄)은 x CANAL_X..+3, 남쪽 들판에서 한 번 꺾인다.
  const BRIDGE_ROW = 19; // 아치 다리 위 끝 줄(갑판 = 20·21줄 = 동서 큰길 두 줄)
  let riverX = -1;
  for (let x = 0; x < W && riverX < 0; x += 1) if (isWater(lo[at(x, 10)]!)) riverX = x;
  if (riverX < 0) throw new Error("[fallen-town] 강을 찾지 못했다");
  // 남쪽 들판에서 세 칸 꺾이던 굽이는 두 웅덩이처럼 끊겨 보였다(적대 VQA) — 남 성벽 수문까지 곧게.
  const canalX = (_y: number): number => riverX;
  for (let y = 0; y < H; y += 1) {
    const cx = canalX(y);
    for (let x = Math.max(0, cx - 6); x <= Math.min(W - 1, cx + 9); x += 1) {
      const i = at(x, y);
      const want = x >= cx && x < cx + 4;
      if (want && !isWater(lo[i]!)) clear(x, y, 23152);
      else if (!want && isWater(lo[i]!)) clear(x, y, GRASS);
      // 물가 둑 덧그림(2층, beodeul_nature 30000~) — 돌 둑은 물 오토타일이 스스로 그린다.
      if (lo2[i]! >= 30000 && Math.abs(x - cx) <= 1 || lo2[i]! >= 30000 && Math.abs(x - (cx + 3)) <= 1) lo2[i] = -1;
      if (isWater(lo[i]!)) { if (lo2[i]! >= 30000) lo2[i] = -1; if (y >= BRIDGE_ROW - 2 && y <= BRIDGE_ROW + 5) up[i] = -1; }
    }
  }
  // 옛 다리(산길 돌다리, 강보다 한 칸 넓었다) 칸을 걷는다 — 큰길 두 줄은 다리 양 끝까지 포석, 나머지는 풀밭.
  for (let y = BRIDGE_ROW - 1; y <= BRIDGE_ROW + 4; y += 1) for (let x = riverX + 4; x <= riverX + 6; x += 1) {
    const road = y === BRIDGE_ROW + 1 || y === BRIDGE_ROW + 2;
    if (road || up[at(x, y)]! < 0) clear(x, y, road ? 3221 : GRASS);
  }
  retile(waterSet, waterLink, WATER_BY_MASK);

  // ── 2. 아치 돌다리 — 버들항 강 다리(bd-river-bridge)의 강 위 네 칸 + 양 끝 난간 기둥. 북 난간·상판 두 줄·남 난간·쌍아치
  //    앞면이 한 벌이다. 강 위 아치 다리(bd-bridge-arch)는 남 난간·기둥이 없어 상판이 길 한 토막처럼 떠 보였다(사용자 지적).
  //    키트 8줄 = 북 난간(물 위), 9·10줄 = 상판(마을 큰길 두 줄), 11·12줄 = 남 난간 아래 아치 앞면, 13줄부터 물.
  const riverBridge = kit("bd-river-bridge");
  const waterlineFix = new Map<number, number>();
  {
    const src = riverBridge.rows[12]!.upperTiles!.slice(7, 11);
    const tsDef = project.tilesets[map.tilesetId]!;
    const before = (tsDef.tileGrafts ?? []).length;
    const baked = bakeWorkshopObject(project as unknown as Parameters<typeof bakeWorkshopObject>[0], map.tilesetId, {
      objectId: "workshop:fallen-town-bridge-waterline", title: "물선 없는 아치 다리 밑", description: "버들항 강 다리 아치 앞면 밑 줄 — 물 위 검은 윤곽을 지운 사본(폴른 스타 왕도)",
      kind: "floor", columns: 4, rows: 1, footRows: 1, risePx: 0, use: ["다리"], gridHash: "fallen-town-bridge-waterline-v1",
      asset: { id: workshopAssetId(BRIDGE_WATERLINE_PNG), dataUrl: BRIDGE_WATERLINE_PNG, width: 64, height: 16 },
      cells: [0, 1, 2, 3].map((dx) => ({ sourceTile: dx, dx, dy: 0 })),
      provenance: { aiGenerated: false, tool: "pixel erase (bd-river-bridge 6980/6989/6998/7007 row 9 under arch openings)" },
    });
    for (const g of (tsDef.tileGrafts ?? []).slice(before)) { g.sourceTileSize = 16; g.sourceTilesPerRow = 4; }
    baked.rows[0]!.upperTiles!.forEach((id, dx) => {
      const from = src[dx]!;
      if (from < 0) return;
      tsDef.priority[id] = tsDef.priority[from] ?? "upper";
      if (tsDef.passability) (tsDef.passability as Record<number, unknown>)[id] = (tsDef.passability as Record<number, unknown>)[from];
      waterlineFix.set(from, id);
    });
  }
  const bridgeAt = (top: number): void => {
    for (let ky = 8; ky <= 12; ky += 1) for (let kx = 6; kx <= 11; kx += 1) {
      const x = riverX + kx - 7, y = top + ky - 8;
      if (!inside(x, y)) continue;
      const i = at(x, y), row = riverBridge.rows[ky]!;
      const l = row.tiles[kx] ?? -1, u0 = row.upperTiles?.[kx] ?? -1;
      const u = ky === 12 ? waterlineFix.get(u0) ?? u0 : u0;
      if (kx >= 7 && kx <= 10) {
        lo[i] = l; lo2[i] = -1; up[i] = u; up2[i] = -1;
        if (ky === 8 || ky === 12) waterLink.add(l);   // 위·아래 운하 물이 둑 테두리 없이 다리 밑으로 이어진다
        if (ky === 9 || ky === 10) roadLink.add(l);     // 양쪽 큰길이 연석 없이 상판에 닿는다
      } else if ((ky === 8 || ky === 10) && u >= 0) {
        up[i] = u; up2[i] = -1;                          // 양 끝 난간 기둥(둑 위) — 바닥은 마을 길 그대로
      }
    }
  };
  bridgeAt(BRIDGE_ROW);

  // ── 3. 천문대 탑: 재단사 집을 걷고 둥근 돌 탑을 세운다. 문 = 탑 밑 가운데(키트 문 칸 dx3,dy15). ──
  const oldObs = transferTo(ids.observatory);
  if (!oldObs) throw new Error("[fallen-town] 천문대 문을 찾지 못했다");
  const tower = kit("bd-pick-wizard-tower-wizard-tower");
  const towerX0 = riverX + 4; // 키트 원점 x(탑 몸통은 dx2~5)
  const doorY = BRIDGE_ROW;    // 탑 문 칸(막힘) — 문 앞 칸 = 큰길 윗줄
  const towerY0 = doorY - 15;
  clearRect(towerX0 + 1, towerY0 - 1, towerX0 + 7, doorY, (x, y) => level(x, y) > 0);
  copyKit(tower, towerX0, towerY0, { cols: [0, 7] });
  const observatoryDoor = { x: towerX0 + 3, y: doorY + 1 };
  oldObs.x = observatoryDoor.x; oldObs.y = observatoryDoor.y;
  // 탑 곁(운하 쪽 둑) 삼각대 놋쇠 망원경.
  stamp("bd-pick-headland-lighthouse-telescope", riverX + 4, doorY - 4);

  // ── 4. 성벽 고리 — 마을 전체를 성벽이 두른다(오프닝: 성문루가 광장 북쪽을 막고 성벽이 마을을 감싼다).
  //    성벽 조각은 버들항 도시 성벽(pn.townwall 을 자른 칸 — tiledata/beodeul-city/map.json)을 그대로 쓴다:
  //    동서 성벽 = 위 통로 1줄(2) + 앞면 2줄(219.. / 377..), 남북 성벽 = 통로 띠(78), 꼭대기 모서리 1·77, 띠 머리 5565,
  //    운하가 지나는 수문 = 도시 북벽 수문 6×3. 성벽 꺾이는 곳·남쪽 모서리는 왕성 키트 원탑(11~13열)이 덮는다.
  //    성문루 = 왕성 키트 앞 성벽 줄(원탑·창살 성문·원탑) — 광장 북쪽, 성문 밖은 동쪽 숲.
  const castle = kit("bd-castle");
  const G = 15;               // 성문 통로 줄(왕성 키트 22줄)
  const ringNE = G - 2;       // 동북 성벽 위 통로 줄(성문루 성벽보다 한 줄 낮다 — 원탑이 이음매를 덮는다)
  const WX = 30;              // 서북 성벽(맵 위 끝) ↔ 동북 성벽을 잇는 남북 성벽 열
  const SWALL = H - 3;        // 남 성벽 위 통로 줄(앞면 = 맵 아래 두 줄)
  const STREET = SWALL - 1;   // 남 성벽 안쪽 거리
  // 동북 언덕 단은 성벽 밖 숲이 된다 — 단·경사로를 없앤다(성벽이 단을 가로지르지 않게).
  const relief = map.relief as { levels?: number[]; ramps?: number[] } | undefined;
  relief?.levels?.fill(0); relief?.ramps?.fill(0);
  clearRect(WX - 1, 0, 35, G);
  clearRect(36, 0, W - 1, 20);
  clearRect(0, SWALL, W - 1, H - 1);
  const setLo = (x: number, y: number, t: number): void => { if (inside(x, y)) { const i = at(x, y); lo[i] = t; up[i] = -1; lo2[i] = -1; up2[i] = -1; } };
  const ewWall = (x0: number, x1: number, y: number): void => {
    for (let x = x0; x <= x1; x += 1) { setLo(x, y, 2); setLo(x, y + 1, 219 + (x % 31)); setLo(x, y + 2, 377 + (x % 31)); }
  };
  const nsWall = (x: number, y0: number, y1: number): void => { for (let y = y0; y <= y1; y += 1) setLo(x, y, 78); };
  ewWall(1, WX - 1, 0); setLo(0, 0, 1); setLo(WX, 0, 77);   // 서북 성벽 — 맵 위 끝
  nsWall(0, 1, SWALL);                                       // 서쪽 성벽
  nsWall(WX, 1, ringNE);                                     // 꺾이는 남북 성벽
  ewWall(WX, W - 14, ringNE);                                // 동북 성벽 → 성문루 왼쪽 원탑까지
  ewWall(0, W - 1, SWALL);                                   // 남 성벽
  setLo(W - 1, G + 1, 5565); nsWall(W - 1, G + 2, SWALL);    // 동쪽 성벽 — 성문루 끝 밑에서 남쪽 끝까지
  // 운하 수문 — 성벽 앞면의 밑 줄을 강 위 아치 다리 키트의 아치 줄(4줄: 돌 벽에 뚫린 아치 둘, 물 위)로 바꾼다.
  //   북 성벽은 아치로 운하가 마을에 흘러들고, 남 성벽은 아치로 빠져나간다(위 통로·윗 앞면 줄은 성벽 그대로).
  //   오프닝 그림의 수문은 성벽 앞면에 뚫린 돌테 쌍아치다 — 앞면 두 줄 위에 하수도 수로 아치(2×2, 물 위 돌테 아치) 둘을 나란히.
  //   다리 키트 아치 줄을 끼웠을 때는 벽면이 잘린 구멍처럼 읽혔다(적대 VQA r2 M4).
  const waterArch = kit("bd-pick-aqueduct-sewer-arch-water");
  for (const top of [1, SWALL + 1]) for (const ox of [0, 2]) {
    for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) {
      const x = riverX + ox + dx, y = top + dy, i = at(x, y);
      const r = waterArch.rows[dy]!;
      const t = r.upperTiles?.[dx] ?? -1, l = r.tiles[dx] ?? -1;
      if (t >= 0) up[i] = t; else if (l >= 0) up[i] = l;
      if (dy === 1) waterLink.add(lo[i]!); // 아치 밑 줄 성벽 앞면은 운하 물과 이어진 것으로(둑 테두리가 생기지 않게)
    }
  }
  retile(waterSet, waterLink, WATER_BY_MASK);
  // 성문루: 왕성 키트 앞 성벽 줄을 동쪽 끝에(키트 15~18줄은 성 안마당 — 원탑 지붕(윗층)만 옮긴다).
  const gateX0 = W - 13;
  const towerCol = (kx: number): boolean => (kx >= 11 && kx <= 13) || (kx >= 19 && kx <= 21) || (kx >= 29 && kx <= 31);
  copyKit(castle, gateX0, G - 7, {
    cols: [11, 11 + (W - 1 - gateX0)], rows: [15, 22],
    lower: (_kx, ky) => ky >= 19,
    upper: (kx, ky) => ky >= 19 || towerCol(kx),
  });
  const gate = { x: gateX0 + 5, y: G };
  // 왼쪽 원탑이 성문루 벽에 드리운 푸른 그림자 띠(키트 14열)가 이음매로 읽혔다(적대 VQA r2 M1) — 오른쪽 짝(18열, 방패 같은 자리)으로.
  for (let ky = 19; ky <= 22; ky += 1) { const i = at(gateX0 + 3, G - 22 + ky); lo[i] = castle.rows[ky]!.tiles[18]!; lo2[i] = -1; }
  // 성문 아래 줄 = 창살을 걷어 올린 손 도트 세 칸(막힘, 아래층).
  {
    const before = (project.tilesets[map.tilesetId]!.tileGrafts ?? []).length;
    const raised = bakeWorkshopObject(project as unknown as Parameters<typeof bakeWorkshopObject>[0], map.tilesetId, {
      objectId: "workshop:fallen-town-gate-raised", title: "걷어 올린 성문 창살", description: "왕성 성문 아래 줄 — 창살을 걷어 올린 열린 성문(폴른 스타 왕도)",
      kind: "floor", columns: 3, rows: 1, footRows: 1, risePx: 0, use: ["성문"], gridHash: "fallen-town-gate-raised-v1",
      asset: { id: workshopAssetId(RAISED_GATE_PNG), dataUrl: RAISED_GATE_PNG, width: 48, height: 16 },
      cells: [0, 1, 2].map((dx) => ({ sourceTile: dx, dx, dy: 0 })),
      provenance: { aiGenerated: false, tool: "hand-pixel (derived from bd-castle 3277-3279)" },
    });
    const tsDef = project.tilesets[map.tilesetId]!;
    for (const g of (tsDef.tileGrafts ?? []).slice(before)) { g.sourceTileSize = 16; g.sourceTilesPerRow = 3; }
    raised.rows[0]!.upperTiles!.forEach((id, dx) => {
      tsDef.priority[id] = "lower";
      const i = at(gate.x - 1 + dx, G - 1); lo[i] = id; lo2[i] = -1;
    });
  }
  // 원탑: 성벽이 꺾이는 곳·남쪽 두 모서리(밑동 = 그 자리 성벽 앞면 밑 줄).
  const towerAt = (xc: number, base: number): void => copyKit(castle, xc - 1, base - 7, { cols: [11, 13], rows: [15, 22], lower: (_kx, ky) => ky >= 19 });
  towerAt(WX, ringNE + 2);

  // ── 5. 성문 앞 포석 광장 — 성문 통로 밑 줄부터 옛 광장(우물·노점)까지. 다리에서 오는 큰길(20·21줄)이 광장에 닿는다. ──
  const ROAD_Y = BRIDGE_ROW + 1;
  for (let y = ROAD_Y; y <= ROAD_Y + 1; y += 1) for (let x = riverX + 4; x < 42; x += 1) {
    if (up[at(x, y)]! < 0 && !isWater(lo[at(x, y)]!)) clear(x, y, 3221);
  }
  for (let y = G + 1; y <= ROAD_Y + 3; y += 1) for (let x = 42; x < W - 1; x += 1) {
    const i = at(x, y);
    if (up[i]! >= 0 && y > ROAD_Y + 1) continue; // 아래쪽 집·소품은 그대로
    clear(x, y, PLAZA);
  }

  // ── 6. 숲으로 나가는 출구를 성문 통로로 옮긴다(통로 세 칸 모두 밟으면 나간다). 가운데 칸이 첫 출구다. ──
  const exit = transferTo(ids.forest);
  if (!exit) throw new Error("[fallen-town] 숲 출구를 찾지 못했다");
  exit.x = gate.x; exit.y = gate.y;
  const exitIdx = events.indexOf(exit);
  for (const dx of [-1, 1]) {
    const side = JSON.parse(JSON.stringify(exit)) as GameEvent;
    side.id = `${exit.id}_${dx < 0 ? "w" : "e"}`;
    side.x = gate.x + dx;
    for (const page of side.pages ?? []) page.id = `${page.id}_${dx < 0 ? "w" : "e"}`;
    events.splice(exitIdx + 1, 0, side);
  }

  // ── 7. 성벽 밖(동북)은 숲. ──
  const TREES = ["bd-tree-d43edd", "bd-tree-1a786c", "bd-tree-03a8f7", "bd-tree-5844f6", "bd-tree-d61d7e", "bd-tree-3e8732", "bd-tree-b1d104", "bd-tree-1e09f0", "bd-tree-a80c85", "bd-tree-bdd36e", "bd-tree-7ecdb8"];
  const SMALL = ["bd-tree-f4f319", "bd-tree-e9d9b3", "bd-tree-37f48b", "bd-tree-47e17a", "bd-tree-d105b2", "bd-tree-0f7ed1", "bd-tree-cc0fcb", "bd-tree-132848"];
  const hash = (x: number, y: number, salt: number): number => (((x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)) >>> 0);
  const nearEvent = (x: number, y: number, r: number): boolean => events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= r);
  let plazaMode = false; // 참이면 판석 칸에 놓는다(광장 소품)
  const freeGround = (x: number, y: number): boolean => {
    if (!inside(x, y)) return false;
    const i = at(x, y);
    const ground = plazaMode ? plazaSet.has(lo[i]!) : grassSet.has(lo[i]!) || lo[i]! >= 30000;
    return ground && up[i]! < 0 && up2[i]! < 0 && (!plazaMode || lo2[i]! < 0);
  };
  /** 영역 안에 나무를 빽빽이 심는다(발자국이 모두 빈 풀밭일 때만). 심은 수. */
  const plant = (x0: number, y0: number, x1: number, y1: number, kinds: string[], salt: number, ok: (x: number, y: number) => boolean = () => true, gap = 0, skip = 0): number => {
    let count = 0;
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
      const h = hash(x, y, salt);
      if (skip && h % 100 < skip) continue;
      const k = kit(kinds[(h >>> 8) % kinds.length]!);
      if (x + k.width - 1 > x1 || y + k.height - 1 > y1) continue;
      let fits = true;
      // 띄움: 발자국 둘레 gap 칸 안에 다른 물체(윗층)가 없어야 한다 — 공원처럼 나무 사이 풀밭이 보이게.
      for (let dy = -gap; dy < k.height + gap && fits; dy += 1) for (let dx = -gap; dx < k.width + gap; dx += 1) {
        if (dy >= 0 && dy < k.height && dx >= 0 && dx < k.width) continue;
        const cx = x + dx, cy = y + dy;
        if (inside(cx, cy) && up[at(cx, cy)]! >= 0 && !isPassable(project, map, cx, cy)) { fits = false; break; }
      }
      for (let dy = 0; dy < k.height && fits; dy += 1) for (let dx = 0; dx < k.width; dx += 1) {
        const cx = x + dx, cy = y + dy;
        if (!freeGround(cx, cy) || !ok(cx, cy) || level(cx, cy) !== level(x, y + k.height - 1)) { fits = false; break; }
      }
      if (!fits) continue;
      stamp(k.id, x, y); count += 1;
    }
    return count;
  };
  const outside = (x: number, y: number): boolean => !nearEvent(x, y, 2);
  plant(WX + 1, 0, W - 1, ringNE - 1, TREES, 3, outside);
  plant(WX + 1, 0, W - 1, ringNE - 1, SMALL, 5, outside);

  // 성문 광장 마감 — 성문 통로(가운데 세 줄)는 비우고 양옆에 깃발 기둥·통행세 초소·말 물통·말 매는 가로대.
  stamp("bd-pick-walled-market-banner-red", gate.x - 3, G + 1);
  stamp("bd-pick-walled-market-banner-red", gate.x + 3, G + 1);
  stamp("bd-pick-walled-market-toll-booth", gate.x + 5, G + 1);
  stamp("bd-pick-walled-market-trough", gate.x - 6, G + 3);
  stamp("bd-pick-walled-market-hitching-rail", gate.x - 6, G + 1);
  stamp("bd-prop-stall_cheese_meat", gate.x + 4, ROAD_Y);
  const guardSpot = { x: gate.x + 2, y: gate.y + 1 };

  // ── 8. 서북 밭 → 반목조 집 블록(문 앞 골목 12줄이 방앗간 옆 남북 골목에 닿는다). 서쪽 주택가도 블록으로. ──
  clearRect(1, 3, 10, 14); clearRect(11, 3, 12, 5);
  stamp("bd-block-res-10x8", 1, 4);
  for (let x = 1; x <= 13; x += 1) if (up[at(x, 12)]! < 0) clear(x, 12, 3221);
  clearRect(1, 23, 12, 31);
  for (let x = 1; x <= 13; x += 1) clear(x, 32, 3221);
  stamp("bd-block-res-10x8-b", 2, 24);

  // ── 9. 남쪽 밭 셋 → 주택 블록 둘 + 과수원. 블록 문 앞은 남 성벽 안쪽 거리, 블록 사이·양 끝 골목이 북쪽 큰길(34줄)에 닿는다. ──
  clearRect(riverX + 7, 35, W - 2, STREET);
  const south = riverX + 8; // 운하(남쪽 들판 x+3..+6) 동쪽 둑 다음 칸
  stamp("bd-block-res-14x8-c", south + 2, 35);
  stamp("bd-block-res-10x8", south + 18, 35);
  for (let x = south; x <= W - 4; x += 1) clear(x, STREET, 3221);
  for (const lane of [south, south + 1, south + 16, south + 17]) for (let y = 34; y <= STREET; y += 1) clear(lane, y, 3221);
  for (let x = south; x <= south + 17; x += 1) if (lo[at(x, 34)] === GRASS && up[at(x, 34)]! < 0) clear(x, 34, 3221);
  clearRect(4, 35, riverX - 1, STREET);
  // 둘째 아치 다리(34·35줄 갑판) — 서쪽 34줄 길과 운하 양 둑 산책길이 남쪽 거리로 건너간다(길이 운하에 막혀 끝나지 않게).
  const BRIDGE2 = 33;
  for (let y = BRIDGE2; y <= BRIDGE2 + 4; y += 1) for (let x = riverX; x < riverX + 4; x += 1) clear(x, y, 23152);
  for (let y = BRIDGE2 + 1; y <= BRIDGE2 + 2; y += 1) for (const x of [riverX - 1, riverX + 4, riverX + 5, riverX + 6, riverX + 7]) clear(x, y, 3221);
  bridgeAt(BRIDGE2);
  plant(4, 36, riverX - 2, STREET, TREES, 11);
  plant(4, 36, riverX - 2, STREET, SMALL, 13);
  // 남쪽 두 모서리 원탑(남 성벽 앞면 밑 줄이 밑동).
  clearRect(1, SWALL - 7, 3, STREET); clearRect(W - 3, SWALL - 7, W - 2, STREET);
  towerAt(1, H - 1); towerAt(W - 2, H - 1);

  // 운하 산책길 — 다리 남쪽 양 둑에 한 칸 포석 길(큰길 ↔ 남쪽 거리), 둑길 가로등.
  for (let y = BRIDGE_ROW + 3; y <= 33; y += 1) for (const x of [riverX - 1, riverX + 4]) {
    if (up[at(x, y)]! < 0 || isPassable(project, map, x, y)) clear(x, y, 3221);
  }
  for (const y of [BRIDGE_ROW + 5, BRIDGE_ROW + 10]) {
    if (freeGround(riverX + 5, y) && freeGround(riverX + 5, y + 1) && freeGround(riverX + 5, y + 2)) stamp("bd-prop-lamp_crook", riverX + 5, y);
  }

  // 길 오토타일을 이웃에 맞춰 다시 고른다(연석·모서리).
  retile(roadSet, roadLink, ROAD_BY_MASK);

  // ── 10. 빈 풀밭 메우기 — 길·광장·물에서 한 칸 띄운 풀밭에 나무, 그다음 작은 나무·덤불·꽃밭. ──
  const paved = (x: number, y: number): boolean => {
    if (!inside(x, y)) return false;
    const l = lo[at(x, y)]!;
    return roadSet.has(l) || isWater(l) || plazaSet.has(l);
  };
  const awayFromPaving = (r: number) => (x: number, y: number): boolean => {
    if (nearEvent(x, y, 2)) return false;
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (paved(x + dx, y + dy)) return false;
    return true;
  };
  plant(0, 0, W - 1, H - 1, TREES, 21, awayFromPaving(1), 0, 55);
  plant(0, 0, W - 1, H - 1, SMALL, 23, awayFromPaving(1), 0, 70);
  // 좁은 틈(블록 옆·둑 곁 한두 칸)은 가는 나무로.
  plant(0, 0, W - 1, H - 1, ["bd-tree-eef4bc", "bd-tree-28ad5e", "bd-tree-c27062"], 31, awayFromPaving(0), 0, 75);
  // 남은 맨 풀밭 칸에 들꽃 무더기(밟고 지나가는 바닥 소품)를 성기게 — 길가 풀 띠가 맨바닥 줄로 보이지 않게.
  plant(0, 0, W - 1, H - 1, ["bd-pick-wheat-roman-road-wild-a", "bd-pick-wheat-roman-road-wild-b", "bd-pick-deep-forest-path-wild-b", "bd-pick-deep-forest-path-wild-c", "bd-pick-deep-forest-path-fern-c"], 37,
    (x, y) => !nearEvent(x, y, 1) && lo2[at(x, y)]! < 0, 0, 45);

  // 광장 가장자리 소품 — 판석이 한 면으로 비지 않게. 성문 통로 앞 다섯 줄(행진 길)과 사람·출입구 둘레는 비운다.
  plazaMode = true;
  plant(0, G + 1, W - 1, H - 1, ["bd-prop-planter_round", "bd-prop-bench_wood", "bd-prop-crate_apple", "bd-prop-flower_cart", "bd-pick-walled-market-sack-pile", "bd-prop-goods_pile", "bd-prop-veg_cart", "bd-prop-tree_planter", "bd-prop-stall_herb_flower"], 41,
    (x, y) => !nearEvent(x, y, 2) && Math.abs(x - gate.x) > 1 && !(y >= ROAD_Y && y <= ROAD_Y + 1 && x < gate.x), 1, 15);
  plazaMode = false;

  // 길·광장 위에 남은 덧그림 그림자 — 바로 위 칸에 그림자를 드리울 물체가 없으면 떠 있는 갈색 줄로 읽혔다(적대 VQA r2 M3, (2~6,33)).
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = at(x, y);
    if (lo2[i]! < 30000 || !paved(x, y) || up[i]! >= 0) continue;
    const caster = inside(x, y - 1) && (up[at(x, y - 1)]! >= 0 || !isPassable(project, map, x, y - 1));
    if (!caster) lo2[i] = -1;
  }

  // ── 11. 사람 자리 — 새 담·나무·소품에 갇히거나 올라선 사람은 천문대 문 앞에서 걸어 닿는 가장 가까운 빈 칸으로. ──
  const reach = new Set<number>();
  const start = at(observatoryDoor.x, observatoryDoor.y + 1);
  const people = events.filter((e) => e.pages?.[0]?.priority === "same");
  const blocker = new Set(people.map((e) => at(e.x, e.y)));
  reach.add(start);
  for (const q = [start]; q.length;) {
    const c = q.shift()!, x = c % W, y = Math.floor(c / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (!inside(nx, ny)) continue;
      const n = at(nx, ny);
      if (reach.has(n) || blocker.has(n) || !isPassable(project, map, nx, ny)) continue;
      reach.add(n); q.push(n);
    }
  }
  const touchable = (e: { x: number; y: number }): boolean => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(e.x + dx!, e.y + dy!) && reach.has(at(e.x + dx!, e.y + dy!)));
  for (const person of people) {
    const home = person.id.endsWith("_gate") ? guardSpot : undefined;
    if (!home && isPassable(project, map, person.x, person.y) && touchable(person)) continue;
    const want = home ?? { x: person.x, y: person.y };
    let best: { x: number; y: number; d: number } | undefined;
    for (const c of reach) {
      const x = c % W, y = Math.floor(c / W);
      // 다른 사람과 붙지 않고, 출입구(문·성문) 앞 세 칸 안에는 서지 않는다(도착 칸을 막지 않게).
      if (events.some((e) => e !== person && Math.abs(e.x - x) + Math.abs(e.y - y) <= (e.pages?.[0]?.priority === "same" ? 1 : home ? 1 : 3))) continue;
      const d = Math.abs(x - want.x) + Math.abs(y - want.y);
      if (!best || d < best.d) best = { x, y, d };
    }
    if (best) { person.x = best.x; person.y = best.y; }
  }
  return { observatoryDoor, gate, guardSpot };
}
