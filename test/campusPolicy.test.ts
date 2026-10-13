// modern_campus 조수 연결(campusPolicy) + 실내 방 표 — 이 파일은 작성 시 실행하지 않았다(not run).
// 칩셋이 번들에 구워지기 전이라 프로젝트에 칩셋이 «있는» 상태는 합성 정의로 만든다(번들 이미지 id tex_modern_campus).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  CAMPUS_CONCEPT_HINT, CAMPUS_DETAIL_LINE, CAMPUS_EXPOSED_TOOLS, CAMPUS_INTERIOR_LINE, CAMPUS_POINTER_LINE, CAMPUS_ROOM_KINDS, CAMPUS_TILESET_ID,
  campusPromptLines, campusTargetFor, describesCampus, formatCampusNote, hasCampusTileset, namesCampusTileset, scopeUsesCampus,
} from "@/ai/campusPolicy";
import { jpCityTargetFor } from "@/ai/jpCityPolicy";
import { buildPiIntentNote } from "@/ai/piAgent/executionRoute";
import { planStart, startPlanPrompt } from "@/project/startVariety";
import { BUILDABLE_CONCEPT_TILESETS } from "@/concepts/format";
import roomTable from "@/assets/modernCampusRoomTable.json";
import jpSpec from "@/assets/jpInteriorSpec.json";
import references from "@/assets/modernCampusInteriorReferences.json";
import { declaredIntent } from "./intentFixture";

const START = "map_blank_start";
const create = declaredIntent({ mode: "create", space: "outdoor" });

/** 캠퍼스 칩셋을 «가진» 프로젝트 — 번들 id 만 맞춘 최소 정의(tileset 본문은 정책이 읽지 않는다). */
function withCampus() {
  const project = createBlankProject();
  (project.tilesets as Record<string, unknown>)[CAMPUS_TILESET_ID] = { id: CAMPUS_TILESET_ID, name: "캠퍼스", image: { type: "bundled", id: "tex_modern_campus" } };
  project.maps["campus_map"] = { ...project.maps[START]!, id: "campus_map", tilesetId: CAMPUS_TILESET_ID } as never;
  return project;
}

describe("낱말", () => {
  it.each(["학교 하나 만들어줘", "학원물 배경", "대학 캠퍼스", "교실 장면", "동아리 방이 있는 교정", "기숙사가 있는 고등학교", "college campus", "school classroom"])("%s", (text) => {
    expect(describesCampus(text)).toBe(true);
  });
  it.each(["일본풍 학교 만들어줘", "일본 소학교 거리", "마법 학교 성", "jp_city 학교", "숲속 마을", "항구 도시"])("%s 는 아니다", (text) => {
    expect(describesCampus(text)).toBe(false);
  });
  it("칩셋 이름", () => {
    expect(namesCampusTileset("modern_campus 로 맵 만들어줘")).toBe(true);
    expect(namesCampusTileset("캠퍼스 칩셋")).toBe(true);
    expect(namesCampusTileset("학교 만들어줘")).toBe(false);
  });
});

describe("campusTargetFor — 칩셋이 프로젝트에 있을 때만", () => {
  it("칩셋이 없으면 이름을 불러도 낱말이 있어도 null", () => {
    const blank = createBlankProject();
    expect(hasCampusTileset(blank)).toBe(false);
    expect(campusTargetFor(blank, create, "학교 만들어줘", START, false)).toBeNull();
    expect(campusTargetFor(blank, create, "modern_campus 로 학교", START, false)).toBeNull();
  });
  it("칩셋이 있으면 학교 낱말·칩셋 이름 생성 요청이 새 맵으로 간다", () => {
    const project = withCampus();
    expect(hasCampusTileset(project)).toBe(true);
    expect(campusTargetFor(project, create, "대학 캠퍼스 만들어줘", START, false)).toEqual({});
    expect(campusTargetFor(project, create, "modern_campus 맵 하나", START, false)).toEqual({});
  });
  it("보는 맵이 이미 캠퍼스면 수정도 그 맵", () => {
    const project = withCampus();
    const modify = declaredIntent({ mode: "modify", space: "outdoor" });
    expect(campusTargetFor(project, modify, "벤치 더해줘", "campus_map", true)).toEqual({ mapId: "campus_map", lived: true });
  });
  it("일본풍 학교·마법 학교·학교 낱말 없는 요청·실내·질문은 가지 않는다", () => {
    const project = withCampus();
    expect(campusTargetFor(project, create, "일본풍 학교 만들어줘", START, false)).toBeNull();
    expect(campusTargetFor(project, create, "마법 학교 만들어줘", START, false)).toBeNull();
    expect(campusTargetFor(project, create, "항구 마을 만들어줘", START, false)).toBeNull();
    expect(campusTargetFor(project, declaredIntent({ mode: "create", space: "interior" }), "교실 만들어줘", START, false)).toBeNull();
    expect(campusTargetFor(project, declaredIntent({ mode: "question", space: "outdoor" }), "학교가 뭐야", START, false)).toBeNull();
  });
  it("일본 학교는 칩셋이 둘 다 있어도 jp_city 쪽이 이긴다(호출자가 jp 먼저 부른다)", () => {
    const project = withCampus();
    (project.tilesets as Record<string, unknown>)["jp_city"] = { id: "jp_city", name: "일본 도시", image: { type: "bundled", id: "tex_jp_city" } };
    expect(jpCityTargetFor(project, create, "일본풍 학교 만들어줘", START, false)).toEqual({});
    expect(campusTargetFor(project, create, "일본풍 학교 만들어줘", START, false)).toBeNull();
  });
});

describe("시스템 프롬프트 줄", () => {
  it("칩셋이 없으면 아무 줄도 없다(없는 칩셋을 있다고 말하지 않는다)", () => {
    expect(campusPromptLines(createBlankProject(), [START])).toEqual([]);
  });
  it("칩셋이 있으면 포인터, 범위에 캠퍼스 맵이 있으면 상세·실내 줄까지", () => {
    const project = withCampus();
    expect(scopeUsesCampus(project, [START])).toBe(false);
    expect(campusPromptLines(project, [START])).toEqual([CAMPUS_POINTER_LINE]);
    expect(scopeUsesCampus(project, ["campus_map"])).toBe(true);
    expect(campusPromptLines(project, ["campus_map"])).toEqual([CAMPUS_POINTER_LINE, CAMPUS_DETAIL_LINE, CAMPUS_INTERIOR_LINE]);
  });
  it("문장은 PAW 게이트 낱말(현대·모던·modern)과 겹치지 않는다 — 식별자 modern_campus 는 예외", () => {
    for (const raw of [CAMPUS_POINTER_LINE, CAMPUS_DETAIL_LINE, CAMPUS_INTERIOR_LINE, formatCampusNote({}, null), formatCampusNote({ mapId: "m", lived: true }, null)]) {
      const text = raw.replaceAll("modern_campus", "");
      expect(text).not.toMatch(/현대|모던|modern|contemporary/iu);
    }
    expect(CAMPUS_POINTER_LINE).toContain("jp_city");
    expect(CAMPUS_POINTER_LINE).toContain("wizarding_world");
    expect(CAMPUS_POINTER_LINE).toContain("build_hand_interior_room");
    expect(CAMPUS_DETAIL_LINE).toContain("접근칸");
  });
  it("노출 도구에 실내 조립·참고문서·땅 도구가 있다", () => {
    for (const tool of ["list_tileset_references", "read_tileset_reference", "build_hand_interior_room", "list_hand_interior_parts", "create_map", "check_reachability"]) expect(CAMPUS_EXPOSED_TOOLS).toContain(tool);
  });
  it("의도 노트가 캠퍼스 대상이면 jp_city·버들항 노트 대신 캠퍼스 노트가 간다", () => {
    const project = withCampus();
    const note = buildPiIntentNote({ project, intent: create, targetMap: null, selection: null, campus: {}, requestText: "대학 캠퍼스" });
    expect(note).toContain("캠퍼스 칩셋");
    expect(note).not.toContain("compose_jp_city_street");
  });
});

describe("컨셉 힌트·시작 맵", () => {
  it("활성화 전 — 힌트는 정책 표에만 있고 지을 수 있는 타일셋 목록에는 아직 없다(칩셋이 구워질 때 같이 더한다)", () => {
    expect(CAMPUS_CONCEPT_HINT["현대 학원·캠퍼스"]).toBe(CAMPUS_TILESET_ID);
    expect((BUILDABLE_CONCEPT_TILESETS as readonly string[]).includes(CAMPUS_TILESET_ID)).toBe(false);
  });
  it("컨셉이 modern_campus 를 가리키면 시작 맵 프롬프트가 캠퍼스 길을 말한다(버들항 아님)", () => {
    const plan = planStart({ seedText: "concept:campus-x", tilesetHint: CAMPUS_TILESET_ID });
    expect(plan.tilesetId).toBe(CAMPUS_TILESET_ID);
    expect(plan.prebuildTown).toBe(false);
    const prompt = startPlanPrompt(plan);
    expect(prompt).toContain("build_hand_interior_room");
    expect(prompt).toContain("modern_campus");
    expect(prompt).not.toContain("author_beodeul_town({theme");
  });
});

describe("실내 방 표(modernCampusRoomTable.json) — 방 12종·재사용/새 조각 id", () => {
  const spec = jpSpec as unknown as { objects: Record<string, unknown>; floors: Record<string, unknown>; walls: Record<string, unknown> };
  const table = roomTable as unknown as { kinds: Record<string, { ko: string; alias: string[] }>; buildings: Record<string, string>; examples: [string, string, string, [string, number][]][]; newObjectIds: string[]; floors: string[]; walls: string[]; dropped: string[] };

  it("요구한 방 12종이 모두 있고 낱말이 겹치지 않는다", () => {
    for (const kind of CAMPUS_ROOM_KINDS) expect(table.kinds[kind], kind).toBeTruthy();
    const seen = new Map<string, string>();
    for (const [kind, v] of Object.entries(table.kinds)) for (const alias of v.alias) {
      const key = alias.toLowerCase();
      expect(seen.get(key) === undefined || seen.get(key) === kind, `${alias} 가 ${seen.get(key)} 와 ${kind} 에 중복`).toBe(true);
      seen.set(key, kind);
    }
  });
  it("예제의 가구 id 는 새 조각이거나 jp_city 사양에 있는 재사용 id 다(없는 id 를 지어내지 않는다)", () => {
    const fresh = new Set(table.newObjectIds);
    for (const [map, building, kind, objects] of table.examples) {
      expect(table.buildings[building], map).toBeTruthy();
      expect(table.kinds[kind], `${map}/${kind}`).toBeTruthy();
      for (const [id] of objects) expect(fresh.has(id) || id in spec.objects, `${map}: ${id}`).toBe(true);
    }
  });
  it("버린 조각은 새 조각 목록에 없다", () => {
    for (const id of table.dropped) expect(table.newObjectIds).not.toContain(id);
    expect(table.newObjectIds.length).toBeGreaterThanOrEqual(40);
  });
  it("새 조각 id 는 mc- 로 시작하고 재사용 jp 사양 id 와 겹치지 않는다", () => {
    for (const id of [...table.newObjectIds, ...table.floors, ...table.walls]) { expect(id.startsWith("mc-")).toBe(true); expect(id in spec.objects || id in spec.floors || id in spec.walls).toBe(false); }
  });
});

describe("참고문서 번들(modernCampusInteriorReferences.json)", () => {
  const cats = references as unknown as { id: string; documents: { id: string; markdown: string }[]; images: { id: string; dataUrl: string }[] }[];
  it("용도 하나·문서 6·그림 7, id 는 mci- 머리, 그림은 경로(바이트 없음)", () => {
    expect(cats).toHaveLength(1);
    const cat = cats[0]!;
    expect(cat.documents.length).toBe(6);
    expect(cat.images.length).toBe(7);
    for (const doc of cat.documents) expect(doc.id.startsWith("mci-")).toBe(true);
    for (const image of cat.images) { expect(image.id.startsWith("mci-")).toBe(true); expect(image.dataUrl.startsWith("/assets/modern-campus-references/")).toBe(true); }
  });
  it("완성 예제에 전체 물건 배열·접근칸·이벤트 분리·변조 오류 코드가 있다", () => {
    const docs = new Map(cats[0]!.documents.map((d) => [d.id, d.markdown]));
    for (const id of ["mci-ex-school-class-wing", "mci-ex-school-special-wing", "mci-ex-school-cafeteria-club-wing", "mci-ex-dorm-1f", "mci-ex-dorm-2f"]) {
      const md = docs.get(id)!;
      expect(md, id).toContain("전체 물건 배열");
      expect(md).toContain("접근칸");
      expect(md).toContain("이벤트 없음");
    }
    const rules = docs.get("mci-rules")!;
    for (const code of ["door-not-in-gap", "overlap", "hang-not-on-face", "exit-blocked", "door-access-blocked", "not-on-floor"]) expect(rules).toContain(code);
    expect(rules).toContain("기숙사 층 연결");
  });
});
