// editor/panels/aiPlanningReuse.ts
// 컴포저의 「보존 기획 재사용」 팝오버. 다음 조수 작업이 이 맵의 보존 기획 항목을
// **없음 / 전체 / 선택** 중 무엇으로 참고할지 사용자가 고르고, 그 결과가 무슨 문장으로
// 실리는지 보내기 전에 그대로 본다.
//
// 세 계약:
//  1. 기본은 `none` 이다. 아무 것도 고르지 않으면 어떤 문장도 조수에게 가지 않는다.
//  2. 선택은 **맵 단위**다. 다른 맵으로 옮기면 선택이 초기화된다 — 한 맵의 기획이
//     다른 맵 작업에 조용히 실리면 안 된다.
//  3. 미리보기(`ai-planning-reuse-preview`)는 실제로 보낼 지침 블록 원문이다. 여기 보이는
//     것과 실려 나가는 것이 다르면 그것이 결함이다.

import { renderEditorIcon } from "@/editor/panels/eventEditor/editorIcons";
import { listMapPlanningItems } from "@/editor/mapPlanningActions";
import { currentPlanningMapId, planningMapName } from "@/editor/panels/aiPlanningList";
import type { MapId } from "@/project/types";
import {
  activePlanningItems,
  describePlanningReuse,
  formatPlanningReuseBlock,
  NO_PLANNING_REUSE,
  resolvePlanningReuse,
  type MapPlanningItem,
  type PlanningReuseChoice,
  type PlanningReuseMode,
} from "@/project/mapPlanningItems";
import { el } from "@/util/dom";

export interface PlanningReuseControl {
  /** 팝오버 내용 — 컴포저에 `planningContent` 로 넘긴다. */
  readonly content: HTMLElement;
  /** 컴포저 액션 행에 붙는 요약 칩. 선택이 없으면 스스로 숨는다. */
  readonly chip: HTMLElement;
  /** 현재 선택. 맵이 바뀌었으면 자동으로 `none` 으로 되돌아간 값이다. */
  readonly choice: () => PlanningReuseChoice;
  /** 이번 턴에 실제로 실릴 항목들(은퇴·삭제 반영 후). */
  readonly resolvedItems: () => MapPlanningItem[];
  /** 사용자 발화 뒤에 붙일 지침 블록. 선택이 없으면 빈 문자열. */
  readonly guidanceBlock: () => string;
  /** 화면·칩을 저장소 최신값으로 다시 읽는다(맵 전환·항목 편집 후). */
  readonly refresh: () => void;
  /** 전송 후 초기화 — 한 번 고른 재사용이 다음 턴에 조용히 또 실리지 않게 한다. */
  readonly reset: () => void;
}

const MODES: readonly { readonly id: PlanningReuseMode; readonly label: string; readonly hint: string }[] = [
  { id: "none", label: "사용 안 함", hint: "보존 기획을 이번 작업에 넣지 않습니다" },
  { id: "all", label: "전체 사용", hint: "사용 가능한 항목 전부를 지침으로 넣습니다" },
  { id: "selected", label: "선택 사용", hint: "고른 항목만 지침으로 넣습니다" },
];

export function createPlanningReuseControl(options: {
  /** 선택이 바뀌면 불린다 — 패널이 칩·placeholder 를 다시 그리는 자리. */
  readonly onChange?: () => void;
  /** 목록 화면을 여는 요청(스튜디오 「기획」 탭). 주지 않으면 버튼을 만들지 않는다. */
  readonly onOpenList?: () => void;
} = {}): PlanningReuseControl {
  let mode: PlanningReuseMode = "none";
  let selected = new Set<string>();
  let scopeMapId: MapId | null = currentPlanningMapId();

  const modeRow = el("div", {
    class: "ai-planning-reuse-modes",
    attrs: { role: "radiogroup", "aria-label": "보존 기획 재사용 범위" },
  });
  const itemList = el("div", { class: "ai-planning-reuse-items", dataset: { testid: "ai-planning-reuse-items" } });
  const preview = el("pre", {
    class: "ai-planning-reuse-preview",
    dataset: { testid: "ai-planning-reuse-preview" },
  });
  const effect = el("p", { class: "ai-planning-reuse-effect", dataset: { testid: "ai-planning-reuse-effect" } });
  const head = el("header", {
    class: "ai-planning-reuse-head",
    children: [
      el("p", { class: "ai-studio-kicker", text: "보존 기획 재사용" }),
      el("p", { class: "ai-planning-reuse-scope", dataset: { testid: "ai-planning-reuse-scope" } }),
    ],
  });

  const chipText = el("span", { dataset: { testid: "ai-planning-chip-text" } });
  const chip = el("span", {
    class: "ai-context-chip ai-planning-chip",
    dataset: { testid: "ai-planning-chip" },
    children: [
      chipText,
      el("button", {
        class: "ai-selection-chip-clear",
        children: [renderEditorIcon("close")],
        attrs: { type: "button", title: "보존 기획 재사용 해제", "aria-label": "보존 기획 재사용 해제" },
        dataset: { testid: "ai-planning-chip-clear" },
        on: {
          click: (event) => {
            event.preventDefault();
            event.stopPropagation();
            reset();
          },
        },
      }),
    ],
  });

  const items = (): MapPlanningItem[] => activePlanningItems(listMapPlanningItems(scopeMapId));

  const currentChoice = (): PlanningReuseChoice => {
    if (mode === "none") return NO_PLANNING_REUSE;
    return { mode, selectedIds: [...selected] };
  };

  const resolved = (): MapPlanningItem[] =>
    resolvePlanningReuse(listMapPlanningItems(scopeMapId), currentChoice());

  const renderPreview = (): void => {
    const chosen = resolved();
    const block = formatPlanningReuseBlock(chosen);
    preview.hidden = block === "";
    preview.textContent = block;
    effect.textContent = block === ""
      ? "이번 작업에 보존 기획을 넣지 않습니다. 조수는 지금 적는 요청만 봅니다."
      : `이번 작업에 항목 ${chosen.length}개가 지침으로 실립니다. 지침이며 차단 규칙이 아닙니다.`;
    const label = describePlanningReuse(chosen.length, chosen.length === 0 ? "none" : mode);
    chipText.textContent = label;
    chip.hidden = chosen.length === 0;
    chip.setAttribute("title", `${label} — 누르면 재사용 선택을 다시 엽니다`);
  };

  const render = (): void => {
    const available = items();
    head.querySelector<HTMLElement>("[data-testid=ai-planning-reuse-scope]")!.textContent =
      `${planningMapName(scopeMapId)} · 사용 가능 ${available.length}개`;
    modeRow.replaceChildren(...MODES.map((entry) => {
      const on = entry.id === mode;
      const disabled = entry.id !== "none" && available.length === 0;
      return el("button", {
        class: `ai-planning-reuse-mode${on ? " is-on" : ""}`,
        text: entry.label,
        attrs: {
          type: "button",
          role: "radio",
          "aria-checked": String(on),
          title: entry.hint,
          ...(disabled ? { disabled: "", "aria-disabled": "true" } : {}),
        },
        dataset: { testid: `ai-planning-reuse-mode-${entry.id}` },
        on: { click: () => setMode(entry.id) },
      });
    }));
    itemList.hidden = mode !== "selected";
    if (mode === "selected") {
      itemList.replaceChildren(...(available.length === 0
        ? [el("p", { class: "ai-studio-empty-text", text: "고를 수 있는 항목이 없습니다." })]
        : available.map((item) => {
          const box = el("input", {
            attrs: { type: "checkbox", ...(selected.has(item.id) ? { checked: "" } : {}) },
            dataset: { testid: `ai-planning-reuse-pick-${item.id}` },
          }) as HTMLInputElement;
          box.checked = selected.has(item.id);
          box.addEventListener("change", () => {
            if (box.checked) selected.add(item.id);
            else selected.delete(item.id);
            renderPreview();
            options.onChange?.();
          });
          return el("label", {
            class: "ai-planning-reuse-item",
            children: [box, el("span", { text: item.text })],
          });
        })));
    }
    renderPreview();
  };

  const setMode = (next: PlanningReuseMode): void => {
    if (mode === next) return;
    mode = next;
    // 「선택」으로 처음 들어가면 아무 것도 안 고른 상태가 곧 「사용 안 함」과 같은 결과다.
    // 사용자가 무엇을 고를지 스스로 결정해야 하므로 자동 전체 선택을 하지 않는다.
    if (next === "none") selected = new Set();
    render();
    options.onChange?.();
  };

  const reset = (): void => {
    mode = "none";
    selected = new Set();
    render();
    options.onChange?.();
  };

  const refresh = (): void => {
    const before = `${scopeMapId ?? ""}|${mode}|${[...selected].sort().join(",")}`;
    const nowMap = currentPlanningMapId();
    if (nowMap !== scopeMapId) {
      scopeMapId = nowMap;
      mode = "none";
      selected = new Set();
    } else {
      // 은퇴·삭제된 항목의 선택은 사라진다 — 조용한 부활 금지.
      const alive = new Set(items().map((item) => item.id));
      for (const id of [...selected]) if (!alive.has(id)) selected.delete(id);
      if (mode !== "none" && items().length === 0) mode = "none";
    }
    render();
    // 상태가 그대로면 바깥을 깨우지 않는다 — 저장소 구독이 매 번 칩을 다시 그리게 된다.
    if (`${scopeMapId ?? ""}|${mode}|${[...selected].sort().join(",")}` !== before) options.onChange?.();
  };

  const content = el("div", {
    class: "ai-planning-reuse",
    dataset: { testid: "ai-planning-reuse" },
    children: [
      head,
      modeRow,
      itemList,
      effect,
      preview,
      ...(options.onOpenList
        ? [el("button", {
            class: "ai-studio-ghost-btn",
            text: "기획 목록 편집",
            attrs: { type: "button", title: "이 맵의 보존 기획 목록을 봅니다" },
            dataset: { testid: "ai-planning-reuse-open-list" },
            on: { click: () => options.onOpenList?.() },
          })]
        : []),
    ],
  });

  render();
  return {
    content,
    chip,
    choice: currentChoice,
    resolvedItems: resolved,
    guidanceBlock: () => formatPlanningReuseBlock(resolved()),
    refresh,
    reset,
  };
}
