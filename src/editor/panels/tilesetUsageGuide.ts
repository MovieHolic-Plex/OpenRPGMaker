export type TilesetEditMode = "ai" | "autotile" | "group" | "passage" | "terrain";

// 참고문서를 먼저 보여 주고, 편집 규칙과 그래픽 설정을 분리한다.
// rules: 지도 만들 때 쓰는 규칙(통행·지형·레이어). knowledge: AI 지식(단어장). compose: 구성(오토타일). references: 용도별 MD·이미지.
// rooms: 방 짓기 역할표(바닥·벽면·천장 → 조수가 방을 짓는다).
export type TilesetSectionTab = "compose" | "knowledge" | "rules" | "references" | "rooms" | "settings";

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
    label: "설명",
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
  { id: "rules", label: "통행·레이어" },
  { id: "compose", label: "자동 연결" },
  { id: "knowledge", label: "타일 정보" },
  { id: "references", label: "AI 참고문서" },
  { id: "rooms", label: "방 짓기" },
  { id: "settings", label: "설정" },
] as const;

export const TILESET_TAB_MODES: Record<TilesetSectionTab, readonly TilesetEditMode[]> = {
  rules: ["passage", "terrain"],
  knowledge: ["ai", "group"],
  compose: ["autotile"],
  references: [],
  rooms: [],
  settings: [],
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
