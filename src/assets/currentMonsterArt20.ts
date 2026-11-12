// 현행 몬스터 세트에 더한 새 종(currentMonsterSheets20.ts — battle-gen gif20 단계의 20칸 5×4 시트)을 프로젝트에 넣는다.
// 『폴른 스타』의 설치(flagship/fallen/monsterArt16.ts)와 같은 업로드 둘(초상 kind monster + 시트 picture)을 만든다 —
// 전투 그림(pixelEnemySheets)과 맵 위 그림(eventSpriteResources)이 같은 길로 잡는다.
// 같은 id 의 시트가 『폴른 스타』에도 있는 것(alsoInFlagship)은 여기서 넣지 않는다 — 그 id 는 그쪽 설치가 넣는다.
import { bundledPixelEnemySheet } from "@/assets/pixelEnemySheets";
import type { Project, UploadedAsset } from "@/project/types";
import { CURRENT_MONSTER_SHEETS_20 } from "./currentMonsterSheets20";

const GENERATED_BY = "battle-gen:gif20";
const COLS = 5, ROWS = 4;

/** 이 프로젝트에 그 id 들의 새 그림(초상 + 20칸 시트)을 넣는다. 넣었거나 이미 있던 id. */
export function installMonsterArt20For(project: Project, resourceIds: ReadonlySet<string>): Set<string> {
  const uploaded = project.assets.uploaded;
  const installed = new Set<string>();
  for (const art of CURRENT_MONSTER_SHEETS_20) {
    if (art.alsoInFlagship || !resourceIds.has(art.resourceId)) continue;
    const sheetId = `${art.resourceId}-sheet20`;
    if (uploaded[art.resourceId]?.generatedBy === GENERATED_BY && uploaded[sheetId]?.generatedBy === GENERATED_BY) { installed.add(art.resourceId); continue; }
    if (Object.hasOwn(uploaded, art.resourceId) || Object.hasOwn(uploaded, sheetId)) {
      console.warn(`[current-monster-art20] ${art.resourceId}: 같은 id 의 업로드가 이미 있어 새 그림을 넣지 않았다`);
      continue;
    }
    // 편집기 스킬 미리보기는 시트 파일 이름(slug)으로 스킬 묶음을 찾는다 — 업로드 시트에는 파일 이름이 없어 번들 것을 적어 둔다.
    const skillSlug = bundledPixelEnemySheet(art.resourceId)?.path.replace(/^.*\//, "").replace(/\.png$/, "");
    const sheet: UploadedAsset = {
      id: sheetId, name: `${art.name} ${COLS * ROWS}칸 전투 시트`, kind: "picture", dataUrl: art.sheet,
      meta: { width: art.cell * COLS, height: art.cell * ROWS, frameWidth: art.cell, frameHeight: art.cell, frames: COLS * ROWS },
      generatedBy: GENERATED_BY,
    };
    const portrait: UploadedAsset = {
      id: art.resourceId, name: art.name, kind: "monster", dataUrl: art.portrait,
      meta: {
        width: art.cell, height: art.cell,
        pixelEnemySheet: { sheetResourceId: sheetId, cell: art.cell, motion: art.motion, idleFrameMs: art.idleFrameMs, grid: art.grid, ...(skillSlug ? { skillSlug } : {}) },
      },
      generatedBy: GENERATED_BY,
    };
    uploaded[sheetId] = sheet;
    uploaded[art.resourceId] = portrait;
    installed.add(art.resourceId);
  }
  return installed;
}
