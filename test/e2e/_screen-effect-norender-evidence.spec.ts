/**
 * 진단 전용 증거 수집 — "Screen Effect" 모던 커맨드가 화면을 바꾸지 않는다는 것을 픽셀로 남긴다.
 *
 * 배경: `executeModernCommand` 는 `runtime.screenEffects` 배열에 push 만 하고 끝난다
 * (`src/player/interpreter/m2ModernRuntime.ts:26`). 이 배열을 **읽는 렌더링 경로가 없다**
 * (저장소 전체에서 쓰기 3곳 + 타입 선언뿐, 소비자 0). 그런데 커맨드는 피커 3페이지에
 * 정상 노출되므로(`src/project/eventCommands/m2PickerLayout.ts:180`) 감독은 넣고, 실행하고,
 * 아무 일도 일어나지 않고, 경고도 못 받는다.
 *
 * 대조군으로 같은 조건에서 "Tint Screen"(구식 경로, 실제로 렌더됨)을 함께 잰다.
 * 대조군이 화면을 바꾸는데 Screen Effect 만 안 바꾸면 "테스트 환경 탓"이 아님이 증명된다.
 *
 * 이 스펙은 **결함을 기록하는 것이 목적**이라 실패시키지 않는다. 수치를 probes.json 에 남긴다.
 * 배선이 복구되면 changedRatio 가 올라가고, 그때 이 스펙을 계약 테스트로 승격시킨다.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent, Project } from "@/project/types";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const DIR = "output/evidence/screen-effect-norender";

test.setTimeout(240_000);

type ProbeCase = {
  readonly id: string;
  readonly title: string;
  readonly label: string;
  readonly fields: Record<string, unknown>;
  /** 대조군(구식 경로, 렌더됨)인가 */
  readonly control: boolean;
};

const CASES: readonly ProbeCase[] = [
  // 대조군 — 구식 Tint Screen 경로. 이건 반드시 화면을 바꿔야 한다.
  { id: "ev_control_tint", title: "Tint Screen", label: "[대조군] 색조 (빨강)", fields: { color: "red", value: "#ff0000", duration: 0 }, control: true },
  // 검사 대상 — 모던 Screen Effect 6옵션 중 화면 변화가 기대되는 4개.
  { id: "ev_se_fadeout", title: "Screen Effect", label: "Screen Effect → 페이드 아웃", fields: { effect: "fadeOut", value: "", durationMs: 600 }, control: false },
  { id: "ev_se_flash", title: "Screen Effect", label: "Screen Effect → 플래시", fields: { effect: "flash", value: "#ffffff", durationMs: 600 }, control: false },
  { id: "ev_se_tint", title: "Screen Effect", label: "Screen Effect → 색조", fields: { effect: "tint", value: "#ff0000", durationMs: 600 }, control: false },
  { id: "ev_se_blur", title: "Screen Effect", label: "Screen Effect → 블러", fields: { effect: "blur", value: "4", durationMs: 600 }, control: false },
];

function m2CommandByTitle(title: string) {
  return M2_COMMAND_CATALOG.find((entry) => entry.title === title);
}

function screenEffectEvent(probeCase: ProbeCase, x: number, y: number): GameEvent {
  const entry = m2CommandByTitle(probeCase.title);
  if (!entry) throw new Error(`카탈로그에 없는 커맨드: ${probeCase.title}`);
  const commands: Command[] = [
    { kind: "m2Command", commandId: entry.id, fields: probeCase.fields } as unknown as Command,
  ];
  const page = {
    id: `${probeCase.id}_page`,
    name: `${probeCase.id}_page`,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  return { id: probeCase.id, x, y, trigger: { kind: "action" }, commands, pages: [page] } as unknown as GameEvent;
}

function probeProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error(`시작 맵을 찾을 수 없다: ${project.startMapId}`);
  map.events = CASES.map((probeCase, index) => screenEffectEvent(probeCase, 4 + index, 5));
  return project;
}

/** 스크린샷 두 장의 픽셀 차이 비율(2px 격자 샘플링). */
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
  await expect(target, `${probeCase.label} 실행 타깃이 런타임에 없다`).toHaveCount(1);
  await expect(target).toBeVisible();
  return playWindow;
}

test("진단: Screen Effect 6옵션이 화면을 바꾸는지 픽셀로 관측한다", async ({ browser, baseURL }) => {
  await rm(DIR, { recursive: true, force: true });
  await mkdir(DIR, { recursive: true });

  const results: Array<Record<string, unknown>> = [];

  for (const probeCase of CASES) {
    // 효과마다 새 컨텍스트 — 이전 효과가 다음 before/after 에 누적되지 않게.
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

      await playWindow.getByTestId(`event-${probeCase.id}`).click();

      // 지속형/일회형을 모두 잡도록 여러 프레임에서 최고 변화량을 보존한다.
      let peak = 0;
      let peakShot = before;
      for (const delay of [80, 160, 160, 200, 200]) {
        await page.waitForTimeout(delay);
        const shot = await playWindow.screenshot();
        const ratio = await changedRatio(before, shot);
        if (ratio > peak) {
          peak = ratio;
          peakShot = shot;
        }
      }
      await writeFile(`${DIR}/${probeCase.id}-after.png`, peakShot);

      // 런타임이 명령을 "받기는 했는지" 확인 — 안 받았으면 무렌더가 아니라 미실행이다.
      const runtimeJson = await playWindow.getByTestId("runtime-state-json").textContent();
      const parsed = JSON.parse(runtimeJson ?? "{}") as Record<string, unknown>;
      const m2 = (parsed.m2Runtime ?? {}) as Record<string, unknown>;
      const screenEffects = Array.isArray(m2.screenEffects) ? m2.screenEffects : [];
      const flags = Object.keys((parsed.flags ?? {}) as Record<string, unknown>).filter((key) => key.startsWith("screen-effect:"));

      results.push({
        id: probeCase.id,
        label: probeCase.label,
        control: probeCase.control,
        changedRatio: Number(peak.toFixed(4)),
        // 배열에 쌓였다 = 인터프리터는 실행했다. 그런데 화면은 안 바뀐다 → 렌더러 부재의 증거.
        screenEffectsRecorded: screenEffects.length,
        screenEffectFlags: flags,
        screenState: m2.screen ?? null,
        consoleWarnings: warnings,
      });

      console.log(
        `[probe] ${probeCase.label.padEnd(30)} ratio=${peak.toFixed(4).padEnd(8)} queued=${screenEffects.length} warnings=${warnings.length}`
      );
    } finally {
      await context.close();
    }
  }

  await writeFile(`${DIR}/probes.json`, JSON.stringify(results, null, 2));
  expect(results).toHaveLength(CASES.length);
});
