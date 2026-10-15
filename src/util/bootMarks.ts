/**
 * 부팅 단계 시각 계측(`performance.mark("oprn:boot:<이름>")`).
 *
 * 왜(2026-10-15): 시작 느림 조사가 매번 CPU 프로필·로그 끼워 넣기로 시작했다. 단계 시각을 상시 남겨 두면 개발자 콘솔에서
 * `__oprnBoot()`(요약) / `__oprnBoot(true)`(표) 한 줄로 «어느 구간이 느렸나»를 본다. 비용은 마크 한 번에 마이크로초.
 *
 * 마크 이름 규칙(boot-splash.js 와 같다): html(스플래시 스크립트 실행) → js-eval-start(번들 첫 모듈 평가) → js-ready(번들 평가 끝) →
 * prepare·shared·project·editor(reportBootStage 단계) → project-loaded·normalized(store.load) → shell-mounted → settled(입력 가능).
 * `window.__oprnBoot` 는 public/boot-splash.js 가 정의한다. 스플래시가 없는 환경(플레이어·테스트)에서는 이 모듈이 같은 모양으로 채운다.
 */

const PREFIX = "oprn:boot:";

/** 이름 하나를 현재 시각으로 새긴다. 같은 이름을 다시 새기면 마지막 값이 요약에 쓰인다. 환경이 안 받쳐 주면 조용히 넘어간다. */
export function bootMark(name: string): void {
  try {
    if (typeof performance !== "undefined" && typeof performance.mark === "function") performance.mark(`${PREFIX}${name}`);
  } catch {
    // 계측은 부팅을 깨지 않는다.
  }
}

export interface BootMarkRow {
  readonly stage: string;
  readonly atMs: number;
  readonly sincePrevMs: number | null;
}

/** 새겨진 부팅 마크를 시간순으로. 칠하기(paint) 항목도 함께 넣는다. */
export function bootSummary(): BootMarkRow[] {
  const rows: BootMarkRow[] = [];
  try {
    let previous = 0;
    for (const entry of performance.getEntriesByType("mark")) {
      if (!entry.name.startsWith(PREFIX)) continue;
      const at = Math.round(entry.startTime);
      rows.push({ stage: entry.name.slice(PREFIX.length), atMs: at, sincePrevMs: at - previous });
      previous = at;
    }
    for (const paint of performance.getEntriesByType("paint")) {
      rows.push({ stage: paint.name, atMs: Math.round(paint.startTime), sincePrevMs: null });
    }
  } catch {
    // 요약 실패는 빈 표로.
  }
  return rows.sort((a, b) => a.atMs - b.atMs);
}

/** 스플래시 스크립트가 없는 환경(플레이어·헤드리스)에서만 `window.__oprnBoot` 를 채운다. */
export function installBootSummaryFallback(): void {
  if (typeof window === "undefined") return;
  const target = window as unknown as { __oprnBoot?: (table?: boolean) => BootMarkRow[] };
  if (typeof target.__oprnBoot === "function") return;
  target.__oprnBoot = (table?: boolean) => {
    const rows = bootSummary();
    if (table === true && typeof console !== "undefined" && typeof console.table === "function") console.table(rows);
    return rows;
  };
}

// 번들 첫 모듈 평가 시각 — main.ts 가 이 모듈을 가장 먼저 import 한다.
bootMark("js-eval-start");
