// project/jpCitySceneRun.ts
// 거리 장면 계획(planJpCityScene)을 실행한다 — 도구 호출은 부르는 쪽이 준 call 로, 칩셋을 읽어야 하는 단계(담 모양·4층 덧그림·처마 칸 되살리기)는 여기서 풀어 찍는다.
import { STREET_PIECES, streetPieceOfKit } from "@/project/jpCityStreetPieces";
import { addMapLocation, COMPOSED_LAYOUT_TAG } from "@/project/mapNamedLocations";
import { fillLotUses, type LotUsePlaced, type LotUseView } from "@/project/jpCityLotUse";
import type { JpStreetBuiltBuilding } from "@/project/jpCityStreetComposer";
import type { ScenePlan } from "@/project/jpCitySceneComposer";
import type { GameMap } from "@/project/types";

type Call = (tool: string, args: Record<string, unknown>) => { rect?: { x0: number; y0: number; w: number; h: number }; doors?: readonly { x: number; y: number }[] } | void;
const EDGE_AUTOTILE: Readonly<Record<string, string>> = { "생울타리": "jp-hedge", "블록담": "jp-wall-block", "철망 울타리": "jp-fence-mesh", "가드레일": "jp-guardrail" };

/** 횡단보도 줄무늬 칸 — 도구와 미리 보기(v2 빌더)가 같은 값으로 계획을 세운다(이 값에 따라 길 표시 자리가 달라진다). */
export function sceneCrosswalkTile(tileset: { structureKits?: readonly { id: string; rows: readonly { upperTiles?: readonly number[] }[] }[] } | undefined): number | undefined {
  return (tileset?.structureKits ?? []).find((k) => k.id === "jp-road-lane-crosswalk-h")?.rows.flatMap((row) => row.upperTiles ?? []).find((t) => t >= 0);
}

export interface SceneBuilt extends JpStreetBuiltBuilding { readonly ko: string }

export function runJpScenePlan(plan: ScenePlan, call: Call, view: () => LotUseView, avoid?: (kitId: string) => boolean): { built: number; skipped: number; props: number; buildings: SceneBuilt[]; lotUses: readonly LotUsePlaced[] } {
  let built = 0, skipped = 0, props = 0;
  const buildings: SceneBuilt[] = [];
  const done = new Set<string>(), tried = new Set<string>();
  const mapId = plan.mapId;
  const dbg = Boolean((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SCENEDBG);
  const kitOf = (id: string) => (view().tileset.structureKits ?? []).find((k) => k.id === id);
  const upper = (id: string): number[][] | undefined => { const k = kitOf(id); return k ? k.rows.map((r) => [...(r.upperTiles ?? new Array<number>(k.width).fill(-1))]) : undefined; };
  const layer = (id: string, x: number, y: number, n: "2" | "4"): boolean => { const g = upper(id); if (!g) return false; call("stamp_layer_block", { mapId, x, y, layers: { [n]: g }, reshape: false }); return true; };
  /** 담·생울타리·철망·가드레일: 칸 목록을 한 덩이로 이웃 모양을 맞춰 3층에(이미 무언가 선 칸은 건너뛴다). 4방 비트 N1 E2 S4 W8. */
  const edge = (cells: readonly { x: number; y: number }[], material: string): void => {
    const { map, tileset } = view();
    const g = (tileset.autotileGroups ?? []).find((a) => a.id === EDGE_AUTOTILE[material]);
    if (!g) return;
    const W = map.width, key = (x: number, y: number) => y * W + x;
    const set = new Set(cells.filter((q) => (map.upperTiles[key(q.x, q.y)] ?? -1) < 0 && (map.upperOverlayTiles?.[key(q.x, q.y)] ?? -1) < 0).map((q) => key(q.x, q.y)));
    if (!set.size) return;
    const xs = [...set].map((i) => i % W), ys = [...set].map((i) => Math.floor(i / W));
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    const grid: number[][] = [];
    for (let y = y0; y <= y1; y++) {
      const row: number[] = [];
      for (let x = x0; x <= x1; x++) {
        if (!set.has(key(x, y))) { row.push(-1); continue; }
        const m = (set.has(key(x, y - 1)) ? 1 : 0) | (x < W - 1 && set.has(key(x + 1, y)) ? 2 : 0) | (set.has(key(x, y + 1)) ? 4 : 0) | (x > 0 && set.has(key(x - 1, y)) ? 8 : 0);
        row.push(Number((g.variantMap as Record<string, number>)[String(m)] ?? -1));
      }
      grid.push(row);
    }
    call("stamp_layer_block", { mapId, x: x0, y: y0, layers: { "3": grid }, reshape: false });
  };
  /**
   * 새 거리의 바닥: 가족의 무늬 키트(jp-st-gnd-<가족>)를 1층에 찍는다. 무늬 키트의 칸 수가 16 이상이면 이음매 없는 결(지도 좌표로 이어 붙인다 —
   * 아스팔트는 4×4 칸 덩이마다 두 결 가운데 하나), 그보다 작으면 낱칸을 섞어 깐다(민무늬 칸을 더 자주).
   */
  const groundCells = (family: string, rects: readonly { x: number; y: number; w: number; h: number }[]): void => {
    const lower = (id: string): number[][] | undefined => { const k = kitOf(id); return k ? k.rows.map((r) => [...(r.tiles ?? [])]) : undefined; };
    const a = lower(`jp-st-gnd-${family}`), b = lower(`jp-st-gnd-${family}-2`);
    if (!a || !a.length) return;
    const ph = a.length, pw = a[0]!.length, wrap = family !== "pave" && family !== "forecourt" && family !== "water";   // 무늬가 이어지는 바닥은 자리대로, 낱장 바닥(보도 블록·앞마당 판·물)은 섞어 깐다
    const hash = (x: number, y: number) => { let h = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + plan.seed * 31 + 1274126177, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
    for (const r of rects) {
      const grid: number[][] = [];
      for (let y = r.y; y < r.y + r.h; y++) {
        const row: number[] = [];
        for (let x = r.x; x < r.x + r.w; x++) {
          if (wrap) { const src = b && hash(Math.floor(x / pw), Math.floor(y / ph)) % 2 ? b : a; row.push(src[y % ph]![x % pw]!); }
          else { const k = hash(x, y) % (pw * ph + 3 * Math.ceil((pw * ph) / 2)); const i = k < pw * ph ? k : (k - pw * ph) % Math.ceil((pw * ph) / 2); row.push(a[Math.floor(i / pw)]![i % pw]!); }
        }
        grid.push(row);
      }
      call("stamp_layer_block", { mapId, x: r.x, y: r.y, layers: { "1": grid }, reshape: false });
    }
  };
  for (const step of plan.steps) {
    const note = step.note ?? "";
    const tryKey = note.startsWith("try:") ? note : undefined;
    if (tryKey && done.has(tryKey)) continue;
    const kitId = step.tool === "stamp_object" ? String(step.args.objectId ?? "").replace("kit:jp_city/", "") : "";
    try {
      if (step.tool === "ground_cells") { groundCells(String(step.args.family), step.args.rects as { x: number; y: number; w: number; h: number }[]); continue; }
      if (note === "shade") { const g = upper(kitId); if (g) call("stamp_layer_block", { mapId, x: Number(step.args.x), y: Number(step.args.y), layers: { "3": g }, reshape: false }); continue; }
      if (step.tool === "edge_cells") { edge(step.args.cells as { x: number; y: number }[], String(step.args.material)); continue; }
      if (step.tool === "restore_col") {
        const g = upper(String(step.args.kit)), col = Number(step.args.col);
        if (g) call("stamp_layer_block", { mapId, x: Number(step.args.x), y: Number(step.args.y), layers: { "4": g.map((r) => [r[col] ?? -1]) }, reshape: false });
        continue;
      }
      if (note === "prop4" || note === "wire" || note === "floor2") {
        if (avoid?.(kitId)) continue;
        // 소품 수: 서 있는 것만 센다 — 새 거리의 바닥 덧조각(테·노면 표시)과 경계 줄 조각은 소품이 아니다.
        const st = streetPieceOfKit(kitId), piece = st ? STREET_PIECES[st] : undefined;
        if (layer(kitId, Number(step.args.x), Number(step.args.y), note === "floor2" ? "2" : "4") && note !== "wire" && (!piece || (piece.layer !== "floor" && piece.anchor !== "run"))) props++;
        continue;
      }
      const result = call(step.tool, step.args);
      if (note.startsWith("bldg:")) {
        const p = plan.placed[Number(note.slice(5))];
        if (p) { built++; buildings.push({ role: p.role, ko: p.ko, x: p.x, foot: p.foot, w: p.w, rect: { x0: p.x, y0: p.y, w: p.w, h: p.h }, doors: p.doors.map((d) => ({ x: p.x + d, y: p.foot })) }); }
      } else if (tryKey) {
        done.add(tryKey); built++;
        const p = plan.placed[Number(tryKey.slice(4))];
        if (p) buildings.push({ role: p.role, ko: p.ko, x: p.x, foot: p.foot, w: p.w, ...(result?.rect ? { rect: result.rect } : {}), doors: result?.doors ?? [] });
      } else if (note === "prop") props++;
    } catch (error) {
      if (!step.optional) throw error;
      if (dbg) console.error("[scene] 건너뜀", step.tool, note, kitId || "", JSON.stringify(step.args).slice(0, 80), String((error as Error).message).slice(0, 160));
      if (note.startsWith("bldg:")) skipped++;
      if (tryKey) tried.add(tryKey);
    }
  }
  for (const k of tried) if (!done.has(k)) skipped++;
  // 남은 빈 대지: 빈터 쓰임(텃밭·뒤뜰 살림·골목 틈 …)으로 한 번 더 채운다.
  const rects = buildings.filter((b) => b.rect).map((b) => ({ x: b.rect!.x0, y: b.rect!.y0, w: b.rect!.w, h: b.rect!.h }));
  const lot = fillLotUses({ mapId, seed: plan.seed, style: plan.style === "residential" ? "residential" : "shopping", noGreen: plan.kind.noGreen === true, buildings: rects, allow: plan.lotFree, view, call: (tool, args) => (avoid && tool === "stamp_object" && avoid(String(args.objectId ?? "").replace("kit:jp_city/", "")) ? undefined : call(tool, args)) });
  return { built, skipped, props: props + lot.props, buildings, lotUses: lot.uses };
}

/** 지어진 건물마다 이름 붙은 위치를 남긴다 — 옛 구성기와 같은 글 꼴(조수·link_jp_city_interior·도달 검사가 «문 앞 접근칸 (x,y)» 을 읽는다). */
export function labelSceneBuildings(map: GameMap, buildings: readonly SceneBuilt[]): string[] {
  const lines: string[] = [];
  for (const b of buildings) {
    if (!b.rect) continue;
    const door = b.doors[0];
    if (!door && b.role === "landmark") continue;                          // 문 없는 풍경 건물(시타마치 줄 키트)
    const note = door ? `종류 ${b.role} · 문 (${door.x},${door.y}) · 문 앞 접근칸 (${door.x},${door.y + 1}) — 이 문에 ${b.ko} 실내를 link_jp_city_interior 로 잇는다${b.doors.length > 1 ? ` · 다른 문 ${b.doors.slice(1).map((d) => `(${d.x},${d.y})`).join(" ")}` : ""}` : `종류 ${b.role}`;
    const added = addMapLocation(map, { name: `${b.ko} 건물`, x: b.rect.x0, y: b.rect.y0, w: b.rect.w, h: b.rect.h, note, tags: ["jp-building", COMPOSED_LAYOUT_TAG, b.role] });
    if (added.ok) lines.push(`${b.ko} 문 (${door ? `${door.x},${door.y}` : "?"})`);
  }
  return lines;
}
