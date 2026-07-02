import type Phaser from "phaser";
import type { Dir, Input } from "@/player/input";
import type { PlaySession } from "@/project/session";

type TestHookWindow = Window & {
  __rpgzzuInput?: { action: () => void; dir: (d: string | null) => void };
  __rpgzzuPlayerSprite?: () => PlayerSpriteDebug | null;
  __rpgzzuCharacterSprites?: () => CharacterSpriteDebug | null;
  __rpgzzuCamera?: () => CameraDebug;
  __rpgzzuSetActorVitals?: (actorId: string, hp: number, mp: number) => void;
  __rpgzzuSetMediaState?: (state: MediaStateDebug) => void;
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
  session: PlaySession,
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
  scene.events.once("shutdown", () => {
    delete w.__rpgzzuInput;
    delete w.__rpgzzuPlayerSprite;
    delete w.__rpgzzuCharacterSprites;
    delete w.__rpgzzuCamera;
    delete w.__rpgzzuSetActorVitals;
    delete w.__rpgzzuSetMediaState;
  });
  const params = new URLSearchParams(window.location.search);
  if (params.get("e2eMedia") === "1") {
    w.__rpgzzuSetMediaState = (state) => {
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
