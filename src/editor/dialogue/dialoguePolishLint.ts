// editor/dialogue/dialoguePolishLint.ts
// 대사 여러 줄을 윤문 린터(general-good-writing polish-lint, fiction 프로필, 판정 모델 없이 로컬 규칙)에 돌려 줄마다 적중을 돌려준다.
// 조수 도구 lint_dialogue 와 같은 린터·같은 줄 매기기(대사 하나 = 한 줄, 대사 안 \n 은 공백)다. 실행기의 「완성 뒤 윤문 고리」
// (src/ai/piAgent/dialoguePolishHook.ts)가 모델 없이 전/후 적중 수를 셀 때 쓴다.
// 린터는 동적 import 로만 받는다 — 편집기 첫 번들·내보낸 플레이어 번들에 들어가지 않는다(openwiki/licensing.md 「코드 경계」).

export interface DialoguePolishHit {
  /** 린터 계열 id(translationese·model-tic …). */
  readonly family: string;
  /** 사람이 읽는 계열 이름(번역투·모델틱 …). */
  readonly label: string;
  readonly pid: string;
  readonly severity: string;
  readonly match: string;
  readonly hint: string;
}

type LintModule = typeof import("@/vendor/general-good-writing/local");
let lintModule: LintModule | null = null;

/** 대화창의 줄바꿈은 같은 대사 안의 줄이다 — 한 대사를 한 줄 글로 편다(lint_dialogue 와 같은 방식). */
export function flattenDialogueText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/\s*\n\s*/g, " ").trim();
}

/** texts 와 같은 길이의 배열 — 줄마다 그 줄 문장에 걸린 적중. 린터를 못 불러오면 던진다. */
export async function lintDialogueTexts(texts: readonly string[], options: { readonly lang?: "ko" | "en" } = {}): Promise<DialoguePolishHit[][]> {
  const perLine = texts.map(() => [] as DialoguePolishHit[]);
  const flats = texts.map((text) => flattenDialogueText(text).normalize("NFC"));
  if (!flats.some(Boolean)) return perLine;
  lintModule ??= await import("@/vendor/general-good-writing/local");
  const result = await lintModule.lintLocal(flats.join("\n"), { ...(options.lang ? { lang: options.lang } : {}), profile: "fiction" });
  const seen = new Set<string>();
  for (const hit of result.report.hits) {
    const sentence = hit.sentence.trim();
    if (!sentence) continue;
    flats.forEach((text, index) => {
      if (!text.includes(sentence)) return;
      const key = `${index}\u0000${hit.pid}\u0000${hit.match}`;
      if (seen.has(key)) return;
      seen.add(key);
      perLine[index]!.push({ family: hit.family, label: hit.family_label, pid: hit.pid, severity: hit.severity, match: hit.match, hint: hit.hint });
    });
  }
  return perLine;
}
