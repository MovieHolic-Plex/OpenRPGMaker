import { renderEquipmentScene } from "@/player/playerStatusMenuEquipmentScene";
import { renderItemScene, renderSaveScene } from "@/player/playerStatusMenuItemSaveScenes";
import { renderFormationScene, renderRowScene, renderSkillScene, renderStatusScene } from "@/player/playerStatusMenuActorScenes";
import type { StatusMenuFunctionSceneOptions } from "@/player/playerStatusMenuFunctionTypes";

export function renderStatusMenuFunctionScene(options: StatusMenuFunctionSceneOptions): HTMLElement {
  switch (options.commandId) {
    case "items":
      return renderItemScene(options);
    case "skills":
      return renderSkillScene(options);
    case "equipment":
      return renderEquipmentScene(options);
    case "save":
      return renderSaveScene(options, "save");
    case "load":
      return renderSaveScene(options, "load");
    case "status":
      return renderStatusScene(options);
    case "row":
      return renderRowScene(options);
    case "formation":
      return renderFormationScene(options);
    case "wait":
    case "to-title":
      throw new Error(`Status command ${options.commandId} does not use a function scene`);
    default:
      return assertNever(options.commandId);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled status menu function scene: ${String(value)}`);
}
