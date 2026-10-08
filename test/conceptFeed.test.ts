/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { bundledConcepts } from "@/concepts/source";
import type { ConceptPage, ConceptQuery, ConceptSource } from "@/concepts/source";
import type { GameConcept } from "@/concepts/format";
import { CONCEPT_FEED_TESTIDS, createConceptFeed, type ConceptFeedOptions } from "@/start/conceptFeed/conceptFeed";

const base = bundledConcepts()[0]!;
function concept(index: number, overrides: Partial<GameConcept> = {}): GameConcept {
  return { ...base, slug: `c-${index}-abcdef`, title: `컨셉 ${index}`, ...overrides };
}

function fakeSource(pages: Record<string, ConceptPage>, calls: { query: ConceptQuery; cursor: string | null }[] = []): ConceptSource {
  return {
    page: async (query, cursor) => { calls.push({ query, cursor }); return pages[cursor ?? "first"] ?? { items: [], nextCursor: null, offline: false }; },
    detail: async (item) => ({ concept: item, similar: [concept(99, { title: "비슷한 것" })] }),
    thumbUrl: async () => "/assets/x.webp",
    made: () => undefined,
  };
}

const flush = async (): Promise<void> => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };
const q = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const qa = (root: HTMLElement, id: string) => [...root.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];

let disposeLast: (() => void) | null = null;
function mount(options: Partial<ConceptFeedOptions> & Pick<ConceptFeedOptions, "source">) {
  let onVisible: () => void = () => {};
  const feed = createConceptFeed({
    mode: "overlay",
    onMake: async () => true,
    observe: (_target, callback) => { onVisible = callback; return () => {}; },
    ...options,
  });
  document.body.append(feed.element);
  disposeLast = () => { feed.dispose(); feed.element.remove(); };
  return { feed, root: feed.element, scrollToEnd: () => onVisible() };
}

afterEach(() => { disposeLast?.(); disposeLast = null; vi.useRealTimers(); });

describe("concept feed", () => {
  it("loads the next page when the end comes into view and does not duplicate cards", async () => {
    const calls: { query: ConceptQuery; cursor: string | null }[] = [];
    const source = fakeSource({
      first: { items: [concept(1), concept(2)], nextCursor: "p2", offline: false },
      p2: { items: [concept(2), concept(3)], nextCursor: null, offline: false },
    }, calls);
    const { root, scrollToEnd } = mount({ source });
    await flush();
    expect(qa(root, CONCEPT_FEED_TESTIDS.card)).toHaveLength(2);
    scrollToEnd();
    await flush();
    expect(qa(root, CONCEPT_FEED_TESTIDS.card).map((card) => card.dataset.slug)).toEqual(["c-1-abcdef", "c-2-abcdef", "c-3-abcdef"]);
    expect(calls.map((call) => call.cursor)).toEqual([null, "p2"]);
    expect(q(root, CONCEPT_FEED_TESTIDS.more)!.hidden).toBe(true);
  });

  it("a tag chip restarts the list with that tag", async () => {
    const calls: { query: ConceptQuery; cursor: string | null }[] = [];
    const { root } = mount({ source: fakeSource({ first: { items: [concept(1)], nextCursor: null, offline: false } }, calls) });
    await flush();
    q(root, `${CONCEPT_FEED_TESTIDS.chip}-추리`)!.click();
    await flush();
    expect(calls.at(-1)).toEqual({ query: { tag: "추리" }, cursor: null });
    expect(q(root, `${CONCEPT_FEED_TESTIDS.chip}-추리`)!.getAttribute("aria-selected")).toBe("true");
  });

  it("shows the offline note for bundle pages", async () => {
    const { root } = mount({ source: fakeSource({ first: { items: [concept(1)], nextCursor: null, offline: true } }) });
    await flush();
    expect(q(root, CONCEPT_FEED_TESTIDS.offline)!.hidden).toBe(false);
  });

  it("typing shows the custom card first, and Enter drafts a concept into the detail view", async () => {
    const drafted = concept(7, { title: "초안 컨셉" });
    const draft = vi.fn(async () => ({ concept: drafted, thumb: Promise.resolve(null) }));
    const { root } = mount({ source: fakeSource({ first: { items: [concept(1)], nextCursor: null, offline: false } }), draft });
    await flush();
    const search = q(root, CONCEPT_FEED_TESTIDS.search) as HTMLInputElement;
    search.value = "고양이 탐정";
    search.dispatchEvent(new Event("input"));
    expect(root.querySelector(".cf-grid")!.firstElementChild!.getAttribute("data-testid")).toBe(CONCEPT_FEED_TESTIDS.custom);
    search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flush();
    expect(draft).toHaveBeenCalledWith("고양이 탐정");
    expect(q(root, CONCEPT_FEED_TESTIDS.detail)!.hidden).toBe(false);
    expect(root.querySelector(".cf-detail-title")!.textContent).toBe("초안 컨셉");
  });

  it("a declined AI gate keeps the feed and never drafts", async () => {
    const draft = vi.fn();
    const { root } = mount({ source: fakeSource({ first: { items: [concept(1)], nextCursor: null, offline: false } }), draft, beforeDraft: async () => false });
    await flush();
    const search = q(root, CONCEPT_FEED_TESTIDS.search) as HTMLInputElement;
    search.value = "고양이 탐정";
    search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flush();
    expect(draft).not.toHaveBeenCalled();
    expect(q(root, CONCEPT_FEED_TESTIDS.detail)!.hidden).toBe(true);
  });

  it("make passes the tweak, locks while running, and unlocks when cancelled", async () => {
    let finish: (started: boolean) => void = () => {};
    const onMake = vi.fn((_concept: GameConcept, _tweak: string) => new Promise<boolean>((resolve) => { finish = resolve; }));
    const { root } = mount({ source: fakeSource({ first: { items: [concept(1)], nextCursor: null, offline: false } }), onMake });
    await flush();
    q(root, CONCEPT_FEED_TESTIDS.card)!.click();
    await flush();
    const tweak = q(root, CONCEPT_FEED_TESTIDS.tweak) as HTMLTextAreaElement;
    tweak.value = "주인공을 고양이로";
    const make = q(root, CONCEPT_FEED_TESTIDS.make) as HTMLButtonElement;
    make.click();
    make.click();
    expect(onMake).toHaveBeenCalledTimes(1);
    expect(onMake.mock.calls[0]![1]).toBe("주인공을 고양이로");
    expect(make.disabled).toBe(true);
    finish(false);
    await flush();
    expect(make.disabled).toBe(false);
  });

  it("a failed make shows the error and re-enables the button", async () => {
    const { root } = mount({ source: fakeSource({ first: { items: [concept(1)], nextCursor: null, offline: false } }), onMake: async () => { throw new Error("폴더를 만들지 못했습니다."); } });
    await flush();
    q(root, CONCEPT_FEED_TESTIDS.card)!.click();
    await flush();
    const make = q(root, CONCEPT_FEED_TESTIDS.make) as HTMLButtonElement;
    make.click();
    await flush();
    expect(q(root, CONCEPT_FEED_TESTIDS.error)!.textContent).toBe("폴더를 만들지 못했습니다.");
    expect(make.disabled).toBe(false);
  });

  it("a late similar list keeps the typed tweak and the locked make button", async () => {
    let answer: (value: { concept: GameConcept; similar: GameConcept[] }) => void = () => {};
    const source = { ...fakeSource({ first: { items: [concept(1)], nextCursor: null, offline: false } }), detail: () => new Promise<{ concept: GameConcept; similar: GameConcept[] }>((resolve) => { answer = resolve; }) };
    const onMake = vi.fn((_concept: GameConcept, _tweak: string) => new Promise<boolean>(() => {}));
    const { feed, root } = mount({ source, onMake });
    await flush();
    q(root, CONCEPT_FEED_TESTIDS.card)!.click();
    const tweak = q(root, CONCEPT_FEED_TESTIDS.tweak) as HTMLTextAreaElement;
    tweak.value = "겨울로";
    const make = q(root, CONCEPT_FEED_TESTIDS.make) as HTMLButtonElement;
    make.click();
    answer({ concept: concept(1), similar: [concept(2, { title: "늦게 온 것" })] });
    await flush();
    expect(q(root, CONCEPT_FEED_TESTIDS.tweak)).toBe(tweak);
    expect(tweak.value).toBe("겨울로");
    expect(q(root, CONCEPT_FEED_TESTIDS.make)).toBe(make);
    expect(q(root, CONCEPT_FEED_TESTIDS.similar)!.textContent).toContain("늦게 온 것");
    expect(feed.busy()).toBe(true);
    expect(feed.escape()).toBe(true);
    expect(q(root, CONCEPT_FEED_TESTIDS.detail)!.hidden).toBe(false);
  });

  it("escape() goes back from detail first and reports false on the feed", async () => {
    const { feed, root } = mount({ source: fakeSource({ first: { items: [concept(1)], nextCursor: null, offline: false } }) });
    await flush();
    expect(feed.escape()).toBe(false);
    q(root, CONCEPT_FEED_TESTIDS.card)!.click();
    await flush();
    expect(q(root, CONCEPT_FEED_TESTIDS.similar)!.textContent).toContain("비슷한 것");
    expect(feed.escape()).toBe(true);
    expect(q(root, CONCEPT_FEED_TESTIDS.detail)!.hidden).toBe(true);
  });
});
