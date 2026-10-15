/**
 * 바로 깔기 실제 편집기 재현 — 바로 깔기 토글 ON, 우클릭 드래그로 영역 선택, 입력줄에 문장 + Enter.
 *
 *   BASE=http://127.0.0.1:9892 THEME=jp TEXT="화분 깔아 줘" TAG=before node scripts/qa/stamp-place-ui.mjs
 *   THEMES=beodeul,jp,interior TEXTS="화분 깔아 줘|의자 놓아 줘" TAG=after node scripts/qa/stamp-place-ui.mjs
 *
 * 모델: 편집기 기본 조수 모델 경로(/v1/chat/completions)를 page.route 로 받아, 같은 요청을 `agy -p --model gemini-4-argon-medium`
 *       (Google Argon medium)으로 되묻는다 — 8318 프록시 키(OPRN_LIVE_KEY)가 없을 때의 대용이다. 응답은 output/stamp-corpus/agy-cache 에 캐시한다.
 *       STUB=plans.json 이면 {문장: 응답JSON문자열} 대본으로 대체한다(모델 호출 없음).
 * 도구·스토어·캔버스·채팅 말풍선은 실제 경로다. blankProject 세션이라 정본 저장 증거가 아니다(코드 QA 전용).
 * 출력(OUT=output/stamp-ui/<TAG>): <테마>-<번호>-before.png / -after.png (캔버스 선택 영역 원본 크기 클립), <테마>-<번호>.json(결과 줄·요청·응답).
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9892";
const TAG = process.env.TAG ?? "run";
const OUT = path.resolve(process.env.OUT ?? `output/stamp-ui/${TAG}`);
const THEMES = (process.env.THEMES ?? process.env.THEME ?? "jp").split(",").filter(Boolean);
const TEXTS = (process.env.TEXTS ?? process.env.TEXT ?? "화분 깔아 줘").split("|");
const STUB = process.env.STUB ? JSON.parse(fs.readFileSync(process.env.STUB, "utf8")) : null;
const CACHE_DIR = path.resolve("output/stamp-corpus/agy-cache");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

const SETUPS = {
  jp: { map: { name: "일본 주택가", id: "t_jp", themeScene: "jp_city:residential" } },
  beodeul: { map: { name: "버들항 마을", id: "t_beodeul", width: 40, height: 30, tilesetId: "beodeul_city" }, then: ["author_beodeul_town", { mapId: "t_beodeul", theme: "river" }] },
  interior: { tool: "build_hand_interior_room", args: { name: "빵집 안", mapId: "t_interior", floor: "plank", wall: "plaster", layout: { program: "bakery" } }, mapId: "t_interior" },
  sky: { map: { name: "천공섬 마을", id: "t_sky", themeScene: "sky_island:village" } },
  monster: { map: { name: "몬스터 마을", id: "t_monster", width: 34, height: 26, tilesetId: "monster_overworld" } },
  farm: { map: { name: "농장", id: "t_farm", width: 34, height: 26, tilesetId: "scarloxy_chipset_grassland" } },
};

function runAgy(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn("agy", ["-p", prompt, "--model", "gemini-4-argon-medium"], { cwd: "/tmp", stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("agy 시간 초과")); }, 150_000);
    child.on("close", () => { clearTimeout(timer); resolve(out.trim()); });
    child.on("error", reject);
  });
}

async function modelReply(body) {
  const messages = body.messages ?? [];
  const system = String(messages.find((m) => m.role === "system")?.content ?? "");
  const users = messages.filter((m) => m.role !== "system");
  if (STUB) {
    let payload = {};
    try { payload = JSON.parse(String(users[0]?.content ?? "{}")); } catch { /* repair */ }
    const hit = STUB[payload.sentence ?? ""];
    if (hit === undefined) throw new Error("STUB 에 없는 문장: " + payload.sentence);
    return typeof hit === "string" ? hit : JSON.stringify(hit);
  }
  const prompt = [`SYSTEM:\n${system}`, ...users.map((m) => `${m.role === "assistant" ? "ASSISTANT" : "USER"}:\n${String(m.content)}`), "Reply with ONLY the JSON object, no tools, no prose."].join("\n\n");
  const file = path.join(CACHE_DIR, `ui-${createHash("sha1").update(prompt).digest("hex").slice(0, 16)}.txt`);
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const text = await runAgy(prompt);
  if (text) fs.writeFileSync(file, text);
  return text;
}

const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const summary = [];
for (const theme of THEMES) {
  const setup = SETUPS[theme];
  if (!setup) { console.error("모르는 테마", theme); continue; }
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 240)));
  const modelCalls = [];
  await page.addInitScript(() => { localStorage.setItem("oprn:ai-stamp-place", "1"); });
  await page.route("**/v1/chat/completions", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    try {
      const content = await modelReply(body);
      modelCalls.push({ out: content.slice(0, 2000), turns: (body.messages ?? []).length });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "stub", model: body.model, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }] }) });
    } catch (error) {
      modelCalls.push({ error: String(error) });
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: String(error) } }) });
    }
  });
  await page.goto(BASE + "/?blankProject=1", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 150_000 });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.waitForFunction(() => typeof window.__oprnEditorTool === "function", null, { timeout: 30_000 });
  const mapId = await page.evaluate(async ({ setup }) => {
    const t = window.__oprnEditorTool;
    let id = setup.mapId;
    if (setup.map) {
      const r = t("create_map", setup.map);
      if (!r.ok) throw new Error("create_map " + r.summary);
      id = setup.map.id;
      if (setup.then) t(setup.then[0], setup.then[1]);
    } else {
      const r = t(setup.tool, setup.args);
      if (!r.ok) throw new Error(setup.tool + " " + r.summary);
    }
    const { editorState } = await import("/src/editor/editorState.ts");
    editorState.set({ currentMapId: id });
    return id;
  }, { setup });
  await page.waitForFunction((id) => typeof window.__oprnEditWorldToClient === "function" && window.__oprnEditMapViewport?.()?.mapId === id, mapId, { timeout: 60_000 });
  await page.waitForTimeout(2500);
  const geometry = await page.evaluate(({ mapId }) => {
    const p = window.__oprnEditorStore.getCurrent();
    const map = p.maps[mapId];
    return { w: map.width, h: map.height, tile: p.tilesets[map.tilesetId]?.tileSize ?? 16, events: map.events.length };
  }, { mapId });
  console.log(`[${theme}] map ${mapId} ${geometry.w}x${geometry.h} tile ${geometry.tile} events ${geometry.events}`);
  await page.screenshot({ path: path.join(OUT, `${theme}-00-map.png`) });

  let index = 0;
  for (const text of TEXTS) {
    index += 1;
    const label = `${theme}-${String(index).padStart(2, "0")}`;
    // 맵 가운데의 8×6 영역을 우클릭 드래그. 월드→화면 변환은 편집기 훅.
    const sel = await page.evaluate(({ mapId }) => {
      const p = window.__oprnEditorStore.getCurrent();
      const map = p.maps[mapId];
      return { x: Math.max(0, Math.floor(map.width / 2) - 4), y: Math.max(0, Math.floor(map.height / 2) - 3) };
    }, { mapId });
    const tileSize = geometry.tile;
    const toClient = (tx, ty) => page.evaluate(([x, y, size]) => window.__oprnEditWorldToClient?.(x * size + size / 2, y * size + size / 2) ?? null, [tx, ty, tileSize]);
    const a = await toClient(sel.x, sel.y);
    const b = await toClient(sel.x + 7, sel.y + 5);
    if (!a || !b) throw new Error("world→client 변환이 없습니다");
    const pad = 80;
    const clip = {
      x: Math.max(0, Math.min(a.x, b.x) - pad), y: Math.max(0, Math.min(a.y, b.y) - pad),
      width: Math.abs(b.x - a.x) + pad * 2, height: Math.abs(b.y - a.y) + pad * 2,
    };
    const before = await page.evaluate(({ mapId }) => JSON.stringify(window.__oprnEditorStore.getCurrent().maps[mapId]), { mapId });
    await page.mouse.move(a.x, a.y);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up({ button: "right" });
    const prompt = page.getByTestId("selection-chip-prompt");
    await prompt.waitFor({ state: "visible", timeout: 20_000 });
    await page.screenshot({ path: path.join(OUT, `${label}-before.png`), clip });
    modelCalls.length = 0;
    await prompt.fill(text);
    await prompt.press("Enter");
    const started = Date.now();
    // 주문이 끝날 때까지(채팅 결과 말풍선) — 최대 4분.
    let rows = [];
    while (Date.now() - started < 240_000) {
      await page.waitForTimeout(1500);
      rows = await page.evaluate(() => [...document.querySelectorAll("[data-testid=ai-command-row], .ai-msg, .ai-chat-message, [data-testid=ai-chat-log] *")].map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim()).filter((t) => t.length > 0 && t.length < 600));
      const queue = await page.evaluate(() => document.querySelector("[data-testid=ai-pending-queue]")?.textContent ?? "");
      if (modelCalls.length > 0 && !/진행|대기|읽는/.test(queue) && rows.some((row) => /완료|실패|일부|깔|없|중단/.test(row))) break;
    }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, `${label}-after.png`), clip });
    await page.screenshot({ path: path.join(OUT, `${label}-full.png`) });
    const after = await page.evaluate(({ mapId }) => {
      const map = window.__oprnEditorStore.getCurrent().maps[mapId];
      return JSON.stringify(map);
    }, { mapId });
    const diff = (() => {
      const x = JSON.parse(before), y = JSON.parse(after);
      let tiles = 0;
      for (const key of ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"]) {
        const m = x[key], n = y[key];
        for (let i = 0; i < x.width * x.height; i++) if ((m?.[i] ?? -1) !== (n?.[i] ?? -1)) tiles++;
      }
      const ids = new Set(x.events.map((e) => e.id));
      const events = y.events.filter((e) => !ids.has(e.id)).map((e) => ({ name: e.name, x: e.x, y: e.y, graphic: JSON.stringify(e.pages?.[0]?.graphic ?? {}).slice(0, 160) }));
      return { tiles, events };
    })();
    const chat = await page.evaluate(() => [...document.querySelectorAll("[data-testid=ai-chat-panel] *")].filter((el) => el.children.length === 0).map((el) => (el.textContent ?? "").trim()).filter((t) => t.length > 3).slice(-14));
    fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify({ theme, text, modelCalls, diff, chat, errors: errors.slice(0, 5) }, null, 1));
    console.log(`[${label}] "${text}" tilesChanged=${diff.tiles} newEvents=${diff.events.length} modelCalls=${modelCalls.length} (${Date.now() - started}ms)`);
    console.log("   chat:", chat.slice(-6).join(" ⏎ ").slice(0, 600));
    summary.push({ label, theme, text, tiles: diff.tiles, events: diff.events, chat: chat.slice(-8) });
    // 다음 시험을 위해 맵을 되돌린다(스토어에 시작 상태를 다시 넣는다).
    await page.evaluate(({ mapId, before }) => {
      const store = window.__oprnEditorStore;
      const project = structuredClone(store.getCurrent());
      project.maps[mapId] = JSON.parse(before);
      store.replace(project);
    }, { mapId, before });
    await page.waitForTimeout(800);
  }
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
console.log("summary → " + path.join(OUT, "summary.json"));
