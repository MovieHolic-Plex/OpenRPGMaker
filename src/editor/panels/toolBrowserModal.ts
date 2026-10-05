// editor/panels/toolBrowserModal.ts
// 🧰 AI 툴 브라우저 — 활성(비-deprecated) 툴만 도메인별로 보여준다.

import { activeTools } from "@/editor/tools/toolRegistry";
import type { ToolDefinition } from "@/editor/tools/types";
import { el } from "@/util/dom";

interface ToolCategory {
  readonly label: string;
  readonly tools: readonly ToolDefinition[];
}

const DOMAIN_LABEL: Record<string, string> = {
  core: "핵심",
  tile: "타일/시공",
  map: "맵",
  event: "이벤트/NPC",
  database: "데이터베이스",
  world: "월드 그래프",
  quest: "퀘스트/서사",
  battle: "전투",
  system: "시스템",
  other: "기타",
};

const DOMAIN_ORDER = ["core", "tile", "map", "event", "database", "world", "quest", "battle", "system", "other"] as const;

function primaryDomain(tool: ToolDefinition): string {
  const domains = tool.domains ?? [];
  if (domains.includes("core") && domains.every((d) => d === "core")) return "core";
  return domains.find((d) => d !== "core") ?? "other";
}

function buildActiveCategories(): ToolCategory[] {
  const buckets = new Map<string, ToolDefinition[]>();
  for (const tool of activeTools()) {
    const domain = primaryDomain(tool);
    const list = buckets.get(domain) ?? [];
    list.push(tool);
    buckets.set(domain, list);
  }
  return DOMAIN_ORDER
    .filter((domain) => (buckets.get(domain)?.length ?? 0) > 0)
    .map((domain) => ({
      label: DOMAIN_LABEL[domain] ?? domain,
      tools: buckets.get(domain) ?? [],
    }));
}

// 활성 툴 전량 — 카테고리 누락 방지 (레지스트리 activeTools 가 단일 소스).
export const TOOL_CATEGORIES: readonly ToolCategory[] = buildActiveCategories();

export function totalToolCount(): number {
  return activeTools().length;
}

const DESTRUCTIVE_NAMES = new Set(["remove_event", "remove_map"]);

/** 첫 화면용 자주 쓰는 툴 (이름 고정 — 레지스트리에 없으면 건너뜀). */
export const FREQUENT_TOOL_NAMES = [
  "place_npc",
  "author_house",
  "build_wall",
  "paint_road",
  "fill_region",
  "place_props",
  "place_door",
  "tile_query",
] as const;

export function frequentTools(): readonly ToolDefinition[] {
  const byName = new Map(
    TOOL_CATEGORIES.flatMap((category) => category.tools.map((tool) => [tool.name, tool] as const))
  );
  return FREQUENT_TOOL_NAMES.map((name) => byName.get(name)).filter(
    (tool): tool is ToolDefinition => tool !== undefined
  );
}

// 검색 필터(이름/설명 부분 일치). 빈 질의는 전체.
export function filterToolCategories(query: string): ToolCategory[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [...TOOL_CATEGORIES];
  return TOOL_CATEGORIES.map((category) => ({
    label: category.label,
    tools: category.tools.filter(
      (tool) => tool.name.toLowerCase().includes(trimmed) || tool.description.toLowerCase().includes(trimmed)
    ),
  })).filter((category) => category.tools.length > 0);
}

export function shouldShowFrequentFirst(query: string, showAll: boolean): boolean {
  return query.trim().length === 0 && !showAll;
}

function renderToolRow(tool: ToolDefinition): HTMLElement {
  return el("div", {
    class: "tool-browser-row",
    dataset: { testid: `tool-browser-row-${tool.name}` },
    children: [
      el("div", {
        class: "tool-browser-row-head",
        children: [
          el("code", { class: "tool-browser-name", text: tool.name }),
          el("span", {
            class: `tool-browser-badge ${tool.mode === "write" ? "is-write" : "is-read"}`,
            text: tool.mode === "write" ? "편집" : "조회",
          }),
          ...(DESTRUCTIVE_NAMES.has(tool.name)
            ? [el("span", { class: "tool-browser-badge is-danger", text: "파괴적" })]
            : []),
        ],
      }),
      el("p", { class: "tool-browser-desc", text: tool.description }),
    ],
  });
}

export function openToolBrowserModal(): HTMLElement {
  document.querySelector("[data-testid='tool-browser-modal']")?.remove();

  const body = el("div", { class: "database-modal-body tool-browser-body", dataset: { testid: "tool-browser-body" } });
  let showAll = false;
  const renderList = (query: string): void => {
    body.replaceChildren();
    if (shouldShowFrequentFirst(query, showAll)) {
      const frequent = frequentTools();
      body.append(
        el("section", {
          class: "tool-browser-category tool-browser-frequent",
          dataset: { testid: "tool-browser-frequent" },
          children: [
            el("h3", {
              class: "tool-browser-category-title",
              text: `자주 쓰는 툴 (${frequent.length})`,
              dataset: { testid: "tool-browser-frequent-title" },
            }),
            ...frequent.map((tool) => renderToolRow(tool)),
          ],
        }),
        el("button", {
          class: "ai-assistant-action tool-browser-show-all",
          text: `전체 ${totalToolCount()}개 보기`,
          attrs: { type: "button" },
          dataset: { testid: "tool-browser-show-all" },
          on: {
            click: () => {
              showAll = true;
              renderList(search.value);
            },
          },
        })
      );
      return;
    }
    const categories = filterToolCategories(query);
    if (categories.length === 0) {
      body.append(el("p", { class: "tool-browser-empty", text: "검색 결과가 없습니다." }));
      return;
    }
    if (showAll && query.trim().length === 0) {
      body.append(
        el("button", {
          class: "ai-assistant-action tool-browser-show-frequent",
          text: "자주 쓰는 툴만 보기",
          attrs: { type: "button" },
          dataset: { testid: "tool-browser-show-frequent" },
          on: {
            click: () => {
              showAll = false;
              renderList(search.value);
            },
          },
        })
      );
    }
    for (const category of categories) {
      body.append(
        el("section", {
          class: "tool-browser-category",
          children: [
            el("h3", { class: "tool-browser-category-title", text: `${category.label} (${category.tools.length})` }),
            ...category.tools.map((tool) => renderToolRow(tool)),
          ],
        })
      );
    }
  };

  const search = el("input", {
    class: "tool-browser-search",
    attrs: { type: "text", placeholder: "툴 검색 (예: 집, npc, 타일, 삭제)" },
    dataset: { testid: "tool-browser-search" },
  }) as HTMLInputElement;
  search.addEventListener("input", () => {
    if (search.value.trim().length > 0) showAll = false;
    renderList(search.value);
  });

  const closeButton = el("button", {
    class: "database-modal-close",
    text: "×",
    attrs: { type: "button", "aria-label": "닫기" },
    dataset: { testid: "tool-browser-close" },
  });

  const backdrop = el("div", {
    class: "database-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "tool-browser-modal" },
    children: [
      el("section", {
        class: "database-modal-window tool-browser-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "AI 툴 목록" },
        children: [
          el("header", {
            class: "database-modal-header tool-browser-header",
            children: [
              el("h2", { text: `🧰 AI 툴 · 자주 쓰는 것 + 검색` }),
              search,
              closeButton,
            ],
          }),
          el("p", {
            class: "tool-browser-hint",
            text: "먼저 자주 쓰는 툴을 보고, 검색으로 나머지를 찾거나 전체 목록을 엽니다. 채팅에 자연어로 요청하면 AI가 이 툴들을 조합해 실행합니다.",
          }),
          body,
        ],
      }),
    ],
  });

  const close = (): void => {
    backdrop.remove();
    document.removeEventListener?.("keydown", onKeyDown);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener?.("keydown", onKeyDown);

  renderList("");
  document.body.append(backdrop);
  return backdrop;
}
