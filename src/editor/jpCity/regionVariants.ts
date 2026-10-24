// 역전(station_plaza) 장면을 판마다 다르게 — 2026-10-24 v2 다양성 검수 「역 앞 상점가는 매번 같은 그림」(blind sameness 10/10).
// 카탈로그의 고정 op 목록 대신 짜임 손잡이(광장 꼴·랜드마크·앞줄 가게 구성과 순서·고가 아래 줄·좌우 뒤집기)로 장면을 펼친다.
// 손잡이를 모델이 고르면 그대로, 안 고른 것은 씨앗으로 고른다. 같은 씨앗·같은 손잡이 = 같은 장면.
import type { JpRegion, JpRegionOp } from "./japaneseRegionsCatalog";

export type StationPlazaKind = "rotary" | "crossing" | "square";
export type StationLandmark = "fountain" | "hachiko" | "clock" | "zelkova" | "kiosk";

export interface StationPlazaLayout {
  readonly plaza?: StationPlazaKind;
  readonly landmark?: StationLandmark;
  /** 앞줄 가게(왼쪽부터). STATION_SHOP_POOL 의 짧은 이름. */
  readonly shops?: readonly string[];
  readonly mirror?: boolean;
}

/** 앞줄 가게 짧은 이름 → 키트. */
export const STATION_SHOP_POOL: Readonly<Record<string, string>> = {
  books: "jp-bldg-shop-books", cafe: "jp-bldg-shop-cafe", pharmacy: "jp-bldg-shop-pharmacy", ramen: "jp-bldg-shop-ramen",
  bakery: "jp-bldg-shop-bakery", izakaya: "jp-bldg-shop-izakaya", sushi: "jp-bldg-shop-sushi", soba: "jp-bldg-shop-soba",
  teishoku: "jp-bldg-shop-teishoku", flower: "jp-bldg-shop-flower", barber: "jp-bldg-shop-barber", cleaning: "jp-bldg-shop-cleaning",
  wagashi: "jp-bldg-shop-wagashi", conbini: "jp-bldg-conbini", parking: "jp-coin-parking", office: "jp-bldg-office6",
};
export const STATION_PLAZA_KINDS: readonly StationPlazaKind[] = ["rotary", "crossing", "square"];
export const STATION_LANDMARKS: readonly StationLandmark[] = ["fountain", "hachiko", "clock", "zelkova", "kiosk"];
const LANDMARK_KIT: Readonly<Record<StationLandmark, string>> = {
  fountain: "jp-lot-fountain", hachiko: "jp-prop-hachiko", clock: "jp-lot-clock", zelkova: "jp-prop-tree-zelkova", kiosk: "jp-lot-kiosk",
};

function rng(seed: number): () => number {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
function shuffle<T>(r: () => number, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const j = (r: () => number, f: number, d: number) => Math.round((f + (r() * 2 - 1) * d) * 1000) / 1000;

/** 역전 장면 op 목록과 실제로 쓴 손잡이. */
export function stationPlazaOps(seed: number, layout: StationPlazaLayout = {}): { ops: JpRegionOp[]; used: Required<StationPlazaLayout> } {
  const r = rng((Math.imul(seed, 0x9e3779b1) + 17) >>> 0);
  const plaza = layout.plaza && STATION_PLAZA_KINDS.includes(layout.plaza) ? layout.plaza : pick(r, STATION_PLAZA_KINDS);
  const landmark = layout.landmark && STATION_LANDMARKS.includes(layout.landmark) ? layout.landmark : pick(r, STATION_LANDMARKS);
  const mirror = typeof layout.mirror === "boolean" ? layout.mirror : r() < 0.5;
  const asked = (layout.shops ?? []).filter((s) => STATION_SHOP_POOL[s]);
  const shops = asked.length ? [...new Set(asked)].slice(0, 7) : shuffle(r, Object.keys(STATION_SHOP_POOL)).slice(0, 6 + Math.floor(r() * 2));
  const ops: JpRegionOp[] = [];
  const M = { pave: "판석 광장", walk: "콘크리트 판석 보도", lane: "생활도로", road: "거리 · 도로·정지선", lawn: "잔디", gravel: "자갈 참배길", rail: "선로" };

  // 선로와 고가(맨 위 고정 — 3/4 시점에서 고가 아래 가게가 앞을 본다). 열차 수·위치·고가 아래 줄 순서는 씨앗.
  ops.push({ op: "area", mat: M.gravel, box: [0, 0, 1, 0.14], clear: true });
  ops.push({ op: "band", mat: M.rail, dir: "h", at: 0.06, size: 1 });
  ops.push({ op: "band", mat: M.rail, dir: "h", at: 0.12, size: 1 });
  const trains = shuffle(r, ["jp-prop-train10-b", "jp-prop-train8-y", "jp-prop-train8-g"]).slice(0, 1 + Math.floor(r() * 2));
  trains.forEach((kit, i) => ops.push({ op: "put", kit, at: [i === 0 ? j(r, 0.25, 0.08) : j(r, 0.72, 0.08), i === 0 ? 0.06 : 0.08], onPath: true }));
  ops.push({ op: "line", kit: "jp-prop-catenary-pole", dir: "h", at: 0.04, span: [0.06, 0.94], step: 8 + Math.floor(r() * 5), onPath: true });
  const under = shuffle(r, ["jp-prop-viaduct6-shops", "jp-prop-viaduct6-pass", pick(r, ["jp-prop-viaduct6-shops", "jp-bldg-koban", "jp-bldg-conbini"]), pick(r, ["jp-bldg-koban", "jp-bldg-office6", "jp-prop-viaduct6-shops"])]);
  under.splice(1 + Math.floor(r() * (under.length - 1)), 0, "jp-bldg-station-small");
  ops.push({ op: "row", kits: [...new Set(under)], foot: 0.33, span: [0.01, 0.99], gap: r() < 0.5 ? 0 : 1 });
  ops.push({ op: "band", mat: M.walk, dir: "h", at: 0.38, size: 2 });

  const roadY = j(r, 0.66, 0.02);
  const lk = LANDMARK_KIT[landmark];
  const extras = shuffle(r, STATION_LANDMARKS.filter((l) => l !== landmark)).slice(0, 1 + Math.floor(r() * 2)).map((l) => LANDMARK_KIT[l]);
  const cx = plaza === "crossing" ? pick(r, [0.3, 0.7]) : j(r, 0.5, 0.06);
  if (plaza === "rotary") {
    // 로터리: 양옆 차로가 잔디 섬을 둘러싼다. 섬 크기·차로 자리는 씨앗.
    const lane = j(r, 0.18, 0.04);
    ops.push({ op: "band", mat: M.lane, dir: "v", at: lane, size: 3, span: [0.38, roadY] });
    ops.push({ op: "band", mat: M.lane, dir: "v", at: 1 - lane, size: 3, span: [0.38, roadY] });
    const hw = j(r, 0.17, 0.04);
    ops.push({ op: "area", mat: M.lawn, box: [cx - hw, 0.44, cx + hw, 0.56], clear: true });
    ops.push({ op: "area", mat: M.pave, box: [cx - 0.07, 0.45, cx + 0.07, 0.55], clear: true, zone: "plaza" });
    ops.push({ op: "put", kit: lk, at: [cx, 0.5], onPath: true });
    extras.forEach((k, i) => ops.push({ op: "put", kit: k, at: [cx + (i ? 0.1 : -0.1), 0.5], onPath: true }));
    ops.push({ op: "put", kit: "jp-prop-bench", at: [cx - hw + 0.03, 0.57], onPath: true });
    ops.push({ op: "put", kit: "jp-prop-bench", at: [cx + hw - 0.03, 0.57], onPath: true });
  } else if (plaza === "crossing") {
    // 교차로: 광장 한쪽으로 큰길이 내려와 앞길과 만나고(횡단보도), 다른 쪽 반이 보행 광장이다.
    const roadX = 1 - cx;
    ops.push({ op: "band", mat: M.road, dir: "v", at: roadX, size: 4, span: [0.4, roadY] });
    ops.push({ op: "area", mat: M.pave, box: [cx - 0.16, 0.43, cx + 0.16, 0.58], clear: true, zone: "plaza" });
    ops.push({ op: "put", kit: lk, at: [cx, 0.5], onPath: true });
    extras.forEach((k, i) => ops.push({ op: "put", kit: k, at: [cx + (i ? 0.11 : -0.11), 0.49], onPath: true }));
    ops.push({ op: "line", kit: "jp-prop-planter", dir: "h", at: 0.44, span: [cx - 0.14, cx + 0.14], step: 6, onPath: true });
    ops.push({ op: "put", kit: pick(r, ["jp-prop-car-taxi", "jp-prop-car-white", "jp-prop-van-white"]), at: [roadX, j(r, 0.5, 0.04)], onPath: true });
    ops.push({ op: "put", kit: "jp-prop-bench", at: [cx - 0.08, 0.57], onPath: true });
  } else {
    // 너른 광장: 차로 없이 판석 광장 전체, 랜드마크 둘레로 나무와 벤치.
    ops.push({ op: "area", mat: M.pave, box: [0.06, 0.42, 0.94, 0.6], clear: false, zone: "plaza" });
    ops.push({ op: "put", kit: lk, at: [cx, 0.5], onPath: true });
    extras.forEach((k, i) => ops.push({ op: "put", kit: k, at: [i ? j(r, 0.78, 0.05) : j(r, 0.22, 0.05), 0.5], onPath: true }));
    ops.push({ op: "scatter", kits: ["jp-prop-tree-zelkova", "jp-prop-tree-ginkgo"], n: 2 + Math.floor(r() * 3), box: [0.08, 0.43, 0.92, 0.58] });
    ops.push({ op: "scatter", kits: ["jp-prop-bench", "jp-prop-planter"], n: 3 + Math.floor(r() * 3), box: [0.1, 0.44, 0.9, 0.59], onPath: true });
  }
  // 곁 소품: 후보 자리 여섯에 씨앗 순서로 몇 개만.
  const sideKits = shuffle(r, ["jp-prop-metro-exit", "jp-prop-vend-trio", "jp-prop-bike-cluster", "jp-prop-smoking-area", "jp-postbox-red", "jp-prop-vend-pair", "jp-prop-a-frame"]).slice(0, 3 + Math.floor(r() * 3));
  const slots = shuffle(r, [[0.07, 0.48], [0.93, 0.48], [0.07, 0.57], [0.93, 0.57], [0.36, 0.42], [0.64, 0.42]] as const);
  sideKits.forEach((kit, i) => { const s = slots[i]; if (s) ops.push({ op: "put", kit, at: [s[0], s[1]], onPath: true }); });
  if (plaza !== "square") {
    // 원래 판만큼 차게: 가로수 둘·화분 둘·벤치 둘(자리는 씨앗).
    const tx = j(r, 0.27, 0.04);
    ops.push({ op: "put", kit: pick(r, ["jp-prop-tree-zelkova", "jp-prop-tree-ginkgo"]), at: [tx, 0.48] });
    ops.push({ op: "put", kit: pick(r, ["jp-prop-tree-zelkova", "jp-prop-tree-ginkgo", "jp-prop-tree-sakura"]), at: [mx(tx), 0.48] });
    ops.push({ op: "put", kit: "jp-prop-planter", at: [j(r, 0.35, 0.03), 0.43], onPath: true });
    ops.push({ op: "put", kit: "jp-prop-planter", at: [j(r, 0.65, 0.03), 0.43], onPath: true });
    ops.push({ op: "put", kit: "jp-prop-bench", at: [j(r, 0.4, 0.04), 0.58], onPath: true });
  }
  ops.push({ op: "line", kit: "jp-bus-stop", dir: "h", at: 0.6, span: pick(r, [[0.12, 0.34], [0.66, 0.88]] as const), step: 8, onPath: true });
  ops.push({ op: "line", kit: "jp-prop-lamp-post", dir: "h", at: 0.6, span: [0.06, 0.94], step: 9 + Math.floor(r() * 4), onPath: true });

  // 앞길: 차 종류·자리는 씨앗.
  ops.push({ op: "band", mat: M.road, dir: "h", at: roadY, size: 4 });
  const cars = shuffle(r, ["jp-prop-bus", "jp-prop-car-taxi", "jp-prop-car-taxi-r", "jp-prop-car-red-r", "jp-prop-car-blue", "jp-prop-car-silver-r", "jp-prop-bus-r"]).slice(0, 2 + Math.floor(r() * 2));
  cars.forEach((kit, i) => ops.push({ op: "put", kit, at: [j(r, 0.2 + i * 0.28, 0.06), /-r$/.test(kit) ? roadY + 0.02 : roadY - 0.01], onPath: true }));
  ops.push({ op: "band", mat: M.walk, dir: "h", at: roadY + 0.09, size: 2 });
  ops.push({ op: "row", kits: shops.map((s) => STATION_SHOP_POOL[s]!), foot: 0.96, span: [0.01, 0.99], gap: r() < 0.5 ? 0 : 1 });

  const out = mirror ? ops.map(mirrorOp) : ops;
  return { ops: out, used: { plaza, landmark, shops, mirror } };
}

const mx = (x: number) => Math.round((1 - x) * 1000) / 1000;
function mirrorOp(o: JpRegionOp): JpRegionOp {
  switch (o.op) {
    case "area": return { ...o, box: [mx(o.box[2]), o.box[1], mx(o.box[0]), o.box[3]] };
    case "scatter": return { ...o, box: [mx(o.box[2]), o.box[1], mx(o.box[0]), o.box[3]] };
    case "band": return o.dir === "v" ? { ...o, at: mx(o.at) } : o.span ? { ...o, span: [mx(o.span[1]), mx(o.span[0])] } : o;
    case "line": return o.dir === "v" ? { ...o, at: mx(o.at) } : { ...o, span: [mx(o.span[1]), mx(o.span[0])] };
    case "put": return { ...o, at: [mx(o.at[0]), o.at[1]] };
    case "row": case "lots": return { ...o, kits: [...o.kits].reverse(), span: [mx(o.span[1]), mx(o.span[0])] };
    case "street": return { ...o, points: o.points.map(([x, y]) => [mx(x), y] as const) };
    default: return o;
  }
}

/** 지역에 짜임 변주가 있으면 그 판의 지역 정의를 돌려준다(지금은 역전). 없으면 그대로. */
export function regionWithLayout(region: JpRegion, seed: number, layout?: StationPlazaLayout): { region: JpRegion; layout?: Required<StationPlazaLayout> } {
  if (region.id !== "station_plaza" || region.engine.kind !== "scene") return { region };
  const { ops, used } = stationPlazaOps(seed, layout);
  return { region: { ...region, engine: { ...region.engine, ops } }, layout: used };
}
