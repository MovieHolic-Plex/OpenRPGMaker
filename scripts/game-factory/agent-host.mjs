#!/usr/bin/env node
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { firefox } from "playwright";
import { generateImage, preflightImage } from "./imagegen.mjs";

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const projectDir = resolve(opt("project-dir"));
const out = resolve(opt("out"));
const port = Number(opt("port"));
const REPO = process.cwd();
mkdirSync(resolve(out, "shots"), { recursive: true });
const log = (rec) => appendFileSync(resolve(out, "host-calls.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), ...rec })}\n`);

const t0 = Date.now();
const drv = await import(pathToFileURL(resolve(REPO, "src/harnesses/assistant-capability/node/editorDriver.mjs")).href);
const { buildTsModule } = await import(pathToFileURL(resolve(REPO, "scripts/ontology-ts-loader.mjs")).href);
const { buildWorldmap } = await import(pathToFileURL(resolve(REPO, "scripts/lib/worldmapBuild.mjs")).href);
const bundle = resolve(out, "headless.mjs");
await buildTsModule(resolve(REPO, "src/headless/index.ts"), bundle);
await (await import("esbuild")).stop?.();
const H = await import(pathToFileURL(bundle).href);
H.setHeadlessPublicRoot(resolve(REPO, "public"));
H.setHeadlessWorldmapBuilder?.(buildWorldmap);
const toolList = H.listHeadlessTools();

const preflight = await preflightImage();
writeFileSync(resolve(out, "image-preflight.json"), JSON.stringify(preflight, null, 2));
if (!preflight.ok) {
  const message = [
    "이미지 생성 불가 — 런을 시작하지 않습니다.",
    `이유: ${preflight.error}`,
    "이 런에서 만들 수 없는 것: 오프닝·타이틀·전투 배경·아이템 아이콘·캐릭터 초상 등 생성 이미지 전부(재고 그림 대체로 넘어가지 않습니다).",
    "연결 방법: ChatGPT 로그인이 연결된 이미지 엔드포인트를 OPRN_IMAGE_BASE_URL / OPRN_IMAGE_API_KEY 로 지정하거나 $OPRN_OPENAI_COMPAT_PATH 의 엔드포인트 키를 채우세요.",
  ].join("\n");
  writeFileSync(resolve(out, "IMAGE-UNAVAILABLE.txt"), message + "\n");
  console.error(message);
  process.exit(4);
}

const host = await drv.startHost(projectDir, out);
const handshake = await (await fetch(new URL("/__oprn/handshake", host.url))).json();
const headers = { "content-type": "application/json", "x-oprn-bridge-token": handshake.token, "x-oprn-session": "ade-agent", "x-oprn-project": "" };
async function call(channel, payload) {
  const r = await fetch(new URL("/__oprn/bridge", host.url), { method: "POST", headers: { ...headers, "x-oprn-channel": channel }, body: JSON.stringify({ channel, payload }) });
  if (!r.ok) throw new Error(`${channel}: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}
const opened = await call("oprn:project.open", { projectDir: "host-project" });

const NO_VIEW = process.env.ADE_NO_VIEW === "1";
const browser = NO_VIEW ? null : await firefox.launch({ firefoxUserPrefs: { "network.notify.changed": false, "network.notify.IPv6": false, "network.captive-portal-service.enabled": false, "network.connectivity-service.enabled": false } });
const VIEW_CONFIG = process.env.ADE_VIEW_AICONFIG
  ? JSON.parse(readFileSync(process.env.ADE_VIEW_AICONFIG, "utf8"))
  : { assistantEngine: { kind: "local-cli", cli: "claude", routineModel: "claude-opus-5-5", deepModel: "claude-opus-5-5", effort: "medium" } };
const editor = browser ? await drv.newEditor(browser, host.url, projectDir, VIEW_CONFIG, { viewport: { width: 1440, height: 900 } }) : null;
const warmupSec = (Date.now() - t0) / 1000;
writeFileSync(resolve(out, "warmup.json"), JSON.stringify({ warmupSec, tools: toolList.length, hostUrl: host.url, imagePreflight: preflight, browser: !NO_VIEW }, null, 2));

let warm = null;
async function current() {
  const status = await call("oprn:team.status");
  if (warm && warm.revision === status.revision) return warm;
  const row = await call("oprn:project.load", { projectDir: opened.projectDir });
  warm = { revision: row.revision, sha256: row.sha256, project: H.normalizeHeadlessProject(H.loadHeadlessProject(row.serialized)) };
  return warm;
}
async function saveProject(next) {
  const base = await current();
  const serialized = H.serializeHeadlessProject(next);
  const saved = await call("oprn:project.save", { projectDir: opened.projectDir, serialized, expectedSha: base.sha256 });
  if (saved.kind === "saved") warm = saved.serialized ? null : { revision: saved.revision, sha256: saved.sha256, project: next };
  return { kind: saved.kind, revision: saved.revision };
}

const IMAGE_TOOLS = new Set([
  "generate_opening_image",
  "generate_title_art",
  "generate_image_asset",
  "generate_battle_backdrop",
  "generate_item_icon",
  "generate_character_appearance",
]);

const IMAGE_TOOL_PROMPT = {
  generate_opening_image: (a) => [a.prompt, a.artStyle, a.focus && `Focus: ${a.focus}`, a.light && `Light: ${a.light}`,
    a.palette && `Palette: ${a.palette}`, a.cast && `Cast: ${a.cast}`, "No text, no letters, no UI, no watermark."].filter(Boolean).join("\n\n"),
  generate_title_art: (a) => [a.prompt, a.artStyle, "No text, no logo lettering, no watermark."].filter(Boolean).join("\n\n"),
  generate_image_asset: (a) => [a.prompt, a.description, "No text, no watermark."].filter(Boolean).join("\n\n"),
  generate_battle_backdrop: (a) => [a.prompt, a.description, "No text, no UI, no watermark."].filter(Boolean).join("\n\n"),
  generate_item_icon: (a) => [a.prompt, a.description, "Single isolated item icon, centered, plain background, no text."].filter(Boolean).join("\n\n"),
  generate_character_appearance: (a) => [a.prompt, a.description, "Bust portrait of one character, plain background, no text."].filter(Boolean).join("\n\n"),
};

async function runImageTool(name, args, mapId) {
  const startedAt = Date.now();
  const prompt = (IMAGE_TOOL_PROMPT[name] ?? ((a) => a.prompt ?? ""))(args ?? {});
  if (!prompt || String(prompt).trim().length < 8) {
    return { ok: false, summary: `${name}: prompt 가 비었습니다. 장면 설명을 넣어 다시 부르세요.`, code: "invalid-args" };
  }
  let image;
  try {
    image = await generateImage({ prompt: String(prompt).slice(0, 3000) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log({ path: "/tool", tool: name, ok: false, imageError: message.slice(0, 400), ms: Date.now() - startedAt });
    return {
      ok: false,
      code: "image-generation-unavailable",
      summary: `${name} 생성 실패: ${message}. 조용히 재고 그림으로 대체하지 마라. 이 사실을 최종 보고에 적어라: 이미지 생성이 불가능해 ${name} 그림은 게임에 없다.`,
    };
  }
  const suffix = String(args?.name ?? name).replace(/[^\w가-힣\-]/gu, "_").slice(0, 40) || "generated";
  const resourceId = `${name.replace(/^generate_/, "")}_${Date.now().toString(36)}_${suffix}`;
  const kind = name === "generate_item_icon" ? "picture"
    : name === "generate_character_appearance" ? "faceset"
    : name === "generate_battle_backdrop" ? "backdrop"
    : "backdrop";
  const registered = await runTool("upsert_resource", { resource: { id: resourceId, name: String(args?.name ?? resourceId), kind, dataUrl: image.dataUrl, mimeType: "image/png" } }, mapId);
  if (!registered.ok) {
    log({ path: "/tool", tool: name, ok: false, registerError: String(registered.summary ?? "").slice(0, 300), ms: Date.now() - startedAt });
    return { ...registered, ok: false, summary: `${name}: 그림은 만들었지만 리소스 등록 실패 — ${registered.summary}` };
  }
  log({ path: "/tool", tool: name, ok: true, generated: { resourceId, bytes: image.bytes, model: image.model }, ms: Date.now() - startedAt });
  return {
    ok: true,
    summary: `${name}: 그림을 만들어 리소스 ${resourceId} 로 등록했습니다. 이 resourceId 를 실제 장면(오프닝 background·타이틀 배경·전투 배경·아이템 아이콘)에 넣으세요 — 만들기만 하고 쓰지 않으면 게임에는 없습니다.`,
    data: { status: "generated", resourceId, name: String(args?.name ?? resourceId), bytes: image.bytes, model: image.model },
  };
}

async function runTool(name, args, mapId) {
  if (IMAGE_TOOLS.has(name)) return runImageTool(name, args, mapId);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const base = await current();
    const project = structuredClone(base.project);
    await H.prepareHeadlessTool(name, args, project);
    const { result, project: next } = H.runHeadlessToolWithProject(project, name, args, mapId ? { currentMapId: mapId } : {});
    if (!result.ok || isDeepStrictEqual(next, base.project)) return result;
    const saved = await saveProject(next);
    if (saved.kind === "saved") return { ...result, saved: { revision: saved.revision, attempt } };
    if (saved.kind !== "conflict") return { ...result, ok: false, saveError: saved };
    warm = null;
  }
  return { ok: false, summary: "3번 모두 다른 저장과 부딪혔습니다" };
}

async function shot(mapId, name) {
  if (!editor) return { skipped: "no-browser", note: "ADE_NO_VIEW=1 — this run has no editor page; use the judge play-test for screenshots" };
  const page = editor.page;
  if (mapId) {
    if (!(await page.getByTestId(`map-tree-node-${mapId}`).count())) await page.getByTestId("sidebar-map-switcher").click().catch(() => {});
    await page.getByTestId(`map-tree-node-${mapId}`).first().click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  const file = resolve(out, "shots", `${String(Date.now())}-${(name ?? mapId ?? "editor").replace(/[^\w-]/g, "_")}.png`);
  await page.screenshot({ path: file });
  return { file };
}

async function finalCheck() {
  const applied = drv.stored(projectDir);
  if (!editor) {
    const receipt = { tag: "final", projectId: applied.projectId, revision: applied.revision, afterSha256: applied.sha256,
      reloadedSha256: applied.sha256, sameStoredDocument: true,
      rendererLoadObserved: false, rendererMapsAndDatabaseEqual: null, browserSkipped: true,
      generatedImageResources: Object.keys(applied.project.assets?.uploaded ?? {}).length,
      maps: Object.values(applied.project.maps).map((m) => ({ id: m.id, name: m.name, size: `${m.width}x${m.height}`, events: (m.events ?? []).length })) }
    writeFileSync(resolve(out, "persistence-final.json"), JSON.stringify(receipt, null, 2));
    return receipt;
  }
  const page = editor.page;
  await page.waitForTimeout(3000);
  const liveFile = resolve(out, "shots", "final-live.png");
  await page.screenshot({ path: liveFile });
  await editor.context.close();
  const again = await drv.newEditor(browser, host.url, projectDir, VIEW_CONFIG, { viewport: { width: 1440, height: 900 } });
  await again.page.waitForTimeout(4000);
  const loaded = again.loads.find((l) => l.sha256 === applied.sha256);
  const reloaded = drv.stored(projectDir);
  const receipt = { tag: "final", projectId: applied.projectId, revision: applied.revision, afterSha256: applied.sha256, reloadedSha256: reloaded.sha256,
    sameStoredDocument: applied.sha256 === reloaded.sha256, rendererLoadObserved: Boolean(loaded),
    rendererMapsAndDatabaseEqual: Boolean(loaded) && isDeepStrictEqual(applied.project.maps, loaded.maps) && isDeepStrictEqual(applied.project.database, loaded.database),
    generatedImageResources: Object.keys(applied.project.assets?.uploaded ?? {}).length,
    maps: Object.values(applied.project.maps).map((m) => ({ id: m.id, name: m.name, size: `${m.width}x${m.height}`, events: (m.events ?? []).length })) };
  await again.page.screenshot({ path: resolve(out, "shots", "final-reload.png") });
  writeFileSync(resolve(out, "persistence-final.json"), JSON.stringify(receipt, null, 2));
  return receipt;
}

let queue = Promise.resolve();
const serial = (fn) => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };
const body = (req) => new Promise((done) => { let s = ""; req.on("data", (c) => { s += c; }); req.on("end", () => done(s ? JSON.parse(s) : {})); });

const server = createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, "http://x");
  let payload = {};
  try {
    const input = req.method === "POST" ? await body(req) : {};
    payload = await serial(async () => {
      switch (url.pathname) {
        case "/status": { const s = await call("oprn:team.status"); return { revision: s.revision }; }
        case "/tools": return toolList.map((t) => ({ name: t.name, mode: t.mode, description: String(t.description).split("\n")[0].slice(0, 220) }));
        case "/schema": { const t = toolList.find((x) => x.name === url.searchParams.get("name")); return t ?? { error: "unknown tool" }; }
        case "/get": { const w = await current(); writeFileSync(resolve(input.file), JSON.stringify(JSON.parse(H.serializeHeadlessProject(w.project)), null, 1)); return { file: input.file, revision: w.revision }; }
        case "/put": { const next = H.normalizeHeadlessProject(H.loadHeadlessProject(readFileSync(resolve(input.file), "utf8"))); return await saveProject(next); }
        case "/tool": return { name: input.name, ...(await runTool(input.name, input.args ?? {}, input.map)) };
        case "/shot": return await shot(input.map, input.name);
        case "/final": return await finalCheck();
        case "/quit": setTimeout(async () => { await browser?.close().catch(() => {}); await host.close(); process.exit(0); }, 200); return { ok: true };
        default: return { error: `unknown path ${url.pathname}` };
      }
    });
  } catch (error) {
    payload = { ok: false, error: String(error?.message ?? error).slice(0, 2000) };
  }
  log({ path: url.pathname, ms: Date.now() - started, ok: payload?.ok !== false && !payload?.error, ...(url.pathname === "/tool" ? { tool: payload?.name } : {}) });
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
});
server.listen(port, "127.0.0.1", () => { writeFileSync(resolve(out, "host-ready.json"), JSON.stringify({ port, warmupSec, hostUrl: host.url, imagePreflight: preflight })); });
