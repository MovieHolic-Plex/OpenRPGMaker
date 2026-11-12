// 조수 v2 — 모델에게 내놓는 도구 목록을 정한다: 처음부터 싣는 도구(기록에서 실제로 쓴 것) + 필요할 때 싣는 도구(load_tools 또는 이름으로 바로).
//
// 왜 (2026-10-30): 「게임 하나 만들어 줘」 한 턴의 도구 글이 v1 스키마만 91.7k 토큰(o200k)이었고 거의 다 한국어였다. 기록된 실행 467개
// (terra 301 · opus 166, suite/scenes/runs · scenes-duel · runs 의 turns/*.json toolArgs = 모델이 직접 부른 호출)에서
// 호출 0번인 도구가 v1 노출의 절반 토큰(compile_puzzle 8.0k · place_npc 7.4k · upsert_skill 4.9k · upsert_troop_battle_page 3.5k · create_quest 2.6k …)이었다.
// 하는 일 (v2 경로만 — v1·편집기 도구 글은 그대로):
//   1) 게임 요청은 V2_UP_FRONT 에 든 v1 도구만 처음부터 싣는다. 나머지(이 요청 묶음 + v2ToolPool)는 load_tools{names} 로 싣거나 이름으로 바로 부르면 그 자리에서 싣고 실행한다.
//   2) 처음부터 싣는 v1 도구는 영어 사본(toolTextEn.ts): 짧은 영어 설명, 영어 파라미터 설명, 남은 한국어 파라미터 설명은 걷는다(형·enum·required 는 그대로).
//   3) 같은 큰 하위 스키마(설명 뺀 모양 ≥ COLLAPSE_MIN 자)가 앞 도구(또는 같은 도구 앞자리)에 이미 있으면 느슨한 자리표시(«같은 모양: 도구 경로»)로 바꾼다.
//      광고하는 스키마만 느슨해지고, 실제 검증은 v1 레지스트리(runToolDefinition validateArgs)가 원래 스키마로 한다 — 받던 인자는 계속 받는다.
// 실행기(scripts/lib/piAgentRuntime.ts)는 env.declareTool 로 실은 도구를 다음 모델 호출부터 선언하고, 이름만 부른 호출은 options.v2.lazyTool 로 이 사본을 찾는다.
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import { getTool } from "@/editor/tools/toolRegistry";
import { stripDeep } from "@/ai/piAgent/cliContextBudget";
import type { Project } from "@/project/types";
import type { PiAssistantV2Env } from "../shared/env";
import { V2_TOOL_EN, type ToolTextEn } from "./toolTextEn";
import { classifyRequest, describeIntent } from "../request/intent";
import { PLACE_BUILD_VERBS } from "../prompt/placeSpecs";
import { composedWorldFor } from "../request/world";
import { leanPromptFor } from "../request/readers";

/**
 * 게임 요청에 처음부터 싣는 v1 도구 — 기록된 실행(위)에서 모델이 직접 부른 세션 수가 terra ≥10 또는 opus ≥20 인 것, 또는 그에 준하는 싼 읽기 도구.
 * 이 요청의 묶음에 든 것만 싣는다(교집합). 측정: scripts/qa/assistant-v2/toolExposureReplay.mts.
 * 뺀 것의 예: upsert_item·upsert_enemy(terra 4세션) · set_title_screen(terra 1) · set_map_properties(5) · place_npc(0) · compile_puzzle(0).
 */
export const V2_UP_FRONT: ReadonlySet<string> = new Set([
  "get_event", "find_events", "get_database_records", "get_story_state", "find_switch_usage", "list_endings", "read_npc_layout",
  "list_npc_graphics", "list_resources", "list_spatial_designs", "stamp_object", "find_empty_ground", "furnish_outdoor_area",
  "move_event", "remove_event", "patch_event_page", "add_event_page", "upsert_event", "run_scene_test",
  "create_transfer_pair", "place_chest", "declare_story_flag", "set_start_position", "set_field_hud",
  "simulate_battle", "upsert_actor", "upsert_troop", "set_encounter_table", "place_field_enemy", "define_ending", "set_project_settings",
  "set_opening", "edit_opening", "list_opening_media", "author_opening_stage", "create_opening_animatic_shot", "place_opening_background", "place_opening_charset_actor",
  "inspect_opening_timeline", "set_opening_caption", "author_forest_route",
  // TypeScript 이벤트 스크립트(2026-10-31, 새 도구라 기록 없음) — 로직 낱말(SCRIPT_TIER)이 맞는 요청에서만 처음부터 싣는다.
  // 쓰기 둘만 싣는다(2026-10-31 A/B: get_script_api·check_script·dry_run_script 를 처음부터 실으니 쓰기 앞뒤로 매번 불러 왕복이 늘었다).
  // author_script/edit_script 가 컴파일·예시 실행을 한 번에 돌려주고, API 요약은 SCRIPT_TIER 카드에 있다. 나머지는 이름 호출·load_tools 로.
  "author_script", "edit_script",
]);

/**
 * 게임 하나 요청(intent.wholeGame)에서 처음부터 싣지 않는 것. 기록: Haiku 게임 다섯 판 15턴(r1v-fun · r1h 4판, 2026-11-12) —
 * 도구 56개·12.3만 자가 모델 호출마다 실렸는데, 12개(2.3만 자)는 한 번도 안 불렸고 큰 넷(edit_place 1.7만 · make_place 1.1만 · upsert_event 1.0만 · set_opening 0.5만)은 판의 절반 이하에서만 불렸다.
 * 필요하면 load_tools 로 싣는다(구성기 세계의 장소 짓기 동사가 이미 그렇게 간다). 재는 법: openwiki/assistant-v2.md 「게임 하나 요청의 처음 목록」.
 */
const WHOLE_GAME_LATER: ReadonlySet<string> = new Set([
  "edit_place", "make_place", "set_project_settings", "upsert_event", "set_opening", "upsert_actor",
  "add_scene", "draw_object", "place_object", "dungeon_parts", "set_start_position", "place_chest", "furnish_outdoor_area",
  "create_opening_animatic_shot", "place_opening_background", "place_opening_charset_actor",
]);
/** 게임 하나 요청에는 요청 묶음 밖이라도 처음부터 싣는다 — list_endings 는 잇는 턴 10번에 10번 불렸다(167자). */
const WHOLE_GAME_ALWAYS: ReadonlySet<string> = new Set(["list_endings"]);
/**
 * 청사진의 단계가 다 지어진 게임을 잇는 턴(고치기)에 처음부터 싣는 것 — 읽기 · 돌려 보기 · 이벤트와 목표 고치기 · 엔딩 · 소품.
 * 같은 기록의 잇는 턴 10번에서, 실린 글자의 81~92% 가 그 턴에 한 번도 안 불린 도구였다(12.6만 자 → 3.9만 자). 짓는 동사(청사진 · 장소 · 사람 · 사건)는 load_tools 로.
 */
const WHOLE_GAME_REPAIR: ReadonlySet<string> = new Set([
  "todo", "ask_user", "get_event", "find_events", "inspect", "find_switch_usage", "get_story_state", "get_database_records", "read_npc_layout", "run_scene_test", "list_endings",
  "patch_event_page", "move_event", "remove_event", "restore_event", "declare_story_flag", "set_objective", "set_field_hud", "define_ending", "generate_art",
  "stamp_object", "find_empty_ground", "list_resources", "list_spatial_designs",
]);
/** 청사진의 단계마다 지은 이벤트가 적혀 있나(GameBlueprintStep.built — build_blueprint_path 가 적는다). 하나라도 비면 아직 짓는 턴이다. */
const pathBuilt = (project: Project): boolean => !!project.gameBlueprint?.steps.length && project.gameBlueprint.steps.every((step) => !!step.built);

/** 같은 모양으로 걷을 하위 스키마의 최소 크기(설명 뺀 JSON 글자 수). 분기 명령 배열(약 420자)은 걷고, {x,y} 같은 작은 모양은 남긴다. */
const COLLAPSE_MIN = 400;
const HANGUL = /[ㄱ-ㆎ가-힣]/u;

type Json = unknown;
type Obj = Record<string, Json>;
const isObj = (v: Json): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const strip = (v: Json): Json => Array.isArray(v) ? v.map(strip) : isObj(v) ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "description").map(([k, x]) => [k, strip(x)])) : v;

/**
 * 값이 하나뿐인 선택 enum 에 "none" 을 앞에 더한다. 스키마의 칸을 다 채우는 모델(GPT 계열)은 그 칸을 비울 수 없어 하나뿐인 값을 넣는다 —
 * `upsert_item` 의 `escapeTo:["entrance"]` 가 그렇게 채워져 회복약이 탈출 로프로 저장됐다(2026-11-11 작은 일 둘째 묶음 item-new-built).
 * "none" 은 인자 검사(`loop/argGuard` pruneDefaults)가 도구에 가기 전에 걷는다.
 */
function withNone(schema: Json, required: boolean): Json {
  if (required || !isObj(schema) || !Array.isArray(schema.enum) || schema.enum.length !== 1 || typeof schema.enum[0] !== "string" || schema.enum[0] === "none") return schema;
  const note = '"none" = leave unset.';
  return { ...schema, enum: ["none", schema.enum[0]], description: typeof schema.description === "string" ? `${schema.description} ${note}` : note };
}

/** 파라미터 설명을 경로 규칙(toolTextEn.ts 머리)대로 바꾼다. keepKorean=false 면 영어 덮개가 없는 한국어 설명을 걷는다. */
function translateParams(node: Json, en: ToolTextEn | undefined, keepKorean: boolean, path = ""): Json {
  if (Array.isArray(node)) return node.map((n) => translateParams(n, en, keepKorean, path));
  if (!isObj(node)) return node;
  const out: Obj = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "description") continue;
    const child = k === "properties" && isObj(v)
      ? Object.fromEntries(Object.entries(v).filter(([pk]) => !en?.hide?.includes(path ? `${path}.${pk}` : pk))
        .map(([pk, pv]) => [pk, withNone(translateParams(pv, en, keepKorean, path ? `${path}.${pk}` : pk), Array.isArray(node.required) && node.required.includes(pk))]))
      : k === "items" ? translateParams(v, en, keepKorean, `${path}[]`)
        : k === "anyOf" || k === "oneOf" || k === "allOf" ? translateParams(v, en, keepKorean, path)
          : translateParams(v, en, keepKorean, path ? `${path}.${k}` : k);
    out[k] = child;
  }
  const original = typeof node.description === "string" ? node.description : undefined;
  const override = path ? en?.p?.[path] : undefined;
  const description = override ?? (original === undefined ? undefined : !HANGUL.test(original) || keepKorean ? original : undefined);
  return description === undefined ? out : { description, ...out };
}

/** 한 도구의 영어 사본(설명·파라미터 설명). 레지스트리 도구가 아니면(v2 동사) 그대로 둔다. */
export function englishToolCopy(tool: PiToolShape, upFront: boolean): PiToolShape {
  if (!getTool(tool.name)) return tool;
  const en = V2_TOOL_EN[tool.name];
  // 감싸개가 덧붙인 세션별 꼬리(예: forestBrief 의 설계 지시서)는 영어 설명으로 바꿔도 남긴다.
  const tail = (tool as PiToolShape & { readonly descriptionTail?: string }).descriptionTail ?? "";
  const description = en?.d ? `${en.d}${tail}` : tool.description;
  return { ...tool, description, parameters: translateParams(tool.parameters, en, !upFront) as PiToolShape["parameters"] };
}

/** 앞서 본 큰 하위 스키마 → 처음 나온 자리(«도구 경로»). collapseRepeats 가 채운다. */
type ShapeIndex = Map<string, string>;

/**
 * 같은 큰 하위 스키마가 다시 나오면 느슨한 자리표시로 바꾼다(앞쪽부터 걷는다 — 처음 나온 자리가 정본, 그 아래 작은 모양도 등록).
 * register=false 면 seen 에 새로 넣지 않는다(필요할 때 싣는 도구 — 다른 필요할 때 싣는 도구가 그 도구를 가리키면 안 된다). 자기 안의 반복은 걷는다.
 */
function collapseRepeats(tool: PiToolShape, seen: ShapeIndex, register = true): PiToolShape {
  // v2 동사(레지스트리 밖)는 광고 스키마가 곧 검증기다 — 느슨하게 만들지 않고 모양만 등록한다(뒤 v1 도구가 가리킬 수 있게).
  const collapse = !!getTool(tool.name);
  const local: ShapeIndex = new Map();
  const visit = (node: Json, path: string): Json => {
    if (Array.isArray(node)) return node.map((n) => visit(n, path));
    if (!isObj(node)) return node;
    const bare = JSON.stringify(strip(node));
    if (path && bare.length >= COLLAPSE_MIN) {
      const first = seen.get(bare) ?? local.get(bare);
      // v2 동사: 구조는 그대로 두고 설명만 걷는다.
      if (first && !collapse) return { ...(strip(node) as Obj), description: `Same shape as ${first} (see the field notes there)` };
      if (first) {
        const ref = `Same shape as ${first}${typeof node.description === "string" && !HANGUL.test(node.description) ? ` — ${node.description}` : ""}`;
        if (node.type === "array") return { type: "array", items: { type: "object", additionalProperties: true }, description: ref };
        if (node.type === "object" || node.properties) return { type: "object", additionalProperties: true, description: ref };
        if (node.type === "string") return { type: "string", description: ref };
        return { description: ref };
      }
      if (!seen.has(bare) && !local.has(bare)) (register ? seen : local).set(bare, `${tool.name} ${path}`);
    }
    const out: Obj = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = k === "properties" && isObj(v)
        ? Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, visit(pv, path ? `${path}.${pk}` : pk)]))
        : k === "items" ? visit(v, `${path}[]`)
          : k === "anyOf" || k === "oneOf" || k === "allOf" ? visit(v, path)
            : k === "description" ? v : visit(v, path ? `${path}.${k}` : k);
    }
    return out;
  };
  return { ...tool, parameters: visit(tool.parameters, "") as PiToolShape["parameters"] };
}

export interface V2ToolExposure {
  /** 처음부터 싣는 도구(load_tools 포함). */
  readonly tools: PiToolShape[];
  /** 필요할 때 싣는 도구(영어 사본·같은 모양 걷기를 마친 것) — 이름 → 도구. */
  readonly lazy: ReadonlyMap<string, PiToolShape>;
  /** 이 요청 묶음에 들었지만 처음부터 싣지 않은 이름(load_tools 설명의 앞쪽 목록). */
  readonly offered: readonly string[];
  /** 목록에 없는 도구(call_tool 로 부른다)의 매개변수 글 — 인자 모양 거절에 붙인다. 처음 목록에 있는 도구는 undefined. */
  readonly callSchema: (name: string) => string | undefined;
}

const gloss = (tool: PiToolShape): string => {
  const d = V2_TOOL_EN[tool.name]?.d ?? tool.description;
  const first = d.split(/(?<=[.!?])\s|[(—:;]/u)[0]!.trim().replace(/[.]$/u, "");
  return first.length > 64 ? `${first.slice(0, 62)}…` : first;
};

/** 실은 도구 하나를 짧게(이름·설명·필수 칸·칸 이름) — load_tools 결과 글. 전체 스키마는 다음 호출의 도구 목록에 있다. */
function loadedLine(tool: PiToolShape): string {
  const p = isObj(tool.parameters) ? tool.parameters : {};
  const props = isObj(p.properties) ? Object.keys(p.properties).filter((k) => k !== "todoId") : [];
  const req = Array.isArray(p.required) ? (p.required as string[]) : [];
  return `- ${tool.name}: ${tool.description}\n  required: ${req.length ? req.join(", ") : "(none)"} · fields: ${props.join(", ") || "(none)"}`;
}

/**
 * call_tool 로 부르는 도구의 매개변수 글 — 실행기가 그 호출을 검증하는 스키마(이 사본의 parameters) 그대로, 깊은 칸의 설명만 걷는다.
 * load_tools 결과와 인자 모양 거절(callSchema)이 같은 모양을 쓴다. english 면 영어 덮개가 없는 한국어 칸 설명도 걷는다(거절 글은 짧게).
 */
function parametersText(tool: PiToolShape, english = false): string {
  const parameters = english && getTool(tool.name) ? translateParams(tool.parameters, V2_TOOL_EN[tool.name], false) : tool.parameters;
  return JSON.stringify(stripDeep(parameters));
}
/** 목록 고정(call_tool) 때 load_tools 결과에 싣는 한 도구 — 설명과 매개변수 스키마. */
const loadedSchema = (tool: PiToolShape): string => `- ${tool.name}: ${tool.description}\n  parameters: ${parametersText(tool)}`;

/**
 * 할 일 고리(withTodoLoop)까지 감싼 v2 도구 목록을 받아 이번 요청에 내놓을 모양으로 나눈다.
 * 게임 요청이 아니면(맵만·음악만·덧그리기·스토어) 다 싣는다 — 영어 사본·같은 모양 걷기만 한다.
 */
/** 버들항 칩셋으로만 짓는 도구 — 구성기 세계의 게임에는 싣지 않는다. */
const BEODEUL_ONLY_TOOLS: ReadonlySet<string> = new Set(["author_forest_route"]);

/** 작은 일의 처음 싣는 도구 글자 상한 — load_tools 설명(약 5천 자)을 더해 4만 자 안에 든다. */
const SMALL_TOOL_CHARS = 34_000;
/** 앞(급한 것)부터 상한 안에 드는 도구 이름 — 안 드는 것은 건너뛰고 필요할 때 싣는다. */
function withinSmallBudget(ordered: readonly PiToolShape[]): Set<string> {
  const keep = new Set<string>();
  const seen: ShapeIndex = new Map();
  let used = 0;
  for (const tool of ordered) {
    // 실리는 모양 그대로 잰다(되풀이되는 스키마는 한 번만 실린다).
    const copy = collapseRepeats(englishToolCopy(tool, true), seen);
    const size = JSON.stringify({ n: copy.name, d: copy.description, p: copy.parameters }).length;
    if (used + size > SMALL_TOOL_CHARS) continue;
    used += size; keep.add(tool.name);
  }
  return keep;
}

export function exposeV2Tools(env: PiAssistantV2Env, allTools: readonly PiToolShape[]): V2ToolExposure {
  let tools = allTools;
  const task = String(env.request.task ?? "");
  // 이 요청을 어떻게 갈랐는지 실행 기록에 한 줄 남긴다 — 지시문·도구·검사가 모두 이 분류를 읽는다.
  const intent = classifyRequest(task, env.ctx.project);
  env.emit({ type: "execution_status", name: "v2.request.intent", ok: true, summary: `요청 분류: ${describeIntent(intent)}`, data: { scope: intent.scope, wholeGame: intent.wholeGame, why: intent.why } });
  const lazyOn = intent.tools.game && !intent.audio.musicOnly;
  // 장소를 짓지 않는 요청(readers.leanPromptFor)이면 장소 짓기 동사도 필요할 때 싣는다 — 지시문의 장소 카드와 함께 빠진다.
  // 구성기 세계의 게임(world.ts)도 같다 — 장소는 build_places 가 짓는다. 버들항 전용 숲길 도구는 그 세계에 싣지 않는다(다른 칩셋 맵이 섞인다).
  const composedWorld = composedWorldFor(env.ctx.project, env.request.projectKey ? String(env.request.projectKey) : undefined, task);
  if (composedWorld) tools = tools.filter((t) => !BEODEUL_ONLY_TOOLS.has(t.name));
  const lean = leanPromptFor(env.ctx.project, task);
  const placeLazy = lean || composedWorld;
  // 작은 일(고치기·질문·게임 하나를 잇지 않는 이어 하기): 그 일이 쓸 도구만 처음부터 싣는다(request/topics.ts smallJobTools). 청사진·장소 짓기·오프닝·엔딩 도구는 필요할 때.
  // 실측(2026-11-11): 「이 NPC를 두 칸 왼쪽으로 옮겨 줘」에 도구 43개·9.7만 자가 처음부터 실렸고 첫 도구가 write_blueprint 였다.
  const order = lean && !intent.wholeGame && intent.scope !== "audio" ? new Map(intent.smallTools.map((name, i) => [name, i] as const)) : undefined;
  if (order) tools = [...tools].sort((x, y) => (order.get(x.name) ?? order.size) - (order.get(y.name) ?? order.size));
  const small = order && withinSmallBudget(tools.filter((t) => order.has(t.name)));
  // 게임 하나: 청사진의 단계가 다 지어져 있으면 잇는 턴(고치는 도구만 처음부터), 아니면 짓는 턴(안 쓰는 것 · 드물게 쓰는 큰 것만 뒤로). 요청 글이 아니라 프로젝트 상태로 가른다.
  const repairTurn = intent.wholeGame && pathBuilt(env.ctx.project);
  const later = (name: string) => repairTurn ? !WHOLE_GAME_REPAIR.has(name) : intent.wholeGame && WHOLE_GAME_LATER.has(name);
  // 뒤로 돌린 v2 동사도 load_tools 설명의 앞쪽 목록(이름 — 한 줄 뜻)에 든다.
  const offeredSet = new Set([...intent.tools.extra, ...(placeLazy ? PLACE_BUILD_VERBS : []), ...(intent.wholeGame ? tools.filter((t) => !getTool(t.name) && later(t.name)).map((t) => t.name) : [])]);
  // 처음부터 = 이 요청 묶음에 들었고(offered) 기록에서 쓴 것(V2_UP_FRONT). 묶음 밖 도구(v2ToolPool 로만 들어온 것)는 늘 필요할 때.
  const pinned = (name: string) => intent.wholeGame && (WHOLE_GAME_ALWAYS.has(name) || (repairTurn && WHOLE_GAME_REPAIR.has(name)));
  const isLazy = (t: PiToolShape) => small ? !small.has(t.name) : pinned(t.name) ? false : later(t.name) || (placeLazy && PLACE_BUILD_VERBS.has(t.name))
    || (lazyOn && !!getTool(t.name) && (!V2_UP_FRONT.has(t.name) || !offeredSet.has(t.name)));
  const seen: ShapeIndex = new Map();
  const upFront = tools.filter((t) => !isLazy(t)).map((t) => collapseRepeats(englishToolCopy(t, true), seen));
  const lazy = new Map<string, PiToolShape>();
  for (const t of tools) if (isLazy(t)) lazy.set(t.name, collapseRepeats(englishToolCopy(t, false), seen, false));
  const callSchema = (name: string) => { const tool = lazy.get(name); return tool ? parametersText(tool, true) : undefined; };
  if (!lazy.size) return { tools: upFront, lazy, offered: [], callSchema };
  const offered = [...lazy.keys()].filter((n) => offeredSet.has(n));
  const others = [...lazy.keys()].filter((n) => !offeredSet.has(n));
  const loaded = new Set<string>();
  const loadTools: PiToolShape = {
    name: "load_tools",
    label: "load tools",
    description: [
      env.lazyToolsVia === "call_tool"
        ? "Load more tools by name. They are left out of your tool list to keep it short. Loading returns their parameters; run them with call_tool{name, args} (your tool list itself never changes)."
        : "Load more tools by name. They are left out of your tool list to keep it short; after loading, their full schemas are in your tool list from your next call. Calling one of them by name also works (it loads on first use).",
      `For this request: ${offered.map((n) => `${n} — ${gloss(lazy.get(n)!)}`).join("; ") || "(none)"}.`,
      ...(others.length ? [`Also loadable: ${others.join(", ")}.`] : []),
    ].join("\n"),
    parameters: { type: "object", properties: { names: { type: "array", items: { type: "string" }, description: "Tool names to load (from the lists above)." } }, required: ["names"], additionalProperties: false } as PiToolShape["parameters"],
    async execute(_id, params) {
      const names = Array.isArray((params as { names?: unknown })?.names) ? ((params as { names: unknown[] }).names).map(String) : [];
      const got: PiToolShape[] = []; const unknown: string[] = []; const already: string[] = [];
      for (const raw of names) {
        const name = raw.trim();
        if (upFront.some((t) => t.name === name)) { already.push(name); continue; }
        if (loaded.has(name) && env.lazyToolsVia !== "call_tool") { already.push(name); continue; }
        const tool = lazy.get(name);
        if (!tool) { unknown.push(name); continue; }
        loaded.add(name);
        env.declareTool?.(tool);
        got.push(tool);
      }
      const viaCall = env.lazyToolsVia === "call_tool";
      const lines = [
        got.length && viaCall ? `Loaded ${got.length} tool(s). Your tool list does not change (prompt cache) — run them with call_tool{name:"<tool>", args:{…}} using these parameters:\n${got.map(loadedSchema).join("\n")}` : "",
        got.length && !viaCall ? `Loaded ${got.length} tool(s)${env.declareTool ? " — call them from your next step; the full schema is in your tool list" : ""}:\n${got.map(loadedLine).join("\n")}` : "",
        already.length ? `Already in your tool list: ${already.join(", ")}.` : "",
        unknown.length ? `Unknown tool name(s): ${unknown.join(", ")}. Loadable names: ${[...lazy.keys()].filter((n) => !loaded.has(n)).join(", ")}.` : "",
      ].filter(Boolean);
      const summary = lines.join("\n") || "Nothing to load — pass names:[…] from the lists in this tool's description.";
      return { content: [{ type: "text", text: JSON.stringify({ ok: got.length > 0 || already.length > 0, summary }) }], details: { ok: got.length > 0 || already.length > 0, summary } } as Awaited<ReturnType<PiToolShape["execute"]>>;
    },
  } as PiToolShape;
  return { tools: [...upFront, loadTools], lazy, offered, callSchema };
}

/** 없는 도구 이름을 부른 호출에 돌려줄 영어 글(실행기가 v2 에서 «tool not found» 대신 쓴다). */
export function unknownToolText(name: string, lazy: ReadonlyMap<string, PiToolShape>): string {
  const near = [...lazy.keys()].filter((n) => n.includes(name.split("_").pop() ?? name) || name.includes(n.split("_").pop() ?? n)).slice(0, 6);
  return `Rejected: there is no tool named "${name}". Use a tool from your tool list${lazy.size ? `, or load one with load_tools{names:[…]}${near.length ? ` — similar names: ${near.join(", ")}` : ""}` : ""}.`;
}
