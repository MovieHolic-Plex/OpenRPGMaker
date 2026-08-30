// editor/panels/workspaceBar.ts
// 탑바의 워크스페이스 컨트롤 — 「초보 / 표준 / 전문가」 3단 모드 토글이 있던 자리.
//
// 왜 바꾸나: 초보/표준/전문가는 **밀도** 한 축을 세 칸으로 쪼갠 것이었고, 그 이름은
// 사용자를 등급으로 분류한다("나는 초보인가?"를 묻게 만든다). 실제로 감독이 고르고 싶은
// 것은 자기 등급이 아니라 **지금 하는 일**이다 — 맵을 그리거나, 이벤트를 연출하거나,
// 자료를 만진다. 그래서 앞면 컨트롤은 작업 프리셋이 되고, 밀도는 패널 메뉴 안의
// 부차 설정으로 내려간다(초보 안전망은 「안내」 밀도에 그대로 남는다).
//
// 패널 메뉴가 도킹 컨트롤을 담는 이유: 좌패널의 세로 공간은 이 제품에서 가장 비싼
// 자원이다(팔레트가 접힘선 밑으로 밀린 사고가 3번 있었다). 패널마다 제목줄을 얹으면
// 28px 씩 먹으므로, 옮기기·닫기는 탑바 메뉴에서 처리한다.
//
// ── 소유권 (2026-08-30 중복 정리) ─────────────────────────────────────────────
// 한 명령의 집은 하나다. 두 번째 표면은 첫 번째가 그 모드에서 렌더되지 않을 때만 둔다.
//  • 작업 프리셋(맵·이벤트·데이터) = **저작 작업 칩**. ▤ 의 「레이아웃」 3줄은 같은
//    `setWorkspacePreset` 을 부르는 두 번째 이름이었고, 칩이 하는 실제 일(레이어·모달)을
//    하지 않아 「작업 런처처럼 보이지만 레이아웃 프리셋만 내놓는 컨트롤」이었다 —
//    `authoringTasks` 가 애초에 대체한 그 표면이다. 지웠고, 선택 표시는 칩으로 옮겼다.
//  • 패널 도크 멤버십(타일·맵) = 초보에서는 제공하지 않는다. 타일은 아이콘 레일의 고정
//    호스트이고 맵 도크는 `mapTree=false`라 렌더되지 않는다. 초보의 `basic-rail-toggle-*`는
//    멤버십을 바꾸는 컨트롤이 아니라 별도 플라이아웃을 여닫는다. 표준·전문가에서는 이 메뉴가
//    도크 토글을 소유한다.

import { requestCommandPalette } from "@/editor/panels/commandPalette";
import { AUTHORING_TASKS, runAuthoringTask } from "@/editor/authoringTasks";
import { editorState } from "@/editor/editorState";
import { getEditorUiMode, setEditorUiMode, getEditorChrome, type EditorUiMode } from "@/editor/editorUiMode";
import type { ChatDock } from "@/editor/chatDock";
import { allPanels, type DockZone, type PanelId } from "@/editor/workspace/panelRegistry";
import { dockZoneHasHost } from "@/editor/workspace/leftDockPanels";
import {
  dockOf,
  isWorkspaceDensity,
  type WorkspaceDensity,
  type WorkspaceLayout,
} from "@/editor/workspace/workspaceLayout";
import {
  getWorkspaceLayout,
  moveWorkspacePanel,
  setWorkspaceDensity,
  toggleWorkspacePanel,
} from "@/editor/workspace/workspaceStore";
import { el } from "@/util/dom";

const DENSITY_OPTIONS: readonly { readonly id: WorkspaceDensity; readonly label: string; readonly hint: string }[] = [
  { id: "guided", label: "안내", hint: "도구에 이름을 붙이고 첫 사용 안내를 켠다" },
  { id: "comfortable", label: "보통", hint: "기본 밀도" },
  { id: "dense", label: "촘촘", hint: "패널을 더 좁게 쓰고 보조 툴바를 모두 노출한다" },
];

const ZONE_LABEL: Record<DockZone, string> = { left: "왼쪽", right: "오른쪽", bottom: "아래" };

// 편집 모드는 2026-08-26 에 이 메뉴로 이사했다. 전에는 standard 전용 ⋯ 메뉴에만 있었고,
// 그 메뉴는 `.open` 클래스를 붙이지 않아 실제로는 열리지 않았다 — 초보 모드 사용자는 Ctrl+K 없이
// 모드를 바꿀 방법이 아예 없었다. 밀도·레이아웃과 같은 화면 설정이므로 이 메뉴가 집이다.
const UI_MODE_OPTIONS: readonly { readonly id: EditorUiMode; readonly label: string; readonly hint: string }[] = [
  { id: "beginner", label: "초보", hint: "이름 붙은 큰 도구 레일과 안내를 최대한 켠다" },
  { id: "standard", label: "표준", hint: "전체 팔레트와 맵 트리를 여는 기본 배치" },
  { id: "expert", label: "전문가", hint: "클래식 툴바와 기술 용어까지 노출한다" },
];

/**
 * 탑바에 들어갈 노드들. `.oprn-menu-popup` 이 형제 기준으로 위치를 잡으므로 감싸면 CSS 를
 * 함께 고쳐야 한다. (구 `standard-more-tools` 가 같은 형제 패턴이었고, `.open` 을 붙이지 않아
 * 영구히 열리지 않던 탓에 2026-08-26 에 제거됐다.)
 */
export function renderWorkspaceBar(): readonly HTMLElement[] {
  const [panelsButton, panelsMenu] = renderPanelsMenu();
  return [renderAuthoringTaskLauncher(), panelsButton, panelsMenu, renderCommandPaletteChip()];
}

function renderAuthoringTaskLauncher(): HTMLElement {
  const group = el("div", {
    class: "authoring-task-launcher editor-ui-mode-toggle",
    attrs: { role: "group", "aria-label": "저작 작업 열기 — 현재 레이아웃 프리셋 표시" },
    dataset: { testid: "authoring-task-launcher" },
  });
  // 표시는 작업 수행 여부가 아니라 현재 **레이아웃 프리셋**만 말한다. Ctrl+K의 화면 프리셋은
  // 의도적으로 도크만 바꾸므로, 데이터 모달을 열지 않았는데 「데이터 작업 중」이라고 읽히면
  // 거짓이다. 상호배타 현재 항목은 집 규칙대로 활성 항목에만 aria-current를 둔다.
  const presetId = getWorkspaceLayout().presetId;
  for (const task of AUTHORING_TASKS) {
    // `test` 는 프리셋이 아니라 일회성 실행 요청이라 선택 상태를 갖지 않는다.
    const active = task.id !== "test" && task.id === presetId;
    const currentPresetCopy = active ? " — 현재 레이아웃 프리셋" : "";
    group.append(
      el("button", {
        class: `authoring-task-btn editor-ui-mode-btn${active ? " is-active" : ""}`,
        text: task.label,
        attrs: {
          type: "button",
          title: `${task.hint}${currentPresetCopy}`,
          "aria-label": `${task.hint}${currentPresetCopy}`,
          ...(active ? { "aria-current": "true" } : {}),
        },
        dataset: { testid: `authoring-task-${task.id}` },
        on: {
          click: (event) => {
            event.stopPropagation();
            runAuthoringTask(task.id);
          },
        },
      }),
    );
  }
  return group;
}

function renderPanelsMenu(): readonly [HTMLElement, HTMLElement] {
  const paletteRail = getEditorChrome().paletteRail;
  const menuName = paletteRail ? "화면 배치와 밀도" : "패널 배치와 밀도";
  const menu = el("div", {
    class: "oprn-menu-popup workspace-panels-menu",
    attrs: { role: "menu", "aria-label": menuName },
    dataset: { testid: "workspace-panels-menu" },
  });
  menu.hidden = true;
  const button = el("button", {
    class: "oprn-menu-item workspace-panels-button",
    text: "▤",
    attrs: {
      type: "button",
      title: menuName,
      "aria-label": menuName,
      "aria-expanded": "false",
      "aria-haspopup": "menu",
    },
    dataset: { testid: "workspace-panels-button" },
  });
  let refreshAssistantPlacement = (): void => {};
  // `.oprn-menu-popup` 은 `position: fixed` + `display: none` 이고 `.open` 이 붙어야 보인다.
  // hidden 만 바꾸면 열리지 않는다(같은 파일의 standard-more-tools 가 그 상태다).
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
    refreshAssistantPlacement();
    const rect = button.getBoundingClientRect?.();
    if (rect) {
      menu.style.left = `${Math.round(rect.left)}px`;
      menu.style.top = `${Math.round(rect.bottom + 2)}px`;
    }
    button.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    menu.classList.add("open");
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
  const assistantPlacement = renderAssistantPlacement(close);
  refreshAssistantPlacement = assistantPlacement.refresh;
  menu.append(
    el("div", { class: "workspace-menu-group", text: "조수 위치" }),
    assistantPlacement.element,
  );
  menu.append(el("div", { class: "workspace-menu-group", text: "밀도" }));
  for (const option of DENSITY_OPTIONS) {
    const active = layout.density === option.id;
    menu.append(
      el("button", {
        class: `oprn-menu-command workspace-density-item${active ? " is-active" : ""}`,
        text: `${active ? "● " : "○ "}${option.label}`,
        attrs: { type: "button", role: "menuitemradio", "aria-checked": active ? "true" : "false", title: option.hint },
        dataset: { testid: `workspace-density-${option.id}`, workspaceDensity: option.id },
        on: {
          click: (event) => {
            event.stopPropagation();
            const next = (event.currentTarget as HTMLElement | null)?.dataset["workspaceDensity"];
            if (isWorkspaceDensity(next)) setWorkspaceDensity(next);
            close();
          },
        },
      }),
    );
  }
  menu.append(el("div", { class: "workspace-menu-group", text: "편집 모드" }));
  for (const option of UI_MODE_OPTIONS) {
    const active = getEditorUiMode() === option.id;
    menu.append(
      el("button", {
        class: `oprn-menu-command workspace-ui-mode-item${active ? " is-active" : ""}`,
        text: `${active ? "● " : "○ "}${option.label}`,
        attrs: { type: "button", role: "menuitemradio", "aria-checked": active ? "true" : "false", title: option.hint },
        dataset: { testid: `workspace-ui-mode-${option.id}`, editorUiMode: option.id },
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

function renderAssistantPlacement(close: () => void): {
  readonly element: HTMLElement;
  readonly refresh: () => void;
} {
  const choices: readonly { readonly dock: ChatDock; readonly icon: string; readonly label: string }[] = [
    { dock: "glass", icon: "◧", label: "왼쪽 카드" },
    { dock: "side", icon: "▥", label: "오른쪽 고정" },
    { dock: "float", icon: "⌨", label: "입력줄" },
  ];
  const buttons: HTMLButtonElement[] = [];
  const refresh = (): void => {
    const current = editorState.get().chatDock;
    for (const button of buttons) {
      button.setAttribute("aria-checked", button.dataset["chatDock"] === current ? "true" : "false");
    }
  };
  for (const choice of choices) {
    buttons.push(el("button", {
      class: "workspace-assistant-dock-option",
      text: choice.icon,
      attrs: {
        type: "button",
        role: "menuitemradio",
        title: choice.label,
        "aria-label": choice.label,
        "aria-checked": choice.dock === editorState.get().chatDock ? "true" : "false",
      },
      dataset: { testid: `workspace-assistant-dock-${choice.dock}`, chatDock: choice.dock },
      on: {
        click: (event) => {
          event.stopPropagation();
          for (const button of buttons) {
            button.setAttribute("aria-checked", button.dataset["chatDock"] === choice.dock ? "true" : "false");
          }
          close();
          void import("@/editor/panels/editor").then((module) => module.setChatDock(choice.dock));
        },
      },
    }) as HTMLButtonElement);
  }
  return {
    element: el("div", {
      class: "workspace-assistant-dock-picker",
      attrs: { role: "group", "aria-label": "조수 위치" },
      children: buttons,
    }),
    refresh,
  };
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
    text: `${zone ? "☑" : "☐"} ${title}`,
    attrs: {
      type: "button",
      role: "menuitemcheckbox",
      "aria-checked": zone ? "true" : "false",
      title: zone ? `${title} 패널 닫기` : `${title} 패널 열기`,
    },
    dataset: { testid: `workspace-panel-toggle-${id}` },
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

function renderCommandPaletteChip(): HTMLElement {
  return el("button", {
    class: "oprn-menu-item workspace-command-chip",
    attrs: {
      type: "button",
      // 이름은 팔레트가 실제로 색인하는 것에서 나온다 — `commandPalette.ts` 의 KIND_HEADERS 는
      // `command`(명령)와 `map`(맵 이동) 둘뿐이다. 구 title 「명령·맵·스킬 찾기 (Ctrl+K)」는
      // (1) 2026-08-27 에 삭제된 조수 스킬을 광고하고 (2) 도구 메뉴의 「맵·이벤트 찾기」와 같은
      // 헤더에 `찾기` 표면을 둘 만들어 둘 다 맵을 찾는다고 말했다.
      //
      // 이 버튼의 이름은 **명령 팔레트** 하나다. title 은 그 이름 뒤에 `—` 로 뭐를 하는
      // 것인지를 잇고(헤더 공통 관례), aria-label 도 같은 이름을 쓴다 — 직전에는 title 이
      // 「명령 실행 · 맵 이동」, aria-label 이 「명령 팔레트 열기」로 같은 버튼이 둘을 말했다.
      title: "명령 팔레트 — 명령 실행 · 맵 이동 (Ctrl+K)",
      "aria-label": "명령 팔레트 열기 (Ctrl+K)",
      "aria-keyshortcuts": "Control+K",
    },
    dataset: { testid: "workspace-command-palette-button" },
    children: [
      el("span", { class: "workspace-command-chip-icon", attrs: { "aria-hidden": "true" }, text: "⌕" }),
      el("span", { class: "workspace-command-chip-key", text: "Ctrl K" }),
    ],
    on: {
      click: (event) => {
        event.stopPropagation();
        requestCommandPalette();
      },
    },
  });
}
