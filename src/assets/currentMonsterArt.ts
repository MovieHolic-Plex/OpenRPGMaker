// 지금 쓰는 몬스터 그림(현행 세트) — 5×4(20칸) 정식 번들(`src/assets/pixelEnemySheets.ts`).
// 2026-11-26 승격: 이전에는 『폴른 스타』(`monsterSheets16.ts`)와 `currentMonsterSheets20.ts` 의 base64 시트를
// 프로젝트 `assets.uploaded` 에 복사해 덮어썼으나, 이제 44종(괴물 38 + 폴른 스타 인간형 적 6) 전부
// `public/assets/generated/pixel-enemies/`·`pixel-enemy-portraits/` 정식 번들로 승격했고 구형 3×3 106종은 삭제했다.
//
// `CURRENT_MONSTER_ART_IDS` 는 조수 v2·기본 적 대역이 고르는 괴물 38종 목록이다(폴른 스타 이야기 인간형 6종 제외).
// 이미 저장된 프로젝트에 남아 있는 예전 `battle-gen:fallen-star`·`battle-gen:gif20` 중복 업로드 복사본은
// `ensureCurrentMonsterArt` 가 로드 정규화 때 정리해 번들을 직접 보게 한다(사용자 커스텀 업로드는 건드리지 않는다).
import { PIXEL_ENEMY_SHEETS } from "@/assets/pixelEnemySheets";
import type { Project } from "@/project/types";

/** 현행 괴물 세트의 리소스 id 38종(번들 5×4 정본 중 폴른 스타 전용 인간형 적 6종을 뺀 것). */
export const CURRENT_MONSTER_ART_IDS: readonly string[] = [
  "generated-enemy-bandit-mask",
  "generated-enemy-bat-cave",
  "generated-enemy-bear-brown",
  "generated-enemy-bee-giant",
  "generated-enemy-beetle-horn",
  "generated-enemy-bird-hawk",
  "generated-enemy-boar-tusk",
  "generated-enemy-centipede-fire",
  "generated-enemy-crab-rock",
  "generated-enemy-dragon-blue",
  "generated-enemy-dragon-whelp",
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
  "generated-enemy-triceratops",
  "generated-enemy-well-olm",
  "generated-enemy-wisp-blue",
  "generated-enemy-wolf-dire",
  "generated-enemy-wolf-grey",
  "generated-enemy-wraith-dark",
  "generated-enemy-yeti-frost",
];

const CURRENT = new Set(CURRENT_MONSTER_ART_IDS);
const BUNDLED_5X4 = new Set(PIXEL_ENEMY_SHEETS.map((sheet) => sheet.resourceId));
const LEGACY_GENERATED_BY = new Set(["battle-gen:fallen-star", "battle-gen:gif20"]);

export const isCurrentMonsterArt = (resourceId: string | undefined): boolean => !!resourceId && CURRENT.has(resourceId);

/** 정식 번들로 승격되어 별도 비동기 로드가 필요 없다. 호출부 호환을 위해 유지. */
export function preloadCurrentMonsterArt(): Promise<void> {
  return Promise.resolve();
}

/**
 * 현행 세트가 정식 번들(`public/assets/generated/pixel-enemies/`)에 들어 있으므로 프로젝트 업로드에 복사하지 않는다.
 * 요청한 id 중 현행 세트에 속하는 id 집합을 돌려준다.
 */
export function installCurrentMonsterArt(_project: Project, resourceIds: Iterable<string>): Set<string> {
  return new Set([...resourceIds].filter((id) => CURRENT.has(id)));
}

/**
 * 로드 정규화(store.normalizeCurrentProject·headless):
 * 예전에 `battle-gen:fallen-star`·`battle-gen:gif20` 이 프로젝트 `assets.uploaded` 에 중복 복사해 둔
 * 현행 번들 5×4 시트·초상을 정리하고, 그 업로드를 가리키던 맵 이벤트 스프라이트는 `bundled` 로 바꾼다.
 * 사용자가 직접 올렸거나 공방·스토어에서 넣은 업로드는 절대 건드리지 않는다. 정리했으면 true.
 */
export function ensureCurrentMonsterArt(project: Project): boolean {
  const uploaded = project.assets.uploaded;
  const redundantIds = new Set<string>();
  for (const [id, asset] of Object.entries(uploaded)) {
    if (!asset?.generatedBy || !LEGACY_GENERATED_BY.has(asset.generatedBy)) continue;
    const baseId = id.replace(/-sheet(?:16|20)$/u, "");
    if (BUNDLED_5X4.has(baseId)) redundantIds.add(id);
  }
  if (!redundantIds.size) return false;
  for (const map of Object.values(project.maps ?? {})) {
    for (const ev of map.events ?? []) {
      for (const page of ev.pages ?? []) {
        const sprite = (page.graphic as { sprite?: { type?: string; id?: string } } | undefined)?.sprite;
        if (sprite?.type === "uploaded" && sprite.id && redundantIds.has(sprite.id) && BUNDLED_5X4.has(sprite.id)) {
          sprite.type = "bundled";
        }
      }
    }
  }
  for (const id of redundantIds) delete uploaded[id];
  return true;
}

/** 이 리소스가 현행 5×4 몬스터 그림을 쓸 수 있는가(정식 번들이므로 늘 사용 가능). */
export const hasCurrentMonsterArt = (_project: Project, resourceId: string | undefined): boolean =>
  isCurrentMonsterArt(resourceId);
