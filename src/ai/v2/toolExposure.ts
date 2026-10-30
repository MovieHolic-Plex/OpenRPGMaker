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
import type { PiAssistantV2Env } from "./env";
import { v2ExtraToolNames, wantsGameTools } from "./game";
import { musicOnly } from "./musicWords";
import { V2_TOOL_EN, type ToolTextEn } from "./toolTextEn";

/**
 * 게임 요청에 처음부터 싣는 v1 도구 — 기록된 실행(위)에서 모델이 직접 부른 세션 수가 terra ≥10 또는 opus ≥20 인 것, 또는 그에 준하는 싼 읽기 도구.
 * 이 요청의 묶음에 든 것만 싣는다(교집합). 측정: scripts/qa/assistant-v2/toolExposureReplay.mts.
 * 뺀 것의 예: upsert_item·upsert_enemy(terra 4세션) · set_title_screen(terra 1) · set_map_properties(5) · place_npc(0) · compile_puzzle(0).
 */
export const V2_UP_FRONT: ReadonlySet<string> = new Set([
  "get_event", "find_events", "get_database_records", "get_story_state", "find_switch_usage", "list_endings", "read_npc_layout",
  "list_npc_graphics", "list_resources", "list_spatial_designs", "stamp_object", "find_empty_ground",
  "move_event", "remove_event", "patch_event_page", "add_event_page", "upsert_event", "run_scene_test",
  "create_transfer_pair", "place_chest", "declare_story_flag", "set_start_position", "set_field_hud",
  "simulate_battle", "upsert_actor", "upsert_troop", "set_encounter_table", "place_field_enemy", "define_ending", "set_project_settings",
  "set_opening", "edit_opening", "list_opening_media", "create_opening_animatic_shot", "place_opening_background", "place_opening_charset_actor",
  "inspect_opening_timeline", "set_opening_caption", "author_forest_route",
]);

/** 같은 모양으로 걷을 하위 스키마의 최소 크기(설명 뺀 JSON 글자 수). 분기 명령 배열(약 420자)은 걷고, {x,y} 같은 작은 모양은 남긴다. */
const COLLAPSE_MIN = 400;
const HANGUL = /[ㄱ-ㆎ가-힣]/u;

type Json = unknown;
type Obj = Record<string, Json>;
const isObj = (v: Json): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const strip = (v: Json): Json => Array.isArray(v) ? v.map(strip) : isObj(v) ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "description").map(([k, x]) => [k, strip(x)])) : v;

/** 파라미터 설명을 경로 규칙(toolTextEn.ts 머리)대로 바꾼다. keepKorean=false 면 영어 덮개가 없는 한국어 설명을 걷는다. */
function translateParams(node: Json, en: ToolTextEn | undefined, keepKorean: boolean, path = ""): Json {
  if (Array.isArray(node)) return node.map((n) => translateParams(n, en, keepKorean, path));
  if (!isObj(node)) return node;
  const out: Obj = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "description") continue;
    const child = k === "properties" && isObj(v)
      ? Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, translateParams(pv, en, keepKorean, path ? `${path}.${pk}` : pk)]))
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
export type ShapeIndex = Map<string, string>;

/**
 * 같은 큰 하위 스키마가 다시 나오면 느슨한 자리표시로 바꾼다(앞쪽부터 걷는다 — 처음 나온 자리가 정본, 그 아래 작은 모양도 등록).
 * register=false 면 seen 에 새로 넣지 않는다(필요할 때 싣는 도구 — 다른 필요할 때 싣는 도구가 그 도구를 가리키면 안 된다). 자기 안의 반복은 걷는다.
 */
export function collapseRepeats(tool: PiToolShape, seen: ShapeIndex, register = true): PiToolShape {
  // v2 동사(레지스트리 밖)는 광고 스키마가 곧 검증기다 — 느슨하게 만들지 않고 모양만 등록한다(뒤 v1 도구가 가리킬 수 있게).
  const collapse = !!getTool(tool.name);
  const local: ShapeIndex = new Map();
  const visit = (node: Json, path: string): Json => {
    if (Array.isArray(node)) return node.map((n) => visit(n, path));
    if (!isObj(node)) return node;
    const bare = JSON.stringify(strip(node));
    if (path && bare.length >= COLLAPSE_MIN) {
      const first = seen.get(bare) ?? local.get(bare);
      // v2 동사: 구조는 그대로 두고 설명만 걷는다(schemaDedupe.ts 와 같은 원칙).
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
 * 할 일 고리(withTodoLoop)까지 감싼 v2 도구 목록을 받아 이번 요청에 내놓을 모양으로 나눈다.
 * 게임 요청이 아니면(맵만·음악만·덧그리기·스토어) 다 싣는다 — 영어 사본·같은 모양 걷기만 한다.
 */
export function exposeV2Tools(env: PiAssistantV2Env, tools: readonly PiToolShape[]): V2ToolExposure {
  const task = String(env.request.task ?? "");
  const lazyOn = wantsGameTools(task) && !musicOnly(task);
  const offeredSet = new Set(v2ExtraToolNames(task));
  // 처음부터 = 이 요청 묶음에 들었고(offered) 기록에서 쓴 것(V2_UP_FRONT). 묶음 밖 도구(v2ToolPool 로만 들어온 것)는 늘 필요할 때.
  const isLazy = (t: PiToolShape) => lazyOn && !!getTool(t.name) && (!V2_UP_FRONT.has(t.name) || !offeredSet.has(t.name));
  const seen: ShapeIndex = new Map();
  const upFront = tools.filter((t) => !isLazy(t)).map((t) => collapseRepeats(englishToolCopy(t, true), seen));
  const lazy = new Map<string, PiToolShape>();
  for (const t of tools) if (isLazy(t)) lazy.set(t.name, collapseRepeats(englishToolCopy(t, false), seen, false));
  if (!lazy.size) return { tools: upFront, lazy, offered: [] };
  const offered = [...lazy.keys()].filter((n) => offeredSet.has(n));
  const others = [...lazy.keys()].filter((n) => !offeredSet.has(n));
  const loaded = new Set<string>();
  const loadTools: PiToolShape = {
    name: "load_tools",
    label: "load tools",
    description: [
      "Load more tools by name. They are left out of your tool list to keep it short; after loading, their full schemas are in your tool list from your next call. Calling one of them by name also works (it loads on first use).",
      `For this request: ${offered.map((n) => `${n} — ${gloss(lazy.get(n)!)}`).join("; ") || "(none)"}.`,
      ...(others.length ? [`Also loadable: ${others.join(", ")}.`] : []),
    ].join("\n"),
    parameters: { type: "object", properties: { names: { type: "array", items: { type: "string" }, description: "Tool names to load (from the lists above)." } }, required: ["names"], additionalProperties: false } as PiToolShape["parameters"],
    async execute(_id, params) {
      const names = Array.isArray((params as { names?: unknown })?.names) ? ((params as { names: unknown[] }).names).map(String) : [];
      const got: PiToolShape[] = []; const unknown: string[] = []; const already: string[] = [];
      for (const raw of names) {
        const name = raw.trim();
        if (upFront.some((t) => t.name === name) || loaded.has(name)) { already.push(name); continue; }
        const tool = lazy.get(name);
        if (!tool) { unknown.push(name); continue; }
        loaded.add(name);
        env.declareTool?.(tool);
        got.push(tool);
      }
      const lines = [
        got.length ? `Loaded ${got.length} tool(s)${env.declareTool ? " — call them from your next step; the full schema is in your tool list" : ""}:\n${got.map(loadedLine).join("\n")}` : "",
        already.length ? `Already in your tool list: ${already.join(", ")}.` : "",
        unknown.length ? `Unknown tool name(s): ${unknown.join(", ")}. Loadable names: ${[...lazy.keys()].filter((n) => !loaded.has(n)).join(", ")}.` : "",
      ].filter(Boolean);
      const summary = lines.join("\n") || "Nothing to load — pass names:[…] from the lists in this tool's description.";
      return { content: [{ type: "text", text: JSON.stringify({ ok: got.length > 0 || already.length > 0, summary }) }], details: { ok: got.length > 0 || already.length > 0, summary } } as Awaited<ReturnType<PiToolShape["execute"]>>;
    },
  } as PiToolShape;
  return { tools: [...upFront, loadTools], lazy, offered };
}

/** 없는 도구 이름을 부른 호출에 돌려줄 영어 글(실행기가 v2 에서 «tool not found» 대신 쓴다). */
export function unknownToolText(name: string, lazy: ReadonlyMap<string, PiToolShape>): string {
  const near = [...lazy.keys()].filter((n) => n.includes(name.split("_").pop() ?? name) || name.includes(n.split("_").pop() ?? n)).slice(0, 6);
  return `Rejected: there is no tool named "${name}". Use a tool from your tool list${lazy.size ? `, or load one with load_tools{names:[…]}${near.length ? ` — similar names: ${near.join(", ")}` : ""}` : ""}.`;
}
