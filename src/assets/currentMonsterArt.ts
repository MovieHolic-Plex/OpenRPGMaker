// 지금 쓰는 몬스터 그림(현행 세트) — 『폴른 스타』가 쓰는 새 전투 시트(5×4 20칸)와 한 칸 초상.
// 번들 3×3 시트(구형)와 리소스 id 가 같다. 프로젝트에 같은 id 의 업로드(초상 + 시트)를 넣으면 전투 그림(pixelEnemySheets)과
// 맵 위 그림(eventSpriteResources — 업로드 monster 가 먼저) 둘 다 새 그림으로 잡힌다. 넣지 않은 프로젝트는 종전 번들 그림 그대로다.
// 그림 데이터(0.9MB)는 flagship/fallen/monsterSheets16.ts 에 있다 — 편집기 번들에 싣지 않으려고 여기는 id 목록만 들고, 쓸 때 한 번 늦게 읽는다.
import type { Project } from "@/project/types";

/** 현행 세트의 리소스 id(monsterSheets16.ts 의 것 전부 — test/currentMonsterArt.test.ts 가 맞춘다). */
export const CURRENT_MONSTER_ART_IDS: readonly string[] = [
  "generated-enemy-bandit-mask",
  "generated-enemy-bat-cave",
  "generated-enemy-bee-giant",
  "generated-enemy-beetle-horn",
  "generated-enemy-bird-hawk",
  "generated-enemy-boar-tusk",
  "generated-enemy-crab-rock",
  "generated-enemy-dragon-blue",
  "generated-enemy-eel-electric",
  "generated-enemy-eye-floating",
  "generated-enemy-ghost-pale",
  "generated-enemy-goblin-scout",
  "generated-enemy-golem-clay",
  "generated-enemy-golem-crystal",
  "generated-enemy-golem-iron",
  "generated-enemy-golem-stone",
  "generated-enemy-hound-hell",
  "generated-enemy-jelly-lantern",
  "generated-enemy-leafling-01",
  "generated-enemy-mantis-blade",
  "generated-enemy-moth-dust",
  "generated-enemy-plant-carnivore",
  "generated-enemy-slime-green",
  "generated-enemy-snake-01",
  "generated-enemy-snake-viper",
  "generated-enemy-spider-cave",
  "generated-enemy-spirit-fire",
  "generated-enemy-spirit-water",
  "generated-enemy-well-olm",
  "generated-enemy-wisp-blue",
  "generated-enemy-wolf-dire",
  "generated-enemy-wolf-grey",
  "generated-enemy-wraith-dark",
  "generated-enemy-yeti-frost",
];

const CURRENT = new Set(CURRENT_MONSTER_ART_IDS);

export const isCurrentMonsterArt = (resourceId: string | undefined): boolean => !!resourceId && CURRENT.has(resourceId);

type Installer = (project: Project, resourceIds: ReadonlySet<string>) => Set<string>;
let installer: Installer | undefined;
let loading: Promise<void> | undefined;

/** 그림 데이터를 읽어 둔다(한 번). 그 뒤로 installCurrentMonsterArt 가 동기로 돈다. */
export function preloadCurrentMonsterArt(): Promise<void> {
  loading ??= import("@/project/flagship/fallen/monsterArt16").then((m) => { installer = m.installMonsterArt16For; });
  return loading;
}

/**
 * 이 프로젝트에 그 id 들의 현행 그림을 넣는다(이미 있으면 그대로). 넣었거나 이미 있던 id 를 돌려준다.
 * 그림 데이터를 아직 못 읽었으면(preloadCurrentMonsterArt 를 기다리지 않은 호출) 빈 집합 — 그 프로젝트는 번들 그림으로 남는다.
 */
export function installCurrentMonsterArt(project: Project, resourceIds: Iterable<string>): Set<string> {
  const want = new Set([...resourceIds].filter((id) => CURRENT.has(id)));
  if (!installer || !want.size) return new Set();
  return installer(project, want);
}

/** 이 프로젝트에 그 id 의 현행 그림이 들어 있나. */
export const hasCurrentMonsterArt = (project: Project, resourceId: string | undefined): boolean =>
  isCurrentMonsterArt(resourceId) && project.assets.uploaded[resourceId!]?.kind === "monster";
