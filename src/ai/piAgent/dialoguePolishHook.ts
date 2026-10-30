// 완성 뒤 대사 윤문 고리 — 게임(또는 큰 덩어리)을 다 지은 실행의 끝에서 실행기가 스스로 도는 단계.
//
// 왜(2026-10-30 사용자): 「저 윤문을 ai 조수가, 게임을 완성한다고 판단한 이후의 hook 으로 넣어서 잘 윤문하게끔 했음 좋겠거든?」
// 공식 윤문 스킬 dialogue-polish(general-good-writing, 코드 연규)와 린터 lint_dialogue 는 #3962 로 들어왔지만, 조수가 스스로 부르지 않으면
// 새로 쓴 대사에 번역투·모델 틱·「A가 아니라 B」·em dash 가 그대로 남는다. 그래서 지시문이 아니라 실행기 단계로 건다:
//   1. 이번 실행이 쓰거나 바꾼 플레이어 글을 대사 색인(collectDialogueLines — 「대사」 탭·list_dialogue 와 같은 색인)에서 모은다.
//      «이번 실행이 썼다» = 실행 시작 프로젝트의 어떤 줄과도 글이 다르다(줄 id 는 명령 경로라 끼우기·지우기로 밀리므로 글로 가른다).
//   2. 모델 없이 린터를 돌려 스킬이 지우라고 한 계열(아래 DIALOGUE_POLISH_FAMILIES)의 적중을 센다.
//   3. 적중이 있으면 조수에게 한 차례(최대 DIALOGUE_POLISH_MAX_ROUNDS) 더 맡긴다 — 그 차례에는 윤문 도구만 남기고,
//      rewrite_dialogue 는 스킬(read_assistant_skill dialogue-polish)과 장면 문맥(read_story_script·get_dialogue_context)을 읽기 전에는 거절한다.
//      이번 실행이 쓴 줄은 바로 고치고(apply), 사람이 쓴 줄은 「대사」 탭 제안(propose)으로만 남긴다 — 모델이 고른 mode 와 무관하게 실행기가 가른다.
//   4. 차례마다 실행기가 다시 린트해 전/후 적중 수를 실행 기록(execution_status dialogue_polish)과 마지막 보고에 남긴다.
// 끄기: AI 설정 「동작」 → 「완성 뒤 대사 윤문」(요청 dialoguePolish:false), 시험용 OPRN_DIALOGUE_POLISH_HOOK=0.
// 맵 소유권: 같은 실행 안의 단계라 그 실행이 쥔 맵 예약을 그대로 쓴다(새 실행·새 예약을 만들지 않는다). 묶음 실행의 범위 검사도 그대로 걸린다.

import { collectDialogueLines, type DialogueLine } from "@/editor/dialogue/dialogueIndex";
import { flattenDialogueText, lintDialogueTexts, type DialoguePolishHit } from "@/editor/dialogue/dialoguePolishLint";
import { isSpeakerLabelHit } from "@/editor/dialogue/dialogueSpeakerLabel";
import { buildStory, lineRefLabel } from "@/editor/dialogue/storyScript";
import { speakerVoiceNote } from "@/project/dialogueDesk";
import type { Project } from "@/project/types";

/** 스킬 dialogue-polish 5절 4단계가 「0 으로 만든다」고 한 계열 + 추상명사 주어(사물의인화). */
export const DIALOGUE_POLISH_FAMILIES: readonly string[] = [
  "translationese", // 번역투
  "model-tic", // 모델틱(서사체 종결 「~였던 겁니다」 포함)
  "neg-redefine", // 부정재정의 「A가 아니라 B」
  "metaphor-noun", // 은유명사(축·지점·결…)
  "typography", // 기호(em dash·가운뎃점·화살표)
  "personify", // 사물의인화(추상명사 주어)
];
export const DIALOGUE_POLISH_MAX_ROUNDS = 2;
/** 한 차례 프롬프트에 싣는 적중 줄 상한(모델 응답이 길어져 끊기지 않게, rewrite_dialogue 권고 30줄 안팎). */
export const DIALOGUE_POLISH_MAX_PROMPT_LINES = 40;
/** 게임 전체 요청이 아니면 이만큼 새 글을 쓴 실행만 «큰 덩어리»로 본다. */
export const DIALOGUE_POLISH_MIN_NEW_LINES = 12;
/** 한 차례가 쓸 수 있는 모델 차례·토큰(입력+출력). 넘으면 윤문 도구가 거절하고 보고로 넘긴다. */
export const DIALOGUE_POLISH_ROUND_TURNS = 10;
export const DIALOGUE_POLISH_ROUND_TOKENS = 600_000;
/** 윤문 차례에 남기는 도구 — 이 밖의 도구는 그 차례 동안 선언에서 뺀다. */
export const DIALOGUE_POLISH_TOOLS: readonly string[] = [
  "read_assistant_skill", "get_story_outline", "read_story_script", "get_dialogue_context", "list_dialogue", "lint_dialogue", "rewrite_dialogue",
];
const CONTEXT_READ_TOOLS = new Set(["read_story_script", "get_dialogue_context"]);

export interface DialoguePolishPair {
  readonly id: string;
  readonly speaker?: string;
  readonly where: string;
  readonly before: string;
  readonly after: string;
  /** apply = 이번 실행이 쓴 줄을 바로 고침, propose = 사람이 쓴 줄이라 「대사」 탭 제안, label = 실행기가 「이름: 」 라벨을 화자 칸으로 옮김. */
  readonly how: "apply" | "propose" | "label";
  /** label 일 때 화자 칸에 들어간 이름. */
  readonly nameplate?: string;
}

export interface DialoguePolishReport {
  readonly ran: boolean;
  /** 고리가 돌지 않았거나 멈춘 사유(끔·새 글 없음·적중 없음·예산 …). */
  readonly reason?: string;
  readonly newLines: number;
  /** 고칠 계열 적중(줄 기준 합) — 고리 시작 때 / 마지막 차례 뒤. */
  readonly before: number;
  readonly after: number;
  readonly beforeByFamily: Readonly<Record<string, number>>;
  readonly afterByFamily: Readonly<Record<string, number>>;
  /** 모든 계열 적중(참고). */
  readonly beforeAll: number;
  readonly afterAll: number;
  readonly rounds: number;
  readonly applied: number;
  readonly proposed: number;
  /** 실행기가 「이름: 」 라벨을 화자 칸으로 옮긴 줄 / 화자 칸이 없어 그대로 둔 라벨 줄(세지 않음). */
  readonly labelsLifted?: number;
  readonly labelsKept?: number;
  readonly pairs: readonly DialoguePolishPair[];
  readonly ms: number;
  readonly tokens?: number;
}

export interface PolishLintRow {
  readonly line: DialogueLine;
  readonly hits: readonly DialoguePolishHit[];
}

export interface PolishLint {
  readonly rows: readonly PolishLintRow[];
  /** 고칠 계열 적중 수. */
  readonly target: number;
  readonly all: number;
  readonly byFamily: Readonly<Record<string, number>>;
}

function norm(text: string): string {
  return flattenDialogueText(text).normalize("NFC");
}

/** 실행 시작 프로젝트의 플레이어 글(펼친 글) 집합 — «사람이 쓴 줄» 판정의 기준. */
export function baseDialogueTexts(base: Project): ReadonlySet<string> {
  return new Set(collectDialogueLines(base, { includeDescriptions: true }).map((line) => norm(line.text)).filter(Boolean));
}

/** 이번 실행이 쓰거나 바꾼 줄 — 시작 프로젝트에 같은 글이 없는 줄. 빈 글·서식 글은 뺀다. */
export function runWrittenDialogueLines(project: Project, baseTexts: ReadonlySet<string>): DialogueLine[] {
  return collectDialogueLines(project, { includeDescriptions: true })
    .filter((line) => !line.drafted)
    .filter((line) => { const text = norm(line.text); return text.length >= 2 && !baseTexts.has(text); });
}

export function isRunWrittenText(text: string, baseTexts: ReadonlySet<string>): boolean {
  return !baseTexts.has(norm(text));
}

/**
 * known 을 주면 글 맨 앞 「이름: 」 라벨의 콜론 적중은 세지 않는다 — 라벨은 실행기가 화자 칸으로 옮기고(dialogueSpeakerLabel.ts),
 * 화자 칸이 없는 자리의 라벨은 그대로 둔다. 모델에게 «고치라» 고 넘기면 지우거나 3인칭 서술로 바꿔 글이 나빠졌다(2026-10-30 실측).
 */
export async function lintPolishLines(lines: readonly DialogueLine[], known?: ReadonlySet<string>): Promise<PolishLint> {
  const raw = await lintDialogueTexts(lines.map((line) => line.text));
  const hits = known ? raw.map((lineHits, index) => lineHits.filter((hit) => !isSpeakerLabelHit(lines[index]!.text, hit.pid, known))) : raw;
  const target = new Set(DIALOGUE_POLISH_FAMILIES);
  const byFamily: Record<string, number> = {};
  let targetCount = 0, all = 0;
  const rows: PolishLintRow[] = [];
  lines.forEach((line, index) => {
    const lineHits = hits[index] ?? [];
    all += lineHits.length;
    const mine = lineHits.filter((hit) => target.has(hit.family));
    for (const hit of mine) byFamily[hit.label] = (byFamily[hit.label] ?? 0) + 1;
    targetCount += mine.length;
    if (mine.length) rows.push({ line, hits: mine });
  });
  return { rows, target: targetCount, all, byFamily };
}

/** 고리가 이 실행에서 돌 자리인가(설정·실행 종류). 새 글 수 판정은 실행기가 따로 한다. */
export function dialoguePolishHookEnabled(input: {
  readonly requested?: boolean; readonly readOnly?: boolean; readonly teamMember?: boolean; readonly featurePolish?: boolean; readonly env?: string;
}): boolean {
  if (input.env === "0") return false;
  return input.requested !== false && !input.readOnly && !input.teamMember && !input.featurePolish;
}

export function dialoguePolishWanted(newLines: number, wholeGame: boolean): boolean {
  return wholeGame ? newLines > 0 : newLines >= DIALOGUE_POLISH_MIN_NEW_LINES;
}

function familySummary(byFamily: Readonly<Record<string, number>>): string {
  return Object.entries(byFamily).sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name} ${count}`).join(", ");
}

/** 윤문 차례 지시 — 줄 id·hash·꼬리표·말투 메모·적중을 그대로 싣는다. */
export function dialoguePolishRoundPrompt(project: Project, lint: PolishLint, round: number, maxRounds: number, first?: PolishLint): string {
  const previous = first;
  const story = buildStory(project, { fresh: true });
  const rows = lint.rows.slice(0, DIALOGUE_POLISH_MAX_PROMPT_LINES);
  const speakers = [...new Set(rows.map((row) => row.line.speaker).filter(Boolean))];
  const voices = speakers.flatMap((speaker) => { const note = speakerVoiceNote(project, speaker); return note ? [`- ${speaker}: ${note}`] : []; });
  const scenes = [...new Set(rows.flatMap((row) => { const ref = lineRefLabel(story, row.line.id); return ref ? [ref.split(".")[0]!] : []; }))];
  const body = rows.map((row) => {
    const ref = lineRefLabel(story, row.line.id);
    const head = `- id:${row.line.id} hash:${row.line.hash}${ref ? ` ref:${ref}` : ""}${row.line.speaker ? ` 화자:${row.line.speaker}` : ""} (${row.line.groupLabel})`;
    const hits = row.hits.map((hit) => `${hit.label} 「${hit.match}」 → ${hit.hint}`).join(" / ");
    return `${head}\n  글: ${JSON.stringify(row.line.text)}\n  적중: ${hits}`;
  }).join("\n");
  return [
    `[완성 뒤 대사 윤문 ${round}/${maxRounds} — 실행기 단계] 게임 짓기가 끝났다. 이번 실행이 쓴 플레이어 글을 윤문 린터에 돌렸더니 고칠 계열 적중이 ${lint.target}건 남았다(${familySummary(lint.byFamily)})`
      + `${previous ? ` — 처음 린트 때는 ${previous.target}건이었다. 앞 차례에 고치지 못한 줄이다` : ""}. 맵·이벤트·DB 는 더 짓지 않는다. 이 차례에는 윤문 도구만 있다.`,
    "순서(실행기가 지킨다 — 앞 단계 없이 rewrite_dialogue 를 부르면 거절된다):",
    "1. read_assistant_skill({id:'dialogue-polish'}) 를 읽는다(이번 실행에서 이미 읽었으면 다시 읽지 않는다).",
    `2. 장면 문맥을 읽는다: read_story_script({scenes:${JSON.stringify(scenes.slice(0, 12))}})${scenes.length ? "" : " 또는 get_dialogue_context({id})"} — 앞뒤 흐름과 인물 말투를 본다.`,
    "3. rewrite_dialogue({edits:[{id, hash, text, reason}], mode:'apply'}) 로 아래 줄만 고친다. 이번 실행이 쓴 줄은 실행기가 바로 반영하고, 사람이 쓴 줄을 건드리면 실행기가 「대사」 탭 제안으로 돌린다.",
    "   지킬 것: 각 화자의 말투(아래 말투 메모·이미 쓴 어미), 대사 안 줄 수(\\n 개수), 제어 코드·자리표시자(\\C[n] \\N[n] {name} [흔들]…[/])는 바이트 그대로, 숫자·단서·고유명사·화자 이름은 그대로. 고칠 필요가 없는 줄은 넣지 않는다.",
    "   말투가 그 어미를 요구해 남기는 적중은 reason 이 아니라 보고에 «남김: 이유» 로 적는다.",
    "   대사는 대사로 둔다: 3인칭 서술·지문(「직원이 말한다. …」「~라고 외쳤다」「~라고 적혀 있다」)로 바꾸지 않는다. 글 맨 앞의 「이름: 」 라벨은 실행기가 이미 화자 칸으로 옮겼다 — 남은 라벨은 지우지도 풀어 쓰지도 않는다.",
    "4. lint_dialogue({lineIds:[…]}) 로 고친 줄을 다시 검사한다. 끝나면 두세 줄로 보고한다(고친 줄 수, 남긴 적중과 이유). 실행기가 전/후 적중 수를 따로 센다 — 숫자를 지어내지 않는다.",
    ...(voices.length ? ["화자 말투 메모:", ...voices] : []),
    `고칠 줄(${rows.length}${lint.rows.length > rows.length ? ` / 적중 줄 ${lint.rows.length} 중 앞쪽` : ""}):`,
    body,
  ].join("\n");
}

/** 마지막 보고에 붙는 실행기 글 — 모델 말이 아니라 실행기가 센 숫자다. */
export function dialoguePolishReportText(report: DialoguePolishReport): string {
  if (!report.ran) return `대사 윤문(완성 뒤 자동 단계): ${report.reason ?? "돌지 않음"}.`;
  const left = report.after
    ? ` 남은 적중 ${report.after}건(${familySummary(report.afterByFamily)}) — 말투 때문에 남긴 것이면 위 보고의 이유를 보세요.`
    : "";
  const labels = report.labelsLifted ? ` 글 앞 「이름:」 라벨 ${report.labelsLifted}줄은 화자 칸(이름표)으로 옮겼다.` : "";
  return `대사 윤문(완성 뒤 자동 단계, 실행기가 센 숫자): 새로 쓴 글 ${report.newLines}줄에서 고칠 규칙 적중 ${report.before}건 → ${report.after}건`
    + ` (${report.rounds}차례, 바로 고친 줄 ${report.applied} · 「대사」 탭 제안 ${report.proposed}).${labels}${left}${report.reason ? ` ${report.reason}` : ""}`;
}

export function emptyPolishReport(reason: string, newLines = 0, ms = 0): DialoguePolishReport {
  return { ran: false, reason, newLines, before: 0, after: 0, beforeByFamily: {}, afterByFamily: {}, beforeAll: 0, afterAll: 0, rounds: 0, applied: 0, proposed: 0, pairs: [], ms };
}

/** 고리 시작 때 줄 글(id → 글)과 끝 프로젝트를 견주어 전/후 쌍을 만든다. */
export function dialoguePolishPairs(before: ReadonlyMap<string, DialogueLine>, project: Project, proposals: readonly { readonly lineId: string; readonly before: string; readonly after: string }[]): DialoguePolishPair[] {
  const pairs: DialoguePolishPair[] = [];
  for (const line of collectDialogueLines(project, { includeDescriptions: true })) {
    const was = before.get(line.id);
    if (!was || was.text === line.text) continue;
    pairs.push({ id: line.id, ...(line.speaker ? { speaker: line.speaker } : {}), where: line.groupLabel, before: was.text, after: line.text, how: "apply" });
  }
  for (const proposal of proposals) {
    const was = before.get(proposal.lineId);
    pairs.push({ id: proposal.lineId, ...(was?.speaker ? { speaker: was.speaker } : {}), where: was?.groupLabel ?? "", before: proposal.before, after: proposal.after, how: "propose" });
  }
  return pairs;
}

/** rewrite_dialogue 를 부를 수 있는가 — 스킬과 장면 문맥을 읽었나. 읽지 않았으면 거절 글. */
export function dialoguePolishRewriteGate(state: { readonly skillRead: boolean; readonly contextRead: boolean }): string | undefined {
  if (!state.skillRead) return "완성 뒤 윤문 단계: 먼저 read_assistant_skill({id:'dialogue-polish'}) 로 윤문 지침을 읽는다(실행기가 지킨다). 그다음 read_story_script 로 장면을 읽고 다시 부른다.";
  if (!state.contextRead) return "완성 뒤 윤문 단계: 고치기 전에 read_story_script({scenes:[…]}) 또는 get_dialogue_context({id}) 로 그 줄의 장면 문맥을 읽는다(실행기가 지킨다).";
  return undefined;
}

/** 윤문 단계의 도구 호출 하나를 기록해 관문 상태를 갱신한다. */
export function noteDialoguePolishCall(state: { skillRead: boolean; contextRead: boolean }, name: string, args: unknown, ok: boolean): void {
  if (!ok) return;
  const record = args && typeof args === "object" ? args as Record<string, unknown> : {};
  if (name === "read_assistant_skill" && record.id === "dialogue-polish") state.skillRead = true;
  if (CONTEXT_READ_TOOLS.has(name)) state.contextRead = true;
}
