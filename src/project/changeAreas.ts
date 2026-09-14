// project/changeAreas.ts — ChangeSummary 의 명시 카운터가 **세지 않는** 영역을 사람 말로 남긴다.
//
// 왜 필요한가 (실측 2026-09-14): 요약 카운터(`summarizeChanges` + `CHIP_RULES`)는 손으로 관리하는
// 목록이라 Project 에 필드가 늘 때마다 뒤처진다. 퀘스트·스토리 플래그·캐릭터·맵 연결·공통 이벤트가
// 그렇게 요약에서 사라졌고, 그 결과 조수는 검토 카드에 아무 정보도 없이 적용/버리기만 물었고
// 영수증에는 같은 지도 그림 두 장을 「지금 / 적용 후」라고 붙였다.
//
// 이 모듈은 **명시 카운터가 없는 필드가 바뀌었는지만** 본다 — 열거가 아니라 여집합이다. 그래서
// Project 에 필드가 새로 생겨도 그 변경은 화면에서 사라지지 않는다(라벨이 없으면 키 이름이 나온다).
import type { Project } from "./types";

/**
 * 명시 카운터가 이미 세는 필드. 여기 있는 키의 변경은 `summarizeChanges` 의 숫자(또는 불리언)가
 * 보고하므로 이 모듈은 입을 다문다. 새 Project 필드를 요약에 직접 넣지 않는다면 여기 넣지 마라 —
 * 넣는 순간 그 필드의 변경은 어느 쪽에서도 보고되지 않는다.
 *
 * `world` 는 엔티티만 세어지므로 예외다 — 엔티티 **밖** 변경은 `changedAreaLabels` 가 따로 본다.
 */
export const COUNTED_PROJECT_FIELDS: Readonly<Record<string, true>> = {
  version: true, // 저장 형식 표식 — 저작 변경이 아니다(마이그레이션이 올린다).
  maps: true, // tilesChanged / events* / mapPropertiesChanged
  mapTree: true, // mapPropertiesChanged
  database: true, // dbRecordsChanged
  spatialAuthoring: true, // dbRecordsChanged
  tilesets: true, // tilesetsChanged (palettePresets* 는 타일셋 안에 산다)
  switches: true,
  variables: true,
  endings: true,
  audioDescriptions: true,
  monsterMetadata: true,
  session: true, // sessionChanged
  system: true, // systemChanged
  world: true, // worldEntities*
};

/** 카운터가 없는 필드의 사람 말. 여기 없는 키는 키 이름 그대로 나온다(변경이 사라지진 않는다). */
export const AREA_LABELS: Readonly<Record<string, string>> = {
  growth: "성장 그래프",
  meta: "프로젝트 정보",
  assets: "에셋",
  resourceProfiles: "자원",
  commonEvents: "공통 이벤트",
  mapConnections: "맵 연결",
  villageInfoDocuments: "마을 문서",
  villageTemplates: "집 형태",
  villagePresets: "마을 배치 프리셋",
  defaultVillagePresetId: "기본 설계서",
  aiDocuments: "AI 문서",
  aiInstructions: "AI 지시문",
  worldCanon: "세계 정본",
  worldGraph: "세계 그래프",
  factions: "세력",
  quests: "퀘스트",
  testPresets: "테스트 프리셋",
  storyFlags: "스토리 플래그",
  characters: "캐릭터",
  charsetLabels: "칩셋 이름",
  startMapId: "시작 맵",
  startPos: "시작 위치",
  flags: "플래그",
};

/** 세계관 카운터는 엔티티만 센다 — 엔티티 밖(관계)이 바뀌면 이름을 남긴다. */
function worldRelationsJson(world: Project["world"]): string {
  const { entities: _entities, ...others } = world ?? {};
  return JSON.stringify(others ?? null);
}

/**
 * 명시 카운터가 세지 않은 영역의 변경 라벨. 순서는 **라벨 표 순서**로 고정한다 —
 * 사용자가 매번 같은 자리에서 같은 낱말을 읽게.
 */
export function changedAreaLabels(before: Project, after: Project): string[] {
  const labels: string[] = [];
  const beforeFields = before as unknown as Record<string, unknown>;
  const afterFields = after as unknown as Record<string, unknown>;
  for (const [key, label] of Object.entries(AREA_LABELS)) {
    if (COUNTED_PROJECT_FIELDS[key] === true) continue;
    const prev = beforeFields[key];
    const next = afterFields[key];
    if (prev === next || JSON.stringify(prev ?? null) === JSON.stringify(next ?? null)) continue;
    labels.push(label);
  }
  if (worldRelationsJson(before.world) !== worldRelationsJson(after.world)) labels.push("세계관 관계");
  return labels;
}
