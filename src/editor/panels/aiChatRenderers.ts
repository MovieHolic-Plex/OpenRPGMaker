import { ruleToolRejectionText, type ProposedCall } from "@/ai/assistantSession";
import { AGENT_RUN_MAX_TOTAL_STEPS } from "@/ai/assistantSession";
import type { WorkItem, WorkPlan } from "@/ai/workPlan";
import { isItemFinished, layerItems, planLayers } from "./aiWorkPlanPages";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import type { ToolResult } from "@/editor/tools";
import { getGrammarProfile, type VocabularyProposalCard } from "@/editor/tools/v3";
import type { Project, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";
import { deckIcon } from "./aiDeckIcons";
import { toolIconKey, toolLabel } from "./aiToolLabels";

const AI_PROGRESS_TOOL_LIMIT = 30;
const DRAFT_DESTRUCTIVE_TOOL_NAMES = new Set(["remove_map", "remove_event", "clear_region", "delete_tile_group", "reset_project"]);

export function formatAiRunningStatus(
  startedAt: number,
  now: number,
  toolCount: number,
  maxTools = AI_PROGRESS_TOOL_LIMIT,
  phaseLabel?: string | null,
  activityLine?: string | null,
): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const activity = activityLine?.trim();
  const label = phaseLabel?.trim();
  const prefix = label ? `${label}…` : "생각 중…";
  const elapsed = `${elapsedSeconds}초`;
  // 분모(상한)는 진단용 — 일상 UI에는 호출 횟수만.
  void maxTools;
  if (activity) return `${activity} · ${elapsed}${toolCount > 0 ? ` · 도구 ${toolCount}` : ""}`;
  return toolCount > 0 ? `${prefix} ${elapsed} · 도구 ${toolCount}` : `${prefix} ${elapsed}`;
}

export function isDraftDestructiveTool(name: string): boolean {
  return DRAFT_DESTRUCTIVE_TOOL_NAMES.has(name);
}

export function failedToolRetrySummary(summary: string): string {
  const counts = [...summary.matchAll(/(\d+)회/gu)]
    .map((match) => Number(match[1]))
    .filter((count) => Number.isFinite(count) && count > 0);
  const retryCount = counts.length > 0 ? Math.max(...counts) : 1;
  return `내부 재시도 ${retryCount}회`;
}

function truncateFailureSummary(text: string): string {
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export function failedToolVisibleSummary(result: Pick<ToolResult, "summary" | "issues">): string {
  const issueMessage = result.issues?.[0]?.message?.trim() ?? "";
  const merged = issueMessage && !result.summary.includes(issueMessage)
    ? `${result.summary}: ${issueMessage}`
    : result.summary;
  return `${truncateFailureSummary(merged)} (${failedToolRetrySummary(result.summary)})`;
}

export function formatToolActivityLine(name: string, result: ToolResult): string {
  const mark = result.ok ? "✓" : "✗";
  const draftPrefix = result.ok && isDraftDestructiveTool(name) ? "(초안) " : "";
  const summary = result.summary.trim();
  const line = summary.length > 0 ? summary : name;
  return ruleToolRejectionText(name, result) ?? `${draftPrefix}${mark} ${line}`;

}

export function reasoningToggleText(count: number, collapsed: boolean): string {
  const label = count > 1 ? `💭 추론 ${count}회` : "💭 추론";
  return collapsed ? `${label} 보기 ▸` : `${label} ▾`;
}

// ── 자율 실행 런 표면(todo 6) ────────────────────────────────────────────────
// 순수 렌더 헬퍼만 둔다(패널 배선은 aiChatPanel.ts). 세션 이벤트가 아닌 상태는
// 여기서 파싱/렌더하고, 이벤트 구독·수명주기는 패널이 소유한다.

export interface AutonomousRunBudget {
  readonly used: number;
  readonly total: number;
  readonly exhausted?: boolean;
}

/**
 * 드라이버(todo 2)의 status 이벤트에서 예산(used/48)을 파싱한다.
 * "자율 실행 계속 (N/48)" → used=N, exhausted=false / "자율 실행 예산 소진 …" → used=total, exhausted=true.
 * 무관한 텍스트는 null(패널은 표시를 갱신하지 않는다).
 */
export function parseAutonomousRunBudget(text: string): AutonomousRunBudget | null {
  const match = /자율 실행 계속 \((\d+)\/(\d+)\)/u.exec(text);
  if (match) {
    const used = Number(match[1]);
    const total = Number(match[2]);
    if (Number.isFinite(used) && Number.isFinite(total)) return { used, total, exhausted: false };
    return null;
  }
  if (/자율 실행 예산 소진/u.test(text)) {
    return { used: AGENT_RUN_MAX_TOTAL_STEPS, total: AGENT_RUN_MAX_TOTAL_STEPS, exhausted: true };
  }
  return null;
}

function currentRunItemTitle(plan: WorkPlan): string {
  const items = planLayers(plan).flatMap(layerItems);
  const current = items.find((item) => item.status === "in_progress")
    ?? items.find((item) => Boolean(item.id) && item.id === plan.currentItemId);
  const title = (current?.title ?? plan.goal ?? "작업").trim();
  return title || "작업";
}

function isPlanComplete(items: readonly WorkItem[]): boolean {
  return items.length > 0 && items.every(isItemFinished);
}

/** 막힌 항목(사람 판단 대기) — 있으면 앞줄이 그것을 먼저 말한다. */
function blockedItem(items: readonly WorkItem[]): WorkItem | null {
  return items.find((item) => item.status === "blocked") ?? null;
}

/** 계획의 체크와 실제 실행 종료는 별개다. 후속 검증·예산 중단을 완료로 표시하지 않는다. */
function workPlanStatusLine(plan: WorkPlan, items: readonly WorkItem[], active: boolean, stoppedReason?: string): string {
  const blocked = blockedItem(items);
  if (blocked) return `막힘 — ${blocked.title ?? "항목"}`;
  if (active && isPlanComplete(items)) return "마무리 확인 중";
  if (!active && stoppedReason && stoppedReason !== "final") {
    if (stoppedReason === "max-tool-calls" || stoppedReason === "token-budget") return "작업 중단 — 실행 한도 도달";
    if (stoppedReason === "apply-failed") return "작업 중단 — 적용 실패";
    if (stoppedReason === "error") return "작업 중단 — 오류";
    return "작업 중단 — 완료 확인 필요";
  }
  if (isPlanComplete(items)) return items.some((item) => item.status === "skipped") ? "계획 종료 — 건너뛴 항목 있음" : "모두 완료";
  const current = currentRunItemTitle(plan);
  return active ? `${current} 중` : `${current} — 대기 중`;
}

/** 진행 중 항목 아래 한 줄: 지금 돌고 있는 툴 라벨(있으면) 또는 「진행 중…」. testid 는 패널이 라이브로 덧쓴다. */
function workItemActivityNode(activity: string | undefined): HTMLElement {
  return el("span", {
    class: "ai-autonomous-item-note",
    dataset: { testid: "ai-work-item-activity" },
    text: activity && activity.trim().length > 0 ? activity : "진행 중…",
  });
}

/**
 * 할 일 목록 앞면 — 상태 한 줄 + 진행 + 계획 보기. 항목 본문은 페이지 책 모달(aiWorkPlanModal).
 * `active` 일 때만 중지와 활동 줄이 붙는다. 칩·예산·목표·피드는 「자세히」 서랍.
 */
export function renderWorkPlanChecklist(
  plan: WorkPlan,
  opts: {
    readonly active?: boolean;
    readonly stoppedReason?: string;
    readonly budget?: AutonomousRunBudget;
    readonly onStop?: () => void;
    readonly onOpenBook?: () => void;
    readonly activity?: string;
  } = {}
): HTMLElement {
  const items = planLayers(plan).flatMap(layerItems);
  const done = items.filter(isItemFinished).length;
  const active = opts.active !== false;
  const budget = opts.budget;
  const complete = !active && isPlanComplete(items) && items.every((item) => item.status === "done")
    && (!opts.stoppedReason || opts.stoppedReason === "final");
  const percent = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
  const statusLine = workPlanStatusLine(plan, items, active, opts.stoppedReason);
  const running = active && items.some((item) => item.status === "in_progress");
  const progressFill = el("span", { class: "ai-run-progress-fill" });
  progressFill.style.width = `${percent}%`;
  const head = el("div", {
    class: "ai-autonomous-head",
    children: [
      el("span", {
        class: "ai-autonomous-chip",
        dataset: { testid: "ai-autonomous-chip" },
        text: budget ? (active ? "⚡ 자율 실행 중" : "⚡ 자율 실행") : "할 일 목록",
      }),
      ...(budget
        ? [
            el("span", {
              class: "ai-autonomous-budget",
              dataset: { testid: "ai-autonomous-budget" },
              text: `예산 ${budget.used}/${budget.total}${budget.exhausted ? " · 소진" : ""}`,
            }),
          ]
        : []),
    ],
  });
  const openBook = opts.onOpenBook
    ? el("button", {
        class: "ai-plan-book-open",
        text: "계획 보기",
        attrs: { type: "button", title: "작업 계획을 페이지로 엽니다" },
        dataset: { testid: "ai-plan-book-open" },
        on: { click: () => opts.onOpenBook?.() },
      })
    : null;
  const blocked = blockedItem(items);
  const blockedNote = blocked && typeof blocked.note === "string" && blocked.note.trim().length > 0
    ? blocked.note.trim()
    : null;
  const stop = active
    ? el("button", {
        class: "ai-run-stop",
        text: "중지",
        attrs: { type: "button", title: "진행 중인 작업을 중지합니다" },
        dataset: { testid: "ai-run-stop" },
        on: { click: () => opts.onStop?.() },
      })
    : null;
  return el("div", {
    class: "ai-autonomous-checklist",
    dataset: {
      testid: "ai-work-plan-checklist",
      active: String(active),
      complete: String(complete),
      blocked: String(blockedItem(items) !== null),
    },
    attrs: { role: "group", "aria-label": "할 일 목록" },
    children: [
      el("div", {
        class: "ai-run-whisper",
        dataset: { testid: "ai-run-whisper" },
        children: [
          el("div", {
            class: "ai-run-line",
            children: [
              el("span", { class: "ai-run-status", dataset: { testid: "ai-run-status" }, text: statusLine }),
              el("span", {
                class: "ai-autonomous-progress",
                dataset: { testid: "ai-autonomous-progress" },
                attrs: { title: "완료한 항목 / 전체 항목" },
                text: `${done}/${items.length}`,
              }),
              ...(openBook ? [openBook] : []),
              ...(stop ? [stop] : []),
            ],
          }),
          ...(running ? [workItemActivityNode(opts.activity)] : []),
          ...(blockedNote
            ? [el("span", {
                class: "ai-autonomous-item-note is-blocked",
                dataset: { testid: "ai-work-item-blocked-note" },
                text: blockedNote,
              })]
            : []),
          el("div", {
            class: "ai-run-progress",
            dataset: { testid: "ai-run-progress" },
            attrs: { "aria-hidden": "true" },
            children: [progressFill],
          }),
        ],
      }),
      el("details", {
        class: "ai-run-details",
        dataset: { testid: "ai-run-details" },
        children: [
          el("summary", {
            class: "ai-run-details-toggle",
            dataset: { testid: "ai-run-details-toggle" },
            text: "자세히",
          }),
          head,
          el("div", { class: "ai-autonomous-goal", dataset: { testid: "ai-autonomous-goal" }, text: plan.goal ?? "" }),
        ],
      }),
    ],
  });
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

export interface ToolDetailSource {
  readonly args: Record<string, unknown> | undefined;
  readonly index: number;
}

export function renderToolCallDetail(name: string, result: ToolResult, detail: ToolDetailSource): HTMLElement {
  const resultRaw: Record<string, unknown> = { ok: result.ok, summary: result.summary };
  if (result.issues && result.issues.length > 0) resultRaw.issues = result.issues;
  const warnings = result.diff?.warnings ?? [];
  if (warnings.length > 0) resultRaw.warnings = warnings;
  if (result.data !== undefined) resultRaw.data = result.data;
  return el("div", {
    class: "ai-tool-detail",
    dataset: { testid: `ai-tool-detail-${detail.index}` },
    children: [
      el("div", { class: "ai-tool-detail-label", text: `호출 인자 — ${name}` }),
      el("pre", { class: "ai-tool-detail-pre", text: safeJsonStringify(detail.args ?? {}) }),
      el("div", { class: "ai-tool-detail-label", text: result.ok ? "결과 원문" : "오류 원문" }),
      el("pre", { class: "ai-tool-detail-pre", text: safeJsonStringify(resultRaw) }),
    ],
  });
}

export interface ToolActivityEntryOptions {
  /** 행 앞의 맵 칩(aiMapChip). 없으면 툴 계열 아이콘 칩. */
  readonly chip?: HTMLElement | null;
}

/**
 * 작업 타임라인 행(데크 2026-09-03). 성공은 `칩 · 한국어 라벨/요약 · 상태` 세 칸 격자이고, 함수 이름은
 * title 로만 남긴다 — 사용자는 「NPC 배치 · 상인 「두리」 (27,15)」 를 읽고 함수 이름은 호버로 본다.
 * 실패는 그대로 details(요약 + 원문)다: 진단 정보라 이름을 감추지 않는다.
 */
export function renderToolActivityEntry(
  name: string,
  result: ToolResult,
  detail?: ToolDetailSource,
  options: ToolActivityEntryOptions = {},
): HTMLElement {
  if (result.ok) {
    const rejection = ruleToolRejectionText(name, result);
    const summary = result.summary.trim();
    const draftPrefix = isDraftDestructiveTool(name) ? "(초안) " : "";
    const sum = rejection ?? `${draftPrefix}${summary.length > 0 ? summary : toolLabel(name)}`;
    const chip = options.chip
      ?? el("span", { class: "ai-act-chip is-icon", attrs: { "aria-hidden": "true" }, children: [deckIcon(toolIconKey(name), { size: 15 })] });
    return el("div", {
      class: "ai-tool-activity-line ai-act",
      attrs: { title: `${name} — ${summary.length > 0 ? summary : "완료"}` },
      dataset: { testid: "ai-tool-entry", tool: name },
      children: [
        chip,
        el("span", {
          class: "ai-act-what",
          children: [
            el("span", { class: "ai-act-label", text: toolLabel(name) }),
            el("span", { class: "ai-act-sum", text: sum, attrs: { title: sum } }),
          ],
        }),
        el("span", {
          class: "ai-act-status",
          attrs: { "aria-label": "완료" },
          children: [deckIcon("check", { size: 15 })],
        }),
      ],
    });
  }
  const draftPrefix = isDraftDestructiveTool(name) ? "(초안) " : "";
  return el("details", {
    class: "ai-tool-activity-line ai-tool-failure",
    dataset: { testid: "ai-tool-failure" },
    children: [
      el("summary", {
        text: `${draftPrefix}✗ ${name} — ${failedToolVisibleSummary(result)}`,
        dataset: { testid: "ai-tool-failure-summary" },
      }),
      el("div", {
        class: "ai-tool-failure-body",
        text: "이 단계는 자동으로 다시 시도했습니다. 최종 결과만 확인해 주세요.",
      }),
      ...(detail ? [renderToolCallDetail(name, result, detail)] : []),
    ],
  });
}

export interface VocabularyCardEdit {
  name?: string;
  role?: string;
  patternKind?: string;
  layerHome?: string;
}

interface VocabularyCardsData {
  readonly tilesetId: string;
  readonly grammarProfile: string;
  readonly cards: readonly VocabularyProposalCard[];
}

export function vocabularyCardsData(call: Pick<ProposedCall, "name" | "result">): VocabularyCardsData | null {
  if (call.name !== "propose_tile_vocabulary") return null;
  const data = call.result.data;
  if (typeof data !== "object" || data === null) return null;
  const record = data as Partial<VocabularyCardsData>;
  if (typeof record.tilesetId !== "string" || typeof record.grammarProfile !== "string" || !Array.isArray(record.cards)) return null;
  return record as VocabularyCardsData;
}

export function applyVocabularyCardEdits(
  args: Record<string, unknown>,
  edits: ReadonlyMap<number, VocabularyCardEdit>
): Record<string, unknown> {
  if (edits.size === 0) return args;
  const next = structuredClone(args);
  const items = Array.isArray(next.items) ? (next.items as unknown[]) : [];
  for (const [index, edit] of edits) {
    const item = items[index];
    if (typeof item !== "object" || item === null) continue;
    const target = item as Record<string, unknown>;
    if (edit.name !== undefined && edit.name.trim().length > 0) target.name = edit.name.trim();
    if (edit.role !== undefined) target.role = edit.role;
    if (edit.patternKind !== undefined) target.patternKind = edit.patternKind === "" ? undefined : edit.patternKind;
    if (edit.layerHome !== undefined) target.layerHome = edit.layerHome;
  }
  return next;
}

export function callsWithVocabularyEdits(
  calls: readonly ProposedCall[],
  editsByCall: ReadonlyMap<number, ReadonlyMap<number, VocabularyCardEdit>>
): readonly ProposedCall[] {
  let touched = false;
  const next = calls.map((call, index) => {
    const edits = editsByCall.get(index);
    if (!edits || edits.size === 0 || call.name !== "propose_tile_vocabulary") return call;
    touched = true;
    return { ...call, args: applyVocabularyCardEdits(call.args, edits) };
  });
  return touched ? next : calls;
}

export function hasVocabularyEdits(editsByCall: ReadonlyMap<number, ReadonlyMap<number, VocabularyCardEdit>>): boolean {
  for (const edits of editsByCall.values()) if (edits.size > 0) return true;
  return false;
}

const VOCAB_ROLE_OPTIONS = ["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"] as const;
const VOCAB_LAYER_OPTIONS = ["lower", "upper", "perCell"] as const;
const VOCAB_THUMB_LIMIT = 9;
const VOCAB_FACT_LIMIT = 4;

function vocabSelect(testid: string, options: readonly string[], value: string, onChange: (next: string) => void): HTMLSelectElement {
  const select = el("select", { class: "ai-vocab-edit-select", dataset: { testid } }) as HTMLSelectElement;
  const values = options.includes(value) || value === "" ? [...options] : [value, ...options];
  for (const option of values) {
    const node = el("option", { text: option === "" ? "(없음)" : option, attrs: { value: option } }) as HTMLOptionElement;
    if (option === value) node.selected = true;
    select.append(node);
  }
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function vocabFieldRow(label: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "ai-vocab-field", children: [el("span", { class: "ai-vocab-field-label", text: label }), control] });
}

function renderVocabularyCard(
  tileset: TilesetDef | undefined,
  card: VocabularyProposalCard,
  cardNumber: number,
  patternKindOptions: readonly string[],
  onEdit: (field: keyof VocabularyCardEdit, value: string) => void
): HTMLElement {
  const thumbs = el("div", {
    class: "ai-vocab-thumbs",
    children: card.tileIds.slice(0, VOCAB_THUMB_LIMIT).map((tile) =>
      el("span", {
        class: "ai-vocab-thumb",
        attrs: { title: `타일 ${tile}`, style: tileset ? tilesetTileBackgroundStyle(tileset, tile, 24) : "" },
      })
    ),
  });
  const nameInput = el("input", {
    class: "ai-vocab-edit-input",
    attrs: { type: "text", value: card.name, "aria-label": "어휘 이름(AI 추정 — 교정 가능)" },
    dataset: { testid: `ai-vocab-edit-name-${cardNumber}` },
  }) as HTMLInputElement;
  nameInput.value = card.name;
  nameInput.addEventListener("input", () => onEdit("name", nameInput.value));
  nameInput.addEventListener("change", () => onEdit("name", nameInput.value));

  const facts = card.facts.slice(0, VOCAB_FACT_LIMIT).map((fact) =>
    el("span", {
      class: "ai-vocab-fact",
      text: `타일 ${fact.tileId}: ${fact.layerHome}·${fact.passable ? "통행" : "차단"}`,
    })
  );
  const factSuffix = card.facts.length > VOCAB_FACT_LIMIT ? [el("span", { class: "ai-vocab-fact", text: `외 ${card.facts.length - VOCAB_FACT_LIMIT}` })] : [];

  const editRows: HTMLElement[] = [
    vocabFieldRow("이름", nameInput),
    vocabFieldRow("role", vocabSelect(`ai-vocab-edit-role-${cardNumber}`, VOCAB_ROLE_OPTIONS, card.role, (next) => onEdit("role", next))),
    vocabFieldRow("layerHome", vocabSelect(`ai-vocab-edit-layerHome-${cardNumber}`, VOCAB_LAYER_OPTIONS, card.layerHome, (next) => onEdit("layerHome", next))),
  ];
  if (card.kind === "group") {
    editRows.push(vocabFieldRow("패턴", vocabSelect(`ai-vocab-edit-patternKind-${cardNumber}`, patternKindOptions, card.patternKind ?? "", (next) => onEdit("patternKind", next))));
  }

  return el("div", {
    class: "ai-vocab-card",
    dataset: { testid: `ai-vocab-card-${cardNumber}` },
    children: [
      el("div", {
        class: "ai-vocab-card-head",
        children: [
          el("span", { class: "ai-vocab-badge is-estimate", text: "AI 추정" }),
          el("span", { class: "ai-vocab-kind", text: card.kind === "group" ? `그룹${card.groupId ? ` ${card.groupId}` : ""}` : `낱개 타일 ${card.tileIds.join(",")}` }),
          el("span", {
            class: `ai-vocab-badge ${card.patternDefined ? "is-fact" : "is-warn"}`,
            text: card.patternDefined ? "패턴 정의됨" : "패턴 미정의(T1b에서 파츠 필요)",
          }),
        ],
      }),
      thumbs,
      el("div", { class: "ai-vocab-edits", children: editRows }),
      el("div", { class: "ai-vocab-facts", children: [el("span", { class: "ai-vocab-badge is-fact", text: "사실" }), ...facts, ...factSuffix] }),
      ...card.warnings.map((warning) => el("div", { class: "ai-vocab-warning", text: warning })),
    ],
  });
}

export function renderVocabularyCardList(
  project: Project,
  call: ProposedCall,
  cardNumberStart: number,
  onEdit: (cardIndex: number, field: keyof VocabularyCardEdit, value: string) => void
): { element: HTMLElement; count: number } | null {
  const data = vocabularyCardsData(call);
  if (!data || data.cards.length === 0) return null;
  const tileset = project.tilesets[data.tilesetId];
  const patternKindOptions = ["", ...getGrammarProfile(data.grammarProfile).supportedPatternKinds];
  const element = el("div", {
    class: "ai-vocab-cards",
    children: data.cards.map((card, cardIndex) =>
      renderVocabularyCard(tileset, card, cardNumberStart + cardIndex, patternKindOptions, (field, value) => onEdit(cardIndex, field, value))
    ),
  });
  return { element, count: data.cards.length };
}
