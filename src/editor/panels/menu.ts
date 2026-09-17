import { getMode, toggleMode } from "@/app/mode";
import { PRODUCT_TAGLINE } from "@/brand";
import { showConfirm } from "@/editor/ui/modal";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { newProjectChoiceLabel, showNewProjectDialog } from "@/editor/ui/newProjectDialog";
import {
  EDITOR_PRODUCT_BRAND,
  getEditorChrome,
  getEditorUiMode,
} from "@/editor/editorUiMode";
import { openAudioTestDialog } from "@/editor/panels/audioTestDialog";
import { openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import {
  AI_STUDIO_CHANGE_EVENT,
  readStudioMode,
  requestAiStudioToggle,
} from "@/editor/aiStudioMode";
import { openHelpModal } from "@/editor/panels/helpModal";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { renderDbConnectionStatus } from "@/editor/panels/dbConnectionStatus";
import { openMapEventSearchModal } from "@/editor/panels/mapEventSearchModal";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { openWorldPanel } from "@/editor/panels/worldEntries";
import { deserialize, ProjectFormatError } from "@/project/io";
import { createSampleAdventureProject, createScarloxyDemoProject, createScarloxyPokemonDemoProject, createSnowMountain60Project, createIcePlain64Project, createTrainingExamplesProject, createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { createSkyStairProject } from "@/editor/content/skyStairGame";
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
import { persistenceSurfaceVisible } from "@/editor/persistenceRecoveryUi";
import { reloadProjectFromDbNow, saveProjectNow } from "@/editor/saveActions";
import { uiLabel, type UiCopyKey } from "@/editor/uiCopy";
import { requestCommandPalette } from "@/editor/panels/commandPalette";
import { makeSvgIcon, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { installToolbarOverflow } from "@/editor/panels/toolbarOverflow";
import { renderWorkspaceBar } from "@/editor/panels/workspaceBar";
import { toolbarButton } from "./menuToolbar";
import { renderCommitHistoryButton, renderIdentityTopbarControl } from "@/editor/teamWorkflowUi";

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
//
// 모드 차이: 전문가(`chrome.toolStrip`)는 세계관·음악·찾기를 「도구 ▾」 대신 아이콘 버튼으로
// 인라인한다(1클릭). 초보(`chrome.paletteRail`)는 자료집·소재 버튼을 두지 않고 도구 메뉴가
// 그 둘을 담는다 — 아이콘 레일이 이미 큰 도구 버튼을 차지하고 있고, 초보용 e2e·도움말이
// 「도구 메뉴에서 자료집」 경로를 정본으로 삼기 때문이다.

type MenuId = "project" | "tools" | "help";

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
let disposeStudioButton: (() => void) | null = null;
let disposeFullscreenButton: (() => void) | null = null;
let lastLoggedAutoSaveKind: AutoSaveState["kind"] | null = null;
// 실패 에피소드가 진행 중인가. error 로 켜지고 saved/idle 로 꺼진다 — 재시도 중(saving)에도
// 칩을 붙잡아 두는 데 쓴다. 톱바가 다시 그려져도 에피소드는 이어져야 하므로 모듈 상태다.
let saveFailureEpisode = false;

export function renderTopbar(topbar: HTMLElement): void {
  for (const dispose of disposeToolbarOverflows) dispose();
  disposeToolbarOverflows = [];
  disposeSaveStatus?.();
  disposeSaveStatus = null;
  paintSaveDot = null;
  disposeStudioButton?.();
  disposeStudioButton = null;
  disposeFullscreenButton?.();
  disposeFullscreenButton = null;
  while (topbar.firstChild) topbar.removeChild(topbar.firstChild);
  const mode = getMode();
  const uiMode = getEditorUiMode();
  const chrome = getEditorChrome();
  const menuBar = el("div", {
    class: "oprn-menu-bar editor-studio-menubar studio-bar",
    dataset: { testid: "oprn-menu-bar", editorUiMode: uiMode },
  });

  // 왼쪽 — 파일·자료 묶음.
  const lead = el("div", { class: "studio-bar-lead", dataset: { testid: "studio-bar-lead" } });
  const projectLabel = projectMenuLabel();
  lead.append(
    renderProductBrand(),
    renderMenu("project", projectLabel, menuCommands("project", topbar), { chevron: true, className: "studio-project-button", title: `프로젝트 — ${projectLabel}` }),
    renderSaveButton(),
    renderTopbarSaveStatus(topbar),
    ...renderToolCluster(topbar),
  );
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
  if (chrome.helpMenu) {
    cluster.append(renderMenu("help", "도움말", menuCommands("help", topbar), { icon: "help", className: "studio-icon-button" }));
  }
  cluster.append(renderCommitHistoryButton(), renderTopbarIdentityControl(topbar));
  if (mode === "edit") cluster.append(renderTopbarAiSettingsButton());
  cluster.append(renderFullscreenButton());
  trailing.append(cluster);
  menuBar.append(trailing);

  topbar.append(menuBar);
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
    button.dataset.autosaveKind = state.kind;
    status.textContent = autosaveStatusText(state);
  };
  paint(store.getAutoSaveState());
  paintSaveDot = paint;
  return button;
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
      return "자동 저장 실패";
    default:
      return "변경 없음";
  }
}

/**
 * 자료집·소재 버튼 + 도구 자리. 초보는 버튼을 두지 않는다(도구 메뉴가 담는다). 전문가는
 * 세계관·음악·찾기를 인라인 아이콘으로, 표준은 「도구 ▾」 메뉴로 낸다 — 같은 모드에 두 표면을
 * 함께 두지 않는다.
 */
function renderToolCluster(topbar: HTMLElement): readonly HTMLElement[] {
  const chrome = getEditorChrome();
  const nodes: HTMLElement[] = [];
  if (!chrome.paletteRail) {
    nodes.push(
      toolButton({ testId: "toolbar-database", icon: "database", label: headerLabel("databaseShort"), title: headerLabel("database"), onClick: () => openDatabaseModal() }),
      toolButton({ testId: "toolbar-resource-manager", icon: "image", label: headerLabel("resources"), title: headerLabel("resourceLibrary"), onClick: () => openResourceModal() }),
    );
  }
  if (chrome.toolStrip) {
    nodes.push(
      toolButton({ testId: "toolbar-world", icon: "globe", title: headerLabel("world"), onClick: () => openWorldPanel() }),
      toolButton({ testId: "toolbar-sound-test", icon: "music", title: headerLabel("audio"), onClick: () => openAudioTestDialog() }),
      toolButton({ testId: "toolbar-search", icon: "docSearch", title: headerLabel("mapEventSearch"), onClick: () => openMapEventSearchModal() }),
    );
  } else {
    nodes.push(renderMenu("tools", "도구", menuCommands("tools", topbar), { chevron: true }));
  }
  return nodes;
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
    attrs: { title: EDITOR_PRODUCT_BRAND },
    children: [
      el("span", { class: "editor-product-brand-mark", attrs: { "aria-hidden": "true" }, text: "✦" }),
      el("span", { class: "editor-product-brand-text", text: EDITOR_PRODUCT_BRAND }),
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
    text: "스튜디오",
    attrs: {
      type: "button",
      "aria-label": "AI 스튜디오",
      "aria-pressed": "false",
      title: "AI 스튜디오 — 장면 모니터와 조수",
    },
    dataset: { testid: "topbar-ai-studio" },
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
  if (state.kind === "error" || recovery.kind === "blocked") saveFailureEpisode = true;
  else if (state.kind === "saved" || state.kind === "idle") saveFailureEpisode = false;
  const quiet = state.kind !== "error" && !saveFailureEpisode && !persistenceSurfaceVisible(recovery);
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
  const onChange = (): void => button.setAttribute("aria-pressed", document.fullscreenElement ? "true" : "false");
  document.addEventListener("fullscreenchange", onChange);
  disposeFullscreenButton = () => document.removeEventListener("fullscreenchange", onChange);
  return button;
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
        item("게임 및 배포...", "menu-project-publication", () => void openPublishingDialog({
          project: store.getCurrent(),
          opener: topbar.querySelector<HTMLElement>('[data-testid="menu-project"]'),
          apply: publication => store.update(project => { project.meta.publication = publication; }, { scope: "project", label: "게임 배포 설정" }),
          exportZip: doExportWebGame, exportHtml: doExportStandaloneHtml,
        })),
        item("웹 게임 내보내기...", "menu-project-export-web", () => void doExportWebGame()),
        item("실행형 HTML 내보내기...", "menu-project-export-standalone", () => void doExportStandaloneHtml()),
      ];
    case "tools": {
      // 작업 창(모달)만 담는다. 되돌리기/다시 실행과 레이어 3종은 사이드바가 소유하므로 없다.
      // 자료집·소재는 표준·전문가에서 톱바 버튼이 집이라 초보에서만 이 메뉴가 담는다.
      // AI 설정은 오른쪽 ⚙ 버튼이 집이다.
      const chrome = getEditorChrome();
      const beginnerOnly: MenuCommand[] = chrome.paletteRail
        ? [
            item(`${headerLabel("database")}...`, "menu-tools-database", () => openDatabaseModal(), "database"),
            item(`${headerLabel("resourceLibrary")}...`, "menu-tools-resources", () => openResourceModal(), "image"),
            { kind: "separator" },
          ]
        : [];
      return [
        ...beginnerOnly,
        item(`${headerLabel("world")}...`, "menu-tools-world", () => openWorldPanel(), "globe"),
        item(`${headerLabel("audio")}...`, "menu-tools-audio", () => openAudioTestDialog(), "music"),
        item(`${headerLabel("mapEventSearch")}...`, "menu-tools-search", () => openMapEventSearchModal(), "docSearch"),
      ];
    }
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

/**
 * 헤더 문구의 단일 진입점. 헤더는 메뉴바·톱바·클래식 툴바가 같은 개념을 같은 말로 불러야
 * 하므로 한국어를 여기서 새로 적지 않고 `uiCopy` 표를 현재 모드의 용어 스타일로 읽는다.
 * title/aria-label 은 언제나 정본 키를, label 은 정본 또는 `*Short` 축약형을 쓴다.
 */
function headerLabel(key: UiCopyKey): string {
  return uiLabel(key, getEditorChrome().jargonStyle);
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

async function newProject(): Promise<void> {
  // 2026-08-18 UX 리뷰 P0: "현재 작업을 지우고" + 빨간 버튼은 위협적이고,
  // clearAll()은 열려 있던 원격 project id를 그대로 쓰며 공유 행을 덮어썼다.
  // 새 프로젝트는 이름과 시작 장르를 받고 새 project id를 발급해 새 원격 행으로 저장한다.
  // 장르가 있으면 genrePacks.ts 정본 경로로 시스템 프리셋을 씨앗에 적용한다 —
  // 맵·이벤트·DB 레코드는 만들지 않고 system.* 토글만 설정된다.
  const selection = await showNewProjectDialog({ defaultValue: "새 프로젝트" });
  if (selection === null) return;
  const title = selection.title.trim() || "새 프로젝트";
  const choiceId = selection.choiceId;
  const packId = choiceId === null ? null : newProjectChoiceById(choiceId)?.packId ?? null;
  const seed = createNewProjectSeed(packId);
  const { createProjectFolderWithSeed } = await import("@/editor/projectFolderActions");
  const created = await createProjectFolderWithSeed(title, seed);
  if (!created) {
    toast("새 프로젝트는 데스크톱 앱에서 폴더를 골라 만듭니다.", "error");
    return;
  }
  const genreSuffix = choiceId ? ` — 시작 장르: ${newProjectChoiceLabel(choiceId)}` : "";
  toast(`'${title}' 프로젝트를 만들었습니다 — 새 폴더에 저장됩니다${genreSuffix}`, "ok");
  if (choiceId) {
    // 프리셋으로 만들면 장르 프롬프트를 AI 조수에 바로 자동 전송한다 —
    // 엔진 토글은 씨앗에 들어 있고, AI는 그 위의 콘텐츠만 채운다.
    // 빈 프로젝트는 조용히 둔다.
    const { sendAiBootIntent, setPendingAiBootIntent, applyPendingAiBootIntent } = await import("@/editor/aiBootIntent");
    const { welcomeGenrePresetById, buildWelcomeGenrePresetPrompt } = await import("@/editor/welcomeGenrePresets");
    // 선택지 id 로 바로 찾는다 — 예전에는 packId 로 역추적해서 같은 팩 2장 중 하나만 골랐다.
    const preset = welcomeGenrePresetById(choiceId);
    if (preset) {
      const prompt = buildWelcomeGenrePresetPrompt(preset);
      if (!sendAiBootIntent(prompt)) {
        setPendingAiBootIntent(prompt, { autoSend: true });
        applyPendingAiBootIntent();
      }
    }
  }
  // 새 폴더를 여는 것은 주 프로세스가 했다 — 문서를 다시 띄우면 부팅 attach 가 그 폴더를 연다.
  window.location.reload();
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

async function doLoad(): Promise<void> {
  const { openProjectFolder } = await import("@/editor/projectFolderActions");
  const opened = await openProjectFolder();
  if (!opened) {
    toast("폴더 열기는 데스크톱 앱에서만 됩니다.", "error");
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
    await store.flush();
    toast(`백업을 만들었습니다: ${await repository.backup()}`, "ok");
  } catch (error) {
    toast(error instanceof Error ? `백업 실패: ${error.message}` : "백업 실패", "error");
  }
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
