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
import { seedProjectForEditor } from "./projectSeed";

test.setTimeout(180_000);
test.use({ serviceWorkers: "block" });

const NEUTRAL_BODY = "기본 말투로 말한다.";
const SAD_BODY = "가라앉은 말투로 말한다.";
const ANGRY_BODY = "화난 말투로 말한다.";
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

/**
 * 글자별 연출은 정착한 뒤에 읽어도 된다. 상자의 phase 와 달리 char-reveal 게이트는
 * 세션 내내 남으므로 선언이 사라지지 않는다 — 재생이 끝난 span 도 animationName 을
 * 그대로 들고 있다. 그래서 타이밍을 맞출 필요가 없다.
 */
async function readCharReveal(page: Page): Promise<{
  readonly count: number;
  readonly gate: string | null;
  readonly animationName: string;
  readonly animationDuration: string;
}> {
  return page.evaluate(() => {
    const box = document.querySelector<HTMLElement>(".dialogue-box");
    const chars = box?.querySelectorAll<HTMLElement>(".body .dialogue-char") ?? [];
    const first = chars[0];
    const style = first ? getComputedStyle(first) : undefined;
    return {
      count: chars.length,
      gate: box?.getAttribute("data-dialogue-char-reveal") ?? null,
      animationName: style?.animationName ?? "",
      animationDuration: style?.animationDuration ?? "",
    };
  });
}

/**
 * 스크림은 자기 엘리먼트라 상자 표본에 안 잡힌다. 디밍·플래시는 각각 ::before/::after 에
 * 걸려 있어서 요소 자신의 계산된 스타일로는 보이지 않는다 — 의사요소를 직접 읽는다.
 */
async function readScrim(page: Page): Promise<{
  readonly found: boolean;
  readonly siblingOfOverlay: boolean;
  readonly zIndex: string;
  readonly dimOpacity: number;
  readonly dimImage: string;
  readonly flashAnimation: string;
  /** 스크림 사각형이 대사 오버레이와 같은 화면 영역(크롭 보정 포함)을 덮는가. */
  readonly coversOverlayBand: boolean;
}> {
  return page.evaluate(() => {
    const scrim = document.querySelector<HTMLElement>(".dialogue-scrim");
    const overlay = document.querySelector<HTMLElement>(".dialogue-overlay");
    if (!scrim || !overlay) {
      return {
        found: false,
        siblingOfOverlay: false,
        zIndex: "",
        dimOpacity: 0,
        dimImage: "",
        flashAnimation: "",
        coversOverlayBand: false,
      };
    }
    const style = getComputedStyle(scrim);
    const dim = getComputedStyle(scrim, "::before");
    const flash = getComputedStyle(scrim, "::after");
    const scrimBox = scrim.getBoundingClientRect();
    const overlayBox = overlay.getBoundingClientRect();
    return {
      found: true,
      siblingOfOverlay: scrim.parentElement === overlay.parentElement,
      zIndex: style.zIndex,
      dimOpacity: Number.parseFloat(dim.opacity),
      dimImage: dim.backgroundImage,
      flashAnimation: flash.animationName,
      // 오버레이는 화면의 27% 띠다. 스크림은 그보다 높고 좌우는 같아야 한다 —
      // 같은 playSurface.css 규칙이 둘의 크롭 inset 을 맞춘다.
      coversOverlayBand:
        scrimBox.height > overlayBox.height &&
        Math.abs(scrimBox.left - overlayBox.left) < 1 &&
        Math.abs(scrimBox.right - overlayBox.right) < 1 &&
        Math.abs(scrimBox.bottom - overlayBox.bottom) < 1,
    };
  });
}

async function bootRuntime(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await installEnterProbe(page);
  await seedProjectForEditor(page, presentationProject());
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

  // 본문이 글자별 노드로 깔렸고 그 노드가 실제로 연출을 받는다. 노드가 0 이면 증분
  // 렌더러가 배선되지 않은 것이고, animationName 이 none 이면 게이트나 var 가 죽은 것이다.
  const reveal = await readCharReveal(page);
  expect(reveal.count).toBeGreaterThan(NEUTRAL_BODY.length - 2);
  expect(reveal.gate).toBe("1");
  expect(reveal.animationName).toBe("dialogue-char-enter");
  expect(reveal.animationDuration).toBe("0.11s");

  // 스크림은 오버레이의 형제여야 화면을 덮을 수 있다. 오버레이는 27% 띠뿐이다.
  const scrim = await readScrim(page);
  expect(scrim.found, ".dialogue-scrim 이 DOM 에 없다").toBe(true);
  expect(scrim.siblingOfOverlay).toBe(true);
  expect(scrim.zIndex, "대사창(39) 위로 올라가면 스크림이 대사를 덮는다").toBe("38");
  // ::before 가 안 뜨면 --dialogue-scrim-opacity 가 무효거나 게이트가 안 걸린 것이다.
  expect(scrim.dimOpacity).toBe(1);
  expect(scrim.dimImage).toContain("gradient");
  expect(scrim.coversOverlayBand, "스크림이 오버레이와 같은 화면 영역을 안 덮는다").toBe(true);
  await closeMessage(page);

  // 슬픔은 오버슈트 없는 느린 곡선을, 놀람은 강한 팝을 쓴다 — 감정이 실제로 갈린다.
  const sad = await awaitMessage(page, SAD_BODY, "sad");
  expect(sad.emotion).toBe("sad");
  expect(sad.phase).toBe("enter");
  expect(sad.animationName).toBe("dialogue-box-enter-soft");
  expect(sad.animationDuration).toBe("0.26s");
  await closeMessage(page);

  // 분노는 창이 자리잡은 **뒤에** 흔들린다. 진입과 같은 규칙에 넣으면 transform 을 다투고
  // 세션 중간 대사(진입 없이 shown 으로 뜬다)는 아예 안 흔들린다.
  await awaitMessage(page, ANGRY_BODY, "angry");
  const angryBox = page.getByTestId("dialogue-box");
  await expect(angryBox).toHaveAttribute("data-dialogue-shake", "1");
  await expect(angryBox).toHaveAttribute("data-dialogue-phase", "shown");
  const shake = await angryBox.evaluate((node) => {
    const style = getComputedStyle(node);
    return { name: style.animationName, duration: style.animationDuration };
  });
  expect(shake.name).toBe("dialogue-box-shake");
  expect(shake.duration).toBe("0.12s");
  await closeMessage(page);

  const surprised = await awaitMessage(page, SURPRISED_BODY, "surprised");
  expect(surprised.emotion).toBe("surprised");
  expect(surprised.animationName).toBe("dialogue-box-enter-pop");
  expect(surprised.animationDuration).toBe("0.16s");
  // 놀람의 화면 플래시. Phaser 카메라 흔들기는 DOM 대화창에 안 먹으므로 CSS 로 간다.
  expect((await readScrim(page)).flashAnimation).toBe("dialogue-scrim-flash");
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

  // 글자는 여전히 노드로 깔리지만(본문 구조는 연출과 무관하다) 연출은 걸리지 않는다.
  const reveal = await readCharReveal(page);
  expect(reveal.count).toBeGreaterThan(NEUTRAL_BODY.length - 2);
  expect(reveal.gate, "reducedMotion 인데 글자 연출 게이트가 심겼다").toBeNull();
  expect(reveal.animationName).toBe("none");

  // 스크림 디밍은 남는다 — 움직임이 아니라 분위기·대비 신호다.
  const scrim = await readScrim(page);
  expect(scrim.dimOpacity, "reducedMotion 이 스크림 디밍까지 없앴다").toBe(1);
  expect(scrim.flashAnimation).toBe("none");

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
      { kind: "text", speaker: "안내", body: ANGRY_BODY, emotion: "angry" },
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
