// gothic_manor 라우팅·지침 — 칩셋이 프로젝트에 있을 때만, 판타지 성은 끌지 않는다. 이 파일은 작성 시 실행하지 않았다(not run).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { describesGothicPlace, gothicPromptLines, gothicTargetFor, formatGothicNote, GOTHIC_EXPOSED_TOOLS, GOTHIC_POINTER_LINE, GOTHIC_DETAIL_LINE, isGothicManorTilesetDef } from "@/ai/gothicPolicy";
import { declaredIntent } from "./intentFixture";
import type { Project } from "@/project/types";

const START = "map_blank_start";
const create = declaredIntent({ mode: "create", space: "outdoor" });

function withGothic(): Project {
  const project = createBlankProject();
  const base = Object.values(project.tilesets)[0]!;
  project.tilesets["gothic_manor"] = { ...structuredClone(base), id: "gothic_manor", image: { type: "bundled", id: "tex_gothic_manor" } } as Project["tilesets"][string];
  return project;
}

/** gothic_manor 가 번들로 모든 새 프로젝트에 실리게 된 뒤라(BUNDLED 칩셋 → createGothicManorTileset) 「칩셋 없음」은 떼어 낸 프로젝트로 재현한다. */
function withoutGothic(): Project {
  const project = createBlankProject();
  for (const [id, tileset] of Object.entries(project.tilesets)) if (isGothicManorTilesetDef(tileset)) delete project.tilesets[id];
  return project;
}

describe("고딕 낱말", () => {
  it.each(["저택 호러 게임", "폐성 탐험", "미술관 추리", "고아원 괴담", "정신병원 탈출", "묘지 마을", "haunted mansion", "흉가 저택과 정원 만들어줘", "공동묘지와 예배당", "미술관 호러 갤러리"])("%s", (t) => expect(describesGothicPlace(t)).toBe(true));
  it.each(["판타지 성 하나 만들어줘", "중세 왕국 마을", "마왕성 던전", "숲속 마을", "일본 상가 거리"])("%s 는 아니다", (t) => expect(describesGothicPlace(t)).toBe(false));
  it("판타지 성이어도 호러·폐성이면 고딕", () => expect(describesGothicPlace("판타지 호러 저택")).toBe(true));
});

describe("gothicTargetFor", () => {
  it("칩셋이 있으면 고딕 장소 새 맵 요청이 간다", () => expect(gothicTargetFor(withGothic(), create, "저택 호러 맵 만들어줘", START, false)).toEqual({}));
  it("칩셋이 없으면 가지 않는다", () => expect(gothicTargetFor(withoutGothic(), create, "저택 호러 맵 만들어줘", START, false)).toBeNull());
  it("판타지 성 요청은 칩셋이 있어도 가지 않는다", () => expect(gothicTargetFor(withGothic(), create, "판타지 성 만들어줘", START, false)).toBeNull());
  it("질문은 제외", () => expect(gothicTargetFor(withGothic(), declaredIntent({ mode: "question", space: "outdoor" }), "저택이 뭐야", START, false)).toBeNull());
  it("칩셋 이름을 직접 부르면 간다", () => expect(gothicTargetFor(withGothic(), create, "gothic_manor 로 맵 하나", START, false)).toEqual({}));
  it("대상 맵이 gothic_manor 면 수정도 그 맵", () => {
    const p = withGothic(); p.maps[START]!.tilesetId = "gothic_manor";
    expect(gothicTargetFor(p, declaredIntent({ mode: "modify", space: "outdoor" }), "촛대 더해", START, true)).toEqual({ mapId: START, lived: true });
  });
});

describe("프롬프트 줄", () => {
  it("칩셋이 없으면 줄이 없다", () => expect(gothicPromptLines(withoutGothic(), [START])).toEqual([]));
  it("칩셋이 있으면 포인터, 맵이 gothic 이면 상세까지", () => {
    const p = withGothic();
    expect(gothicPromptLines(p, [START])).toEqual([GOTHIC_POINTER_LINE]);
    p.maps[START]!.tilesetId = "gothic_manor";
    expect(gothicPromptLines(p, [START])).toEqual([GOTHIC_POINTER_LINE, GOTHIC_DETAIL_LINE]);
  });
  it("장소 빌더로 보낸다", () => {
    expect(GOTHIC_EXPOSED_TOOLS).toContain("build_gothic_place");
    expect(GOTHIC_EXPOSED_TOOLS).toContain("list_gothic_places");
    for (const t of [GOTHIC_POINTER_LINE, GOTHIC_DETAIL_LINE, formatGothicNote({}, null)]) expect(t).toContain("build_gothic_place");
    expect(GOTHIC_POINTER_LINE).not.toContain("gothic-interior-authoring");
  });
  it("PAW 게이트 낱말을 쓰지 않는다", () => {
    for (const t of [GOTHIC_POINTER_LINE, GOTHIC_DETAIL_LINE, formatGothicNote({}, null)]) expect(/현대|모던|modern/iu.test(t)).toBe(false);
    expect(isGothicManorTilesetDef(undefined)).toBe(false);
  });
});
