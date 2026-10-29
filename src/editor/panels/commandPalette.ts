// Ctrl+K 통합 커맨드 팔레트 — 에디터 명령 + 맵 이동 (스펙 §4 3-A).
// 조수 스킬 섹션은 스킬 기능 제거와 함께 사라졌다. 셸 클래스는 command-palette-* 로 자립한다
// (구 스킬 팔레트 클래스 ai-skill-palette-* 는 스타일 파일과 함께 삭제됨).
import { listEditorCommands, listMapCommands, matchEditorCommands, type EditorCommand } from "@/editor/commandRegistry";
import { openMapEventSearchModal } from "@/editor/panels/mapEventSearchModal";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { isImeCompositionEvent } from "@/player/keyBindings";
import { store } from "@/project/store";
import { el } from "@/util/dom";

/**
 * 팔레트 열기 요청 이벤트. 여는 주체는 AI 패널이다(수명주기가 단축키 등록을 소유한다) —
 * 탑바 칩처럼 밖에서 열고 싶을 때 이 이벤트를 쏜다.
 */
export const COMMAND_PALETTE_OPEN_EVENT = "oprn:open-command-palette";

/** 어디서든 커맨드 팔레트를 요청한다. 수신자(AI 패널)가 없으면 조용히 무시된다. */
export function requestCommandPalette(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT));
}

export interface PaletteEntry {
  readonly kind: "command" | "map" | "find";
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly hotkey?: string;
  readonly run: () => void;
}

const KIND_CAPS = { command: 6, map: 4 } as const;
const KIND_HEADERS: Record<PaletteEntry["kind"], string> = { command: "명령", map: "맵 이동", find: "프로젝트에서 찾기" };

export interface PaletteEntryDeps {
  readonly commands: readonly EditorCommand[];
  readonly maps: readonly EditorCommand[];
  /** 있으면 입력한 말로 맵·이벤트 찾기 창을 여는 항목을 덧붙인다. */
  readonly find?: (query: string) => void;
}

export function buildPaletteEntries(query: string, deps: PaletteEntryDeps): readonly PaletteEntry[] {
  const commandHits = matchEditorCommands(query, deps.commands).slice(0, KIND_CAPS.command);
  const mapHits = matchEditorCommands(query, deps.maps).slice(0, KIND_CAPS.map);
  return [
    ...commandHits.map((command): PaletteEntry => ({
      kind: "command", id: command.id, label: command.label, detail: command.category, hotkey: command.hotkey, run: command.run,
    })),
    ...mapHits.map((command): PaletteEntry => ({
      kind: "map", id: command.id, label: command.label, detail: "이동", run: command.run,
    })),
    // 맵·이벤트 찾기 창과 팔레트는 같은 낱말을 받는다 — 입력한 말로 찾기 창을 바로 연다(검색 입구 하나).
    ...(query.trim() && deps.find ? [{
      kind: "find" as const, id: "map-event-search", label: `「${query.trim()}」 맵·이벤트·스위치에서 찾기`, detail: "", run: () => deps.find?.(query.trim()),
    }] : []),
  ];
}

export function movePaletteIndex(length: number, index: number, delta: 1 | -1): number {
  if (length <= 0) return 0;
  return (index + delta + length) % length;
}

export type PaletteKeyAction = "up" | "down" | "run" | "ignore";

/**
 * 팔레트 입력칸의 키.
 * 한글·일본어·중국어 조합 중 Enter 와 화살표는 글자 확정이다 — 명령 실행·선택 이동으로 받으면
 * 마지막 음절이 잘리고, 고른 명령이 바로 실행된 뒤 팔레트가 닫힌다.
 */
export function paletteKeyAction(event: { readonly key: string; readonly isComposing?: boolean; readonly keyCode?: number }): PaletteKeyAction {
  if (isImeCompositionEvent(event)) return "ignore";
  if (event.key === "ArrowDown") return "down";
  if (event.key === "ArrowUp") return "up";
  if (event.key === "Enter") return "run";
  return "ignore";
}

function paletteOptionId(index: number): string {
  return `command-palette-option-${index}`;
}

export function openCommandPalette(): HTMLElement {
  document.querySelector("[data-testid='command-palette']")?.remove();
  // 닫으면 연 자리로 초점을 돌려준다(본문 <body> 였으면 그대로 둔다).
  const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
  const listHost = el("div", {
    class: "command-palette-list",
    attrs: { id: "command-palette-list", role: "listbox", "aria-label": "명령과 맵" },
  });
  const search = el("input", {
    class: "command-palette-input",
    attrs: {
      type: "text",
      role: "combobox",
      placeholder: "명령·맵 검색",
      autocomplete: "off",
      "aria-autocomplete": "list",
      "aria-expanded": "true",
      "aria-controls": "command-palette-list",
      "aria-label": "명령 또는 맵",
      "aria-describedby": "command-palette-hint",
    },
    dataset: { testid: "command-palette-search" },
  }) as HTMLInputElement;
  // 사용법은 자리표시에만 있으면 한 글자 치는 순간 사라진다 — 바닥 줄에 늘 두고, 결과 수는 상태로 알린다.
  const resultCount = el("span", {
    class: "command-palette-count",
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "command-palette-count" },
  });
  const footer = el("div", {
    class: "command-palette-footer",
    children: [
      el("span", { class: "command-palette-hint", text: "↑↓ 이동 · Enter 실행 · Esc 닫기", attrs: { id: "command-palette-hint" } }),
      resultCount,
    ],
  });

  const backdrop = el("div", {
    class: "command-palette-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "command-palette" },
    children: [
      el("section", {
        class: "command-palette-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "명령 팔레트" },
        children: [search, listHost, footer],
      }),
    ],
  });

  let entries: readonly PaletteEntry[] = [];
  let activeIndex = 0;
  const close = (): void => {
    unregisterModal(backdrop);
    backdrop.remove();
    if (opener?.isConnected) opener.focus();
  };
  const runEntry = (entry: PaletteEntry): void => {
    close();
    entry.run();
  };

  const refresh = (): void => {
    entries = buildPaletteEntries(search.value, {
      commands: listEditorCommands(),
      maps: listMapCommands(store.getCurrent()),
      find: (query) => openMapEventSearchModal({ initialQuery: query }),
    });
    const hits = entries.filter((entry) => entry.kind !== "find").length;
    resultCount.textContent = search.value.trim() ? `결과 ${hits}개` : `명령 ${hits}개`;
    activeIndex = Math.min(activeIndex, Math.max(0, entries.length - 1));
    const nodes: HTMLElement[] = [];
    let lastKind: PaletteEntry["kind"] | null = null;
    entries.forEach((entry, index) => {
      if (entry.kind !== lastKind) {
        lastKind = entry.kind;
        nodes.push(el("div", { class: "command-palette-group", text: KIND_HEADERS[entry.kind], attrs: { role: "presentation" } }));
      }
      nodes.push(
        el("button", {
          class: `command-palette-item${index === activeIndex ? " is-active" : ""}`,
          attrs: {
            type: "button",
            id: paletteOptionId(index),
            role: "option",
            "aria-selected": String(index === activeIndex),
          },
          dataset: { testid: `command-palette-item-${entry.kind}-${entry.id}` },
          // 행마다 붙던 분류 꼬리(「화면」「이동」)는 그룹 제목과 같은 말이라 뺐다. 단축키만 오른쪽에 둔다.
          children: [
            el("span", { class: "command-palette-item-name", text: entry.label }),
            ...(entry.hotkey ? [el("kbd", { class: "command-palette-hotkey", text: entry.hotkey, attrs: { translate: "no" } })] : []),
          ],
          on: {
            click: () => runEntry(entry),
            // hover 가 Enter 대상을 옮긴다 — 키보드 선택과 hover 가 따로 강조돼 대상이 모호했다.
            // 목록을 다시 그리면 hover 가 끊기므로 클래스만 옮긴다.
            mousemove: () => {
              if (index === activeIndex) return;
              activeIndex = index;
              listHost.querySelectorAll(".command-palette-item").forEach((node, nodeIndex) => {
                node.classList.toggle("is-active", nodeIndex === index);
                node.setAttribute("aria-selected", String(nodeIndex === index));
              });
              search.setAttribute("aria-activedescendant", paletteOptionId(index));
            },
          },
        }),
      );
    });
    if (entries.length === 0) nodes.push(el("div", { class: "command-palette-empty", text: "일치하는 항목이 없습니다" }));
    listHost.replaceChildren(...nodes);
    const active = entries[activeIndex];
    if (!active) {
      search.removeAttribute("aria-activedescendant");
      return;
    }
    search.setAttribute("aria-activedescendant", paletteOptionId(activeIndex));
    const activeNode = listHost.querySelector<HTMLElement>(`#${paletteOptionId(activeIndex)}`);
    if (activeNode && typeof activeNode.scrollIntoView === "function") {
      activeNode.scrollIntoView({ block: "nearest" });
    }
  };

  search.addEventListener("input", () => { activeIndex = 0; refresh(); });
  search.addEventListener("keydown", (event) => {
    // Escape 는 공용 모달 스택이 라우팅한다(아래 registerModal). 조합 중 키는 입력기 것이다.
    const action = paletteKeyAction(event);
    if (action === "ignore") return;
    event.preventDefault();
    if (action === "down" || action === "up") {
      activeIndex = movePaletteIndex(entries.length, activeIndex, action === "down" ? 1 : -1);
      refresh();
      return;
    }
    const entry = entries[activeIndex];
    if (entry) runEntry(entry);
  });
  // aria-modal 이므로 Tab 이 배경(톱바 메뉴·자료집 단추 등)으로 나가지 않게 입력칸으로 되돌린다.
  // 초점이 항목 버튼에 있어도 백드롭에서 받는다.
  backdrop.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    search.focus();
  });
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });

  refresh();
  document.body.append(backdrop);
  registerModal(backdrop, close);
  search.focus();
  return backdrop;
}
