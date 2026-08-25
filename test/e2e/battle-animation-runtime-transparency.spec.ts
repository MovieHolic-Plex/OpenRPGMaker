import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

test.setTimeout(120_000);
test.use({ serviceWorkers: "block" });

type SheetKind = "magenta" | "green" | "black" | "alpha";
const EVIDENCE_DIR = "output/evidence/battle-animation-transparency";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test("런타임 전투 애니메이션 캔버스: 마젠타/녹색/검은 배경 자동 키아웃", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.goto("/?freshProject=1");
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(2500);

  await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const makeSheet = (bg: { r: number; g: number; b: number; a: number } | null): string => {
      const canvas = document.createElement("canvas");
      canvas.width = 96; canvas.height = 96;
      const ctx = canvas.getContext("2d")!;
      if (bg) { ctx.fillStyle = `rgba(${bg.r},${bg.g},${bg.b},${bg.a / 255})`; ctx.fillRect(0, 0, 96, 96); }
      else { ctx.clearRect(0, 0, 96, 96); }
      ctx.fillStyle = "rgb(220,20,20)";
      ctx.beginPath(); ctx.arc(48, 48, 24, 0, Math.PI * 2); ctx.fill();
      return canvas.toDataURL("image/png");
    };
    const sheets: Record<string, string> = {
      magenta: makeSheet({ r: 255, g: 0, b: 255, a: 255 }),
      green: makeSheet({ r: 0, g: 255, b: 0, a: 255 }),
      black: makeSheet({ r: 0, g: 0, b: 0, a: 255 }),
      alpha: makeSheet(null),
    };
    store.update((draft) => {
      for (const kind of Object.keys(sheets)) {
        const resId = `qa-anim-sheet-${kind}`;
        draft.assets.uploaded[resId] = { id: resId, name: `QA ${kind}`, kind: "sprite", dataUrl: sheets[kind]!, meta: { width: 96, height: 96 } };
        draft.database.battleAnimations.push({
          id: `qa-anim-${kind}`, name: `QA ${kind}`, resourceId: resId,
          sheet: { frameWidth: 96, frameHeight: 96, columns: 1 }, scope: "singleTarget",
          position: "center", large: false,
          frames: [{ cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] }],
          timings: [],
        } as never);
      }
    });
  });

  const results = await page.evaluate(async () => {
    const animMod = await import("/src/player/battleAnimationDom.ts");
    const kinds = ["magenta", "green", "black", "alpha"];
    const out: Record<string, { cornerAlpha: number; contentRed: number; rendered: boolean }> = {};
    for (const kind of kinds) {
      const snapshot = {
        lastAnimation: {
          animationId: `qa-anim-${kind}`, targetId: "t", name: `QA ${kind}`,
          soundResourceIds: [], flashTargets: [], screenShake: false, frameCount: 1,
        },
      } as never;
      const playback = animMod.mountBattleAnimationPlayback(snapshot, null);
      if (!playback) { out[kind] = { cornerAlpha: -1, contentRed: -1, rendered: false }; continue; }
      document.body.append(playback.element);
      const canvas = await new Promise<HTMLCanvasElement | null>((resolve) => {
        const start = Date.now();
        const tick = () => {
          const c = playback.element.querySelector<HTMLCanvasElement>("canvas[data-rendered='true']");
          if (c) return resolve(c);
          if (Date.now() - start > 5000) return resolve(null);
          setTimeout(tick, 50);
        };
        tick();
      });
      if (!canvas) { out[kind] = { cornerAlpha: -1, contentRed: -1, rendered: false }; playback.destroy(); continue; }
      const ctx = canvas.getContext("2d")!;
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      out[kind] = { cornerAlpha: px[3], contentRed: px[(48 * canvas.width + 48) * 4], rendered: true };
      playback.destroy();
      playback.element.remove();
    }
    return out;
  });

  writeFileSync(`${EVIDENCE_DIR}/runtime-measurements.json`, JSON.stringify(results, null, 2));

  for (const kind of ["magenta", "green", "black"] as SheetKind[]) {
    expect(results[kind].rendered, `${kind} 렌더됨`).toBe(true);
    expect(results[kind].cornerAlpha, `${kind} 모서리 키아웃 → alpha=0`).toBe(0);
    expect(results[kind].contentRed, `${kind} 콘텐츠 보존`).toBeGreaterThan(100);
  }
  expect(results.alpha.rendered, "투명 PNG 렌더됨").toBe(true);
  expect(results.alpha.contentRed, "투명 PNG 콘텐츠 보존").toBeGreaterThan(100);
});
