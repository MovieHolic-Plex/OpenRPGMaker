// v2 동사들이 같이 쓰는 밑받침 — 결과 글 싸기, 지은 맵 보기(기계 검사·비평·그림), 쓰기 기록, 다음 단계 안내, 장소 패치 적용, 상한 값.
import type { PiToolExecResult } from "@/ai/piAgent/toolAdapter";
import { layoutGiven } from "../place/interiorLayout";
import { cleanLayoutHint } from "../place/builders/village";
import type { PiAssistantV2Env } from "../shared/env";
import { roomSpecOf } from "@/editor/handInterior/builder";
import { type RecordingBuildRun } from "../shared/buildRun";
import { applyModernSetupDefaults, applyStorySetupDefaults } from "../genreDefaults";
import { recordStageWrites, type StageWrites } from "../shared/stageWrites";
import { interiorBuilder } from "../place/builders/interior";
import { roomMaterials } from "../place/builders/interiorShape";
import { runMachineChecks, summarizeChecks } from "../judge/machineChecks";
import { critique } from "../judge/critic";
import type { CriticVerdict } from "@/ai/piAgent/featureReview";
import type { PlaceBuildResult, PlacePatch, PlaceRecord, PlaceSpec, PlaceType, ZoneSpec } from "../shared/types";
import type { Project } from "@/project/types";
import { V2Session, type Seen } from "../turn/session";
import { V2_MAX_REPAIR_ROUNDS, repairCapOf } from "../turn/session";

export const OPP_SIDE = { north: "south", south: "north", east: "west", west: "east" } as const;

/** 청사진 장소가 게임 세계와 안 맞을 때 돌려보내는 횟수(그 뒤에는 함수가 메운다). */
export const WORLD_BOUNCES = 2;

/** 한 장소에서 여러 바깥 장소로 나가는 길을 서로 다른 변에 둔다. */
export const LINK_SIDES = ["east", "west", "north", "south"] as const;


/** 칸 배치 없이 온 손 도트 실내를 돌려보내는 최대 횟수 — 그 뒤엔 옛 설계 길로 짓는다. */
export const LAYOUT_BOUNCES = 3;

/** 장소 하나의 고치기 상한(정본 turn/session.ts repairCapOf — 끝맺음 관문과 같은 수). */
export const repairCap = (spec?: PlaceSpec): number => repairCapOf(spec);

/** build_hand_interior_room 이 layout 방마다 다는 장소 꼬리표(handInteriorTools.ts 와 같은 값). */
export const HAND_LAYOUT_ROOM_TAG = "hand-layout-room";

export const text = (value: unknown): PiToolExecResult => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] });

/** 실내형 장소 낱말(감옥·여관·가게·서재…) — 요청이 던전을 분명히 말하지 않으면 실내 길로 짓는다. */
export const INTERIOR_PLACE = /감옥|뇌옥|감방|옥사|여관|주점|선술집|객잔|가게|상점|잡화점|서재|도서관|서고|교회|성당|예배당|대장간|길드|병원|학교|교실|jail|prison|dungeon cell|inn\b|tavern|shop|store|library|study|chapel|church|forge|guild/iu;

/** 던전을 분명히 말하는 낱말 — 미궁·던전 탐험·동굴·몬스터 소굴·보스 방·층 여럿. */
export const CLEAR_DUNGEON = /던전|미궁|동굴|굴\b|소굴|탐험|보스\s*방|몬스터|함정|labyrinth|maze|dungeon(?!\s*cell)|cave|lair|crawl|boss room/iu;

/** 맵 하나를 사람이 보는 1배 그림으로(모델·비평가 공용). 렌더 경로가 없으면 undefined. */
export async function renderMap(env: PiAssistantV2Env, mapId: string): Promise<string | undefined> {
  const map = env.ctx.project.maps[mapId];
  if (!map || !env.render) return undefined;
  try { return await env.render(mapId, 0, 0, map.width, map.height); } catch { return undefined; }
}

/** 보기 단계: 기계 검사 + 1배 그림 + 독립 비평가(맵마다, 같은 짓기의 다른 맵은 문맥으로). */
export async function see(env: PiAssistantV2Env, session: V2Session, task: string, type: PlaceType | "content", mapIds: readonly string[], entrance: PlaceBuildResult["entrance"], critic: boolean): Promise<Seen> {
  const project = env.ctx.project;
  const checks = runMachineChecks(project, mapIds, entrance);
  const images: { mapId: string; dataUrl: string }[] = [];
  for (const mapId of mapIds.slice(0, 4)) {
    const dataUrl = await renderMap(env, mapId);
    if (dataUrl) images.push({ mapId, dataUrl });
  }
  const critics: CriticVerdict[] = [];
  if (critic && images.length) {
    env.emit({ type: "execution_status", name: "v2.critic", ok: true, summary: `다른 눈(독립 비평가)이 1배 그림 ${images.length}장을 보는 중` });
    const judged = await Promise.all(images.slice(0, 3).map(async (image) => {
      const map = project.maps[image.mapId]!;
      // 다른 층은 이름만 준다 — 그림까지 주면 층마다 비평가가 그림 3장을 읽어 한 번에 ~6초 더 걸렸다(72회 실측: 1장 23초 · 3장 29초 중앙값).
      const others = images.filter((o) => o.mapId !== image.mapId).map((o) => ({ name: project.maps[o.mapId]?.name ?? o.mapId, image: "" }));
      // 요청 하나가 여러 장소를 말하면(마을 + 북쪽 밤 숲길) 마을 비평가가 숲길 특징을 마을 맵의 「빠진 것」으로 잡는다 — 이번 실행에 지은 다른 장소와
      // 이미 있는 다른 맵 이름(최대 8)을 문맥으로 준다(「다른 맵에 있으면 빠진 것으로 세지 않는다」). 실측 2026-10-31 asst-parity 숲 추격 terra: 마을 비평이
      // 「어둡고 구불구불한 숲길이 마을에 안 보인다」 major 를 세 번 내 고치기 항목이 막힘으로 끝났다(숲길은 따로 지은 「밤의 숲길」 맵).
      for (const [id, m] of Object.entries(project.maps)) {
        if (id === image.mapId || others.length >= 8 || images.some((o) => o.mapId === id)) continue;
        others.push({ name: m.name ?? id, image: "" });
      }
      try {
        const run = await critique({ task, type, map: { id: map.id, name: map.name, width: map.width, height: map.height }, image: image.dataUrl, others, sideChat: env.sideChat, ...(env.signal ? { signal: env.signal } : {}) });
        session.criticCalls++; session.criticMs += run.ms;
        return run.verdict;
      } catch (error) {
        return { mapId: image.mapId, majors: [], problem: `비평 호출 실패: ${error instanceof Error ? error.message : String(error)}` } satisfies CriticVerdict;
      }
    }));
    critics.push(...judged);
  }
  return { checks, critics, images };
}

export function seenPayload(seen: Seen): Record<string, unknown> {
  return {
    machineChecks: summarizeChecks(seen.checks),
    critic: seen.critics.map((v) => ({ mapId: v.mapId, score: v.score, majors: v.majors, ...(v.problem ? { problem: v.problem } : {}) })),
  };
}

export function withImages(payload: unknown, seen: Seen | undefined, maxImages = 2): PiToolExecResult {
  const result = text(payload);
  for (const image of seen?.images.slice(0, maxImages) ?? []) {
    const comma = image.dataUrl.indexOf(",");
    result.content.push({ type: "image", mimeType: "image/png", data: image.dataUrl.slice(comma + 1) });
  }
  return result;
}

/** 쓰기 기록 하나: 시공 재생 단계를 실어 다음 체크포인트가 편집기에서 다시 튼다. */
export const recorded = new WeakMap<PiAssistantV2Env, Set<string>>();

/** 청사진 경로를 하나씩 맞추려 할 때 build_blueprint_path 로 보낼 하위 도구. */
export const PATH_LOW_LEVEL = new Set(["upsert_event", "patch_event_page", "define_ending", "declare_story_flag", "upsert_item", "place_npc", "upsert_common_event"]);

export const BLUEPRINT_PROGRESS_VERBS = new Set(["make_place", "make_game", "edit_place", "add_people", "add_event", "add_scene", "author_puzzle_chain", "build_blueprint_path"]);

export function recordWrite(env: PiAssistantV2Env, run: RecordingBuildRun, toolCallId: string, name: string, args: unknown, ok: boolean, summary: string, data?: unknown): void {
  if (!recorded.has(env)) recorded.set(env, new Set());
  recorded.get(env)!.add(toolCallId);
  const logs = run.takeConstructionLogs();
  env.record({ toolCallId, name, args, result: { ok, summary, ...(data !== undefined ? { data } : {}) }, ...(logs.length ? { constructionLogs: logs } : {}) });
}

export function nextStep(seen: Seen, rounds: number, designed: boolean | "dungeon" = false, cap = V2_MAX_REPAIR_ROUNDS, handInterior = true): string {
  const bad = seen.checks.filter((c) => !c.ok).length + seen.critics.reduce((n, v) => n + v.majors.length, 0);
  if (!bad && !seen.critics.some((v) => v.problem)) return "통과 — 비평 major 0, 기계 검사 통과. 다른 요청 부분이 남았으면 이어서, 아니면 사용자에게 보고한다.";
  // 조수가 설계한 방: 고치기도 설계로 — 함수가 가구를 골라 채우는 dress_room 을 권하지 않는다.
  if (designed === "dungeon") return `문제 ${bad}건 — 이 층은 네 dungeonDesign 대로 지었다. warnings 의 「고침:」 줄과 비평을 보고 설계(방 크기·모양·자리 at·길 links·물)를 고쳐 edit_place({patch:{mapId, set:{dungeonDesign: 고친 설계 전체}}}) 로 다시 짓는다. 못 고치는 것은 보고에 남긴다.`;
  if (designed) return `문제 ${bad}건 — 이 방은 네 design 대로 지었다. warnings 의 「고침:」·「맨바닥」 줄과 비평을 보고 design(크기 w·h, 모양, 묶음과 자리)을 고쳐 edit_place({patch:{mapId, design: 고친 설계 전체}}) 로 다시 짓는다. 가구 하나만 옮기거나 돌리려면 move_object. 못 고치는 것(그림이 없는 물건 등)은 보고에 남긴다.`;
  // dress_room 은 설계하지 않은 손 도트 실내 방만 채운다 — 바깥 맵·던전에 권하면 거절만 쌓인다(2026-10-30~31 Terra 129판: dress_room 205번 중 194번 거절).
  const furniture = handInterior
    ? "놓인 가구 하나가 문·길을 막거나 방향이 틀린 major 는 move_object(그 칸 at → to·face·remove)로 고친다. 방이 비었다·빈 바닥이 많다는 문제는 dress_room(mapId, at: 그 방 바닥 한 칸, purpose: 방 쓰임)으로 채운다 — 둘 다 바퀴를 쓰지 않는다."
    : "이 맵의 칩셋에는 방 짓기 역할표가 없어 move_object·dress_room 을 쓰지 않는다 — 빈 곳에 소품이 필요하면 stamp_object 로 하나씩 놓는다.";
  if (rounds >= cap) return `고치기 상한(${cap}바퀴)에 닿았다 — 다시 짓는 고치기는 더 하지 않는다. ${furniture} 그 밖의 남은 문제는 사용자에게 그대로 보고한다.`;
  return `문제 ${bad}건 — 고칠 수 있으면 edit_place 패치(구역 더하기·주인공 물건 near 좌표·크기·variant·dressing)로 한 번에 고친다(남은 바퀴 ${cap - rounds}). ${furniture} 패치로 못 고치는 것(그림이 없는 물건 등)은 보고에 적는다.`;
}

/** 빌더 기록이 없는 손 도트 실내(이전 실행이나 사람이 layout 으로 지은 방)를 같은 방 구성으로 다시 지어 기록을 만든다. */
export function adoptInterior(run: RecordingBuildRun, mapId: string): PlaceRecord | undefined {
  const project = run.ctx.project;
  const map = project.maps[mapId];
  if (!map || !roomSpecOf(project.tilesets[map.tilesetId])) return undefined;
  const rooms = (map.locations ?? []).filter((l) => (l.tags ?? []).includes(HAND_LAYOUT_ROOM_TAG));
  if (!rooms.length) return undefined;
  const style = map.tilesetId === "atlas_biome_interior" ? undefined : map.tilesetId;
  // 원래 방 크기·바닥·벽면 재질을 지킨다 — 크기를 안 주면 다른 견본(돌바닥)이 골라져 「아늑하게」가 오히려 차가워졌다(2026-10-23 비교, v1 7.5 · v2 3.5).
  const roomSpec = roomSpecOf(project.tilesets[map.tilesetId])!;
  const spec: PlaceSpec = { type: "interior", name: map.name, mapId, ...(style ? { style } : {}),
    zones: rooms.map((r) => ({ kind: r.name, keep: { w: r.w ?? 0, h: r.h ?? 0, ...roomMaterials(roomSpec, map, { x: r.x, y: r.y, w: r.w ?? 1, h: r.h ?? 1 }) } })) };
  const result = interiorBuilder.build(run, spec);
  return result.ok ? { builder: interiorBuilder.id, spec, result: { ...result, warnings: [...result.warnings, "v2 기록이 없던 방이라 같은 방 구성(layout)으로 다시 지은 뒤 고쳤다 — 손으로 옮긴 가구는 견본 가구로 돌아간다"] }, rounds: 0 } : undefined;
}

export function applyPatch(spec: PlaceSpec, patch: PlacePatch, floor = 1): PlaceSpec {
  const removed = new Set(patch.removeZones ?? []);
  let zones = (spec.zones ?? []).filter((z) => !removed.has(z.id ?? z.kind) && !removed.has(z.kind));
  // zones = 이 층의 구역 목록 전체를 바꾼다(방 그래프 다시 짜기). 다른 층 구역은 그대로.
  if (patch.zones?.length) zones = [...zones.filter((z) => (z.floor ?? 1) !== floor), ...patch.zones.map((z) => (floor > 1 && !z.floor ? { ...z, floor } : z))];
  // 설계 방 고치기: 고친 설계 전체로 그 구역의 design 을 바꾼다. 같은 종류의 설계 구역을 addZones 로 다시 보낸 것도 «바꾸기»로 읽는다
  // (2026-10-29 flash 실조수: 고친 서재 설계를 addZones 로 보내 서재가 둘인 2실이 됐다).
  const designAt = (want?: string) => zones.findIndex((z) => (z.floor ?? 1) === floor && (want ? z.id === want || z.kind === want : !!z.design));
  if (patch.design) {
    const i = designAt(patch.designZone) >= 0 ? designAt(patch.designZone) : zones.findIndex((z) => (z.floor ?? 1) === floor);
    if (i >= 0) zones[i] = { ...zones[i]!, design: patch.design };
  }
  const adds: ZoneSpec[] = [];
  for (const z of patch.addZones ?? []) {
    const i = z.design ? zones.findIndex((q) => !!q.design && q.kind === z.kind && (q.floor ?? 1) === (z.floor ?? floor)) : -1;
    if (i >= 0) zones[i] = { ...zones[i]!, ...z, design: z.design };
    else adds.push(floor > 1 && !z.floor ? { ...z, floor } : z);
  }
  zones = [...zones, ...adds];
  // 위층 맵을 고치는 패치: 물건은 그 층 구역으로(없으면 객실 구역을 만든다) — 1층 홀에 침대가 들어갔다(2026-10-23 v2 실조수).
  if (floor > 1 && patch.addAnchors?.length && !zones.some((z) => z.floor === floor)) zones = [...zones, { kind: "inn_room", floor }];
  const loose: string[] = [];
  for (const add of patch.addAnchors ?? []) {
    const index = floor > 1
      ? zones.findIndex((z) => z.floor === floor && (!add.zone || z.id === add.zone || z.kind === add.zone)) >= 0
        ? zones.findIndex((z) => z.floor === floor && (!add.zone || z.id === add.zone || z.kind === add.zone))
        : zones.findIndex((z) => z.floor === floor)
      : zones.findIndex((z) => (z.floor ?? 1) === 1 && (z.id === add.zone || z.kind === add.zone));
    const at = index >= 0 ? index : 0;
    if (zones[at]) zones[at] = { ...zones[at]!, anchors: [...(zones[at]!.anchors ?? []), add.what] };
    else loose.push(add.what); // 구역 없는 장소(마을·던전)는 장소 전체의 낱말로
  }
  const features = [...new Set([...(spec.features ?? []).filter((f) => !(patch.removeFeatures ?? []).includes(f)), ...(patch.addFeatures ?? []), ...loose])];
  const { seed: _modelSeed, ...setHints } = (patch.set?.hints ?? {}) as Record<string, string | number | boolean>;   // 씨앗은 모델 손잡이가 아니다(make_place 와 같다)
  const hints = { ...(spec.hints ?? {}), ...setHints,
    ...(patch.variant !== undefined ? { variant: patch.variant } : {}), ...(patch.seed !== undefined ? { seed: patch.seed } : {}), ...(patch.dressing !== undefined ? { dressing: patch.dressing } : {}) };
  // 빈 껍데기 layout(엄격 스키마가 채운 {regions:[]})은 «바꾸지 않는다»로 읽는다.
  const { layout: setLayout, ...setRest } = (patch.set ?? {}) as Partial<PlaceSpec>;
  const layout = layoutGiven(setLayout) ? { layout: setLayout } : {};
  return { ...spec, ...setRest, ...layout, type: spec.type, ...(zones.length ? { zones } : {}), ...(features.length ? { features } : {}), hints };
}

/**
 * 고치기 패치에서 «보내지 않은 것»을 걷어 낸다. 엄격 스키마 모델(terra)은 edit_place 의 모든 칸을 0·빈 값·지금 값으로 채워 보낸다 —
 * set.name:"" · set.features:[] · set.hints.layout{gather{x:0,y:0}…} · design{shape:"",areas:[],groups:[]} · variant:0 · dressing:0.
 * 그대로 적용하면 «우물 하나 더» 가 마을 이름·자리·크기를 지운 다시 짓기가 된다(2026-11-11 map-vqa 깔기 village 재생: 「시골 마을」 38×48 → 이름 없는 50×40).
 * 규칙: 빈 글·빈 배열·null·잎이 모두 기본값인 객체는 버리고, 지금 명세와 같은 값도 버린다(바꾸는 것이 아니다). spec = 고칠 장소의 지금 명세(없으면 빈 값만 걷는다).
 */
export function dropPatchFill(patch: PlacePatch, spec?: PlaceSpec): PlacePatch {
  const empty = (v: unknown): boolean => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);
  const shell = (v: unknown): boolean => !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every((l) => l === 0 || l === false || empty(l) || shell(l));
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
  const out: Record<string, unknown> = { ...patch };
  if (patch.set) {
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch.set)) {
      if (k === "hints" || empty(v) || (k === "layout" ? !layoutGiven(v) : shell(v)) || same(v, (spec as Record<string, unknown> | undefined)?.[k])) continue;
      set[k] = v;
    }
    const hints: Record<string, unknown> = {};
    for (const [k, v] of Object.entries((patch.set.hints ?? {}) as Record<string, unknown>)) {
      const cur = (spec?.hints as Record<string, unknown> | undefined)?.[k];
      if (k === "layout") { const lay = cleanLayoutHint(v); if (lay && !same(lay, cur)) hints[k] = lay; continue; }
      // 숫자 0 은 «안 정했다» 다(폭·높이·집 수·씨앗에 0 은 없다). false 는 켜 둔 것을 끄는 것일 때만 바꾸는 것이다.
      if (empty(v) || shell(v) || same(v, cur) || v === 0 || (v === false && cur !== true)) continue;
      hints[k] = v;
    }
    if (Object.keys(hints).length) set.hints = hints;
    if (Object.keys(set).length) out.set = set; else delete out.set;
  }
  for (const k of ["zones", "addZones", "removeZones", "addAnchors", "addFeatures", "removeFeatures"] as const) if (empty(patch[k])) delete out[k];
  if (patch.addAnchors) { const real = patch.addAnchors.filter((a) => typeof a?.what === "string" && a.what.trim()); if (real.length) out.addAnchors = real; else delete out.addAnchors; }
  if (patch.design && !(patch.design as { areas?: unknown[] }).areas?.length && !(patch.design as { groups?: unknown[] }).groups?.length) delete out.design;
  const hintNow = (k: string) => Number((spec?.hints as Record<string, unknown> | undefined)?.[k] ?? 0);
  if (patch.variant !== undefined && patch.variant === hintNow("variant")) delete out.variant;
  if (patch.dressing !== undefined && patch.dressing === hintNow("dressing")) delete out.dressing;
  if (empty(patch.designZone)) delete out.designZone;
  if (empty(patch.layoutReview)) delete out.layoutReview;
  return out as unknown as PlacePatch;
}

/** 현대(한국·일본 도시) 장소를 처음 지은 게임 요청이면 장르 기본값(주인공 현대 칩·체력 HUD 끄기·연애 기본값)을 깔고 보고에 한 줄 남긴다. */
export function withSetupDefaults(result: PlaceBuildResult, builderId: string, project: Project, task: string, freshStart = false, writes?: StageWrites): PlaceBuildResult {
  if (!result.ok) return result;
  const set = recordStageWrites(project, writes, () => builderId === "kr-modern" || builderId === "jp-city" ? applyModernSetupDefaults(project, task, freshStart) : applyStorySetupDefaults(project, task, freshStart));
  return set.length ? { ...result, warnings: [...result.warnings, `게임 기본값을 깔았다: ${set.join(" · ")} — 사용자가 다른 것을 원하면 바꾼다`] } : result;
}

/** 결정적 장소 열쇠 — 프로젝트 열쇠(없으면 게임 제목) + 요청문. 실내 빌더가 견본·조합 씨앗에 쓴다(같은 게임·같은 요청 → 같은 방, 다른 게임 → 다른 설계). */
export function placeVariety(env: PiAssistantV2Env, task: unknown): string {
  return `${env.request.projectKey ?? env.ctx.project.meta.title ?? ""}|${String(task ?? "").slice(0, 400)}`;
}
