// 조수 v2 동사 — 모델이 부르는 도구는 이 열 개 안팎뿐이다. 동사마다: 명세 → 결정론 빌더 → 1배 그림 + 기계 검사 → 독립 비평가.
// 고치기는 모델이 비평 결과(칸 좌표 major)를 보고 edit_place 패치로 한다(맵당 3바퀴 상한). 끝맺음 관문(afterMain)이
// 「비평 major 0 + 기계 검사 통과」가 아닌 장소를 남긴 채 「다 됐다」고 말하지 못하게 한다.
import type { PiToolShape, PiToolExecResult } from "@/ai/piAgent/toolAdapter";
import type { PiAssistantV2Env } from "./env";
import { roomSpecOf } from "@/editor/handInterior/builder";
import { createBuildRun, type RecordingBuildRun } from "./buildRun";
import { builderFor } from "./builders";
import { adoptExactInterior, interiorAddAnchors, interiorBuilder, interiorEditFromArgs, roomMaterials } from "./builders/interior";
import { interiorStampEdit, type StampEditState } from "./builders/interiorEdit";
import { fixPlayerStart, runMachineChecks, summarizeChecks, type MachineCheck } from "./checks";
import { critique } from "./critic";
import type { CriticVerdict } from "@/ai/piAgent/featureReview";
import type { ContentBuildResult, EventSpec, ObjectSpec, PersonSpec, PlaceBuildResult, PlacePatch, PlaceRecord, PlaceSpec, PlaceType } from "./types";
import { buildPeople, findMap, resolveWhere } from "./people";
import { buildEvent } from "./events";
import { drawObject } from "./drawObject";
import { buildScene, SCENE_SCHEMA, type SceneSpec } from "./scene";
// 콘텐츠 동사(컷신 무대·연출 비평·물건 자리 계획) — finishContent·addEvent·drawObjectVerb·placeObject 가 쓴다.
import { critiqueStaging } from "./critic";
import { pickStageFrames, stageFrameProject, type EventBuildResult } from "./events";
import { rememberObjectPlan, takeObjectPlan, type DrawObjectResult } from "./drawObject";

export const V2_MAX_REPAIR_ROUNDS = 3;
/** build_hand_interior_room 이 layout 방마다 다는 장소 꼬리표(handInteriorTools.ts 와 같은 값). */
const HAND_LAYOUT_ROOM_TAG = "hand-layout-room";

interface Seen {
  readonly checks: readonly MachineCheck[];
  readonly critics: readonly CriticVerdict[];
  readonly images: readonly { readonly mapId: string; readonly dataUrl: string }[];
}

/** 이 실행의 v2 상태 — 맵별 장소 기록·마지막 검사·누적 「그림 없음」. */
export class V2Session {
  readonly places = new Map<string, PlaceRecord>();
  readonly seen = new Map<string, Seen>();
  readonly content: { verb: string; result: ContentBuildResult }[] = [];
  readonly missingArt = new Set<string>();
  readonly questions: string[] = [];
  criticCalls = 0;
  criticMs = 0;
  /** 모델 입장에서 「아직 안 끝난 것」 — 끝맺음 관문이 읽는다. */
  unresolved(): { mapId: string; name: string; rounds: number; problems: string[] }[] {
    const out: { mapId: string; name: string; rounds: number; problems: string[] }[] = [];
    for (const [mapId, record] of this.places) {
      const seen = this.seen.get(mapId);
      if (!seen) continue;
      const critics = seen.critics.filter((v) => v.mapId === mapId);
      const problems = [
        ...seen.checks.filter((c) => !c.ok && c.mapId === mapId).map((c) => `[기계 ${c.id}] ${c.detail}`),
        ...critics.flatMap((v) => v.majors.map((m) => `[비평 축${m.axis}${m.x !== undefined ? ` (${m.x},${m.y})${m.w ? ` ${m.w}×${m.h}` : ""}` : ""}] ${m.what}${m.fix ? ` → ${m.fix}` : ""}`)),
        ...critics.filter((v) => v.problem).map((v) => `[비평 미판정] ${v.problem}`),
      ];
      if (problems.length) out.push({ mapId, name: record.spec.name, rounds: record.rounds, problems });
    }
    return out;
  }
}

const text = (value: unknown): PiToolExecResult => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] });

const PLACE_TYPES: PlaceType[] = ["interior", "village", "dungeon", "cave", "street", "house"];
const SIZE = { type: "string", enum: ["small", "medium", "large"] };
const ZONE_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", description: "구역 종류 낱말(카드의 낱말)" },
    purpose: { type: "string", description: "무엇을 위한 곳인지 한 줄" },
    anchors: { type: "array", items: { type: "string" }, description: "이 구역의 주인공 물건 낱말" },
    size: SIZE,
    floor: { type: "number", description: "몇 층(기본 1)" },
    id: { type: "string" },
  },
  required: ["kind"],
};
const HINTS_SCHEMA = {
  type: "object",
  description: "카드가 알려 준 빌더 손잡이만. 모르는 것은 넣지 않는다.",
  properties: {
    variant: { type: "number", description: "같은 명세의 다른 배치(0,1,2…)" },
    seed: { type: "number" },
    dressing: { type: "number", description: "꾸밈 정도 0 보통 · 1 많이 · 2 가득(아늑하게)" },
    houseCount: { type: "number" },
    roofs: { type: "string" },
    water: { type: "string" },
    woods: { type: "string" },
    form: { type: "string" },
    terrain: { type: "string" },
    forestType: { type: "string" },
    walls: { type: "boolean" },
    wallGate: { type: "string" },
    width: { type: "number" },
    height: { type: "number" },
  },
};
const PLACE_SPEC_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: PLACE_TYPES },
    name: { type: "string" },
    style: { type: "string" },
    theme: { type: "string" },
    size: SIZE,
    zones: { type: "array", items: ZONE_SCHEMA },
    features: { type: "array", items: { type: "string" } },
    floors: { type: "number" },
    exits: { type: "array", items: { type: "string", enum: ["south", "north", "east", "west"] } },
    mapId: { type: "string", description: "이미 있는 맵을 그 자리에서 다시 지을 때만" },
    hints: HINTS_SCHEMA,
  },
  required: ["type", "name"],
};
const POINT = { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] };

/** 맵 하나를 사람이 보는 1배 그림으로(모델·비평가 공용). 렌더 경로가 없으면 undefined. */
async function renderMap(env: PiAssistantV2Env, mapId: string): Promise<string | undefined> {
  const map = env.ctx.project.maps[mapId];
  if (!map || !env.render) return undefined;
  try { return await env.render(mapId, 0, 0, map.width, map.height); } catch { return undefined; }
}

/** 보기 단계: 기계 검사 + 1배 그림 + 독립 비평가(맵마다, 같은 짓기의 다른 맵은 문맥으로). */
async function see(env: PiAssistantV2Env, session: V2Session, task: string, type: PlaceType | "content", mapIds: readonly string[], entrance: PlaceBuildResult["entrance"], critic: boolean): Promise<Seen> {
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

function seenPayload(seen: Seen): Record<string, unknown> {
  return {
    machineChecks: summarizeChecks(seen.checks),
    critic: seen.critics.map((v) => ({ mapId: v.mapId, score: v.score, majors: v.majors, ...(v.problem ? { problem: v.problem } : {}) })),
  };
}

function withImages(payload: unknown, seen: Seen | undefined, maxImages = 2): PiToolExecResult {
  const result = text(payload);
  for (const image of seen?.images.slice(0, maxImages) ?? []) {
    const comma = image.dataUrl.indexOf(",");
    result.content.push({ type: "image", mimeType: "image/png", data: image.dataUrl.slice(comma + 1) });
  }
  return result;
}

/** 쓰기 기록 하나: 시공 재생 단계를 실어 다음 체크포인트가 편집기에서 다시 튼다. */
const recorded = new WeakMap<PiAssistantV2Env, Set<string>>();
function recordWrite(env: PiAssistantV2Env, run: RecordingBuildRun, toolCallId: string, name: string, args: unknown, ok: boolean, summary: string, data?: unknown): void {
  if (!recorded.has(env)) recorded.set(env, new Set());
  recorded.get(env)!.add(toolCallId);
  const logs = run.takeConstructionLogs();
  env.record({ toolCallId, name, args, result: { ok, summary, ...(data !== undefined ? { data } : {}) }, ...(logs.length ? { constructionLogs: logs } : {}) });
}

function nextStep(seen: Seen, rounds: number): string {
  const bad = seen.checks.filter((c) => !c.ok).length + seen.critics.reduce((n, v) => n + v.majors.length, 0);
  if (!bad && !seen.critics.some((v) => v.problem)) return "통과 — 비평 major 0, 기계 검사 통과. 다른 요청 부분이 남았으면 이어서, 아니면 사용자에게 보고한다.";
  if (rounds >= V2_MAX_REPAIR_ROUNDS) return `고치기 상한(${V2_MAX_REPAIR_ROUNDS}바퀴)에 닿았다 — 더 고치지 말고 남은 문제를 사용자에게 그대로 보고한다.`;
  return `문제 ${bad}건 — 고칠 수 있으면 edit_place 패치(구역 더하기·주인공 물건 near 좌표·크기·variant·dressing)로 한 번에 고친다(남은 바퀴 ${V2_MAX_REPAIR_ROUNDS - rounds}). 패치로 못 고치는 것(그림이 없는 물건 등)은 보고에 적는다.`;
}

/** 빌더 기록이 없는 손 도트 실내(이전 실행이나 사람이 layout 으로 지은 방)를 같은 방 구성으로 다시 지어 기록을 만든다. */
function adoptInterior(run: RecordingBuildRun, mapId: string): PlaceRecord | undefined {
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
  zones = [...zones, ...(patch.addZones ?? []).map((z) => (floor > 1 && !z.floor ? { ...z, floor } : z))];
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
  const hints = { ...(spec.hints ?? {}), ...(patch.set?.hints ?? {}),
    ...(patch.variant !== undefined ? { variant: patch.variant } : {}), ...(patch.seed !== undefined ? { seed: patch.seed } : {}), ...(patch.dressing !== undefined ? { dressing: patch.dressing } : {}) };
  return { ...spec, ...(patch.set ?? {}), type: spec.type, ...(zones.length ? { zones } : {}), ...(features.length ? { features } : {}), hints };
}

export function createV2Tools(env: PiAssistantV2Env, session: V2Session): PiToolShape[] {
  const task = env.request.task;
  const run = createBuildRun(env.ctx);

  const problemCount = (seen: Seen | undefined, mapIds: readonly string[]) => !seen ? Infinity
    : seen.checks.filter((c) => !c.ok && mapIds.includes(c.mapId)).length + seen.critics.filter((v) => mapIds.includes(v.mapId)).reduce((n, v) => n + v.majors.length, 0);
  const finishPlace = async (toolCallId: string, verb: string, args: unknown, spec: PlaceSpec, builderId: string, built: PlaceBuildResult, rounds: number,
    before?: { project: typeof env.ctx.project; record: PlaceRecord; seen: Map<string, Seen> }): Promise<PiToolExecResult> => {
    let result = built;
    recordWrite(env, run, toolCallId, verb, args, result.ok, result.summary, { mapIds: result.mapIds });
    for (const m of result.missingArt) session.missingArt.add(m);
    if (!result.ok) return text({ ok: false, summary: result.summary, warnings: result.warnings, missingArt: result.missingArt, next: "명세를 바꿔 다시 하거나(다른 type·style), 할 수 없으면 사용자에게 그대로 알린다." });
    if (spec.type !== "interior" && spec.type !== "house") {
      const fixed = fixPlayerStart(env.ctx.project, result.mapIds);
      if (fixed.note) { env.ctx.project = fixed.project; result = { ...result, warnings: [...result.warnings, fixed.note], ...(result.entrance && result.entrance.mapId === fixed.project.startMapId ? { entrance: { mapId: fixed.project.startMapId, x: fixed.project.startPos.x, y: fixed.project.startPos.y } } : {}) }; }
    }
    const record: PlaceRecord = { builder: builderId, spec, result, rounds };
    for (const mapId of result.mapIds) session.places.set(mapId, record);
    // 다시 짓기로 사라진 층(새 id 로 바뀐 위층)은 기록·검사에서 뺀다 — 남겨 두면 없는 맵의 옛 major 를 「남은 문제」로 들고 다닌다.
    for (const mapId of [...session.places.keys()]) if (!env.ctx.project.maps[mapId]) { session.places.delete(mapId); session.seen.delete(mapId); }
    // 첫 짓기를 비평 전에 편집기에 싣는다 — 사용자는 비평을 기다리지 않고 지어지는 것을 본다.
    await env.checkpoint(verb);
    const seen0 = await see(env, session, task, spec.type, result.mapIds, result.entrance, true);
    // 요청한 주인공 물건이 못 놓였거나 밀려났으면 기계 실패로 센다 — 되돌리기·끝맺음 관문이 이것을 본다(「큰 망원경」이 빠진 채 끝났다).
    const anchorFails: MachineCheck[] = result.missingArt.filter((m) => /놓을 빈 자리가 없다|최종 맵에 없다/u.test(m)).map((m) => ({ id: "anchor-missing", mapId: result.mapIds[0]!, ok: false, detail: m }));
    const seen: Seen = anchorFails.length ? { ...seen0, checks: [...seen0.checks, ...anchorFails] } : seen0;
    for (const mapId of result.mapIds) session.seen.set(mapId, seen);
    // 고친 결과가 앞보다 나쁘면(기계 실패 + 비평 major 가 늘면) 앞 상태로 되돌린다 — 천문대 고치기가 방을 하나 더 붙여 맨바닥 52% 가 됐다(2026-10-23 v2 실조수).
    if (before) {
      const oldIds = before.record.result.mapIds;
      const was = problemCount(before.seen.get(oldIds[0]!), oldIds), now = problemCount(seen, result.mapIds);
      if (now > was) {
        env.ctx.project = before.project;
        for (const mapId of result.mapIds) { session.places.delete(mapId); session.seen.delete(mapId); }
        const kept: PlaceRecord = { ...before.record, rounds };
        for (const mapId of oldIds) { session.places.set(mapId, kept); const old = before.seen.get(mapId); if (old) session.seen.set(mapId, old); }
        env.record({ toolCallId, name: verb, args, result: { ok: false, summary: `고친 결과가 더 나빠(문제 ${was}→${now}) 되돌렸다` } });
        await env.checkpoint(`${verb}-revert`);
        return withImages({ ok: false, reverted: true, summary: `고친 결과의 문제(${now})가 앞(${was})보다 많아 앞 상태로 되돌렸다 — 이 패치는 버렸다.`, triedResult: { ...seenPayload(seen), summary: result.summary.slice(0, 300) }, round: rounds,
          next: rounds >= V2_MAX_REPAIR_ROUNDS ? "고치기 상한 — 남은 문제를 보고한다." : "다른 패치(더 작은 변화)를 한 번 더 시도하거나, 남은 문제를 보고한다." }, before.seen.get(oldIds[0]!));
      }
    }
    return withImages({ ok: true, mapIds: result.mapIds, summary: result.summary, warnings: result.warnings, missingArt: result.missingArt, ...seenPayload(seen), round: rounds, next: nextStep(seen, rounds) }, seen);
  };

  const finishContent = async (toolCallId: string, verb: string, args: unknown, result: ContentBuildResult): Promise<PiToolExecResult> => {
    recordWrite(env, run, toolCallId, verb, args, result.ok, result.summary, result.card !== undefined ? result.card : { eventIds: result.eventIds });
    session.content.push({ verb, result });
    for (const m of result.missingArt) session.missingArt.add(m);
    if (result.ok) await env.checkpoint(verb);
    const mapIds = result.mapIds.length ? result.mapIds : [];
    const stage = (result as EventBuildResult).stage;
    // 컷신: 끝 그림 한 장이 아니라 장면을 따라 그린 틀 여러 장 + 무대 검사(걸음 길이·도착·대사 거리) + 연출 비평가.
    if (result.ok && stage) {
      const map = env.ctx.project.maps[stage.mapId];
      const frames: { label: string; image: string; crop: { x: number; y: number; w: number; h: number } }[] = [];
      if (map && env.render) {
        for (const frame of pickStageFrames(stage, 5)) {
          const { project: framed, crop } = stageFrameProject(env.ctx.project, stage, frame);
          const saved = env.ctx.project;
          try {
            env.ctx.project = framed; // render 는 그 순간의 ctx.project 를 그린다
            frames.push({ label: frame.label, image: await env.render(stage.mapId, crop.x, crop.y, crop.w, crop.h), crop });
          } catch { /* 그림 경로 없음 */ } finally { env.ctx.project = saved; }
        }
      }
      const critics: CriticVerdict[] = [];
      if (map && frames.length) {
        env.emit({ type: "execution_status", name: "v2.critic", ok: true, summary: `다른 눈(연출 비평가)이 컷신 장면 ${frames.length}장을 보는 중` });
        const notes = [
          ...(stage.letterbox ? ["the scene starts by sliding in cinematic letterbox bars and removes them at the end"] : []),
          ...stage.walks.map((w) => `${w.who} walks ${w.steps} cells from (${w.from.x},${w.from.y}) to (${w.goal.x},${w.goal.y})${w.onRoad ? `, ${w.onRoad} of them on road tiles` : ""}`),
          "after walking up, the two characters turn to face each other; each spoken line is shown in a dialogue box with the speaker's portrait",
        ];
        try {
          const ran = await critiqueStaging({ task, map: { id: map.id, name: map.name }, frames, notes, sideChat: env.sideChat, ...(env.signal ? { signal: env.signal } : {}) });
          session.criticCalls++; session.criticMs += ran.ms;
          critics.push(ran.verdict);
        } catch (error) {
          critics.push({ mapId: map.id, majors: [], problem: `연출 비평 호출 실패: ${error instanceof Error ? error.message : String(error)}` });
        }
      }
      const seen = mapIds.length ? await see(env, session, task, "content", mapIds, undefined, false) : undefined;
      const npcProblems = seen?.checks.filter((c) => !c.ok && (c.id === "npc-reachable" || c.id.startsWith("exit"))) ?? [];
      const stageBad = stage.checks.filter((c) => !c.ok);
      const majors = critics.reduce((n, v) => n + v.majors.length, 0);
      const rounds = session.content.filter((c) => c.verb === verb && (c.result as EventBuildResult).stage?.mapId === stage.mapId).length;
      const clean = !stageBad.length && !npcProblems.length && !majors && !critics.some((v) => v.problem);
      const payload = {
        ok: true, summary: result.summary, warnings: result.warnings, missingArt: result.missingArt, eventIds: result.eventIds,
        machineChecks: [...stage.checks.map((c) => `[${c.id}] ${c.ok ? "통과" : "문제"} — ${c.detail}`), ...(npcProblems.length ? npcProblems.map((c) => c.detail) : ["사람·출입 검사 통과"])],
        critic: critics.map((v) => ({ mapId: v.mapId, score: v.score, majors: v.majors, ...(v.problem ? { problem: v.problem } : {}) })),
        round: rounds,
        next: clean ? "통과 — 무대 검사·연출 비평 major 0. 다른 요청 부분이 남았으면 이어서, 아니면 보고한다."
          : rounds >= V2_MAX_REPAIR_ROUNDS ? `고치기 상한(${V2_MAX_REPAIR_ROUNDS}번)에 닿았다 — 남은 문제를 보고한다.`
          : "문제가 있다 — add_event 를 같은 kind·when 으로 다시 부르면 앞 컷신(과 그 컷신이 세운 사람)을 바꾼다(겹쳐 쌓이지 않는다). 걷는 곳 낱말·appear where·비트 순서를 고쳐 한 번에 다시 부른다. 칸 좌표는 비평이 짚은 칸이 꼭 필요할 때만.",
      };
      const shots: Seen = { checks: [...stage.checks], critics, images: frames.map((f) => ({ mapId: stage.mapId, dataUrl: f.image })) };
      return withImages(payload, shots.images.length ? shots : seen, 3);
    }
    const seen = mapIds.length ? await see(env, session, task, "content", mapIds, undefined, false) : undefined;
    const npcProblems = seen?.checks.filter((c) => !c.ok && (c.id === "npc-reachable" || c.id.startsWith("exit"))) ?? [];
    return withImages({ ok: result.ok, summary: result.summary, warnings: result.warnings, missingArt: result.missingArt, eventIds: result.eventIds,
      ...(seen ? { machineChecks: npcProblems.length ? npcProblems.map((c) => c.detail) : "사람·출입 검사 통과" } : {}),
      next: result.ok ? (npcProblems.length ? "where 낱말이나 at 칸을 바꿔 다시 부른다." : "통과.")
        : /이미 (칩셋에 )?있다/u.test(result.summary) ? "칩셋에 이름이 비슷한 물건이 있다 — inspect 그림이나 이름으로 보아 요청과 같은 물건이면 그 id 를 place_object 로 놓고, 요청과 다른 물건(재질·장치가 다름)이면 draw_object 에 notThese:[그 id 들] 을 넣어 다시 부른다(새로 그린다). 이름만 바꿔 다시 부르지 않는다."
        : "명세를 고쳐 다시 부르거나 못 하는 것을 보고한다." }, seen, 1);
  };

  const makePlace: PiToolShape = {
    name: "make_place", label: "장소 짓기", concurrency: "exclusive",
    description: "장소(실내·마을·던전·동굴·거리·집)를 명세 하나로 짓는다. 칸·좌표·타일 번호는 쓰지 않는다 — 함수가 짓고, 1배 그림·기계 검사·독립 비평 결과를 돌려준다.",
    parameters: { type: "object", properties: { spec: PLACE_SPEC_SCHEMA }, required: ["spec"] },
    async execute(id, params) {
      const spec = (params as { spec: PlaceSpec }).spec;
      const builder = builderFor(spec);
      if (!builder) {
        session.missingArt.add(`${spec.name}(${spec.type}${spec.style ? `·${spec.style}` : ""}) — 이 종류를 짓는 빌더가 없다`);
        return text({ ok: false, summary: `${spec.type}${spec.style ? `(${spec.style})` : ""} 을 짓는 빌더가 없다. 다른 type 으로 바꾸거나 사용자에게 못 한다고 알린다.` });
      }
      env.emit({ type: "execution_status", name: "v2.build", ok: true, summary: `${spec.name} 짓는 중(${builder.id})` });
      await builder.prepare?.(spec);
      const result = builder.build(run, spec);
      return finishPlace(id, "make_place", params, spec, builder.id, result, 0);
    },
  };

  const editPlace: PiToolShape = {
    name: "edit_place", label: "장소 고치기", concurrency: "exclusive",
    description: "지은(또는 이미 있는) 장소의 명세 일부만 바꿔 같은 빌더로 다시 짓는다. 비평 major 의 좌표는 addAnchors.near 로 넘긴다. 맵당 3바퀴까지.",
    parameters: { type: "object", properties: { patch: { type: "object", properties: {
      mapId: { type: "string", description: "고칠 맵 id(patch 안에)" },
      set: { type: "object", properties: { name: { type: "string" }, style: { type: "string" }, theme: { type: "string" }, size: SIZE, floors: { type: "number" }, features: { type: "array", items: { type: "string" } }, exits: { type: "array", items: { type: "string", enum: ["south", "north", "east", "west"] } }, hints: HINTS_SCHEMA } },
      addZones: { type: "array", items: ZONE_SCHEMA },
      removeZones: { type: "array", items: { type: "string" } },
      addAnchors: { type: "array", items: { type: "object", properties: { zone: { type: "string" }, what: { type: "string" }, near: POINT }, required: ["what"] } },
      addFeatures: { type: "array", items: { type: "string" } },
      removeFeatures: { type: "array", items: { type: "string" } },
      variant: { type: "number" }, seed: { type: "number" }, dressing: { type: "number" },
    }, required: ["mapId"] } }, required: ["patch"] },
    async execute(id, params) {
      const raw = params as { patch: PlacePatch; mapId?: string };
      // 모델이 mapId 를 patch 바깥에 두기도 한다(2026-10-23 실조수) — 둘 다 받는다.
      const patch: PlacePatch = { ...raw.patch, mapId: raw.patch?.mapId ?? raw.mapId ?? env.ctx.currentMapId ?? "" };
      let record = session.places.get(patch.mapId);
      // 이미 있는 방(이 실행이 짓지 않은 방)의 「아늑하게·물건 더하기·뒷문」은 다시 짓지 않고 덧찍는다 — 다시 지으면 원래 바닥·가구가 바뀐다(2026-10-23 비교).
      const doorWord = /뒷문|출입문|back ?door|^문$|^door$/iu;
      const north = (patch.set?.exits ?? []).includes("north") || (patch.addAnchors ?? []).some((a) => doorWord.test(a.what.trim()));
      const stampOnly = !patch.addZones?.length && !patch.removeZones?.length && patch.variant === undefined && patch.seed === undefined && !patch.addFeatures?.length && !patch.removeFeatures?.length
        && Object.keys(patch.set ?? {}).every((k) => k === "exits");
      const prevStamp = record?.result.state as StampEditState | undefined;
      const existing = env.ctx.project.maps[patch.mapId];
      const layoutRoom = !!existing && !!roomSpecOf(env.ctx.project.tilesets[existing.tilesetId]) && (existing.locations ?? []).some((l) => (l.tags ?? []).includes(HAND_LAYOUT_ROOM_TAG));
      const prevAdoptedState = (record?.result.state as { adopted?: unknown } | undefined)?.adopted;
      if ((!record || prevStamp?.stampEdit || prevAdoptedState) && stampOnly && layoutRoom) {
        const rounds = record?.rounds ?? 0;
        if (rounds >= V2_MAX_REPAIR_ROUNDS) return text({ ok: false, summary: `고치기 상한(${V2_MAX_REPAIR_ROUNDS}바퀴)에 닿았다. 남은 문제를 사용자에게 보고한다.` });
        const spec: PlaceSpec = { ...(record?.spec ?? { type: "interior", name: existing!.name, mapId: patch.mapId }), ...(north ? { exits: ["south", "north"] as const } : {}) };
        env.emit({ type: "execution_status", name: "v2.repair", ok: true, summary: `${spec.name} 덧찍어 고치는 중(${rounds + 1}바퀴)` });
        const before = record ? { project: env.ctx.project, record, seen: new Map(record.result.mapIds.map((m) => [m, session.seen.get(m)!] as const).filter(([, v]) => !!v)) } : undefined;
        const editReq = { dressing: patch.dressing ?? 0, adds: (patch.addAnchors ?? []).filter((a) => !doorWord.test(a.what.trim())), north };
        // 원래 방을 «똑같이» 다시 지을 인자를 찾으면 그 인자에서 고친다(가구 비키기·뒷문 자리 만들기가 된다). 못 찾으면 덧찍기.
        const prevAdopted = (record?.result.state as { adopted?: Parameters<typeof interiorEditFromArgs>[2] } | undefined)?.adopted;
        const exact = prevAdopted ?? (prevStamp?.stampEdit ? undefined : adoptExactInterior(run, patch.mapId));
        const result = exact
          ? interiorEditFromArgs(run, spec, exact, editReq, prevAdopted ? record!.result.state as never : undefined)
          : interiorStampEdit(run, spec, patch.mapId, { ...editReq, north: north && !prevStamp?.backMapId }, prevStamp);
        return finishPlace(id, "edit_place", params, spec, interiorBuilder.id, result, rounds + 1, before?.seen.size ? before : undefined);
      }
      if (prevStamp?.stampEdit || prevAdoptedState) record = undefined;
      if (!record) {
        record = adoptInterior(run, patch.mapId);
        if (record) for (const mapId of record.result.mapIds) session.places.set(mapId, record);
      }
      if (!record) return text({ ok: false, summary: `${patch.mapId} 는 v2 가 지은 기록이 없고 다시 지을 방 구성도 읽지 못했다. make_place(spec.mapId=${patch.mapId}) 로 그 자리에 새로 짓거나 못 한다고 알린다.` });
      if (record.rounds >= V2_MAX_REPAIR_ROUNDS) return text({ ok: false, summary: `고치기 상한(${V2_MAX_REPAIR_ROUNDS}바퀴)에 닿았다. 남은 문제를 사용자에게 보고한다.` });
      const builder = builderFor(record.spec)!;
      // 마을·던전·거리 빌더는 소품 하나하나·꾸밈 정도를 받지 않는다 — 그런 패치로 다시 지으면 같은 맵이 또 나오고 바퀴만 쓴다(2026-10-23 v2 실조수).
      if (builder.id !== interiorBuilder.id) {
        const effective = !!(patch.set || patch.variant !== undefined || patch.seed !== undefined || patch.addFeatures?.length || patch.removeFeatures?.length || patch.addZones?.length || patch.removeZones?.length
          || (patch.addAnchors ?? []).some((a) => /적|몬스터|박쥐|해골|거미|고블린|슬라임|늑대|좀비|유령|enem|monster|bat|skeleton|spider|goblin|slime|wolf|zombie|ghost|상자|chest|보스|boss|레버|lever|광장|plaza|우물|well|밭|field|자판기|vending|공원|park/iu.test(a.what)));
        if (!effective) {
          // 거절도 한 바퀴로 센다 — 바퀴를 안 쓰면 모델이 같은 거절을 열 번 넘게 되풀이했다(2026-10-23 3차 피라미드: edit_place 13번 중 12번 거절).
          const spent = { ...record, rounds: record.rounds + 1 };
          for (const mapId of record.result.mapIds) session.places.set(mapId, spent);
          const left = V2_MAX_REPAIR_ROUNDS - spent.rounds;
          return text({ ok: false, summary: `${builder.id} 빌더는 소품 하나하나·꾸밈(dressing)·단상·석관 같은 물건 지정을 받지 않는다 — 고칠 수 있는 것은 variant(다른 배치)·features·size·floors 뿐이다. 이 거절도 한 바퀴로 셌다(남은 바퀴 ${Math.max(0, left)}).${left <= 0 ? " 더 고치지 말고 남은 major 를 사용자에게 그대로 보고한다." : " 그 넷으로 못 고치는 major 는 고치려 하지 말고 보고에 적는다."}` });
        }
      }
      const floor = Math.max(1, record.result.mapIds.indexOf(patch.mapId) + 1);
      const onlyAnchors = floor === 1 && !!patch.addAnchors?.length && !patch.set && !patch.addZones?.length && !patch.removeZones?.length && !patch.addFeatures?.length && !patch.removeFeatures?.length && patch.variant === undefined && patch.seed === undefined && patch.dressing === undefined;
      const spec = applyPatch(record.spec, patch, floor);
      env.emit({ type: "execution_status", name: "v2.repair", ok: true, summary: `${spec.name} 고치는 중(${record.rounds + 1}바퀴)` });
      const before = { project: env.ctx.project, record, seen: new Map(record.result.mapIds.map((m) => [m, session.seen.get(m)!] as const).filter(([, v]) => !!v)) };
      const result = onlyAnchors && builder.id === interiorBuilder.id ? interiorAddAnchors(run, record, patch.addAnchors!) : builder.build(run, spec, record);
      return finishPlace(id, "edit_place", params, spec, builder.id, result, record.rounds + 1, before.seen.size ? before : undefined);
    },
  };

  const addPeople: PiToolShape = {
    name: "add_people", label: "사람 두기", concurrency: "exclusive",
    description: "NPC 를 명세로 둔다(역할·자리 낱말·외형 낱말·대사). 함수가 걸어서 닿는 칸을 고르고 첫 대화/다음 대화 쪽을 만든다.",
    parameters: { type: "object", properties: {
      mapId: { type: "string" },
      people: { type: "array", items: { type: "object", properties: {
        role: { type: "string" }, name: { type: "string" }, where: { type: "string" }, at: POINT, mapId: { type: "string" }, looks: { type: "string" },
        firstTalk: { type: "array", items: { type: "string" } }, laterTalk: { type: "array", items: { type: "string" } },
        movement: { type: "string", enum: ["still", "wander", "patrol"] },
      }, required: ["role"] } },
    }, required: ["people"] },
    async execute(id, params) {
      const p = params as { people: PersonSpec[]; mapId?: string };
      const result = buildPeople(run, p.people, p.mapId ?? env.ctx.currentMapId);
      return finishContent(id, "add_people", params, result);
    },
  };

  const addEvent: PiToolShape = {
    name: "add_event", label: "사건·컷신", concurrency: "exclusive",
    description: "컷신·대화 사건을 비트 목록으로 만든다(walk/say/appear/face/wait/fade). 함수가 걸을 수 있는 길·자리를 정하고 미리보기 탐침으로 검사한다.",
    parameters: { type: "object", properties: { event: { type: "object", properties: {
      kind: { type: "string", enum: ["cutscene", "talk", "trigger"] }, mapId: { type: "string" },
      when: { type: "string", enum: ["game-start", "touch", "talk"] }, where: { type: "string" }, at: POINT,
      beats: { type: "array", items: { type: "object", properties: {
        do: { type: "string", enum: ["walk", "say", "appear", "face", "wait", "fade"] },
        who: { type: "string" }, to: { type: "string", description: "자리 낱말(또는 'x,y')" }, text: { type: "string" },
        where: { type: "string" }, looks: { type: "string" }, toward: { type: "string" }, ms: { type: "number" }, dir: { type: "string", enum: ["in", "out"] },
      }, required: ["do"] } },
    }, required: ["kind", "beats"] } }, required: ["event"] },
    async execute(id, params) {
      const event = (params as { event: EventSpec }).event;
      const beats = event.beats.map((b) => {
        const raw = b as unknown as Record<string, unknown>;
        const asPoint = (v: unknown) => typeof v === "string" && /^\s*\d+\s*,\s*\d+\s*$/u.test(v) ? { x: Number(v.split(",")[0]), y: Number(v.split(",")[1]) } : v;
        return { ...raw, ...(raw.to !== undefined ? { to: asPoint(raw.to) } : {}), ...(raw.where !== undefined ? { where: asPoint(raw.where) } : {}) } as unknown as EventSpec["beats"][number];
      });
      const result = buildEvent(run, { ...event, ...(event.mapId || !env.ctx.currentMapId ? {} : { mapId: env.ctx.currentMapId }), beats });
      return finishContent(id, "add_event", params, result);
    },
  };

  const addScene: PiToolShape = {
    name: "add_scene", label: "두 선택 대화 장면", concurrency: "exclusive",
    description: "상대 한 명과의 짧은 대화 장면 — 도입 대사, 선택지 두 개와 선택별 반응, 다시 말 걸면 하는 말. 확정 연애 기획이 있으면 그 계약대로 쓰고, 함수가 짝 얼굴 그림으로 세워 두 선택을 실제 런타임으로 검사한다.",
    parameters: { type: "object", properties: { scene: SCENE_SCHEMA }, required: ["scene"] },
    async execute(id, params) {
      const scene = (params as { scene: SceneSpec }).scene;
      return finishContent(id, "add_scene", params, buildScene(run, { ...scene, ...(scene.mapId || !env.ctx.currentMapId ? {} : { mapId: env.ctx.currentMapId }) }));
    },
  };

  const drawObjectVerb: PiToolShape = {
    name: "draw_object", label: "없는 물건 그리기", concurrency: "exclusive",
    description: "칩셋에 없는 물건을 공방 원클릭 그리기 경로로 맡긴다. 결과의 summary 가 놓였는지·대기인지를 정직하게 말한다.",
    parameters: { type: "object", properties: { object: { type: "object", properties: {
      what: { type: "string" }, description: { type: "string" }, mapId: { type: "string" }, where: { type: "string" }, at: POINT,
      notThese: { type: "array", items: { type: "string" }, description: "「이미 있다」로 거부됐지만 그 그림이 요청과 다른 물건일 때 그 id 들" },
    }, required: ["what"] } }, required: ["object"] },
    async execute(id, params) {
      const object = (params as { object: ObjectSpec }).object;
      const result: DrawObjectResult = drawObject(run, { ...object, ...(object.mapId || !env.ctx.currentMapId ? {} : { mapId: env.ctx.currentMapId }) });
      // 미리 정한 자리·크기를 기억한다 — 그림이 끝난 뒤 place_object 가 where·at 없이 불리면 이 자리에 놓는다.
      if (result.ok && result.plan) rememberObjectPlan(session, result.plan);
      return finishContent(id, "draw_object", params, result);
    },
  };

  const placeObject: PiToolShape = {
    name: "place_object", label: "그린 물건 놓기", concurrency: "exclusive",
    description: "공방에서 그려 칩셋에 넣은 물건(objectId)을 맵에 놓는다. 자리는 낱말(where) 또는 비평·후속 지시가 준 칸(at). 막히면 함수가 가까운 빈 바닥으로 옮긴다.",
    parameters: { type: "object", properties: { mapId: { type: "string" }, objectId: { type: "string" }, where: { type: "string" }, at: POINT }, required: ["mapId", "objectId"] },
    async execute(id, params) {
      const p = params as { mapId: string; objectId: string; where?: string; at?: { x: number; y: number } };
      const map = findMap(env.ctx.project, p.mapId);
      if (!map) return text({ ok: false, summary: `맵 ${p.mapId} 이 없다` });
      // where·at 이 없으면 draw_object 가 크기에 맞춰 미리 정한 자리(있으면).
      const plan = !p.where && !p.at ? takeObjectPlan(session, p.mapId, p.objectId) : undefined;
      const first = plan ? plan.base : p.at && !p.where ? p.at : resolveWhere(env.ctx.project, map, p.where, p.at ? { at: p.at } : {}).cell;
      const tried: string[] = [];
      let placed: { ok: boolean; summary: string } | undefined;
      for (let r = 0; r <= 3 && !placed?.ok; r++) for (let dy = -r; dy <= r && !placed?.ok; dy++) for (let dx = -r; dx <= r && !placed?.ok; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const base = { x: first.x + dx, y: first.y + dy };
        const res = run.call("stamp_tileset_object", { mapId: p.mapId, objectId: p.objectId, base });
        tried.push(`(${base.x},${base.y})`);
        if (res.ok) placed = { ok: true, summary: `${p.objectId} 를 (${base.x},${base.y})에 놓았다${plan && !r ? ` — draw_object 가 미리 정한 자리${plan.how ? `(${plan.how})` : ""}` : ""}${r ? ` — 처음 자리 (${first.x},${first.y})가 막혀 옮겼다` : ""}` };
        else placed = { ok: false, summary: String(res.summary).slice(0, 200) };
      }
      return finishContent(id, "place_object", params, { ok: !!placed?.ok, mapIds: [p.mapId], summary: placed?.ok ? placed.summary : `놓지 못했다(${tried.length}자리 시도): ${placed?.summary ?? ""}`, warnings: [], missingArt: placed?.ok ? [] : [`${p.objectId} — 놓을 자리가 없다`], calls: [] });
    },
  };

  const inspect: PiToolShape = {
    name: "inspect", label: "맵 보기", concurrency: "shared",
    description: "맵 하나의 1배 그림·기계 검사·사람/이벤트 목록을 본다(비평가 없이). 고치기 전에 지금 상태를 확인할 때.",
    parameters: { type: "object", properties: { mapId: { type: "string" } } },
    async execute(_id, params) {
      const mapId = (params as { mapId?: string }).mapId ?? env.ctx.currentMapId ?? env.ctx.project.startMapId;
      const map = env.ctx.project.maps[mapId];
      if (!map) return text({ ok: false, summary: `맵 ${mapId} 이 없다` });
      const seen = await see(env, session, task, "content", [mapId], undefined, false);
      const events = (map.events ?? []).slice(0, 30).map((e) => `${e.id} ${e.name ?? ""}(${e.x},${e.y})`);
      return withImages({ ok: true, map: { id: map.id, name: map.name, tileset: map.tilesetId, size: `${map.width}×${map.height}` }, record: session.places.get(mapId)?.spec, machineChecks: summarizeChecks(seen.checks), events }, seen, 1);
    },
  };

  const askUser: PiToolShape = {
    name: "ask_user", label: "사용자에게 묻기", concurrency: "shared",
    description: "요청이 정말 둘 이상으로 갈리고 잘못 고르면 다시 지어야 할 때만 묻는다. 부른 뒤에는 짓지 말고 질문으로 턴을 끝낸다.",
    parameters: { type: "object", properties: { question: { type: "string" }, choices: { type: "array", items: { type: "string" } } }, required: ["question"] },
    async execute(_id, params) {
      const p = params as { question: string; choices?: string[] };
      session.questions.push(p.question);
      return text({ ok: true, summary: "질문을 기록했다. 지금 응답 끝에 이 질문(과 고를 거리)을 그대로 쓰고 턴을 끝낸다.", question: p.question, choices: p.choices ?? [] });
    },
  };

  // 기록 없이 끝난 실패(빌더 없음·맵 없음·상한)와 예외도 tool_end 에 ok:false·이유가 실리게 한다 — 안 그러면 편집기에 빈 「성공」 줄이 남는다.
  const guard = (tool: PiToolShape): PiToolShape => ({ ...tool, async execute(id, params, signal) {
    let result: PiToolExecResult;
    try { result = await tool.execute(id, params, signal); }
    catch (error) { result = text({ ok: false, summary: `${tool.name} 실패: ${error instanceof Error ? error.message : String(error)}` }); }
    if (!recorded.get(env)?.has(id)) {
      const first = result.content.find((c) => c.type === "text") as { text: string } | undefined;
      let parsed: { ok?: boolean; summary?: string } = {};
      try { parsed = first ? JSON.parse(first.text) as { ok?: boolean; summary?: string } : {}; } catch { /* 글 */ }
      env.record({ toolCallId: id, name: tool.name, args: params, result: { ok: parsed.ok !== false, summary: String(parsed.summary ?? (parsed.ok === false ? "실패" : `${tool.label} 완료`)) } });
    }
    return result;
  } });
  return [makePlace, editPlace, addPeople, addEvent, addScene, drawObjectVerb, placeObject, inspect, askUser].map(guard);
}

/** 끝맺음 관문 — 남은 문제가 있으면 한 번 더 돌게 하는 글. 다 통과면 undefined. */
export function v2FinishGate(session: V2Session): string | undefined {
  if (session.questions.length) return undefined;
  const open = session.unresolved();
  const missing = [...session.missingArt];
  const fixable = open.filter((o) => o.rounds < V2_MAX_REPAIR_ROUNDS);
  // 고칠 것이 없으면 한 바퀴를 더 쓰지 않는다 — 남은 문제·「그림 없음」은 동사 결과가 이미 보고하라고 일렀다.
  if (!fixable.length) return undefined;
  return [
    "[v2 끝맺음 관문] 「다 됐다」고 말하기 전에:",
    ...(fixable.length ? [`아직 고칠 수 있는 장소 ${fixable.length}곳 — edit_place 로 고친다:`, ...fixable.map((o) => `- ${o.name}(${o.mapId}, ${o.rounds}바퀴): ${o.problems.slice(0, 5).join(" / ")}`)] : []),
    ...(open.length > fixable.length ? ["고치기 상한에 닿은 장소의 남은 문제는 사용자 보고에 그대로 적는다:", ...open.filter((o) => o.rounds >= V2_MAX_REPAIR_ROUNDS).map((o) => `- ${o.name}: ${o.problems.slice(0, 4).join(" / ")}`)] : []),
    ...(missing.length ? [`그림·부품이 없어 못 한 것(보고에 반드시 적는다, 대체물로 지어내지 않는다): ${missing.join(" / ")}`] : []),
    "고칠 것을 고친 뒤(또는 고칠 수 없으면 바로) 사용자에게 짧게 보고한다: 지은 것, 통과 여부, 못 한 것.",
  ].join("\n");
}
