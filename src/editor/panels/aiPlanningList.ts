// editor/panels/aiPlanningList.ts
// 현재 맵의 **보존 기획** 목록 화면. 스튜디오 덱의 「기획」 탭이 이것을 통째로 싣고,
// 컴포저의 재사용 팝오버는 같은 데이터를 읽되 선택 UI 만 따로 그린다.
//
// 규칙 셋:
//  1. 여기는 저작 데이터를 고치는 화면이다 — 쓰기는 전부 `mapPlanningActions` 를 지난다.
//  2. 이 목록은 아무 것도 차단하지 않는다. 항목이 있다고 조수 턴이 달라지거나 맵 편집이
//     막히지 않는다. 프롬프트에 실리는 것은 컴포저의 명시적 재사용 선택뿐이다.
//  3. 은퇴(retired)와 삭제는 다르다. 은퇴는 기록을 남긴 채 재사용 후보에서만 빼고, 삭제는
//     항목을 프로젝트에서 지운다.

import { editorState } from "@/editor/editorState";
import {
  addMapPlanningItem,
  deleteMapPlanningItem,
  listMapPlanningItems,
  setMapPlanningItemRetired,
  updateMapPlanningItem,
} from "@/editor/mapPlanningActions";
import { renderEditorIcon } from "@/editor/panels/eventEditor/editorIcons";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { MAP_PLANNING_ITEM_TEXT_MAX, type MapPlanningItem } from "@/project/mapPlanningItems";
import { el } from "@/util/dom";

export interface PlanningListView {
  readonly root: HTMLElement;
  refresh(): void;
}

/** 지금 편집 중인 맵. 없으면 시작 맵 — 스튜디오 모니터와 같은 판정이다. */
export function currentPlanningMapId(): MapId | null {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId ?? null;
  return mapId && project.maps[mapId] ? mapId : null;
}

export function planningMapName(mapId: MapId | null): string {
  if (!mapId) return "맵 없음";
  const map = store.getCurrent().maps[mapId];
  return map?.name || mapId;
}

/**
 * 보존 기획 목록 화면 하나. `onChanged` 는 쓰기 후에 불려 바깥 표면(탭 배지·컴포저 칩)이
 * 같은 데이터를 다시 읽게 한다.
 */
export function createPlanningListView(options: { readonly onChanged?: () => void } = {}): PlanningListView {
  const list = el("div", { class: "ai-planning-list", dataset: { testid: "ai-planning-list" } });
  const summary = el("p", { class: "ai-planning-summary", dataset: { testid: "ai-planning-summary" } });
  const draft = el("input", {
    class: "ai-studio-search-input ai-planning-input",
    attrs: {
      type: "text",
      placeholder: "이 맵에 보존할 기획 한 줄",
      "aria-label": "보존할 기획 항목 추가",
      maxlength: String(MAP_PLANNING_ITEM_TEXT_MAX),
      autocomplete: "off",
    },
    dataset: { testid: "ai-planning-input" },
  }) as HTMLInputElement;

  const commitDraft = (): void => {
    const mapId = currentPlanningMapId();
    if (!mapId) return;
    const text = draft.value;
    if (!text.trim()) return;
    addMapPlanningItem(mapId, text, { origin: "user" });
    draft.value = "";
    refresh();
  };

  const addButton = el("button", {
    class: "ai-studio-ghost-btn",
    text: "추가",
    attrs: { type: "button", title: "이 맵의 보존 기획에 추가합니다" },
    dataset: { testid: "ai-planning-add" },
    on: { click: () => commitDraft() },
  });
  draft.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitDraft();
  });

  // 도구 필터의 `is-deck`(168px 고정)를 보리지 않는다 — 기획 한 줄은 밑밑하게 길고,
  // 입력칸이 168px 로 브려지면 무엇을 적는 칸인지 자체가 쟘린다(verify-shots/oprn-019/01 초판).
  const composer = el("div", {
    class: "ai-planning-composer",
    children: [
      el("label", { class: "ai-studio-search is-planning", children: [renderEditorIcon("plus"), draft] }),
      addButton,
    ],
  });

  const root = el("section", {
    class: "ai-planning",
    dataset: { testid: "ai-planning" },
    attrs: { "aria-label": "보존 기획" },
    children: [
      el("header", {
        class: "ai-planning-head",
        children: [el("p", { class: "ai-studio-kicker", text: "보존 기획" }), summary],
      }),
      composer,
      list,
    ],
  });

  const renderRow = (mapId: MapId, item: MapPlanningItem): HTMLElement => {
    const text = el("input", {
      class: "ai-planning-text",
      attrs: {
        type: "text",
        "aria-label": "기획 항목 본문",
        maxlength: String(MAP_PLANNING_ITEM_TEXT_MAX),
      },
      value: item.text,
      dataset: { testid: `ai-planning-text-${item.id}` },
    }) as HTMLInputElement;
    const commitText = (): void => {
      if (text.value.trim() === item.text) return;
      updateMapPlanningItem(mapId, item.id, text.value);
      refresh();
    };
    text.addEventListener("change", commitText);
    text.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      commitText();
    });

    const retired = item.status === "retired";
    return el("div", {
      class: `ai-planning-item is-${item.status}`,
      dataset: { testid: "ai-planning-item", itemId: item.id, status: item.status, origin: item.origin },
      children: [
        text,
        el("span", {
          class: "ai-planning-origin",
          text: item.origin === "spec" ? "밑그림" : "직접",
          attrs: { title: item.origin === "spec" ? "조수 밑그림에서 담은 항목" : "사용자가 직접 적은 항목" },
        }),
        el("button", {
          class: "ai-studio-icon-btn",
          children: [renderEditorIcon(retired ? "undo" : "pause")],
          attrs: {
            type: "button",
            title: retired ? "다시 사용 후보로 되돌립니다" : "기록은 남기고 재사용 후보에서 뺍니다",
            "aria-label": retired ? "기획 항목 복귀" : "기획 항목 은퇴",
          },
          dataset: { testid: `ai-planning-retire-${item.id}` },
          on: {
            click: () => {
              setMapPlanningItemRetired(mapId, item.id, !retired);
              refresh();
            },
          },
        }),
        el("button", {
          class: "ai-studio-icon-btn is-danger",
          children: [renderEditorIcon("trash")],
          attrs: { type: "button", title: "이 항목을 지웁니다", "aria-label": "기획 항목 삭제" },
          dataset: { testid: `ai-planning-delete-${item.id}` },
          on: {
            click: () => {
              deleteMapPlanningItem(mapId, item.id);
              refresh();
            },
          },
        }),
      ],
    });
  };

  const refresh = (): void => {
    const mapId = currentPlanningMapId();
    const items = listMapPlanningItems(mapId);
    const active = items.filter((item) => item.status === "active").length;
    draft.disabled = mapId === null;
    (addButton as HTMLButtonElement).disabled = mapId === null;
    summary.textContent = mapId === null
      ? "맵을 열면 그 맵의 보존 기획을 볼 수 있습니다."
      : `${planningMapName(mapId)} · 사용 가능 ${active} / 전체 ${items.length}`;
    if (items.length === 0) {
      list.replaceChildren(el("p", {
        class: "ai-studio-empty-text",
        dataset: { testid: "ai-planning-empty" },
        text: "보존된 기획 항목이 없습니다. 여기 적어 두면 새 대화나 다음 작업에서도 남아 있습니다.",
      }));
    } else {
      list.replaceChildren(...items.map((item) => renderRow(mapId as MapId, item)));
    }
    options.onChanged?.();
  };

  refresh();
  return { root, refresh };
}
