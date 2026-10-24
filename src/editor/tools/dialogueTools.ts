// editor/tools/dialogueTools.ts
// 대사 관리(윤문) 조수 도구 — list_dialogue · get_dialogue_context · rewrite_dialogue · set_speaker_voice.
// 색인·검사·적용은 `editor/dialogue/*` 의 순수 함수를 자료집 「대사」 탭과 함께 쓴다.
//
// 윤문 흐름: list_dialogue 로 줄(id·hash·원문)을 읽고 → 필요하면 get_dialogue_context 로 앞뒤·말투 메모를 보고 →
// rewrite_dialogue 로 고친 글을 «제안» 으로 낸다(기본). 제안은 사람이 「대사」 탭에서 줄마다 받거나 버린다.
// 사람이 «바로 고쳐» 라고 분명히 말했을 때만 mode:"apply" 로 곧장 쓴다.
//
// 스키마: 자유 키 객체·빈 enum 멤버를 쓰지 않는다(Gemini 400 — openwiki/editor-ai-tools.md). 배열은 items 를 단다.

import { genId } from "@/util/id";
import { readDialogueDesk, speakerVoiceNote, upsertDialogueProposals, writeSpeakerVoice, normalizeSpeakerName, type DialogueProposal } from "@/project/dialogueDesk";
import {
  collectDialogueLines,
  dialogueContext,
  dialogueKindLabel,
  dialogueLineUsesMessageWindow,
  speakerSummary,
  type DialogueLine,
} from "@/editor/dialogue/dialogueIndex";
import { applyDialogueEdits, checkDialogueEdit, estimateLineFit, type DialogueEditRequest } from "@/editor/dialogue/dialogueEdits";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import type { Project } from "@/project/types";

const LIST_LIMIT_DEFAULT = 60;
const LIST_LIMIT_MAX = 200;
const REWRITE_MAX = 80;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function compactRow(project: Project, line: DialogueLine, pendingLineIds: ReadonlySet<string>): Record<string, unknown> {
  const fit = estimateLineFit(project, line, line.text);
  return {
    id: line.id,
    hash: line.hash,
    ...(line.speaker ? { speaker: line.speaker } : {}),
    text: line.text,
    where: line.groupLabel,
    ...(line.kind !== "text" ? { kind: dialogueKindLabel(line.kind) } : {}),
    ...(fit ? { lines: `${fit.lines}/${fit.maxLines}` } : {}),
    ...(fit?.overflow ? { overflow: true } : {}),
    ...(line.drafted ? { locked: "이벤트 편집기에서 열려 있음" } : {}),
    ...(pendingLineIds.has(line.id) ? { pendingProposal: true } : {}),
  };
}

function matchesKind(line: DialogueLine, kind: string): boolean {
  if (kind === "line") return line.kind === "text";
  if (kind === "choice") return line.kind === "choiceOption" || line.kind === "choicePrompt" || line.kind === "presentPrompt";
  if (kind === "description") return line.kind === "description";
  return true;
}

const listDialogue: ToolDefinition = {
  name: "list_dialogue",
  description:
    "게임의 대사·선택지·설명 글을 한 줄씩(id·hash·화자·원문·자리·창 줄 수) 돌려준다. 윤문·말투 다듬기·길이 줄이기의 첫 단계다. " +
    "speaker 로 한 인물만, mapId·query 로 장면만, overflowOnly 로 대화창 한 장을 넘는 줄만 고른다. " +
    "첫 쪽(offset 0)에는 화자 목록(대사 수·말투 메모)과 프로젝트 문체 규칙이 함께 온다. 고칠 때는 rewrite_dialogue 에 id·hash 를 그대로 넘긴다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "원문·화자·자리(맵·이벤트 이름)에 들어 있는 낱말." },
      speaker: { type: "string", description: "이 화자의 대사만(대사 명령의 화자 이름 그대로)." },
      mapId: { type: "string", description: "이 맵의 이벤트 대사만." },
      scope: { type: "string", enum: ["all", "map", "common", "troop", "database"], description: "map=맵 이벤트, common=공용 이벤트, troop=적 그룹 전투 이벤트, database=아이템·장비·스킬 설명." },
      kind: { type: "string", enum: ["all", "line", "choice", "description"], description: "line=대사 명령, choice=선택지·질문, description=자료집 설명." },
      overflowOnly: { type: "boolean", description: "대화창 한 장(추정)을 넘는 줄만." },
      minChars: { type: "integer", minimum: 0, description: "이 글자 수 이상인 줄만." },
      offset: { type: "integer", minimum: 0 },
      limit: { type: "integer", minimum: 1, maximum: LIST_LIMIT_MAX },
    },
    additionalProperties: false,
  },
  invalidArgsExample: { speaker: "발렌", limit: 40 },
  run(project, args): ToolExecResult {
    const query = str(args.query).trim().toLocaleLowerCase();
    const speaker = normalizeSpeakerName(str(args.speaker));
    const mapId = str(args.mapId).trim();
    const scope = str(args.scope) || "all";
    const kind = str(args.kind) || "all";
    const minChars = typeof args.minChars === "number" ? Math.max(0, Math.trunc(args.minChars)) : 0;
    const offset = typeof args.offset === "number" ? Math.max(0, Math.trunc(args.offset)) : 0;
    const limit = typeof args.limit === "number" ? Math.max(1, Math.min(LIST_LIMIT_MAX, Math.trunc(args.limit))) : LIST_LIMIT_DEFAULT;
    if (mapId && !project.maps[mapId]) throw new ToolError(`맵 없음 — ${mapId}`, { code: "invalid-args" });
    const all = collectDialogueLines(project);
    const desk = readDialogueDesk(project);
    const pending = new Set(desk.proposals.map((proposal) => proposal.lineId));
    let filtered = all.filter((line) =>
      (scope === "all" || line.scope === scope)
      && matchesKind(line, kind)
      && (!speaker || line.speaker === speaker)
      && (!mapId || line.mapId === mapId)
      && (!query || `${line.text}\n${line.speaker}\n${line.groupLabel}`.toLocaleLowerCase().includes(query))
      && Array.from(line.text).length >= minChars);
    if (args.overflowOnly === true) {
      filtered = filtered.filter((line) => dialogueLineUsesMessageWindow(line) && estimateLineFit(project, line, line.text)?.overflow === true);
    }
    const page = filtered.slice(offset, offset + limit);
    const nextOffset = offset + page.length < filtered.length ? offset + page.length : null;
    const head = offset === 0
      ? {
        speakers: speakerSummary(all).slice(0, 40).map(({ speaker: name, count }) => {
          const note = speakerVoiceNote(project, name);
          return { speaker: name, count, ...(note ? { voice: note } : {}) };
        }),
        ...(project.aiAuthoring?.dialogueStyleRules?.trim() ? { styleRules: project.aiAuthoring.dialogueStyleRules.trim() } : {}),
        pendingProposals: desk.proposals.length,
        windowNote: "lines 는 대화창 줄 수 추정(쓴 줄/한 장 최대). 편집기 「대사」 탭은 실제 런타임 글꼴·폭으로 다시 잰다.",
      }
      : {};
    return {
      summary: `대사 ${filtered.length}줄 중 ${page.length}줄 (offset ${offset}${nextOffset !== null ? ` → 다음 ${nextOffset}` : ""})`,
      data: { total: filtered.length, offset, nextOffset, rows: page.map((line) => compactRow(project, line, pending)), ...head },
    };
  },
};

const getDialogueContext: ToolDefinition = {
  name: "get_dialogue_context",
  description:
    "대사 한 줄의 앞뒤 문맥(같은 이벤트 페이지 안의 앞·뒤 줄), 화자의 말투 메모, 프로젝트 문체 규칙, 창 맞춤 추정, 걸려 있는 제안을 돌려준다. " +
    "한 줄을 다듬기 전에 흐름을 볼 때 쓴다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "list_dialogue 의 줄 id." },
      before: { type: "integer", minimum: 0, maximum: 20 },
      after: { type: "integer", minimum: 0, maximum: 20 },
    },
    required: ["id"],
    additionalProperties: false,
  },
  invalidArgsExample: { id: "ev/map_town/ev_guard/page_1/0#body", before: 3, after: 3 },
  run(project, args): ToolExecResult {
    const id = str(args.id);
    const lines = collectDialogueLines(project);
    const before = typeof args.before === "number" ? Math.trunc(args.before) : 3;
    const after = typeof args.after === "number" ? Math.trunc(args.after) : 3;
    const context = dialogueContext(lines, id, before, after);
    if (!context) throw new ToolError(`대사 줄 없음 — ${id}. list_dialogue 로 다시 찾아라.`, { code: "invalid-args" });
    const desk = readDialogueDesk(project);
    const pending = new Set(desk.proposals.map((proposal) => proposal.lineId));
    const proposal = desk.proposals.find((entry) => entry.lineId === id);
    const fit = estimateLineFit(project, context.line, context.line.text);
    const voice = context.line.speaker ? speakerVoiceNote(project, context.line.speaker) : undefined;
    return {
      summary: `${context.line.groupLabel} · ${context.line.speaker || dialogueKindLabel(context.line.kind)} — 앞 ${context.previous.length}줄 · 뒤 ${context.next.length}줄`,
      data: {
        line: compactRow(project, context.line, pending),
        previous: context.previous.map((line) => compactRow(project, line, pending)),
        next: context.next.map((line) => compactRow(project, line, pending)),
        ...(voice ? { speakerVoice: voice } : {}),
        ...(project.aiAuthoring?.dialogueStyleRules?.trim() ? { styleRules: project.aiAuthoring.dialogueStyleRules.trim() } : {}),
        ...(fit ? { fit } : {}),
        ...(context.line.emotion ? { emotion: context.line.emotion } : {}),
        ...(context.line.context ? { lineContext: context.line.context } : {}),
        ...(proposal ? { pendingProposal: { after: proposal.after, reason: proposal.reason ?? "" } } : {}),
      },
    };
  },
};

const EDIT_ITEM_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", description: "list_dialogue 의 줄 id 그대로." },
    hash: { type: "string", description: "list_dialogue 가 준 hash 그대로(원문이 그 사이 바뀌었으면 거절된다)." },
    text: { type: "string", description: "고친 글 전체. 제어 코드(\\C[n] \\N[n] \\. \\| [흔들]…[/] {name} 등)는 원문 그대로 남긴다." },
    reason: { type: "string", description: "무엇을 왜 바꿨는지 한 줄(사람이 검토할 때 본다)." },
  },
  required: ["id", "hash", "text"],
  additionalProperties: false,
} as const;

const rewriteDialogue: ToolDefinition = {
  name: "rewrite_dialogue",
  description:
    "대사 여러 줄을 한 번에 고친다(윤문·말투 맞추기·줄이기). edits 는 {id, hash, text, reason} 배열(최대 80). " +
    "기본 mode:\"propose\" 는 게임 대사를 바꾸지 않고 «윤문 제안» 으로 남긴다 — 사람이 자료집 「대사」 탭에서 바꾸기 전·후를 보고 줄마다 받거나 버린다. " +
    "사람이 «바로 바꿔» 라고 분명히 말했을 때만 mode:\"apply\" 로 곧장 쓴다. " +
    "거절: 낡은 hash(원문이 바뀜)·없는 id·이벤트 편집기에서 열린 이벤트·제어 코드가 빠지거나 새로 생김·대화창 한 장을 원문보다 더 넘김(allowOverflow 로만 허용). " +
    "고치기 전에 list_dialogue 첫 쪽의 화자 말투 메모(voice)와 styleRules 를 따른다. 화자 이름·이벤트 구조는 바꾸지 않는다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      edits: { type: "array", minItems: 1, maxItems: REWRITE_MAX, items: EDIT_ITEM_SCHEMA },
      mode: { type: "string", enum: ["propose", "apply"], description: "propose(기본)=사람 검토용 제안, apply=곧장 적용." },
      instruction: { type: "string", description: "사용자가 한 요청을 그대로(제안 묶음에 함께 보인다)." },
      allowOverflow: { type: "boolean", description: "대화창 한 장을 넘기는 것이 의도일 때만 true." },
    },
    required: ["edits"],
    additionalProperties: false,
  },
  invalidArgsExample: { edits: [{ id: "ev/map_town/ev_guard/page_1/0#body", hash: "0123456789ab", text: "멈춰라. 통행증.", reason: "경비병 말투를 짧게" }], mode: "propose" },
  run(draft, args): ToolExecResult {
    const raw = Array.isArray(args.edits) ? args.edits : [];
    if (raw.length === 0) throw new ToolError("edits 가 비었다.", { code: "invalid-args" });
    if (raw.length > REWRITE_MAX) throw new ToolError(`한 번에 ${REWRITE_MAX}줄까지 — 나눠서 부른다.`, { code: "invalid-args" });
    const edits: (DialogueEditRequest & { readonly reason?: string })[] = raw.map((entry, index) => {
      const record = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
      const id = str(record.id);
      const hash = str(record.hash);
      if (!id || !hash || typeof record.text !== "string") throw new ToolError(`edits[${index}] 에 id·hash·text 가 필요하다.`, { code: "invalid-args" });
      const reason = str(record.reason).trim();
      return { id, hash, text: record.text, ...(reason ? { reason: reason.slice(0, 400) } : {}) };
    });
    const mode = str(args.mode) === "apply" ? "apply" : "propose";
    const instruction = str(args.instruction).trim().slice(0, 600);
    const options = { allowOverflow: args.allowOverflow === true };
    const lines = collectDialogueLines(draft);
    const verdicts = mode === "apply"
      ? applyDialogueEdits(draft, edits, options)
      : edits.map((edit) => checkDialogueEdit(draft, edit, options, lines));
    const accepted = verdicts.filter((verdict) => verdict.ok);
    const rejected = verdicts.filter((verdict) => !verdict.ok).map((verdict) => ({ id: verdict.id, reason: verdict.reason, message: verdict.message }));
    if (accepted.length === 0) {
      throw new ToolError(`고친 줄 0 — ${rejected.slice(0, 4).map((item) => `${item.id}: ${item.message}`).join(" / ")}`, { code: "dialogue-rewrite-rejected" });
    }
    if (mode === "propose") {
      const batchId = genId("dlgbatch");
      const now = new Date().toISOString();
      const byId = new Map(edits.map((edit) => [edit.id, edit]));
      const proposals: DialogueProposal[] = [];
      const seen = new Set<string>();
      for (const verdict of accepted) {
        if (seen.has(verdict.id)) continue;
        seen.add(verdict.id);
        const edit = byId.get(verdict.id)!;
        proposals.push({
          id: genId("dlgprop"),
          lineId: verdict.id,
          baseHash: edit.hash,
          before: verdict.before ?? "",
          after: verdict.after ?? edit.text,
          ...(edit.reason ? { reason: edit.reason } : {}),
          batchId,
          ...(instruction ? { instruction } : {}),
          source: "ai",
          createdAt: now,
        });
      }
      upsertDialogueProposals(draft, proposals);
    }
    const warnings = accepted.flatMap((verdict) => verdict.warning ? [`${verdict.id}: ${verdict.warning}`] : []);
    return {
      summary: mode === "propose"
        ? `윤문 제안 ${accepted.length}줄을 남겼다(거절 ${rejected.length}) — 사람이 자료집 「대사」 탭에서 받거나 버린다. 게임 대사는 아직 그대로다.`
        : `대사 ${accepted.length}줄을 고쳤다(거절 ${rejected.length}).`,
      ...(warnings.length ? { warnings: warnings.slice(0, 8) } : {}),
      data: {
        mode,
        accepted: accepted.map((verdict) => ({
          id: verdict.id,
          before: verdict.before,
          after: verdict.after,
          ...(verdict.fitAfter ? { lines: `${verdict.fitAfter.lines}/${verdict.fitAfter.maxLines}`, overflow: verdict.fitAfter.overflow } : {}),
        })),
        rejected,
      },
    };
  },
};

const setSpeakerVoice: ToolDefinition = {
  name: "set_speaker_voice",
  description:
    "화자 한 명의 말투 메모를 프로젝트에 남긴다(빈 note 는 지움). 예: 발렌 — 「냉정한 심문관. 짧은 평서문, 존댓말 없음, 감정 표현 억제.」 " +
    "list_dialogue·get_dialogue_context 가 이 메모를 돌려주고, 이후 윤문은 이 메모를 문체 지침으로 따른다. 사람이 「대사」 탭에서도 고친다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      speaker: { type: "string", description: "대사 명령의 화자 이름 그대로." },
      note: { type: "string", description: "말투 메모(800자 이내). 빈 문자열이면 지운다." },
    },
    required: ["speaker", "note"],
    additionalProperties: false,
  },
  invalidArgsExample: { speaker: "발렌", note: "냉정한 심문관. 짧은 평서문." },
  run(draft, args): ToolExecResult {
    const speaker = normalizeSpeakerName(str(args.speaker));
    if (!speaker) throw new ToolError("speaker 가 비었다.", { code: "invalid-args" });
    const result = writeSpeakerVoice(draft, speaker, str(args.note));
    const known = speakerSummary(collectDialogueLines(draft, { includeDescriptions: false })).some((entry) => entry.speaker === speaker);
    return {
      summary: result === "set" ? `${speaker} 말투 메모를 남겼다.` : result === "cleared" ? `${speaker} 말투 메모를 지웠다.` : `${speaker} 말투 메모는 그대로다.`,
      ...(known ? {} : { warnings: [`대사 중에 화자 「${speaker}」가 아직 없다 — 이름 철자를 list_dialogue 화자 목록과 맞춰라.`] }),
      data: { speaker, note: speakerVoiceNote(draft, speaker) ?? "" },
    };
  },
};

export const DIALOGUE_TOOLS: readonly ToolDefinition[] = [listDialogue, getDialogueContext, rewriteDialogue, setSpeakerVoice];
