export type DialogueTextControl =
  | { readonly kind: "speed"; readonly value: number }
  | { readonly kind: "gold" }
  | { readonly kind: "pause" }
  | { readonly kind: "wait"; readonly ms: number }
  | { readonly kind: "fastOn" }
  | { readonly kind: "fastOff" }
  | { readonly kind: "halfSpace" }
  | { readonly kind: "autoClose" };

export type DialogueTextSegment = {
  readonly text: string;
  readonly colorIndex: number;
  readonly controlsBefore?: readonly DialogueTextControl[];
};

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
    while (currentLine.length > 0 && measure(styledCharsText(currentLine)) > maxWidth) {
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
    if (measure(styledCharsText(withoutTrailingBreak)) <= maxWidth) {
      return { line: withoutTrailingBreak, remainder: [] };
    }
  }

  const wordSplit = findWordBoundarySplit(line, measure, maxWidth);
  if (wordSplit) return wordSplit;

  for (let end = line.length - 1; end > 0; end -= 1) {
    const candidate = line.slice(0, end);
    if (measure(styledCharsText(candidate)) <= maxWidth) {
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
    if (measure(styledCharsText(head)) <= maxWidth) return { line: head, remainder: tail };
  }
  return null;
}

function styledCharsToSegments(chars: readonly StyledChar[]): DialogueTextSegment[] {
  const segments: DialogueTextSegment[] = [];
  for (const char of chars) {
    const last = segments[segments.length - 1];
    if (last && last.colorIndex === char.colorIndex && !char.controlsBefore?.length) {
      segments[segments.length - 1] = { ...last, text: `${last.text}${char.char}` };
      continue;
    }
    segments.push({
      text: char.char,
      colorIndex: char.colorIndex,
      ...(char.controlsBefore?.length ? { controlsBefore: [...char.controlsBefore] } : {}),
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
  if (last && last.colorIndex === next.colorIndex && next.text && !next.controlsBefore?.length) {
    segments[segments.length - 1] = { ...last, text: `${last.text}${next.text}` };
    return;
  }
  segments.push(next);
}

function styledCharsText(chars: readonly StyledChar[]): string {
  return chars.map((char) => char.char).join("");
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
