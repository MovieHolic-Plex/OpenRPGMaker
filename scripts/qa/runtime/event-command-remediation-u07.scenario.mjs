import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { firefox } from "@playwright/test";
import { runRuntimeQa, startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { eventCommandQaOp } from "../../lib/runtimeQaEventCommands.mjs";
import { installPlayerObservation } from "../../../test/eventCommandRemediation/U07/playerObservation.mjs";

const HERO = "actor_hero";
const state = (path, equals) => ({ source: "state", path, equals });
const present = selector => ({ source: "dom", selector, read: "present", equals: true });
const attribute = (selector, name, equals) => ({ source: "dom", selector, read: "attribute", name, equals });
const op = (key, observe) => ({ kind: "eventCommand", trigger: { kind: "key", key }, observe, timeoutMs: 120_000 });
const ready = body => [present('[data-testid="dialogue-box"].page-ready'),
  { source: "dom", selector: '[data-testid="dialogue-box"] .body', read: "text", equals: body }];
const boot = { id: "boot", ops: [op("Enter", [state(["player"], { x: 2, y: 3 })])] };
const otherRecord = { characterGraphic: "easyrpg-charset-actor2", faceset: "u07-faceset-old-bust" };
const otherReady = { id: "untargeted-actor-precondition", ops: [op("z", [...ready("U07_OTHER"), state(["m2Runtime", "actors", "u07_other"], otherRecord)])] };

export function scenario(projectFixture) {
  return { id: "event-command-remediation-u07-map", projectFixture, viewport: { width: 1280, height: 800 }, beats: [boot, otherReady,
    { id: "g2-f9-g3-f22-g3-f24-g4-f11-g4-f13", shot: true, ops: [op("z", [
      ...ready("U07_MAP"), state(["m2Runtime", "actors", HERO, "characterGraphic"], "u07-charset-new"),
      state(["m2Runtime", "actors", HERO, "faceset"], "u07-faceset-new-bust"),
      state(["m2Runtime", "map", "parallax_override", "value"], "u07-backdrop-new"),
      state(["m2Runtime", "map", "escape_location"], { mapId: "u07-map-12", x: 0, y: 9, value: "" }),
      state(["m2Runtime", "system", "vehicle_graphic_boat"], "u07-charset-new"),
      state(["variables", "u07-reward-17"], 2), state(["removedEventIds", "u07-map-04"], ["u07-event-b"]),
      state(["m2Runtime", "checkpoints"], [{ slotId: "u07-manual-9", label: "", restoreOnGameOver: false }]),
      state(["partyActorIds"], [HERO, "u07_other"]), state(["m2Runtime", "actors", "u07_other"], otherRecord),
    ])], expect: { playerSpriteTextureLoaded: true } },
  ] };
}
export default scenario("/tmp/event-command-remediation/U07/project.json");

export async function provePlayer(sourceFile, out, owned) {
  // Given: exact editor-exported payloads. Only QA setup/barriers are introduced.
  const source = await readFile(sourceFile, "utf8"); const saved = JSON.parse(source);
  const commands = saved.maps["u07-map-04"].events[0].pages[0].commands;
  assert.equal(commands.length, 17);
  assert.equal(commands[0].fields.value, "u07-charset-new"); assert.equal(commands[1].fields.value, "u07-faceset-new-bust");
  assert.equal(commands[3].fields.resourceId, "u07-backdrop-new"); assert.equal(commands[13].fields.restoreOnGameOver, false);
  assert.equal(saved.assets.uploaded[commands[15].fields.value].kind, "faceset");
  assert.equal(saved.assets.uploaded[commands[16].fields.value].kind, "backdrop");
  const text = body => ({ kind: "text", body });
  const setup = [{ ...commands[0], fields: { ...commands[0].fields, target: "u07_other", value: otherRecord.characterGraphic } },
    { ...commands[1], fields: { ...commands[1].fields, target: "u07_other", value: otherRecord.faceset } }, text("U07_OTHER")];
  const mapProgram = [...setup, commands[0], commands[1], commands[2], commands[4], commands[6], commands[11], commands[12], commands[13], text("U07_MAP")];
  const cases = [{ id: "map", program: mapProgram }];
  for (const [id, face, parallax] of [["battle", commands[1], commands[2]], ["ai-battle", commands[15], commands[16]]]) {
    cases.push({ id, faceId: face.fields.value, parallaxId: parallax.fields.value, program: [...setup, commands[0], face, parallax,
      { kind: "battleProcessing", troopId: saved.database.troops[0].id, canEscape: true, canLose: true, battleFlow: "strict", onWin: [], onEscape: [], onLose: [] }] });
  }
  await writeFile(join(out, "player-inputs.json"), JSON.stringify({ sourceFile, sourceHash: createHash("sha256").update(source).digest("hex"), commands, cases,
    limitations: ["Parallax, escape location, vehicle graphic and checkpoint remain recorded contracts; no live parallax/travel/vehicle movement/checkpoint restore claimed.",
      "System BGM/SE field normalization belongs to U14; no immediate playback is claimed. Spawn and region runtime semantics belong to U10/U19."] }, null, 2));
  process.env.VITE_CACHE_DIR = resolve(owned, "player-cache"); process.env.E2E_FREEZE_DEV_SERVER = "1";
  process.env.VITE_SUPABASE_URL = ""; process.env.VITE_SUPABASE_ANON_KEY = ""; process.env.VITE_SUPABASE_USE_PROXY = "0";
  const server = await startPlayerQaServer(); let browser; const results = []; const failures = [];
  try {
    browser = await firefox.launch({ headless: true });
    for (const entry of cases) {
      const project = structuredClone(saved); const event = project.maps[project.startMapId].events[0];
      // QA host faces the default downward-facing player; command payloads stay unchanged.
      event.y = 4;
      event.commands = entry.program; event.pages[0].commands = entry.program;
      const other = { ...structuredClone(project.database.actors.find(actor => actor.id === HERO)), id: "u07_other", name: "U07 untargeted", characterResourceId: "easyrpg-charset-actor2" };
      project.database.actors.push(other);
      if (entry.id === "map") project.session.partyActorIds = [HERO, other.id];
      for (const troop of project.database.troops) troop.battleEventPages = [];
      if (entry.id !== "map") {
        project.database.troops[0].battleEventPages = [{ id: "u07-battle-page", name: "U07 battleback", span: "battle", conditions: [], commands: [commands[3]] }];
        const hero = project.database.actors.find(actor => actor.id === HERO);
        const klass = project.database.classes.find(klass => klass.id === hero.classId);
        // Troop pages execute at the action boundary, not the first command menu.
        // Keep one existing defend action so Enter deterministically reaches that boundary.
        klass.battleCommands = klass.battleCommands.filter(command => command.kind === "defend");
      }
      const fixture = join(owned, `${entry.id}.json`); await writeFile(fixture, JSON.stringify(project));
      const spec = entry.id === "map" ? scenario(fixture) : {
        id: `event-command-remediation-u07-${entry.id}`, projectFixture: fixture, viewport: { width: 1280, height: 800 }, beats: [boot, otherReady,
          { id: "battle-ready", ops: [op("z", [
            attribute('[data-testid="battle-scene"]', "data-battle-director-step", "command"),
            present('[data-testid="actor-command-defend"]'),
            present(`.battle-actor-status[data-record-id="${HERO}"] [data-face-resource-id="${entry.faceId}"]`),
          ])] },
          { id: "g2-f9-g2-f15-g3-f22", shot: true, ops: [op("Enter", [
            attribute('[data-testid="battle-backdrop"]', "data-backdrop-resource-id", "u07-backdrop-new"),
            present(`.battle-actor-status[data-record-id="${HERO}"] [data-face-resource-id="${entry.faceId}"]`),
            state(["m2Runtime", "map", "parallax_override", "value"], entry.parallaxId),
          ])] },
        ],
      };
      const context = await browser.newContext(); const writes = [];
      await context.route(url => /(?:supabase|dbserver|\/rest\/v1|\/projects?(?:\/|$))/i.test(url.href), async route => {
        if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) { writes.push(route.request().method()); await route.abort("blockedbyclient"); }
        else await route.continue();
      });
      const page = await context.newPage(); page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(120_000);
      await page.addInitScript(installPlayerObservation);
      try {
        // When: H0 subscribes before each real player key; no interpreter/session mutation hooks.
        const report = await runRuntimeQa(page, spec, { serverUrl: server.url, outDir: join(out, `player-${entry.id}`) });
        // Then: actual native/runtime records and rendered sprite/face/backdrop match the exported selections.
        assert.deepEqual(report.errors, []); assert.ok(report.beats.every(beat => beat.failures.length === 0), JSON.stringify(report.beats));
        const surface = await page.evaluate(() => ({ url: location.href, editor: Boolean(document.querySelector(".editor-layout")), pending: Boolean(window.__eventCommandQa), loadedPlayer: window.__u07ReadPlayer?.(),
          sprite: window.__oprnPlayerSprite?.(), backdrop: document.querySelector('[data-testid="battle-backdrop"]')?.style.backgroundImage,
          face: document.querySelector('.battle-actor-status [data-face-resource-id]')?.getAttribute("data-face-resource-id") }));
        assert.ok(surface.url.endsWith("/player.html")); assert.equal(surface.editor, false); assert.equal(surface.pending, false);
        if (entry.id !== "map") { assert.equal(surface.face, entry.faceId); assert.ok(surface.backdrop.includes(saved.assets.uploaded["u07-backdrop-new"].dataUrl)); }
        const geometry = [];
        for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
          await page.setViewportSize(viewport); const r = await page.getByTestId("play-canvas").locator("canvas").boundingBox(); assert.ok(r);
          assert.ok(r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.x + r.width <= viewport.width && r.y + r.height <= viewport.height);
          geometry.push({ viewport, ...r }); await page.screenshot({ path: join(out, `player-${entry.id}-${viewport.width}.png`) });
        }
        assert.deepEqual(writes, []); results.push({ id: entry.id, beats: report.beats.length, surface, geometry, remoteWrites: writes });
        if (entry.id === "map") {
          let negative;
          await assert.rejects(eventCommandQaOp(page, { kind: "eventCommand", trigger: { kind: "none" }, observe: [state(["m2Runtime", "actors", HERO, "characterGraphic"], "u07-charset-old")], timeoutMs: 250 }), error => {
            negative = error.observation; return negative?.status === "timeout";
          });
          assert.deepEqual(negative.after, [{ value: "u07-charset-new" }]); await writeFile(join(out, "player-negative.json"), JSON.stringify(negative, null, 2));
        }
        await writeFile(join(out, `player-${entry.id}-loaded.json`), JSON.stringify(surface, null, 2));
        assert.equal(surface.sprite?.resourceId, "u07-charset-new"); assert.notEqual(surface.sprite?.textureKey, "__MISSING");
        assert.equal(surface.loadedPlayer?.textureExists, true);
        assert.deepEqual(surface.loadedPlayer?.frames, [
          { id: 24, x: 0, y: 64, width: 24, height: 32 },
          { id: 25, x: 24, y: 64, width: 24, height: 32 },
          { id: 26, x: 48, y: 64, width: 24, height: 32 },
        ]);
        assert.deepEqual(surface.loadedPlayer?.other, { graphic: otherRecord.characterGraphic, face: otherRecord.faceset, record: otherRecord });
        if (entry.id === "map") {
          assert.deepEqual(surface.loadedPlayer.frame, { name: 25, x: 24, y: 64, width: 24, height: 32 });
          await eventCommandQaOp(page, op("z", [state(["inputEnabled"], true), state(["running"], false)]));
          await page.evaluate(() => window.__u07ArmFrame(true));
          await page.keyboard.down("ArrowRight");
          const walk = await page.evaluate(() => window.__u07FrameResult);
          await page.evaluate(() => window.__u07ArmFrame(false));
          await page.keyboard.up("ArrowRight");
          const idle = await page.evaluate(() => window.__u07FrameResult);
          await writeFile(join(out, "player-walk.json"), JSON.stringify({ walk, idle }, null, 2));
          assert.equal(walk.status, "success"); assert.equal(walk.moving, true); assert.equal(walk.textureKey, "u07-charset-new");
          assert.ok([12, 13, 14].includes(Number(walk.frame.name))); assert.equal(walk.frame.x, (Number(walk.frame.name) - 12) * 24);
          assert.deepEqual([walk.frame.y, walk.frame.width, walk.frame.height], [32, 24, 32]);
          assert.deepEqual(idle, { status: "success", moving: false, textureKey: "u07-charset-new", frame: { name: 13, x: 24, y: 32, width: 24, height: 32 } });
        }
      } catch (error) {
        if (!(error instanceof assert.AssertionError)) throw error;
        // Keep independent surface receipts, but propagate every assertion failure at the end.
        failures.push({ id: entry.id, message: error.message, actual: error.actual, expected: error.expected });
      } finally { await context.close(); }
    }
    await writeFile(join(out, "player-observations.json"), JSON.stringify(results, null, 2));
    await writeFile(join(out, "player-failures.json"), JSON.stringify(failures, null, 2));
    assert.deepEqual(failures, []);
    console.log("PLAYER PASS: 3 scenarios, 11 beats, real idle/walk/face/battleback and untargeted actor control");
  } finally {
    await browser?.close(); await server.close();
    await writeFile(join(out, "player-cleanup.json"), JSON.stringify({ port: server.port, serverClosed: true, browserClosed: true, observationsDisposed: true }, null, 2));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [sourceFile, out] = process.argv.slice(2); assert.ok(sourceFile && out);
  const owned = await mkdtemp(join(out, "tmp-player-"));
  try { await provePlayer(sourceFile, out, owned); }
  finally { await rm(owned, { recursive: true, force: true }); }
}
