// 스킬 시스템 계약(2026-07-05): 레지스트리/슬래시 필터/사용자 정의 스킬 + 패널 전면 재배치.
// "긴 프로토콜을 버튼 하나로 주입"(맵 인터뷰의 성공 공식)을 스킬 레지스트리로 일반화한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteUserSkill,
  expandUserSkillTemplate,
  filterSkills,
  listAllSkills,
  loadUserSkills,
  pinnedSkills,
  recordSkillUse,
  saveUserSkill,
  SYSTEM_SKILLS,
  type SkillRunContext,
} from "@/ai/skills";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { openSkillPalette, renderSkillParamForm, renderSlashList } from "@/editor/panels/aiSkillDrawer";
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
  it("시스템 스킬 14종이 등록되어 있다", () => {
    expect(SYSTEM_SKILLS.length).toBe(14);
    const ids = SYSTEM_SKILLS.map((skill) => skill.id);
    for (const id of ["interview", "learn-structure", "cluster-edit", "range-classify", "unclassified-analysis", "demo-teach", "build-house", "map-audit", "build-village", "quest-builder", "build-road", "place-npcs", "npc-motion", "make-items"]) {
      expect(ids, id).toContain(id);
    }
  });

  it("집 짓기 프롬프트는 크기/공정 순서를 정확히 지시한다(v3: build_wall→문/창→build_roof)", () => {
    const house = SYSTEM_SKILLS.find((skill) => skill.id === "build-house")!;
    const rect = house.buildPrompt!({ width: 12, height: 8, material: "wood", shape: "rect", where: "" }, CTX);
    expect(rect).toContain("12×8");
    expect(rect).toContain("build_wall(mapId, rect{x,y,w,h}, wallVocabId)");
    expect(rect).toContain("벽 타일을 직접 칠해");
    expect(rect).toContain("place_door");
    expect(rect).toContain("build_roof");
    expect(rect).toContain("공정 순서");
    const lShape = house.buildPrompt!({ width: 10, height: 10, material: "plaster", shape: "l", where: "" }, CTX);
    expect(lShape).toContain("직교 rect 2개");
  });

  it("검증/마을/움직임 프롬프트에 핵심 프로토콜이 들어 있다", () => {
    const audit = SYSTEM_SKILLS.find((skill) => skill.id === "map-audit")!.buildPrompt!({}, CTX);
    expect(audit).toContain("run_lint");
    expect(audit).toContain("check_reachability");
    expect(audit).toContain("얼버무림 없이");
    const village = SYSTEM_SKILLS.find((skill) => skill.id === "build-village")!.buildPrompt!({ theme: "어촌", houses: 3, npcs: 2 }, CTX);
    expect(village).toContain("단계");
    expect(village).toContain("build_wall");
    expect(village).toContain("lay_path");
    expect(village).toContain("place_props");
    expect(village).toContain("propose_tile_vocabulary");
    expect(village).toContain("자연스러움: 보통");
    const motion = SYSTEM_SKILLS.find((skill) => skill.id === "npc-motion")!.buildPrompt!({ brief: "주민 랜덤" }, CTX);
    expect(motion).toContain("get_event");
    expect(motion).toContain("random");
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
    expect(displayAs).toContain("14×9");
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
    expect(pinnedSkills(5)[0]?.id).toBe("interview");
    recordSkillUse("make-items");
    recordSkillUse("build-road");
    const pins = pinnedSkills(5).map((skill) => skill.id);
    expect(pins[0]).toBe("build-road");
    expect(pins[1]).toBe("make-items");
    expect(pins.length).toBe(5);
  });
});
