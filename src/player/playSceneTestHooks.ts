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
    battleResult: PlaySession["battleResult"];
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
  __oprnInput?: {
    action: () => void;
    attack: () => void;
    skill: () => void;
    dir: (d: string | null) => void;
    face: (d: string) => void;
  };
  __oprnActionCombat?: () => ActionCombatDebug | null;
  __oprnPlayerSprite?: () => PlayerSpriteDebug | null;
  __oprnCharacterSprites?: () => CharacterSpriteDebug | null;
  __oprnCamera?: () => CameraDebug;
  __oprnSetActorVitals?: (actorId: string, hp: number, mp: number) => void;
  __oprnSetMediaState?: (state: MediaStateDebug) => void;
  __oprnDebug?: RuntimeDebugHook;
};

type ActionCombatDebug = {
  readonly enemies: readonly { readonly eventId: string; readonly hp: number; readonly maxHp: number; readonly mode: string }[];
  readonly projectiles: number;
  readonly swingCooldownMs: number;
  readonly stamina: number;
  readonly facing: string;
  /** 회피가 열어 둔 남은 무적 창(ms). 0 이면 회피 중이 아니다. */
  readonly dodgeIframesMs: number;
  /** 피격 직후 무적 창(ms). */
  readonly playerIframesMs: number;
  /** 가드 키를 잡고 있어 감산이 걸린 상태인가. */
  readonly guarding: boolean;
  /** 활성 액션 스킬 슬롯 인덱스와 슬롯 목록. */
  readonly activeSkillSlot: number;
  readonly skillSlotIds: readonly string[];
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
  w.__oprnInput = {
    action: () => input.injectActionEdge(),
    attack: () => input.injectAttackEdge(),
    skill: () => input.injectSkillEdge(),
    dir: (d) => input.injectDirection(parseDirection(d)),
    face: (d) => {
      const direction = parseDirection(d);
      if (!direction) return;
      const context = scene as unknown as { facing: Dir; playerSprite?: { idleFrameFor: (dir: Dir) => number }; player?: Phaser.GameObjects.Sprite };
      context.facing = direction;
      if (context.playerSprite && context.player) context.player.setFrame(context.playerSprite.idleFrameFor(direction));
      syncRuntimeState();
    },
  };
  w.__oprnPlayerSprite = () => playerSpriteDebug(scene);
  w.__oprnCharacterSprites = () => characterSpritesDebug(scene);
  w.__oprnCamera = () => cameraDebug(scene);
  w.__oprnActionCombat = () => actionCombatDebug(scene);
  // 런타임 디버그 쓰기 훅(항상 활성). 조작 후 syncRuntimeState로 화면/상태 JSON을 갱신한다.
  const applyAndSync = (op: DebugOp): void => {
    applyDebugOp(getSession(), op);
    syncRuntimeState();
  };
  w.__oprnDebug = {
    setSwitch: (switchId, value) => applyAndSync({ kind: "setSwitch", switchId, value }),
    setVariable: (variableId, value) => applyAndSync({ kind: "setVariable", variableId, value }),
    giveItem: (itemId, amount) => applyAndSync({ kind: "giveItem", itemId, amount }),
    setGold: (amount) => applyAndSync({ kind: "setGold", amount }),
    heal: () => applyAndSync({ kind: "heal" }),
    teleport: (mapId, x, y) => {
      const context = scene as unknown as {
        getMapId?: () => string;
        loadMap?: (id: string) => void;
        tileX: number;
        tileY: number;
      };
      // 맵 비교는 세션을 쓰기 **전에** 해야 한다. applyAndSync 가 session.currentMapId 를 먼저
      // 갈아치우면 getMapId() === mapId 가 항상 참이 되어 loadMap 이 한 번도 불리지 않고,
      // 세션만 새 맵을 가리킨 채 화면은 옛 맵을 계속 그린다(실측 2026-08-28: 런타임 QA 의
      // 맵 전환 비트가 세션 값만 보고 통과하고 있었다).
      const previousMapId = context.getMapId?.();
      applyAndSync({ kind: "teleport", mapId, x, y });
      if (typeof context.loadMap === "function" && previousMapId !== mapId) {
        context.loadMap(mapId);
      }
      context.tileX = x;
      context.tileY = y;
    },
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
        battleResult: session.battleResult,
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
    delete w.__oprnInput;
    delete w.__oprnPlayerSprite;
    delete w.__oprnCharacterSprites;
    delete w.__oprnCamera;
    delete w.__oprnSetActorVitals;
    delete w.__oprnSetMediaState;
    delete w.__oprnDebug;
  });
  const params = new URLSearchParams(window.location.search);
  if (params.get("e2eMedia") === "1") {
    w.__oprnSetMediaState = (state) => {
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
    delete w.__oprnSetMediaState;
  }
  if (params.get("e2eVitals") !== "1") {
    delete w.__oprnSetActorVitals;
    return;
  }
  w.__oprnSetActorVitals = (actorId, hp, mp) => {
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

function actionCombatDebug(scene: Phaser.Scene): ActionCombatDebug | null {
  const context = scene as unknown as {
    actionCombatState?: {
      enemies: Map<string, { hp: number; maxHp: number; mode: string }>;
      projectiles: unknown[];
      swingCooldownMs: number;
      stamina: number;
      dodgeIframesMs: number;
      playerIframesMs: number;
      guarding: boolean;
      activeSkillSlot: number;
      skillSlotIds: readonly string[];
    } | null;
    facing?: string;
  };
  const state = context.actionCombatState;
  if (!state) return null;
  return {
    enemies: [...state.enemies.entries()].map(([eventId, enemy]) => ({
      eventId,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      mode: enemy.mode,
    })),
    projectiles: state.projectiles.length,
    swingCooldownMs: state.swingCooldownMs,
    stamina: state.stamina,
    facing: context.facing ?? "down",
    dodgeIframesMs: state.dodgeIframesMs,
    playerIframesMs: state.playerIframesMs,
    guarding: state.guarding,
    activeSkillSlot: state.activeSkillSlot,
    skillSlotIds: [...state.skillSlotIds],
  };
}
