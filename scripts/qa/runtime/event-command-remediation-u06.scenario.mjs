import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { firefox } from "@playwright/test";
import { runRuntimeQa, startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { eventCommandQaOp } from "../../lib/runtimeQaEventCommands.mjs";

const state = (path, equals) => ({ source: "state", path, equals });
const graphic = id => ({ sprite: { type: "bundled", id }, direction: "down", pattern: 25 });
const actorGraphic = graphic("tex_easyrpg_charset_actor1");
const monster = { id: "monster:monster_1", name: "M", kind: "monster", monsterInstanceId: "monster_1",
  graphic: graphic("tex_easyrpg_charset_monster1") };
const actor = (id, name) => ({ id: `actor:${id}`, eventId: id, name, kind: "actor", graphic: actorGraphic });
const custom = { sprite: { type: "uploaded", id: "charsetB" }, direction: "left", pattern: 2, transparent: false };
const mascot = { id: "mascot:Mascot", name: "Mascot", kind: "actor", graphic: custom };
const op = (trigger, observe, timeoutMs = 15_000) => ({ kind: "eventCommand", trigger, observe, timeoutMs });
const key = key => ({ kind: "key", key });
const barrier = (body, followers) => [
  { source: "dom", selector: '[data-testid="dialogue-box"].page-ready', read: "present", equals: true },
  { source: "dom", selector: '[data-testid="dialogue-box"] .body', read: "text", equals: body },
  state(["followers"], followers),
];

export function scenario(projectFixture) {
  return { id: "event-command-remediation-u06", projectFixture, viewport: { width: 1280, height: 800 }, beats: [
    { id: "boot", ops: [op(key("Enter"), [state(["player"], { x: 2, y: 3 }), state(["followers"], [])], 120_000)] },
    { id: "ready", shot: true, ops: [op(key("z"), barrier("READY", [actor("actor_hero", "Alice"), actor("actor_u06_bob", "Bob"), monster]))] },
    { id: "named-removal", shot: true, ops: [op(key("z"), barrier("NAMED", [actor("actor_hero", "Alice"), monster]))] },
    { id: "explicit-all", shot: true, ops: [op(key("z"), barrier("ALL", [monster]))] },
    { id: "graphic-off-actor-default", shot: true, ops: [op(key("z"), barrier("DEFAULT", [actor("actor_hero", "Hero"), monster]))] },
    { id: "graphic-only", shot: true, ops: [op(key("z"), barrier("CUSTOM", [mascot, monster]))] },
    { id: "restored-draft-actor-default", shot: true, ops: [op(key("z"), barrier("RESTORED", [actor("actor_hero", "Hero renamed"), monster]))] },
  ] };
}
export default scenario("/tmp/event-command-remediation/U06/project.json");

export async function provePlayer(editorFile, out, owned) {
  // Given: exact editor-exported commands; setup/barriers are QA-only, never remote content.
  const saved = JSON.parse(await readFile(editorFile, "utf8"));
  const runtime = structuredClone(saved);
  const event = runtime.maps[runtime.startMapId].events[0];
  const commands = event.pages[0].commands;
  assert.deepEqual(commands, [
    { kind: "removeFollower", name: "Bob" }, { kind: "removeFollower", all: true },
    { kind: "addFollower", actorId: "actor_hero", name: "Hero" },
    { kind: "addFollower", actorId: "actor_hero", name: "Hero renamed", graphic: { ...custom, scale: 2, direction: "up", pattern: 1 } },
    { kind: "addFollower", name: "Mascot", graphic: custom },
  ]);
  const text = body => ({ kind: "text", body });
  const program = [
    { kind: "addFollower", actorId: "actor_hero", name: "Alice" },
    { kind: "addFollower", actorId: "actor_u06_bob", name: "Bob" },
    { kind: "giveMonster", speciesId: "species_wild_slime", level: 3, nickname: "M" }, text("READY"),
    commands[0], text("NAMED"), commands[1], text("ALL"), commands[2], text("DEFAULT"),
    { kind: "removeFollower", all: true }, commands[4], text("CUSTOM"),
    { kind: "removeFollower", all: true }, commands[3], text("RESTORED"),
  ];
  event.commands = program; event.pages[0].commands = program;
  const fixture = join(owned, "runtime-project.json"); await writeFile(fixture, JSON.stringify(runtime));
  await writeFile(join(out, "player-inputs.json"), JSON.stringify({ editorFile, commands, program,
    note: "Actor IDs execute default appearance. The graphic-only Mascot executes custom uploaded appearance. Exact entire monster follower is retained at every barrier; monsterParty/monsterInstances are separately covered by U06 integration tests." }, null, 2));
  process.env.VITE_CACHE_DIR = resolve(owned, "player-cache"); process.env.E2E_FREEZE_DEV_SERVER = "1";
  process.env.VITE_SUPABASE_URL = ""; process.env.VITE_SUPABASE_ANON_KEY = ""; process.env.VITE_SUPABASE_USE_PROXY = "0";
  const server = await startPlayerQaServer(); let browser;
  try {
    browser = await firefox.launch({ headless: true });
    const context = await browser.newContext(); const page = await context.newPage();
    // When: H0 arms exact state/DOM subscriptions before each real key.
    const report = await runRuntimeQa(page, scenario(fixture), { serverUrl: server.url, outDir: join(out, "player") });
    // Then: every barrier has the exact expected followers, not just a node/count.
    assert.deepEqual(report.errors, []);
    assert.ok(report.beats.every(beat => beat.failures.length === 0), JSON.stringify(report.beats.filter(beat => beat.failures.length)));
    const geometry = [];
    for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      const bounds = await page.evaluate(() => {
        const canvas = document.querySelector("canvas"); if (!canvas) throw new Error("Player canvas missing");
        const r = canvas.getBoundingClientRect();
        return { url: location.href, editor: Boolean(document.querySelector(".editor-layout")), pending: Boolean(window.__eventCommandQa),
          x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      });
      assert.ok(bounds.url.endsWith("/player.html")); assert.equal(bounds.editor, false); assert.equal(bounds.pending, false);
      assert.ok(bounds.width > 0 && bounds.height > 0 && bounds.x >= 0 && bounds.y >= 0 && bounds.right <= viewport.width && bounds.bottom <= viewport.height);
      geometry.push({ ...viewport, ...bounds });
      await page.screenshot({ path: join(out, `player-${viewport.width}.png`) });
    }
    await writeFile(join(out, "player-geometry.json"), JSON.stringify(geometry, null, 2));
    // A wrong target must fail on the same real player, without another startup.
    let negative;
    await assert.rejects(eventCommandQaOp(page, op({ kind: "none" }, [state(["followers", 0, "name"], "Bob")], 250)), error => {
      if (!(error instanceof Error) || !("observation" in error)) return false;
      negative = error.observation; return negative.status === "timeout";
    });
    assert.deepEqual(negative.after, [{ value: "Hero renamed" }]);
    await writeFile(join(out, "player-negative.json"), JSON.stringify(negative, null, 2));
    await context.close(); console.log("PLAYER PASS: 7 beats, exact follower intent, wrong-target rejection");
  } finally {
    await browser?.close(); await server.close();
    await writeFile(join(out, "player-cleanup.json"), JSON.stringify({ port: server.port, serverClosed: true, browserClosed: true, observationsDisposed: true }, null, 2));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [editorFile, out] = process.argv.slice(2); assert.ok(editorFile && out);
  const owned = await mkdtemp(join(out, "tmp-player-"));
  try { await provePlayer(editorFile, out, owned); }
  finally { await rm(owned, { recursive: true, force: true }); }
}
