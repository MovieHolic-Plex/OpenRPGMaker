import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage();
await p.goto("http://localhost:9999/?project=rpg-zzu-quest-demo&map=map_snow_mountain_60", { waitUntil: "domcontentloaded" });
await p.getByTestId("project-export-json").waitFor({ state: "attached", timeout: 60_000 });
const dump = await p.evaluate(() => {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i)!;
    if (k.includes("supabase") || k.includes("project") || k.includes("rpg-zzu")) {
      const v = localStorage.getItem(k) ?? "";
      out[k] = v.length > 300 ? `${v.slice(0, 300)}…(${v.length})` : v;
    }
  }
  return out;
});
console.log(JSON.stringify(dump, null, 1));
await b.close();
