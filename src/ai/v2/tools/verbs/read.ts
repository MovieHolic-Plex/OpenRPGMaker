// 읽기·묻기 동사 — read_specs · room_parts · inspect · restore_event · ask_user · ask_helpers.
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import { PLACE_SPEC_KINDS } from "../../prompt/placeSpecs";
import { HAND_INTERIOR_TILESET_ID } from "@/editor/handInterior/builder";
import { createBuildRun } from "../../buildRun";
import { builderFor } from "../../place/builders";
import { summarizeChecks } from "../../checks";
import type { PlaceSpec } from "../../types";
import { HELPER_LIMITS, runHelperJobs, type HelperJob } from "../../helpers";
import { restoreEventFromBefore } from "../../story/restoreEvent";
import { roomParts, SHAPE_EXAMPLES } from "../../place/roomParts";
import { ROOM_IDEA_RULE, roomIdeasFor } from "../../place/roomIdeas";
import { text, see, withImages } from "../support";
import type { VerbContext } from "../context";

/** createV2Tools 에서 뗀 것 — readSpecs · refPictures · roomPartsVerb · inspect · restoreEvent · askUser · askHelpers. (readVerbs) */
export function readVerbs(c: VerbContext) {
  const { env, session, task, showSpecs, withSpecText } = c;
  const readSpecs: PiToolShape = {
    name: "read_specs", label: "장소 카드 읽기", concurrency: "shared",
    description: "Read the specs for building places (they are not in your prompt). interior = inns, shops, studies, jails, houses inside (with the interior chipset catalog); village; dungeon (also caves); street (modern Japan/Korea streets and houses); people (NPCs); draw_object. Read the kinds you will build, once, before the first build call of that kind.",
    parameters: { type: "object", properties: { names: { type: "array", items: { type: "string", enum: [...PLACE_SPEC_KINDS, "all"] } } }, required: ["names"], additionalProperties: false },
    async execute(_id, params) {
      const asked = ((params as { names?: unknown })?.names ?? []) as unknown[];
      const kinds = asked.includes("all") ? [...PLACE_SPEC_KINDS] : PLACE_SPEC_KINDS.filter((k) => asked.includes(k));
      if (!kinds.length) return text({ ok: false, summary: `Pass names from: ${PLACE_SPEC_KINDS.join(", ")} (or all).` });
      return withSpecText({ ok: true, summary: `Specs for ${kinds.join(", ")} follow — use them in your build calls.` }, showSpecs(kinds));
    },
  };
  // ───── room_parts: 방을 직접 설계하기 전에 보는 재료(기물 이름표 + 손 견본 배치 요약·그림). 읽기만 한다 ─────
  const refPictures = new Map<string, string>();
  const roomPartsVerb: PiToolShape = {
    name: "room_parts", label: "방 재료 보기", concurrency: "shared",
    description: "Call before designing a hand-pixel interior room yourself (make_place zones[].design). Returns the chipset part labels for that use (id, size, where it goes), floor/wall/rug ids, a summary of sample layouts for the same use, and reference rooms players liked (structure summaries + a 1x picture: several rooms, stairs, side rooms, one big landmark per room). Borrow structure, not the plan — a plan that matches a reference's room count, sizes and positions is sent back. Compose rooms, connections, groups and spots fresh for the request.",
    parameters: { type: "object", properties: { purpose: { type: "string", description: "room use — e.g. 서재 study, 마법사의 서재 wizard's study, 침실 bedroom" }, query: { type: "string", description: "(optional) more part words to look up" } }, required: ["purpose"] },
    async execute(_id, params) {
      const p = params as { purpose: string; query?: string };
      // 글은 가볍게(기본 slim): 기물 40줄·모양 예 하나 — 2026-10-30 서재 시험에서 결과 글 1.2~1.3만 자 뒤 flash 가 도구 호출을 글로 쓰거나 «I'm having a hard time»으로 멈췄다.
      // 더 필요한 기물은 query 로 다시 묻는다.
      const slim = (env.roomPartsText ?? "slim") === "slim";
      const full = roomParts(env.ctx.project, String(p.purpose ?? ""), p.query, undefined, slim ? 40 : 90);
      if (!full) return text({ ok: false, summary: "손 도트 실내 칩셋이 이 프로젝트에 없다" });
      const plans = roomIdeasFor(`${p.purpose ?? ""} ${p.query ?? ""}`, 3).map((x) => ({ id: x.id, structure: x.idea }));
      const out = slim ? { ...full, references: full.references.slice(0, 2), referenceIds: full.referenceIds.slice(0, 2), shapeExamples: full.shapeExamples.slice(0, 1), more: "Only the 40 part lines that fit this use are shown — call again with words in query to look up more. One shape example as text; the other shapes are in the picture." } : full;
      const result = text({ ok: true, ...out, referenceRooms: plans, how: "One room: zones:[{kind, purpose, design:{shape, corner?, w, h, door, floor, wall, areas?:[{name, purpose, focal, visit}], groups:[{name, area?, at, pos?, rug?, items:[{id, dx?, dy?, count?}]}]}}]. Several rooms (what the reference rooms players liked do — see referenceRooms and the picture): one zone per room, each with id, x, y (rough top-left cell), design (w, h, groups), landmark (one part id from its groups that the room is built around — big multi-cell parts are welcome), optional stairs:\"up\"|\"down\" and role (main · side · corridor); plus connections:[{a, b, type:\"door\"|\"open\"}] and entrance (the southernmost room; the exit is in its south wall). One map can hold several rooms even when the request asks for one place. You choose how many rooms, their sizes, rough positions and connections; the function only snaps neighbours to a one-cell wall, carves the doors and checks reachability, and rejects impossible geometry with a fixed call. Groups are everything placed (the function adds nothing; it fixes only name matching, overlap, chair facing, the aisle in front of doors and reachability). Part coordinates: the floor's top-left is 0,0; hangings use y -2. Wall furniture and hangings stand under the north wall (also under a lowered north wall)." });
      // 그림: 구성 아이디어(사용자가 실내 기준으로 고른 assistant-rooms-2 방 — 동선·초점·묶음만 보고 베끼지 않는다) + 모양 예시(shapeExamples 를 지금 빌더로 지은 것).
      // 옛 사람 견본 그림(견본을 지어 찍은 것)은 더 보여 주지 않는다 — 2026-10-29 감사에서 모델이 그 서재를 그대로 옮겨 방탈출 방이 다 같아졌다.
      // 기본은 한 장으로 합쳐 싣는다(env.roomPartsPictures): 2026-10-30 서재 3d 에서 그림 8장·글 1.3만 자 결과 뒤 Gemini 계열이 짓지 못한 판이 늘었다(인계 handoff-study.md).
      const mode = env.roomPartsPictures ?? "one";
      const panels: { label: string; url: string }[] = [];
      if (mode !== "none" && env.readPublicAsset) for (const idea of roomIdeasFor(`${p.purpose ?? ""} ${p.query ?? ""}`, 3)) {
        const key = `idea:${idea.id}`;
        let url = refPictures.get(key);
        if (!url) { try { url = await env.readPublicAsset(idea.file); } catch { url = undefined; } if (url) refPictures.set(key, url); }
        if (url) panels.push({ label: `reference room ${idea.id}`, url });
      }
      if (mode !== "none" && env.render && out.tileset === HAND_INTERIOR_TILESET_ID) for (const ex of SHAPE_EXAMPLES) {
        const key = `shape:${ex.shape}`;
        let url = refPictures.get(key);
        if (!url) {
          const scratch = { project: env.ctx.project, currentMapId: env.ctx.currentMapId, assistantRun: true } as typeof env.ctx;
          const sp = { name: `모양 예시 ${ex.ko}`, type: "interior", hints: { newMap: true }, zones: ex.zones.map((z) => ({ ...z })) } as unknown as PlaceSpec;
          const built = builderFor(sp)?.build(createBuildRun(scratch), sp);
          const mapId = built?.ok ? built.mapIds[0] : undefined;
          const m = mapId ? scratch.project.maps[mapId] : undefined;
          if (m && mapId) {
            const keep = env.ctx.project;
            try { env.ctx.project = scratch.project; url = await env.render(mapId, 0, 0, m.width, m.height); } catch { url = undefined; } finally { env.ctx.project = keep; }
            if (url) refPictures.set(key, url);
          }
        }
        if (url) panels.push({ label: `shape ${ex.shape} example (built from shapeExamples)`, url });
      }
      const img = (url: string) => ({ type: "image" as const, mimeType: "image/png", data: url.slice(url.indexOf(",") + 1) });
      if (panels.length && mode === "each") for (const x of panels) { result.content.push({ type: "text", text: `${x.label} (1x):` }); result.content.push(img(x.url)); }
      else if (panels.length && mode === "one") {
        const sheet = env.combinePictures ? await env.combinePictures(panels.map((x) => x.url)).catch(() => undefined) : undefined;
        const first = sheet ?? panels[0]!.url;
        const shown = sheet ? panels : panels.slice(0, 1);
        result.content.push({ type: "text", text: `One picture (1x, ${shown.length} panels from the top left): ${shown.map((x, i) => `${i + 1}) ${x.label}`).join(" / ")}. ${ROOM_IDEA_RULE}` });
        result.content.push(img(first));
      }
      return result;
    },
  };
  const inspect: PiToolShape = {
    name: "inspect", label: "맵 보기", concurrency: "shared",
    description: "Look at one map's 1x picture, machine checks and person/event list (no critic). Use it to check the current state before fixing.",
    parameters: { type: "object", properties: { mapId: { type: "string" } } },
    async execute(_id, params) {
      const mapId = (params as { mapId?: string }).mapId ?? env.ctx.currentMapId ?? env.ctx.project.startMapId;
      const map = env.ctx.project.maps[mapId];
      if (!map) return text({ ok: false, summary: `맵 ${mapId} 이 없다` });
      const seen = await see(env, session, task, "content", [mapId], undefined, false);
      const events = (map.events ?? []).slice(0, 30).map((e) => `${e.id} ${e.name ?? ""}(${e.x},${e.y})`);
      return withImages({ ok: true, map: { id: map.id, name: map.name, tileset: map.tilesetId, size: `${map.width}×${map.height}` }, record: session.placeOf(mapId)?.spec, machineChecks: summarizeChecks(seen.checks), events }, seen, 1);
    },
  };
  const restoreEvent: PiToolShape = {
    name: "restore_event", label: "이벤트 되살리기", concurrency: "exclusive",
    description: "Restore an event that existed before this request exactly as it was (pages, conditions, switches, art, original lines) — to undo a deletion or overwrite. Do not rewrite it from memory with upsert_event (names and conditions drift). eventId is an id or a name.",
    parameters: { type: "object", properties: { eventId: { type: "string" }, mapId: { type: "string" } }, required: ["eventId"] },
    async execute(_id, params) {
      const p = params as { eventId: string; mapId?: string };
      const result = restoreEventFromBefore(env.request.project, env.ctx.project, String(p.eventId ?? ""), p.mapId);
      if (result.ok) await env.checkpoint("restore_event");
      return text({ ...result, ...(result.ok ? { next: "get_event 로 읽어 확인하고, 보고에는 「요청 전 그대로 되살렸다」고 쓴다." } : {}) });
    },
  };
  const askUser: PiToolShape = {
    name: "ask_user", label: "사용자에게 묻기", concurrency: "shared",
    description: "Ask only when the request truly splits two or more ways and a wrong pick means rebuilding. After calling, do not build; end the turn with the question.",
    parameters: { type: "object", properties: { question: { type: "string" }, choices: { type: "array", items: { type: "string" } } }, required: ["question"] },
    async execute(_id, params) {
      const p = params as { question: string; choices?: string[] };
      // 아직 아무것도 안 바꿨으면 한 번은 되돌려 보낸다 — 「다리가 없어 어디에?」처럼 고칠 수 있는 빈칸은 가장 그럴듯하게 지어 보고하는 편이 낫다(2026-10-24 g2-toll).
      if (!session.askBounced && JSON.stringify(env.ctx.project.maps) === JSON.stringify(env.request.project.maps) && JSON.stringify(env.ctx.project.database) === JSON.stringify(env.request.project.database)) {
        session.askBounced = true;
        return text({ ok: false, summary: "아직 아무것도 짓지 않았다. 요청이 가리키는 자리·물건이 맵에 없으면 묻지 말고 가장 그럴듯한 자리에 만들어(덧그리기·make_place·add_people) 짓고, 보고에 「~가 없어 ~로 정했다」고 쓴다. 그래도 정말 두 갈래로 갈려 잘못 고르면 다시 지어야 하는 경우에만 다시 ask_user 를 부른다." });
      }
      session.questions.push(p.question);
      return text({ ok: true, summary: "질문을 기록했다. 지금 응답 끝에 이 질문(과 고를 거리)을 그대로 쓰고 턴을 끝낸다.", question: p.question, choices: p.choices ?? [] });
    },
  };
  // 잔일 일꾼 — 주 모델이 계획·검수하고, 틀이 정해진 글 일은 잔일 모델(assistantRoles.smol, 예: Flash)이 나눠 한다. 일꾼은 도구가 없다(읽기·쓰기 없음).
  const askHelpers: PiToolShape = {
    name: "ask_helpers", label: "잔일 맡기기", concurrency: "shared",
    description: `Hand short, fixed-format text jobs to a cheap worker model in bulk (${HELPER_LIMITS.parallel} at a time, at most ${HELPER_LIMITS.jobs}). E.g. draft lines for several NPCs, name candidates, item/skill descriptions, summaries of long scripts, polishing speech style. Workers cannot see the project — put the needed characters, scenes and speech style in context. With fields (+count) it checks and returns JSON with those keys. Results are drafts: check them and put them in yourself with write tools (add_people, add_event, upsert_* etc.). Do not hand off building or fixing maps and events, or anything that needs judgment.`,
    parameters: { type: "object", properties: { jobs: { type: "array", maxItems: HELPER_LIMITS.jobs, items: { type: "object", properties: {
      id: { type: "string", description: "name to tell results apart (e.g. npc_baker)" },
      task: { type: "string", description: "the job in one or two sentences" },
      context: { type: "string", description: "material the worker sees (character notes, scene, speech examples). It cannot see the project, so put everything needed here" },
      fields: { type: "array", items: { type: "string" }, description: "keys to receive as JSON (e.g. [\"speaker\",\"line\"])" },
      count: { type: "integer", description: "how many fields-shaped objects to receive (as an array)" },
    }, required: ["task"] } } }, required: ["jobs"] },
    async execute(_id, params, signal) {
      const jobs = ((params as { jobs?: HelperJob[] }).jobs ?? []).filter(Boolean);
      if (!jobs.length) return text({ ok: false, summary: "jobs 가 비었다" });
      const smol = env.request.assistantRoles?.smol;
      const usable = smol && smol !== "off" && env.roleChat && (smol.provider.startsWith("local-cli:") || env.keyedProviders?.has(smol.provider));
      const chat = usable ? (messages: readonly unknown[], s?: AbortSignal) => env.roleChat!(smol, messages, s) : env.sideChat;
      const model = usable ? `${smol.provider}/${smol.model}` : "주 모델(잔일 칸이 비었거나 그 계정 키가 없음)";
      env.emit({ type: "execution_status", name: "v2.helpers", ok: true, summary: `잔일 ${Math.min(jobs.length, HELPER_LIMITS.jobs)}개를 일꾼(${model})에게 맡기는 중` });
      const results = await runHelperJobs(jobs, chat, signal ?? env.signal);
      const failed = results.filter((r) => !r.ok).length;
      env.emit({ type: "execution_status", name: "v2.helpers", ok: failed === 0, summary: `잔일 ${results.length}개 끝(실패 ${failed}) · ${model}`, data: { model, jobs: results.map((r) => ({ id: r.id, ok: r.ok, ms: r.ms, ...(r.problem ? { problem: r.problem } : {}) })) } });
      return text({ ok: failed < results.length, summary: `잔일 ${results.length}개 중 ${results.length - failed}개 받음${jobs.length > HELPER_LIMITS.jobs ? ` (앞 ${HELPER_LIMITS.jobs}개만)` : ""}`, model, results, next: "초안이다 — 맞는지 보고 쓰기 도구로 직접 넣는다. 실패한 일은 고쳐 다시 맡기거나 직접 쓴다." });
    },
  };
  return { readSpecs, roomPartsVerb, inspect, restoreEvent, askUser, askHelpers };
}
