import { nativeManifestEntry } from "../specTypes";

export const DIALOGUE_SPECS = {
  text: nativeManifestEntry("dialogue", { kind: "text", speaker: "Guide", body: "Contract text" }),
  changeFace: nativeManifestEntry("dialogue", {
    kind: "changeFace",
    resourceId: "resource_contract",
    position: "left",
    flipHorizontally: false,
  }),
  choices: nativeManifestEntry("dialogue", {
    kind: "choices",
    prompt: "Choose",
    options: [{ text: "Continue", branch: [] }],
    cancelBehavior: "disallow",
  }),
  presentItem: nativeManifestEntry("dialogue", {
    kind: "presentItem",
    prompt: "Present",
    options: [{ itemId: "item_contract", branch: [] }],
  }),
  inputWait: nativeManifestEntry("dialogue", { kind: "inputWait", variableId: "variable_contract" }),
  inputNumber: nativeManifestEntry("dialogue", {
    kind: "inputNumber",
    variableId: "variable_contract",
    digits: 2,
  }),
  enterHeroName: nativeManifestEntry("dialogue", {
    kind: "enterHeroName",
    actorId: "actor_contract",
    maxLength: 8,
    showInitialName: true,
  }),
  displayTextSettings: nativeManifestEntry("dialogue", {
    kind: "displayTextSettings",
    format: "normal",
    position: "bottom",
    preventObscuringPlayer: true,
    allowEventMovementDuringWait: false,
  }),
} as const;
