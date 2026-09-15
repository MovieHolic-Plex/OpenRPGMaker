import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

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
    // 330ms 전환을 서너 점으로만 보게 된다(실측). 베일은 WAAPI 자체 시계로 돈다.
    const w = window as any;
    const mapIdNow = (): string => w.__oprnEditMapViewport().mapId;
    w.__switchQA = {
      editorState,
      begin(): void {
        const state: any = { samples: [], durations: [], maxOpacity: -1, covered: false, running: true, startedAt: performance.now() };
        w.__switchQA.state = state;
        void (async () => {
          while (performance.now() - state.startedAt < 8000) {
            const node = document.querySelector<HTMLElement>("[data-testid='map-dissolve-veil']");
            const opacity = node ? Number.parseFloat(getComputedStyle(node).opacity) : -1;
            for (const animation of node?.getAnimations?.() ?? []) {
              const duration = Number(animation.effect?.getTiming().duration ?? 0);
              if (!state.durations.includes(duration)) state.durations.push(duration);
            }
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
          maxOpacity: state.maxOpacity,
          covered: state.covered,
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
  // 중간 프레임은 여기서 지지 않는다: screenshot 한 장이 330ms 전환보다 오래 걸려
  // «덮인 순간» 을 잡지 못하고, 덮었다고 이름 붙인 프레임이 실은 걷힌 뒤 화면이 된다.
  // 사람이 볼 프레임은 CDP 스크린캐스트 필름스트립이 남긴다
  // (FILMSTRIP_DRIVER=map-list node scripts/qa/assistant-map-switch-filmstrip.mjs).
  writeFileSync(path.join(evidence, "click-samples.json"), JSON.stringify({ picked }, null, 2));

  // ── then: 하드컷이 아니라 시간이 있는 크로스페이드였다 ──
  expect(picked.mapAfter).toBe("user-switch-b");
  expect(picked.maxOpacity, "목록 클릭이 베일 없이 하드컷됐다 — 맵만 바뀌고 화면은 한 프레임에 갈렸다").toBeGreaterThan(0.9);
  expect(picked.durations).toContain(130);
  expect(picked.durations).toContain(200);
  const swapFrame = picked.samples.find((sample: any) => sample.mapId === "user-switch-b");
  expect(swapFrame).toBeDefined();
  expect(swapFrame.opacity, "맵이 베일 밖에서 먼저 바뀌었다 — 덮이기 전에 하드컷이 보인다").toBeGreaterThan(0.9);
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

  // ── 동작 줄이기는 전환을 제거한다 — 교체가 덮기(130ms)를 기다리면 안 된다 ──
  // 시계는 «클릭 이벤트가 행에 닿은 순간» 부터 잰다. 표본 시작부터 재면 플레이라이트의
  // 클릭 디스패치(이 브라우저에서 1초 남짓)가 섞여 상품 지연을 못 본다.
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
  expect(reduced.swapLatencyMs, "동작 줄이기인데 덮기를 기다렸다 — 전환이 제거되지 않고 지연됐다").toBeLessThan(130);

  writeFileSync(
    path.join(evidence, "measurements.json"),
    JSON.stringify({ picked: { ...picked, samples: undefined }, reclick: { ...reclick, samples: undefined }, folder: { ...folder, samples: undefined }, reduced, errors }, null, 2)
  );
  expect(errors).toEqual([]);
});