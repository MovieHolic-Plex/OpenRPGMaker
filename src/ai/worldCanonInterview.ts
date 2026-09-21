// 세계관 인터뷰 클라이언트 (2026-09-22)
//
// 세계 설정을 폼으로 채우게 하지 않고, 조수와 문답하며 한 칸씩 정한다. 모델은 매 턴
//   1) 조수가 지금까지 이해한 세계를 한두 문장으로 되짚어 주고,
//   2) 아직 비어 있는 칸 중 **가장 중요한 하나**를 질문하고,
//   3) 사용자가 답하면 그 답을 스키마 필드로 옮긴다.
// 산출물은 자유 문장이 아니라 **부분 패치 JSON**이다 — 스키마·경계값·store 계약은 기존
// 세계관과 완전히 같고, 여기서는 그 필드에 값을 채워 넣는 경로만 새로 만든다.
//
// 왜 JSON 인가: 대화 기록에서 값을 다시 파싱하면 모델이 문장을 바꿀 때마다 필드가 흔들린다.
// 패치를 명시적으로 받아 `compactWorldCanon` 으로 검증·클램프하는 편이 안전하다.
import { isAssistantEndpointReady, resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { chatCompletion, LlmError, type ChatMessage } from "@/ai/llmClient";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { composeSystemPrompt } from "@/ai/systemPromptEnvelope";
import {
  WORLD_CANON_LAW_KINDS,
  WORLD_CANON_BOUNDS,
  type ResolvedWorldCanon,
} from "@/project/world/canon";

export type InterviewPatch = {
  readonly name?: string;
  readonly premise?: string;
  readonly tones?: readonly string[];
  readonly era?: string;
  readonly techCeiling?: string;
  readonly absences?: readonly string[];
  readonly laws?: Partial<Record<string, { readonly present?: boolean; readonly note?: string }>>;
  readonly body?: string;
};

export type InterviewTurn = {
  /** 조수가 되짚어 주는 현재 이해. 사람에게 보여 주는 문장. */
  readonly recap: string;
  /** 조수가 지금 묻는 것. 빈 문자열이면 "더 물을 게 없다"는 뜻이다. */
  readonly question: string;
  /** 질문의 선택지(있으면 버튼으로 렌더). 자유 서술도 항상 허용한다. */
  readonly choices: readonly string[];
  /** 사용자 답변에서 뽑아낸 스키마 패치. 비어 있을 수 있다. */
  readonly patch: InterviewPatch;
  /** 인터뷰가 끝났다고 모델이 판단했는가. */
  readonly done: boolean;
};

const TONE_IDS = ["hopeful", "grim", "comic", "political", "slice", "gothic", "fairytale", "mythic"] as const;

const SYSTEM_PROMPT = [
  "You interview a Korean game author to fill in their world bible, one slot at a time.",
  "Always answer with exactly one JSON object and nothing else:",
  '{"recap": string, "question": string, "choices": string[], "patch": object, "done": boolean}',
  "",
  "Rules:",
  "- recap: one or two Korean sentences restating what you now understand about the world. If nothing is known yet, say so briefly.",
  "- question: the single most valuable slot to ask next, in Korean, conversational and concrete. Ask for ONE thing only.",
  "- choices: 0-4 short Korean suggestions the author can click instead of typing. Use [] when free prose is better.",
  "- patch: values the author has ALREADY given you in this conversation, mapped onto the schema below. Only include fields the author actually stated or clearly agreed to. Never invent facts, never fill a field the author has not spoken about.",
  "- done: true only when every required slot below is settled and nothing important is left to ask.",
  "",
  "Schema for patch (all optional; omit what the author has not decided):",
  '- name: string, the world name (max 120 chars)',
  '- premise: string, one-sentence premise (max 280 chars)',
  `- tones: subset of [${TONE_IDS.join(", ")}] (Korean meanings: 희망, 우울, 코믹, 정치, 일상, 고딕, 동화, 신화)`,
  '- era: string, era/setting (max 80 chars)',
  '- techCeiling: string, tech ceiling (max 80 chars)',
  '- absences: string[], things this world must NOT contain (max 32 items, 40 chars each). Partial-match warning: a short word also blocks longer words containing it.',
  `- laws: object with keys ${WORLD_CANON_LAW_KINDS.join(", ")}. Each value is {"present": true|false, "note": string}. ` +
    "present:true means the world has it (note = the rule), present:false means it explicitly does not exist, omit the key while undecided. " +
    "power=마법·기·과학, gods=신·종교, death=죽음 다음, money=돈의 정체.",
  "- body: string, prose the author dictated for the world's story. Only when they clearly asked you to write it down.",
  "",
  "Slots to settle, in priority order: name, premise, tones, laws, absences, era, techCeiling, body.",
  "Ask about ONE slot per turn and keep the Korean natural. Never output markdown fences or commentary outside the JSON.",
].join("\n");

export function interviewHistoryToMessages(
  history: readonly { readonly role: "user" | "assistant"; readonly text: string }[],
  canon: ResolvedWorldCanon,
): ChatMessage[] {
  const known = knownSlotSummary(canon);
  const messages: ChatMessage[] = [
    { role: "system", content: composeSystemPrompt({ surface: "world-canon-interview", body: SYSTEM_PROMPT, includePolicy: true }) },
    { role: "system", content: `현재까지 저장된 세계 설정(사용자가 이전에 확정한 값):\n${known}` },
  ];
  for (const turn of history) messages.push({ role: turn.role, content: turn.text });
  if (history.length === 0) {
    messages.push({ role: "user", content: "세계 설정을 처음부터 함께 정하자. 첫 질문을 해 줘." });
  }
  return messages;
}

export function knownSlotSummary(canon: ResolvedWorldCanon): string {
  const lines: string[] = [];
  if (canon.name.trim()) lines.push(`이름: ${canon.name.trim()}`);
  if (canon.premise.trim()) lines.push(`전제: ${canon.premise.trim()}`);
  if (canon.tones.length > 0) lines.push(`톤: ${canon.tones.join(", ")}`);
  if (canon.era.trim()) lines.push(`시대: ${canon.era.trim()}`);
  if (canon.techCeiling.trim()) lines.push(`기술 천장: ${canon.techCeiling.trim()}`);
  if (canon.absences.length > 0) lines.push(`없는 것: ${canon.absences.join(", ")}`);
  for (const kind of WORLD_CANON_LAW_KINDS) {
    const law = canon.laws[kind];
    if (law.present === undefined && !law.note.trim()) continue;
    lines.push(`법칙 ${kind}: ${law.present === undefined ? "미정" : law.present ? "있음" : "없음"}${law.note.trim() ? ` — ${law.note.trim()}` : ""}`);
  }
  if (canon.body.trim()) lines.push(`본문: ${canon.body.trim().length}자 작성됨`);
  return lines.length > 0 ? lines.join("\n") : "(아직 비어 있음)";
}

/**
 * 인터뷰 한 턴. 실패는 던지지 않고 사용자에게 보여줄 한국어 메시지로 바꾼다 —
 * 이 패널은 폼이 아니라 대화라, 오류도 대화의 한 줄로 보여야 한다.
 */
export async function requestWorldCanonInterview(options: {
  readonly history: readonly { readonly role: "user" | "assistant"; readonly text: string }[];
  readonly canon: ResolvedWorldCanon;
  readonly signal?: AbortSignal;
}): Promise<{ ok: true; turn: InterviewTurn } | { ok: false; message: string }> {
  const config = resolveSurfaceAiConfig("world-canon-interview");
  if (!isAssistantEndpointReady(config, getAiConnectionStatus(config))) {
    return { ok: false, message: "AI 연결이 필요합니다. 편집기 헤더의 AI 설정에서 로그인하거나 API 키를 넣어 주세요." };
  }
  try {
    const result = await chatCompletion(config, {
      messages: interviewHistoryToMessages(options.history, options.canon),
      response_format: { type: "json_object" },
      temperature: 0.4,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    const content = typeof result.message.content === "string" ? result.message.content : "";
    const turn = parseInterviewTurn(content);
    if (!turn) return { ok: false, message: "조수 응답을 해석하지 못했습니다. 다시 시도해 주세요." };
    return { ok: true, turn };
  } catch (error) {
    if (error instanceof LlmError) return { ok: false, message: error.message };
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** 모델 출력 → InterviewTurn. 코드펜스·앞뒤 잡음을 견디고, 스키마 밖 필드는 버린다. */
export function parseInterviewTurn(raw: string): InterviewTurn | null {
  const json = extractJsonObject(raw);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  return {
    recap: typeof record.recap === "string" ? record.recap.trim() : "",
    question: typeof record.question === "string" ? record.question.trim() : "",
    choices: Array.isArray(record.choices)
      ? record.choices.filter((choice): choice is string => typeof choice === "string" && choice.trim().length > 0).slice(0, 4)
      : [],
    patch: sanitizePatch(record.patch),
    done: record.done === true,
  };
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/u);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

function sanitizePatch(value: unknown): InterviewPatch {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  const patch: {
    name?: string;
    premise?: string;
    tones?: readonly string[];
    era?: string;
    techCeiling?: string;
    absences?: readonly string[];
    laws?: Record<string, { present?: boolean; note?: string }>;
    body?: string;
  } = {};
  const bounded = (input: unknown, max: number): string | undefined => {
    if (typeof input !== "string") return undefined;
    const text = input.trim();
    return text.length > 0 ? text.slice(0, max) : undefined;
  };
  const name = bounded(record.name, WORLD_CANON_BOUNDS.name);
  if (name !== undefined) patch.name = name;
  const premise = bounded(record.premise, WORLD_CANON_BOUNDS.premise);
  if (premise !== undefined) patch.premise = premise;
  const era = bounded(record.era, WORLD_CANON_BOUNDS.era);
  if (era !== undefined) patch.era = era;
  const techCeiling = bounded(record.techCeiling, WORLD_CANON_BOUNDS.techCeiling);
  if (techCeiling !== undefined) patch.techCeiling = techCeiling;
  if (Array.isArray(record.tones)) {
    const tones = record.tones.filter((tone): tone is string => typeof tone === "string" && (TONE_IDS as readonly string[]).includes(tone));
    if (tones.length > 0) patch.tones = Array.from(new Set(tones));
  }
  if (Array.isArray(record.absences)) {
    const absences = record.absences
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim().slice(0, WORLD_CANON_BOUNDS.absence))
      .filter((entry) => entry.length > 0);
    if (absences.length > 0) patch.absences = Array.from(new Set(absences)).slice(0, WORLD_CANON_BOUNDS.absenceCount);
  }
  if (typeof record.laws === "object" && record.laws !== null) {
    const laws: Record<string, { present?: boolean; note?: string }> = {};
    for (const kind of WORLD_CANON_LAW_KINDS) {
      const entry = (record.laws as Record<string, unknown>)[kind];
      if (typeof entry !== "object" || entry === null) continue;
      const lawRecord = entry as Record<string, unknown>;
      const next: { present?: boolean; note?: string } = {};
      if (typeof lawRecord.present === "boolean") next.present = lawRecord.present;
      const note = bounded(lawRecord.note, WORLD_CANON_BOUNDS.lawNote);
      if (note !== undefined) next.note = note;
      if (next.present !== undefined || next.note !== undefined) laws[kind] = next;
    }
    if (Object.keys(laws).length > 0) patch.laws = laws;
  }
  const body = bounded(record.body, WORLD_CANON_BOUNDS.body);
  if (body !== undefined) patch.body = body;
  return patch;
}

/** 인터뷰 패치를 기존 세계관으로 병합한다. 저장은 호출부가 기존 writeCanon 경로로 한다. */
export function mergeInterviewPatch(canon: ResolvedWorldCanon, patch: InterviewPatch): Partial<ResolvedWorldCanon> {
  const next: {
    name?: string;
    premise?: string;
    tones?: readonly ResolvedWorldCanon["tones"][number][];
    era?: string;
    techCeiling?: string;
    absences?: readonly string[];
    laws?: ResolvedWorldCanon["laws"];
    body?: string;
  } = {};
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.premise !== undefined) next.premise = patch.premise;
  if (patch.era !== undefined) next.era = patch.era;
  if (patch.techCeiling !== undefined) next.techCeiling = patch.techCeiling;
  if (patch.tones !== undefined) {
    next.tones = Array.from(new Set([...canon.tones, ...patch.tones.filter((tone): tone is ResolvedWorldCanon["tones"][number] => (TONE_IDS as readonly string[]).includes(tone))]));
  }
  if (patch.absences !== undefined) {
    next.absences = Array.from(new Set([...canon.absences, ...patch.absences])).slice(0, WORLD_CANON_BOUNDS.absenceCount);
  }
  if (patch.body !== undefined) {
    const merged = canon.body.trim().length > 0 ? `${canon.body.trimEnd()}\n\n${patch.body}` : patch.body;
    next.body = merged.slice(0, WORLD_CANON_BOUNDS.body);
  }
  if (patch.laws !== undefined) {
    const laws = { ...canon.laws };
    for (const kind of WORLD_CANON_LAW_KINDS) {
      const entry = patch.laws[kind];
      if (!entry) continue;
      const current = laws[kind];
      laws[kind] = {
        present: entry.present === undefined ? current.present : entry.present,
        note: entry.note === undefined ? current.note : entry.note,
      };
    }
    next.laws = laws;
  }
  return next;
}

