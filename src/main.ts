// 앱 진입점: store 로드 + 에디터 부팅.

// ⚠ 순서 의존: 전역 오류 트랩이 **가장 먼저** 평가돼야 한다. import 는 호이스팅되므로
// 아래 무거운 import(@/app/mode → 편집기 모듈 트리) 들의 top-level 평가가 본문보다 앞선다.
// 그 평가 중에 터지는 예외를 잡으려면 트랩 모듈이 첫 import 여야 한다 —
// 이 모듈은 import 시점에 스스로 설치한다(근거는 src/app/errorTrap.ts 하단 주석).
import { installGlobalErrorTrap } from "@/app/errorTrap";
// 두 번째 import: 번들 첫 평가 시각을 새긴다(import 시점 부수효과). 아래 무거운 모듈 평가가 이 뒤에 온다.
import { bootMark, installBootSummaryFallback } from "@/util/bootMarks";
import { installVitePreloadRecovery } from "@/app/moduleLoadRecovery";
import "./styles/index.css";
import { mountWindowControls } from "@/start/windowControls";
// ⚠ 순서 의존: 저장 키 마이그레이션이 import 시점에 localStorage 를 읽는 모듈보다 **먼저**
// 평가돼야 한다. 자세한 이유는 src/storageBoot.ts 헤더 주석 — 진입점 본문의 함수 호출로는
// 안 된다(import 호이스팅).
import "@/storageBoot";
import { initializeTeamAccess, startTeamSession } from "@/editor/teamSession";
import { loadSharedTileReferences } from "@/project/sharedTileReferences";
import { loadSharedContent } from "@/project/sharedContent";
import { installReferenceDocumentOwners } from "@/project/installReferenceOwners";
import { bootApp, isModeShellMounted as modeShellMountedForBootFailure } from "@/app/mode";
import { dismissBootLoader, failBootLoader, reportBootStage } from "@/app/bootLoader";
import { afterBootSettled, expectBootSettle } from "@/util/bootSettled";
import { preloadBundledJsonForProject } from "@/project/defaults/bundledJson";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { reloadFlushAllowsReload } from "../electron/shared/reloadFlow";
import { hasElectronBridge } from "@/project/persistence/electronRepository";
import { adoptElectronOpenProject } from "@/project/persistence/repository";
import { initI18n } from "@/i18n";
import { configureProjectInterviewBootPreparation } from "@/editor/projectInterviewBootPreparation";

// 첫 import 에서 이미 설치됐다(idempotent). 진입점에 남겨두는 이유는 부팅 순서에서
// 이게 1번이라는 사실을 코드로 읽히게 하려는 것 — 누가 import 를 정리해도 의도가 남는다.
installGlobalErrorTrap();
installBootSummaryFallback();
installVitePreloadRecovery();
// 로드 직후 걸리는 «한가할 때» 일(요약 데우기)은 첫 화면 뒤로 미룬다(src/util/bootSettled.ts).
expectBootSettle();
// 번들 타일셋 정의 JSON 은 부팅에 싣지 않는다(bundledJson.ts). 첫 화면 뒤 한가할 때 열린 프로젝트의 맵이 쓰는 칩셋 것만 읽어 둔다 —
// 조립 도구·팔레트가 번들 판본을 물을 때 동기 읽기로 떨어지지 않게. 나머지는 쓰일 때 읽는다.
afterBootSettled(() => {
  const run = () => { void preloadBundledJsonForProject(store.getCurrent()).catch((error: unknown) => console.warn("[bundled-json] 미리 읽기 실패", error)); };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 5_000 });
  else setTimeout(run, 1_000);
});
// 번들의 모든 import 평가가 끝났다(여기까지가 «JS 내려받기 + 파싱 + 평가»).
bootMark("js-ready");

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
  mountWindowControls();
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
    // 보기 → 새로고침·개발자 도구의 새로고침. 리스너가 붙기 전에는 메인이 바로 새로고침한다.
    window.oprn.lifecycle.markFlushReady?.();
    window.oprn.lifecycle.onFlushBeforeReload?.(() => {
      void store.flush().then(
        (result) => {
          const ok = reloadFlushAllowsReload(result.kind, store.hasUnsavedChanges());
          void window.oprn?.lifecycle.flushReloadDone?.(ok);
        },
        (error: unknown) => {
          console.error("[store] 새로고침 전 저장 실패:", error);
          void window.oprn?.lifecycle.flushReloadDone?.(false);
        },
      );
    });
    // 파일 → 새 프로젝트·폴더 열기. flush 가 끝나고 남은 변경이 없을 때만 메인이 폴더를 바꾼다.
    window.oprn.lifecycle.onFlushBeforeReplace?.(() => {
      void store.flush().then(
        (result) => {
          window.oprn?.lifecycle.flushReplaceDone?.({ kind: result.kind, dirty: store.hasUnsavedChanges() });
        },
        (error: unknown) => {
          console.error("[store] 폴더를 바꾸기 전에 저장하지 못했습니다:", error);
          window.oprn?.lifecycle.flushReplaceDone?.({ kind: "error", dirty: true });
        },
      );
    });
    window.oprn.lifecycle.flushReplaceReady?.();  }

  window.addEventListener("beforeunload", (event) => {
    if (window.oprn?.closeIsHostDriven === true) {
      // 창 닫기는 메인이 close 에서 먼저 막으므로 여기까지 오지 않는다.
      // 개발자 도구의 새로고침은 보기 메뉴를 타지 않는다. 미저장이면 막고, 메인이 저장한 뒤 다시 연다.
      if (store.hasUnsavedChanges()) {
        try { window.oprn.lifecycle.noteUnsavedReloadBlock?.(); } catch { /* 막기만 해도 편집은 남는다. */ }
        event.preventDefault();
        event.returnValue = "";
      }
      return;
    }
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
// 부팅이 어디서 터지든 첫 로드 로더가 오류 화면·빈 셸을 덮은 채 남지 않게 한다(정상 경로는 mode.ts 가 먼저 걷는다).
void bootEditorWithOpenedProject(app)
  .then(dismissBootLoader, (error: unknown) => {
    // 부팅이 던졌다. 스플래시가 아직 떠 있으면(= 편집기 셸이 안 떴다) 걷지 말고 실패 메시지 + 다시 시도를 보인다 —
    // 걷으면 빈 셸만 남고, 안 걷으면 영원히 돈다. 셸이 이미 떴으면 걷고(원래 동작) 오류는 그대로 던진다.
    if (document.getElementById("oprn-boot-loader") && !modeShellMountedForBootFailure()) {
      failBootLoader(error, "unknown");
      console.error("[boot] editor boot failed:", error);
      return;
    }
    dismissBootLoader();
    throw error;
  })
  .then(openClassicEventEditorCaptureIfRequested)
  // 스토어 「에디터에서 열기」 링크: 편집기가 뜬 뒤에 받는다(부팅 전에 온 요청은 메인이 맡겨 두었다).
  .then(() => import("@/editor/assetStore/storeOpenLink"))
  .then(({ installStoreOpenLinks }) => installStoreOpenLinks());

/**
 * 시작 화면이 폴더를 열어둔 채 편집기 창으로 넘어오면, 렌더러의 저장소는 그 사실을 모른다 —
 * 부팅 전에 브리지로 조회해 세션을 이어받는다(설계 7.3). 브라우저에서는 no-op 이다.
 */
async function bootEditorWithOpenedProject(host: HTMLElement): Promise<void> {
  reportBootStage("prepare");
  await initI18n();
  await adoptElectronOpenProject();
  await initializeTeamAccess();
  // 공용 타일 참고문서는 프로젝트에 이미 있는 업로드 타일셋만 보강하고 타일셋을 새로 설치하지 않는다(설치는
  // shared-content 가 한다). 부팅이 기다릴 이유가 없다 — 실측(2026-09-26): 191MB 응답이 10s 제한에 걸려 팀 호스트 부팅이 +10s.
  const tileReferences = loadSharedTileReferences();
  reportBootStage("shared");
  await loadSharedContent({ scope: "defaults" });
  // 공용 카탈로그가 설치된 뒤·프로젝트 로드 전에 켠다 — 로드가 표지를 되돌릴 소유자 판본을 알아야 한다.
  installReferenceDocumentOwners();
  let remainingContent: Promise<void> | undefined;
  const loadRemainingContent = () => remainingContent ??= loadSharedContent({ scope: "rest" });
  configureProjectInterviewBootPreparation(async () => {
    // References can need libraries outside the boot-default scope. Start those
    // here too: waiting for bootApp to return would deadlock its interview handoff.
    await Promise.all([tileReferences, loadRemainingContent()]);
    store.applySharedReferenceRefresh();
  });
  await bootApp(host);
  startTeamSession();
  void tileReferences.then(() => store.applySharedReferenceRefresh());
  // 장소·지역 카탈로그 전체는 편집기가 뜬 뒤 받는다. 기본 라이브러리는 위에서 이미 설치됐으므로
  // 정규화 결과(프로젝트에 들어가는 shared_* 타일셋)는 바뀌지 않는다.
  // 나머지(rest)만 받아 합친다 — 전체(all)를 받으면 위에서 받은 기본 20MB(gzip)가 두 번 온다(2026-09-27 실측).
  void loadRemainingContent();
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
  // 캡처 전용 경로 — 이벤트 편집기 모달은 조수 도구 목록까지 끌고 와서 진입 번들에 정적으로 두지 않는다(2026-10-20).
  const [{ addEvent }, { addEventPage, ensureEventPages }, { openEventEditorModal }] = await Promise.all([
    import("@/editor/eventActions"),
    import("@/editor/eventPages"),
    import("@/editor/panels/eventEditor/modal"),
  ]);

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
