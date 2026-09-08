// Faithful Chromium CSSOM + glyph-vs-backing pixel proof for event-command preview paint.
// Contrast is NOT global min/max on the whole control (border/shadow/gradient ends can
// impersonate a glyph). Ink pixels are those that change when ONLY `color` is set
// transparent; each ink pixel is compared to the same pixel of the glyph-hidden shot.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";

const ROOT = resolve(__dirname, "..");
const FROM_HEAD = process.env.EVENT_PREVIEW_PAINT_FROM === "HEAD";

function loadCss(rel: string): string {
  const source = FROM_HEAD
    ? execFileSync("git", ["show", `HEAD:${rel}`], { encoding: "utf8", cwd: ROOT })
    : readFileSync(resolve(ROOT, rel), "utf8");
  return source.replace(/@font-face\s*\{[\s\S]*?\}/g, "");
}

const SHEET = [
  loadCss("src/styles/tokens.css"),
  loadCss("src/styles/runtime/system.css"),
  loadCss("src/styles/editor/event-editor.command-preview/01-event-editor-modern-import.css"),
  loadCss("src/styles/editor/event-editor.command-preview/03-ecp-result-screen.css"),
  loadCss("src/styles/editor/event-editor.command-preview/04-ecp-variable-stage.css"),
].join("\n");

const HTML = `<!doctype html>
<html>
  <head><style>${SHEET}</style></head>
  <body style="width:360px;margin:0;background:#F7F8F8">
    <div class="ecp-stage">
      <div class="ecp-message-window has-speaker">
        <div class="ecp-message-speaker ecp-message-speaker-nameplate">촌장</div>
      </div>
      <div class="ecp-result-screen gameover">GAME OVER</div>
      <div class="ecp-result-screen title">타이틀 화면</div>
      <div class="ecp-result-screen ending">ENDING</div>
    </div>
    <div class="ecp-audio">
      <div class="ecp-audio-icon play">▶</div>
      <div class="ecp-audio-icon stop">■</div>
    </div>
    <div class="ecp-variable-card"></div>
    <div class="ecp-shop-window"></div>
    <div class="ecp-number-window"></div>
    <div class="ecp-number-slot cursor">0</div>
  </body>
</html>`;

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(red: number, green: number, blue: number): number {
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function pixelDelta(left: Uint8Array, right: Uint8Array, index: number): number {
  return (
    Math.abs((left[index] ?? 0) - (right[index] ?? 0)) +
    Math.abs((left[index + 1] ?? 0) - (right[index + 1] ?? 0)) +
    Math.abs((left[index + 2] ?? 0) - (right[index + 2] ?? 0))
  );
}

type InkStats = {
  inkPixels: number;
  minRatio: number;
  sampleInk: string;
  sampleBack: string;
};

function inkVsBacking(presentBuf: Buffer, hiddenBuf: Buffer): InkStats {
  const present = PNG.sync.read(presentBuf);
  const hidden = PNG.sync.read(hiddenBuf);
  expect(present.width, "mutation shot width").toBe(hidden.width);
  expect(present.height, "mutation shot height").toBe(hidden.height);
  const ratios: number[] = [];
  let sampleInk = "none";
  let sampleBack = "none";
  let bestDelta = 0;
  const limit = Math.min(present.data.length, hidden.data.length);
  for (let index = 0; index < limit; index += 4) {
    if ((present.data[index + 3] ?? 0) < 16 && (hidden.data[index + 3] ?? 0) < 16) continue;
    const delta = pixelDelta(present.data, hidden.data, index);
    // Skip antialiased fringes (they sit between ink and fill). Core glyph/text
    // vs backing is a large RGB delta; border/shadow do not move when only color changes.
    if (delta < 80) continue;
    const inkL = luminance(present.data[index] ?? 0, present.data[index + 1] ?? 0, present.data[index + 2] ?? 0);
    const backL = luminance(hidden.data[index] ?? 0, hidden.data[index + 1] ?? 0, hidden.data[index + 2] ?? 0);
    ratios.push(contrast(inkL, backL));
    if (delta >= bestDelta) {
      bestDelta = delta;
      sampleInk = `${present.data[index]},${present.data[index + 1]},${present.data[index + 2]}`;
      sampleBack = `${hidden.data[index]},${hidden.data[index + 1]},${hidden.data[index + 2]}`;
    }
  }
  ratios.sort((a, b) => a - b);
  const median = ratios.length === 0 ? 1 : ratios[Math.floor(ratios.length / 2)]!;
  return { inkPixels: ratios.length, minRatio: median, sampleInk, sampleBack };
}

describe(`event preview paint CSSOM (${FROM_HEAD ? "HEAD original CSS" : "worktree CSS"})`, () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
    page = await browser.newPage({ viewport: { width: 400, height: 900 } });
    await page.setContent(HTML, { waitUntil: "load" });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  async function measureInk(selector: string): Promise<InkStats> {
    const node = page.locator(selector);
    await node.waitFor({ state: "visible" });
    const present = await node.screenshot({ animations: "disabled" });
    await node.evaluate((el) => {
      const style = el as HTMLElement;
      style.dataset.prevColor = style.style.color;
      style.style.color = "transparent";
    });
    const hidden = await node.screenshot({ animations: "disabled" });
    await node.evaluate((el) => {
      const style = el as HTMLElement;
      style.style.color = style.dataset.prevColor ?? "";
      delete style.dataset.prevColor;
    });
    return inkVsBacking(present, hidden);
  }

  it("generic nameplate uses the glass image slot, not a nested-gradient color-stop", async () => {
    const painted = await page.locator(".ecp-message-speaker-nameplate").evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        backgroundImage: style.backgroundImage,
        fontSize: style.fontSize,
        overflow: style.overflow,
        boxShadow: style.boxShadow,
      };
    });
    expect(painted.fontSize).toBe("12px");
    expect(painted.overflow).toBe("hidden");
    expect(painted.backgroundImage, "nested gradient-as-stop drops the whole background").toMatch(/linear-gradient/i);
    expect(painted.backgroundImage).not.toBe("none");
    expect(painted.boxShadow, "0 3px 8px var(--shadow-pop) is an invalid shadow list").not.toBe("none");
  });

  it("nameplate Hangul is distinct from its backing, not from shadow/corners", async () => {
    const stats = await measureInk(".ecp-message-speaker-nameplate");
    expect(stats.inkPixels, "nameplate ink pixels").toBeGreaterThan(20);
    expect(
      stats.minRatio,
      `nameplate ink ${stats.sampleInk} on ${stats.sampleBack} = ${stats.minRatio.toFixed(2)}:1`,
    ).toBeGreaterThan(4.5);
  });

  it("nameplate ink proof fails when only color is transparent", async () => {
    const node = page.locator(".ecp-message-speaker-nameplate");
    await node.evaluate((el) => {
      (el as HTMLElement).style.color = "transparent";
    });
    const stats = await measureInk(".ecp-message-speaker-nameplate");
    await node.evaluate((el) => {
      (el as HTMLElement).style.color = "";
    });
    expect(stats.inkPixels, "transparent nameplate must not count border/shadow as ink").toBe(0);
  });

  for (const variant of ["gameover", "title", "ending"] as const) {
    it(`${variant} text is distinct from its rendered fill/gradient`, async () => {
      const stats = await measureInk(`.ecp-result-screen.${variant}`);
      expect(stats.inkPixels, `${variant} ink pixels`).toBeGreaterThan(20);
      expect(
        stats.minRatio,
        `${variant} ink ${stats.sampleInk} on ${stats.sampleBack} = ${stats.minRatio.toFixed(2)}:1`,
      ).toBeGreaterThan(4.5);
    });

    it(`${variant} ink proof fails when only color is transparent`, async () => {
      const node = page.locator(`.ecp-result-screen.${variant}`);
      await node.evaluate((el) => {
        (el as HTMLElement).style.color = "transparent";
      });
      const stats = await measureInk(`.ecp-result-screen.${variant}`);
      await node.evaluate((el) => {
        (el as HTMLElement).style.color = "";
      });
      expect(stats.inkPixels, `transparent ${variant} must not count fill/gradient as ink`).toBe(0);
    });
  }

  for (const variant of ["play", "stop"] as const) {
    it(`${variant} glyph is distinct from fill, ignoring the matching border`, async () => {
      const stats = await measureInk(`.ecp-audio-icon.${variant}`);
      expect(stats.inkPixels, `${variant} glyph pixels`).toBeGreaterThan(10);
      expect(
        stats.minRatio,
        `${variant} ink ${stats.sampleInk} on ${stats.sampleBack} = ${stats.minRatio.toFixed(2)}:1`,
      ).toBeGreaterThan(3);
    });

    it(`${variant} glyph proof fails when only color is transparent`, async () => {
      const node = page.locator(`.ecp-audio-icon.${variant}`);
      await node.evaluate((el) => {
        (el as HTMLElement).style.color = "transparent";
      });
      const stats = await measureInk(`.ecp-audio-icon.${variant}`);
      await node.evaluate((el) => {
        (el as HTMLElement).style.color = "";
      });
      expect(stats.inkPixels, `transparent ${variant} must not count fill+border as ink`).toBe(0);
    });
  }

  it("variable card consumes --shadow-pop as a full shadow list", async () => {
    const boxShadow = await page.locator(".ecp-variable-card").evaluate((el) => getComputedStyle(el).boxShadow);
    expect(boxShadow, ".ecp-variable-card extra lengths prefixed --shadow-pop").not.toBe("none");
  });

  it("shop window consumes --shadow-pop as a full shadow list", async () => {
    const boxShadow = await page.locator(".ecp-shop-window").evaluate((el) => getComputedStyle(el).boxShadow);
    expect(boxShadow, ".ecp-shop-window extra lengths prefixed --shadow-pop").not.toBe("none");
  });

  it("number window consumes --shadow-pop as a full shadow list", async () => {
    const boxShadow = await page.locator(".ecp-number-window").evaluate((el) => getComputedStyle(el).boxShadow);
    expect(boxShadow, ".ecp-number-window extra lengths prefixed --shadow-pop").not.toBe("none");
  });

  it("number slot cursor does not treat --shadow-pop as a color", async () => {
    const boxShadow = await page.locator(".ecp-number-slot.cursor").evaluate((el) => getComputedStyle(el).boxShadow);
    expect(boxShadow, ".ecp-number-slot.cursor 0 0 0 1px var(--shadow-pop) is invalid").not.toBe("none");
  });
});
