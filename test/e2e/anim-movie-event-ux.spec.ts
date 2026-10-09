/**
 * 애니메이션·동영상 이벤트 저작 UX 종단 증명(anim-movie-event-ux 레인).
 *
 * 증명 대상은 네 가지다.
 *  C1 애니메이션 실미리보기 — showAnimation 본문 표시면이 레코드 시트 프레임을 실제로 돌린다.
 *     (data-frame-index 전진 + 스테이지 스크린샷 버퍼 차이 + ▶ 재생/■ 정지 토글 상태 반전)
 *  C2 단일 표시면 — 열린 showAnimation 본문에 애니메이션 표제가 정확히 하나다.
 *  C3 동영상 — playMovie 본문 표시면 안에 진짜 <video> 가 걸리고, 재생 진행을 실측해 정직하게 기록한다.
 *  C4 샘플·기본 데이터 — 번들 샘플 클립이 서버에서 200 이고, 기본 DB 가 생성 이펙트 애니메이션을 싣는다.
 *
 * 증거는 .omo/evidence/anim-movie-event-ux/ 에 남는다(PNG + JSON).
 *
 * 재생 진행 측정(C3)에만 벽시계 샘플링을 쓴다 — 거기서는 "시간에 따라 디코딩이 나아가는가" 자체가
 * 측정 대상이다. 그 밖의 대기는 모두 상태(프레임 인덱스·버튼 라벨) 폴링이다.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { GENERATED_EFFECT_SHEETS } from "@/assets/generatedEffectSheets";
import { defaultBattleAnimationRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import { openCommandPicker, openMapEventEditor, pickerGrid } from "./eventStoryboardPicker";

const EVIDENCE_DIR = path.resolve(".omo/evidence/anim-movie-event-ux");

/** 12프레임(15fps → 약 800ms) 생성 이펙트. 재생 중/정지 상태를 갈라서 찍을 시간이 필요하다. */
const LONG_ANIMATION_NAME = "운석 낙하";

type ConsoleRecord = { readonly kind: string; readonly text: string };

type ToolWindow = Window & {
  __oprnEditorTool?: (name: string, args: Record<string, unknown>) => unknown;
  __oprnRegionTaskHarness?: { readonly currentMapId: () => string };
};

type FrameShot = {
  readonly file: string;
  readonly frameIndex: string | null;
  readonly atMs: number;
  readonly bytes: number;
  readonly sha256: string;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    // 전문가 모드 + 웰컴/코치마크 무음. 이벤트 에디터 표면만 남긴다.
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    window.localStorage.setItem("oprn:standard-welcome-seen", "1");
    window.localStorage.setItem("oprn:editor-session-id", "e2e-anim-movie-event-ux");
  });
  await page.setViewportSize({ width: 1478, height: 926 });
});

test("C1·C2 showAnimation 표시면이 실제 프레임을 돌리고 표제는 하나다", async ({ page }) => {
  test.setTimeout(120_000);
  const logs = attachConsole(page);
  const body = await openShowAnimationBody(page);

  // 어떤 애니메이션을 고를 수 있는지 먼저 기록한다(C4 기본 데이터 교차 확인용).
  const select = body.getByTestId("show-animation-animationId-select");
  const options = await select.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({ value: (node as HTMLOptionElement).value, label: (node.textContent ?? "").trim() }))
  );
  const generatedOptions = options.filter((option) => option.value.startsWith("anim_gen_"));
  await writeJson("c1-animation-options.json", {
    projectSeed: "?blankProject=1 (기본 데이터베이스)",
    count: options.length,
    generatedEffectOptions: generatedOptions.length,
    options,
  });
  // 기본 DB 의 생성 이펙트가 이벤트 저작 표면까지 실제로 도달한다(C4 브라우저 쪽 교차 확인).
  expect(generatedOptions.length).toBeGreaterThanOrEqual(30);

  // 시트 프레임이 12장인 레코드로 바꾼다 — 재생 중 프레임과 정지 프레임을 갈라 찍을 수 있다.
  // 네이티브 select 는 커스텀 리스트박스에 가려 aria-hidden 이므로 제품 UI 로 고른다.
  await selectRecord(page, body, "show-animation-animationId-select", LONG_ANIMATION_NAME);
  await expect(select).toHaveValue("anim_gen_meteor_fall");
  const stage = body.getByTestId("show-animation-preview-stage");
  const layer = body.getByTestId("show-animation-frame-layer");
  await expect(stage).toBeVisible();
  await expect(layer).toHaveAttribute("data-frame-index", /\d+/);
  await expect(body.getByTestId("show-animation-preview-fallback")).toHaveCount(0);

  // 시트 아트가 디코딩되기 전에 찍으면 두 장이 모두 빈 스테이지가 된다. 실제 디코딩을 기다린다.
  const sheetUrl = await frameSheetUrl(layer);
  await page.evaluate(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
  }, sheetUrl);

  // 열릴 때 1회 자동 재생한다. 토글 계약을 재려면 먼저 정지 상태로 내려놓는다.
  const play = body.getByTestId("show-animation-play");
  await expect(play).toBeVisible();
  await expect
    .poll(async () => ((await play.textContent()) ?? "").trim(), { timeout: 10_000 })
    .toBe("▶ 재생");
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect(layer).toHaveAttribute("data-frame-index", "0");

  const restShot = await captureStage(stage, layer, "c1-stage-rest-before.png", 0);

  // 프레임 인덱스 전진은 MutationObserver 로 한 번의 재생 동안 전부 모은다.
  await layer.evaluate((node) => {
    const target = node as HTMLElement;
    const observed: string[] = [];
    (window as unknown as { __animFrames?: string[] }).__animFrames = observed;
    new MutationObserver(() => {
      observed.push(target.dataset.frameIndex ?? "");
    }).observe(target, { attributes: true, attributeFilter: ["data-frame-index"] });
  });

  await play.click();
  // 토글이 실제로 뒤집힌다: 라벨과 aria-pressed 가 함께 재생 상태로 간다.
  await expect(play).toHaveText("■ 정지");
  await expect(play).toHaveAttribute("aria-pressed", "true");

  const playStartedAt = Date.now();
  const midShots: FrameShot[] = [];
  // 재생 중 스테이지를 연속으로 찍는다. 프레임 0 이 아닌 장면이 잡히면 그걸 비교 증거로 쓴다.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const shot = await captureStage(
      stage,
      layer,
      `c1-stage-playing-${String(attempt).padStart(2, "0")}.png`,
      Date.now() - playStartedAt
    );
    midShots.push(shot);
    if (shot.frameIndex !== null && shot.frameIndex !== "0") break;
    if (((await play.textContent()) ?? "").trim() === "▶ 재생") break;
  }
  const movingShot = midShots.find((shot) => shot.frameIndex !== null && shot.frameIndex !== "0");

  // 1회 재생이 끝나면 버튼은 정지 상태로, 레이어는 첫 프레임으로 돌아온다.
  await expect(play).toHaveText("▶ 재생", { timeout: 15_000 });
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect(layer).toHaveAttribute("data-frame-index", "0");
  const restShotAfter = await captureStage(stage, layer, "c1-stage-rest-after.png", Date.now() - playStartedAt);

  const observedFrames = await page.evaluate(
    () => (window as unknown as { __animFrames?: string[] }).__animFrames ?? []
  );
  const distinctFrames = [...new Set(observedFrames)];

  await writeJson("c1-playback.json", {
    animation: LONG_ANIMATION_NAME,
    sheetUrl: describeUrl(sheetUrl),
    observedFrames,
    distinctFrames,
    restBefore: restShot,
    playingShots: midShots,
    restAfter: restShotAfter,
    comparedShots: movingShot ? [movingShot.file, restShotAfter.file] : null,
    shotGapMs: movingShot ? restShotAfter.atMs - movingShot.atMs : null,
    console: logs,
  });

  // data-frame-index 가 실제로 전진한다(정지 복귀 프레임 0 포함해 3개 이상 관측).
  expect(distinctFrames.length, `관측 프레임: ${observedFrames.join(",")}`).toBeGreaterThanOrEqual(3);
  expect(observedFrames.some((frame) => frame !== "0")).toBe(true);

  // 재생 중 스테이지와 정지 스테이지의 픽셀 버퍼가 다르다.
  expect(movingShot, `재생 중 프레임을 잡지 못했다: ${JSON.stringify(midShots)}`).toBeDefined();
  const gapMs = restShotAfter.atMs - (movingShot as FrameShot).atMs;
  expect((movingShot as FrameShot).sha256).not.toBe(restShotAfter.sha256);
  expect(gapMs, "두 스테이지 스크린샷 간격").toBeGreaterThan(300);

  // C2 — 열린 본문 안 애니메이션 표제는 하나뿐이다.
  const bodyTitles = await collectAnimationTitles(body);
  const dialogTitles = await collectAnimationTitles(page.getByTestId("event-command-edit-dialog"));
  await writeJson("c2-animation-surface-titles.json", {
    scope: "show-animation-command-body",
    bodyMatches: bodyTitles,
    dialogMatches: dialogTitles,
    note: "대화상자 범위 목록은 문맥용이다. 계약은 본문 범위에서 표제 1개.",
  });
  expect(bodyTitles.map((match) => match.testid)).toEqual(["show-animation-surface-title"]);

  await page.getByTestId("event-command-edit-dialog").screenshot({
    path: path.join(EVIDENCE_DIR, "c2-show-animation-dialog.png"),
  });
  // 네트워키 연결 거부(예: 로생 백엔드 미기동)는 이 레인의 결함이 아니다 — 증거에만 남긴다.
  // 잡혀지지 않은 예생(pageerror)과 네트워키 외 콘솔 오류는 통과 조건이다.
  expect(logs.filter((entry) => entry.kind === "pageerror"), "페이지 예생").toEqual([]);
  expect(appErrorLogs(logs), "앨 콘솔 오류").toEqual([]);
});

test("C3 playMovie 본문 표시면에 진짜 <video> 가 걸리고 재생 진행을 실측한다", async ({ page }) => {
  test.setTimeout(120_000);
  const logs = attachConsole(page);
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });

  // playMovie 는 보증 레지스트리가 editorOnly 라 명령 피커 그리드에서 직접 고를 수 없다.
  // (commandGuaranteeRegistry: support.map = "editorOnly" → descriptor.selectable = false)
  // 그래서 제품이 실제로 지원하는 저수준 저작 경로(에디터 툴 upsert_event)로 명령을 심고,
  // 이벤트 에디터에서 그 명령의 본문을 연다.
  const tile = await centerTile(page);
  const seed = await page.evaluate(
    ({ mapId, at }) => {
      const tool = (window as ToolWindow).__oprnEditorTool;
      if (!tool) return { ok: false, reason: "__oprnEditorTool 없음" };
      return tool("upsert_event", {
        mapId,
        event: {
          id: "ev_anim_movie_proof",
          x: at.x,
          y: at.y,
          trigger: { kind: "action" },
          pages: [
            {
              id: "page_movie",
              commands: [{ kind: "playMovie", resourceId: "", wait: true, skippable: true }],
            },
          ],
        },
      });
    },
    { mapId: await currentMapId(page), at: tile }
  );
  await writeJson("c3-seed-upsert-event.json", { tile, result: seed });
  expect(seed, `upsert_event 실패: ${JSON.stringify(seed)}`).toMatchObject({ ok: true });

  const editor = await openEventEditorAt(page, tile);
  const card = editor.getByTestId("event-storyboard-card-0");
  await expect(card).toBeVisible();
  await expect(card).toContainText("동영상");
  await card.click();

  const body = editor.getByTestId("play-movie-command-body");
  await expect(body).toBeVisible();
  const stage = body.getByTestId("play-movie-preview-stage");
  await expect(stage).toBeVisible();
  const video = stage.locator("video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute("src", /sample-movie\.webm$/);

  const measurement = await video.evaluate(async (node) => {
    const media = node as HTMLVideoElement;
    media.muted = true;
    let playError: string | null = null;
    try {
      await media.play();
    } catch (error) {
      playError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    // 디코딩 진행 자체가 측정 대상이라 여기서만 벽시계로 샘플링한다(최대 3초).
    const samples: { readonly atMs: number; readonly currentTime: number; readonly readyState: number }[] = [];
    const startedAt = performance.now();
    for (;;) {
      const atMs = Math.round(performance.now() - startedAt);
      samples.push({ atMs, currentTime: media.currentTime, readyState: media.readyState });
      if (media.currentTime > 0.05 || atMs >= 3_000) break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return {
      playError,
      samples,
      paused: media.paused,
      currentSrc: media.currentSrc,
      duration: Number.isFinite(media.duration) ? media.duration : null,
      videoWidth: media.videoWidth,
      videoHeight: media.videoHeight,
      readyState: media.readyState,
      networkState: media.networkState,
      mediaError: media.error ? { code: media.error.code, message: media.error.message } : null,
    };
  });

  const advance = Math.max(...measurement.samples.map((sample) => sample.currentTime));
  await stage.screenshot({ path: path.join(EVIDENCE_DIR, "c3-play-movie-stage.png") });
  await writeJson("c3-play-movie-measurement.json", {
    wiring: { stage: "play-movie-preview-stage", video: "play-movie-preview-video", src: measurement.currentSrc },
    measuredAdvanceSeconds: advance,
    decoded: advance > 0,
    measurement,
    console: logs,
    verdict:
      advance > 0
        ? "번들 샘플이 실제로 디코딩되어 재생 시간이 전진했다."
        : "번들 샘플이 디코딩되지 않아 currentTime 이 전진하지 않았다 — defects.md 의 sample-risk 항목 참조.",
  });

  // 계약은 배선이다: 표시면 안에 진짜 <video> 가 샘플 클립을 물고 있어야 한다.
  // 번들 샘플의 디코딩 여부는 위 JSON 과 defects.md 에 정직하게 남긴다(강제 통과 금지).
  await expect(body.getByTestId("play-movie-sample-note")).toBeVisible();
  expect(measurement.currentSrc).toContain("/assets/movies/sample-movie.webm");
});

test("C4 번들 샘플 클립과 기본 DB 생성 이펙트 애니메이션", async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  const sample = await page.request.get("/assets/movies/sample-movie.webm");
  const sampleBody = await sample.body();
  const sampleReport = {
    url: `${baseURL ?? ""}/assets/movies/sample-movie.webm`,
    status: sample.status(),
    contentType: sample.headers()["content-type"] ?? null,
    bytes: sampleBody.byteLength,
    sha256: createHash("sha256").update(sampleBody).digest("hex"),
    ebmlMagic: sampleBody.subarray(0, 4).toString("hex"),
  };

  // 기본 데이터베이스 확인은 유닛 방식이다 — 기본 DB 레코드 생성기를 그대로 불러 본다.
  const records = defaultBattleAnimationRecords();
  const generated = GENERATED_EFFECT_SHEETS.map((sheet) => {
    const record = records.find((entry) => entry.resourceId === `generated-battle-anim-${sheet.slug}`);
    return {
      slug: sheet.slug,
      name: sheet.name,
      expectedFrames: sheet.frameCount,
      recordId: record?.id ?? null,
      recordName: record?.name ?? null,
      frames: record?.frames?.length ?? 0,
      columns: record?.sheet?.columns ?? null,
    };
  });
  const missing = generated.filter((entry) => entry.recordId === null);
  const frameMismatch = generated.filter((entry) => entry.frames !== entry.expectedFrames);

  // 시트 아트도 실제로 서버에서 내려오는지 두 장 확인한다(가장 긴 12프레임 계열).
  const sheetProbes = [];
  for (const slug of ["meteor-fall", "arcane-nova"]) {
    const response = await page.request.get(`/assets/generated/effects/effect-${slug}.png`);
    sheetProbes.push({ slug, status: response.status(), bytes: (await response.body()).byteLength });
  }

  await writeJson("c4-sample-and-defaults.json", {
    sample: sampleReport,
    battleAnimationRecords: records.length,
    generatedEffectSheets: GENERATED_EFFECT_SHEETS.length,
    generated,
    missing,
    frameMismatch,
    sheetProbes,
  });

  expect(sampleReport.status).toBe(200);
  expect(sampleReport.bytes).toBeGreaterThan(0);
  expect(missing, "기본 DB 에 없는 생성 이펙트").toEqual([]);
  expect(frameMismatch, "프레임 수가 카탈로그와 다른 생성 이펙트").toEqual([]);
  for (const probe of sheetProbes) expect(probe.status, `${probe.slug} 시트`).toBe(200);
});

/** 커스텀 리스트박스(제품 UI)로 레코드를 고른다. 네이티브 select 는 aria-hidden 이라 직접 못 만진다. */
async function selectRecord(page: Page, scope: Locator, testid: string, label: string): Promise<void> {
  await scope.locator(`[data-custom-select-for="${testid}"]`).click();
  const popover = page.locator("[data-custom-select-popover]");
  await expect(popover).toBeVisible();
  const search = popover.locator(".event-custom-select-search");
  if ((await search.count()) > 0) await search.fill(label);
  await popover.getByRole("option", { name: label, exact: true }).click();
  await expect(popover).toHaveCount(0);
}

async function openShowAnimationBody(page: Page): Promise<Locator> {
  // blankProject=1 → 기본 데이터베이스(생성 이펙트 43개 포함). freshProject=1 은 예제 어드벤처
  // 픽스처를 실어서 애니메이션 레코드가 12개뿐이다(c4 리포트의 fixture 항목 참조).
  // freshProject 도 함께 붙여 웰컴/팀 워크플로 오버레이를 같은 규칙으로 끈다.
  await page.goto("/?blankProject=1&freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await openMapEventEditor(page);
  const picker = await openCommandPicker(page, "storyboard-cta");
  // 애니메이션(showAnimation)은 연출 탭에 있다. 탭 위치에 의존하지 않도록 전 탭 검색으로 집는다.
  await picker.getByTestId("event-command-picker-search").fill("애니메이션");
  const add = pickerGrid(picker).getByTestId("command-picker-add-showAnimation").first();
  await expect(add).toBeEnabled();
  await add.click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  const body = dialog.getByTestId("show-animation-command-body");
  await expect(body).toBeVisible();
  return body;
}


/** 프레임 셀에 걸린 시트 이미지 URL. 화면에 배경이 올라오기까지 상태를 폴링한다(66ms 마다 셀이 다시 그려진다). */
async function frameSheetUrl(layer: Locator): Promise<string> {
  const read = async (): Promise<string> =>
    layer.evaluate((node) => {
      const cell = (node as HTMLElement).querySelector<HTMLElement>('[data-testid="show-animation-frame-cell"]');
      return cell === null ? "" : getComputedStyle(cell).backgroundImage;
    });
  await expect.poll(async () => (await read()).slice(0, 4), { timeout: 15_000 }).toBe("url(");
  const raw = await read();
  return raw.replace(/^url\("?/, "").replace(/"?\)$/, "");
}

/** data URL 은 증거 JSON 에 통짜로 넣지 않는다 — 종류와 길이만 기록한다. */
function describeUrl(url: string): { readonly kind: string; readonly length: number; readonly head: string } {
  return {
    kind: url.startsWith("data:") ? "data-url(chroma-keyed)" : "http-url",
    length: url.length,
    head: url.slice(0, 64),
  };
}

/** 스테이지 스크린샷 1장 + 그 순간의 프레임 인덱스를 함께 기록한다. */
async function captureStage(
  stage: Locator,
  layer: Locator,
  file: string,
  atMs: number
): Promise<FrameShot> {
  const frameIndex = await layer.getAttribute("data-frame-index");
  const buffer = await stage.screenshot({ path: path.join(EVIDENCE_DIR, file) });
  return {
    file,
    frameIndex,
    atMs,
    bytes: buffer.byteLength,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

/** 표시면 표제로 기능하는 노드: 보이는 텍스트가 정확히 '애니메이션' 이거나 '애니메이션 표시' 로 시작. */
async function collectAnimationTitles(
  root: Locator
): Promise<readonly { readonly tag: string; readonly testid: string | null; readonly text: string }[]> {
  return root.evaluate((node) => {
    const matches: { tag: string; testid: string | null; text: string }[] = [];
    for (const element of Array.from((node as HTMLElement).querySelectorAll<HTMLElement>("*"))) {
      if (element.offsetParent === null && element.getClientRects().length === 0) continue;
      const text = (element.textContent ?? "").trim();
      if (text === "애니메이션" || text.startsWith("애니메이션 표시")) {
        matches.push({
          tag: element.tagName.toLowerCase(),
          testid: element.dataset.testid ?? null,
          text,
        });
      }
    }
    return matches;
  });
}

async function currentMapId(page: Page): Promise<string> {
  const mapId = await page.evaluate(() => (window as ToolWindow).__oprnRegionTaskHarness?.currentMapId() ?? null);
  expect(mapId, "현재 맵 id 를 읽지 못했다").not.toBeNull();
  return mapId as string;
}

/** 캔버스 중앙이 가리키는 타일. 하니스 커서 진단으로 실측한다(매직 픽셀 금지). */
async function centerTile(page: Page): Promise<{ readonly x: number; readonly y: number }> {
  await page.getByTestId("layer-event").click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.hover({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  const status = page.getByTestId("cursor-position");
  await expect(status).not.toHaveText("outside");
  const text = (await status.textContent()) ?? "";
  const [x, y] = text.split(",").map((part) => Number(part.trim()));
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error(`unexpected cursor position: ${text}`);
  return { x: x as number, y: y as number };
}

/** 중앙 타일에 있는 이벤트의 편집기를 연다(centerTile 로 재 좌표를 그대로 다시 쓴다). */
async function openEventEditorAt(page: Page, tile: { readonly x: number; readonly y: number }): Promise<Locator> {
  const visibleEventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await visibleEventTool.count()) > 0) await visibleEventTool.click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const center = { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) };
  await expect
    .poll(async () => {
      await canvas.hover({ position: center });
      const text = (await page.getByTestId("cursor-position").textContent()) ?? "";
      return text.split(",").map((part) => Number(part.trim()));
    })
    .toEqual([tile.x, tile.y]);
  await canvas.dblclick({ position: center });
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  return editor;
}

function attachConsole(page: Page): ConsoleRecord[] {
  const logs: ConsoleRecord[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      logs.push({ kind: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => logs.push({ kind: "pageerror", text: `${error.name}: ${error.message}` }));
  // 어떤 요소가 못 떨어지는지를 남긴다 — 러언 자산(/assets/…) 이뱌 난으면 제품 결함이다.
  page.on("requestfailed", (request) =>
    logs.push({ kind: "requestfailed", text: `${request.failure()?.errorText ?? "?"} ${request.url()}` })
  );
  return logs;
}

/** 네트워키 로드 실패를 끌 앨 코드 오류만 추린다. */
function appErrorLogs(logs: readonly ConsoleRecord[]): readonly ConsoleRecord[] {
  return logs.filter(
    (entry) => entry.kind === "error" && !entry.text.startsWith("Failed to load resource")
  );
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(path.join(EVIDENCE_DIR, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
