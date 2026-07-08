// [P0] 커맨드 카테고리 시각 언어 공용 모듈.
// - 커맨드 피커: 그룹 헤딩/버튼/탭의 카테고리 아이콘 + 색
// - 커맨드 리스트: 행 좌측 색 레일(data-command-category) + kind 아이콘
// RM2003 텍스트 스크립트가 정본이므로 아이콘은 16px 이하의 부가 장식으로만 쓴다.
import { M2_COMMAND_CATALOG } from "@/editor/eventCommands/m2Catalog";
import type { M2CommandPickerGroup } from "@/editor/eventCommands/m2PickerLayout";
import type { Command } from "@/project/types";

export type CommandCategoryKey =
  | "dialogue"
  | "flow"
  | "map"
  | "reward"
  | "sound"
  | "actor"
  | "screen"
  | "system"
  | "battle"
  | "modern";

type CategoryVisual = {
  readonly key: CommandCategoryKey;
  readonly glyph: string;
};

const GROUP_VISUALS: Record<string, CategoryVisual> = {
  "대화/입력": { key: "dialogue", glyph: "❝" },
  "조건/흐름": { key: "flow", glyph: "◇" },
  "맵/이동": { key: "map", glyph: "➤" },
  "보상/상점": { key: "reward", glyph: "¤" },
  "소리": { key: "sound", glyph: "♪" },
  "배우/전투": { key: "actor", glyph: "☗" },
  "화면/연출": { key: "screen", glyph: "✦" },
  "시스템/고급": { key: "system", glyph: "⚙" },
  "전투 전용": { key: "battle", glyph: "⚔" },
  "모던 명령": { key: "modern", glyph: "◈" },
};

const FALLBACK_VISUAL: CategoryVisual = GROUP_VISUALS["시스템/고급"] ?? { key: "system", glyph: "⚙" };

const CATEGORY_BY_KIND: ReadonlyMap<string, CategoryVisual> = buildKindIndex();
const CATEGORY_BY_COMMAND_ID: ReadonlyMap<string, CategoryVisual> = buildCommandIdIndex();

function buildKindIndex(): Map<string, CategoryVisual> {
  const index = new Map<string, CategoryVisual>();
  for (const entry of M2_COMMAND_CATALOG) {
    if (!entry.existingKind || index.has(entry.existingKind)) continue;
    index.set(entry.existingKind, groupVisual(entry.pickerGroup));
  }
  // 카탈로그에 없는 내부 kind 들의 보정 매핑.
  index.set("setFlag", groupVisual("조건/흐름"));
  index.set("setSelfSwitch", groupVisual("조건/흐름"));
  index.set("inputWait", groupVisual("대화/입력"));
  index.set("callMapEvent", groupVisual("맵/이동"));
  index.set("changeTile", groupVisual("맵/이동"));
  index.set("setEventGraphicPattern", groupVisual("맵/이동"));
  index.set("addFollower", groupVisual("맵/이동"));
  index.set("removeFollower", groupVisual("맵/이동"));
  index.set("setLighting", groupVisual("화면/연출"));
  index.set("addLight", groupVisual("화면/연출"));
  index.set("removeLight", groupVisual("화면/연출"));
  index.set("checkpointSave", groupVisual("시스템/고급"));
  index.set("killPlayer", groupVisual("시스템/고급"));
  index.set("triggerEnding", groupVisual("시스템/고급"));
  index.set("ending", groupVisual("시스템/고급"));
  index.set("recoverAll", groupVisual("배우/전투"));
  return index;
}

function buildCommandIdIndex(): Map<string, CategoryVisual> {
  const index = new Map<string, CategoryVisual>();
  for (const entry of M2_COMMAND_CATALOG) {
    index.set(entry.id, groupVisual(entry.pickerGroup));
  }
  return index;
}

export function groupVisual(group: M2CommandPickerGroup): CategoryVisual {
  return GROUP_VISUALS[group] ?? FALLBACK_VISUAL;
}

export function commandCategoryVisual(cmd: Command): CategoryVisual {
  if (cmd.kind === "m2Command") return CATEGORY_BY_COMMAND_ID.get(cmd.commandId) ?? FALLBACK_VISUAL;
  return CATEGORY_BY_KIND.get(cmd.kind) ?? FALLBACK_VISUAL;
}

// 피커 탭(1~4) 대표 아이콘 — RM2003 탭 구성(빠른 저작 / 배우·전투 / 맵·연출 / 시스템·고급) 기준.
export function pickerPageGlyph(page: 1 | 2 | 3 | 4): string {
  switch (page) {
    case 1:
      return "❝";
    case 2:
      return "☗";
    case 3:
      return "✦";
    case 4:
      return "⚙";
  }
}
