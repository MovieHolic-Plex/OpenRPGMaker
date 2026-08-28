// 전투 주스 플래시가 배틀 씬의 불투명 배경을 지워 **뒤의 맵이 보이던** 회귀를 잠근다.
//
// 출하 경로만 검증한다 — `player.html` 을 런타임 QA 서버로 띄우므로 편집기 셸을 타지 않는다
// (AGENTS.md 의 hard rule). 픽스처는 test/fixtures/projects/battle-v3.json:
// 시작 맵 map_battle(0,0) 에서 오른쪽 (1,0) 이벤트가 battleProcessing(troop_slime) 단일 커맨드라
// 대사·텔레포트 없이 실전투 DOM 에 도달한다(실측: face("right") + action() 2회 이내).
//
// 불변식 세 개를 같은 샘플 시리즈에서 판정한다(타이밍 경합 없음):
//   1. 플래시 전 구간에서 .battle-scene 의 computed background-color 알파 == 1
//      (실측 회귀: battle-flash-hit 이 루트 배경을 애니메이션해 최소 알파 0.082까지 떨어졌다)
//   2. 플래시가 여전히 보인다 — .battle-field::after 오버레이 알파 > 0 (주스 삭제가 아니라 이전)
//   3. 셰이크 동안 루트는 움직이지 않는다 — computed transform 의 translate 성분 == 0
//      (루트를 옮기면 640x480 불투명 배경이 밀려 가장자리로 맵이 샌다)
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

const PROJECT_FIXTURE = fileURLToPath(
  new URL("../fixtures/projects/battle-v3.json", import.meta.url),
);
const SHOT_DIR = fileURLToPath(
  new URL("../../.omo/evidence/battle-flash-map/shots/", import.meta.url),
);
const FLASH_CLASSES = ["battle-flash-hit", "battle-flash-critical"] as const;

type FlashSample = {
  classes: string;
  sceneBackground: string;
  sceneTransform: string;
  fieldTransform: string;
  overlayBackground: string;
};

type FlashProbe = {
  active: boolean;
  done: boolean;
  observedClass: string | null;
  samples: FlashSample[];
};

type ProbeWindow = Window & {
  __battleFlashProbe?: FlashProbe;
  __oprnDebug?: {
    setSeed(seed: number): void;
    readState(): { currentMapId: string; x: number; y: number };
  };
  __oprnInput?: {
    face(direction: string): void;
    action(): void;
  };
};

test.setTimeout(300_000);

test("hit flash keeps the battle scene opaque", async ({ page }) => {
  await withRealBattle(page, async () => {
    await installFlashProbe(page);

    // 실제 데미지 피드백이 먼저다 — 커맨드 확정으로 battleJuice 가 클래스를 붙이길 기다린다.
    await page.keyboard.press("Enter");
    if (!(await flashStarted(page, 5_000))) {
      // 커맨드 타이밍이 피드백을 내지 않으면 flashBattleField 와 **같은 클래스**를 직접 붙인다.
      // 검증 대상은 전투 RNG 가 아니라 실제 씬에 걸리는 출하 CSS 다(battleJuice.ts:81-100).
      await applyFlashClasses(page, "battle-flash-hit");
      expect(await flashStarted(page, 5_000), "히트 플래시 샘플링이 시작되지 않았다").toBe(true);
    }

    await captureMidFlashShot(page, "hit-mid-flash.png");
    const samples = await completedSamples(page);
    expectOpaqueRoot(samples, "hit");
    expectFlashStillVisible(samples, "hit");
    expectRootNotTranslated(samples, "hit");
  });
});

test("critical flash keeps the battle scene opaque and still renders the flash", async ({ page }) => {
  await withRealBattle(page, async () => {
    await installFlashProbe(page);

    // 크리티컬은 RNG 라 직접 붙인다. battleJuice 는 크리티컬에 battle-screen-shake 를
    // 함께 붙이므로(battleJuice.ts:94) 같은 조합으로 셰이크 경로까지 덮는다.
    await applyFlashClasses(page, "battle-flash-critical");
    expect(await flashStarted(page, 30_000), "크리티컬 플래시 샘플링이 시작되지 않았다").toBe(true);

    await captureMidFlashShot(page, "critical-mid-flash.png");
    const samples = await completedSamples(page);
    expectOpaqueRoot(samples, "critical");
    expectFlashStillVisible(samples, "critical");
    expectRootNotTranslated(samples, "critical");
  });
});

async function withRealBattle(page: Page, run: () => Promise<void>): Promise<void> {
  const server = await startPlayerQaServer();
  try {
    const projectJson = await readFile(PROJECT_FIXTURE, "utf8");
    await mkdir(SHOT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.addInitScript(() => {
      localStorage.clear();
      (window as Window & { __OPENRPG_BOOT__?: object }).__OPENRPG_BOOT__ = {
        projectUrl: "/__runtime-qa/project.json",
        saveNamespace: "runtime-qa:battle-flash-map",
        // Debug hooks/state mirrors are an explicit export-QA capability; this probe drives
        // __oprnDebug, so it must opt in like the runtime QA harness does.
        qaInstrumentation: true,
      };
    });
    await page.route("**/__runtime-qa/project.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: projectJson }),
    );

    await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
    await page.keyboard.press("Enter");
    await page.waitForSelector("[data-testid='title-screen']", {
      state: "detached",
      timeout: 120_000,
    });
    await page.waitForFunction(
      () =>
        typeof (window as ProbeWindow).__oprnDebug === "object"
        && (window as ProbeWindow).__oprnDebug !== null,
      undefined,
      { timeout: 120_000 },
    );
    await page.waitForFunction(
      () => {
        const state = (window as ProbeWindow).__oprnDebug?.readState();
        return state?.currentMapId === "map_battle" && state.x === 0 && state.y === 0;
      },
      undefined,
      { polling: "raf", timeout: 30_000 },
    );
    await page.evaluate(() => (window as ProbeWindow).__oprnDebug?.setSeed(1));
    await enterImmediateBattle(page);
    await page.waitForSelector("[data-testid='actor-command-attack']", {
      state: "visible",
      timeout: 120_000,
    });
    await run();
  } finally {
    await server.close();
  }
}

async function enterImmediateBattle(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await page.evaluate(() => {
      const runtimeWindow = window as ProbeWindow;
      runtimeWindow.__oprnInput?.face("right");
      runtimeWindow.__oprnInput?.action();
    });
    try {
      await page.waitForSelector("[data-testid='battle-scene'], .battle-scene", {
        state: "visible",
        timeout: 1_500,
      });
      return;
    } catch {
      // 주입한 액션 엣지가 이벤트에 먹힐 때까지 재시도한다(관측 상태 기준, 고정 대기 없음).
    }
  }
  throw new Error("authored battle did not start within 10 action attempts");
}

async function applyFlashClasses(
  page: Page,
  className: "battle-flash-hit" | "battle-flash-critical",
): Promise<void> {
  await page.evaluate((flashClass) => {
    const scene = document.querySelector<HTMLElement>(".battle-scene");
    if (!scene) throw new Error("battle scene is missing");
    scene.classList.add(flashClass);
    if (flashClass === "battle-flash-critical") scene.classList.add("battle-screen-shake");
  }, className);
}

async function flashStarted(page: Page, timeout: number): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => (window as ProbeWindow).__battleFlashProbe?.active === true,
      undefined,
      { polling: "raf", timeout },
    );
    return true;
  } catch {
    return false;
  }
}

async function installFlashProbe(page: Page): Promise<void> {
  await page.evaluate((flashClasses) => {
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
    if (!scene) throw new Error("battle scene is missing");
    const runtimeWindow = window as ProbeWindow;
    const probe: FlashProbe = { active: false, done: false, observedClass: null, samples: [] };
    runtimeWindow.__battleFlashProbe = probe;

    const activeFlashClass = () => flashClasses.find((name) => scene.classList.contains(name));
    const observer = new MutationObserver(() => {
      const className = activeFlashClass();
      if (!className || probe.active) return;
      probe.active = true;
      probe.observedClass = className;

      // 샘플링은 애니메이션이 끝나면 스스로 멈춘다. 클래스 제거 타이밍(런타임은
      // setTimeout, 테스트는 직접 부착)에 의존하면 판정이 경합에 걸린다 — 실측으로 깨졌다.
      const startedAt = performance.now();
      const sampleFrame = () => {
        const field = document.querySelector<HTMLElement>(".battle-field");
        const overlay = field ? getComputedStyle(field, "::after").backgroundColor : "none";
        probe.samples.push({
          classes: [...scene.classList].filter((name) => name !== "battle-scene").join(" "),
          sceneBackground: getComputedStyle(scene).backgroundColor,
          sceneTransform: getComputedStyle(scene).transform,
          fieldTransform: field ? getComputedStyle(field).transform : "none",
          overlayBackground: overlay,
        });
        const running = [...scene.getAnimations(), ...(field ? field.getAnimations() : [])].some(
          (animation) => animation.playState === "running",
        );
        if (running && performance.now() - startedAt < 2_000) {
          requestAnimationFrame(sampleFrame);
          return;
        }
        probe.done = true;
        observer.disconnect();
      };
      requestAnimationFrame(sampleFrame);
    });
    observer.observe(scene, { attributes: true, attributeFilter: ["class"] });
  }, FLASH_CLASSES);
}

async function captureMidFlashShot(page: Page, fileName: string): Promise<void> {
  // 플래시 창은 200-430ms 다. 스크린샷이 그 창을 놓치지 않도록 실행 중 애니메이션을
  // 중간 시점에 세워 찍고 곧바로 재생한다 — 샘플 판정은 rAF 시리즈가 따로 한다.
  await page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
    const field = document.querySelector<HTMLElement>(".battle-field");
    if (!scene) throw new Error("battle scene is missing");
    for (const animation of [...scene.getAnimations(), ...(field ? field.getAnimations() : [])]) {
      animation.pause();
      animation.currentTime = 40;
    }
  });
  await page.screenshot({ path: `${SHOT_DIR}/${fileName}` });
  await page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
    const field = document.querySelector<HTMLElement>(".battle-field");
    if (!scene) throw new Error("battle scene is missing");
    for (const animation of [...scene.getAnimations(), ...(field ? field.getAnimations() : [])]) {
      animation.play();
    }
  });
}

async function completedSamples(page: Page): Promise<FlashSample[]> {
  await page.waitForFunction(
    () => (window as ProbeWindow).__battleFlashProbe?.done === true,
    undefined,
    { polling: "raf", timeout: 30_000 },
  );
  const samples = await page.evaluate(() => {
    const probe = (window as ProbeWindow).__battleFlashProbe;
    if (!probe || probe.samples.length === 0) throw new Error("flash probe captured no samples");
    return probe.samples;
  });
  await page.evaluate(() => {
    document
      .querySelector<HTMLElement>(".battle-scene")
      ?.classList.remove("battle-flash-hit", "battle-flash-critical", "battle-screen-shake");
  });
  return samples;
}

function colorAlpha(color: string): number {
  const commaAlpha = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/i);
  if (commaAlpha) return Number(commaAlpha[1]);
  const slashAlpha = color.match(/\/\s*([\d.]+)%?\s*\)$/);
  if (slashAlpha) return color.includes("%") ? Number(slashAlpha[1]) / 100 : Number(slashAlpha[1]);
  if (/^rgb\(/i.test(color)) return 1;
  if (color === "none" || color === "transparent") return 0;
  throw new Error(`Cannot parse computed color alpha: "${color}"`);
}

function translationOf(transform: string): { x: number; y: number } {
  const matrix = transform.match(/^matrix\(([^)]+)\)$/);
  if (!matrix) return { x: 0, y: 0 };
  const parts = matrix[1].split(",").map((value) => Number(value.trim()));
  return { x: parts[4] ?? 0, y: parts[5] ?? 0 };
}

function expectOpaqueRoot(samples: FlashSample[], kind: string): void {
  const weakest = samples.reduce((lowest, sample) =>
    colorAlpha(sample.sceneBackground) < colorAlpha(lowest.sceneBackground) ? sample : lowest,
  );
  expect(
    colorAlpha(weakest.sceneBackground),
    `${kind} 플래시 ${samples.length}프레임 중 씬 루트가 투명해졌다: `
      + `background-color "${weakest.sceneBackground}" (classes: ${weakest.classes})`,
  ).toBe(1);
}

function expectFlashStillVisible(samples: FlashSample[], kind: string): void {
  const strongest = samples.reduce((highest, sample) =>
    colorAlpha(sample.overlayBackground) > colorAlpha(highest.overlayBackground) ? sample : highest,
  );
  expect(
    colorAlpha(strongest.overlayBackground),
    `${kind} 플래시가 화면에 남지 않았다: .battle-field::after background-color 최대값 `
      + `"${strongest.overlayBackground}"`,
  ).toBeGreaterThan(0);
}

function expectRootNotTranslated(samples: FlashSample[], kind: string): void {
  const moved = samples.find((sample) => {
    const { x, y } = translationOf(sample.sceneTransform);
    return Math.abs(x) > 0.01 || Math.abs(y) > 0.01;
  });
  expect(
    moved ? `${moved.sceneTransform} (classes: ${moved.classes})` : null,
    `${kind} 플래시 동안 씬 루트가 이동했다 — 불투명 배경이 밀려 가장자리로 맵이 샌다`,
  ).toBeNull();
}
