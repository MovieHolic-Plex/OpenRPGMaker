import { describe, expect, it } from "vitest";
import { packTownTargetFor } from "../src/ai/piAgent/packTownRoute";
import { requestsModernMap } from "../src/ai/modernTilesetPolicy";
import type { Project } from "../src/project/types";

// Rasak Modern 팩 타일셋 한 벌 + 그 타일셋을 쓰는 빈 맵. 판정은 tileset.mvPack.presetId 와 이름만 읽는다.
const project = {
  tilesets: { ts_rasak: { id: "ts_rasak", name: "Rasak Modern · 도시 야외", mvPack: { presetId: "rasak-modern-city" } } },
  maps: { town: { id: "town", tilesetId: "ts_rasak", width: 50, height: 40 } },
} as unknown as Project;

describe("팩 도시 마을 라우팅", () => {
  it("한글 팩 이름(라삭)으로 부른 요청도 팩 타일셋을 고른다", () => {
    expect(packTownTargetFor(project, "라삭 모던 타일셋으로 50x40 미국풍 동네 만들어줘", null)?.tilesetId).toEqual("ts_rasak");
  });
  it("팩 이름의 «모던» 이 PAW 전용 현대 맵 게이트를 켜지 않는다", () => {
    expect(requestsModernMap(project, "라삭 모던 타일셋으로 동네 만들어줘", [])).toEqual(false);
    expect(requestsModernMap(project, "Rasak Modern 타일셋으로 미국 소도시 마을 만들어 줘", ["town"])).toEqual(false);
  });
  it("팩 타일셋 맵 위 현대 요청도 PAW 게이트 밖이다", () => {
    expect(requestsModernMap(project, "현대 도시 거리로 꾸며줘", ["town"])).toEqual(false);
  });
  it("팩과 무관한 현대 맵 요청은 여전히 PAW 게이트를 켠다", () => {
    expect(requestsModernMap(project, "현대 학교 교실 맵 만들어줘", [])).toEqual(true);
  });
});
