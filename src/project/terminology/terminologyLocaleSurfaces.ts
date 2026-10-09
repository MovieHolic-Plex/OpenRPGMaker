import type { LocaleSensitiveSurface, TranslationBoundaryRule } from "./terminologyTypes";

/**
 * Locale-sensitive behavior, inventoried apart from translatable labels.
 *
 * These do not become terminology entries: translating a label is a wording
 * decision, while these are formatting and ordering decisions that change with
 * the reader's locale even when every label stays Korean. Any future locale
 * work must handle this list separately from `TERMINOLOGY_ENTRIES`.
 */
export const LOCALE_SENSITIVE_SURFACES = [
  {
    id: "document-language",
    kind: "documentLanguage",
    locale: "ko",
    description: "The shipped document language is declared once on the root element.",
    sources: ["index.html"],
  },
  {
    id: "database-actor-number-format",
    kind: "number",
    locale: "ko-KR",
    description: "Actor studio stat numbers use a fixed ko-KR grouping formatter with no fraction digits.",
    sources: ["src/editor/panels/databaseActorStudio.ts"],
  },
  {
    id: "map-inspector-tile-count",
    kind: "number",
    locale: "ko-KR",
    description: "Map inspector cell counts are grouped with ko-KR and suffixed by the Korean counter 칸.",
    sources: ["src/editor/panels/mapInspectorPane.ts"],
  },
  {
    id: "commerce-price-format",
    kind: "currency",
    locale: "ko-KR",
    description: "Shop and inn prices are ko-KR grouped and suffixed with a bare G rather than a currency code.",
    sources: [
      "src/editor/panels/eventEditor/shopEditorModel.ts",
      "src/editor/panels/eventEditor/commandBodyCommerce.ts",
      "src/editor/panels/eventEditor/commandPreview.ts",
    ],
  },
  {
    id: "activity-timestamp-format",
    kind: "time",
    locale: "ko-KR",
    description: "Team workflow, world panel, and AI settings timestamps are rendered with ko-KR date/time styles.",
    sources: [
      "src/editor/teamWorkflowUi.ts",
      "src/editor/panels/worldPanelViews.ts",
      "src/editor/panels/aiSettingsModal.ts",
    ],
  },
  {
    id: "conversation-date-heading",
    kind: "date",
    locale: "ko-KR",
    description: "Assistant conversation history groups turns under ko-KR formatted date headings.",
    sources: ["src/editor/panels/aiChatPanelHelpers.ts"],
  },
] as const satisfies readonly LocaleSensitiveSurface[];

/**
 * The boundary between product-owned text and user-authored project content.
 *
 * This is the rule that keeps a future translation pass from rewriting somebody
 * else's game. Only `translated: true` rows are in scope for terminology, and
 * `owner: "author"` rows must never be translated at all.
 */
export const TRANSLATION_BOUNDARY = [
  {
    id: "product-chrome",
    owner: "product",
    translated: true,
    description: "Product-owned chrome: menus, toolbars, tab labels, dialog titles, field labels, help text.",
    examples: ["자료집", "테스트 실행", "맵 설정", "이동 경로"],
  },
  {
    id: "assistant-user-facing-task-names",
    owner: "product",
    translated: true,
    description: "Korean labels the assistant shows for its own tool calls, and the tool ids behind them.",
    examples: ["길 그리기", "시설 짓기", "검사"],
  },
  {
    id: "authored-record-names",
    owner: "author",
    translated: false,
    description: "Names the author typed into database records — actors, classes, skills, items, enemies, troops.",
    examples: ["주인공 이름", "스킬 이름", "아이템 이름"],
  },
  {
    id: "authored-map-and-event-text",
    owner: "author",
    translated: false,
    description: "Map names, event names, dialogue, choices, and any message text authored inside events.",
    examples: ["맵 이름", "NPC 대사", "선택지"],
  },
  {
    id: "authored-in-game-terms",
    owner: "author",
    translated: false,
    description: "The database 용어 tab: the author's own words for in-game concepts. Product translation must never touch it.",
    examples: ["HP 표기", "골드 표기"],
  },
  {
    id: "authored-world-documents",
    owner: "author",
    translated: false,
    description: "World canon, world codex, and concept bundle prose — authored fiction, not product copy.",
    examples: ["세계 개요 본문", "설정집 항목"],
  },
  {
    id: "seed-and-sample-content",
    owner: "author",
    translated: false,
    description: "Bundled sample records, demo maps, and generation presets. They are starting content the author edits, so they follow the content rule even though the project ships them.",
    examples: ["서슬 늑대", "여행자의 빵"],
  },
  {
    id: "stable-identifiers",
    owner: "product",
    translated: false,
    description: "Test ids, tool names, command kinds, storage keys, and layer ids (`lower`/`upper`/`event`). Renaming one breaks an automation contract, not a translation.",
    examples: ["db-tab-actors", "place_concept", "lower"],
  },
] as const satisfies readonly TranslationBoundaryRule[];
