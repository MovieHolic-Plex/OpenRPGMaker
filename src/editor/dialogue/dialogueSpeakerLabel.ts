// editor/dialogue/dialogueSpeakerLabel.ts
// 대사 글 맨 앞의 「이름: 」 라벨 — 조수가 화자 칸 대신 글에 이름을 적어 넣은 꼴(「여신: 어머, 맨손이에요?」).
//
// 왜(2026-10-30 완성 뒤 윤문 고리 실측): 린터는 이 라벨을 「기호(콜론 라벨)」로 잡는다. 모델에게 맡기면 Opus 는 라벨을 지우기만 해서
// 누가 말하는지가 사라졌고, terra 는 「접수대 직원이 말한다. …」 같은 3인칭 서술로 바꿔 대사 맛을 버렸다. 린터 수치는 0 이 됐지만 게임은 나빠졌다.
// 그래서 라벨은 모델이 아니라 실행기가 결정적으로 처리한다:
//   - 그 자리에 대화창 이름표(화자 칸)가 있으면 이름을 화자 칸으로 옮기고 글에서 라벨을 뗀다(화자 칸이 비었거나 같은 이름일 때만).
//   - 화자 칸이 없는 자리(선택지·설명·퀘스트 글)나 화자 칸에 다른 이름이 있는 줄은 그대로 두고, 그 라벨 적중은 세지 않는다.
// 판정은 이 파일 하나다 — 실행기 고리(src/ai/piAgent/dialoguePolishHook.ts)와 내부 도구(liftDialogueSpeakerLabelsTool)가 같이 쓴다.

import { collectDialogueLines, resolveDialogueSlot } from "@/editor/dialogue/dialogueIndex";
import { normalizeSpeakerName } from "@/project/dialogueDesk";
import type { Project } from "@/project/types";
import type { ToolDefinition, ToolExecResult } from "@/editor/tools/types";

/** 라벨처럼 생겼어도 말하는 이가 아닌 머리말 — 이것들은 라벨로 보지 않는다(모델이 문장으로 풀어 쓸 일이다). */
const NOT_SPEAKERS = new Set([
  "주의", "경고", "참고", "힌트", "팁", "목표", "보상", "획득", "알림", "메모", "안내", "공지", "결과", "정답", "조건", "비용", "효과", "설명", "위치", "시간", "날짜",
  "note", "tip", "hint", "warning", "goal", "reward", "info",
]);
const NAME_PART = String.raw`[^\s:：.!?。,、…「」『』"'()（）\[\]\\<>]`;
const LABEL = new RegExp(String.raw`^\s*(${NAME_PART}{1,12}(?: ${NAME_PART}{1,10})?)\s*[:：][ \t]*(\S[\s\S]*)$`, "u");
/** 이름으로 모르는 라벨은 이 길이까지만 이름으로 본다. */
const UNKNOWN_NAME_MAX = 8;

export interface SpeakerLabel {
  readonly name: string;
  /** 라벨을 뗀 글(대사 안 줄바꿈은 그대로). */
  readonly rest: string;
}

/** 이 프로젝트에서 말하는 이로 알려진 이름 — 배우·이벤트 이름·이미 쓰인 화자. */
export function knownSpeakerNames(project: Project): ReadonlySet<string> {
  const names = new Set<string>();
  const add = (value: unknown): void => { if (typeof value === "string" && value.trim()) names.add(normalizeSpeakerName(value)); };
  for (const actor of project.database?.actors ?? []) add(actor.name);
  for (const map of Object.values(project.maps ?? {})) for (const event of map?.events ?? []) add((event as { name?: unknown }).name);
  for (const line of collectDialogueLines(project)) add(line.speaker);
  return names;
}

/** 글 맨 앞의 「이름: 」 라벨. 말하는 이로 볼 수 없으면 undefined. */
export function parseSpeakerLabel(text: string, known: ReadonlySet<string>): SpeakerLabel | undefined {
  const match = LABEL.exec(text);
  if (!match) return undefined;
  const name = normalizeSpeakerName(match[1]!);
  const rest = match[2]!;
  if (!/\p{L}/u.test(name) || NOT_SPEAKERS.has(name.toLowerCase())) return undefined;
  if (!known.has(name) && [...name].length > UNKNOWN_NAME_MAX) return undefined;
  return { name, rest };
}

export type SpeakerLabelOutcome =
  | { readonly id: string; readonly action: "lifted"; readonly name: string; readonly before: string; readonly after: string; readonly speakerWas: string }
  | { readonly id: string; readonly action: "kept"; readonly name: string; readonly reason: "no-speaker-field" | "other-speaker" };

/**
 * 줄마다 라벨을 화자 칸으로 옮긴다(제자리 — 도구 초안 안에서만 부른다). 화자 칸이 없거나 다른 이름이 있으면 그대로 둔다.
 * 라벨이 없는 줄은 결과에 넣지 않는다.
 */
export function liftSpeakerLabels(project: Project, lineIds: readonly string[], known: ReadonlySet<string> = knownSpeakerNames(project)): SpeakerLabelOutcome[] {
  const out: SpeakerLabelOutcome[] = [];
  for (const id of lineIds) {
    const slot = resolveDialogueSlot(project, id);
    if (!slot || slot.drafted) continue;
    const label = parseSpeakerLabel(slot.text, known);
    if (!label) continue;
    if (!slot.speaker) { out.push({ id, action: "kept", name: label.name, reason: "no-speaker-field" }); continue; }
    const current = normalizeSpeakerName(slot.speaker.value);
    if (current && current !== label.name) { out.push({ id, action: "kept", name: label.name, reason: "other-speaker" }); continue; }
    const before = slot.text;
    if (!current) slot.speaker.write(label.name);
    slot.write(label.rest);
    out.push({ id, action: "lifted", name: label.name, before, after: label.rest, speakerWas: current });
  }
  return out;
}

/**
 * 실행기 고리 전용 내부 도구(레지스트리에 올리지 않는다 — 모델에게 보이지 않는다). runToolDefinition 으로 불러
 * 다른 쓰기 도구와 같은 초안·적용 검증을 지난다.
 */
export const liftDialogueSpeakerLabelsTool: ToolDefinition = {
  name: "lift_dialogue_speaker_labels",
  description: "대사 글 맨 앞의 「이름: 」 라벨을 대화창 화자 칸으로 옮긴다(실행기 내부 단계).",
  mode: "write",
  domains: ["event"],
  parameters: {
    type: "object",
    properties: { lineIds: { type: "array", items: { type: "string" }, maxItems: 400 } },
    required: ["lineIds"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const ids = Array.isArray(args.lineIds) ? args.lineIds.filter((id): id is string => typeof id === "string") : [];
    const outcomes = liftSpeakerLabels(draft, ids, knownSpeakerNames(draft));
    const lifted = outcomes.filter((o) => o.action === "lifted").length;
    return { summary: `대사 라벨 → 화자 칸 ${lifted}줄, 그대로 둔 줄 ${outcomes.length - lifted}`, data: { outcomes } };
  },
};

/** 린터 적중 중 «말하는 이 라벨» 콜론 적중인가 — 이것은 세지 않는다(실행기가 따로 다룬다). */
export function isSpeakerLabelHit(text: string, pid: string, known: ReadonlySet<string>): boolean {
  return pid === "typo-colon-line" && parseSpeakerLabel(text, known) !== undefined;
}
