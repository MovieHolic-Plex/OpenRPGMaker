/**
 * 계약: **피커에서 고를 수 있는 `Screen Effect` 옵션은 전부 실제로 화면을 바꾼다.**
 *
 * 회귀 배경: 이 커맨드는 `runtime.screenEffects` 배열에 push 만 하고 끝났고, 그 배열을
 * 읽는 렌더러가 저장소에 없었다. 피커에는 정상 노출되니 감독은 넣고 → 실행하고 →
 * 화면은 그대로고 → 경고도 못 받았다. 실측 픽셀 변화율 0.00%(같은 조건 구식 Tint Screen 75.28%).
 * 배선 후 75.27% 로 올라왔고, 이 스펙이 그 상태를 고정한다.
 *
 * 유닛(test/screenEffectPlan.test.ts)은 매핑을, 이 스펙은 **모델→화면** 구간을 지킨다.
 * 모델 계층만 초록이던 탓에 배선이 끊긴 채 오래 방치됐던 것이 이 결함의 근본 원인이다.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent, Project } from "@/project/types";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { SCREEN_EFFECT_OPTIONS } from "@/project/eventCommands/m2ModernCatalog";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const DIR = "output/evidence/screen-effect-renders";

// 효과 하나당 프로젝트 시드 + 에디터 부팅 + 테스트플레이 기동이 들어간다.
// 전부 한 테스트에 몰면 240s 를 넘겨 타임아웃했다(실측) — 효과별로 쪼개 각자 예산을 준다.
test.describe.configure({ timeout: 180_000 });
test.use({ viewport: { width: 1280, height: 800 } });

/** 효과별 최소 픽셀 변화율. 날씨는 파티클이라 화면 점유가 작다(구식 경로 실측 1.55%). */
const THRESHOLD: Record<string, number> = { weather: 0.001 };
const DEFAULT_THRESHOLD = 0.01;

type ProbeCase = {
  readonly id: string;
  readonly effect: string;
  readonly label: string;
  readonly value: string;
  /** fadeIn 은 이미 보이는 화면에서는 바꿀 게 없다 — 먼저 어둡게 덮고 나서 잰다. */
  readonly primeWith?: string;
};

function caseFor(option: { value: string; label: string }): ProbeCase {
  const base = { id: `ev_se_${option.value.toLowerCase()}`, effect: option.value, label: option.label };
  switch (option.value) {
    case "tint":
      return { ...base, value: "#ff0000" };
    case "flash":
      return { ...base, value: "white" };
    case "weather":
      return { ...base, value: "rain,0.9" };
    case "fadeIn":
      return { ...base, value: "", primeWith: "fadeOut" };
    default:
      return { ...base, value: "" };
  }
}

const CASES: readonly ProbeCase[] = SCREEN_EFFECT_OPTIONS.map(caseFor);

function m2CommandByTitle(title: string) {
  return M2_COMMAND_CATALOG.find((entry) => entry.title === title);
}

function screenEffectEvent(id: string, x: number, y: number, fields: Record<string, unknown>): GameEvent {
  const entry = m2CommandByTitle("Screen Effect");
  if (!entry) throw new Error("카탈로그에 Screen Effect 가 없다");
  const commands: Command[] = [{ kind: "m2Command", commandId: entry.id, fields } as unknown as Command];
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
  const map = project.maps[project.startMapId];
  if (!map) throw new Error(`시작 맵을 찾을 수 없다: ${project.startMapId}`);
  // 전부 같은 행(y=5)에 늘어놓는다. 아래쪽 행에 두면 터치 d-pad 오버레이
  // (.touch-pad)가 클릭을 가로채 이벤트를 못 누른다(실측: prime 클릭 180s 타임아웃).
  // 맵은 20×15 라 6칸은 여유롭게 들어간다.
  const events: GameEvent[] = [];
  const PROBE_ROW = 5;
  let column = 3;
  for (const probeCase of CASES) {
    events.push(screenEffectEvent(probeCase.id, (column += 1), PROBE_ROW, {
      effect: probeCase.effect,
      value: probeCase.value,
      durationMs: 400,
    }));
    if (probeCase.primeWith) {
      events.push(screenEffectEvent(`${probeCase.id}_prime`, (column += 1), PROBE_ROW, {
        effect: probeCase.primeWith,
        value: "",
        durationMs: 200,
      }));
    }
  }
  map.events = events;
  return project;
}

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

async function openProbeRuntime(page: Page): Promise<Locator> {
  await seedProjectFromSupabaseCanonical(page, probeProject());
  const skip = page.getByRole("button", { name: "건너뛰기" });
  if (await skip.count()) await skip.click();
  await expect(page.getByTestId("topbar-test-play")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("topbar-test-play").click();
  const playWindow = page.getByTestId("test-play-window");
  await expect(playWindow).toBeVisible({ timeout: 30_000 });
  await startNewGameFromTitle(page);
  await expect(playWindow.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
  return playWindow;
}

/** 클릭 후 여러 프레임에서 최고 변화량을 보존한다(flash 는 수백 ms 만 지속). */
async function peakChangeAfterClick(page: Page, playWindow: Locator, eventId: string, before: Buffer) {
  await playWindow.getByTestId(`event-${eventId}`).click();
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
  return { peak, peakShot };
}

test.beforeAll(async () => {
  await rm(DIR, { recursive: true, force: true });
  await mkdir(DIR, { recursive: true });
});

for (const probeCase of CASES) {
  test(`계약: Screen Effect → ${probeCase.label} 이 화면 픽셀을 바꾼다`, async ({ page }) => {
    const playWindow = await openProbeRuntime(page);

    // fadeIn 처럼 "되돌리는" 효과는 먼저 상태를 만들어야 잴 것이 생긴다.
    if (probeCase.primeWith) {
      await playWindow.getByTestId(`event-${probeCase.id}_prime`).click();
      await page.waitForTimeout(600);
    }

    const before = await playWindow.screenshot();
    await writeFile(`${DIR}/${probeCase.id}-before.png`, before);
    const { peak, peakShot } = await peakChangeAfterClick(page, playWindow, probeCase.id, before);
    await writeFile(`${DIR}/${probeCase.id}-after.png`, peakShot);

    const threshold = THRESHOLD[probeCase.effect] ?? DEFAULT_THRESHOLD;
    await writeFile(
      `${DIR}/${probeCase.id}.json`,
      JSON.stringify({ effect: probeCase.effect, label: probeCase.label, changedRatio: Number(peak.toFixed(4)), threshold }, null, 2)
    );
    console.log(`[probe] ${probeCase.label.padEnd(18)} effect=${probeCase.effect.padEnd(10)} ratio=${peak.toFixed(4)} (>${threshold})`);

    expect(
      peak,
      `Screen Effect → ${probeCase.label} 이 화면을 바꾸지 않았다. ` +
        `렌더 경로가 끊겼는지 확인하라(src/player/interpreter/screenEffectPlan.ts).`
    ).toBeGreaterThan(threshold);
  });
}
