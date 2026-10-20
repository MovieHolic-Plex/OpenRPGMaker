// 새 게임 = 컨셉 피드 (2026-10-07, docs/superpowers/specs/2026-10-07-concept-feed-design.md).
// 런처 「만들기」 갈래(2026-10-17부터 src/start/launcherShell 안의 본문)와 편집기 「새 프로젝트」·환영 창(덮는 창)이 같은 컴포넌트를 쓴다.
// 덮는 창은 자기 위 막대(제목·입력창·닫기)를 그리고, 런처는 입력창(searchBox)만 받아 틀의 위 막대에 꽂는다.
// 유튜브 홈처럼: 입력창 + 분류 칩 + 16:9 썸네일 격자(내리면 계속) → 상세(큰 키아트·이런 게임이 됩니다·살짝 바꾸기·비슷한 컨셉).
import "./conceptFeed.css";
import { el } from "@/util/dom";
import { getLocale, t } from "@/i18n";
import { CONCEPT_TAGS, CONCEPT_TWEAK_LIMIT, localizedConcept, type GameConcept } from "@/concepts/format";
import { CONCEPT_FALLBACK_THUMB, type ConceptFallback, type ConceptQuery, type ConceptSource } from "@/concepts/source";
import { NEW_PROJECT_CHOICES } from "@/editor/newProjectChoices";
import type { GameDesignBrief } from "@/project/gameDesignBrief";
import type { InterviewGenre } from "@/project/gameInterview";
import { startIcon } from "../icons";
import { BUILTIN_GAMES, type BuiltinGameId } from "../home/builtinGames";
import { conceptStageArt } from "./stageArt";

/** 덮는 창의 「골라서 만들기」 띠 — 인터뷰 첫 장면(cdn, src/editor/interviewSceneBank.ts)과 장르 바로가기. 띠 하나 때문에 장면 목록 JSON 을 피드에 싣지 않는다. */
const QUICK_ART = "https://cdn.openrpgmaker.com/interview-scene-bank/full/opening-62062ac73a78.webp";
const QUICK_GENRES: readonly (readonly [InterviewGenre, string])[] = [["romance", "관계·연애"], ["monster", "몬스터 수집"], ["adventure", "모험"], ["mystery", "추리"]];

export type BuiltinDemoId = BuiltinGameId;

/** 덮는 창의 「기본 데모 게임」 카드 — 첫 화면 「기본 게임」 선반과 같은 표(src/start/home/builtinGames.ts)를 쓴다. */
const BUILTIN_DEMO_CARDS = BUILTIN_GAMES.map((game) => ({
  ...game,
  playTestId: `builtin-demo-play-${game.id}`,
  openTestId: `builtin-demo-open-${game.id}`,
}));

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
  quick: "concept-feed-quick",
  quickGenre: "concept-feed-quick-genre",
  quickStart: "concept-feed-quick-start",
  builtinDemos: "concept-feed-builtin-demos",
} as const;

/** launcher = 런처 「만들기」 갈래의 본문(위 막대는 틀이 그린다). overlay = 편집기의 덮는 창(자기 위 막대·닫기). */
export type ConceptFeedMode = "launcher" | "overlay";
export type DraftedConcept = { readonly concept: GameConcept; readonly thumb: Promise<string | null> };

export type ConceptFeedOptions = {
  readonly mode: ConceptFeedMode;
  readonly source: ConceptSource;
  /** 만들기. true = 시작됨(화면 넘김은 호출부 몫, 버튼은 잠근 채 둔다). false = 취소(다시 누를 수 있다). 던지면 오류 줄. */
  readonly onMake: (concept: GameConcept, tweak: string) => Promise<boolean>;
  readonly onBlank?: () => void;
  /** 「골라서 만들기」 — 빠른 인터뷰(장르 + 질문 셋)가 낸 기획으로 만들기. 없으면 입구를 보이지 않는다. 약속은 onMake 와 같다. */
  readonly onInterview?: (brief: GameDesignBrief, title: string) => Promise<boolean>;
  readonly onClose?: () => void;
  /** 기본 데모 게임 즉시 플레이 / 편집기에서 열기. */
  readonly onBuiltinDemo?: (demoId: BuiltinDemoId, action: "play" | "open") => void;
  /** 런처만 — 피드 맨 위에 얹는 판(시작 화면의 「이어서 만들기」). */
  readonly lead?: HTMLElement | null;
  /** 「내가 쓴 걸로 만들기」 전에 — AI 연결 관문. false 면 초안을 쓰지 않고 피드에 남는다. */
  readonly beforeDraft?: () => Promise<boolean>;
  /** 입력 문장 → 컨셉 초안. 기본은 src/concepts/draft.ts 를 지연 로드한다. */
  readonly draft?: (text: string) => Promise<DraftedConcept>;
  /** 테스트용 — 끝 감지. 기본은 IntersectionObserver. */
  readonly observe?: (target: Element, onVisible: () => void) => () => void;
};

export type ConceptFeed = {
  readonly element: HTMLElement;
  /** 입력창 + 만들기 단추. 덮는 창은 자기 위 막대에 이미 꽂았고, 런처는 이것을 틀의 위 막대로 옮긴다. */
  readonly searchBox: HTMLElement;
  /** Escape 한 번. 상세면 피드로 돌아가고 true. 피드면 false(닫기는 호출부 몫). 편집기 창은 modalStack 이 이걸 부른다. */
  escape(): boolean;
  /** 상세 화면에서 피드로 돌아간다. 만들기 중이면 false. */
  returnToFeed(): boolean;
  /** 만들기가 진행 중이면 true — 덮는 창은 이동안 닫지 않는다. */
  busy(): boolean;
  /**
   * 처음 상태로 — 상세·골라서 만들기 창을 닫고, 검색어·분류를 비우고, 맨 위로. 만들기 중이면 false(아무것도 바꾸지 않는다).
   * 런처가 다른 칸으로 갔다가 돌아올 때 앞 칸의 검색·상세가 남지 않게 부른다(2026-10-21 상태 누수).
   */
  reset(): boolean;
  /** 이 컨셉의 상세를 바로 연다(홈의 「지금 만들 수 있는 게임」 카드). */
  openConcept(concept: GameConcept): void;
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
  let fallback: ConceptFallback | null = null;
  let disposed = false;
  let feedScroll = 0;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let stopObserving: () => void = () => {};

  const launcher = options.mode === "launcher";
  const root = el("div", { class: `cf-root cf-${options.mode}`, dataset: { testid: CONCEPT_FEED_TESTIDS.root } });
  if (options.mode === "overlay") {
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "새 게임");
  }
  const errorLine = el("p", { class: "cf-error", attrs: { role: "alert" }, dataset: { testid: CONCEPT_FEED_TESTIDS.error } });
  errorLine.hidden = true;
  const setError = (message: string): void => { errorLine.textContent = message; errorLine.hidden = message === ""; };

  // ── 입력창 ────────────────────────────────────────────────────────────
  const search = el("input", {
    class: "cf-search-input",
    attrs: {
      type: "search", maxlength: "200", autocomplete: "off", "aria-label": "만들고 싶은 게임",
      placeholder: t(launcher ? "만들고 싶은 게임을 적거나 컨셉 검색 — 예: 회귀한 용사가 마왕의 비서가 된다" : "만들고 싶은 게임을 적어 보세요 — 예: 회귀한 용사가 마왕의 비서가 된다"),
    },
    dataset: { testid: CONCEPT_FEED_TESTIDS.search },
  });
  const searchSubmit = el("button", { class: "cf-search-go", attrs: { type: "button" }, text: "만들기" });
  const searchBox = el("div", { class: "cf-search", children: [...(launcher ? [startIcon("search", "cf-search-icon")] : []), search, searchSubmit] });
  const top = launcher ? null : el("header", { class: "cf-top", children: [
    el("div", { class: "cf-brand", text: "새 게임" }),
    searchBox,
    ...(options.onClose ? [el("div", { class: "cf-top-actions", children: [el("button", {
      class: "cf-close", attrs: { type: "button", "aria-label": "닫기" }, dataset: { testid: CONCEPT_FEED_TESTIDS.close },
      children: [startIcon("close", "cf-close-icon")],
      on: { click: () => { if (!making) options.onClose?.(); } },
    })] })] : []),
  ] });

  // ── 피드 ──────────────────────────────────────────────────────────────
  const chips = el("div", { class: "cf-chips", attrs: { role: "tablist", "aria-label": "분류" } });
  const grid = el("div", { class: "cf-grid" });
  const more = el("button", { class: "cf-more", attrs: { type: "button" }, text: "더 보기", dataset: { testid: CONCEPT_FEED_TESTIDS.more } });
  const offlineNote = el("p", { class: "cf-offline", dataset: { testid: CONCEPT_FEED_TESTIDS.offline } });
  offlineNote.hidden = true;
  const blank = !launcher && options.onBlank ? el("p", { class: "cf-blank", children: [
    el("span", { text: "직접 처음부터 만들고 싶다면" }),
    el("button", { class: "cf-link", attrs: { type: "button" }, text: "빈 프로젝트로 시작", dataset: { testid: CONCEPT_FEED_TESTIDS.blank }, on: { click: () => options.onBlank?.() } }),
  ] }) : null;
  // ── 골라서 만들기(빠른 인터뷰) ────────────────────────────────────────
  let quick: { element: HTMLElement; destroy(): void } | null = null;
  const closeQuick = (): void => { quick?.destroy(); quick = null; };
  const openQuick = async (genre?: InterviewGenre): Promise<void> => {
    if (quick || making || !options.onInterview) return;
    const { createQuickInterview } = await import("@/start/quickInterview/quickInterview");
    if (disposed || quick) return;
    quick = createQuickInterview({
      ...(genre ? { initialGenre: genre } : {}),
      onClose: closeQuick,
      onMake: async (brief, title) => {
        making = true;
        try {
          const started = await options.onInterview!(brief, title);
          if (!started) making = false;
          return started;
        } catch (error) { making = false; throw error; }
      },
    });
    root.append(quick.element);
    quick.element.querySelector<HTMLElement>(".qi-card")?.focus();
  };
  const genreButtons = (className: string): HTMLElement[] => QUICK_GENRES.map(([id, label]) => el("button", {
    class: className, attrs: { type: "button" }, text: label, dataset: { testid: CONCEPT_FEED_TESTIDS.quickGenre, genre: id },
    on: { click: () => void openQuick(id) },
  }));
  // 덮는 창만: 인터뷰 첫 장면을 깐 띠. 런처는 「컨셉에서 시작」 머리의 「골라서 만들기 ›」가 같은 창을 연다.
  const quickBand = !options.onInterview || launcher ? null
    : el("section", { class: "cf-quick", dataset: { testid: CONCEPT_FEED_TESTIDS.quick }, children: [
      el("img", { class: "cf-quick-art", attrs: { src: QUICK_ART, alt: "", draggable: "false" } }),
      el("div", { class: "cf-quick-text", children: [
        el("strong", { text: "골라서 만들기" }),
        el("span", { text: "장르 하나, 질문 셋. 네 번 고르면 바로 시작해요." }),
      ] }),
      el("div", { class: "cf-quick-genres", children: [
        ...genreButtons("cf-quick-genre"),
        el("button", { class: "cf-quick-go", attrs: { type: "button" }, text: "시작하기", dataset: { testid: CONCEPT_FEED_TESTIDS.quickStart }, on: { click: () => void openQuick() } }),
      ] }),
    ] });
  const runBuiltinDemo = (demoId: BuiltinDemoId, action: "play" | "open"): void => {
    if (making) return;
    if (options.onBuiltinDemo) {
      options.onBuiltinDemo(demoId, action);
      return;
    }
    window.location.href = `/index.html?demo=${demoId}${action === "play" ? "&play=1" : ""}`;
  };
  const builtinDemosSection = el("section", {
    class: "cf-builtin-demos",
    dataset: { testid: CONCEPT_FEED_TESTIDS.builtinDemos },
    children: [
      el("div", {
        class: "cf-builtin-head",
        children: [
          el("h2", { class: "cf-builtin-title", text: "기본 게임" }),
          el("p", { class: "cf-builtin-sub", text: "설치되어 있어 AI 없이 바로 플레이할 수 있어요" }),
        ],
      }),
      el("div", {
        class: "cf-builtin-grid",
        children: BUILTIN_DEMO_CARDS.map((demo) =>
          el("article", {
            class: `cf-builtin-card cf-builtin-${demo.id}`,
            dataset: { testid: `builtin-demo-card-${demo.id}` },
            children: [
              el("div", {
                class: "cf-builtin-thumb",
                children: [
                  el("img", { class: "cf-builtin-thumb-img", attrs: { src: demo.cover, alt: "", decoding: "async", draggable: "false" } }),
                  el("span", { class: "cf-builtin-badge", text: "공식" }),
                ],
              }),
              el("div", {
                class: "cf-builtin-body",
                children: [
                  el("h3", { class: "cf-builtin-card-title", text: demo.title, attrs: { translate: "no" } }),
                  el("p", { class: "cf-builtin-card-sub", text: demo.genre }),
                  el("p", { class: "cf-builtin-card-desc", text: demo.description }),
                  el("div", {
                    class: "cf-builtin-actions",
                    children: [
                      el("button", {
                        class: "cf-builtin-btn cf-builtin-btn-play",
                        attrs: { type: "button" },
                        dataset: { testid: demo.playTestId },
                        text: "▶ 플레이",
                        on: { click: () => runBuiltinDemo(demo.id, "play") },
                      }),
                      el("button", {
                        class: "cf-builtin-btn cf-builtin-btn-open",
                        attrs: { type: "button" },
                        dataset: { testid: demo.openTestId },
                        text: "편집기에서 열기",
                        on: { click: () => runBuiltinDemo(demo.id, "open") },
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ),
      }),
    ],
  });
  // 런처(첫 화면 「라이브러리 홈」)는 배너·내 게임·기본 게임 선반을 lead 로 받고, 여기서는 「컨셉에서 시작」 선반만 그린다.
  // 장르 질문(골라서 만들기)과 빈 프로젝트는 선반 머리 오른쪽 글자 단추로 둔다.
  const launcherHead = launcher ? el("div", { class: "cf-feed-head", dataset: { nav: "create" }, children: [
    el("h2", { text: "컨셉에서 시작", attrs: { id: "cf-feed-h" } }),
    el("p", { text: "고르면 이름·폴더·화면 크기는 자동으로 정해져요" }),
    el("div", { class: "cf-feed-head-right", children: [
      ...(options.onInterview ? [el("button", { class: "cf-head-link", attrs: { type: "button" }, dataset: { testid: CONCEPT_FEED_TESTIDS.quickStart }, text: "골라서 만들기 ›", on: { click: () => void openQuick() } })] : []),
      ...(options.onBlank ? [el("button", { class: "cf-head-link", attrs: { type: "button" }, dataset: { testid: CONCEPT_FEED_TESTIDS.blank }, text: "빈 프로젝트 ›", on: { click: () => options.onBlank?.() } })] : []),
    ] }),
  ] }) : null;
  const feed = el("section", { class: "cf-feed", children: [
    ...(options.lead ? [options.lead] : []),
    ...(launcher ? [] : [builtinDemosSection]),
    ...(quickBand ? [quickBand] : []),
    ...(launcherHead ? [launcherHead] : []),
    chips,
    grid, more, offlineNote, ...(blank ? [blank] : []),
  ] });
  const detail = el("section", { class: "cf-detail", dataset: { testid: CONCEPT_FEED_TESTIDS.detail } });
  detail.hidden = true;
  const body = el("div", { class: "cf-body", children: [feed, detail] });
  const main = el("div", { class: "cf-main", children: [...(top ? [top] : []), body, errorLine] });
  root.append(main);

  const renderChips = (): void => {
    chips.replaceChildren(...["전체", ...(source.tags?.() ?? CONCEPT_TAGS)].map((tag) => {
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

  /**
   * 카드 그림. 런처에서는 그 컨셉이 실제로 지어질 무대(번들 칩셋의 등록 장소 그림)를 크게, 생성 일러스트는 오른쪽 아래 작은 창에 둔다 —
   * 앱 화풍과 맞고 「이걸 고르면 이런 화면이 나온다」가 거짓이 아니게. 무대 그림이 없는 칩셋이면 일러스트 그대로.
   */
  const cardArt = (concept: GameConcept): HTMLElement[] => {
    const badge = el("span", { class: "cf-badge", text: presetLabel(concept.presetId) });
    const stage = launcher ? conceptStageArt(concept) : null;
    if (!stage) return [thumbImage(concept, "card", "cf-thumb-img"), badge];
    return [
      el("img", { class: "cf-thumb-img cf-thumb-stage", attrs: { src: stage, alt: "", decoding: "async", loading: "lazy", draggable: "false" } }),
      thumbImage(concept, "card", "cf-thumb-ill"),
      badge,
    ];
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
        el("div", { class: "cf-thumb", children: cardArt(concept) }),
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
      el("div", { class: "cf-thumb cf-custom-thumb", children: [startIcon("make", "cf-custom-mark")] }),
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
    offlineNote.hidden = fallback === null;
    offlineNote.dataset.fallback = fallback ?? "";
    offlineNote.textContent = t(fallback === "offline" ? "인터넷에 연결하면 더 많은 컨셉을 볼 수 있어요." : "지금은 앱에 든 기본 컨셉만 보여요.");
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
      fallback = page.fallback;
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
    fallback = null;
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
  /** 만들기 진행 중 — 피드 전체에 하나. 상세를 옮겨 다녀도 두 번째 만들기·닫기를 막는다. */
  let making = false;
  const showFeed = (): void => {
    detailSeq += 1;
    detail.hidden = true;
    feed.hidden = false;
    detail.replaceChildren();
    setError("");
    body.scrollTop = feedScroll;
  };
  const returnToFeed = (): boolean => {
    if (making) return false;
    showFeed();
    return true;
  };

  const renderDetail = (concept: GameConcept, similar: readonly GameConcept[], heroOverride?: Promise<string | null>): void => {
    const local = localizedConcept(concept, locale);
    const tweak = el("textarea", {
      class: "cf-tweak",
      attrs: { maxlength: String(CONCEPT_TWEAK_LIMIT), rows: "3", "aria-label": "살짝 바꾸기", placeholder: t("예: 주인공을 고양이로 / 배경을 겨울로 / 엔딩은 해피엔딩") },
      dataset: { testid: CONCEPT_FEED_TESTIDS.tweak },
    });
    const make = el("button", { class: "cf-make", attrs: { type: "button" }, text: "이 게임 만들기", dataset: { testid: CONCEPT_FEED_TESTIDS.make } });
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
        make.textContent = t("이 게임 만들기");
      }, (error: unknown) => {
        making = false;
        make.disabled = false;
        make.textContent = t("이 게임 만들기");
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
      similarAside,
    );
    setSimilar(similar);
  };

  // 비슷한 컨셉은 늦게 온다(스토어 최대 3초). 상세 전체를 다시 그리면 적던 「살짝 바꾸기」와 잠긴 만들기 단추가 새것으로
  // 바뀌어 두 번 만들 수 있었다 — 늦은 결과는 이 칸만 바꾼다.
  const similarAside = el("aside", { class: "cf-similar", dataset: { testid: CONCEPT_FEED_TESTIDS.similar } });
  function setSimilar(similar: readonly GameConcept[]): void {
    similarAside.replaceChildren(
      el("h3", { text: "비슷한 컨셉" }),
      ...similar.map((other) => el("button", {
        class: "cf-mini", attrs: { type: "button" },
        on: { click: () => openDetail(other) },
        children: [thumbImage(other, "card", "cf-mini-img"), el("span", { class: "cf-mini-meta", children: [
          el("strong", { text: localizedConcept(other, locale).title, attrs: { translate: "no" } }),
          el("span", { class: "cf-tags", text: other.tags.map((tag) => `#${tag}`).join(" ") }),
        ] })],
      })),
    );
  }

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
      if (mine === detailSeq && !detail.hidden) setSimilar(result.similar);
    }, () => undefined);
  }

  let gating = false;
  async function openCustom(text: string): Promise<void> {
    if (gating) return;
    if (options.beforeDraft) {
      gating = true;
      try {
        if (!(await options.beforeDraft())) return;
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
        return;
      } finally {
        gating = false;
      }
      if (disposed) return;
    }
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
      renderDetail(drafted.concept, items.filter((other) => other.presetId === drafted.concept.presetId).slice(0, 6), drafted.thumb);
      // 피드가 검색어로 걸러져 있으면 위 목록이 비기 쉽다 — 출처의 비슷한 컨셉(태그·장르 틀)으로 채운다.
      void source.detail(drafted.concept).then((result) => {
        if (mine === detailSeq && !detail.hidden && result.similar.length > 0) setSimilar(result.similar);
      }, () => undefined);
    } catch (error) {
      if (mine !== detailSeq) return;
      setError(error instanceof Error ? error.message : String(error));
    }
  }

  const escape = (): boolean => {
    if (making) return true;
    if (quick) { closeQuick(); return true; }
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
    searchBox,
    escape,
    returnToFeed,
    busy: () => making,
    reset() {
      if (making) return false;
      closeQuick();
      showFeed();
      clearTimeout(searchTimer);
      const filtered = query.q.trim() !== "" || query.tag !== undefined;
      search.value = "";
      query.q = "";
      query.tag = undefined;
      feedScroll = 0;
      body.scrollTop = 0;
      if (filtered) { renderChips(); void reload(); }
      return true;
    },
    openConcept(concept) {
      if (making) return;
      closeQuick();
      feedScroll = 0;
      openDetail(concept);
    },
    dispose() {
      closeQuick();
      disposed = true;
      seq += 1;
      clearTimeout(searchTimer);
      stopObserving();
      document.removeEventListener("keydown", onKey);
    },
  };
}
