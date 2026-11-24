// 전투 화면 탭 미리보기의 데모 전투(qa1124 항목 6-1·6-2).
//
// 진짜 전투 화면(player/battleDom.mountBattleScene)을 고정 데모 부대 — 아군 1~2명 대 적 2 — 로 돌린다. 프로젝트는 읽기만 한다:
// 부대·적 값·연계기 기술은 모두 **복제본**에만 쓰고 저장소(store)에는 아무것도 쓰지 않는다(editor/enemyBattleTest.ts 와 같은 방식, 단 바꾸는 것만 복제 — prepareBattleScreenDemo).
// 장면(대기·공격·피격·연계기·결과)은 사람이 누르는 것과 같은 길 — 명령 단추·대상 클릭 — 으로 한 번만 보낸다. 별도 연출을 흉내 내지 않는다.
import { preloadRuntimeStyles } from "@/app/runtimeStyles";
import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import { createBattleRuntime } from "@/battle/runtime";
import type { BattleRuntime } from "@/battle/types";
import { holdBattleAudioMute } from "@/player/battleAudioMute";
import { mountBattleScene } from "@/player/battleDom";
import { nextSessionRandom, startSession, type PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export const BATTLE_PREVIEW_SCENES = ["idle", "attack", "hit", "combo", "result"] as const;
export type BattlePreviewScene = (typeof BATTLE_PREVIEW_SCENES)[number];

export const BATTLE_PREVIEW_SCENE_LABELS: Readonly<Record<BattlePreviewScene, string>> = {
  idle: "대기",
  attack: "공격",
  hit: "피격",
  combo: "연계기",
  result: "결과",
};

/** 장면이 무엇을 보여 주는지 — 장면 고르기 단추의 툴팁. */
export const BATTLE_PREVIEW_SCENE_HELP: Readonly<Record<BattlePreviewScene, string>> = {
  idle: "명령을 기다리는 모습. 창 꾸미기·전투 방식·적 그림 움직임이 보입니다.",
  attack: "아군이 적을 때립니다. 상성 알림·전투 흐름이 보입니다.",
  hit: "적이 달려들어 아군이 맞습니다. 타격감·적 달려드는 속도가 보입니다.",
  combo: "두 사람이 연계기를 씁니다. 컷인·화려함이 보입니다.",
  result: "적을 쓰러뜨리고 결과 화면(레벨 업 연출)을 봅니다.",
};

export const BATTLE_PREVIEW_COMBO_SKILL_ID = "editor-preview-combo";
export const BATTLE_PREVIEW_TROOP_ID = "editor-battle-screen-preview";

export interface BattleScreenDemo {
  /** 복제본 — 데모 부대·연계기가 들어 있다. 저장소의 프로젝트가 아니다. */
  readonly project: Project;
  readonly troopId: string;
  readonly session: PlaySession;
  readonly partyActorIds: readonly string[];
  /** 이 장면이 실제로 보여 줄 수 있는 것(아군이 한 명뿐이면 연계기는 공격으로 물러선다). */
  readonly scene: BattlePreviewScene;
}

function demoEnemyIds(project: Project): { readonly ids: string[]; readonly backdrop: string | undefined } | undefined {
  const known = new Set(project.database.enemies.map((enemy) => enemy.id));
  const initial = project.database.troops.find((troop) => troop.id === project.system.initialTroopId);
  const troops = [...(initial ? [initial] : []), ...project.database.troops];
  for (const troop of troops) {
    const ids = troop.enemyIds.filter((id) => known.has(id));
    if (ids.length >= 2) return { ids: ids.slice(0, 2), backdrop: troop.previewBackgroundResourceId };
  }
  for (const troop of troops) {
    const first = troop.enemyIds.find((id) => known.has(id));
    if (first) return { ids: [first, first], backdrop: troop.previewBackgroundResourceId };
  }
  const first = project.database.enemies[0]?.id;
  const second = project.database.enemies[1]?.id ?? first;
  return first && second ? { ids: [first, second], backdrop: undefined } : undefined;
}

/**
 * 현재 프로젝트로 데모 전투 한 판을 준비한다. 원본은 건드리지 않는다. 아군이나 적이 하나도 없으면 undefined.
 * 결과 장면은 적을 한 방에 쓰러지게(체력 1) 하고 경험치를 넉넉히 줘 레벨 업 연출까지 간다. 연계기 장면은 두 아군 전용 연계 기술을 심는다.
 *
 * 프로젝트 전체를 structuredClone 하지 않는다 — 새 프로젝트도 2.07초(타일 칩셋 1.91초)라 설정을 바꾸고 500ms 안에 장면을 다시 돌릴 수 없다.
 * 대신 **바꾸는 것만** 복제한다: 데모 부대(troops 배열 사본에 추가)·연계 기술(skills 배열 사본에 추가, 기반 기술은 structuredClone)·
 * 결과 장면의 적 기록(structuredClone). 나머지는 읽기 전용으로 공유한다 — 전투 런타임은 프로젝트를 읽기만 하며(전투 테스트·퀵 전투는 저장소의 프로젝트를 그대로 넘긴다),
 * 저장소의 객체에는 어떤 쓰기도 일어나지 않는다(test/battleScreenPreview.test.ts 가 직렬화 해시로 지킨다).
 */
export function prepareBattleScreenDemo(source: Project, requested: BattlePreviewScene): BattleScreenDemo | undefined {
  const database = source.database;
  // 세션은 전투 중 경험치·인벤토리·RNG 가 바뀌는 상태다 — 프로젝트의 배열·객체와 겹치지 않게 통째로 복제한다(작다).
  const session = structuredClone(startSession(source));
  const party = session.partyActorIds.filter((id) => database.actors.some((actor) => actor.id === id));
  for (const actor of database.actors) if (party.length < 2 && !party.includes(actor.id)) party.push(actor.id);
  const partyActorIds = party.slice(0, 2);
  const enemies = demoEnemyIds(source);
  if (partyActorIds.length === 0 || !enemies) return undefined;

  let scene = requested;
  let demoEnemies = database.enemies;
  let demoSkills = database.skills;
  if (scene === "result") {
    // 결과 장면: 쓰는 적 기록만 복제해 체력 1·경험치 500 으로 만든다.
    demoEnemies = database.enemies.map((record) => {
      if (!enemies.ids.includes(record.id)) return record;
      const copy = structuredClone(record);
      copy.stats.maxHp = 1;
      copy.rewards.exp = Math.max(copy.rewards.exp, 500);
      return copy;
    });
  }
  if (scene === "combo") {
    const base = database.skills.find((skill) => skill.id === "skill_attack")
      ?? database.skills.find((skill) => skill.effect.kind === "damage" && skill.scope === "enemy");
    if (base && partyActorIds.length >= 2) {
      demoSkills = [...database.skills, {
        ...structuredClone(base),
        id: BATTLE_PREVIEW_COMBO_SKILL_ID,
        name: "합체 공격",
        scope: "enemy",
        comboActorIds: [...partyActorIds],
      }];
    } else {
      scene = "attack";
    }
  }
  const project: Project = {
    ...source,
    database: {
      ...database,
      enemies: demoEnemies,
      skills: demoSkills,
      troops: [...database.troops, {
        id: BATTLE_PREVIEW_TROOP_ID,
        name: "전투 화면 미리보기",
        enemyIds: enemies.ids,
        autoAlign: true,
        // 라운드제로 고정한다 — 게이지(ATB) 흐름이면 명령을 기다리는 대기 장면에서도 적이 알아서 때린다.
        battleFlow: "strict",
        battleEventPages: [],
        ...(enemies.backdrop ? { previewBackgroundResourceId: enemies.backdrop } : {}),
      }],
    },
  };

  session.partyActorIds = [...partyActorIds];
  return { project, troopId: BATTLE_PREVIEW_TROOP_ID, session, partyActorIds, scene };
}

function createDemoRuntime(demo: BattleScreenDemo): BattleRuntime {
  const { project, session } = demo;
  return createBattleRuntime({
    project,
    troopId: demo.troopId,
    canEscape: true,
    canLose: true,
    party: {
      levels: session.actorLevels,
      experience: session.actorExperience,
      names: session.actorNames,
      faceResourceIds: session.actorFaceResourceIds,
      vitals: session.actorVitals,
      paramBonuses: session.actorParamBonuses,
      equipment: session.actorEquipment,
      skillIds: session.actorSkillIds,
      classOverrides: session.classOverrides,
      stateIds: session.actorStateIds,
      partyActorIds: session.partyActorIds,
      battleCommands: session.actorBattleCommands,
    },
    sessionState: {
      switches: session.switches,
      variables: session.variables,
      inventory: session.inventory,
      gold: session.gold,
      partyActorIds: session.partyActorIds,
      actorSkillIds: session.actorSkillIds,
      actorExperience: session.actorExperience,
      actorLevels: session.actorLevels,
      actorBattleCommands: session.actorBattleCommands,
    },
    rng: () => nextSessionRandom(session, "battle"),
  });
}

/** 마운트된 데모 전투. destroy() 는 멱등이고 타이머·창 리스너·소리 잠금을 모두 놓는다. */
export interface BattleScreenDemoHandle {
  readonly root: HTMLElement;
  destroy(): void;
}

/**
 * 장면별로 사람이 누르는 순서를 그대로 보낸다. 같은 단추·같은 대상 클릭이라 실제 전투와 같은 길을 탄다.
 * 명령은 장면이 정한 수(아군 수 · 연계기는 1 · 결과는 적이 다 쓰러질 때까지 최대 8)만 보내고 멈춘다 — 그 뒤 전투는 사람이 두지 않아도 한 라운드가 끝까지 재생된다.
 */
function startScript(root: HTMLElement, runtime: BattleRuntime, scene: BattlePreviewScene, demo: BattleScreenDemo): () => void {
  if (scene === "idle") return () => undefined;
  let stopped = false;
  let timer = 0;
  let sent = 0;
  const wanted = scene === "result" ? 8 : scene === "combo" ? 1 : demo.partyActorIds.length;
  const observer = new MutationObserver(() => schedule());
  const stop = (): void => {
    stopped = true;
    observer.disconnect();
    window.clearTimeout(timer);
  };
  function schedule(): void {
    if (stopped || timer) return;
    timer = window.setTimeout(() => {
      timer = 0;
      step();
    }, 40);
  }
  /** 명령 하나를 보냈다 — 대상 고르기가 남지 않았으면 그 명령은 끝난 것이다. */
  const commandSent = (): void => {
    if (runtime.snapshot().phase === "targetSelect") return;
    sent += 1;
    if (sent >= wanted) stop();
  };
  const press = (selector: string): boolean => {
    const button = root.querySelector<HTMLButtonElement>(`.battle-command-host ${selector}:not(:disabled):not([data-battle-command-inert="true"])`);
    if (!button) return false;
    button.click();
    return true;
  };
  function step(): void {
    if (stopped) return;
    const snapshot = runtime.snapshot();
    if (snapshot.result) return stop();
    if (root.dataset.battleSequenceBusy === "true") return;
    if (snapshot.phase === "targetSelect") {
      const targets = [...root.querySelectorAll<HTMLElement>(".battle-field [data-battle-targetable='true'][data-battle-target-id]")];
      const target = targets[Math.min(sent, targets.length - 1)] ?? targets[0];
      if (!target) return;
      target.click();
      commandSent();
      return;
    }
    if (snapshot.phase !== "actorCommand") return;
    if (scene === "combo") {
      // 「연계」 단추 → 연계 목록의 데모 연계기 → 대상. 목록이 열려 있으면 그 단추를 누른다.
      if (press(`[data-testid='actor-skill-${BATTLE_PREVIEW_COMBO_SKILL_ID}']`)) commandSent();
      else press("[data-testid='actor-command-combo']");
      return;
    }
    if ((scene === "hit" && press("[data-testid='actor-command-defend']")) || press("[data-testid='actor-command-attack']")) return commandSent();
    // 몬스터 대치는 「공격」 단추가 없다 — 「스킬」 목록에서 적 한 명을 때리는 첫 기술을 고른다.
    const skills = demo.project.database.skills;
    const listed = [...root.querySelectorAll<HTMLButtonElement>(".battle-command-host button[data-testid^='actor-skill-']")];
    const strike = listed.find((button) => {
      const skill = skills.find((entry) => `actor-skill-${entry.id}` === button.dataset.testid);
      return skill?.scope === "enemy" && skill.effect.kind === "damage" && !button.disabled && button.dataset.battleCommandInert !== "true";
    });
    if (strike) {
      strike.click();
      commandSent();
    } else press("[data-testid='actor-command-skill']");
  }
  schedule();
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-battle-sequence-busy"] });
  return stop;
}

/**
 * host 에 데모 전투를 마운트한다. host 는 4:3 상자여야 한다(mountBattleScene 이 host 크기에 맞춰 640×480 무대를 줄인다).
 * 소리는 muted 가 true 면 전투 소리 잠금을 쥔다. 창 키 입력은 받지 않는다(isolateInput) — 편집기의 타이핑·단축키가 보이지 않는 전투를 움직이면 안 된다.
 */
export function startBattleScreenDemo(host: HTMLElement, demo: BattleScreenDemo, options: { readonly muted: boolean }): BattleScreenDemoHandle {
  void preloadRuntimeStyles();
  const releaseMute = options.muted ? holdBattleAudioMute() : undefined;
  let controller: ReturnType<typeof mountBattleScene> | undefined;
  let stopScript: (() => void) | undefined;
  let destroyed = false;
  try {
    const runtime = createDemoRuntime(demo);
    advanceBattleRuntime(runtime);
    // project: 명령 창이 복제본에만 있는 데모 연계기를 메뉴에 보이게 한다. 전투 규칙은 runtime 이 같은 복제본으로 돌린다.
    controller = mountBattleScene({ host, runtime, project: demo.project, deferStart: true, introHold: false, isolateInput: true, onResult: () => undefined });
    const mounted = controller;
    void mounted.ready.then(() => {
      if (destroyed) return;
      mounted.begin();
      stopScript = startScript(mounted.root, runtime, demo.scene, demo);
    });
  } catch (error) {
    destroyed = true;
    releaseMute?.();
    throw error;
  }
  const root = controller.root;
  return {
    root,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      stopScript?.();
      controller?.destroy();
      releaseMute?.();
    },
  };
}
