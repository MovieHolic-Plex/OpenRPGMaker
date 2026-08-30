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

const SEED_CONVERSATION_HEAD = {
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
      // 넓은 자료는 **지난 턴**에도 있어야 한다. 최신 턴에만 두면 `.ai-turn-group` 이
      // 다시 `overflow: hidden` 으로 회귀해도 E2E 가 못 잡는다 — 접히는 것은 지난 턴뿐이라
      // 판정 대상이 그룹 밖에 있게 된다(적대적 검토 지적). 그래서 여기에도 열보다 넓은
      // 코드 펜스와 표를 심는다.
      kind: "assistant",
      text: [
        "광장 남쪽에 상점 3채와 우물을 배치했습니다.",
        "",
        "```json",
        '{ "tool": "place_structure_cluster", "mapId": "map_village_30_100x100", "assets": 4, "anchors": ["plaza_south_gate", "well_center", "shop_row_east"] }',
        "```",
        "",
        "| 동 | 자리 | 크기 | 맞닿은 길 | 비고 |",
        "| --- | --- | --- | --- | --- |",
        "| shop_a | (24,22) | 3×3 | road_seg_2 | 광장 남서, 간판 동향 |",
        "| shop_b | (28,22) | 3×3 | road_seg_3 | 광장 남동, 우물과 1칸 |",
        "| well_a | (26,24) | 2×2 | road_seg_4 | 광장 정중앙 남쪽 |",
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
      // 넓은 표·긴 URL·긴 린트 덤프를 한 자리에 모은 메시지 — 적대적 리뷰가 짚은 "시드가 단일
      // 시나리오라 표/URL/작업기록이 판정에 안 들어온다"는 사각지대를 메운다. 긴 `pre` 는
      // `foldWorkLogs` 가 `details.ai-work-log` 로 갈아 넣으므로, 펼침 단계에서 그 details 까지
      // 열어야 비로소 판정 대상이 된다(아래 expandAll).
      kind: "assistant",
      text: [
        "배치 전 린트 결과입니다. 상세는 발간 보고서를 보십시오:",
        "https://example.invalid/rpg-zzu/reports/2026-08-30/layout-placement-validate/map_village_30_100x100/full-dump-with-a-very-long-unbreakable-path-segment.json",
        "",
        "| 항목 | 값 | 기준 | 범위 | 대상 | 처방 |",
        "| --- | --- | --- | --- | --- | --- |",
        "| 설명 없는 타일 | 15개 | 0개 | map_village_30_100x100 전역 | 12,13,44,45,46,47 | 설명 보강 |",
        "| 겹친 구조물 | 2동 | 0동 | 광장 남쪽 (24,20)~(31,27) | shop_b, well_a | 한 칸 밀기 |",
        "| 못 간 길 | 1군데 | 0군데 | 북문 (24,20) 앞 | road_seg_7 | 재포장 |",
        "",
        "```",
        "layoutPlacementValidate: map_village_30_100x100",
        "  warn  tree_count_zero        나무 0그루 — region 한정 보수로 전환함",
        "  warn  overlap_structure      shop_b(24,20) ∩ well_a(25,21) — 1칸 겹침",
        "  warn  unreachable_segment    road_seg_7(24,19) — 북문과 맞닿지 않음",
        "  info  tile_desc_missing      15개(12,13,44,45,46,47,88,89,90,91,120,121,122,123,124)",
        "  info  budget                 타일 42/57 설명 보유, 이벤트 20/32 사용",
        "```",
      ].join("\n"),
      at: new Date().toISOString(),
    },
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

/**
 * 시드가 짧으면 이 게이트는 **아무것도 못 잡는다**(2026-08-30 실측). 로그가 내용보다 크면
 * flex 압력이 없어 `.ai-turn-group` 의 `flex`/`overflow` 를 결함 상태로 되돌려도 그대로
 * 통과한다 — 원 결함(지난 턴이 10px 회색 띠로 눌림)은 **내용이 로그보다 길 때만** 난다.
 */
const PRESSURE_TURNS = Array.from({ length: 6 }, (_, index) => [
  {
    kind: "user" as const,
    text: `${index + 1}차 점검: 광장 남쪽 상점 줄과 북문 길을 다시 확인해줘.`,
    at: new Date().toISOString(),
  },
  {
    kind: "assistant" as const,
    text: [
      `${index + 1}차 점검 결과입니다. 상점 줄은 유지하고 길만 다시 깔았습니다.`,
      "",
      "```",
      `layoutPlacementValidate#${index + 1}: map_village_30_100x100`,
      "  info  road_repaved      road_seg_7 → 북문(24,20) 과 맞닿게 재포장",
      "  info  structure_kept    shop_a shop_b shop_c well_a — 좌표 변경 없음",
      "  warn  tile_desc_missing 15개(12,13,44,45,46,47,88,89,90,91,120,121,122,123,124)",
      "```",
    ].join("\n"),
    at: new Date().toISOString(),
  },
]).flat();

const SEED_CONVERSATION = {
  ...SEED_CONVERSATION_HEAD,
  entries: [...SEED_CONVERSATION_HEAD.entries, ...PRESSURE_TURNS],
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

/**
 * 대화 로그가 **실측 가능한 표면**을 가졌는지 본다. 이 게이트는 오래도록 float(로그 0x0)과
 * 접힌 glass(로그 452x14)를 재고 있었다 — 그 12개 상태는 통과가 아니라 **빈 통과**였다
 * (4차 적대적 검토 지적, 2026-08-30 실측).
 */
async function logSurface(page: Page): Promise<{ readonly width: number; readonly height: number }> {
  return page.evaluate(() => {
    const rect = document.querySelector<HTMLElement>(".ai-chat-log")?.getBoundingClientRect();
    return { width: Math.round(rect?.width ?? 0), height: Math.round(rect?.height ?? 0) };
  });
}

/** glass 는 기본이 접힘(fold)이다 — 셰브론이 그 도크에서는 fold 토글이므로 눌러 펼친다. */
async function unfoldGlass(page: Page): Promise<void> {
  const folded = await page.evaluate(() =>
    document.querySelector(".ai-chat-panel")?.classList.contains("is-glass-folded") === true);
  if (!folded) return;
  await page.evaluate(() => document.querySelector<HTMLElement>("[data-testid='ai-collapse']")?.click());
  await expect(page.locator(".ai-chat-panel.is-glass-folded")).toHaveCount(0);
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
        // 한 축만 0 인 요소(본문 0×485 같은 눌림)를 여기서 걸러 버리면 아래 두-축-작음
        // 판정이 죽은 코드가 된다 — 하나라도 살아 있으면 통과시키고 걸러내기는 그쪽에 맡긴다.
        && (node.offsetWidth > 0 || node.offsetHeight > 0);
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
     * 있는데 scrollTop=58 에서 멈추고 요소가 186px 밖에 남았다), 게이트가 그 휴리스틱을
     * 검사하면 제품 결함과 분간이 안 된다. 지금은 사용자가 할 수 있는 일만 한다:
     * 조상 스크롤러를 안쪽부터 밖으로 한 칸씩 직접 움직인다.
     */
    const scrollableX = (node: HTMLElement, style: CSSStyleDeclaration): boolean =>
      /auto|scroll/u.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1;
    const scrollableY = (node: HTMLElement, style: CSSStyleDeclaration): boolean =>
      /auto|scroll/u.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
    // 판정이 실제로 만진 스크롤러만 기억한다 — 문서 전체를 0 으로 밀면 맵 트리·팔레트가
    // 사용자가 보던 자리를 잃고 증거 스크린샷이 사용자 화면이 아니게 된다.
    const touched = new Map<HTMLElement, { top: number; left: number }>();
    const remember = (node: HTMLElement): void => {
      if (!touched.has(node)) touched.set(node, { top: node.scrollTop, left: node.scrollLeft });
    };
    /**
     * 어떤 스크롤러가 실제로 보여줄 수 있는 사각형은 자기 박스가 아니라, **자기 박스와 자기를
     * 자르는 모든 조상 박스의 교집합**이다. 실측(1024x768 side): 로그 박스는 아래로 더
     * 뻗어 있는데 `.ai-rising-overlay` 가 그 아래를 잘라, 로그 박스 기준으로 맞추면 요소가
     * 여전히 64px 가려진 채 "다 끌어왔다" 고 판정됐다 — 사용자는 더 스크롤할 수 있었다.
     */
    const visibleBox = (node: HTMLElement): { top: number; bottom: number; left: number; right: number } => {
      const r = node.getBoundingClientRect();
      let box = { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      for (let cursor = node.parentElement; cursor; cursor = cursor.parentElement) {
        const s = getComputedStyle(cursor);
        if (clips(s, "x") || clips(s, "y") || /auto|scroll/u.test(`${s.overflowX}${s.overflowY}`)) {
          const c = cursor.getBoundingClientRect();
          box = {
            top: Math.max(box.top, c.top),
            bottom: Math.min(box.bottom, c.bottom),
            left: Math.max(box.left, c.left),
            right: Math.min(box.right, c.right),
          };
        }
        if (cursor === document.body) break;
      }
      return box;
    };
    /**
     * 요소를 한 **가장자리** 기준으로 끌어온다. 왜 가장자리별인가: 요소가 보이는 영역보다
     * 크면(긴 답변 본문·펼친 실패 상세) 위아래를 동시에 보이게 할 수 없다 — 아래를 맞추면
     * 위가 나가고, 위를 맞추면 아래가 나간다. 한 함수로 둘을 다 맞추려 하면 두 패스가
     * 서로를 되돌리며 진동하고, 그 잔량이 "잘림" 으로 보고된다(실측: 11건 가짜 양성).
     * 사람은 그런 자료를 훑어 읽는다 — 그래서 판정도 "이 가장자리를 볼 수 있나" 를 따로 묻는다.
     */
    const align = (node: HTMLElement, edge: "start" | "end"): void => {
      // 두 번 돈다: 안쪽 스크롤러를 움직이면 바깥 스크롤러 기준 좌표가 바뀐다.
      for (let pass = 0; pass < 2; pass += 1) {
        for (let cursor = node.parentElement; cursor; cursor = cursor.parentElement) {
          const s = getComputedStyle(cursor);
          const box = visibleBox(cursor);
          const rect = node.getBoundingClientRect();
          // 축은 반드시 따로 본다. `overflow-x: hidden; overflow-y: auto` 를 한 불리언으로
          // 합치면 가로로 못 움직이는 상자에도 scrollLeft 를 쓰게 되는데 Chromium 은 그 쓰기를
          // 받아들인다 — 사용자가 절대 볼 수 없는 가로 잘림이 게이트에서 사라진다(가짜 음성).
          if (scrollableY(cursor, s)) {
            remember(cursor);
            if (edge === "end") { if (rect.bottom > box.bottom) cursor.scrollTop += rect.bottom - box.bottom; }
            else if (rect.top < box.top) cursor.scrollTop -= box.top - rect.top;
          }
          if (scrollableX(cursor, s)) {
            remember(cursor);
            if (edge === "end") { if (rect.right > box.right) cursor.scrollLeft += rect.right - box.right; }
            else if (rect.left < box.left) cursor.scrollLeft -= box.left - rect.left;
          }
          if (cursor === document.body) break;
        }
      }
    };

    const hits: Unreachable[] = [];
    for (const node of targets) {
      align(node, "end");
      // 두 축이 다 작을 때만 건너뛴다(장식용 1px 선 등). 한 축만 0 이면 그것이 바로 이 PR 이
      // 고친 눌림 계열이므로 반드시 재야 한다(2차 검토 지적 ③).
      const first = node.getBoundingClientRect();
      if (first.height < 4 && first.width < 4) continue;
      let worst: Unreachable | null = null;
      const scrollerInfo = ((): string => {
        for (let cursor = node.parentElement; cursor; cursor = cursor.parentElement) {
          const s = getComputedStyle(cursor);
          if (scrollableX(cursor, s) || scrollableY(cursor, s)) {
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
      /** 이 가장자리를 끌어온 뒤에도 남은 초과분만 센다 — 반대쪽 가장자리는 이 패스의 관심이 아니다. */
      const measure = (edge: "start" | "end"): void => {
        const rect = node.getBoundingClientRect();
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          const s = getComputedStyle(parent);
          const box = parent.getBoundingClientRect();
          // 스크롤 여유가 없는(포화된) 스크롤러도 그 순간에는 클리퍼다 — visibleBox 와 같은
          // 술어를 써야 판정이 일관된다(2차 검토 지적 ④).
          if (clips(s, "y") || (/auto|scroll/u.test(s.overflowY) && !scrollableY(parent, s))) {
            record(label(parent), edge === "end" ? rect.bottom - box.bottom : box.top - rect.top, "y");
          }
          if (clips(s, "x") || (/auto|scroll/u.test(s.overflowX) && !scrollableX(parent, s))) {
            record(label(parent), edge === "end" ? rect.right - box.right : box.left - rect.left, "x");
          }
          if (parent === document.body) break;
        }
        record("viewport", edge === "end" ? rect.bottom - window.innerHeight : -rect.top, "y");
        record("viewport", edge === "end" ? rect.right - window.innerWidth : -rect.left, "x");
      };
      measure("end");
      align(node, "start");
      measure("start");
      if (worst) hits.push(worst);
    }
    for (const [node, memo] of touched) {
      node.scrollTop = memo.top;
      node.scrollLeft = memo.left;
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
  // 두 프레임에 걸쳐 두 번 재고 **둘 다** 눌렸을 때만 보고한다. 한 번만 재면 칩 렌더가
  // 끼어든 순간의 과도 상태를 잡아 게이트가 흔들린다(실측: 같은 코드로 8건 → 0건).
  const sample = async (): Promise<readonly string[]> =>
    await page.evaluate(() => {
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
  const first = await sample();
  if (first.length === 0) return first;
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  const second = await sample();
  return first.filter((line) => second.includes(line));
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
      if (applied === "glass") await unfoldGlass(page);
      const surface = await logSurface(page);
      if (applied === "float") {
        // float 은 **컴포저 캡슐**이다 — 대화 본문을 띄우지 않는다(로그 0x0). 이 도크의 대화
        // 측정은 아래 `history` 상태가 맡는다. 계약을 못 박아 두면, 나중에 누가 float 에 본문을
        // 띄우면서 크기를 안 줄 때 이 줄이 붉은불이 된다.
        expect(surface.height, `float 은 컴포저 전용이어야 한다 (로그 ${surface.width}x${surface.height})`).toBe(0);
      } else {
        expect(surface.height, `${applied} 의 대화 로그가 사실상 없다 (${surface.width}x${surface.height})`)
          .toBeGreaterThan(120);
        const pressure = await page.evaluate(() => {
          const log = document.querySelector<HTMLElement>(".ai-chat-log");
          return log ? log.scrollHeight - log.clientHeight : 0;
        });
        expect(pressure, `${applied} 로그에 flex 압력이 없다 — 시드가 짧아지면 이 게이트는 아무것도 못 잡는다`)
          .toBeGreaterThan(40);
        // 원 결함을 **이름 그대로** 잰다: 접힌 지난 턴은 토글 한 줄이므로 그보다 낮아질 수 없다.
        // `overflow: hidden`(자동 최소 크기 0) 과 축소 가능한 `flex` 가 **함께** 돌아오면 여기서
        // 잡힌다 — 둘 중 하나만 되돌린 변이가 통과하는 것은 옳다(각각이 독립적으로 충분한 방어).
        const squeezedGroups = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>(".ai-chat-log .ai-turn-group")]
            .map((group) => ({
              height: Math.round(group.getBoundingClientRect().height),
              toggle: Math.round(
                group.querySelector<HTMLElement>(".ai-turn-group-toggle")?.getBoundingClientRect().height ?? 0),
            }))
            .filter((row) => row.toggle > 0 && row.height < row.toggle));
        expect(squeezedGroups, `${applied}: 지난 턴 그룹이 토글보다 낮게 눌렸다 ${JSON.stringify(squeezedGroups)}`)
          .toEqual([]);
      }
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
        // 접힌 `<details>`(작업 기록 `details.ai-work-log`, 실패 상세 `.ai-tool-failure`)도 전부 연다 —
        // 판정에서 닫힌 details 를 제외하므로(Chromium 이 버려진 기하를 돌려준다), 열지 않으면
        // 그 안의 `pre`·표가 영원히 사각지대로 남는다(적대적 리뷰 중대 ①).
        // 원래 열려 있던 것만 기억해 두고 전부 연다 — 되돌릴 때 이 표를 쓴다.
        const log = document.querySelector<HTMLElement>(".ai-chat-log");
        (globalThis as { __openBefore?: readonly boolean[] }).__openBefore =
          [...(log?.querySelectorAll<HTMLDetailsElement>("details") ?? [])].map((d) => d.open);
        for (const node of document.querySelectorAll<HTMLDetailsElement>(".ai-chat-log details")) node.open = true;
      });
      // 펼침이 아무것도 바꾸지 않은 독은 "펼침" 측정이 빈 통과가 된다 — float 의
      // restored/expanded 스크린샷이 바이트까지 같았다(적대적 검토 지적 ③). 펼친 결과가
      // 실제로 있는지 못 박고 지나간다.
      await expect(page.locator(".ai-chat-log details[open]").first()).toBeAttached();
      await expect(page.locator(".ai-turn-group:not(.is-collapsed)").first()).toBeAttached();
      if (viewport.name === "1280x800") {
        await page.screenshot({ path: path.join(OUT, `${applied}-2-expanded.png`) });
      }
      report[`${viewport.name}/${applied}/expanded`] = await unreachable(page);
      drift[`${viewport.name}/${applied}/expanded`] = await horizontalDrift(page);
      squeeze[`${viewport.name}/${applied}/expanded`] = await squeezed(page);
      if (viewport.name === "1280x800") {
        await page.screenshot({ path: path.join(OUT, `${applied}-3-after-probe.png`) });
      }

      // 펼침은 다시 접고 나간다. 턴 그룹 토글은 `is-collapsed` 를 뒤집기만 하고 툴 항목은
      // `list.hidden = !list.hidden` 이라, 되돌리지 않으면 다음 독(float·glass)의 "기본"
      // 상태 재기가 사실은 펼친 상태가 된다 — 기본 상태는 side 만 검사되고 있었다(재검토 지적).
      await page.evaluate(() => {
        for (const node of document.querySelectorAll<HTMLElement>(".ai-tool-activity-toggle")) node.click();
      });
      await page.evaluate(() => {
        // `<details>` 도 원래 상태로 돌린다. 안 돌리면 side 에서 연 작업 기록·실패 상세가
        // float·glass 의 "기본" 상태 재기까지 열린 채로 따라와, 고친 줄 알았던 누수가 남는다
        // (2차 적대적 검토 지적 ②).
        const log = document.querySelector<HTMLElement>(".ai-chat-log");
        const before = (globalThis as { __openBefore?: readonly boolean[] }).__openBefore ?? [];
        const nodes = [...(log?.querySelectorAll<HTMLDetailsElement>("details") ?? [])];
        for (const [index, node] of nodes.entries()) node.open = before[index] ?? false;
      });
      await click(page, "ai-turn-group-toggle");
      await expect(page.locator(".ai-turn-group.is-collapsed").first()).toBeAttached();

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
