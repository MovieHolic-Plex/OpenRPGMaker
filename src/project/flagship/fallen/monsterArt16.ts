/**
 * 『폴른 스타』 몬스터 새 그림 — 2026-11-04. 오너: 「그냥 공격적으로 진행해 갈아엎고싶거든. 몬스터들 그래픽이 넘 구려서」.
 * battle-gen(브랜치 agent/fs-monster16)에서 새로 그려 초상과 16칸 시트가 Opus 4점 이상으로 통과한 24종(monsterSheets16.ts)을
 * 번들 3×3 대신 쓴다. 적 기록의 monsterResourceId 는 그대로이고, 같은 id 의 uploaded 초상(grid 4x4)이 번들 시트보다 먼저 잡힌다.
 *   - 새 시트의 6번 칸은 복귀 자세(대기 그림을 2px 누른 것)라 skillCell 을 켜지 않는다.
 *   - 체급(보스 > 큰 > 보통 > 작은)을 그림 크기로 맞췄으므로 표의 적은 battleScalePercent 도 바꾼다. 원래 값이 from 과 다르면
 *     경고하고 덮는다(mobBalance.ts 와 같은 규칙). chronoBell.ts 가 applyFallenMobBalance 다음에 부른다.
 */
import { bundledPixelEnemySheet } from "@/assets/pixelEnemySheets";
import type { Project, UploadedAsset } from "@/project/types";
import { FS_MONSTER_SHEETS_16 } from "./monsterSheets16";

const GENERATED_BY = "battle-gen:fallen-star";

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

export function applyFallenMonsterArt16(project: Project): void {
  const uploaded = project.assets.uploaded;
  const installed = new Set<string>();
  for (const art of FS_MONSTER_SHEETS_16) {
    const sheetId = `${art.resourceId}-sheet16`;
    if (Object.hasOwn(uploaded, art.resourceId) || Object.hasOwn(uploaded, sheetId)) {
      console.warn(`[fallen-star art16] ${art.resourceId}: 같은 id 의 업로드가 이미 있어 새 그림을 넣지 않았다`);
      continue;
    }
    // 편집기 스킬 미리보기는 시트 파일 이름(slug)으로 스킬 묶음을 찾는다. 업로드 시트에는 파일 이름이 없어 번들 것을 적어 둔다.
    const skillSlug = bundledPixelEnemySheet(art.resourceId)?.path.replace(/^.*\//, "").replace(/\.png$/, "");
    const frames = art.grid === "4x4" ? 4 : 3;
    const sheet: UploadedAsset = {
      id: sheetId, name: `${art.name} ${frames * frames - (frames === 4 ? 1 : 0)}칸 전투 시트`, kind: "picture", dataUrl: art.sheet,
      meta: { width: art.cell * frames, height: art.cell * frames, frameWidth: art.cell, frameHeight: art.cell, frames: frames * frames },
      generatedBy: GENERATED_BY,
    };
    const portrait: UploadedAsset = {
      id: art.resourceId, name: art.name, kind: "monster", dataUrl: art.portrait,
      meta: {
        width: art.cell, height: art.cell,
        pixelEnemySheet: { sheetResourceId: sheetId, cell: art.cell, motion: art.motion, idleFrameMs: art.idleFrameMs, ...(art.grid === "4x4" ? { grid: "4x4" as const } : {}), ...(art.missingCells ? { missingCells: [...art.missingCells] } : {}), ...(skillSlug ? { skillSlug } : {}) },
      },
      generatedBy: GENERATED_BY,
    };
    uploaded[sheetId] = sheet;
    uploaded[art.resourceId] = portrait;
    installed.add(art.resourceId);
  }
  for (const change of FS_MONSTER_SCALE_16) {
    const enemy = project.database.enemies.find((e) => e.id === change.enemyId);
    if (!enemy) { console.warn(`[fallen-star art16] ${change.enemyId} 적이 없다`); continue; }
    if (!enemy.monsterResourceId || !installed.has(enemy.monsterResourceId)) {
      console.warn(`[fallen-star art16] ${change.enemyId}: 그림 ${enemy.monsterResourceId} 이 새 그림이 아니라 배율을 그대로 둔다`);
      continue;
    }
    const was = enemy.battleScalePercent ?? 100;
    if (was !== change.from) console.warn(`[fallen-star art16] ${change.enemyId}: 배율이 ${change.from}% 가 아니라 ${was}% 였다 — ${change.to}% 로 덮는다`);
    if (change.to === 100) delete enemy.battleScalePercent;
    else enemy.battleScalePercent = change.to;
  }
}
