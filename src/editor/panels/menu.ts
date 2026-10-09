import { editorState } from "@/editor/editorState";
import { layerSwitcherKey, makeLeftLayerSwitcher } from "./leftLayerSwitcher";
import { captureFocus, restoreFocus } from "./sidebarFocus";
import { getMode, toggleMode } from "@/app/mode";
import { PRODUCT_BRAND, PRODUCT_TAGLINE } from "@/brand";
import { showAlert, showConfirm } from "@/editor/ui/modal";
import { showBackupRestoreDialog } from "@/editor/ui/backupRestoreDialog";
import { openAudioTestDialog } from "@/editor/panels/audioTestDialog";
import { openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { renderAiConnectionChip } from "@/editor/panels/aiConnectionChip";
import {
  AI_STUDIO_CHANGE_EVENT,
  readStudioMode,
  requestAiStudioToggle,
} from "@/editor/aiStudioMode";
import { openHelpModal } from "@/editor/panels/helpModal";
import { openDatabaseModalLazy, scheduleDatabaseModalPrefetch } from "@/editor/panels/databaseModalLazy";
import { renderDbConnectionStatus } from "@/editor/panels/dbConnectionStatus";
import { openMapEventSearchModal } from "@/editor/panels/mapEventSearchModal";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { openWorldPanel } from "@/editor/panels/worldEntries";
import { deserialize, ProjectFormatError } from "@/project/io";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import {
  createProjectPackage,
  ProjectPackageError,
  projectPackageFileName,
  readProjectPackage,
  LEGACY_RPGZZU_MIME,
  OPRN_MIME,
} from "@/project/package";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { createStandaloneHtmlExport } from "@/project/standaloneExport";
import { openPublishingDialog } from "./publishingDialog";
import { createWebPlayerExportPackage, webExportFileName } from "@/project/webExport";
import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";
import { store, type AutoSaveState } from "@/project/store";
import type { Project } from "@/project/types";
import { downloadBlob } from "@/util/downloadBlob";
import { clearChildren, el } from "@/util/dom";
import { createLogger } from "@/util/logger";
import { toast } from "@/util/toast";
import { projectRepository } from "@/project/persistence/repository";
import { sameProjectTarget } from "@/project/persistence/target";
import { persistenceSurfaceVisible } from "@/editor/persistenceRecoveryUi";
import { reloadProjectFromDbNow, saveProjectNow } from "@/editor/saveActions";
import { uiLabel, type UiCopyKey } from "@/editor/uiCopy";
import { requestCommandPalette } from "@/editor/panels/commandPalette";
import { makeSvgIcon, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { installToolbarOverflow } from "@/editor/panels/toolbarOverflow";
import { renderWorkspaceBar } from "@/editor/panels/workspaceBar";
import { toolbarButton } from "./menuToolbar";
import { renderCommitHistoryButton, renderIdentityTopbarControl } from "@/editor/teamWorkflowUi";
import { claimTransientLayer, releaseTransientLayer } from "@/editor/ui/transientLayer";

// ── 스튜디오 바 (2026-09-03) ──────────────────────────────────────────────────────────────
// 표준·전문가 셸의 톱바는 **한 줄**이다. 그 전에는 메뉴 4개 + 작업 칩 4개 + 보기 + Ctrl K +
// 오른쪽 8개가 같은 무게의 글자 버튼으로 한 줄에 18개 놓였고, 전문가는 그 아래 67px 짜리
// 클래식 툴바 행(15개, 그중 14개가 메뉴 항목의 복제)이 하나 더 있었다. 같은 동작의 집이 넷
// (테스트 실행: 작업 칩·▶ 버튼·게임 메뉴·클래식 툴바)까지 갔다.
//
// 지금의 규칙 — 한 동작의 집은 하나, 자리는 빈도로 정한다:
//   • 왼쪽  = 파일·자료. 프로젝트 이름(▾ 메뉴) · 저장(자동 저장 점) · 자료집 · 소재 · 도구.
//   • 가운데 = 명령 팔레트(Ctrl K). 전체 검색이라 한 집 규칙의 예외다.
//   • 오른쪽 = 실행·화면·세션. ▶ 테스트|⚔ · 스튜디오 · 보기 ▾ · 도움말 · 기록 · 신원 · AI 설정 · 전체화면.
// 삭제한 것: 게임 메뉴(두 항목이 모두 오른쪽 버튼의 복제), 전문가 클래식 툴바 행, 툴바 접기,
// 작업 칩(레이어 전환·자료집 버튼·▶ 테스트의 복제). 맵 메뉴는 2026-08-26 에 같은 이유로 사라졌다.
// 초보/표준/전문가 편집 모드는 2026-09-27 에 없앴다 — 편집기 화면은 하나다. 초보 전용이던
// 「도구 ▾」 메뉴도 그때 걷었다(자료집·소재·세계관·음악·찾기가 모두 인라인 버튼이다).

type MenuId = "project" | "help";

const autoSaveLog = createLogger("autosave");

type MenuCommand =
  | { readonly kind: "item"; readonly disabled?: boolean; readonly label: string; readonly icon?: SvgIconName; readonly onClick: () => void; readonly testId: string }
  | { readonly kind: "submenu"; readonly label: string; readonly popupId: string; readonly testId: string; readonly commands: () => readonly MenuCommand[] }
  | { readonly kind: "separator" };

let activeMenuPopup: HTMLElement | null = null;
let popupOutsideListener: (() => void) | null = null;
let popupPositionCleanup: (() => void) | null = null;
let activeMenuTrigger: HTMLElement | null = null;
// renderTopbar가 재실행될 때마다 classicPlayToolbarRow가 새 row에 installToolbarOverflow를
// 걸므로, 이전 호출이 남긴 document 리스너/ResizeObserver를 재구축 직전에 반드시 해제해야
// 세션 내 리스너 누적을 막을 수 있다.
let disposeToolbarOverflows: (() => void)[] = [];
// 저장 상태 칩의 autosave 구독도 같은 이유로 재구축 직전에 끊는다. renderTopbar는 한 세션에서
// 여러 번 불린다(mode.ts: 편집 상태 구독 / enterMode / 신원·워크스페이스·UI모드 구독) —
// 구독을 끊지 않으면 편집 몇 분 만에 같은 리스너가 수십 개 쌓여 죽은 DOM을 계속 그린다.
let disposeSaveStatus: (() => void) | null = null;
// 저장 버튼의 자동 저장 점을 그리는 함수. 구독은 renderTopbarSaveStatus 의 하나만 살아 있어야 하므로
// (test/saveStatusVisibility: 재렌더마다 이전 구독을 끊고 살아 있는 구독은 항상 1개) 점은 그 구독에 얹는다.
let paintSaveDot: ((state: AutoSaveState) => void) | null = null;
let disposeLayerSwitcher: (() => void) | null = null;
let disposeStudioButton: (() => void) | null = null;
let disposeAiConnectionChip: (() => void) | null = null;
let disposeFullscreenButton: (() => void) | null = null;
let lastLoggedAutoSaveKind: AutoSaveState["kind"] | null = null;
// 실패 에피소드가 진행 중인가. error 로 켜지고 saved/idle 로 꺼진다 — 재시도 중(saving)에도
// 칩을 붙잡아 두는 데 쓴다. 톱바가 다시 그려져도 에피소드는 이어져야 하므로 모듈 상태다.
let saveFailureEpisode = false;

export function renderTopbar(topbar: HTMLElement): void {
  // 메뉴 모듈이 잡히면 이미 읽기 시작한다. 톱바가 다시 그려져도 한 번만이다.
  scheduleDatabaseModalPrefetch();
  const focusSnapshot = captureFocus(topbar);
  for (const dispose of disposeToolbarOverflows) dispose();
  disposeToolbarOverflows = [];
  disposeSaveStatus?.();
  disposeSaveStatus = null;
  paintSaveDot = null;
  disposeLayerSwitcher?.();
  disposeLayerSwitcher = null;
  disposeStudioButton?.();
  disposeStudioButton = null;
  disposeAiConnectionChip?.();
  disposeAiConnectionChip = null;
  disposeFullscreenButton?.();
  disposeFullscreenButton = null;
  while (topbar.firstChild) topbar.removeChild(topbar.firstChild);
  const mode = getMode();
  const menuBar = el("div", {
    class: "oprn-menu-bar editor-studio-menubar studio-bar",
    dataset: { testid: "oprn-menu-bar" },
  });

  // 왼쪽 — 파일·자료 묶음.
  const lead = el("div", { class: "studio-bar-lead", dataset: { testid: "studio-bar-lead" } });
  const projectLabel = projectMenuLabel();
  lead.append(
    renderProductBrand(),
    renderMenu("project", projectLabel, menuCommands("project", topbar), { chevron: true, className: "studio-project-button", title: `프로젝트 — ${projectLabel}` }),
    renderSaveButton(),
    renderTopbarSaveStatus(topbar),
    toolButton({ testId: "toolbar-database", icon: "database", label: headerLabel("databaseShort"), title: headerLabel("database"), onClick: () => openDatabaseModalLazy() }),
    toolButton({ testId: "toolbar-resource-manager", icon: "image", label: headerLabel("resources"), title: headerLabel("resourceLibrary"), onClick: () => openResourceModal() }),
    toolButton({ testId: "toolbar-world", icon: "globe", title: headerLabel("world"), onClick: () => openWorldPanel() }),
    toolButton({ testId: "toolbar-sound-test", icon: "music", title: headerLabel("audio"), onClick: () => openAudioTestDialog() }),
    toolButton({ testId: "toolbar-search", icon: "docSearch", title: headerLabel("mapEventSearch"), onClick: () => openMapEventSearchModal() }),
  );
  if (mode === "edit") {
    const resources = lead.querySelector<HTMLElement>('[data-testid="toolbar-resource-manager"]');
    const layers = makeLeftLayerSwitcher(layerSwitcherKey(editorState.get()));
    layers.classList.add("header-layer-switcher");
    let paintedKey = layerSwitcherKey(editorState.get());
    disposeLayerSwitcher = editorState.subscribe((state) => {
      const key = layerSwitcherKey(state);
      // 켜진 칸이 그대로면(맵 전환·타일 선택 등) 단추를 훑지 않는다.
      if (key === paintedKey) return;
      paintedKey = key;
      const keepFocus = layers.contains(document.activeElement);
      for (const button of layers.querySelectorAll<HTMLButtonElement>("button")) {
        const active = button.dataset.sidebarLayer === key;
        button.classList.toggle("is-active", active);
        if (active) button.setAttribute("aria-current", "true");
        else button.removeAttribute("aria-current");
        if (!keepFocus) button.tabIndex = active ? 0 : -1;
      }
    });
    const resourceIndex = resources ? Array.from(lead.children).indexOf(resources) : -1;
    lead.insertBefore(layers, resourceIndex >= 0 ? lead.children[resourceIndex + 1] ?? null : null);
  }
  menuBar.append(lead);

  // 가운데 — 명령 팔레트.
  menuBar.append(el("div", { class: "studio-bar-center", children: [renderCommandCenter()] }));

  // 오른쪽 — 실행·화면·세션.
  const trailing = el("div", {
    class: "editor-topbar-trailing",
    dataset: { testid: "editor-topbar-trailing" },
  });
  if (mode === "edit") {
    trailing.append(
      el("div", {
        class: "studio-run-group",
        attrs: { role: "group", "aria-label": "실행" },
        dataset: { testid: "studio-run-group" },
        children: [renderTestPlayButton(), renderQuickBattleTestButton()],
      }),
      renderTopbarStudioButton(),
    );
  } else {
    trailing.append(renderQuickBattleTestButton());
  }
  const [panelsButton, panelsMenu] = renderWorkspaceBar();
  trailing.append(panelsButton, panelsMenu);
  const cluster = el("div", { class: "studio-icon-cluster", dataset: { testid: "studio-icon-cluster" } });
  cluster.append(renderMenu("help", "도움말", menuCommands("help", topbar), { icon: "help", className: "studio-icon-button" }));
  cluster.append(renderCommitHistoryButton(), renderTopbarIdentityControl(topbar));
  if (mode === "edit") cluster.append(renderTopbarAiSettingsButton(), renderTopbarAiConnectionChip());
  cluster.append(renderFullscreenButton());
  trailing.append(cluster);
  menuBar.append(trailing);

  topbar.append(menuBar);
  restoreFocus(topbar, focusSnapshot);
  installDelayedTooltips(topbar);
  // 플레이 모드(편집기 안에서 게임이 도는 상태)에서만 「편집으로 돌아가기」 줄을 하나 더 둔다.
  // 편집 모드의 클래식 툴바 행은 2026-09-03 에 걷었다 — 15개 중 14개가 메뉴 항목의 복제였다.
  if (mode !== "edit") {
    const toolbar = el("div", {
      class: "oprn-toolbar classic-toolbar",
      dataset: { testid: "oprn-toolbar", uiDensity: "play" },
    });
    toolbar.append(classicPlayToolbarRow(mode));
    topbar.append(toolbar);
  }
}

/** 프로젝트 메뉴의 얼굴은 프로젝트 이름이다 — 지금 어느 프로젝트를 만지는지 톱바가 말해야 한다. */
export function projectMenuLabel(): string {
  const title = store.getCurrent().meta?.title?.trim();
  return title && title.length > 0 ? title : "제목 없는 프로젝트";
}

/**
 * 저장 버튼 + 자동 저장 점. 저장 상태는 예전에 오류일 때만 칩으로 보였다(평상시 pending·saving 은
 * 281px 칩이 옆 버튼을 밀어서 접었다). 점은 폭이 고정이라 레이아웃을 흔들지 않으면서 저장됨(초록)·
 * 저장 중(호박)·오류(빨강)를 말한다. title 은 e2e 계약대로 정확히 「프로젝트 저장 (Ctrl+S)」다.
 */
function renderSaveButton(): HTMLElement {
  const dot = el("span", { class: "studio-save-dot", attrs: { "aria-hidden": "true" } });
  const status = el("span", { class: "visually-hidden", dataset: { testid: "toolbar-save-autosave" } });
  const button = el("button", {
    class: "studio-icon-button studio-save-button",
    attrs: { type: "button", title: "프로젝트 저장 (Ctrl+S)", "aria-label": "프로젝트 저장 (Ctrl+S)", "aria-keyshortcuts": "Control+S" },
    dataset: { testid: "toolbar-save" },
    children: [makeSvgIcon("save"), dot, status],
    on: { click: () => void saveProjectNow() },
  });
  const paint = (state: AutoSaveState): void => {
    // 저장하지 않는 세션은 빨간 오류 점이 아니라 회색 「저장 안 함」 점이다(배너가 이유를 말한다).
    button.dataset.autosaveKind = isSessionNotPersisted(state) ? "unsaved-session" : state.kind;
    status.textContent = autosaveStatusText(state);
  };
  paint(store.getAutoSaveState());
  paintSaveDot = paint;
  return button;
}

/** 임시·예제 세션처럼 애초에 저장하지 않는 자리. 실패가 아니므로 오류 표시를 띄우지 않는다. */
function isSessionNotPersisted(state: AutoSaveState): boolean {
  return state.kind === "error" && state.code === "session-not-persisted";
}

export function autosaveStatusText(state: AutoSaveState): string {
  switch (state.kind) {
    case "saved": {
      const at = new Date(state.at);
      const hh = String(at.getHours()).padStart(2, "0");
      const mm = String(at.getMinutes()).padStart(2, "0");
      return `자동 저장됨 ${hh}:${mm}`;
    }
    case "pending":
    case "saving":
      return "저장 중";
    case "error":
      return state.code === "session-not-persisted" ? "이 세션은 저장 안 됨" : "자동 저장 실패";
    default:
      return "변경 없음";
  }
}


type ToolButtonSpec = {
  readonly testId: string;
  readonly icon: SvgIconName;
  /** 없으면 아이콘만 — title 이 이름이다. */
  readonly label?: string;
  readonly title: string;
  readonly onClick: () => void;
};

function toolButton(spec: ToolButtonSpec): HTMLElement {
  const iconOnly = spec.label === undefined;
  return el("button", {
    class: iconOnly ? "studio-icon-button studio-tool-button" : "studio-tool-button",
    attrs: { type: "button", title: spec.title, "aria-label": spec.label ?? spec.title },
    dataset: { testid: spec.testId },
    children: iconOnly
      ? [makeSvgIcon(spec.icon)]
      : [makeSvgIcon(spec.icon), el("span", { class: "studio-tool-button-label", text: spec.label })],
    on: { click: spec.onClick },
  });
}

/**
 * 가운데 명령 팔레트 칩. 이름은 팔레트가 실제로 색인하는 것에서 나온다 — `commandPalette.ts` 의
 * KIND_HEADERS 는 `command`(명령)와 `map`(맵 이동) 둘뿐이다. 「찾기」라는 말은 쓰지 않는다:
 * 헤더의 찾기 표면은 맵·이벤트 찾기 하나여야 한다(test/editorHeaderTerminology).
 */
function renderCommandCenter(): HTMLElement {
  return el("button", {
    class: "oprn-menu-item workspace-command-chip studio-command-center",
    attrs: {
      type: "button",
      title: "명령 팔레트 — 명령 실행 · 맵 이동 (Ctrl+K)",
      "aria-label": "명령 팔레트 열기 (Ctrl+K)",
      "aria-keyshortcuts": "Control+K",
    },
    dataset: { testid: "workspace-command-palette-button" },
    children: [
      el("span", { class: "workspace-command-chip-icon", attrs: { "aria-hidden": "true" }, children: [makeSvgIcon("command")] }),
      el("span", { class: "workspace-command-chip-label", text: "명령 · 맵 이동", attrs: { "aria-hidden": "true" } }),
      el("span", { class: "workspace-command-chip-key", text: "Ctrl K", attrs: { "aria-hidden": "true" } }),
    ],
    on: {
      click: (event) => {
        event.stopPropagation();
        requestCommandPalette();
      },
    },
  });
}

function renderProductBrand(): HTMLElement {
  return el("div", {
    class: "editor-product-brand",
    dataset: { testid: "editor-product-brand" },
    attrs: { title: PRODUCT_BRAND },
    children: [
      el("span", { class: "editor-product-brand-mark", attrs: { "aria-hidden": "true" }, text: "✦" }),
      el("span", { class: "editor-product-brand-text", text: PRODUCT_BRAND }),
    ],
  });
}

function renderTopbarStudioButton(): HTMLElement {
  const paint = (button: HTMLButtonElement, open: boolean): void => {
    button.classList.toggle("is-on", open);
    button.setAttribute("aria-pressed", String(open));
    button.setAttribute("title", open ? "스튜디오 닫고 타일 편집으로" : "AI 스튜디오 — 장면 모니터와 조수");
  };
  const button = el("button", {
    class: "topbar-ai-studio",
    attrs: {
      type: "button",
      "aria-label": "AI 스튜디오",
      "aria-pressed": "false",
      title: "AI 스튜디오 — 장면 모니터와 조수",
    },
    dataset: { testid: "topbar-ai-studio" },
    children: [
      el("span", { class: "topbar-ai-studio-icon", attrs: { "aria-hidden": "true" }, text: "✦" }),
      el("span", { class: "topbar-ai-studio-label", text: "스튜디오" }),
    ],
    on: { click: () => requestAiStudioToggle() },
  }) as HTMLButtonElement;
  paint(button, readStudioMode());
  const onChange = (event: Event): void => {
    const detail = event instanceof CustomEvent ? event.detail as { open?: boolean } | undefined : undefined;
    paint(button, typeof detail?.open === "boolean" ? detail.open : readStudioMode());
  };
  if (typeof window !== "undefined") {
    window.addEventListener(AI_STUDIO_CHANGE_EVENT, onChange);
    disposeStudioButton = () => window.removeEventListener(AI_STUDIO_CHANGE_EVENT, onChange);
  }
  return button;
}

function renderTopbarAiSettingsButton(): HTMLElement {
  // 2026-09-03 까지는 「⚙ AI 설정」 글자 버튼(81px, 강조 배경)이었다. 연결이 안 된 첫 사용은 조수
  // 패널의 「연결하기」 카드가 이미 안내하므로, 톱바에서는 세션 묶음의 아이콘 하나로 충분하다.
  return el("button", {
    class: "studio-icon-button topbar-ai-settings-button",
    attrs: { type: "button", title: "AI 설정", "aria-label": "AI 설정 열기" },
    dataset: { testid: "topbar-ai-settings" },
    children: [makeSvgIcon("gear"), el("span", { class: "visually-hidden", text: "AI 설정" })],
    on: { click: () => openAiSettingsModal() },
  });
}

/**
 * AI 연결 상태를 톱바에 **상시** 보여 준다.
 *
 * 위 주석(2026-09-03)의 판단 — "연결이 안 된 첫 사용은 조수 패널의 「연결하기」 카드가 이미
 * 안내하므로 톱바에는 아이콘 하나로 충분하다" — 은 실측으로 뒤집혔다(2026-09-22):
 * 편집기 첫 화면 어디에도 연결 상태가 없었고("연결됨"·"확인 중"·"ChatGPT" 문자열 0건),
 * 사용자는 첫 문장을 보내고 나서야 — 그것도 "의도 읽는 중…" 에서 멈춘 뒤에야 — 알았다.
 * 이 앱에서 AI 는 핵심 시스템이므로 상태가 사후에만 보이면 안 된다.
 */
function renderTopbarAiConnectionChip(): HTMLElement {
  disposeAiConnectionChip?.();
  const chip = renderAiConnectionChip(() => openAiSettingsModal());
  disposeAiConnectionChip = chip.dispose;
  return chip.element;
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
    paintSaveDot?.(state);
  });
  return host;
}

function paintSaveStatus(host: HTMLElement, topbar: HTMLElement): void {
  const state = store.getAutoSaveState();
  const recovery = store.getPersistenceRecovery();
  // 평상시의 pending·saving 은 접는다 — 실측(브라우저 캡처): 칩 폭이 281px 이라 타일 한 칸
  // 칠할 때마다 pending 으로 떴다가 4초 뒤 사라지면서 바로 옆 `테스트`·`AI 설정` 버튼이 그만큼
  // 좌우로 튄다. 그리는 중에 버튼이 커서 밑에서 움직이는 건 오히려 오조작을 만든다. 진행 상황은
  // 명시적 저장(Ctrl+S)의 토스트가, 미저장 종료는 beforeunload 경고가 이미 알려준다.
  //
  // 단, **실패 에피소드가 시작된 뒤**의 pending·saving 은 계속 보여 준다. 그러지 않으면
  // `다시 저장`을 누른 직후 칩이 사라졌다가 빨간 채로 다시 나타나 사용자가 결과를 오해한다.
  //
  // 저장하지 않는 세션(임시·예제)은 실패가 아니다. 빨간 칩 + 「다시 저장」을 띄우면 눌러도 소용없는
  // 버튼을 권하게 되고, 톱바 폭이 좁을 땐 「온. 이.」처럼 잘려 읽을 수도 없다(2026-09-24 visual QA).
  // 이유와 내보내기는 임시 세션 배너가 이미 말하므로 톱바는 조용히 두고 저장 점만 회색으로 칠한다.
  const notPersisted = isSessionNotPersisted(state);
  if ((state.kind === "error" && !notPersisted) || recovery.kind === "blocked") saveFailureEpisode = true;
  else if (state.kind === "saved" || state.kind === "idle" || notPersisted) saveFailureEpisode = false;
  const quiet = (state.kind !== "error" || notPersisted) && !saveFailureEpisode && !persistenceSurfaceVisible(recovery);
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
  if (state.kind === "error" && !isSessionNotPersisted(state)) {
    autoSaveLog.error("자동 저장 실패 — 톱바 저장 상태 칩에 노출한다", {
      message: state.message,
      retryCount: state.retryCount ?? 0,
    });
    return;
  }
  autoSaveLog.debug(`자동 저장 상태 → ${state.kind}`, state.kind === "saved" ? { at: state.at } : undefined);
}

/** 「브라우저 e373」 식 세션 라벨이면 세션 id 를, 아니면 null. */
function browserSessionIdOf(label: string): string | null {
  return label.trim().match(/^브라우저\s+(.+)$/u)?.[1] ?? null;
}

// 첫 사용자에게 「게스트 세션 e373」 의 id 는 의미 없는 잡음이다 — 라벨은 「게스트」 만,
// id 는 디버깅용으로 툴팁(title)에만 남긴다.
export function readableTopbarIdentityLabel(label: string): string {
  return browserSessionIdOf(label) ? "게스트" : label.trim();
}

function renderTopbarIdentityControl(topbar: HTMLElement): HTMLElement {
  const control = renderIdentityTopbarControl(() => renderTopbar(topbar));
  const label = control.querySelector<HTMLElement>("[data-testid='topbar-identity-label']");
  if (label) {
    const raw = label.textContent ?? "";
    const readable = readableTopbarIdentityLabel(raw);
    label.textContent = readable;
    const accessibleName = `편집 신원 — ${readable}`;
    const sessionId = browserSessionIdOf(raw);
    control.setAttribute("title", sessionId ? `${accessibleName} (세션 ${sessionId})` : accessibleName);
    control.setAttribute("aria-label", accessibleName);
  }
  return control;
}

type RenderMenuOptions = {
  /** 아이콘만 — 라벨은 visually-hidden 으로 남긴다(테스트·스크린리더가 이름으로 잡는다). */
  readonly icon?: SvgIconName;
  readonly chevron?: boolean;
  readonly className?: string;
  readonly title?: string;
};

function renderMenu(id: MenuId, label: string, commands: readonly MenuCommand[], options: RenderMenuOptions = {}): HTMLElement {
  const children: Node[] = [];
  if (options.icon) {
    children.push(makeSvgIcon(options.icon), el("span", { class: "visually-hidden", text: label }));
  } else {
    children.push(el("span", { class: "oprn-menu-item-label", text: label }));
    if (options.chevron) children.push(el("span", { class: "oprn-menu-item-chevron", attrs: { "aria-hidden": "true" }, children: [makeSvgIcon("chevronDown")] }));
  }
  return el("button", {
    class: `oprn-menu-item${options.className ? ` ${options.className}` : ""}`,
    attrs: {
      type: "button",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
      ...(options.title ? { title: options.title } : options.icon ? { title: label } : {}),
      ...(options.icon ? { "aria-label": label } : {}),
    },
    dataset: { testid: `menu-${id}` },
    children,
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

/**
 * 전체화면 하나만 남는다. 「툴바 접기(─)」는 편집 모드 클래식 툴바 행을 접는 버튼이었는데 그 행이
 * 사라졌다(2026-09-03). 브라우저 탭은 스크립트로 안정적으로 닫을 수 없어 닫기 컨트롤도 없다.
 */
function renderFullscreenButton(): HTMLElement {
  const button = el("button", {
    class: "studio-icon-button oprn-window-control",
    attrs: { type: "button", title: "전체화면 전환", "aria-label": "전체화면 전환", "aria-pressed": document.fullscreenElement ? "true" : "false" },
    dataset: { testid: "window-fullscreen" },
    children: [makeSvgIcon("expand")],
    on: {
      click: (event) => {
        event.stopPropagation();
        void toggleFullscreen();
      },
    },
  });
  const paint = (fullscreen: boolean): void => button.setAttribute("aria-pressed", String(fullscreen));
  const onChange = (): void => paint(Boolean(document.fullscreenElement));
  document.addEventListener("fullscreenchange", onChange);
  // 데스크톱 창의 네이티브 전체화면은 fullscreenchange 를 일으키지 않는다 — 상태를 따로 구독한다.
  const nativeSubscribe = typeof window === "undefined" ? undefined : window.oprn?.onWindowFullscreen;
  const disposeNative = nativeSubscribe ? nativeSubscribe(paint) : null;
  const nativeQuery = typeof window === "undefined" ? undefined : window.oprn?.windowFullscreen;
  if (nativeQuery) void nativeQuery().then(paint).catch(() => {});
  disposeFullscreenButton = () => {
    document.removeEventListener("fullscreenchange", onChange);
    disposeNative?.();
  };
  return button;
}

async function toggleFullscreen(): Promise<void> {
  // 이 창은 네이티브 전체화면(fullscreen: true)으로 뜬다. 그 창에서 브라우저 Fullscreen API 는
  // DOM 만 바꾸고 창 크기는 그대로여서 「축소」가 안 됐다 — 데스크톱 브릿지가 있으면
  // 시작 화면 「화면 전환」 과 같은 창 컨트롤로 토글한다. 브라우저·팀 페이지에는 브릿지가 없다.
  const nativeControl = typeof window === "undefined" ? undefined : window.oprn?.windowControl;
  if (nativeControl) {
    try {
      if (await nativeControl("toggle-fullscreen")) return;
    } catch {
      // 브릿지 호출이 실패하면 아래 브라우저 경로로 내려간다.
    }
  }
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

const MENU_LAYER_OWNER = {};

function openMenuPopup(id: string, button: HTMLElement, commands: readonly MenuCommand[]): void {
  const alreadyOpen = activeMenuPopup?.dataset.testid === `menu-popup-${id}`;
  closeMenuPopup();
  if (alreadyOpen) return;
  button.setAttribute("aria-expanded", "true");
  claimTransientLayer(MENU_LAYER_OWNER, () => closeMenuPopup());
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
      class: `oprn-menu-command${command.icon ? " has-icon" : ""}`,
      attrs: { role: "menuitem" },
      dataset: { testid: command.testId },
      children: command.icon
        ? [el("span", { class: "oprn-menu-command-icon", attrs: { "aria-hidden": "true" }, children: [makeSvgIcon(command.icon)] }), el("span", { class: "oprn-menu-command-label", text: command.label })]
        : [el("span", { class: "oprn-menu-command-label", text: command.label })],
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
  releaseTransientLayer(MENU_LAYER_OWNER);
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
      // 「저장」은 톱바의 저장 버튼(toolbar-save, Ctrl+S)이 집이다 — 여기엔 두지 않는다.
      return [
        item("새 프로젝트", "menu-project-new", () => void newProject()),
        ...(store.getCurrent().gameDesignBrief ? [item("게임 기획...", "menu-project-design-brief", () => void editGameDesignBrief())] : []),
        item("열기", "menu-project-load", () => void doLoad()),
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
        item("백업 만들기", "menu-project-backup", () => void doBackupProject()),
        item("백업에서 복구...", "menu-project-restore-backup", () => void doRestoreBackup()),
        item("게임 및 배포...", "menu-project-publication", () => void openPublishingDialog({
          project: store.getCurrent(),
          opener: topbar.querySelector<HTMLElement>('[data-testid="menu-project"]'),
          apply: publication => store.update(project => { project.meta.publication = publication; }, { scope: "project", label: "게임 배포 설정" }),
          exportZip: doExportWebGame, exportHtml: doExportStandaloneHtml,
        })),
        item("웹 게임 내보내기...", "menu-project-export-web", () => void doExportWebGame()),
        item("실행형 HTML 내보내기...", "menu-project-export-standalone", () => void doExportStandaloneHtml()),
      ];
    case "help":
      return [
        item("단축키 · 도움말", "menu-help-shortcuts", () => openHelpModal()),
        item("정보", "menu-help-about", () => toast(`${PRODUCT_BRAND} — ${PRODUCT_TAGLINE}`, "ok")),
      ];
  }
}

/** 예제 프로젝트 하위 메뉴 — 전부 「현재 작업을 지우고 시작」 확인을 거치는 로더다.
 * 지운 칩셋 위의 데모(이슬 마을·천공의 계단·학습 예시·설산·얼음 평원·포켓몬풍·농장)는 2026-10-07 저작권 정리로 뺐다. */
function sampleProjectCommands(): readonly MenuCommand[] {
  return [
    item("Scarloxy 몬스터 초원 데모", "menu-project-scarloxy-demo", () => void newScarloxyDemoProject()),
  ];
}

/**
 * 헤더 문구의 단일 진입점. 헤더는 메뉴바·톱바·클래식 툴바가 같은 개념을 같은 말로 불러야
 * 하므로 한국어를 여기서 새로 적지 않고 `uiCopy` 표에서 읽는다.
 * title/aria-label 은 언제나 정본 키를, label 은 정본 또는 `*Short` 축약형을 쓴다.
 */
function headerLabel(key: UiCopyKey): string {
  return uiLabel(key);
}

function item(label: string, testId: string, onClick: () => void, icon?: SvgIconName): MenuCommand {
  return icon ? { kind: "item", label, testId, onClick, icon } : { kind: "item", label, testId, onClick };
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
          title: headerLabel("testPlay"),
          "aria-label": headerLabel("testPlay"),
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
          el("span", { class: "topbar-test-play-label", text: headerLabel("testPlayShort") }),
        ],
      }),
    ],
  });
}

function renderQuickBattleTestButton(): HTMLElement {
  return el("button", {
    class: "team-history-button is-icon-only quick-battle-test-button studio-icon-button",
    attrs: {
      type: "button",
      title: `${headerLabel("battleTest")} — 적 그룹을 뽑아 즉시 전투`,
      "aria-label": headerLabel("battleTest"),
    },
    dataset: { testid: "topbar-battle-test" },
    children: [makeSvgIcon("combat")],
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
    label: mode === "edit" ? headerLabel("testPlayShort") : "편집",
    title: mode === "edit" ? headerLabel("testPlay") : "편집기로 돌아가기",
    icon: mode === "edit" ? "play" : "pencil",
    primary: true,
    onClick: () => {
      if (mode === "edit") void openTestPlayWindow();
      else toggleMode();
    },
  });
}

let creatingProject = false;
async function newProject(): Promise<void> {
  if (creatingProject) return;
  creatingProject = true;
  try { await createProjectFromDialog(); } finally { creatingProject = false; }
}

async function editGameDesignBrief(): Promise<void> {
  const initialBrief = store.getCurrent().gameDesignBrief;
  if (!initialBrief) return;
  const identity = JSON.stringify(store.getProjectIdentity());
  const { showProjectInterview } = await import("@/editor/ui/projectInterviewDialog");
  const brief = await showProjectInterview(initialBrief.presetId, { initialBrief, confirmLabel: "기획 저장" });
  if (!brief || identity !== JSON.stringify(store.getProjectIdentity())) return;
  const { recordProjectSnapshot } = await import("@/editor/mapEditHistory");
  recordProjectSnapshot("게임 기획 수정");
  store.update(project => { project.gameDesignBrief = brief; }, { scope: "project", label: "게임 기획 수정", origin: "human" });
  if (!(await saveProjectNow())) return;
  const { prefillAiAssistantInput } = await import("@/editor/aiBootIntent");
  const { welcomeGenrePresetById, buildWelcomeGenrePresetPrompt, welcomeGenrePresetDisplayText } = await import("@/editor/welcomeGenrePresets");
  const preset = welcomeGenrePresetById(brief.presetId);
  const prefilled = preset && prefillAiAssistantInput(buildWelcomeGenrePresetPrompt(preset, brief), {
    preserveDraft: true,
    displayText: welcomeGenrePresetDisplayText(preset, brief),
  });
  toast(prefilled
    ? "기획을 저장했습니다. 조수 입력창에서 작업 범위를 확인한 뒤 보낼 수 있습니다."
    : "기획을 저장했습니다. 다음 AI 대화부터 이 기획을 참고합니다.", "ok");
}

async function createProjectFromDialog(): Promise<void> {
  // 2026-10-07: 새 프로젝트 = 새 게임 = 컨셉 피드(src/start/conceptFeed). 런처와 같은 화면을 덮는 창으로 연다.
  // 이름·폴더·화면 크기는 묻지 않는다. 만들기는 새 폴더에 씨앗 + 확정 기획을 저장하고 다시 읽는다(src/editor/conceptMake.ts).
  const { openConceptFeedOverlay } = await import("@/editor/conceptFeedOverlay");
  await openConceptFeedOverlay("menu");
}

async function newScarloxyDemoProject(): Promise<void> {
  if (!(await showConfirm({ title: "Scarloxy 데모", message: "현재 작업을 지우고 Scarloxy 몬스터 초원 데모 프로젝트를 시작할까요?", confirmLabel: "시작", danger: true }))) return;
  store.replaceProject(createScarloxyDemoProject());
  focusLoadedProjectStartMap();
  toast("Scarloxy 몬스터 초원 데모를 불러왔습니다", "ok");
}

function focusLoadedProjectStartMap(): void {
  void import("@/editor/mapSelection").then(({ focusProjectStartMap }) => {
    focusProjectStartMap();
  });
}

async function openTestPlayWindow(): Promise<void> {
  // flush 는 openTestPlayModal 이 창을 먼저 띄운 뒤 진행(로딩 UI 표시).
  window.dispatchEvent(new CustomEvent("oprn:test-play-window"));
}
async function reloadProjectFromDb(_topbar: HTMLElement): Promise<void> {
  if (store.hasUnsavedChanges()) {
    const ok = await showConfirm({
      title: "저장본 다시 불러오기",
      message: "아직 저장하지 않은 변경이 있습니다. 프로젝트 폴더의 저장본으로 다시 불러올까요?",
      confirmLabel: "저장본으로 덮어쓰기",
      danger: true,
    });
    if (!ok) return;
    await reloadProjectFromDbNow({ force: true });
    return;
  }
  await reloadProjectFromDbNow();
}

async function doLoad(): Promise<void> {
  const { openProjectFolder } = await import("@/editor/projectFolderActions");
  let opened: boolean;
  try {
    opened = await openProjectFolder();
  } catch (error) {
    toast(error instanceof Error ? error.message : "폴더를 열지 못했습니다.", "error");
    return;
  }
  if (!opened) {
    toast("프로젝트 서버에 연결되지 않았습니다. 내부 IP의 프로젝트 호스트 주소로 다시 접속하세요.", "error");
    return;
  }
  window.location.reload();
}

// 프로젝트 내보내기(도그푸딩 결함 ⑪ 수리). 과거 결함 ①: `await store.flush()`가 저장 오류 시
// reject → 함수 전체가 무반응으로 중단(다운로드 없음). anchor 부착·revoke 지연(과거 결함 ②③)은
// downloadBlob 로 옮겼다.
/** 폴더 정본을 사본으로 남긴다 — 파일을 가진 어댑터(앱·로컬 서버)만 제공한다. */
async function doBackupProject(): Promise<void> {
  const repository = projectRepository();
  if (!repository.backup) {
    toast("이 저장소에서는 백업을 만들 수 없습니다", "error");
    return;
  }
  try {
    const saved = await store.flush();
    if (saved.kind !== "saved") throw new Error("현재 변경을 저장하지 못했습니다. 다시 저장하거나 프로젝트 파일을 내보내세요.");
    toast(`백업을 만들었습니다: ${await repository.backup()}`, "ok");
  } catch (error) {
    toast(error instanceof Error ? `백업 실패: ${error.message}` : "백업 실패", "error");
  }
}

let restoringBackup = false;
async function doRestoreBackup(): Promise<void> {
  if (restoringBackup) return;
  const repository = projectRepository();
  if (!repository.listBackups || !repository.restoreBackup) {
    toast("프로젝트 폴더를 사용하는 앱 또는 호스트에서 백업을 복구할 수 있습니다.", "error");
    return;
  }
  const target = repository.currentTarget();
  const requireSameTarget = (): void => {
    const active = repository.currentTarget();
    if (!target || !sameProjectTarget(target, active) || active?.projectId !== target.projectId) {
      throw new Error("복구 중 열린 프로젝트가 바뀌었습니다. 현재 프로젝트는 유지됩니다. 복구 사본은 ‘열기’에서 선택하세요.");
    }
  };
  restoringBackup = true;
  try {
    const backups = await repository.listBackups();
    if (!backups.length) {
      await showAlert({ title: "복구할 백업이 없습니다", message: "프로젝트 메뉴의 ‘백업 만들기’로 복구 지점을 남겨 두세요. 다른 폴더에 있는 백업이나 편집기를 열 수 없는 경우에는 복구 명령으로 새 폴더를 만들 수 있습니다." });
      return;
    }
    const id = await showBackupRestoreDialog(backups, { opener: document.querySelector<HTMLElement>('[data-testid="menu-project"]') });
    if (!id) return;
    requireSameTarget();
    toast("백업을 검사하고 복구 사본을 만들고 있어요…", { kind: "info", durationMs: 10000 });
    const restored = await repository.restoreBackup(id);
    requireSameTarget();
    // Recovery is still possible when saving the current session is broken. Keep that session
    // open so its in-memory edits can be exported before the user switches to the copy.
    try {
      const saved = await store.flush();
      if (saved.kind !== "saved") throw new Error("현재 변경을 저장하지 못했습니다.");
    } catch (error) {
      await showAlert({ title: "복구 사본을 만들었습니다", message: `복구 위치: ${restored.projectDir}\n${error instanceof Error ? error.message : "현재 변경을 저장하지 못했습니다."}\n이 화면은 유지됩니다. 프로젝트 파일을 내보내 변경을 보관한 뒤 ‘열기’에서 복구 사본을 선택하세요.` });
      return;
    }
    requireSameTarget();
    const opened = await window.oprn?.start.openFolder({ projectDir: restored.projectDir });
    if (!opened) throw new Error(`복구 사본을 열지 못했습니다: ${restored.projectDir}`);
    window.location.reload();
  } catch (error) {
    toast(error instanceof Error ? `복구 실패: ${error.message}` : "복구 실패", "error");
  } finally { restoringBackup = false; }
}

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

/**
 * 웹 서버 없이 더블클릭으로 도는 HTML 한 장. 웹 게임 내보내기와 재료는 같고, 에셋을 data URL 로
 * 문서 안에 넣는다는 점만 다르다 — `file://` 에서는 옆 파일도 못 읽기 때문이다.
 */
async function doExportStandaloneHtml(): Promise<void> {
  try {
    await store.flush().catch((error) => {
      console.error("[standalone-export] flush before export failed:", error);
      toast("저장은 실패했지만 현재 상태로 실행형 HTML 을 만듭니다", "info");
    });
    toast("실행형 HTML 을 만드는 중... (에셋을 문서에 넣느라 수십 초 걸립니다)", "info");
    const result = await createStandaloneHtmlExport(store.getCurrent());
    downloadBlob(result.blob, result.fileName);
    const size = (result.summary.htmlBytes / 1048576).toFixed(1);
    const missing = result.summary.missingAssets.length;
    toast(
      missing === 0
        ? `실행형 HTML 완료: ${size}MB, 에셋 ${result.summary.assetCount}개`
        : `실행형 HTML 완료(경고): ${size}MB, 못 넣은 에셋 ${missing}개`,
      missing === 0 ? "ok" : "info",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast(`실행형 HTML 내보내기 실패: ${message}`, "error");
  }
}

function doImport(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = `${OPRN_MIME},${LEGACY_RPGZZU_MIME},application/zip,.oprn,.rpgzzu,application/json,.json`;
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    void confirmAndImport(file);
  });
  input.click();
}

async function confirmAndImport(file: File): Promise<void> {
  const confirmed = await showConfirm({
    title: "프로젝트 가져오기",
    message: "현재 프로젝트를 가져온 파일로 교체합니다. 저장하지 않은 변경과 이벤트 초안은 사라집니다.",
    confirmLabel: "가져오기",
    cancelLabel: "취소",
    danger: true,
  });
  if (!confirmed) return;
  if (isProjectPackageFile(file)) {
    void replaceProjectFromPackage(file);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => replaceProjectFromJson(String(reader.result));
  reader.onerror = () => toast("파일 읽기 실패", "error");
  reader.readAsText(file);
}

function isProjectPackageFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".oprn") || name.endsWith(".rpgzzu") || file.type === OPRN_MIME || file.type === LEGACY_RPGZZU_MIME;
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
