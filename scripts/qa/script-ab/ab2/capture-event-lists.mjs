// capture-event-lists.mjs — screenshots of the event editor's command list, one PNG per event page, for the
// readability judge. Uses the real dev editor (viewer = OPRN branch agent/script-readable or main after #4146,
// which renders script commands inline as event-style lines). Scratch only: the project is loaded into the
// browser store from a JSON file and never saved.
//
//   node capture-event-lists.mjs --base http://127.0.0.1:9980 --project run.json --events events.json --out dir
//     events.json: [{ "mapId": "...", "eventId": "..." } | { "commonEventId": "..." }, ...]
//   prints one JSON line per shot: {"key": "...", "file": "...", "page": n, "commands": n}
//
// Needs a dev server of the viewer build (`npm run dev:worktree` in that checkout) and Playwright from that
// checkout's node_modules (set PW=/path/to/node_modules/playwright/index.mjs). Common events are shown by
// copying their commands into a temporary event on the first map (browser store only).
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : fallback;
};
const base = arg("base", "http://127.0.0.1:9980");
const projectFile = arg("project");
const events = JSON.parse(readFileSync(arg("events"), "utf8"));
const out = arg("out", "./event-lists");
mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PW ?? "/home/main/z-project/rpg-zzu-script-editor-live/node_modules/playwright/index.mjs");

const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier", "--js-flags=--max-old-space-size=8192"] });
const page = await browser.newPage({ viewport: { width: +(process.env.CAP_W ?? 1680), height: +(process.env.CAP_H ?? 1000) } });
await page.route("**/__cap_project.json", (route) => route.fulfill({ body: readFileSync(projectFile), contentType: "application/json" }));
await page.goto(`${base}/?blankProject=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__oprnEditorStore?.isLoaded?.(), null, { timeout: 180000 });
await page.waitForFunction(() => !!document.querySelector("canvas"), null, { timeout: 180000 }).catch(() => undefined);
await page.waitForTimeout(3000);
await page.evaluate(async () => {
  const project = await (await fetch("/__cap_project.json")).json();
  // A/B 2: run.json may come without tilesets (runtime exports carry ~100 MB of bundled sheets and crash the tab);
  // the blank editor project already holds the bundled ones — keep those for ids the file does not carry.
  const doc = project.project ?? project;
  doc.tilesets = { ...(window.__oprnEditorStore.getCurrent().tilesets ?? {}), ...(doc.tilesets ?? {}) };
  window.__oprnEditorStore.replaceProject(doc);
});
await page.waitForTimeout(2000);
// Warm the TypeScript reader so script lines render immediately.
await page.evaluate(async () => { const c = await import("/src/editor/script/compile.ts"); await c.prepareScriptCompiler(); });

for (const target of events) {
  const info = await page.evaluate(async (t) => {
    const store = window.__oprnEditorStore;
    const project = store.getCurrent();
    let mapId = t.mapId;
    let eventId = t.eventId;
    let label = `${t.mapId}/${t.eventId}`;
    if (t.commonEventId) {
      const common = project.commonEvents.find((entry) => entry.id === t.commonEventId);
      if (!common) return { error: "no common event" };
      mapId = project.startMapId ?? Object.keys(project.maps)[0];
      eventId = `__cap_ce_${common.id}`;
      label = `common/${common.id}`;
      const map = project.maps[mapId];
      if (!map.events.some((e) => e.id === eventId)) {
        const template = map.events[0];
        map.events.push({ ...(template ? structuredClone(template) : {}), id: eventId, name: `공통 이벤트: ${common.name ?? common.id}`, x: 0, y: 0, pages: [{ ...(template?.pages?.[0] ? structuredClone(template.pages[0]) : {}), id: `${eventId}_p1`, commands: structuredClone(common.commands ?? []) }] });
      }
    }
    const event = project.maps[mapId]?.events.find((e) => e.id === eventId);
    if (!event) return { error: "no event" };
    return { mapId, eventId, label, pages: event.pages.map((p) => ({ id: p.id, commands: (p.commands ?? []).length })) };
  }, target);
  if (info.error) { console.log(JSON.stringify({ key: JSON.stringify(target), error: info.error })); continue; }
  for (const [index, pageInfo] of info.pages.entries()) {
    await page.evaluate(async ([mapId, eventId, pageId]) => {
      const st = await import("/src/editor/editorState.ts");
      st.editorState.set({ currentMapId: mapId });
      const m = await import("/src/editor/panels/eventEditor/modal.ts");
      m.openEventEditorModal(mapId, eventId, { pageId });
    }, [info.mapId, info.eventId, pageInfo.id]);
    await page.waitForTimeout(2200);
    const file = join(out, `${info.label.replace(/[^\w.-]+/g, "_")}-p${index + 1}.png`);
    // Unclip the list: every scrolling/fixed ancestor grows to its content so the whole list is in one image.
    const unclipped = await page.evaluate(() => {
      const list = document.querySelector(".event-editor-modal-window .cmd-list");
      if (!list) return false;
      for (let node = list.parentElement; node && node !== document.documentElement; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (/(auto|scroll|hidden)/.test(style.overflow + style.overflowY)) node.style.setProperty("overflow", "visible", "important");
        node.style.setProperty("max-height", "none", "important");
        if (style.height !== "auto") node.style.setProperty("height", "auto", "important");
        if (style.position === "fixed") { node.style.setProperty("position", "absolute", "important"); node.style.setProperty("bottom", "auto", "important"); }
      }
      document.documentElement.style.setProperty("overflow", "visible", "important");
      document.body.style.setProperty("overflow", "visible", "important");
      document.body.style.setProperty("height", "auto", "important");
      return true;
    });
    await page.waitForTimeout(300);
    if (unclipped) await page.locator(".event-editor-modal-window .cmd-list").first().screenshot({ path: file });
    else await page.screenshot({ path: file });
    console.log(JSON.stringify({ key: info.label, file, page: index + 1, commands: pageInfo.commands }));
    await page.evaluate(() => { for (const el of [document.documentElement, document.body]) { el.style.removeProperty("overflow"); el.style.removeProperty("height"); } });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('[data-testid="event-editor-cancel"]')?.click());
    await page.waitForTimeout(600);
  }
}
await browser.close();
