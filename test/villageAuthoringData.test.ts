import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import {
  presetOverrides,
  templateFromRecord,
  villagePresetById,
  villageTemplateCatalog,
  villageFormTemplates,
} from "@/editor/tools/village/authoringData";
import { templateRecordFromDef } from "@/editor/panels/databaseVillageModel";
import { HOUSE_TEMPLATE_DEFS } from "@/project/defaults/houseTemplateCatalog";
import { serialize, deserialize } from "@/project/io";
import type { Project, VillageHouseTemplateRecord, VillageLayoutPresetRecord } from "@/project/types";
import { createExistingProject, EXISTING_TARGET, runFacade } from "./authorVillageFacadeFixtures";

// 사용자 저작 → AI → 시공 사슬의 계약 테스트.
// "사용자가 데이터베이스에서 정한 값을 AI가 읽고 그대로 깐다"가 실제로 성립하는지를 본다.

const USER_TEMPLATE: VillageHouseTemplateRecord = {
  id: "my-longhouse",
  name: "내 장옥",
  w: 8,
  h: 7,
  stories: 1,
  kitId: "timber-hall",
  wings: [{ x: 0, y: 0, w: 8, h: 7 }],
  clonedFrom: "rect-large",
  note: "촌장 집으로 쓰는 넓은 장옥",
};

const USER_PRESET: VillageLayoutPresetRecord = {
  id: "vpreset_my_hamlet",
  name: "내 산골 마을",
  houseCount: 5,
  pathStyle: "dirt",
  roadWidth: 3,
  roadNaturalness: 0.9,
  settlementLayout: "street-grid",
  plazaStyle: "garden",
  plazaLayout: "north",
  yardStyle: "workshop",
  edgeTrees: "dense",
  kitMix: "mixed",
  npcCount: 3,
  templateIds: ["my-longhouse", "rect-small"],
  note: "산골 분위기, 넓은 흙길",
};

function withAuthoring(project: Project): Project {
  project.villageTemplates = [structuredClone(USER_TEMPLATE)];
  project.villagePresets = [structuredClone(USER_PRESET)];
  return project;
}

describe("사용자 저작 마을 데이터 — 읽기", () => {
  it("사용자 형태가 내장 카탈로그에 더해진다", () => {
    const project = withAuthoring(createExistingProject(46));
    const { templates, warnings } = villageTemplateCatalog(project);
    expect(warnings).toEqual([]);
    expect(templates.length).toBe(HOUSE_TEMPLATE_DEFS.length + villageFormTemplates().length + 1);
    const mine = templates.find((template) => template.id === "my-longhouse");
    expect(mine?.name).toBe("내 장옥");
    expect(mine?.wingsAt(3, 4)).toEqual([{ x: 3, y: 4, w: 8, h: 7 }]);
  });

  it("같은 id면 사용자 형태가 내장을 덮는다", () => {
    const project = createExistingProject(46);
    project.villageTemplates = [{ ...structuredClone(USER_TEMPLATE), id: "rect-large", name: "내 직사각" }];
    const { templates } = villageTemplateCatalog(project);
    expect(templates.length).toBe(HOUSE_TEMPLATE_DEFS.length + villageFormTemplates().length);
    expect(templates.find((template) => template.id === "rect-large")?.name).toBe("내 직사각");
  });

  it("규약을 어긴 사용자 형태는 경고로 흘리고 시공을 막지 않는다", () => {
    const project = createExistingProject(46);
    project.villageTemplates = [
      { id: "too-wide", name: "너무 넓은", w: 12, h: 8, wings: [{ x: 0, y: 0, w: 12, h: 8 }] },
      { id: "wing-out", name: "날개 이탈", w: 6, h: 8, wings: [{ x: 4, y: 0, w: 4, h: 8 }] },
      { id: "bad-kit", name: "모르는 킷", w: 6, h: 6, kitId: "nope", wings: [{ x: 0, y: 0, w: 6, h: 6 }] },
    ];
    const { templates, warnings } = villageTemplateCatalog(project);
    expect(templates.length).toBe(HOUSE_TEMPLATE_DEFS.length + villageFormTemplates().length);
    expect(warnings).toHaveLength(3);
    expect(warnings.join(" ")).toContain("폭은 3~8칸");
    expect(warnings.join(" ")).toContain("바운딩 박스를 넘습니다");
    expect(warnings.join(" ")).toContain("모르는 재료 킷");
  });

  it("프리셋 화이트리스트가 형태 후보를 좁힌다", () => {
    const project = withAuthoring(createExistingProject(46));
    const preset = villagePresetById(project, "vpreset_my_hamlet");
    const { templates } = villageTemplateCatalog(project, presetOverrides(preset).templateIds);
    expect(templates.map((template) => template.id).sort()).toEqual(["my-longhouse", "rect-small"]);
  });

  it("프리셋의 잘못된 값은 무시하고 유효한 값만 넘긴다", () => {
    const overrides = presetOverrides({
      id: "p",
      name: "이상한 프리셋",
      pathStyle: "lava",
      settlementLayout: "spiral",
      roadWidth: 9,
      houseCount: 999,
      npcCount: -1,
      yardStyle: "garden",
      roadNaturalness: 5,
    });
    expect(overrides.pathStyle).toBeUndefined();
    expect(overrides.settlementLayout).toBeUndefined();
    expect(overrides.roadWidth).toBeUndefined();
    expect(overrides.houseCount).toBeUndefined();
    expect(overrides.npcCount).toBeUndefined();
    expect(overrides.yardStyle).toBe("garden");
    expect(overrides.roadNaturalness).toBe(1); // 범위로 조여진다
  });

  it("레코드는 JSON 왕복으로 살아남는다", () => {
    const project = withAuthoring(createExistingProject(46));
    const round = deserialize(serialize(project));
    expect(round.villageTemplates).toEqual([USER_TEMPLATE]);
    expect(round.villagePresets).toEqual([USER_PRESET]);
  });

  // 화면의 화이트리스트 고르기는 카탈로그 전체(내장 34 + 내 형태)를 체크박스로 내주고
  // 하네스도 내장 id 를 그대로 받는다. 그런데 로더는 저작 형태만 봤다 — 「작은 집」을 골라
  // 저장한 프로젝트가 다음 열기에서 ProjectFormatError 로 튕겼다(USER_PRESET 이 그 조합이다).
  it("화이트리스트에 내장 id 가 있어도 프로젝트가 열린다", () => {
    const project = withAuthoring(createExistingProject(46));
    project.villagePresets = [{ id: "vp_builtin_only", name: "내장만", templateIds: ["rect-small", "rect-large"] }];
    expect(() => deserialize(serialize(project))).not.toThrow();
  });

  it("내장에도 저작에도 없는 id 는 여전히 막는다", () => {
    const project = withAuthoring(createExistingProject(46));
    project.villagePresets = [{ id: "vp_ghost", name: "유령", templateIds: ["no-such-template"] }];
    expect(() => deserialize(serialize(project))).toThrow(/no-such-template/);
  });
});

describe("사용자 저작 마을 데이터 — AI 컨텍스트", () => {
  it("프리셋과 형태가 시스템 프롬프트에 실린다", () => {
    const project = withAuthoring(createExistingProject(46));
    const prompt = buildSystemPrompt(project);
    expect(prompt).toContain("마을 저작 데이터");
    expect(prompt).toContain("vpreset_my_hamlet");
    expect(prompt).toContain("내 산골 마을");
    expect(prompt).toContain("my-longhouse");
    expect(prompt).toContain("산골 분위기");
    expect(prompt).toContain("presetId");
  });

  it("저작 레코드가 없으면 섹션 자체가 없다", () => {
    const prompt = buildSystemPrompt(createExistingProject(46));
    expect(prompt).not.toContain("마을 저작 데이터");
  });
});

describe("사용자 저작 마을 데이터 — 시공 반영", () => {
  it("presetId를 주면 프리셋 형태만 쓰고 설계도에 프리셋을 남긴다", () => {
    const project = withAuthoring(createExistingProject(50));
    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 4,
      countPolicy: "exact",
      presetId: "vpreset_my_hamlet",
      seed: 7,
      interior: false,
    });
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);

    const plan = project.maps.map_existing?.layoutPlan;
    expect(plan, "layoutPlan").toBeDefined();
    const commons = plan!.regions.find((region) => region.role === "plaza");
    expect(commons?.tags).toContain("preset:vpreset_my_hamlet");

    const houses = plan!.regions.filter((region) => region.role === "house");
    expect(houses.length).toBe(4);
    for (const house of houses) {
      expect(["my-longhouse", "rect-small"], `${house.id} shape`).toContain(house.shape);
    }
    // 사용자 형태가 실제로 한 채 이상 쓰였다 — 화이트리스트가 장식이 아니다.
    expect(houses.some((house) => house.shape === "my-longhouse")).toBe(true);
  });

  it("모르는 presetId는 경고로 흘리고 기본값으로 시공한다", () => {
    const project = withAuthoring(createExistingProject(50));
    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 3,
      countPolicy: "exact",
      presetId: "vpreset_nope",
      seed: 3,
      interior: false,
    });
    expect(result.ok, result.summary).toBe(true);
    const plan = project.maps.map_existing?.layoutPlan;
    expect(plan!.regions.find((region) => region.role === "plaza")?.tags ?? []).not.toContain("preset:vpreset_nope");
  });

  it("사용자 형태 id를 housePlans로 지정해도 지워지지 않는다", () => {
    const project = withAuthoring(createExistingProject(50));
    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 2,
      countPolicy: "exact",
      housePlans: [
        { templateId: "my-longhouse", ownerName: "촌장" },
        { templateId: "rect-small", ownerName: "하린" },
      ],
      seed: 11,
      interior: false,
    });
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    expect((result.warnings ?? []).join(" ")).not.toContain("알려진 템플릿이 아니어서");
    const shapes = (project.maps.map_existing?.layoutPlan?.regions ?? [])
      .filter((region) => region.role === "house")
      .map((region) => region.shape);
    expect(shapes).toContain("my-longhouse");
  });

  it("저작 레코드가 없으면 예전과 똑같이 동작한다", () => {
    const project = createExistingProject(50);
    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 4,
      countPolicy: "exact",
      seed: 7,
      interior: false,
    });
    expect(result.ok, result.summary).toBe(true);
    const commons = project.maps.map_existing?.layoutPlan?.regions.find((region) => region.role === "plaza");
    expect((commons?.tags ?? []).some((tag) => tag.startsWith("preset:"))).toBe(false);
  });

  it("규약 위반 형태 레코드가 있어도 시공은 성공한다", () => {
    const project = createExistingProject(50);
    project.villageTemplates = [{ id: "broken", name: "깨진 형태", w: 99, h: 99, wings: [] }];
    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 3,
      countPolicy: "exact",
      seed: 5,
      interior: false,
    });
    expect(result.ok, result.summary).toBe(true);
  });

  it("templateFromRecord는 날개를 원점 기준으로 검사한다", () => {
    const ok = templateFromRecord(USER_TEMPLATE);
    expect("template" in ok).toBe(true);
    const bad = templateFromRecord({ ...USER_TEMPLATE, wings: [{ x: 0, y: 0, w: 2, h: 3 }] });
    expect("reason" in bad && bad.reason).toContain("최소 3×3");
  });

  // 내장 34종은 하네스가 실제로 잘 짓는 형태들이다 — 그래서 "화면이 받아주는 범위" 의
  // 정답지이기도 하다. 화면 규약이 내장보다 조이면 사용자는 복제 버튼을 누른 직후
  // "규약 위반" 을 보는데 하네스는 아무 문제 없이 짓는다(전에 날개 하한 3×4 로 그랬다).
  it("내장 34종을 복제해 온 레코드는 전부 규약을 통과한다", () => {
    const rejected = HOUSE_TEMPLATE_DEFS.map((def) => {
      // 화면의 「내장에서 복제」가 쓰는 바로 그 변환을 태운다 — 낮은 벽·킷 같은 곁가지
      // 필드를 빼먹으면 규약 계산이 달라지므로 손으로 레코드를 짜지 않는다.
      const resolved = templateFromRecord(templateRecordFromDef(def, `my-${def.id}`));
      return "reason" in resolved ? `${def.id}: ${resolved.reason}` : undefined;
    }).filter((entry): entry is string => entry !== undefined);
    expect(rejected).toEqual([]);
  });

  // 시공기가 요구하는 기하 — 열마다 벽 밴드 + 지붕 2행. 화면이 이걸 안 보면
  // "통과" 라고 해 놓고 하네스는 "집을 한 채도 시공하지 못했다" 로 실패한다.
  it("열이 짧아 지붕이 안 들어가는 형태를 거절한다", () => {
    // 위 4행만 폭 8, 아래 4행은 왼쪽 4칸 — 오른쪽 열 구간이 4행뿐(1층은 5행 필요).
    const short = templateFromRecord({
      ...USER_TEMPLATE,
      w: 8,
      h: 8,
      wings: [{ x: 0, y: 0, w: 8, h: 4 }, { x: 0, y: 4, w: 4, h: 4 }],
    });
    expect("reason" in short && short.reason).toContain("5칸 이상");

    // 같은 ㅜ 자를 한 행만 키우면 통과한다.
    const tall = templateFromRecord({
      ...USER_TEMPLATE,
      w: 8,
      h: 9,
      wings: [{ x: 0, y: 0, w: 8, h: 5 }, { x: 0, y: 5, w: 4, h: 4 }],
    });
    expect(tall).toHaveProperty("template");

    // 2층은 벽 밴드가 5행이라 7행이 필요하다.
    const twoStory = templateFromRecord({ ...USER_TEMPLATE, w: 6, h: 6, stories: 2, wings: [{ x: 0, y: 0, w: 6, h: 6 }] });
    expect("reason" in twoStory && twoStory.reason).toContain("7칸 이상");

    // 낮은 벽은 벽 밴드가 2행이라 4행으로도 짓는다(내장 「외양간」이 그렇다).
    const low = templateFromRecord({ ...USER_TEMPLATE, w: 4, h: 4, lowWall: true, kitId: undefined, wings: [{ x: 0, y: 0, w: 4, h: 4 }] });
    expect(low).toHaveProperty("template");
  });

});
