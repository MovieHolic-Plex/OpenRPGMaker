#!/usr/bin/env node
// 자동복구 토스트가 테스트 플레이 창에 가려지는지 실측한다.
//
// 왜: 보고서용 캡처에서 토스트가 «CSS 상 보임»인데 화면에는 없었다. 눈으로 못 보는 알림은
// 없는 알림이다 → 겹침 순서를 숫자로 재고, 겹치면 결함으로 보고한다.
//
// 사용: node scripts/qa/testplay-toast-occlusion-probe.mjs [--base-url http://127.0.0.1:9842]

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const BASE_URL = argValue("--base-url", "http://127.0.0.1:9842");
const OUT_DIR = argValue("--out", "verify-shots/testplay-resilient-report");
const TIMEOUT = 120_000;
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
page.setDefaultTimeout(TIMEOUT);
page.setDefaultNavigationTimeout(TIMEOUT);
await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
await page.goto(`${BASE_URL}/?blankProject=1`, { waitUntil: "domcontentloaded" });
await page.locator('[data-testid="edit-canvas"] canvas').first().waitFor({ state: "visible" });
await page.locator('[data-testid="mode-play"]').waitFor({ state: "visible" });
await page.evaluate(async () => {
  const { store } = await import(/* @vite-ignore */ "/src/project/store.ts");
  store.update((draft) => {
    draft.startMapId = "map_does_not_exist_zzu";
    draft.session = { ...draft.session, partyActorIds: [] };
  });
});
await page.locator('[data-testid="mode-play"]').click();
await page.locator('[data-testid="toast"].show').first().waitFor({ state: "visible" });

const probe = await page.evaluate(() => {
  const toast = document.querySelector('[data-testid="toast"]');
  const stack = document.querySelector('[data-testid="toast-stack"]');
  const playWindow = document.querySelector('[data-testid="test-play-window"]');
  const rect = toast?.getBoundingClientRect();
  const center = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
  // 토스트 스택은 pointer-events:none 이다(일부러 통해준다). 그대로 elementFromPoint 를 쓰면
  // «클릭이 통하는가»를 재게 되어 겹침 상태와 무관하게 항상 «가려짐» 으로 나온다.
  // 재려는 것은 **그려지는 순서**이므로 부도입만 잠시 돌려놓고 재고 되돌린다.
  const savedPointerEvents = stack instanceof HTMLElement ? stack.style.pointerEvents : "";
  const savedToastPointerEvents = toast instanceof HTMLElement ? toast.style.pointerEvents : "";
  if (stack instanceof HTMLElement) stack.style.pointerEvents = "auto";
  if (toast instanceof HTMLElement) toast.style.pointerEvents = "auto";
  const hit = center ? document.elementFromPoint(center.x, center.y) : null;
  if (stack instanceof HTMLElement) stack.style.pointerEvents = savedPointerEvents;
  if (toast instanceof HTMLElement) toast.style.pointerEvents = savedToastPointerEvents;
  const describe = (node) =>
    node
      ? {
          tag: node.tagName.toLowerCase(),
          testid: node.dataset?.testid ?? null,
          class: node.className?.toString().slice(0, 80) ?? null,
          zIndex: getComputedStyle(node).zIndex,
          position: getComputedStyle(node).position,
        }
      : null;
  return {
    toast: describe(toast),
    stack: describe(stack),
    playWindow: describe(playWindow),
    toastRect: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
    hitAtToastCenter: describe(hit),
    toastIsTopMost: hit === toast || (toast?.contains(hit) ?? false),
    toastText: toast?.textContent?.trim().slice(0, 200) ?? "",
  };
});

writeFileSync(`${OUT_DIR}/toast-occlusion-probe.json`, `${JSON.stringify(probe, null, 2)}\n`);
await page.screenshot({ path: `${OUT_DIR}/toast-occlusion-window.png` });
console.log(JSON.stringify(probe, null, 2));
console.log(`\n토스트가 맨 위인가: ${probe.toastIsTopMost ? "예" : "아니오 — 가려진다"}`);
await context.close();
await browser.close();
