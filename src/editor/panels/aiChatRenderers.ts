import { ruleToolRejectionText, type ProposedCall } from "@/ai/assistantSession";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import type { ToolResult } from "@/editor/tools";
import { getGrammarProfile, type VocabularyProposalCard } from "@/editor/tools/v3";
import type { Project, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const AI_PROGRESS_TOOL_LIMIT = 30;
const DRAFT_DESTRUCTIVE_TOOL_NAMES = new Set(["remove_map", "remove_event", "clear_region", "delete_tile_group"]);

export function formatAiRunningStatus(startedAt: number, now: number, toolCount: number, maxTools = AI_PROGRESS_TOOL_LIMIT): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `생각 중… ${elapsedSeconds}초 · 도구 ${toolCount}/${maxTools}`;
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

export function formatToolActivityLine(name: string, result: ToolResult): string {
  const mark = result.ok ? "✓" : "✗";
  const draftPrefix = result.ok && isDraftDestructiveTool(name) ? "(초안) " : "";
  return ruleToolRejectionText(name, result) ?? `${draftPrefix}${mark} ${name} — ${result.summary}`;
}

export function reasoningToggleText(count: number, collapsed: boolean): string {
  const label = count > 1 ? `💭 추론 ${count}회` : "💭 추론";
  return collapsed ? `${label} 보기 ▸` : `${label} ▾`;
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

export function renderToolActivityEntry(name: string, result: ToolResult, detail?: ToolDetailSource): HTMLElement {
  if (result.ok) {
    if (!detail) return el("div", { class: "ai-tool-activity-line", text: formatToolActivityLine(name, result) });
    return el("details", {
      class: "ai-tool-activity-line ai-tool-entry",
      dataset: { testid: "ai-tool-entry" },
      children: [
        el("summary", { class: "ai-tool-entry-summary", text: formatToolActivityLine(name, result) }),
        renderToolCallDetail(name, result, detail),
      ],
    });
  }
  const draftPrefix = isDraftDestructiveTool(name) ? "(초안) " : "";
  return el("details", {
    class: "ai-tool-activity-line ai-tool-failure",
    dataset: { testid: "ai-tool-failure" },
    children: [
      el("summary", {
        text: `${draftPrefix}✗ ${name} — ${failedToolRetrySummary(result.summary)}`,
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
