// editor/panels/workspaceBar.ts
// 톱바의 「보기 ▾」 메뉴 — 패널 표시와 편집 모드(초보/표준/전문가).
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
//  • 패널 도크 멤버십(타일·맵) = 초보에서는 제공하지 않는다. 타일은 아이콘 레일의 고정 호스트이고
//    맵 도크는 `mapTree=false`라 렌더되지 않는다. 초보의 `basic-rail-toggle-*`는 멤버십을 바꾸는
//    컨트롤이 아니라 별도 플라이아웃을 여닫는다. 표준·전문가에서는 이 메뉴가 도크 토글을 소유한다.
//  • 편집 모드 = 이 메뉴가 유일한 화면 진입점이다(Ctrl+K 팔레트는 전체 검색이라 예외).

import { getEditorUiMode, setEditorUiMode, getEditorChrome, type EditorUiMode } from "@/editor/editorUiMode";
import { makeSvgIcon } from "@/editor/panels/tileToolbarIcons";
import { uiLabel } from "@/editor/uiCopy";
import { allPanels, type DockZone, type PanelId } from "@/editor/workspace/panelRegistry";
import { dockZoneHasHost } from "@/editor/workspace/leftDockPanels";
import { dockOf, type WorkspaceLayout } from "@/editor/workspace/workspaceLayout";
import { getWorkspaceLayout, moveWorkspacePanel, toggleWorkspacePanel } from "@/editor/workspace/workspaceStore";
import { el } from "@/util/dom";

const ZONE_LABEL: Record<DockZone, string> = { left: "왼쪽", right: "오른쪽", bottom: "아래" };

// 편집 모드는 2026-08-26 에 이 메뉴로 이사했다. 전에는 standard 전용 ⋯ 메뉴에만 있었고,
// 그 메뉴는 `.open` 클래스를 붙이지 않아 실제로는 열리지 않았다 — 초보 모드 사용자는 Ctrl+K 없이
// 모드를 바꿀 방법이 아예 없었다. 힌트는 모드가 실제로 바꾸는 것만 말한다(밀도·용어·노출).
export const UI_MODE_OPTIONS: readonly { readonly id: EditorUiMode; readonly label: string; readonly hint: string }[] = [
  { id: "beginner", label: "초보", hint: "이름 붙은 큰 도구 레일 · 첫 사용 안내" },
  { id: "standard", label: "표준", hint: "타일 팔레트와 맵 트리 · 쉬운 용어" },
  { id: "expert", label: "전문가", hint: "촘촘한 배치 · 기술 용어 · 도구 창 1클릭 · 배율 6단" },
];

/**
 * 「보기 ▾」 버튼과 그 메뉴. `.oprn-menu-popup` 이 형제 기준으로 위치를 잡으므로 감싸면 CSS 를
 * 함께 고쳐야 한다.
 */
export function renderWorkspaceBar(): readonly [HTMLElement, HTMLElement] {
  return renderPanelsMenu();
}

function renderPanelsMenu(): readonly [HTMLElement, HTMLElement] {
  const paletteRail = getEditorChrome().paletteRail;
  const menuName = paletteRail ? "보기 — 편집 모드" : "보기 — 패널과 편집 모드";
  const menu = el("div", {
    class: "oprn-menu-popup workspace-panels-menu",
    attrs: { role: "menu", "aria-label": menuName },
    dataset: { testid: "workspace-panels-menu" },
  });
  menu.hidden = true;
  // 글리프 + 글자 라벨. 「▤」 하나만 있던 2026-08-26~09-03 사이에는 편집 모드(초보/표준/전문가)의
  // 유일한 진입점이 장식으로 읽혔다 — 실제로 사용자가 "진입점이 없다"고 했다. 화면 글자는
  // uiCopy 정본에서 가져온다.
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
      el("span", { class: "workspace-panels-label", text: uiLabel("viewMenu", getEditorChrome().jargonStyle) }),
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
  };
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (button.getAttribute("aria-expanded") === "true") close();
    else open();
  });

  const layout = getWorkspaceLayout();
  // 「패널」 그룹은 **좌측 레일이 없는 모드에서만** 이 메뉴의 것이다. 초보의 타일은 레일
  // 호스트라 고정이고 맵 도크는 렌더되지 않는다. `basic-rail-toggle-tiles/-maps` 는 도크
  // 멤버십이 아니라 별도 플라이아웃을 여닫으므로, 초보에는 도크 그룹 자체를 내놓지 않는다.
  if (!paletteRail) {
    menu.append(el("div", { class: "workspace-menu-group", text: "패널" }));
    for (const panel of allPanels().filter((candidate) => candidate.id !== "assistant")) {
      menu.append(renderPanelRow(panel.id, panel.title, layout, close));
    }
  }
  menu.append(el("div", { class: "workspace-menu-group", text: "편집 모드" }));
  for (const option of UI_MODE_OPTIONS) {
    const active = getEditorUiMode() === option.id;
    menu.append(
      el("button", {
        class: `oprn-menu-command workspace-ui-mode-item${active ? " is-active" : ""}`,
        attrs: { type: "button", role: "menuitemradio", "aria-checked": active ? "true" : "false", title: `${option.label} — ${option.hint}` },
        dataset: { testid: `workspace-ui-mode-${option.id}`, editorUiMode: option.id },
        children: [
          el("span", { class: "workspace-ui-mode-radio", attrs: { "aria-hidden": "true" } }),
          el("span", {
            class: "workspace-ui-mode-text",
            children: [
              el("span", { class: "workspace-ui-mode-label", text: option.label }),
              el("span", { class: "workspace-ui-mode-hint", text: option.hint }),
            ],
          }),
        ],
        on: {
          click: (event) => {
            event.stopPropagation();
            setEditorUiMode(option.id);
            close();
          },
        },
      }),
    );
  }
  return [button, menu];
}

/**
 * 패널 한 줄 = 표시 토글 + 도크 이동 칩.
 *
 * 초보 모드는 이 행을 아예 그리지 않는다(`renderPanelsMenu` 가 그룹째로 건너뛴다). 타일은
 * 고정 레일 호스트이고 맵 도크는 렌더되지 않으므로 설명만 남은 비활성 행도 만들지 않는다.
 */
function renderPanelRow(id: PanelId, title: string, layout: WorkspaceLayout, close: () => void): HTMLElement {
  const zone = dockOf(layout, id);
  const row = el("div", { class: "workspace-panel-row", dataset: { testid: `workspace-panel-row-${id}` } });
  const toggle = el("button", {
    class: `oprn-menu-command workspace-panel-toggle${zone ? " is-active" : ""}`,
    attrs: {
      type: "button",
      role: "menuitemcheckbox",
      "aria-checked": zone ? "true" : "false",
      title: zone ? `${title} 패널 닫기` : `${title} 패널 열기`,
    },
    dataset: { testid: `workspace-panel-toggle-${id}` },
    children: [
      el("span", { class: "workspace-panel-check", attrs: { "aria-hidden": "true" }, children: zone ? [makeSvgIcon("check")] : [] }),
      el("span", { class: "workspace-panel-title", text: title }),
    ],
    on: {
      click: (event) => {
        event.stopPropagation();
        toggleWorkspacePanel(id);
        close();
      },
    },
  });
  row.append(toggle);
  // 이동 칩은 **호스트가 실제로 마운트된 zone 만** 제시한다. right/bottom 도크를 아무도
  // 마운트하지 않는 동안 칩을 보여주면 눌러도 아무 일이 없고, 그 뒤 메뉴는 이동이 일어난
  // 척한다(계획서 §1-1 B-2).
  for (const target of ["left", "right"] as const) {
    if (!zone || zone === target) continue;
    if (!dockZoneHasHost(target)) continue;
    row.append(
      el("button", {
        class: "workspace-panel-dock-chip",
        text: ZONE_LABEL[target],
        attrs: { type: "button", title: `${title} 패널을 ${ZONE_LABEL[target]} 도크로 옮긴다` },
        dataset: { testid: `workspace-panel-dock-${id}-${target}` },
        on: {
          click: (event) => {
            event.stopPropagation();
            moveWorkspacePanel(id, target);
            close();
          },
        },
      }),
    );
  }
  return row;
}
