// 테스트 플레이가 "실제 테스트에 쓸 수 있는 계측기"인지 라이브로 증명한다.
//
// 관측된 결함(2026-08-25, 1280×720, ?blankProject=1)에 1:1 대응한다:
//   D1 게임이 창의 27% 만 사용(정수 배율 강제) → 창에 맞춰 채워야 한다.
//   D2 실행마다 타이틀 화면 왕복 → 기본은 즉시 플레이.
//   D3 재시작 수단 없음 → 타이틀바 `다시 시작` / `타이틀부터`.
//   D4 디버그 패널 스위치 옵션 0개(죽은 버튼) → 옵션이 있고 ON 이 런타임 상태를 실제로 바꾼다.
//   D5 저작자가 읽을 수 있는 상태 없음 → 라이브 리드아웃.
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { tapKey } from "./runtimeInput";

const EVIDENCE_DIR = process.env.TESTPLAY_EVIDENCE_DIR ?? "";

function evidence(name: string): string | undefined {
  if (!EVIDENCE_DIR) return undefined;
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  return `${EVIDENCE_DIR}/${name}`;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

test("테스트 플레이는 창을 채우고, 타이틀 없이 시작하고, 재시작·디버그 계측이 실제로 동작한다", async ({ page }) => {
  test.setTimeout(240_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // 워크트리 환경의 Supabase 프록시 거부는 런타임 결함이 아니다.
    if (text.includes("ERR_CONNECTION_REFUSED")) return;
    consoleErrors.push(text.slice(0, 300));
  });

  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  // 프로젝트가 실제로 로드된 뒤에만 테스트 게이트를 통과한다 — 캔버스를 기다린다(고정 sleep 금지).
  await expect(page.getByTestId("edit-canvas").locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("mode-play")).toBeEnabled({ timeout: 60_000 });
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 60_000 });

  // D2: 타이틀을 거치지 않고 곧바로 플레이 상태가 된다.
  const runtimeState = page.getByTestId("runtime-state-json");
  await expect(runtimeState).toBeAttached({ timeout: 60_000 });
  await expect(page.getByTestId("title-screen")).toHaveCount(0);
  // D2 옵션: 지금 모드가 체크박스로 보이고, 그것이 자동 시작 선호다.
  await expect(page.getByTestId("test-play-skip-title")).toBeChecked();

  // D1: 논리 해상도가 창을 채운다(정수 배율 상한 2.0 초과).
  const geometry = await page.evaluate(() => {
    const viewport = document.querySelector('[data-testid="play-viewport"]') as HTMLElement | null;
    const stage = document.querySelector('[data-testid="play-stage"]') as HTMLElement | null;
    const box = (node: Element | null) =>
      node ? { w: node.getBoundingClientRect().width, h: node.getBoundingClientRect().height } : null;
    return {
      viewport: box(viewport),
      stage: box(stage),
      scale: Number(viewport?.dataset.scale ?? "0"),
    };
  });
  expect(geometry.viewport).not.toBeNull();
  expect(geometry.stage).not.toBeNull();
  expect(geometry.scale).toBeGreaterThan(2.2);
  // 4:3 논리 해상도를 와이드 창에 넣으면 높이가 제한 변이다. 높이를 가득 채우면 남는 것은
  // 좌우 여백뿐이다(수정 전 실측: 높이 75%, 면적 39.5%).
  expect(geometry.stage!.h / geometry.viewport!.h).toBeGreaterThan(0.97);
  const coverage =
    (geometry.stage!.w * geometry.stage!.h) / (geometry.viewport!.w * geometry.viewport!.h);
  expect(coverage).toBeGreaterThan(0.6);
  const shotFill = evidence("20-fills-window.png");
  if (shotFill) await page.screenshot({ path: shotFill });

  // D1(횜섭): 기하학만 맞고 화면이 안 그려지는 경우를 막는다. 자동 시작 경로가 셀 모달과
  // 같은 핅에 엔진을 띄우면 확대된 스테이지가 첫 프레임을 엉마감으로 합성해 맵이 사라지고
  // 에디터 화면이 배경으로 배어나왔다(실측). 스테이지 샷을 다시 및어 태울 상태를 본다.
  const stageShot = await page.locator('[data-testid="play-stage"]').screenshot();
  const nearWhiteRatio = await page.evaluate(async (base64: string) => {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("stage shot decode failed"));
      image.src = `data:image/png;base64,${base64}`;
    });
    const probe = document.createElement("canvas");
    probe.width = image.width;
    probe.height = image.height;
    const context = probe.getContext("2d");
    if (!context) throw new Error("2d context unavailable");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, probe.width, probe.height);
    let sampled = 0;
    let nearWhite = 0;
    for (let index = 0; index < data.length; index += 4 * 16) {
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      sampled += 1;
      if (r > 235 && g > 235 && b > 235) nearWhite += 1;
    }
    return sampled === 0 ? 1 : nearWhite / sampled;
  }, stageShot.toString("base64"));
  expect(nearWhiteRatio, "play stage is mostly blank/near-white - the run is not rendering").toBeLessThan(0.2);

  // 저작자처럼 움직여 본다 — 런타임이 입력을 받는다.
  const before = JSON.parse((await runtimeState.textContent()) ?? "{}");
  await tapKey(page, "ArrowDown", 220);
  await expect
    .poll(async () => JSON.parse((await runtimeState.textContent()) ?? "{}").player?.y)
    .not.toBe(before.player?.y);

  // D5: 저작자가 읽을 수 있는 라이브 리드아웃이 화면에 보인다.
  const liveState = page.getByTestId("runtime-debug-live-state");
  await expect(liveState).toBeVisible();
  await expect(liveState).toContainText(before.mapId);

  // D4: 스위치 컨트롤이 살아 있고 ON 이 런타임 상태를 바꾼다.
  const panelToggle = page.getByTestId("runtime-debug-toggle");
  const switchSelect = page.getByTestId("runtime-debug-switch-select");
  // 패널은 펼침 상태를 기억한다 — 무조건 토글하면 오히려 접힌다. 안 보일 때만 여는다.
  if (!(await switchSelect.isVisible())) await panelToggle.click();
  await expect(switchSelect).toBeVisible();
  const optionCount = await switchSelect.locator("option").count();
  expect(optionCount).toBeGreaterThan(0);
  const switchId = await switchSelect.locator("option").first().getAttribute("value");
  expect(switchId).toBeTruthy();
  await switchSelect.selectOption(switchId!);
  await page.getByTestId("runtime-debug-switch-on").click();
  await expect
    .poll(async () => JSON.parse((await runtimeState.textContent()) ?? "{}").switches?.[switchId!])
    .toBe(true);
  // 스위치를 쓸 수 있다 = 바뀐 값을 패널에서 바로 볼 수 있다(전체 JSON 을 열지 않고).
  const switchValue = page.getByTestId("runtime-debug-switch-value");
  await expect(switchValue).toHaveAttribute("data-switch-id", switchId!);
  await expect(switchValue).toHaveAttribute("data-switch-value", "true");
  await expect(switchValue).toHaveText("ON");
  const shotDebug = evidence("21-debug-instrument.png");
  if (shotDebug) await page.screenshot({ path: shotDebug });

  // D3: 다시 시작이 런을 처음 상태로 되돌린다(스위치 ON 이 사라진다).
  await page.getByTestId("test-play-restart").click();
  await expect
    .poll(
      async () => JSON.parse((await runtimeState.textContent()) ?? "{}").switches?.[switchId!],
      { timeout: 60_000 }
    )
    .toBe(false);
  const shotRestart = evidence("22-after-restart.png");
  if (shotRestart) await page.screenshot({ path: shotRestart });

  // D3: 타이틀부터도 그대로 도달 가능하다(기존 경로 보존).
  await page.getByTestId("test-play-title").click();
  await expect(page.getByTestId("title-screen")).toBeVisible({ timeout: 60_000 });
  // 체크박스는 버튼이 바꾸 선호를 같이 보여준다(숨은 상태 금지).
  await expect(page.getByTestId("test-play-skip-title")).not.toBeChecked();
  // 타이틀은 플레이 서페이스를 공유하므로 play-stage 가 동시에 살아 있다 — 공용 햬프의
  // title.or(stage) 는 여기에서 strict 위반이 된다. 타이틀을 곧바로 집어 새 게임을 시작한다.
  await expect(page.getByTestId("title-new-game")).toBeVisible({ timeout: 60_000 });
  await page.keyboard.press("Enter");
  await expect(runtimeState).toBeAttached({ timeout: 60_000 });
  await expect(page.getByTestId("title-screen")).toHaveCount(0);

  expect(consoleErrors, `unexpected console errors: ${consoleErrors.join(" | ")}`).toEqual([]);

  if (EVIDENCE_DIR) {
    writeFileSync(
      `${EVIDENCE_DIR}/instrument-report.json`,
      JSON.stringify({ geometry, coverage, nearWhiteRatio, optionCount, switchId, consoleErrors }, null, 2),
      "utf8"
    );
  }
});
