import type { CommandKind } from "@/project/commandKindRegistry";

export const COMMAND_CONTEXTS = ["map", "common", "troop"] as const;

export type CommandContext = (typeof COMMAND_CONTEXTS)[number];
export type CommandSupport = "full" | "partial" | "editorOnly";
export type CommandStability = "experimental" | "stable" | "deprecated";
export type CommandExecutionOwner = "interpreter" | "player" | "battle";
export type CommandCompletionExpectation =
  | "continue"
  | "pause"
  | "conditionalPause"
  | "pauseThenTerminate"
  | "terminalHandoff"
  | "dynamic";
export type CommandAuthoringSurface =
  | "mainPicker"
  | "quick"
  | "nested"
  | "common"
  | "troop"
  | "ai";
export type CommandFamily =
  | "dialogue"
  | "controlFlow"
  | "state"
  | "time"
  | "map"
  | "battle"
  | "actor"
  | "economy"
  | "social"
  | "monster"
  | "follower"
  | "atmosphere"
  | "media"
  | "commerce"
  | "system"
  | "compatibility";

export type CommandGuarantee = {
  readonly family: CommandFamily;
  readonly stability: CommandStability;
  readonly contractVersion: number;
  readonly supportByContext: Readonly<Record<CommandContext, CommandSupport>>;
  readonly executionOwner: CommandExecutionOwner;
  readonly completion: CommandCompletionExpectation;
  readonly authoringSurfaces: readonly CommandAuthoringSurface[];
  readonly replacementKind?: CommandKind;
};

type GuaranteeOverrides = {
  readonly stability?: CommandStability;
  readonly executionOwner?: CommandExecutionOwner;
  readonly completion?: CommandCompletionExpectation;
  readonly quick?: boolean;
  readonly ai?: boolean;
  readonly direct?: boolean;
  // direct:false 라 mainPicker/common/troop 묶음 표면이 빠진 명령이라도,
  // 배틀 executor 가 실제 실행하는 troop-full 명령은 troop 저작 표면을 개별 선언한다.
  readonly troopAuthoring?: boolean;
  readonly support?: Readonly<Partial<Record<CommandContext, CommandSupport>>>;
};

const defaultSupport = {
  map: "full",
  common: "full",
  troop: "partial",
} as const satisfies Record<CommandContext, CommandSupport>;

function guarantee(family: CommandFamily, overrides: GuaranteeOverrides = {}): CommandGuarantee {
  const supportByContext = {
    ...defaultSupport,
    ...overrides.support,
  } satisfies Record<CommandContext, CommandSupport>;
  const authoringSurfaces: CommandAuthoringSurface[] = ["nested"];
  if (overrides.direct !== false) {
    authoringSurfaces.push("mainPicker", "common", "troop");
  }
  if (overrides.quick === true) authoringSurfaces.push("quick");
  if (overrides.troopAuthoring === true && !authoringSurfaces.includes("troop")) {
    authoringSurfaces.push("troop");
  }
  if (overrides.ai !== false) authoringSurfaces.push("ai");
  return {
    family,
    stability: overrides.stability ?? "stable",
    contractVersion: 1,
    supportByContext,
    executionOwner: overrides.executionOwner ?? "interpreter",
    completion: overrides.completion ?? "continue",
    authoringSurfaces,
  };
}

const playerPause = { executionOwner: "player", completion: "pause" } as const;
const troopFull = { troop: "full" } as const;
const scopedPartial = { map: "partial", common: "partial", troop: "partial" } as const;

export const COMMAND_GUARANTEES = {
  text: guarantee("dialogue", { ...playerPause, quick: true, support: troopFull }),
  // changeFace: battleEvents.ts 가 메시지 스트립 프레젠테이션 상태를 이벤트 로그로 실행(Step 3 2026-08-20).
  changeFace: guarantee("dialogue", { support: troopFull }),
  choices: guarantee("dialogue", { ...playerPause, quick: true, support: troopFull }),
  fork: guarantee("controlFlow", { quick: true, support: troopFull }),
  // wait: battleEvents.ts 가 pendingWaitMs 적립으로 실제 실행(2026-08-20 executor 실측 대조).
  wait: guarantee("controlFlow", { ...playerPause, support: troopFull }),
  inputWait: guarantee("dialogue", playerPause),
  inputNumber: guarantee("dialogue", playerPause),
  // label/gotoLabel/loop/breakLoop: battleEvents.ts pc 기반 프레임 머신이 페이지 로컬로
  // 실제 실행(Step 3 2026-08-20). 라벨 탐색은 맵 gotoLabel(stack.ts)과 동형(활성 프레임 스택).
  label: guarantee("controlFlow", { support: troopFull }),
  gotoLabel: guarantee("controlFlow", { support: troopFull }),
  loop: guarantee("controlFlow", { support: troopFull }),
  breakLoop: guarantee("controlFlow", { support: troopFull }),
  setSwitch: guarantee("state", { quick: true, support: troopFull }),
  setVariable: guarantee("state", { quick: true, support: troopFull }),
  // timer: battleEvents.ts 가 배틀 이벤트 timers state 를 실제 변경(Step 3, write-back 포함).
  timer: guarantee("time", { ...playerPause, quick: true, support: troopFull }),
  advanceTime: guarantee("time", { ...playerPause, direct: false, quick: true, support: scopedPartial }),
  advanceCropGrowth: guarantee("time", { direct: false, quick: true, support: scopedPartial }),
  setTime: guarantee("time", { ...playerPause, direct: false, support: scopedPartial }),
  sleepUntilMorning: guarantee("time", { ...playerPause, direct: false, support: scopedPartial }),
  transfer: guarantee("map", {
    executionOwner: "player",
    completion: "pauseThenTerminate",
    quick: true,
  }),
  moveEvent: guarantee("map", { ...playerPause, quick: true }),
  setEventGraphicPattern: guarantee("map", { ...playerPause, direct: false, support: scopedPartial }),
  changeTile: guarantee("map", playerPause),
  callCommonEvent: guarantee("controlFlow", { support: troopFull }),
  callMapEvent: guarantee("controlFlow", { direct: false, support: scopedPartial }),
  battleProcessing: guarantee("battle", {
    executionOwner: "battle",
    completion: "pause",
    quick: true,
  }),
  // learnSkill/changeExp/changeLevel: battleEvents.ts 배틀 이벤트 state 에 실제 반영(troop-full).
  learnSkill: guarantee("actor", { support: troopFull }),
  changeExp: guarantee("actor", { support: troopFull }),
  changeLevel: guarantee("actor", { support: troopFull }),
  // 생활 스킬 XP — changeExp/changeLevel 과 동일 계열(액터 상태 변경, 즉시 완료).
  changeLifeSkillExp: guarantee("actor"),
  // promoteActor: battleEvents.ts 가 맵과 같은 sessionClass.promoteActor 권위자로 전직을 실제
  // 실행하고(요건 검증/아이템 소모/클래스 스킬 학습) 배틀러 파생 스탯을 재계산한다(Step 3d 2026-08-20).
  // map/common 은 종전 partial 유지, troop 저작 표면은 개별 선언(direct:false 유지).
  promoteActor: guarantee("actor", {
    direct: false,
    troopAuthoring: true,
    support: { ...scopedPartial, troop: "full" },
  }),
  // changeEquipment: battleEvents.ts 가 맵과 같은 transitionActorEquipment 권위자로 장비를 실제
  // 변경하고 배틀러 파생 스탯을 재계산한다(Step 3d 2026-08-20, 전투 종료 시 세션 write-back).
  changeEquipment: guarantee("actor", { support: troopFull }),
  changeActorHp: guarantee("actor", { support: troopFull }),
  changeActorMp: guarantee("actor", { support: troopFull }),
  recoverAll: guarantee("actor", { support: troopFull }),
  enterHeroName: guarantee("dialogue", playerPause),
  // changeGold: battleEvents.ts 가 배틀 이벤트 gold state 를 실제 변경(troop-full).
  changeGold: guarantee("economy", { quick: true, support: troopFull }),
  changeItem: guarantee("economy", { quick: true, support: troopFull }),
  craftRecipe: guarantee("economy", { stability: "experimental", quick: true }),
  applyItemUpgrade: guarantee("economy", { stability: "experimental", quick: true }),
  equipTool: guarantee("economy", { stability: "experimental", quick: true }),
  openChest: guarantee("commerce", {
    ...playerPause,
    stability: "experimental",
    quick: true,
  }),
  // changeFriendship/getFriendship: battleEvents.ts 가 friendship state 를 실제 실행(troop-full).
  // map/common 은 종전 partial 유지, troop 저작 표면은 개별 선언(direct:false 유지).
  changeFriendship: guarantee("social", {
    direct: false,
    quick: true,
    troopAuthoring: true,
    support: { ...scopedPartial, troop: "full" },
  }),
  getFriendship: guarantee("social", {
    direct: false,
    troopAuthoring: true,
    support: { ...scopedPartial, troop: "full" },
  }),
  // changeParty: battleEvents.ts 가 partyActorIds state 를 실제 변경(troop-full).
  changeParty: guarantee("actor", { quick: true, support: troopFull }),
  giveMonster: guarantee("monster", { direct: false, quick: true, support: scopedPartial }),
  moveMonster: guarantee("monster", { direct: false, support: scopedPartial }),
  evolveMonster: guarantee("monster", { direct: false, quick: true, support: scopedPartial }),
  addFollower: guarantee("follower", { direct: false, quick: true, support: scopedPartial }),
  removeFollower: guarantee("follower", { direct: false, support: scopedPartial }),
  setLighting: guarantee("atmosphere", {
    executionOwner: "player",
    completion: "conditionalPause",
    quick: true,
  }),
  addLight: guarantee("atmosphere"),
  removeLight: guarantee("atmosphere"),
  setWeather: guarantee("atmosphere", { ...playerPause, quick: true }),
  // showAnimation: battleEvents.ts 가 showBattleAnimation 콜백(m2-103 동일 경로)으로 실제 실행(Step 3).
  showAnimation: guarantee("media", { ...playerPause, quick: true, support: troopFull }),
  showPicture: guarantee("media", { ...playerPause, quick: true }),
  erasePicture: guarantee("media", playerPause),
  // playAudio/stopAudio: battleEvents.ts 가 호스트 오디오 콜백으로 실제 실행(troop-full).
  playAudio: guarantee("media", { ...playerPause, quick: true, support: troopFull }),
  stopAudio: guarantee("media", { ...playerPause, support: troopFull }),
  cutsceneControl: guarantee("controlFlow", { direct: false, support: scopedPartial }),
  // displayTextSettings: battleEvents.ts 가 메시지 표시 설정을 이벤트 로그로 실행(Step 3).
  displayTextSettings: guarantee("dialogue", { support: troopFull }),
  shop: guarantee("commerce", playerPause),
  inn: guarantee("commerce", playerPause),
  checkpointSave: guarantee("system", { direct: false, quick: true, support: scopedPartial }),
  // killPlayer: battleEvents.ts 가 액터 HP 0 + endBattleAsDefeat 로 defeat 종결(Step 3).
  // map/common 은 종전 partial 유지, troop 저작 표면은 개별 선언(direct:false 유지).
  killPlayer: guarantee("system", {
    executionOwner: "player",
    completion: "terminalHandoff",
    direct: false,
    quick: true,
    troopAuthoring: true,
    support: { ...scopedPartial, troop: "full" },
  }),
  triggerEnding: guarantee("system", {
    executionOwner: "player",
    completion: "terminalHandoff",
    direct: false,
    quick: true,
    support: scopedPartial,
  }),
  // gameOver: battleEvents.ts 가 endBattleAsDefeat 콜백으로 defeat 결과 매핑(Step 3).
  gameOver: guarantee("system", {
    executionOwner: "player",
    completion: "terminalHandoff",
    quick: true,
    support: troopFull,
  }),
  ending: guarantee("system", {
    executionOwner: "player",
    completion: "terminalHandoff",
    quick: true,
  }),
  returnToTitle: guarantee("system", {
    executionOwner: "player",
    completion: "terminalHandoff",
  }),
  // setFlag: battleEvents.ts 가 배틀 이벤트 flags state 를 실제 변경(Step 3, write-back 포함).
  // map/common 은 종전 partial 유지, troop 저작 표면은 개별 선언(direct:false 유지).
  setFlag: guarantee("compatibility", {
    direct: false,
    troopAuthoring: true,
    support: { ...scopedPartial, troop: "full" },
  }),
  // setSelfSwitch: battleEvents.ts 가 ownerEventId(전투 기동 이벤트)의 셀프 스위치를
  // 스냅샷에 실제 기록하고 전투 종료 시 세션에 되돌려 쓴다(troop-full, Step 2 2026-08-20).
  // map/common 은 종전 partial 유지, troop 저작 표면은 개별 선언(direct:false 유지).
  setSelfSwitch: guarantee("state", {
    direct: false,
    troopAuthoring: true,
    support: { ...scopedPartial, troop: "full" },
  }),
  m2Command: guarantee("compatibility", {
    ai: false,
    executionOwner: "player",
    completion: "dynamic",
    support: { map: "partial", common: "partial", troop: "partial" },
  }),
  openSaveMenu: guarantee("system", {
    executionOwner: "player",
    completion: "conditionalPause",
    quick: true,
  }),
  spawnFieldEnemy: guarantee("monster", {
    executionOwner: "player",
    completion: "continue",
    quick: true,
  }),
  despawnFieldEnemy: guarantee("monster", {
    executionOwner: "player",
    completion: "continue",
    quick: true,
  }),
} satisfies Record<CommandKind, CommandGuarantee>;

export function commandGuarantee(kind: CommandKind): CommandGuarantee {
  return COMMAND_GUARANTEES[kind];
}

export function commandGuaranteeIssues(
  kind: CommandKind,
  entry: CommandGuarantee
): readonly string[] {
  const issues: string[] = [];
  if (!Number.isInteger(entry.contractVersion) || entry.contractVersion < 1) {
    issues.push(`${kind}: contractVersion must be a positive integer`);
  }
  if (entry.stability === "deprecated") {
    if (entry.authoringSurfaces.length > 0) issues.push(`${kind}: deprecated commands cannot be authored`);
    if (!entry.replacementKind) issues.push(`${kind}: deprecated commands require replacementKind`);
    return issues;
  }
  const surfaces = new Set(entry.authoringSurfaces);
  const hasFullContext = COMMAND_CONTEXTS.some(
    (context) => entry.supportByContext[context] === "full"
  );
  if (hasFullContext && entry.authoringSurfaces.length === 0) {
    issues.push(`${kind}: full support requires an authoring surface`);
  }
  if (hasFullContext && !surfaces.has("nested")) {
    issues.push(`${kind}: full support requires nested authoring`);
  }
  if (entry.stability === "stable") {
    const requiredSurfaceByContext = {
      map: "mainPicker",
      common: "common",
      troop: "troop",
    } as const satisfies Record<CommandContext, CommandAuthoringSurface>;
    for (const context of COMMAND_CONTEXTS) {
      const requiredSurface = requiredSurfaceByContext[context];
      if (entry.supportByContext[context] === "full" && !surfaces.has(requiredSurface)) {
        issues.push(`${kind}: ${context} full support requires ${requiredSurface} authoring`);
      }
    }
  }
  return issues;
}
