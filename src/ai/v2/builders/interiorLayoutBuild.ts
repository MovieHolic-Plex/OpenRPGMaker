// 칸 배치(spec.layout)로 손 도트 실내를 짓는다 — 검증(interiorLayout.checkLayout) → build_hand_interior_room(plan·zones·objects·lines·daises·start)
// → 맵 위치 기록(방마다 hand-layout-room·model-designed, 방 그래프 선언·랜드마크, 칸 배치 선언). 함수는 칸·가구·방 수를 고르지 않는다.
// 고치기 횟수(hints.layoutRepairsLeft)를 다 쓰면 여전히 걸리는 기물만 빼고 나머지를 깐다(무엇을 뺐는지 알린다).
import type { HandInteriorSpec } from "@/editor/handInterior/builder";
import { ROOM_GRAPH_TAG } from "@/editor/handInterior/designAreaRecord";
import type { BuildRun, PlaceBuildResult, PlaceSpec } from "../types";
import { REVIEWS_TAG } from "../layoutReview";
import { checkLayout, layoutDecl, layoutGiven, rejectionText, LAYOUT_TAG, type InteriorLayout, type LayoutCheck } from "../interiorLayout";

const HAND_LAYOUT_ROOM_TAG = "hand-layout-room";

/** 칸 배치가 실제로 왔나 — 엄격 스키마로 빈 껍데기({regions:[]})를 채워 보내는 모델이 있다. */
export function hasLayout(spec: PlaceSpec): boolean {
  return layoutGiven(spec.layout);
}

/** 두 방 사각형 사이를 문 틈이 잇는가(틈 칸이 두 방 모두와 맞닿거나 겹친다). */
function joins(o: { x: number; y: number; w?: number; h?: number }, a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  const ow = o.w ?? 1, oh = o.h ?? 1;
  const near = (r: typeof a) => o.x <= r.x + r.w && r.x <= o.x + ow && o.y <= r.y + r.h && r.y <= o.y + oh;
  return near(a) && near(b);
}

export function buildFromLayout(run: BuildRun, spec: PlaceSpec, S: HandInteriorSpec, tilesetId: string, mapId: string | undefined): PlaceBuildResult {
  const L = spec.layout as InteriorLayout;
  const tileset = run.ctx.project.tilesets[tilesetId];
  if (!tileset) return { ok: false, mapIds: [], summary: `spec.layout needs a chipset with a room table; ${tilesetId} is missing. Drop layout and use zones.`, warnings: [], missingArt: [], calls: run.calls };
  const left = Number(spec.hints?.layoutRepairsLeft ?? 2);
  let check: LayoutCheck = checkLayout(L, S, tileset);
  const dropped: string[] = [];
  if (check.errors.length && left <= 0 && check.input === undefined && check.badObjects.size === 0) {
    return { ok: false, mapIds: [], summary: rejectionText(spec.name, check, L, 0), warnings: [], missingArt: [], calls: run.calls };
  }
  if (check.errors.length && left <= 0) {
    // 고치기를 다 썼다: 걸린 기물만 빼고 다시 본다(두 번까지 — 뺀 뒤 새로 드러난 겹침).
    const drop = new Set<number>(check.badObjects);
    for (let pass = 0; pass < 3 && check.errors.length; pass++) {
      check = checkLayout(L, S, tileset, { dropObjects: drop });
      for (const i of check.badObjects) drop.add(i);
    }
    const src = check.sources ?? [];
    for (const i of drop) { const o = src[i]; if (o) dropped.push(`"${o.id}"@(${o.x},${o.y})`); }
  }
  if (check.errors.length || !check.input) return { ok: false, mapIds: [], summary: rejectionText(spec.name, check, L, left), warnings: [], missingArt: [], calls: run.calls };

  const input = check.input;
  const args: Record<string, unknown> = { tileset: tilesetId, mapId, name: spec.name, replace: mapId ? true : undefined,
    plan: input.plan, floor: input.floor, wall: input.wall, zones: input.zones, objects: input.objects, lines: input.lines, daises: input.daises, start: input.start };
  const clean = (a: Record<string, unknown>) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined));
  let r = run.call("build_hand_interior_room", clean(args));
  if (!r.ok && mapId) r = run.call("build_hand_interior_room", clean({ ...args, mapId: undefined, replace: undefined }));
  if (!r.ok) return { ok: false, mapIds: [], summary: `Rejected: the layout passed the checks but the room tool refused it: ${String(r.summary ?? "").slice(0, 400)}. Fixed call: make_place with the layout changed where that message points.`, warnings: [], missingArt: [], calls: run.calls };
  const data = (r.data ?? {}) as Record<string, unknown>;
  const builtId = String(data.mapId ?? mapId);
  const map = run.ctx.project.maps[builtId];
  if (!map) return { ok: false, mapIds: [], summary: "the room tool reported success but the map is missing", warnings: [], missingArt: [], calls: run.calls };
  // 지은 맵의 기록을 칸 배치로 다시 쓴다(옛 방 기록·방 그래프·칸 배치 선언은 지운다). 도구가 평면 가장자리를 잘랐으면 그만큼 옮긴다.
  // build_hand_interior_room 은 바깥 막힌 줄을 한 칸만 남기고 잘라 낸다(trimPlanMargin) — 기록 좌표도 그만큼 옮긴다.
  let minX = Infinity, minY = Infinity;
  input.plan.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== "#") { minX = Math.min(minX, x); minY = Math.min(minY, y); } });
  const dx = map.width === L.map.w ? 0 : Math.max(0, minX - 1), dy = map.height === L.map.h ? 0 : Math.max(0, minY - 1);
  const sh = <T extends { x: number; y: number }>(o: T): T => ({ ...o, x: o.x - dx, y: o.y - dy });
  for (const l of [...(map.locations ?? [])]) {
    const t = l.tags ?? [];
    if (t.includes(HAND_LAYOUT_ROOM_TAG) || t.includes(ROOM_GRAPH_TAG) || t.includes(LAYOUT_TAG) || t.includes("design-area")) run.call("delete_map_location", { mapId: builtId, locationId: l.id });
  }
  const decl0 = layoutDecl(L, check, S);
  const reviews = Number(spec.hints?.layoutReviews ?? 0) || 0;
  const reviewNotes = String(spec.hints?.layoutReviewNotes ?? "").split(" || ").filter(Boolean).slice(-6);
  const decl = { ...decl0, regions: decl0.regions.map(sh), objects: decl0.objects.map(sh), ...(decl0.landmark ? { landmark: sh(decl0.landmark) } : {}), entrance: sh(decl0.entrance), reviews, ...(reviewNotes.length ? { reviewNotes } : {}) };
  const walled = !!check.rooms;
  type Reg = { id: string; x: number; y: number; w: number; h: number; purpose?: string; role?: string; landmark?: string; stairs?: string };
  const regions: Reg[] = walled ? check.rooms!.map(sh) : (L.regions ?? []).map(sh);
  const openings = (L.openings ?? []).map(sh);
  const entranceAt = sh(L.entrance);
  // 기물이 선 방 — 벽 우선 형식은 검사가 방 칸으로 정했다(L 자 방의 상자는 다른 방과 겹칠 수 있다), 사각형 형식은 상자 안.
  const objRegion = new Map<string, string | undefined>(check.objects.map((o) => [`${o.id}@${o.x - dx},${o.y - dy}`, o.region]));
  const inReg = (o: { id: string; x: number; y: number }, reg: Reg) => walled ? objRegion.get(`${o.id}@${o.x},${o.y}`) === reg.id : o.x >= reg.x && o.x < reg.x + reg.w && o.y >= reg.y && o.y < reg.y + reg.h;
  // 방 그래프 선언(room_graph 검사가 읽는다): 방 = 영역(벽 우선이면 벽으로 닫힌 방), 연결 = 문(벽 우선) · 맞닿음/문 틈(사각형), 랜드마크 = 방마다 이름 붙인 것 + 전체 랜드마크.
  const connections: { a: string; b: string; type: string }[] = walled ? [...new Map((check.connections ?? []).map((c) => [[c.a, c.b].sort().join("|"), c])).values()] : [];
  if (!walled) for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) {
    const a = regions[i]!, b = regions[j]!;
    const touching = a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
    if (touching) connections.push({ a: a.id, b: b.id, type: "open" });
    else if (openings.some((o) => joins(o, a, b))) connections.push({ a: a.id, b: b.id, type: "door" });
  }
  const lmOf = (id: string) => {
    const reg = regions.find((q) => q.id === id)!;
    const name = reg.landmark ?? (decl.landmark && inReg(decl.landmark, reg) ? decl.landmark.id : undefined);
    if (!name) return undefined;
    const hit = decl.objects.find((o) => o.id === name && inReg(o, reg));
    return { name, hit };
  };
  const stairsOf = (id: string) => {
    const reg = regions.find((q) => q.id === id)!;
    const want = reg.stairs === "up" || reg.stairs === "down" ? reg.stairs : undefined;
    const hit = decl.objects.find((o) => !!S.objects[o.id]?.stairs && inReg(o, reg));
    return want ? { want, hit } : undefined;
  };
  const entranceRegion = (walled ? check.entranceRoom : regions.find((q) => entranceAt.x >= q.x && entranceAt.x < q.x + q.w && entranceAt.y - 1 < q.y + q.h && entranceAt.y - 1 >= q.y)?.id) ?? regions[0]!.id;
  const graphDecl = {
    source: "layout",
    rooms: regions.map((q) => { const lm = lmOf(q.id); const st = stairsOf(q.id); return { id: q.id, name: String(q.purpose ?? q.id).slice(0, 40), ...(q.role ? { role: String(q.role) } : {}), ...(lm ? { landmark: lm.name } : {}), ...(st ? { stairs: st.want } : {}) }; }),
    connections, entrance: entranceRegion,
  };
  run.call("create_map_location", { mapId: builtId, name: "room graph", x: 0, y: 0, w: map.width, h: map.height, note: JSON.stringify(graphDecl).slice(0, 4000), tags: [ROOM_GRAPH_TAG, "decl"] });
  run.call("create_map_location", { mapId: builtId, name: "interior layout", x: 0, y: 0, w: map.width, h: map.height, note: JSON.stringify(decl).slice(0, 8000), tags: [LAYOUT_TAG, "decl", `${REVIEWS_TAG}${reviews}`] });
  for (const q of regions) {
    const lm = lmOf(q.id), st = stairsOf(q.id);
    const box = (o: { x: number; y: number; w: number; h: number }) => `${o.x},${o.y},${o.w},${o.h}`;
    const objs = decl.objects.filter((o) => inReg(o, q)).map((o) => o.id);
    const count = new Map<string, number>(); for (const id of objs) count.set(id, (count.get(id) ?? 0) + 1);
    const tags = [HAND_LAYOUT_ROOM_TAG, "model-designed", LAYOUT_TAG, ROOM_GRAPH_TAG, `room:${q.id}`, ...(q.role ? [`role:${q.role}`] : []),
      ...(lm ? [`landmark:${lm.name}`, lm.hit ? `landmark-at:${box(lm.hit)}` : "landmark-missing"] : []),
      ...(st ? [`stairs:${st.want}`, st.hit ? `stairs-at:${box(st.hit)}` : "stairs-missing"] : []),
      `objs:${[...count].map(([k, v]) => `${k}*${v}`).join(";").slice(0, 300)}`];
    run.call("create_map_location", { mapId: builtId, name: String(q.purpose ?? q.id).slice(0, 40), x: q.x, y: q.y, w: q.w, h: q.h, note: `layout region ${q.id}`, tags });
  }
  const entrance = Array.isArray(data.entrance) ? (data.entrance as { x: number; y: number }[])[0] : undefined;
  const warnings = [...check.warnings, ...(dropped.length ? [`left out (still failing after the repairs): ${dropped.join(", ")}`] : []), ...((data.warnings as string[] | undefined) ?? []).filter((w) => !/[\uac00-\ud7a3]/.test(w)).slice(0, 4)];
  return {
    ok: true, mapIds: [builtId], ...(entrance ? { entrance: { mapId: builtId, ...entrance } } : {}),
    summary: `${spec.name}: laid your layout exactly — ${regions.length} region${regions.length === 1 ? "" : "s"} (${regions.map((q) => q.id).join(", ")}), ${decl.objects.length} pieces, landmark ${decl.landmark?.id ?? "none"}, map ${map.width}×${map.height} (${builtId}). Reachable floor ${String(data.reachable ?? "?")} cells.`,
    warnings, missingArt: [], calls: run.calls,
    state: { tilesetId, mapId: builtId, args: clean({ ...args, mapId: builtId, replace: true }), placed: [] },
  };
}
