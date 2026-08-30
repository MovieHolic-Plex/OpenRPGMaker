// AI 조수 패널 **도달 가능성** 게이트.
//
// 판정 기준은 "기하가 넘쳤는가"가 아니라 **"사용자가 볼 수 있는가"** 다. 로그는 스크롤러이므로
// 자식이 로그 밖으로 넘치는 것은 정상이고, 스크롤로 도달하면 결함이 아니다. 그래서 각 요소를
// `scrollIntoView` 로 끌어온 뒤에도 여전히 조상 클리퍼(overflow hidden/clip)나 뷰포트 밖에
// 남아 있는 것만 잘림으로 센다.
//
// 실측으로 확인된 결함(수정 전, 2026-08-30):
//  - `pre/code` 블록이 폭 614px 로 자라 대화 열(260~418px)을 가로로 225~383px 넘어가고,
//    조상이 `overflow: hidden` 이라 가로 스크롤이 없어 **영구히 못 읽는다**.
//  - 이전 턴 그룹을 펼치면 툴 상세(`.ai-tool-detail`)가 그룹의 `overflow: hidden` 에
//    세로로 355px 잘린다 — 그룹은 스크롤러가 아니다.
//  - float 도크에서 전체 기록을 열면 패널이 뷰포트 아래로 49px 넘어가 하단이 창에 잘린다.
//
// 실행: DEV_SERVER_PORT=9841 npx playwright test test/e2e/ai-panel-reachability.spec.ts --project=chromium
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve("verify-shots/ai-panel-clip/reachability");
mkdirSync(OUT, { recursive: true });

/** 복원 조건: 저장된 `projectContextKey` 가 현재 프로젝트 스코프와 같아야 한다. */
const SEED_SCOPE = "local:이슬 장터 — 30분::map_village_30_100x100";

const SEED_CONVERSATION = {
  id: "conv-reachability",
  title: "도달 가능성 게이트",
  model: "gate/model",
  savedAt: Date.now(),
  entries: [
    {
      kind: "user",
      text: "이 마을 광장 남쪽에 상점 3채와 우물을 놓고, 북쪽 숲에서 마을로 이어지는 길을 깔아줘.",
      at: new Date().toISOString(),
    },
    {
      kind: "assistant",
      text: [
        "광장 남쪽에 상점 3채와 우물을 배치했습니다.",
        "",
        "```json",
        '{ "tool": "place_structure_cluster", "mapId": "map_village_30_100x100", "assets": 4 }',
        "```",
      ].join("\n"),
      at: new Date().toISOString(),
    },
    {
      kind: "tool",
      name: "analyze_map_tile_usage",
      args: { mapId: "map_village_30_100x100", includeUndescribed: true },
      ok: false,
      summary: "타일 설명 42/57 — 남은 15개는 설명이 없어 배치 근거로 쓰지 못했습니다.",
      issues: ["설명 없는 타일 15개: 12, 13, 44, 45, 46, 47, 88, 89, 90, 91, 120, 121, 122, 123, 124"],
      at: new Date().toISOString(),
    },
    { kind: "user", text: "길부터 깔아줘.", at: new Date().toISOString() },
    {
      kind: "assistant",
      text: [
        "북쪽 숲 입구에서 광장 북문까지 폭 2칸 길을 깔았습니다.",
        "[선택지] 상점 주인 NPC 대사 넣기 | 밤에 문 닫는 이벤트 만들기 | 아직 괜찮아",
      ].join("\n"),
      at: new Date().toISOString(),
    },
  ],
  projectContextKey: SEED_SCOPE,
} as const;

type Unreachable = {
  readonly selector: string;
  readonly blocker: string;
  readonly overflowPx: number;
  readonly axis: string;
  readonly text: string;
  /** 가장 가까운 스톤러와 그 포화 상황 — "스톤롤러가 없다" 와 "스톤롤이 부족하다" 를 가른다. */
  readonly scroller?: string;
};

async function boot(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.addInitScript((seed) => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.removeItem("oprn:ai-panel-collapsed");
    localStorage.setItem("oprn:ai-conversations", JSON.stringify([seed]));
  }, SEED_CONVERSATION);
  await page.goto("/?freshProject=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 8_000 }).catch(() => false)) await guest.click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
  const welcome = page.getByTestId("standard-welcome-start");
  if (await welcome.isVisible({ timeout: 4_000 }).catch(() => false)) await welcome.click();
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible({ timeout: 2_000 }).catch(() => false)) await restore.click();
  await page.getByTestId("ai-input").waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(() =>
    document.querySelectorAll("[data-testid^='ai-command-row']").length > 0, undefined, { timeout: 20_000 });
}

async function setDock(page: Page, dock: string): Promise<string> {
  for (let i = 0; i < 4; i += 1) {
    const current = await page.evaluate(() =>
      document.querySelector<HTMLElement>("[data-testid='ai-dock-mode-btn']")?.dataset.dockMode ?? "");
    if (current === dock) return current;
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("[data-testid='chat-dock-toggle']")?.click());
    await page.waitForFunction((want) =>
      document.querySelector<HTMLElement>("[data-testid='ai-dock-mode-btn']")?.dataset.dockMode !== want,
      current, { timeout: 4_000 }).catch(() => undefined);
  }
  return await page.evaluate(() =>
    document.querySelector<HTMLElement>("[data-testid='ai-dock-mode-btn']")?.dataset.dockMode ?? "?");
}

async function unfoldIfFolded(page: Page): Promise<void> {
  if (!(await page.evaluate(() => Boolean(document.querySelector(".ai-chat-panel.is-glass-folded"))))) return;
  await page.evaluate(() => document.querySelector<HTMLElement>("[data-testid='ai-collapse']")?.click());
  await page.waitForFunction(() => !document.querySelector(".ai-chat-panel.is-glass-folded"),
    undefined, { timeout: 4_000 }).catch(() => undefined);
}

async function unreachable(page: Page): Promise<readonly Unreachable[]> {
  return await page.evaluate(() => {
    const TOL = 2;
    const root = document.querySelector<HTMLElement>(".ai-chat-panel");
    if (!root) return [];
    const label = (node: Element): string => {
      const testid = (node as HTMLElement).dataset?.testid;
      const cls = node.className && typeof node.className === "string"
        ? `.${node.className.trim().split(/\s+/).slice(0, 2).join(".")}`
        : "";
      return `${node.tagName.toLowerCase()}${testid ? `[${testid}]` : ""}${cls}`;
    };
    const clips = (style: CSSStyleDeclaration, axis: "x" | "y"): boolean => {
      const value = axis === "x" ? style.overflowX : style.overflowY;
      return value === "hidden" || value === "clip";
    };
    const shown = (node: HTMLElement): boolean => {
      const s = getComputedStyle(node);
      return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) !== 0
        && node.offsetWidth > 0 && node.offsetHeight > 0;
    };
    /** 접힘/투명 조상 안쪽은 판정하지 않는다(의도된 축소이지 잘림이 아니다). */
    const hidden = (node: HTMLElement): boolean => {
      // 접힌 `<details>` 속은 사용자가 안 펼친 것이니 잡림이 아니다. Chromium 은 이때 UA
      // `::details-content` 를 `content-visibility: hidden` 으로 건너뚰는데, 그 속 자식은
      // display:none 처럼 사라지지 않고 **버려진 기하**를 그대로 되돌려준다 — 실측:
      // 접힌 `.ai-tool-failure`(110px) 안의 `.ai-tool-detail` 이 344px 로 잡혀 부모보다 훨짱
      // 큼 가짜 잡림 12건을 만들었다. 판정에서 제외한다.
      if (node.closest("details:not([open])")) return true;
      for (let cursor: HTMLElement | null = node; cursor; cursor = cursor.parentElement) {
        const s = getComputedStyle(cursor);
        if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return true;
        if (s.contentVisibility === "hidden") return true;
        if (cursor !== node && cursor.clientHeight === 0 && s.overflowY !== "visible") return true;
        if (cursor === document.body) break;
      }
      return false;
    };

    const CANDIDATES = [
      "button", "a[href]", "textarea", "input", "select",
      ".ai-command-row-body", ".md", "pre", "code", ".ai-tool-detail", ".ai-tool-activity-line",
      ".ai-quick-reply-chip", ".ai-change-card", ".ai-turn-group-toggle",
    ].join(",");
    const targets = [...root.querySelectorAll<HTMLElement>(CANDIDATES)]
      .filter((node) => shown(node) && !hidden(node));

    /**
     * 요소를 스톤롤로 끌어온다. `scrollIntoView` 를 샨다 — 그것은 어떤 스톤로포트를
     * 얼마만큼 움질지를 부라우서 헴리스틱으로 정하고(실측: 로그가 550px 더 움질 수
     * 있는데 scrollTop=58 에서 멈추고 요소가 186px 밖에 남았다), 게이트가 그 헴리스틱을
     * 검사하면 제품 결함과 분간이 안 된다. 지금은 사용자가 할 수 있는 일만 한다:
     * 조상 스톤러를 살짝 안쪽부터 밖으로 한 칸씩 움진다.
     */
    const bringIntoView = (node: HTMLElement): void => {
      for (let cursor = node.parentElement; cursor; cursor = cursor.parentElement) {
        const s = getComputedStyle(cursor);
        const scrolls = /auto|scroll/u.test(`${s.overflowX}${s.overflowY}`);
        if (scrolls) {
          const box = cursor.getBoundingClientRect();
          const rect = node.getBoundingClientRect();
          if (rect.bottom > box.bottom) cursor.scrollTop += rect.bottom - box.bottom;
          else if (rect.top < box.top) cursor.scrollTop -= box.top - rect.top;
          if (rect.right > box.right) cursor.scrollLeft += rect.right - box.right;
          else if (rect.left < box.left) cursor.scrollLeft -= box.left - rect.left;
        }
        if (cursor === document.body) break;
      }
    };

    const hits: Unreachable[] = [];
    // 판정은 스톤을 움직이므로 끝나면 원래 자리로 되돌린다 — 그러지 않으면 이후의 상태와
    // 증거 스톤샷이 사용자가 보는 화면이 아니게 된다.
    const scrollMemo = [...document.querySelectorAll<HTMLElement>("*")]
      .filter((node) => node.scrollTop !== 0 || node.scrollLeft !== 0)
      .map((node) => ({ node, top: node.scrollTop, left: node.scrollLeft }));
    for (const node of targets) {
      bringIntoView(node);
      const rect = node.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) continue;
      let worst: Unreachable | null = null;
      const scrollerInfo = ((): string => {
        for (let cursor = node.parentElement; cursor; cursor = cursor.parentElement) {
          const s = getComputedStyle(cursor);
          const scrolls = /auto|scroll/u.test(`${s.overflowX}${s.overflowY}`);
          if (scrolls) {
            return `${label(cursor)} client=${cursor.clientHeight} scroll=${cursor.scrollHeight} top=${Math.round(cursor.scrollTop)}`;
          }
          if (cursor === document.body) break;
        }
        return "none";
      })();
      const record = (blocker: string, over: number, axis: string): void => {
        if (over <= TOL) return;
        if (worst && worst.overflowPx >= over) return;
        worst = {
          selector: label(node), blocker, overflowPx: Math.round(over), axis,
          text: (node.textContent ?? "").trim().replace(/\s+/gu, " ").slice(0, 50),
          scroller: scrollerInfo,
        };
      };
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const s = getComputedStyle(parent);
        const clipX = clips(s, "x");
        const clipY = clips(s, "y");
        if (clipX || clipY) {
          const box = parent.getBoundingClientRect();
          if (clipX) record(label(parent), Math.max(box.left - rect.left, rect.right - box.right), "x");
          if (clipY) record(label(parent), Math.max(box.top - rect.top, rect.bottom - box.bottom), "y");
        }
        if (parent === document.body) break;
      }
      record("viewport", Math.max(-rect.left, rect.right - window.innerWidth), "x");
      record("viewport", Math.max(-rect.top, rect.bottom - window.innerHeight), "y");
      if (worst) hits.push(worst);
    }
    for (const node of document.querySelectorAll<HTMLElement>("*")) {
      if (node.scrollTop !== 0) node.scrollTop = 0;
      if (node.scrollLeft !== 0) node.scrollLeft = 0;
    }
    for (const memo of scrollMemo) {
      memo.node.scrollTop = memo.top;
      memo.node.scrollLeft = memo.left;
    }
    return hits;
  });
}

async function click(page: Page, testid: string): Promise<void> {
  await page.evaluate((id) =>
    document.querySelector<HTMLElement>(`[data-testid='${id}']`)?.click(), testid);
}

/**
 * 대화 열은 **가로로 밀리지 않는다**. 로그가 가로로 스크롤되면 긴 자료(코드 블록 등) 하나
 * 때문에 모든 말풍선이 같이 옆으로 밀리고, 사용자는 자기 글이 사라진 것으로 본다.
 * 넘치는 자료는 자기 스크롤러를 가져야 하며(예: `pre { overflow-x: auto }`) 열은 그대로 둔다.
 */
async function horizontalDrift(page: Page): Promise<readonly string[]> {
  return await page.evaluate(() => {
    const drifts: string[] = [];
    for (const log of document.querySelectorAll<HTMLElement>("[data-testid='ai-chat-log']")) {
      if (log.scrollWidth <= log.clientWidth + 2) continue;
      let widest: { sel: string; width: number } | null = null;
      for (const node of log.querySelectorAll<HTMLElement>("*")) {
        const width = Math.max(node.scrollWidth, Math.round(node.getBoundingClientRect().width));
        if (width <= log.clientWidth) continue;
        const style = getComputedStyle(node);
        if (/auto|scroll/u.test(style.overflowX)) continue; // 자기 스크롤러는 정당하다.
        if (!widest || width > widest.width) {
          widest = {
            sel: `${node.tagName.toLowerCase()}${node.dataset.testid ? `[${node.dataset.testid}]` : ""}.${typeof node.className === "string" ? node.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`,
            width,
          };
        }
      }
      drifts.push(`log client=${log.clientWidth} scroll=${log.scrollWidth} widest=${widest ? `${widest.sel} ${widest.width}px` : "(자기 스크롤러만)"}`);
    }
    return drifts;
  });
}

/**
 * 대화 본문은 **줄 폭을 다 쓴다**. 잘림·밀림이 아니라 *눌림*으로도 글은 못 읽게 된다 —
 * 실측 스크린샷에서 마지막 답변 본문이 오른쪽 끝 14px 칸에서 한 글자씩 세로로 쓰이고 있었고,
 * 원인은 [선택지] 칩이 두 칸 그리드의 1열로 자동 배치돼 `minmax(0, 1fr)` 본문 칸을 0px 로
 * 밀어낸 것이었다(본문 rect 0×485). 스크롤로는 복구되지 않으므로 별도 계약으로 못 박는다.
 */
async function squeezed(page: Page): Promise<readonly string[]> {
  return await page.evaluate(() => {
    const hits: string[] = [];
    for (const body of document.querySelectorAll<HTMLElement>(".ai-chat-log .ai-command-row-body")) {
      const text = (body.textContent ?? "").trim();
      if (text.length < 8) continue;
      const row = body.closest<HTMLElement>(".ai-command-row");
      const rowWidth = row?.getBoundingClientRect().width ?? 0;
      if (rowWidth < 80) continue; // 접힌/숨은 줄은 판정하지 않는다.
      const width = body.getBoundingClientRect().width;
      if (width >= rowWidth * 0.5) continue;
      hits.push(`본문 ${Math.round(width)}px / 줄 ${Math.round(rowWidth)}px :: ${text.slice(0, 24)}`);
    }
    return hits;
  });
}

const VIEWPORTS = [
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1024x768", width: 1024, height: 768 },
] as const;

test("조수 패널의 어떤 요소도 스크롤 후에 잘려 남지 않는다", async ({ page }) => {
  test.setTimeout(600_000);
  const report: Record<string, readonly Unreachable[]> = {};
  const drift: Record<string, readonly string[]> = {};
  const squeeze: Record<string, readonly string[]> = {};
  for (const viewport of VIEWPORTS) {
    await boot(page, viewport.width, viewport.height);
    for (const dock of ["side", "float", "glass"] as const) {
      const applied = await setDock(page, dock);
      await unfoldIfFolded(page);

      // 스크린샷은 **판정 전에** 찍는다 — 판정은 조상 스크롤러를 전부 움직이므로 그 뒤의 화면은
      // 사용자가 보는 상태가 아니다(실측: 판정 후 화면은 로그가 끝까지 스크롤된 모습이었다).
      if (viewport.name === "1280x800") {
        await page.screenshot({ path: path.join(OUT, `${applied}-1-restored.png`) });
      }
      report[`${viewport.name}/${applied}/restored`] = await unreachable(page);
      drift[`${viewport.name}/${applied}/restored`] = await horizontalDrift(page);
      squeeze[`${viewport.name}/${applied}/restored`] = await squeezed(page);

      await click(page, "ai-turn-group-toggle");
      await page.evaluate(() => {
        for (const node of document.querySelectorAll<HTMLElement>(".ai-tool-activity-toggle")) node.click();
      });
      if (viewport.name === "1280x800") {
        await page.screenshot({ path: path.join(OUT, `${applied}-2-expanded.png`) });
      }
      report[`${viewport.name}/${applied}/expanded`] = await unreachable(page);
      drift[`${viewport.name}/${applied}/expanded`] = await horizontalDrift(page);
      squeeze[`${viewport.name}/${applied}/expanded`] = await squeezed(page);
      if (viewport.name === "1280x800") {
        await page.screenshot({ path: path.join(OUT, `${applied}-3-after-probe.png`) });
      }

      await click(page, "ai-dock-toggle");
      if (viewport.name === "1280x800") {
        await page.screenshot({ path: path.join(OUT, `${applied}-4-history.png`) });
      }
      report[`${viewport.name}/${applied}/history`] = await unreachable(page);
      await click(page, "ai-dock-toggle");
    }
  }
  writeFileSync(path.join(OUT, "reachability.json"), JSON.stringify({ report, drift, squeeze }, null, 2));
  const failures = Object.entries(report).flatMap(([key, hits]) =>
    hits.map((hit) => `${key}: ${hit.selector} +${hit.overflowPx}px ${hit.axis} blocked by ${hit.blocker} [scroller: ${hit.scroller ?? "?"}] :: ${hit.text}`));
  const drifts = Object.entries(drift).flatMap(([key, lines]) => lines.map((line) => `${key}: ${line}`));
  // eslint-disable-next-line no-console
  console.log(failures.length === 0 ? "[reach] 잘림 0건" : `[reach] 잘림 ${failures.length}건\n${failures.join("\n")}`);
  // eslint-disable-next-line no-console
  console.log(drifts.length === 0 ? "[reach] 가로 밀림 0건" : `[reach] 가로 밀림 ${drifts.length}건\n${drifts.join("\n")}`);
  const squeezes = Object.entries(squeeze).flatMap(([key, lines]) => lines.map((line) => `${key}: ${line}`));
  // eslint-disable-next-line no-console
  console.log(squeezes.length === 0 ? "[reach] 본문 눌림 0건" : `[reach] 본문 눌림 ${squeezes.length}건\n${squeezes.join("\n")}`);
  expect(failures, failures.join("\n")).toEqual([]);
  expect(drifts, drifts.join("\n")).toEqual([]);
  expect(squeezes, squeezes.join("\n")).toEqual([]);
});
