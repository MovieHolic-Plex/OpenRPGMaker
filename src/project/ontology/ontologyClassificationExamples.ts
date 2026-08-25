import type { OntologyClassificationExample } from "./ontologyTypes";

export const ONTOLOGY_CLASSIFICATION_EXAMPLES = [
  { task: "이벤트 명령 추가", expectedCapabilityId: "EventAuthoring" },
  { task: "NPC 대사 조건 이벤트 수정", expectedCapabilityId: "EventAuthoring" },
  { task: "타일셋 지면 종류 자동 분류", expectedCapabilityId: "TilesetSemantics" },
  { task: "오토타일 통행 설정 개선", expectedCapabilityId: "TilesetSemantics" },
  { task: "전투 보상 경험치 처리", expectedCapabilityId: "BattleRuntime" },
  { task: "부대 전투 이벤트 실행", expectedCapabilityId: "BattleRuntime" },
  { task: "아이템 데이터베이스 필드 추가", expectedCapabilityId: "DatabaseRecords" },
  { task: "스킬 레코드 MP 비용 수정", expectedCapabilityId: "DatabaseRecords" },
  { task: "리소스 매니저 이미지 업로드", expectedCapabilityId: "ResourcePipeline" },
  { task: "사운드 리소스 선택기 추가", expectedCapabilityId: "ResourcePipeline" },
  { task: "맵 레이어 타일 배치 도구", expectedCapabilityId: "MapEditing" },
  { task: "맵 트리 시작 위치 이동", expectedCapabilityId: "MapEditing" },
  { task: "저장 로드 마이그레이션 검증", expectedCapabilityId: "ProjectPersistence" },
  { task: "Supabase 동기화 저장 포맷", expectedCapabilityId: "ProjectPersistence" },
] satisfies readonly OntologyClassificationExample[];
