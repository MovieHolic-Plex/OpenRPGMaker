import { describe, expect, it } from "vitest";
import { resourceProfileThirdPartyWord, splitStoreGameThirdPartyProfiles } from "@/assetStore/storeGameThirdParty";
import type { Project, ResourceProfile } from "@/project/types";

const charset = (assetId: string, name: string): ResourceProfile => ({ kind: "charset", name, assetId, tileWidth: 24, tileHeight: 32 });
const project = (profiles: ResourceProfile[], spriteIds: string[]): Project => ({
  resourceProfiles: profiles,
  maps: { m: { events: spriteIds.map((id, i) => ({ id: `ev${i}`, pages: [{ graphic: { sprite: { type: "bundled", id } } }] })) } },
} as unknown as Project);

describe("스토어 판본의 제3자 이름 자원", () => {
  it("REFMAP 이름 걷기 칩은 막는 낱말을 돌려준다", () => {
    expect(resourceProfileThirdPartyWord(charset("tex_oprn_charset_refmap_doll1", "RefmapDoll1 · REFMAP 변형 인물"))).toBe("refmap");
  });
  it("공개 라이선스 카탈로그(cc0-·easyrpg-)는 「rtp」가 들어 있어도 막지 않는다", () => {
    expect(resourceProfileThirdPartyWord(charset("cc0-bgm-rtp-btl-001", "rtp btl 001"))).toBeNull();
    expect(resourceProfileThirdPartyWord(charset("easyrpg-charset-rtp-actor1", "EasyRPG RTP Actor1"))).toBeNull();
  });
  it("게임이 쓰지 않는 제3자 이름 자원은 빼고, 나머지는 그대로 둔다", () => {
    const own = charset("tex_oprn_charset_modern3", "Modern3");
    const refmap = charset("tex_oprn_charset_refmap_doll1", "RefmapDoll1 · REFMAP 변형 인물");
    const split = splitStoreGameThirdPartyProfiles(project([own, refmap], ["tex_oprn_charset_modern3"]));
    expect(split.kept).toEqual([own]);
    expect(split.dropped).toEqual([refmap]);
    expect(split.referenced).toEqual([]);
  });
  it("게임이 쓰는 제3자 이름 자원은 referenced 로 알린다", () => {
    const refmap = charset("tex_oprn_charset_refmap_doll1", "RefmapDoll1 · REFMAP 변형 인물");
    const split = splitStoreGameThirdPartyProfiles(project([refmap], ["tex_oprn_charset_refmap_doll1"]));
    expect(split.dropped).toEqual([]);
    expect(split.referenced.map((r) => r.word)).toEqual(["refmap"]);
  });
});
