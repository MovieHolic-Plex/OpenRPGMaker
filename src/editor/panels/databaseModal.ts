import { openAiAssistantPanel, sendAiAssistantMessage } from "@/editor/aiAssistantBridge";
import { dismissCoachMarks } from "@/editor/coachMarks";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { handleHistoryHotkey } from "@/editor/hotkeys";
import {
  databaseTabLabel,
  getDatabaseActiveTab,
  refreshDatabasePanel,
  renderDatabasePanel,
  setDatabaseActiveTab,
  type DatabaseTab,
} from "@/editor/panels/database";
import { createDatabaseModalDirtySession } from "@/editor/panels/databaseModalDirtySession";
import { applyDatabaseChanges } from "@/editor/panels/databaseModalPersistence";
import { startModalDrag, stopModalDrag } from "@/editor/panels/databaseModalWindowDrag";
import { resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { selectedRecordIdForSession } from "@/editor/panels/databaseRecordViewSession";
import { isStructureKitEditorOpen } from "@/editor/panels/structureKitEditorDialog";
import { DATABASE_APPLY_BUTTON_HINT, DATABASE_FOOTER_ACTION_TEST_IDS, databaseFooterStatusText } from "@/editor/panels/databaseWorkbench";
import {
  createEditorModalDirtyCloseController,
  EDITOR_MODAL_DIRTY_DECISION,
  type EditorModalCloseAttempt,
  type EditorModalDirtyDecision,
} from "@/editor/panels/editorModalDirtyState";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

type ActiveDatabaseModalHandle = {
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

export function openDatabaseModal(initialTab?: DatabaseTab): void {
  // 맵 도구 레일을 가리키는 온보드 코치마크가 body 최상위에 매달려 모달 위를 덮어
  // 목록 제목과 탭 검색을 가리는 사고가 있었다 — 모달이 열리면 화면을 모달에게 넘긴다.
  // 본 것으로 기록하지는 않는다(welcome intent 와 같은 정책).
  dismissCoachMarks();
  // 재오픈 경로: DOM 만 뜯어내면 이전 인스턴스의 document keydown 리스너 2개가 남는다
  // (M11 과 동일 원리) — 반드시 기존 인스턴스의 정식 close() 를 경유해 정리한다.
  activeModal?.close();
  // close() 가 backdrop 을 지우지만, 혹시 핸들 없이 남은 고아 DOM 도 방어적으로 제거.
  document.querySelector("[data-testid='database-modal']")?.remove();
  if (initialTab) setDatabaseActiveTab(initialTab);
  resetDatabaseRecordViewSession();
  const dirtySession = createDatabaseModalDirtySession();
  // 사이드 도킹(M8): 모달⇄우측 도크 토글 상태. localStorage 에 저장돼 다음 오픈 시 복원된다.
  let dockMode = false;

  const body = el("div", { class: "database-modal-body" });
  const maximizeButton = el("button", {
    class: "database-modal-maximize",
    text: "□",
    attrs: { type: "button", title: "전체 화면", "aria-label": "데이터베이스 전체 화면" },
    dataset: { testid: "database-modal-maximize" },
  }) as HTMLButtonElement;
  const closeButton = el("button", {
    class: "database-modal-close",
    text: "x",
    attrs: { type: "button", title: "닫기", "aria-label": "데이터베이스 닫기" },
    dataset: { testid: "database-modal-close" },
  }) as HTMLButtonElement;
  const dockToggleButton = el("button", {
    class: "database-modal-dock-toggle",
    text: "⇥",
    attrs: { type: "button", title: "사이드 도크로 전환", "aria-label": "사이드 도크로 전환" },
    dataset: { testid: "database-dock-toggle" },
  }) as HTMLButtonElement;
  const windowControls = el("div", {
    class: "database-modal-controls",
    children: [dockToggleButton, maximizeButton, closeButton],
  });
  // ── AI 연결(M7): 제목 옆 ✨ AI 토글 → 헤더 아래 인라인 바(입력+실행+닫기). ──
  // 응답/제안 카드는 기존 채팅 패널 흐름 그대로 — 여기서는 전송과 도크 열기만 한다.
  const aiToggleButton = el("button", {
    class: "database-ai-toggle",
    text: "AI 어시스턴트",
    attrs: { type: "button", title: "AI 어시스턴트 열기", "aria-label": "에디터 AI 어시스턴트 열기", "aria-expanded": "false" },
    dataset: { testid: "database-ai-toggle" },
  }) as HTMLButtonElement;
  const aiInput = el("input", {
    class: "database-ai-input",
    attrs: { type: "text", placeholder: "프로젝트, 맵, 이벤트, 데이터에 관해 무엇이든 물어보세요", "aria-label": "AI에게 보낼 요청" },
    dataset: { testid: "database-ai-input" },
  }) as HTMLInputElement;
  const aiRunButton = el("button", {
    class: "database-ai-run",
    text: "실행",
    attrs: { type: "button", title: "AI에게 전달", "aria-label": "AI에게 요청 전달" },
    dataset: { testid: "database-ai-run" },
  }) as HTMLButtonElement;
  const aiCloseButton = el("button", {
    class: "database-ai-close",
    text: "×",
    attrs: { type: "button", title: "AI 바 닫기", "aria-label": "데이터베이스 AI 바 닫기" },
    dataset: { testid: "database-ai-close" },
  }) as HTMLButtonElement;
  const aiIntro = el("div", {
    class: "database-ai-intro",
    children: [
      el("span", { class: "database-ai-mark", text: "AI" }),
      el("div", {
        children: [
          el("strong", { text: "에디터 AI 어시스턴트" }),
          el("p", { text: "프로젝트 전체를 함께 살펴봅니다. 현재 화면의 맥락도 자동으로 전달됩니다." }),
        ],
      }),
    ],
  });
  const aiSuggestions = el("div", {
    class: "database-ai-suggestions",
    children: DATABASE_ASSISTANT_SUGGESTIONS.map((suggestion) => assistantSuggestion(suggestion, aiInput)),
  });
  const aiComposer = el("div", {
    class: "database-ai-composer",
    children: [aiInput, aiRunButton, aiCloseButton],
  });
  const aiBar = el("section", {
    class: "database-ai-bar",
    attrs: { "aria-label": "에디터 AI 어시스턴트" },
    dataset: { testid: "database-ai-bar" },
    children: [aiIntro, aiSuggestions, aiComposer],
  });
  aiBar.hidden = true;
  const setAiBarOpen = (open: boolean): void => {
    aiBar.hidden = !open;
    aiToggleButton.setAttribute("aria-expanded", String(open));
    if (open) aiInput.focus();
  };
  aiToggleButton.addEventListener("click", () => setAiBarOpen(aiBar.hidden));
  aiCloseButton.addEventListener("click", () => setAiBarOpen(false));
  const runAiRequest = (): void => {
    const text = aiInput.value.trim();
    if (!text) {
      aiInput.focus();
      return;
    }
    // buildSpec 정규식과 호환되는 한 줄 컨텍스트 풋터. 탭 라벨(몬스터/아이템…)과 "DB"가
    // INTENT_KEYWORDS의 db/battle 도메인 강키워드라 도구 노출도 함께 보장된다.
    const message = `${text}\n\n[컨텍스트] 에디터 전체 요청 · 현재 화면: 데이터베이스 DB 탭 ${databaseTabLabel(getDatabaseActiveTab())}${describeSelectedDatabaseRecord()}`;
    if (typeof window !== "undefined") {
      window.__oprnDbAiLastRequest = { message, at: new Date().toISOString() };
    }
    aiInput.value = "";
    // fire-and-forget: 턴 완료를 기다리지 않는다. 실패(키 미설정/패널 미마운트)만 뒤늦게 알린다.
    void sendAiAssistantMessage(message).then((result) => {
      if (!result.ok && result.error) toast(`AI 전달 실패: ${result.error}`, "error");
    });
    toast("AI에게 전달했습니다 — 채팅 패널에서 제안을 확인하세요", "ok");
    openAiAssistantPanel();
  };
  aiRunButton.addEventListener("click", runAiRequest);
  aiInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    runAiRequest();
  });
  const header = el("header", {
    class: "database-modal-header",
    children: [el("h2", { text: "데이터베이스" }), aiToggleButton, windowControls],
  });
  const backdrop = el("div", {
    class: "database-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "database-modal" },
    children: [
      el("section", {
        class: "database-modal-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "데이터베이스" },
        children: [header, aiBar, body],
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
    if (handleHistoryHotkey(event)) refreshDatabasePanel(body);
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
    if (change.scope !== "database" && change.scope !== "project") return;
    if (isEditingInsideModalBody() || withinInteractionGrace()) {
      pendingRefresh = true;
      scheduleGraceFlush();
      return;
    }
    scheduleModalRefresh();
  });
  const close = (): void => {
    modalClosed = true;
    if (graceFlushTimer !== null) clearTimeout(graceFlushTimer);
    unsubscribeStore(); // 구독 해제 — 리스너 누수 금지(1파 M11 교훈).
    backdrop.remove();
    document.removeEventListener("keydown", controller.handleKeyDown);
    document.removeEventListener("keydown", handleHistoryKeyDown);
    stopModalDrag();
    activeModal = null;
  };
  const hideDirtyPrompt = (): void => dirtyPrompt.replaceChildren();
  const saveAndMarkClean = async (): Promise<boolean> => {
    footerStatus.textContent = "변경 내용을 저장하는 중입니다.";
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
        dirtySession.discard();
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
    isDirty: dirtySession.isDirty,
    promptUnsavedChanges: showDirtyPrompt,
    save: () => {
      void saveAndMarkClean();
    },
    discard: dirtySession.discard,
    close,
  });

  activeModal = { close, requestClose: controller.requestClose };
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
  document.addEventListener("keydown", controller.handleKeyDown);
  document.addEventListener("keydown", handleHistoryKeyDown);
  const footerStatus = el("div", {
    class: "database-footer-status",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "db-footer-status" },
    text: databaseFooterStatusText(),
  });
  const dirtyPrompt = el("div", {
    class: "database-modal-dirty-prompt-region",
    dataset: { testid: "database-dirty-prompt-region" },
  });
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
      el("button", {
        class: "database-footer-button",
        text: "도움말",
        attrs: { type: "button" },
        on: { click: () => toast("데이터베이스에서 레코드와 시스템 설정을 조정합니다.", "ok") },
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
      windowEl.style.left = "";
      windowEl.style.top = "";
      windowEl.style.width = "";
      windowEl.style.height = "";
      maximizeButton.textContent = "□";
      // 도크는 모달이 아니다 — 포커스를 가두지 않고 맵과 병행 조작하는 보조 패널.
      windowEl.setAttribute("role", "complementary");
      windowEl.removeAttribute("aria-modal");
    } else {
      windowEl.setAttribute("role", "dialog");
      windowEl.setAttribute("aria-modal", "true");
    }
    maximizeButton.disabled = next;
    maximizeButton.setAttribute("aria-disabled", String(next));
    dockToggleButton.textContent = next ? "⇤" : "⇥";
    const label = next ? "창 모드로 복원" : "사이드 도크로 전환";
    dockToggleButton.setAttribute("title", label);
    dockToggleButton.setAttribute("aria-label", label);
  };
  dockToggleButton.addEventListener("click", () => applyDockMode(!dockMode));
  document.body.append(backdrop);
  renderDatabasePanel(body);
  // 지난 세션의 도크 상태 복원 — 렌더 후 적용해도 클래스/aria 만 바꾸므로 안전하다.
  if (readStoredDockMode()) applyDockMode(true);
  closeButton.focus();
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

const DATABASE_ASSISTANT_SUGGESTIONS = [
  { id: "project", label: "프로젝트 흐름 점검", prompt: "이 프로젝트의 전체 제작 상태와 다음 우선순위를 점검해줘" },
  { id: "map", label: "맵 연결 살펴보기", prompt: "맵 구성과 이동 연결을 살펴보고 빠진 동선을 찾아줘" },
  { id: "event", label: "이벤트 흐름 검토", prompt: "이벤트와 퀘스트 흐름을 검토하고 막힌 진행을 찾아줘" },
  { id: "data", label: "게임 데이터 다듬기", prompt: "현재 게임 데이터의 불균형과 연결 누락을 찾아줘" },
] as const;

function assistantSuggestion(
  suggestion: (typeof DATABASE_ASSISTANT_SUGGESTIONS)[number],
  input: HTMLInputElement,
): HTMLElement {
  return el("button", {
    class: "database-ai-suggestion",
    text: suggestion.label,
    attrs: { type: "button" },
    dataset: { testid: `database-ai-suggestion-${suggestion.id}` },
    on: {
      click: () => {
        input.value = suggestion.prompt;
        input.focus();
      },
    },
  });
}

// AI 컨텍스트 풋터의 ", 선택 레코드: <이름>(<id>)" 조각. 세션 선택이 없으면 뷰가
// 기본 선택하는 첫 레코드를 따른다(selectedRecordForSession 과 같은 규칙).
function describeSelectedDatabaseRecord(): string {
  const collection = RECORD_TAB_COLLECTIONS[getDatabaseActiveTab()];
  if (!collection) return "";
  const records: readonly { readonly id: string; readonly name: string }[] = store.getCurrent().database[collection];
  const selectedId = selectedRecordIdForSession(collection);
  const record = (selectedId ? records.find((entry) => entry.id === selectedId) : undefined) ?? records[0];
  if (!record) return "";
  return `, 선택 레코드: ${record.name || "(이름 없음)"}(${record.id})`;
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
      dirtyPromptButton("열 때 상태로 되돌리고 닫기", "database-dirty-discard", EDITOR_MODAL_DIRTY_DECISION.Discard, onDecision),
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
  const restoreNote = "되돌리기는 이 모달을 연 시점의 DB 상태로 복구합니다.";
  switch (attempt) {
    case "cancel":
      return `닫기 전에 저장하거나 되돌릴지 선택하세요. ${restoreNote}`;
    case "escape":
      return `Escape로 닫기 전에 저장하거나 되돌릴지 선택하세요. ${restoreNote}`;
    case "backdrop":
      return `바깥 영역을 눌러 닫기 전에 저장하거나 되돌릴지 선택하세요. ${restoreNote}`;
    case "x":
      return `닫기 버튼을 누르기 전에 저장하거나 되돌릴지 선택하세요. ${restoreNote}`;
  }
}

function toggleMaximizedDatabaseModal(button: HTMLButtonElement): void {
  const windowEl = button.closest(".database-modal-window");
  if (!(windowEl instanceof HTMLElement)) return;
  const isMaximized = windowEl.classList.toggle("maximized");
  if (isMaximized) {
    stopModalDrag();
    windowEl.classList.remove("floating");
    windowEl.style.left = "";
    windowEl.style.top = "";
    windowEl.style.width = "";
    windowEl.style.height = "";
  }
  button.textContent = isMaximized ? "▣" : "□";
  button.title = isMaximized ? "창 크기로 복원" : "전체 화면";
  button.setAttribute("aria-label", isMaximized ? "데이터베이스 창 크기로 복원" : "데이터베이스 전체 화면");
}
