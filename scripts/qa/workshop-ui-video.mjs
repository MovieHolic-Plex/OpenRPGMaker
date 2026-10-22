// 공방 화면 전체를 한 번에 1배 영상으로 찍는다(모델 없이 — dev 빌드의 가짜 채팅·검수).
// 장면: 허브 → 새 물건 시작 → 작업 줄 진행 → 다 그림(드러남) → 고르기·칩셋에 넣기 → 캐릭터 묶음 가져오기.
// BASE=http://127.0.0.1:9869 OUT=/tmp/wsui/after CHAR_PACK=~/.cache/char-gen-demo/pack node scripts/qa/workshop-ui-video.mjs
// 결과: OUT/*.webm(전체) + OUT/marks.json(장면 시작·끝 초) — ffmpeg 로 장면을 자른다.
import { chromium } from "playwright";
import { mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.BASE ?? "http://127.0.0.1:9869";
const out = resolve(process.env.OUT ?? "verify-shots/workshop-ui");
const charPack = process.env.CHAR_PACK ?? "";
const width = Number(process.env.W ?? 1440), height = Number(process.env.H ?? 900);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: out, size: { width, height } } });
const page = await context.newPage();
page.setDefaultTimeout(180_000);
const t0 = Date.now();
const marks = {};
const mark = (name) => { marks[name] = Number(((Date.now() - t0) / 1000).toFixed(2)); console.log(`[mark] ${name} ${marks[name]}s`); };
process.on("SIGTERM", () => { console.log(JSON.stringify({ marks, errors })); process.exit(1); });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-studio", "0");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** 가짜 그림이 쓴 색(#rrggbb) — 판정 때 「후보」 표본을 숨긴 반려 표본과 가려낸다(후보만 이 색을 그대로 다 갖는다). */
  const used = new Map();
  const colorsOf = (url) => new Promise((done) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      const g = canvas.getContext("2d");
      g.drawImage(image, 0, 0);
      const d = g.getImageData(0, 0, image.width, image.height).data;
      const set = new Set();
      for (let i = 0; i < d.length; i += 4) if (d[i + 3]) set.add(((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).padStart(6, "0"));
      done(set);
    };
    image.onerror = () => done(new Set());
    image.src = url;
  });
  window.__oprnWorkshopChat = async (surface, request) => {
    const parts = request.messages.flatMap((m) => (typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content ?? []));
    const text = parts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
    if (/blind|ANCHORS/.test(text) && /S1/.test(text)) {
      await sleep(700);
      const answer = [];
      let label = null;
      for (const part of parts) {
        if (part.type === "text") { label = /^(S\d+)\b/.exec(part.text)?.[1] ?? null; continue; }
        if (!label) continue;
        const colors = await colorsOf(part.image_url.url);
        const mine = [...used.values()].some((set) => [...set].every((c) => colors.has(c)) && [...colors].filter((c) => !set.has(c)).length <= 2);
        answer.push({ id: label, view34: mine ? "PASS" : "FAIL", quality: mine ? "PASS" : "FAIL", reason: mine ? "윗면 3행이 보이고 칩셋 결에 맞음" : "평면·잡음" });
        label = null;
      }
      return answer.map((a) => JSON.stringify(a)).join("\n");
    }
    if (/"keep": true/.test(text)) { await sleep(1500); return JSON.stringify({ keep: true, note: "윗면 3행 · 앞판 널 3장" }); }
    if (surface === "workshop-review") { await sleep(600); return JSON.stringify({ verdict: "PASS", codes: [], top: "윗면 3행", top_rows: 3, reasons: "좋음", fix: "", worse: false }); }
    await sleep(9000);
    const size = /Canvas: (\d+)x(\d+) px/.exec(text);
    const w = Number(size?.[1] ?? 16), h = Number(size?.[2] ?? 16);
    const pad = Number(/Keep the top (\d+) rows empty/.exec(text)?.[1] ?? 0);
    // 팔레트 줄(「h030: k:1 #aabbcc . k:2 #ddeeff」)에서 단이 넷 넘는 따뜻한 줄 하나를 쓴다.
    const ramps = [...text.matchAll(/^(h\d{3}|grey): (.+)$/gm)].map((m) => [...m[2].matchAll(/(\S+) #([0-9a-f]{6})/gi)].map((x) => ({ key: x[1], hex: x[2].toLowerCase() })));
    const ramp = ramps.filter((r) => r.length >= 4).sort((a, b) => b.length - a.length)[Math.floor(Math.random() * 2)] ?? ramps[0] ?? [];
    const pick = (f) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(f * (ramp.length - 1))))];
    const ink = pick(0), dark = pick(0.3), mid = pick(0.55), light = pick(0.85);
    const legend = { o: ink.key, d: dark.key, m: mid.key, t: light.key };
    const top = Math.max(pad, 1);
    const rows = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
      if (y < top || x < 1 || x >= w - 1) return ".";
      if (y === top || y === h - 1 || x === 1 || x === w - 2) return "o";
      if (y < top + 4) return "t";
      if ((y - top) % 4 === 0) return "d";
      return "m";
    }).join(""));
    const id = `${w}x${h}:${Math.random()}`;
    used.set(id, new Set([ink.hex, dark.hex, mid.hex, light.hex]));
    if (used.size > 40) used.delete(used.keys().next().value);
    return JSON.stringify({ legend, rows, note: "가짜 그림 · 윗면 3행", topRows: 3 });
  };
});
await page.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

const hold = (ms) => page.waitForTimeout(ms);
try {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 240_000 });
      await page.getByTestId("sidebar-workshop").waitFor({ timeout: 180_000 });
      // 부팅 막(「도구 준비 중…」)이 걷힐 때까지 — 부하가 크면 막이 클릭을 가로챈다
      await page.waitForFunction(() => !document.body.innerText.includes("도구 준비 중"), null, { timeout: 300_000 });
      console.log(`[boot] ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      break;
    } catch (error) { console.log(`[boot] attempt ${attempt} failed: ${String(error).slice(0, 120)}`); if (attempt >= 2) throw error; }
  }
  await hold(2500);
  await page.getByTestId("sidebar-workshop").click();
  await page.getByTestId("left-workshop-pane").waitFor();
  mark("hub");
  await hold(1200);
  await page.getByTestId("workshop-gen-card-object-gen").hover();
  await hold(1600);
  await page.getByTestId("workshop-gen-card-char-gen").hover();
  await hold(2800);
  mark("hub-end");

  mark("start");
  await page.getByTestId("workshop-gen-open-object-gen").click();
  await page.getByTestId("workshop-item-form").waitFor();
  await hold(900);
  await page.getByTestId("workshop-form-title").pressSequentially("약초 말리는 선반", { delay: 45 });
  await page.getByTestId("workshop-form-description").pressSequentially("나무 선반 3단, 말린 약초 다발이 걸려 있다.", { delay: 25 });
  await hold(500);
  await page.getByTestId("workshop-item-save").click();
  await page.getByTestId("workshop-drawing").waitFor({ timeout: 60_000 }).catch(() => {});
  await hold(2200);
  mark("start-end");

  // 두 번째 물건을 줄에 세워 작업 줄이 여럿 돌게 한다
  await page.getByTestId("workshop-new-item").click();
  await page.getByTestId("workshop-form-title").fill("돌 이정표");
  await page.getByTestId("workshop-form-description").fill("이끼 낀 돌 이정표, 위에 작은 등불.");
  await page.getByTestId("workshop-item-save").click();
  await hold(600);
  mark("queue");
  await page.getByTestId("workshop-open-queue").click();
  await page.getByTestId("workshop-queue-panel").waitFor();
  await hold(6500);
  mark("queue-end");
  await page.getByRole("button", { name: "작업 줄 접기" }).click().catch(() => {});
  await hold(300);

  // 첫 물건 판으로 — 다 그려지는 순간(드러남)
  await page.getByTestId("workshop-filter-all").click();
  await page.locator('[data-testid="workshop-item"]', { hasText: "약초 말리는 선반" }).click();
  mark("reveal");
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('[data-testid="workshop-card"]')];
    return cards.length > 0 && cards.every((card) => ["done", "failed"].includes(card.getAttribute("data-status")));
  }, null, { timeout: 180_000 });
  await hold(2600);
  mark("reveal-end");

  mark("pick");
  await page.keyboard.press("2");
  await hold(700);
  await page.keyboard.press("f");
  await hold(1200);
  await page.keyboard.press("f");
  await hold(500);
  await page.keyboard.press("Enter");
  await page.getByTestId("workshop-bake").waitFor({ timeout: 20_000 });
  await hold(1500);
  await page.getByTestId("workshop-bake").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="workshop-stepper"]')?.getAttribute("data-step") === "5", null, { timeout: 30_000 }).catch(() => {});
  await hold(2500);
  mark("pick-end");
  await page.screenshot({ path: resolve(out, "pick.png") });

  if (charPack) {
    await page.keyboard.press("Escape");
    await hold(500);
    mark("char");
    await page.getByTestId("workshop-gen-open-char-gen").click();
    await page.getByTestId("workshop-gen").waitFor();
    await hold(1800);
    await page.getByTestId("workshop-gen-folder").setInputFiles(charPack);
    await page.getByTestId("workshop-gen-add").waitFor({ timeout: 60_000 });
    await hold(1200);
    await page.getByTestId("workshop-gen-step-import").scrollIntoViewIfNeeded();
    await hold(3500);
    mark("char-end");
  }
  // 작업 줄 알약 — 다 끝난 뒤 모습
  await page.keyboard.press("Escape");
  await hold(800);
  mark("pill");
  await hold(2500);
  mark("pill-end");
} catch (error) {
  console.log("FAIL", error instanceof Error ? error.message.slice(0, 300) : error);
  await page.screenshot({ path: resolve(out, "fail.png") }).catch(() => {});
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const path = await video.path();
    renameSync(path, resolve(out, "full.webm"));
  }
  writeFileSync(resolve(out, "marks.json"), JSON.stringify({ marks, errors }, null, 2));
  console.log(JSON.stringify({ marks, errors, files: readdirSync(out) }));
}
