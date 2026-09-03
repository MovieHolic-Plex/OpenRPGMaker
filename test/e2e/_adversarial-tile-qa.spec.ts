/**
 * 진단 전용(`_` 접두): AI 조수 「타일 까는 작업」 적대적 리뷰 — 실제 모델로 문장을 하나씩 채팅 UI(ai-input/ai-send)로
 * 보내고, 턴이 끝날 때마다 맵 델타(레이어별 변경 칸 · 선택 영역 안/밖 · 통행성 · 시작 위치 보호)·툴 호출·상태 문구·
 * 스크린샷(전체/캔버스/패널/변경 영역 확대)을 /tmp/adv-tile-qa/ 에 남긴다. 판정은 스펙이 아니라 사람이 한다(항상 pass).
 *
 *   DEV_SERVER_PORT=9851 E2E_RETRIES=0 npx playwright test test/e2e/_adversarial-tile-qa.spec.ts \
 *     --project=chromium --workers=1 --reporter=line
 *   ONLY=region-water,explicit-road  → 일부 케이스만
 */
import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";

const OUT = process.env.ADV_OUT ?? "/tmp/adv-tile-qa";
mkdirSync(OUT, { recursive: true });
const LOG = `${OUT}/_log.txt`;
const TURN_BUDGET_MS = Number(process.env.TURN_BUDGET_MS ?? 360_000);
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",").map((s) => s.trim())) : null;
const TILE = 16;

type Region = { x: number; y: number; width: number; height: number };
type Snap = {
  mapId: string; name: string; width: number; height: number; tilesetId: string;
  lower: number[]; upper: number[];
  startMapId: string; startPos: { x: number; y: number } | null;
  events: { id: string; name: string; x: number; y: number }[];
  mapIds: string[];
};
type Visible = { x: number; y: number; w: number; h: number } | null;
type AuditEntry = Record<string, unknown> & { kind: string; text?: string; name?: string; ok?: boolean; summary?: string; args?: Record<string, unknown> };

function log(line: string): void {
  console.log(line);
  appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`, "utf8");
}

test.use({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, actionTimeout: 15_000 });

async function bootOnce(page: Page, kind: "fresh" | "blank"): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
  await page.goto(`/?${kind === "blank" ? "blankProject" : "freshProject"}=1`, { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 4_000 }).catch(() => false)) await guest.click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
  const start = page.getByTestId("standard-welcome-start");
  if (await start.isVisible().catch(() => false)) await start.click();
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await page.waitForFunction(
    () => {
      const w = window as unknown as Record<string, unknown>;
      return Boolean(w.__oprnAiBridge && w.__oprnRegionTaskHarness && w.__oprnProjectE2E && w.__oprnEditVisibleArea)
        && document.querySelector("[data-testid='edit-canvas'] canvas") !== null;
    },
    null,
    { timeout: 90_000 },
  );
  await page.getByTestId("ai-input").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(2_000);
}

async function boot(page: Page, kind: "fresh" | "blank"): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await bootOnce(page, kind);
      return;
    } catch (error) {
      lastError = error;
      log(`  boot attempt ${attempt} failed: ${String(error).slice(0, 160)}`);
      await page.waitForTimeout(2_000);
    }
  }
  throw lastError;
}

async function snap(page: Page): Promise<Snap> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __oprnProjectE2E: { currentProject: () => { project: Record<string, unknown> } };
      __oprnRegionTaskHarness: { currentMapId: () => string };
    };
    const project = w.__oprnProjectE2E.currentProject().project as {
      startMapId: string; startPos?: { x: number; y: number };
      maps: Record<string, { name: string; width: number; height: number; tilesetId: string; lowerTiles: number[]; upperTiles: number[]; events: { id: string; name?: string; x: number; y: number }[] }>;
    };
    const mapId = w.__oprnRegionTaskHarness.currentMapId();
    const map = project.maps[mapId];
    return {
      mapId, name: map.name, width: map.width, height: map.height, tilesetId: map.tilesetId,
      lower: Array.from(map.lowerTiles), upper: Array.from(map.upperTiles),
      startMapId: project.startMapId, startPos: project.startPos ?? null,
      events: map.events.map((e) => ({ id: e.id, name: e.name ?? "", x: e.x, y: e.y })),
      mapIds: Object.keys(project.maps),
    };
  });
}

async function visibleTiles(page: Page): Promise<Visible> {
  return page.evaluate((tile: number) => {
    const w = window as unknown as { __oprnEditVisibleArea: () => { worldView: { x: number; y: number; width: number; height: number } } | null };
    const area = w.__oprnEditVisibleArea();
    if (!area) return null;
    const v = area.worldView;
    return { x: Math.ceil(v.x / tile), y: Math.ceil(v.y / tile), w: Math.floor(v.width / tile), h: Math.floor(v.height / tile) };
  }, TILE);
}

async function setSelection(page: Page, region: Region | null, mapId: string): Promise<boolean> {
  await page.evaluate(({ region, mapId }) => {
    const w = window as unknown as { __oprnRegionTaskHarness: { setSelection: (s: unknown) => void } };
    w.__oprnRegionTaskHarness.setSelection(region ? { mapId, ...region } : null);
  }, { region, mapId });
  if (!region) return false;
  await page.waitForTimeout(600);
  return page.getByTestId("ai-selection-chip").isVisible({ timeout: 3_000 }).catch(() => false);
}

/** 칩 DOM 존재 여부와 실제 표시 상태를 따로 잰다 — display:none 이면 "있지만 안 보임". */
async function chipState(page: Page): Promise<{ inDom: number; visible: boolean; hostDisplay: string | null; text: string | null }> {
  return page.evaluate(() => {
    const chips = document.querySelectorAll("[data-testid='ai-selection-chip']");
    const host = document.querySelector("[data-testid='ai-context-chips']") as HTMLElement | null;
    const first = chips[0] as HTMLElement | undefined;
    const rect = first?.getBoundingClientRect();
    return {
      inDom: chips.length,
      visible: Boolean(rect && rect.width > 0 && rect.height > 0),
      hostDisplay: host ? getComputedStyle(host).display : null,
      text: first?.textContent ?? null,
    };
  });
}

async function passable(page: Page, mapId: string, area: { x: number; y: number; w: number; h: number }): Promise<number | null> {
  return page.evaluate(({ mapId, area }) => {
    const w = window as unknown as { __oprnRegionTaskHarness: { passableCount: (m: string, a: unknown) => number | null } };
    return w.__oprnRegionTaskHarness.passableCount(mapId, area);
  }, { mapId, area });
}

/** 턴 종료 = turnBusy false + 중단/정지 버튼 모두 안 보임이 3초 지속. 자율 런은 라운드 사이에 잠깐 idle 로 보일 수 있다. */
async function sendViaUi(page: Page, text: string): Promise<{ elapsedMs: number; audit: AuditEntry[]; statuses: string[]; timedOut: boolean }> {
  const auditBefore = await page.evaluate(() => (window as unknown as { __oprnAiBridge: { audit: () => unknown[] } }).__oprnAiBridge.audit().length);
  const input = page.getByTestId("ai-input");
  await input.click();
  await input.fill(text);
  await page.getByTestId("ai-send").click();
  const started = Date.now();
  const statuses: string[] = [];
  let idleSince: number | null = null;
  let timedOut = true;
  let lastBeat = Date.now();
  await page.waitForTimeout(1_500);
  while (Date.now() - started < TURN_BUDGET_MS) {
    if (Date.now() - lastBeat > 20_000) { lastBeat = Date.now(); log(`    …${Math.round((Date.now() - started) / 1000)}s`); }
    const st = await page.evaluate(() => (window as unknown as { __oprnAiBridge: { status: () => { turnBusy: boolean; lastStatus: string } } }).__oprnAiBridge.status());
    if (st.lastStatus && statuses[statuses.length - 1] !== st.lastStatus) {
      statuses.push(st.lastStatus);
      log(`    status: ${st.lastStatus.slice(0, 110)}`);
    }
    const stopVisible = await page.getByTestId("ai-run-stop").first().isVisible().catch(() => false);
    const abortVisible = await page.getByTestId("ai-abort").first().isVisible().catch(() => false);
    const idle = !st.turnBusy && !stopVisible && !abortVisible;
    if (idle) {
      idleSince ??= Date.now();
      if (Date.now() - idleSince >= 3_000) { timedOut = false; break; }
    } else {
      idleSince = null;
    }
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(1_200);
  const audit = await page.evaluate((from: number) => (window as unknown as { __oprnAiBridge: { audit: () => unknown[] } }).__oprnAiBridge.audit().slice(from), auditBefore) as AuditEntry[];
  return { elapsedMs: Date.now() - started, audit, statuses, timedOut };
}

type Change = { layer: "lower" | "upper"; x: number; y: number; from: number; to: number; inside: boolean | null };
function diffSnaps(before: Snap, after: Snap, region: Region | null): { changes: Change[]; summary: Record<string, unknown> } {
  const changes: Change[] = [];
  if (before.mapId !== after.mapId || before.width !== after.width || before.height !== after.height) {
    return { changes, summary: { note: "map identity/size changed", before: `${before.mapId} ${before.width}x${before.height}`, after: `${after.mapId} ${after.width}x${after.height}` } };
  }
  const inRegion = (x: number, y: number): boolean | null =>
    region ? x >= region.x && y >= region.y && x < region.x + region.width && y < region.y + region.height : null;
  for (const layer of ["lower", "upper"] as const) {
    const b = before[layer];
    const a = after[layer];
    for (let i = 0; i < b.length; i += 1) {
      if (b[i] !== a[i]) {
        const x = i % before.width;
        const y = Math.floor(i / before.width);
        changes.push({ layer, x, y, from: b[i], to: a[i], inside: inRegion(x, y) });
      }
    }
  }
  const hist: Record<string, number> = {};
  for (const c of changes) hist[`${c.layer}:${c.to}`] = (hist[`${c.layer}:${c.to}`] ?? 0) + 1;
  const xs = changes.map((c) => c.x);
  const ys = changes.map((c) => c.y);
  const bbox = changes.length
    ? { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 }
    : null;
  return {
    changes,
    summary: {
      total: changes.length,
      lower: changes.filter((c) => c.layer === "lower").length,
      upper: changes.filter((c) => c.layer === "upper").length,
      inside: region ? changes.filter((c) => c.inside).length : null,
      outside: region ? changes.filter((c) => c.inside === false).length : null,
      regionCells: region ? region.width * region.height : null,
      upperCleared: changes.filter((c) => c.layer === "upper" && c.to === -1).length,
      distinctTiles: Object.keys(hist).length,
      hist,
      bbox,
    },
  };
}

function fourConnected(cells: { x: number; y: number }[]): boolean {
  if (cells.length === 0) return true;
  const key = (x: number, y: number): string => `${x},${y}`;
  const set = new Set(cells.map((c) => key(c.x, c.y)));
  const seen = new Set<string>([key(cells[0].x, cells[0].y)]);
  const stack = [cells[0]];
  while (stack.length) {
    const c = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = key(c.x + dx, c.y + dy);
      if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push({ x: c.x + dx, y: c.y + dy }); }
    }
  }
  return seen.size === set.size;
}

async function box(page: Page, testId: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const loc = page.getByTestId(testId).first();
  if ((await loc.count()) === 0) return null;
  return loc.boundingBox({ timeout: 3_000 }).catch(() => null);
}

function union(a: { x: number; y: number; width: number; height: number } | null, b: { x: number; y: number; width: number; height: number } | null) {
  if (!a) return b; if (!b) return a;
  const x = Math.min(a.x, b.x); const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

async function shots(page: Page, prefix: string, bbox: { x: number; y: number; w: number; h: number } | null): Promise<void> {
  await page.screenshot({ path: `${prefix}-full.png` });
  const canvas = await box(page, "edit-canvas");
  if (canvas) await page.screenshot({ path: `${prefix}-canvas.png`, clip: canvas });
  const logBox = (await box(page, "ai-chat-log")) ?? (await box(page, "ai-glass-log"));
  const composer = await box(page, "ai-composer");
  const panel = union(logBox && logBox.height > 0 ? logBox : null, composer);
  if (panel && panel.width > 0 && panel.height > 0) {
    const clip = { x: Math.max(0, panel.x - 8), y: Math.max(0, panel.y - 8), width: Math.min(1600 - Math.max(0, panel.x - 8), panel.width + 16), height: Math.min(1000 - Math.max(0, panel.y - 8), panel.height + 16) };
    await page.screenshot({ path: `${prefix}-panel.png`, clip });
  }
  if (bbox && canvas) {
    const rect = await page.evaluate(({ bbox, tile }) => {
      const w = window as unknown as { __oprnEditWorldToClient: (x: number, y: number) => { x: number; y: number } };
      const a = w.__oprnEditWorldToClient(bbox.x * tile, bbox.y * tile);
      const b = w.__oprnEditWorldToClient((bbox.x + bbox.w) * tile, (bbox.y + bbox.h) * tile);
      return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    }, { bbox, tile: TILE });
    const pad = 48;
    const x0 = Math.max(canvas.x, rect.x - pad);
    const y0 = Math.max(canvas.y, rect.y - pad);
    const x1 = Math.min(canvas.x + canvas.width, rect.x + rect.w + pad);
    const y1 = Math.min(canvas.y + canvas.height, rect.y + rect.h + pad);
    if (x1 - x0 > 8 && y1 - y0 > 8) await page.screenshot({ path: `${prefix}-zoom.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  }
}

type Case = {
  id: string;
  boot: "fresh" | "blank";
  title: string;
  /** 선택 영역(있으면 채팅 칩으로 붙는다). 보이는 화면 안에서 계산한다. */
  selection?: (snap: Snap, vis: Visible) => Region | null;
  /** 선택 후 칩의 × 를 눌러 스코프를 해제한다(알려진 결함 재현). */
  clearChipBefore?: boolean;
  prompt: (snap: Snap, vis: Visible, region: Region | null) => string;
  /** 첫 턴이 0칸 변경(되묻기)로 끝나면 보낼 후속 문장. */
  followUp?: string;
  /** 턴 뒤 되돌리기 버튼을 눌러 원복을 잰다. */
  undoAfter?: boolean;
  expect: string;
};

function center(vis: Visible, snap: Snap, w: number, h: number, fx = 0.32, fy = 0.35): Region {
  const vx = vis?.x ?? 0; const vy = vis?.y ?? 0;
  const vw = vis?.w ?? snap.width; const vh = vis?.h ?? snap.height;
  const x = Math.max(1, Math.min(snap.width - w - 1, Math.floor(vx + vw * fx)));
  const y = Math.max(1, Math.min(snap.height - h - 1, Math.floor(vy + vh * fy)));
  return { x, y, width: w, height: h };
}

/** 보이는 화면 안에서 상위 레이어 소품이 가장 많은 w×h 창. */
function densestUpper(snap: Snap, vis: Visible, w: number, h: number): Region {
  const vx = vis?.x ?? 0; const vy = vis?.y ?? 0;
  const vw = Math.min(vis?.w ?? snap.width, snap.width - vx); const vh = Math.min(vis?.h ?? snap.height, snap.height - vy);
  let best = { x: vx + 1, y: vy + 1, score: -1 };
  for (let y = vy + 1; y + h < vy + vh - 1; y += 1) {
    for (let x = vx + 1; x + w < vx + vw - 1; x += 1) {
      let score = 0;
      for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) if (snap.upper[yy * snap.width + xx] !== -1) score += 1;
      if (score > best.score) best = { x, y, score };
    }
  }
  return { x: best.x, y: best.y, width: w, height: h };
}

const CASES: Case[] = [
  {
    id: "no-target-stone", boot: "fresh", title: "위치 없는 요청",
    prompt: () => "돌바닥 3x3 깔아줘",
    followUp: "시작 위치 바로 오른쪽에",
    expect: "위치를 되묻거나, 어디에 깔았는지 명시. 시작 위치·이벤트 위 무단 덮기 금지.",
  },
  {
    id: "region-water", boot: "fresh", title: "선택 영역 물 채우기 — 경계 정확성",
    selection: (s, v) => center(v, s, 6, 5),
    prompt: () => "이 영역 물로 채워줘",
    expect: "영역 밖 0칸, 영역 안 대부분 물, 해안 오토타일 다양성>1, 영역 안 통행 0.",
  },
  {
    id: "region-round-pond", boot: "fresh", title: "둥근 연못 — shape=circle",
    selection: (s, v) => center(v, s, 9, 9, 0.5, 0.3),
    prompt: () => "여기에 둥근 연못 파줘",
    expect: "네 귓 칸은 그대로(원형), 중앙은 물, 밖 0칸.",
  },
  {
    id: "explicit-road", boot: "fresh", title: "좌표 명시 직선 흙길",
    prompt: (s, v) => {
      const r = center(v, s, 10, 1, 0.2, 0.55);
      return `(${r.x},${r.y}) 에서 (${r.x + 9},${r.y}) 까지 흙길 깔아줘`;
    },
    expect: "y 고정 10칸 연속 변경, 그 줄 ±1 밖 변경 0(오토타일 이웃 제외).",
  },
  {
    id: "blank-stone-floor", boot: "blank", title: "빈 프로젝트 — 없는 재료(돌바닥)",
    prompt: () => "맵 전체를 돌바닥으로 바꿔줘",
    expect: "재료 없음을 정직하게 알리고 대안 제시. 실패 툴 반복 ≤3.",
  },
  {
    id: "flood-around-start", boot: "fresh", title: "시작 위치 주변 물 — 가둠 방지",
    prompt: (s) => s.startPos ? `시작 위치 (${s.startPos.x},${s.startPos.y}) 주변 5x5 를 물로 채워줘` : "시작 위치 주변 5x5 를 물로 채워줘",
    expect: "시작 칸 보호. 하지만 사방이 물이면 플레이어가 갇힌다 — 경고나 출구를 남겨야 한다.",
  },
  {
    id: "keep-trees-sand", boot: "fresh", title: "바닥만 모래로, 나무는 유지",
    selection: (s, v) => densestUpper(s, v, 8, 6),
    prompt: () => "이 영역 바닥을 모래로 바꿔줘. 나무는 그대로 두고",
    expect: "upper 변경 0(나무 보존), lower 만 바뀜, 밖 0칸.",
  },
  {
    id: "corner-pond-edge", boot: "fresh", title: "맵 가장자리 연못 — 범위 클램프",
    prompt: () => "맵 오른쪽 아래 구석에 10x10 연못 만들어줘",
    expect: "범위 밖 오류로 공회전하지 않고 클램프/조정. 가장자리 규칙 설명.",
  },
  {
    id: "invalid-tile-id", boot: "fresh", title: "잘못된 타일 id",
    prompt: () => "타일 id 99999 를 (3,3) 에 칠해줘",
    expect: "변경 0, 존재하지 않는 id 라고 알림. 다른 타일로 몰래 대체 금지.",
  },
  {
    id: "erase-all-undo", boot: "fresh", title: "맵 전부 지우기 → 되돌리기",
    prompt: () => "이 맵 타일 전부 지워줘",
    followUp: "응, 전부 지워",
    undoAfter: true,
    expect: "파괴적 작업은 확인 또는 명확한 되돌리기. 되돌리기 1회로 100% 원복.",
  },
  {
    id: "upper-flowers-only", boot: "fresh", title: "상위 레이어만(꽃) — 바닥 불변",
    selection: (s, v) => center(v, s, 8, 6, 0.55, 0.55),
    prompt: () => "여기 꽃 좀 뿌려줘. 바닥 타일은 건드리지 말고",
    expect: "lower 변경 0, upper 변경 >0, 밖 0칸.",
  },
  {
    id: "widen-path", boot: "fresh", title: "기존 길 넓히기",
    prompt: () => "기존 길을 1칸 더 넓혀줘",
    expect: "기존 길 옆으로만 확장(새 길 창작 금지). 시각으로 판정.",
  },
  {
    id: "chip-clear-scope", boot: "fresh", title: "칩 × 로 해제한 뒤 — 스코프 잔존 결함",
    selection: (s, v) => center(v, s, 6, 6, 0.6, 0.25),
    clearChipBefore: true,
    prompt: () => "나무 세 그루 심어줘",
    expect: "선택을 해제했으니 영역 제약 없이 심어야 한다. 옛 영역 안에만 몰리면 결함.",
  },
  {
    id: "walk-on-water", boot: "fresh", title: "모순 요청 — 물 위로 걷기",
    selection: (s, v) => center(v, s, 5, 5, 0.25, 0.6),
    prompt: () => "여기 물로 채우고 그 위로 걸어다닐 수 있게 해줘",
    expect: "되묻기 또는 다리/징검다리 제안. 물 타일 통행성을 몰래 바꾸면 결함.",
  },
  {
    id: "outside-selection-ref", boot: "fresh", title: "선택 영역 바깥을 지시 — 하드 클립 충돌",
    selection: (s, v) => center(v, s, 5, 5, 0.3, 0.3),
    prompt: () => "이 선택 영역 말고, 바로 오른쪽 옆에 같은 크기로 물 채워줘",
    expect: "클립으로 0칸이 되면 그 사실을 사용자에게 설명해야 한다. 조용한 0 변경은 결함.",
  },
  {
    id: "diagonal-road", boot: "fresh", title: "대각선 길 — 4방향 연결",
    prompt: (s, v) => {
      const r = center(v, s, 8, 8, 0.15, 0.15);
      return `(${r.x},${r.y}) 에서 (${r.x + 7},${r.y + 7}) 까지 대각선으로 흙길 깔아줘`;
    },
    expect: "길 칸 집합이 4방향으로 연결돼 실제로 걸을 수 있어야 한다.",
  },
];

test.describe("AI 조수 타일 작업 적대적 리뷰", () => {
  test.describe.configure({ timeout: 900_000 });
  const selected = CASES.filter((c) => !ONLY || ONLY.has(c.id));
  for (const [index, c] of selected.entries()) {
    const n = String(CASES.indexOf(c) + 1).padStart(2, "0");
    test(`${n}. ${c.id} — ${c.title}`, async ({ page }) => {
      test.setTimeout(900_000);
      const prefix = `${OUT}/${n}-${c.id}`;
      const consoleErrors: string[] = [];
      page.on("pageerror", (err) => consoleErrors.push(`PAGE ${String(err).slice(0, 200)}`));
      page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200)); });
      page.on("dialog", (dialog) => { void dialog.accept(); });

      const auth = await page.request.get("/auth/status").then((r) => r.json() as Promise<{ connected: boolean; provider: string }>);
      log(`[${n} ${c.id}] auth=${auth.connected} ${auth.provider}`);
      await boot(page, c.boot);
      const before = await snap(page);
      const vis = await visibleTiles(page);
      const region = c.selection ? c.selection(before, vis) : null;
      let chipVisible = false;
      let chipClearedOk: boolean | null = null;
      let chip: Awaited<ReturnType<typeof chipState>> | null = null;
      if (region) {
        chipVisible = await setSelection(page, region, before.mapId);
        chip = await chipState(page);
        if (c.clearChipBefore) {
          await page.getByTestId("ai-selection-chip-clear").click().catch(() => undefined);
          await page.waitForTimeout(500);
          chipClearedOk = !(await page.getByTestId("ai-selection-chip").isVisible().catch(() => false));
        }
      }
      const prompt = c.prompt(before, vis, region);
      log(`[${n} ${c.id}] map=${before.mapId} ${before.width}x${before.height} vis=${JSON.stringify(vis)} region=${JSON.stringify(region)} chip=${chipVisible} prompt="${prompt}"`);
      await page.waitForTimeout(400);
      await shots(page, `${prefix}-0before`, region ? { x: region.x, y: region.y, w: region.width, h: region.height } : null);

      const passArea = region
        ? { x: region.x, y: region.y, w: region.width, h: region.height }
        : before.startPos ? { x: before.startPos.x - 2, y: before.startPos.y - 2, w: 5, h: 5 } : { x: 0, y: 0, w: before.width, h: before.height };
      const passBefore = await passable(page, before.mapId, passArea);

      const turns: Array<Record<string, unknown>> = [];
      let after = before;
      let lastDiff = diffSnaps(before, before, region);
      const texts: string[] = [prompt];
      if (c.followUp) texts.push(c.followUp);
      for (const [ti, text] of texts.entries()) {
        if (ti > 0 && lastDiff.summary.total !== 0) break; // 첫 턴에 이미 변경이 있으면 후속 불필요
        const turn = await sendViaUi(page, text);
        after = await snap(page);
        lastDiff = diffSnaps(before, after, region);
        const tools = turn.audit.filter((e) => e.kind === "tool").map((e) => ({ name: e.name, ok: e.ok, summary: (e.summary ?? "").slice(0, 220), args: JSON.stringify(e.args ?? {}).slice(0, 260) }));
        const assistantTexts = turn.audit.filter((e) => e.kind === "assistant").map((e) => (e.text ?? "").slice(0, 700));
        const scopeNotes = turn.audit.filter((e) => /선택 영역|\[의도\]|intent:llm|scope/u.test(e.text ?? "")).map((e) => `${e.kind}: ${(e.text ?? "").slice(0, 300)}`);
        turns.push({
          text, elapsedMs: turn.elapsedMs, timedOut: turn.timedOut,
          llmCalls: assistantTexts.length, toolCalls: tools.length, failedTools: tools.filter((t) => !t.ok).length,
          toolNames: tools.map((t) => `${t.name}${t.ok ? "" : "✗"}`), tools,
          statuses: turn.statuses.slice(0, 40), assistantTexts, scopeNotes: scopeNotes.slice(0, 12),
          diffAfterThisTurn: lastDiff.summary,
        });
        log(`[${n} ${c.id}] turn${ti + 1} ${turn.elapsedMs}ms tools=${tools.length}(fail ${tools.filter((t) => !t.ok).length}) changes=${lastDiff.summary.total} inside=${lastDiff.summary.inside} outside=${lastDiff.summary.outside}${turn.timedOut ? " TIMEOUT" : ""}`);
        writeFileSync(`${prefix}-turn${ti + 1}.audit.json`, JSON.stringify(turn.audit, null, 2), "utf8");
      }
      const passAfter = await passable(page, before.mapId, passArea);
      const chatTail = await page.getByTestId("ai-chat-log").first().innerText({ timeout: 3_000 }).then((t) => t.slice(-900)).catch(() => null);
      const bbox = (lastDiff.summary.bbox as { x: number; y: number; w: number; h: number } | null) ?? (region ? { x: region.x, y: region.y, w: region.width, h: region.height } : null);
      await shots(page, `${prefix}-1after`, bbox);

      // 시작 위치 관련 판정
      const startInfo = before.startPos && before.startMapId === before.mapId ? (() => {
        const sp = before.startPos!;
        const idx = sp.y * before.width + sp.x;
        const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: sp.x + dx, y: sp.y + dy }))
          .filter((p) => p.x >= 0 && p.y >= 0 && p.x < before.width && p.y < before.height);
        return { startPos: sp, startCellChanged: before.lower[idx] !== after.lower[idx] || before.upper[idx] !== after.upper[idx], neighbours };
      })() : null;
      const startNeighbourPassable = startInfo
        ? await Promise.all(startInfo.neighbours.map((p) => passable(page, before.mapId, { x: p.x, y: p.y, w: 1, h: 1 })))
        : null;
      const eventsCovered = before.events.filter((e) => lastDiff.changes.some((ch) => ch.x === e.x && ch.y === e.y)).map((e) => `${e.name || e.id}@(${e.x},${e.y})`);
      const lowerCells = lastDiff.changes.filter((ch) => ch.layer === "lower").map((ch) => ({ x: ch.x, y: ch.y }));

      // 되돌리기 측정
      let undo: Record<string, unknown> | null = null;
      if (c.undoAfter && lastDiff.summary.total !== 0) {
        const candidates = ["ai-change-undo", "ai-undo-last", "ai-composer-undo", "ai-collapsed-undo"];
        let clicked: string | null = null;
        for (const tid of candidates) {
          const loc = page.getByTestId(tid).last();
          if (await loc.isVisible().catch(() => false)) { await loc.click(); clicked = tid; break; }
        }
        await page.waitForTimeout(1_500);
        const restored = await snap(page);
        const residual = diffSnaps(before, restored, region);
        undo = { clicked, residualChanges: residual.summary.total, fullyRestored: residual.summary.total === 0 };
        await shots(page, `${prefix}-2undo`, bbox);
        log(`[${n} ${c.id}] undo via ${clicked} residual=${residual.summary.total}`);
      }

      const result = {
        id: c.id, title: c.title, expect: c.expect, boot: c.boot, provider: auth.provider,
        map: { id: before.mapId, name: before.name, size: `${before.width}x${before.height}`, tileset: before.tilesetId, startPos: before.startPos, events: before.events.length },
        visibleTiles: vis, region, chipVisible, chip, chipClearedOk, prompt,
        turns,
        diff: lastDiff.summary,
        changedCells: lastDiff.changes.slice(0, 400),
        lowerFourConnected: fourConnected(lowerCells),
        passability: { area: passArea, before: passBefore, after: passAfter },
        start: startInfo ? { ...startInfo, neighbourPassableAfter: startNeighbourPassable } : null,
        eventsCovered,
        chatTail,
        mapsAfter: after.mapIds,
        undo,
        consoleErrors: consoleErrors.slice(0, 20),
      };
      writeFileSync(`${prefix}.json`, `${JSON.stringify(result, null, 2)}\n`, "utf8");
      log(`[${n} ${c.id}] done. index=${index}`);
    });
  }
});
