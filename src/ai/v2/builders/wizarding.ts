// 조수 v2 마법 학교(해리포터풍) 빌더 — 「마법학교·기숙사·마법 수업」 요청의 방·야외를 wizarding_world 의 build_wizarding_space 로 짓는다.
//
// 2026-10-28 스위트 조립 장부: 「마법 학교 신입생이 사라진 교수님을 찾는」 판의 학교가 판타지 실내 v5(통나무 여관풍)로 지어졌다 —
// 실내 빌더가 「주인공 물건이 v5 에 더 많으면 v5」로 도망갔다. wizarding_world 로 방 종류 견본(build_hand_interior_room)을 짓게 하면
// 가구 없는 빈 돌방 다섯이 세로로 섰다. 이 칩셋의 실제 게임 맵 길은 build_wizarding_space(13공간 레시피: 벽·문·바닥·러너·가구 자동)이다.
// 이 빌더: 구역(방)마다 이름 낱말로 공간 하나를 고르고, 첫 방의 문(북·동·서)과 다른 방의 남문을 create_transfer_pair 로 잇는다.
// 주인공 물건은 이 세트의 기물 이름으로 찾고, 없으면 가장 가까운 기물로 바꿔 놓고 경고한다(v5 로 도망가지 않는다).
import { isBlankMap } from "@/editor/tools/mapEmptiness";
import { prepareTool } from "@/editor/tools/asyncToolRunner";
import { WIZARDING_SPACE_SPEC } from "@/editor/wizarding/builder";
import type { BuildRun, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec, ZoneSpec } from "../types";
import { stableHash } from "./joseon";

/** 마법 학교 낱말 — 요청 원문·명세에 있으면 이 빌더가 맡는다(마법사의 탑·연금술 공방 같은 일반 판타지는 아니다). */
export const WIZARDING_WORDS = /wizard|hogwart|호그와트|호그스미드|마법\s*학교|마법학교|마법\s*학원|기숙사|마법\s*수업|마법약\s*(?:교실|수업)|퀴디치|입학식/iu;

type Space = { readonly space: string; readonly variant?: string; readonly label: string };
/** 방 낱말 → 공간. 앞이 우선(복도가 천문탑보다 먼저: 「천문탑으로 가는 복도」는 복도). */
const SPACE_RULES: readonly (readonly [RegExp, Space])[] = [
  [/휴게실|common\s*room/iu, { space: "shared", variant: "common", label: "기숙사 휴게실" }],
  [/기숙사|침실|숙소|dorm|bedroom/iu, { space: "shared", variant: "dorm", label: "기숙사 침실" }],
  [/복도|회랑|통로|corridor|hall\s*way/iu, { space: "shared", variant: "corridor", label: "성채 복도" }],
  [/연회장|대강당|강당|식당|입학\s*홀|대전|great\s*hall|dining|entrance|입구|현관/iu, { space: "shared", label: "성채 대연회장" }],
  [/마법약|물약|potion|교실|수업|강의실|classroom|alchemy|연금/iu, { space: "potions", label: "지하 마법약 교실" }],
  [/도서관|서고|서재|연구실|library|study|archive/iu, { space: "library", label: "도서관" }],
  [/병동|의무실|양호실|치료|infirmary|hospital/iu, { space: "infirmary", label: "병동" }],
  [/온실|약초|식물|greenhouse|herb/iu, { space: "greenhouse", label: "온실" }],
  [/부엉이|올빼미|owl/iu, { space: "owlery", label: "부엉이 탑" }],
  [/천문|관측|별자리|시계탑|시계|clock|astronom|tower|탑/iu, { space: "clocktower", label: "시계탑 기어실" }],
  [/우체국|우편|post/iu, { space: "postoffice", label: "부엉이 우체국" }],
  [/지팡이|wand/iu, { space: "wandshop", label: "지팡이 가게" }],
  [/과자|사탕|허니듀크|창고|honeyduke|cellar|storeroom/iu, { space: "honeydukes", label: "과자점 지하 창고" }],
  [/퀴디치|경기장|quidditch|stadium/iu, { space: "quidditch", label: "퀴디치 경기장" }],
  [/호수|보트|선착|lake|boat/iu, { space: "boathouse", label: "보트 창고" }],
  [/마차|숲|forest|carriage/iu, { space: "carriage", label: "숲 마차 승차장" }],
  // 「홀」은 흔한 낱말이라 맨 뒤(「천문대 관측 홀」은 천문이 먼저).
  [/홀|hall/iu, { space: "shared", label: "성채 대연회장" }],
];
const DEFAULT_INDOOR: Space = { space: "shared", label: "성채 대연회장" };
const DEFAULT_OUTDOOR: Space = { space: "carriage", label: "숲 마차 승차장" };

/** 주인공 물건 낱말 → 이 세트 기물. 앞 표는 같은 물건, 뒤 표(substitute)는 세트에 없어 가장 가까운 기물로 바꾼다. */
const SAME: readonly (readonly [RegExp, string])[] = [
  [/책장|서가|책꽂이|bookshelf|bookcase/iu, "wz-furn-bookshelf"], [/벽난로|난로|fireplace/iu, "wz-furn-fireplace"],
  [/칠판|blackboard/iu, "wz-nv-pot-teaching-kit-blackboard"], [/침대|bed/iu, "wz-dorm-bed-green"], [/의자|chair/iu, "wz-furn-chair-back-left"],
  [/촛대|촛불|양초|candle/iu, "wz-furn-candlestick"], [/가마솥|솥|cauldron/iu, "wz-pot-cauldron-bench-green"], [/카운터|counter/iu, "wz-post-counter"],
  [/거울|mirror/iu, "wz-dorm-mirror"], [/궤짝|상자|crate|chest/iu, "wz-furn-crate-stack"], [/술통|통|barrel/iu, "wz-furn-barrel"],
  [/화분|plant|pot\b/iu, "wz-gh-pot-full"], [/열람대|독서대|교탁|강단|연단|lectern|podium/iu, "wz-lib-lectern"], [/시계|clock/iu, "wz-clock-dial-back"],
  [/계단|stair/iu, "wz-clock-stair"], [/책상|탁자|테이블|desk|table/iu, "wz-furn-table-small"], [/긴\s*의자|벤치|bench/iu, "wz-furn-bench-long"],
];
const SUBSTITUTE: readonly (readonly [RegExp, string, string])[] = [
  [/망원경|천체|telescope/iu, "wz-lib-lectern", "검사 열람대"],
  [/별자리|성도|지도|지구본|천구의|map|globe|chart/iu, "wz-lib-record-table", "양피지 기록 탁자"],
  [/수정\s*구슬|구슬|crystal/iu, "wz-furn-candlestick", "황동 촛대"],
  [/깃발|휘장|banner/iu, "wz-furn-banner-lion", "사자 휘장"],
];

const pieces = WIZARDING_SPACE_SPEC.pieces as Readonly<Record<string, { readonly name: string }>>;

/** 낱말 → 기물 id. sub 가 있으면 대신 놓은 것(경고 문구용). */
export function wizardingKitFor(anchor: string): { kit: string; sub?: string } {
  const word = anchor.replace(/^(?:큰|작은|커다란|낡은|올라가는|내려가는)\s*/u, "").trim();
  const same = SAME.find(([re]) => re.test(word));
  if (same) return { kit: same[1] };
  const named = Object.entries(pieces).find(([, p]) => word.length >= 2 && p.name.replace(/\s+/gu, "").includes(word.replace(/\s+/gu, "")));
  if (named) return { kit: named[0] };
  const sub = SUBSTITUTE.find(([re]) => re.test(word));
  if (sub) return { kit: sub[1], sub: sub[2] };
  return { kit: "wz-furn-candlestick", sub: "황동 촛대" };
}

function spaceFor(text: string): Space | undefined {
  return SPACE_RULES.find(([re]) => re.test(text))?.[1];
}

const requestKeyOf = (spec: PlaceSpec): number => typeof spec.hints?.requestKey === "number" ? spec.hints.requestKey : stableHash(spec.name);

interface WizState { readonly mapIds: readonly string[] }

function zonesOf(spec: PlaceSpec): ZoneSpec[] {
  return spec.zones?.length ? [...spec.zones] : [{ kind: spec.name, purpose: spec.theme ?? spec.name } as ZoneSpec];
}

function build(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const first = run.calls.length;
  const warnings: string[] = [];
  const missingArt: string[] = [];
  const project = run.ctx.project;
  const outdoor = spec.type === "village" || spec.type === "street";
  const zones = zonesOf(spec);
  // 지을 자리: 다시 짓기는 그 맵(overwrite), 명세 mapId, 아니면 빈 지금 맵·빈 시작 맵을 그 자리에서(칩셋을 바꿔 짓는다).
  const prevIds = (previous?.result.state as WizState | undefined)?.mapIds ?? previous?.result.mapIds ?? [];
  let mainTarget: string | undefined = prevIds[0] ?? spec.mapId;
  if (!mainTarget) {
    for (const id of [spec.hints?.newMap === true ? undefined : run.ctx.currentMapId, project.startMapId]) {
      const map = id ? project.maps[id] : undefined;
      if (map && isBlankMap(map)) { mainTarget = map.id; break; }
    }
  }
  const extras = outdoor ? [] : zones.slice(1, 4);
  if (!outdoor && zones.length > 4) warnings.push(`방 ${zones.length}개 중 첫 방에 이을 수 있는 셋(북·동·서 문)까지만 지었다 — 나머지(${zones.slice(4).map((z) => z.purpose ?? z.kind).join("·")})는 따로 make_place 로`);
  const extraSides = ["n", "e", "w"] as const;
  const seedBase = requestKeyOf(spec) + (previous ? (previous.rounds + 1) * 7919 : 0);
  const density = spec.size === "small" ? "sparse" : spec.size === "large" ? "full" : "normal";
  const furnitureFor = (zone: ZoneSpec, label: string) => {
    const out: { kit: string }[] = [];
    for (const anchor of zone.anchors ?? []) {
      const hit = wizardingKitFor(anchor);
      out.push({ kit: hit.kit });
      if (hit.sub) warnings.push(`「${anchor}」은 마법 학교 세트에 없어 가장 가까운 「${hit.sub}」(${hit.kit})로 대신 놓았다(${label})`);
    }
    return out;
  };
  const builtRooms: { mapId: string; label: string; doorCells: { x: number; y: number; side: string }[]; spawn: { x: number; y: number } }[] = [];
  const buildOne = (zone: ZoneSpec, index: number, mapId: string | undefined, name: string, doors: { side: string; kind?: string }[] | undefined): boolean => {
    const text = `${zone.kind} ${zone.purpose ?? ""}`;
    // 첫 방은 장소 이름이 먼저(「천문탑 관측실」), 다른 방은 구역 낱말.
    const pick = (index === 0 ? spaceFor(`${spec.name} ${spec.theme ?? ""}`) ?? spaceFor(text) : spaceFor(text)) ?? (outdoor ? DEFAULT_OUTDOOR : DEFAULT_INDOOR);
    const recipe = (WIZARDING_SPACE_SPEC.spaces as Record<string, { indoor?: boolean }>)[pick.space];
    if (!recipe) { warnings.push(`공간 ${pick.space} 이 없다`); return false; }
    const furniture = furnitureFor(zone, pick.label);
    const exists = mapId ? run.ctx.project.maps[mapId] : undefined;
    const res = run.call("build_wizarding_space", {
      space: pick.space, ...(pick.variant ? { variant: pick.variant } : {}), name,
      ...(mapId ? { mapId } : {}), ...(exists && !isBlankMap(exists) ? { overwrite: true } : {}),
      ...(doors ? { doors } : {}), ...(furniture.length ? { furniture } : {}),
      density, seed: 1 + ((seedBase + index * 104729) % 9973),
    });
    const data = res.data as { mapId?: string; doorCells?: { x: number; y: number; side: string }[]; spawn?: { x: number; y: number }; placed?: { kit: string }[] } | undefined;
    if (!res.ok || !data?.mapId) { warnings.push(`「${zone.purpose ?? zone.kind}」(${pick.label}) 짓기 실패: ${String(res.summary ?? "").slice(0, 200)}`); return false; }
    const placedKits = new Set((data.placed ?? []).map((p) => p.kit));
    for (const f of furniture) if (!placedKits.has(f.kit)) missingArt.push(`${f.kit}(${pick.label}) — 놓을 빈 자리가 없다`);
    builtRooms.push({ mapId: data.mapId, label: `${zone.purpose ?? zone.kind}=${pick.label}${pick.variant ? `(${pick.variant})` : ""}`, doorCells: data.doorCells ?? [], spawn: data.spawn ?? { x: 0, y: 0 } });
    return true;
  };

  const mainDoors = extras.length ? [{ side: "s", kind: "double" }, ...extras.map((_, i) => ({ side: extraSides[i]! }))] : undefined;
  if (!buildOne(zones[0]!, 0, mainTarget, spec.name, mainDoors)) {
    return { ok: false, mapIds: prevIds, summary: `마법 학교 「${spec.name}」을 짓지 못했다: ${warnings.join(" / ").slice(0, 300)}`, warnings, missingArt, calls: run.calls.slice(first) };
  }
  const main = builtRooms[0]!;
  for (const [i, zone] of extras.entries()) {
    const label = zone.purpose?.trim() || zone.kind;
    if (!buildOne(zone, i + 1, prevIds[i + 1], `${spec.name} · ${label}`, [{ side: "s" }])) continue;
    const sub = builtRooms[builtRooms.length - 1]!;
    const from = main.doorCells.find((d) => d.side === extraSides[i]);
    const to = sub.doorCells.find((d) => d.side === "s") ?? sub.doorCells[0];
    if (!from || !to) { warnings.push(`「${label}」 문 칸을 찾지 못해 잇지 못했다`); continue; }
    // 다시 짓기에서 이미 이어진 문이면 건너뛴다(맵 안의 이동 이벤트는 다시 짓기에도 남는다).
    const linked = (run.ctx.project.maps[main.mapId]?.events ?? []).some((e) => JSON.stringify(e.pages ?? []).includes(`"mapId":"${sub.mapId}"`));
    if (linked) continue;
    const link = run.call("create_transfer_pair", { a: { mapId: main.mapId, x: from.x, y: from.y }, b: { mapId: sub.mapId, x: to.x, y: to.y } });
    if (!link.ok) warnings.push(`「${label}」 잇기 실패: ${String(link.summary ?? "").slice(0, 160)}`);
  }
  const after = run.ctx.project;
  const mainMap = after.maps[main.mapId]!;
  const entrance = after.startMapId === main.mapId && after.startPos ? { mapId: main.mapId, x: after.startPos.x, y: after.startPos.y } : { mapId: main.mapId, ...main.spawn };
  const mapIds = builtRooms.map((r) => r.mapId);
  return {
    ok: true,
    mapIds,
    entrance,
    summary: `${spec.name}: 마법 학교 칩셋(wizarding_world) ${builtRooms.map((r) => r.label).join(" · ")} (${mainMap.width}×${mainMap.height}${builtRooms.length > 1 ? `, 방 ${builtRooms.length}개 문으로 이어짐` : ""})`,
    warnings,
    missingArt,
    calls: run.calls.slice(first),
    state: { mapIds } satisfies WizState,
  };
}

export const WIZARDING_BUILDER: PlaceBuilder = {
  id: "wizarding",
  accepts: (spec) => /wizard/iu.test(spec.style ?? "") && (spec.type === "interior" || spec.type === "village" || spec.type === "street" || spec.type === "house"),
  prepare: () => prepareTool("build_wizarding_space", { space: "shared" }),
  build,
};

export const WIZARDING_CARD = "[마법 학교 style:wizarding] 마법 학교·기숙사·호그와트풍 요청은 style 에 wizarding 을 넣는다(판타지 실내로 짓지 않는다). " +
  "interior 의 zones 하나가 방 하나: 대연회장·입학 홀·휴게실·기숙사 침실·복도·마법약 교실(교실·수업)·도서관(서재·연구실)·병동·온실·부엉이 탑·천문탑(시계탑 기어실)·우체국·지팡이 가게·과자점 창고. " +
  "첫 방에 다른 방이 셋까지 문(북·동·서)으로 이어진다. 주인공 물건은 이 세트 기물로 찾고, 없으면(망원경·별자리표) 가장 가까운 기물로 바꿔 경고한다. village=숲 마차 승차장·호수 보트 창고·퀴디치 경기장(이름 낱말).";
