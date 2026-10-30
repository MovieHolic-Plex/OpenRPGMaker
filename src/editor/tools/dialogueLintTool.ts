// editor/tools/dialogueLintTool.ts
// lint_dialogue — 게임 글(대사·자막·선택지·설명)에 general-good-writing 의 polish-lint 를 돌려 문장 단위 적중을 돌려준다.
// 린터 원본: code-yeongyu/general-good-writing(코드 연규) — 출처·수정 내역은 src/vendor/general-good-writing/README.md.
// 지침: 조수 스킬 dialogue-polish(assistant-skills/dialogue-polish/SKILL.md).
//
// 린터는 prepare 에서 동적 import 로만 받는다 — 편집기 첫 번들에도, 내보낸 플레이어 번들에도 들어가지 않는다
// (openwiki/licensing.md 「코드 경계」). 판정 모델(Jev)은 끄고 로컬 규칙만 쓴다: 키·네트워크 없음.
// 린터는 비동기라 prepare 가 입력 글을 미리 검사해 두고, 동기 run 은 같은 글의 결과를 꺼내 쓴다.

import { collectDialogueLines, type DialogueLine } from "@/editor/dialogue/dialogueIndex";
import { normalizeSpeakerName } from "@/project/dialogueDesk";
import type { Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type LintModule = typeof import("@/vendor/general-good-writing/local");
type LocalLintResult = Awaited<ReturnType<LintModule["lintLocal"]>>;

const TEXTS_MAX = 200;
const LINES_MAX = 400;
const CACHE_MAX = 8;

interface LintItem {
  readonly text: string;
  readonly id?: string;
  readonly hash?: string;
  readonly speaker?: string;
  readonly where?: string;
}

let lintModule: LintModule | null = null;
let loadError = "";
const results = new Map<string, LocalLintResult>();

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** 대화창의 줄바꿈은 같은 대사 안의 줄이다 — 한 대사를 한 줄 글로 편다(작가 지시와 같은 방식). */
function flat(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/\s*\n\s*/g, " ").trim();
}

function collectItems(project: Project | undefined, args: Record<string, unknown>): LintItem[] {
  const texts = strList(args.texts);
  if (texts.length) return texts.slice(0, TEXTS_MAX).map((text) => ({ text }));
  if (!project) return [];
  const ids = new Set(strList(args.lineIds));
  const mapId = str(args.mapId).trim();
  const eventId = str(args.eventId).trim();
  const speaker = normalizeSpeakerName(str(args.speaker));
  const lines = collectDialogueLines(project, { includeDescriptions: true }).filter((line: DialogueLine) =>
    (!ids.size || ids.has(line.id))
    && (!mapId || line.mapId === mapId)
    && (!eventId || line.eventId === eventId || line.commonEventId === eventId || line.troopId === eventId)
    && (!speaker || line.speaker === speaker));
  return lines.slice(0, LINES_MAX).map((line) => ({
    text: line.text,
    id: line.id,
    hash: line.hash,
    ...(line.speaker ? { speaker: line.speaker } : {}),
    where: line.groupLabel,
  }));
}

function lintKey(items: readonly LintItem[], lang: string): string {
  return `${lang}\u0000${items.map((item) => flat(item.text)).join("\n")}`;
}

function documentOf(items: readonly LintItem[]): string {
  return items.map((item) => flat(item.text)).join("\n");
}

function langOf(args: Record<string, unknown>): "ko" | "en" | undefined {
  const lang = str(args.lang);
  return lang === "ko" || lang === "en" ? lang : undefined;
}

async function prepareLint(args: Record<string, unknown>, project?: Project): Promise<void> {
  try {
    lintModule ??= await import("@/vendor/general-good-writing/local");
    loadError = "";
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
    throw error;
  }
  const items = collectItems(project, args);
  if (!items.length) return;
  const lang = langOf(args);
  const key = lintKey(items, lang ?? "auto");
  if (results.has(key)) return;
  const result = await lintModule.lintLocal(documentOf(items), { ...(lang ? { lang } : {}), profile: "fiction" });
  results.set(key, result);
  while (results.size > CACHE_MAX) results.delete(results.keys().next().value as string);
}

const lintDialogue: ToolDefinition = {
  name: "lint_dialogue",
  description:
    "게임 글(대사·자막·선택지·아이템 설명·퀘스트·엔딩 글)에 윤문 린터(general-good-writing polish-lint, fiction 프로필, 판정 모델 없이 로컬 규칙)를 돌려 " +
    "문장 단위 적중(번역투·모델틱·부정재정의 「A가 아니라 B」·은유명사·기호 em dash/가운뎃점·한줄요약 등)을 줄마다 돌려준다. " +
    "대사를 쓰거나 고친 뒤 부른다 — 먼저 read_assistant_skill({id:'dialogue-polish'}) 로 적용 지침을 읽는다. " +
    "texts 로 새로 쓴 글을 직접 넣거나, lineIds(list_dialogue 의 id)·mapId·eventId·speaker 로 게임 안 줄을 고른다. " +
    "아무것도 바꾸지 않는다. 고칠 때는 rewrite_dialogue 에 id·hash 를 넘긴다. 리듬·문단 지표는 산문용이라 돌려주지 않는다.",
  mode: "read",
  domains: ["event", "database"],
  parameters: {
    type: "object",
    properties: {
      texts: { type: "array", items: { type: "string" }, maxItems: TEXTS_MAX, description: "검사할 글(한 항목 = 대사 하나). 주면 게임 안 줄은 보지 않는다." },
      lineIds: { type: "array", items: { type: "string" }, maxItems: LINES_MAX, description: "list_dialogue 가 준 줄 id." },
      mapId: { type: "string", description: "이 맵의 이벤트 글만." },
      eventId: { type: "string", description: "이 이벤트(맵 이벤트·공용 이벤트·적 그룹) id 의 글만." },
      speaker: { type: "string", description: "이 화자의 대사만." },
      lang: { type: "string", enum: ["ko", "en"], description: "글 언어. 생략하면 린터가 정한다." },
    },
    additionalProperties: false,
  },
  invalidArgsExample: { texts: ["마왕은 그것이 아니라 품격이라고 생각했다 — 결국."] },
  prepare: prepareLint,
  run(project, args): ToolExecResult {
    const items = collectItems(project, args);
    if (!items.length) {
      throw new ToolError("검사할 글이 없다 — texts 를 넣거나 lineIds·mapId·eventId·speaker 로 게임 안 줄을 고른다(list_dialogue 로 먼저 찾는다).", { code: "invalid-args" });
    }
    const result = results.get(lintKey(items, langOf(args) ?? "auto"));
    if (!result) {
      throw new ToolError(`윤문 린터를 불러오지 못했다${loadError ? ` (${loadError})` : ""}. 비동기 실행 경로(runToolAsync/prepareTool)로 부른다.`, { code: "lint-not-prepared" });
    }
    const flats = items.map((item) => flat(item.text).normalize("NFC"));
    const perLine = items.map(() => [] as { family: string; severity: string; match: string; hint: string }[]);
    const seen = new Set<string>();
    for (const hit of result.report.hits) {
      flats.forEach((text, index) => {
        if (!text.includes(hit.sentence.trim())) return;
        const key = `${index}\u0000${hit.pid}\u0000${hit.match}`;
        if (seen.has(key)) return;
        seen.add(key);
        perLine[index]!.push({ family: hit.family_label, severity: hit.severity, match: hit.match, hint: hit.hint });
      });
    }
    const families: Record<string, number> = {};
    for (const hits of perLine) for (const hit of hits) families[hit.family] = (families[hit.family] ?? 0) + 1;
    const rows = items.flatMap((item, index) => {
      const hits = perLine[index]!;
      if (!hits.length) return [];
      return [{ ...(item.id ? { id: item.id, hash: item.hash } : { index }), ...(item.speaker ? { speaker: item.speaker } : {}), ...(item.where ? { where: item.where } : {}), text: item.text, hits }];
    });
    const total = rows.reduce((sum, row) => sum + row.hits.length, 0);
    return {
      summary: `윤문 린트 ${items.length}줄 — 적중 ${total}건 ${rows.length}줄${total ? ` (${Object.entries(families).map(([name, count]) => `${name} ${count}`).join(", ")})` : ""}`,
      data: {
        checked: items.length,
        flaggedLines: rows.length,
        families,
        rows,
        note: "인물 말투가 그 어미·말버릇을 요구하면 남겨도 된다(남긴 이유를 보고에 적는다). 검색 키 문자열·자리표시자·제어 문자는 바꾸지 않는다. 대화창 줄 수(\\n 개수)는 유지한다.",
        credit: "general-good-writing — 코드 연규(code-yeongyu)",
      },
    };
  },
};

export const DIALOGUE_LINT_TOOLS: readonly ToolDefinition[] = [lintDialogue];
