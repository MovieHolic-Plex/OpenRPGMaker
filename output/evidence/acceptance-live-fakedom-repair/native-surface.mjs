import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { build } from "esbuild";
import { firefox } from "playwright";

// Local production component only: no editor boot, project load, model or DB.
const bundle = await build({
  entryPoints: ["src/editor/panels/eventEditor/customSelect.ts"],
  bundle: true, write: false, format: "iife", globalName: "customSelect",
});
const browser = await firefox.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route("**/*", route => route.abort());
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(() => {
    const host = document.createElement("section"), select = document.createElement("select");
    const first = document.createElement("option"), second = document.createElement("option");
    const group = document.createElement("optgroup");
    first.value = "first"; first.textContent = "FIRST";
    second.value = "second"; second.textContent = "SECOND";
    group.label = "GROUP"; group.append(second);
    select.append(first, group); host.append(select); document.body.append(host);
    const controller = customSelect.installEventEditorCustomSelects(host);
    const events = [];
    host.addEventListener("input", () => events.push("input"));
    host.addEventListener("change", () => events.push("change"));
    const trigger = host.querySelector(".event-custom-select-trigger");
    trigger.click();
    const rows = host.querySelectorAll(".event-custom-select-option");
    const initial = { options: select.options.length, rows: rows.length, rootOwned: document.body.firstElementChild === host };
    rows[1].click();
    const selected = { value: select.value, index: select.selectedIndex, label: trigger.textContent, events,
      menuRemoved: host.querySelector(".event-custom-select-popover") === null };
    controller.dispose();
    const cleanup = { selectCount: host.querySelectorAll("select").length, directChild: host.firstElementChild === select,
      children: host.children.length, ariaHidden: select.getAttribute("aria-hidden") };
    host.remove();
    return { initial, selected, cleanup, bodyChildren: document.body.children.length };
  });
  assert.deepEqual(result, {
    initial: { options: 2, rows: 2, rootOwned: true },
    selected: { value: "second", index: 1, label: "SECOND", events: ["input", "change"], menuRemoved: true },
    cleanup: { selectCount: 1, directChild: true, children: 1, ariaHidden: null }, bodyChildren: 0,
  });
  writeFileSync(new URL("native-surface.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
