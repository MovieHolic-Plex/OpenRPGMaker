// 배틀러 idle 애니메이션이 **출하 경로에서 실제로 프레임을 넘기는지** 재는 가드.
//
// 왜 단위 테스트로 부족한가: happy-dom 은 CSS 애니메이션을 굴리지 않는다. 단위 테스트는
// "런타임이 올바른 속성을 심었다" 까지만 증명한다. `steps(N, jump-none)` 산식이 프레임 경계에
// 정확히 떨어지는지, `object-position` 밀어내기가 배경을 가리지 않는지, 스킨 크기 규칙 아래에서
// 배틀러가 여전히 보이는지는 진짜 브라우저에서만 잡힌다.
//
// 실측 근거로 남긴 것:
//  1) 적 배틀러(`<img>`)의 `background-position-x` 가 시간에 따라 여러 값을 거친다.
//  2) 그 값들이 모두 프레임 경계(k/(N-1) × 100%)에 떨어진다 — 중간값이 나오면 steps 가 아니다.
//  3) `<img>` 가 그대로 `<img>` 이고 `src` 는 정적 원본이며 `naturalWidth > 0` 이다.
//  4) 주인공(정면 48px 시트)도 idle 스트립으로 프레임을 넘긴다.
//  5) 배틀러 상자가 0×0 이 아니다(배경만 남기면서 상자가 죽는 회귀를 막는다).
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

const OUT = fileURLToPath(new URL("../../evidence/battler-idle-animation/", import.meta.url));

type ProbeWindow = Window & {
  __oprnDebug?: { setSeed(seed: number): void; readState(): { currentMapId: string; x: number; y: number } };
  __oprnInput?: { face(direction: string): void; action(): void };
};

type BattlerSample = {
  selector: string;
  tagName: string;
  src: string | null;
  naturalWidth: number | null;
  frames: string;
  backgroundPositionX: string;
  backgroundSize: string;
  frameWidthVar: string;
  animationName: string;
  rect: { width: number; height: number };
};

async function sampleBattlers(page: Page): Promise<BattlerSample[]> {
  return page.evaluate(() => {
    const read = (selector: string): BattlerSample | null => {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) return null;
      const cs = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const image = node instanceof HTMLImageElement ? node : null;
      return {
        selector,
        tagName: node.tagName,
        src: image ? image.getAttribute("src") : null,
        naturalWidth: image ? image.naturalWidth : null,
        frames: node.style.getPropertyValue("--battler-anim-frames"),
        backgroundPositionX: cs.backgroundPositionX,
        backgroundSize: cs.backgroundSize,
        frameWidthVar: node.style.getPropertyValue("--battle-sprite-frame-width"),
        animationName: cs.animationName,
        rect: { width: Math.round(rect.width), height: Math.round(rect.height) },
      };
    };
    return [
      read(".battle-enemy-image[data-battler-anim]"),
      read(".battle-actor-sprite[data-battler-anim]"),
    ].filter((entry): entry is BattlerSample => entry !== null);
  }) as Promise<BattlerSample[]>;
}

/** 백분율 표본이 프레임 경계 k/(N-1)×100% 중 하나인지. 셀 좌표계(px)는 여기서 걸러낸다. */
function isFrameBoundaryPercent(value: string, frameCount: number): boolean {
  const match = /^(-?\d+(?:\.\d+)?)%$/.exec(value.trim());
  if (!match) return false;
  const percent = Number(match[1]);
  const step = 100 / (frameCount - 1);
  for (let k = 0; k < frameCount; k += 1) {
    if (Math.abs(percent - k * step) < 0.05) return true;
  }
  return false;
}

test.setTimeout(300_000);

test("배틀러 idle 애니메이션이 출하 플레이어에서 프레임을 넘긴다", async ({ page }) => {
  const server = await startPlayerQaServer();
  try {
    await page.setViewportSize({ width: 1024, height: 768 });
    // 플레이어는 `__OPENRPG_BOOT__.projectUrl` 로 프로젝트를 불러온다. 이걸 심지 않으면
    // 기본 URL 이 index.html 을 돌려주고 "JSON 파싱 실패" 로 죽는다(실측).
    await page.addInitScript(() => {
      localStorage.clear();
      (window as Window & { __OPENRPG_BOOT__?: object }).__OPENRPG_BOOT__ = {
        projectUrl: "/__runtime-qa/project.json",
        saveNamespace: "runtime-qa:battler-idle-animation",
        qaInstrumentation: true,
      };
    });
    await page.route("**/__runtime-qa/project.json", async (route) => {
      const fixturePath = fileURLToPath(new URL("../fixtures/projects/battle-v3.json", import.meta.url));
      await route.fulfill({ status: 200, contentType: "application/json", body: await readFile(fixturePath, "utf8") });
    });

    await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
    await page.keyboard.press("Enter");
    await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 120_000 });
    await page.waitForFunction(
      () => typeof (window as ProbeWindow).__oprnDebug === "object" && (window as ProbeWindow).__oprnDebug !== null,
      undefined,
      { timeout: 120_000 },
    );
    await page.waitForFunction(() => {
      const state = (window as ProbeWindow).__oprnDebug?.readState();
      return state?.currentMapId === "map_battle";
    }, undefined, { polling: "raf", timeout: 30_000 });
    await page.evaluate(() => (window as ProbeWindow).__oprnDebug?.setSeed(7));

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await page.evaluate(() => {
        const w = window as ProbeWindow;
        w.__oprnInput?.face("right");
        w.__oprnInput?.action();
      });
      try {
        await page.waitForSelector("[data-testid='battle-scene']", { state: "visible", timeout: 1_500 });
        break;
      } catch {
        /* 액션 엣지 재시도 */
      }
    }
    await page.waitForSelector("[data-testid='actor-command-attack']", { state: "visible", timeout: 120_000 });

    // 애니메이션이 붙은 배틀러가 화면에 실제로 있어야 한다 — 없으면 이 가드가 공허해진다.
    const first = await sampleBattlers(page);
    const selectors = first.map((entry) => entry.selector);
    expect(selectors, "적 배틀러와 주인공 시트 둘 다 애니메이션이 붙어야 한다").toEqual([
      ".battle-enemy-image[data-battler-anim]",
      ".battle-actor-sprite[data-battler-anim]",
    ]);

    const timeline: BattlerSample[][] = [];
    for (let i = 0; i < 14; i += 1) {
      timeline.push(await sampleBattlers(page));
      await page.waitForTimeout(70);
    }

    await mkdir(OUT, { recursive: true });
    await writeFile(`${OUT}samples.json`, `${JSON.stringify(timeline, null, 2)}\n`, "utf8");
    await page.screenshot({ path: `${OUT}battle-scene.png` });

    for (const selector of selectors) {
      const series = timeline.map((row) => row.find((entry) => entry.selector === selector));
      const observed = [...new Set(series.map((entry) => entry?.backgroundPositionX ?? "?"))];
      // (1) 프레임이 실제로 넘어간다.
      expect(observed.length, `${selector}: 값이 하나면 정지 화면이다 (${observed.join(", ")})`).toBeGreaterThan(1);
      const head = series[0];
      if (!head) throw new Error(`${selector}: 표본이 비었다`);
      expect(head.animationName).not.toBe("none");
      // (5) 배경만 남기면서 상자가 죽지 않았다.
      expect(head.rect.width).toBeGreaterThan(0);
      expect(head.rect.height).toBeGreaterThan(0);

      if (selector.startsWith(".battle-enemy-image")) {
        // (3) `<img>` 와 정적 `src` 계약.
        expect(head.tagName).toBe("IMG");
        expect(head.src).toMatch(/monster-[a-z]+-\d+\.png$/);
        expect(head.src).not.toContain("/idle/");
        expect(head.naturalWidth ?? 0).toBeGreaterThan(0);
        // (2) 모든 표본이 프레임 경계에 떨어진다.
        const frameCount = Number(head.frames);
        expect(frameCount).toBeGreaterThan(1);
        for (const value of observed) {
          expect(isFrameBoundaryPercent(value, frameCount), `${selector}: ${value} 가 프레임 경계가 아니다`).toBe(true);
        }
        // (6) 칸의 종횡비를 지킨다 — 상자가 정사각이 아닐 때 늘어나는 회귀를 잡는다.
        // 계약은 "가로 = 프레임 수 × 상자폭, 세로 = auto". 크로미엄은 세로가 auto 면 한 값으로
        // 직렬화한다(실측: 8프레임 → "800%"). 세로를 `100%` 로 묶으면 여기서 "800% 100%" 가
        // 나오고, 정사각 칸이 상자 종횡비(실측 180×210)로 늘어난다.
        expect(
          head.backgroundSize,
          `칸이 상자 종횡비로 늘어났다 (상자 ${head.rect.width}×${head.rect.height})`
        ).toMatch(new RegExp(`^${frameCount * 100}%(?:\\s+auto)?$`));
      } else {
        // (4) 주인공은 px 셀 좌표계로 스텝하고, 값은 **칸 경계의 배수**여야 한다.
        // "px 문자열" 만 재면 steps 가 아닌 보간(1px, 2px, 3px…)도 통과한다.
        expect(head.tagName).toBe("SPAN");
        const frameWidth = Number.parseFloat(head.frameWidthVar);
        expect(frameWidth).toBeGreaterThan(0);
        for (const value of observed) {
          const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
          expect(match, `주인공 시트는 px 스텝이어야 한다: ${value}`).not.toBeNull();
          const offset = Math.abs(Number(match?.[1] ?? Number.NaN));
          const cells = offset / frameWidth;
          expect(Math.abs(cells - Math.round(cells)), `${value} 가 칸 경계(${frameWidth}px 배수)가 아니다`).toBeLessThan(0.02);
          expect(Math.round(cells)).toBeLessThan(Number(head.frames));
        }
      }
    }
  } finally {
    await server.close();
  }
});
