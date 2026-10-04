// 점검 4: 스튜디오 버튼(aria-pressed) 토글 + 조수 사이드바 표시. behaviour2 의 assistant 판정(잘못된 표시 판정)을 대체.
import { launch, BASE, wait, rmSync, writeFileSync } from "./lib.mjs";
import { readFileSync } from "node:fs";
const OUT = "verify-shots/editor-lag-integrated/";
const profile = "/tmp/lag-int/prof-beh3"; rmSync(profile, { recursive: true, force: true });
const { ctx, page } = await launch({ profile });
await page.goto(BASE + "/");
for (let i = 0; i < 3000; i++) { if (await page.evaluate(() => typeof window.__oprnEditWorldToClient === "function").catch(() => false)) break; await wait(40); }
await wait(2500);
const st = () => page.evaluate(() => { const b = document.querySelector("[data-testid=topbar-ai-studio]"); const s = document.querySelector("[data-testid=editor-ai-sidebar]"); const r = s?.getBoundingClientRect(); const c = s?.querySelector(":scope > *:not(.ai-activity-bar)"); return { pressed: b?.getAttribute("aria-pressed"), sidebar: !!s, sw: r ? Math.round(r.width) : 0, collapsed: s?.classList.contains("is-collapsed") ?? null, canvas: document.querySelectorAll("canvas").length, tid: [...document.querySelectorAll("[data-testid]")].map((e) => e.dataset.testid).filter((t) => /studio|ai-/.test(t)).slice(0, 12) }; });
const s0 = await st(); await page.click("[data-testid=topbar-ai-studio]"); await wait(2500); const s1 = await st();
await page.screenshot({ path: OUT + "beh-10-assistant-open.png" });
await page.click("[data-testid=topbar-ai-studio]"); await wait(2000); const s2 = await st();
const r = { initial: s0, open: s1, closed: s2, ok: s0.pressed === "false" && s1.pressed === "true" && s2.pressed === "false" };
const prev = JSON.parse(readFileSync(OUT + "behaviour2.json", "utf8")); prev.assistant = r; prev.checks.assistant_toggles = r.ok;
writeFileSync(OUT + "behaviour2.json", JSON.stringify(prev, null, 1));
console.log(JSON.stringify(r));
await ctx.close();
