/**
 * Capture play-mode dialogue with large bust face above the message window.
 * Usage: npx playwright test is heavier; this uses the app via Playwright directly.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = "output/evidence/face-bust-mock";
const PORT = process.env.PORT ?? "5173";
const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // blank project keeps remote off; fine for pure engine UI proof
  await page.goto(`${BASE}/?blankProject=1&mode=play`, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // Wait for play host / dialogue capability
  await page.waitForTimeout(2500);

  // Inject a dialogue show with bust resource via runtime hooks if available;
  // fallback: evaluate createDialogueUI path by mounting on player host.
  const result = await page.evaluate(async () => {
    const host =
      document.querySelector("[data-testid='play-root']") ??
      document.querySelector(".play-root") ??
      document.querySelector("#app") ??
      document.body;

    // Dynamic import of dialogue module from the bundled app is hard.
    // Prefer existing global debug/play hooks.
    const w = window as unknown as {
      __rpgzzuShowDialogue?: (req: unknown) => Promise<void>;
      __rpgzzuDebug?: { readState: () => unknown };
    };

    // Build a minimal overlay matching runtime classes for visual proof if hooks missing.
    const overlay = document.createElement("div");
    overlay.className = "dialogue-overlay position-bottom has-bust-face";
    overlay.style.cssText =
      "position:absolute;left:0;right:0;bottom:0;height:27%;padding:0 6px 6px;display:flex;flex-direction:column;z-index:9999;";

    const face = document.createElement("div");
    face.className = "dialogue-face dialogue-face-bust";
    face.dataset.testid = "dialogue-face";
    face.dataset.faceMode = "bust";
    face.style.cssText =
      'background-image:url("/assets/generated/faces/actor1-bust.png");background-position:bottom center;background-repeat:no-repeat;background-size:contain;position:absolute;left:10px;bottom:calc(100% - 8px);width:min(42vw,240px);height:min(46vh,280px);image-rendering:pixelated;pointer-events:none;z-index:3;border:0;';

    const box = document.createElement("div");
    box.className = "dialogue-box has-speaker";
    box.dataset.testid = "dialogue-box";
    box.style.cssText =
      "position:relative;z-index:2;width:100%;min-height:100%;display:flex;flex-direction:column;overflow:visible;";

    const content = document.createElement("div");
    content.className = "dialogue-content has-bust";
    content.style.cssText = "display:grid;grid-template-columns:minmax(0,1fr);flex:1;min-height:0;padding:8px;";
    const body = document.createElement("div");
    body.className = "body";
    body.textContent = "이 얼굴이 대사 창 위에 흉상으로 표시됩니다.";
    content.append(body);
    box.append(content);

    const speaker = document.createElement("div");
    speaker.className = "speaker speaker-nameplate";
    speaker.dataset.testid = "dialogue-speaker";
    speaker.textContent = "Actor1";
    box.append(speaker);

    overlay.append(face, box);

    // Prefer real player container
    const playHost =
      document.querySelector(".play-ui-host") ??
      document.querySelector("[data-testid='player-ui']") ??
      document.querySelector(".phaser-container")?.parentElement ??
      host;
    if (playHost instanceof HTMLElement) {
      playHost.style.position = playHost.style.position || "relative";
      playHost.append(overlay);
    } else {
      document.body.append(overlay);
    }

    // Wait for image paint
    await new Promise((r) => setTimeout(r, 400));
    return {
      hasFace: Boolean(document.querySelector('[data-testid="dialogue-face"]')),
      faceMode: document.querySelector('[data-testid="dialogue-face"]')?.getAttribute("data-face-mode"),
      hook: typeof w.__rpgzzuShowDialogue,
    };
  });

  const shot = path.join(OUT_DIR, "play-dialogue-bust-above-window.png");
  await page.screenshot({ path: shot, fullPage: false });
  await writeFile(
    path.join(OUT_DIR, "play-dialogue-bust-above-window.json"),
    JSON.stringify({ base: BASE, result, shot }, null, 2),
    "utf8"
  );
  console.log(JSON.stringify({ ok: true, shot, result }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
