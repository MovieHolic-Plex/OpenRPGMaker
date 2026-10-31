// editor/script/scriptLabels.ts — the Korean names a script gives its own code, for the event list's reading.
//
// A script line in the event list must not show code identifiers (`pct`, `ORDER`, `ev_lever1`). The assistant (and a
// person) names them in the script itself, in comments the runtime ignores:
//
//   const pct = discountPercent(rep); // 할인율          ← a trailing comment names the local
//   const BASE = 120, MAX_OFF = 30;   // 기본 가격, 최대 할인   ← one name per declarator, comma separated
//   // @label A: 이미 당김                              ← names a self switch (A-D) or any identifier
//   /** @label 할인율 */ export function discountPercent(…)  ← names a helper (also inside @lib modules)
//   // 가격 계산                                         ← a comment on its own line = step heading
//
// Names nobody wrote fall back to a reading of the identifier (`discountedPrice` → 「할인된 가격」) when every word of
// it is known, else the identifier stays. Pure text scan — no TypeScript parser needed. Wiki: openwiki/script-sandbox.md
// 「목록에서 읽히는 스크립트」.

export interface ScriptLabels {
  /** identifier → name. */
  readonly names: ReadonlyMap<string, string>;
  /** self switch key (A-D) → name. */
  readonly selfSwitches: ReadonlyMap<string, string>;
  /** 1-based line of the statement right under a heading comment → heading text. */
  readonly headings: ReadonlyMap<number, string>;
}

const IDENT = /^[A-Za-z_$][\w$]*$/u;
const MAX_NAME = 24;
const MAX_HEADING = 60;

/** Index of a `//` that starts a comment (outside string/template literals), or -1. */
function commentStart(line: string): number {
  let quote = "";
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "/" && line[i + 1] === "/") return i;
  }
  return -1;
}

function cleanName(text: string): string | undefined {
  const name = text.trim().replace(/[.。]$/u, "").trim();
  if (!name || name.length > MAX_NAME) return undefined;
  return name;
}

/** Top-level comma split (ignores commas inside brackets/strings). */
function splitTop(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) depth -= 1;
    else if (char === "," && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out;
}

const LABEL_TAG = /@label\s+([A-Za-z_$][\w$]*)\s*[:=]\s*(.+?)\s*(?:\*\/)?$/u;
const LABEL_JSDOC = /\/\*\*?\s*@label\s+(.+?)\s*\*\//u;
const FUNCTION_DECL = /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/u;
const VAR_DECL = /^\s*(?:export\s+)?(?:const|let|var)\s+(.+?);?\s*$/u;

/** Names, self switch names and step headings written in a script's comments. */
export function readScriptLabels(source: string): ScriptLabels {
  const names = new Map<string, string>();
  const selfSwitches = new Map<string, string>();
  const headings = new Map<number, string>();
  const lines = source.split(/\r?\n/u);
  let pendingHeading: string | undefined;
  let pendingFunctionLabel: string | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]!;
    const at = commentStart(raw);
    const code = (at >= 0 ? raw.slice(0, at) : raw).trim();
    const comment = at >= 0 ? raw.slice(at + 2).trim() : "";
    const blockComment = /^\s*\/\*/u.test(raw);
    const jsdoc = LABEL_JSDOC.exec(raw);
    if (blockComment && jsdoc) {
      pendingFunctionLabel = cleanName(jsdoc[1]!);
      continue;
    }
    if (blockComment) {
      // multi-line JSDoc: look for @label inside it
      let end = index;
      let block = raw;
      while (!/\*\//u.test(lines[end]!) && end + 1 < lines.length) {
        end += 1;
        block += `\n${lines[end]}`;
      }
      const tag = /@label\s+([^\n*]+)/u.exec(block);
      if (tag) pendingFunctionLabel = cleanName(tag[1]!);
      index = end;
      continue;
    }
    if (!code) {
      if (!comment) {
        // blank line ends a heading only if nothing followed it yet — keep it (headings often have a blank under them)
        continue;
      }
      const tag = LABEL_TAG.exec(comment);
      if (tag) {
        const name = cleanName(tag[2]!);
        if (name) {
          if (/^[A-D]$/u.test(tag[1]!)) selfSwitches.set(tag[1]!, name);
          else names.set(tag[1]!, name);
        }
        continue;
      }
      if (/^(?:eslint|@ts-|prettier|#region|#endregion|TODO\b|FIXME\b)/iu.test(comment)) continue;
      const text = comment.replace(/^[-=─—\s]+|[-=─—\s]+$/gu, "").trim();
      if (text && text.length <= MAX_HEADING) pendingHeading = text;
      continue;
    }
    // a code line
    if (pendingHeading) {
      // closing braces alone (`}` / `} else {`) are not statements — keep the heading for the next one
      if (!/^[}\])]+[;,]?$/u.test(code)) {
        headings.set(index + 1, pendingHeading);
        pendingHeading = undefined;
      }
    }
    const fn = FUNCTION_DECL.exec(code);
    if (fn && pendingFunctionLabel) names.set(fn[1]!, pendingFunctionLabel);
    pendingFunctionLabel = undefined;
    if (!comment) continue;
    const tag = LABEL_TAG.exec(comment);
    if (tag) {
      const name = cleanName(tag[2]!);
      if (name) (/^[A-D]$/u.test(tag[1]!) ? selfSwitches : names).set(tag[1]!, name);
      continue;
    }
    const decl = VAR_DECL.exec(code);
    if (!decl) continue;
    const declarators = splitTop(decl[1]!).map((part) => part.split("=")[0]!.replace(/:.*$/u, "").trim()).filter((part) => IDENT.test(part));
    if (!declarators.length) continue;
    const parts = declarators.length === 1 ? [comment] : comment.split(/[,，、;]/u);
    if (parts.length !== declarators.length) continue;
    declarators.forEach((name, i) => {
      const label = cleanName(parts[i]!);
      if (label) names.set(name, label);
    });
  }
  return { names, selfSwitches, headings };
}

// ── fallback reading of an identifier ───────────────────────────────────────

/** English word → Korean (only words an RPG script commonly uses; unknown words keep the identifier). */
const WORDS: Readonly<Record<string, string>> = {
  price: "가격", prices: "가격들", cost: "비용", count: "개수", counts: "개수", total: "총액", sum: "합계", amount: "양",
  pct: "비율", percent: "비율", percentage: "비율", rate: "비율", ratio: "비율", discount: "할인", discounted: "할인된",
  rep: "평판", reputation: "평판", order: "순서", sequence: "순서", levers: "레버 목록", lever: "레버", step: "단계",
  steps: "단계", stage: "단계", progress: "진행", pick: "고른 것", picked: "고른 것", choice: "선택", answer: "정답",
  input: "입력", code: "암호", password: "암호", hint: "힌트", after: "이후", base: "기본", max: "최대", min: "최소",
  gold: "돈", money: "돈", item: "아이템", items: "아이템들", num: "번호", number: "번호", index: "순번", idx: "순번",
  fail: "실패", fails: "실패 횟수", failed: "실패", tries: "시도 횟수", attempts: "시도 횟수", time: "시간", hour: "시",
  minute: "분", day: "날", close: "닫는", open: "여는", me: "이 이벤트", player: "주인공", id: "항목", ids: "항목들",
  list: "목록", bonus: "보너스", damage: "피해", hp: "체력", mp: "마력", level: "레벨", exp: "경험치", score: "점수",
  round: "판", turn: "차례", next: "다음", prev: "이전", current: "지금", cur: "지금", new: "새", flag: "표시",
  done: "완료", ok: "맞음", correct: "정답", wrong: "틀림", key: "열쇠", door: "문", gate: "문", chest: "상자",
  potion: "포션", potions: "포션", herb: "약초", herbs: "약초", coin: "동전", coins: "동전", gem: "보석", gems: "보석",
  bell: "종", bells: "종 목록", statue: "석상", statues: "석상 목록", plate: "발판", plates: "발판 목록",
  need: "필요", needed: "필요", left: "남은", remaining: "남은", have: "가진", has: "가진", seen: "본 것", found: "찾은 것",
  clue: "단서", clues: "단서", reward: "보상", fee: "요금", tax: "세금", qty: "수량", quantity: "수량", buy: "살",
  sell: "팔", unit: "한 개", each: "각", per: "당", off: "할인", limit: "한도", cap: "한도", chance: "확률", roll: "주사위",
  dice: "주사위", random: "무작위", value: "값", result: "결과", target: "목표", goal: "목표", wait: "기다림",
  delay: "지연", timer: "타이머", seconds: "초", frames: "프레임", phase: "시간대", night: "밤", morning: "아침",
  curfew: "통금", pass: "통행증", guard: "경비병", npc: "인물", event: "이벤트", events: "이벤트들", name: "이름",
  text: "글", message: "메시지", msg: "메시지", party: "파티", member: "동료", members: "동료들", actor: "인물",
  enemy: "적", enemies: "적들", boss: "보스", heal: "회복", cure: "치료", power: "세기", strength: "힘", answer2: "정답",
};

function splitWords(identifier: string): string[] {
  return identifier
    .replace(/^ev_/u, "")
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replace(/([A-Za-z])(\d)/gu, "$1 $2")
    .replace(/(\d)([A-Za-z])/gu, "$1 $2")
    .split(/[\s_$-]+/u)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/** 「할인된 가격」 for `discountedPrice`, 「레버 1」 for `ev_lever1`; undefined when a word is unknown. */
export function readIdentifier(identifier: string): string | undefined {
  const words = splitWords(identifier);
  if (!words.length) return undefined;
  const out: string[] = [];
  for (const word of words) {
    if (/^\d+$/u.test(word)) {
      out.push(word);
      continue;
    }
    const korean = WORDS[word];
    if (!korean) return undefined;
    out.push(korean);
  }
  return out.join(" ").replace(/\s+비율$/u, " 비율").replace(/할인 비율/u, "할인율");
}

// ── Korean particles ────────────────────────────────────────────────────────

const DIGIT_BATCHIM = [true, true, false, true, false, false, true, true, true, false]; // 영 일 이 삼 사 오 육 칠 팔 구

/** True when the last readable syllable of `word` ends in a consonant (받침). Unknown → true. */
export function hasBatchim(word: string): boolean {
  const text = word.replace(/[\s」』)\]»'"%]+$/u, "");
  const last = text[text.length - 1];
  if (!last) return true;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/\d/u.test(last)) return DIGIT_BATCHIM[Number(last)] ?? true;
  if (/[A-Za-z]/u.test(last)) return /[lmnr]$/iu.test(last);
  return true;
}

/** Attach a particle: josa("돈", "이", "가") → "돈이"; josa("가격", "이", "가") → "가격이". */
export function josa(word: string, withBatchim: string, without: string): string {
  return `${word}${hasBatchim(word) ? withBatchim : without}`;
}
