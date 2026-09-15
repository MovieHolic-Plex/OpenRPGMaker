
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.PROBE_BASE ?? "http://127.0.0.1:9843";
const AUTH = process.env.OPRN_OH_MY_PI_AUTH_PATH ?? "";
const OUT = process.env.AUDIT_OUT ?? "/tmp/concept-plan-verify.json";
const PROMPT = process.env.AUDIT_PROMPT ?? "여관 지어줘";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
const page = await context.newPage();
page.on("dialog", (dialog) => { void dialog.accept(); });
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:ai-config", JSON.stringify({ maxToolCalls: 40, maxTokens: 32768, agentMode: "chat" }));
});
const t0 = Date.now();
const auth = await page.request.get(`${BASE}/auth/status`).then((res) => res.json());
if (!auth.connected) throw new Error(`auth not connected ${JSON.stringify(auth)} path=${AUTH}`);
await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "load", timeout: 60_000 });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible().catch(() => false)) await guest.click();
const start = page.getByTestId("standard-welcome-start");
if (await start.isVisible({ timeout: 3_000 }).catch(() => false)) await start.click();
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
const result = await page.evaluate(async (prompt) => {
  const bridge = window.__oprnAiBridge;
  if (!bridge) throw new Error("window.__oprnAiBridge 미등록");
  const before = bridge.audit().length;
  const turn = await bridge.send(prompt);
  const project = window.__oprnProjectE2E?.currentProject().project;
  const hash = (tiles) => {
    let h = 2166136261;
    for (const t of tiles) { h ^= (t + 2) & 0xffff; h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  };
  const maps = project
    ? Object.fromEntries(Object.entries(project.maps).filter(([id]) => id !== "map_blank_start").map(([id, map]) => {
        const plan = map.roomHarnessPlan?.plan;
        return [id, {
          name: map.name, width: map.width, height: map.height, events: map.events.length,
          tileHash: hash([...map.lowerTiles, ...map.upperTiles]),
          seed: plan?.seed, wallMaterial: plan?.wallMaterial ?? "cream",
          rooms: (plan?.rooms ?? []).map((room) => ({ id: room.id, x: room.x, y: room.y, w: room.w, h: room.h, theme: room.theme, floorTile: room.floorTile })),
          facility: plan?.concept?.facilityLabel,
          things: Object.fromEntries(Object.entries(plan?.concept?.rooms ?? {}).map(([roomId, room]) => [
            roomId, `${room.placeLabel}[${room.role}]: ${room.things.map((thing) => thing.objectId + (thing.required ? "*" : "")).join(",")}`,
          ])),
          lowerTiles: map.lowerTiles, upperTiles: map.upperTiles,
        }];
      }))
    : null;
  return {
    ok: turn.ok, error: turn.error, lastAssistantText: turn.lastAssistantText,
    tools: turn.audit.slice(before).filter((entry) => entry.kind === "tool").map((entry) => `${entry.name} | ${entry.summary ?? ""}`),
    maps,
  };
}, PROMPT);
writeFileSync(OUT, `${JSON.stringify({ provider: auth.provider, prompt: PROMPT, elapsedMs: Date.now() - t0, ...result }, null, 2)}\n`);
console.log(`[plan-verify] ${Date.now() - t0}ms tools=${result.tools.length} maps=${Object.keys(result.maps ?? {}).join(",")}`);
await browser.close();
