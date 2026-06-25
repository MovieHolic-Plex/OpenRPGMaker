// MCGA 클라이언트 부팅.
// 세션 있음 → 숏 피드(메인) + 맵(탭). 없음 → 입장 화면.

import { bootEnter } from "@/ui/enterView";
import { bootShortFeed } from "@/ui/shortFeed";
import { bootMapView } from "@/ui/mapView";
import { loadSession, clearSession, type Session } from "@/session";

const app = document.getElementById("app");
if (!app) throw new Error("#app 엘리먼트 없음");
const appEl: HTMLElement = app;

let pollTimer: number | null = null;

async function start(): Promise<void> {
  const existing = loadSession();
  if (existing && existing.subject.alive) {
    showGame(existing);
  } else {
    await showEnter();
  }
}

async function showEnter(): Promise<void> {
  appEl.innerHTML = `<div id="enter-root"></div>`;
  const root = document.getElementById("enter-root")!;
  const session = await bootEnter(root);
  if (session) showGame(session);
}

function showGame(session: Session): void {
  appEl.innerHTML = `
    <header class="app-header">
      <h1>조선을 다시 위대하게</h1>
      <span class="tagline">${escapeText(session.nickname)} · ${officeText(session.subject.office)}</span>
      <button id="logout-btn" class="logout-btn">퇴조</button>
    </header>
    <nav class="tabs">
      <button class="tab tab-active" data-tab="short">📜 조회</button>
      <button class="tab" data-tab="map">🗺️ 천하</button>
    </nav>
    <main id="tab-content" class="tab-content"></main>
    <footer class="app-footer">
      <span class="step-badge">STEP 2 — 플레이어 참여 (판결은 STEP 3)</span>
    </footer>
  `;

  const content = document.getElementById("tab-content")!;

  // 탭 전환
  const tabs = appEl.querySelectorAll<HTMLButtonElement>(".tab");
  let currentFeed: (() => void) | null = null;

  function switchTab(tab: "short" | "map"): void {
    tabs.forEach((t) => t.classList.toggle("tab-active", t.dataset.tab === tab));
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    currentFeed?.();
    currentFeed = null;

    if (tab === "short") {
      currentFeed = bootShortFeed(content, session.subject);
    } else {
      bootMapView(content).then((cleanup) => {
        // mapView는 내부에서 폴링 관리. 탭 전환 시 cleanup이 필요하면 저장.
        // 간단하게: pollTimer 대신 cleanup을 캡처. (여기선 폴링은 mapView 내부)
        void cleanup;
      });
    }
  }

  tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab as "short" | "map")));
  switchTab("short");

  appEl.querySelector<HTMLButtonElement>("#logout-btn")?.addEventListener("click", () => {
    clearSession();
    location.reload();
  });
}

function officeText(office: string): string {
  return office === "interior" ? "영의정" : "병조판서";
}

function escapeText(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

start().catch((e) => {
  console.error("부팅 실패", e);
  app.innerHTML = `<div class="fatal-error">부팅 실패: ${escapeText(String(e))}</div>`;
});
