import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

test.setTimeout(180_000);
test.use({ serviceWorkers: "block" });

type SheetKind = "magenta" | "green" | "black" | "alpha";
const EVIDENCE_DIR = "output/evidence/battle-animation-transparency";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test("DB 전투 애니메이션 미리보기: 마젠타/녹색/검은 배경 자동 키아웃, 투명 PNG 는 no-op", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.goto("/?freshProject=1");
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(2500);

  const injected = await page.evaluate(async () => {
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
    return { ok: true };
  });
  expect(injected.ok).toBe(true);

  await openDatabase(page);
  await switchDatabaseTab(page, { label: "Animations", slug: "animations", testId: "db-tab-animations" });

  const results: Record<SheetKind, { cornerAlpha: number; contentRed: number; bgUrlIsDataUrl: boolean }> = {
    magenta: { cornerAlpha: -1, contentRed: -1, bgUrlIsDataUrl: false },
    green: { cornerAlpha: -1, contentRed: -1, bgUrlIsDataUrl: false },
    black: { cornerAlpha: -1, contentRed: -1, bgUrlIsDataUrl: false },
    alpha: { cornerAlpha: -1, contentRed: -1, bgUrlIsDataUrl: false },
  };

  for (const kind of ["magenta", "green", "black", "alpha"] as SheetKind[]) {
    const recordId = `qa-anim-${kind}`;
    await expect(page.getByTestId(`db-record-row-${recordId}`)).toBeVisible({ timeout: 10000 });
    await page.getByTestId(`db-record-row-${recordId}`).click();
    await expect(page.getByTestId("db-animation-rm2003-editor")).toBeVisible({ timeout: 8000 });
    await page.waitForFunction(
      (k: string) => {
        const cell = document.querySelector('[data-testid="db-animation-stage-target"]') as HTMLElement | null;
        if (!cell) return false;
        const bg = cell.style.backgroundImage;
        return Boolean(bg) && bg !== "none";
      },
      kind,
      { timeout: 8000 }
    );
    await page.waitForTimeout(500);

    const measured = await page.evaluate(async (k: string) => {
      const cell = document.querySelector('[data-testid="db-animation-stage-target"]') as HTMLElement | null;
      if (!cell) return { cornerAlpha: -1, contentRed: -1, bgUrlIsDataUrl: false };
      const bg = cell.style.backgroundImage;
      const match = bg.match(/url\(["']?(data:image\/png;base64,[^"')]+)["']?\)/);
      let dataUrl: string | null = match ? match[1]! : null;
      if (!dataUrl) {
        const urlMatch = bg.match(/url\(["']?([^"')]+)["']?\)/);
        dataUrl = urlMatch ? urlMatch[1]! : null;
      }
      if (!dataUrl) return { cornerAlpha: -1, contentRed: -1, bgUrlIsDataUrl: Boolean(match) };
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("img load"));
        img.src = dataUrl!;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const cornerAlpha = px[3];
      const centerOffset = (48 * canvas.width + 48) * 4;
      const contentRed = px[centerOffset];
      return { cornerAlpha, contentRed, bgUrlIsDataUrl: Boolean(match) };
    }, kind);
    results[kind] = measured;
    await page.getByTestId("db-animation-rm2003-editor").screenshot({ path: `${EVIDENCE_DIR}/preview-${kind}.png` });
  }

  writeFileSync(`${EVIDENCE_DIR}/measurements.json`, JSON.stringify(results, null, 2));

  for (const kind of ["magenta", "green", "black"] as SheetKind[]) {
    expect(results[kind].cornerAlpha, `${kind} 모서리 키아웃 → alpha=0`).toBe(0);
    expect(results[kind].contentRed, `${kind} 콘텐츠 빨간색 보존`).toBeGreaterThan(100);
  }
  expect(results.alpha.contentRed, "투명 PNG 콘텐츠 보존").toBeGreaterThan(100);
});
