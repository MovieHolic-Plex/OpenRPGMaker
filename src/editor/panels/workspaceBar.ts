// editor/panels/workspaceBar.ts
// 톱바의 「보기 ▾」 메뉴 — 패널 표시와 언어.
//
// 2026-09-03 개편 전 이 파일은 셋을 그렸다: 저작 작업 칩 4개(맵/이벤트/데이터/테스트), ▤ 메뉴
// (패널·밀도·편집 모드), Ctrl K 칩. 칩 4개는 사이드바 레이어 전환·자료집 버튼·▶ 테스트의 두 번째
// 자리였고, 메뉴의 「밀도(안내/보통/촘촘)」는 「편집 모드(초보/표준/전문가)」와 **같은 축**을
// 다른 이름으로 한 번 더 내놓은 것이었다(`setWorkspaceDensity` → `setEditorUiMode`). 셋 다 걷었다.
// 남은 것은 이 메뉴 하나이고, Ctrl K 칩은 톱바 가운데(menu.ts renderCommandCenter)로 갔다.
//
// 패널 메뉴가 도킹 컨트롤을 담는 이유: 좌패널의 세로 공간은 이 제품에서 가장 비싼 자원이다
// (팔레트가 접힘선 밑으로 밀린 사고가 3번 있었다). 패널마다 제목줄을 얹으면 28px 씩 먹으므로,
// 옮기기·닫기는 톱바 메뉴에서 처리한다.
//
// 소유권 — 한 명령의 집은 하나다. 두 번째 표면은 첫 번째가 그 모드에서 렌더되지 않을 때만 둔다.
//  • 왼쪽 패널 전환은 활동 막대(aiSidebarWorkspace.ts)가 소유한다. 이 메뉴의 「패널」 절은 그 막대의
//    단추를 그대로 비춘다 — 체크 = 지금 펼쳐져 보이는 패널, 누르면 막대 단추를 누른 것과 같다.
//    예전 절은 도크 멤버십(타일·맵)을 토글했는데, 타일은 작업 호스트라 늘 다시 붙고 맵은 막대로
//    옮겨 가 도크에 안 붙어서 체크를 꺼도 화면이 그대로였고, 접힌 도크도 「열림」으로 보였다
//    (2026-10-21 UI 감사 02-leftdock-02·03·09).
// 초보/표준/전문가 편집 모드 라디오는 2026-09-27 에 모드와 함께 없앴다 — 편집기 화면은 하나다.

import { makeSvgIcon } from "@/editor/panels/tileToolbarIcons";
import { uiLabel } from "@/editor/uiCopy";
import { el } from "@/util/dom";
import { getLocale, LOCALE_NATIVE_NAMES, setLocale, SUPPORTED_LOCALES, sourceAttributeOf } from "@/i18n";

/**
 * 「보기 ▾」 버튼과 그 메뉴. `.oprn-menu-popup` 이 형제 기준으로 위치를 잡으므로 감싸면 CSS 를
 * 함께 고쳐야 한다.
 */
export function renderWorkspaceBar(): readonly [HTMLElement, HTMLElement] {
  return renderPanelsMenu();
}

function renderPanelsMenu(): readonly [HTMLElement, HTMLElement] {
  const menuName = "보기 — 패널과 언어";
  const menu = el("div", {
    class: "oprn-menu-popup workspace-panels-menu",
    attrs: { role: "menu", "aria-label": menuName },
    dataset: { testid: "workspace-panels-menu" },
  });
  menu.hidden = true;
  // 글리프 + 글자 라벨. 「▤」 하나만 있던 2026-08-26~09-03 사이에는 이 메뉴가 장식으로 읽혔다 —
  // 실제로 사용자가 "진입점이 없다"고 했다. 화면 글자는 uiCopy 정본에서 가져온다.
  const button = el("button", {
    class: "oprn-menu-item workspace-panels-button",
    attrs: {
      type: "button",
      title: menuName,
      "aria-label": menuName,
      "aria-expanded": "false",
      "aria-haspopup": "menu",
    },
    dataset: { testid: "workspace-panels-button" },
    children: [
      el("span", { class: "workspace-panels-icon", attrs: { "aria-hidden": "true" }, children: [makeSvgIcon("panels")] }),
      el("span", { class: "workspace-panels-label", text: uiLabel("viewMenu") }),
      el("span", { class: "oprn-menu-item-chevron", attrs: { "aria-hidden": "true" }, children: [makeSvgIcon("chevronDown")] }),
    ],
  });
  // `.oprn-menu-popup` 은 `position: fixed` + `display: none` 이고 `.open` 이 붙어야 보인다.
  // hidden 만 바꾸면 열리지 않는다(구 standard-more-tools 가 그 상태였다).
  const close = (): void => {
    button.setAttribute("aria-expanded", "false");
    menu.hidden = true;
    menu.classList.remove("open");
    document.removeEventListener("pointerdown", onOutsidePointerDown, true);
    document.removeEventListener("keydown", onEscapeKey, true);
  };
  // Esc 로 닫고 포커스를 「보기」 버튼으로 돌린다 — 바깥 클릭만 닫히면 키보드 사용자가 갇힌다.
  const onEscapeKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    close();
    button.focus?.();
  };
  const onOutsidePointerDown = (event: Event): void => {
    const target = event.target;
    if (target instanceof Node && (menu.contains(target) || button.contains(target))) return;
    close();
  };
  const open = (): void => {
    button.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    menu.classList.add("open");
    // 메뉴는 톱바가 그릴 때 한 번만 만들어진다. 언어·패널 구성을 바꿔도 톱바는 다시 그려지지 않으므로
    // 열 때마다 현재 상태로 체크/라디오를 맞춘다.
    syncPanelItems(menu, localeHeading, close);
    syncLocaleItems(menu);
    const rect = button.getBoundingClientRect?.();
    if (rect) {
      // 오른쪽 묶음에 있으므로 버튼 왼쪽에 맞추되 화면 오른쪽 여백 12px 안으로 당긴다 — 폭은 열어 놓고
      // 실측한다(min-width 만 믿으면 패딩·테두리만큼 화면 끝에 붙는다).
      const width = menu.getBoundingClientRect?.().width || 288;
      const viewport = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : rect.right;
      menu.style.left = `${Math.round(Math.max(12, Math.min(rect.left, viewport - width - 12)))}px`;
      menu.style.top = `${Math.round(rect.bottom + 4)}px`;
    }
    document.addEventListener("pointerdown", onOutsidePointerDown, true);
    document.addEventListener("keydown", onEscapeKey, true);
  };
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (button.getAttribute("aria-expanded") === "true") close();
    else open();
  });

  menu.append(el("div", { class: "workspace-menu-group", text: "패널" }));
  // 언어 항목은 예전 편집 모드 라디오의 모양(workspace-ui-mode-*)을 그대로 빌려 쓴다.
  const localeHeading = el("div", { class: "workspace-menu-group", text: "언어" });
  menu.append(localeHeading);
  for (const locale of SUPPORTED_LOCALES) {
    const active = getLocale() === locale;
    // 언어 이름은 그 언어로 쓴다 — 못 읽는 언어로 바뀐 화면에서도 자기 언어를 찾을 수 있어야 한다.
    menu.append(
      el("button", {
        class: `oprn-menu-command workspace-ui-mode-item workspace-locale-item${active ? " is-active" : ""}`,
        attrs: { type: "button", role: "menuitemradio", "aria-checked": active ? "true" : "false", lang: locale, translate: "no" },
        dataset: { testid: `workspace-locale-${locale}`, locale },
        children: [
          el("span", { class: "workspace-ui-mode-radio", attrs: { "aria-hidden": "true" } }),
          el("span", { class: "workspace-ui-mode-text", children: [el("span", { class: "workspace-ui-mode-label", text: LOCALE_NATIVE_NAMES[locale] })] }),
        ],
        on: {
          click: (event) => {
            event.stopPropagation();
            close();
            void setLocale(locale);
          },
        },
      }),
    );
  }
  return [button, menu];
}

function syncLocaleItems(menu: HTMLElement): void {
  const current = getLocale();
  menu.querySelectorAll<HTMLElement>(".workspace-locale-item").forEach((item) => {
    const active = item.dataset.locale === current;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-checked", active ? "true" : "false");
  });
}
/** 왼쪽 활동 막대의 패널 단추들. 「검사」는 패널이 아니라 명령이라 aria-pressed 가 없어 빠진다. */
function leftActivityPaneButtons(): HTMLElement[] {
  const bar = document.querySelector<HTMLElement>('[data-testid="left-activity-bar"]');
  if (!bar) return [];
  return Array.from(bar.querySelectorAll<HTMLElement>(".left-activity-item"))
    .filter((button) => button.getAttribute("aria-pressed") !== null);
}

/** 메뉴를 열 때마다 막대의 지금 상태로 다시 그린다 — 접힌 도크면 체크가 하나도 없다. */
function syncPanelItems(menu: HTMLElement, localeHeading: HTMLElement, close: () => void): void {
  menu.querySelectorAll(".workspace-panel-row").forEach((row) => row.remove());
  for (const paneButton of leftActivityPaneButtons()) menu.insertBefore(renderPanelItem(paneButton, close), localeHeading);
}

function renderPanelItem(paneButton: HTMLElement, close: () => void): HTMLElement {
  const open = paneButton.getAttribute("aria-pressed") === "true";
  // 막대 단추의 이름은 DOM 번역이 바꿔 놓는다 — 원문을 읽어 이 메뉴도 같은 번역을 거치게 한다.
  const title = sourceAttributeOf(paneButton, "aria-label") ?? paneButton.getAttribute("aria-label") ?? "";
  const pane = (paneButton.dataset.testid ?? "").replace(/^sidebar-/, "");
  const toggle = el("button", {
    class: `oprn-menu-command workspace-panel-toggle${open ? " is-active" : ""}`,
    attrs: {
      type: "button",
      role: "menuitemcheckbox",
      "aria-checked": open ? "true" : "false",
      title: open ? `${title} 패널 닫기` : `${title} 패널 열기`,
    },
    dataset: { testid: `workspace-panel-toggle-${pane}` },
    children: [
      el("span", { class: "workspace-panel-check", attrs: { "aria-hidden": "true" }, children: open ? [makeSvgIcon("check")] : [] }),
      el("span", { class: "workspace-panel-title", text: title }),
    ],
    on: {
      click: (event) => {
        event.stopPropagation();
        close();
        paneButton.click();
      },
    },
  });
  return el("div", { class: "workspace-panel-row", dataset: { testid: `workspace-panel-row-${pane}` }, children: [toggle] });
}
