// project/jpCitySceneStreets.ts
// 거리 장면의 길 꾸밈 — 하천 띠(둑·다리·둘째 인도교·물가 계단·배·담쟁이·벚나무 산책로), 큰길(횡단보도·외측선·차·가로등·전봇대와 전선·표지),
// 생활도로(길 가장자리 표지·쓰레기장), 보행자 시장 길(노점·초롱 줄), 아케이드 지붕, 육교, 지도 끝 담.
import { arcadeGateKit, arcadeRoofKit, FLAVOR_ARCADE } from "@/project/jpShitamachiStreet";
import { Occ, type SceneBand, type SceneCtx, type SceneLayout, type SceneVStreet } from "@/project/jpCitySceneCtx";
import { sceneList } from "@/project/jpCitySceneKinds";

/** 키 큰 가로 시설(전봇대·가로등·가로수·표지): 4층 덧그림으로 — 뒤의 차도 표시·가드레일·둑을 지우지 않고 그 앞에 선다. */
const TALL = { layer4: true, over: [Occ.Lot, Occ.Walk, Occ.Road, Occ.Water, Occ.Wall] } as const;
const crossing = (L: SceneLayout, i: number): SceneVStreet[] => L.vstreets.filter((v) => v.from <= i && v.to > i);
/** 이 큰길 줄에 닿는 세로 길(지나가거나 여기서 시작·끝나는 것). */
const touching = (L: SceneLayout, b: SceneBand): SceneVStreet[] => L.vstreets.filter((v) => v.y0 <= b.front.road1 + 1 && v.y1 >= b.front.road0 - 1);

/** 육교: 지도를 끝까지 지나는 세로 큰길의 맨 위(지도 끝)에 — 서쪽 계단 · 붉은 상판 · 동쪽 계단. 계단 발치에서 올라 길을 건너 내려온다. 세로 길은 그 아래로 온전하다. */
export function placeOverpass(c: SceneCtx, L: SceneLayout): void {
  const v = L.vstreets.find((q) => q.main), b0 = L.bands[0]!;
  if (!v || v.lane % 2 || !v.sw || !c.size("jp-overpass-stair-e") || !c.size("jp-overpass-deck-red")) return;
  const y = 1;
  if (b0.foot < y + 8 || v.x < 2 || v.x + v.w + 1 > c.W) return;
  c.raw("jp-overpass-stair-e", v.x - 1, y, "prop");
  for (let k = 0; k < v.lane / 2; k++) c.raw("jp-overpass-deck-red", v.x + 1 + 2 * k, y, "prop");
  c.raw("jp-overpass-stair-w", v.x + v.w - 1, y, "prop");
  c.mark(v.x - 1, 0, v.w + 2, y + 8, Occ.Wall);
  c.mark(v.x - 1, y + 8, v.w + 2, 1, Occ.Walk, [Occ.Lot]);                // 계단 발치는 비운다
  for (let yy = 0; yy < y + 8; yy++) for (let xx = v.x - 1; xx <= v.x + v.w; xx++) c.drawn[yy * c.W + xx] = 1;
  for (const blk of L.blocks) if (blk.band.index === 0) {
    if (blk.ex === v.x) blk.ex -= 1;
    if (blk.sx === v.x + v.w) blk.sx += 1;
  }
  for (const id of ["jp-overpass-stair-e", "jp-overpass-deck-red", "jp-overpass-stair-w"]) c.usedProps.set(id, 1);
  c.piecesUsed.push("overpass");
}

export function dressRiver(c: SceneCtx, L: SceneLayout): void {
  const { W, rng, tone } = c;
  for (const b of L.bands) {
    const s = b.front, rv = s.river;
    if (!rv) continue;
    const cross = crossing(L, b.index);
    const spans: [number, number][] = cross.map((v) => [v.x, v.x + v.w]);
    const clear = (x: number, w: number, pad = 1) => !spans.some(([a, e]) => x < e + pad && x + w > a - pad);
    const rail = (x: number) => { for (let y = rv.wall; y <= rv.bank1; y++) { const post = y === rv.wall || y === rv.bank1 || ((y - rv.wall) % 3 === 0 && rv.bank1 - y >= 2); c.raw(post ? "jp-bridge-post" : "jp-bridge-rail-v", x, y, "bridge"); } c.mark(x, rv.wall, 1, rv.bank1 - rv.wall + 1, Occ.Wall); };
    // 둘째 다리(나무 인도교): 넓은 지도에 다리가 하나뿐이면 14칸 넘게 떨어진 자리에.
    if (W >= 52 && cross.length <= 1) for (let t = 0; t < 12; t++) {
      const fx = 4 + Math.floor(rng() * (W - 12));
      if (!clear(fx, 4, 13)) continue;
      c.fill(fx + 1, rv.wall, 2, rv.bank1 - rv.wall + 1, tone.plaza);
      spans.push([fx, fx + 4]);
      break;
    }
    // 물가 계단(둑을 내려가 물가 디딤판 — 낚시터)과 매어 둔 배
    const stair = sceneList("kawa", "step")[0], boat = sceneList("kawa", "water")[0];
    let stairX = -1;
    if (stair) for (let t = 0; t < 12 && stairX < 0; t++) { const sx = 2 + Math.floor(rng() * (W - 12)); if (clear(sx, 8, 2)) stairX = sx; }
    for (let x = 0; x < W; x++) {
      if (spans.some(([a, e]) => x >= a && x < e) || (stairX >= 0 && x >= stairX && x < stairX + 8)) continue;
      c.raw("jp-river-wall", x, rv.wall); c.raw("jp-water-shade", x, rv.water0); c.raw("jp-water-rim-s", x, rv.water1); c.raw("jp-bank-lip", x, rv.bank0); c.raw("jp-bank-slope", x, rv.bank1);
    }
    for (const [a, e] of spans) {
      const wood = !cross.some((v) => v.x === a);
      for (let x = a + 1; x < e - 1; x++) for (let y = wood ? rv.wall : rv.water0; y <= (wood ? rv.bank1 : rv.water1); y++) c.raw(wood || (y !== rv.water0 && y !== rv.water1) ? "jp-bridge-plank" : y === rv.water0 ? "jp-bridge-lip" : "jp-bridge-pier", x, y, "bridge");
      c.mark(a + 1, rv.wall, e - a - 2, rv.bank1 - rv.wall + 1, Occ.Road);
      rail(a); rail(e - 1);
      for (let y = rv.water0 + 1; y < rv.water1; y++) { c.raw("jp-water-dark", a - 1, y, "bridge"); c.raw("jp-water-dark-r", e, y, "bridge"); }
    }
    if (stairX >= 0 && stair) {
      c.fill(stairX + 1, rv.water0, 6, 1, tone.plaza);
      c.put(stair, stairX, rv.wall, { baseRows: 4, base: [Occ.Water] });
      for (let x = stairX + 1; x < stairX + 7; x++) c.raw("jp-bridge-plank", x, rv.water0, "bridge");
      if (boat) for (const bx of [stairX + 8, stairX - 7]) if (clear(bx, 6, 0) && c.put(boat, bx, rv.water0, { baseRows: 3, base: [Occ.Water] })) break;
    } else if (boat) for (let t = 0; t < 8; t++) { const bx = 2 + Math.floor(rng() * (W - 10)); if (clear(bx, 6) && c.put(boat, bx, rv.water0, { baseRows: 3, base: [Occ.Water] })) break; }
    for (let x = 3 + Math.floor(rng() * 5); x < W - 1; x += 8 + Math.floor(rng() * 6)) if (c.at(x, rv.wall) === Occ.Water) c.raw("jp-wall-drain", x, rv.wall + 2);
    for (let x = 2 + Math.floor(rng() * 4); x < W - 1; x += 2 + Math.floor(rng() * 3)) if (c.at(x, rv.water0 + 1) === Occ.Water) c.raw(rng() < 0.5 ? "jp-water-streak" : "jp-water-glint", x, rv.water0 + 1 + Math.floor(rng() * Math.max(1, rv.water1 - rv.water0 - 1)));
    // 둑 벽: 담쟁이·나팔꽃·사다리(4층 덧그림)
    const wall = sceneList("kawa", "wall");
    for (let x = 1 + Math.floor(rng() * 4); x < W - 1; x += 4 + Math.floor(rng() * 5)) { const id = c.least(wall); if (id) c.put(id, x, rv.wall + 1, { layer4: true, baseRows: 3, base: [Occ.Water], over: [Occ.Water] }); }
    // 북쪽 산책로(난간 쪽 줄): 벤치·화단·돌등롱
    for (let x = 2 + Math.floor(rng() * 3); x < W - 2; ) { const id = c.putAny(sceneList("kawa", "rail"), x, s.nK!, { gap: true }); x += (id ? c.size(id)![0] : 1) + 3 + Math.floor(rng() * 4); }
    // 남쪽 산책로: 벚나무 줄, 사이사이 가로등·벤치
    const tree = sceneList("kawa", "tree")[0];
    for (let x = 1 + Math.floor(rng() * 3); x + 4 < W; x += 7 + Math.floor(rng() * 2)) {
      if (tree && clear(x, 4)) c.putFoot(tree, x, s.sB, TALL);
      if (clear(x + 5, 1)) c.putAny(["jp-prop-lamp-post", "jp-prop-bench", "jp-prop-stone-lantern", "jp-prop-bench"], x + 5, s.sB, TALL);
    }
    c.scenesUsed.add("kawa"); c.piecesUsed.push("river");
  }
}

export function dressStreets(c: SceneCtx, L: SceneLayout, crosswalkTile?: number): void {
  const { W, H, rng, kind } = c;
  const has = (s: string) => kind.scenes.includes(s);
  for (const b of L.bands) {
    const s = b.front;
    const vs = touching(L, b);
    const inV = (x: number, pad = 0) => vs.some((v) => x >= v.x - pad && x < v.x + v.w + pad);
    let cw = -99;
    if (s.type === "kerb" || s.type === "lane" || (s.type === "edge" && s.road0 > s.y0)) {
      const rw = s.road1 - s.road0 + 1;
      if (s.type === "kerb") for (let t = 0; t < 10; t++) {                // 횡단보도 하나(4칸) + 보행 신호등
        const x = 4 + Math.floor(rng() * Math.max(1, W - 12));
        if (inV(x, 3) || inV(x + 3, 3)) continue;
        cw = x;
        if (crosswalkTile !== undefined && crosswalkTile >= 0) {
          const cells: { x: number; y: number }[] = [];
          for (let cx = x; cx < x + 4; cx++) for (let y = s.road0; y <= s.road1; y++) { cells.push({ x: cx, y }); c.drawn[y * W + cx] = 1; }
          c.marks.push({ tool: "paint_tiles", args: { mapId: c.mapId, layer: "2", mode: "cells", tile: crosswalkTile, cells }, optional: true, note: "road" });
        }
        c.putFoot("jp-road-signal-ped", x - 1, s.nK!); c.putFoot("jp-road-signal-ped-green", x + 4, s.sB, TALL);
        break;
      }
      for (let x = 0; x < W; x++) {                                         // 흰 외측선(교차로·횡단보도 칸은 비운다)
        if (inV(x) || (x >= cw && x < cw + 4)) continue;
        c.raw("jp-mark-edge-n", x, s.road0, "road");
        if (s.type !== "edge") c.raw("jp-mark-edge-s", x, s.road1, "road");
      }
      if (s.type !== "edge") {
        const east = rng() < 0.5, laneY = s.road0 + (rw >= 4 ? 1 : 0);
        for (let t = 0; t < 6; t++) { const mx = 2 + Math.floor(rng() * Math.max(1, W - 8)); if (!inV(mx, 1) && !inV(mx + 3, 1) && c.decal(`jp-mark-30-${east ? "e" : "w"}`, mx, east ? s.road0 : s.road1 - 1)) break; }
        const cars = sceneList("doro", "cars");
        const nCars = s.type === "lane" ? (rng() < 0.4 ? 1 : 0) : 1 + Math.floor(rng() * 2);
        for (let k = 0, t = 0; k < nCars && t < 12; t++) { const id = c.least(cars); const cx = 1 + Math.floor(rng() * Math.max(1, W - 7)); if (id && !inV(cx, 2) && !inV(cx + 4, 2) && c.decal(`${id}${east || id.includes("van") ? "" : "-r"}`, cx, laneY, "prop")) k++; }
      }
    }
    if (s.type === "kerb") {
      // 남쪽 보도 담 쪽 줄: 전봇대와 전선 · 가로등 · 표지 · 가로수, 그 사이 낮은 것(게시판·쓰레기망·자판기·벤치)
      const poles: number[] = [];
      if (has("poles")) for (let x = 3 + Math.floor(rng() * 5); x < W - 4; x += 11 + Math.floor(rng() * 5)) {
        let px = x; while (px < W - 4 && (inV(px, 1) || inV(px + 1, 1))) px++;
        if (c.putFoot("jp-prop-utility-pole2", px, s.sB, TALL)) poles.push(px);
        x = px;
      }
      poles.forEach((px, i) => { const nx = poles[i + 1]; if (nx === undefined) return; const n = nx - (px + 2) + 3; if (n >= 5 && n <= 20 && c.size(`jp-wire-${n}`)) c.late.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/jp-wire-${n}`, mapId: c.mapId, x: px + 2, y: s.sB - 4 }, optional: true, note: "wire" }); });
      for (let x = 5 + Math.floor(rng() * 4); x < W - 2; x += 8 + Math.floor(rng() * 4)) if (!inV(x, 1)) c.putFoot("jp-prop-lamp-post", x, s.sB, { ...TALL, gap: true });
      const trees = kind.density.south >= 0.4 && rng() < 0.6 ? sceneList("doro", "tree") : [];
      for (let x = 2 + Math.floor(rng() * 6); trees.length && x + 4 < W; x += 9 + Math.floor(rng() * 5)) if (!inV(x, 1) && !inV(x + 3, 1)) c.putFoot(trees[Math.floor(rng() * trees.length)]!, x, s.sB, { ...TALL, gap: true });
      for (const v of vs) for (const x of [v.x + v.w, v.x - 1]) if (rng() < 0.7) c.putAny(sceneList("doro", "tall"), x, s.sB, { ...TALL, gap: true });
      for (let x = 1 + Math.floor(rng() * 4); x < W - 2; ) { const id = rng() < kind.density.south + 0.3 ? c.putAny(sceneList("doro", "back"), x, s.sB, { gap: true }) : undefined; x += (id ? c.size(id)![0] : 1) + 3 + Math.floor(rng() * 4); }
      // 가드레일: 세로 길 모퉁이에서 연석 쪽 줄을 따라 몇 칸
      if (has("ekimae") || has("tsugaku") || rng() < 0.4) { let any = false; for (const v of vs) for (const x0 of [v.x + v.w + 1, v.x - 6]) if (x0 >= 0 && x0 + 5 <= W && !(x0 < cw + 5 && x0 + 5 > cw - 1)) { c.edge(c.hline(x0, s.sA!, 5), "가드레일"); any = true; } if (any) c.piecesUsed.push("guardrail"); }
    } else if (s.type === "lane") {
      // 생활도로 남쪽 가장자리: 전봇대(담 앞) · 거울 · 표지 · 쓰레기 모으는 곳
      const lane = [...sceneList("jutaku", "lane"), ...(has("tsugaku") ? sceneList("tsugaku", "lane") : [])];
      const tall = { base: [Occ.Road], over: [Occ.Road, Occ.Lot, Occ.Walk] } as const;
      const poles: number[] = [];
      for (let x = 3 + Math.floor(rng() * 6); x < W - 4; x += 12 + Math.floor(rng() * 5)) {
        let px = x; while (px < W - 4 && (inV(px, 1) || inV(px + 1, 1))) px++;
        if (c.putFoot("jp-prop-utility-pole2", px, s.road1, { layer4: true, base: [Occ.Road], over: [Occ.Road, Occ.Wall, Occ.Lot, Occ.Walk, Occ.Slit] })) poles.push(px);
        x = px;
      }
      poles.forEach((px, i) => { const nx = poles[i + 1]; if (nx === undefined) return; const n = nx - (px + 2) + 3; if (n >= 5 && n <= 20 && c.size(`jp-wire-${n}`)) c.late.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/jp-wire-${n}`, mapId: c.mapId, x: px + 2, y: s.road1 - 4 }, optional: true, note: "wire" }); });
      for (let x = 2 + Math.floor(rng() * 5); x < W - 2; ) { const id = !inV(x, 1) && rng() < 0.85 ? c.putAny(lane, x, s.road1, { ...tall, gap: true }) : undefined; if (id) c.scenesUsed.add("jutaku"); x += (id ? c.size(id)![0] : 1) + 3 + Math.floor(rng() * 3); }
      if (kind.pieces.includes("garbage")) for (let t = 0; t < 8; t++) { const x = 2 + Math.floor(rng() * (W - 8)); if (!inV(x, 1) && !inV(x + 4, 1) && c.putFoot("jp-gomi-box", x, s.road1, { ...tall, gap: true })) { c.putFoot("jp-keijiban", x + 3, s.road1, tall); c.piecesUsed.push("garbage"); break; } }
    } else if (s.type === "mall") {
      // 보행자 시장 길: 가운데 두 줄에 노점·포장마차·벤치, 머리 위 초롱 줄, 남쪽 가장자리에 낮은 것
      const stalls = [...sceneList("shotengai", "stall"), ...sceneList("sando", "stall")];
      const mid = ["jp-prop-bench", "jp-lot-planter", "jp-prop-planter", "jp-prop-lantern-post", "jp-prop-stone-lantern", "jp-prop-record-wagon", "jp-prop-rack-0", "jp-prop-rack-1", "jp-lot-kiosk"];
      for (let x = 2 + Math.floor(rng() * 4); x < W - 4; ) {
        if (inV(x, 1) || inV(x + 3, 1)) { x += 2; continue; }
        const id = rng() < 0.55 ? c.putAny(stalls, x, s.y0 + 3, { gap: true }) : c.putAny(mid, x, s.y0 + 3, { gap: true });
        if (id && stalls.includes(id)) { c.scenesUsed.add(has("sando") ? "sando" : "shotengai"); if (!c.piecesUsed.includes("stalls")) c.piecesUsed.push("stalls"); }
        x += (id ? c.size(id)![0] : 1) + 3 + Math.floor(rng() * 4);
      }
      const hang = sceneList("shotengai", "hang")[0];
      if (hang) for (let x = 1 + Math.floor(rng() * 3); x + 4 < W; x += 6 + Math.floor(rng() * 3)) if (!inV(x) && !inV(x + 3)) c.put(hang, x, s.y0 + 1, { layer4: true, late: true, base: [Occ.Walk], over: [Occ.Walk] });
      for (let x = 1 + Math.floor(rng() * 4); x < W - 2; ) { const id = rng() < 0.7 ? c.putAny(sceneList("doro", "back"), x, s.sB, { gap: true }) : undefined; x += (id ? c.size(id)![0] : 1) + 3 + Math.floor(rng() * 4); }
    }
  }
  // 아케이드 지붕(시장 길 세로 구간): 큰길 쪽 끝에 간판 아치, 사이는 지붕 줄(세 줄마다 철 아치). 다른 소품 뒤에 찍어 지붕이 위에 얹힌다.
  for (const v of L.vstreets) if (v.arcade && FLAVOR_ARCADE.widths.includes(v.w)) for (const b of L.bands) if (b.index >= v.from && b.index <= v.to) {
    const y0 = b.index === 0 ? 0 : (L.bands[b.index - 1]!.front.sA ?? b.top), y1 = b.front.type === "edge" ? b.front.y0 : (b.front.nK ?? b.foot);
    const G = FLAVOR_ARCADE.gateRows;
    const south = y1 < H - 1 ? y1 - G + 1 : -1, north = y0 > 0 ? y0 : -1;
    const top = north >= 0 ? north + G : y0, bottom = south >= 0 ? south - 1 : y1;
    if (bottom - top + 1 < 2) continue;
    const put = (id: string, y: number) => c.late.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${id}`, mapId: c.mapId, x: v.x, y }, optional: true, note: "arcade" });
    for (let y = top; y <= bottom; y++) put(arcadeRoofKit(v.w, (y - top) % FLAVOR_ARCADE.ribEvery === 1), y);
    if (north >= 0) put(arcadeGateKit(v.w), north);
    if (south >= 0) put(arcadeGateKit(v.w), south);
    c.scenesUsed.add("shotengai");
  }
  // 지도 맨 위 끝과 띠 뒤(윗길 보도에 닿는 줄)의 빈 대지에 담 — 건물 뒤가 허공처럼 열려 보이지 않게.
  c.edge(c.hline(0, 0, W).filter((q) => c.at(q.x, q.y) === Occ.Lot), kind.noGreen ? "블록담" : "생울타리");
  for (const b of L.bands) if (b.index > 0) c.edge(c.hline(0, b.top, W).filter((q) => c.at(q.x, q.y) === Occ.Lot), "블록담");
}
