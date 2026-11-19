// project/modernCityKoreanGround.ts
// 한국 지구 구성기의 바닥 — 보도·골목 바닥·아스팔트·연석·중앙선·횡단보도·광장·물·모래. 칸 번호는 사전(묶음·키트)에서만 읽는다.
// 골목 바닥은 차도가 아니다(이름표가 차도 낱말을 갖지 않는 칸): 행인·사람 배치 규칙이 골목을 걷는 길로 본다. 전용 묶음 mc:kr-alley 가 없으면 콘크리트 바닥을 쓴다.
import { cellHash, lawnTile, type Board, type MCPalette, type Use } from "./modernCityBoard";

export interface KRGround {
  walk(x: number, y: number): void;
  alley(x: number, y: number, use?: Use): void;
  /** 건물 뒤 마당·필지 바닥(골목과 다른 결). */
  yard(x: number, y: number): void;
  asphalt(x: number, y: number): void;
  curb(x: number, y: number, roadSide: "s" | "n" | "e" | "w"): void;
  /** 가로 도로 한 열(폭 4 또는 6) — 가운데 두 줄이 노란 중앙선. */
  roadColumn(x: number, y0: number, width: number): void;
  crosswalk(x: number, y: number, across: "ew" | "ns"): void;
  plaza(x: number, y: number): void;
  lawn(x: number, y: number): void;
  sand(x: number, y: number): void;
  water(x: number, y: number): void;
  tactile(x: number, y: number): void;
  manhole(x: number, y: number): void;
  /** 주차장 바닥 · 시장 통로 바닥 · 자전거길 · 나무 데크 · 놀이터 탄성 바닥 — 전용 그림이 없으면 기존 주차장 노면·광장·모래를 쓴다. */
  lot(x: number, y: number): void;
  arcade(x: number, y: number): void;
  bike(x: number, y: number): void;
  deck(x: number, y: number): void;
  play(x: number, y: number): void;
  /** 가게 앞 타일: 이미 걷는 칸의 바닥 그림만 바꾼다(그림이 없으면 그대로). */
  front(x: number, y: number): void;
}
/** 지구 종류가 고른 바닥 그림 이름(키트 mc-prop-kr-<이름>, 굽기 bake_kr_street.py) — 없는 이름·없는 키트는 기본 바닥. */
export type KRGroundNames = Readonly<Partial<Record<"walk" | "alley" | "yard" | "lot" | "arcade" | "bike" | "deck" | "play" | "front", string>>>;

export function koreanGround(b: Board, pal: MCPalette, names: KRGroundNames = {}): KRGround {
  // 바닥 그림 키트의 아래층 칸 배열을 가로·세로로 되풀이한다.
  const pat = (name: string | undefined) => { const k = name ? pal.kit(`mc-prop-kr-${name}`) : undefined; return k && k.rows.every((r) => r.tiles.every((t) => t >= 0)) ? (x: number, y: number) => k.rows[y % k.height]!.tiles[x % k.width]! : undefined; };
  const P = { walk: pat(names.walk), alley: pat(names.alley), yard: pat(names.yard), lot: pat(names.lot), arcade: pat(names.arcade), bike: pat(names.bike), deck: pat(names.deck), play: pat(names.play), front: pat(names.front) };
  const side = pal.group("mc:sidewalk"), road = pal.group("mc:road"), curb = pal.group("mc:curb"), cross = pal.group("mc:crosswalk"), plaza = pal.group("mc:plaza");
  const green = pal.group("mc:green"), water = pal.group("mc:water"), manhole = pal.group("mc:marking-manhole");
  const yardOwn = pal.group("mc:kr-yard"), granite = pal.group("mc:interior-floor-mci-tile-concourse");
  const alleyOwn = pal.group("mc:kr-alley"), concrete = pal.group("mc:interior-floor-mci-concrete");
  // The plain drive aisle in the parking kit is tagged as parking, so the street walker can cross it.
  const parking = pal.kit("mc-parking-two-bays")?.rows[3]?.tiles[0];
  const lotGround = parking !== undefined && parking >= 0 ? parking : concrete[0] ?? side[0];
  // Hand-interior materials store four shadow states per pattern cell. Outside, use the unshaded state.
  const outdoorFloor = (tiles: readonly number[], period: number, x: number, y: number) =>
    tiles[((y % period) * period + x % period) * 4];
  function paving(material: string | undefined, x: number, y: number) {
    if (material === "pave-red") return plaza[0];
    if (material === "pave-check") return plaza[(x + y) % 2];
    if (material === "pave-granite") return outdoorFloor(granite, 2, x, y);
    return undefined;
  }
  const center = pal.kit("mc-road-ew-2lane");
  const lineA = center?.rows[2]?.tiles[0] ?? road[0]!, lineB = center?.rows[3]?.tiles[0] ?? road[0]!;
  const tact = pal.kit("mc-in-mci-tactile"); const tactTile = tact?.rows[0]?.upperTiles?.[0] ?? tact?.rows[0]?.tiles[0] ?? -1;
  const set = (x: number, y: number, t: number | undefined, use: Use) => { if (!b.in(x, y) || t === undefined || t < 0) return; const i = b.k(x, y); b.lower[i] = t; b.use[i] = use; };
  const G: KRGround = {
    walk: (x, y) => set(x, y, P.walk?.(x, y) ?? paving(names.walk, x, y) ?? side[0], "walk"),
    alley: (x, y, use = "yard") => {
      // 전용 골목 바닥이 있으면 칸 해시로 섞고, 없으면 콘크리트 16칸(4×4 무늬)을 자리대로.
      const t = P.alley ? P.alley(x, y) : alleyOwn.length ? alleyOwn[Math.floor(cellHash(x, y, 7) * alleyOwn.length)] : paving(names.alley, x, y) ?? outdoorFloor(concrete, 4, x, y) ?? side[0];
      set(x, y, t, use);
    },
    yard: (x, y) => set(x, y, P.yard ? P.yard(x, y) : yardOwn.length ? yardOwn[Math.floor(cellHash(x, y, 13) * yardOwn.length)] : outdoorFloor(granite, 2, x, y) ?? side[0], "yard"),
    asphalt: (x, y) => set(x, y, road[0], "road"),
    curb: (x, y, s) => set(x, y, curb[s === "s" ? 0 : s === "n" ? 1 : s === "e" ? 2 : 3] ?? side[0], "walk"),
    roadColumn: (x, y0, width) => {
      const mid = Math.floor(width / 2) - 1;
      for (let k = 0; k < width; k++) set(x, y0 + k, k === mid ? lineA : k === mid + 1 ? lineB : road[0], "road");
    },
    crosswalk: (x, y, across) => set(x, y, across === "ew" ? cross[0] : cross[1] ?? cross[0], "road"),
    plaza: (x, y) => set(x, y, plaza[(x + y) % Math.max(1, plaza.length)] ?? side[0], "walk"),
    lawn: (x, y) => set(x, y, green.length ? lawnTile(pal, x, y) : side[0], "park"),
    sand: (x, y) => set(x, y, green[3] ?? plaza[0] ?? side[0], "park"),
    water: (x, y) => set(x, y, water[0] ?? road[0], "bld"),
    tactile: (x, y) => { if (tactTile >= 0 && b.in(x, y) && b.use[b.k(x, y)] === "walk" && b.upper[b.k(x, y)] < 0) b.lower[b.k(x, y)] = tactTile; },
    lot: (x, y) => set(x, y, P.lot?.(x, y) ?? lotGround, "yard"),
    arcade: (x, y) => { if (P.arcade) set(x, y, P.arcade(x, y), "walk"); else G.plaza(x, y); },
    bike: (x, y) => { if (P.bike) set(x, y, P.bike(x, y), "walk"); else G.plaza(x, y); },
    deck: (x, y) => { if (P.deck) set(x, y, P.deck(x, y), "walk"); else G.plaza(x, y); },
    play: (x, y) => { if (P.play) set(x, y, P.play(x, y), "park"); else G.sand(x, y); },
    front: (x, y) => { if (P.front && b.in(x, y) && b.use[b.k(x, y)] === "walk") b.lower[b.k(x, y)] = P.front(x, y); },
    manhole: (x, y) => { const t = manhole[Math.floor(cellHash(x, y, 11) * Math.min(2, manhole.length))]; if (t !== undefined && b.in(x, y) && b.upper[b.k(x, y)] < 0 && !b.keep[b.k(x, y)]) b.upper[b.k(x, y)] = t; },
  };
  return G;
}
