import { mapTileSize } from "@/project/tileGeometry";
import type Phaser from "phaser";
import { buildLifeRuntimeSnapshot, type LifeRuntimeSnapshot, type RuntimeActionReceipt, type RuntimeDomOverlay } from "@/player/runtimeDom";
import { describeSceneEmotes, type SceneEmoteDebug } from "@/player/playSceneEmotes";
import type { Dir, Input } from "@/player/input";
import { reseedSessionRng, type PlaySession } from "@/project/session";
import { applyDebugOp, applyStatePreset, type DebugOp, type StatePreset } from "@/testing/debugSession";
import { startPlayerRoute } from "@/player/playerRouteState";
import { placePlayerOnCurrentMap } from "@/player/playSceneMapCommands";
import type { MoveCommand } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { cloneRngState, normalizeRngState, type RngState } from "@/util/rng";
import type { RuntimePerfCounters } from "@/player/runtimePerfCounters";
import { subscribeActionCombatObservations } from "@/player/playSceneActionCombat";
import {
  normalizeCloudShadowParams,
} from "@/player/cloudShadows";
import { inBounds, isPassable } from "@/project/collision";
import { store } from "@/project/store";
import { vehicleSpritesDebug } from "@/player/playSceneVehicles";
import { PLAYER_COMBATANT_ID, type ActionEnemyState } from "@/player/actionCombatTypes";
import { ACTION_COMBAT_OUTCOMES, type ActionCombatObservation, type ActionCombatRuntimeResult } from "@/testing/actionCombatProof";

// 런타임 디버그 쓰기 훅. 플레이 중 스위치/변수/아이템/골드/회복/텔레포트를 조작한다.
export type RuntimeDebugHook = {
  setSwitch: (switchId: string, value: boolean) => void;
  setVariable: (variableId: string, value: number) => void;
  giveItem: (itemId: string, amount: number) => void;
  setGold: (amount: number) => void;
  heal: () => void;
  teleport: (mapId: string, x: number, y: number) => void;
  /** 주인공에게 이동 경로를 그대로 물린다. 체공(jump/dropIn)은 실제 Phaser 원점 계약을
   *  브라우저에서만 검증할 수 있어 QA 시나리오가 이 훅으로 직접 발동한다. */
  playerRoute: (moves: readonly MoveCommand[]) => void;
  applyPreset: (preset: StatePreset) => void;
  setSeed: (seed: number) => void;
  /**
   * 디버그 패널 라이브 줄이 매 프레임 읽는 값만. readState 는 생활 상태·이벤트 위치·몬스터를 복제해서
   * 큰 세션에서 호출당 수~수십 ms 다 — 접힌 패널이 그것을 60Hz 로 돌렸다. 선택 항목이라 옛 훅도 동작한다.
   */
  readLive?: (switchId?: string) => { readonly currentMapId: string; readonly x: number; readonly y: number; readonly switchValue?: boolean };
  readState: () => LifeRuntimeSnapshot & {
    readonly actionReceipt?: RuntimeActionReceipt;
    horror: PlaySession["horror"];
    eventLocations: PlaySession["eventLocations"];
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
    monsterInstances: PlaySession["monsterInstances"];
    monsterParty: PlaySession["monsterParty"];
    monsterBox: PlaySession["monsterBox"];
    partyActorIds: string[];
    vehicle?: PlaySession["vehicle"];
    gameTime: PlaySession["gameTime"];
    npcActivities: PlaySession["npcActivities"];
    friendship: PlaySession["friendship"];
    rng: RngState;
  };
};

type TestHookWindow = Window & {
  __oprnRunActionCombatProof?: () => Promise<ActionCombatRuntimeResult>;
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
  __oprnCamera?: () => CameraDebug | null;
  /** 재생성·카메라 스냅 계수기 스냅숏. 값이 없으면(계측 없는 씬) null. */
  __oprnPerf?: () => RuntimePerfCounters | null;
  __oprnEmotes?: () => readonly SceneEmoteDebug[];
  /** 구름 그림자 레이어 관측. 계측이 꺼진 씬에는 없다. */
  __oprnCloudShadows?: () => CloudShadowDebug;
  /** 이 훅들을 심은 씬. 옛 씬의 shutdown 이 새 씬의 훅을 지우지 않게 하는 소유권 표다. */
  __oprnHooksScene?: Phaser.Scene;

  __oprnSetActorVitals?: (actorId: string, hp: number, mp: number) => void;
  __oprnSetMediaState?: (state: MediaStateDebug) => void;
  __oprnDebug?: RuntimeDebugHook;
};

type ActionCombatDebug = {
  readonly enemies: readonly {
    readonly eventId: string;
    readonly hp: number;
    readonly maxHp: number;
    readonly mode: string;
    readonly factionId: string;
    readonly targetId: string | null;
  }[];
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
    /** 체공 높이(px). 리프트는 원점 채널에 있어 x/y 로는 보이지 않는다. */
    readonly liftPx: number;
    /** 체공 상태기가 살아 있는가. liftPx 는 정수로 반올림되므로 착지 직전 프레임에서
     *  0 으로 보일 수 있다 — 착지 판정은 이 값으로 한다. */
    readonly airborne: boolean;
    /** 스쿼시·스트레치 채널. 체공 중 1 초과(늘어남), 착지 순간 1 미만(눌림). */
    readonly visible: boolean;
    readonly scaleX: number;
    readonly scaleY: number;
  };
  /** 체공 중인 캐릭터의 발밑 그림자. 접지하면 visible=false 로 남는다(풀 재사용). */
  readonly shadows: Record<string, {
    readonly x: number;
    readonly y: number;
    readonly depth: number;
    readonly alpha: number;
    readonly scaleX: number;
    readonly visible: boolean;
    /** 타원 아래 끝. 원점이 (0.5,0.5) 라 y 는 접지선보다 반 높이 위다 — 접지 판정은 이 값. */
    readonly bottomY: number;
    /** 화면 픽셀 검사용 실측 크기(월드 px). */
    readonly displayWidth: number;
    readonly displayHeight: number;
  }>;
  readonly followers: Record<string, {
    readonly x: number;
    readonly y: number;
    readonly frame: string | number;
    readonly depth: number;
  }>;
  readonly events: Record<string, {
    readonly alpha: number;
    readonly frame: string | number;
    readonly textureKey: string;
    readonly x: number;
    readonly y: number;
    readonly depth: number;
    readonly liftPx: number;
  }>;
  /** 세워 둔 탈것 스프라이트(탄 탈것은 주인공 스프라이트다). */
  readonly vehicles: ReturnType<typeof vehicleSpritesDebug>;
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

/**
 * 구름 그림자가 «화면에 실제로 떠 있는지» 를 판정하는 관측. 설정값(맵 저장본), 계산된
 * 스프라이트 수·알파·깊이, 월드 좌표를 함께 돌려준다 — QA 는 흐르는 방향을 좌표로,
 * 그려짐을 픽셀로 본다.
 */
type CloudShadowDebug = {
  readonly enabled: boolean;
  readonly opacity: number;
  readonly speed: number;
  readonly angleDeg: number;
  readonly scale: number;
  readonly amount: number;
  readonly clockMs: number;
  readonly visibleCount: number;
  readonly depth: number | null;
  readonly textureReady: boolean;
  /** 연속 구름 레이어 수. */
  readonly layoutCount: number;
  /** 격자 주기(월드 px). 위상을 접을 때 쓴다. */
  readonly period: number;
  /** 레이어별 텍스처 UV 위상. 카메라 이동을 제외한 시간 진행을 비교한다. */
  readonly anchors: readonly { readonly x: number; readonly y: number }[];
  readonly blobs: readonly { readonly x: number; readonly y: number; readonly alpha: number; readonly visible: boolean }[];
};

type SpriteDebugScene = Phaser.Scene & {
  readonly player?: Phaser.GameObjects.Sprite;
  readonly playerSprite?: {
    readonly resourceId: string;
    readonly kind: string;
  };
  readonly moving?: boolean;
  readonly eventSprites?: Map<string, Phaser.GameObjects.Sprite>;
  readonly followerSprites?: Map<string, Phaser.GameObjects.Sprite>;
  readonly characterShadows?: Map<string, ShadowDebugTarget>;
  /** 체공 상태기(PlayerHopState | null). 반올림된 liftPx 와 달리 착지 커밋의 유일한 진실이다. */
  readonly playerHop?: unknown;
};

// 체공 그림자. 리프트와 달리 별개의 게임오브젝트라 존재 자체가 관측 대상이다 —
// 깊이 띠(하부 타일 0 < 그림자 < below 캐릭터 100k)를 브라우저에서 확인하는 근거가 된다.
type ShadowDebugTarget = {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly alpha: number;
  readonly scaleX: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly visible: boolean;
};

export function installPlaySceneTestHooks(
  scene: Phaser.Scene & { readonly runtimeDom?: RuntimeDomOverlay },
  input: Input,
  getSession: () => PlaySession,
  syncRuntimeState: () => void
): void {
  const w = window as TestHookWindow;
  w.__oprnHooksScene = scene;
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
  w.__oprnPerf = () => perfCountersDebug(scene);
  w.__oprnCloudShadows = () => cloudShadowsDebug(scene);
  w.__oprnEmotes = () => describeSceneEmotes(scene as unknown as Parameters<typeof describeSceneEmotes>[0]);

  w.__oprnActionCombat = () => actionCombatDebug(scene);
  const proofController = new AbortController();
  w.__oprnRunActionCombatProof = () => runActionCombatSceneProof(scene as PlaySceneContext, proofController.signal);
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
        transferTo?: PlaySceneContext["transferTo"];
        player?: unknown;
        centerCamera?: () => void;
        tileX: number;
        tileY: number;
      };
      // 다른 맵으로 가는 순간이동은 실제 문과 **같은 경로**(transferTo)를 탄다. 예전에는 세션을 쓰고
      // loadMap 만 불러 주인공 스프라이트·카메라·조명이 옛 맵 좌표에 남았다 — 화면이 검게 그려지고
      // 행동이 먹지 않았다(도그푸딩 2026-09-23). 맵 비교는 세션을 쓰기 **전에** 한다.
      const previousMapId = context.getMapId?.();
      if (previousMapId !== mapId && typeof context.transferTo === "function") {
        // fade:"none" 이면 transferTo 는 await 없이 끝까지 동기로 돈다 — 호출 직후 readState 가 도착 맵을 본다.
        void context.transferTo({ mapId, x, y, fade: "none", direction: "retain" }).then(syncRuntimeState);
        syncRuntimeState();
        return;
      }
      applyAndSync({ kind: "teleport", mapId, x, y });
      if (context.player && typeof context.centerCamera === "function") {
        // 같은 맵: 스프라이트·카메라도 옮긴다(좌표만 쓰면 화면은 옛 자리를 그리고 걸음 판정만 새 칸에서 돈다).
        placePlayerOnCurrentMap(scene as unknown as PlaySceneContext, x, y);
        syncRuntimeState();
        return;
      }
      context.tileX = x;
      context.tileY = y;
    },
    playerRoute: (moves) => {
      startPlayerRoute(scene as unknown as PlaySceneContext, moves, false);
    },
    applyPreset: (preset) => {
      applyStatePreset(getSession(), preset);
      syncRuntimeState();
    },
    setSeed: (seed) => {
      reseedSessionRng(getSession(), seed);
      syncRuntimeState();
    },
    readLive: (switchId) => {
      const session = getSession();
      return {
        currentMapId: session.currentMapId,
        x: session.x,
        y: session.y,
        ...(switchId && Object.hasOwn(session.switches, switchId) ? { switchValue: session.switches[switchId] } : {}),
      };
    },
    readState: () => {
      const session = getSession();
      return {
        ...buildLifeRuntimeSnapshot(session),
        ...(scene.runtimeDom?.actionReceipt ? { actionReceipt: scene.runtimeDom.actionReceipt } : {}),
        horror: session.horror ? structuredClone(session.horror) : undefined,
        eventLocations: structuredClone(session.eventLocations),
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
        monsterInstances: structuredClone(session.monsterInstances),
        monsterParty: [...session.monsterParty],
        monsterBox: [...session.monsterBox],
        partyActorIds: [...session.partyActorIds],
        ...(session.vehicle ? { vehicle: structuredClone(session.vehicle) } : {}),
        gameTime: session.gameTime ? { ...session.gameTime } : undefined,
        npcActivities: { ...(session.npcActivities ?? {}) },
        friendship: { ...(session.friendship ?? {}) },
        rng: cloneRngState(normalizeRngState(session.rng)),
      };
    },
  };
  scene.events.once("shutdown", () => {
    // 씬 재시작에서 옛 인스턴스의 shutdown 이 새 인스턴스의 create 뒤에 올 수 있다. 그때
    // 무조건 지우면 살아 있는 새 씬의 훅과 진행 중인 proof 까지 날아간다(실측: 두 번째 페이지에서
    // 관측 훅이 사라져 QA 가 TypeError 로 죽었다) — 내가 심은 훅일 때만 거둔다.
    if (w.__oprnHooksScene !== scene) return;
    proofController.abort();
    delete w.__oprnRunActionCombatProof;
    delete w.__oprnActionCombat;
    delete w.__oprnInput;
    delete w.__oprnPlayerSprite;
    delete w.__oprnCharacterSprites;
    delete w.__oprnCamera;
    delete w.__oprnPerf;
    delete w.__oprnEmotes;
    delete w.__oprnCloudShadows;
    delete w.__oprnHooksScene;

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

/**
 * One bounded QA scenario, in the actual exported PlayScene. Setup relocates live
 * combatants only; authored stats, equipment, rewards, collision and dispatcher
 * remain authoritative. Nothing here is written back to the project.
 */
async function runActionCombatSceneProof(
  scene: PlaySceneContext, shutdown: AbortSignal,
): Promise<ActionCombatRuntimeResult> {
  const state = scene.actionCombatState;
  if (!state || scene.game.registry.get("qaInstrumentation") !== true) {
    return { pass: false, observations: [], reason: "Action runtime QA capability is unavailable" };
  }
  const melee = [...state.enemies.values()].find((enemy) => enemy.actionAttack?.kind === "melee");
  const ranged = [...state.enemies.values()].find((enemy) => enemy.actionAttack?.kind === "projectile");
  const leadId = scene.session.partyActorIds[0];
  const vitals = leadId ? scene.session.actorVitals[leadId] : undefined;
  if (!melee || !ranged || !vitals || vitals.hp <= (melee.actionAttack?.damage ?? 0)) {
    return { pass: false, observations: [], reason: "Scenario requires live authored melee/projectile spawns and a surviving actor" };
  }
  const project = store.getCurrent();
  let stage: { x: number; y: number } | undefined;
  for (let y = 2; y < scene.map.height - 1 && !stage; y += 1) {
    for (let x = 2; x < scene.map.width - 4; x += 1) {
      const cells = [{ x, y }, { x, y: y - 1 }, { x: x + 1, y }, { x: x + 3, y }];
      if (cells.every((cell) => inBounds(scene.map, cell.x, cell.y)
        && isPassable(project, scene.map, cell.x, cell.y)
        && !scene.map.events.some((event) => event.x === cell.x && event.y === cell.y))) {
        stage = { x, y };
        break;
      }
    }
  }
  if (!stage) return { pass: false, observations: [], reason: "No passable action proof staging cells on this map" };
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  shutdown.addEventListener("abort", abort, { once: true });
  const deadline = setTimeout(abort, 45_000);
  const observations: ActionCombatObservation[] = [];
  const notify = new Set<() => void>();
  const stop = subscribeActionCombatObservations(scene, (entry) => {
    observations.push(entry);
    for (const listener of notify) listener();
  });
  // Register both the exact outcome and post-frame state signals before input.
  const until = (check: () => boolean, trigger: () => void = () => {}): Promise<void> => new Promise((resolve, reject) => {
    const cleanup = (): void => {
      notify.delete(inspect);
      scene.events.off("postupdate", inspect);
      controller.signal.removeEventListener("abort", cancelled);
    };
    const inspect = (): void => {
      if (scene.map.id !== mapId) {
        cleanup();
        reject(new Error("Action proof map changed"));
      } else if (check()) {
        cleanup();
        resolve();
      }
    };
    const cancelled = (): void => { cleanup(); reject(new Error("Action proof cancelled or timed out")); };
    notify.add(inspect);
    scene.events.on("postupdate", inspect);
    controller.signal.addEventListener("abort", cancelled, { once: true });
    if (controller.signal.aborted) { cancelled(); return; }
    trigger();
    inspect();
  });
  const mapId = scene.map.id;
  const positionPlayer = (): void => {
    scene.input_.releaseAllKeys();
    scene.moving = false;
    scene.dashing = false;
    scene.moveProgress = 0;
    scene.tileX = stage.x;
    scene.tileY = stage.y;
    scene.session.x = stage.x;
    scene.session.y = stage.y;
    scene.movingFrom = { ...stage };
    scene.movingTo = { ...stage };
    scene.player.setPosition((stage.x + 0.5) * mapTileSize(scene.map), (stage.y + 1) * mapTileSize(scene.map));
    state.playerIframesMs = 0;
    state.dodgeIframesMs = 0;
    state.hitstopMs = 0;
    state.stamina = 100;
    reseedSessionRng(scene.session, 731);
  };
  const park = (enemy: ActionEnemyState): void => {
    enemy.mode = "recover";
    enemy.modeTimerMs = 1_000_000;
    enemy.attackCooldownMs = 1_000_000;
    enemy.targetId = PLAYER_COMBATANT_ID;
    enemy.retargetMs = 1_000_000;
    enemy.knockbackTween?.stop();
  };
  const arm = (enemy: ActionEnemyState, distance: number): void => {
    park(enemy);
    scene.eventPositions[enemy.eventId] = { x: stage.x + distance, y: stage.y, direction: "left" };
    scene.eventSprites.get(enemy.eventId)?.setPosition((stage.x + distance + 0.5) * mapTileSize(scene.map), (stage.y + 1) * mapTileSize(scene.map));
    enemy.mode = "windup";
    enemy.modeTimerMs = 0;
  };
  const key = (type: "keydown" | "keyup", value: string): void => {
    document.dispatchEvent(new KeyboardEvent(type, { key: value, bubbles: true }));
  };
  try {
    if (shutdown.aborted) return { pass: false, observations, reason: "Action proof scene shut down" };
    // Existing field spawns remain the roster; hold background movement for the
    // paired attack, otherwise pathfinding changes the counterfactual geometry.
    scene.autonomousNPCs.clear();
    for (const enemy of state.enemies.values()) park(enemy);
    positionPlayer();
    const hp = vitals.hp;
    await until(() => observations.some((entry) => entry.outcome === "player-damage" && entry.eventId === melee.eventId), () => {
      arm(melee, 1);
      key("keydown", "Shift");
    });
    key("keyup", "Shift");
    park(melee);
    const control = observations.find((entry) => entry.outcome === "player-damage" && entry.eventId === melee.eventId);
    positionPlayer();
    vitals.hp = hp;
    await until(() => observations.some((entry) => entry.outcome === "dodge-rejection" && entry.attackId === control?.attackId), () => {
      arm(melee, 1);
      key("keydown", "Shift");
      scene.input_.injectDirection("up");
    });
    key("keyup", "Shift");
    scene.input_.releaseAllKeys();
    park(melee);
    const spent = state.stamina;
    await until(() => !scene.moving && state.stamina > spent);
    positionPlayer();
    await until(() => observations.some((entry) => entry.outcome === "enemy-projectile" && entry.eventId === ranged.eventId), () => arm(ranged, 3));
    park(ranged);
    // Projectiles were created by the real dispatcher. Clear them between cases
    // so a late projectile cannot turn the controlled swing case into a death.
    for (const projectile of state.projectiles) projectile.object.destroy();
    state.projectiles.length = 0;
    for (let swings = 0; melee.hp > 0 && swings < 256; swings += 1) {
      await until(() => state.swingCooldownMs === 0 && state.stamina >= 10);
      park(melee);
      scene.eventPositions[melee.eventId] = { x: scene.tileX + 1, y: scene.tileY, direction: "left" };
      scene.facing = "right";
      const previous = observations.length;
      await until(() => observations.slice(previous).some((entry) => entry.outcome === "swing-hit" && entry.eventId === melee.eventId),
        () => scene.input_.injectAttackEdge());
    }
    const rejected = observations.find((entry) => entry.outcome === "dodge-rejection" && entry.attackId === control?.attackId);
    const pass = control !== undefined && control.before > control.after
      && rejected !== undefined && rejected.before === rejected.after
      && ACTION_COMBAT_OUTCOMES.every((outcome) => observations.some((entry) => entry.outcome === outcome));
    return { pass, observations, ...(pass ? {} : { reason: "Runtime did not observe every required action outcome" }) };
  } catch (error) {
    return { pass: false, observations, reason: error instanceof Error ? error.message : String(error) };
  } finally {
    key("keyup", "Shift");
    scene.input_.releaseAllKeys();
    stop();
    clearTimeout(deadline);
    shutdown.removeEventListener("abort", abort);
    controller.abort();
  }
}

function cameraDebug(scene: Phaser.Scene): CameraDebug | null {
  // Phaser CameraManager.shutdown() 은 Scene SHUTDOWN 에서 main 을 undefined 로 비운다.
  // 훅 정리도 같은 SHUTDOWN 리스너인데 등록 순서상 카메라가 먼저 비워질 수 있다 —
  // 그 틈에 관측하면 "undefined.centerX" TypeError 가 QA 런 전체를 죽였다
  // (추리 레인 증거 런 2026-09-24, beat 26). 소비자는 이미 null 허용이다.
  const camera = scene.cameras?.main;
  if (!camera) return null;
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

function cloudShadowsDebug(scene: Phaser.Scene): CloudShadowDebug {
  const context = scene as unknown as Partial<PlaySceneContext>;
  const params = normalizeCloudShadowParams(context.map?.cloudShadows);
  const sprites = context.cloudShadowSprites ?? [];
  return {
    enabled: params.enabled,
    opacity: params.opacity,
    speed: params.speed,
    angleDeg: params.angleDeg,
    scale: params.scale,
    amount: params.amount,
    clockMs: context.cloudShadowClockMs ?? 0,
    visibleCount: sprites.filter((sprite) => sprite.visible).length,
    depth: sprites[0]?.depth ?? null,
    textureReady: sprites.length > 0 && sprites.every((sprite) => scene.textures.exists(sprite.texture.key)),
    layoutCount: sprites.length,
    period: sprites[0] ? sprites[0].frame.width * sprites[0].tileScaleX : 0,
    anchors: sprites.map((sprite) => ({ x: sprite.tilePositionX, y: sprite.tilePositionY })),
    blobs: sprites.map((sprite) => ({
      x: sprite.x,
      y: sprite.y,
      alpha: sprite.alpha,
      visible: sprite.visible,
    })),
  };
}

function perfCountersDebug(scene: Phaser.Scene): RuntimePerfCounters | null {
  const counters = (scene as unknown as { perfCounters?: RuntimePerfCounters }).perfCounters;
  return counters ? { ...counters } : null;
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
    readonly liftPx: number;
  }> = {};
  for (const [eventId, sprite] of scene.eventSprites?.entries() ?? []) {
    events[eventId] = {
      alpha: sprite.alpha,
      frame: sprite.frame.name,
      textureKey: sprite.texture.key,
      x: sprite.x,
      y: sprite.y,
      depth: sprite.depth,
      liftPx: spriteLiftPx(sprite),
    };
  }
  const shadows: Record<string, {
    readonly x: number;
    readonly y: number;
    readonly depth: number;
    readonly alpha: number;
    readonly scaleX: number;
    readonly visible: boolean;
    readonly bottomY: number;
    readonly displayWidth: number;
    readonly displayHeight: number;
  }> = {};
  for (const [key, shadow] of scene.characterShadows?.entries() ?? []) {
    shadows[key] = {
      x: shadow.x,
      y: shadow.y,
      depth: shadow.depth,
      alpha: shadow.alpha,
      scaleX: shadow.scaleX,
      visible: shadow.visible,
      bottomY: shadow.y + shadow.displayHeight / 2,
      displayWidth: shadow.displayWidth,
      displayHeight: shadow.displayHeight,
    };
  }
  // 팔로워 스프라이트. syncFollowerSprites 가 슬롯 보간을 하므로 프레임마다 화면 x/y 가
  // 타일 사이값이 되어야 한다(스냅이면 버그다) — probe 가 이 값으로 판정한다.
  const followers: Record<string, { readonly x: number; readonly y: number; readonly frame: string | number; readonly depth: number }> = {};
  for (const [key, sprite] of scene.followerSprites?.entries() ?? []) {
    followers[key] = { x: sprite.x, y: sprite.y, frame: sprite.frame.name, depth: sprite.depth };
  }
  return {
    player: {
      x: player.x,
      y: player.y,
      depth: player.depth,
      liftPx: spriteLiftPx(player),
      airborne: scene.playerHop != null,
      visible: player.visible,
      scaleX: player.scaleX,
      scaleY: player.scaleY,
    },
    followers,
    shadows,
    events,
    vehicles: vehicleSpritesDebug(scene),
  };
}

/**
 * 원점 채널에 실린 체공 높이를 되읽는다. `applyCharacterLift` 의 역함수 —
 * originY = 1 + lift/(height×scaleY) 이므로 lift = (originY − 1) × height × scaleY 다.
 */
function spriteLiftPx(sprite: Phaser.GameObjects.Sprite): number {
  const denominator = sprite.height * sprite.scaleY;
  if (!Number.isFinite(denominator)) return 0;
  return Math.max(0, Math.round((sprite.originY - 1) * denominator));
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
      enemies: Map<string, { hp: number; maxHp: number; mode: string; factionId: string; targetId?: string }>;
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
      factionId: enemy.factionId,
      targetId: enemy.targetId ?? null,
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
