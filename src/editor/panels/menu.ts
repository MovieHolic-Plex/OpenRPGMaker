import { getMode, toggleMode } from "@/app/mode";
import { PRODUCT_TAGLINE } from "@/brand";
import { duplicateMap } from "@/editor/actions";
import { selectEditorMap } from "@/editor/mapSelection";
import { showConfirm, showPromptInput } from "@/editor/ui/modal";
import { editorState, type Layer, type Tool } from "@/editor/editorState";
import {
  EDITOR_PRODUCT_BRAND,
  getEditorChrome,
  getEditorUiMode,
} from "@/editor/editorUiMode";
import { openAudioTestDialog } from "@/editor/panels/audioTestDialog";
import { openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { openHelpModal } from "@/editor/panels/helpModal";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { openDbConnectionSettings, renderDbConnectionStatus } from "@/editor/panels/dbConnectionSettings";
import { openMapEventSearchModal } from "@/editor/panels/mapEventSearchModal";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { openWorldPanel } from "@/editor/panels/worldPanel";
import { deserialize, ProjectFormatError } from "@/project/io";
import { createBlankProject, createSampleAdventureProject, createScarloxyDemoProject, createScarloxyPokemonDemoProject, createSkyStairProject, createSnowMountain60Project, createIcePlain64Project, createTrainingExamplesProject, createFarmingDemoProject } from "@/project/defaults";
import {
  createProjectPackage,
  ProjectPackageError,
  projectPackageFileName,
  readProjectPackage,
  LEGACY_RPGZZU_MIME,
  RPGZZU_MIME,
} from "@/project/package";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { createWebPlayerExportPackage, webExportFileName } from "@/project/webExport";
import { store, type AutoSaveState } from "@/project/store";
import type { Project } from "@/project/types";
import { downloadBlob } from "@/util/downloadBlob";
import { clearChildren, el } from "@/util/dom";
import { createLogger } from "@/util/logger";
import { toast } from "@/util/toast";
import { reloadProjectFromDbNow, saveProjectNow } from "@/editor/saveActions";
import { toolLabel, uiLabel } from "@/editor/uiCopy";
import { installToolbarOverflow } from "@/editor/panels/toolbarOverflow";
import { renderWorkspaceBar } from "@/editor/panels/workspaceBar";
import { separator, toolbarButton } from "./menuToolbar";
import { renderCommitHistoryButton, renderIdentityTopbarControl } from "@/editor/teamWorkflowUi";

// 맵 메뉴는 없다. 「새 맵 / 현재 맵을 시작 맵으로 / 현재 맵 삭제」 세 항목이 모두 좌측 맵 트리
// (map-add / map-set-start / 행 ⋯ 메뉴)와 같은 동작이었다 — 사이드바가 잦은 조작의 집이다.
const MENU_ITEMS = [
  { id: "project", label: "프로젝트" },
  { id: "tools", label: "도구" },
  { id: "game", label: "게임" },
  { id: "help", label: "도움말" },
] as const;

const TOOLBAR_COLLAPSED_KEY = "oprn:toolbar-collapsed";

const autoSaveLog = createLogger("autosave");

type MenuId = (typeof MENU_ITEMS)[number]["id"];

type MenuCommand =
  | { readonly kind: "item"; readonly disabled?: boolean; readonly label: string; readonly onClick: () => void; readonly testId: string }
  | { readonly kind: "submenu"; readonly label: string; readonly popupId: string; readonly testId: string; readonly commands: () => readonly MenuCommand[] }
  | { readonly kind: "separator" };

let activeMenuPopup: HTMLElement | null = null;
let popupOutsideListener: (() => void) | null = null;
let popupPositionCleanup: (() => void) | null = null;
let activeMenuTrigger: HTMLElement | null = null;
// renderTopbar가 재실행될 때마다 classicToolbarRow/classicPlayToolbarRow가 새 row에
// installToolbarOverflow를 걸므로, 이전 호출이 남긴 document 리스너/ResizeObserver를
// 재구축 직전에 반드시 해제해야 세션 내 리스너 누적을 막을 수 있다.
let disposeToolbarOverflows: (() => void)[] = [];
// 저장 상태 칩의 autosave 구독도 같은 이유로 재구축 직전에 끊는다. renderTopbar는 한 세션에서
// 여러 번 불린다(mode.ts: editorState 구독 / enterMode / 신원·워크스페이스·UI모드 구독) —
// 구독을 끊지 않으면 편집 몇 분 만에 같은 리스너가 수십 개 쌓여 죽은 DOM을 계속 그린다.
let disposeSaveStatus: (() => void) | null = null;
let lastLoggedAutoSaveKind: AutoSaveState["kind"] | null = null;
// 실패 에피소드가 진행 중인가. error 로 켜지고 saved/idle 로 꺼진다 — 재시도 중(saving)에도
// 칩을 붙잡아 두는 데 쓴다. 톱바가 다시 그려져도 에피소드는 이어져야 하므로 모듈 상태다.
let saveFailureEpisode = false;

export function renderTopbar(topbar: HTMLElement): void {
  for (const dispose of disposeToolbarOverflows) dispose();
  disposeToolbarOverflows = [];
  disposeSaveStatus?.();
  disposeSaveStatus = null;
  while (topbar.firstChild) topbar.removeChild(topbar.firstChild);
  applyToolbarCollapsed(readToolbarCollapsed());
  const mode = getMode();
  const uiMode = getEditorUiMode();
  const chrome = getEditorChrome();
  const state = editorState.get();
  const menuBar = el("div", {
    class: "oprn-menu-bar editor-studio-menubar",
    dataset: { testid: "oprn-menu-bar", editorUiMode: uiMode },
  });
  menuBar.append(renderProductBrand());
  for (const item of MENU_ITEMS) {
    if (item.id === "help" && !chrome.helpMenu) continue;
    const label = item.id === "game" ? chrome.gameMenuLabel : item.label;
    menuBar.append(renderMenu(item.id, label, menuCommands(item.id, topbar)));
  }
  menuBar.append(...renderWorkspaceBar());
  // History + identity sit as trailing icon buttons (right end), before window chrome.
  const trailing = el("div", {
    class: "editor-topbar-trailing",
    dataset: { testid: "editor-topbar-trailing" },
  });
  trailing.append(
    renderTopbarSaveStatus(topbar),
    ...(mode === "edit" ? [renderTestPlayButton(), renderTopbarAiSettingsButton()] : []),
    renderQuickBattleTestButton(),
    renderCommitHistoryButton(),
    renderTopbarIdentityControl(topbar),
    renderWindowControls()
  );
  menuBar.append(trailing);

  const showClassic = mode !== "edit" || chrome.classicToolbar;
  topbar.append(menuBar);
  if (showClassic) {
    const toolbar = el("div", {
      class: "oprn-toolbar classic-toolbar is-legacy-surface",
      dataset: { testid: "oprn-toolbar", uiDensity: chrome.classicToolbar ? "expert" : "play" },
    });
    toolbar.append(mode === "edit" ? classicToolbarRow(state, topbar) : classicPlayToolbarRow(mode));
    topbar.append(toolbar);
  }
}

function renderProductBrand(): HTMLElement {
  return el("div", {
    class: "editor-product-brand",
    dataset: { testid: "editor-product-brand" },
    attrs: { title: EDITOR_PRODUCT_BRAND },
    children: [
      el("span", { class: "editor-product-brand-mark", attrs: { "aria-hidden": "true" }, text: "✦" }),
      el("span", { class: "editor-product-brand-text", text: EDITOR_PRODUCT_BRAND }),
    ],
  });
}

function renderTopbarAiSettingsButton(): HTMLElement {
  return el("button", {
    class: "topbar-ai-settings-button",
    attrs: { type: "button", title: "AI 설정", "aria-label": "AI 설정 열기" },
    dataset: { testid: "topbar-ai-settings" },
    children: [
      el("span", { class: "topbar-ai-settings-glyph", attrs: { "aria-hidden": "true" }, text: "⚙" }),
      el("span", { text: "AI 설정" }),
    ],
    on: { click: () => openAiSettingsModal() },
  });
}

/**
 * 저장 상태 칩의 호스트. 톱바가 이 칩이 붙을 수 있는 유일하게 살아 있는 면이다.
 *
 * 실측 배경(2026-08-29): `AutoSaveState`는 error/retryCount까지 갖추고 있고 그걸 그리는
 * `renderDbConnectionStatus`도 CSS 8종과 함께 이미 있었는데, 하단 상태바 폐지(2026-08-25)로
 * 호스트를 잃어 **프로덕션 호출 사이트가 0건**이었다. 남은 `renderPersistenceModeBanner`는
 * `status.kind !== "disabled"`면 null이라 autosave 실패를 아예 다루지 않는다. 그래서 오토세이브가
 * 몇 시간 연속 실패해도 화면에는 흔적이 없고 console.error만 남았다. 여기서 다시 마운트한다.
 *
 * 칩 본체는 새로 만들지 않고 기존 구현을 그대로 쓴다 — 라벨·색·`다시 저장` 버튼·testid
 * (`db-connection-status` / `db-autosave-state` / `db-autosave-retry`)가 전부 거기 있다.
 */
function renderTopbarSaveStatus(topbar: HTMLElement): HTMLElement {
  const host = el("div", {
    class: "topbar-save-status",
    // 라이브 리전은 **내용이 바뀌기 전부터** DOM에 있어야 읽힌다. 그래서 조용한 상태에서도
    // 호스트는 남겨두고 안만 비운다(칩째로 붙였다 떼면 스크린리더가 변화를 못 읽는다).
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "topbar-save-status" },
  });
  paintSaveStatus(host, topbar);
  disposeSaveStatus = store.subscribeAutoSave((state) => {
    logAutoSaveTransition(state);
    paintSaveStatus(host, topbar);
  });
  return host;
}

function paintSaveStatus(host: HTMLElement, topbar: HTMLElement): void {
  const state = store.getAutoSaveState();
  // 평상시의 pending·saving 은 접는다 — 실측(브라우저 캡처): 칩 폭이 281px 이라 타일 한 칸
  // 칠할 때마다 pending 으로 떴다가 4초 뒤 사라지면서 바로 옆 `테스트`·`AI 설정` 버튼이 그만큼
  // 좌우로 튄다. 그리는 중에 버튼이 커서 밑에서 움직이는 건 오히려 오조작을 만든다. 진행 상황은
  // 명시적 저장(Ctrl+S)의 토스트가, 미저장 종료는 beforeunload 경고가 이미 알려준다.
  //
  // 단, **실패 에피소드가 시작된 뒤**의 pending·saving 은 계속 보여 준다. 그러지 않으면
  // `다시 저장`을 누른 직후 칩이 사라졌다가 빨간 채로 다시 나타나 사용자가 결과를 오해한다.
  if (state.kind === "error") saveFailureEpisode = true;
  else if (state.kind === "saved" || state.kind === "idle") saveFailureEpisode = false;
  const quiet = state.kind !== "error" && !saveFailureEpisode;
  clearChildren(host);
  host.dataset.autosaveKind = state.kind;
  host.hidden = quiet;
  // hidden 속성만으로는 클래스 규칙의 display에 밀릴 수 있다(특이도 함정 실측) — 인라인으로 못박는다.
  host.style.display = quiet ? "none" : "inline-flex";
  host.style.alignItems = "center";
  if (quiet) return;
  // 충돌은 별도 kind가 아니다: store의 `autoSaveStateForFlushResult`가 flush 결과 conflict를
  // 충돌 안내 문구를 담은 kind:"error"로 접어 보낸다. 따라서 error 한 분기가 실패·충돌을 함께 덮고
  // CSS `.db-connection-status.autosave-error .db-autosave-state`가 --status-error로 칠한다.
  host.append(renderDbConnectionStatus(store.getDbPersistenceStatus(), () => renderTopbar(topbar)));
}

/**
 * 화면을 안 보고 있었을 때를 위한 흔적. 링버퍼는 레벨과 무관하게 전량 적재되므로
 * 진행 상태는 debug로 남겨 콘솔을 조용히 두고, 실패만 error로 올린다.
 * 실패는 같은 kind가 이어져도 매번 남긴다 — retryCount가 늘어나는 게 그 자체로 정보다.
 */
function logAutoSaveTransition(state: AutoSaveState): void {
  if (state.kind === lastLoggedAutoSaveKind && state.kind !== "error") return;
  lastLoggedAutoSaveKind = state.kind;
  if (state.kind === "error") {
    autoSaveLog.error("자동 저장 실패 — 톱바 저장 상태 칩에 노출한다", {
      message: state.message,
      retryCount: state.retryCount ?? 0,
    });
    return;
  }
  autoSaveLog.debug(`자동 저장 상태 → ${state.kind}`, state.kind === "saved" ? { at: state.at } : undefined);
}

export function readableTopbarIdentityLabel(label: string): string {
  const browserSession = label.trim().match(/^브라우저\s+(.+)$/u)?.[1];
  return browserSession ? `게스트 세션 ${browserSession}` : label.trim();
}

function renderTopbarIdentityControl(topbar: HTMLElement): HTMLElement {
  const control = renderIdentityTopbarControl(() => renderTopbar(topbar));
  const label = control.querySelector<HTMLElement>("[data-testid='topbar-identity-label']");
  if (label) {
    const readable = readableTopbarIdentityLabel(label.textContent ?? "");
    label.textContent = readable;
    const title = `편집 신원 — ${readable}`;
    control.setAttribute("title", title);
    control.setAttribute("aria-label", title);
  }
  return control;
}

function renderMenu(id: MenuId, label: string, commands: readonly MenuCommand[]): HTMLElement {
  return el("button", {
    class: "oprn-menu-item",
    text: label,
    attrs: { "aria-haspopup": "menu", "aria-expanded": "false" },
    dataset: { testid: `menu-${id}` },
    on: {
      click: (event) => {
        event.stopPropagation();
        const target = event.currentTarget;
        if (!(target instanceof HTMLElement)) return;
        openMenuPopup(id, target, commands);
      },
      keydown: (event) => {
        if (!(event instanceof KeyboardEvent) || event.key !== "Escape" || activeMenuTrigger !== event.currentTarget) return;
        event.preventDefault();
        closeMenuPopup({ restoreFocus: true });
      },
    },
  });
}

function renderWindowControls(): HTMLElement {
  const controls = el("div", { class: "oprn-window-controls" });
  const collapsed = document.body.classList.contains("toolbar-collapsed");
  const collapse = el("button", {
    class: "oprn-window-control",
    text: collapsed ? "▾" : "─",
    attrs: { type: "button", title: "툴바 접기/펼치기", "aria-pressed": collapsed ? "true" : "false" },
    dataset: { testid: "window-toolbar-collapse" },
    on: {
      click: (event) => {
        event.stopPropagation();
        const nextCollapsed = !document.body.classList.contains("toolbar-collapsed");
        applyToolbarCollapsed(nextCollapsed);
        writeToolbarCollapsed(nextCollapsed);
        collapse.textContent = nextCollapsed ? "▾" : "─";
        collapse.setAttribute("aria-pressed", nextCollapsed ? "true" : "false");
      },
    },
  });
  const fullscreen = el("button", {
    class: "oprn-window-control",
    text: document.fullscreenElement ? "◱" : "□",
    attrs: { type: "button", title: "전체화면 전환" },
    dataset: { testid: "window-fullscreen" },
    on: {
      click: (event) => {
        event.stopPropagation();
        void toggleFullscreen();
      },
    },
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreen.textContent = document.fullscreenElement ? "◱" : "□";
  });
  // 브라우저 탭은 스크립트로 안정적으로 닫을 수 없어 닫기 컨트롤은 렌더하지 않는다.
  controls.append(collapse, fullscreen);
  return controls;
}

function applyToolbarCollapsed(collapsed: boolean): void {
  document.body.classList[collapsed ? "add" : "remove"]("toolbar-collapsed");
}

function readToolbarCollapsed(): boolean {
  return browserLocalStorage()?.getItem(TOOLBAR_COLLAPSED_KEY) === "1";
}

function writeToolbarCollapsed(collapsed: boolean): void {
  browserLocalStorage()?.setItem(TOOLBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
}

function browserLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (error) {
    if (error instanceof Error) return null;
    return null;
  }
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      if (typeof document.exitFullscreen !== "function") {
        toast("이 브라우저에서는 전체화면을 지원하지 않습니다", "error");
        return;
      }
      await document.exitFullscreen();
      return;
    }
    if (typeof document.documentElement.requestFullscreen !== "function") {
      toast("이 브라우저에서는 전체화면을 지원하지 않습니다", "error");
      return;
    }
    await document.documentElement.requestFullscreen();
  } catch (error) {
    toast(error instanceof Error ? `전체화면 전환 실패: ${error.message}` : "전체화면 전환 실패", "error");
  }
}

function openMenuPopup(id: string, button: HTMLElement, commands: readonly MenuCommand[]): void {
  const alreadyOpen = activeMenuPopup?.dataset.testid === `menu-popup-${id}`;
  closeMenuPopup();
  if (alreadyOpen) return;
  button.setAttribute("aria-expanded", "true");
  const popup = el("div", { class: "oprn-menu-popup open", attrs: { role: "menu" }, dataset: { testid: `menu-popup-${id}` } });
  for (const command of commands) {
    if (command.kind === "separator") {
      popup.append(el("div", { class: "oprn-menu-separator", attrs: { role: "separator" } }));
      continue;
    }
    if (command.kind === "submenu") {
      // 하위 메뉴는 같은 팝업 기계를 재사용해 부모 팝업을 대시한다. 일반 항목 경로는
      // `onClick()` 다음에 `closeMenuPopup()` 가 이어지므로, 그 경로로 여면 방급 여다
      // 하위 메뉴가 그 자리에서 닫힐다 — 그래서 여기서 직접 닫고 여는 순서를 진다.
      const submenu = command;
      popup.append(el("button", {
        class: "oprn-menu-command",
        text: submenu.label,
        attrs: { role: "menuitem", "aria-haspopup": "menu" },
        dataset: { testid: submenu.testId },
        on: {
          click: () => {
            const trigger = activeMenuTrigger;
            closeMenuPopup();
            if (trigger) openMenuPopup(submenu.popupId, trigger, submenu.commands());
          },
        },
      }));
      continue;
    }
    const item = el("button", {
      class: "oprn-menu-command",
      text: command.label,
      attrs: { role: "menuitem" },
      dataset: { testid: command.testId },
      on: {
        click: () => {
          command.onClick();
          closeMenuPopup();
        },
      },
    });
    item.disabled = Boolean(command.disabled);
    popup.append(item);
  }
  const box = button.getBoundingClientRect();
  popup.style.left = `${Math.round(box.left)}px`;
  popup.style.top = `${Math.round(box.bottom)}px`;
  document.body.append(popup);
  activeMenuPopup = popup;
  activeMenuTrigger = button;
  positionMenuPopup(popup, button);
  popup.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeMenuPopup({ restoreFocus: true });
  });
  const reposition = () => positionMenuPopup(popup, button);
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(reposition);
  observer?.observe(popup);
  window.addEventListener("resize", reposition);
  popupPositionCleanup = () => {
    observer?.disconnect();
    window.removeEventListener("resize", reposition);
  };
  // 바깥 클릭 시 닫기 — 단, 팝업 '안'을 누른 pointerdown은 닫지 않는다(도그푸딩 결함 ⑪ 근본 원인).
  // 기존에는 무조건 닫아서, 항목의 pointerdown이 팝업을 제거 → 이어질 click이 분리된 항목에
  // 도달하지 못해 내보내기 등 메뉴 항목 onClick이 실행되지 않았다(내보내기 무반응).
  const onOutsidePointerDown = (event: PointerEvent): void => {
    if (event.target instanceof Node && popup.contains(event.target)) return;
    closeMenuPopup();
    document.removeEventListener("pointerdown", onOutsidePointerDown);
  };
  window.setTimeout(() => {
    document.addEventListener("pointerdown", onOutsidePointerDown);
  }, 0);
  // Escape 는 문서 수준에서 받는다. 팝업·트리거 포서스에만 의지하면 하위 메뉴를 여는 순간
  // 클릭한 항목 버튼이 DOM 에서 사라지며 포서스가 body 로 가기 때문에 닫는 길이 없어진다
  // (그런 팝업은 트리거 자리 — 증 상단 왼쪽 — 에 떠 있어 사이드바를 가린다).
  const onDocumentEscape = (event: Event): void => {
    if ((event as KeyboardEvent).key !== "Escape") return;
    event.preventDefault();
    closeMenuPopup({ restoreFocus: true });
  };
  document.addEventListener("keydown", onDocumentEscape);
  popupOutsideListener = () => {
    document.removeEventListener("pointerdown", onOutsidePointerDown);
    document.removeEventListener("keydown", onDocumentEscape);
  };
}

function closeMenuPopup(options: { readonly restoreFocus?: boolean } = {}): void {
  popupOutsideListener?.();
  popupOutsideListener = null;
  popupPositionCleanup?.();
  popupPositionCleanup = null;
  const trigger = activeMenuTrigger;
  activeMenuTrigger = null;
  activeMenuPopup?.remove();
  activeMenuPopup = null;
  document.querySelectorAll<HTMLElement>(".oprn-menu-item[aria-expanded='true']").forEach((node) => {
    node.setAttribute("aria-expanded", "false");
  });
  if (options.restoreFocus && trigger?.isConnected) trigger.focus();
}

function positionMenuPopup(popup: HTMLElement, trigger: HTMLElement): void {
  const margin = 12;
  const triggerBox = trigger.getBoundingClientRect();
  const popupBox = popup.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - popupBox.width - margin);
  const left = Math.max(margin, Math.min(triggerBox.left, maxLeft));
  const maxTop = Math.max(margin, window.innerHeight - popupBox.height - margin);
  const top = triggerBox.bottom <= maxTop
    ? triggerBox.bottom
    : Math.max(margin, Math.min(triggerBox.top - popupBox.height, maxTop));
  popup.style.left = `${Math.round(left)}px`;
  popup.style.top = `${Math.round(top)}px`;
}

function menuCommands(id: MenuId, topbar: HTMLElement): readonly MenuCommand[] {
  switch (id) {
    case "project":
      return [
        item("새 프로젝트", "menu-project-new", () => void newProject()),
        item("열기", "menu-project-load", () => doLoad(topbar)),
        item("저장", "menu-project-save", () => void saveProjectNow()),
        item("저장본 다시 불러오기", "menu-project-reload-db", () => void reloadProjectFromDb(topbar)),
        { kind: "separator" },
        // 데모 로더 9개가 이 메뉴 최상위에 나란히 붙어 14줄을 만들고 있었다 — 하위 메뉴로 접는다.
        {
          kind: "submenu",
          label: "예제 프로젝트",
          testId: "menu-project-samples",
          popupId: "project-samples",
          commands: sampleProjectCommands,
        },
        { kind: "separator" },
        item("가져오기...", "menu-project-import", () => doImport()),
        // 라벨 구분: 전에는 프로젝트/게임 메뉴에 「내보내기...」가 따로 있어 같은 말로 다른 일을
        // 했다. 둘을 한 자리에 모으고 무엇을 내보내는지 이름에 쓴다.
        item("프로젝트 파일 내보내기...", "menu-project-export", () => void exportProjectPackage()),
        item("웹 게임 내보내기...", "menu-project-export-web", () => void doExportWebGame()),
      ];
    case "tools":
      // 모달 편집기만 담는다. 되돌리기/다시 실행과 레이어 3종은 사이드바가 소유하므로 빠졌다.
      // 음악·찾기는 전에는 전문가 클래식 툴바에만 있어 초보·표준에서 도달 경로가 없었다.
      return [
        item(`${uiLabel("database", getEditorChrome().jargonStyle)}...`, "menu-tools-database", () => openDatabaseModal()),
        item("자료 보관함...", "menu-tools-resources", () => openResourceModal()),
        item("세계관...", "menu-tools-world", () => openWorldPanel()),
        { kind: "separator" },
        item("음악·효과음...", "menu-tools-audio", () => openAudioTestDialog()),
        item("맵·이벤트 찾기...", "menu-tools-search", () => openMapEventSearchModal()),
        { kind: "separator" },
        item("AI 설정...", "menu-tools-ai-settings", () => openAiSettingsModal()),
      ];
    case "game":
      // 「시연 실행」과 「시연 실행 창」이 edit 모드에서 둘 다 openTestPlayWindow() 를 부르는
      // 진짜 중복이었다. 한 줄로 줄이고, 라벨은 레이어가 아니라 실제 모드를 말한다.
      return [
        item(getMode() === "edit" ? "시연 실행" : "편집으로 돌아가기", "menu-game-play", () => void togglePlayMode()),
        item("랜덤 전투 테스트", "menu-game-battle-test", () => void openRandomBattleTestWindow()),
      ];
    case "help":
      return [
        item("단축키 · 도움말", "menu-help-shortcuts", () => openHelpModal()),
        item("정보", "menu-help-about", () => toast(`${EDITOR_PRODUCT_BRAND} — ${PRODUCT_TAGLINE}`, "ok")),
      ];
  }
}

/** 예제 프로젝트 하위 메뉴 — 전부 「현재 작업을 지우고 시작」 확인을 거치는 로더다. */
function sampleProjectCommands(): readonly MenuCommand[] {
  return [
    item("예제로 시작", "menu-project-sample-adventure", () => void newSampleAdventureProject()),
    item("천공의 계단 (7층 JRPG)", "menu-project-sky-stair", () => void newSkyStairProject()),
    item("학습 예시 12맵", "menu-project-training-examples", () => void newTrainingExamplesProject()),
    item("설산 60×60 (절벽·계단 캔버스)", "menu-project-snow-mountain-60", () => void newSnowMountain60Project()),
    item("얼음 대평원 64×64 (절벽·계단 캔버스)", "menu-project-ice-plain-64", () => void newIcePlain64Project()),
    item("Scarloxy 몬스터 초원 데모", "menu-project-scarloxy-demo", () => void newScarloxyDemoProject()),
    item("Scarloxy 포켓몬풍 데모", "menu-project-scarloxy-pokemon-demo", () => void newScarloxyPokemonDemoProject()),
    item("농장 생활 데모", "menu-project-farming-demo", () => void newFarmingDemoProject()),
  ];
}

function item(label: string, testId: string, onClick: () => void, disabled = false): MenuCommand {
  return { kind: "item", label, testId, onClick, disabled };
}

function classicToolbarRow(state: ReturnType<typeof editorState.get>, topbar: HTMLElement): HTMLElement {
  const row = el("div", { class: "oprn-toolbar-row classic-row", dataset: { testid: "oprn-toolbar-row-edit" } });
  const selectedEvent = selectedEventForState(state);
  const mapId = state.currentMapId ?? store.getCurrent().startMapId;
  row.append(
    el("span", { class: "visually-hidden", text: `3단 레이어: ${layerShortLabel(state.layer)} / ${toolShortLabel(state.tool)}`, dataset: { testid: "layer-selector" } }),
    toolbarButton({ testId: "toolbar-new", label: "새 프로젝트", title: "새 프로젝트", icon: "new", onClick: () => void newProject() }),
    toolbarButton({
      testId: "toolbar-map-copy",
      label: "맵 복사",
      title: "맵 복사",
      disabled: !mapId,
      onClick: () => {
        const copyId = duplicateMap(mapId);
        if (copyId) selectEditorMap(copyId);
      },
    }),
    toolbarButton({
      testId: "toolbar-event-test",
      label: "이벤트 테스트",
      title: selectedEvent ? "선택 이벤트 테스트" : "이벤트를 선택하면 테스트할 수 있습니다.",
      icon: "event-test",
      disabled: !selectedEvent,
      onClick: () => void openSelectedEventTestWindow(),
    }),
    separator(),
    toolbarButton({
      testId: "toolbar-battle-test",
      label: "전투",
      title: "랜덤 적 그룹과 바로 전투 테스트",
      icon: "play",
      onClick: () => void openRandomBattleTestWindow(),
    }),
    separator(),
    toolbarButton({ testId: "toolbar-save", label: "저장", title: "프로젝트 저장 (Ctrl+S)", icon: "save", onClick: () => void saveProjectNow() }),
    toolbarButton({
      testId: "toolbar-reload-db",
      label: "저장본",
      title: "온라인 저장본을 다시 불러와 맵과 이벤트를 반영",
      icon: "open",
      onClick: () => void reloadProjectFromDb(topbar),
    }),
    separator(),
    toolbarButton({ testId: "toolbar-load", label: "열기", title: "저장된 작업 열기", icon: "open", onClick: () => doLoad(topbar) }),
    toolbarButton({ testId: "toolbar-import", label: "가져오기", title: "RPGZZU/JSON 가져오기", icon: "import", onClick: () => doImport() }),
    separator(),
    // 레이어 전환은 좌측 사이드바(left-layer-switcher)가 소유한다 — 여기에 다시 넣으면 중복이다.
    toolbarButton({ testId: "toolbar-database", label: uiLabel("databaseShort", getEditorChrome().jargonStyle), title: "데이터베이스", icon: "database", onClick: () => openDatabaseModal() }),
    toolbarButton({ testId: "toolbar-resource-manager", label: "소재", title: "자료 보관함", icon: "resources", onClick: () => openResourceModal() }),
    toolbarButton({ testId: "toolbar-world", label: "세계관", title: "세계관", icon: "grid", onClick: () => openWorldPanel() }),
    toolbarButton({ testId: "toolbar-sound-test", label: "음악", title: "음악/효과음", icon: "sound", onClick: () => openAudioTestDialog() }),
    toolbarButton({ testId: "toolbar-search", label: "찾기", title: "맵/이벤트 찾기", icon: "search", onClick: () => openMapEventSearchModal() }),
    separator(),
    // 구 toolbar-left-panel: 클릭해도 관찰 가능한 변화가 없는 죽은 버튼이었고(실측 감사),
    // 패널 표시/숨김은 ▤ 패널 메뉴가 소유한다.
    toolbarButton({ testId: "toolbar-help", label: "도움말", title: "도움말 (단축키·도구 가이드)", icon: "manual", onClick: () => openHelpModal() })
  );
  disposeToolbarOverflows.push(installToolbarOverflow(row));
  return row;
}

function selectedEventForState(state: ReturnType<typeof editorState.get>): { readonly mapId: string; readonly eventId: string } | null {
  const project = store.getCurrent();
  const mapId = state.currentMapId ?? project.startMapId;
  const eventId = state.selectedEventId;
  if (!eventId) return null;
  const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
  return event ? { mapId, eventId } : null;
}

function openSelectedEventTestWindow(): void {
  const selectedEvent = selectedEventForState(editorState.get());
  if (!selectedEvent) {
    toast("이벤트를 선택하면 테스트할 수 있습니다.", "ok");
    return;
  }
  window.dispatchEvent(new CustomEvent("oprn:test-play-window", {
    detail: { kind: "selected-event", ...selectedEvent },
  }));
}

function renderTestPlayButton(): HTMLElement {
  const play = (): void => {
    void openTestPlayWindow();
  };
  return el("div", {
    class: "topbar-test-play-wrap",
    dataset: { testid: "topbar-test-play" },
    on: {
      click: (event) => {
        event.stopPropagation();
        play();
      },
    },
    children: [
      el("button", {
        class: "topbar-test-play",
        attrs: {
          type: "button",
          title: "시연 실행",
          "aria-label": "전체 프로젝트 시연 실행",
        },
        dataset: { testid: "mode-play" },
        on: {
          click: (event) => {
            event.stopPropagation();
            play();
          },
        },
        children: [
          el("span", { class: "topbar-test-play-glyph", text: "▶", attrs: { "aria-hidden": "true" } }),
          el("span", { class: "topbar-test-play-label", text: "테스트" }),
        ],
      }),
    ],
  });
}

function renderQuickBattleTestButton(): HTMLElement {
  return el("button", {
    class: "team-history-button is-icon-only quick-battle-test-button",
    attrs: {
      type: "button",
      title: "랜덤 전투 테스트 — 적 그룹을 뽑아 즉시 전투",
      "aria-label": "랜덤 전투 테스트",
    },
    dataset: { testid: "topbar-battle-test" },
    children: [
      el("span", {
        class: "quick-battle-test-glyph",
        text: "⚔",
        attrs: { "aria-hidden": "true" },
      }),
    ],
    on: {
      click: (event) => {
        event.stopPropagation();
        openRandomBattleTestWindow();
      },
    },
  });
}

function openRandomBattleTestWindow(): void {
  window.dispatchEvent(
    new CustomEvent("oprn:test-play-window", {
      detail: { kind: "random-battle" },
    })
  );
}
function classicPlayToolbarRow(mode: string): HTMLElement {
  const row = el("div", { class: "oprn-toolbar-row classic-row", dataset: { testid: "oprn-toolbar-row-primary" } });
  row.append(playModeButton(mode));
  disposeToolbarOverflows.push(installToolbarOverflow(row));
  return row;
}

function playModeButton(mode: string): HTMLButtonElement {
  return toolbarButton({
    testId: mode === "edit" ? "mode-play" : "mode-edit",
    label: mode === "edit" ? "실행" : "편집",
    title: mode === "edit" ? "시연 실행" : "편집기로 돌아가기",
    icon: mode === "edit" ? "play" : "pencil",
    primary: true,
    onClick: () => {
      if (mode === "edit") void openTestPlayWindow();
      else toggleMode();
    },
  });
}

function layerShortLabel(layer: Layer): string {
  switch (layer) {
    case "lower":
      return "하위";
    case "upper":
      return "상위";
    case "event":
      return "이벤트";
  }
}

/** 도구 이름은 uiCopy 단일 원천 — 여기서 다시 적으면 화면마다 다른 말이 된다. */
function toolShortLabel(tool: Tool): string {
  return toolLabel(tool);
}

async function newProject(): Promise<void> {
  // 2026-08-18 UX 리뷰 P0: "현재 작업을 지우고" + 빨간 버튼은 위협적이고,
  // clearAll()은 열려 있던 원격 project id를 그대로 쓰며 공유 행을 덮어썼다.
  // 새 프로젝트는 이름을 받고 새 project id를 발급해 새 원격 행으로 저장한다.
  const name = await showPromptInput({
    title: "새 프로젝트",
    message: "새 작업의 이름을 정해 주세요. 지금 열려 있는 작업은 그대로 저장된 채 유지됩니다.",
    placeholder: "예: 나의 첫 RPG",
    defaultValue: "새 프로젝트",
    confirmLabel: "만들기",
  });
  if (name === null) return;
  const title = name.trim() || "새 프로젝트";
  const result = await store.loadNewRemoteProject(createBlankProject(), { title });
  const { focusProjectStartMap } = await import("@/editor/mapSelection");
  focusProjectStartMap();
  toast(
    result.projectId
      ? `'${title}' 프로젝트를 만들었습니다 — 새 작업으로 온라인 저장됩니다`
      : `'${title}' 프로젝트를 만들었습니다 (온라인 저장 미연결)`,
    "ok",
  );
}

async function newSkyStairProject(): Promise<void> {
  if (!(await showConfirm({ title: "천공의 계단", message: "현재 작업을 지우고 《천공의 계단》(7층 JRPG)을 시작할까요?", confirmLabel: "시작", danger: true }))) return;
  store.replaceProject(createSkyStairProject());
  focusLoadedProjectStartMap();
  toast("천공의 계단을 불러왔습니다 — 등대지기 마루에게 말을 걸어 첫 퀘스트를 받으세요", "ok");
}

async function newTrainingExamplesProject(): Promise<void> {
  if (!(await showConfirm({ title: "학습 예시 12맵", message: "현재 작업을 지우고 학습 예시 12맵 프로젝트를 시작할까요?", confirmLabel: "시작", danger: true }))) return;
  store.replaceProject(createTrainingExamplesProject());
  focusLoadedProjectStartMap();
  toast("학습 예시 12맵을 불러왔습니다 — 각 맵 이름의 주제대로 예시를 채워넣으세요", "ok");
}

async function newSnowMountain60Project(): Promise<void> {
  if (!(await showConfirm({ title: "설산 60×60", message: "현재 작업을 지우고 설산 60×60 (절벽·계단만 깔린 지형 캔버스)을 시작할까요?", confirmLabel: "시작", danger: true }))) return;
  store.replaceProject(createSnowMountain60Project());
  focusLoadedProjectStartMap();
  toast("설산 60×60 을 불러왔습니다 — 선반 위는 비어 있습니다. 발치(30,57)에서 시작해 계단으로 오릅니다", "ok");
}

async function newIcePlain64Project(): Promise<void> {
  if (!(await showConfirm({ title: "얼음 대평원 64×64", message: "현재 작업을 지우고 얼음 대평원 64×64 (절벽·계단·얼음 바닥만 깔린 지형 캔버스)을 시작할까요?", confirmLabel: "시작", danger: true }))) return;
  store.replaceProject(createIcePlain64Project());
  focusLoadedProjectStartMap();
  toast("얼음 대평원 64×64 을 불러왔습니다 — 못 남안(32,62)에서 시작합니다. 고도는 계단으로만 넘습니다", "ok");
}

async function newScarloxyPokemonDemoProject(): Promise<void> {
  if (!(await showConfirm({ title: "Scarloxy 포켓몬풍 데모", message: "현재 작업을 지우고 Scarloxy 포켓몬풍 데모 프로젝트를 시작할까요?", confirmLabel: "시작", danger: true }))) return;
  store.replaceProject(createScarloxyPokemonDemoProject());
  focusLoadedProjectStartMap();
  toast("Scarloxy 포켓몬풍 데모를 불러왔습니다 — 박사에게 스타터를 받고 남쪽 풀숲에서 포획해 보세요", "ok");
}

async function newFarmingDemoProject(): Promise<void> {
  if (!(await showConfirm({ title: "농장 생활 데모", message: "현재 작업을 지우고 농장 생활 데모 프로젝트를 시작할까요?", confirmLabel: "시작", danger: true }))) return;
  store.replaceProject(createFarmingDemoProject());
  focusLoadedProjectStartMap();
  toast("농장 생활 데모를 불러왔습니다 — 밭을 갈고 씨앗을 심어 보세요", "ok");
}

async function newScarloxyDemoProject(): Promise<void> {
  if (!(await showConfirm({ title: "Scarloxy 데모", message: "현재 작업을 지우고 Scarloxy 몬스터 초원 데모 프로젝트를 시작할까요?", confirmLabel: "시작", danger: true }))) return;
  store.replaceProject(createScarloxyDemoProject());
  focusLoadedProjectStartMap();
  toast("Scarloxy 몬스터 초원 데모를 불러왔습니다", "ok");
}

async function newSampleAdventureProject(): Promise<void> {
  if (!(await showConfirm({ title: "예제 프로젝트", message: "현재 작업을 지우고 예제 프로젝트를 시작할까요?", confirmLabel: "시작", danger: true }))) return;
  store.replaceProject(createSampleAdventureProject());
  focusLoadedProjectStartMap();
  toast("예제 프로젝트를 불러왔습니다", "ok");
}

function focusLoadedProjectStartMap(): void {
  void import("@/editor/mapSelection").then(({ focusProjectStartMap }) => {
    focusProjectStartMap();
  });
}

async function togglePlayMode(): Promise<void> {
  if (getMode() === "edit") {
    await openTestPlayWindow();
    return;
  }
  toggleMode();
}

async function openTestPlayWindow(): Promise<void> {
  // flush 는 openTestPlayModal 이 창을 먼저 띄운 뒤 진행(로딩 UI 표시).
  window.dispatchEvent(new CustomEvent("oprn:test-play-window"));
}
async function reloadProjectFromDb(_topbar: HTMLElement): Promise<void> {
  if (store.hasUnsavedChanges()) {
    const ok = await showConfirm({
      title: "저장본 다시 불러오기",
      message: "아직 저장하지 않은 변경이 있습니다. 온라인 저장본으로 덮어쓸까요?",
      confirmLabel: "저장본으로 덮어쓰기",
      danger: true,
    });
    if (!ok) return;
    await reloadProjectFromDbNow({ force: true });
    return;
  }
  await reloadProjectFromDbNow();
}

function doLoad(topbar: HTMLElement): void {
  openDbConnectionSettings(() => renderTopbar(topbar), {
    autoLoadProjects: true,
  });
}

// 프로젝트 내보내기(도그푸딩 결함 ⑪ 수리). 과거 결함 ①: `await store.flush()`가 저장 오류 시
// reject → 함수 전체가 무반응으로 중단(다운로드 없음). anchor 부착·revoke 지연(과거 결함 ②③)은
// downloadBlob 로 옮겼다.
export async function exportProjectPackage(): Promise<void> {
  try {
    // 최신 상태 저장 시도는 유지하되, 실패해도 내보내기는 진행한다(메모리의 현재 상태를 내보냄).
    await store.flush().catch((error) => {
      console.error("[export] flush before export failed:", error);
      toast("저장은 실패했지만 현재 상태를 내보냅니다", "info");
    });
    const project = projectWithoutEventDrafts(store.getCurrent());
    const blob = createProjectPackage(project);
    downloadBlob(blob, projectPackageFileName(project));
    toast("내보냈습니다", "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast(`내보내기 실패: ${message}`, "error");
  }
}

async function doExportWebGame(): Promise<void> {
  try {
    await store.flush().catch((error) => {
      console.error("[web-export] flush before export failed:", error);
      toast("저장은 실패했지만 현재 상태를 게임 번들로 내보냅니다", "info");
    });
    toast("게임 번들을 만드는 중...", "info");
    const project = store.getCurrent();
    const result = await createWebPlayerExportPackage(project);
    downloadBlob(result.blob, webExportFileName(project));
    toast(`게임 내보내기 완료: 맵 ${result.summary.mapCount}개, 에셋 ${result.summary.assetCount}개`, "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast(`게임 내보내기 실패: ${message}`, "error");
  }
}

function doImport(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = `${RPGZZU_MIME},${LEGACY_RPGZZU_MIME},application/zip,.oprn,.rpgzzu,application/json,.json`;
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (isProjectPackageFile(file)) {
      void replaceProjectFromPackage(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => replaceProjectFromJson(String(reader.result));
    reader.onerror = () => toast("파일 읽기 실패", "error");
    reader.readAsText(file);
  });
  input.click();
}

function isProjectPackageFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".oprn") || name.endsWith(".rpgzzu") || file.type === RPGZZU_MIME || file.type === LEGACY_RPGZZU_MIME;
}

async function replaceProjectFromPackage(file: File): Promise<void> {
  try {
    replaceProject(await readProjectPackage(file));
  } catch (error) {
    const message = error instanceof ProjectPackageError ? `가져오기 실패: ${error.message}` : "가져오기 실패";
    toast(message, "error");
  }
}

function replaceProjectFromJson(json: string): void {
  try {
    replaceProject(deserialize(json));
  } catch (error) {
    const message = error instanceof ProjectFormatError ? `가져오기 실패: ${error.message}` : "가져오기 실패";
    toast(message, "error");
  }
}

function replaceProject(project: Project): void {
  store.replaceProject(project);
  focusLoadedProjectStartMap();
  toast("가져오기 완료", "ok");
}
