// ai/workPlan.ts
//
// Modern LLM agent harness for multi-step editor work.
// Research basis (2025–2026):
// - Anthropic long-running harness: Planner → Generator (one item at a time) → Evaluator
// - Ralph loop: intercept early exit, re-inject next step from externalized plan state
// - OpenAI / Claude Code: Agent = model + harness loop (tools, state, hooks) — code never "thinks"
// - Addy Osmani harness engineering: planning artifact + verification + continuation hooks
//
// Role split (immutable):
// | Piece        | Who              | Job                                              |
// |--------------|------------------|--------------------------------------------------|
// | Planner      | Main LLM         | Decide direct|resume|new_plan|replan; author todos |
// | Generator    | Main/lite + tools| Execute ONLY current work item                   |
// | Evaluator    | Main LLM review  | End-of-burst check (existing review phase)       |
// | Harness      | This module+code | Store plan, inject current, Ralph continue, caps |
//
// Production path never uses regex/keyword heuristics to invent steps.
// Fallback plan only if planner JSON parse/API fails on a long request.

import {
  NARRATIVE_HORROR_PLANNER_RULE,
  detectNarrativeHorrorGenre,
  plannerHintForNarrativeHorrorGenre,
  requiredSuccessToolsForUserText,
  templateToolInstruction,
} from "./narrativeHorrorWorkPlan";
import { QUICK_REPLY_MARKER } from "@/ai/interviewPrompt";
import { allTools, getTool } from "@/editor/tools/toolRegistry";
import { parseAcceptance, type AcceptancePromise } from "./assistantAcceptance";
import { ACCEPTANCE_PLANNER_GUIDE } from "./assistantAcceptanceTools";
export type WorkItemStatus = "pending" | "in_progress" | "done" | "skipped" | "blocked";

export interface WorkItem {
  readonly requirementIds?: readonly string[];
  readonly id: string;
  readonly title: string;
  /** Concrete worker instruction (tool names + numbers preferred). */
  readonly instruction: string;
  /**
   * Acceptance / done-when (Anthropic sprint-contract style).
   * Injected into worker context so the model knows when to complete_work_item.
   */
  readonly doneWhen?: string;
  /** Tools that must all succeed before this item can auto-complete (orchestrator-authored). */
  readonly successTools?: readonly string[];
  /** Emergency generic fallback: require evidence from at least one successful write tool. */
  readonly requiresAnyWrite?: boolean;
  status: WorkItemStatus;
  note?: string;
}

export interface WorkLayer {
  readonly id: string;
  readonly title: string;
  readonly items: WorkItem[];
}

export interface WorkPlan {
  readonly requirements?: readonly AcceptancePromise[];
  readonly acceptance?: readonly AcceptancePromise[];
  readonly id: string;
  readonly goal: string;
  readonly createdAt: string;
  readonly layers: WorkLayer[];
  currentLayerIndex: number;
  currentItemId: string | null;
  /** Planner memo (strategy only; not executed as tools). */
  readonly plannerNote?: string;
  /**
   * 이 계획이 손보는 기존 맵 id — 계획을 만든 턴의 `[컨텍스트] 현재 맵` 에서 뽑는다.
   *
   * 매 스프린트 생성기 컨텍스트에 `Target map:` 으로 재주입한다. 뷰포트가 null 인 턴(맵 씬 미탑재)
   * 이나 자율 계속 턴처럼 footer 가 없는 턴에도 대상이 남아야 하기 때문이다
   * (2026-08-29 modify 진단 근본원인 14). 신규 생성 요청이면 undefined.
   */
  readonly targetMapId?: string;
}

export interface WorkPlanProgressSummary {
  readonly goal: string;
  readonly layersTotal: number;
  readonly layersDone: number;
  readonly itemsTotal: number;
  readonly itemsDone: number;
  readonly current?: {
    readonly layerTitle: string;
    readonly itemTitle: string;
    readonly instruction: string;
    readonly doneWhen?: string;
  };
  readonly remainingTitles: readonly string[];
}

/** Planner (main LLM) JSON decision — no tools. */
export interface PlannerVolumeBar {
  readonly authoredMaps: number;
  readonly multiPageNpcs: number;
  readonly shops: number;
  readonly quests: number;
}

export type OrchestratorDecision =
  | { readonly action: "direct"; readonly reason?: string }
  | { readonly action: "resume"; readonly reason?: string }
  | {
      readonly action: "new_plan" | "replan";
      readonly goal: string;
      readonly plannerNote?: string;
      /**
       * 플래너가 이 계획에 약속하는 최소 산출량(볼륨 계약). 코드는 이 값만 측정한다 — 문장 정규식으로
       * 「마을=맵 1·NPC 3·상점 1」 막대를 씌우던 경로는 없다(2026-09-03 감사: 「이 마을에 상인 하나 추가」 폭주).
       */
      readonly volume?: PlannerVolumeBar;
      readonly requirements?: readonly AcceptancePromise[];
      readonly acceptance?: readonly AcceptancePromise[];
      readonly layers: readonly {
        readonly id?: string;
        readonly title: string;
        readonly items: readonly {
          readonly id?: string;
          readonly title: string;
          readonly instruction: string;
          readonly doneWhen?: string;
          readonly successTools?: readonly string[];
          readonly requirementIds?: readonly string[];
          readonly requiresAnyWrite?: boolean;
        }[];
      }[];
    };

export const ORCHESTRATOR_SYSTEM_PROMPT = `You are the **planner** agent in a modern RPG map/event editor harness (Anthropic planner–generator–evaluator / plan-then-execute).

You do NOT edit maps. You only decide how work is decomposed.

Harness contract:
1. Output **JSON only** (no markdown fences, no prose outside JSON).
2. action=direct — a single tool turn is enough (one NPC, one facility via place_concept, a small paint, adding one merchant to an existing map, simple Q&A). Use new_plan for village / town / RPG / campaign / multi-map / quest-chain requests. Respect negations literally: "마을은 만들지 말고 여관만" is one facility, not a village; "퀘스트 말고 상점만" has no quest.
3. action=resume — incomplete WorkPlan already matches the user goal; keep it.
4. action=new_plan — first multi-step hard request; author goal + layers + items.
5. action=replan — active plan is wrong/stale or user wants restart/wipe/new goal.
6. Plan at the scale the requested work requires. There is no layer or todo-count quota. Separate work that can be executed, retried or verified independently: individual regions, landmarks, connections, authoring passes and verification steps. A bulk tool does not make an entire village or world map an atomic task. Use direct only for genuinely atomic work. Do not invent extra scope or filler tasks merely to make the list longer.
7. Every item needs:
   - title (identifies the independent result)
   - instruction (concrete tools/numbers: 신축=author_house, author_village, create_map, place_npc, create_transfer_pair, upsert_event, fill_region, paint_road, script_cutscene_preset, make_horror_loop, make_gallery_room / **수정=paint_tiles, tile_erase, fill_region, move_event, remove_event, set_map_properties, resize_map, furnish_interior_space, author_village(target:{kind:"existing",mapId,bounds})** … — 건설 지시는 목표 맵과 정확한 수량을, **수정 지시는 대상 맵 id 와 바꿀 대상을 반드시 명시**)
   - doneWhen (acceptance: what must be true when this item is complete)
   - successTools (tool names that must ALL succeed before the item auto-completes; they must cover **every clause of doneWhen**, not just the first one. If doneWhen also requires painting/decorating/placing after a map is created, list those tools too — e.g. doneWhen "맵이 생성되고 지형이 칠해짐" → ["create_map","fill_region"]. Modify items list modify tools, never creation tools — e.g. doneWhen "기존 광장 타일이 석재로 교체됨" → ["paint_tiles"], doneWhen "집 2채가 새 위치로 이동됨" → ["move_event"], doneWhen "잘못 깔린 담장이 정리되고 다시 깔림" → ["tile_erase","build_wall"]. Listing only the creation tool for such an item is a contract violation: the harness completes the item the moment those tools succeed, so the rest of doneWhen never runs. Never list alternatives.)
8. Typical **greenfield** RPG content layers (신규 프로젝트/신규 맵을 만드는 요청에만 해당): meta/wipe → hub map → landmarks → side maps/transfers → quest chain → polish/QA.
   기존 산출물을 고치는 요청의 레이어는 다르다 — Repair/adjust: survey(get_map_region / find_layout_regions 로 현재 상태 확인) → cleanup(tile_erase) → rebuild in place → verify. 여기에 create_map/author_* new 를 끼워 넣지 마라.
9. Titles/instructions/doneWhen in the **same language as the user** (usually Korean).
10. Preserve complete goals, instructions, quantities, dependencies and acceptance criteria without a character quota. Large plans are allowed. Avoid repetition, not required detail. Keep the user's prohibitions and preservation constraints (금지·보존 제약) explicit ("새로 만들지 마", "기존 것 유지", "이 맵만"). An interrupted response does not authorize treating a partial plan as the complete requested scope.
11. A multi-deliverable request MUST have every deliverable represented by independently checkable items. Do not drop, merge or summarize independent tasks just to shorten the plan. Group them into meaningful layers while preserving their individual completion conditions.
12. "volume" (optional, only with new_plan/replan): the minimum outputs you commit to for greenfield content — {"authoredMaps","multiPageNpcs","shops","quests"} as integers. The harness measures the project delta against it and re-injects work until it is met. Derive quantities from the requested scope, not a genre-sized preset or an arbitrary ceiling. Omit it for repairs, single facilities, and anything the user excluded.
13. Only plan quest chains / bosses if the user asks for them. A genre preset or a guide NPC does not require a quest graph or boss.
   - create_quest compiles a step quest and define_quest authors a separate graph contract; they are NOT mandatory sequential calls. Graph verification uses verify_quest. Debugging state to a goal is not a playthrough and cannot prove completion.
   - 보스 전투 페이즈/광폭화/HP 임계 연출 → successTools MUST include ["author_boss_phases","simulate_battle"]. 페이즈가 실제로 발동했는지(phaseCoverage)를 시뮬로 확인해야 완료된다.
14. Preserve an explicit numbered checklist and its dependencies. Put required project/map/event/DB reads in the first item, before any writes. Use only names from the canonical tool list below: get_database_records, set_start_position, set_session_start, upsert_troop are distinct tools. Do not invent get_database or set_player_start.
15. For a full adventure JRPG stage request, include actual village buildings, a connected explorable dungeon with a return transfer, a reachable encounter, a real start party or changeParty join, and final full-map show_map_region inspection. A sign saying dungeon and an NPC talking about joining do not implement these. Seed-only database requests are exempt. Use upsert_equipment for equippable weapons and queried iconResourceId for items.
16. For a party adventure, inspect the current party and supplies, make an accessible village-to-dungeon route, and inspect every affected map with show_map_region. A solid grass rectangle or a small decorated viewport does not complete a dungeon or whole-map stage. Preserve existing content while improving it. Separate visual inspection from authoring so premature tool-name completion cannot omit it.
${NARRATIVE_HORROR_PLANNER_RULE}
${ACCEPTANCE_PLANNER_GUIDE}

JSON schema:
{
  "action": "direct" | "resume" | "new_plan" | "replan",
  "reason": "short why",
  "goal": "required for new_plan/replan",
  "plannerNote": "optional strategy",
  "volume": {"authoredMaps": 1, "multiPageNpcs": 3, "shops": 1, "quests": 0},
  "layers": [
    {
      "id": "L1",
      "title": "phase title",
      "items": [
        {
          "id": "L1-a",
          "title": "todo",
          "instruction": "tools + numbers + placement",
          "doneWhen": "observable acceptance criteria",
          "successTools": ["author_village"]
        }
      ]
    }
  ]
}`;

/**
 * Max Ralph auto-continuations inside one user message after the first item.
 * Research: long-running harnesses keep iterating until plan done or budget hits —
 * not "ask human every 1–2 steps". Cap is a safety pin (context/cost), not product UX.
 */
export const MAX_WORK_PLAN_AUTO_STEPS_PER_TURN = 256;

/**
 * 한 **항목**에 대한 Ralph 재주입 상한 (2026-09-03).
 *
 * Ralph 는 모델이 «끝났다»고 나가려 할 때만 돈다. 같은 항목에서 이것이 3번 반복되면 모델은 끝났다고
 * 믿고 하네스는 아니라고 말하는 교착이다 — 더 밀어붙여도 같은 실패가 반복된다(실측 2026-09-03:
 * 빈 맵에서 `fill_region` 이 스펙 게이트에 막히자 Ralph 가 **173/256** 까지 같은 항목을 재주입했다).
 * 상한에 닿으면 항목을 `blocked` 로 표시하고 턴을 끝내 사용자에게 넘긴다. 턴 전체 상한
 * (`MAX_WORK_PLAN_AUTO_STEPS_PER_TURN`)은 «계획이 큰» 정상 런을 위한 폭주 방지 핀으로 남는다.
 */
export const MAX_RALPH_ATTEMPTS_PER_ITEM = 3;

/** Soft cap: do not Ralph-continue past this many remaining steps in one burst. */
export const MAX_WORK_PLAN_ITEMS_PER_BURST = 256;

export function buildOrchestratorUserPayload(input: {
  readonly userText: string;
  readonly activePlan: WorkPlan | null;
  readonly projectSummary?: string;
}): string {
  const parts = [`## User request\n${input.userText.trim()}`];
  if (input.projectSummary?.trim()) {
    parts.push(`## Project snapshot\n${input.projectSummary.trim()}`);
  }
  if (input.activePlan && !isWorkPlanComplete(input.activePlan)) {
    parts.push(`## Active WorkPlan (incomplete)\n${formatWorkPlanUserVisible(input.activePlan)}`);
    parts.push(
      "If the user continues the same goal (including short messages like 계속/이어서/다음), use action=resume. " +
        "If they change goal or demand restart/wipe/replan, use replan. " +
        "Do not invent a tiny new plan just because the message is short."
    );
  } else {
    parts.push("## Active WorkPlan\n(none)");
  }
  // 대상 선택 규칙(2026-08-29 modify 진단 근본원인 5). 플래너 프롬프트에는 "무엇을 대상으로
  // 삼아라"는 문장이 0건이었고 예시 툴 어휘가 전부 생성계였다. 그래서 "이 마을 담장 고쳐줘"가
  // create_map/author_village 항목으로 분해되고, successTools 에 생성툴이 박히면 그 툴이 성공할
  // 때까지 항목이 완료되지 않아 신축이 강제됐다.
  parts.push(TARGET_SELECTION_RULE);
  parts.push(`## Canonical tool names\n${allTools().map((tool) => tool.name).join(", ")}\nUse exact names in successTools; unknown requirements block completion and require correcting the plan.`);
  parts.push("Respond with JSON only.");
  return parts.join("\n\n");
}

/** 플래너 페이로드에 매 턴 실리는 대상 선택 규칙. */
export const TARGET_SELECTION_RULE = [
  "## Target selection (필수)",
  "- 요청에 신규 생성 표지(새/새로/추가/하나 더/create/new)가 **없으면 기존 산출물을 대상으로 삼는다**.",
  "- '[컨텍스트] 현재 맵' 또는 'Target map' 에 적힌 맵 id 를 수정 대상으로 쓰고, 각 항목 instruction 에 그 id 를 그대로 적는다.",
  "- 사용자가 신규 생성을 요구하지 않았다면 create_map / duplicate_map / reset_project / start_interior_room_session 을 계획에 넣지 않는다.",
  "- 사용자가 '새로 만들지 마'라고 명시했으면 신축 툴은 successTools 에도 넣지 않는다 — 넣으면 그 툴이 성공할 때까지 항목이 완료되지 않아 신축이 강제된다.",
].join("\n");

/** 파싱 결과 — 실패 시 **어느 검증에서 걸렸는지** 를 문자열로 돌려준다. */
export type OrchestratorParseResult =
  | { readonly decision: OrchestratorDecision }
  | { readonly decision: null; readonly error: string };

/**
 * 플래너 JSON 응답을 파싱한다.
 *
 * 실패를 `null` 하나로 뭉개면 원인을 알 수 없다 — 2026-08-23 실측: 6개 산출물을 요구한 요청에서
 * 플래너 응답이 출력 토큰 한도에 걸려 JSON 이 중간에서 끊겼고, 파서가 조용히 null 을 돌려주자
 * 세션이 무관한 장르 템플릿 폴백(moon-cutscene 1항목)으로 갈아치웠다. 그 결과 모델이 스스로
 * "던전·적·물약·상성표·선택지는 추가되지 않았습니다" 라고 말하면서도 턴은 성공으로 끝났다.
 * 그래서 (1) 실패 사유를 반환하고 (2) 잘린 JSON 은 괄호를 닫아 복구를 한 번 시도한다.
 */
export function parseOrchestratorDecision(raw: string): OrchestratorParseResult {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return { decision: null, error: "응답에서 JSON 객체를 찾지 못했습니다." };
  const parsed = parseJsonWithTruncationRepair(jsonText);
  if (parsed === undefined) return { decision: null, error: "JSON 파싱 실패(복구 시도 포함)." };
  if (!isRecord(parsed)) return { decision: null, error: "최상위가 객체가 아닙니다." };
  const action = parsed.action;
  if (action === "direct" || action === "resume") {
    return {
      decision: {
        action,
        ...(typeof parsed.reason === "string" ? { reason: parsed.reason } : {}),
      },
    };
  }
  if (action !== "new_plan" && action !== "replan") {
    return { decision: null, error: `action 이 direct|resume|new_plan|replan 이 아닙니다: ${JSON.stringify(action)}` };
  }
  const goal = typeof parsed.goal === "string" ? parsed.goal.trim() : "";
  if (!goal) return { decision: null, error: "new_plan/replan 에 goal 문자열이 없습니다." };
  const layersRaw = parsed.layers;
  if (!Array.isArray(layersRaw)) return { decision: null, error: "layers 가 배열이 아닙니다." };
  if (layersRaw.length === 0) return { decision: null, error: "layers 가 비어 있습니다." };
  const rejected: string[] = [];
  const layers = layersRaw
    .map((layer, li) => {
      const normalized = normalizeLayer(layer, li);
      if (!normalized) rejected.push(`layers[${li}]`);
      return normalized;
    })
    .filter((layer): layer is NonNullable<typeof layer> => layer !== null);
  if (layers.length === 0) {
    return { decision: null, error: `모든 layer 가 형식 오류입니다(${rejected.join(", ")}). 필요한 형식: {title, items:[{title, instruction}]}` };
  }
  const volume = parsePlannerVolume(parsed.volume);
  let acceptance = parseAcceptance(parsed.acceptance);
  let requirements = parseAcceptance(parsed.requirements);
  if (acceptance || requirements) {
    try {
      JSON.parse(jsonText);
    } catch (cause) {
      if (!(cause instanceof SyntaxError)) throw cause;
      // Truncation repair can recover a plan, never a partial acceptance array.
      acceptance = acceptance?.map(promise => ({ ...promise, criteria: null }));
      requirements = requirements?.map(promise => ({ ...promise, required: true, criteria: null }));
    }
  }
  return {
    decision: {
      action,
      goal,
      ...(typeof parsed.plannerNote === "string" ? { plannerNote: parsed.plannerNote } : {}),
      ...(volume ? { volume } : {}),
      ...(acceptance ? { acceptance } : {}),
      ...(requirements ? { requirements } : {}),
      layers,
    },
  };
}

/** 플래너가 선언한 볼륨 막대. 정수 0 이상만 받고, 전부 0 이면 없는 것으로 본다. */
export function parsePlannerVolume(value: unknown): PlannerVolumeBar | null {
  if (!isRecord(value)) return null;
  const read = (key: string): number => {
    const raw = value[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
    return Math.max(0, Math.floor(raw));
  };
  const bar = {
    authoredMaps: read("authoredMaps"),
    multiPageNpcs: read("multiPageNpcs"),
    shops: read("shops"),
    quests: read("quests"),
  };
  if (bar.authoredMaps === 0 && bar.multiPageNpcs === 0 && bar.shops === 0 && bar.quests === 0) return null;
  return bar;
}

/**
 * 잘린 JSON 복구 — 열려 있는 문자열/배열/객체를 닫고 한 번 더 파싱한다.
 * 출력 토큰 한도에 걸린 플래너 응답에서 **도착한 layer 들만이라도** 살리는 것이 목적이다.
 * 정상 JSON 은 첫 시도에서 통과하므로 이 경로를 타지 않는다.
 */
function parseJsonWithTruncationRepair(jsonText: string): unknown {
  try {
    return JSON.parse(jsonText);
  } catch {
    /* fall through to repair */
  }
  // 뒤에서부터 "구조가 닫힌 지점"(`}` 또는 `]`)으로 후퇴하며, 남은 여는 괄호를 닫아 파싱을 시도한다.
  // 반쯤 도착한 마지막 원소는 이 후퇴로 자연히 잘려 나가고, 온전히 도착한 앞쪽 원소는 살아남는다.
  for (let cut = jsonText.length; cut > 0; cut -= 1) {
    const char = jsonText[cut - 1];
    if (char !== "}" && char !== "]") continue;
    const body = stripTrailingComma(jsonText.slice(0, cut));
    const closers = pendingClosers(body);
    if (closers === null) continue;
    try {
      return JSON.parse(body + closers);
    } catch {
      /* keep backtracking */
    }
  }
  return undefined;
}

function stripTrailingComma(text: string): string {
  const trimmed = text.trimEnd();
  return trimmed.endsWith(",") ? trimmed.slice(0, -1) : trimmed;
}

/** 열린 채 남은 괄호를 닫는 문자열. 문자열 리터럴이 열린 상태로 끝나면 복구 불가(null). */
function pendingClosers(text: string): string | null {
  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  for (const char of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") stack.push(char);
    else if (char === "}" || char === "]") stack.pop();
  }
  if (inString) return null;
  return stack
    .reverse()
    .map((open) => (open === "{" ? "}" : "]"))
    .join("");
}

export function workPlanFromOrchestratorDecision(
  decision: Extract<OrchestratorDecision, { action: "new_plan" | "replan" }>,
  now = new Date(),
  /** 계획을 만든 턴의 대상 맵 id(`[컨텍스트] 현재 맵`). 신규 생성 요청이면 생략. */
  targetMapId?: string,
): WorkPlan {
  return createWorkPlanFromLayers({
    goal: decision.goal,
    acceptance: decision.acceptance,
    requirements: decision.requirements,
    plannerNote: decision.plannerNote,
    layers: decision.layers,
    targetMapId,
    now,
  });
}

/** In-loop set_work_plan tool (Claude TodoWrite-style): generator may replan via tools. */
export function workPlanFromSetToolArgs(args: Record<string, unknown>, now = new Date()): WorkPlan | null {
  const goal = typeof args.goal === "string" ? args.goal.trim() : "";
  if (!goal || !Array.isArray(args.layers)) return null;
  const layers = args.layers
    .map((layer, li) => normalizeLayer(layer, li))
    .filter((layer): layer is NonNullable<typeof layer> => layer !== null);
  if (layers.length === 0) return null;
  return createWorkPlanFromLayers({
    goal,
    acceptance: parseAcceptance(args.acceptance),
    requirements: parseAcceptance(args.requirements),
    plannerNote: typeof args.plannerNote === "string" ? args.plannerNote : undefined,
    layers,
    now,
  });
}

function createWorkPlanFromLayers(input: {
  requirements?: readonly AcceptancePromise[];
  acceptance?: readonly AcceptancePromise[];
  goal: string;
  plannerNote?: string;
  layers: readonly {
    id?: string;
    title: string;
    items: readonly {
      id?: string;
      title: string;
      instruction: string;
      doneWhen?: string;
      successTools?: readonly string[];
      requirementIds?: readonly string[];
      requiresAnyWrite?: boolean;
    }[];
  }[];
  targetMapId?: string;
  now: Date;
}): WorkPlan {
  const layers: WorkLayer[] = input.layers.map((layer, li) => ({
    id: layer.id?.trim() || `L${li + 1}`,
    title: layer.title.trim(),
    items: layer.items.map((it, ii) => ({
      id: it.id?.trim() || `L${li + 1}-${ii + 1}`,
      title: it.title.trim(),
      instruction: it.instruction.trim(),
      doneWhen: it.doneWhen?.trim() || undefined,
      successTools: sanitizeToolNames(it.successTools),
      ...(it.requirementIds ? { requirementIds: it.requirementIds } : {}),
      requiresAnyWrite: it.requiresAnyWrite === true || undefined,
      status: "pending" as const,
    })),
  }));
  const plan: WorkPlan = {
    id: `wp_${input.now.getTime().toString(36)}`,
    goal: input.goal,
    ...(input.acceptance ? { acceptance: input.acceptance } : {}),
    ...(input.requirements ? { requirements: input.requirements } : {}),
    createdAt: input.now.toISOString(),
    layers,
    currentLayerIndex: 0,
    currentItemId: null,
    plannerNote: input.plannerNote,
    targetMapId: input.targetMapId,
  };
  activateFirstPending(plan);
  return plan;
}

function normalizeLayer(
  layer: unknown,
  li: number
): {
  id?: string;
  title: string;
  items: readonly {
    id?: string;
    title: string;
    instruction: string;
    doneWhen?: string;
    successTools?: readonly string[];
    requirementIds?: readonly string[];
  }[];
} | null {
  if (!isRecord(layer)) return null;
  // 플래너가 title/items 대신 name/steps 를 쓰는 드리프트를 흔히 낸다 — 의미가 같은 별칭만 수용한다.
  const title = firstNonEmptyString(layer.title, layer.name, layer.label);
  const rawItems = [layer.items, layer.steps, layer.tasks].find((value) => Array.isArray(value));
  if (!title || !Array.isArray(rawItems) || rawItems.length === 0) return null;
  const items = rawItems
    .map((it, ii) => {
      if (!isRecord(it)) return null;
      const itemTitle = firstNonEmptyString(it.title, it.name, it.label);
      const instruction = firstNonEmptyString(it.instruction, it.detail, it.description, it.task);
      if (!itemTitle || !instruction) return null;
      return {
        id: typeof it.id === "string" ? it.id : `L${li + 1}-${ii + 1}`,
        title: itemTitle,
        instruction,
        ...(Array.isArray(it.requirementIds) ? { requirementIds: it.requirementIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0) } : {}),
        doneWhen: typeof it.doneWhen === "string" ? it.doneWhen : undefined,
        successTools: Array.isArray(it.successTools)
          ? it.successTools.filter((t): t is string => typeof t === "string")
          : undefined,
      };
    })
    .filter((it): it is NonNullable<typeof it> => it !== null);
  if (items.length === 0) return null;
  return {
    id: typeof layer.id === "string" ? layer.id : `L${li + 1}`,
    title,
    items,
  };
}

/** 별칭 후보 중 처음 나오는 비어 있지 않은 문자열(트림)을 고른다. 없으면 빈 문자열. */
function firstNonEmptyString(...candidates: readonly unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) return candidate.trim();
  }
  return "";
}

/**
 * Keep unknown requirements visible and unmet. Dropping an invented tool used to
 * silently turn an explicit acceptance contract into an unrestricted completion.
 */
function sanitizeToolNames(tools: readonly string[] | undefined): readonly string[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  const cleaned = [...new Set(tools.map((t) => t.trim()).filter((t) => t.length > 0))];
  return cleaned.length > 0 ? cleaned : undefined;
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    const inner = fence[1].trim();
    if (inner.startsWith("{")) return inner;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function activateFirstPending(plan: WorkPlan): WorkItem | null {
  for (let li = 0; li < plan.layers.length; li += 1) {
    const layer = plan.layers[li]!;
    const next = layer.items.find(
      (it) => it.status === "pending" || it.status === "in_progress" || it.status === "blocked"
    );
    if (next) {
      plan.currentLayerIndex = li;
      plan.currentItemId = next.id;
      if (next.status === "pending" || next.status === "blocked") next.status = "in_progress";
      return next;
    }
  }
  plan.currentItemId = null;
  return null;
}

export function getCurrentWorkItem(plan: WorkPlan): WorkItem | null {
  const layer = plan.layers[plan.currentLayerIndex];
  if (!layer || !plan.currentItemId) return null;
  return layer.items.find((it) => it.id === plan.currentItemId) ?? null;
}

export function summarizeWorkPlan(plan: WorkPlan): WorkPlanProgressSummary {
  const items = plan.layers.flatMap((l) => l.items);
  const itemsDone = items.filter((i) => i.status === "done" || i.status === "skipped").length;
  const layersDone = plan.layers.filter((l) =>
    l.items.every((i) => i.status === "done" || i.status === "skipped")
  ).length;
  const current = getCurrentWorkItem(plan);
  const layer = plan.layers[plan.currentLayerIndex];
  return {
    goal: plan.goal,
    layersTotal: plan.layers.length,
    layersDone,
    itemsTotal: items.length,
    itemsDone,
    current:
      current && layer
        ? {
            layerTitle: layer.title,
            itemTitle: current.title,
            instruction: current.instruction,
            doneWhen: current.doneWhen,
          }
        : undefined,
    remainingTitles: items
      .filter((i) => i.status === "pending" || i.status === "in_progress")
      .map((i) => i.title),
  };
}

/** Injected into generator context each sprint (current item only). */
export function formatWorkPlanForOrchestration(plan: WorkPlan): string {
  const s = summarizeWorkPlan(plan);
  const lines = [
    "HARNESS (plan-execute-verify / Ralph): execute ONLY the current work item this burst. Do not skip ahead.",
    `Goal: ${s.goal}`,
    `Progress: layers ${s.layersDone}/${s.layersTotal}, items ${s.itemsDone}/${s.itemsTotal}`,
  ];
  if (plan.plannerNote) lines.push(`Planner note: ${plan.plannerNote}`);
  // 뷰포트가 없는 턴에도 대상 맵이 남아야 한다 — 이 줄이 없으면 자율 계속 턴에서 모델이
  // 대상을 잃고 새 맵을 만드는 쪽으로 샜다(진단 근본원인 14).
  if (plan.targetMapId) {
    lines.push(`Target map: ${plan.targetMapId} — 이 계획의 수정 대상. 새 맵을 만들지 말고 이 맵을 편집한다.`);
  }
  if (s.current) {
    lines.push(`Current layer: ${s.current.layerTitle}`);
    lines.push(`Current item: ${s.current.itemTitle}`);
    lines.push(`Worker instruction:\n${s.current.instruction}`);
    if (s.current.doneWhen) lines.push(`Done when: ${s.current.doneWhen}`);
    const required = getCurrentWorkItem(plan)?.successTools ?? [];
    if (required.length) lines.push(`Required successful tools for this item (including prior continuations): ${required.join(", ")}`);
    const unknown = required.filter((name) => !getTool(name));
    if (unknown.length) lines.push(`Invalid tool requirements: ${unknown.join(", ")}. Use find_tools, then correct these names with set_work_plan while preserving all unfinished checklist requirements. They cannot count as completed.`);
    if (getCurrentWorkItem(plan)?.requiresAnyWrite) {
      lines.push("Fallback completion gate: at least one write tool must succeed before completing this item.");
    }
  } else {
    lines.push("All items complete. Summarize results briefly for the user.");
  }
  if (s.remainingTitles.length > 1) {
    lines.push(`Remaining: ${s.remainingTitles.join(" → ")}`);
  }
  lines.push(
    "When all of this item's successTools succeed, the harness may auto-complete; " +
      "or call complete_work_item only after every listed tool succeeded for this item, including its continuations. " +
      "If blocked (wrong tileset material, out of region, etc.), call skip_work_item with a note — " +
      "do NOT complete a failed item by succeeding a different tool. " +
      "If the item's premise is wrong (e.g. it prescribes creating a new map but the user asked to fix an " +
      "existing one), call set_work_plan to correct the plan instead of satisfying the wrong successTools. " +
      "To restructure the remaining plan, call set_work_plan (full replacement). " +
      "Do not claim the full goal is finished while items remain."
  );
  return lines.join("\n");
}

/**
 * Ralph re-injection when the generator tries to exit with work remaining.
 * Externalized plan state is the source of truth (not model memory).
 */
export function formatRalphContinueMessage(plan: WorkPlan): string {
  const s = summarizeWorkPlan(plan);
  const lines = [
    "RALPH CONTINUE: you attempted to stop, but the WorkPlan is incomplete.",
    "Do not write a long farewell. Resume the current item with tools now.",
    `Progress: ${s.itemsDone}/${s.itemsTotal} items done.`,
  ];
  if (s.current) {
    lines.push(`Current item: ${s.current.itemTitle}`);
    lines.push(`Instruction:\n${s.current.instruction}`);
    if (s.current.doneWhen) lines.push(`Done when: ${s.current.doneWhen}`);
  }
  return lines.join("\n");
}

export function formatWorkPlanUserVisible(plan: WorkPlan): string {
  const s = summarizeWorkPlan(plan);
  const lines = [`📋 작업 계획 (${s.itemsDone}/${s.itemsTotal})`, `목표: ${s.goal}`];
  if (plan.plannerNote) lines.push(`전략: ${plan.plannerNote}`);
  for (const layer of plan.layers) {
    lines.push(`\n### ${layer.title}`);
    for (const it of layer.items) {
      const mark =
        it.status === "done"
          ? "✅"
          : it.status === "in_progress"
            ? "▶️"
            : it.status === "skipped"
              ? "⏭️"
              : it.status === "blocked"
                ? "⛔"
                : "⬜";
      lines.push(`${mark} ${it.title}`);
    }
  }
  if (s.current) {
    lines.push(`\n다음: **${s.current.itemTitle}** — ${s.current.instruction}`);
  }
  return lines.join("\n");
}

/**
 * Should the harness Ralph-continue (re-inject + keep looping) instead of ending the turn?
 * Code decides continuation; model does not get a silent early exit on multi-step plans.
 */
export function shouldRalphContinue(
  plan: WorkPlan | null,
  opts: {
    readonly autoStepsUsed: number;
    readonly assistantText?: string;
  }
): boolean {
  if (!plan || isWorkPlanComplete(plan)) return false;
  const current = getCurrentWorkItem(plan);
  if (!current) return false;
  // 막힌 항목은 사람의 판단을 기다린다 — 재주입도, 자동 계속도 하지 않는다(2026-09-03).
  if (current.status === "blocked") return false;
  if (opts.autoStepsUsed >= MAX_WORK_PLAN_AUTO_STEPS_PER_TURN) return false;
  const remaining = summarizeWorkPlan(plan).itemsTotal - summarizeWorkPlan(plan).itemsDone;
  if (remaining > MAX_WORK_PLAN_ITEMS_PER_BURST && opts.autoStepsUsed >= MAX_WORK_PLAN_AUTO_STEPS_PER_TURN) {
    return false;
  }
  // Incomplete plans keep looping through a trailing ?; only explicit quick-replies pause.
  if (opts.assistantText?.includes(QUICK_REPLY_MARKER)) {
    return false;
  }
  return true;
}

/**
 * 산출물 게이트 — successTools 이름 매칭을 통과한 뒤 **결과물 상태**를 한 번 더 본다.
 *
 * 2026-08-28 실측: doneWhen 이 "생성되고 칠해짐" 이어도 successTools 가 ["create_map"] 이면
 * create_map 성공 즉시 done 이 됐다. doneWhen 은 자연어라 기계가 못 읽으므로, 대신 산출물이
 * 비어 있는지를 코드가 직접 확인한다(`workItemOutcome.verifyCreatedMapsAuthored`).
 */
export type WorkItemOutcomeGate = (item: WorkItem) => { ok: true } | { ok: false; reason: string };

export function advanceWorkPlanFromTools(
  plan: WorkPlan,
  successfulTools: readonly string[],
  gate?: WorkItemOutcomeGate
): { completed: WorkItem | null; next: WorkItem | null; blocked?: { item: WorkItem; reason: string } } {
  const current = getCurrentWorkItem(plan);
  if (!current || current.status !== "in_progress") {
    return { completed: null, next: activateFirstPending(plan) };
  }
  const needed = current.successTools ?? [];
  const hasSuccessfulWrite = successfulTools.some((name) => getTool(name)?.mode === "write");
  if (current.requiresAnyWrite && !hasSuccessfulWrite) return { completed: null, next: current };
  // successTools 없는 일반 항목은 자동 완료 금지 — 아무 툴이나 성공했다고 다음 단계로 넘어가 thrash 유발.
  if (needed.length === 0 && !current.requiresAnyWrite) return { completed: null, next: current };
  const tools = new Set(successfulTools);
  const allSucceeded = needed.every((name) => tools.has(name));
  if (!allSucceeded) return { completed: null, next: current };
  const verdict = gate?.(current);
  if (verdict && !verdict.ok) {
    return { completed: null, next: current, blocked: { item: current, reason: verdict.reason } };
  }

  current.status = "done";
  const next = activateFirstPending(plan);
  return { completed: current, next };
}

/**
 * successTools 가 있으면 **모두** 이번 턴에 성공해야 complete 허용(읽기 포함).
 * `create_map + create_transfer_pair` 같은 복합 항목을 첫 툴 하나만으로 완료 처리하면 뒤 작업이
 * 영구 누락된다. successTools 가 비어 있으면 자유 complete(레거시 항목).
 */
export function canCompleteWorkItem(
  item: WorkItem,
  successfulTools: readonly string[] | undefined,
  gate?: WorkItemOutcomeGate,
): { ok: true } | { ok: false; reason: string; missingTools?: readonly string[] } {
  const needed = item.successTools ?? [];
  if (item.requiresAnyWrite) {
    const hasSuccessfulWrite = (successfulTools ?? []).some((name) => getTool(name)?.mode === "write");
    if (!hasSuccessfulWrite) {
      return {
        ok: false,
        reason: `항목 '${item.title}' 완료 조건 미충족: 성공한 쓰기 툴 기록이 없습니다.`,
      };
    }
  }
  if (needed.length === 0) return gate?.(item) ?? { ok: true };
  const tools = new Set(successfulTools ?? []);
  const missing = needed.filter((name) => !tools.has(name));
  if (missing.length === 0) return gate?.(item) ?? { ok: true };
  return {
    ok: false,
    missingTools: missing,
    reason:
      `항목 '${item.title}' 완료 조건 미충족: 필수 successTools 중 ${missing.join(", ")} 성공 기록이 없습니다. ` +
      `누락된 툴을 성공시키거나, 항목 전제가 틀렸다면(예: 사용자가 기존 맵 수정을 요청했는데 항목이 신축을 요구) ` +
      `set_work_plan으로 계획을 고치거나 skip_work_item으로 건너뛰세요.`,
  };
}

export type CompleteWorkItemResult =
  | { ok: true; item: WorkItem; alreadyDone?: boolean }
  | { ok: false; reason: string; item?: WorkItem };

/** 아직 열려 있는(대기/진행) 항목 id — 오류 메시지에서 모델에 유효값을 알려주는 용도. */
export function openWorkItemIds(plan: WorkPlan): string[] {
  return plan.layers.flatMap((layer) => layer.items)
    .filter((item) => item.status === "pending" || item.status === "in_progress")
    .map((item) => item.id);
}

export function completeWorkItemById(
  plan: WorkPlan,
  itemId: string,
  note?: string,
  options?: {
    successfulTools?: readonly string[];
    force?: boolean;
    outcomeGate?: WorkItemOutcomeGate;
  },
): CompleteWorkItemResult {
  for (const layer of plan.layers) {
    const it = layer.items.find((i) => i.id === itemId);
    if (!it) continue;
    // 이미 끝난 항목은 idempotent 다(2026-09-02 실측, reports/place-concept-inn/e2e/receipt.json):
    // place_concept 성공 → 라운드 끝 successTools 자동 완료(성공 툴 집합은 다음 항목 기준으로 비워짐)
    // → 모델이 같은 항목을 명시 complete_work_item → 「성공 기록이 없습니다」 거부 → 모델이 같은 맵을
    // 한 번 더 시공했다. 완료 게이트는 열려 있는 항목에만 의미가 있다.
    if (it.status === "done" || it.status === "skipped") {
      if (note && !it.note) it.note = note;
      return { ok: true, item: it, alreadyDone: true };
    }
    if (!options?.force) {
      if (plan.currentItemId !== itemId) {
        return { ok: false, item: it, reason: `현재 항목 '${plan.currentItemId}'을 먼저 완료하세요. 다른 항목의 성공 기록을 사용할 수 없습니다.` };
      }
      const gate = canCompleteWorkItem(it, options?.successfulTools, options?.outcomeGate);
      if (!gate.ok) return { ok: false, reason: gate.reason, item: it };
    }
    it.status = "done";
    if (note) it.note = note;
    if (plan.currentItemId === itemId) activateFirstPending(plan);
    return { ok: true, item: it };
  }
  // 실측(2026-08-30): 모델이 "L1-1" 같은 라벨을 지어내 complete_work_item 을 반복 실패했다.
  // 유효 id 를 오류에 실어 보내면 같은 턴에서 스스로 교정한다.
  return { ok: false, reason: `항목을 찾지 못했습니다: ${itemId} — 유효한 항목 id: ${openWorkItemIds(plan).join(", ") || "(없음)"}` };
}

/**
 * 항목을 `blocked` 로 표시한다 — 진행이 멈췄고 사람이 봐야 한다는 표시다.
 *
 * `currentItemId` 는 **그대로 둔다**: 다음 항목으로 넘기면 막힌 이유가 조용히 묻히고 뒤 항목이
 * 같은 전제 위에서 또 실패한다. 드라이버·Ralph 는 `blocked` 를 보고 멈추고(`shouldRalphContinue`),
 * 사용자의 다음 메시지가 `reactivateBlockedWorkItems` 로 되살린다.
 */
export function blockWorkItemById(plan: WorkPlan, itemId: string, reason: string): WorkItem | null {
  for (const layer of plan.layers) {
    const it = layer.items.find((i) => i.id === itemId);
    if (!it) continue;
    if (it.status === "done" || it.status === "skipped") return null;
    it.status = "blocked";
    it.note = reason;
    return it;
  }
  return null;
}

/** 막힌 항목을 다시 진행 대상으로 돌린다(사용자의 새 메시지 = 재시도 신호). 되살린 항목 수를 준다. */
export function reactivateBlockedWorkItems(plan: WorkPlan): number {
  let revived = 0;
  for (const layer of plan.layers) {
    for (const item of layer.items) {
      if (item.status !== "blocked") continue;
      item.status = "pending";
      revived += 1;
    }
  }
  if (revived > 0) activateFirstPending(plan);
  return revived;
}

export function skipWorkItemById(plan: WorkPlan, itemId: string, note?: string): WorkItem | null {
  for (const layer of plan.layers) {
    const it = layer.items.find((i) => i.id === itemId);
    if (!it) continue;
    it.status = "skipped";
    if (note) it.note = note;
    if (plan.currentItemId === itemId) activateFirstPending(plan);
    return it;
  }
  return null;
}

export function isWorkPlanComplete(plan: WorkPlan): boolean {
  return plan.layers.every((l) => l.items.every((i) => i.status === "done" || i.status === "skipped"));
}


/**
 * Emergency fallback only when planner API/parse fails — single sprint wrapping the raw goal.
 * 시공 생성기(author_village/author_house)를 문장 정규식으로 강제하지 않는다 — 「담장만 손봐줘」 폴백이
 * 「집 최소 1채 신축」을 완료 조건으로 갖던 경로다. 수정 여부는 의도 선언이 알려 준다(opts.modifies).
 */
export function buildDefaultWorkPlan(goal: string, now = new Date(), opts: { readonly modifies?: boolean } = {}): WorkPlan {
  const genre = detectNarrativeHorrorGenre(goal);
  const genreTools = requiredSuccessToolsForUserText(goal);
  const successTools = genreTools.length > 0 ? [...genreTools] : undefined;
  // 수정 요청이면 폴백 지시문에 신축 금지를 동봉한다 — 폴백은 계획 문장이 goal 그대로라
  // 대상 규칙이 붙을 자리가 여기밖에 없다.
  const modifyGuard = opts.modifies === true
    ? "\n\n[대상 규칙] 기존 맵 수정 요청이다. 컨텍스트의 현재 맵을 대상으로 편집하고 "
      + "create_map / author_house / author_village(kind:\"new\") / 방 세션 시작을 쓰지 말 것."
    : "";
  const instruction =
    (genre != null
      ? `${templateToolInstruction(genre)}

요청: ${goal}`
      : goal) + modifyGuard;
  return workPlanFromOrchestratorDecision(
    {
      action: "new_plan",
      goal,
      plannerNote:
        genre != null
          ? `fallback template (planner parse/API failed); ${plannerHintForNarrativeHorrorGenre(genre)}`
          : "fallback template (planner parse/API failed)",
      layers: [
        {
          title: "실행",
          items: [
            {
              title: genre != null ? `장르 템플릿: ${genre}` : "요청 처리",
              instruction,
              doneWhen: "User request addressed with write tools where applicable",
              successTools,
              requiresAnyWrite: successTools === undefined,
            },
          ],
        },
      ],
    },
    now,
  );
}

/** @deprecated tests only — planner LLM decides in production. */
export function isHardAuthoringQuery(text: string): boolean {
  return text.trim().length >= 40;
}

/** @deprecated */
export function isWorkPlanContinueQuery(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "계속" || t === "이어서" || t === "다음" || t === "continue" || t.startsWith("계속");
}

/** @deprecated — production uses planner LLM; never create plans from this. */
export function shouldCreateWorkPlan(_text: string, _existing: WorkPlan | null): boolean {
  return false;
}

/** @deprecated */
export function shouldResumeWorkPlan(_text: string, existing: WorkPlan | null): boolean {
  return Boolean(existing && !isWorkPlanComplete(existing));
}
