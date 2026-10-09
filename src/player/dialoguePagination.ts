export type DialogueTextControl =
  | { readonly kind: "speed"; readonly value: number }
  | { readonly kind: "gold" }
  | { readonly kind: "pause" }
  | { readonly kind: "wait"; readonly ms: number }
  | { readonly kind: "fastOn" }
  | { readonly kind: "fastOff" }
  | { readonly kind: "halfSpace" }
  | { readonly kind: "autoClose" }
  // ── 본문 태그(project/dialogueStyles.ts DIALOGUE_INLINE_TAGS) ──
  /** 기본 글자 간격 배율. [빠르게]=0.5, [느리게]=2, 닫으면 앞 배율로 되돌린다. */
  | { readonly kind: "rate"; readonly factor: number }
  /** [표정:…] — 얼굴 칸·목소리 높이·이모트를 이 자리부터 바꾼다. */
  | { readonly kind: "expression"; readonly emotion: string }
  /** [소리:id] — 이 자리에서 효과음 한 번. */
  | { readonly kind: "sound"; readonly soundId: string }
  /** [화면흔들] — 이 자리에서 화면을 한 번 흔든다. */
  | { readonly kind: "screenShake" }
  /** [넘기기금지]…[/] — 켜진 동안은 키를 눌러도 남은 글자를 한 번에 채우지 않는다. */
  | { readonly kind: "lock"; readonly on: boolean };

/** 글자 모양 효과. 페이지 나누기는 크기(big/small)만 폭 계산에 쓴다. */
export type DialogueTextFx = {
  readonly shake?: true;
  readonly wave?: true;
  readonly size?: "big" | "small";
  /** CSS 색(rgb()/#hex). \C[n] 색보다 이긴다. */
  readonly color?: string;
};

export type DialogueTextSegment = {
  readonly text: string;
  readonly colorIndex: number;
  readonly controlsBefore?: readonly DialogueTextControl[];
  readonly fx?: DialogueTextFx;
};

/** 같은 효과인지 비교하는 열쇠. 세그먼트를 합칠지 정할 때 쓴다. */
export function dialogueFxKey(fx: DialogueTextFx | undefined): string {
  if (!fx) return "";
  return `${fx.shake ? "s" : ""}${fx.wave ? "w" : ""}${fx.size ?? ""}|${fx.color ?? ""}`;
}

/** 폭 계산용 크기 배율. dialogueStyles.css 의 .dialogue-fx-big / -small 과 같은 값이다. */
export function dialogueFxScale(fx: DialogueTextFx | undefined): number {
  return fx?.size === "big" ? 1.3 : fx?.size === "small" ? 0.8 : 1;
}

export type DialogueTextMeasure = (text: string) => number;

export type DialoguePageLine = {
  readonly segments: readonly DialogueTextSegment[];
  readonly trailingControls?: readonly DialogueTextControl[];
};

export type DialoguePage = {
  readonly lines: readonly DialoguePageLine[];
  readonly segments: readonly DialogueTextSegment[];
};

export type DialoguePaginationOptions = {
  readonly maxWidth: number;
  readonly measure: DialogueTextMeasure;
  readonly maxLines?: number;
  readonly fallbackCharWidth?: number;
};

export const DIALOGUE_LINES_PER_PAGE = 4;
export const DIALOGUE_FALLBACK_CHAR_WIDTH = 7;

type StyledChar = {
  readonly char: string;
  readonly colorIndex: number;
  readonly controlsBefore?: readonly DialogueTextControl[];
  readonly fx?: DialogueTextFx;
};

export function paginateDialogueSegments(
  segments: readonly DialogueTextSegment[],
  options: DialoguePaginationOptions
): DialoguePage[] {
  const maxLines = Math.max(1, Math.trunc(options.maxLines ?? DIALOGUE_LINES_PER_PAGE));
  const maxWidth = Math.max(1, options.maxWidth);
  const fallbackCharWidth = Math.max(1, options.fallbackCharWidth ?? DIALOGUE_FALLBACK_CHAR_WIDTH);
  const measure = (text: string): number => safeMeasure(text, options.measure, fallbackCharWidth);
  const pages: DialoguePageLine[][] = [[]];
  let currentLine: StyledChar[] = [];
  let pendingControls: DialogueTextControl[] = [];
  let sawInput = false;
  let endedWithExplicitNewline = false;

  const activePage = (): DialoguePageLine[] => pages[pages.length - 1] ?? [];
  const addLine = (
    lineChars: readonly StyledChar[],
    trailingControls: readonly DialogueTextControl[] = []
  ): void => {
    if (activePage().length >= maxLines) pages.push([]);
    activePage().push({
      segments: styledCharsToSegments(lineChars),
      ...(trailingControls.length > 0 ? { trailingControls: [...trailingControls] } : {}),
    });
  };
  const wrapCurrentLine = (): void => {
    while (currentLine.length > 0 && measureStyled(currentLine, measure) > maxWidth) {
      const split = splitOverflowLine(currentLine, measure, maxWidth);
      addLine(split.line);
      currentLine = trimLeadingSoftBreaks(split.remainder);
    }
  };

  for (const segment of segments) {
    if (segment.controlsBefore?.length) pendingControls.push(...segment.controlsBefore);
    for (const char of Array.from(segment.text.replace(/\r\n?/gu, "\n"))) {
      sawInput = true;
      if (char === "\n") {
        addLine(currentLine, pendingControls);
        currentLine = [];
        pendingControls = [];
        endedWithExplicitNewline = true;
        continue;
      }
      endedWithExplicitNewline = false;
      currentLine.push({
        char,
        colorIndex: segment.colorIndex,
        ...(pendingControls.length > 0 ? { controlsBefore: [...pendingControls] } : {}),
        ...(segment.fx ? { fx: segment.fx } : {}),
      });
      pendingControls = [];
      wrapCurrentLine();
    }
  }
  if (currentLine.length > 0 || !sawInput || endedWithExplicitNewline) {
    addLine(currentLine, pendingControls);
  } else if (pendingControls.length > 0) {
    const page = activePage();
    const lastIndex = page.length - 1;
    const lastLine = page[lastIndex];
    if (lastLine) {
      page[lastIndex] = {
        ...lastLine,
        trailingControls: [...(lastLine.trailingControls ?? []), ...pendingControls],
      };
    } else {
      addLine([], pendingControls);
    }
  }

  return pages.map((pageLines) => ({
    lines: pageLines,
    segments: flattenPageLines(pageLines),
  }));
}

export function fallbackMeasureDialogueText(text: string, charWidth = DIALOGUE_FALLBACK_CHAR_WIDTH): number {
  return Array.from(text).length * Math.max(1, charWidth);
}

function splitOverflowLine(
  line: readonly StyledChar[],
  measure: DialogueTextMeasure,
  maxWidth: number
): { readonly line: readonly StyledChar[]; readonly remainder: StyledChar[] } {
  const withoutTrailingBreak = trimTrailingSoftBreaks(line);
  if (withoutTrailingBreak.length > 0 && withoutTrailingBreak.length < line.length) {
    if (measureStyled(withoutTrailingBreak, measure) <= maxWidth) {
      return { line: withoutTrailingBreak, remainder: [] };
    }
  }

  const wordSplit = findWordBoundarySplit(line, measure, maxWidth);
  if (wordSplit) return wordSplit;

  for (let end = line.length - 1; end > 0; end -= 1) {
    const candidate = line.slice(0, end);
    if (measureStyled(candidate, measure) <= maxWidth) {
      return { line: candidate, remainder: line.slice(end) };
    }
  }

  return { line: line.slice(0, 1), remainder: line.slice(1) };
}

function findWordBoundarySplit(
  line: readonly StyledChar[],
  measure: DialogueTextMeasure,
  maxWidth: number
): { readonly line: readonly StyledChar[]; readonly remainder: StyledChar[] } | null {
  for (let index = line.length - 2; index > 0; index -= 1) {
    if (!isSoftBreakChar(line[index]?.char ?? "")) continue;
    const head = trimTrailingSoftBreaks(line.slice(0, index));
    const tail = trimLeadingSoftBreaks(line.slice(index + 1));
    if (head.length === 0 || tail.length === 0) continue;
    if (measureStyled(head, measure) <= maxWidth) return { line: head, remainder: tail };
  }
  return null;
}

function styledCharsToSegments(chars: readonly StyledChar[]): DialogueTextSegment[] {
  const segments: DialogueTextSegment[] = [];
  for (const char of chars) {
    const last = segments[segments.length - 1];
    if (last && last.colorIndex === char.colorIndex && dialogueFxKey(last.fx) === dialogueFxKey(char.fx) && !char.controlsBefore?.length) {
      segments[segments.length - 1] = { ...last, text: `${last.text}${char.char}` };
      continue;
    }
    segments.push({
      text: char.char,
      colorIndex: char.colorIndex,
      ...(char.controlsBefore?.length ? { controlsBefore: [...char.controlsBefore] } : {}),
      ...(char.fx ? { fx: char.fx } : {}),
    });
  }
  return segments;
}

function flattenPageLines(lines: readonly DialoguePageLine[]): DialogueTextSegment[] {
  const segments: DialogueTextSegment[] = [];
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) appendSegment(segments, { text: "\n", colorIndex: 0 });
    for (const segment of line.segments) appendSegment(segments, segment);
    if (line.trailingControls?.length) {
      appendSegment(segments, {
        text: "",
        colorIndex: line.segments[line.segments.length - 1]?.colorIndex ?? 0,
        controlsBefore: line.trailingControls,
      });
    }
  });
  return segments;
}

function appendSegment(segments: DialogueTextSegment[], next: DialogueTextSegment): void {
  if (!next.text && !next.controlsBefore?.length) return;
  const last = segments[segments.length - 1];
  if (last && last.colorIndex === next.colorIndex && dialogueFxKey(last.fx) === dialogueFxKey(next.fx) && next.text && !next.controlsBefore?.length) {
    segments[segments.length - 1] = { ...last, text: `${last.text}${next.text}` };
    return;
  }
  segments.push(next);
}

/** 크기 효과가 섞인 줄의 폭. 같은 배율끼리 묶어 재고 배율을 곱한다(자간은 근사). */
function measureStyled(chars: readonly StyledChar[], measure: DialogueTextMeasure): number {
  let total = 0;
  let runText = "";
  let runScale = 1;
  for (const char of chars) {
    const scale = dialogueFxScale(char.fx);
    if (scale !== runScale && runText) {
      total += measure(runText) * runScale;
      runText = "";
    }
    runScale = scale;
    runText += char.char;
  }
  if (runText) total += measure(runText) * runScale;
  return total;
}

function trimLeadingSoftBreaks(chars: readonly StyledChar[]): StyledChar[] {
  let start = 0;
  while (start < chars.length && isSoftBreakChar(chars[start]?.char ?? "")) start += 1;
  if (start === 0) return chars.slice();
  const removedControls = chars.slice(0, start).flatMap((char) => char.controlsBefore ?? []);
  const remaining = chars.slice(start);
  if (removedControls.length === 0) return remaining;
  const first = remaining[0];
  if (!first) {
    return [{
      char: "",
      colorIndex: chars[start - 1]?.colorIndex ?? 0,
      controlsBefore: removedControls,
    }];
  }
  remaining[0] = {
    ...first,
    controlsBefore: [...removedControls, ...(first.controlsBefore ?? [])],
  };
  return remaining;
}

function trimTrailingSoftBreaks(chars: readonly StyledChar[]): StyledChar[] {
  let end = chars.length;
  while (
    end > 0
    && isSoftBreakChar(chars[end - 1]?.char ?? "")
    && !chars[end - 1]?.controlsBefore?.length
  ) {
    end -= 1;
  }
  return chars.slice(0, end);
}

function isSoftBreakChar(char: string): boolean {
  return char === " " || char === "\t" || char === "\u3000";
}

function safeMeasure(text: string, measure: DialogueTextMeasure, fallbackCharWidth: number): number {
  try {
    const measured = measure(text);
    if (Number.isFinite(measured) && measured >= 0) return measured;
  } catch {
    // Measuring is injected so tests and non-layout runtimes can remain pure.
  }
  return fallbackMeasureDialogueText(text, fallbackCharWidth);
}
