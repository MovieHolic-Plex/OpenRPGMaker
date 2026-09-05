import type { GenreBlankProjectSystemPresetPlan } from "@/editor/genrePacks";
import {
  WELCOME_GENRE_PRESETS,
  welcomeGenrePresetById,
  welcomeGenreSystemPresetPlanById,
  type WelcomeGenrePresetId,
} from "@/editor/welcomeGenrePresets";

export const NEW_PROJECT_DEFAULT_TITLE = "새 프로젝트";

export type NewProjectStarterId = "blank" | "sample-adventure";

export type NewProjectStarterOption = {
  readonly id: NewProjectStarterId;
  readonly label: string;
  readonly blurb: string;
};

export const NEW_PROJECT_STARTER_OPTIONS: readonly NewProjectStarterOption[] = [
  { id: "blank", label: "빈 프로젝트", blurb: "빈 맵에서 직접 만들기" },
  { id: "sample-adventure", label: "예제 어드벤처", blurb: "조작법을 익히는 완성형 예제" },
];

export type NewProjectSelectionInput = {
  readonly title: string;
  readonly genrePresetId: string | null;
  readonly starter: NewProjectStarterId;
};

export type NewProjectSelection = {
  readonly title: string;
  readonly genrePresetId: WelcomeGenrePresetId | null;
  readonly starter: NewProjectStarterId;
  readonly systemPresetPlan?: GenreBlankProjectSystemPresetPlan;
};

export function newProjectGenreOptions(): readonly { readonly id: WelcomeGenrePresetId; readonly label: string; readonly blurb: string }[] {
  return WELCOME_GENRE_PRESETS.map((preset) => ({ id: preset.id, label: preset.label, blurb: preset.blurb }));
}

export function resolveNewProjectSelection(input: NewProjectSelectionInput): NewProjectSelection {
  const title = input.title.trim() || NEW_PROJECT_DEFAULT_TITLE;
  if (input.genrePresetId !== null) {
    const preset = welcomeGenrePresetById(input.genrePresetId);
    if (!preset) throw new Error(`Unknown new-project genre preset: ${input.genrePresetId}`);
    return {
      title,
      genrePresetId: preset.id,
      starter: input.starter,
      systemPresetPlan: welcomeGenreSystemPresetPlanById(preset.id),
    };
  }
  return { title, genrePresetId: null, starter: input.starter };
}
