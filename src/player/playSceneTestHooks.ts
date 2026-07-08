import type Phaser from "phaser";
import type { Dir, Input } from "@/player/input";
import { reseedSessionRng, type PlaySession } from "@/project/session";
import { applyDebugOp, applyStatePreset, type DebugOp, type StatePreset } from "@/testing/debugSession";
import { cloneRngState, normalizeRngState, type RngState } from "@/util/rng";

// 런타임 디버그 쓰기 훅. 플레이 중 스위치/변수/아이템/골드/회복/텔레포트를 조작한다.
export type RuntimeDebugHook = {
  setSwitch: (switchId: string, value: boolean) => void;
  setVariable: (variableId: string, value: number) => void;
  giveItem: (itemId: string, amount: number) => void;
  setGold: (amount: number) => void;
  heal: () => void;
  teleport: (mapId: string, x: number, y: number) => void;
  applyPreset: (preset: StatePreset) => void;
  setSeed: (seed: number) => void;
  readState: () => {
    currentMapId: string;
    x: number;
    y: number;
    gold: number;
    switches: Record<string, boolean>;
    variables: Record<string, number>;
    selfSwitches: PlaySession["selfSwitches"];
    timers: Record<string, number>;
    inventory: Record<string, number>;
    partyActorIds: string[];
    gameTime: PlaySession["gameTime"];
    npcActivities: PlaySession["npcActivities"];
    friendship: PlaySession["friendship"];
    rng: RngState;
  };
};

type TestHookWindow = Window & {
  __rpgzzuInput?: { action: () => void; dir: (d: string | null) => void };
  __rpgzzuPlayerSprite?: () => PlayerSpriteDebug | null;
  __rpgzzuCharacterSprites?: () => CharacterSpriteDebug | null;
  __rpgzzuCamera?: () => CameraDebug;
  __rpgzzuSetActorVitals?: (actorId: string, hp: number, mp: number) => void;
  __rpgzzuSetMediaState?: (state: MediaStateDebug) => void;
  __rpgzzuDebug?: RuntimeDebugHook;
};

type MediaStateDebug = {
  readonly audioResourceId?: string;
  readonly pictureId?: string;
  readonly pictureResourceId?: string;
  readonly x?: number;
  readonly y?: number;
};

type RuntimeOverlayScene = Phaser.Scene & {
  showRuntimeOverlay: (testId: string, text: string) => void;
};

type PlayerSpriteDebug = {
  readonly textureKey: string;
  readonly frame: string | number;
  readonly resourceId: string;
  readonly kind: string;
  readonly moving: boolean;
  readonly x: number;
  readonly y: number;
};

type CharacterSpriteDebug = {
  readonly player: {
    readonly x: number;
    readonly y: number;
    readonly depth: number;
  };
  readonly events: Record<string, {
    readonly alpha: number;
    readonly frame: string | number;
    readonly textureKey: string;
    readonly x: number;
    readonly y: number;
    readonly depth: number;
  }>;
};

type CameraDebug = {
  readonly centerX: number;
  readonly centerY: number;
  readonly height: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly width: number;
  readonly zoom: number;
};

type SpriteDebugScene = Phaser.Scene & {
  readonly player?: Phaser.GameObjects.Sprite;
  readonly playerSprite?: {
    readonly resourceId: string;
    readonly kind: string;
  };
  readonly moving?: boolean;
  readonly eventSprites?: Map<string, Phaser.GameObjects.Sprite>;
};

export function installPlaySceneTestHooks(
  scene: Phaser.Scene,
  input: Input,
  getSession: () => PlaySession,
  syncRuntimeState: () => void
): void {
  const w = window as TestHookWindow;
  w.__rpgzzuInput = {
    action: () => input.injectActionEdge(),
    dir: (d) => input.injectDirection(parseDirection(d)),
  };
  w.__rpgzzuPlayerSprite = () => playerSpriteDebug(scene);
  w.__rpgzzuCharacterSprites = () => characterSpritesDebug(scene);
  w.__rpgzzuCamera = () => cameraDebug(scene);
  // 런타임 디버그 쓰기 훅(항상 활성). 조작 후 syncRuntimeState로 화면/상태 JSON을 갱신한다.
  const applyAndSync = (op: DebugOp): void => {
    applyDebugOp(getSession(), op);
    syncRuntimeState();
  };
  w.__rpgzzuDebug = {
    setSwitch: (switchId, value) => applyAndSync({ kind: "setSwitch", switchId, value }),
    setVariable: (variableId, value) => applyAndSync({ kind: "setVariable", variableId, value }),
    giveItem: (itemId, amount) => applyAndSync({ kind: "giveItem", itemId, amount }),
    setGold: (amount) => applyAndSync({ kind: "setGold", amount }),
    heal: () => applyAndSync({ kind: "heal" }),
    teleport: (mapId, x, y) => applyAndSync({ kind: "teleport", mapId, x, y }),
    applyPreset: (preset) => {
      applyStatePreset(getSession(), preset);
      syncRuntimeState();
    },
    setSeed: (seed) => {
      reseedSessionRng(getSession(), seed);
      syncRuntimeState();
    },
    readState: () => {
      const session = getSession();
      return {
        currentMapId: session.currentMapId,
        x: session.x,
        y: session.y,
        gold: session.gold,
        switches: { ...session.switches },
        variables: { ...session.variables },
        selfSwitches: structuredClone(session.selfSwitches),
        timers: { ...session.timers },
        inventory: { ...session.inventory },
        partyActorIds: [...session.partyActorIds],
        gameTime: session.gameTime ? { ...session.gameTime } : undefined,
        npcActivities: { ...(session.npcActivities ?? {}) },
        friendship: { ...(session.friendship ?? {}) },
        rng: cloneRngState(normalizeRngState(session.rng)),
      };
    },
  };
  scene.events.once("shutdown", () => {
    delete w.__rpgzzuInput;
    delete w.__rpgzzuPlayerSprite;
    delete w.__rpgzzuCharacterSprites;
    delete w.__rpgzzuCamera;
    delete w.__rpgzzuSetActorVitals;
    delete w.__rpgzzuSetMediaState;
    delete w.__rpgzzuDebug;
  });
  const params = new URLSearchParams(window.location.search);
  if (params.get("e2eMedia") === "1") {
    w.__rpgzzuSetMediaState = (state) => {
      const session = getSession();
      if (state.audioResourceId) {
        session.audio.bgm = { resourceId: state.audioResourceId, loop: true };
        if (hasRuntimeOverlay(scene)) {
          scene.showRuntimeOverlay.call(scene, "audio-indicator", state.audioResourceId);
        }
      }
      if (state.pictureId) {
        session.pictures[state.pictureId] = {
          pictureId: state.pictureId,
          resourceId: state.pictureResourceId ?? state.pictureId,
          x: state.x ?? 0,
          y: state.y ?? 0,
        };
      }
      syncRuntimeState();
    };
  } else {
    delete w.__rpgzzuSetMediaState;
  }
  if (params.get("e2eVitals") !== "1") {
    delete w.__rpgzzuSetActorVitals;
    return;
  }
  w.__rpgzzuSetActorVitals = (actorId, hp, mp) => {
    const session = getSession();
    const vitals = session.actorVitals[actorId];
    if (!vitals) return;
    vitals.hp = Math.max(0, Math.min(vitals.maxHp, hp));
    vitals.mp = Math.max(0, Math.min(vitals.maxMp, mp));
    syncRuntimeState();
  };
}

function cameraDebug(scene: Phaser.Scene): CameraDebug {
  const camera = scene.cameras.main;
  return {
    centerX: camera.centerX,
    centerY: camera.centerY,
    height: camera.height,
    scrollX: camera.scrollX,
    scrollY: camera.scrollY,
    width: camera.width,
    zoom: camera.zoom,
  };
}

function hasRuntimeOverlay(scene: Phaser.Scene): scene is RuntimeOverlayScene {
  return typeof (scene as RuntimeOverlayScene).showRuntimeOverlay === "function";
}

function playerSpriteDebug(scene: Phaser.Scene): PlayerSpriteDebug | null {
  if (!isSpriteDebugScene(scene)) return null;
  const player = scene.player;
  const playerSprite = scene.playerSprite;
  if (!player || !playerSprite) return null;
  return {
    textureKey: player.texture.key,
    frame: player.frame.name,
    resourceId: playerSprite.resourceId,
    kind: playerSprite.kind,
    moving: scene.moving === true,
    x: player.x,
    y: player.y,
  };
}

function characterSpritesDebug(scene: Phaser.Scene): CharacterSpriteDebug | null {
  if (!isSpriteDebugScene(scene)) return null;
  const player = scene.player;
  if (!player) return null;
  const events: Record<string, {
    readonly alpha: number;
    readonly frame: string | number;
    readonly textureKey: string;
    readonly x: number;
    readonly y: number;
    readonly depth: number;
  }> = {};
  for (const [eventId, sprite] of scene.eventSprites?.entries() ?? []) {
    events[eventId] = {
      alpha: sprite.alpha,
      frame: sprite.frame.name,
      textureKey: sprite.texture.key,
      x: sprite.x,
      y: sprite.y,
      depth: sprite.depth,
    };
  }
  return {
    player: { x: player.x, y: player.y, depth: player.depth },
    events,
  };
}

function isSpriteDebugScene(scene: Phaser.Scene): scene is SpriteDebugScene {
  return "player" in scene && "playerSprite" in scene;
}

function parseDirection(value: string | null): Dir | null {
  switch (value) {
    case "down":
    case "left":
    case "right":
    case "up":
      return value;
    default:
      return null;
  }
}
