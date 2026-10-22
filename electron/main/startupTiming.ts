// 메인 프로세스 시작 단계 시각(프로세스 시작 기준 ms). main.ts 가 **가장 먼저** import 한다 — 번들에서 이 모듈의 최상위가
// 다른 모듈 평가보다 앞서 돌아야 «모듈 평가에 걸린 시간»이 보인다. 측정기(scripts/perf/startup-bench.mjs)가
// `globalThis.__oprnMainTiming` 을 읽는다. 비용은 기록 한 번에 마이크로초.
//
// OPRN_STARTUP_TRACE=1 이면 단계마다 한 줄씩 stderr 에 찍는다(`[startup] +123ms appReady`). 기준점은 프로세스 시작
// (performance.timeOrigin)이다 — 사용자가 아이콘을 누른 순간에 가장 가깝다.
type MainTiming = Record<string, number>;
const target = globalThis as typeof globalThis & { __oprnMainTiming?: MainTiming };
// 입구(main.cjs)와 본체(app.cjs)가 이 모듈을 하나씩 품는다 — 먼저 평가된 쪽이 만든 기록을 그대로 쓴다.
const firstHere = target.__oprnMainTiming === undefined;
target.__oprnMainTiming ??= { firstModule: performance.now() };
const trace = process.env.OPRN_STARTUP_TRACE === "1";
if (trace && firstHere) process.stderr.write(`[startup] +${Math.round(performance.now())}ms firstModule\n`);

export function mainMark(name: string): void {
  if (target.__oprnMainTiming && target.__oprnMainTiming[name] === undefined) {
    const at = performance.now();
    target.__oprnMainTiming[name] = at;
    if (trace) process.stderr.write(`[startup] +${Math.round(at)}ms ${name}\n`);
  }
}
