// editor/panels/toolBrowserModal.ts
// 🧰 AI 툴 브라우저 — 어시스턴트가 쓸 수 있는 툴을 사용자에게 카테고리별로 보여준다.
// "AI한테 뭘 시킬 수 있는지"를 사용자가 알아야 좋은 요청이 나온다.

import { BATTLE_TOOLS } from "@/editor/tools/battleTools";
import { CLUSTER_RULE_TOOLS } from "@/editor/tools/clusterRuleTools";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import { EVENT_TOOLS } from "@/editor/tools/eventTools";
import { MAP_GEN_TOOLS } from "@/editor/tools/generateMapTool";
import { GROUP_LAYOUT_TOOLS } from "@/editor/tools/groupLayoutTools";
import { GROUP_SAMPLE_TOOLS } from "@/editor/tools/groupSampleTool";
import { HISTORY_TOOLS } from "@/editor/tools/historyTools";
import { MAP_TOOLS } from "@/editor/tools/mapTools";
import { TILE_TOOLS_V2 } from "@/editor/tools/v2";
import { VOCABULARY_TOOLS_V3 } from "@/editor/tools/v3";
import { PALETTE_PRESET_TOOLS } from "@/editor/tools/palettePresetTools";
import { PLAY_TOOLS } from "@/editor/tools/playTools";
import { PLACEMENT_TOOLS } from "@/editor/tools/toolRegistry";
import { QUERY_TOOLS } from "@/editor/tools/queryTools";
import { QUEST_TOOLS } from "@/editor/tools/questTools";
import { RANGE_CLASSIFY_TOOLS } from "@/editor/tools/rangeClassifyTools";
import { REFACTOR_TOOLS } from "@/editor/tools/refactorTools";
import { TERRAIN_TEMPLATE_TOOLS } from "@/editor/tools/terrainTemplateTools";
import { TILE_METADATA_TOOLS } from "@/editor/tools/tileMetadataTools";
import type { ToolDefinition } from "@/editor/tools/types";
import { VISION_QUERY_TOOLS } from "@/editor/tools/visionQueryTools";
import { WORLD_TOOLS } from "@/editor/tools/worldTools";
import { el } from "@/util/dom";

interface ToolCategory {
  readonly label: string;
  readonly tools: readonly ToolDefinition[];
}

const PLACEMENT_CATEGORIES: readonly ToolCategory[] = PLACEMENT_TOOLS.length > 0
  ? [{ label: "오브젝트 배치", tools: PLACEMENT_TOOLS }]
  : [];

// 레지스트리와 같은 원본 배열을 카테고리로 묶는다(추가 유지비 없음 — 배열이 곧 진실).
export const TOOL_CATEGORIES: readonly ToolCategory[] = [
  { label: "타일 v3 (승인 어휘)", tools: VOCABULARY_TOOLS_V3 },
  { label: "타일 v2", tools: TILE_TOOLS_V2 },
  { label: "맵 편집", tools: MAP_TOOLS },
  { label: "맵 생성", tools: MAP_GEN_TOOLS },
  ...PLACEMENT_CATEGORIES,
  { label: "이벤트/NPC", tools: EVENT_TOOLS },
  { label: "데이터베이스", tools: DB_TOOLS },
  { label: "세계관", tools: WORLD_TOOLS },
  { label: "퀘스트", tools: QUEST_TOOLS },
  { label: "전투", tools: BATTLE_TOOLS },
  { label: "리팩토링", tools: REFACTOR_TOOLS },
  { label: "작업 기록", tools: HISTORY_TOOLS },
  { label: "플레이테스트", tools: PLAY_TOOLS },
  { label: "조회", tools: QUERY_TOOLS },
  { label: "팔레트 프리셋", tools: PALETTE_PRESET_TOOLS },
  { label: "타일 지식(단어장)", tools: TILE_METADATA_TOOLS },
  { label: "클러스터 규칙", tools: CLUSTER_RULE_TOOLS },
  { label: "클러스터 구성", tools: GROUP_LAYOUT_TOOLS },
  { label: "타일 샘플 조회", tools: GROUP_SAMPLE_TOOLS },
  { label: "맵 비전 조회", tools: VISION_QUERY_TOOLS },
  { label: "타일 범위 제안", tools: RANGE_CLASSIFY_TOOLS },
  { label: "지형 템플릿(교과서)", tools: TERRAIN_TEMPLATE_TOOLS },
];

export function totalToolCount(): number {
  return TOOL_CATEGORIES.reduce((total, category) => total + category.tools.length, 0);
}

const DESTRUCTIVE_NAMES = new Set(["remove_event", "remove_map"]);

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

export function openToolBrowserModal(): HTMLElement {
  document.querySelector("[data-testid='tool-browser-modal']")?.remove();

  const body = el("div", { class: "database-modal-body tool-browser-body", dataset: { testid: "tool-browser-body" } });
  const renderList = (query: string): void => {
    body.replaceChildren();
    const categories = filterToolCategories(query);
    if (categories.length === 0) {
      body.append(el("p", { class: "tool-browser-empty", text: "검색 결과가 없습니다." }));
      return;
    }
    for (const category of categories) {
      body.append(
        el("section", {
          class: "tool-browser-category",
          children: [
            el("h3", { class: "tool-browser-category-title", text: `${category.label} (${category.tools.length})` }),
            ...category.tools.map((tool) =>
              el("div", {
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
              })
            ),
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
  search.addEventListener("input", () => renderList(search.value));

  const closeButton = el("button", {
    class: "database-modal-close",
    text: "x",
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
              el("h2", { text: `🧰 AI가 쓸 수 있는 툴 ${totalToolCount()}개` }),
              search,
              closeButton,
            ],
          }),
          el("p", {
            class: "tool-browser-hint",
            text: "채팅에 자연어로 요청하면 AI가 이 툴들을 조합해 실행합니다. 편집은 제안 카드(또는 자동 승인)로 적용되고 Ctrl+Z로 되돌릴 수 있습니다.",
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
