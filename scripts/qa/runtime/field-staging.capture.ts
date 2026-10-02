// 필드 연출 캡처 — 레터박스·감정·폭발 파티클·흔들기·쓰러짐·유령·잔상·불티를 출하 플레이어(player.html)에서 돌린다.
//
// 컷신은 조수와 같은 경로(runTool "script_cutscene")로 만든다 — 비트 → 명령 컴파일·명령 형식 검사까지 실제로 지난다.
// 단계마다 세션 값(레터박스·모습 효과)이 바뀐 뒤 찍는다.
//
// 사용: npx tsx scripts/qa/runtime/field-staging.capture.ts --out /tmp/field-staging
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { runTool } from "@/editor/tools";
import type { Project } from "@/project/types";
// @ts-expect-error — mjs 도우미(타입 없음)
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SOURCE = join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json");
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";

const HOLD = 1400;
const BEATS = [
  { kind: "letterbox", size: 12, durationMs: 500, wait: true },
  { kind: "emote", target: "ev_lantern_elder", emote: "exclamation", durationMs: 1400, wait: true },
  { kind: "parallel", beats: [
    { kind: "particles", preset: "explosion", x: 14, y: 16, durationMs: 700 },
    { kind: "shake", intensity: 6, axis: "both", durationMs: 600 },
    { kind: "flash", color: "white", durationMs: 200 },
  ] },
  { kind: "wait", ms: 260 },
  { kind: "look", target: "ev_lantern_elder", pose: "fallen", tint: "gray" },
  { kind: "particles", preset: "dust", target: "ev_lantern_elder", durationMs: 500 },
  { kind: "wait", ms: HOLD },
  { kind: "look", target: "ev_lantern_healer", pose: "float", alpha: 0.6, tint: "blue" },
  { kind: "particles", preset: "magic", target: "ev_lantern_healer", durationMs: 2600 },
  { kind: "wait", ms: HOLD },
  { kind: "look", target: "player", afterimage: true },
  { kind: "particles", preset: "sparkle", target: "player", durationMs: 2000 },
  { kind: "moveActor", target: "player", moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "right" }, { kind: "move", dir: "right" }], wait: true },
  { kind: "particles", preset: "fire", target: "ev_lantern_scout", durationMs: 3000 },
  { kind: "particles", preset: "smoke", target: "ev_lantern_training", durationMs: 3000 },
  { kind: "wait", ms: HOLD },
  { kind: "shake", intensity: 3, axis: "vertical", durationMs: 800 },
  { kind: "wait", ms: 600_000 },
];

const STEPS = [
  { id: "letterbox", label: "레터박스 들어옴", waitFor: "letterbox", delayMs: 500 },
  { id: "emote", label: "감정 말풍선 — 놀람", waitFor: "letterbox", delayMs: 900 },
  { id: "explosion", label: "폭발 파티클 + 흔들기 + 번쩍임", waitFor: "explosion", delayMs: 0, shots: 4, gapMs: 90 },
  { id: "fallen", label: "쓰러짐(회색) + 흙먼지", waitFor: "fallen", delayMs: 250 },
  { id: "ghost", label: "유령 — 둥실·반투명·파랑 + 마법 기운", waitFor: "ghost", delayMs: 700, shots: 2, gapMs: 400 },
  { id: "afterimage", label: "주인공 잔상 이동 + 반짝임", waitFor: "afterimage", delayMs: 250, shots: 3, gapMs: 140 },
  { id: "fire", label: "불티·연기", waitFor: "fire", delayMs: 700, shots: 2, gapMs: 300 },
];

async function buildProject(): Promise<string> {
  const project = JSON.parse(await readFile(SOURCE, "utf8")) as Project;
  // runTool 은 초안을 새 객체로 바꿔 ctx.project 에 돌려준다 — 원래 객체를 직렬화하면 컷신이 없다.
  const ctx = { project };
  const result = runTool(ctx, "script_cutscene", {
    mapId: project.startMapId, x: 2, y: 2, trigger: "auto", once: true, eventId: "ev_staging_demo", beats: BEATS,
  });
  if (!result.ok) throw new Error(`script_cutscene 실패: ${JSON.stringify(result)}`);
  return JSON.stringify(ctx.project);
}

const outArg = process.argv.indexOf("--out");
const outDir = resolve(outArg >= 0 ? process.argv[outArg + 1]! : "/tmp/field-staging");
await mkdir(outDir, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const report: { steps: unknown[]; errors: string[] } = { steps: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  page.on("pageerror", (error) => report.errors.push(String(error?.message ?? error)));
  page.on("console", (message) => { if (message.type() === "error") report.errors.push(`console.error: ${message.text()}`); });
  const projectJson = await buildProject();
  await page.addInitScript(([projectUrl]) => {
    try { localStorage.clear(); } catch { /* 그대로 */ }
    (window as unknown as { __OPENRPG_BOOT__: unknown }).__OPENRPG_BOOT__ = { projectUrl, saveNamespace: "field-staging", qaInstrumentation: true };
  }, [PROJECT_URL]);
  await page.route(PROJECT_ROUTE, (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");

  const conditions: Record<string, string> = {
    letterbox: "Number(document.querySelector(\"[data-testid='runtime-letterbox-top']\")?.dataset.percent ?? 0) > 0",
    explosion: "(window.__oprnHooksScene?.children?.list ?? []).some((o) => o.type === 'ParticleEmitter' && o.texture?.key === 'oprn-fx-dot')",
    fallen: "Boolean(window.__oprnHooksScene?.session?.m2Runtime?.screen?.spriteLooks && Object.values(window.__oprnHooksScene.session.m2Runtime.screen.spriteLooks).some((l) => l.pose === 'fallen'))",
    ghost: "Object.values(window.__oprnHooksScene?.session?.m2Runtime?.screen?.spriteLooks ?? {}).some((l) => l.pose === 'float')",
    afterimage: "Boolean(window.__oprnHooksScene?.session?.m2Runtime?.screen?.spriteLooks?.player?.afterimage)",
    fire: "(window.__oprnHooksScene?.children?.list ?? []).some((o) => o.type === 'ParticleEmitter' && o.texture?.key === 'oprn-fx-puff')",
  };
  if (process.argv.includes("--debug")) {
    await page.waitForTimeout(8000);
    await page.screenshot({ path: join(outDir, "debug.png") });
    const debug = await page.evaluate(() => {
      const scene = (window as unknown as { __oprnHooksScene: any }).__oprnHooksScene;
      return {
        mapId: scene?.session?.currentMapId, screen: scene?.session?.m2Runtime?.screen,
        fallbacks: scene?.session?.m2Runtime?.fallbacks, bars: document.querySelectorAll(".runtime-letterbox").length,
        events: [...(scene?.eventSprites?.keys?.() ?? [])],
      };
    });
    console.log(JSON.stringify({ debug, errors: report.errors }, null, 1));
    process.exit(0);
  }
  for (const step of STEPS) {
    await page.waitForFunction(conditions[step.waitFor]!, null, { timeout: 60_000, polling: 30 });
    if (step.delayMs) await page.waitForTimeout(step.delayMs);
    const files: string[] = [];
    for (let index = 0; index < (step.shots ?? 1); index += 1) {
      const file = `${step.id}-${index}.png`;
      await page.screenshot({ path: join(outDir, file) });
      files.push(file);
      if (step.gapMs) await page.waitForTimeout(step.gapMs);
    }
    // tsx 가 함수 안 화살표에 __name 을 끼워 넣어 브라우저에서 터진다 — 문자열 식으로 보낸다.
    const shown = await page.evaluate(`(() => {
      const scene = window.__oprnHooksScene;
      const sprite = (s) => s && { angle: Math.round(s.angle), origin: [Number(s.originX.toFixed(2)), Number(s.originY.toFixed(2))], alpha: Number(s.alpha.toFixed(2)), tint: s.tintTopLeft?.toString(16), tintFill: s.tintFill, scale: [Number(s.scaleX.toFixed(2)), Number(s.scaleY.toFixed(2))] };
      return {
        letterbox: document.querySelector("[data-testid='runtime-letterbox-top']")?.style.height ?? null,
        looks: scene.session.m2Runtime?.screen?.spriteLooks ?? {},
        elder: sprite(scene.eventSprites.get("ev_lantern_elder")),
        healer: sprite(scene.eventSprites.get("ev_lantern_healer")),
        player: sprite(scene.player),
        emitters: scene.children.list.filter((o) => o.type === "ParticleEmitter").map((o) => ({ key: o.texture?.key, x: Math.round(o.x), y: Math.round(o.y), alive: o.getAliveParticleCount?.(), emitting: o.emitting, visible: o.visible, depth: o.depth, follow: Boolean(o.follow), first: o.alive?.[0] ? [Math.round(o.alive[0].x), Math.round(o.alive[0].y), Number(o.alive[0].scaleX?.toFixed?.(2)), Number(o.alive[0].alpha?.toFixed?.(2))] : null })),
        ghosts: scene.children.list.filter((o) => o.type === "Image" && o.tintFill).length,
      };
    })()`);
    report.steps.push({ ...step, files, shown });
  }
  await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
} finally {
  await browser.close();
  await server.close();
}
