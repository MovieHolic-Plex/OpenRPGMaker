// 앱 진입점: store 로드 + 에디터 부팅.

// ⚠ 순서 의존: 전역 오류 트랩이 **가장 먼저** 평가돼야 한다. import 는 호이스팅되므로
// 아래 무거운 import(@/app/mode → 편집기 모듈 트리) 들의 top-level 평가가 본문보다 앞선다.
// 그 평가 중에 터지는 예외를 잡으려면 트랩 모듈이 첫 import 여야 한다 —
// 이 모듈은 import 시점에 스스로 설치한다(근거는 src/app/errorTrap.ts 하단 주석).
import { installGlobalErrorTrap } from "@/app/errorTrap";
import { installVitePreloadRecovery } from "@/app/moduleLoadRecovery";
import "./styles/index.css";
// ⚠ 순서 의존: 저장 키 마이그레이션이 editorUiMode 보다 **먼저** 평가돼야 한다.
// editorUiMode 는 import 시점에 localStorage 를 읽는다(ensureHydrated). 자세한 이유는
// src/storageBoot.ts 헤더 주석 — 진입점 본문의 함수 호출로는 안 된다(import 호이스팅).
import "@/storageBoot";
import "@/editor/editorUiMode";
import { bootApp } from "@/app/mode";
import { editorState } from "@/editor/editorState";
import { addEvent } from "@/editor/eventActions";
import { addEventPage, ensureEventPages } from "@/editor/eventPages";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { store } from "@/project/store";
import { hasElectronBridge } from "@/project/persistence/electronRepository";
import { adoptElectronOpenProject } from "@/project/persistence/repository";

// 첫 import 에서 이미 설치됐다(idempotent). 진입점에 남겨두는 이유는 부팅 순서에서
// 이게 1번이라는 사실을 코드로 읽히게 하려는 것 — 누가 import 를 정리해도 의도가 남는다.
installGlobalErrorTrap();
installVitePreloadRecovery();

// 개발/테스트 플래그를 URL 파라미터에서 body class로 변환.
// 각 플래그는 대응하는 CSS 모드(palette compact scroll 등)를 토글한다.
// 예: ?paletteVerticalCategoryScroll=1 → body.palette-vertical-category-scroll
const FEATURE_FLAGS = [
  "paletteVerticalCategoryScroll",
  "paletteSelectKeepsScroll",
  "rm2kShell",
  "rm2k3Shell",
  "koreanAuthoring",
] as const;
if (typeof window !== "undefined" && window.location) {
  const params = new URLSearchParams(window.location.search);
  for (const flag of FEATURE_FLAGS) {
    if (params.has(flag)) {
      document.body.classList.add(flag.replace(/([A-Z])/g, "-$1").toLowerCase());
    }
  }
  if (window.oprn?.closeIsHostDriven === true) {
    // 닫기는 주 프로세스가 flush-before-close 로 연다 — 브라우저 beforeunload 경고와 겹치지 않게 한다.
    window.oprn.lifecycle.onFlushBeforeClose(() => {
      void store.flush().finally(() => { void window.oprn?.lifecycle.flushDone(); });
    });
    // 파일 → 저장(CmdOrCtrl+S). 저장은 store 가 소유하므로 메뉴는 요청만 보내고 여기서 flush 한다.
    window.oprn?.lifecycle.onSaveRequest(() => {
      void store.flush().catch((error) => {
        console.error("[store] 메뉴 저장 실패:", error);
      });
    });
  }

  window.addEventListener("beforeunload", (event) => {
    if (window.oprn?.closeIsHostDriven === true) return;
    // Local-first: flush whenever dirty, not only when autosave UI says pending/saving.
    // Paint during an in-flight save can leave dirty=true while status briefly reads "saved".
    if (store.hasUnsavedChanges()) {
      void store.flush().catch((error) => {
        console.error("[store] beforeunload auto-save flush failed:", error);
      });
      // 미저장 변경 경고(도그푸딩 결함 ⑧): 저장이 꺼진/실패한 상태에서 변경을 들고
      // 창을 닫으면 브라우저 확인 다이얼로그를 띄운다(P1에서 삭제 12건 무경고 증발).
      event.preventDefault();
      event.returnValue = "";
    }
  });
}

const app = document.getElementById("app");
if (!app) {
  throw new Error("#app 요소를 찾을 수 없습니다.");
}

// DEV 전용 검증 훅: e2e/비주얼 QA가 스토어 상태(드래프트 수명주기 등)를 실측할 수 있게 한다.
// 동적 import는 별도 모듈 인스턴스를 만들어 앱 스토어를 못 보므로(2026-08-18 실측) 여기서 노출한다.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __oprnEditorStore?: typeof store }).__oprnEditorStore = store;
}

void registerPwaIfEnabled();
void bootEditorWithOpenedProject(app).then(openClassicEventEditorCaptureIfRequested);

/**
 * 시작 화면이 폴더를 열어둔 채 편집기 창으로 넘어오면, 렌더러의 저장소는 그 사실을 모른다 —
 * 부팅 전에 브리지로 조회해 세션을 이어받는다(설계 7.3). 브라우저에서는 no-op 이다.
 */
async function bootEditorWithOpenedProject(host: HTMLElement): Promise<void> {
  await adoptElectronOpenProject();
  await bootApp(host);
}

async function registerPwaIfEnabled(): Promise<void> {
  if (!shouldLoadPwaModule()) return;
  const { registerPwa } = await import("@/pwa");
  registerPwa();
}

function shouldLoadPwaModule(): boolean {
  if (hasElectronBridge()) return false;
  if (import.meta.env.PROD) return true;
  return new URLSearchParams(window.location.search).has("enablePwa");
}

async function openClassicEventEditorCaptureIfRequested(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("classicCapture") !== "2") return;

  const mapId = editorState.get().currentMapId ?? store.getCurrent().startMapId;
  const map = store.getCurrent().maps[mapId];
  if (!map) return;

  const eventId = map.events[0]?.id ?? addEvent(mapId, 2, 2);
  ensureEventPages(mapId, eventId);
  let pages = store.getCurrent().maps[mapId]?.events.find((event) => event.id === eventId)?.pages ?? [];
  while (pages.length < 3) {
    addEventPage(mapId, eventId);
    pages = store.getCurrent().maps[mapId]?.events.find((event) => event.id === eventId)?.pages ?? [];
  }
  editorState.set({ selectedEventId: eventId, selectedEventPageId: pages[2]?.id ?? pages[pages.length - 1]?.id ?? null });
  openEventEditorModal(mapId, eventId);
}
