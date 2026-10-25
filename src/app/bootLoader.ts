// 첫 로드 스플래시(index.html 의 #oprn-boot-loader) 걷어내기·단계 알림·실패 표시.
//
// 스플래시는 JS 없이 HTML+CSS 만으로 첫 프레임에 그려지고, 단계 표시·시간 안내·오류 화면은 public/boot-splash.js 가 번들과
// 무관하게 맡는다(Electron app:// CSP 는 인라인 스크립트를 막으므로 외부 클래식 스크립트다). 이 모듈은 번들이 아는 사실 —
// «지금 어느 부팅 단계인가», «첫 화면이 떴다», «부팅이 실패했다» — 만 `window.__oprnBootSplash` 로 넘긴다.
//
// 진행 줄은 가짜 퍼센트가 아니다: 실제 단계 이벤트(prepare → shared → project → editor)에 맞춰 4칸이 이산적으로 찬다.
// (예전 구현은 단계마다 시간 곡선으로 0~100% 를 그렸다 — 큰 프로젝트에서 숫자가 실제와 따로 놀았다.)
//
// 로더가 없는 환경(플레이어·테스트·두 번째 부팅)에서는 모든 호출이 마크만 새기고 아무것도 안 한다.

import { markBootSettled } from "@/util/bootSettled";
import { bootMark } from "@/util/bootMarks";

const BOOT_LOADER_ID = "oprn-boot-loader";

export type BootStage = "prepare" | "shared" | "project" | "editor";
export type BootFailureKind = "bundle" | "script" | "project" | "unknown";

interface BootSplashApi {
  stage(id: BootStage): void;
  fail(kind: BootFailureKind, detail?: string): void;
  leave(): void;
}

function loaderElement(): HTMLElement | null {
  // 테스트의 가짜 document(test/fakeDom.ts)는 getElementById 가 없다 — 부팅 경로를 깨지 않게 조용히 넘어간다.
  if (typeof document === "undefined" || typeof document.getElementById !== "function") return null;
  return document.getElementById(BOOT_LOADER_ID);
}

function splashApi(): BootSplashApi | null {
  if (typeof window === "undefined") return null;
  const api = (window as unknown as { __oprnBootSplash?: BootSplashApi }).__oprnBootSplash;
  return api && typeof api.stage === "function" ? api : null;
}

/** 부팅 단계를 알린다. 로더가 없으면(두 번째 부팅·플레이어·테스트) 마크만 새긴다. */
export function reportBootStage(stage: BootStage): void {
  bootMark(stage);
  const loader = loaderElement();
  if (!loader || loader.dataset.leaving !== undefined) return;
  splashApi()?.stage(stage);
}

/** 부팅이 끝내 못 열렸다 — 스플래시를 영원히 돌리지 않고 메시지와 «다시 시도»를 보인다. 로더가 없으면 아무것도 안 한다. */
export function failBootLoader(error: unknown, kind: BootFailureKind = "unknown"): void {
  bootMark(`failed-${kind}`);
  markBootSettled();
  const loader = loaderElement();
  if (!loader || loader.dataset.leaving !== undefined) return;
  const detail = error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack.split("\n").slice(1, 4).join("\n")}` : ""}` : String(error);
  splashApi()?.fail(kind, detail);
}

/** 멱등. 로더가 없으면(플레이어·테스트·두 번째 호출) 첫 화면 신호만 켠다. */
export function dismissBootLoader(): void {
  // 로더가 없어도(플레이어·테스트·두 번째 부팅) 첫 화면 신호는 켠다 — 미뤄 둔 한가한 일이 영영 안 도는 것을 막는다.
  markBootSettled();
  const loader = loaderElement();
  if (!loader || loader.dataset.leaving !== undefined) return;
  // 실패 화면이 떠 있으면 걷지 않는다 — 메시지와 «다시 시도»가 사라지면 빈 셸만 남는다.
  if (loader.hasAttribute("data-failed")) return;
  bootMark("settled");
  splashApi()?.leave();
  // 데스크톱: 이제 이 화면을 «마지막 편집 화면»으로 찍어도 된다(electron/main/lastView.ts — 다음 부팅의 자리표시).
  (window as unknown as { oprn?: { resume?: { editorReady?: () => void } } }).oprn?.resume?.editorReady?.();
  loader.dataset.leaving = "";
  // 페이드아웃 뒤 DOM 에서 뺀다. reduced-motion(transition:none)이면 transitionend 가 안 오므로 시간으로.
  setTimeout(() => loader.remove(), 200);
}
