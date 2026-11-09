import { describe, expect, it } from "vitest";
import { MONSTER_TOWN_BUILDER, PRESET_REPORT_LINE, monsterPresetRefusal } from "@/ai/v2/builders/monsterTown";
import { builderFor } from "@/ai/v2/builders";

describe("monster town preset limit", () => {
  const spec = { type: "village", style: "monster", name: "새벽마을" } as never;

  it("is the builder make_place picks for style:'monster'", () => {
    expect(builderFor(spec)?.id).toBe(MONSTER_TOWN_BUILDER.id);
  });

  it("refuses the whole-game preset when the user did not ask for a monster-collecting game", () => {
    for (const task of ["마을 하나 만들어줘. 거기서 시작하는 모험 게임으로", "학교 미스터리 게임 만들어줘", "고양이와 보물찾기 게임 만들어줘"]) {
      expect(monsterPresetRefusal(MONSTER_TOWN_BUILDER.id, task), task).toContain("PRESET");
    }
  });

  it("allows it when the user explicitly asks for a monster-collecting game", () => {
    for (const task of ["포켓몬 같은 몬스터 수집 모험 게임 만들어줘. 짧아도 되니까 처음부터 끝까지 할 수 있게.", "체육관 관장과 싸우는 몬스터 수집 RPG 만들어 줘"]) {
      expect(monsterPresetRefusal(MONSTER_TOWN_BUILDER.id, task), task).toBeUndefined();
    }
  });

  it("does not read the system intent note as the user's words", () => {
    const task = "마을 하나 만들어줘\n\n[의도 메모 — 아래는 사용자 글이 아니라 시스템 지침]\n몬스터 수집 포켓몬 체육관";
    expect(monsterPresetRefusal(MONSTER_TOWN_BUILDER.id, task)).toContain("PRESET");
  });

  it("never touches other builders, and the report line names the preset", () => {
    expect(monsterPresetRefusal("village", "마을 하나 만들어줘")).toBeUndefined();
    expect(PRESET_REPORT_LINE).toContain("프리셋");
  });
});
