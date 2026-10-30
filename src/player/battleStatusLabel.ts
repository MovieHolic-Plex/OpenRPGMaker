/**
 * 상태 배지에 찍을 짧은 글자. 저작자가 쓴 상태 이름이 곧 그 게임의 언어이므로 그것을 쓴다.
 * - 4글자 이하면 그대로(「마비」「독」「Burn」).
 * - 한글·한자·가나가 든 긴 이름은 첫 낱말을 3글자까지(「마비 상태」→「마비」).
 * - 긴 라틴 이름(「Paralysis」)은 null — CSS 약어(PAR)가 영어 게임의 관례다.
 * 능력 증감(화살표가 뜻)과 전투불능은 호출부가 거른다.
 */
export function stateBadgeLabel(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const graphemes = Array.from(trimmed);
  if (graphemes.length <= 4) return trimmed;
  if (!/[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(trimmed)) return null;
  const firstWord = trimmed.split(/[\s()（）[\]【】·・,，/]+/u).find((word) => word.length > 0) ?? trimmed;
  return Array.from(firstWord).slice(0, 3).join("");
}
