import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ASSISTANT_DISSOLVE_COVER_MS, ASSISTANT_DISSOLVE_REVEAL_MS } from "@/editor/assistantViewTransition";

const evidence = path.resolve(".omo/evidence/map-list-switch-dissolve");

// 사용자가 맵 목록에서 직접 고른 전환의 계약 — 조수 경로는 assistant-map-switch-dissolve.spec.ts 가 본다.
// 하드컷 판정은 세 가지를 함께 본다: 베일 불투명도, 베일에 걸린 애니메이션 지속시간,
// 그리고 맵이 바뀐 첫 표본의 불투명도 — 하나만 보면 초록이 거짓말을 할 수 있다.
test("map list switch: picking a map by click crossfades instead of hard-cutting", async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  });
  // 호스트 netlink 변동이 Chromium 모듈 그래프를 통째로 취소하는 것을 막는다.
  await page.route((url) => url.origin === new URL(baseURL!).origin && !url.pathname.startsWith("/api/"), async (route) => {
    await route.fulfill({ response: await route.fetch() });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 45_000 });
  await page.waitForFunction(() => Boolean((window as any).__oprnEditVisibleArea?.()));

  await page.evaluate(async () => {
    // 이미 실린 모듈의 URL 을 재사용한다 — 새 인스턴스를 만들면 store 가 둘이 된다.
    const moduleUrl = (suffix: string): string => performance.getEntriesByType("resource")
      .map((entry) => entry.name).find((url) => new URL(url).pathname === suffix) ?? suffix;
    const { store } = await import(moduleUrl("/src/project/store.ts")) as typeof import("../../src/project/store");
    const { createBlankMap } = await import(moduleUrl("/src/project/defaults.ts")) as typeof import("../../src/project/defaults");
    const { editorState } = await import(moduleUrl("/src/editor/editorState.ts")) as typeof import("../../src/editor/editorState");
    const { revealMapInDock } = await import(moduleUrl("/src/editor/panels/mapList.ts")) as typeof import("../../src/editor/panels/mapList");
    const project = structuredClone(store.getCurrent());
    const a = createBlankMap("Switch QA A", 60, 40);
    const b = createBlankMap("Switch QA B", 40, 30);
    a.id = "user-switch-a";
    b.id = "user-switch-b";
    // 두 맵이 눈으로도 달라야 스크린샷이 증거가 된다 — 하나만 바닥을 칠한다.
    for (let index = 0; index < b.lowerTiles.length; index += 1) b.lowerTiles[index] = a.lowerTiles[0] ?? 0;
    project.maps = { [a.id]: a, [b.id]: b };
    project.startMapId = a.id;
    project.mapTree = {
      mapId: a.id,
      children: [
        { mapId: b.id, children: [] },
        { kind: "folder", mapId: "folder_qa", name: "QA 분류", children: [] },
      ],
    } as typeof project.mapTree;
    store.replace(project);
    editorState.set({ currentMapId: a.id, zoom: 2, tool: "select" });
    revealMapInDock(a.id);

    // 표본은 타이머로 뜬다 — 소프트웨어 GL(swiftshader)에서 이 캔버스의 rAF 는 7fps 까지 떨어져
    // 전환을 서너 점으로만 보게 된다(실측). 베일은 WAAPI 자체 시계로 돈다.
    //
    // 다만 **지속시간과 교체 순간의 불투명도는 표본으로 재지 않는다**(2026-09-16 실측).
    // 호스트 부하가 높으면 폴링 루프가 맵 재구축 동안 700ms 넘게 굶어 120ms 짜리 걷기 페이드를
    // 통째로 놓친다 — 그러면 «시간이 있는 보간이었다» 는 단정이 거짓 실패한다. 그래서
    // `Element.prototype.animate` 를 걸어 페이드의 **계획값**을 직접 받고, 교체 순간의
    // 불투명도는 `editorState` 구독자(=교체와 같은 태스크)에서 읽는다. 표본 루프는 사람이 볼
    // 곡선용으로만 남긴다.
    const w = window as any;
    const mapIdNow = (): string => w.__oprnEditMapViewport().mapId;
    if (!w.__switchQAAnimatePatched) {
      const original = Element.prototype.animate;
      Element.prototype.animate = function patched(keyframes: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
        const animation = original.call(this, keyframes as Keyframe[], options as KeyframeAnimationOptions);
        if (this instanceof HTMLElement && this.classList.contains("map-dissolve-veil")) {
          const duration = Number((options as KeyframeAnimationOptions | undefined)?.duration ?? 0);
          const to = String((keyframes as Keyframe[])?.[1]?.opacity ?? "");
          const state = w.__switchQA?.state;
          if (state) {
            state.fadeDurations.push({ duration, to });
            if (!state.durations.includes(duration)) state.durations.push(duration);
          }
        }
        return animation;
      };
      w.__switchQAAnimatePatched = true;
    }
    w.__switchQA = {
      editorState,
      begin(): void {
        const state: any = { samples: [], durations: [], fadeDurations: [], maxOpacity: -1, covered: false, swapFrameOpacity: -1, running: true, startedAt: performance.now() };
        w.__switchQA.state = state;
        // 교체와 같은 태스크에서 베일 불투명도를 찍는다 — 폴링이 굶어도 이 값은 정확하다.
        let unsubscribe: (() => void) | null = null;
        unsubscribe = editorState.subscribe((next: { currentMapId: string | null }) => {
          if (state.swapFrameOpacity >= 0 || next.currentMapId !== "user-switch-b") return;
          const node = document.querySelector<HTMLElement>("[data-testid='map-dissolve-veil']");
          state.swapFrameOpacity = node ? Number.parseFloat(getComputedStyle(node).opacity) : -1;
          if (state.swapFrameOpacity > 0.99) state.covered = true;
          unsubscribe?.();
        });
        void (async () => {
          while (performance.now() - state.startedAt < 8000) {
            const node = document.querySelector<HTMLElement>("[data-testid='map-dissolve-veil']");
            const opacity = node ? Number.parseFloat(getComputedStyle(node).opacity) : -1;
            const mapId = mapIdNow();
            state.samples.push({ t: Math.round(performance.now() - state.startedAt), opacity, mapId });
            if (opacity > state.maxOpacity) state.maxOpacity = opacity;
            if (opacity > 0.99) state.covered = true;
            const elapsed = performance.now() - state.startedAt;
            if (state.covered && opacity < 0.001) break;
            // 베일 없이 맵만 바뀌었다면 그것이 하드컷이다 — 고정 창을 태울 이유가 없다.
            if (state.maxOpacity <= 0.01 && mapId !== "user-switch-a" && elapsed > 1200) break;
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          state.running = false;
        })();
      },
      read(): any {
        const state = w.__switchQA.state;
        const node = document.querySelector<HTMLElement>("[data-testid='map-dissolve-veil']");
        return {
          samples: state.samples,
          durations: state.durations,
          fadeDurations: state.fadeDurations,
          maxOpacity: state.maxOpacity,
          covered: state.covered,
          swapFrameOpacity: state.swapFrameOpacity,
          veilAtEnd: node ? Number.parseFloat(getComputedStyle(node).opacity) : -1,
          mapAfter: mapIdNow(),
        };
      },
    };
  });
  await page.getByTestId("map-tree").waitFor({ state: "visible", timeout: 30_000 });
  await expect(page.getByTestId("map-tree-node-user-switch-a")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: path.join(evidence, "01-before-click.png") });

  // ── when: 목록에서 다른 맵을 고른다 ──
  await page.evaluate(() => (window as any).__switchQA.begin());
  await page.getByTestId("map-tree-node-user-switch-b").click();
  await page.waitForFunction(() => (window as any).__switchQA?.state?.running === false, null, { timeout: 20_000 });
  const picked = await page.evaluate(() => (window as any).__switchQA.read());
  await page.screenshot({ path: path.join(evidence, "02-after-click.png") });
  // 중간 프레임은 여기서 지지 않는다: screenshot 한 장이 전환 전체(페이드 + 베일 유지)보다
  // 오래 걸려 «덮인 순간» 을 잡지 못하고, 덮었다고 이름 붙인 프레임이 실은 걷힌 뒤 화면이 된다.
  // 사람이 볼 프레임은 CDP 스크린캐스트 필름스트립이 남긴다
  // (FILMSTRIP_DRIVER=map-list node scripts/qa/assistant-map-switch-filmstrip.mjs).
  writeFileSync(path.join(evidence, "click-samples.json"), JSON.stringify({ picked }, null, 2));

  // ── then: 하드컷이 아니라 시간이 있는 크로스페이드였다 ──
  expect(picked.mapAfter).toBe("user-switch-b");
  expect(picked.maxOpacity, "목록 클릭이 베일 없이 하드컷됐다 — 맵만 바뀌고 화면은 한 프레임에 갈렸다").toBeGreaterThan(0.9);
  // 덮기와 걷기가 **시간이 있는 보간**으로 돌았다 — 한 프레임 토글이 아니다.
  // 지속시간은 `Element.prototype.animate` 가 받은 계획값이다(표본 아님).
  expect(picked.durations).toContain(ASSISTANT_DISSOLVE_COVER_MS);
  expect(picked.durations).toContain(ASSISTANT_DISSOLVE_REVEAL_MS);
  // 교체는 **덮인 뒤에만** 일어난다: 교체와 같은 태스크에서 읽은 베일이 불투명해야 한다.
  expect(
    picked.swapFrameOpacity,
    "맵이 베일 밖에서 먼저 바뀌었다 — 덮이기 전에 하드컷이 보인다"
  ).toBeGreaterThan(0.9);
  expect(picked.veilAtEnd).toBeLessThan(0.01);

  // ── 이미 열려 있는 행을 다시 누르면 베일을 걸지 않는다(같은 맵은 좌표계가 이어진다) ──
  await page.evaluate(() => (window as any).__switchQA.begin());
  await page.getByTestId("map-tree-node-user-switch-b").click();
  await page.waitForTimeout(600);
  const reclick = await page.evaluate(() => (window as any).__switchQA.read());
  expect(reclick.mapAfter).toBe("user-switch-b");
  expect(reclick.maxOpacity).toBeLessThan(0.01);

  // ── 분류(폴더) 행은 화면을 바꾸지 않는다 — 활성 맵도 베일도 그대로 ──
  await page.evaluate(() => (window as any).__switchQA.begin());
  await page.getByTestId("map-tree-node-folder_qa").click();
  await page.waitForTimeout(600);
  const folder = await page.evaluate(() => (window as any).__switchQA.read());
  expect(folder.mapAfter).toBe("user-switch-b");
  expect(folder.maxOpacity).toBeLessThan(0.01);

  // ── 동작 줄이기는 전환을 **제거**한다 — 교체가 덮기를 기다리면 안 된다 ──
  //
  // 왜 «지연(ms)» 으로 재지 않는가(2026-09-16 실측): 이 경로의 클릭→교체 시간은 전환을 뺀
  // 나머지, 곧 **맵 재구축 시간**이 지배한다(부하가 높을 때 124ms). 예전의
  // `toBeLessThan(130)` 은 그 재구축보다 겨우 6ms 큰 값이라 통과가 운에 달려 있었다.
  // 게다가 «클릭과 같은 태스크인가» 를 `queueMicrotask` 로 재려 해도 안 된다 — 이벤트 디스패치
  // 중에는 리스너 사이마다 마이크로태스크 체크포인트가 돌아서 행의 버블 핸들러보다 먼저 찍힌다.
  // 계약은 «기다렸는가» 이므로 **베일에 페이드가 하나도 안 걸렸는가** 를 직접 본다:
  // 덮기 페이드가 없다는 것이 곧 «덮기를 기다리지 않았다» 이다.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => (window as any).__switchQA.begin());
  await page.evaluate(() => {
    const w = window as any;
    const state: any = { clickAt: 0, swapAt: 0, maxOpacity: -1, done: false };
    w.__switchQA.latency = state;
    const onClick = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("[data-testid='map-tree-node-user-switch-a']")) return;
      state.clickAt = performance.now();
      document.removeEventListener("click", onClick, true);
    };
    // 캡처 단계로 건다 — 행 자신에 달면 앱 핸들러보다 늦게 불린다.
    document.addEventListener("click", onClick, true);
    // 교체 시각은 편집기 상태 구독자로 찍는다: editorState.set 은 리스너를 동기로 부르므로
    // 클릭 핸들러와 같은 태스크 안이다. 표본 루프로 재면 맵을 다시 그리는 동안 굶은 폴링
    // 지연(swiftshader 에서 수백 ms)이 «상품 지연» 으로 둔갑한다.
    let unsubscribe: (() => void) | null = null;
    unsubscribe = w.__switchQA.editorState.subscribe((next: { currentMapId: string | null }) => {
      if (state.swapAt || next.currentMapId !== "user-switch-a") return;
      state.swapAt = performance.now();
      unsubscribe?.();
    });
    const startedAt = performance.now();
    void (async () => {
      while (performance.now() - startedAt < 8000) {
        const node = document.querySelector<HTMLElement>("[data-testid='map-dissolve-veil']");
        const opacity = node ? Number.parseFloat(getComputedStyle(node).opacity) : -1;
        if (opacity > state.maxOpacity) state.maxOpacity = opacity;
        if (state.swapAt && performance.now() - state.swapAt > 300) break;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      state.done = true;
    })();
  });
  await page.getByTestId("map-tree-node-user-switch-a").click();
  await page.waitForFunction(() => (window as any).__switchQA?.latency?.done === true, null, { timeout: 15_000 });
  const reduced = await page.evaluate(() => {
    const w = window as any;
    const state = w.__switchQA.latency;
    return {
      clickAt: Math.round(state.clickAt),
      swapAt: Math.round(state.swapAt),
      swapLatencyMs: Math.round(state.swapAt - state.clickAt),
      maxOpacity: state.maxOpacity,
      read: w.__switchQA.read(),
    };
  });
  expect(reduced.read.mapAfter).toBe("user-switch-a");
  expect(reduced.read.maxOpacity).toBeLessThan(0.01);
  expect(reduced.swapAt, "동작 줄이기인데 맵이 안 바뀌었다 — 관찰 자체가 실패했다").toBeGreaterThan(0);
  expect(
    reduced.read.fadeDurations,
    `동작 줄이기인데 베일에 페이드가 걸렸다(클릭→교체 ${reduced.swapLatencyMs}ms) — 전환을 제거하지 않고 지연시켰다`
  ).toEqual([]);

  writeFileSync(
    path.join(evidence, "measurements.json"),
    JSON.stringify({ picked: { ...picked, samples: undefined }, reclick: { ...reclick, samples: undefined }, folder: { ...folder, samples: undefined }, reduced, errors }, null, 2)
  );
  expect(errors).toEqual([]);
});