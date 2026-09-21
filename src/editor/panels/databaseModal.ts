import "@/styles/database/index.css";
import { dismissCoachMarks } from "@/editor/coachMarks";
import { disposeAppearanceSlots } from "@/editor/panels/databaseAppearanceSlots";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { handleHistoryHotkey } from "@/editor/hotkeys";
import { hasOpenModalLayer, isTopModal, registerModal, unregisterModal } from "@/editor/ui/modalStack";
import {
  databaseTabGroupLabel,
  databaseTabLabel,
  databaseTabPath,
  getDatabaseActiveTab,
  refreshDatabasePanel,
  renderDatabasePanel,
  setDatabaseActiveTab,
  switchDatabaseActiveTab,
  subscribeDatabaseActiveTab,
  type DatabaseTab,
} from "@/editor/panels/database";
import { createDatabaseAiBar, type DatabaseAiRecordRef } from "@/editor/panels/databaseAiBar";
import { createDatabaseModalDirtySession } from "@/editor/panels/databaseModalDirtySession";
import { worldCodexSessionFor } from "./worldCodexSession";
import { applyDatabaseChanges, writeDatabaseFooterError, writeDatabaseFooterPending } from "@/editor/panels/databaseModalPersistence";
import { startModalDrag, stopModalDrag } from "@/editor/panels/databaseModalWindowDrag";
import { resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { stopSkillAnimationStagesIn } from "@/editor/panels/databaseSkillAnimationStage";
import { disposeDatabaseCinematicsIn } from "@/editor/panels/databaseCinematicView";
import { inventoryCatalogSession, selectedRecordIdForSession, setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { invalidateFarmSpatialConfirmationContext } from "@/editor/panels/databaseFarmSpatialView";
import { isStructureKitEditorOpen } from "@/editor/panels/structureKitEditorDialog";
import { DATABASE_APPLY_BUTTON_HINT, DATABASE_FOOTER_ACTION_TEST_IDS, databaseFooterStatus } from "@/editor/panels/databaseWorkbench";
import {
  createEditorModalDirtyCloseController,
  EDITOR_MODAL_DIRTY_DECISION,
  type EditorModalCloseAttempt,
  type EditorModalDirtyDecision,
} from "@/editor/panels/editorModalDirtyState";
import { buildSvgIcon, type SvgNodeSpec } from "@/editor/panels/tileToolbarIcons";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { pendingHistoryLabels, undoMapEdit } from "@/editor/mapEditHistory";
import { openHelpModal } from "@/editor/panels/helpModal";
import { getEditorChrome } from "@/editor/editorUiMode";
import { uiLabel } from "@/editor/uiCopy";

// 창 컨트롤 아이콘 — 예전에는 "⇥ □ x" 텍스트 글리프였다. 글꼴에 따라 굵기·베이스라인이
// 제각각이고 x 는 소문자 엑스라 닫기 버튼으로 읽히지 않았다. 규격은 레일 아이콘과 같다
// (`tileToolbarIcons.ts`: 22×22 viewBox · stroke currentColor 1.8 · round cap/join).
type WindowIconName = "dock" | "undock" | "maximize" | "restore" | "close";

const WINDOW_ICONS: Record<WindowIconName, readonly SvgNodeSpec[]> = {
  dock: [
    { tag: "rect", attrs: { x: "3", y: "4", width: "16", height: "14", rx: "2" } },
    { tag: "path", attrs: { d: "M13 4v14" } },
  ],
  undock: [
    { tag: "rect", attrs: { x: "3", y: "4", width: "16", height: "14", rx: "2" } },
    { tag: "path", attrs: { d: "M9 4v14" } },
  ],
  maximize: [{ tag: "rect", attrs: { x: "4", y: "4", width: "14", height: "14", rx: "2" } }],
  restore: [
    { tag: "rect", attrs: { x: "3", y: "7", width: "12", height: "12", rx: "2" } },
    { tag: "path", attrs: { d: "M7 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" } },
  ],
  close: [{ tag: "path", attrs: { d: "M6 6l10 10M16 6L6 16" } }],
};

function windowIcon(name: WindowIconName): SVGSVGElement {
  const icon = buildSvgIcon(WINDOW_ICONS[name]);
  icon.setAttribute("class", "database-modal-icon");
  return icon;
}

/** 헤더 브레드크럼 "그룹 › 탭" 을 현재 활성 탭으로 다시 쓴다. 개요처럼 그룹 밖 탭은 탭 이름만 남긴다. */
function writeCrumb(crumb: HTMLElement, tab: DatabaseTab): void {
  const group = databaseTabGroupLabel(tab);
  const path = databaseTabPath(tab);
  crumb.replaceChildren(
    ...(group
      ? [
        el("span", { class: "database-modal-crumb-group", text: group }),
        el("span", { class: "database-modal-crumb-sep", text: "›", attrs: { "aria-hidden": "true" } }),
      ]
      : []),
    ...path.flatMap((entry, index) => [
      ...(index > 0 ? [el("span", { class: "database-modal-crumb-sep", text: "›", attrs: { "aria-hidden": "true" } })] : []),
      el("span", { class: "database-modal-crumb-tab", text: databaseTabLabel(entry), dataset: { tab: entry } }),
    ]),
  );
  crumb.dataset.tab = tab;
}

type ActiveDatabaseModalHandle = {
  readonly navigate: (tab: DatabaseTab) => void;
  readonly onClose: Set<() => void>;
  readonly close: () => void;
  readonly requestClose: (attempt: EditorModalCloseAttempt) => void;
};

let activeModal: ActiveDatabaseModalHandle | null = null;

// 모달 내부의 다른 뷰(예: 트룹의 "전투 테스트" 버튼)가 모달을 닫아야 할 때 쓰는 훅.
// document.querySelector(...)?.remove()로 DOM만 뜯어내면 openDatabaseModal이 등록한
// document keydown 리스너 2개가 정리되지 않고 남는다(M11) — 반드시 이 훅을 통해서만 닫는다.
//
// "battleTest"는 읽기 행위이므로 dirty 세션 확인 없이 즉시 close()만 수행한다(리스너 정리가
// 목적) — discard는 하지 않는다. 자동 저장 모델이라 데이터는 이미 안전하다(C2와 정합).
// 그 외 reason은 기존처럼 controller.requestClose를 거쳐 dirty 프롬프트를 존중한다.
export function requestDatabaseModalClose(reason: EditorModalCloseAttempt | "battleTest"): void {
  if (!activeModal) return;
  if (reason === "battleTest") {
    activeModal.close();
    return;
  }
  activeModal.requestClose(reason);
}

export function openDatabaseModal(initialTab?: DatabaseTab, options?: { readonly onClose: () => void }): void {
  // 맵 도구 레일을 가리키는 온보드 코치마크가 body 최상위에 매달려 모달 위를 덮어
  // 목록 제목과 탭 검색을 가리는 사고가 있었다 — 모달이 열리면 화면을 모달에게 넘긴다.
  // 본 것으로 기록하지는 않는다(welcome intent 와 같은 정책).
  dismissCoachMarks();
  // Reuse the open session for cross-tab links; rebuilding it would discard staged cards.
  if (activeModal && document.querySelector("[data-testid='database-modal']")) {
    if (options) activeModal.onClose.add(options.onClose);
    if (initialTab) activeModal.navigate(initialTab);
    return;
  }
  activeModal?.close();
  // close() 가 backdrop 을 지우지만, 혹시 핸들 없이 남은 고아 DOM 도 방어적으로 제거.
  const orphan = document.querySelector<HTMLElement>("[data-testid='database-modal']");
  if (orphan) {
    disposeDatabaseCinematicsIn(orphan);
    orphan.remove();
  }
  // Cross-record links establish selection before opening. Reset unrelated view state,
  // not the catalog target; apply the legacy equipment route after that reset.
  const requestedTab = initialTab ?? getDatabaseActiveTab();
  const catalogCollection = requestedTab === "equipment" ? "equipment"
    : requestedTab === "items" ? inventoryCatalogSession().collection : undefined;
  const catalogRecordId = catalogCollection ? selectedRecordIdForSession(catalogCollection) : undefined;
  resetDatabaseRecordViewSession();
  if (catalogCollection) {
    inventoryCatalogSession().collection = catalogCollection;
    setSelectedRecordId(catalogCollection, catalogRecordId);
  }
  if (initialTab) setDatabaseActiveTab(initialTab);
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // Topbar rerenders can replace the opener while the modal remains mounted.
  const openerTestId = opener?.dataset.testid;
  const dirtySession = createDatabaseModalDirtySession();
  // 사이드 도킹(M8): 모달⇄우측 도크 토글 상태. localStorage 에 저장돼 다음 오픈 시 복원된다.
  let dockMode = false;
  // 창 모드에서만 설치되는 Tab 트랩의 해제자. 도크 모드·닫기에서 반드시 호출한다.
  let disposeFocusTrap: () => void = () => {};

  const body = el("div", { class: "database-modal-body" });
  const codexSession = worldCodexSessionFor(body);
  const maximizeButton = el("button", {
    class: "database-modal-maximize",
    attrs: { type: "button", title: "전체 화면", "aria-label": "데이터베이스 전체 화면" },
    dataset: { testid: "database-modal-maximize" },
    children: [windowIcon("maximize")],
  }) as HTMLButtonElement;
  const closeButton = el("button", {
    class: "database-modal-close",
    attrs: { type: "button", title: "닫기", "aria-label": "데이터베이스 닫기" },
    dataset: { testid: "database-modal-close" },
    children: [windowIcon("close")],
  }) as HTMLButtonElement;
  const dockToggleButton = el("button", {
    class: "database-modal-dock-toggle",
    attrs: { type: "button", title: "사이드 도크로 전환", "aria-label": "사이드 도크로 전환" },
    dataset: { testid: "database-dock-toggle" },
    children: [windowIcon("dock")],
  }) as HTMLButtonElement;
  const windowControls = el("div", {
    class: "database-modal-controls",
    children: [dockToggleButton, maximizeButton, closeButton],
  });
  // ── AI 연결(M7): 제목 옆 ✨ AI 토글 → 헤더 아래 인라인 바. 진행·도구 결과·답변을 바 안에
  // 그린다(databaseAiBar.ts). 채팅 패널은 이 모달 뒤에 가려지므로 「패널에서 확인하세요」로
  // 끝내지 않는다.
  const aiBar = createDatabaseAiBar({
    context: () => ({ tab: getDatabaseActiveTab(), record: selectedDatabaseRecordRef() }),
    deps: {
      // 검토 카드의 「이동 →」. 컬렉션 이름은 모델이 아니라 diff 가 만든 것이지만, 탭으로 넘기기 전에
      // 실제 프로젝트 키인지 확인한다 — 없는 탭으로 전환하면 본문이 빈 화면이 된다.
      navigate: (collection, recordId) => {
        const database = store.getCurrent().database as unknown as Record<string, unknown>;
        // 유효하지 않으면 조용히 무시하지 않는다 — 버튼을 눌렀는데 아무 일도 안 일어나면
        // 사용자는 UI 가 멈춘 줄 안다. 같은 실패의 다른 경로는 이미 토스트로 말한다.
        if (!(collection in database)) {
          toast(`'${collection}' 은(는) 열 수 있는 탭이 아닙니다. 변경 내용은 그대로 있습니다.`, "error");
          return;
        }
        const target = collection as DatabaseCollection;
        setSelectedRecordId(target, recordId, { reveal: true });
        switchDatabaseActiveTab(target as DatabaseTab, body);
        refreshDatabasePanel(body);
      },
    },
  });
  const aiToggleButton = aiBar.toggle;
  // 현재 위치 브레드크럼 — 레일에서 한 그룹만 펼쳐지므로 "어디를 편집하고 있나" 는 헤더가
  // 답해야 한다. 활성 탭 구독으로 레일 클릭·G006 점프·Ctrl+T 순환을 전부 따라간다.
  const crumb = el("nav", {
    class: "database-modal-crumb",
    attrs: { "aria-label": "현재 위치" },
    dataset: { testid: "database-modal-crumb" },
  });
  writeCrumb(crumb, getDatabaseActiveTab());
  const unsubscribeActiveTab = subscribeDatabaseActiveTab((tab) => {
    writeCrumb(crumb, tab);
    aiBar.refreshContext();
  });
  const header = el("header", {
    class: "database-modal-header",
    children: [
      // 창 제목이 jargonStyle 을 우회하면 초보 모드에서 명령 팔레트·도움말은 「자료집」,
      // 정작 열린 창은 「데이터베이스」가 된다. 라벨 정본(uiCopy)을 쓴다.
      el("div", { class: "database-modal-heading", children: [el("h2", { text: databaseSurfaceLabel() }), crumb] }),
      aiToggleButton,
      windowControls,
    ],
  });
  const backdrop = el("div", {
    class: "database-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "database-modal" },
    children: [
      el("section", {
        class: "database-modal-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": databaseSurfaceLabel() },
        children: [header, aiBar.element, body],
      }),
    ],
  });

  // 데이터베이스 모달이 열려 있어도 Ctrl+Z/Y 로 undo/redo 하고, 복원된 프로젝트 상태를
  // 패널에 다시 반영한다(입력 필드 포커스 중에는 브라우저 텍스트 undo 우선 — 가드 유지).
  const handleHistoryKeyDown = (event: KeyboardEvent): void => {
    // 구조물 편집기가 떠 있으면 undo/redo 를 통째로 넘긴다. undo 는 프로젝트를 갈아치우므로
    // 편집기가 보고 있던 킷이 사라지고, 그 뒤의 칠하기가 전부 헛일이 된다.
    // (편집기를 닫은 다음에는 평소대로 되돌릴 수 있다.)
    if (isStructureKitEditorOpen()) return;
    // undo/redo 후에도 부분 갱신 경로를 타서 스크롤/선택/검색 상태를 보존한다.
    if (handleHistoryHotkey(event)) {
      refreshDatabasePanel(body);
      syncUndoButton();
    }
  };
  // ── 열린 모달의 실시간 갱신(M7): AI(채팅 패널)나 외부 경로가 store 를 바꾸면
  // 열린 모달을 부분 갱신한다(undo 경로와 같은 refreshDatabasePanel — 스크롤/선택/검색 보존).
  let modalClosed = false;
  let refreshQueued = false;
  const scheduleModalRefresh = (): void => {
    // rAF 디바운스 1회: 한 프레임에 여러 emit(연속 store.update)이 와도 재렌더는 한 번.
    if (refreshQueued) return;
    refreshQueued = true;
    const run = (): void => {
      refreshQueued = false;
      if (modalClosed) return;
      // 프레임 시점 재판정: blur/change 커밋이 유발한 갱신은 구독 시점엔 activeElement 가
      // <body> 여도, rAF 까지 오면 다음 필드로 포커스가 정착해 있다. 편집 중이면 보류로 전환.
      // 버튼 클릭 직전의 유예 창도 막는다 — 재렌더가 버튼을 분리해 클릭이 유실되는 경로(qa-troops).
      if (isEditingInsideModalBody() || withinInteractionGrace()) {
        pendingRefresh = true;
        scheduleGraceFlush();
        return;
      }
      refreshDatabasePanel(body);
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
    else run();
  };
  // 모달 자신이 유발한 변경 가드: DB 폼의 텍스트 필드는 keystroke 마다 store.update 를
  // 발화한다 — 그때마다 본문 전체를 재렌더하면 입력 포커스를 잃는다. 편집 중인 컨트롤이
  // 모달 본문 안에 있으면 스킵한다(그 뷰의 rerender 콜백이 자체 갱신을 책임진다).
  const isEditingInsideModalBody = (): boolean => {
    const active = typeof document !== "undefined" ? document.activeElement : null;
    if (!(active instanceof HTMLElement) || !body.contains(active)) return false;
    const tag = active.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable === true;
  };
  // 포커스 전이 과민 방지: change 커밋형 필드(number/textarea)는 다음 필드로 포커스가
  // 옮겨가는 blur 순간에 store.update 를 발화하는데, 그 순간 activeElement 는 일시적으로
  // <body> 다. 그 틈에 재렌더하면 사용자가 막 타이핑을 시작한 필드가 분리된다(qa-crops
  // 회귀). 마지막 상호작용으로부터 짧은 유예(grace) 안의 갱신은 편집 중으로 간주한다.
  const INTERACTION_GRACE_MS = 400;
  let lastInteractionAt = 0;
  const bumpInteraction = (): void => {
    lastInteractionAt = Date.now();
  };
  for (const type of ["pointerdown", "keydown", "input"] as const) {
    body.addEventListener(type, bumpInteraction, true);
  }
  const withinInteractionGrace = (): boolean => Date.now() - lastInteractionAt < INTERACTION_GRACE_MS;
  // 편집 중 스킵된 갱신은 버리지 않고 보류했다가(pendingRefresh) 포커스가 본문을
  // 떠날 때 반영한다 — 편집 도중 도착한 AI/외부 변경이 영구 stale 되는 것 방지(3파 리뷰 Medium).
  let pendingRefresh = false;
  const flushPendingRefresh = (): void => {
    if (!pendingRefresh || modalClosed) return;
    pendingRefresh = false;
    scheduleModalRefresh();
  };
  // grace 기간에 보류된 갱신은 상호작용이 멈춘 뒤에도 플러시한다 — focusout 이
  // 본문 밖으로 일어나지 않는 경로(필드 간 이동만 하다 멈춤)의 stale 방지.
  let graceFlushTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleGraceFlush = (): void => {
    if (graceFlushTimer !== null) return;
    graceFlushTimer = setTimeout(() => {
      graceFlushTimer = null;
      if (modalClosed) return;
      if (!pendingRefresh) return;
      if (isEditingInsideModalBody() || withinInteractionGrace()) {
        scheduleGraceFlush();
        return;
      }
      flushPendingRefresh();
    }, INTERACTION_GRACE_MS + 50);
  };
  body.addEventListener("focusout", () => {
    // focusout 시점엔 activeElement 가 아직 이전 값일 수 있어 rAF 뒤에 재판정한다.
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => { if (!isEditingInsideModalBody()) flushPendingRefresh(); });
    else if (!isEditingInsideModalBody()) flushPendingRefresh();
  });
  const unsubscribeStore = store.subscribe((_project, change) => {
    // A project switch ends this modal's snapshot/draft ownership. Never allow
    // its Save or Discard actions to write the previous project into the new one.
    // 닫기는 유지하되 **말없이 사라지지는 않는다** — 편집 중이던 사용자에게 모달이 이유
    // 없이 증발한 것처럼 보였다. dirty 프롬프트를 띄울 수는 없다(그 사이 다른 프로젝트가
    // 이미 current 다 — 저장도 되돌리기도 잘못된 프로젝트에 쓰게 된다).
    if (change.projectSwitch) {
      const hadUnsaved = dirtySession.isDirty();
      close();
      toast(
        hadUnsaved
          ? "프로젝트가 바뀌어 데이터베이스를 닫았습니다. 저장하지 않은 편집은 이전 프로젝트에 남아 있습니다."
          : "프로젝트가 바뀌어 데이터베이스를 닫았습니다.",
        hadUnsaved ? "error" : "ok"
      );
      return;
    }
    if (change.scope !== "database" && change.scope !== "project") return;
    syncUndoButton();
    if (isEditingInsideModalBody() || withinInteractionGrace()) {
      pendingRefresh = true;
      scheduleGraceFlush();
      return;
    }
    scheduleModalRefresh();
  });
  const onClose = new Set(options ? [options.onClose] : []);
  const close = (): void => {
    if (modalClosed) return;
    modalClosed = true;
    disposeAppearanceSlots();
    if (graceFlushTimer !== null) clearTimeout(graceFlushTimer);
    // End pending housing confirmation ownership with the modal session itself.
    invalidateFarmSpatialConfirmationContext();
    unsubscribeCodex();
    unsubscribeAutoSave();
    unsubscribeStore(); // 구독 해제 — 리스너 누수 금지(1파 M11 교훈).
    unsubscribeActiveTab();
    aiBar.dispose();
    stopSkillAnimationStagesIn(backdrop);
    disposeDatabaseCinematicsIn(backdrop);
    backdrop.remove();
    unregisterModal(backdrop);
    disposeFocusTrap();
    document.removeEventListener("keydown", handleModalKeyDown);
    document.removeEventListener("keydown", handleHistoryKeyDown);
    stopModalDrag();
    activeModal = null;
    const returnTarget = opener?.isConnected ? opener : openerTestId
      ? Array.from(document.querySelectorAll<HTMLElement>("[data-testid]")).find(node => node.dataset.testid === openerTestId)
      : undefined;
    // 내 위(또는 아래)에 아직 모달 층이 살아 있으면 포커스를 그쪽에서 빼앗지 않는다
    // — 이벤트 에디터(eventEditor/modal.ts)가 쓰는 것과 같은 가드.
    if (returnTarget?.isConnected && !hasOpenModalLayer()) returnTarget.focus();
    for (const callback of onClose) callback();
    onClose.clear();
  };
  const hideDirtyPrompt = (): void => dirtyPrompt.replaceChildren();
  const saveAndMarkClean = async (): Promise<boolean> => {
    // 플래그는 commit()/refresh 가 codex 구독을 통해 플래그를 도로 내린 **뒤에** 세운다.
    // 이 흐름이 쓰는 문구는 autosave 구독의 재도색보다 우선한다(아래 paintFooterStatus 참고).
    if (!codexSession.commit()) {
      switchDatabaseActiveTab("worldCodex", body);
      refreshDatabasePanel(body);
      manualStatusShown = true;
      writeDatabaseFooterError(footerStatus, codexSession.state.editError || "설정집 카드 내용을 확인하세요.");
      return false;
    }
    refreshDatabasePanel(body);
    manualStatusShown = true;
    writeDatabaseFooterPending(footerStatus, "변경 내용을 저장하는 중입니다.");
    const saved = await applyDatabaseChanges(footerStatus);
    if (saved) dirtySession.markClean();
    return saved;
  };
  const handleDirtyDecision = (decision: EditorModalDirtyDecision): void => {
    switch (decision) {
      case EDITOR_MODAL_DIRTY_DECISION.Save:
        void saveAndMarkClean().then((saved) => {
          if (saved) close();
        });
        return;
      case EDITOR_MODAL_DIRTY_DECISION.Discard:
        codexSession.discard();
        dirtySession.discard();
        // 복구한 상태를 **즉시** 원격에 밀어 넣는다. 진행 중이던 flush 는 제출 시점의
        // 프로젝트를 고정 전송하므로, 가만두면 방금 버린 내용이 원격에 먼저 확정되고
        // 복구본의 반영은 4초 자동저장에 달린다 — 그 전에 탭을 닫으면 「버린」 내용이
        // 원격 정본으로 남는다. 실패는 autosave 재시도/상태 칩이 이어받는다.
        void store.flush().catch(() => undefined);
        close();
        return;
      case EDITOR_MODAL_DIRTY_DECISION.KeepEditing:
        hideDirtyPrompt();
        closeButton.focus();
        return;
    }
  };
  const showDirtyPrompt = (attempt: EditorModalCloseAttempt): EditorModalDirtyDecision => {
    dirtyPrompt.replaceChildren(renderDirtyPrompt(attempt, handleDirtyDecision));
    return EDITOR_MODAL_DIRTY_DECISION.KeepEditing;
  };
  const controller = createEditorModalDirtyCloseController({
    isDirty: () => codexSession.isDirty() || dirtySession.isDirty(),
    promptUnsavedChanges: showDirtyPrompt,
    save: () => {
      void saveAndMarkClean();
    },
    discard: () => { codexSession.discard(); dirtySession.discard(); },
    close,
  });

  activeModal = { close, onClose, requestClose: controller.requestClose, navigate: (tab) => switchDatabaseActiveTab(tab, body) };
  controller.bindCloseButton(closeButton);
  // 도크 모드에서는 최대화·드래그를 비활성, 바깥 클릭 닫기도 끈다(맵 조작이 곧 바깥 클릭).
  maximizeButton.addEventListener("click", () => {
    if (dockMode) return;
    toggleMaximizedDatabaseModal(maximizeButton);
  });
  header.addEventListener("dblclick", () => {
    if (dockMode) return;
    toggleMaximizedDatabaseModal(maximizeButton);
  });
  backdrop.addEventListener("mousedown", (event) => {
    if (dockMode) return;
    controller.handleBackdropMouseDown(event, backdrop);
  });
  // 도크는 모달이 아니다 — Esc 는 맵(화면 밀기·선택 해제)의 몫이고, 도크 패널은 X 로 닫는다.
  // 예전에는 이 리스너에 도크 가드가 없어서 포커스가 맵에 있어도 Esc 한 번에 도크가 통째로
  // 닫혔다(2026-09-19 리뷰 P0-3a). 창 모드에서는 modalStack 에 등록돼 있으므로 이 핸들러가
  // hasOpenModalLayer() 로 스스로 물러나고, 실제 Esc 는 스택의 최상층 라우팅이 가져간다.
  const handleModalKeyDown = (event: KeyboardEvent): void => {
    if (dockMode) return;
    // 스택이 어떤 이유로든 이 층을 놓쳤을 때를 위한 대비책. 전체 화면 복원이 먼저다.
    if (event.key === "Escape" && !event.defaultPrevented && !hasOpenModalLayer()) {
      if (exitMaximizedDatabaseModal(maximizeButton)) {
        event.preventDefault();
        return;
      }
    }
    controller.handleKeyDown(event);
  };
  document.addEventListener("keydown", handleModalKeyDown);
  document.addEventListener("keydown", handleHistoryKeyDown);
  const footerStatus = el("div", {
    class: "database-footer-status",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "db-footer-status" },
  });
  // 설정집 카드 초안이 우선, 그다음이 store 의 autosave 상태. 둘 다 여기 한 곳에서만 칠한다
  // — 예전처럼 두 구독자가 textContent 를 각자 덮으면 비동기 저장 결과가 지워진다.
  //
  // "지금 저장"이 쓴 결과 문구("적용하고 온라인에 저장했습니다" 등)는 붙잡아 둔다. flush 는
  // 끝나면서 autosave 상태도 함께 움직이므로, 가만두면 방금 띄운 결과가 곧바로
  // "자동 저장됨"으로 지워진다(원래 코드가 codexDraftPending 가드로 지키던 계약).
  let manualStatusShown = false;
  const paintFooterStatus = (): void => {
    // 실패는 언제나 이긴다 — 이 결함(P0-4)의 본체가 "실패를 성공으로 말하던 것"이다.
    if (manualStatusShown && store.getAutoSaveState().kind !== "error") return;
    manualStatusShown = false;
    const status = codexSession.isDirty()
      ? ({ text: "설정집 카드 저장 전", kind: "pending" } as const)
      : databaseFooterStatus(store.getAutoSaveState());
    footerStatus.textContent = status.text;
    footerStatus.dataset.statusKind = status.kind;
  };
  paintFooterStatus();
  // 설정집 초안이 움직이면 사용자가 이미 다음 작업으로 넘어간 것 — 붙잡아 둔 문구를 놓는다.
  const unsubscribeCodex = codexSession.subscribe(() => {
    manualStatusShown = false;
    paintFooterStatus();
  });
  // 모달이 열려 있는 동안 톱바 저장 칩은 가려진다 — 실패를 여기서 말하지 않으면 아무도 말하지 않는다.
  const unsubscribeAutoSave = store.subscribeAutoSave(paintFooterStatus);
  const dirtyPrompt = el("div", {
    class: "database-modal-dirty-prompt-region",
    dataset: { testid: "database-dirty-prompt-region" },
  });
  // 레코드 편집 되돌리기(Ctrl+Z). 닫기 프롬프트의 「열 때 상태로 복구」와는 **범위가 다른**
  // 연산이라 낱말도 분리한다 — 이건 한 단계, 저건 세션 전체다.
  const undoButton = el("button", {
    class: "database-footer-button tertiary",
    text: "되돌리기",
    attrs: { type: "button", title: "마지막 편집을 한 단계 되돌립니다 (Ctrl+Z)" },
    dataset: { testid: "database-footer-undo" },
    on: {
      click: () => {
        if (!undoMapEdit()) {
          toast("되돌릴 편집이 없습니다.", "error");
          return;
        }
        refreshDatabasePanel(body);
        syncUndoButton();
      },
    },
  }) as HTMLButtonElement;
  const syncUndoButton = (): void => {
    const label = pendingHistoryLabels().undo;
    undoButton.disabled = !label;
    undoButton.setAttribute("aria-disabled", String(!label));
    undoButton.title = label ? `되돌리기: ${label} (Ctrl+Z)` : "되돌릴 편집이 없습니다";
  };
  syncUndoButton();
  const footer = el("footer", {
    class: "database-modal-footer",
    children: [
      footerStatus,
      dirtyPrompt,
      el("button", {
        class: "database-footer-button",
        text: "닫기",
        attrs: { type: "button" },
        dataset: { testid: DATABASE_FOOTER_ACTION_TEST_IDS.ok },
        on: { click: () => controller.requestClose("cancel") },
      }),
      el("button", {
        class: "database-footer-button primary",
        text: "지금 저장",
        attrs: { type: "button", title: DATABASE_APPLY_BUTTON_HINT },
        dataset: { testid: DATABASE_FOOTER_ACTION_TEST_IDS.apply },
        on: {
          click: () => {
            hideDirtyPrompt();
            void saveAndMarkClean();
          },
        },
      }),
      // Ctrl+Z 는 예전부터 동작했지만 모달 어디에도 노출이 없어 아무도 몰랐다.
      // 같은 DB 안 전투 명령 스튜디오가 이미 가시 되돌리기를 갖고 있다 — 그 규약을 셸로 올린다.
      undoButton,
      el("button", {
        class: "database-footer-button tertiary",
        text: "도움말",
        attrs: { type: "button" },
        dataset: { testid: "database-footer-help" },
        // 예전에는 동어반복 토스트가 전부였다. 실제 DB 도움말 문서가 이미 있다.
        on: { click: () => openHelpModal("database") },
      }),
    ],
  });
  const windowEl = backdrop.querySelector(".database-modal-window");
  if (windowEl instanceof HTMLElement) {
    header.addEventListener("mousedown", (event) => {
      if (dockMode) return;
      startModalDrag(windowEl, event);
    });
  }
  windowEl?.append(footer);
  // ── 사이드 도킹(M8): 백드롭 투명·포인터 통과 + 창 우측 고정. 맵 캔버스는 그대로 조작 가능. ──
  const applyDockMode = (next: boolean): void => {
    if (!(windowEl instanceof HTMLElement)) return;
    dockMode = next;
    writeStoredDockMode(next);
    backdrop.classList.toggle("is-docked", next);
    if (next) {
      // 드래그/최대화가 남긴 상태를 정리하고 우측 고정으로 전환한다.
      stopModalDrag();
      windowEl.classList.remove("maximized", "floating");
      windowEl.style.position = "";
      windowEl.style.left = "";
      windowEl.style.top = "";
      windowEl.style.width = "";
      windowEl.style.height = "";
      windowEl.style.maxWidth = "";
      windowEl.style.maxHeight = "";
      maximizeButton.replaceChildren(windowIcon("maximize"));
      // 도크는 모달이 아니다 — 포커스를 가두지 않고 맵과 병행 조작하는 보조 패널.
      windowEl.setAttribute("role", "complementary");
      windowEl.removeAttribute("aria-modal");
    } else {
      windowEl.setAttribute("role", "dialog");
      windowEl.setAttribute("aria-modal", "true");
    }
    maximizeButton.disabled = next;
    maximizeButton.setAttribute("aria-disabled", String(next));
    dockToggleButton.replaceChildren(windowIcon(next ? "undock" : "dock"));
    const label = next ? "창 모드로 복원" : "사이드 도크로 전환";
    dockToggleButton.setAttribute("title", label);
    dockToggleButton.setAttribute("aria-label", label);
    syncModalLayer(next);
  };

  // modalStack 은 Escape 소유권의 정본이다. 창 모드일 때만 등록한다 — 도크는 스스로
  // `role="complementary"` 로 "모달 아님"을 선언하므로 층에 끼면 맵의 Esc·단축키를 빼앗는다.
  const requestModalEscape = (): void => {
    if (modalClosed) return;
    // modalStack 은 닫기가 거절돼도(계속 편집) 자기 엔트리를 먼저 지운다 — 되살려 둔다.
    unregisterModal(backdrop);
    registerModal(backdrop, requestModalEscape);
    // 전체 화면은 전면 fixed 라 "Esc 한 번 = DB 통째로 닫힘"이 된다. 첫 Esc 는 복원만.
    if (exitMaximizedDatabaseModal(maximizeButton)) return;
    controller.requestClose("escape");
  };
  const syncModalLayer = (docked: boolean): void => {
    disposeFocusTrap();
    disposeFocusTrap = () => {};
    unregisterModal(backdrop);
    if (docked) return;
    registerModal(backdrop, requestModalEscape);
    // `aria-modal="true"` 를 선언해 놓고 Tab 경계가 없어서 포커스가 탑바·맵 툴바로 새던
    // 것을 막는다(2026-09-19 리뷰 P0-2). 중첩 대화상자가 위에 뜨면 isTopModal 로 양보한다.
    if (windowEl instanceof HTMLElement) disposeFocusTrap = installDatabaseFocusTrap(backdrop, windowEl);
  };

  dockToggleButton.addEventListener("click", () => applyDockMode(!dockMode));
  document.body.append(backdrop);
  renderDatabasePanel(body);
  // 창 모드로 시작한다 — 아래 도크 복원이 있으면 syncModalLayer 가 다시 정리한다.
  syncModalLayer(false);
  // 지난 세션의 도크 상태 복원 — 렌더 후 적용해도 클래스/aria 만 바꾸므로 안전하다.
  if (readStoredDockMode()) applyDockMode(true);
  closeButton.focus();
}

/**
 * 창 모드 Tab 트랩. 이벤트 에디터(`eventEditor/modal.ts` 의 installFocusTrap)와 같은 규약 —
 * 최상층일 때만 경계를 잡고, 보이지 않는 컨트롤은 후보에서 뺀다.
 */
function installDatabaseFocusTrap(backdropEl: HTMLElement, windowEl: HTMLElement): () => void {
  const trap = (event: KeyboardEvent): void => {
    if (event.key !== "Tab" || event.defaultPrevented || !isTopModal(backdropEl)) return;
    const focusable = Array.from(
      windowEl.querySelectorAll<HTMLElement>(
        "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"
      )
    ).filter((node) => node.offsetParent !== null || node === document.activeElement);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey) {
      if (document.activeElement === first) { event.preventDefault(); last.focus(); }
    } else if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  backdropEl.addEventListener("keydown", trap);
  return () => backdropEl.removeEventListener("keydown", trap);
}

/**
 * 이 표면의 이름. 「자료집」(초보)/「데이터베이스」(전문) 두 이름이 있고 정본은 uiCopy 다.
 * 문자열을 새로 적으면 같은 창이 화면마다 다른 이름으로 불린다 — 실제로 갈라져 있었다.
 */
function databaseSurfaceLabel(): string {
  return uiLabel("database", getEditorChrome().jargonStyle);
}

const DB_DOCK_MODE_KEY = "oprn:db-dock-mode";

function readStoredDockMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DB_DOCK_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredDockMode(next: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DB_DOCK_MODE_KEY, next ? "1" : "0");
  } catch {
    // 저장 실패(프라이빗 모드 등)는 무시 — 토글 자체는 동작해야 한다.
  }
}

// 레코드형 탭 → DatabaseCollection 매핑 (그 외 탭은 선택 레코드 개념이 없다).
const RECORD_TAB_COLLECTIONS: Partial<Record<DatabaseTab, DatabaseCollection>> = {
  actors: "actors",
  classes: "classes",
  skills: "skills",
  items: "items",
  equipment: "equipment",
  enemies: "enemies",
  troops: "troops",
  states: "states",
  animations: "battleAnimations",
};

// AI 컨텍스트의 선택 레코드. 세션 선택이 없으면 뷰가 기본 선택하는 첫 레코드를 따른다
// (selectedRecordForSession 과 같은 규칙). 레코드 탭이 아니면 null.
function selectedDatabaseRecordRef(): DatabaseAiRecordRef | null {
  const tab = getDatabaseActiveTab();
  const collection = tab === "items" ? inventoryCatalogSession().collection : RECORD_TAB_COLLECTIONS[tab];
  if (!collection) return null;
  const records: readonly { readonly id: string; readonly name: string }[] = store.getCurrent().database[collection];
  const selectedId = selectedRecordIdForSession(collection);
  const record = (selectedId ? records.find((entry) => entry.id === selectedId) : undefined) ?? records[0];
  return record ? { id: record.id, name: record.name } : null;
}

function renderDirtyPrompt(
  attempt: EditorModalCloseAttempt,
  onDecision: (decision: EditorModalDirtyDecision) => void
): HTMLElement {
  return el("section", {
    class: "database-modal-dirty-prompt",
    attrs: { "aria-label": "이 세션에서 바뀐 데이터베이스 내용" },
    dataset: { closeAttempt: attempt, testid: "database-dirty-prompt" },
    children: [
      el("strong", { text: "이 세션에서 바뀐 내용이 있습니다. 어떻게 할까요?" }),
      el("span", { text: closeAttemptMessage(attempt) }),
      dirtyPromptButton("저장하고 닫기", "database-dirty-save", EDITOR_MODAL_DIRTY_DECISION.Save, onDecision, "primary"),
      // 「되돌리기」는 Ctrl+Z 한 단계의 이름으로 쓴다 — 세션 전체 복구는 「복구」로 분리.
      dirtyPromptButton("열 때 상태로 복구하고 닫기", "database-dirty-discard", EDITOR_MODAL_DIRTY_DECISION.Discard, onDecision),
      dirtyPromptButton("계속 편집", "database-dirty-keep-editing", EDITOR_MODAL_DIRTY_DECISION.KeepEditing, onDecision),
    ],
  });
}

function dirtyPromptButton(
  text: string,
  testid: string,
  decision: EditorModalDirtyDecision,
  onDecision: (decision: EditorModalDirtyDecision) => void,
  variant = ""
): HTMLElement {
  return el("button", {
    class: `database-footer-button ${variant}`.trim(),
    text,
    attrs: { type: "button" },
    dataset: { testid },
    on: { click: () => onDecision(decision) },
  });
}

function closeAttemptMessage(attempt: EditorModalCloseAttempt): string {
  // 「되돌리기」는 Ctrl+Z(한 단계)의 이름이다 — 용어집 정본도 shell.undo=되돌리기다.
  // 세션 전체 복구를 같은 낱말로 부르면 범위가 다른 두 연산이 한 이름을 나눠 쓴다.
  // 여기서는 「열 때 상태로 복구」로 분리한다(버튼 라벨과도 같은 말).
  const restoreNote = "「열 때 상태로 복구」는 이 모달을 연 시점의 DB 상태로 되돌립니다(맵 편집은 그대로 둡니다).";
  switch (attempt) {
    case "cancel":
      return `닫기 전에 저장할지 복구할지 선택하세요. ${restoreNote}`;
    case "escape":
      return `Escape로 닫기 전에 저장할지 복구할지 선택하세요. ${restoreNote}`;
    case "backdrop":
      return `바깥 영역을 눌러 닫기 전에 저장할지 복구할지 선택하세요. ${restoreNote}`;
    case "x":
      return `닫기 버튼을 누르기 전에 저장할지 복구할지 선택하세요. ${restoreNote}`;
  }
}

function toggleMaximizedDatabaseModal(button: HTMLButtonElement): void {
  const windowEl = button.closest(".database-modal-window");
  if (!(windowEl instanceof HTMLElement)) return;
  const isMaximized = windowEl.classList.toggle("maximized");
  if (isMaximized) {
    stopModalDrag();
    windowEl.classList.remove("floating");
    // `sidebar.css`의 지오메트리 단일 소유자(`:has(.db-shared-workspace)`, (0,3,0))가
    // `.maximized` CSS(0,2,0)보다 이겨 left/top만 8px로 가고 크기는 그대로 둔다
    // (2026-09-18 실측). CSS 특이성 경쟁 대신 인라인 스타일로 이긴다(R2 추가 없음).
    windowEl.style.position = "fixed";
    windowEl.style.left = "8px";
    windowEl.style.top = "8px";
    windowEl.style.width = "calc(100vw - 16px)";
    windowEl.style.height = "calc(100vh - 16px)";
    windowEl.style.maxWidth = "none";
    windowEl.style.maxHeight = "none";
  } else {
    windowEl.style.position = "";
    windowEl.style.left = "";
    windowEl.style.top = "";
    windowEl.style.width = "";
    windowEl.style.height = "";
    windowEl.style.maxWidth = "";
    windowEl.style.maxHeight = "";
  }
  button.replaceChildren(windowIcon(isMaximized ? "restore" : "maximize"));
  button.title = isMaximized ? "창 크기로 복원 (Esc)" : "전체 화면";
  button.setAttribute("aria-label", isMaximized ? "데이터베이스 창 크기로 복원" : "데이터베이스 전체 화면");
  // 토글 버튼이면서 눌림 상태 신호가 없었다 — 이벤트 에디터의 전체화면 버튼과 규약을 맞춘다.
  button.setAttribute("aria-pressed", String(isMaximized));
}

/** 전체 화면이면 Esc 의 첫 타는 복원이다(닫기는 그다음). 이벤트 에디터와 같은 규약. */
function exitMaximizedDatabaseModal(button: HTMLButtonElement): boolean {
  const windowEl = button.closest(".database-modal-window");
  if (!(windowEl instanceof HTMLElement) || !windowEl.classList.contains("maximized")) return false;
  toggleMaximizedDatabaseModal(button);
  return true;
}
