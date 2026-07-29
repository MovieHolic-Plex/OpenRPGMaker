// 스킬 시스템 계약(2026-07-05): 레지스트리/슬래시 필터/사용자 정의 스킬 + 패널 전면 재배치.
// "긴 프로토콜을 버튼 하나로 주입"(맵 인터뷰의 성공 공식)을 스킬 레지스트리로 일반화한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteUserSkill,
  expandUserSkillTemplate,
  filterSkills,
  listAllSkills,
  listDefaultSkills,
  loadUserSkills,
  pinnedSkills,
  recordSkillUse,
  saveUserSkill,
  SYSTEM_SKILLS,
  type SkillRunContext,
} from "@/ai/skills";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { openSkillPalette, renderSkillDrawer, renderSkillParamForm, renderSlashList } from "@/editor/panels/aiSkillDrawer";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const CTX: SkillRunContext = {
  mapId: "map_x",
  mapName: "잿불 마을",
  selection: { mapId: "map_x", x: 3, y: 4, width: 5, height: 6 },
};

let storage: Map<string, string>;

function installFakeLocalStorage(): void {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

beforeEach(() => {
  installFakeLocalStorage();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("스킬 레지스트리", () => {
  it("시스템 스킬 17종이 등록되어 있다", () => {
    expect(SYSTEM_SKILLS.length).toBe(17);
    const ids = SYSTEM_SKILLS.map((skill) => skill.id);
    for (const id of ["interview", "learn-structure", "cluster-edit", "range-classify", "unclassified-analysis", "demo-teach", "build-house", "map-audit", "build-village", "build-interior", "build-dungeon", "quest-builder", "build-road", "place-npcs", "npc-motion", "make-items", "battle-balance"]) {
      expect(ids, id).toContain(id);
    }
  });

  it("집 짓기 프롬프트는 현재 맵에 정확히 1채를 author_house로 지시한다", () => {
    const house = SYSTEM_SKILLS.find((skill) => skill.id === "build-house")!;
    const rect = house.buildPrompt!({ width: 12, height: 8, material: "wood", shape: "rect", where: "" }, CTX);
    expect(rect).toContain("12×8");
    expect(rect).toContain("author_house");
    expect(rect).toContain('kind:"single"');
    expect(rect).toContain('mapId:"map_x"');
    expect(rect).toContain("정확히 1채");
    expect(rect).not.toMatch(/build_wall|place_door|place_window|build_roof|build_house_kit/);
    const lShape = house.buildPrompt!({ width: 10, height: 10, material: "plaster", shape: "l", where: "" }, CTX);
    expect(lShape).toContain("wings");
  });

  it("검증/마을/움직임 프롬프트에 핵심 프로토콜이 들어 있다", () => {
    const audit = SYSTEM_SKILLS.find((skill) => skill.id === "map-audit")!.buildPrompt!({}, CTX);
    expect(audit).toContain("run_lint");
    expect(audit).toContain("check_reachability");
    expect(audit).toContain("얼버무림 없이");
    const village = SYSTEM_SKILLS.find((skill) => skill.id === "build-village")!.buildPrompt!({ theme: "어촌", houses: 3, npcs: 2 }, CTX);
    expect(village).toContain("author_village");
    expect(village).toContain('target:{kind:"existing",mapId:"map_x"}');
    expect(village).toContain("houseCount:3");
    expect(village).toContain('countPolicy:"exact"');
    expect(village).not.toMatch(/run_village_session|start_village_session|run_village_pipeline|build_village|build_house_lots/);
    expect(village).toContain("check_reachability");
    expect(village).toContain("자연스러움: 보통");
    const motion = SYSTEM_SKILLS.find((skill) => skill.id === "npc-motion")!.buildPrompt!({ brief: "주민 랜덤" }, CTX);
    expect(motion).toContain("get_event");
    expect(motion).toContain("random");
  });

  it("전투 밸런스 리포트: simulate_battle/tune_enemy 실제 시그니처가 절차에 들어 있다", () => {
    const skill = SYSTEM_SKILLS.find((entry) => entry.id === "battle-balance")!;
    expect(skill.icon).toBe("⚔️");
    expect(skill.name).toBe("전투 밸런스 리포트");
    const prompt = skill.buildPrompt!({ troopId: "troop_boss", heroLevel: 7, targetWinRate: 90 }, CTX);
    expect(prompt).toContain("troop_boss");
    expect(prompt).toContain("get_database_records(troops)");
    expect(prompt).toContain("simulate_battle({ troopId, heroLevel: 7, n: 50, seed: 42 })");
    expect(prompt).toContain("tune_enemy({ enemyId, targetHitsToKill, targetDamageToHeroPerHit, heroLevel: 7 })");
    expect(prompt).toContain("90%");
    expect(prompt).toContain("before/after");
    expect(prompt).toContain("얼버무림 없이"); // HONEST_REPORT_RULE 재사용
    expect(prompt).not.toContain("set_build_spec"); // SPEC_RULE(공간 작업용)은 붙이지 않는다
    // troopId 비우면 전체 트룹 + 기본값(Lv5, 85%)으로 동작.
    const all = skill.buildPrompt!({}, CTX);
    expect(all).toContain("모든 트룹");
    expect(all).toContain("heroLevel: 5");
    expect(all).toContain("85%");
    expect(skill.displayAs!({ troopId: "" })).toContain("전체 트룹");
    expect(skill.displayAs!({ troopId: "troop_boss", heroLevel: 7, targetWinRate: 90 })).toContain("troop_boss");
  });

  it("타일 지식 스킬의 autoFill이 타일셋 컨텍스트에서 초기값을 만들고, 컨텍스트 없으면 undefined", () => {
    const withTileset: SkillRunContext = {
      ...CTX,
      tileset: { id: "tiles_town", selectedGroupId: "roof_main", sheetRect: { x: 2, y: 3, w: 4, h: 5 } },
    };
    const param = (skillId: string, key: string) =>
      SYSTEM_SKILLS.find((entry) => entry.id === skillId)!.params.find((entry) => entry.key === key)!;
    expect(param("cluster-edit", "tilesetId").autoFill!(withTileset)).toBe("tiles_town");
    expect(param("cluster-edit", "groupId").autoFill!(withTileset)).toBe("roof_main");
    expect(param("range-classify", "tilesetId").autoFill!(withTileset)).toBe("tiles_town");
    expect(param("range-classify", "rect").autoFill!(withTileset)).toBe("2,3,4,5");
    expect(param("unclassified-analysis", "tilesetId").autoFill!(withTileset)).toBe("tiles_town");
    // 컨텍스트 없음(하위호환 ctx) → undefined → placeholder 현행 동작 유지.
    expect(param("cluster-edit", "tilesetId").autoFill!(CTX)).toBeUndefined();
    expect(param("cluster-edit", "groupId").autoFill!(CTX)).toBeUndefined();
    expect(param("range-classify", "rect").autoFill!(CTX)).toBeUndefined();
    // 그룹/시트 선택 없이 타일셋만 있어도 id는 채워진다.
    const idOnly: SkillRunContext = { ...CTX, tileset: { id: "tiles_town" } };
    expect(param("cluster-edit", "tilesetId").autoFill!(idOnly)).toBe("tiles_town");
    expect(param("range-classify", "rect").autoFill!(idOnly)).toBeUndefined();
  });

  it("슬래시 필터가 이름/설명으로 스킬을 찾는다", () => {
    expect(filterSkills("/집").map((skill) => skill.id)).toContain("build-house");
    expect(filterSkills("검증").map((skill) => skill.id)).toContain("map-audit");
    expect(filterSkills("/존재하지않는스킬xyz")).toEqual([]);
    expect(filterSkills("/").length).toBeGreaterThanOrEqual(11);
  });
});

describe("사용자 정의 스킬", () => {
  it("저장/조회/삭제가 왕복하고 목록에 합류한다", () => {
    const saved = saveUserSkill({ name: "우물 파기", icon: "🪣", description: "", template: "{{맵}}에 우물을 파줘" });
    expect(loadUserSkills().map((skill) => skill.id)).toContain(saved.id);
    expect(listAllSkills().some((skill) => skill.id === saved.id && skill.source === "user")).toBe(true);
    expect(filterSkills("우물").map((skill) => skill.id)).toContain(saved.id);
    deleteUserSkill(saved.id);
    expect(loadUserSkills()).toEqual([]);
  });

  it("템플릿 플레이스홀더가 현재 맵/영역으로 치환된다", () => {
    const expanded = expandUserSkillTemplate("{{맵}}({{맵id}})의 {{영역}}에 꽃밭", CTX);
    expect(expanded).toBe("잿불 마을(map_x)의 (3,4) 5×6에 꽃밭");
  });

  it("{{인자키}}가 args로 치환되고, args 없이 호출해도 기존 3종은 그대로 동작한다(하위호환)", () => {
    const template = "{{맵}}의 {{영역}}에 {{재료}} 우물 {{개수}}개";
    expect(expandUserSkillTemplate(template, CTX, { 재료: "석재", 개수: 2 })).toBe("잿불 마을의 (3,4) 5×6에 석재 우물 2개");
    // 하위호환: args 생략 시 내장 3종만 치환되고 {{인자키}}는 그대로 남는다.
    expect(expandUserSkillTemplate(template, CTX)).toBe("잿불 마을의 (3,4) 5×6에 {{재료}} 우물 {{개수}}개");
    // 내장 플레이스홀더가 같은 이름의 인자 키보다 우선한다.
    expect(expandUserSkillTemplate("{{맵}}", CTX, { 맵: "가짜" })).toBe("잿불 마을");
  });

  it("loadUserSkills는 params 있는/없는 레코드를 모두 수용한다(하위호환 + 정화)", () => {
    localStorage.setItem(
      "rpg-zzu:user-skills",
      JSON.stringify([
        { id: "u-old", icon: "⭐", name: "옛 스킬", description: "", template: "{{맵}} 정리" },
        {
          id: "u-new",
          icon: "🪣",
          name: "새 스킬",
          description: "",
          template: "{{재료}} 우물",
          params: [
            { key: "재료", label: "재료", type: "enum", options: [{ value: "석재", label: "석재" }] },
            { key: "", label: "무효", type: "text" },
            { key: "개수", type: "이상한타입" },
          ],
          needsSelection: true,
        },
      ])
    );
    const skills = loadUserSkills();
    const legacy = skills.find((skill) => skill.id === "u-old")!;
    expect(legacy.params).toBeUndefined();
    expect(legacy.needsSelection).toBeUndefined();
    const fresh = skills.find((skill) => skill.id === "u-new")!;
    expect(fresh.needsSelection).toBe(true);
    // key 없는 행은 버려지고, 알 수 없는 type은 text로, label 없으면 key로 정화된다.
    expect(fresh.params?.map((param) => param.key)).toEqual(["재료", "개수"]);
    expect(fresh.params?.[0].options).toEqual([{ value: "석재", label: "석재" }]);
    expect(fresh.params?.[1].type).toBe("text");
    expect(fresh.params?.[1].label).toBe("개수");
  });

  it("params 있는 사용자 스킬은 SkillDef 인자 폼/치환/선택 필수까지 흐른다", () => {
    const saved = saveUserSkill({
      name: "꽃밭",
      icon: "🌸",
      description: "",
      template: "{{영역}}에 {{색}} 꽃밭",
      params: [{ key: "색", label: "색", type: "text" }],
      needsSelection: true,
    });
    expect(loadUserSkills().find((skill) => skill.id === saved.id)?.params?.length).toBe(1);
    const def = listAllSkills().find((skill) => skill.id === saved.id)!;
    expect(def.params.map((param) => param.key)).toEqual(["색"]);
    expect(def.needsSelection).toBe(true);
    expect(def.buildPrompt!({ 색: "노란" }, CTX)).toBe("(3,4) 5×6에 노란 꽃밭");
  });
});

describe("스킬 UI(fakeDom)", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    store.replace(createBlankProject());
    editorState.set({ selection: null });
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("패널 재배치: 헤더 모드 배지/핀바 없이 slash 진입점/서랍/설정/컨텍스트 칩이 있다", () => {
    const panel = renderAiChatPanel() as unknown as FakeElement;
    expect(findByTestId(panel, "ai-mode-badge")).toBeNull();
    expect(findByTestId(panel, "ai-skill-pinbar")).toBeNull();
    expect(findByTestId(panel, "ai-skill-slash-toggle")).toBeTruthy();
    expect(findByTestId(panel, "ai-skill-drawer")).toBeTruthy();
    // 기존 버튼 testid는 서랍 카드로 이관되어 유지된다.
    expect(findByTestId(panel, "ai-interview")).toBeTruthy();
    expect(findByTestId(panel, "ai-learn-structure")).toBeTruthy();
    expect(findByTestId(panel, "ai-demo-teach")).toBeTruthy();
    expect(findByTestId(panel, "ai-export")).toBeTruthy();
    // 설정은 모달 — 헤더 ⚙ 만 상시 노출.
    expect(findByTestId(panel, "ai-settings-toggle")).toBeTruthy();
    expect(findByTestId(panel, "ai-config-save")).toBeNull();
    // 컨텍스트 칩에 현재 맵 이름이 뜬다.
    const chips = findByTestId(panel, "ai-context-chips");
    expect(chips?.textContent).toContain("🗺");
  });

  it("입력창에 /를 치면 슬래시 목록이 뜬다", () => {
    const panel = renderAiChatPanel() as unknown as FakeElement;
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "/집";
    input.dispatchEvent(new Event("input"));
    expect(findByTestId(panel, "ai-slash-item-build-house")).toBeTruthy();
    // TUI: `/build-house` + `# 예: …` 구체 예시만. `<width>` 같은 자리표시자 없음.
    const house = findByTestId(panel, "ai-slash-item-build-house");
    expect(house?.textContent).toContain("/build-house");
    expect(house?.textContent).not.toContain("<");
    expect(house?.textContent).toContain("예:");
    expect(findByTestId(panel, "ai-slash-hint-build-house")?.textContent).toContain("회벽");
    expect(house?.getAttribute("title")).toContain("집");
    input.value = "일반 텍스트";
    input.dispatchEvent(new Event("input"));
    expect(findByTestId(panel, "ai-slash-item-build-house")).toBeNull();
  });

  it("슬래시 버튼은 입력창의 스킬 검색 메뉴를 열고 전체 보기 항목은 서랍으로 진입한다", () => {
    const panel = renderAiChatPanel() as unknown as FakeElement;
    const drawer = findByTestId(panel, "ai-skill-drawer") as unknown as HTMLElement;
    expect(drawer.hidden).toBe(true);
    (findByTestId(panel, "ai-skill-slash-toggle") as unknown as HTMLElement).click();
    expect(findByTestId(panel, "ai-slash-list")).toBeTruthy();
    (findByTestId(panel, "ai-slash-view-all") as unknown as HTMLElement).click();
    expect(drawer.hidden).toBe(false);
  });

  it("슬래시 검색은 방향키와 Enter로 선택한 스킬을 연다", () => {
    const panel = renderAiChatPanel() as unknown as FakeElement;
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "/마을";
    input.dispatchEvent(new Event("input"));
    const down = new Event("keydown") as Event & { key: string };
    down.key = "ArrowDown";
    input.dispatchEvent(down);
    const enter = new Event("keydown") as Event & { key: string };
    enter.key = "Enter";
    input.dispatchEvent(enter);
    expect(findByTestId(panel, "ai-skill-param-form")).toBeTruthy();
    expect(findByTestId(panel, "ai-slash-list")).toBeNull();
  });

  it("인자 폼: 값을 바꿔 실행하면 프롬프트에 반영된다", () => {
    const house = SYSTEM_SKILLS.find((skill) => skill.id === "build-house")!;
    const onSubmit = vi.fn();
    const form = renderSkillParamForm(house, CTX, onSubmit, () => {}) as unknown as FakeElement;
    (findByTestId(form, "skill-param-width") as unknown as HTMLInputElement).value = "14";
    (findByTestId(form, "skill-param-height") as unknown as HTMLInputElement).value = "9";
    (findByTestId(form, "skill-param-run") as unknown as HTMLElement).click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [prompt, displayAs] = onSubmit.mock.calls[0] as [string, string];
    expect(prompt).toContain("14×9");
    // 채팅 표시는 TUI 명령 줄(`/build-house`) — 앱 라벨("🏠 …")을 쓰지 않는다.
    expect(displayAs).toBe("/build-house");
  });

  it("인자 폼 초기값: autoFill이 타일셋 컨텍스트를 채우고, 없으면 placeholder 동작 유지", () => {
    const clusterEdit = SYSTEM_SKILLS.find((skill) => skill.id === "cluster-edit")!;
    const withTileset: SkillRunContext = { ...CTX, tileset: { id: "tiles_town", selectedGroupId: "roof_main" } };
    const filled = renderSkillParamForm(clusterEdit, withTileset, () => {}, () => {}) as unknown as FakeElement;
    expect((findByTestId(filled, "skill-param-tilesetId") as unknown as HTMLInputElement).value).toBe("tiles_town");
    expect((findByTestId(filled, "skill-param-groupId") as unknown as HTMLInputElement).value).toBe("roof_main");
    // 컨텍스트 없음 → 빈 입력 + placeholder(현행 동작).
    const empty = renderSkillParamForm(clusterEdit, CTX, () => {}, () => {}) as unknown as FakeElement;
    const tilesetInput = findByTestId(empty, "skill-param-tilesetId") as unknown as HTMLInputElement;
    expect(tilesetInput.value).toBe("");
    expect(tilesetInput.getAttribute("placeholder")).toBe("tiles_default");
  });

  it("내 스킬 저장 폼: 파라미터 추가/선택 필수 체크가 저장 레코드에 반영된다", () => {
    const drawer = renderSkillDrawer({ getContext: () => CTX, onRunPrompt: () => {}, onAction: () => {}, getSavePrefill: () => "" });
    const root = drawer.element as unknown as FakeElement;
    (findByTestId(root, "ai-user-skill-open") as unknown as HTMLElement).click();
    (findByTestId(root, "ai-user-skill-name") as unknown as HTMLInputElement).value = "꽃밭";
    (findByTestId(root, "ai-user-skill-template") as unknown as HTMLTextAreaElement).value = "{{영역}}에 {{색}} 꽃밭";
    (findByTestId(root, "ai-user-skill-param-add") as unknown as HTMLElement).click();
    (findByTestId(root, "ai-user-skill-param-key-0") as unknown as HTMLInputElement).value = "색";
    (findByTestId(root, "ai-user-skill-param-type-0") as unknown as HTMLSelectElement).value = "enum";
    (findByTestId(root, "ai-user-skill-param-options-0") as unknown as HTMLInputElement).value = "노랑, 파랑";
    (findByTestId(root, "ai-user-skill-needs-selection") as unknown as HTMLInputElement).checked = true;
    (findByTestId(root, "ai-user-skill-save") as unknown as HTMLElement).click();
    const saved = loadUserSkills().find((skill) => skill.name === "꽃밭")!;
    expect(saved.needsSelection).toBe(true);
    expect(saved.params).toEqual([
      { key: "색", label: "색", type: "enum", options: [{ value: "노랑", label: "노랑" }, { value: "파랑", label: "파랑" }] },
    ]);
  });

  it("needsSelection 사용자 스킬은 선택 없으면 시스템 스킬과 같은 안내 경로로 멈춘다", () => {
    const saved = saveUserSkill({ name: "영역 손질", icon: "✂️", description: "", template: "{{영역}} 손질", needsSelection: true });
    const def = listAllSkills().find((skill) => skill.id === saved.id)!;
    const onRunPrompt = vi.fn();
    const drawer = renderSkillDrawer({
      getContext: () => ({ mapId: "map_x", mapName: "잿불 마을", selection: null }),
      onRunPrompt,
      onAction: () => {},
      getSavePrefill: () => "",
    });
    drawer.run(def);
    expect(onRunPrompt).not.toHaveBeenCalled();
    // 선택이 있으면 params 없는 사용자 스킬은 즉시 실행된다.
    const withSelection = renderSkillDrawer({ getContext: () => CTX, onRunPrompt, onAction: () => {}, getSavePrefill: () => "" });
    withSelection.run(def);
    expect(onRunPrompt).toHaveBeenCalledTimes(1);
    expect(onRunPrompt.mock.calls[0][0]).toBe("(3,4) 5×6 손질");
  });

  it("슬래시 목록 클릭이 onPick으로 스킬을 넘긴다", () => {
    const onPick = vi.fn();
    const list = renderSlashList("/검증", onPick) as unknown as FakeElement;
    (findByTestId(list, "ai-slash-item-map-audit") as unknown as HTMLElement).click();
    expect(onPick).toHaveBeenCalledTimes(1);
    expect((onPick.mock.calls[0][0] as { id: string }).id).toBe("map-audit");
  });

  it("시작 화면(빈 대화)은 최소 힌트만 두고, 헤더/입력부는 경량 IA를 유지한다", () => {
    const panel = renderAiChatPanel() as unknown as FakeElement;
    expect(findByTestId(panel, "ai-start-screen")).toBeTruthy();
    expect(findByTestId(panel, "ai-start-empty-hint")).toBeTruthy();
    expect(findByTestId(panel, "ai-start-build-house")).toBeNull();
    expect(findByTestId(panel, "ai-mode-badge")).toBeNull();
    expect(findByTestId(panel, "ai-skill-pinbar")).toBeNull();
    expect(findByTestId(panel, "ai-skill-slash-toggle")).toBeTruthy();
    // 헤더: 로그 내보내기 복귀 + 스튜디오 토글.
    expect(findByTestId(panel, "ai-export")).toBeTruthy();
    expect(findByTestId(panel, "ai-studio-toggle")).toBeTruthy();
  });

  it("스튜디오 토글이 is-studio 클래스와 스킬 레일을 켠다", () => {
    const panel = renderAiChatPanel() as unknown as FakeElement;
    const toggle = findByTestId(panel, "ai-studio-toggle") as unknown as HTMLElement;
    const drawer = findByTestId(panel, "ai-skill-drawer") as unknown as HTMLElement;
    expect(drawer.hidden).toBe(true);
    toggle.click();
    expect(panel.className).toContain("is-studio");
    expect(drawer.hidden).toBe(false);
    toggle.click();
    expect(panel.className).not.toContain("is-studio");
    expect(drawer.hidden).toBe(true);
  });

  it("Ctrl+K 팔레트: 검색 후 Enter로 첫 스킬을 실행한다", () => {
    const onRun = vi.fn();
    const palette = openSkillPalette(onRun) as unknown as FakeElement;
    const search = findByTestId(palette, "ai-skill-palette-search") as unknown as HTMLInputElement;
    search.value = "검증";
    search.dispatchEvent(new Event("input"));
    const enter = new Event("keydown") as Event & { key: string };
    enter.key = "Enter";
    search.dispatchEvent(enter);
    expect(onRun).toHaveBeenCalledTimes(1);
    expect((onRun.mock.calls[0][0] as { id: string }).id).toBe("map-audit");
  });
});

describe("핀 바 최근 사용순", () => {
  it("기록이 없으면 기본 순서, 사용하면 최근 스킬이 앞으로 온다", () => {
    // 기본 핀은 제작 흐름으로 시작한다. 예전 첫 항목은 "interview"(타일 학습 저작 도구)였는데,
    // 그 계열을 advanced 로 내리면서 기본 순서에서도 빼 첫 화면이 /build-* 로 채워지게 했다.
    expect(pinnedSkills(5)[0]?.id).toBe("build-house");
    recordSkillUse("make-items");
    recordSkillUse("build-road");
    const pins = pinnedSkills(5).map((skill) => skill.id);
    expect(pins[0]).toBe("build-road");
    expect(pins[1]).toBe("make-items");
    expect(pins.length).toBe(5);
  });

  it("검색어가 없으면 고급(저작) 스킬을 숨기고, 검색하면 찾을 수 있다", () => {
    // 타일 학습 계열 6종이 SYSTEM_SKILLS 맨 앞이라 슬래시 첫 화면을 다 차지했다.
    const ADVANCED = ["interview", "learn-structure", "cluster-edit", "range-classify", "unclassified-analysis", "demo-teach"];
    const defaultIds = filterSkills("").map((skill) => skill.id);
    for (const id of ADVANCED) expect(defaultIds).not.toContain(id);
    expect(defaultIds).toContain("build-house");
    expect(defaultIds).toContain("map-audit");

    // 숨겼을 뿐 지운 게 아니다 — 이름/id 로 치면 나온다.
    expect(filterSkills("interview").map((s) => s.id)).toContain("interview");
    expect(filterSkills("인터뷰").map((s) => s.id)).toContain("interview");

    // id 조회 경로는 전체를 봐야 한다(clusterAiModal 이 cluster-edit 를 직접 부른다).
    expect(listAllSkills().map((s) => s.id)).toContain("cluster-edit");
    expect(listDefaultSkills().map((s) => s.id)).not.toContain("cluster-edit");
  });
});
