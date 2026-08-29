// 진단/증거 수집용(전투 재미 감사 후속 검증). 출하 경로(player.html)로 실전투에 들어가
// 공격 시퀀스를 **연속 프레임으로 촬영**한다. 프레임은 evidence/ 아래 PNG 시퀀스로
// 떨어지고, scripts/make-battle-gifs.mjs 가 ffmpeg 로 GIF 로 묶는다.
//
// 판정(expect)은 감사에서 고친 항목의 최소 회귀 가드만 둔다 — 목적은 실측 증거다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

const PROJECT_FIXTURE = fileURLToPath(new URL("../fixtures/projects/battle-v3.json", import.meta.url));
const OUT = fileURLToPath(new URL("../../evidence/battle-feel-after-2026-08-29/", import.meta.url));

type ProbeWindow = Window & {
  __feelAudio?: { t: number; kind: string; detail: string }[];
  __feelT0?: number;
  __oprnDebug?: { setSeed(seed: number): void; readState(): { currentMapId: string; x: number; y: number } };
  __oprnInput?: { face(direction: string): void; action(): void };
};

type Sample = {
  t: number;
  step: string;
  hitFeel: string;
  busy: string;
  skipping: string;
  message: string;
  popups: string[];
  animation: string | null;
  hpRevealed: string[];
  motions: string[];
  msgBox: Record<string, unknown> | null;
};

test.setTimeout(600_000);

// GIF 소재는 스크린샷 연사(프레임당 ~340ms)로는 부족하다 — 브라우저 영상을 그대로
// 받아서 ffmpeg 로 GIF 로 묶는다(scripts/make-battle-gifs.mjs).
test.use({ video: { mode: "on", size: { width: 1024, height: 768 } } });

async function readSample(page: Page): Promise<Sample> {
  return page.evaluate(() => {
    const w = window as ProbeWindow;
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
    const anim = scene?.querySelector<HTMLElement>("[data-testid='battle-animation']")
      ?? scene?.querySelector<HTMLElement>(".battle-animation-layer [data-animation-name],[data-animation-id]")
      ?? null;
    const motions = Array.from(scene?.querySelectorAll<HTMLElement>("[class*='motion'],[class*='juice'],[class*='knockback'],[class*='lunge']") ?? [])
      .flatMap((node) => [...node.classList].filter((name) => /motion|juice|knockback|lunge/.test(name)));
    return {
      t: Math.round(performance.now() - (w.__feelT0 ?? 0)),
      step: scene?.dataset.battleDirectorStep ?? "",
      hitFeel: scene?.dataset.battleHitFeel ?? "",
      busy: scene?.dataset.battleSequenceBusy ?? "",
      skipping: scene?.dataset.battleSkipping ?? "",
      message: scene?.querySelector("[data-testid='battle-message']")?.textContent?.trim().replace(/\s+/g, " ")
        ?? scene?.querySelector(".battle-message-lines")?.textContent?.trim().replace(/\s+/g, " ") ?? "",
      popups: Array.from(scene?.querySelectorAll("[data-testid^='battle-damage'], .battle-damage-popup") ?? [])
        .map((node) => node.textContent?.trim() ?? "").filter(Boolean),
      animation: anim?.dataset.animationName ?? anim?.dataset.animationId ?? null,
      hpRevealed: Array.from(scene?.querySelectorAll<HTMLElement>(".battle-enemy[data-battle-hp-revealed='true']") ?? [])
        .map((node) => node.querySelector(".battle-enemy-hp-text")?.textContent?.trim() ?? ""),
      motions: [...new Set(motions)],
      msgBox: (() => {
        const win = scene?.querySelector<HTMLElement>(".battle-message-window");
        if (!win) return null;
        const style = getComputedStyle(win);
        const clippers: string[] = [];
        for (let node = win.parentElement; node; node = node.parentElement) {
          const parentStyle = getComputedStyle(node);
          if (parentStyle.overflowY !== "visible") {
            clippers.push(`${node.className || node.tagName}:${parentStyle.overflowY}:${Math.round(node.getBoundingClientRect().height)}`);
          }
        }
        return {
          client: win.clientHeight,
          scroll: win.scrollHeight,
          rect: Math.round(win.getBoundingClientRect().height),
          position: style.position,
          overflowY: style.overflowY,
          fontSize: style.fontSize,
          lineFontSize: getComputedStyle(win.querySelector(".battle-message-line") ?? win).fontSize,
          minHeight: style.minHeight,
          maxHeight: style.maxHeight,
          clippers,
        };
      })(),
    };
  });
}

test("공격 시퀀스 연속 촬영 + 오디오 레이어(수정 후)", async ({ page }) => {
  // 영상 트리밍 기준시각. 영상 녹화는 컨텍스트 생성 시점(=이 줄 직전)에 시작한다.
  const videoStart = Date.now();
  const marks: Record<string, number> = {};
  const mark = (name: string): void => {
    marks[name] = (Date.now() - videoStart) / 1000;
  };
  const server = await startPlayerQaServer();
  try {
    // 픽스처는 용어를 Attack/Skill/Item 으로만 덮어써 커맨드가 영·한 혼용으로 보였다.
    // 용어 사전에 defend/escape 가 들어왔으니, 여기서는 한국어로 통일해 촬영한다.
    const project = JSON.parse(await readFile(PROJECT_FIXTURE, "utf8")) as {
      meta: { terms: Record<string, string> };
    };
    project.meta.terms = {
      ...project.meta.terms,
      attack: "공격",
      skill: "스킬",
      item: "아이템",
      defend: "방어",
      escape: "도주",
      level: "Lv",
    };
    const projectJson = JSON.stringify(project);

    await mkdir(OUT, { recursive: true });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.addInitScript(() => {
      localStorage.clear();
      (window as Window & { __OPENRPG_BOOT__?: object }).__OPENRPG_BOOT__ = {
        projectUrl: "/__runtime-qa/project.json",
        saveNamespace: "runtime-qa:battle-feel-after",
        qaInstrumentation: true,
      };
      const w = window as ProbeWindow;
      w.__feelAudio = [];
      w.__feelT0 = performance.now();
      const log = (kind: string, detail: string): void => {
        w.__feelAudio?.push({ t: Math.round(performance.now() - (w.__feelT0 ?? 0)), kind, detail });
      };
      const NativeAudio = window.Audio;
      const Patched = function PatchedAudio(src?: string) {
        const audio = new NativeAudio(src);
        const play = audio.play.bind(audio);
        audio.play = () => {
          log("sample", (audio.src || src || "").split("/").pop() ?? "");
          return play();
        };
        return audio;
      } as unknown as typeof window.Audio;
      Patched.prototype = NativeAudio.prototype;
      window.Audio = Patched;
      if (typeof AudioContext !== "undefined") {
        const osc = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function patchedOsc() {
          log("synth-tone", "oscillator");
          return osc.call(this);
        };
        const buffer = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function patchedBuffer() {
          log("synth-noise", "bufferSource");
          return buffer.call(this);
        };
      }
    });
    await page.route("**/__runtime-qa/project.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: projectJson }),
    );

    await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
    await page.keyboard.press("Enter");
    await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 120_000 });
    await page.waitForFunction(
      () => typeof (window as ProbeWindow).__oprnDebug === "object" && (window as ProbeWindow).__oprnDebug !== null,
      undefined,
      { timeout: 120_000 },
    );
    await page.waitForFunction(() => {
      const state = (window as ProbeWindow).__oprnDebug?.readState();
      return state?.currentMapId === "map_battle" && state.x === 0 && state.y === 0;
    }, undefined, { polling: "raf", timeout: 30_000 });
    await page.evaluate(() => (window as ProbeWindow).__oprnDebug?.setSeed(7));

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await page.evaluate(() => {
        const w = window as ProbeWindow;
        w.__oprnInput?.face("right");
        w.__oprnInput?.action();
      });
      try {
        await page.waitForSelector("[data-testid='battle-scene']", { state: "visible", timeout: 1_500 });
        break;
      } catch { /* 액션 엣지 재시도 */ }
    }
    await page.waitForSelector("[data-testid='actor-command-attack']", { state: "visible", timeout: 120_000 });
    mark("commandMenu");
    await page.screenshot({ path: `${OUT}10-command-menu.png` });

    const commandLabels = await page.locator("button.battle-command").allTextContents();

    // 대상 선택
    await page.keyboard.press("z");
    await page.waitForTimeout(140);
    await page.screenshot({ path: `${OUT}11-target-select.png` });

    // ── 컷 A: 공격 1회를 실시간 그대로 녹화한다(스크린샷 없이 = GIF 소스) ────
    // 스크린샷을 찍으면 프레임마다 수백 ms 가 늘어나 영상이 늘어진다.
    // 그래서 GIF 용 구간은 키 입력 + 대기만으로 만들고, 계측용 필름스트립은 다음 턴에 찍는다.
    await page.evaluate(() => {
      const w = window as ProbeWindow;
      if (w.__feelAudio) w.__feelAudio.length = 0;
      w.__feelT0 = performance.now();
    });
    mark("cutAStart");
    await page.keyboard.press("z");
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-testid='battle-scene']")
          ?.getAttribute("data-battle-sequence-busy") === "true",
      undefined,
      { timeout: 5_000 },
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-testid='battle-scene']")
          ?.getAttribute("data-battle-sequence-busy") === "false",
      undefined,
      { timeout: 20_000 },
    );
    await page.waitForTimeout(500);
    mark("cutAEnd");
    const audio = await page.evaluate(() => (window as ProbeWindow).__feelAudio ?? []);

    // ── 계측용 필름스트립: 같은 공격을 프레임 단위로 뜯어본다(영상 구간 아님) ──
    await page.keyboard.press("z");
    await page.waitForTimeout(90);
    await page.keyboard.press("z");

    const strip: Sample[] = [];
    for (let i = 0; i < 44; i += 1) {
      const sample = await readSample(page);
      strip.push(sample);
      await page.screenshot({ path: `${OUT}cutA-${String(i).padStart(3, "0")}.png` });
      if (i > 6 && sample.busy === "false") break;
    }

    // ── 컷 B: 빨리감기 — 연출 중 확인 키를 눌러 남은 재생을 건너뛴다 ────────
    // 앞 절반은 스크린샷 없이 실시간 녹화(GIF 소스), 상태 표본은 얕게만 뜬다.
    const skipStrip: Sample[] = [];
    let skipObserved = false;
    mark("cutBStart");
    if (await page.locator("[data-testid='actor-command-attack']").isVisible().catch(() => false)) {
      await page.keyboard.press("z");
      await page.waitForTimeout(90);
      await page.keyboard.press("z");
      await page.waitForTimeout(220);
      await page.keyboard.press("z"); // 연출 중 빨리감기 발동
      for (let i = 0; i < 40; i += 1) {
        const sample = await readSample(page);
        if (sample.skipping === "true") skipObserved = true;
        skipStrip.push(sample);
        if (i > 2 && sample.busy === "false") break;
      }
      await page.screenshot({ path: `${OUT}cutB-tail.png` });
    }
    await page.waitForTimeout(300);
    mark("cutBEnd");
    // ── 컷 C: 전투 끝까지 — 적 HP 게이지가 계속 노출되는지 + 결과 화면 ──────
    mark("cutCStart");
    const cutC: Sample[] = [];
    for (let turn = 0; turn < 8; turn += 1) {
      if (!(await page.locator("[data-testid='actor-command-attack']").isVisible().catch(() => false))) break;
      await page.keyboard.press("z");
      await page.waitForTimeout(90);
      await page.keyboard.press("z");
      for (let i = 0; i < 60; i += 1) {
        const sample = await readSample(page);
        cutC.push(sample);
        if (i > 2 && sample.busy === "false") break;
      }
      await page.screenshot({ path: `${OUT}cutC-turn${String(turn)}.png` });
      if (await page.locator("[data-testid='battle-result-panel']").count()) break;
    }
    await page.waitForTimeout(1_400);
    mark("cutCEnd");
    await page.screenshot({ path: `${OUT}90-result.png` });

    await writeFile(`${OUT}cutA-filmstrip.json`, JSON.stringify(strip, null, 2), "utf8");
    await writeFile(`${OUT}cutA-audio.json`, JSON.stringify(audio, null, 2), "utf8");
    await writeFile(`${OUT}cutB-skip.json`, JSON.stringify(skipStrip, null, 2), "utf8");
    await writeFile(`${OUT}cutC-turns.json`, JSON.stringify(cutC, null, 2), "utf8");
    await writeFile(`${OUT}summary.json`, JSON.stringify({
      commandLabels,
      skipObserved,
      audioEventsForOneHit: audio.length,
      animationSeen: strip.some((sample) => sample.animation !== null),
      hpRevealedSeen: [...strip, ...cutC].some((sample) => sample.hpRevealed.length > 0),
      framesCutA: strip.length,
      framesCutB: skipStrip.length,
      framesCutC: cutC.length,
      marks,
    }, null, 2), "utf8");

    // ── 최소 회귀 가드 ────────────────────────────────────────────────────
    // F02: 한 번의 타격에 소리가 겹치지 않는다. 예전 실측은 4겹(26/592/593/594ms)이었다.
    const impactWindow = audio.filter((event) => event.t >= 200);
    expect(impactWindow.length, `타격 오디오가 겹쳤다: ${JSON.stringify(impactWindow)}`).toBeLessThanOrEqual(2);
    // F12: 커맨드 라벨 언어가 섞이지 않는다.
    expect(commandLabels.join(" ")).not.toMatch(/Attack|Skill|Item/);
    // F01: 통상공격에 애니메이션이 실린다(예전에는 전 구간 null 이었다).
    expect(strip.some((sample) => sample.animation !== null)).toBe(true);
    // F08: 메시지 창이 두 줄을 잘라먹지 않는다(rm2003 클래식은 44px 고정이었다).
    const clipped = strip
      .map((sample) => sample.msgBox as { client: number; scroll: number } | null)
      .filter((box): box is { client: number; scroll: number } => Boolean(box) && box!.client > 0)
      .filter((box) => box.scroll > box.client);
    expect(clipped, `메시지 창이 잘렸다: ${JSON.stringify(clipped)}`).toEqual([]);
    // F07: 피해를 입은 적의 HP 가 화면에 계속 보인다.
    expect([...strip, ...cutC].some((sample) => sample.hpRevealed.length > 0)).toBe(true);
  } finally {
    // 영상 파일 경로를 증거 디렉터리에 남긴다(GIF 변환 스크립트가 읽는다).
    const videoPath = await page.video()?.path().catch(() => undefined);
    if (videoPath) await writeFile(`${OUT}video-path.txt`, videoPath, "utf8");
    await server.close();
  }
});
