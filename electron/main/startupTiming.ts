// 메인 프로세스 시작 단계 시각(프로세스 시작 기준 ms). main.ts 가 **가장 먼저** import 한다 — 번들에서 이 모듈의 최상위가
// 다른 모듈 평가보다 앞서 돌아야 «모듈 평가에 걸린 시간»이 보인다. 측정기(scripts/perf/startup-bench.mjs)가
// `globalThis.__oprnMainTiming` 을 읽는다. 비용은 기록 한 번에 마이크로초.
type MainTiming = Record<string, number>;
const target = globalThis as typeof globalThis & { __oprnMainTiming?: MainTiming };
target.__oprnMainTiming = { firstModule: performance.now() };

export function mainMark(name: string): void {
  if (target.__oprnMainTiming && target.__oprnMainTiming[name] === undefined) target.__oprnMainTiming[name] = performance.now();
}
