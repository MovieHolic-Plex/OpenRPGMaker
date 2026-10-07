// 새 게임 = 컨셉 피드 (2026-10-07, docs/superpowers/specs/2026-10-07-concept-feed-design.md).
// 런처 첫 화면(전체 화면)과 편집기 「새 프로젝트」·환영 창(덮는 창)이 같은 컴포넌트를 쓴다. 다른 것은 만들기 처리기뿐이다.
// 유튜브 홈처럼: 위 입력창 + 분류 칩 + 16:9 썸네일 격자(내리면 계속) → 상세(큰 키아트·이런 게임이 됩니다·살짝 바꾸기·비슷한 컨셉).
import "./conceptFeed.css";
import { el } from "@/util/dom";
import { getLocale, t } from "@/i18n";
import { CONCEPT_TAGS, CONCEPT_TWEAK_LIMIT, localizedConcept, type GameConcept } from "@/concepts/format";
import { CONCEPT_FALLBACK_THUMB, type ConceptQuery, type ConceptSource } from "@/concepts/source";
import { NEW_PROJECT_CHOICES } from "@/editor/newProjectChoices";

export const CONCEPT_FEED_TESTIDS = {
  root: "concept-feed",
  search: "concept-feed-search",
  chip: "concept-feed-chip",
  card: "concept-feed-card",
  custom: "concept-feed-custom",
  more: "concept-feed-more",
  detail: "concept-detail",
  make: "concept-detail-make",
  tweak: "concept-detail-tweak",
  back: "concept-detail-back",
  similar: "concept-detail-similar",
  blank: "concept-feed-blank",
  offline: "concept-feed-offline",
  close: "concept-feed-close",
  error: "concept-feed-error",
} as const;

export type ConceptFeedMode = "launcher" | "overlay";
export type DraftedConcept = { readonly concept: GameConcept; readonly thumb: Promise<string | null> };

export type ConceptFeedOptions = {
  readonly mode: ConceptFeedMode;
  readonly source: ConceptSource;
  /** 만들기. true = 시작됨(화면 넘김은 호출부 몫, 버튼은 잠근 채 둔다). false = 취소(다시 누를 수 있다). 던지면 오류 줄. */
  readonly onMake: (concept: GameConcept, tweak: string) => Promise<boolean>;
  readonly onBlank?: () => void;
  readonly onClose?: () => void;
  /** 런처만 — 「이어하기」 줄. */
  readonly continueRow?: HTMLElement | null;
  /** 런처만 — 위 막대 오른쪽(폴더 열기·팀 참여·언어). */
  readonly topActions?: readonly HTMLElement[];
  /** 입력 문장 → 컨셉 초안. 기본은 src/concepts/draft.ts 를 지연 로드한다. */
  readonly draft?: (text: string) => Promise<DraftedConcept>;
  /** 테스트용 — 끝 감지. 기본은 IntersectionObserver. */
  readonly observe?: (target: Element, onVisible: () => void) => () => void;
};

export type ConceptFeed = {
  readonly element: HTMLElement;
  /** Escape 한 번. 상세면 피드로 돌아가고 true. 피드면 false(닫기는 호출부 몫). 편집기 창은 modalStack 이 이걸 부른다. */
  escape(): boolean;
  dispose(): void;
};

const SKELETON_COUNT = 12;
const SEARCH_DEBOUNCE_MS = 250;

function presetLabel(presetId: GameConcept["presetId"]): string {
  return NEW_PROJECT_CHOICES.find((choice) => choice.id === presetId)?.label ?? presetId;
}

function defaultObserve(target: Element, onVisible: () => void): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) onVisible(); }, { rootMargin: "600px 0px" });
  observer.observe(target);
  return () => observer.disconnect();
}

async function defaultDraft(text: string): Promise<DraftedConcept> {
  const { draftConceptFromText, drawConceptThumb } = await import("@/concepts/draft");
  const concept = await draftConceptFromText(text);
  return { concept, thumb: drawConceptThumb(concept) };
}

export function createConceptFeed(options: ConceptFeedOptions): ConceptFeed {
  const { source } = options;
  const observe = options.observe ?? defaultObserve;
  const draft = options.draft ?? defaultDraft;
  const locale = getLocale();
  const query: { tag?: string; q: string } = { q: "" };
  let items: GameConcept[] = [];
  let cursor: string | null = null;
  let exhausted = false;
  let loading = false;
  let seq = 0;
  let offline = false;
  let disposed = false;
  let feedScroll = 0;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let stopObserving: () => void = () => {};

  const root = el("div", { class: `cf-root cf-${options.mode}`, dataset: { testid: CONCEPT_FEED_TESTIDS.root } });
  if (options.mode === "overlay") {
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "새 게임");
  }
  const errorLine = el("p", { class: "cf-error", attrs: { role: "alert" }, dataset: { testid: CONCEPT_FEED_TESTIDS.error } });
  errorLine.hidden = true;
  const setError = (message: string): void => { errorLine.textContent = message; errorLine.hidden = message === ""; };

  // ── 위 막대 ───────────────────────────────────────────────────────────
  const search = el("input", {
    class: "cf-search-input",
    attrs: { type: "search", maxlength: "200", autocomplete: "off", "aria-label": "만들고 싶은 게임", placeholder: t("만들고 싶은 게임을 적어 보세요 — 예: 회귀한 용사가 마왕의 비서가 된다") },
    dataset: { testid: CONCEPT_FEED_TESTIDS.search },
  });
  const searchSubmit = el("button", { class: "cf-search-go", attrs: { type: "button" }, text: "만들기" });
  const top = el("header", { class: "cf-top", children: [
    el("div", { class: "cf-brand", children: [el("span", { class: "cf-brand-mark", text: "▶", attrs: { "aria-hidden": "true" } }), el("span", { text: "새 게임" })] }),
    el("div", { class: "cf-search", children: [search, searchSubmit] }),
    el("div", { class: "cf-top-actions", children: [
      ...(options.topActions ?? []),
      ...(options.mode === "overlay" && options.onClose ? [el("button", {
        class: "cf-close", attrs: { type: "button", "aria-label": "닫기" }, text: "✕", dataset: { testid: CONCEPT_FEED_TESTIDS.close },
        on: { click: () => options.onClose?.() },
      })] : []),
    ] }),
  ] });

  // ── 피드 ──────────────────────────────────────────────────────────────
  const chips = el("div", { class: "cf-chips", attrs: { role: "tablist", "aria-label": "분류" } });
  const grid = el("div", { class: "cf-grid" });
  const more = el("button", { class: "cf-more", attrs: { type: "button" }, text: "더 보기", dataset: { testid: CONCEPT_FEED_TESTIDS.more } });
  const offlineNote = el("p", { class: "cf-offline", text: "인터넷에 연결하면 더 많은 컨셉을 볼 수 있어요.", dataset: { testid: CONCEPT_FEED_TESTIDS.offline } });
  offlineNote.hidden = true;
  const blank = options.onBlank ? el("p", { class: "cf-blank", children: [
    el("span", { text: "직접 처음부터 만들고 싶다면" }),
    el("button", { class: "cf-link", attrs: { type: "button" }, text: "빈 프로젝트로 시작", dataset: { testid: CONCEPT_FEED_TESTIDS.blank }, on: { click: () => options.onBlank?.() } }),
  ] }) : null;
  const feed = el("section", { class: "cf-feed", children: [
    chips,
    ...(options.continueRow ? [options.continueRow] : []),
    grid, more, offlineNote, ...(blank ? [blank] : []),
  ] });
  const detail = el("section", { class: "cf-detail", dataset: { testid: CONCEPT_FEED_TESTIDS.detail } });
  detail.hidden = true;
  const body = el("div", { class: "cf-body", children: [feed, detail] });
  root.append(top, body, errorLine);

  const renderChips = (): void => {
    chips.replaceChildren(...["전체", ...CONCEPT_TAGS].map((tag) => {
      const active = (tag === "전체" && !query.tag) || tag === query.tag;
      return el("button", {
        class: "cf-chip" + (active ? " is-on" : ""),
        attrs: { type: "button", role: "tab", "aria-selected": String(active) },
        dataset: { testid: `${CONCEPT_FEED_TESTIDS.chip}-${tag}` },
        text: tag,
        on: { click: () => { query.tag = tag === "전체" ? undefined : tag; renderChips(); void reload(); } },
      });
    }));
  };

  const thumbImage = (concept: GameConcept, size: "full" | "card", className: string): HTMLImageElement => {
    const image = el("img", { class: className, attrs: { alt: "", decoding: "async", loading: size === "card" ? "lazy" : "eager", draggable: "false" } });
    image.addEventListener("error", () => {
      const fallback = CONCEPT_FALLBACK_THUMB[concept.presetId];
      if (fallback && !image.src.endsWith(fallback)) image.src = fallback;
    }, { once: true });
    void source.thumbUrl(concept, size).then((url) => { image.src = url; });
    return image;
  };

  const card = (concept: GameConcept): HTMLElement => {
    const local = localizedConcept(concept, locale);
    return el("article", {
      class: "cf-card",
      attrs: { tabindex: "0", role: "button", "aria-label": local.title },
      dataset: { testid: CONCEPT_FEED_TESTIDS.card, slug: concept.slug },
      on: {
        click: () => openDetail(concept),
        keydown: (event) => { if ((event as KeyboardEvent).key === "Enter") openDetail(concept); },
      },
      children: [
        el("div", { class: "cf-thumb", children: [thumbImage(concept, "card", "cf-thumb-img"), el("span", { class: "cf-badge", text: presetLabel(concept.presetId) })] }),
        el("div", { class: "cf-meta", children: [
          el("h3", { class: "cf-title", text: local.title, attrs: { translate: "no" } }),
          el("p", { class: "cf-hook", text: local.hook, attrs: { translate: "no" } }),
          el("p", { class: "cf-tags", children: [
            el("span", { text: concept.tags.map((tag) => `#${tag}`).join(" ") }),
            ...(concept.madeCount ? [el("span", { class: "cf-made", text: `${concept.madeCount}명이 만들었어요` })] : []),
          ] }),
        ] }),
      ],
    });
  };

  const customCard = (text: string): HTMLElement => el("article", {
    class: "cf-card cf-custom",
    attrs: { tabindex: "0", role: "button", "aria-label": "내가 쓴 걸로 만들기" },
    dataset: { testid: CONCEPT_FEED_TESTIDS.custom },
    on: {
      click: () => void openCustom(text),
      keydown: (event) => { if ((event as KeyboardEvent).key === "Enter") void openCustom(text); },
    },
    children: [
      el("div", { class: "cf-thumb cf-custom-thumb", children: [el("span", { class: "cf-custom-mark", text: "✏️", attrs: { "aria-hidden": "true" } })] }),
      el("div", { class: "cf-meta", children: [
        el("h3", { class: "cf-title", text: "내가 쓴 걸로 만들기" }),
        el("p", { class: "cf-hook", text: `“${text}”`, attrs: { translate: "no" } }),
        el("p", { class: "cf-tags", text: "AI가 컨셉과 썸네일을 바로 만들어요" }),
      ] }),
    ],
  });

  const renderGrid = (): void => {
    const text = query.q.trim();
    const cards = [...(text ? [customCard(text)] : []), ...items.map(card)];
    if (loading && items.length === 0) {
      for (let index = 0; index < SKELETON_COUNT; index += 1) cards.push(el("div", { class: "cf-card cf-skeleton", attrs: { "aria-hidden": "true" }, children: [el("div", { class: "cf-thumb" }), el("div", { class: "cf-meta" })] }));
    }
    if (!loading && items.length === 0 && !text) cards.push(el("p", { class: "cf-empty", text: "이 분류에는 아직 컨셉이 없어요." }));
    grid.replaceChildren(...cards);
    more.hidden = exhausted || items.length === 0;
    more.disabled = loading;
    offlineNote.hidden = !offline;
  };

  const loadMore = async (): Promise<void> => {
    if (loading || exhausted || disposed) return;
    loading = true;
    const mine = seq;
    renderGrid();
    const request: ConceptQuery = { ...(query.tag ? { tag: query.tag } : {}), ...(query.q.trim() ? { q: query.q.trim() } : {}) };
    try {
      const page = await source.page(request, cursor);
      if (mine !== seq || disposed) return;
      const seen = new Set(items.map((concept) => concept.slug));
      items = [...items, ...page.items.filter((concept) => !seen.has(concept.slug))];
      cursor = page.nextCursor;
      exhausted = page.nextCursor === null;
      offline = page.offline;
    } catch (error) {
      if (mine !== seq) return;
      exhausted = true;
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      if (mine === seq) { loading = false; renderGrid(); }
    }
  };

  const reload = async (): Promise<void> => {
    seq += 1;
    items = [];
    cursor = null;
    exhausted = false;
    loading = false;
    offline = false;
    setError("");
    await loadMore();
  };

  more.addEventListener("click", () => void loadMore());
  stopObserving = observe(more, () => { if (!more.hidden) void loadMore(); });

  search.addEventListener("input", () => {
    query.q = search.value;
    clearTimeout(searchTimer);
    renderGrid();
    searchTimer = setTimeout(() => void reload(), SEARCH_DEBOUNCE_MS);
  });
  const submitSearch = (): void => {
    const text = search.value.trim();
    if (text) void openCustom(text);
    else search.focus();
  };
  search.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); submitSearch(); } });
  searchSubmit.addEventListener("click", submitSearch);

  // ── 상세 ──────────────────────────────────────────────────────────────
  let detailSeq = 0;
  const showFeed = (): void => {
    detailSeq += 1;
    detail.hidden = true;
    feed.hidden = false;
    detail.replaceChildren();
    setError("");
    body.scrollTop = feedScroll;
  };

  const renderDetail = (concept: GameConcept, similar: readonly GameConcept[], heroOverride?: Promise<string | null>): void => {
    const local = localizedConcept(concept, locale);
    const tweak = el("textarea", {
      class: "cf-tweak",
      attrs: { maxlength: String(CONCEPT_TWEAK_LIMIT), rows: "3", "aria-label": "살짝 바꾸기", placeholder: t("예: 주인공을 고양이로 / 배경을 겨울로 / 엔딩은 해피엔딩") },
      dataset: { testid: CONCEPT_FEED_TESTIDS.tweak },
    });
    const make = el("button", { class: "cf-make", attrs: { type: "button" }, text: "▶ 이 게임 만들기", dataset: { testid: CONCEPT_FEED_TESTIDS.make } });
    let making = false;
    make.addEventListener("click", () => {
      if (making) return;
      making = true;
      make.disabled = true;
      make.textContent = t("만드는 중…");
      setError("");
      void options.onMake(concept, tweak.value.slice(0, CONCEPT_TWEAK_LIMIT)).then((started) => {
        if (started) return;
        making = false;
        make.disabled = false;
        make.textContent = t("▶ 이 게임 만들기");
      }, (error: unknown) => {
        making = false;
        make.disabled = false;
        make.textContent = t("▶ 이 게임 만들기");
        setError(error instanceof Error ? error.message : String(error));
      });
    });
    const hero = thumbImage(concept, "full", "cf-hero-img");
    void heroOverride?.then((url) => { if (url) hero.src = url; });
    const facts: [string, string][] = [["장르 틀", presetLabel(concept.presetId)], ["주인공", concept.protagonist], ["무대", concept.stage], ["첫 장면", concept.firstScene]];
    detail.replaceChildren(
      el("div", { class: "cf-detail-main", children: [
        el("button", { class: "cf-back cf-link", attrs: { type: "button" }, text: "← 피드로", dataset: { testid: CONCEPT_FEED_TESTIDS.back }, on: { click: showFeed } }),
        el("div", { class: "cf-hero", children: [hero] }),
        el("h2", { class: "cf-detail-title", text: local.title, attrs: { translate: "no" } }),
        el("p", { class: "cf-detail-hook", text: local.hook, attrs: { translate: "no" } }),
        el("div", { class: "cf-make-row", children: [
          make,
          el("span", { class: "cf-make-hint", text: "이름·폴더·화면 크기는 자동으로 정해요. 나중에 바꿀 수 있어요." }),
        ] }),
        el("p", { class: "cf-detail-desc", text: local.description, attrs: { translate: "no" } }),
        el("div", { class: "cf-box", children: [
          el("h3", { text: "이런 게임이 됩니다" }),
          el("dl", { children: facts.flatMap(([label, value]) => [el("dt", { text: label }), el("dd", { text: value, attrs: { translate: "no" } })]) }),
        ] }),
        el("div", { class: "cf-box", children: [
          el("h3", { text: "내 식으로 살짝 바꾸기 (선택)" }),
          tweak,
        ] }),
      ] }),
      el("aside", { class: "cf-similar", dataset: { testid: CONCEPT_FEED_TESTIDS.similar }, children: [
        el("h3", { text: "비슷한 컨셉" }),
        ...similar.map((other) => el("button", {
          class: "cf-mini", attrs: { type: "button" },
          on: { click: () => openDetail(other) },
          children: [thumbImage(other, "card", "cf-mini-img"), el("span", { class: "cf-mini-meta", children: [
            el("strong", { text: localizedConcept(other, locale).title, attrs: { translate: "no" } }),
            el("span", { class: "cf-tags", text: other.tags.map((tag) => `#${tag}`).join(" ") }),
          ] })],
        })),
      ] }),
    );
  };

  const enterDetail = (): void => {
    if (!detail.hidden) return;
    feedScroll = body.scrollTop;
    feed.hidden = true;
    detail.hidden = false;
    body.scrollTop = 0;
  };

  function openDetail(concept: GameConcept): void {
    const mine = ++detailSeq;
    enterDetail();
    setError("");
    renderDetail(concept, []);
    void source.detail(concept).then((result) => {
      if (mine === detailSeq && !detail.hidden) renderDetail(result.concept, result.similar);
    }, () => undefined);
  }

  async function openCustom(text: string): Promise<void> {
    const mine = ++detailSeq;
    enterDetail();
    setError("");
    detail.replaceChildren(el("div", { class: "cf-detail-main", children: [
      el("button", { class: "cf-back cf-link", attrs: { type: "button" }, text: "← 피드로", dataset: { testid: CONCEPT_FEED_TESTIDS.back }, on: { click: showFeed } }),
      el("div", { class: "cf-hero cf-drafting", children: [el("span", { text: "컨셉을 만드는 중…" })] }),
      el("p", { class: "cf-detail-hook", text: `“${text}”`, attrs: { translate: "no" } }),
    ] }));
    try {
      const drafted = await draft(text);
      if (mine !== detailSeq || detail.hidden) return;
      const similar = items.filter((other) => other.presetId === drafted.concept.presetId).slice(0, 6);
      renderDetail(drafted.concept, similar, drafted.thumb);
    } catch (error) {
      if (mine !== detailSeq) return;
      setError(error instanceof Error ? error.message : String(error));
    }
  }

  const escape = (): boolean => {
    if (detail.hidden) return false;
    showFeed();
    return true;
  };
  // 런처는 이 화면이 문서 전부라 Escape 를 직접 받는다. 편집기 창은 modalStack 이 받아 escape() 를 부른다(층 순서 유지).
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (escape()) event.preventDefault();
  };
  if (options.mode === "launcher") document.addEventListener("keydown", onKey);

  renderChips();
  void reload();

  return {
    element: root,
    escape,
    dispose() {
      disposed = true;
      seq += 1;
      clearTimeout(searchTimer);
      stopObserving();
      document.removeEventListener("keydown", onKey);
    },
  };
}
