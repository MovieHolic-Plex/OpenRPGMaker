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

import { requestCommandPalette } from "@/editor/panels/commandPalette";
import { allPanels, type DockZone, type PanelId } from "@/editor/workspace/panelRegistry";
import {
  dockOf,
  isWorkspaceDensity,
  WORKSPACE_PRESETS,
  type WorkspaceDensity,
} from "@/editor/workspace/workspaceLayout";
import {
  getWorkspaceLayout,
  moveWorkspacePanel,
  setWorkspaceDensity,
  setWorkspacePreset,
  toggleWorkspacePanel,
} from "@/editor/workspace/workspaceStore";
import { el } from "@/util/dom";

const DENSITY_OPTIONS: readonly { readonly id: WorkspaceDensity; readonly label: string; readonly hint: string }[] = [
  { id: "guided", label: "안내", hint: "도구에 이름을 붙이고 첫 사용 안내를 켠다" },
  { id: "comfortable", label: "보통", hint: "기본 밀도" },
  { id: "dense", label: "촘촘", hint: "패널을 더 좁게 쓰고 보조 툴바를 모두 노출한다" },
];

const ZONE_LABEL: Record<DockZone, string> = { left: "왼쪽", right: "오른쪽", bottom: "아래" };

/**
 * 탑바에 들어갈 노드들. `standard-more-tools` 와 같은 평면 형제 패턴을 쓴다 —
 * `.oprn-menu-popup` 이 형제 기준으로 위치를 잡으므로 감싸면 CSS 를 함께 고쳐야 한다.
 */
export function renderWorkspaceBar(): readonly HTMLElement[] {
  const [panelsButton, panelsMenu] = renderPanelsMenu();
  return [renderPresetToggle(), panelsButton, panelsMenu, renderCommandPaletteChip()];
}

function renderPresetToggle(): HTMLElement {
  const current = getWorkspaceLayout().presetId;
  const group = el("div", {
    class: "workspace-preset-toggle editor-ui-mode-toggle",
    attrs: { role: "group", "aria-label": "작업 프리셋" },
    dataset: { testid: "workspace-preset-toggle" },
  });
  for (const preset of WORKSPACE_PRESETS) {
    const active = current === preset.id;
    group.append(
      el("button", {
        class: `workspace-preset-btn editor-ui-mode-btn${active ? " is-active" : ""}`,
        text: preset.label,
        attrs: { type: "button", "aria-pressed": active ? "true" : "false", title: preset.hint },
        dataset: { testid: `workspace-preset-${preset.id}`, workspacePreset: preset.id },
        on: {
          click: (event) => {
            event.stopPropagation();
            // 구독자(editor.ts 의 도크 동기화 + app/mode.ts 의 renderTopbar)가 재렌더를 맡는다.
            setWorkspacePreset(preset.id);
          },
        },
      }),
    );
  }
  return group;
}

function renderPanelsMenu(): readonly [HTMLElement, HTMLElement] {
  const menu = el("div", {
    class: "oprn-menu-popup workspace-panels-menu",
    attrs: { role: "menu", "aria-label": "패널과 밀도" },
    dataset: { testid: "workspace-panels-menu" },
  });
  menu.hidden = true;
  const button = el("button", {
    class: "oprn-menu-item workspace-panels-button",
    text: "▤",
    attrs: {
      type: "button",
      title: "패널 배치와 밀도",
      "aria-label": "패널 배치와 밀도",
      "aria-expanded": "false",
      "aria-haspopup": "menu",
    },
    dataset: { testid: "workspace-panels-button" },
  });
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
  menu.append(el("div", { class: "workspace-menu-group", text: "패널" }));
  for (const panel of allPanels()) {
    menu.append(renderPanelRow(panel.id, panel.title, close));
  }
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
  return [button, menu];
}

/** 패널 한 줄 = 표시 토글 + 도크 이동 칩. */
function renderPanelRow(id: PanelId, title: string, close: () => void): HTMLElement {
  const layout = getWorkspaceLayout();
  const zone = dockOf(layout, id);
  const row = el("div", { class: "workspace-panel-row", dataset: { testid: `workspace-panel-row-${id}` } });
  row.append(
    el("button", {
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
    }),
  );
  for (const target of ["left", "right"] as const) {
    if (!zone || zone === target) continue;
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
      title: "명령·맵·스킬 찾기 (Ctrl+K)",
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
