export type TilesetEditMode = "ai" | "autotile" | "group" | "passage" | "terrain";

// 타일셋 섹션 3탭 — 기능 과다를 성격별로 분리한다(2026-07-05 재편).
// rules: 지도 만들 때 쓰는 규칙(통행·지형·레이어). knowledge: AI 지식(단어장). compose: 구성(오토타일).
export type TilesetSectionTab = "compose" | "knowledge" | "rules";

type ModeGuide = {
  readonly id: TilesetEditMode;
  readonly label: string;
};

type TabGuide = {
  readonly id: TilesetSectionTab;
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
    label: "그룹",
  },
  {
    id: "autotile",
    label: "오토타일",
  },
] as const;

export const TILESET_SECTION_TABS: readonly TabGuide[] = [
  { id: "rules", label: "타일 규칙" },
  { id: "knowledge", label: "타일 지식(단어장)" },
  { id: "compose", label: "구성" },
] as const;

export const TILESET_TAB_MODES: Record<TilesetSectionTab, readonly TilesetEditMode[]> = {
  rules: ["passage", "terrain"],
  knowledge: ["ai", "group"],
  compose: ["autotile"],
};

export function tabForTilesetMode(mode: TilesetEditMode): TilesetSectionTab {
  for (const tab of TILESET_SECTION_TABS) {
    if (TILESET_TAB_MODES[tab.id].includes(mode)) return tab.id;
  }
  return "rules";
}

export function modeHelpText(mode: TilesetEditMode): string {
  const guide = TILESET_EDIT_MODES.find((entry) => entry.id === mode) ?? PASSAGE_MODE_GUIDE;
  return guide.label;
}
