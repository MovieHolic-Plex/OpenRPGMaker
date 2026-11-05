import { describe, expect, it } from "vitest";
import { charsetEntryOf, characterBrief, characterRoleOf, chipFitsRole } from "@/ai/characterFit";

describe("이름 붙은 인물의 걷기 칩이 역할에 맞는가", () => {
  it("무기점 주인에게 여관 주인 앞치마 칩은 맞지 않고, 대장장이 칩은 맞는다", () => {
    const innkeeper = charsetEntryOf("tex_oprn_charset_refmap_doll225", 0);
    const smith = charsetEntryOf("tex_oprn_charset_refmap_doll190", 4);
    expect(innkeeper && smith).toBeTruthy();
    expect(chipFitsRole(innkeeper, "무기점 주인 도르간").fits).toBe(false);
    expect(chipFitsRole(smith, "무기점 주인 도르간").fits).toBe(true);
  });

  it("어부 할아버지는 늙은 선원 칩이면 맞고 젊은 어부 칩이면 나이가 어긋난다", () => {
    const oldSailor = charsetEntryOf("tex_oprn_charset_refmap_doll288", 2);
    const youngFisher = charsetEntryOf("tex_oprn_charset_refmap_doll291", 7);
    expect(chipFitsRole(oldSailor, "어부 할아버지").fits).toBe(true);
    expect(chipFitsRole(youngFisher, "어부 할아버지").fits).toBe(false);
  });

  it("꽃집 소녀·음유시인·수상한 상인은 각자 보이는 것이 있어야 한다", () => {
    const flowerMaid = charsetEntryOf("tex_oprn_charset_refmap_doll49", 2);
    const bard = charsetEntryOf("tex_oprn_charset_refmap_doll199", 4);
    const innkeeper = charsetEntryOf("tex_easyrpg_charset_people5", 6);
    expect(chipFitsRole(flowerMaid, "꽃집 소녀 릴리").fits).toBe(true);
    expect(chipFitsRole(bard, "떠돌이 음유시인").fits).toBe(true);
    expect(chipFitsRole(innkeeper, "수상한 상인").fits).toBe(false);
    expect(chipFitsRole(bard, "꽃집 소녀 릴리").fits).toBe(false);
  });

  it("역할 낱말이 없는 이름과 카탈로그 밖 칩은 판정하지 않는다", () => {
    const innkeeper = charsetEntryOf("tex_easyrpg_charset_people5", 6);
    expect(characterRoleOf("미라")).toBeUndefined();
    expect(chipFitsRole(innkeeper, "미라").fits).toBe(true);
    expect(chipFitsRole(undefined, "무기점 주인").fits).toBe(true);
  });

  it("생성 설명에 역할 생김새와 나이가 들어간다", () => {
    const role = characterRoleOf("은퇴한 기사 할아버지")!;
    expect(role.elder).toBe(true);
    expect(characterBrief("가렌", role)).toMatch(/elderly man.*knight/u);
  });

  it("대사가 다른 가게를 말해도 역할은 이름에서만 읽는다", () => {
    expect(characterRoleOf("미라 여관에 가 봐", "미라")).toBeUndefined();
    expect(characterRoleOf("무기점 주인 늙은 영감님", "무기점 주인")?.elder).toBe(true);
  });
});
