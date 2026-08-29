// 임시 진단용(적대적 "전투 재미" 감사). 출하 경로(player.html)로 실전투에 들어가서
//  1. 한 번의 공격 시퀀스를 고속 촬영해 필름스트립을 만들고,
//  2. 그 동안의 오디오 이벤트(샘플 재생 + WebAudio 합성 보이스)를 시각과 함께 기록하고,
//  3. 씬 속성(director step / hit-feel / 모션 클래스)의 실제 지속 시간을 잰다.
// 판정(expect)은 최소한만 둔다 — 목적은 회귀 가드가 아니라 실측 증거 수집이다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test, type Page } from "@playwright/test";
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

const PROJECT_FIXTURE = fileURLToPath(new URL("../fixtures/projects/battle-v3.json", import.meta.url));
const OUT = fileURLToPath(new URL("../../evidence/battle-feel-audit-2026-08-29/", import.meta.url));

type ProbeWindow = Window & {
  __feelAudio?: { t: number; kind: string; detail: string }[];
  __feelT0?: number;
  __oprnDebug?: { setSeed(seed: number): void; readState(): { currentMapId: string; x: number; y: number } };
  __oprnInput?: { face(direction: string): void; action(): void };
};

type Sample = {
  t: number;
  phase: string;
  step: string;
  hitFeel: string;
  busy: string;
  speed: string;
  sceneClasses: string;
  message: string;
  popups: string[];
  animation: string | null;
  animFrame: string | null;
  motions: string[];
};

test.setTimeout(300_000);

test("공격 시퀀스 필름스트립 + 오디오 레이어 실측", async ({ page }) => {
  const server = await startPlayerQaServer();
  try {
    const projectJson = await readFile(PROJECT_FIXTURE, "utf8");
    await mkdir(OUT, { recursive: true });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.addInitScript(() => {
      localStorage.clear();
      (window as Window & { __OPENRPG_BOOT__?: object }).__OPENRPG_BOOT__ = {
        projectUrl: "/__runtime-qa/project.json",
        saveNamespace: "runtime-qa:battle-feel-audit",
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
    await page.screenshot({ path: `${OUT}00-title.png` });
    await page.keyboard.press("Enter");
    await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 120_000 });
    await page.waitForFunction(() => typeof (window as ProbeWindow).__oprnDebug === "object" && (window as ProbeWindow).__oprnDebug !== null, undefined, { timeout: 120_000 });
    await page.waitForFunction(() => {
      const state = (window as ProbeWindow).__oprnDebug?.readState();
      return state?.currentMapId === "map_battle" && state.x === 0 && state.y === 0;
    }, undefined, { polling: "raf", timeout: 30_000 });
    await page.evaluate(() => (window as ProbeWindow).__oprnDebug?.setSeed(7));
    await page.screenshot({ path: `${OUT}01-field.png` });

    // 저작된 전투 이벤트로 진입
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
    // 전투 인트로 컷
    await page.screenshot({ path: `${OUT}02-battle-intro.png` });
    await page.waitForSelector("[data-testid='actor-command-attack']", { state: "visible", timeout: 120_000 });
    await page.screenshot({ path: `${OUT}03-command-menu.png` });

    const readSample = async (): Promise<Sample> => page.evaluate(() => {
      const w = window as ProbeWindow;
      const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
      const anim = scene?.querySelector<HTMLElement>("[data-testid='battle-animation']") ?? null;
      const motions = Array.from(scene?.querySelectorAll<HTMLElement>("[class*='motion'],[class*='juice'],[class*='knockback'],[class*='lunge']") ?? [])
        .flatMap((node) => [...node.classList].filter((name) => /motion|juice|knockback|lunge/.test(name)));
      return {
        t: Math.round(performance.now() - (w.__feelT0 ?? 0)),
        phase: scene?.dataset.battlePhase ?? "",
        step: scene?.dataset.battleDirectorStep ?? "",
        hitFeel: scene?.dataset.battleHitFeel ?? "",
        busy: scene?.dataset.battleSequenceBusy ?? "",
        speed: scene?.dataset.battleSpeed ?? "",
        sceneClasses: [...(scene?.classList ?? [])].filter((name) => name !== "battle-scene").join(" "),
        message: scene?.querySelector("[data-testid='battle-message']")?.textContent?.trim().replace(/\s+/g, " ") ?? "",
        popups: Array.from(scene?.querySelectorAll("[data-testid^='battle-damage'], .battle-damage-popup") ?? [])
          .map((node) => node.textContent?.trim() ?? "").filter(Boolean),
        animation: anim?.dataset.animationName ?? anim?.dataset.animationId ?? null,
        animFrame: anim?.dataset.currentFrame ?? null,
        motions: [...new Set(motions)],
      };
    });

    // 출하 런타임은 키보드 전용 계약이다(포인터 클릭은 씹힌다) — 커서가 Attack 위에 있으므로 확정만 한다.
    await page.keyboard.press("z");
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}04-target-select.png` });

    // 오디오 로그 리셋 후 확정 → 시퀀스 촬영
    await page.evaluate(() => {
      const w = window as ProbeWindow;
      if (w.__feelAudio) w.__feelAudio.length = 0;
      w.__feelT0 = performance.now();
    });
    await page.keyboard.press("z");

    const strip: Sample[] = [];
    for (let i = 0; i < 30; i += 1) {
      const sample = await readSample();
      strip.push(sample);
      await page.screenshot({ path: `${OUT}seq-${String(i).padStart(2, "0")}.png` });
      if (i > 5 && sample.busy === "false") break;
    }
    const audio = await page.evaluate(() => (window as ProbeWindow).__feelAudio ?? []);
    await writeFile(`${OUT}sequence-filmstrip.json`, JSON.stringify(strip, null, 2), "utf8");
    await writeFile(`${OUT}sequence-audio.json`, JSON.stringify(audio, null, 2), "utf8");

    // 이어지는 턴들 — 데미지 팝업 값과 메시지 다양성을 모은다.
    const turns: { popups: string[]; messages: string[]; audio: unknown[] }[] = [];
    for (let turn = 0; turn < 6; turn += 1) {
      const hasCommand = await page.locator("[data-testid='actor-command-attack']").isVisible().catch(() => false);
      if (!hasCommand) break;
      await page.evaluate(() => {
        const w = window as ProbeWindow;
        if (w.__feelAudio) w.__feelAudio.length = 0;
        w.__feelT0 = performance.now();
      });
      await page.keyboard.press("z");
      await page.waitForTimeout(80);
      await page.keyboard.press("z");
      const popups = new Set<string>();
      const messages = new Set<string>();
      for (let i = 0; i < 22; i += 1) {
        const sample = await readSample();
        for (const popup of sample.popups) popups.add(popup);
        if (sample.message) messages.add(sample.message);
        if (i > 4 && sample.busy === "false") break;
      }
      const turnAudio = await page.evaluate(() => (window as ProbeWindow).__feelAudio ?? []);
      turns.push({ popups: [...popups], messages: [...messages], audio: turnAudio });
      if (await page.locator("[data-testid='battle-result-panel']").count()) {
        await page.screenshot({ path: `${OUT}30-result-panel.png` });
        break;
      }
    }
    await writeFile(`${OUT}turns.json`, JSON.stringify(turns, null, 2), "utf8");
    await page.screenshot({ path: `${OUT}31-final.png` });
  } finally {
    await server.close();
  }
});
