// editor/dialogue/dialogueEdits.ts
// 대사 고치기의 검사·적용(순수). 사람 편집(「대사」 탭)·제안 받기·조수 도구(rewrite_dialogue)가 같은 관문을 지난다:
//   1. 줄 id 가 지금도 같은 자리(같은 종류의 명령·칸)를 가리킨다.
//   2. 지금 원문의 해시가 호출자가 본 해시와 같다(낙관적 동시성 — 그 사이 누가 고쳤으면 거절).
//   3. 이벤트 편집기에서 초안으로 열린 이벤트는 고치지 않는다(초안 취소가 고친 글을 되돌리고, 적용이 덮는다).
//   4. 제어 코드(\C[n]·\N[n]·\.·[흔들]…[/]·{name})의 묶음이 원문과 같다.
//   5. 글 길이: 대화창 줄은 창 한 장(최대 줄 수)을 원문보다 더 넘기지 않는다 — allowOverflow 로만 푼다.

import type { Project } from "@/project/types";
import { resolvePlayResolution } from "@/project/playResolution";
import { collectDialogueLines, dialogueLineUsesMessageWindow, dialogueTextHash, resolveDialogueSlot, type DialogueLine } from "./dialogueIndex";
import { compareControlCodes, estimateDialogueWindowMetrics, measureDialogueFit, visibleDialogueText, type DialogueFit } from "./dialogueText";

export const DIALOGUE_TEXT_LIMIT = 2000;

export interface DialogueEditRequest {
  readonly id: string;
  readonly hash: string;
  readonly text: string;
}

export type DialogueEditRejection =
  | "unknown-line"
  | "stale-hash"
  | "drafted"
  | "control-codes"
  | "too-long"
  | "overflow"
  | "empty"
  | "unchanged";

export interface DialogueEditVerdict {
  readonly id: string;
  readonly ok: boolean;
  readonly reason?: DialogueEditRejection;
  readonly message?: string;
  readonly before?: string;
  readonly after?: string;
  readonly fitBefore?: DialogueFit;
  readonly fitAfter?: DialogueFit;
  readonly warning?: string;
}

export interface DialogueEditOptions {
  /** 창 넘침을 늘리는 고치기도 받는다. */
  readonly allowOverflow?: boolean;
}

export function actorNamesOf(project: Project): string[] {
  return (project.database?.actors ?? []).map((actor) => actor.name);
}

/** 도구·사람 공통의 추정 창 맞춤. 편집기 화면은 실제 DOM 측정으로 따로 보여 준다. */
/** 측정기(편집기 DOM 에서 런타임 CSS 로 잰 것)가 이 프로젝트의 창 설정과 같은 키로 등록돼 있으면 추정 대신 그것을 쓴다. */
type MeasuredFit = (line: Pick<DialogueLine, "kind" | "speaker" | "context" | "withFace">, text: string) => DialogueFit | undefined;
let measuredFit: { readonly key: string; readonly fit: MeasuredFit } | null = null;

/** 창 맞춤이 달라지는 설정(해상도·글꼴·대화창 모양)의 키. */
export function dialogueMeasureKey(project: Project): string {
  const system = project.system as Project["system"] & { dialogueStyle?: unknown; dialogueFont?: unknown };
  return JSON.stringify([system.playResolution ?? null, system.fonts ?? null, system.dialogueStyle ?? null, system.dialogueFont ?? null]);
}

/** 편집기가 실측기를 만들면 등록한다 — 조수 도구의 창 넘침 판정도 같은 실측을 쓰게. */
export function registerMeasuredDialogueFit(key: string, fit: MeasuredFit | null): void {
  measuredFit = fit ? { key, fit } : null;
}

export function hasMeasuredDialogueFit(project: Project): boolean {
  return measuredFit?.key === dialogueMeasureKey(project);
}

export function estimateLineFit(project: Project, line: Pick<DialogueLine, "kind" | "withFace"> & Partial<Pick<DialogueLine, "speaker" | "context">>, text: string): DialogueFit | undefined {
  if (!dialogueLineUsesMessageWindow(line)) return undefined;
  if (measuredFit && measuredFit.key === dialogueMeasureKey(project)) {
    return measuredFit.fit({ kind: line.kind, withFace: line.withFace, speaker: line.speaker ?? "", ...(line.context ? { context: line.context } : {}) }, text);
  }
  const width = resolvePlayResolution(project.system).width;
  const metrics = estimateDialogueWindowMetrics(width, { face: line.withFace });
  return measureDialogueFit(visibleDialogueText(text, { actorNames: actorNamesOf(project) }), metrics);
}

const LITERAL_NEWLINE = /\\n(?!\[)/gu;

/**
 * 고친 글의 줄바꿈을 맞춘다. CRLF 는 LF 로. 모델이 JSON 이스케이프를 한 번 더 해서 줄바꿈 대신 「\n」 두 글자를 보내는 일이 있다
 * (2026-10-24 폴른 스타 실측: 발렌 제안 30줄 중 여러 줄) — 원문에 그 두 글자가 없으면 진짜 줄바꿈으로 바꾼다. `\N[1]` 같은 코드는 건드리지 않는다.
 */
export function normalizeEditedDialogueText(original: string, text: string): string {
  const unified = text.replace(/\r\n?/gu, "\n");
  if (/\\n(?!\[)/u.test(original)) return unified;
  return unified.replace(LITERAL_NEWLINE, "\n");
}

/** 고치기 하나를 검사만 한다(프로젝트를 바꾸지 않는다). lines 를 주면 색인을 다시 만들지 않는다. */
export function checkDialogueEdit(project: Project, edit: DialogueEditRequest, options: DialogueEditOptions = {}, lines?: readonly DialogueLine[]): DialogueEditVerdict {
  const slot = resolveDialogueSlot(project, edit.id);
  if (!slot) return { id: edit.id, ok: false, reason: "unknown-line", message: "그 자리에 대사가 없다 — 명령이 옮겨졌거나 지워졌다. list_dialogue 로 다시 읽어라." };
  if (dialogueTextHash(slot.text) !== edit.hash) {
    return { id: edit.id, ok: false, reason: "stale-hash", message: `원문이 바뀌었다(지금 해시 ${dialogueTextHash(slot.text)}). 다시 읽고 고쳐라.`, before: slot.text };
  }
  if (slot.drafted) return { id: edit.id, ok: false, reason: "drafted", message: "이 이벤트가 이벤트 편집기에서 열려 있다 — 편집기를 닫은 뒤 고친다.", before: slot.text };
  const text = normalizeEditedDialogueText(slot.text, edit.text);
  if (text === slot.text) return { id: edit.id, ok: false, reason: "unchanged", message: "원문과 같다.", before: slot.text };
  if (!text.trim()) return { id: edit.id, ok: false, reason: "empty", message: "빈 글로 바꿀 수 없다. 줄을 없애려면 이벤트 명령을 지운다.", before: slot.text };
  if (text.length > DIALOGUE_TEXT_LIMIT) return { id: edit.id, ok: false, reason: "too-long", message: `${DIALOGUE_TEXT_LIMIT}자를 넘는다.`, before: slot.text };
  const codes = compareControlCodes(slot.text, text);
  if (codes.missing.length > 0 || codes.added.length > 0) {
    const parts = [
      codes.missing.length ? `빠짐 ${codes.missing.join(" ")}` : "",
      codes.added.length ? `새로 생김 ${codes.added.join(" ")}` : "",
    ].filter(Boolean).join(" · ");
    return { id: edit.id, ok: false, reason: "control-codes", message: `제어 코드는 원문 그대로 둔다(${parts}).`, before: slot.text };
  }
  const line = (lines ?? collectDialogueLines(project)).find((candidate) => candidate.id === edit.id);
  const shape = line ?? { kind: "description" as const, withFace: false };
  const fitBefore = estimateLineFit(project, shape, slot.text);
  const fitAfter = estimateLineFit(project, shape, text);
  if (fitBefore && fitAfter && fitAfter.overflow && fitAfter.pages > fitBefore.pages && options.allowOverflow !== true) {
    return {
      id: edit.id, ok: false, reason: "overflow",
      message: `대화창 한 장(${fitAfter.maxLines}줄·폭 ${fitAfter.bodyWidthPx}px 추정)을 넘는다: ${fitAfter.lines}줄 ${fitAfter.pages}장(원문 ${fitBefore.pages}장). 줄이거나 allowOverflow 로 일부러 넘긴다고 밝힌다.`,
      before: slot.text, after: text, fitBefore, fitAfter,
    };
  }
  const warning = fitAfter?.overflow ? `아직 창 한 장을 넘는다(${fitAfter.lines}줄 ${fitAfter.pages}장, 추정).` : undefined;
  return { id: edit.id, ok: true, before: slot.text, after: text, ...(fitBefore ? { fitBefore } : {}), ...(fitAfter ? { fitAfter } : {}), ...(warning ? { warning } : {}) };
}

/**
 * 검사를 통과한 고치기만 프로젝트에 쓴다(제자리). 통과 못 한 것은 쓰지 않고 판정만 돌려준다.
 * 스토어 변경기(store.update) 또는 도구 초안 안에서 부른다.
 */
export function applyDialogueEdits(
  project: Project,
  edits: readonly DialogueEditRequest[],
  options: DialogueEditOptions = {},
  /** 스토어 변경기에서는 바꾸기 전 프로젝트의 색인을 넘긴다 — 초안에서 색인을 만들면 모든 맵을 늦은 복제로 깨운다. */
  lines: readonly DialogueLine[] = collectDialogueLines(project),
): DialogueEditVerdict[] {
  const verdicts = edits.map((edit) => checkDialogueEdit(project, edit, options, lines));
  const seen = new Set<string>();
  return verdicts.map((verdict, index) => {
    if (!verdict.ok) return verdict;
    if (seen.has(verdict.id)) return { id: verdict.id, ok: false, reason: "stale-hash" as const, message: "같은 줄을 한 번에 두 번 고칠 수 없다." };
    seen.add(verdict.id);
    resolveDialogueSlot(project, verdict.id)!.write(verdict.after ?? normalizeEditedDialogueText(verdict.before ?? "", edits[index]!.text));
    return verdict;
  });
}
