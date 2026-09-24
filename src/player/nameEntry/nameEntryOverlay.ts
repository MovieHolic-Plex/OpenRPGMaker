// player/nameEntry/nameEntryOverlay.ts
// RM2K3 스타일 이름 입력 오버레이(DOM). 현재 이름 표시줄 + 문자표 그리드 + 페이지 탭 +
// 지우기/확정 버튼으로 구성된다. 키보드 직접 타이핑(한글 IME 포함)과 그리드 클릭/방향키 탐색을 병행한다.
// Promise<string> 을 반환하며, 확정 시 최종 이름을 resolve 한다.

import { clearChildren, el } from "@/util/dom";
import {
  appendChar,
  charAt,
  clampMaxLength,
  clampName,
  deleteLastChar,
  moveCursor,
  NAME_ENTRY_PAGES,
  pageById,
  type GridCursor,
  type NameEntryPageId,
} from "@/player/nameEntry/hangulTable";

export interface NameEntryRequest {
  readonly currentName: string;
  readonly maxLength: number;
  // 초기 이름 표시 여부. true 면 현재 이름을 입력란에 미리 채운다.
  readonly showInitialName: boolean;
}

// 공백/특수 문자를 그리드 셀에 알아보기 쉽게 표기한다.
function cellLabel(char: string): string {
  if (char === " ") return "␣";
  return char;
}

export function showNameEntry(host: HTMLElement, request: NameEntryRequest): Promise<string> {
  return new Promise<string>((resolve) => {
    const maxLength = clampMaxLength(request.maxLength);
    let value = request.showInitialName ? clampName(request.currentName, maxLength) : "";
    let pageId: NameEntryPageId = "hangul";
    let cursor: GridCursor = { row: 0, col: 0 };

    const overlay = el("div", {
      class: "name-entry-overlay",
      dataset: { testid: "runtime-name-entry" },
    });

    const nameBar = el("div", {
      class: "name-entry-bar",
      dataset: { testid: "runtime-name-entry-value" },
    });

    // 직접 타이핑 + 한글 IME 조합용 입력. 화면에서는 숨기고 항상 포커스를 유지한다.
    const typingInput = el("input", {
      class: "name-entry-typing",
      attrs: { type: "text", autocomplete: "off", "aria-label": "이름 입력", maxlength: String(maxLength) },
      dataset: { testid: "runtime-name-entry-input" },
    }) as HTMLInputElement;
    typingInput.value = value;

    const gridEl = el("div", { class: "name-entry-grid", dataset: { testid: "runtime-name-entry-grid" } });
    const tabsEl = el("div", { class: "name-entry-tabs", attrs: { role: "tablist" } });

    const renderNameBar = (): void => {
      clearChildren(nameBar);
      const chars = Array.from(value);
      for (let index = 0; index < maxLength; index += 1) {
        nameBar.append(
          el("span", {
            class: `name-entry-cell${index < chars.length ? " filled" : ""}`,
            text: chars[index] ?? "",
          })
        );
      }
    };

    const renderGrid = (): void => {
      clearChildren(gridEl);
      const page = pageById(pageId);
      page.rows.forEach((row, rowIndex) => {
        const rowEl = el("div", { class: "name-entry-row" });
        row.forEach((char, colIndex) => {
          const selected = rowIndex === cursor.row && colIndex === cursor.col;
          const button = el("button", {
            class: `name-entry-key${selected ? " selected" : ""}`,
            text: cellLabel(char),
            attrs: { type: "button" },
          }) as HTMLButtonElement;
          button.addEventListener("mouseenter", () => {
            cursor = { row: rowIndex, col: colIndex };
            highlight();
          });
          button.addEventListener("click", () => {
            insertChar(char);
          });
          rowEl.append(button);
        });
        gridEl.append(rowEl);
      });
    };

    const highlight = (): void => {
      const keys = gridEl.querySelectorAll<HTMLButtonElement>(".name-entry-key");
      const page = pageById(pageId);
      let flatIndex = 0;
      for (let rowIndex = 0; rowIndex < page.rows.length; rowIndex += 1) {
        for (let colIndex = 0; colIndex < page.rows[rowIndex].length; colIndex += 1) {
          const selected = rowIndex === cursor.row && colIndex === cursor.col;
          keys[flatIndex]?.classList.toggle("selected", selected);
          flatIndex += 1;
        }
      }
    };

    const renderTabs = (): void => {
      clearChildren(tabsEl);
      for (const page of NAME_ENTRY_PAGES) {
        tabsEl.append(
          el("button", {
            class: `name-entry-tab${page.id === pageId ? " active" : ""}`,
            text: page.label,
            attrs: { type: "button", role: "tab", "aria-selected": page.id === pageId ? "true" : "false" },
            dataset: { testid: `runtime-name-entry-tab-${page.id}` },
            on: {
              click: () => {
                switchPage(page.id);
              },
            },
          })
        );
      }
    };

    const syncValue = (next: string): void => {
      value = clampName(next, maxLength);
      if (typingInput.value !== value) typingInput.value = value;
      renderNameBar();
    };

    const insertChar = (char: string): void => {
      syncValue(appendChar(value, char, maxLength));
      focusInput();
    };

    const switchPage = (next: NameEntryPageId): void => {
      pageId = next;
      cursor = { row: 0, col: 0 };
      renderTabs();
      renderGrid();
    };

    const focusInput = (): void => {
      // 브라우저가 준비된 후 포커스(IME 조합 유지).
      typingInput.focus();
    };

    const finish = (): void => {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      // 빈 이름이면 기존 이름을 유지한다(RM2K3 동작).
      const result = value.trim().length > 0 ? value : request.currentName;
      resolve(clampName(result, maxLength));
    };

    const onKey = (event: KeyboardEvent): void => {
      // IME 조합 중에는 그리드 단축키를 가로채지 않는다.
      if (event.isComposing) return;
      switch (event.key) {
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          event.preventDefault();
          const direction =
            event.key === "ArrowUp" ? "up" : event.key === "ArrowDown" ? "down" : event.key === "ArrowLeft" ? "left" : "right";
          cursor = moveCursor(pageById(pageId), cursor, direction);
          overlay.classList.add("grid-active");
          highlight();
          return;
        }
        case "Enter": {
          event.preventDefault();
          if (overlay.classList.contains("grid-active")) {
            insertChar(charAt(pageById(pageId), cursor));
          } else {
            finish();
          }
          return;
        }
        case "Escape": {
          // 그리드에서 방향키를 쓴 뒤에는 Enter 가 글자 입력이라, 마우스가 막힌 키보드 전용 플레이에서
          // 확정할 길이 「글자 입력 → 지우기 → Enter」뿐이었다. Esc 로 그리드를 나오면 Enter 가 확정이다.
          if (!overlay.classList.contains("grid-active")) return;
          event.preventDefault();
          event.stopPropagation();
          overlay.classList.remove("grid-active");
          highlight();
          focusInput();
          return;
        }
        case "Tab": {
          event.preventDefault();
          const nextIndex = (NAME_ENTRY_PAGES.findIndex((page) => page.id === pageId) + 1) % NAME_ENTRY_PAGES.length;
          switchPage(NAME_ENTRY_PAGES[nextIndex].id);
          return;
        }
        default:
          // 직접 타이핑(문자/백스페이스)은 input 이 처리하므로 그리드 모드를 해제한다.
          if (event.key.length === 1 || event.key === "Backspace") {
            overlay.classList.remove("grid-active");
          }
          return;
      }
    };

    typingInput.addEventListener("input", () => {
      overlay.classList.remove("grid-active");
      syncValue(typingInput.value);
    });

    const controls = el("div", { class: "name-entry-controls" });
    controls.append(
      el("button", {
        class: "name-entry-action delete",
        text: "지우기",
        attrs: { type: "button" },
        dataset: { testid: "runtime-name-entry-delete" },
        on: {
          click: () => {
            syncValue(deleteLastChar(value));
            focusInput();
          },
        },
      }),
      el("button", {
        class: "name-entry-action confirm",
        text: "확정",
        attrs: { type: "button" },
        dataset: { testid: "runtime-name-entry-confirm" },
        on: { click: () => finish() },
      })
    );

    renderTabs();
    renderGrid();
    renderNameBar();

    overlay.append(
      el("div", { class: "name-entry-title", text: "이름 입력" }),
      nameBar,
      typingInput,
      tabsEl,
      gridEl,
      controls
    );
    host.append(overlay);
    document.addEventListener("keydown", onKey, true);
    focusInput();
  });
}
