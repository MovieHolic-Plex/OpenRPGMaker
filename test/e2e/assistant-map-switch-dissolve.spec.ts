import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const evidence = path.resolve(".omo/evidence/assistant-map-switch-dissolve");

// 조수가 **다른 맵**으로 화면을 옮길 때 하드컷이 아니라 크로스페이드가 나는가.
// 같은 맵 안의 이동은 기존 팬이 그대로 소유한다(assistant-camera-motion.spec.ts 가 그쪽을 본다).
// LLM 도 원격 쓰기도 없이, 출하되는 에디터 경로를 그대로 부른다.
test("assistant map switch: crossfade covers the cut, camera arrives framed, reduced motion opts out", async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
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
    const { store } = await import(/* @vite-ignore */ "/src/project/store.ts");
    const { createBlankMap } = await import(/* @vite-ignore */ "/src/project/defaults.ts");
    const { editorState } = await import(/* @vite-ignore */ "/src/editor/editorState.ts");
    const { focusEditorRegion } = await import(/* @vite-ignore */ "/src/editor/editorReferenceNavigation.ts");
    const project = structuredClone(store.getCurrent());
    const a = createBlankMap("Dissolve QA A", 60, 40);
    const b = createBlankMap("Dissolve QA B", 40, 30);
    a.id = "dissolve-qa-a"; b.id = "dissolve-qa-b";
    // 두 맵이 눈으로도 달라야 스크린샷이 증거가 된다 — 하나만 바닥을 칠한다.
    for (let index = 0; index < b.lowerTiles.length; index += 1) b.lowerTiles[index] = a.lowerTiles[0] ?? 0;
    project.maps = { [a.id]: a, [b.id]: b };
    project.startMapId = a.id;
    project.mapTree = { mapId: a.id, children: [{ mapId: b.id, children: [] }] };
    store.replace(project);
    editorState.set({ currentMapId: a.id, zoom: 2, tool: "select" });
    (window as any).__dissolveQA = { editorState, focusEditorRegion, store };
  });
  await page.waitForTimeout(200);

  // ── 1. 다른 맵으로: 베일이 실제로 화면을 덮고, 덮인 뒤에 맵이 바뀐다 ──
  // 표본은 rAF 가 아니라 타이머로 뜬다. 소프트웨어 GL(swiftshader)에서 이 편집 캔버스의
  // rAF 는 7fps 까지 떨어져(실측) 330ms 전환을 서너 점으로만 보게 된다 — 베일은 WAAPI
  // 자체 시계로 도므로 타이머가 정직한 관찰자다.
  const crossMap = await page.evaluate(async () => {
    const w = window as any;
    const veilOpacity = (): number => {
      const node = document.querySelector<HTMLElement>("[data-testid='map-dissolve-veil']");
      if (!node) return -1;
      return Number.parseFloat(getComputedStyle(node).opacity);
    };
    // 「깜빡인 것이 아니라 페이드했다」는 표본으로 증명하지 않는다 — 덮기가 130ms 인데 이
    // 루프는 메인 스레드가 맵을 다시 그리는 동안 130ms 까지 굶는다(실측). 대신 베일에 실제로
    // 걸린 애니메이션의 **지속시간**을 모은다: 시간이 있는 보간이었다는 결정적 증거다.
    const durations = (): number[] => {
      const node = document.querySelector<HTMLElement>("[data-testid='map-dissolve-veil']");
      return (node?.getAnimations() ?? []).map((animation) => Number(animation.effect?.getTiming().duration ?? 0));
    };
    const samples: { t: number; opacity: number; mapId: string }[] = [];
    const seenDurations = new Set<number>();
    const startedAt = performance.now();
    const mapBefore = w.__oprnEditMapViewport().mapId;
    w.__dissolveQA.focusEditorRegion({ mapId: "dissolve-qa-b", x: 34, y: 25, w: 4, h: 3 });
    let covered = false;
    while (performance.now() - startedAt < 8000) {
      for (const duration of durations()) seenDurations.add(duration);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const opacity = veilOpacity();
      samples.push({ t: performance.now() - startedAt, opacity, mapId: w.__oprnEditMapViewport().mapId });
      if (opacity > 0.99) covered = true;
      // 다 덮였다가 다시 걷혔으면 전환이 끝난 것이다 — 고정 창을 기다리지 않는다.
      if (covered && opacity < 0.001) break;
    }
    return {
      mapBefore,
      samples,
      durations: [...seenDurations],
      veilAtEnd: veilOpacity(),
      mapAfter: w.__oprnEditMapViewport().mapId,
    };
  });
  writeFileSync(path.join(evidence, "cross-map-samples.json"), JSON.stringify(crossMap, null, 2));

  expect(crossMap.mapBefore).toBe("dissolve-qa-a");
  expect(crossMap.mapAfter).toBe("dissolve-qa-b");
  // 베일이 붙었고, 한 번은 거의 다 덮였다.
  expect(Math.max(...crossMap.samples.map((s) => s.opacity))).toBeGreaterThan(0.9);
  // 덮기·걷기가 **시간이 있는 보간**으로 돌았다 — 한 프레임 토글이 아니다.
  // 값은 ASSISTANT_DISSOLVE_COVER_MS / ASSISTANT_DISSOLVE_REVEAL_MS 와 같아야 한다.
  expect(crossMap.durations).toContain(130);
  expect(crossMap.durations).toContain(200);
  // 교체는 **덮인 뒤에만** 일어난다: 맵이 바뀐 첫 프레임의 베일은 불투명해야 한다.
  const swapFrame = crossMap.samples.find((s) => s.mapId === "dissolve-qa-b");
  expect(swapFrame).toBeDefined();
  expect(swapFrame!.opacity).toBeGreaterThan(0.9);
  // 그리고 끝에는 반드시 걷힌다 — 종이색에 갇히면 하드컷보다 나쁘다.
  expect(crossMap.veilAtEnd).toBeLessThan(0.01);

  await page.screenshot({ path: path.join(evidence, "01-after-cross-map.png") });

  // ── 2. 맵을 건너뛴 카메라는 팬하지 않는다(도착해 있다) ──
  const arrival = await page.evaluate(async () => {
    const w = window as any;
    w.__dissolveQA.editorState.set({ currentMapId: "dissolve-qa-a" });
    await new Promise(requestAnimationFrame);
    w.__dissolveQA.focusEditorRegion({ mapId: "dissolve-qa-b", x: 2, y: 2, w: 2, h: 2 });
    // 교체가 실제로 일어날 때까지 기다린다 — 소프트웨어 GL 에서는 맵 재구축이 수백 ms 다.
    const deadline = performance.now() + 8000;
    while (performance.now() < deadline && w.__oprnEditMapViewport().mapId !== "dissolve-qa-b") {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const justAfterSwap = w.__oprnEditCamera();
    // 기존 팬이라면 300–650ms 안에 카메라가 계속 움직인다. 도착해 있다면 한 톨도 안 움직인다.
    await new Promise((resolve) => setTimeout(resolve, 900));
    return { justAfterSwap, settled: w.__oprnEditCamera(), mapId: w.__oprnEditMapViewport().mapId };
  });
  expect(arrival.mapId).toBe("dissolve-qa-b");
  // 베일이 걷힌 뒤로 카메라가 더 움직이면 그것이 두 번째 덜컹이다.
  expect(arrival.settled).toEqual(arrival.justAfterSwap);

  // ── 3. 같은 맵 안의 이동에는 베일을 걸지 않는다 — 팬이 연속성을 갖는다 ──
  const sameMap = await page.evaluate(async () => {
    const w = window as any;
    const veil = () => {
      const node = document.querySelector<HTMLElement>("[data-testid='map-dissolve-veil']");
      return node ? Number.parseFloat(getComputedStyle(node).opacity) : 0;
    };
    const peak: number[] = [];
    const startedAt = performance.now();
    w.__dissolveQA.focusEditorRegion({ mapId: "dissolve-qa-b", x: 36, y: 27, w: 2, h: 2 });
    while (performance.now() - startedAt < 700) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      peak.push(veil());
    }
    return { maxVeil: Math.max(...peak), mapId: w.__oprnEditMapViewport().mapId };
  });
  expect(sameMap.mapId).toBe("dissolve-qa-b");
  expect(sameMap.maxVeil).toBeLessThan(0.01);

  // ── 4. 동작 줄이기: 전환을 **제거**한다(대체하지 않는다) ──
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.evaluate(async () => {
    const w = window as any;
    const veil = () => {
      const node = document.querySelector<HTMLElement>("[data-testid='map-dissolve-veil']");
      return node ? Number.parseFloat(getComputedStyle(node).opacity) : 0;
    };
    w.__dissolveQA.editorState.set({ currentMapId: "dissolve-qa-a" });
    await new Promise(requestAnimationFrame);
    const peak: number[] = [];
    const startedAt = performance.now();
    w.__dissolveQA.focusEditorRegion({ mapId: "dissolve-qa-b", x: 5, y: 5, w: 2, h: 2 });
    const mapImmediately = w.__oprnEditMapViewport().mapId;
    while (performance.now() - startedAt < 500) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      peak.push(veil());
    }
    return { mapImmediately, maxVeil: Math.max(...peak, 0) };
  });
  expect(reduced.mapImmediately).toBe("dissolve-qa-b");
  expect(reduced.maxVeil).toBeLessThan(0.01);

  writeFileSync(path.join(evidence, "measurements.json"), JSON.stringify({ crossMap: { ...crossMap, samples: undefined }, arrival, sameMap, reduced, errors }, null, 2));
  expect(errors).toEqual([]);
});
