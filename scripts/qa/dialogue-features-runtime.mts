// Run: npx tsx scripts/qa/dialogue-features-runtime.mts
// 대화창 기능 증거 촬영 — 본문 태그·▼/■·구두점 쉼·말풍선(가장자리·꼬리 뒤집기·상자 되돌림)·흘림·코너·
// 초상 무대·입 모양·표정·비트 태그·넘기기 금지·대화 기록·움직임 줄이기·대사 목소리 음량.
// 일회용 합성 fixture(빈 프로젝트 + NPC 이벤트) 를 player.html 런타임 QA 하네스로 돌린다.
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { createBlankProject } from "../../src/project/defaults";
import { DEFAULT_EASYRPG_CHARSET_ID } from "../../src/project/defaults/constants";
import { serialize } from "../../src/project/io";
import type { Command } from "../../src/project/types";
import { runRuntimeQa, startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const OUT = process.env.DIALOGUE_QA_OUT ?? join(process.cwd(), "verify-shots/runtime-qa/dialogue-features");
const MAP = "map_blank_start";
const project = createBlankProject();
project.startPos = { x: 10, y: 8 };
project.system.dialogueStyle = "classic";
// 대화창 글꼴 칸 — 편집기 글꼴과 따로 정한 대사 글꼴(스타일 기본 글꼴을 덮는다).
project.system.dialogueFont = "neodgm";
project.characters = {
  mira: {
    displayName: "미라",
    dialogue: {
      nameColor: "#ff9bd6",
      voice: "bright",
      pitch: 3,
      talkFace: "easyrpg-faceset-actor1-09",
      expressions: { surprised: { face: "easyrpg-faceset-actor1-11", pitch: 3, emote: "exclamation" } },
    },
  },
  cat: { displayName: "고양이", dialogue: { container: "bark", voice: "squeak", pitch: 6 } },
} as never;

const text = (body: string, extra: Record<string, unknown> = {}): Command => ({ kind: "text", body, ...extra }) as Command;
const face = (resourceId: string, position: "left" | "right", presentation?: "bust"): Command =>
  ({ kind: "changeFace", resourceId, position, flipHorizontally: false, ...(presentation ? { presentation } : {}) }) as Command;

type Npc = { id: string; x: number; y: number; commands: Command[]; characterId?: string };
const npcs: Npc[] = [
  { id: "tags", x: 11, y: 8, commands: [text("[흔들]진짜라니까![/] 저기 [색:노랑]보물[/]이 [크게]있어[/]!\n[물결]우우우~[/] [작게]아마도…[/] [색:파랑]파랑[/]과 [색:빨강]빨강[/].", { speaker: "아린" })] },
  { id: "pages", x: 9, y: 8, commands: [text("음, 그러니까. 잘 들어, 여행자.\n이 마을 북쪽에는 오래된 다리가 있고,\n그 다리 너머엔 아무도 안 간 숲이 있지.\n숲 한가운데엔 탑이 서 있어.\n탑 꼭대기엔 종이 달려 있고.\n그 종이 울리면… 그때 다시 오게.", { speaker: "촌장" })] },
  { id: "balloon", x: 10, y: 7, commands: [text("안녕! 오늘 날씨 좋다.", { speaker: "보리", container: "balloon" })] },
  { id: "edge", x: 0, y: 5, commands: [text("여기 구석이 좋아.", { speaker: "구석이", container: "balloon" })] },
  { id: "top", x: 6, y: 0, commands: [text("위가 막혔으면 아래로!", { speaker: "꼭대기", container: "balloon" })] },
  { id: "long", x: 10, y: 9, commands: [text("말풍선에 넣기엔 너무 긴 대사는 읽기 어려우니까 자동으로 보통 대사 상자로 바뀌어서 여러 장으로 나뉘어 보이게 된다는 걸 확인하려고 일부러 길게 쓴 문장이야. 한 줄 더 써 볼까? 아직 모자라면 이렇게 더.", { speaker: "수다쟁이", container: "balloon" })] },
  { id: "bark", x: 14, y: 8, commands: [
    text("싱싱한 사과 있어요~", { speaker: "상인", container: "bark" }),
    text("냐옹.", { speaker: "고양이" }),
  ] },
  { id: "cat", x: 18, y: 8, characterId: "cat", commands: [] },
  { id: "corner", x: 4, y: 12, commands: [
    face("easyrpg-faceset-actor1-05", "left"),
    text("여기는 본부. 북쪽 다리를 확인하라.", { speaker: "본부", container: "corner" }),
    face("easyrpg-faceset-actor1-02", "left"),
    text("알았다, 오버.", { speaker: "정찰병", container: "corner" }),
  ] },
  { id: "stage", x: 14, y: 3, commands: [
    face("easyrpg-faceset-actor1-00", "left", "bust"),
    text("…왔구나. 기다렸어.", { speaker: "리아" }),
    face("easyrpg-faceset-actor1-07", "right", "bust"),
    text("응, 늦어서 미안해. 길이 막혀서 한참 돌아왔어. 저기 말이야, 하나만 물어봐도 될까?", { speaker: "미라" }),
    text("그런데 [표정:놀람]저게 뭐야?!", { speaker: "미라" }),
  ] },
  { id: "beats", x: 6, y: 12, commands: [
    text("[소리:easyrpg-se-thunder]쾅! [화면흔들]땅이 흔들린다![넘기기금지] 이 부분은 키를 눌러도 한 번에 안 채워진다. 끝까지 들어.[/]", { speaker: "나레이터" }),
  ] },
];
project.maps[MAP].events = npcs.map((npc, index) => ({
  id: npc.id, x: npc.x, y: npc.y, trigger: { kind: "action" }, commands: npc.commands,
  ...(npc.characterId ? { characterId: npc.characterId } : {}),
  pages: [{ id: "p1", name: npc.id, conditions: [],
    graphic: { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down", pattern: index % 8 },
    trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: npc.commands,
  }],
})) as never;

const dir = await mkdtemp(join(tmpdir(), "oprn-dialogue-features-"));
const fixture = join(dir, "project.json");
await writeFile(fixture, serialize(project));
await mkdir(OUT, { recursive: true });

const evidence: Record<string, unknown> = {};
const server = await startPlayerQaServer();
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"],
});
const shot = async (page: Page, name: string) => {
  const stage = page.locator("[data-testid='play-stage'], #game, canvas").first();
  const box = await stage.boundingBox().catch(() => null);
  await page.screenshot({ path: join(OUT, `${name}.png`), ...(box ? { clip: { x: 0, y: 0, width: 1024, height: 768 } } : {}) });
  console.log("shot", name);
};
const boxReady = (page: Page) => page.waitForSelector("[data-testid='dialogue-box'].page-ready", { timeout: 15_000 });
const talk = async (page: Page, x: number, y: number, dir: "up" | "down" | "left" | "right") => {
  await page.evaluate(([m, px, py]) => (window as never as { __oprnDebug: { teleport: (a: string, b: number, c: number) => void } }).__oprnDebug.teleport(m as string, px as number, py as number), [MAP, x, y]);
  await page.waitForTimeout(250);
  await page.evaluate((d) => (window as never as { __oprnInput: { face: (d: string) => void } }).__oprnInput.face(d), dir);
  await page.waitForTimeout(120);
  await page.evaluate(() => (window as never as { __oprnInput: { action: () => void } }).__oprnInput.action());
};
const closeAll = async (page: Page) => {
  for (let i = 0; i < 12; i += 1) {
    if (!(await page.$("[data-testid='dialogue-box']"))) return;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(260);
  }
};

try {
  const page = await browser.newPage();
  // tsx(esbuild keepNames) 가 evaluate 콜백 안의 화살표 함수에 __name(…) 을 심는다 — 페이지엔 그 함수가 없다.
  await page.addInitScript("window.__name = (fn) => fn;");
  page.on("pageerror", (error) => console.log("pageerror", String(error)));
  page.on("console", (message) => { if (message.type() === "error") console.log("console", message.text()); });
  page.on("requestfailed", (request) => console.log("requestfailed", request.url(), request.failure()?.errorText));
  await runRuntimeQa(page, {
    id: "dialogue-features",
    projectFixture: fixture,
    beats: [{ id: "field", note: "필드 진입", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }], expect: { mapId: MAP } }],
  }, { serverUrl: server.url, outDir: join(OUT, "harness") }).catch(async (error) => {
    await page.screenshot({ path: join(OUT, "boot-fail.png") });
    console.log("boot html", (await page.content()).slice(0, 3000));
    throw error;
  });
  await page.waitForTimeout(400);

  // 1) 본문 태그
  await talk(page, 10, 8, "right");
  await boxReady(page);
  await page.waitForTimeout(300);
  await shot(page, "01-inline-tags");
  evidence.tags = await page.evaluate(() => ({
    shake: document.querySelectorAll(".dialogue-fx-shake").length,
    wave: document.querySelectorAll(".dialogue-fx-wave").length,
    big: document.querySelectorAll(".dialogue-fx-big").length,
    small: document.querySelectorAll(".dialogue-fx-small").length,
    colored: [...document.querySelectorAll<HTMLElement>(".dialogue-box .body span")].filter((n) => n.style.color).map((n) => n.style.color).filter((v, i, a) => a.indexOf(v) === i),
    shakeAnimation: getComputedStyle(document.querySelector(".dialogue-fx-shake")!).animationName,
    text: document.querySelector(".dialogue-box .body")?.textContent,
    font: getComputedStyle(document.querySelector(".dialogue-box .body")!).fontFamily,
  }));
  // 움직임 줄이기: 같은 창에서 애니메이션이 꺼지는지
  await page.emulateMedia({ reducedMotion: "reduce" });
  evidence.reducedMotion = await page.evaluate(() => ({
    shake: getComputedStyle(document.querySelector(".dialogue-fx-shake")!).animationName,
    wave: getComputedStyle(document.querySelector(".dialogue-fx-wave")!).animationName,
  }));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await closeAll(page);

  // 2) 구두점 쉼 + ▼/■
  await talk(page, 10, 8, "left");
  await page.waitForSelector("[data-testid='dialogue-box']");
  evidence.punctuation = await page.evaluate(async () => {
    const samples: { t: number; n: number; text: string }[] = [];
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const body = document.querySelector(".dialogue-box .body");
        const t = body?.textContent ?? "";
        if (!samples.length || samples[samples.length - 1].n !== t.length) samples.push({ t: Math.round(performance.now() - start), n: t.length, text: t });
        if (document.querySelector(".dialogue-box.page-ready") || performance.now() - start > 8000) resolve();
        else requestAnimationFrame(tick);
      };
      tick();
    });
    const gaps = samples.slice(1).map((s, i) => ({ after: samples[i].text.slice(-1), ms: s.t - samples[i].t }));
    return { samples: samples.length, gaps: gaps.slice(0, 20) };
  });
  await page.waitForTimeout(200);
  await shot(page, "02-page-next-marker");
  evidence.pageMarker1 = await page.evaluate(() => ({ glyph: document.querySelector(".dialogue-page-cursor")?.textContent, end: document.querySelector(".dialogue-page-cursor")?.classList.contains("is-end") }));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter"); // 타자 채우기
  await boxReady(page);
  await page.waitForTimeout(200);
  await shot(page, "03-page-end-marker");
  evidence.pageMarker2 = await page.evaluate(() => ({ glyph: document.querySelector(".dialogue-page-cursor")?.textContent, end: document.querySelector(".dialogue-page-cursor")?.classList.contains("is-end") }));
  await closeAll(page);

  // 3) 말풍선: 머리 위 / 왼쪽 가장자리 / 위가 막혀 아래로 / 길면 상자로
  const balloonInfo = () => page.evaluate(() => {
    const b = document.querySelector<HTMLElement>("[data-testid='dialogue-box']");
    return b ? { balloon: b.classList.contains("dialogue-balloon"), tailUp: b.classList.contains("tail-up"), edge: b.dataset.balloonEdge, left: b.style.left, top: b.style.top, tailX: b.style.getPropertyValue("--balloon-tail-x") } : null;
  });
  await talk(page, 10, 8, "up");
  await boxReady(page); await page.waitForTimeout(250);
  await shot(page, "04-balloon"); evidence.balloon = await balloonInfo();
  evidence.balloonDebug = await page.evaluate(() => {
    const o = document.querySelector<HTMLElement>(".dialogue-overlay")!;
    const cs = getComputedStyle(o);
    const b = document.querySelector<HTMLElement>("[data-testid='dialogue-box']")!;
    return { cls: o.className, style: o.getAttribute("style"), top: cs.top, bottom: cs.bottom, height: cs.height, position: cs.position, transform: cs.transform, boxPos: getComputedStyle(b).position, boxRect: JSON.stringify(b.getBoundingClientRect()), oRect: JSON.stringify(o.getBoundingClientRect()), parent: o.parentElement?.className };
  });
  await closeAll(page);
  await talk(page, 1, 5, "left");
  await boxReady(page); await page.waitForTimeout(250);
  await shot(page, "05-balloon-edge"); evidence.balloonEdge = await balloonInfo(); await closeAll(page);
  await talk(page, 6, 1, "up");
  await boxReady(page); await page.waitForTimeout(250);
  await shot(page, "06-balloon-tail-flip"); evidence.balloonFlip = await balloonInfo(); await closeAll(page);
  await talk(page, 10, 8, "down");
  await boxReady(page); await page.waitForTimeout(250);
  await shot(page, "07-balloon-fallback-box"); evidence.balloonFallback = await balloonInfo(); await closeAll(page);

  // 4) 흘림 대사 — 게임을 멈추지 않는다: 말을 건 뒤 바로 걸어 나간다
  await talk(page, 13, 8, "right");
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => (window as never as { __oprnDebug: { readState: () => { x: number; y: number } } }).__oprnDebug.readState());
  await page.evaluate(() => (window as never as { __oprnDebug: { playerRoute: (m: unknown[]) => void } }).__oprnDebug.playerRoute([{ kind: "move", dir: "down" }, { kind: "move", dir: "down" }]));
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => (window as never as { __oprnDebug: { readState: () => { x: number; y: number } } }).__oprnDebug.readState());
  await shot(page, "08-bark");
  evidence.bark = await page.evaluate(() => ({
    barks: [...document.querySelectorAll<HTMLElement>("[data-testid='dialogue-bark']")].map((n) => ({ text: n.textContent, left: n.style.left, top: n.style.top })),
    blockingBox: Boolean(document.querySelector("[data-testid='dialogue-box']")),
  }));
  (evidence.bark as Record<string, unknown>).moved = { before: [before.x, before.y], after: [after.x, after.y] };
  await page.waitForTimeout(4500);

  // 5) 코너 대사
  await talk(page, 4, 11, "down");
  await page.waitForTimeout(1800);
  await shot(page, "09-corner");
  evidence.corner = await page.evaluate(() => ({
    items: [...document.querySelectorAll("[data-testid='dialogue-corner']")].map((n) => n.textContent),
    faces: document.querySelectorAll(".dialogue-corner-face").length,
    blockingBox: Boolean(document.querySelector("[data-testid='dialogue-box']")),
  }));
  await page.waitForTimeout(4500);

  // 6) 초상 무대 · 입 모양 · 표정
  await talk(page, 14, 4, "up");
  await boxReady(page); await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-testid='dialogue-portrait-listener']", { timeout: 10_000 });
  const mouth: string[] = [];
  for (let i = 0; i < 14; i += 1) {
    const id = await page.evaluate(() => document.querySelector<HTMLElement>(".dialogue-box > .dialogue-face:not(.dialogue-portrait-listener)")?.dataset.resourceId ?? "(base)");
    mouth.push(id);
    if (i === 3) await shot(page, "10-portrait-stage-talking");
    await page.waitForTimeout(60);
  }
  evidence.mouth = mouth;
  await boxReady(page); await page.waitForTimeout(200);
  await shot(page, "11-portrait-stage");
  evidence.stage = await page.evaluate(() => ({
    listener: Boolean(document.querySelector("[data-testid='dialogue-portrait-listener']")),
    listenerFilter: getComputedStyle(document.querySelector("[data-testid='dialogue-portrait-listener']")!).filter,
  }));
  for (let i = 0; i < 6 && !(await page.$("[data-testid='dialogue-box'][data-dialogue-expression]")); i += 1) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
  }
  await boxReady(page); await page.waitForTimeout(250);
  await shot(page, "12-expression");
  evidence.expression = await page.evaluate(() => {
    const b = document.querySelector<HTMLElement>("[data-testid='dialogue-box']")!;
    return {
      expression: b.dataset.dialogueExpression,
      face: b.querySelector<HTMLElement>(":scope > .dialogue-face:not(.dialogue-portrait-listener)")?.dataset.resourceId,
      badge: b.querySelector<HTMLElement>("[data-testid='dialogue-emote-badge']")?.dataset.emote,
    };
  });
  // 7) 대화 기록 — 대화 중 L
  await page.keyboard.press("l");
  await page.waitForSelector("[data-testid='dialogue-log']");
  await page.waitForTimeout(150);
  await shot(page, "13-backlog");
  evidence.log = await page.evaluate(() => [...document.querySelectorAll(".dialogue-log-entry")].map((n) => n.textContent));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await closeAll(page);

  // 8) 비트 태그 · 넘기기 금지
  await talk(page, 6, 11, "down");
  await page.waitForSelector("[data-testid='dialogue-box']");
  await page.waitForFunction(() => (document.querySelector(".dialogue-box .body")?.textContent ?? "").includes("흔들린다!"), undefined, { timeout: 10_000 });
  await page.waitForTimeout(40);
  await shot(page, "14-beat-shake");
  const shakeClass = await page.evaluate(() => document.querySelector(".dialogue-box")?.classList.contains("dialogue-beat-shake"));
  await page.waitForFunction(() => (document.querySelector(".dialogue-box .body")?.textContent ?? "").includes("이 부분"), undefined, { timeout: 10_000 });
  const lenBefore = await page.evaluate(() => document.querySelector(".dialogue-box .body")?.textContent?.length ?? 0);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(60);
  const lenAfter = await page.evaluate(() => document.querySelector(".dialogue-box .body")?.textContent?.length ?? 0);
  await shot(page, "15-no-skip");
  evidence.beats = {
    beats: await page.evaluate(() => document.querySelector<HTMLElement>(".dialogue-box")?.dataset.dialogueBeats),
    shakeClass,
    noSkip: { lenBefore, lenAfterEnter60ms: lenAfter, full: await page.evaluate(() => document.querySelector(".dialogue-box")?.getAttribute("data-dialogue-beats")) },
  };
  await boxReady(page);
  await closeAll(page);
  // 9) 대사 목소리 음량 — ESC 메뉴 설정
  await page.keyboard.press("Escape");
  await page.waitForSelector("[data-testid='main-menu']", { timeout: 10_000 });
  const groups = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-testid^='status-menu-command-']")].map((n) => n.dataset.testid));
  console.log("menu", groups.join(" "));
  await page.evaluate(() => document.querySelector<HTMLElement>("[data-testid='status-menu-command-system-menu']")?.click());
  await page.waitForTimeout(300);
  console.log("submenu", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("button")].filter((n) => n.offsetParent).map((n) => `${n.dataset.testid}:${n.textContent?.trim().slice(0, 12)}`))));
  await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("button")].find((n) => n.offsetParent && n.textContent?.trim().startsWith("설정"))?.click());
  await page.waitForSelector("[data-testid='player-option-voice-up']", { state: "attached", timeout: 10_000 });
  const voiceBefore = await page.locator("[data-testid='player-option-voice-down']").textContent();
  await page.evaluate(() => document.querySelector<HTMLElement>("[data-testid='player-option-voice-up']")?.click());
  await page.waitForTimeout(150);
  await shot(page, "16-voice-volume");
  evidence.voice = {
    before: voiceBefore,
    after: await page.locator("[data-testid='player-option-voice-down']").textContent(),
    saved: await page.evaluate(() => Object.entries(localStorage).filter(([k]) => /pref|option/i.test(k)).map(([k, v]) => `${k}=${v.slice(0, 200)}`)),
  };
} finally {
  await writeFile(join(OUT, "evidence.json"), JSON.stringify(evidence, null, 2));
  await browser.close();
  await server.close();
}
console.log(JSON.stringify(evidence, null, 2));
