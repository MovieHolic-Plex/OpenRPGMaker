/**
 * 적대적 분석 보고서가 인용하는 런타임 화면효과의 실행 가능한 증거 계약.
 *
 * Tint/Flash/Shake/Weather/Hide Screen 각각은 실행 전후 픽셀을 실제로 바꿔야 한다.
 * Weather 는 Phaser 렌더러만 사용해야 하며, 은퇴한 DOM weather overlay 가 돌아오면 안 된다.
 * 이 스펙은 관측 자료를 남기는 동시에 계약을 어긴 probe 를 실패시켜 보고서가 회귀를
 * 정상 동작으로 게시하지 못하게 한다.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent, Project } from "@/project/types";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

/** 카탈로그에서 title 로 엔트리를 찾는다. m2Catalog 는 id/kind 조회만 export 한다. */
function m2CommandByTitle(title: string) {
  return M2_COMMAND_CATALOG.find((entry) => entry.title === title);
}

const DIR = "output/evidence/adversarial-ui-ux";

test.setTimeout(240_000);

type ScreenState = Readonly<Record<string, unknown>>;

type ProbeCase = {
  readonly id: string;
  readonly title: string;
  readonly label: string;
  readonly expectedState: ScreenState;
};

type Probe = {
  readonly title: string;
  readonly label: string;
  readonly declaredSupport: string;
  readonly hasKind: boolean;
  readonly pixelsChanged: boolean;
  readonly changedRatio: number;
  readonly sessionRecorded: ScreenState;
  readonly consoleWarnings: string[];
  readonly domEvidence: { retiredWeatherOverlayPresent: number; tintLayers: number };
};

/** 화면효과 커맨드 하나만 담은 이벤트를 만든다. */
function screenEffectEvent(id: string, x: number, y: number, title: string, fields: Record<string, unknown>): GameEvent {
  const entry = m2CommandByTitle(title);
  if (!entry) throw new Error(`카탈로그에 없는 커맨드: ${title}`);
  const commands: Command[] = [
    { kind: "m2Command", commandId: entry.id, fields } as unknown as Command,
  ];
  // 런타임은 pages[0] 를 해석한다. trigger 는 문자열이 아니라 { kind } 객체다.
  const page = {
    id: `${id}_page`,
    name: `${id}_page`,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  return { id, x, y, trigger: { kind: "action" }, commands, pages: [page] } as unknown as GameEvent;
}

function probeProject(): Project {
  const project = createBlankProject();
  // project.maps 는 배열이 아니라 Record<MapId, GameMap> 이고 startMapId 는 최상위다.
  const map = project.maps[project.startMapId];
  if (!map) throw new Error(`시작 맵을 찾을 수 없다: ${project.startMapId}`);
  map.events = [
    screenEffectEvent("ev_tint", 4, 5, "Tint Screen", { color: "red", value: "#ff0000", duration: 0 }),
    // 인터프리터는 color/durationMs 를 읽고 에디터는 intensity/durationMs 도 함께 저장한다.
    // 실제 저작 산출물과 같아지도록 양쪽 필드를 모두 넣는다.
    screenEffectEvent("ev_flash", 5, 5, "Flash Screen", { color: "white", value: "flash", durationMs: 600 }),
    screenEffectEvent("ev_shake", 6, 5, "Shake Screen", { intensity: 10, value: 10, durationMs: 900 }),
    // 대조군: weather 는 Phaser weather runtime plan 경로가 있다.
    screenEffectEvent("ev_weather", 8, 5, "Set Weather Effects", { value: "rain,0.9" }),
    screenEffectEvent("ev_hide", 7, 5, "Hide Screen", {}),
  ];
  return project;
}

/** 스크린샷 두 장의 픽셀 차이 비율을 센다. */
async function changedRatio(before: Buffer, after: Buffer): Promise<number> {
  const { default: Jimp } = await import("jimp");
  const a = await Jimp.read(before);
  const b = await Jimp.read(after);
  const w = Math.min(a.bitmap.width, b.bitmap.width);
  const h = Math.min(a.bitmap.height, b.bitmap.height);
  let diff = 0;
  let total = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      total += 1;
      if (a.getPixelColor(x, y) !== b.getPixelColor(x, y)) diff += 1;
    }
  }
  return total === 0 ? 0 : diff / total;
}

async function runtimeScreen(playWindow: Locator): Promise<ScreenState> {
  return playWindow.getByTestId("runtime-state-json").evaluate((el) => {
    const parsed = JSON.parse(el.textContent ?? "{}") as Record<string, unknown>;
    const m2 = parsed.m2Runtime as Record<string, unknown> | undefined;
    const screen = m2?.screen;
    if (!screen || typeof screen !== "object" || Array.isArray(screen)) {
      throw new Error("runtime-state-json 에 m2Runtime.screen 이 없다");
    }
    return screen as ScreenState;
  });
}

const EFFECT_STATE_KEYS = ["tint", "tintDurationMs", "flash", "shake", "weather", "hidden"] as const;

async function assertIsolatedEffectState(playWindow: Locator, probeCase: ProbeCase): Promise<ScreenState> {
  await expect.poll(() => runtimeScreen(playWindow), {
    message: `${probeCase.title} 실행 상태가 기록되지 않았다`,
    timeout: 10_000,
  }).toMatchObject(probeCase.expectedState);
  const screen = await runtimeScreen(playWindow);
  for (const key of EFFECT_STATE_KEYS) {
    if (key in probeCase.expectedState) continue;
    expect(screen, `${probeCase.title} fresh runtime 이 다른 화면효과 상태 ${key} 에 오염됐다`).not.toHaveProperty(key);
  }
  return screen;
}

async function openProbeRuntime(page: Page, probeCase: ProbeCase): Promise<Locator> {
  await seedProjectFromSupabaseCanonical(page, probeProject());
  const skip = page.getByRole("button", { name: "건너뛰기" });
  if (await skip.count()) await skip.click();
  await expect(page.getByTestId("topbar-test-play")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("topbar-test-play").click();
  const playWindow = page.getByTestId("test-play-window");
  await expect(playWindow).toBeVisible({ timeout: 30_000 });
  await startNewGameFromTitle(page);
  await expect(playWindow.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
  const target = playWindow.getByTestId(`event-${probeCase.id}`);
  await expect(target, `${probeCase.title} 이벤트 실행 타깃이 런타임에 없다`).toHaveCount(1);
  await expect(target).toBeVisible();
  return playWindow;
}

test("적대적: runtime-full 화면효과 커맨드가 실제로 화면을 바꾸는지 픽셀로 검증한다", async ({ browser, baseURL }) => {
  await rm(DIR, { recursive: true, force: true });
  await mkdir(DIR, { recursive: true });

  const probes: Probe[] = [];
  const cases: readonly ProbeCase[] = [
    { id: "ev_tint", title: "Tint Screen", label: "화면 색조 (빨강)", expectedState: { tint: "#ff0000", tintDurationMs: 0 } },
    { id: "ev_flash", title: "Flash Screen", label: "화면 플래시 (흰색)", expectedState: { flash: "flash" } },
    { id: "ev_shake", title: "Shake Screen", label: "화면 흔들기 (강도 10)", expectedState: { shake: 10 } },
    { id: "ev_weather", title: "Set Weather Effects", label: "날씨 비 (대조군)", expectedState: { weather: "rain,0.9" } },
    { id: "ev_hide", title: "Hide Screen", label: "화면 숨기기", expectedState: { hidden: true } },
  ];

  for (const probeCase of cases) {
    // 효과마다 브라우저 저장소·PlaySession·Phaser scene 을 새로 만들어 이전 효과가
    // 다음 before/after 또는 상태 증거에 누적될 수 없게 한다.
    const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") warnings.push(`[${message.type()}] ${message.text()}`);
    });

    try {
      const playWindow = await openProbeRuntime(page, probeCase);
      const before = await playWindow.screenshot();
      await writeFile(`${DIR}/${probeCase.id}-before.png`, before);
      const warnBefore = warnings.length;

      // 런타임 event target 은 증거 계약의 일부다. 없는 타깃이나 optional no-op runner 로
      // 성공을 위조하지 않고, 실제 플레이 표면의 클릭 경로만 실행한다.
      const target = playWindow.getByTestId(`event-${probeCase.id}`);
      await target.click();

      // flash/shake 는 수백 ms 만 지속되므로 진행 중 여러 프레임에서 최고 변화량을 보존한다.
      let peak = 0;
      let peakShot = before;
      for (const delay of [80, 200, 360, 560, 820]) {
        await page.waitForTimeout(delay === 80 ? 80 : 160);
        const shot = await playWindow.screenshot();
        const ratio = await changedRatio(before, shot);
        if (ratio > peak) {
          peak = ratio;
          peakShot = shot;
        }
      }
      await writeFile(`${DIR}/${probeCase.id}-after.png`, peakShot);

      const session = await assertIsolatedEffectState(playWindow, probeCase);
      const threshold = probeCase.title === "Set Weather Effects" ? 0.001 : 0.01;
      expect(peak, `${probeCase.title} 렌더러가 runtime 표면 픽셀을 바꾸지 않았다`).toBeGreaterThan(threshold);

      const domEvidence = await playWindow.evaluate((root) => ({
        retiredWeatherOverlayPresent: root.querySelectorAll(".runtime-weather-overlay").length,
        tintLayers: root.querySelectorAll("[class*='screen-tint'],[class*='screen-hidden'],.runtime-screen-overlay").length,
      }));
      expect(domEvidence.retiredWeatherOverlayPresent, "은퇴한 weather DOM overlay 가 돌아왔다").toBe(0);

      const entry = m2CommandByTitle(probeCase.title);
      expect(entry, `카탈로그에서 ${probeCase.title} 을 찾지 못했다`).toBeTruthy();
      probes.push({
        title: probeCase.title,
        label: probeCase.label,
        declaredSupport: entry!.runtimeSupport,
        hasKind: Boolean(entry!.existingKind),
        pixelsChanged: true,
        changedRatio: Number(peak.toFixed(4)),
        sessionRecorded: session,
        consoleWarnings: warnings.slice(warnBefore),
        domEvidence,
      });
    } finally {
      await context.close();
    }
  }

  await writeFile(`${DIR}/probes.json`, JSON.stringify(probes, null, 2));

  for (const probe of probes) {
    console.log(
      `[probe] ${probe.title.padEnd(22)} declared=${probe.declaredSupport.padEnd(14)} kind=${String(probe.hasKind).padEnd(5)} pixelsChanged=${String(probe.pixelsChanged).padEnd(5)} ratio=${String(probe.changedRatio).padEnd(8)} retiredWeatherOverlayPresent=${probe.domEvidence.retiredWeatherOverlayPresent} tintLayers=${probe.domEvidence.tintLayers}`
    );
  }

  expect(probes).toHaveLength(cases.length);
});
