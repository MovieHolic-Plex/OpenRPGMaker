/**
 * 쉬운 말 보고서(reports/dialogue-easy/)에 실을 그림을 찍는다.
 * 진단 전용 — `_` 접두사라 기본 스위트에서 제외된다.
 *
 * 판정은 하지 않는다. 계산된 스타일 단정은 `dialogue-presentation-motion.spec.ts`,
 * 이름표 기하는 `dialogue-nameplate-clears-body.spec.ts`, 스크림의 크롭 정합은
 * `npm run qa:runtime -- --scenario dialogue` 가 각각 갖는다. 여기는 그림만 만든다.
 *
 * 얼려 찍는 방법과 그 함정은 `dialogueFreeze.ts` 머리말에 있다.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { enterAnimationName, expectFrozen, freeze, installFreezeWatcher, thaw } from "./dialogueFreeze";
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

const PROJECT_URL = "/__dialogue-easy-report/project.json";

let server: Awaited<ReturnType<typeof startPlayerQaServer>>;

test.beforeAll(async () => {
  server = await startPlayerQaServer();
});

test.afterAll(async () => {
  await server.close();
});

/** 타자가 다 찼다는 신호. 고정 대기 대신 이것을 기다린다 — 상자에 `page-ready` 가 붙는다. */
async function settled(page: Page): Promise<void> {
  await expect(page.getByTestId("dialogue-box")).toHaveClass(/page-ready/, { timeout: 30_000 });
}

const DIR = "reports/dialogue-easy/shots";

test.setTimeout(300_000);
test.use({ serviceWorkers: "block" });

/** 감정마다 말투가 드러나는 대사. 앞부분이 서로 달라야 어느 대사인지 기다릴 수 있다. */
const LINES = [
  { emotion: "neutral", speaker: "마을 사람", body: "마을에 온 걸 환영해. 여기가 우리 광장이야.", wait: "환영해" },
  { emotion: "happy", speaker: "마을 사람", body: "드디어 왔구나! 계속 기다리고 있었어!", wait: "드디어" },
  { emotion: "sad", speaker: "마을 사람", body: "…그날 이후로, 아무도 종을 울리지 않았어.", wait: "그날 이후로" },
  { emotion: "angry", speaker: "마을 사람", body: "그 이름을 여기서 다시 꺼내지 마!", wait: "꺼내지 마" },
  { emotion: "surprised", speaker: "마을 사람", body: "뭐라고?! 종이 다시 울렸다고?!", wait: "울렸다고" },
] as const;

async function shot(page: Page, name: string): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await page.screenshot({ path: `${DIR}/${name}.png` });
}

/**
 * 게임 화면만 자른다. 스크림이 지도를 얼마나 가라앉히는지는 **에디터 UI 를 뺀 자리**에서
 * 재야 한다 — 전체 화면 사진으로 재면 위쪽 밝기에 에디터 툴바가 섞여 들어간다
 * (실측 2026-08-30: 그렇게 재면 위쪽 평균이 166 으로 나오는데 지도는 그만큼 밝지 않다).
 */
async function viewportShot(page: Page, name: string): Promise<void> {
  await mkdir(DIR, { recursive: true });
  // 요소 스크린샷이 아니라 clip 이다 — 요소 스크린샷은 움직임이 멈추기를 기다려서
  // 얼려 놓은 프레임(플래시)에서 쓸 수 없다. clipShot 머리말 참고.
  const rect = await page.getByTestId("play-viewport").boundingBox();
  if (!rect) throw new Error("play-viewport 자리를 못 쟀다");
  await page.screenshot({ path: `${DIR}/${name}.png`, clip: rect });
}

/** 상자만 자른다. 글자 한 칸씩 밝아지는 선두는 전체 화면 축소에서 안 보인다. */
async function boxShot(page: Page, name: string): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await page.getByTestId("dialogue-box").screenshot({ path: `${DIR}/${name}.png` });
}

/**
 * 미리 잰 자리를 페이지 스크린샷에서 오린다.
 *
 * **요소 스크린샷으로는 타자 중간을 잡을 수 없다.** Playwright 의 요소 스크린샷은 찍기 전에
 * "요소가 두 프레임 연속 같은 자리에 있을 때까지" 기다린다. 대화창은 뜨는 동안 크기가
 * 변하므로 그 대기가 진입 연출이 끝날 때까지 늘어나고, 그 사이 타자도 끝나 버린다.
 * 실측(2026-08-30): `waitForTimeout(120|260|1400)` 뒤에 요소 스크린샷으로 찍은 세 장은
 * 본문이 **화소 단위로 동일**했고 오른쪽 아래 ▼ 맥동만 달랐다. 페이지 스크린샷은 그 대기가
 * 없으므로 자리를 미리 재 두고 오리면 중간 프레임이 잡힌다.
 */
async function clipShot(page: Page, name: string, clip: Clip): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await page.screenshot({ path: `${DIR}/${name}.png`, clip });
}

type Clip = { x: number; y: number; width: number; height: number };

/** 상자가 제자리에 있을 때 자리를 잰다. 타자 중에는 상자 크기가 변하지 않는다 — 글자를 미리 다 깔기 때문이다. */
async function measureBox(page: Page): Promise<Clip> {
  const box = await page.getByTestId("dialogue-box").boundingBox();
  if (!box) throw new Error("대화창 자리를 재지 못했다");
  return box;
}

/**
 * 글자가 다 찬 뒤에 넘긴다. **첫 Enter 는 넘기기가 아니라 "타자 건너뛰기" 로 먹힌다** —
 * 타자 중에 누르면 그 줄이 즉시 완성되고 창은 그대로 남는다(실측 2026-08-30). 타자가
 * 끝나면 상자에 `page-ready` 가 붙고 ▼ 가 뜬다. 그걸 기다린 뒤 눌러야 한 번에 넘어간다.
 */
async function advance(page: Page, expectText: string): Promise<void> {
  await expect(page.getByTestId("dialogue-box")).toHaveClass(/page-ready/, { timeout: 30_000 });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("dialogue-box")).toContainText(expectText, { timeout: 30_000 });
}

async function boot(page: Page, project: Project, armed: Parameters<typeof installFreezeWatcher>[1]): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  // 게임 화면 샷은 편집기 셸을 지나지 않는다(AGENTS.md 하드 룰). 편집기 play 모드는 톱바를
  // 남기고 편집기 번들·DB 연결을 태우며 실제 @/project/store 를 쓴다 — 출하되는 내보내기
  // 플레이어는 exportProjectStoreShim 을 타므로 그 경로로 찍으면 출하물이 아니다.
  await page.addInitScript(([projectUrl]) => {
    localStorage.clear();
    (window as any).__OPENRPG_BOOT__ = {
      projectUrl,
      saveNamespace: "dialogue-easy-report",
      qaInstrumentation: true,
    };
  }, [PROJECT_URL]);
  await page.route(`**${PROJECT_URL}`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(project) }),
  );
  // 얼음은 부팅 전에 걸어야 한다 — 첫 대사의 진입은 맵이 뜨는 순간 시작한다.
  await installFreezeWatcher(page, armed);
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  // startNewGameFromTitle 은 쓰지 않는다 — title.or(stage) 로 기다리는데 player.html 은 타이틀과
  // 무대가 **동시에** 살아 있어 strict mode 위반이 난다(편집기 경로에서는 하나만 뜨다).
  await page.getByTestId("title-screen").waitFor({ timeout: 90_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => typeof (window as any).__oprnDebug?.readState === "function", null, {
    timeout: 90_000,
  });
}

test("감정 5종의 진입·정착 프레임을 찍는다", async ({ page }) => {
  // 첫 대사는 맵이 뜨는 순간 시작하므로 얼음을 **부팅 전에** 걸어 둔다.
  const first = LINES[0];
  await boot(page, easyProject(), { name: enterAnimationName(first.emotion), fraction: 0.58, pinPhase: "enter" });
  await expect(page.getByTestId("dialogue-box")).toBeVisible({ timeout: 30_000 });

  for (const [index, line] of LINES.entries()) {
    if (index > 0) {
      // 다음 대사의 얼음을 **넘기기 전에** 걸어야 한다. 진입은 창이 뜨는 순간 시작한다.
      await freeze(page, { name: enterAnimationName(line.emotion), fraction: 0.58, pinPhase: "enter" });
      await advance(page, line.wait);
    }
    await expectFrozen(page, enterAnimationName(line.emotion));
    const tag = `${index + 1}${line.emotion}`;
    await boxShot(page, `enter-${tag}-crop`);
    if (index === 0) await shot(page, "enter-1neutral-full");

    // 같은 대사의 정착. 얼음을 풀고 글자가 다 차기를 기다린다.
    await thaw(page);
    // 감정마다 타자 길이가 달라 고정 대기로는 맞출 수 없다 — 상자가 page-ready 를 달 때까지 기다린다.
    await settled(page);
    await boxShot(page, `settled-${tag}-crop`);
    if (index === 0) {
      await shot(page, "settled-1neutral-full");
      await viewportShot(page, "settled-1neutral-play");
    }
  }

  // 창이 없는 같은 화면. 스크림이 맵을 얼마나 가라앉히는지는 이 그림과 나란히 놓아야 보인다.
  await expect(page.getByTestId("dialogue-box")).toHaveClass(/page-ready/, { timeout: 30_000 });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("dialogue-box")).toBeHidden({ timeout: 30_000 });
  await shot(page, "no-dialogue-full");
  await viewportShot(page, "no-dialogue-play");
});

test("글자가 차오르는 세 단계를 찍는다", async ({ page }) => {
  // 타자는 얼리지 않는다. 얼음은 CSS 연출만 멈추고 타자는 자기 타이머로 돈다.
  // 대신 **페이지 스크린샷을 오려** 찍는다 — 요소 스크린샷은 움직임이 멈추기를 기다려서
  // 타자 중간을 못 잡는다. clipShot 머리말 참고.
  await boot(page, slowTypingProject(), null);
  await expect(page.getByTestId("dialogue-box")).toBeVisible({ timeout: 30_000 });

  // 진입 연출이 끝나기를 기다린 뒤 자리를 잰다. 부풀어 있는 동안 재면 오려낸 틀이 어긋난다.
  // 고정 대기가 아니라 타자 완료 신호를 쓴다 — 진입이 끝나야 타자가 찬다.
  await settled(page);
  const clip = await measureBox(page);

  // 시계로 재지 않고 **렌더러가 붙인 글자 수**에 걸어 찍는다. 글자는 span.dialogue-char 로
  // 하나씩 덧붙는다(dialogueTextRenderer.ts — 미리 다 깔고 opacity 로 켜는 방식이 아니다).
  // 세 수는 본문에 심은 정지 구간과 같은 자리다. 그 구간 안에서 찍으므로 지연이 끼어도
  // 같은 칸이 나온다.
  const names = ["typing-1-early", "typing-2-mid", "typing-3-done"] as const;
  for (const [index, name] of names.entries()) {
    const count = TYPING_STOPS[index]!;
    await page.waitForFunction(
      (n) => document.querySelectorAll('[data-testid="dialogue-box"] .body .dialogue-char').length >= n,
      count,
      { timeout: 30_000 }
    );
    await clipShot(page, `${name}-crop`, clip);
  }
});

test("흔들림·플래시·퇴장 프레임을 찍는다", async ({ page }) => {
  await boot(page, easyProject(), null);
  await expect(page.getByTestId("dialogue-box")).toBeVisible({ timeout: 30_000 });

  // 분노까지 넘긴다. 흔들림은 진입이 끝나고 phase="shown" 이 되는 순간 시작한다.
  // 0.22 는 좌측 최대 변위 프레임이다(keyframes: 22% 에서 -3px, 48% 에서 +3px —
  // 중간을 잡으면 제자리로 보인다).
  for (const line of LINES.slice(1, 3)) await advance(page, line.wait);
  await freeze(page, { name: "dialogue-box-shake", fraction: 0.22 });
  await advance(page, "꺼내지 마");
  await expectFrozen(page, "dialogue-box-shake");
  await boxShot(page, "shake-crop");
  await shot(page, "shake-full");

  // 놀람의 플래시는 스크림 ::after 에 있어 상자 크롭에는 안 잡힌다 — 전체 화면으로 찍는다.
  await thaw(page);
  await freeze(page, { name: "dialogue-scrim-flash", fraction: 0.18 });
  await advance(page, "울렸다고");
  await expectFrozen(page, "dialogue-scrim-flash");
  await shot(page, "flash-full");
  await viewportShot(page, "flash-play");

  // 번쩍임이 얼마나 밝히는지는 **같은 대사의 안 번쩍이는 프레임**과 비교해야 한다.
  // 다른 감정의 정착 프레임과 비교하면 감정별로 다른 스크림 농도가 숫자에 섞인다.
  await thaw(page);
  await settled(page);
  await viewportShot(page, "flash-baseline-play");

  // 퇴장 프레임은 **이 방법으로 못 찍는다**(실측 2026-08-30). 얼음은 CSS 애니메이션만
  // 멈추고, 상자를 DOM 에서 빼는 것은 cleanup() 이 예약한 setTimeout 이다 — 그 타이머는
  // 그대로 흘러 120ms 뒤 상자가 사라지므로 찍을 대상이 없어진다. phase 를 되돌려 붙여도
  // 마찬가지다(속성이 아니라 타이머가 지우는 것이다). 퇴장을 그림으로 남기려면 테스트가
  // 아니라 소스의 지속시간을 늘려야 하므로, 보고서는 퇴장만 글로 설명한다.
});

test("움직임을 끈 화면을 찍는다", async ({ page }) => {
  // 시스템이 "움직임 줄이기" 인 사용자가 보는 화면. 창은 그대로 떠야 한다.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await boot(page, easyProject(), { name: "dialogue-box-enter-fade", fraction: 0.5, pinPhase: "enter" });
  await expect(page.getByTestId("dialogue-box")).toBeVisible({ timeout: 30_000 });
  await expectFrozen(page, "dialogue-box-enter-fade");
  await boxShot(page, "reduced-motion-enter-crop");
  await thaw(page);
  await settled(page);
  await shot(page, "reduced-motion-settled-full");
});

/**
 * 타자 중간 프레임 전용 프로젝트. 대사 한 줄에 제어 문자를 두 종류 심는다.
 *
 *  - `\s[20]` — 글자당 160ms. 기본보다 훨씬 느리다.
 *  - `\|` — 타자를 1초 멈춘다. 사진을 찍을 **정지 구간**을 만드는 장치다.
 *
 * **왜 이렇게까지 하나.** 기본 속도에서 이 대사는 약 400ms 만에 다 찍히는데, 스크린샷 한 장에
 * 그만한 시간이 든다. "6글자에서 찍어라" 라고 걸어도 필름에 남는 건 81~100% 였다(실측
 * 2026-08-30). 시계로 재도, 글자 수로 걸어도 안 된다 — 찍는 지연이 연출보다 길면 어떻게 걸어도
 * 못 잡는다. 속도를 늦추면 지연이 여섯 글자쯤으로 줄지만 여전히 흔들린다. `\|` 로 타자를
 * 세워 두면 그 구간 안에서는 몇 번을 찍어도 같은 칸이 나온다.
 *
 * 늦춘 것도 세운 것도 **찍기 위한 장치**이고, 보고서에도 그렇게 적는다. 렌더러와 글자 연출
 * 자체는 손대지 않았다 — 두 제어 문자 모두 원래 있는 기능이다(dialogue.ts 의 제어 문자 표).
 */
const TYPING_LINE = { emotion: "sad", speaker: "마을 사람", body: "…그날 이후로, 아무도 종을 울리지 않았어." } as const;
const TYPING_CHARS = Array.from(TYPING_LINE.body).length;
/** 정지 구간을 심은 실제 본문. 멈추는 자리가 곧 사진 세 장의 글자 수다. */
const TYPING_BODY = "\\s[20]…그날 이후로,\\|\\| 아무도 종을 울리지\\|\\| 않았어.";
/** "…그날 이후로," 8 자, " 아무도 종을 울리지" 를 더해 18 자, 나머지를 더해 전문. */
const TYPING_STOPS = [8, 18, TYPING_CHARS] as const;

function slowTypingProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("blank project start map is missing");
  map.events.push(
    autoEvent("ev_typing", 2, 2, [
      { kind: "text", speaker: TYPING_LINE.speaker, body: TYPING_BODY, emotion: TYPING_LINE.emotion } as Command,
      { kind: "wait", ms: 120_000 } as Command,
    ])
  );
  return project;
}

function easyProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("blank project start map is missing");
  // 대사 사이에 wait 를 끼운다. cleanup() 이 예약한 퇴장이 만료되어 창이 닫히고, 다음 대사는
  // 빈 오버레이를 만나 **새 세션으로** 진입 연출을 다시 재생한다 — 그래서 감정마다 진입
  // 프레임을 따로 잡을 수 있다. 마지막 wait 는 auto 이벤트가 처음으로 되돌아오는 것을 막는
  // 주차용이다.
  const commands: Command[] = [];
  for (const line of LINES) {
    commands.push({
      kind: "text",
      speaker: line.speaker,
      body: line.body,
      ...(line.emotion === "neutral" ? {} : { emotion: line.emotion }),
    } as Command);
    commands.push({ kind: "wait", ms: 400 } as Command);
  }
  commands.push({ kind: "wait", ms: 120_000 } as Command);
  map.events.push(autoEvent("ev_easy", 2, 2, commands));
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
