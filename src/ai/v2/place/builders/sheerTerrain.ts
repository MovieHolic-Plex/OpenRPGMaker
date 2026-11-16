// 조수 v2 깎아지른 지형 빌더 — 바깥 장소(type village) 명세의 hints.kind 가 깎아지른 지형 종류(sheerTerrainKinds.json)일 때 맡는다.
//
// 왜 village 갈래인가(2026-11-16): route 장소 종류는 아직 main 에 없다(#4742 초안). 모델이 이미 쓰는 바깥 장소 명세와 hints.kind 손잡이를 그대로 쓰고,
// 종류 id 가 마을 종류가 아니라 깎아지른 지형 종류면 이 빌더가 받는다(PLACE_BUILDERS 에서 마을 빌더보다 앞).
// 모르는 kind: 마을 종류와 같은 잣대(rankKindsByWord)로 깎아지른 지형 종류에 더 가까우면 가장 가까운 종류로 짓고 경고로 알린다(목록 포함).
// 마을 종류에 더 가깝거나 어디에도 안 걸리면 마을 빌더가 받는다(강가·포구 마을의 한 번 거절). type route(#4742)는 늘 이 빌더가 가장 가까운 종류로.
// 하는 일: 맵 하나(종류의 크기, 버들항 칩셋)를 만들거나 빈 지금 맵을 그 크기로 맞추고 build_sheer_terrain 한 번. 맵 배경은 도구가 견본으로 건다.
// 배경 그림 생성(generate_map_background)은 이 실행 경로(v2 도구 묶음)에 없다 — 결과 한 줄이 견본을 썼다고 알린다(지어내지 않는다).
import { isBlankMap } from "@/editor/tools/mapEmptiness";
import { BEODEUL_VILLAGE_KINDS, rankKindsByWord } from "@/editor/tools/beodeulVillageKinds";
import { SHEER_KINDS, sheerKindById, type SheerKind } from "@/editor/tools/sheerTerrainPlan";
import type { SheerBuildReport } from "@/editor/tools/sheerTerrainBuild";
import { v2ToolPool } from "../../request/toolGroups";
import type { BuildRun, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../../shared/types";

const BEODEUL_TILESET = "beodeul_city";
const BACKGROUND_TOOL = "generate_map_background";

/** 명세의 hints.kind 글(빈 값은 안 준 것). */
const kindWord = (spec: PlaceSpec): string | undefined => {
  const v = (spec.hints as Record<string, unknown> | undefined)?.kind;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

/** 깎아지른 지형 종류의 한 줄 목록(빌더 답에만 싣는다 — 늘 실리는 지시문에는 없다). */
export const sheerKindMenu = (near?: string): string =>
  `Sheer terrain kinds${near ? ", nearest first" : ""}: ${(near ? sheerKindsNearestFirst(near) : SHEER_KINDS).map((k) => `${k.id} (${k.hint})`).join(" · ")}.`;

/** 모르는 낱말에 가까운 깎아지른 지형 종류부터(마을 종류와 같은 잣대 — beodeulVillageKinds.rankKindsByWord). */
export function sheerKindsNearestFirst(word: string): SheerKind[] {
  return rankKindsByWord(word, SHEER_KINDS).map((e) => e.kind);
}

/**
 * 명세가 고른 깎아지른 지형 종류. 표에 있는 id 면 그것(nearest 없음), 모르는 id 면 가장 가까운 종류와 그 사실.
 * 깎아지른 지형 명세가 아니면 undefined.
 */
export function sheerKindFor(spec: PlaceSpec): { kind: SheerKind; asked?: string } | undefined {
  const word = kindWord(spec);
  if (!word) return undefined;
  const exact = sheerKindById(word);
  if (exact) return { kind: exact };
  const best = rankKindsByWord(word, SHEER_KINDS)[0]!;
  // 「route」 장소 종류가 들어오면(#4742) 그 갈래의 kind 는 늘 깎아지른 지형 — 모르는 이름은 가장 가까운 종류로 짓고 알린다.
  if ((spec.type as string) === "route") return { kind: best.kind, asked: word };
  // 바깥 장소(village)의 모르는 kind: 마을 종류보다 깎아지른 지형 종류에 더 가까우면(같은 잣대의 점수 · 오타 거리) 그 종류로 짓고 알린다.
  // 어느 쪽에도 안 걸리거나 마을 종류에 더 가까우면 마을 빌더가 받는다(강가·포구 마을은 한 번 거절하고 목록을 준다).
  const village = rankKindsByWord(word, BEODEUL_VILLAGE_KINDS)[0];
  const closer = !village || best.score > village.score || (best.score === village.score && best.typo < village.typo);
  return (best.score > 0 || best.typo < 99) && closer ? { kind: best.kind, asked: word } : undefined;
}

/** 이 실행 경로에서 맵 배경 그림 생성 도구를 부를 수 있는가 — v2 도구 묶음에 있어야 한다(없으면 조수가 부를 길이 없다). */
export function mapBackgroundGenerationReachable(): boolean {
  return v2ToolPool().includes(BACKGROUND_TOOL);
}

/** 결과에 붙는 배경 한 줄(영어, 모델이 읽는다). */
export function sheerBackdropLine(background: SheerBuildReport["background"], reachable = mapBackgroundGenerationReachable()): string | undefined {
  if (!background) return undefined;
  return reachable
    ? `Tip: ${BACKGROUND_TOOL} view=${background.view} prompt="${background.prompt}" for a custom backdrop (preset ${background.preset} is set now).`
    : `Backdrop: preset ${background.preset} (${BACKGROUND_TOOL} unavailable here).`;
}

const seedOf = (spec: PlaceSpec): number => {
  const v = (spec.hints as Record<string, unknown> | undefined)?.variant;
  const variant = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : 0;
  if (spec.salt !== undefined) return ((spec.salt % 100000) + variant * 7919) >>> 0;
  const text = spec.variety ?? spec.name;
  let h = 7; for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ((h % 100000) + variant * 7919) >>> 0;
};

function build(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const first = run.calls.length;
  const picked = sheerKindFor(spec)!;
  const kind = picked.kind;
  const warnings: string[] = [];
  if (picked.asked) warnings.push(`hints.kind "${picked.asked}" is not a sheer terrain kind; built as ${kind.id} (nearest). ${sheerKindMenu(picked.asked)}`);
  const size = spec.size ?? "medium";
  const [W, H] = kind.size[size] ?? kind.size.medium;
  const fail = (summary: string): PlaceBuildResult => ({ ok: false, mapIds: previous?.result.mapIds ?? [], summary, warnings, missingArt: [], calls: run.calls.slice(first) });
  // 맵: 다시 짓기는 같은 맵, 명세의 mapId, 지금 보는 빈 버들항 맵(크기를 맞춘다), 아니면 새 맵
  const project = () => run.ctx.project;
  let mapId = previous?.result.mapIds[0] ?? spec.mapId;
  if (mapId && project().maps[mapId] && project().maps[mapId]!.events.length > 0) return fail(`${spec.name}: not rebuilt — map ${mapId} already has ${project().maps[mapId]!.events.length} event(s), rebuilding would erase them.`);
  if (!mapId) {
    const cur = run.ctx.currentMapId ? project().maps[run.ctx.currentMapId] : undefined;
    if (cur && cur.tilesetId === BEODEUL_TILESET && isBlankMap(cur)) mapId = cur.id;
  }
  if (mapId && project().maps[mapId]) {
    const map = project().maps[mapId]!;
    if (map.tilesetId !== BEODEUL_TILESET) return fail(`${spec.name}: sheer terrain is Beodeul-only; map ${mapId} uses ${map.tilesetId}.`);
    if (map.width !== W || map.height !== H) {
      const r = run.call("resize_map", { mapId, width: W, height: H });
      if (!r.ok) return fail(`${spec.name}: could not resize ${mapId} to ${W}×${H} — ${r.summary}`);
    }
  } else {
    const r = run.call("create_map", { name: spec.name, width: W, height: H, tilesetId: BEODEUL_TILESET, ...(mapId ? { id: mapId } : {}) });
    const made = (r.data as { mapId?: string } | undefined)?.mapId;
    if (!r.ok || !made) return fail(`${spec.name}: could not create the map — ${r.summary}`);
    mapId = made;
  }
  const seed = seedOf(spec);
  const sides = (spec.exits ?? []).length ? spec.exits : undefined;
  const res = run.call("build_sheer_terrain", { mapId, kind: kind.id, seed, ...(sides ? { sides } : {}) });
  if (!res.ok) return fail(`${spec.name}: sheer terrain failed — ${res.summary}`);
  const report = res.data as SheerBuildReport & { mapId: string };
  warnings.push(...(res.warnings ?? []));
  if (!report.reach.ok) warnings.push(`Not reachable from the entry: ${report.reach.missing.join(", ")}.`);
  // 시작 위치: 이 맵이 시작 맵이면 들어오는 칸으로 옮긴다(빈 곳·막은 칸에 서지 않게)
  if (project().startMapId === mapId) run.call("set_start_position", { mapId, x: report.entry.x, y: report.entry.y });
  const devices = report.devices.map((d) => `${d.kind} ${d.lo}→${d.hi}`).join(", ");
  const backdrop = sheerBackdropLine(report.background);
  const summary = `${spec.name}: sheer terrain ${kind.id} ${report.width}×${report.height} (seed ${seed}) — ${report.levels} levels, face 3 cells a level, walkable ${report.walkablePct}%, `
    + `${report.devices.length} devices (${devices}), reach ${report.reach.ok ? "ok" : "MISSING"}`
    + `${report.landmark?.placed ? `, landmark ${report.landmark.kit.replace(/^bd-(?:obj-|pick-)?/u, "")} (${report.landmark.x},${report.landmark.y})` : ""}`
    + `${report.deadEnd ? `, dead-end ledge (${report.deadEnd.x},${report.deadEnd.y})${report.deadEnd.chest ? " with a chest" : ""}` : ""}`
    + `${report.falls ? `, ${report.falls} waterfall(s)` : ""}, entry (${report.entry.x},${report.entry.y}) ${report.entry.side}`
    + `${report.exits.length ? `, exits ${report.exits.map((e) => `${e.side} (${e.x},${e.y})`).join(" ")}` : ""}.${backdrop ? ` ${backdrop}` : ""}`;
  return {
    ok: true, mapIds: [mapId], entrance: { mapId, x: report.entry.x, y: report.entry.y }, summary, warnings, missingArt: [], calls: run.calls.slice(first),
    state: { sheer: kind.id, seed, ...(picked.asked ? { asked: picked.asked } : {}) },
  };
}

export const SHEER_TERRAIN_BUILDER: PlaceBuilder = {
  id: "sheer-terrain",
  accepts: (spec) => (spec.type === "village" || (spec.type as string) === "route") && !!sheerKindFor(spec),
  build,
};
