// player/nameEntry/nameEntryOverlay.ts
// RM2K3 스타일 이름 입력 오버레이(DOM). 현재 이름 표시줄 + 문자표 그리드 + 페이지 탭 +
// 지우기/확정 버튼으로 구성된다. 키보드 직접 타이핑(한글 IME 포함)과 그리드 클릭/방향키 탐색을 병행한다.
// Promise<string> 을 반환하며, 확정 시 최종 이름을 resolve 한다.

import { isImeCompositionEvent } from "@/player/keyBindings";
import { clearChildren, el } from "@/util/dom";
import { applyCharsetFrameCrop, charsetFrameCropPosition } from "@/assets/charsetFrameCrop";
import type { NameEntryShowcaseHero } from "@/player/nameEntry/nameEntryShowcase";
import { getPlayerPreferences } from "@/player/playerPreferences";
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
  /** 제목 대신 보일 안내(자유 텍스트 입력). 생략 = "이름 입력". */
  readonly prompt?: string;
  /** 있으면 별빛 쇼케이스 연출(enterHeroName presentation:"showcase"). hero 가 null 이면 주인공 그림 없이. */
  readonly showcase?: { readonly hero: NameEntryShowcaseHero | null };
}

const SHOWCASE_SCALE = 3;
const SHOWCASE_TURN_MS = 520;
const SHOWCASE_CONFIRM_MS = 720;
const SHOWCASE_DIRECTIONS = ["down", "left", "up", "right"] as const;
const NAME_ENTRY_TITLE_ID = "runtime-name-entry-title";

/** 운영체제 「움직임 줄이기」 또는 플레이어 「메뉴 움직임 줄이기」. */
function nameEntryReducedMotion(): boolean {
  return getPlayerPreferences().reduceMenuMotion
    || (typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

/** 문자표의 공백은 ␣ 로 그린다. 그 기호는 글자가 아니라서 읽어 줄 말을 따로 둔다. */
function spokenGridChar(char: string): string {
  return char === " " ? "공백" : char;
}

/** 쇼케이스 무대: 별빛 배경 + 사방으로 도는 주인공(걷는 발) + 확정 반짝이. 정리 함수를 돌려준다. */
function mountShowcaseStage(overlay: HTMLElement, hero: NameEntryShowcaseHero | null, reduced: boolean): () => void {
  const stage = el("div", { class: "name-entry-showcase-stage", dataset: { testid: "runtime-name-entry-showcase" } });
  stage.append(el("div", { class: "name-entry-showcase-stars" }), el("div", { class: "name-entry-showcase-ring" }));
  let timer: ReturnType<typeof setInterval> | undefined;
  if (hero) {
    const sprite = el("span", { class: "name-entry-showcase-hero", attrs: { role: "img", "aria-hidden": "true" } });
    applyCharsetFrameCrop(sprite, hero.spriteUrl, { characterIndex: hero.characterIndex, direction: "down", pattern: 1 }, SHOWCASE_SCALE);
    stage.append(sprite);
    let tick = 0;
    if (!reduced) {
      timer = setInterval(() => {
        tick += 1;
        const direction = SHOWCASE_DIRECTIONS[Math.floor(tick / 4) % SHOWCASE_DIRECTIONS.length]!;
        const pattern = [0, 1, 2, 1][tick % 4]!;
        sprite.style.backgroundPosition = charsetFrameCropPosition({ characterIndex: hero.characterIndex, direction, pattern }, SHOWCASE_SCALE);
      }, SHOWCASE_TURN_MS / 4);
    }
  }
  stage.append(el("div", { class: "name-entry-showcase-burst" }));
  overlay.prepend(stage);
  return () => { if (timer !== undefined) clearInterval(timer); };
}

// 공백/특수 문자를 그리드 셀에 알아보기 쉽게 표기한다.
function cellLabel(char: string): string {
  if (char === " ") return "␣";
  return char;
}

export function showNameEntry(host: HTMLElement, request: NameEntryRequest): Promise<string> {
  return new Promise<string>((resolve) => {
    const maxLength = clampMaxLength(request.maxLength);
    const titleText = request.prompt?.trim() || "이름 입력";
    const reduced = nameEntryReducedMotion();
    let value = request.showInitialName ? clampName(request.currentName, maxLength) : "";
    let pageId: NameEntryPageId = "hangul";
    let cursor: GridCursor = { row: 0, col: 0 };

    const overlay = el("div", {
      class: `name-entry-overlay${request.showcase ? " name-entry-showcase" : ""}`,
      dataset: {
        testid: "runtime-name-entry",
        ...(reduced ? { reducedMotion: "true" } : {}),
      },
      attrs: {
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": NAME_ENTRY_TITLE_ID,
      },
    });
    let stopShowcase: () => void = () => {};
    let finishing = false;
    // Chromium 은 음절을 확정하는 Enter(keyCode 229) 뒤에 isComposing 이 꺼진 Enter 를 한 번 더 보낸다.
    // 그 메아리가 이름을 확정해 버렸다.
    let imeCommitEnter = false;

    const nameBar = el("div", {
      class: "name-entry-bar",
      dataset: { testid: "runtime-name-entry-value" },
    });

    // 직접 타이핑 + 한글 IME 조합용 입력. 화면에서는 숨기고 항상 포커스를 유지한다.
    const typingInput = el("input", {
      class: "name-entry-typing",
      attrs: { type: "text", autocomplete: "off", "aria-label": titleText, maxlength: String(maxLength) },
      dataset: { testid: "runtime-name-entry-input" },
    }) as HTMLInputElement;
    typingInput.value = value;

    const gridEl = el("div", {
      class: "name-entry-grid",
      dataset: { testid: "runtime-name-entry-grid" },
      attrs: { role: "group" },
    });
    const tabsEl = el("div", { class: "name-entry-tabs", attrs: { role: "tablist", "aria-label": "문자 종류" } });
    const announcement = el("div", {
      class: "name-entry-announcement",
      dataset: { testid: "runtime-name-entry-announcement" },
      attrs: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
    });
    const announce = (text: string): void => {
      announcement.textContent = text;
    };

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
      gridEl.setAttribute("aria-label", `문자표 ${page.label}`);
      page.rows.forEach((row, rowIndex) => {
        const rowEl = el("div", { class: "name-entry-row" });
        row.forEach((char, colIndex) => {
          const selected = rowIndex === cursor.row && colIndex === cursor.col;
          const button = el("button", {
            class: `name-entry-key${selected ? " selected" : ""}`,
            text: cellLabel(char),
            attrs: {
              type: "button",
              ...(selected ? { "aria-current": "true" } : {}),
              ...(char === " " ? { "aria-label": "공백" } : {}),
            },
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
          if (selected) keys[flatIndex]?.setAttribute("aria-current", "true");
          else keys[flatIndex]?.removeAttribute("aria-current");
          // 문자표가 스크롤되므로 방향키로 고른 칸이 늘 보이게 한다.
          if (selected) keys[flatIndex]?.scrollIntoView?.({ block: "nearest" });
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
      const page = pageById(pageId);
      announce(`${page.label}, ${spokenGridChar(charAt(page, cursor))}`);
    };

    const focusInput = (): void => {
      // 브라우저가 준비된 후 포커스(IME 조합 유지).
      typingInput.focus();
    };

    const finish = (): void => {
      if (finishing) return;
      finishing = true;
      document.removeEventListener("keydown", onKey, true);
      // 빈 이름이면 기존 이름을 유지한다(RM2K3 동작).
      const result = clampName(value.trim().length > 0 ? value : request.currentName, maxLength);
      const close = (): void => {
        stopShowcase();
        overlay.remove();
        resolve(result);
      };
      if (!request.showcase || nameEntryReducedMotion()) { close(); return; }
      // 쇼케이스: 확정한 이름을 크게 보이고 반짝이 폭발 뒤 닫는다.
      syncValue(result);
      overlay.classList.add("confirmed");
      setTimeout(close, SHOWCASE_CONFIRM_MS);
    };

    const onKey = (event: KeyboardEvent): void => {
      // IME 조합(isComposing 이 꺼진 keyCode 229 / Process 포함)은 글자만 받는다.
      if (isImeCompositionEvent(event)) {
        if (event.key === "Enter" || event.code === "Enter" || event.code === "NumpadEnter") imeCommitEnter = true;
        return;
      }
      if (event.key === "Enter" && imeCommitEnter) {
        imeCommitEnter = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      imeCommitEnter = false;
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
          announce(spokenGridChar(charAt(pageById(pageId), cursor)));
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
      announcement,
      el("div", {
        class: "name-entry-title",
        text: titleText,
        attrs: { id: NAME_ENTRY_TITLE_ID },
        dataset: { testid: "runtime-name-entry-title" },
      }),
      nameBar,
      typingInput,
      tabsEl,
      gridEl,
      controls
    );
    if (request.showcase) stopShowcase = mountShowcaseStage(overlay, request.showcase.hero, reduced);
    host.append(overlay);
    document.addEventListener("keydown", onKey, true);
    focusInput();
  });
}
