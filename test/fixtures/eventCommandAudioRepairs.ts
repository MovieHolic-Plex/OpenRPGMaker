/** Test-owned PCM tones for real media playback; never shipped as authored game content. */
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";

function tone(frequency: number): string {
  const rate = 8000;
  const samples = rate * 2;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) bytes[offset + i] = value.charCodeAt(i);
  };
  text(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i += 1) {
    view.setInt16(44 + i * 2, Math.round(Math.sin(i * frequency * Math.PI * 2 / rate) * 2400), true);
  }
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
}

export function audioCommandRepairsProject() {
  const project = createBlankProject();
  project.meta.title = "Audio command repairs";
  project.startPos = { x: 3, y: 6 };
  project.system.titleScreen = { ...project.system.titleScreen, title: project.meta.title };
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Audio fixture has no start map");
  map.lowerTiles.fill(240);
  map.upperTiles.fill(-1);
  map.bgm = { mode: "none" };
  map.encounterRate = 0;
  project.switches.push({ id: "audio_repair_done", name: "Audio repair complete" });
  for (const [id, frequency] of [["qa_bgm", 220], ["qa_bgs", 330], ["qa_se", 660], ["qa_ambient", 440]] as const) {
    const kind = id === "qa_se" ? "sound" : "music";
    project.assets.uploaded[id] = { id, name: id, kind, meta: {}, dataUrl: tone(frequency) };
    project.resourceProfiles.push({ assetId: id, name: id, kind });
  }
  const layer = (channel: string, resourceId: string, volume: number): Command => ({
    kind: "m2Command", commandId: "m2-210-sound-layer",
    fields: { channel, resourceId, volume, fadeMs: 0 },
  });
  const commands: Command[] = [
    { kind: "text", body: "AUDIO START" },
    layer("bgm", "qa_bgm", 100),
    { kind: "text", body: "BGM READY" },
    layer("bgs", "qa_bgs", 63),
    { kind: "text", body: "BGS READY" },
    layer("se", "qa_se", 63),
    { kind: "text", body: "SE READY" },
    layer("ambient", "qa_ambient", 0),
    { kind: "text", body: "AMBIENT MUTED" },
    layer("ambient", "qa_ambient", 25),
    { kind: "text", body: "AMBIENT READY" },
    { kind: "setSwitch", switchId: "audio_repair_done", value: true },
    { kind: "openSaveMenu" },
    { kind: "text", body: "AUDIO SAVED" },
    { kind: "stopAudio" },
    { kind: "m2Command", commandId: "m2-093-open-load-menu", fields: {} },
    { kind: "text", body: "STALE AUDIO EVENT MUST NOT RESUME" },
  ];
  map.events = [{
    id: "audio_owner", x: 0, y: 0, trigger: { kind: "action" }, commands: [],
    pages: [{
      id: "audio_owner", name: "Audio test", conditions: [{ kind: "switch", switchId: "audio_repair_done", value: false }],
      graphic: {}, priority: "below", trigger: { kind: "auto" },
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
    }],
  }];
  return project;
}
