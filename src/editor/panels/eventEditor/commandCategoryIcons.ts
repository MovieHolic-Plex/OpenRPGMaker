// [P0] 커맨드 카테고리 시각 언어 공용 모듈.
// - 커맨드 피커: 그룹 헤딩/버튼/탭의 카테고리 아이콘 + 색
// - 커맨드 리스트: 행 좌측 색 레일(data-command-category) + kind 아이콘
// 아이콘은 16px 이하 스캔 보조. 식별은 항상 텍스트가 한다.
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import {
  M2_PICKER_APPEARANCE_GROUP,
  M2_PICKER_BATTLE_GROUP,
  M2_PICKER_GROWTH_GROUP,
  M2_PICKER_PARTY_GROUP,
  M2_QUICK_AUTHORING_SURFACE_GROUPS,
  type M2CommandPickerGroup,
} from "@/project/eventCommands/m2PickerLayout";
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
  readonly label: string;
};

const GROUP_VISUALS: Record<string, CategoryVisual> = {
  // 탭 1 저작면: 말을 건다 / 답을 받는다 / 장소를 옮긴다 / 물건을 판다 / 흐름을 잡는다.
  "말하기": { key: "dialogue", glyph: "❝", label: "대화" },
  "고르기": { key: "dialogue", glyph: "▽", label: "대화" },
  "옮기기": { key: "map", glyph: "➤", label: "지도" },
  "거래": { key: "reward", glyph: "¤", label: "보상" },
  "흐름": { key: "flow", glyph: "◇", label: "흐름" },
  // 탭 3·4 카탈로그 분류명은 그대로 남는다(탭 3 수리는 별 계획).
  "대화/입력": { key: "dialogue", glyph: "❝", label: "대화" },
  "조건/흐름": { key: "flow", glyph: "◇", label: "흐름" },
  "맵/이동": { key: "map", glyph: "➤", label: "지도" },
  "보상/상점": { key: "reward", glyph: "¤", label: "보상" },
  "소리": { key: "sound", glyph: "♪", label: "소리" },
  // 탭 2 저작면: 적을 세운다 / 파티를 바꾼다 / 수치를 움직인다 / 모습을 바꾼다.
  "전투": { key: "battle", glyph: "⚔", label: "전투" },
  "파티": { key: "actor", glyph: "☗", label: "파티" },
  "능력·성장": { key: "actor", glyph: "▲", label: "능력·성장" },
  "모습·이름": { key: "actor", glyph: "☺", label: "모습·이름" },
  "화면/연출": { key: "screen", glyph: "✦", label: "화면 효과" },
  "시스템/고급": { key: "system", glyph: "⚙", label: "시스템" },
  "모던 명령": { key: "modern", glyph: "◈", label: "도구" },
};

const FALLBACK_VISUAL: CategoryVisual = GROUP_VISUALS["시스템/고급"] ?? {
  key: "system",
  glyph: "⚙",
  label: "시스템",
};

const CATEGORY_BY_KIND: ReadonlyMap<string, CategoryVisual> = buildKindIndex();
const CATEGORY_BY_COMMAND_ID: ReadonlyMap<string, CategoryVisual> = buildCommandIdIndex();

function buildKindIndex(): Map<string, CategoryVisual> {
  const index = new Map<string, CategoryVisual>();
  for (const entry of M2_COMMAND_CATALOG) {
    if (!entry.existingKind || index.has(entry.existingKind)) continue;
    index.set(entry.existingKind, groupVisual(entry.pickerGroup));
  }
  // 카탈로그에 없는 내부 kind 들의 보정 매핑.
  index.set("setFlag", groupVisual("흐름"));
  index.set("setSelfSwitch", groupVisual("흐름"));
  index.set("inputWait", groupVisual("말하기"));
  index.set("callMapEvent", groupVisual("옮기기"));
  index.set("changeTile", groupVisual("맵/이동"));
  index.set("setEventGraphicPattern", groupVisual("맵/이동"));
  index.set("addFollower", groupVisual("맵/이동"));
  index.set("removeFollower", groupVisual("맵/이동"));
  index.set("setLighting", groupVisual("화면/연출"));
  index.set("addLight", groupVisual("화면/연출"));
  index.set("removeLight", groupVisual("화면/연출"));
  index.set("setWeather", groupVisual("화면/연출"));
  index.set("showAnimation", groupVisual("화면/연출"));
  index.set("playMovie", groupVisual("화면/연출"));
  index.set("checkpointSave", groupVisual("시스템/고급"));
  index.set("killPlayer", groupVisual("시스템/고급"));
  index.set("triggerEnding", groupVisual("시스템/고급"));
  index.set("ending", groupVisual("시스템/고급"));
  index.set("recoverAll", groupVisual("능력·성장"));
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

/**
 * 피커 그리드 헤딩 텍스트.
 * 저작면 그룹(탭 1·2)은 그룹 이름 자체가 작가의 어휘라 그대로 쓴다. 카탈로그 분류명
 * (`시스템/고급`, `모던 명령`)은 리스트 배지와 같은 짧은 라벨로 줄여 쓴다.
 */
const AUTHORING_SURFACE_HEADINGS: ReadonlySet<string> = new Set([
  ...M2_QUICK_AUTHORING_SURFACE_GROUPS,
  M2_PICKER_BATTLE_GROUP,
  M2_PICKER_PARTY_GROUP,
  M2_PICKER_GROWTH_GROUP,
  M2_PICKER_APPEARANCE_GROUP,
]);

export function groupHeadingText(group: M2CommandPickerGroup): string {
  return AUTHORING_SURFACE_HEADINGS.has(group) ? group : groupVisual(group).label;
}

export function commandCategoryVisual(cmd: Command): CategoryVisual {
  if (cmd.kind === "m2Command") return CATEGORY_BY_COMMAND_ID.get(cmd.commandId) ?? FALLBACK_VISUAL;
  return CATEGORY_BY_KIND.get(cmd.kind) ?? FALLBACK_VISUAL;
}

// 피커 탭(1~4) 대표 아이콘.
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
