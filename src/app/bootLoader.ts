// 첫 로드 로더(index.html 의 #oprn-boot-loader) 걷어내기.
// 로더는 JS 없이 HTML 만으로 그려지는 고정 오버레이라, 편집기가 지우지 않으면 계속 덮는다
// (bootApp 은 #app 을 비우지 않고 append 한다). 편집기 셸 마운트·부팅 실패 화면 양쪽에서 부른다.
//
// 진행 막대: 번들이 뜨기 전에는 index.html 의 CSS 애니메이션이 0→12% 를 천천히 채운다(인라인 스크립트는
// Electron CSP 에서 막히므로 JS 없이). 번들이 뜨면 reportBootStage 가 단계별 구간을 넘겨받는다.
//
// 막대는 transform(scaleX) 전환으로 움직인다 — 합성 스레드가 그리므로 메인 스레드가 막혀도 계속 찬다.
// 실측(2026-09-28, 8.9MB 프로젝트): 역직렬화·정규화가 메인 스레드를 9초 붙잡아 JS 타이머로 그린 막대는
// 36% 에 서 있다가 85% 로 튀었다. 단계마다 끝값 근처까지 긴 ease-out 전환을 걸고, 숫자는 메인 스레드가
// 풀릴 때 막대의 현재 계산값을 읽어 맞춘다. 다음 단계 값은 앞지르지 않는다.
// 큰 프로젝트(80MB+)는 「프로젝트 불러오기」가 수 초에서 수십 초라 그 구간을 가장 넓게 잡았다.

const BOOT_LOADER_ID = "oprn-boot-loader";

export type BootStage = "prepare" | "shared" | "project" | "editor";

interface StageSpec {
  readonly from: number;
  readonly to: number;
  /** 막대가 구간 끝값의 약 90% 까지 가는 데 걸리는 시간(ms). 이 단계의 느린 쪽 길이로 잡는다. */
  readonly durationMs: number;
  /** 상태 문구. 없으면 index.html 의 「불러오는 중…」(언어별로 이미 바뀐 글)을 그대로 둔다. */
  readonly label?: string;
}

export const BOOT_STAGES: Readonly<Record<BootStage, StageSpec>> = {
  prepare: { from: 12, to: 20, durationMs: 3000 },
  shared: { from: 20, to: 35, durationMs: 6000, label: "공용 자료 받는 중…" },
  project: { from: 35, to: 85, durationMs: 15000, label: "프로젝트 불러오는 중…" },
  editor: { from: 85, to: 97, durationMs: 6000, label: "편집기 여는 중…" },
};

/** 단계가 전환으로 향하는 막대 값(%). 구간의 90% 지점 — 끝값은 다음 단계 몫으로 남긴다. */
export function bootStageTarget(stage: BootStage, startAt?: number): number {
  const spec = BOOT_STAGES[stage];
  const from = Math.min(spec.to, Math.max(spec.from, startAt ?? spec.from));
  return from + (spec.to - from) * 0.9;
}

let ticker: ReturnType<typeof setInterval> | null = null;

function loaderElement(): HTMLElement | null {
  // 테스트의 가짜 document(test/fakeDom.ts)는 getElementById 가 없다 — 부팅 경로를 깨지 않게 조용히 넘어간다.
  if (typeof document === "undefined" || typeof document.getElementById !== "function") return null;
  return document.getElementById(BOOT_LOADER_ID);
}

/** 막대가 지금 그려진 값(%) — 전환 중이면 계산된 transform 의 scaleX 를 읽는다. */
function renderedPercent(fill: HTMLElement | null): number {
  if (!fill || typeof getComputedStyle !== "function") return 0;
  const transform = getComputedStyle(fill).transform;
  const match = /^matrix\(([^,]+)/.exec(transform ?? "");
  const scale = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(scale) ? Math.max(0, Math.min(100, scale * 100)) : 0;
}

function writePercent(loader: HTMLElement, percent: number): void {
  const rounded = Math.round(percent);
  const bar = loader.querySelector<HTMLElement>(".oprn-boot-progress");
  const value = loader.querySelector<HTMLElement>(".oprn-boot-percent");
  if (bar) bar.setAttribute("aria-valuenow", String(rounded));
  if (value) value.textContent = `${rounded}%`;
}

/** 막대를 현재 값에서 target 으로 durationMs 동안 전환시킨다. 막대는 뒤로 가지 않는다. */
function driveBar(loader: HTMLElement, target: number, durationMs: number): number {
  const fill = loader.querySelector<HTMLElement>(".oprn-boot-progress-fill");
  const current = renderedPercent(fill);
  const next = Math.max(current, target);
  if (fill) {
    // CSS 키프레임(번들 전 0→12%)을 끄기 전에 지금 값을 고정해 두어야 튀지 않는다.
    fill.style.transition = "none";
    fill.style.transform = `scaleX(${(current / 100).toFixed(4)})`;
    loader.dataset.progress = "js";
    void fill.getBoundingClientRect();
    fill.style.transition = `transform ${durationMs}ms cubic-bezier(0.2, 0.7, 0.3, 1)`;
    fill.style.transform = `scaleX(${(next / 100).toFixed(4)})`;
  } else {
    loader.dataset.progress = "js";
  }
  writePercent(loader, current);
  return current;
}

function tick(): void {
  const loader = loaderElement();
  if (!loader || loader.dataset.leaving !== undefined) {
    stopTicker();
    return;
  }
  writePercent(loader, renderedPercent(loader.querySelector<HTMLElement>(".oprn-boot-progress-fill")));
}

function stopTicker(): void {
  if (ticker !== null) clearInterval(ticker);
  ticker = null;
}

/** 부팅 단계를 알린다. 로더가 없으면(두 번째 부팅·플레이어·테스트) 아무것도 안 한다. 막대는 뒤로 가지 않는다. */
export function reportBootStage(stage: BootStage): void {
  const loader = loaderElement();
  if (!loader || loader.dataset.leaving !== undefined) return;
  const spec = BOOT_STAGES[stage];
  const fill = loader.querySelector<HTMLElement>(".oprn-boot-progress-fill");
  const startAt = Math.max(spec.from, renderedPercent(fill));
  // 이 단계 시작값까지는 짧게 따라잡고, 거기서부터 끝값 근처까지 긴 전환을 건다.
  driveBar(loader, bootStageTarget(stage, startAt), spec.durationMs);
  if (spec.label) {
    const status = loader.querySelector<HTMLElement>(".oprn-boot-text");
    // 한국어 원문을 쓴다 — 다른 언어는 DOM 번역 계층(src/i18n/domTranslator.ts)이 카탈로그로 바꾼다.
    if (status) status.textContent = spec.label;
  }
  if (ticker === null) ticker = setInterval(tick, 150);
}

/** 멱등. 로더가 없으면(플레이어·테스트·두 번째 호출) 아무것도 안 한다. */
export function dismissBootLoader(): void {
  const loader = loaderElement();
  if (!loader || loader.dataset.leaving !== undefined) return;
  stopTicker();
  driveBar(loader, 100, 160);
  writePercent(loader, 100);
  loader.dataset.leaving = "";
  // 페이드아웃 뒤 DOM 에서 뺀다. reduced-motion(transition:none)이면 transitionend 가 안 오므로 시간으로.
  setTimeout(() => loader.remove(), 200);
}
