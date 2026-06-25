// MCGA 클라이언트 부팅.
// STEP 1: 맵 뷰만 (세계 틱이 고을 색을 바꾸는 걸 본다).
// STEP 2+: 숏 피드·내 신분·시대 현황이 여기에 추가됨.

import { bootMapView } from "@/ui/mapView";

const app = document.getElementById("app");
if (!app) throw new Error("#app 엘리먼트 없음");

// 헤더 + 맵 컨테이너 구성
app.innerHTML = `
  <header class="app-header">
    <h1>조선을 다시 위대하게</h1>
    <span class="tagline">Make Chosun Great Again · MVP</span>
  </header>
  <main id="map-view" class="map-view"></main>
  <footer class="app-footer">
    <span class="step-badge">STEP 1 — 결정론적 세계 (봇만)</span>
  </footer>
`;

const mapContainer = document.getElementById("map-view")!;
bootMapView(mapContainer).catch((e) => {
  console.error("맵 부팅 실패", e);
});
