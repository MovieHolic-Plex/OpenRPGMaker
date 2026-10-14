// gothic_manor 장소 빌더 — 야외 구성기 3종과 실내 8종이 오류 없이 한 덩이 통행으로 지어지고, 번들 정의가 새 프로젝트에 들어온다.
// 이 파일은 작성 시 실행하지 않았다(not run) — 감독자 게이트에서 돈다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { composeGothicPlace, GOTHIC_PLACE_KINDS } from "@/editor/gothic/composer";
import { BUILD_GOTHIC_PLACE_TOOL, GOTHIC_ROOM_KEYS } from "@/editor/tools/gothicPlaceTools";
import { createGothicManorTileset, ensureGothicManorTileset, GOTHIC_MANOR_FAMILY, GOTHIC_MANOR_ID } from "@/project/defaults/gothicManor";
import { passabilityOf } from "@/project/collision";

describe("gothic_manor 번들", () => {
  it("새 프로젝트가 칩셋과 참고문서를 들고 태어난다", () => {
    const p = createBlankProject();
    const ts = p.tilesets[GOTHIC_MANOR_ID];
    expect(ts?.family).toBe(GOTHIC_MANOR_FAMILY);
    expect(ts?.roomKit).toEqual({ builtin: GOTHIC_MANOR_ID });
    expect((ts?.referenceDocuments ?? []).some((c) => c.id === "gm-start")).toBe(true);
    for (const c of ts?.referenceDocuments ?? []) for (const im of c.images) expect(im.dataUrl.startsWith("/assets/gothic-manor-references/")).toBe(true);
  });
  it("옛 굽기 사본의 칸 표를 맞춘다", () => {
    const ts = createGothicManorTileset();
    ts.tileGroups = []; ts.family = undefined;
    expect(ensureGothicManorTileset(ts)).toBe(true);
    expect(ts.family).toBe(GOTHIC_MANOR_FAMILY);
    expect(ts.tileGroups?.length).toBeGreaterThan(0);
  });
});

describe("야외 구성기", () => {
  const ts = createGothicManorTileset();
  it.each(GOTHIC_PLACE_KINDS.flatMap((place) => [1, 2, 3].map((seed) => [place, seed] as const)))("%s seed %d", (place, seed) => {
    const r = composeGothicPlace({ place, seed }, ts);
    expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(r.entrances.length).toBeGreaterThan(0);
    // 문 앞 접근칸·정문은 통행이다
    for (const c of [...r.entrances.map((e) => e.access), ...r.exits, r.spawn]) {
      const i = c.y * r.width + c.x;
      const pf = passabilityOf(ts, r.lowerTiles[i]!, r.lowerOverlayTiles[i]!, r.upperTiles[i]!, r.upperOverlayTiles[i]!);
      expect(pf.up || pf.down || pf.left || pf.right).toBe(true);
    }
  });
  it("크기 범위 밖은 오류", () => {
    expect(composeGothicPlace({ place: "graveyard", width: 10, height: 10 }, ts).issues[0]?.code).toBe("SIZE_OUT_OF_RANGE");
  });
});

describe("build_gothic_place", () => {
  it.each([...GOTHIC_PLACE_KINDS, ...GOTHIC_ROOM_KEYS])("%s 를 새 맵에 짓는다", (place) => {
    const draft = createBlankProject();
    const res = BUILD_GOTHIC_PLACE_TOOL.run!(draft, { place, seed: 1 }) as { data: { mapId: string } };
    const map = draft.maps[res.data.mapId]!;
    expect(map.tilesetId).toBe(GOTHIC_MANOR_ID);
    expect(map.lowerTiles.length).toBe(map.width * map.height);
  });
});
