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
import { completeInterviewChoices } from "./helpers/gameDesignBrief";

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

  it("선택지 id 는 팩 id 가 아니다 — 한 팩에 이름이 둘인 경우를 되돌릴 수 있어야 한다", () => {
    const horrorChoices = NEW_PROJECT_CHOICES.filter((choice) => choice.packId === "horror-chase");
    expect(horrorChoices.map((choice) => choice.id).sort()).toEqual(["horror-gallery", "school-horror"]);
    expect(new Set(horrorChoices.map((choice) => choice.label)).size).toBe(2);
    const rows = NEW_PROJECT_GENRE_OPTIONS.filter((option) =>
      option.id !== null && newProjectChoiceById(option.id)?.packId === "horror-chase");
    expect(rows).toHaveLength(2);
  });

  it("다이얼로그 순서는 첫 화면 featured 3장을 먼저 둔다", () => {
    const featured = NEW_PROJECT_CHOICES.filter((choice) => choice.featured).map((choice) => choice.id);
    expect(NEW_PROJECT_DIALOG_CHOICE_ORDER.slice(0, featured.length)).toEqual(featured);
    expect([...NEW_PROJECT_DIALOG_CHOICE_ORDER].sort()).toEqual(
      [...NEW_PROJECT_CHOICES.map((choice) => choice.id)].sort());
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
  it("빈 프로젝트와 모든 선택지가 보인다", async () => {
    const pending = showNewProjectDialog({ defaultValue: "달빛 항구" });
    const host = document.querySelector("[data-testid='new-project-dialog']");
    expect(host).not.toBeNull();
    expect(document.querySelector("[data-testid='new-project-name-input']")).not.toBeNull();
    const radios = Array.from(
      document.querySelectorAll(`[data-testid^='new-project-genre-option-']`),
    );
    expect(radios).toHaveLength(NEW_PROJECT_CHOICES.length + 1);
    expect(newProjectGenreOptionTestId(null)).toBe("new-project-genre-option-blank");
    expect(newProjectGenreOptionTestId("horror-gallery")).toBe("new-project-genre-option-horror-gallery");
    document.querySelector<HTMLButtonElement>("[data-testid='new-project-cancel']")?.click();
    await expect(pending).resolves.toBeNull();
  });

  it("빈 프로젝트가 기본 선택이고 확인하면 이름·선택지 id 가 돌아온다", async () => {
    const pending = showNewProjectDialog({ defaultValue: "달빛 항구" });
    const blank = document.querySelector<HTMLInputElement>(
      `[data-testid='${newProjectGenreOptionTestId(null)}']`,
    );
    expect(blank?.checked).toBe(true);
    document.querySelector<HTMLButtonElement>("[data-testid='new-project-confirm']")?.click();
    // 2026-09-21 인터뷰 다이얼로그 — 결과에 게임 화면 크기가 추가됐다(기본값 classic).
    await expect(pending).resolves.toEqual({ title: "달빛 항구", choiceId: null, screenSize: "classic" });
  });

  it("선택지를 고르면 그 선택지 id 가 돌아온다", async () => {
    const pending = showNewProjectDialog({ defaultValue: "달빛 항구" });
    const monster = document.querySelector<HTMLInputElement>(
      `[data-testid='${newProjectGenreOptionTestId("monster-collect")}']`,
    );
    expect(monster).not.toBeNull();
    monster!.checked = true;
    monster!.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector<HTMLButtonElement>("[data-testid='new-project-confirm']")?.click();
    await completeInterviewChoices();
    await expect(pending).resolves.toMatchObject({ title: "달빛 항구", choiceId: "monster-collect", screenSize: "classic", gameDesignBrief: { presetId: "monster-collect" } });
  });

  it("선택지는 첫 화면 포스터와 같은 그림을 실어 보여 준다", async () => {
    const pending = showNewProjectDialog({ defaultValue: "달빛 항구" });
    for (const option of NEW_PROJECT_GENRE_OPTIONS) {
      if (option.id === null) continue;
      const radio = document.querySelector(`[data-testid='${newProjectGenreOptionTestId(option.id)}']`);
      const image = radio?.parentElement?.querySelector("img");
      expect(image?.getAttribute("src"), `${option.id} row image`).toBe(option.thumb);
      expect(image?.getAttribute("alt")).toBe("");
    }
    const blankRow = document
      .querySelector(`[data-testid='${newProjectGenreOptionTestId(null)}']`)?.parentElement;
    expect(blankRow?.querySelector("img")).toBeNull();
    expect(blankRow?.querySelector(".new-project-genre-placeholder")?.textContent).toBe("+");
    document.querySelector<HTMLButtonElement>("[data-testid='new-project-cancel']")?.click();
    await expect(pending).resolves.toBeNull();
  });

  it("빈 이름은 기본값으로 대체된다", async () => {
    const pending = showNewProjectDialog({ defaultValue: "새 프로젝트" });
    const input = document.querySelector<HTMLInputElement>("[data-testid='new-project-name-input']");
    input!.value = "   ";
    document.querySelector<HTMLButtonElement>("[data-testid='new-project-confirm']")?.click();
    await expect(pending).resolves.toEqual({ title: "새 프로젝트", choiceId: null, screenSize: "classic" });
  });
});
