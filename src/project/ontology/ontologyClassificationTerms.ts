import type { OntologyCapability } from "./ontologyTypes";

export type WeightedTerm = {
  readonly term: string;
  readonly source: "alias" | "entity" | "keyword" | "surface";
  readonly weight: number;
};

const KEYWORDS_BY_CAPABILITY: Record<string, readonly string[]> = {
  MapEditing: ["맵", "지도", "레이어", "타일 배치", "캔버스", "시작 위치", "맵 트리", "map", "layer", "canvas"],
  EventAuthoring: ["이벤트", "명령", "커맨드", "대사", "조건", "페이지", "상점", "NPC", "event", "command", "shop"],
  TilesetSemantics: ["타일셋", "타일", "지형", "통행", "오토타일", "메타데이터", "분류", "tileset", "terrain", "passability"],
  DatabaseRecords: ["데이터베이스", "레코드", "액터", "아이템", "스킬", "장비", "적", "상태", "MP", "database", "record"],
  BattleRuntime: ["전투", "보상", "경험치", "부대", "턴", "전투 이벤트", "battle", "reward", "troop"],
  ResourcePipeline: ["리소스", "에셋", "이미지", "사운드", "업로드", "선택기", "resource", "asset", "sound"],
  ProjectPersistence: ["저장", "로드", "마이그레이션", "검증", "동기화", "SQLite", "포맷", "save", "migration", "sync"],
};

export function weightedTermsForCapability(capability: OntologyCapability): readonly WeightedTerm[] {
  return [
    ...terms(KEYWORDS_BY_CAPABILITY[capability.id] ?? [], "keyword", 1),
    ...terms(capability.commonTasks.flatMap((task) => [task.label, ...task.taskAliases]), "alias", 0.95),
    ...terms(capability.entities, "entity", 0.75),
    ...terms(surfaceBasenames(capability), "surface", 0.45),
  ];
}

function terms(values: readonly string[], source: WeightedTerm["source"], weight: number): readonly WeightedTerm[] {
  return values.map((term) => ({ term, source, weight }));
}

function surfaceBasenames(capability: OntologyCapability): readonly string[] {
  return [
    ...capability.typeSurfaces,
    ...capability.uiSurfaces,
    ...capability.runtimeSurfaces,
    ...capability.storageSurfaces,
    ...capability.testSurfaces,
  ].map((surface) => surface.split(/[\\/]/).at(-1) ?? surface);
}
