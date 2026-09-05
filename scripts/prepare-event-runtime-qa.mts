import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { eventRuntimeCommandsProject } from "../test/fixtures/eventRuntimeCommands.ts";
import { deserialize, serialize } from "../src/project/io.ts";
import { startSession } from "../src/project/session.ts";
import { createSaveSnapshot } from "../src/player/saveSlots.ts";

const out = ".omo/evidence/event-runtime-audit";
fs.mkdirSync(out, { recursive: true });
const project = deserialize(serialize(eventRuntimeCommandsProject()));
fs.writeFileSync(`${out}/runtime-project.json`, serialize(project));
const session = startSession(project);
session.x = 3; session.y = 9;
for (const id of ["ready", "path_done", "menu_done", "load_done", "movie_done"]) session.switches[id] = true;
fs.writeFileSync(`${out}/load-slot.json`, JSON.stringify(createSaveSnapshot(project, session)));
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15", "-t", "4", "-an", "-c:v", "libvpx", "-pix_fmt", "yuv420p", "-y", `${out}/qa-event-runtime.webm`]);
console.log("Prepared and reloaded the test-only player fixture and save slot.");
