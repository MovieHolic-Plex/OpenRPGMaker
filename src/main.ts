// 앱 진입점: store 로드 + 에디터 부팅.

import "./styles/index.css";
// Hydrate basic/expert UI mode (+ body class + window.__rpgzzuEditorUiMode) before shell paint.
import "@/editor/editorUiMode";
import { bootApp } from "@/app/mode";
import { editorState } from "@/editor/editorState";
import { addEvent } from "@/editor/eventActions";
import { addEventPage, ensureEventPages } from "@/editor/eventPages";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { store } from "@/project/store";

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
  window.addEventListener("beforeunload", (event) => {
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

void registerPwaIfEnabled();
void bootApp(app).then(openClassicEventEditorCaptureIfRequested);

async function registerPwaIfEnabled(): Promise<void> {
  if (!shouldLoadPwaModule()) return;
  const { registerPwa } = await import("@/pwa");
  registerPwa();
}

function shouldLoadPwaModule(): boolean {
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
