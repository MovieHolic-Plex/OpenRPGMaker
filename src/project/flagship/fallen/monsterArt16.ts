/**
 * 『폴른 스타』 몬스터 새 그림 적용 — 2026-11-26 번들 승격 반영.
 *
 * 이전에는 40종 5×4 시트(괴물 34 + 인간형 적 6)를 base64(`monsterSheets16.ts`)로 프로젝트 `assets.uploaded` 에 복사했으나,
 * 이제 40종 모두 `public/assets/generated/pixel-enemies/` 정식 번들(`PIXEL_ENEMY_SHEETS`)로 승격했다.
 * 여기서는:
 *   1. 예전 저장본에 남아 있는 중복 `battle-gen:fallen-star` 업로드 복사본을 정리(`ensureCurrentMonsterArt`),
 *   2. 사람 적 6종의 걷기 칩 전투 시트를 정식 번들 5×4 시트로 교체(`FS_HUMAN_ART_16`),
 *   3. 체급(보스 > 큰 > 보통 > 작은)에 맞춘 `battleScalePercent` 표를 적용(`FS_MONSTER_SCALE_16`)한다.
 * `chronoBell.ts` 가 `applyFallenMobBalance` 다음에 부른다.
 */
import { ensureCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { bundledPixelEnemySheet } from "@/assets/pixelEnemySheets";
import type { Project } from "@/project/types";

const FS_MONSTER_SCALE_16: readonly { readonly enemyId: string; readonly from: number; readonly to: number }[] = [
  { enemyId: "enemy_fs_guardian", from: 150, to: 125 },
  { enemyId: "enemy_fs_moon_dragon", from: 150, to: 125 },
  { enemyId: "enemy_fs2_ash_collector", from: 190, to: 125 },
  { enemyId: "enemy_fs2_cinder_golem", from: 150, to: 125 },
  { enemyId: "enemy_fs2_tower_sentinel", from: 150, to: 125 },
  { enemyId: "enemy_fs_elite_thornback", from: 165, to: 150 },
  { enemyId: "enemy_fs2_collector_eye_burn", from: 85, to: 100 },
  { enemyId: "enemy_fs2_collector_eye_grab", from: 85, to: 100 },
  { enemyId: "enemy_fs2_swallowed_fire", from: 110, to: 100 },
];

/**
 * 이전에는 등불해파리·서리예티가 번들에 없어 적 생성 전에 uploaded 로 밀어 넣었다.
 * 이제 모든 폴른 스타 몬스터가 정식 번들(`PIXEL_ENEMY_SHEETS`)에 있으므로 할 일이 없다(호출부 호환용).
 */
export function installFallenMonsterArtWithoutBundle(_project: Project): void {
  // no-op: all Fallen Star 5×4 sheets are natively bundled in PIXEL_ENEMY_SHEETS.
}

/**
 * 사람 적 그림 6종 — 걷기 칩 전투 시트를 쓰던 적 행만 번들 5×4 시트 id 로 돌린다.
 * 같은 `charset-battler-actor1-2` 를 파티 배우(성기사)도 쓰므로 그 id 를 덮지 않고 전용 id 를 쓴다.
 */
const FS_HUMAN_ART_16: readonly { readonly from: string; readonly to: string }[] = [
  { from: "charset-battler-actor1-2", to: "generated-enemy-inq-soldier" },
  { from: "charset-battler-people2-2", to: "generated-enemy-cult-preacher" },
  { from: "charset-battler-actor3-0-samurai", to: "generated-enemy-inq-shield" },
  { from: "charset-battler-actor1-3", to: "generated-enemy-sarah" },
  { from: "charset-battler-people3-7", to: "generated-enemy-inq-spearman" },
  { from: "charset-battler-actor3-1", to: "generated-enemy-flagellant" },
];

export function applyFallenMonsterArt16(project: Project): void {
  ensureCurrentMonsterArt(project);
  for (const swap of FS_HUMAN_ART_16) {
    if (!bundledPixelEnemySheet(swap.to)) {
      console.warn(`[fallen-star art16] ${swap.to} 번들 시트가 없어 ${swap.from} 적을 그대로 둔다`);
      continue;
    }
    for (const enemy of project.database.enemies) if (enemy.monsterResourceId === swap.from) enemy.monsterResourceId = swap.to;
  }
  for (const change of FS_MONSTER_SCALE_16) {
    const enemy = project.database.enemies.find((e) => e.id === change.enemyId);
    if (!enemy) { console.warn(`[fallen-star art16] ${change.enemyId} 적이 없다`); continue; }
    if (!enemy.monsterResourceId || !bundledPixelEnemySheet(enemy.monsterResourceId)) {
      console.warn(`[fallen-star art16] ${change.enemyId}: 그림 ${enemy.monsterResourceId} 이 번들 5×4 시트가 아니라 배율을 그대로 둔다`);
      continue;
    }
    const was = enemy.battleScalePercent ?? 100;
    if (was !== change.from) console.warn(`[fallen-star art16] ${change.enemyId}: 배율이 ${change.from}% 가 아니라 ${was}% 였다 — ${change.to}% 로 덮는다`);
    if (change.to === 100) delete enemy.battleScalePercent;
    else enemy.battleScalePercent = change.to;
  }
}
