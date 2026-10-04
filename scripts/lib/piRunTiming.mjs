// Pi 실행 준비 구간 계측 — OPRN_PI_TIMING=1 일 때만 한 줄씩 남긴다(호스트·워커 공통).
// 왜(2026-10-03 실측): 보내기 → 워커 응답 헤더가 20~70초였는데 어느 단계가 먹는지 아무 기록이 없었다.
const enabled = typeof process !== "undefined" && process.env?.OPRN_PI_TIMING === "1";

export function piTimingEnabled() {
  return enabled;
}

/** 단계별 벽시계를 모아 끝에 한 줄로 쓴다. 꺼져 있으면 아무 일도 하지 않는다. */
export function piTimer(label) {
  if (!enabled) return { mark() {}, done() {} };
  const started = performance.now();
  let last = started;
  const parts = [];
  return {
    mark(name, extra = "") {
      const now = performance.now();
      parts.push(`${name}=${Math.round(now - last)}ms${extra ? `(${extra})` : ""}`);
      last = now;
    },
    done(extra = "") {
      console.error(`[pi-timing] ${label} total=${Math.round(performance.now() - started)}ms ${parts.join(" ")}${extra ? ` ${extra}` : ""}`);
    },
  };
}
