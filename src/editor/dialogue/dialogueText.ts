// editor/dialogue/dialogueText.ts
// 대사 본문의 제어 코드·보이는 글자·창 맞춤(추정)을 다루는 순수 함수. DOM 을 만지지 않는다(조수 도구 워커도 쓴다).
//
// 제어 코드 문법의 정본은 런타임 `player/dialogue.ts` parseDialogueText 다. 여기서는 «윤문이 지우면 안 되는 토막» 을
// 같은 문법으로 골라낼 뿐이다:
//   \C[n] \V[n] \N[n] \S[n] \T[id]   — 대괄호 인자 코드(대소문자 무관)
//   \$ \! \. \| \> \< \^ \_ \\         — 한 글자 코드
//   [흔들]…[/] [색:노랑] [쉼:0.5] …    — 본문 태그(project/dialogueStyles.ts DIALOGUE_INLINE_TAGS 와 런타임 parseInlineTag 의 이름)
//   {name}                             — 중괄호 자리표시(런타임이 쓰지 않아도 저자가 자리표시로 쓰면 지키게 한다)
// 줄바꿈(\n)은 제어 코드가 아니다 — 다듬으면서 줄을 다시 나눌 수 있다.

import { paginateDialogueSegments, type DialogueTextMeasure } from "@/player/dialoguePagination";

const INLINE_TAG_NAMES = new Set([
  "흔들", "shake", "물결", "wave", "크게", "big", "작게", "small", "색", "color", "쉼", "pause",
  "빠르게", "fast", "느리게", "slow", "표정", "face", "소리", "sound", "화면흔들", "screenshake",
  "넘기기금지", "noskip",
]);

export interface DialogueToken {
  readonly kind: "code" | "tag" | "placeholder";
  readonly raw: string;
  readonly start: number;
  readonly end: number;
}

function inlineTagName(inner: string): string | null {
  const text = inner.trim();
  if (text === "/") return "/";
  const colon = text.search(/[:：]/u);
  const name = (colon >= 0 ? text.slice(0, colon) : text).trim().toLowerCase();
  return INLINE_TAG_NAMES.has(name) ? name : null;
}

/** 본문에서 지켜야 할 토막을 순서대로 돌려준다. */
export function dialogueControlTokens(text: string): DialogueToken[] {
  const tokens: DialogueToken[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\\") {
      const next = text[i + 1];
      if (next === undefined) continue;
      if (/[a-z]/iu.test(next) && text[i + 2] === "[") {
        const end = text.indexOf("]", i + 3);
        if (end > 0) {
          tokens.push({ kind: "code", raw: text.slice(i, end + 1), start: i, end: end + 1 });
          i = end;
          continue;
        }
      }
      if ("$!.|><^_\\".includes(next)) {
        tokens.push({ kind: "code", raw: text.slice(i, i + 2), start: i, end: i + 2 });
        i += 1;
      }
      continue;
    }
    if (char === "[") {
      const end = text.indexOf("]", i + 1);
      if (end > i && end - i <= 40 && inlineTagName(text.slice(i + 1, end)) !== null) {
        tokens.push({ kind: "tag", raw: text.slice(i, end + 1), start: i, end: end + 1 });
        i = end;
      }
      continue;
    }
    if (char === "{") {
      const end = text.indexOf("}", i + 1);
      if (end > i + 1 && end - i <= 40 && /^[\p{L}\p{N}_.:-]+$/u.test(text.slice(i + 1, end))) {
        tokens.push({ kind: "placeholder", raw: text.slice(i, end + 1), start: i, end: end + 1 });
        i = end;
      }
    }
  }
  return tokens;
}

function tokenCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of dialogueControlTokens(text)) {
    // \C[2] 와 \c[2] 는 같은 코드다.
    const key = token.kind === "code" ? token.raw.toLowerCase() : token.raw;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export interface ControlCodeDiff {
  readonly missing: readonly string[];
  readonly added: readonly string[];
}

/** 원문과 새 글의 제어 코드 묶음(개수 포함)이 같은지. 순서는 바뀌어도 된다(문장을 다시 짜면 위치가 옮겨 간다). */
export function compareControlCodes(before: string, after: string): ControlCodeDiff {
  const a = tokenCounts(before);
  const b = tokenCounts(after);
  const missing: string[] = [];
  const added: string[] = [];
  for (const [key, count] of a) for (let i = (b.get(key) ?? 0); i < count; i += 1) missing.push(key);
  for (const [key, count] of b) for (let i = (a.get(key) ?? 0); i < count; i += 1) added.push(key);
  return { missing, added };
}

export interface VisibleTextContext {
  /** \N[n] 을 풀 배우 이름(1부터). 없으면 「주인공」. */
  readonly actorNames?: readonly string[];
}

/** 화면에 실제로 찍히는 글자(제어 코드·태그를 빼고 \N[n] 은 이름, \V[n] 은 네 자리로). 폭 추정용. */
export function visibleDialogueText(text: string, context: VisibleTextContext = {}): string {
  let out = "";
  let cursor = 0;
  for (const token of dialogueControlTokens(text)) {
    out += text.slice(cursor, token.start);
    cursor = token.end;
    if (token.kind === "code") {
      const lower = token.raw.toLowerCase();
      if (lower.startsWith("\\n[")) {
        const index = Number(token.raw.slice(3, -1));
        out += context.actorNames?.[index - 1] ?? "주인공";
      } else if (lower.startsWith("\\v[")) out += "0000";
      else if (lower === "\\_") out += " ";
      else if (lower === "\\\\") out += "\\";
    } else if (token.kind === "placeholder") {
      out += token.raw.slice(1, -1);
    }
  }
  return out + text.slice(cursor);
}

/** 창 한 장의 글자 칸. 편집기 「대사」 탭은 실제 런타임 CSS 로 재고, 도구 워커는 아래 추정 값을 쓴다. */
export interface DialogueWindowMetrics {
  /** 본문 칸 폭(논리 px). */
  readonly bodyWidthPx: number;
  readonly fontSizePx: number;
  /** 한 장에 들어가는 줄 수. */
  readonly maxLines: number;
  /** 측정 출처: dom = 실제 런타임 대화창 CSS, estimate = 해상도·상수 추정. */
  readonly source: "dom" | "estimate";
  /** 글꼴 이름(사람에게 보여 줄 표기). */
  readonly fontLabel: string;
}

export interface DialogueFit {
  readonly lines: number;
  readonly pages: number;
  readonly maxLines: number;
  /** 창 한 장을 넘는가(다음 장으로 넘겨야 한다). */
  readonly overflow: boolean;
  readonly bodyWidthPx: number;
  readonly source: "dom" | "estimate";
}

// 런타임 player/dialogue.ts 의 상수와 같은 값(대화창 아래 위치, 얼굴 칸).
const OVERLAY_HORIZONTAL_PADDING = 20;
const BOX_HORIZONTAL_PADDING = 16;
const BOX_HORIZONTAL_BORDER = 2;
const FACE_COLUMN = 48 + 8;
const VISIBLE_LINES = 3;

/** 해상도로 추정한 창 칸. 기본 대화창(유리, 9px, 줄 높이 1.5, 이름표 있음)을 가정한다. */
export function estimateDialogueWindowMetrics(playWidth: number, options: { readonly face?: boolean; readonly fontSizePx?: number } = {}): DialogueWindowMetrics {
  const width = Math.max(1, playWidth - OVERLAY_HORIZONTAL_PADDING - BOX_HORIZONTAL_PADDING - BOX_HORIZONTAL_BORDER - (options.face ? FACE_COLUMN : 0));
  return { bodyWidthPx: width, fontSizePx: options.fontSizePx ?? 9, maxLines: VISIBLE_LINES, source: "estimate", fontLabel: "기본 대화 글꼴(추정)" };
}

/** 글자 폭 추정: 한글·한자·전각 1em, 라틴 0.56em, 공백 0.3em, 문장부호 0.4em. 비례 글꼴 평균값이다. */
export function estimateTextWidth(text: string, fontSizePx: number): number {
  let em = 0;
  for (const char of Array.from(text)) {
    const code = char.codePointAt(0) ?? 0;
    if (char === " ") em += 0.3;
    else if (code >= 0x1100 && (code <= 0x11ff || (code >= 0x2e80 && code <= 0xa4cf) || (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xf900 && code <= 0xfaff) || (code >= 0xfe30 && code <= 0xfe4f) || (code >= 0xff00 && code <= 0xff60) || (code >= 0x3000 && code <= 0x303f))) em += 1;
    else if (/[.,!?;:'"…·~\-()]/u.test(char)) em += 0.4;
    else em += 0.56;
  }
  return em * fontSizePx;
}

/** 런타임 페이지 나누기(paginateDialogueSegments)를 그대로 돌려 줄 수·장 수를 센다. measure 를 주면 그 폭으로 잰다. */
export function measureDialogueFit(visibleText: string, metrics: DialogueWindowMetrics, measure?: DialogueTextMeasure): DialogueFit {
  const measureFn: DialogueTextMeasure = measure ?? ((text) => estimateTextWidth(text, metrics.fontSizePx));
  const pages = paginateDialogueSegments([{ text: visibleText, colorIndex: 0 }], {
    maxWidth: metrics.bodyWidthPx,
    measure: measureFn,
    maxLines: metrics.maxLines,
  });
  const lines = pages.reduce((sum, page) => sum + page.lines.length, 0);
  return {
    lines,
    pages: pages.length,
    maxLines: metrics.maxLines,
    overflow: pages.length > 1,
    bodyWidthPx: Math.round(metrics.bodyWidthPx),
    source: metrics.source,
  };
}
