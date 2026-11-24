// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { ensureCurrentMonsterArt, hasCurrentMonsterArt, isCurrentMonsterArt, preloadCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { pixelEnemySheet, setPixelEnemySheetProjectSource } from "@/assets/pixelEnemySheets";
import { enemyPixelCellOrder } from "@/editor/panels/databaseEnemyPixelPreview";
import { applyCurrentMonsterStandIns, standInOriginalArt } from "@/project/defaults/currentMonsterStandIns";
import type { Project } from "@/project/types";

// qa1124 항목 4(오너 2026-11-24 «최신 몬스터들 반영»): 새 프로젝트 기본 적이 현행 id 를 쓰는데 그림이 설치되지 않아
// 자료집·전투에 옛 3×3 그림이 보였고, 편집기 칸 표는 시트 격자와 상관없이 9칸만 그렸다.

describe("기본 적의 현행 몬스터 그림", () => {
  it("로드 정규화가 현행 id 적 전부에 5×4 그림을 넣고, 같은 id 의 사용자 업로드는 건드리지 않는다", async () => {
    await preloadCurrentMonsterArt();
    const project = createBlankProject() as Project;
    const currentIds = [...new Set(project.database.enemies.map((e) => e.monsterResourceId).filter(isCurrentMonsterArt))] as string[];
    expect(currentIds.length).toBeGreaterThan(0);
    const keep = currentIds[0]!;
    const userAsset = { id: keep, name: "내 그림", kind: "monster" as const, dataUrl: "data:image/png;base64,AAAA", meta: { width: 1, height: 1 } };
    project.assets.uploaded[keep] = userAsset;

    expect(ensureCurrentMonsterArt(project)).toBe(true);
    expect(project.assets.uploaded[keep]).toBe(userAsset);
    setPixelEnemySheetProjectSource(() => project);
    try {
      for (const id of currentIds.slice(1)) {
        expect(hasCurrentMonsterArt(project, id), id).toBe(true);
        expect(pixelEnemySheet(id)?.grid, id).toBe("5x4");
      }
    } finally {
      setPixelEnemySheetProjectSource(undefined);
    }
    // 두 번째 로드는 아무것도 하지 않는다(정규화 표식이 «바뀜»으로 남지 않게).
    expect(ensureCurrentMonsterArt(project)).toBe(false);
  });

  it("새 프로젝트 기본 적은 모두 현행 그림이고, 옛 그림을 이미 바꾼 적은 대역하지 않는다", () => {
    const project = createBlankProject() as Project;
    expect(project.database.enemies.filter((e) => !isCurrentMonsterArt(e.monsterResourceId)).map((e) => e.id)).toEqual([]);
    const red = project.database.enemies.find((e) => e.id === "enemy_slime_red")!;
    expect(red.monsterResourceId).toBe("generated-enemy-slime-green");
    expect(standInOriginalArt(red)).toBe("generated-enemy-slime-red");

    const saved = [{ ...red, monsterResourceId: "generated-enemy-slime-red" }, { ...red, id: "enemy_slime_blue", monsterResourceId: "my-upload" }];
    expect(applyCurrentMonsterStandIns(saved)).toBe(1);
    expect(saved.map((e) => e.monsterResourceId)).toEqual(["generated-enemy-slime-green", "my-upload"]);
    expect(standInOriginalArt(saved[1])).toBeUndefined();
  });

  it("칸 표는 시트 격자를 따른다: 3×3 9칸 · 4×4 15칸(예약 칸 제외) · 5×4 20칸 · 비운 칸은 빠진다", () => {
    expect(enemyPixelCellOrder({})).toHaveLength(9);
    expect(enemyPixelCellOrder({ grid: "4x4" })).toHaveLength(15);
    expect(enemyPixelCellOrder({ grid: "5x4" })).toHaveLength(20);
    expect(enemyPixelCellOrder({ grid: "5x4", missingCells: [18, 19] })).toHaveLength(18);
  });
});
