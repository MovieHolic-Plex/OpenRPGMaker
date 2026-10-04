/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { GENRE_PACK_IDS } from "@/project/genrePackId";
import {
  NEW_PROJECT_CHOICES,
  NEW_PROJECT_DIALOG_CHOICE_ORDER,
  newProjectChoiceById,
  newProjectChoiceRowThumb,
} from "@/editor/newProjectChoices";
import {
  NEW_PROJECT_GENRE_OPTIONS,
  newProjectChoiceLabel,
  newProjectGenreOptionTestId,
  showNewProjectDialog,
} from "@/editor/ui/newProjectDialog";
import { WELCOME_GENRE_PRESETS } from "@/editor/welcomeGenrePresets";
import { createBlankProject } from "@/project/defaults";


afterEach(() => {
  document.body.replaceChildren();
});

describe("새 프로젝트 씨앗", () => {
  it("장르 없음은 빈 프로젝트와 같은 씨앗이다", () => {
    const seed = createNewProjectSeed(null);
    expect(seed.system.genre).toBe(createBlankProject().system.genre);
    expect(Object.keys(seed.maps)).toHaveLength(1);
  });

  it("공식 팩마다 기본 레시피의 시스템 프리셋이 적용된다", () => {
    for (const packId of GENRE_PACK_IDS) {
      const seed = createNewProjectSeed(packId);
      expect(seed.system.genre).toBe(packId);
    }
    expect(createNewProjectSeed("monster-collect").system.monsterCollection).toBe(true);
    expect(createNewProjectSeed("farm-life").system.timeSystem?.enabled).toBe(true);
  });

  it("장르 씨앗은 맵·이벤트를 심지 않는다", () => {
    const seed = createNewProjectSeed("monster-collect");
    expect(Object.keys(seed.maps)).toHaveLength(1);
    expect(Object.values(seed.maps).every((map) => map.events.length === 0)).toBe(true);
  });

  it("표시 문구는 모든 공식 팩을 빠짐없이 덮는다", () => {
    const coveredPacks = new Set(NEW_PROJECT_CHOICES.map((choice) => choice.packId));
    for (const packId of GENRE_PACK_IDS) {
      expect(coveredPacks.has(packId), `${packId} 선택지 누락`).toBe(true);
    }
    for (const choice of NEW_PROJECT_CHOICES) {
      expect(newProjectChoiceLabel(choice.id)).toBe(choice.label);
      expect(newProjectChoiceLabel(choice.id)).not.toBe("빈 프로젝트");
    }
    expect(newProjectChoiceLabel(null)).toBe("빈 프로젝트");
  });
});

describe("새 프로젝트 선택 정본", () => {
  // Break (2026-09-11 통합 전): 첫 화면 포스터와 이 다이얼로그가 같은 팩을 다른 이름으로 보여 줬다.
  // story-cutscene 은 "회상 스토리" vs "스토리 컷신", horror-chase 는 포스터 2장 vs 행 1개였다.
  // 그래서 첫 화면에서 고른 이름이 두 번째 화면에서 사라진 것처럼 보였다. 이 게이트가 그걸 막는다.
  it("다이얼로그 행의 이름·설명이 첫 화면 포스터와 글자까지 같다", () => {
    const presetsById = new Map(WELCOME_GENRE_PRESETS.map((preset) => [preset.id, preset]));
    for (const option of NEW_PROJECT_GENRE_OPTIONS) {
      if (option.id === null) continue;
      const preset = presetsById.get(option.id);
      expect(preset, `${option.id} 첫 화면 포스터 누락`).toBeTruthy();
      expect(option.label).toBe(preset!.label);
      expect(option.blurb).toBe(preset!.blurb);
      // 행 그림은 포스터 그림이 형제와 겹칠 때만 갈라진다 — 이름·설명은 항상 같다.
      expect(option.thumb).toBe(newProjectChoiceRowThumb(newProjectChoiceById(option.id)!));
    }
  });

  it("시작 UI 밖 장르는 정본에만 남고 다이얼로그 행에는 없다", () => {
    const horrorChoices = NEW_PROJECT_CHOICES.filter((choice) => choice.packId === "horror-chase");
    expect(horrorChoices.map((choice) => choice.id).sort()).toEqual(["horror-gallery", "school-horror"]);
    expect(new Set(horrorChoices.map((choice) => choice.label)).size).toBe(2);
    const rows = NEW_PROJECT_GENRE_OPTIONS.filter((option) =>
      option.id !== null && newProjectChoiceById(option.id)?.packId === "horror-chase");
    expect(rows).toHaveLength(0);
  });

  it("다이얼로그는 첫 화면의 세 장르만 같은 순서로 보여 준다", () => {
    const featured = NEW_PROJECT_CHOICES.filter((choice) => choice.featured).map((choice) => choice.id);
    expect(featured).toEqual(["monster-collect", "story-cutscene", "adventure-jrpg"]);
    expect(NEW_PROJECT_DIALOG_CHOICE_ORDER).toEqual(featured);
  });

  it("같은 그림을 두 행이 나눠 갖지 않는다", () => {
    const thumbs = NEW_PROJECT_GENRE_OPTIONS
      .filter((option) => option.id !== null)
      .map((option) => option.thumb);
    expect(thumbs.every((thumb) => typeof thumb === "string" && thumb.length > 0)).toBe(true);
    expect(new Set(thumbs).size, `골랐을 때 무엇이 달라지는지 읽히지 않는다: ${thumbs.join(", ")}`)
      .toBe(thumbs.length);
  });
});

describe("새 프로젝트 다이얼로그", () => {
  const click = (id: string) => document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!.click();
  it("opens AI planning and preserves explicit example and blank alternatives", async () => {
    const pending = showNewProjectDialog();
    expect(document.querySelector('[data-testid="new-project-confirm"]')?.textContent).toContain("게임 기획");
    click("new-project-back");
    expect(document.querySelectorAll(".project-start-example")).toHaveLength(3);
    expect(document.querySelector(`[data-testid="${newProjectGenreOptionTestId(null)}"]`)).not.toBeNull();
    click("new-project-cancel"); expect(await pending).toBeNull();
  });
  it("creates an empty project after its explicit choice", async () => {
    const pending = showNewProjectDialog({ defaultValue: "달빛 항구" });
    click("new-project-back");
    click(newProjectGenreOptionTestId(null)); click("new-project-confirm");
    expect(await pending).toEqual({ title: "달빛 항구", choiceId: null, screenSize: "classic", startMode: "blank" });
  });
  it("the example path needs no AI connection or interview", async () => {
    let gateCalls = 0;
    const pending = showNewProjectDialog({ ensureAiConnected: async () => { gateCalls++; return false; } });
    click("new-project-back");
    click(newProjectGenreOptionTestId("monster-collect")); click("new-project-confirm");
    expect(await pending).toMatchObject({ choiceId: "monster-collect", startMode: "example", screenSize: "classic" });
    expect(gateCalls).toBe(0); expect(document.querySelector('[data-testid="project-interview"]')).toBeNull();
  });
  it("an AI gate decline keeps the dialog and draft intact", async () => {
    const pending = showNewProjectDialog({ ensureAiConnected: async () => false });
    const input = document.querySelector<HTMLInputElement>('[data-testid="new-project-name-input"]')!;
    input.value = "내 게임"; input.dispatchEvent(new Event("input"));
    click("new-project-confirm"); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(document.querySelector('[data-testid="project-interview"]')).toBeNull();
    click("new-project-cancel"); expect(await pending).toBeNull();
  });
  it("empty names use the supplied default without an extra wizard", async () => {
    const pending = showNewProjectDialog({ defaultValue: "새 프로젝트" });
    click("new-project-back");
    click(newProjectGenreOptionTestId(null));
    const input = document.querySelector<HTMLInputElement>('[data-testid="new-project-name-input"]')!;
    input.value = " "; input.dispatchEvent(new Event("input")); click("new-project-confirm");
    expect(await pending).toMatchObject({ title: "새 프로젝트", startMode: "blank" });
  });
});
