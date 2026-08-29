// 대화창 진입 연출이 **실제 브라우저에서 도는지** 본다.
//
// 단위 테스트는 dataset 과 CSS 텍스트까지만 확인할 수 있다. 둘이 다 맞아도 화면에서는
// 아무 일도 일어나지 않을 수 있다 — 특이도에 밀리거나, var() 가 무효라
// animation-duration 이 0s 로 떨어지거나, keyframe 이름이 어긋나면 조용히 죽는다.
// 그래서 여기서는 getComputedStyle 로 실제 animationName/Duration 을 읽는다.
//
// ── 관측 시점 ────────────────────────────────────────────────────────────────
// 진입 연출은 짧고(140~260ms) 끝나면 phase 가 shown 으로 바뀌며 animation 선언 자체가
// 사라진다. 폴링으로는 놓치므로 MutationObserver 로 **상자가 삽입되는 순간**
// 계산된 스타일을 낚아채 둔다.
//
// ── 트리거를 auto 로 쓰는 이유 ───────────────────────────────────────────────
// 실행 히트박스(runtime-debug-marker) 클릭에 의존하지 않는다. runtimeDom.ts 의
// upsertEventMarker 는 **마커를 처음 만들 때만** 클릭 리스너를 붙이는데
// playSceneAutonomous.ts 는 onActivate 없이 같은 함수를 부른다. 자율이동 경로가 마커를
// 먼저 만들면 그 마커는 영구히 클릭이 안 먹는다 — 어느 경로가 먼저 그리는지에 달린
// 경합이라 클릭 기반 대화 e2e 는 원래 불안정하다. auto 트리거는 그 경로를 타지 않는다.
//
// 대사 사이에 wait 를 끼우는 것도 의도된 설계 검증이다. cleanup() 이 예약한 퇴장이
// 만료되어 창이 닫히고, 다음 text 는 빈 오버레이를 만나 **새 세션으로** 진입 연출을
// 다시 재생한다. 연속 대사는 반대로 재생하지 않는다(같은 tick 에 예약이 취소된다).
import { expect, test, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(180_000);
test.use({ serviceWorkers: "block" });

const NEUTRAL_BODY = "기본 말투로 말한다.";
const SAD_BODY = "가라앉은 말투로 말한다.";
const SURPRISED_BODY = "놀란 말투로 말한다.";

type EnterSample = {
  readonly emotion: string;
  readonly phase: string;
  readonly motion: string;
  readonly animationName: string;
  readonly animationDuration: string;
  readonly animationFillMode: string;
  readonly enterVar: string;
  /** 이름표는 창보다 늦게 들어온다 — 지연이 0 이면 같이 튀어나온다. */
  readonly nameplateAnimationName: string;
  readonly nameplateAnimationDelay: string;
};

declare global {
  interface Window {
    __dialogueEnterSamples?: EnterSample[];
  }
}

/** 상자가 붙는 순간의 계산된 스타일을 기록하는 관찰자. 페이지마다 1회 심는다. */
async function installEnterProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__dialogueEnterSamples = [];
    const sample = (box: HTMLElement): void => {
      const style = getComputedStyle(box);
      const plate = box.querySelector<HTMLElement>(".speaker.speaker-nameplate");
      const plateStyle = plate ? getComputedStyle(plate) : undefined;
      window.__dialogueEnterSamples?.push({
        nameplateAnimationName: plateStyle?.animationName ?? "",
        nameplateAnimationDelay: plateStyle?.animationDelay ?? "",
        emotion: box.dataset.dialogueEmotion ?? "",
        phase: box.dataset.dialoguePhase ?? "",
        motion: box.dataset.dialogueMotion ?? "",
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        animationFillMode: style.animationFillMode,
        enterVar: style.getPropertyValue("--dialogue-enter-ms").trim(),
      });
    };
    const scan = (node: Node): void => {
      if (!(node instanceof HTMLElement)) return;
      if (node.classList.contains("dialogue-box")) sample(node);
      for (const box of node.querySelectorAll<HTMLElement>(".dialogue-box")) sample(box);
    };
    // document 를 본다 — init script 시점에는 documentElement 가 아직 없을 수 있다.
    new MutationObserver((records) => {
      for (const record of records) for (const added of record.addedNodes) scan(added);
    }).observe(document, { childList: true, subtree: true });
  });
}

/**
 * 상자가 뜬 뒤, 그 상자가 삽입될 때 찍힌 표본을 돌려준다.
 * 표본은 위치가 아니라 emotion 으로 찾는다 — 대사 사이 공백(wait 600ms)이
 * Playwright 폴링 간격보다 짧아서 어느 상자가 "마지막"인지는 보장되지 않는다.
 */
async function awaitMessage(page: Page, body: string, emotion: string): Promise<EnterSample> {
  await expect(page.getByTestId("dialogue-box")).toContainText(body, { timeout: 30_000 });
  const samples = await page.evaluate(() => window.__dialogueEnterSamples ?? []);
  const sample = samples.find((entry) => entry.emotion === emotion);
  expect(sample, `emotion=${emotion} 상자의 삽입이 관측되지 않았다`).toBeTruthy();
  return sample!;
}

/**
 * 대사를 닫는다. 창이 비는 순간은 단정하지 않는다 — 관측할 수 없고 필요도 없다.
 * 다음 표본의 phase 가 "enter" 라는 것이 곧 창이 닫혔다는 증거다.
 * 창이 안 닫혔다면 다음 대사는 같은 상자를 재사용해 phase="shown" 으로 뜨고
 * animationName 이 none 이 되어 아래 단정이 깨진다.
 */
async function closeMessage(page: Page): Promise<void> {
  await page.keyboard.press("Enter");
}

async function bootRuntime(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await installEnterProbe(page);
  await seedProjectFromSupabaseCanonical(page, presentationProject());
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 60_000 });
  // 상태 덤프까지 기다린다. waitForRuntimeState:false 로 건너뛰면 자동시작 분기에서
  // 스테이지만 보고 곧장 반환해 **게임이 시작되기 전에** 다음 단계로 넘어간다.
  // 타임아웃만 넉넉히 준다 — 에디터 콜드 부팅이 기본 15초보다 느리다.
  await startNewGameFromTitle(page, { timeoutMs: 90_000 });
}

test("진입 연출이 감정별 keyframe 과 주입된 길이로 실제 재생된다", async ({ page }) => {
  await bootRuntime(page);

  const neutral = await awaitMessage(page, NEUTRAL_BODY, "neutral");
  expect(neutral.emotion).toBe("neutral");
  expect(neutral.phase).toBe("enter");
  expect(neutral.motion).toBe("on");
  expect(neutral.animationName).toBe("dialogue-box-enter");
  // 0s 면 var(--dialogue-enter-ms) 가 무효라 선언이 통째로 버려진 것이다.
  expect(neutral.animationDuration).toBe("0.17s");
  expect(neutral.enterVar).toBe("170ms");
  expect(neutral.animationFillMode).toBe("both");
  // 이름표는 창이 자리잡은 뒤 40ms 늦게 들어온다(neutral 프로파일).
  expect(neutral.nameplateAnimationName).toBe("dialogue-nameplate-enter");
  expect(neutral.nameplateAnimationDelay).toBe("0.04s");

  // 연출이 끝나면 정착 상태로 넘어가고 transform 이 풀린다.
  const box = page.getByTestId("dialogue-box");
  await expect(box).toHaveAttribute("data-dialogue-phase", "shown");
  expect(await box.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
  await closeMessage(page);

  // 슬픔은 오버슈트 없는 느린 곡선을, 놀람은 강한 팝을 쓴다 — 감정이 실제로 갈린다.
  const sad = await awaitMessage(page, SAD_BODY, "sad");
  expect(sad.emotion).toBe("sad");
  expect(sad.phase).toBe("enter");
  expect(sad.animationName).toBe("dialogue-box-enter-soft");
  expect(sad.animationDuration).toBe("0.26s");
  await closeMessage(page);

  const surprised = await awaitMessage(page, SURPRISED_BODY, "surprised");
  expect(surprised.emotion).toBe("surprised");
  expect(surprised.animationName).toBe("dialogue-box-enter-pop");
  expect(surprised.animationDuration).toBe("0.16s");
});

test("reducedMotion 은 움직임을 죽이지만 창은 그대로 뜬다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await bootRuntime(page);

  const reduced = await awaitMessage(page, NEUTRAL_BODY, "neutral");
  expect(reduced.motion, "TS 가 prefers-reduced-motion 을 못 읽었다").toBe("off");
  expect(reduced.animationName).toBe("dialogue-box-enter-fade");
  expect(reduced.animationDuration).toBe("0.06s");
  // 이름표도 이동을 잃고 지연 없이 페이드만 남는다.
  expect(reduced.nameplateAnimationName).toBe("dialogue-child-enter-fade");
  expect(reduced.nameplateAnimationDelay).toBe("0s");

  // 창은 여전히 나타나야 한다 — opacity 0 으로 남으면 대사를 읽을 수 없다.
  const box = page.getByTestId("dialogue-box");
  await expect(box).toHaveAttribute("data-dialogue-phase", "shown");
  const settled = await box.evaluate((node) => {
    const style = getComputedStyle(node);
    return { opacity: Number.parseFloat(style.opacity), transform: style.transform };
  });
  expect(settled.opacity).toBeGreaterThan(0.9);
  expect(settled.transform === "none" || settled.transform === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);

  // 감정별 규칙(특이도 0,3,0)이 안전망을 이겨 버리면 여기서 잡힌다.
  await closeMessage(page);
  const sad = await awaitMessage(page, SAD_BODY, "sad");
  expect(sad.animationName).toBe("dialogue-box-enter-fade");
});

function presentationProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("blank project start map is missing");
  // 대사 사이의 wait 가 퇴장 예약을 만료시켜 창을 닫는다 — 그래서 다음 대사가
  // 새 세션이 되고 진입 연출을 다시 재생한다. 마지막 wait 는 auto 이벤트가
  // 처음으로 되돌아와 대사를 다시 띄우는 것을 막는 주차용이다.
  map.events.push(
    autoEvent("ev_presentation", 2, 2, [
      { kind: "text", speaker: "안내", body: NEUTRAL_BODY },
      { kind: "wait", ms: 600 },
      { kind: "text", speaker: "안내", body: SAD_BODY, emotion: "sad" },
      { kind: "wait", ms: 600 },
      { kind: "text", speaker: "안내", body: SURPRISED_BODY, emotion: "surprised" },
      { kind: "wait", ms: 120_000 },
    ])
  );
  return project;
}

function autoEvent(id: string, x: number, y: number, commands: Command[]): GameEvent {
  const page: EventPage = {
    id: `${id}_page`,
    name: id,
    conditions: [],
    graphic: {},
    trigger: { kind: "auto" },
    priority: "below",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  return { id, x, y, trigger: { kind: "auto" }, commands: [], pages: [page] };
}
