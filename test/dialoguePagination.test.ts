import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { parseDialogueText } from "@/player/dialogue";
import { paginateDialogueSegments, type DialoguePage } from "@/player/dialoguePagination";

const measureChars = (text: string): number => Array.from(text).length;

function plainPageText(page: DialoguePage): string {
  return page.segments.map((segment) => segment.text).join("");
}

function plainLineTexts(page: DialoguePage): string[] {
  return page.lines.map((line) => line.segments.map((segment) => segment.text).join(""));
}

describe("dialogue pagination", () => {
  it("respects literal newlines without confusing actor-name text codes", () => {
    const project = createBlankProject();
    project.database.actors = [{ ...project.database.actors[0]!, id: "hero", name: "Hero" }];
    const segments = parseDialogueText("첫 줄\n둘째 줄 \\n[1]", {
      session: { variables: {}, actorNames: { hero: "Renamed" } },
      project,
    });

    const pages = paginateDialogueSegments(segments, { maxWidth: 100, measure: measureChars });

    expect(pages).toHaveLength(1);
    expect(plainLineTexts(pages[0]!)).toEqual(["첫 줄", "둘째 줄 Renamed"]);
    expect(plainPageText(pages[0]!)).toBe("첫 줄\n둘째 줄 Renamed");
  });

  it("preserves non-printing controls as zero-width playback events", () => {
    const source = String.raw`A\s[3]\c[2]B\$\!\.\|\>\<\^\_C`;
    const segments = parseDialogueText(source);
    const pages = paginateDialogueSegments(segments, { maxWidth: 2, maxLines: 1, measure: measureChars });
    const pageSegments = pages.flatMap((page) => page.segments);

    expect(segments.map((segment) => segment.text).join("")).toBe("AB C");
    expect(segments.map((segment) => segment.text).join("")).not.toContain("\\");
    expect(pageSegments.flatMap((segment) => segment.controlsBefore ?? [])).toEqual([
      { kind: "speed", value: 3 },
      { kind: "gold" },
      { kind: "pause" },
      { kind: "wait", ms: 250 },
      { kind: "wait", ms: 1000 },
      { kind: "fastOn" },
      { kind: "fastOff" },
      { kind: "autoClose" },
      { kind: "halfSpace" },
    ]);
    expect(plainPageText(pages[0]!)).toBe("AB");
    expect(plainPageText(pages[1]!)).toBe("C");
  });

  it("fills four wrapped body lines before starting the next page", () => {
    const pages = paginateDialogueSegments([
      { text: "가나다라마바사아자차카타파하거너", colorIndex: 0 },
    ], { maxWidth: 4, measure: measureChars });

    expect(pages).toHaveLength(1);
    expect(plainLineTexts(pages[0]!)).toEqual(["가나다라", "마바사아", "자차카타", "파하거너"]);
  });

  it("prefers English word boundaries when wrapping", () => {
    const pages = paginateDialogueSegments([
      { text: "hello world next", colorIndex: 0 },
    ], { maxWidth: 11, measure: measureChars });

    expect(plainLineTexts(pages[0]!)).toEqual(["hello world", "next"]);
  });

  it("splits text beyond four wrapped lines into following pages", () => {
    const pages = paginateDialogueSegments([
      { text: "가나다라마바사아자차카타파하거너더", colorIndex: 0 },
    ], { maxWidth: 4, measure: measureChars });

    expect(pages).toHaveLength(2);
    expect(plainLineTexts(pages[0]!)).toEqual(["가나다라", "마바사아", "자차카타", "파하거너"]);
    expect(plainLineTexts(pages[1]!)).toEqual(["더"]);
  });

  it("preserves color-code segment boundaries across automatic wraps", () => {
    const pages = paginateDialogueSegments(
      parseDialogueText("A\\c[2]BC\\c[0]D"),
      { maxWidth: 2, measure: measureChars }
    );

    expect(pages).toHaveLength(1);
    expect(pages[0]?.lines[0]?.segments).toEqual([
      { text: "A", colorIndex: 0 },
      { text: "B", colorIndex: 2 },
    ]);
    expect(pages[0]?.lines[1]?.segments).toEqual([
      { text: "C", colorIndex: 2 },
      { text: "D", colorIndex: 0 },
    ]);
  });

  it("counts author-authored empty lines as body lines", () => {
    const pages = paginateDialogueSegments([
      { text: "A\n\nB", colorIndex: 0 },
    ], { maxWidth: 100, measure: measureChars });

    expect(plainLineTexts(pages[0]!)).toEqual(["A", "", "B"]);
    expect(plainPageText(pages[0]!)).toBe("A\n\nB");
  });

  it("does not turn a consumed trailing wrap space into an authored empty line", () => {
    const pages = paginateDialogueSegments([
      { text: "abcd ", colorIndex: 0 },
    ], { maxWidth: 4, measure: measureChars });

    expect(plainLineTexts(pages[0]!)).toEqual(["abcd"]);
  });

  it("falls back to character measurement when the injected measure fails", () => {
    const pages = paginateDialogueSegments([
      { text: "abcdef", colorIndex: 0 },
    ], {
      maxWidth: 3,
      measure: () => {
        throw new Error("no layout");
      },
      fallbackCharWidth: 1,
    });

    expect(plainLineTexts(pages[0]!)).toEqual(["abc", "def"]);
  });
});
