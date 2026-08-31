// 진단용 — 조수 셸의 도크 3종 × 상태별 일관성 실측.
// 재현 대상: (1) 도크마다 컴포저가 다르게 굴음 (2) 사이드바에 은닉 (3) 확장 시 헤더 잔존
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const PORT = process.env.PORT ?? "9988";
const OUT = "verify-shots/shell-consistency";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "basic"));
await page.goto(`http://127.0.0.1:${PORT}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible().catch(() => false)) await guest.click();
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 }).catch(() => {});
for (const l of ["건너뛰기", "닫기", "그만 보기"]) {
  const b = page.getByRole("button", { name: l }).first();
  if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
}
const restore = page.getByTestId("ai-collapsed-restore");
if (await restore.isVisible().catch(() => false)) await restore.click().catch(() => {});
await page.waitForTimeout(1200);

/** 셸 기하 + 겹침/클리핑 실측. */
async function snap() {
  return await page.evaluate(() => {
    const R = (n) => {
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    };
    const q = (s) => document.querySelector(s);
    const panel = q("[data-testid='ai-panel']");
    const composer = q(".ai-composer");
    const header = q(".ai-chat-header");
    const input = q("[data-testid='ai-input']");
    const log = q("[data-testid='ai-chat-log'], .ai-chat-log");
    const main = q(".ai-chat-main");

    // 왼쪽 아이콘 레일 / 오른쪽 사이드바 후보
    const railSel = [".basic-left-rail", ".editor-left-rail", "[data-testid='basic-left-rail']", ".editor-rail"];
    const rail = railSel.map(q).find(Boolean) ?? null;
    const sideSel = [".editor-sidebar", ".editor-right", "[data-testid='editor-sidebar']", ".editor-layout > aside"];
    const side = sideSel.map(q).find(Boolean) ?? null;

    const overlap = (a, b) => {
      if (!a || !b) return null;
      const w = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
      const h = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
      return w > 0 && h > 0 ? [w, h] : null;
    };

    // 컴포저가 실제로 보이는지 — 중심점 hit-test
    const hitTest = (n) => {
      if (!n) return null;
      const r = n.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return "zero-size";
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (!el) return "offscreen";
      return n.contains(el) || el.contains(n) ? "visible" : `covered-by:${el.className?.toString().slice(0, 50) || el.tagName}`;
    };

    const cs = (n, props) => {
      if (!n) return null;
      const s = getComputedStyle(n);
      return Object.fromEntries(props.map((p) => [p, s[p]]));
    };

    const panelRect = R(panel);
    const composerRect = R(composer);
    return {
      dock: panel?.dataset.chatDock ?? null,
      panelClass: panel?.className ?? null,
      viewport: [window.innerWidth, window.innerHeight],
      panel: panelRect,
      header: R(header),
      headerStyle: cs(header, ["display", "position", "height", "borderBottom"]),
      main: R(main),
      log: R(log),
      composer: composerRect,
      composerStyle: cs(composer, ["position", "padding", "borderRadius", "background", "border", "boxShadow", "margin"]),
      input: R(input),
      inputStyle: cs(input, ["minHeight", "maxHeight", "fontSize", "borderRadius", "background"]),
      rail: R(rail),
      railClass: rail?.className?.toString().slice(0, 60) ?? null,
      side: R(side),
      sideClass: side?.className?.toString().slice(0, 60) ?? null,
      composerHit: hitTest(composer),
      inputHit: hitTest(input),
      overlapPanelRail: overlap(panelRect, R(rail)),
      overlapPanelSide: overlap(panelRect, R(side)),
      // 패널이 뷰포트 밖으로 나갔나
      clippedRight: panelRect ? panelRect[0] + panelRect[2] - window.innerWidth : null,
      clippedBottom: panelRect ? panelRect[1] + panelRect[3] - window.innerHeight : null,
    };
  });
}

const report = { states: {} };

async function record(name) {
  await page.waitForTimeout(700);
  report.states[name] = await snap();
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

await record("00-capsule-idle");

// 대화가 있는 상태로 만든다(전송 → 404 오류가 나도 로그는 생긴다)
const input = page.getByTestId("ai-input");
await input.fill("테스트 지시");
await input.press("Enter");
await page.waitForTimeout(2600);
await record("01-capsule-active");

// 구 판본은 `chat-dock-toggle` 을 3번 눌러 glass → side → float 를 이어 찍었다.
// 도크 축이 2026-08-31 에 사라지면서 찍을 표면은 하나다.
await record(`10-dock-${(await page.getByTestId("ai-panel").getAttribute("data-chat-dock")) ?? "?"}`);

// 캡슐 확대 — 리사이즈 핸들을 끝까지 끌어 본다(헤더 잔존 확인)
const grew = await page.evaluate(() => {
  const panel = document.querySelector("[data-testid='ai-panel']");
  if (!panel) return "no-panel";
  const before = [panel.getBoundingClientRect().width, panel.getBoundingClientRect().height];
  // 저장된 커스텀 크기 경로를 직접 쓴다 — 드래그는 헤드리스에서 불안정.
  panel.style.width = "1100px";
  panel.style.height = "900px";
  return { before, after: [panel.getBoundingClientRect().width, panel.getBoundingClientRect().height] };
});
report.grew = grew;
await record("20-grown");

// 접기 → 복귀
await page.evaluate(() => document.querySelector("[data-testid='ai-collapse']")?.click());
await record("30-collapsed");

writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2), "utf8");
for (const [k, v] of Object.entries(report.states)) {
  console.log(
    `${k.padEnd(18)} dock=${String(v.dock).padEnd(6)} panel=${JSON.stringify(v.panel)} composer=${JSON.stringify(v.composer)} hit=${v.composerHit} railOverlap=${JSON.stringify(v.overlapPanelRail)} sideOverlap=${JSON.stringify(v.overlapPanelSide)} clipR=${v.clippedRight} clipB=${v.clippedBottom}`,
  );
}
await browser.close();
