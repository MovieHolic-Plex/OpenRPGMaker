// benchmark/ui/main.ts
// benchmark.html 엔트리부트. index.html 과 동일한 규약(module script →
// src/.../main.ts, div 마운트 루트)을 따른다. 에디터 부트(src/main.ts)와는
// 완전히 분리되어 있다 — 이 파일은 벤치마크 페이지에서만 로드된다.
import { mountLanding } from "./landing";

function boot(): void {
  const container = document.getElementById("benchmark-app");
  if (!container) {
    // 진입 HTML(benchmark.html)과의 계약 위반 — 조용히 넘기지 않고 즉시 드러낸다.
    throw new Error("benchmark-app 컨테이너를 찾을 수 없습니다(benchmark.html 마운트 루트 누락).");
  }
  // v1 랜딩. todo 12/13 이 해시 라우팅(#run / #leaderboard)으로 뷰를 갈아끼운다.
  mountLanding(container);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
