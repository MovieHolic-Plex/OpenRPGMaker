import { createBlankProject } from "../../src/project/defaults";
import { deserialize, serialize } from "../../src/project/io";
import { M2_COMMAND_CATALOG } from "../../src/project/eventCommands/m2Catalog";
import type { Command, M2CommandFields, Project, UploadedAsset } from "../../src/project/types";

export function audioCommand(title: string, fields: M2CommandFields = {}): Command {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
  if (!entry) throw new Error(`Missing command ${title}`);
  return { kind: "m2Command", commandId: entry.id, fields };
}

// Local PCM fixtures keep browser decoding real without depending on a CDN or autoplay retries.
function tone(frequency: number, seconds: number): string {
  const samples = seconds * 8000;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index++) wav.writeInt16LE(Math.round(Math.sin(index * frequency * Math.PI / 4000) * 4000), 44 + index * 2);
  return `data:audio/wav;base64,${wav.toString("base64")}`;
}

export function u14Fixture(): Project {
  const project = createBlankProject();
  for (const [index, [id, kind]] of ([
    ["u14-field", "music"], ["u14-ambient", "music"], ["u14-other", "music"],
    ["u14-battle", "music"], ["u14-se", "sound"], ["u14-defeat", "sound"],
  ] as const).entries()) {
    const asset: UploadedAsset = { id, name: id, kind, dataUrl: tone(220 + index * 40, kind === "sound" ? 30 : 1),
      meta: { width: 0, height: 0 } };
    project.assets.uploaded[id] = asset;
    project.resourceProfiles.push({ kind, assetId: id, name: id });
  }
  const commands = [audioCommand("Sound Layer", { channel: "bgm", resourceId: "u14-field", volume: 100, fadeMs: 0 }),
    audioCommand("Memorize Current BGM"), audioCommand("Play Memorized BGM"),
    audioCommand("Change System BGM", { slot: "battle", resourceId: "u14-field" }),
    audioCommand("Change System SE", { slot: "defeat", resourceId: "u14-se" }),
    audioCommand("Change System BGM", { slot: "field", resourceId: "u14-field" }),
    { kind: "text", body: "U14_END" } satisfies Command];
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Missing start map");
  map.bgm = { mode: "parent" };
  map.events = [{ id: "u14-host", x: 2, y: 4, trigger: { kind: "action" }, commands, pages: [{
    id: "u14-page", name: "U14", conditions: [], trigger: { kind: "action" }, priority: "same",
    graphic: { sprite: { type: "uploaded", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 0 },
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  }] }];
  project.startPos = { x: 2, y: 3 };
  project.system.defaultBgmResourceId = "u14-field";
  project.system.battleBgmResourceId = "u14-field";
  project.system.battleDefeatSeResourceId = "u14-se";
  if (project.system.titleScreen) project.system.titleScreen.musicResourceId = "";
  return deserialize(serialize(project));
}
