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
export type WorkItemStatus = "pending" | "in_progress" | "done" | "skipped" | "blocked";

export interface WorkItem {
  readonly id: string;
  readonly title: string;
  /** Concrete worker instruction (tool names + numbers preferred). */
  readonly instruction: string;
  /**
   * Acceptance / done-when (Anthropic sprint-contract style).
   * Injected into worker context so the model knows when to complete_work_item.
   */
  readonly doneWhen?: string;
  /** Write tools that mark this item done when any succeeds (orchestrator-authored). */
  readonly successTools?: readonly string[];
  status: WorkItemStatus;
  note?: string;
}

export interface WorkLayer {
  readonly id: string;
  readonly title: string;
  readonly items: WorkItem[];
}

export interface WorkPlan {
  readonly id: string;
  readonly goal: string;
  readonly createdAt: string;
  readonly layers: WorkLayer[];
  currentLayerIndex: number;
  currentItemId: string | null;
  /** Planner memo (strategy only; not executed as tools). */
  readonly plannerNote?: string;
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
export type OrchestratorDecision =
  | { readonly action: "direct"; readonly reason?: string }
  | { readonly action: "resume"; readonly reason?: string }
  | {
      readonly action: "new_plan" | "replan";
      readonly goal: string;
      readonly plannerNote?: string;
      readonly layers: readonly {
        readonly id?: string;
        readonly title: string;
        readonly items: readonly {
          readonly id?: string;
          readonly title: string;
          readonly instruction: string;
          readonly doneWhen?: string;
          readonly successTools?: readonly string[];
        }[];
      }[];
    };

export const ORCHESTRATOR_SYSTEM_PROMPT = `You are the **planner** agent in a modern RPG map/event editor harness (Anthropic planner–generator–evaluator / plan-then-execute).

You do NOT edit maps. You only decide how work is decomposed.

Harness contract:
1. Output **JSON only** (no markdown fences, no prose outside JSON).
2. action=direct — single tool turn is enough (one NPC line, small paint, simple Q&A).
3. action=resume — incomplete WorkPlan already matches the user goal; keep it.
4. action=new_plan — first multi-step hard request; author goal + layers + items.
5. action=replan — active plan is wrong/stale or user wants restart/wipe/new goal.
6. Prefer 2–4 layers, 1–3 items each, max ~8 items. Each item = one coherent sprint. Simple requests (one village, a few houses, terrain paint) should use action=direct or a 2-layer plan with ≤4 items — do NOT over-decompose.
7. Every item needs:
   - title (short)
   - instruction (concrete tools/numbers: author_house, author_village, create_map, place_npc, create_transfer_pair, upsert_event, fill_region, paint_road, script_cutscene_preset, make_horror_loop, make_gallery_room, … — 건설 지시는 목표 맵과 정확한 수량을 반드시 명시)
   - doneWhen (acceptance: what must be true when this item is complete)
   - successTools (optional write tool names that auto-complete the item)
8. Typical RPG content layers: meta/wipe → hub map → landmarks → side maps/transfers → quest chain → polish/QA.
9. Titles/instructions/doneWhen in the **same language as the user** (usually Korean).
${NARRATIVE_HORROR_PLANNER_RULE}

JSON schema:
{
  "action": "direct" | "resume" | "new_plan" | "replan",
  "reason": "short why",
  "goal": "required for new_plan/replan",
  "plannerNote": "optional strategy",
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
export const MAX_WORK_PLAN_AUTO_STEPS_PER_TURN = 12;

/** Soft cap: do not Ralph-continue past this many remaining steps in one burst. */
export const MAX_WORK_PLAN_ITEMS_PER_BURST = 16;

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
  parts.push("Respond with JSON only.");
  return parts.join("\n\n");
}

export function parseOrchestratorDecision(raw: string): OrchestratorDecision | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const action = parsed.action;
  if (action === "direct" || action === "resume") {
    return {
      action,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    };
  }
  if (action !== "new_plan" && action !== "replan") return null;
  const goal = typeof parsed.goal === "string" ? parsed.goal.trim() : "";
  const layersRaw = parsed.layers;
  if (!goal || !Array.isArray(layersRaw) || layersRaw.length === 0) return null;
  const layers = layersRaw
    .map((layer, li) => normalizeLayer(layer, li))
    .filter((layer): layer is NonNullable<typeof layer> => layer !== null);
  if (layers.length === 0) return null;
  return {
    action,
    goal,
    plannerNote: typeof parsed.plannerNote === "string" ? parsed.plannerNote : undefined,
    layers,
  };
}

export function workPlanFromOrchestratorDecision(
  decision: Extract<OrchestratorDecision, { action: "new_plan" | "replan" }>,
  now = new Date()
): WorkPlan {
  return createWorkPlanFromLayers({
    goal: decision.goal,
    plannerNote: decision.plannerNote,
    layers: decision.layers,
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
    plannerNote: typeof args.plannerNote === "string" ? args.plannerNote : undefined,
    layers,
    now,
  });
}

function createWorkPlanFromLayers(input: {
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
    }[];
  }[];
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
      status: "pending" as const,
    })),
  }));
  const plan: WorkPlan = {
    id: `wp_${input.now.getTime().toString(36)}`,
    goal: input.goal.slice(0, 500),
    createdAt: input.now.toISOString(),
    layers,
    currentLayerIndex: 0,
    currentItemId: null,
    plannerNote: input.plannerNote,
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
  }[];
} | null {
  if (!isRecord(layer)) return null;
  const title = typeof layer.title === "string" ? layer.title.trim() : "";
  if (!title || !Array.isArray(layer.items) || layer.items.length === 0) return null;
  const items = layer.items
    .map((it, ii) => {
      if (!isRecord(it)) return null;
      const itemTitle = typeof it.title === "string" ? it.title.trim() : "";
      const instruction = typeof it.instruction === "string" ? it.instruction.trim() : "";
      if (!itemTitle || !instruction) return null;
      return {
        id: typeof it.id === "string" ? it.id : `L${li + 1}-${ii + 1}`,
        title: itemTitle,
        instruction,
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

function sanitizeToolNames(tools: readonly string[] | undefined): readonly string[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  const cleaned = tools.map((t) => t.trim()).filter((t) => t.length > 0 && t.length < 64);
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
  if (s.current) {
    lines.push(`Current layer: ${s.current.layerTitle}`);
    lines.push(`Current item: ${s.current.itemTitle}`);
    lines.push(`Worker instruction:\n${s.current.instruction}`);
    if (s.current.doneWhen) lines.push(`Done when: ${s.current.doneWhen}`);
  } else {
    lines.push("All items complete. Summarize results briefly for the user.");
  }
  if (s.remainingTitles.length > 1) {
    lines.push(`Remaining: ${s.remainingTitles.slice(0, 10).join(" → ")}`);
  }
  lines.push(
    "When this item's successTools write tools succeed, the harness may auto-complete; " +
      "or call complete_work_item only after those tools succeeded this turn. " +
      "If blocked (wrong tileset material, out of region, etc.), call skip_work_item with a note — " +
      "do NOT complete a failed item by succeeding a different tool. " +
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
    lines.push(`\n다음: **${s.current.itemTitle}** — ${s.current.instruction.slice(0, 200)}`);
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
  if (!getCurrentWorkItem(plan)) return false;
  if (opts.autoStepsUsed >= MAX_WORK_PLAN_AUTO_STEPS_PER_TURN) return false;
  const remaining = summarizeWorkPlan(plan).itemsTotal - summarizeWorkPlan(plan).itemsDone;
  if (remaining > MAX_WORK_PLAN_ITEMS_PER_BURST && opts.autoStepsUsed >= MAX_WORK_PLAN_AUTO_STEPS_PER_TURN) {
    return false;
  }
  // If the model is clearly asking the user a clarifying question, stop (human-in-the-loop).
  if (opts.assistantText && assistantLooksLikeBlockingQuestion(opts.assistantText)) {
    return false;
  }
  return true;
}

function assistantLooksLikeBlockingQuestion(text: string): boolean {
  const t = text.trim();
  if (t.length < 8) return false;
  // Short heuristic only for HITL gate — not for planning content.
  if (/[?？]\s*$/.test(t) && t.length < 400) return true;
  if (/(선택해|골라|어떻게 할까요|진행할까요|원하시|말해 주|알려 주)/.test(t) && t.length < 500) {
    return true;
  }
  return false;
}

export function advanceWorkPlanFromTools(
  plan: WorkPlan,
  successfulWriteTools: readonly string[]
): { completed: WorkItem | null; next: WorkItem | null } {
  const current = getCurrentWorkItem(plan);
  if (!current || current.status !== "in_progress") {
    return { completed: null, next: activateFirstPending(plan) };
  }
  const needed = current.successTools ?? [];
  // successTools 없는 항목은 자동 완료 금지 — 아무 쓰기나 성공했다고 다음 단계로 넘어가 thrash 유발.
  // (예: 탁자 place_props 실패 후 place_npc 성공으로 탁자 항목 자동 완료)
  if (needed.length === 0) return { completed: null, next: current };
  const tools = new Set(successfulWriteTools);
  const hit = needed.some((name) => tools.has(name));
  if (!hit) return { completed: null, next: current };

  current.status = "done";
  const next = activateFirstPending(plan);
  return { completed: current, next };
}

/**
 * successTools가 있으면 그중 하나라도 이번 턴 쓰기 성공에 있어야 complete 허용.
 * successTools가 비어 있으면 자유 complete(레거시 항목).
 * force=true 는 skip 경로 대체용이 아니라 테스트/내부용 — 일반 complete_work_item 에서는 쓰지 않는다.
 */
export function canCompleteWorkItem(
  item: WorkItem,
  successfulWriteTools: readonly string[] | undefined,
): { ok: true } | { ok: false; reason: string } {
  const needed = item.successTools ?? [];
  if (needed.length === 0) return { ok: true };
  const tools = new Set(successfulWriteTools ?? []);
  if (needed.some((name) => tools.has(name))) return { ok: true };
  return {
    ok: false,
    reason:
      `항목 '${item.title}' 완료 조건 미충족: successTools(${needed.join(", ")}) 성공 기록이 없습니다. ` +
      `해당 툴로 성공하거나 skip_work_item으로 건너뛰세요.`,
  };
}

export type CompleteWorkItemResult =
  | { ok: true; item: WorkItem }
  | { ok: false; reason: string; item?: WorkItem };

export function completeWorkItemById(
  plan: WorkPlan,
  itemId: string,
  note?: string,
  options?: { successfulWriteTools?: readonly string[]; force?: boolean },
): CompleteWorkItemResult {
  for (const layer of plan.layers) {
    const it = layer.items.find((i) => i.id === itemId);
    if (!it) continue;
    if (!options?.force) {
      const gate = canCompleteWorkItem(it, options?.successfulWriteTools);
      if (!gate.ok) return { ok: false, reason: gate.reason, item: it };
    }
    it.status = "done";
    if (note) it.note = note;
    if (plan.currentItemId === itemId) activateFirstPending(plan);
    return { ok: true, item: it };
  }
  return { ok: false, reason: `항목을 찾지 못했습니다: ${itemId}` };
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

/** 건설 의도 감지: 마을 → author_village, 집/건물 → author_house. */
function detectConstructionIntent(goal: string): readonly string[] | null {
  if (/마을|도시|정착지|city|town|settlement/i.test(goal)) return ["author_village"];
  if (/집|건물|house/i.test(goal)) return ["author_house"];
  return null;
}

/** Emergency fallback only when planner API/parse fails — single sprint wrapping the raw goal. */
export function buildDefaultWorkPlan(goal: string, now = new Date()): WorkPlan {
  const genre = detectNarrativeHorrorGenre(goal);
  const genreTools = requiredSuccessToolsForUserText(goal);
  const constructionTools = detectConstructionIntent(goal);
  const successTools =
    genreTools.length > 0
      ? [...genreTools]
      : constructionTools ?? ["create_map", "place_npc", "upsert_event", "script_cutscene_preset", "make_horror_loop", "make_gallery_room"];
  const instruction =
    genre != null
      ? `${templateToolInstruction(genre)}

요청: ${goal.slice(0, 600)}`
      : goal.slice(0, 800);
  return workPlanFromOrchestratorDecision(
    {
      action: "new_plan",
      goal: goal.slice(0, 400),
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
