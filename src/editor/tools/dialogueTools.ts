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
import { DIALOGUE_PROPOSAL_LIMIT, readDialogueDesk, speakerVoiceNote, upsertDialogueProposals, writeSceneNotes, writeSpeakerVoice, normalizeSpeakerName, type DialogueProposal } from "@/project/dialogueDesk";
import {
  collectDialogueLines,
  dialogueContext,
  dialogueKindLabel,
  dialogueLineUsesMessageWindow,
  speakerSummary,
  type DialogueLine,
} from "@/editor/dialogue/dialogueIndex";
import { applyDialogueEdits, checkDialogueEdit, estimateLineFit, hasMeasuredDialogueFit, type DialogueEditRequest } from "@/editor/dialogue/dialogueEdits";
import { buildStory, lineRefLabel, resolveStoryRef, type Story } from "@/editor/dialogue/storyScript";
import { renderOutlineText, renderSceneText, selectScenes, storyCast, STORY_HASH_PREFIX } from "@/editor/dialogue/storyScriptText";
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
  if (kind === "quest") return line.kind === "quest" || line.scope === "ending";
  return true;
}

/**
 * 게임 속 물건을 부르는 말은 사람마다 다르다(사용자 「터미널」 ↔ 게임 글 「단말」·이벤트 「기계 패널」).
 * 낱말 그대로는 한 줄도 없을 때만 이 묶음으로 넓히고, 넓혔다는 사실을 결과에 적는다.
 */
const QUERY_SYNONYMS: readonly (readonly string[])[] = [
  ["터미널", "단말", "단말기", "콘솔", "컴퓨터", "패널", "모니터", "화면"],
  ["표지판", "팻말", "간판", "안내판", "비석", "표지석"],
  ["편지", "서신", "쪽지", "메모"],
  ["일기", "일지", "기록", "수첩"],
  ["책", "책장", "서가", "고서"],
  ["게시판", "벽보", "공고"],
];

function widenQuery(query: string): readonly string[] {
  const group = QUERY_SYNONYMS.find((words) => words.some((word) => word === query || query.includes(word)));
  return group ? group.filter((word) => word !== query) : [];
}

/** 맵을 뺀 같은 거르개 결과를 자리(맵·공용 이벤트·전투…)별로 센다. 많은 순 6곳. */
function otherMapCounts(project: Project, lines: readonly DialogueLine[]): { mapId?: string; where: string; count: number }[] {
  const counts = new Map<string, { mapId?: string; where: string; count: number }>();
  for (const line of lines) {
    const key = line.mapId ? `map:${line.mapId}` : line.scope;
    const where = line.mapId ? `${project.maps[line.mapId]?.name ?? line.mapId}(${line.mapId})` : line.groupLabel.split(" › ")[0] ?? line.scope;
    const entry = counts.get(key) ?? { ...(line.mapId ? { mapId: line.mapId } : {}), where, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 6);
}

const listDialogue: ToolDefinition = {
  name: "list_dialogue",
  description:
    "게임의 대사·선택지·설명·퀘스트 일지·엔딩 글을 한 줄씩(id·hash·화자·원문·자리·창 줄 수) 돌려준다. 윤문·말투 다듬기·길이 줄이기의 첫 단계다. " +
    "speaker 로 한 인물만, mapId·query 로 장면만, overflowOnly 로 대화창 한 장을 넘는 줄만 고른다. " +
    "첫 쪽(offset 0)에는 화자 목록(대사 수·말투 메모)과 프로젝트 문체 규칙이 함께 온다. 고칠 때는 rewrite_dialogue 에 id·hash 를 그대로 넘긴다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "원문·화자·자리(맵·이벤트 이름)에 들어 있는 낱말. 그대로는 없으면 같은 물건을 부르는 다른 말(터미널→단말·패널…)로 넓혀 찾고 결과에 밝힌다." },
      speaker: { type: "string", description: "이 화자의 대사만(대사 명령의 화자 이름 그대로)." },
      mapId: { type: "string", description: "이 맵의 이벤트 대사만. 사용자가 맵을 말하지 않았으면 비운다(대사는 다른 맵에 있을 수 있다). 0줄이면 결과의 elsewhere 가 다른 맵을 알려 준다." },
      scope: { type: "string", enum: ["all", "map", "common", "troop", "database", "quest", "ending"], description: "map=맵 이벤트, common=공용 이벤트, troop=적 그룹 전투 이벤트, database=아이템·장비·스킬 설명, quest=퀘스트 일지 제목·요약·단계, ending=엔딩 제목·머리말·크레딧·에필로그 대사." },
      kind: { type: "string", enum: ["all", "line", "choice", "description", "quest"], description: "line=대사(이벤트·에필로그), choice=선택지·질문, description=자료집 설명, quest=퀘스트·엔딩 화면 글." },
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
    // 화자 칸은 자유 문자열이다(「심문관 발렌」). 정확히 같은 이름이 없으면 이름에 낱말이 든 화자를 모두 본다.
    const exactSpeaker = !speaker || all.some((line) => line.speaker === speaker);
    const speakerMatches = (name: string): boolean => !speaker || (exactSpeaker ? name === speaker : name.includes(speaker));
    const haystack = (line: DialogueLine): string => `${line.text}\n${line.speaker}\n${line.groupLabel}`.toLocaleLowerCase();
    // 낱말 그대로는 어느 맵에도 없으면 같은 물건을 부르는 다른 말로 넓힌다.
    const widened = query && !all.some((line) => haystack(line).includes(query)) ? widenQuery(query) : [];
    const queryHits = (line: DialogueLine): boolean => {
      if (!query) return true;
      const text = haystack(line);
      return text.includes(query) || widened.some((word) => text.includes(word));
    };
    const matches = (line: DialogueLine, withMap: boolean): boolean =>
      (scope === "all" || line.scope === scope)
      && matchesKind(line, kind)
      && speakerMatches(line.speaker)
      && (!withMap || !mapId || line.mapId === mapId)
      && queryHits(line)
      && Array.from(line.text).length >= minChars
      && (args.overflowOnly !== true || (dialogueLineUsesMessageWindow(line) && estimateLineFit(project, line, line.text)?.overflow === true));
    const filtered = all.filter((line) => matches(line, true));
    // 맵을 좁혀 0줄이면 다른 맵에 있는지 알려 준다 — 조수가 지금 보는 맵만 뒤지고 「없다」고 끝내는 일을 막는다
    // (2026-10-27 폴른 스타: 「터미널 대사」를 왕도 맵에서만 찾았다. 단말 글은 천문대 지하 맵에 있다).
    const elsewhere = mapId && filtered.length === 0 ? otherMapCounts(project, all.filter((line) => matches(line, false))) : [];
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
        windowNote: hasMeasuredDialogueFit(project)
          ? "lines 는 대화창 줄 수(쓴 줄/한 장 최대) — 편집기가 런타임 글꼴·폭으로 잰 기준."
          : "lines 는 대화창 줄 수 추정(쓴 줄/한 장 최대). 편집기가 대화창을 재 두면(조수 입력창·대사 탭을 열 때) 실측 기준으로 바뀐다.",
      }
      : {};
    return {
      summary: `대사 ${filtered.length}줄 중 ${page.length}줄 (offset ${offset}${nextOffset !== null ? ` → 다음 ${nextOffset}` : ""})`
        + (widened.length ? ` — 「${query}」 그대로는 게임 글에 없어 ${widened.join("·")} 로 넓혀 찾았다` : "")
        + (elsewhere.length ? ` — 이 맵에는 없고 다른 곳에 있다: ${elsewhere.map((entry) => `${entry.where} ${entry.count}줄`).join(", ")}. mapId 를 빼거나 그 맵 id 로 다시 부른다` : "")
        + (exactSpeaker ? "" : ` — 화자 「${speaker}」가 정확히 없어 이름에 그 낱말이 든 화자(${[...new Set(filtered.map((line) => line.speaker))].slice(0, 6).join("·") || "없음"})를 보였다`),
      data: { total: filtered.length, offset, nextOffset, rows: page.map((line) => compactRow(project, line, pending)), ...(elsewhere.length ? { elsewhere } : {}), ...(widened.length ? { widenedQuery: widened } : {}), ...head },
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
    ref: { type: "string", description: "read_story_script 꼬리표 ⟨S12.3·a1b2c3⟩ 의 앞쪽(S12.3). id 대신 쓴다." },
    id: { type: "string", description: "list_dialogue 의 줄 id 그대로. ref 를 쓰면 생략." },
    hash: { type: "string", description: "list_dialogue 의 hash, 또는 read_story_script 꼬리표의 뒤쪽 6자(a1b2c3). 원문이 그 사이 바뀌었으면 거절된다." },
    text: { type: "string", description: "고친 글 전체. 줄바꿈은 실제 줄바꿈 문자로 넣는다(「\\n」 두 글자로 쓰지 않는다). 제어 코드(\\C[n] \\N[n] \\. \\| [흔들]…[/] {name} 등)는 원문 그대로 남긴다." },
    reason: { type: "string", description: "무엇을 왜 바꿨는지 한 줄(사람이 검토할 때 본다)." },
  },
  required: ["hash", "text"],
  additionalProperties: false,
} as const;

/** ref(S12.3)·짧은 hash(꼬리표 6자)를 정식 id·hash 로 푼다. 원문이 바뀌어 hash 가 안 맞으면 받은 값 그대로 둬 거절되게 한다. */
function resolveEditTarget(project: Project, story: () => Story, index: number, record: Record<string, unknown>): { id: string; hash: string } {
  const ref = str(record.ref).trim();
  let id = str(record.id).trim();
  const hash = str(record.hash).trim().replace(/^·/u, "");
  if (!id && ref) {
    const target = resolveStoryRef(story(), ref);
    if (!target?.line) throw new ToolError(`edits[${index}] ref 「${ref}」 를 찾지 못했다 — read_story_script 를 다시 읽어 꼬리표를 확인하라.`, { code: "invalid-args" });
    id = target.line.id;
  }
  if (!id || !hash) throw new ToolError(`edits[${index}] 에 ref(또는 id)·hash·text 가 필요하다.`, { code: "invalid-args" });
  if (hash.length >= STORY_HASH_PREFIX && hash.length < 12) {
    const line = collectDialogueLinesCached(project).get(id);
    if (line && line.hash.startsWith(hash)) return { id, hash: line.hash };
  }
  return { id, hash };
}

const lineMaps = new WeakMap<Project, Map<string, DialogueLine>>();
function collectDialogueLinesCached(project: Project): Map<string, DialogueLine> {
  let map = lineMaps.get(project);
  if (!map) { map = new Map(collectDialogueLines(project).map((line) => [line.id, line])); lineMaps.set(project, map); }
  return map;
}

const rewriteDialogue: ToolDefinition = {
  name: "rewrite_dialogue",
  description:
    "대사 여러 줄을 한 번에 고친다(윤문·말투 맞추기·줄이기). edits 는 {ref 또는 id, hash, text, reason} 배열(최대 80). " +
    "read_story_script 로 읽었으면 줄 끝 꼬리표 ⟨S12.3·a1b2c3⟩ 를 ref:\"S12.3\", hash:\"a1b2c3\" 로 넘긴다. " +
    "한 번에 한두 장면(30줄 안팎)씩 나눠 부른다 — 수십 줄을 한 호출에 몰면 응답이 길어져 끊길 수 있다. 고칠 필요가 없는 줄은 넣지 않는다. " +
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
  invalidArgsExample: { edits: [{ ref: "S12.3", hash: "a1b2c3", text: "멈춰라. 통행증.", reason: "경비병 말투를 짧게" }], mode: "propose" },
  run(draft, args): ToolExecResult {
    const raw = Array.isArray(args.edits) ? args.edits : [];
    if (raw.length === 0) throw new ToolError("edits 가 비었다.", { code: "invalid-args" });
    if (raw.length > REWRITE_MAX) throw new ToolError(`한 번에 ${REWRITE_MAX}줄까지 — 나눠서 부른다.`, { code: "invalid-args" });
    let story: Story | undefined;
    const storyOf = (): Story => (story ??= buildStory(draft, { fresh: true }));
    const edits: (DialogueEditRequest & { readonly reason?: string })[] = raw.map((entry, index) => {
      const record = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
      if (typeof record.text !== "string") throw new ToolError(`edits[${index}] 에 text 가 필요하다.`, { code: "invalid-args" });
      const { id, hash } = resolveEditTarget(draft, storyOf, index, record);
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
    const rejected: { id: string; reason?: string; message?: string }[] = verdicts.filter((verdict) => !verdict.ok).map((verdict) => ({ id: verdict.id, reason: verdict.reason, message: verdict.message }));
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
      const placed = upsertDialogueProposals(draft, proposals);
      if (placed < proposals.length) {
        const dropped = proposals.slice(placed);
        const full = `제안 칸이 찼다(최대 ${DIALOGUE_PROPOSAL_LIMIT}) — 사람이 「대사」 탭에서 걸린 제안을 받거나 버린 뒤 다시 낸다.`;
        if (placed === 0) throw new ToolError(`고친 줄 0 — ${full}`, { code: "dialogue-proposals-full" });
        const droppedIds = new Set(dropped.map((proposal) => proposal.lineId));
        for (let index = accepted.length - 1; index >= 0; index -= 1) if (droppedIds.has(accepted[index]!.id)) accepted.splice(index, 1);
        for (const proposal of dropped) rejected.push({ id: proposal.lineId, reason: "full", message: full });
      }
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
          ...(story && lineRefLabel(story, verdict.id) ? { ref: lineRefLabel(story, verdict.id) } : {}),
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

const SCRIPT_CHARS_DEFAULT = 14000;
const SCRIPT_CHARS_MAX = 40000;

function chapterArg(story: Story, raw: unknown): string | undefined {
  const value = str(raw).trim();
  if (!value) return undefined;
  const found = story.chapters.find((chapter) => chapter.id === value || chapter.title === value || chapter.title.includes(value))
    ?? (/^\d+$/u.test(value) ? story.chapters[Number(value) - 1] : undefined);
  if (!found) throw new ToolError(`막 「${value}」 없음 — get_story_outline 의 막 id(ch1…)를 쓴다. 있는 막: ${story.chapters.map((chapter) => `${chapter.id} ${chapter.title}`).join(", ")}`, { code: "invalid-args" });
  return found.id;
}

const getStoryOutline: ToolDefinition = {
  name: "get_story_outline",
  description:
    "이야기 전체 줄거리 지도: 막(엔딩 카드로 나뉜다) → 장(장소) → 장면을 «이야기 순서» 로 돌려준다(맵 순서가 아니다 — 스위치·변수·아이템 조건과 자동 시작 컷신·이동으로 정렬). " +
    "장면마다 번호(본줄 S1…, 곁가지 B1…)·장소·발동·조건·대사 수·한 줄 요약, 그리고 등장인물(대사 수·말투 메모)과 문체 규칙. " +
    "대사를 다듬거나 이야기를 파악할 때 맨 먼저 부른다 → 그다음 read_story_script 로 장면 본문을 읽는다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      chapter: { type: "string", description: "이 막만(ch1·ch2… 또는 막 제목)." },
      includeSide: { type: "boolean", description: "곁가지(본줄 밖 NPC 잡담·조사·잠긴 문) 목록도. 기본 false — 본줄 장면마다 곁가지 개수만 붙는다." },
    },
    additionalProperties: false,
  },
  invalidArgsExample: { chapter: "ch1" },
  run(project, args): ToolExecResult {
    const story = buildStory(project, { fresh: true });
    const chapterId = chapterArg(story, args.chapter);
    const outline = renderOutlineText(project, story, { includeSide: args.includeSide === true, ...(chapterId ? { chapterId } : {}) });
    const desk = readDialogueDesk(project);
    const mainCount = story.chapters.reduce((sum, chapter) => sum + chapter.mainIds.length, 0);
    const sideCount = story.chapters.reduce((sum, chapter) => sum + chapter.sideIds.length, 0);
    return {
      summary: `막 ${story.chapters.length}개 · 본줄 ${mainCount}장면 · 곁가지 ${sideCount}장면`,
      data: {
        outline,
        chapters: story.chapters.map((chapter) => ({ id: chapter.id, title: chapter.title, main: chapter.mainIds.length, side: chapter.sideIds.length })),
        cast: storyCast(project, story).slice(0, 40),
        ...(project.aiAuthoring?.dialogueStyleRules?.trim() ? { styleRules: project.aiAuthoring.dialogueStyleRules.trim() } : {}),
        pendingProposals: desk.proposals.length,
        next: "read_story_script 로 장면 본문을 읽는다(chapter 또는 from/to). 요약이 «(자동)» 인 장면은 다 읽은 뒤 set_scene_summaries 로 한 줄 요약을 남겨 두면 다음에 다시 안 읽어도 된다.",
      },
    };
  },
};

const readStoryScript: ToolDefinition = {
  name: "read_story_script",
  description:
    "장면 본문을 대본처럼 읽는다: 장면 머리(장소·발동·조건) · 「화자: 대사」 · [지문](이동·전투·아이템·진행) · [선택지] 와 > 갈래 · {조건 분기}. " +
    "줄 끝 꼬리표 ⟨S12.3·a1b2c3⟩ 는 rewrite_dialogue 의 ref·hash 다. 대사가 똑같은 쌍둥이 장면은 «S2 와 같다» 로 줄인다. " +
    "chapter(막 하나), from/to(본줄 번호 범위, 그 사이 곁가지는 includeSide 일 때), scenes([\"S12\",\"B4\"]), speaker(그 인물이 나오는 장면만 — 곁가지 포함) 로 고른다. " +
    "글이 maxChars 를 넘으면 잘라 nextFrom 을 준다 — 이어서 from:nextFrom 으로 부른다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      chapter: { type: "string", description: "막 id(ch1…) 또는 제목." },
      from: { type: "string", description: "시작 장면 번호(S5)." },
      to: { type: "string", description: "끝 장면 번호(S12)." },
      scenes: { type: "array", items: { type: "string" }, maxItems: 60, description: "읽을 장면 번호들(S12, B4)." },
      speaker: { type: "string", description: "이 화자가 말하는 장면만." },
      includeSide: { type: "boolean", description: "곁가지 장면도 함께(기본 false)." },
      maxChars: { type: "integer", minimum: 2000, maximum: SCRIPT_CHARS_MAX },
    },
    additionalProperties: false,
  },
  invalidArgsExample: { chapter: "ch1", from: "S1", to: "S8" },
  run(project, args): ToolExecResult {
    const story = buildStory(project, { fresh: true });
    const chapterId = chapterArg(story, args.chapter);
    const sceneRefs = Array.isArray(args.scenes) ? args.scenes.map(str).filter(Boolean) : [];
    const speaker = normalizeSpeakerName(str(args.speaker));
    // 없는 번호(곁가지가 B217 까지인데 B226)를 받으면 말없이 빈 결과로 떨어지지 않게 범위를 알려 준다.
    const knownRefs = new Set([...story.scenes.values()].map((scene) => scene.ref));
    const unknown = [str(args.from), str(args.to), ...sceneRefs].map((ref) => ref.trim().toUpperCase()).filter((ref) => ref && !knownRefs.has(ref));
    if (unknown.length > 0) {
      const count = (lane: "main" | "side"): number => [...story.scenes.values()].filter((scene) => scene.lane === lane).length;
      throw new ToolError(`장면 번호 ${unknown.slice(0, 4).join(", ")} 없음 — 본줄은 S1~S${count("main")}, 곁가지는 B1~B${count("side")} 이다.`, { code: "invalid-args" });
    }
    const scenes = selectScenes(story, {
      ...(chapterId ? { chapterId } : {}),
      ...(str(args.from) ? { from: str(args.from) } : {}),
      ...(str(args.to) ? { to: str(args.to) } : {}),
      ...(sceneRefs.length ? { sceneRefs } : {}),
      ...(speaker ? { speaker } : {}),
      includeSide: args.includeSide === true,
    });
    if (scenes.length === 0) throw new ToolError("고른 장면이 없다 — get_story_outline 의 번호(S1…, B1…)와 막 id 를 확인하라.", { code: "invalid-args" });
    const maxChars = typeof args.maxChars === "number" ? Math.max(2000, Math.min(SCRIPT_CHARS_MAX, Math.trunc(args.maxChars))) : SCRIPT_CHARS_DEFAULT;
    const parts: string[] = [];
    let used = 0;
    let nextFrom: string | undefined;
    for (const scene of scenes) {
      const text = renderSceneText(project, story, scene);
      if (parts.length > 0 && used + text.length > maxChars) { nextFrom = scene.ref; break; }
      parts.push(text);
      used += text.length + 2;
    }
    const shown = parts.length;
    const lineCount = scenes.slice(0, shown).reduce((sum, scene) => sum + (scene.sameAs ? 0 : scene.lines.length), 0);
    return {
      summary: `장면 ${shown}/${scenes.length}개 · 대사 ${lineCount}줄${nextFrom ? ` — 잘림, 이어서 from:${nextFrom}` : ""}`,
      data: {
        script: parts.join("\n\n"),
        ...(nextFrom ? { nextFrom } : {}),
        tagNote: "⟨S12.3·a1b2c3⟩ = rewrite_dialogue 의 ref:S12.3 · hash:a1b2c3. «창 넘침 3/2줄» = 대화창 한 장(2줄)을 넘는 줄 — 줄여서 한 장에 맞춘다. [ ] 는 지문(고칠 수 없다), { } 는 조건 갈래, > 는 선택지 갈래.",
        windowCheck: hasMeasuredDialogueFit(project) ? "창 넘침 = 편집기 실측(런타임 글꼴·폭)" : "창 넘침 = 추정(편집기가 아직 대화창을 재지 않았다)",
      },
    };
  },
};

const setSceneSummaries: ToolDefinition = {
  name: "set_scene_summaries",
  description:
    "장면 한 줄 요약을 프로젝트에 남긴다(빈 summary 는 지움, 한 번에 60개). get_story_outline 이 자동 요약 대신 이것을 보이고, 사람도 「대사 → 대본」 에서 본다·고친다. " +
    "장면을 다 읽은 뒤 «누가 무엇을 해서 무엇이 바뀌는지» 를 60자 안팎으로 쓴다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 60,
        items: {
          type: "object",
          properties: {
            scene: { type: "string", description: "장면 번호(S12·B4)." },
            summary: { type: "string", description: "한 줄 요약(200자 이내)." },
          },
          required: ["scene", "summary"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
  invalidArgsExample: { items: [{ scene: "S3", summary: "숲지기 브람이 추락지 위치를 알려 주고, 밤새 들린 사람 목소리를 전한다." }] },
  run(draft, args): ToolExecResult {
    const raw = Array.isArray(args.items) ? args.items : [];
    if (raw.length === 0) throw new ToolError("items 가 비었다.", { code: "invalid-args" });
    const story = buildStory(draft, { fresh: true });
    const missing: string[] = [];
    const items = raw.flatMap((entry) => {
      const record = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
      const ref = str(record.scene).trim();
      const scene = resolveStoryRef(story, ref.replace(/\.\d+$/u, ""))?.scene ?? story.scenes.get(ref);
      if (!scene) { missing.push(ref); return []; }
      return [{ sceneId: scene.id, summary: str(record.summary) }];
    });
    if (items.length === 0) throw new ToolError(`장면을 못 찾았다 — ${missing.slice(0, 6).join(", ")}`, { code: "invalid-args" });
    const changed = writeSceneNotes(draft, items, "ai");
    return {
      summary: `장면 요약 ${changed}개를 남겼다${missing.length ? ` (못 찾은 번호 ${missing.length}: ${missing.slice(0, 4).join(", ")})` : ""}.`,
      data: { changed, missing },
    };
  },
};

export const DIALOGUE_TOOLS: readonly ToolDefinition[] = [getStoryOutline, readStoryScript, listDialogue, getDialogueContext, rewriteDialogue, setSpeakerVoice, setSceneSummaries];
