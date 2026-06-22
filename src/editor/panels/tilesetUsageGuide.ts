export type TilesetEditMode = "ai" | "group" | "passage" | "terrain";

type ModeGuide = {
  readonly id: TilesetEditMode;
  readonly label: string;
};

const PASSAGE_MODE_GUIDE: ModeGuide = {
  id: "passage",
  label: "통행",
};

export const TILESET_EDIT_MODES: readonly ModeGuide[] = [
  PASSAGE_MODE_GUIDE,
  {
    id: "terrain",
    label: "지형",
  },
  {
    id: "ai",
    label: "AI 메타",
  },
  {
    id: "group",
    label: "묶음",
  },
] as const;

export function modeHelpText(mode: TilesetEditMode): string {
  const guide = TILESET_EDIT_MODES.find((entry) => entry.id === mode) ?? PASSAGE_MODE_GUIDE;
  return guide.label;
}
