// Run: npx tsx scripts/qa/emote-runtime.mts
// A transient two-command engine fixture, never an authored/remote demo project.
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createBlankProject } from "../../src/project/defaults";
import { DEFAULT_EASYRPG_CHARSET_ID } from "../../src/project/defaults/constants";
import { serialize } from "../../src/project/io";
import { runRuntimeQa, startPlayerQaServer } from "../lib/runtimeQaRun.mjs";
import emoteScenario from "./runtime/emote.scenario.mjs";
const project = createBlankProject();
project.startPos = { x: 4, y: 4 };
const commands = [
  { kind: "showEmote" as const, target: { eventId: "" }, emote: "heart" as const, durationMs: 10000 },
  { kind: "showEmote" as const, target: "player" as const, emote: "question" as const, durationMs: 10000 },
  { kind: "text" as const, body: "이모트를 띄워도 대사는 바로 이어집니다." },
];
project.maps[project.startMapId].events = [{
  id: "emote-npc", x: 5, y: 4, trigger: { kind: "action" }, commands,
  pages: [{ id: "p1", name: "명령 계약", conditions: [],
    graphic: { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down", pattern: 0 },
    trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  }],
}];
const dir = await mkdtemp(join(tmpdir(), "rpg-zzu-emote-contract-"));
const path = join(dir, "project.json");
await writeFile(path, serialize(project));
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
try {
  const page = await browser.newPage();
  const report = await runRuntimeQa(page, { ...emoteScenario, projectFixture: path }, { serverUrl: server.url });
  const failed = report.errors.length > 0 || report.beats.some((beat) => beat.failures.length > 0);
  console.log(`Emote runtime QA ${failed ? "FAILED" : "PASSED"}: verify-shots/runtime-qa/emote/SUMMARY.md`);
  process.exitCode = failed ? 1 : 0;
} finally {
  await browser.close(); await server.close();
}
