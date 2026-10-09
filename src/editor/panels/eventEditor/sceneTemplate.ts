// 빈 이벤트의 「장면」. 암전 → 그림 → 대사 → 지우기 → 스위치.
// 그림은 갤러리에 남기도록 표시해 둔다. 음성은 문장 편집에서 고른다.

import { SCENE_PICTURE_ID, SCENE_SWITCH_ID } from "@/project/gallery";
import { store } from "@/project/store";
import type { Command } from "@/project/types";

export function sceneTemplateCommands(switchId: string = SCENE_SWITCH_ID): readonly Command[] {
  return [
    { kind: "cutsceneControl", mode: "begin", skippable: true },
    { kind: "m2Command", commandId: "m2-044-hide-screen", fields: {} },
    { kind: "wait", ms: 180 },
    {
      kind: "showPicture",
      pictureId: SCENE_PICTURE_ID,
      resourceId: "",
      x: 0,
      y: 0,
      scale: 100,
      opacity: 255,
      recordInGallery: true,
    },
    { kind: "m2Command", commandId: "m2-045-show-screen", fields: {} },
    { kind: "text", body: "대사를 입력하세요." },
    { kind: "m2Command", commandId: "m2-044-hide-screen", fields: {} },
    { kind: "wait", ms: 180 },
    { kind: "erasePicture", pictureId: SCENE_PICTURE_ID },
    { kind: "m2Command", commandId: "m2-045-show-screen", fields: {} },
    { kind: "setSwitch", switchId, value: true },
    { kind: "cutsceneControl", mode: "end" },
  ];
}

export function applySceneTemplate(replaceCommands: (commands: readonly Command[]) => void): void {
  if (!store.getCurrent().switches.some((entry) => entry.id === SCENE_SWITCH_ID)) {
    store.update((draft) => {
      if (draft.switches.some((entry) => entry.id === SCENE_SWITCH_ID)) return;
      draft.switches.push({ id: SCENE_SWITCH_ID, name: "장면을 봄" });
      draft.session.switches[SCENE_SWITCH_ID] = false;
    }, { scope: "database", label: "장면 스위치" });
  }
  replaceCommands(sceneTemplateCommands());
}
