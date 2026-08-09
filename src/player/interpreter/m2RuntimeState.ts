import type { M2RuntimeState, PlaySessionLike } from "@/project/sessionRuntimeTypes"

export function ensureM2Runtime(session: PlaySessionLike): M2RuntimeState {
  session.m2Runtime ??= {
    screen: {},
    access: {},
    audio: {},
    actors: {},
    events: {},
    map: {},
    system: {},
    session: {},
    camera: {},
    screenEffects: [],
    pathfinding: [],
    waits: [],
    regions: [],
    quests: {},
    dialogue: [],
    cutscene: {},
    checkpoints: [],
    ui: [],
    debug: [],
    expressions: [],
    fallbacks: [],
  };
  session.m2Runtime.camera ??= {};
  session.m2Runtime.screenEffects ??= [];
  session.m2Runtime.pathfinding ??= [];
  session.m2Runtime.waits ??= [];
  session.m2Runtime.regions ??= [];
  session.m2Runtime.quests ??= {};
  session.m2Runtime.dialogue ??= [];
  session.m2Runtime.cutscene ??= {};
  session.m2Runtime.checkpoints ??= [];
  session.m2Runtime.ui ??= [];
  session.m2Runtime.debug ??= [];
  session.m2Runtime.expressions ??= [];
  return session.m2Runtime;
}
