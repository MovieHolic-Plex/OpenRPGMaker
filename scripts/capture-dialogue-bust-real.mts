import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = "output/evidence/face-bust-mock";
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:9999";

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${BASE}/?blankProject=1&mode=play`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2000);

  const ok = await page.evaluate(async () => {
    const mod = await import("/src/player/dialogue.ts");
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;inset:0;z-index:99999;pointer-events:none;";
    document.body.append(host);
    const ui = mod.createDialogueUI(host);
    void ui.showText({
      speaker: "Actor1",
      body: "이 얼굴이 대사 창 위에 흉상으로 표시됩니다.",
      playerTileY: 10,
      mapHeight: 20,
      face: {
        resourceId: "generated-face-actor1-bust",
        faceIndex: 0,
        position: "left",
        flipHorizontally: false,
      },
    });
    await new Promise((r) => setTimeout(r, 400));
    const face = document.querySelector("[data-testid=dialogue-face]");
    return {
      hasBust: face?.classList.contains("dialogue-face-bust") ?? false,
      mode: face?.getAttribute("data-face-mode"),
      overlay: document.querySelector(".dialogue-overlay")?.className ?? "",
      bg: (face as HTMLElement | null)?.style.backgroundImage ?? "",
    };
  });

  const shot = `${OUT}/play-dialogue-bust-real-module.png`;
  await page.screenshot({ path: shot });
  await writeFile(`${OUT}/play-dialogue-bust-real-module.json`, JSON.stringify({ ok, shot }, null, 2));
  console.log(JSON.stringify({ shot, ok }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
