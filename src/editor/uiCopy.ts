// editor/uiCopy.ts
// - 모드별 용어 스타일(jargonStyle)에 따라 UI 문구를 반환하는 단일 테이블.
// - plain: 초보용 일상어(자료집/바닥/장식), technical: 기존 도메인 용어(데이터베이스/하위/상위).

export type UiCopyStyle = "plain" | "technical";

export type UiCopyKey =
  | "database"
  | "databaseShort"
  | "tilesetMissing"
  | "layerLower"
  | "layerUpper"
  | "layerEvent"
  | "onlineSave"
  | "resources"
  | "world";

const UI_COPY: Record<UiCopyKey, Record<UiCopyStyle, string>> = {
  database: { plain: "자료집", technical: "데이터베이스" },
  databaseShort: { plain: "자료", technical: "DB" },
  tilesetMissing: { plain: "그림이 없습니다", technical: "타일셋이 없습니다" },
  layerLower: { plain: "바닥", technical: "하위" },
  layerUpper: { plain: "장식", technical: "상위" },
  layerEvent: { plain: "이벤트", technical: "이벤트" },
  onlineSave: { plain: "온라인 저장", technical: "온라인 저장" },
  resources: { plain: "자료", technical: "리소스" },
  world: { plain: "세계", technical: "월드" },
};

export function uiLabel(key: UiCopyKey, style: UiCopyStyle = "plain"): string {
  return UI_COPY[key][style];
}
