/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { addMapLocation } from "@/project/mapNamedLocations";
import { analyzeSelectionIntent } from "@/editor/selectionIntentRank";
import { buildNpcArchetypePrompt, recommendedNpcArchetypes } from "@/editor/selectionNpcArchetypes";
import { buildDirectArchetypePrompt, recommendedDirectArchetypes } from "@/editor/selectionDirectArchetypes";
import { buildEncounterArchetypePrompt, recommendedEncounterArchetypes } from "@/editor/selectionEncounterArchetypes";
import { renderSelectionActionChips } from "@/editor/selectionActionChips";

describe("analyzeSelectionIntent — 드래그 영역 0ms 맥락 판별 및 우선순위", () => {
  it("저장된 구역 태그(map.locations)를 최우선으로 읽고 마을 광장 소형 영역은 NPC 추가를 1순위로 둔다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.mapRole = "town";
    map.encounterRate = 0;
    addMapLocation(map, { name: "중앙 광장", x: 2, y: 2, w: 6, h: 6, tags: ["plaza"] });

    const analysis = analyzeSelectionIntent(project, map, { x: 3, y: 3, width: 2, height: 2 });
    expect(analysis.zone.source).toBe("location");
    expect(analysis.zone.label).toBe("중앙 광장");
    expect(analysis.zone.locationId).toBeTruthy();
    expect(analysis.actions.map((a) => a.rank)).toEqual([1, 2, 3]);
    expect(analysis.actions[0]!.kind).toBe("npc");
    expect(analysis.actions[0]!.instruction).toContain("중앙 광장");
    expect(analysis.promptPlaceholder).toContain("중앙 광장");
  });

  it("던전 맵의 조우 미설정 중형 구간은 몹 조우를 1순위로 둔다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.mapRole = "dungeon";
    map.name = "어두운 동굴 1층";
    delete map.encounterTable;
    map.fieldSpawns = [];

    const analysis = analyzeSelectionIntent(project, map, { x: 2, y: 2, width: 5, height: 4 });
    expect(analysis.zone.mapRole).toBe("dungeon");
    expect(analysis.actions[0]!.kind).toBe("encounter");
    expect(analysis.actions[0]!.instruction).toBeNull();
  });

  it("수면·물가 비율이 높은 영역은 맵 디렉팅을 1순위로 두고 수심 유지 가드레일을 넣는다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.mapRole = "field";
    const waterDepth = new Array<number>(map.width * map.height).fill(0);
    for (let y = 2; y < 6; y += 1) {
      for (let x = 2; x < 6; x += 1) {
        waterDepth[y * map.width + x] = 2;
      }
    }
    map.terrainDesign = { ...map.terrainDesign, waterDepth };

    const analysis = analyzeSelectionIntent(project, map, { x: 2, y: 2, width: 4, height: 4 });
    expect(analysis.zone.source).toBe("tiles");
    expect(analysis.zone.metrics.waterRatio).toBeGreaterThanOrEqual(0.65);
    expect(analysis.actions[0]!.kind).toBe("direct");
    expect(analysis.actions[0]!.instruction).toContain("수심");
  });

  it("map.locations가 없으면 시공 설계도(layoutPlan.regions)를 폴백으로 읽는다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.mapRole = "town";
    map.layoutPlan = {
      kind: "village",
      regions: [{ id: "r1", role: "market", label: "남쪽 시장", x: 1, y: 1, w: 6, h: 5 }],
    };

    const analysis = analyzeSelectionIntent(project, map, { x: 2, y: 2, width: 3, height: 2 });
    expect(analysis.zone.source).toBe("layout");
    expect(analysis.zone.label).toBe("남쪽 시장");
    expect(analysis.actions[0]!.kind).toBe("npc");
  });
});

describe("renderSelectionActionChips — 컨텍스트 우선순위 HUD & 구역 태그 저장", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.mapRole = "town";
    store.replaceProject(project);
    editorState.set({ currentMapId: map.id, selection: null, clipboard: null, layer: "lower" });
    resetMapEditHistory();
  });

  it("초기에는 1줄 컴팩트 HUD만 보이고 서랍은 접혀 있으며, 구역 태그·NPC 서랍·Ctrl+C 복사가 동작한다", () => {
    const mapId = store.getCurrent().startMapId;
    const handoff = vi.fn();
    const bar = renderSelectionActionChips({ mapId, x: 2, y: 2, width: 4, height: 3 }, handoff);
    document.body.append(bar);

    // 1줄 컴팩트 HUD: 1·2·3 + 4 조수 지시
    expect(bar.querySelector("[data-testid='selection-context-row']")).toBeTruthy();
    expect(bar.querySelector("[data-testid='selection-chip-quick-npc']")).toBeTruthy();
    expect(bar.querySelector("[data-testid='selection-chip-quick-direct']")).toBeTruthy();
    expect(bar.querySelector("[data-testid='selection-chip-quick-encounter']")).toBeTruthy();
    expect(bar.querySelector("[data-testid='selection-chip-ai-toggle']")).toBeTruthy();

    // 초기 서랍과 더보기 팝오버는 접혀 있다
    const drawer = bar.querySelector<HTMLElement>("[data-testid='selection-drawer']")!;
    expect(drawer.hidden).toBe(true);
    const morePop = bar.querySelector<HTMLElement>("[data-testid='selection-more-popover']")!;
    expect(morePop.hidden).toBe(true);

    // 1 NPC 추가 클릭 → 12종 아키타입 팔레트 + 상세 프롬프트 보기 + 직접 빈 NPC 열림
    bar.querySelector<HTMLButtonElement>("[data-testid='selection-chip-quick-npc']")!.click();
    expect(drawer.hidden).toBe(false);
    expect(bar.querySelector("[data-testid='selection-npc-palette']")).toBeTruthy();
    expect(bar.querySelector("[data-testid='selection-npc-arch-shop']")).toBeTruthy();
    expect(bar.querySelector("[data-testid='selection-npc-arch-quest']")).toBeTruthy();
    expect(bar.querySelector("[data-testid='selection-chip-npc-direct']")).toBeTruthy();

    // 퀘스트 아키타입 선택 + 상세 프롬프트 토글 확인
    bar.querySelector<HTMLButtonElement>("[data-testid='selection-npc-arch-quest']")!.click();
    bar.querySelector<HTMLButtonElement>("[data-testid='selection-npc-spec-toggle']")!.click();
    const preview = bar.querySelector<HTMLElement>("[data-testid='selection-npc-spec-preview']")!;
    expect(preview.hidden).toBe(false);
    expect(preview.textContent).toContain("퀘스트");
    expect(preview.textContent).toContain("declare_story_flag");

    // 2 맵 디렉팅 클릭 → 12종 디렉팅 팔레트 + 마을 즉시 짓기 + 상세 프롬프트 전환
    bar.querySelector<HTMLButtonElement>("[data-testid='selection-chip-quick-direct']")!.click();
    expect(bar.querySelector("[data-testid='selection-direct-palette']")).toBeTruthy();
    expect(bar.querySelector("[data-testid='selection-direct-arch-street']")).toBeTruthy();
    expect(bar.querySelector("[data-testid='selection-preset-village-instant']")).toBeTruthy();
    bar.querySelector<HTMLButtonElement>("[data-testid='selection-direct-arch-lighting']")!.click();
    const directPreview = bar.querySelector<HTMLElement>("[data-testid='selection-direct-spec-preview']")!;
    expect(directPreview.hidden).toBe(false);
    expect(directPreview.textContent).toContain("set_lighting_volume");

    // 3 몹 조우 클릭 → 8종 조우 팔레트 + 걷기 전투 직접 버튼 + 상세 프롬프트 전환
    bar.querySelector<HTMLButtonElement>("[data-testid='selection-chip-quick-encounter']")!.click();
    expect(bar.querySelector("[data-testid='selection-encounter-palette']")).toBeTruthy();
    expect(bar.querySelector("[data-testid='selection-encounter-arch-walk_random']")).toBeTruthy();
    expect(bar.querySelector("[data-testid='selection-chip-walk-encounter']")).toBeTruthy();
    bar.querySelector<HTMLButtonElement>("[data-testid='selection-encounter-arch-hunting_ground']")!.click();
    const encPreview = bar.querySelector<HTMLElement>("[data-testid='selection-encounter-spec-preview']")!;
    expect(encPreview.hidden).toBe(false);
    expect(encPreview.textContent).toContain("make_hunting_ground");

    // 구역 태그 핀 클릭 → 인라인 입력 및 map.locations 저장
    const zoneBtn = bar.querySelector<HTMLButtonElement>("[data-testid='selection-chip-zone-tag']")!;
    zoneBtn.click();
    const input = bar.querySelector<HTMLInputElement>("[data-testid='selection-zone-tag-input']")!;
    input.value = "버들 분수 광장";
    input.form!.dispatchEvent(new Event("submit", { cancelable: true }));

    const savedMap = store.getCurrent().maps[mapId]!;
    expect(savedMap.locations?.some((loc) => loc.name === "버들 분수 광장")).toBe(true);
    expect(zoneBtn.classList.contains("is-saved")).toBe(true);
    expect(zoneBtn.dataset.zoneSource).toBe("location");
    expect(drawer.hidden).toBe(true);
  });

  it("buildNpcArchetypePrompt 는 세계관 캐논·금지어·구역 좌표·사용자 메모를 상세 프롬프트로 조립한다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.mapRole = "dungeon";
    project.worldCanon = {
      name: "잿빛 변경",
      premise: "마법이 사라진 철기 시대 변경 지대",
      tones: ["grim"],
      era: "중세 후기",
      techCeiling: "화약 이전",
      absences: ["총기", "스마트폰"],
      laws: {},
      body: "모든 교역은 버들항 길드가 통제한다.",
      status: "canon",
      visibility: "public",
    };
    const analysis = analyzeSelectionIntent(project, map, { x: 2, y: 2, width: 4, height: 4 });
    const rec = recommendedNpcArchetypes(analysis.zone);
    expect(rec.items[0]!.id).toBe("boss");

    const prompt = buildNpcArchetypePrompt({
      archetypeId: "quest",
      project,
      map,
      selection: { x: 2, y: 2, width: 4, height: 4 },
      zone: analysis.zone,
      zoneLabel: "어두운 숲길",
      zoneSaved: true,
      suggestedCell: analysis.suggestedNpcCell,
      userMemo: "잃어버린 열쇠를 찾아오면 200G 보상",
    });
    expect(prompt).toContain("「어두운 숲길」 (저장된 구역 태그)");
    expect(prompt).toContain("declare_story_flag");
    expect(prompt).toContain("잿빛 변경");
    expect(prompt).toContain("총기, 스마트폰");
    expect(prompt).toContain("잃어버린 열쇠를 찾아오면 200G 보상");
  });

  it("buildDirectArchetypePrompt 와 buildEncounterArchetypePrompt 도 구역·세계관·도구 스펙을 상세 조립한다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.mapRole = "dungeon";
    project.worldCanon = {
      name: "서리 봉인",
      premise: "얼어붙은 고대 유적 탐험",
      tones: ["dark-fantasy"],
      era: "고대 판타지",
      techCeiling: "철기",
      absences: ["현대 자동차"],
      laws: {},
      body: "고대 룬 장치로만 문이 열린다.",
      status: "canon",
      visibility: "public",
    };
    const analysis = analyzeSelectionIntent(project, map, { x: 2, y: 2, width: 5, height: 4 });

    const directRec = recommendedDirectArchetypes(analysis.zone);
    expect(directRec.items[0]!.id).toBe("puzzle_gimmick");
    const directPrompt = buildDirectArchetypePrompt({
      archetypeId: "puzzle_gimmick",
      project,
      map,
      selection: { x: 2, y: 2, width: 5, height: 4 },
      zone: analysis.zone,
      zoneLabel: "얼음 유적 홀",
      zoneSaved: true,
      userMemo: "레버를 당기면 북쪽 비밀 통로 개방",
    });
    expect(directPrompt).toContain("「얼음 유적 홀」 (저장된 구역 태그)");
    expect(directPrompt).toContain("author_map_puzzle");
    expect(directPrompt).toContain("서리 봉인");
    expect(directPrompt).toContain("현대 자동차");
    expect(directPrompt).toContain("레버를 당기면 북쪽 비밀 통로 개방");

    const encRec = recommendedEncounterArchetypes(analysis.zone);
    expect(encRec.items[0]!.id).toBe("symbol_patrol");
    const encPrompt = buildEncounterArchetypePrompt({
      archetypeId: "night_spawn",
      project,
      map,
      selection: { x: 2, y: 2, width: 5, height: 4 },
      zone: analysis.zone,
      zoneLabel: "얼음 유적 홀",
      zoneSaved: true,
      suggestedCell: analysis.suggestedNpcCell,
      userMemo: "밤에만 나오는 서리 유령 무리",
    });
    expect(encPrompt).toContain("make_hunting_ground");
    expect(encPrompt).toContain("configure_time_system");
    expect(encPrompt).toContain("서리 봉인");
    expect(encPrompt).toContain("밤에만 나오는 서리 유령 무리");
  });
});
