import { createBlankProject } from "@/project/defaults";
import type { Command, Project } from "@/project/types";

export const AUDIO_QA_BGM_ID = "cc0-bgm-rtp-fld-003";
export const AUDIO_QA_SE_ID = "cc0-sound-ui-confirm";

/** A test-only blank map with one underfoot action event. */
export function audioDescriptionProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (map === undefined) throw new TypeError("Missing blank fixture map");
  project.meta.title = "Audio export contract";
  project.startPos = { x: 3, y: 3 };
  map.encounterRate = 0;
  const commands: Command[] = [
    { kind: "playAudio", resourceId: AUDIO_QA_SE_ID, loop: false },
  ];
  map.events = [{
    id: "audio_qa_action",
    x: 3,
    y: 3,
    trigger: { kind: "action" },
    commands,
    pages: [{
      id: "audio_qa_page",
      name: "Audio QA",
      conditions: [],
      graphic: {},
      priority: "below",
      trigger: { kind: "action" },
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands,
    }],
  }];
  project.audioDescriptions = {
    music: {
      [AUDIO_QA_BGM_ID]: "AUDIO_EXPORT_OVERRIDE",
      orphan_music: " \tAUDIO_EXPORT_ORPHAN\n ",
      terrainTemplates: "",
    },
    sound: {
      [AUDIO_QA_SE_ID]: "",
      orphan_sound: "AUDIO_EXPORT_SOUND",
      ["__proto__"]: "AUDIO_EXPORT_OWN_KEY",
    },
  };
  return project;
}
