import { CONTROL_FLOW_SPECS } from "./specs/controlFlow";
import { DIALOGUE_SPECS } from "./specs/dialogue";
import { SCENE_SPECS } from "./specs/scene";
import { STATE_SPECS } from "./specs/state";
import { SYSTEM_SPECS } from "./specs/system";
import type { NativeManifest } from "./specTypes";

export const NATIVE_MANIFEST = {
  ...DIALOGUE_SPECS,
  ...CONTROL_FLOW_SPECS,
  ...STATE_SPECS,
  ...SCENE_SPECS,
  ...SYSTEM_SPECS,
} satisfies NativeManifest;
