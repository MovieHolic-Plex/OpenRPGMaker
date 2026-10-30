// 조수 v2 — 없는 기물 그리기 요청 빌더.
//
// v1 generate_missing_object 는 «그리지 않는다». 그림 요청(ObjectGenRequest)만 돌려주고, 실제 그림은 브라우저의
// 공방 카드가 사용자 AI 계정으로 나중에 그린다(수 분, 후보 1~3장, 사용자가 고르거나 「알아서 고르기」). 그래서 이 빌더도
// 성공을 꾸미지 않는다: «카드를 띄웠다 / 기물은 아직 안 놓였다» 를 summary 와 missingArt 에 그대로 적는다.
import { findMap, resolveWhere, type Footprint } from "./people";
import type { BuildRun, ContentBuildResult, ObjectSpec } from "./types";

export const DRAW_OBJECT_CARD =
  "Missing object (draw_object) spec: {what,description?,where?,at?,mapId?}. what = the object's name as one noun phrase (brass clockwork globe, wooden beehive). " +
  "description = one or two sentences of shape, material and color (filled from what if omitted). People, animals, terrain (floor, wall, water, road) and buildings are not drawn (rejected) — " +
  "buildings use the house kit, people use people. If the chipset already has an object with a matching name, nothing new is drawn and its id is returned. " +
  "where uses the same words as people (입구 entrance · 광장 square · 문 앞 in front of the door · «홀 한쪽» · «바 옆» · 북쪽 벽 north wall · 구석 corner · 창가 by the window); at:{x,y} only when really needed. " +
  "Size comes from the words (커다란·큰 big → 2×2 with only the bottom row blocking, tall → 1×2, otherwise 1×1) — the function picks free floor now that fits that size without blocking paths and puts it on the card. " +
  "Placement comes from the name: frames, signs and posters hang on the wall; rugs, carpets and floor patterns lie on the floor; bookshelves, shelves and cabinets stand against a wall; everything else stands on the floor. " +
  "Important: this spec only shows a «drawing card». The picture is drawn on the user's screen a few minutes later and only then placed — it is not on the map yet.";

type ObjectKind = "floor" | "wall" | "hang" | "flat";

export function inferObjectKind(what: string, description = ""): ObjectKind {
  const t = `${what} ${description}`.toLowerCase();
  if (/액자|간판|포스터|현판|거울|걸개|족자|깃발|시계|frame|sign|poster|banner|mirror|clock/.test(what.toLowerCase())) return "hang";
  if (/러그|카펫|양탄자|깔개|바닥 ?무늬|매트|rug|carpet|mat\b/.test(t)) return "flat";
  if (/책장|선반|장식장|찬장|서랍장|벽난로|옷장|bookshelf|shelf|cabinet|wardrobe|dresser|fireplace/.test(what.toLowerCase())) return "wall";
  return "floor";
}

/** 놓기 계획 — draw_object 가 카드와 함께 미리 정한 자리. 그림이 끝난 뒤 place_object 가 where·at 없이 불리면 이 자리를 쓴다. */
export interface ObjectPlan {
  readonly mapId: string;
  readonly what: string;
  /** 발밑 맨 아래 줄의 왼쪽 칸(stamp_tileset_object base). */
  readonly base: { readonly x: number; readonly y: number };
  readonly footprint: Footprint;
  readonly how?: string;
}
export type DrawObjectResult = ContentBuildResult & { readonly plan?: ObjectPlan };

/**
 * 이름·설명 낱말로 크기를 미리 정한다: 커다란·큰 → 2×2(아래 줄 막힘, 위 줄은 캐릭터 위로 그려짐), 키 큰 것(괘종시계·석상·옷장) → 1×2,
 * 그 밖의 작은 소품 → 1×1. 벽걸이·바닥 무늬는 도구 사전에 맡긴다.
 */
export function inferFootprint(what: string, description: string, kind: ObjectKind): Footprint | undefined {
  if (kind === "hang" || kind === "flat") return undefined;
  const t = `${what} ${description}`.toLowerCase();
  const big = /커다란|큼직한|대형|거대한|거대|large|big|huge|giant|^큰|\s큰/.test(t);
  const tall = /괘종|시계탑|동상|조각상|석상|입상|기둥|등대|첨탑|옷장|책장|장식장|키\s?큰|tall|statue|pillar|grandfather clock|wardrobe|bookcase/.test(t);
  if (big) return { w: 2, foot: 1, over: 1 };
  if (tall) return { w: 1, foot: 1, over: 1 };
  return { w: 1, foot: 1, over: 0 };
}

export function drawObject(run: BuildRun, spec: ObjectSpec): DrawObjectResult {
  const warnings: string[] = [];
  const firstCall = run.calls.length;
  const what = (spec.what ?? "").trim();
  const mapId = spec.mapId ?? run.ctx.currentMapId ?? run.ctx.project.startMapId;
  const fail = (summary: string): ContentBuildResult => ({
    ok: false, mapIds: [], summary, warnings, missingArt: [], calls: run.calls.slice(firstCall),
  });

  if (!what) return fail("기물 이름(what)이 비었다.");
  const map = findMap(run.ctx.project, mapId);
  if (!map) return fail(`맵 '${mapId}' 이 없다.`);

  const description = (spec.description ?? "").trim() || what;
  if (!spec.description) warnings.push(`description 이 없어 이름 「${what}」 으로 채웠다 — 그림 품질을 위해 모양·재료를 적는 편이 낫다.`);
  const objectKind = inferObjectKind(what, description);
  let footprint = inferFootprint(what, description, objectKind);

  const args: Record<string, unknown> = {
    mapId, title: what, description, objectKind,
    need: `${what} 을(를) 맵에 놓고 싶다${spec.where ? ` (${spec.where})` : ""}`,
  };
  if (footprint) { args.tilesW = footprint.w; args.cellsTall = footprint.foot + footprint.over; args.tilesH = footprint.foot; }
  if (spec.notThese?.length) args.notThese = [...spec.notThese];
  // 자리는 지금 정한다(자리 낱말이 없으면 시작 근처) — 그림이 끝난 뒤 다시 정하면 그 사이 맵이 바뀌어 크기에 맞는 빈 바닥이 없을 수 있다.
  const resolveSpot = (fp: Footprint | undefined) => resolveWhere(run.ctx.project, map, spec.where, { ...(spec.at ? { at: spec.at } : {}), ...(fp ? { footprint: fp } : {}) });
  let spot = objectKind === "hang" && !spec.where && !spec.at ? undefined : resolveSpot(footprint);
  if (spot) args.base = { x: spot.cell.x, y: spot.cell.y };

  let res = run.call("generate_missing_object", args);
  // 도구 크기 사전이 크기를 바꿨으면 그 크기로 자리를 다시 고른다(generate_missing_object 는 읽기 도구 — 다시 불러도 부작용 없다).
  if (res.ok && objectKind !== "hang" && objectKind !== "flat") {
    const d = (res.data ?? {}) as { tilesW?: number; tilesH?: number; rise?: number };
    const final: Footprint | undefined = d.tilesW && d.tilesH ? { w: d.tilesW, foot: d.tilesH, over: Math.ceil((d.rise ?? 0) / 16) } : undefined;
    if (final && (!footprint || final.w !== footprint.w || final.foot !== footprint.foot || final.over !== footprint.over)) {
      warnings.push(`${what}: 도구 크기 사전이 크기를 ${footprint ? `${footprint.w}×${footprint.foot + footprint.over}` : "?"} → ${final.w}×${final.foot + final.over}(발밑 ${final.foot}줄) 로 바꿔 자리를 다시 골랐다.`);
      footprint = final;
      const again = resolveSpot(final);
      if (!spot || again.cell.x !== spot.cell.x || again.cell.y !== spot.cell.y) {
        spot = again;
        res = run.call("generate_missing_object", { ...args, tilesW: final.w, cellsTall: final.foot + final.over, tilesH: final.foot, base: { x: again.cell.x, y: again.cell.y } });
      }
    }
  }
  if (spot?.note) warnings.push(`${what}: ${spot.note}`);
  // 자리가 맵 밖으로 넘치면 자리 없이 다시 — 카드는 띄우되 놓을 자리는 후속 턴이 정한다.
  if (!res.ok && args.base && /벗어난다|out-of-bounds/.test(String(res.summary))) {
    warnings.push(`${what}: 정한 자리에서 기물이 맵 밖으로 넘쳐 자리 없이 요청했다(놓을 자리는 그림이 끝난 뒤 정한다).`);
    delete args.base;
    spot = undefined;
    res = run.call("generate_missing_object", args);
  }
  for (const w of res.warnings ?? []) warnings.push(`${what}: ${w}`);

  if (!res.ok) {
    const exists = /이미 있다/.test(String(res.summary));
    return {
      ok: false, mapIds: [mapId], warnings, missingArt: [],
      summary: exists
        ? `새로 그리지 않았다 — 이름이 맞는 기물이 이미 칩셋에 있다: ${String(res.summary).slice(0, 240)}`
        : `그리기 요청 거부: ${String(res.summary).slice(0, 240)}`,
      calls: run.calls.slice(firstCall),
    };
  }

  const req = (res.data ?? {}) as { tilesW?: number; tilesH?: number; rise?: number; harnessId?: string; tilesetId?: string; base?: { x: number; y: number } | null };
  const over = Math.ceil((req.rise ?? 0) / 16);
  const size = req.tilesW && req.tilesH
    ? `${req.tilesW}×${req.tilesH + over}칸 — 발밑 ${req.tilesH}줄 막힘${over ? `, 위 ${over}줄은 지나갈 수 있고 캐릭터 위로 그려짐` : ""}`
    : "크기는 카드에서 확정";
  const base = req.base ?? (spot ? { x: spot.cell.x, y: spot.cell.y } : null);
  const where = base ? `(${base.x},${base.y})${spot?.how ? ` ${spot.how}` : ""}` : "자리 미정";
  const fp: Footprint | undefined = req.tilesW && req.tilesH ? { w: req.tilesW, foot: req.tilesH, over } : footprint;
  return {
    ok: true,
    card: res.data,
    mapIds: [mapId],
    summary:
      `「${what}」 그리기 카드를 대기열에 올렸다(${objectKind}, ${size}, 놓을 자리 ${where}, 칩셋 ${req.tilesetId ?? map.tilesetId}). ` +
      `아직 그려지지 않았고 맵에도 놓이지 않았다 — 사용자 화면의 공방 카드가 그린 뒤(수 분) 후속 턴이 place_object 로 놓는다(where·at 을 비우면 이 자리).`,
    warnings,
    missingArt: [`${what} (카드 대기: 그림 완성·선택 전, 맵에 없음)`],
    calls: run.calls.slice(firstCall),
    ...(base && fp ? { plan: { mapId, what, base, footprint: fp, ...(spot?.how ? { how: spot.how } : {}) } } : {}),
  };
}

const plans = new WeakMap<object, ObjectPlan[]>();
/** draw_object 가 정한 자리를 이 실행(세션)에 기억한다. */
export function rememberObjectPlan(owner: object, plan: ObjectPlan): void {
  const list = plans.get(owner) ?? [];
  plans.set(owner, [...list.filter((p) => !(p.mapId === plan.mapId && p.what === plan.what)), plan]);
}
/** place_object 가 where·at 없이 불렸을 때: 같은 맵의 기억한 자리(물체 id 에 이름이 들어 있으면 그것, 아니면 가장 최근). 꺼내면 지운다. */
export function takeObjectPlan(owner: object, mapId: string, objectId: string): ObjectPlan | undefined {
  const list = plans.get(owner) ?? [];
  const onMap = list.filter((p) => p.mapId === mapId);
  const named = onMap.find((p) => objectId.includes(p.what) || objectId.toLowerCase().includes(p.what.replace(/\s+/gu, "").toLowerCase()));
  const plan = named ?? onMap.at(-1);
  if (plan) plans.set(owner, list.filter((p) => p !== plan));
  return plan;
}
