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
import type { GamePresetId } from "@/project/gameDesignBrief";
import type { InterviewGenre } from "@/project/gameInterview";
import { startIcon } from "../icons";
import { BUILTIN_GAMES, type BuiltinGameId } from "../home/builtinGames";
import { FIRST_RUN_EXAMPLES } from "../firstRun/promptHome";
import { conceptStageArt } from "./stageArt";

/** 덮는 창의 장르 카드 — 누르면 빠른 인터뷰(장르 + 질문 셋). 그림은 그 장르가 짓는 틀의 대표 그림(CONCEPT_FALLBACK_THUMB). */
const QUICK_GENRES: readonly (readonly [InterviewGenre, string, GamePresetId])[] = [
  ["romance", "관계·연애", "story-cutscene"], ["monster", "몬스터 수집", "monster-collect"], ["adventure", "모험", "adventure-jrpg"], ["mystery", "추리", "horror-gallery"],
];

export type BuiltinDemoId = BuiltinGameId;

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
  draftError: "concept-feed-draft-error",
  retry: "concept-feed-retry",
  retryInput: "concept-feed-retry-input",
  quick: "concept-feed-quick",
  quickGenre: "concept-feed-quick-genre",
  quickStart: "concept-feed-quick-start",
  builtinDemos: "concept-feed-builtin-demos",
  example: "concept-feed-example",
  browse: "concept-feed-browse",
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

/** 「#태그」 — '#' 과 태그 본문을 다른 노드로 나눠 태그 본문이 카탈로그 키(「웹소설」 등)로 번역되게 한다. */
function hashtagSpan(tags: readonly string[]): HTMLElement {
  const parts: (Node | string)[] = [];
  tags.forEach((tag, index) => {
    if (index > 0) parts.push(" ");
    parts.push("#", el("span", { text: tag }));
  });
  return el("span", { children: parts });
}

function presetLabel(presetId: GameConcept["presetId"]): string {
  return NEW_PROJECT_CHOICES.find((choice) => choice.id === presetId)?.label ?? presetId;
}

function defaultObserve(target: Element, onVisible: () => void): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) onVisible(); }, { rootMargin: "600px 0px" });
  observer.observe(target);
  return () => observer.disconnect();
}

/** 컨셉 초안 실패를 원인과 다음 할 일 한 문장으로. 원시 응답(JSON)은 보이지 않는다. */
export function draftFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/429|한도|usage limit|rate limit/iu.test(message)) {
    return "AI 사용 한도에 걸렸어요. 잠시 뒤 다시 시도하거나 AI 설정에서 다른 계정을 고르세요.";
  }
  if (/Failed to fetch|NetworkError|ECONN|401|403|로그인|연결|브리지|bridge|Invalid URL/iu.test(message)) {
    return "AI 에 연결하지 못했어요. AI 설정에서 계정 연결을 확인한 뒤 다시 시도해 주세요.";
  }
  const plain = message.replace(/\s*[—-]\s*\{.*$/su, "").trim();
  return plain || "컨셉을 만들지 못했어요. 문장을 조금 바꿔 다시 시도해 주세요.";
}

// 답이 없는 연결은 「만드는 중…」에 끝없이 머물렀다(2026-11-26 실측: 3분 넘게 변화 없음). 두 번 묻는 초안도 보통 1분 안에 끝난다.
const DRAFT_TIMEOUT_MS = 120_000;
const DRAFT_TIMEOUT_MESSAGE = "AI 가 2분 동안 답하지 않았어요. AI 설정에서 계정을 확인하거나 잠시 뒤 다시 시도해 주세요.";

function withDraftTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(DRAFT_TIMEOUT_MESSAGE)), DRAFT_TIMEOUT_MS); });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
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
  // 덮는 창은 첫 실행 홈(src/start/firstRun/promptHome.ts)과 같은 입력 칸(fr-composer)을 쓴다. 런처는 틀 위 막대에 꽂는 검색 줄이다.
  const search = launcher
    ? el("input", {
      class: "cf-search-input",
      attrs: { type: "search", maxlength: "200", autocomplete: "off", "aria-label": "만들고 싶은 게임", placeholder: t("만들고 싶은 게임을 적거나 컨셉 검색 — 예: 회귀한 용사가 마왕의 비서가 된다") },
      dataset: { testid: CONCEPT_FEED_TESTIDS.search },
    })
    : el("textarea", {
      class: "fr-input",
      attrs: { rows: "3", maxlength: "200", spellcheck: "false", "aria-label": "만들고 싶은 게임", placeholder: t("예: 회귀한 용사가 마왕의 비서로 취직하는 코믹 RPG") },
      dataset: { testid: CONCEPT_FEED_TESTIDS.search },
    });
  const searchSubmit = launcher
    ? el("button", { class: "cf-search-go", attrs: { type: "button" }, text: "만들기" })
    : el("button", { class: "fr-submit", attrs: { type: "button" }, children: [el("span", { text: "만들기" }), startIcon("arrow", "fr-icon")] });
  const searchBox = launcher
    ? el("div", { class: "cf-search", children: [startIcon("search", "cf-search-icon"), search, searchSubmit] })
    : el("div", { class: "fr-composer", children: [search, el("div", { class: "fr-composer-foot", children: [searchSubmit] })] });
  const top = launcher ? null : el("header", { class: "fr-top", children: [
    el("span", { class: "fr-brand", text: "새 게임" }),
    ...(options.onClose ? [el("button", {
      class: "cf-close", attrs: { type: "button", "aria-label": "닫기" }, dataset: { testid: CONCEPT_FEED_TESTIDS.close },
      children: [startIcon("close", "cf-close-icon")],
      on: { click: () => { if (!making) options.onClose?.(); } },
    })] : []),
  ] });

  // ── 피드 ──────────────────────────────────────────────────────────────
  const chips = el("div", { class: "cf-chips", attrs: { role: "tablist", "aria-label": "분류" } });
  const grid = el("div", { class: "cf-grid" });
  const more = el("button", { class: "cf-more", attrs: { type: "button" }, text: "더 보기", dataset: { testid: CONCEPT_FEED_TESTIDS.more } });
  const offlineNote = el("p", { class: "cf-offline", dataset: { testid: CONCEPT_FEED_TESTIDS.offline } });
  offlineNote.hidden = true;
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
  const runBuiltinDemo = (demoId: BuiltinDemoId, action: "play" | "open"): void => {
    if (making) return;
    if (options.onBuiltinDemo) {
      options.onBuiltinDemo(demoId, action);
      return;
    }
    window.location.href = `/index.html?demo=${demoId}${action === "play" ? "&play=1" : ""}`;
  };
  // 덮는 창(편집기 「새 프로젝트」·환영)은 첫 실행 홈(promptHome.ts)과 같은 한 장이다(2026-11-23 오너 「처음 키면 나오는 그거랑 동일하게」).
  // 제목 → 입력 칸 → 예시 칩 → 장르 카드 넷 + 빈 프로젝트 → 접힌 「아이디어·예제 둘러보기」(예제 셋 + 컨셉 피드). 클래스는 promptHome.css 의 fr- 를 그대로 쓴다.
  const startCard = (testid: string, cover: HTMLElement, name: string, meta: string, run: () => void, extra: Record<string, string> = {}): HTMLElement => el("button", {
    class: testid === CONCEPT_FEED_TESTIDS.blank ? "fr-gcard fr-gcard-new" : "fr-gcard", attrs: { type: "button" }, dataset: { testid, ...extra },
    on: { click: () => { if (!making) run(); } },
    children: [cover, el("span", { class: "fr-gcard-name", text: name }), el("span", { class: "fr-gcard-meta", text: meta })],
  });
  const overlayHome = launcher ? null : el("div", { class: "fr-main", children: [
    el("h1", { class: "fr-title", text: "어떤 게임을 만들까요?" }),
    el("p", { class: "fr-sub", text: "한 줄로 적으면 AI가 컨셉을 잡아 보여 줘요." }),
    searchBox,
    el("div", { class: "fr-chips", attrs: { role: "group", "aria-label": "예시" }, children: FIRST_RUN_EXAMPLES.map((example, index) => el("button", {
      class: "fr-chip", attrs: { type: "button" }, dataset: { testid: `${CONCEPT_FEED_TESTIDS.example}-${index}` }, text: example,
      on: { click: () => { if (making) return; search.value = t(example); search.dispatchEvent(new Event("input")); search.focus(); } },
    })) }),
    el("section", { class: "fr-games", dataset: { testid: CONCEPT_FEED_TESTIDS.quick }, children: [
      el("div", { class: "fr-builtin-head", children: [el("h2", { class: "fr-builtin-title", text: "장르로 시작" })] }),
      el("div", { class: "fr-games-row", children: [
        ...(options.onInterview ? QUICK_GENRES.map(([id, label, preset]) => startCard(
          CONCEPT_FEED_TESTIDS.quickGenre,
          el("span", { class: "fr-gcard-cov", children: [el("img", { attrs: { src: CONCEPT_FALLBACK_THUMB[preset], alt: "", decoding: "async", draggable: "false" } })] }),
          label, "질문 셋으로 시작", () => void openQuick(id), { genre: id },
        )) : []),
        ...(options.onBlank ? [startCard(
          CONCEPT_FEED_TESTIDS.blank,
          el("span", { class: "fr-gcard-cov", attrs: { "aria-hidden": "true" }, text: "+" }),
          "빈 프로젝트", "AI 없이 직접 그리기", () => options.onBlank?.(),
        )] : []),
      ] }),
    ] }),
    el("details", { class: "fr-builtin cf-browse", dataset: { testid: CONCEPT_FEED_TESTIDS.browse }, children: [
      el("summary", { class: "fr-builtin-head", children: [el("span", { class: "fr-builtin-title", text: "아이디어·예제 둘러보기" })] }),
      el("div", { class: "fr-builtin-row", dataset: { testid: CONCEPT_FEED_TESTIDS.builtinDemos }, children: BUILTIN_GAMES.map((game) => el("button", {
        class: "fr-bcard", attrs: { type: "button", "aria-label": `${game.title} — 편집기에서 열기` },
        dataset: { testid: `builtin-demo-open-${game.id}` },
        on: { click: () => runBuiltinDemo(game.id, "open") },
        children: [
          el("img", { class: "fr-bcard-img", attrs: { src: game.cover, alt: "", decoding: "async", loading: "lazy", draggable: "false" } }),
          el("span", { class: "fr-bcard-text", children: [
            el("span", { class: "fr-bcard-name", text: game.title.split(":")[0]!.trim(), attrs: { translate: "no" } }),
            el("span", { class: "fr-bcard-meta", text: game.genre }),
          ] }),
        ],
      })) }),
      chips, grid, more, offlineNote,
    ] }),
  ] });
  // 런처(첫 화면 「라이브러리 홈」)는 배너·내 게임·기본 게임 선반을 lead 로 받고, 여기서는 「컨셉에서 시작」 선반만 그린다.
  // 장르 질문(골라서 만들기)과 빈 프로젝트는 선반 머리 오른쪽 글자 단추로 둔다.
  const launcherHead = launcher ? el("div", { class: "cf-feed-head", dataset: { nav: "create" }, children: [
    el("h2", { text: "이런 게임은 어때요?", attrs: { id: "cf-feed-h" } }),
    el("p", { text: "고르면 이름·폴더·화면 크기는 자동으로 정해져요" }),
    el("div", { class: "cf-feed-head-right", children: [
      ...(options.onInterview ? [el("button", { class: "cf-head-link", attrs: { type: "button" }, dataset: { testid: CONCEPT_FEED_TESTIDS.quickStart }, text: "골라서 만들기 ›", on: { click: () => void openQuick() } })] : []),
      ...(options.onBlank ? [el("button", { class: "cf-head-link", attrs: { type: "button" }, dataset: { testid: CONCEPT_FEED_TESTIDS.blank }, text: "빈 프로젝트 ›", on: { click: () => options.onBlank?.() } })] : []),
    ] }),
  ] }) : null;
  const feed = el("section", { class: "cf-feed", children: [
    ...(options.lead ? [options.lead] : []),
    ...(launcher ? [el("div", { class: "cf-launcher-search", children: [searchBox] })] : []),
    ...(overlayHome ? [overlayHome] : [...(launcherHead ? [launcherHead] : []), chips, grid, more, offlineNote]),
  ] });
  const detail = el("section", { class: "cf-detail", dataset: { testid: CONCEPT_FEED_TESTIDS.detail } });
  detail.hidden = true;
  const scrim = el("div", { class: "cf-scrim", attrs: { hidden: "" }, on: { click: () => { returnToFeed(); } } });
  const body = el("div", { class: "cf-body", children: [feed, ...(launcher ? [scrim] : []), detail] });
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
            hashtagSpan(concept.tags),
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
  search.addEventListener("keydown", (raw) => {
    const event = raw as KeyboardEvent;
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); submitSearch(); }
  });
  searchSubmit.addEventListener("click", submitSearch);

  // ── 상세 ──────────────────────────────────────────────────────────────
  let detailSeq = 0;
  /** 만들기 진행 중 — 피드 전체에 하나. 상세를 옮겨 다녀도 두 번째 만들기·닫기를 막는다. */
  let making = false;
  const showFeed = (): void => {
    detailSeq += 1;
    detail.hidden = true;
    scrim.hidden = true;
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
      make.textContent = t("준비하는 중…");
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
        el("button", { class: "cf-back cf-link", attrs: { type: "button", "aria-label": launcher ? "닫기" : "피드로" }, text: launcher ? "✕" : "← 피드로", dataset: { testid: CONCEPT_FEED_TESTIDS.back }, on: { click: showFeed } }),
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
          el("span", { class: "cf-tags", children: [hashtagSpan(other.tags)] }),
        ] })],
      })),
    );
  }

  const enterDetail = (): void => {
    if (!detail.hidden) return;
    feedScroll = body.scrollTop;
    // 런처의 상세는 오른쪽 시트다 — 뒤의 피드는 그대로 두고 스크롤도 지킨다.
    if (!launcher) { feed.hidden = true; body.scrollTop = 0; }
    scrim.hidden = !launcher;
    detail.hidden = false;
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
      const drafted = await withDraftTimeout(draft(text));
      if (mine !== detailSeq || detail.hidden) return;
      renderDetail(drafted.concept, items.filter((other) => other.presetId === drafted.concept.presetId).slice(0, 6), drafted.thumb);
      // 피드가 검색어로 걸러져 있으면 위 목록이 비기 쉽다 — 출처의 비슷한 컨셉(태그·장르 틀)으로 채운다.
      void source.detail(drafted.concept).then((result) => {
        if (mine === detailSeq && !detail.hidden && result.similar.length > 0) setSimilar(result.similar);
      }, () => undefined);
    } catch (error) {
      if (mine !== detailSeq) return;
      renderDraftFailure(text, error);
    }
  }

  // 실패하면 「만드는 중…」을 지우고 원인·고칠 수 있는 문장·다시 시도를 한자리에 둔다 — 예전엔 화면 맨 아래 빨간 줄만 남아
  // 막다른 길이었다(2026-11-26 QA vm-qa15 #52·#57·#93). 다시 시도는 openCustom 을 다시 불러 AI 연결 확인부터 거친다.
  function renderDraftFailure(text: string, error: unknown): void {
    const input = el("textarea", {
      class: "fr-input",
      attrs: { rows: "3", maxlength: "200", spellcheck: "false", "aria-label": "만들고 싶은 게임" },
      dataset: { testid: CONCEPT_FEED_TESTIDS.retryInput },
    }) as HTMLTextAreaElement;
    input.value = text;
    const retry = el("button", {
      class: "fr-submit", attrs: { type: "button" }, dataset: { testid: CONCEPT_FEED_TESTIDS.retry },
      children: [el("span", { text: "다시 시도" })],
      on: { click: () => { const next = input.value.trim(); if (next) void openCustom(next); } },
    });
    detail.replaceChildren(el("div", { class: "cf-detail-main", children: [
      el("button", { class: "cf-back cf-link", attrs: { type: "button" }, text: "← 피드로", dataset: { testid: CONCEPT_FEED_TESTIDS.back }, on: { click: showFeed } }),
      el("h2", { class: "cf-detail-title", text: "컨셉을 만들지 못했어요" }),
      el("p", { class: "cf-error", attrs: { role: "alert" }, dataset: { testid: CONCEPT_FEED_TESTIDS.draftError }, text: draftFailureReason(error) }),
      el("div", { class: "fr-composer", children: [input, el("div", { class: "fr-composer-foot", children: [retry] })] }),
    ] }));
    input.focus();
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
