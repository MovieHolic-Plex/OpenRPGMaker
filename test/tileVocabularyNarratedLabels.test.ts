import { describe, expect, it } from "vitest";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import { retiredEasyRpgTileset } from "./support/retiredEasyRpgTilesets";

/** 실패 모드 F3(`.omo/evidence/ai-assistant-failure-modes.md`): 모델이 `tile_query` 에서 본 그룹 이름을
 * 그대로 써도 해석기가 완전 일치만 받아 "찾지 못했습니다" 로 끝났고, 후보 목록마저 비어 있었다. */
describe("타일 어휘 — 그룹 이름 후보와 실패 메시지", () => {
  // 옛 첫 칩셋 = 합본 마을. 2026-10-07 저작권 정리로 새 프로젝트의 첫 칩셋이 beodeul_city 가 되어 옛 칩셋을 직접 만든다(#3560 방식).
  const tileset = retiredEasyRpgTileset("easyrpg_chipset_combined_town");

  it("그룹 이름의 앞머리만 말해도 그 그룹으로 시공한다", () => {
    const access = resolveMaterialByLabel(tileset, "꽃", { preferGroup: true });
    expect(access.status).toBe("approved");
    expect(access.status === "approved" && access.kind === "group" && access.group.name).toBe("꽃/자연 소품");
  });

  it("정확한 라벨·그룹 이름은 예전 그대로 해석된다", () => {
    for (const [word, expected] of [["잔디", "잔디"], ["키큰 풀", "키큰 풀"], ["나무 바닥 데크", "나무 바닥 데크"]] as const) {
      const access = resolveMaterialByLabel(tileset, word, { preferGroup: true });
      expect(access.status === "approved" && access.kind === "group" && access.group.name).toBe(expected);
    }
  });

  it("못 찾으면 후보를 메시지 안에 적는다 — 약매칭은 후보일 뿐 자동 채택되지 않는다", () => {
    const access = resolveMaterialByLabel(tileset, "석조 기둥", { preferGroup: true });
    expect(access.status).toBe("missing");
    if (access.status !== "missing") return;
    expect(access.suggestions.map(entry => entry.label)).toContain("돌기둥");
    expect(access.message).toContain("돌기둥");
    expect(access.message).toContain(tileset.id);
  });

  it("면 채우기 실패는 채울 수 있는 재료를 주고, 채울 수 없는 함정 바닥을 다시 권하지 않는다", () => {
    const access = resolveMaterialByLabel(tileset, "어두운 돌바닥", { requireAutotileGroup: true });
    expect(access.status).toBe("missing");
    if (access.status !== "missing") return;
    expect(access.suggestionKind).toBe("fillable");
    expect(access.suggestions.map(entry => entry.label)).toContain("잔디");
    expect(access.suggestions.map(entry => entry.label)).not.toContain("돌바닥");
  });

  it("타일셋 자체에 없는 재료는 칩셋을 확인하라고 말한다", () => {
    const access = resolveMaterialByLabel(tileset, "붉은 카펫", { preferGroup: true });
    expect(access.status).toBe("missing");
    if (access.status !== "missing") return;
    expect(access.suggestions).toEqual([]);
    expect(access.message).toContain("타일셋");
  });
});
