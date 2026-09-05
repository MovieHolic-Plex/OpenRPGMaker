/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { GENRE_PACK_IDS } from "@/project/genrePackId";
import {
  NEW_PROJECT_GENRE_OPTIONS,
  newProjectGenreOptionTestId,
  newProjectPackLabel,
  showNewProjectDialog,
} from "@/editor/ui/newProjectDialog";
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

  it("다섯 팩마다 기본 레시피의 시스템 프리셋이 적용된다", () => {
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

  it("표시 문구는 다섯 팩을 빠짐없이 덮는다", () => {
    for (const packId of GENRE_PACK_IDS) {
      expect(NEW_PROJECT_GENRE_OPTIONS.some((option) => option.id === packId)).toBe(true);
      expect(newProjectPackLabel(packId)).not.toBe("빈 프로젝트");
    }
    expect(newProjectPackLabel(null)).toBe("빈 프로젝트");
  });
});

describe("새 프로젝트 다이얼로그", () => {
  it("여섯 선택지(이름 입력 포함 빈 프로젝트 + 다섯 팩)가 보인다", async () => {
    const pending = showNewProjectDialog({ defaultValue: "달빛 항구" });
    const host = document.querySelector("[data-testid='new-project-dialog']");
    expect(host).not.toBeNull();
    expect(document.querySelector("[data-testid='new-project-name-input']")).not.toBeNull();
    const radios = Array.from(
      document.querySelectorAll(`[data-testid^='new-project-genre-option-']`),
    );
    expect(radios).toHaveLength(6);
    expect(newProjectGenreOptionTestId(null)).toBe("new-project-genre-option-blank");
    document.querySelector<HTMLButtonElement>("[data-testid='new-project-cancel']")?.click();
    await expect(pending).resolves.toBeNull();
  });

  it("빈 프로젝트가 기본 선택이고 확인하면 이름·packId 가 돌아온다", async () => {
    const pending = showNewProjectDialog({ defaultValue: "달빛 항구" });
    const blank = document.querySelector<HTMLInputElement>(
      `[data-testid='${newProjectGenreOptionTestId(null)}']`,
    );
    expect(blank?.checked).toBe(true);
    document.querySelector<HTMLButtonElement>("[data-testid='new-project-confirm']")?.click();
    await expect(pending).resolves.toEqual({ title: "달빛 항구", packId: null });
  });

  it("장르를 고르면 그 packId 가 돌아온다", async () => {
    const pending = showNewProjectDialog({ defaultValue: "달빛 항구" });
    const monster = document.querySelector<HTMLInputElement>(
      `[data-testid='${newProjectGenreOptionTestId("monster-collect")}']`,
    );
    expect(monster).not.toBeNull();
    monster!.checked = true;
    monster!.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector<HTMLButtonElement>("[data-testid='new-project-confirm']")?.click();
    await expect(pending).resolves.toEqual({ title: "달빛 항구", packId: "monster-collect" });
  });

  it("빈 이름은 기본값으로 대체된다", async () => {
    const pending = showNewProjectDialog({ defaultValue: "새 프로젝트" });
    const input = document.querySelector<HTMLInputElement>("[data-testid='new-project-name-input']");
    input!.value = "   ";
    document.querySelector<HTMLButtonElement>("[data-testid='new-project-confirm']")?.click();
    await expect(pending).resolves.toEqual({ title: "새 프로젝트", packId: null });
  });
});
