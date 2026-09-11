// project/types/village.ts
// 마을 저작 레코드 — 사용자가 데이터베이스 「마을」탭에서 만드는 값.
//
// 계약:
//  · 프로젝트에 들어 있는 레코드는 **전부 사용자 저작**이다. 내장 형태 34종은 코드 카탈로그
//    (project/defaults/houseTemplateCatalog.ts)가 정본이고 프로젝트에는 복사되지 않는다.
//    그래서 source 축이 없다 — "프로젝트에 있으면 사용자 것"이 판정 기준이다.
//    (구조물 탭이 겪은 "내장을 내보냈다 가져오면 영구 잠긴 유령" 함정을 이 방식으로 피한다.)
//  · 어떤 자동 경로도 이 레코드를 만들지 않는다. AI는 값을 **읽기만** 한다.
//  · 타일 번호·킷 id 같은 열거형은 문자열로 저장하고 읽는 쪽에서 좁힌다 — 저장된 데이터는
//    신뢰하지 않는다는 io 계약을 따른다(types 레이어는 editor 레이어를 import하지 않는다).

/** 원점(0,0) 기준 날개 사각형. 시공 좌표는 전개 함수가 평행이동으로 만든다. */
export interface VillageTemplateWing {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * 이 날개만의 층수 — 계단식 2층(위층이 드러나는 집). 생략하면 레코드 전체 `stories`.
   * 시공기 `storiesAt()` 과 저작 검증 `shapeReason()` 이 같은 규칙으로 읽는다.
   */
  stories?: 1 | 2 | 3;
}

/** 사용자가 만든 집 형태 한 종. */
export interface VillageHouseTemplateRecord {
  id: string;
  name: string;
  /** 바운딩 박스 폭(칸). 후보 슬롯 폭 필터를 통과해야 배치된다 — 8 이하 권장. */
  w: number;
  /** 바운딩 박스 높이(칸). */
  h: number;
  /** 층수. 기본 1. */
  stories?: 1 | 2 | 3;
  /** 낮은 벽(상단+하단 2행) — 헛간·창고·오두막. */
  lowWall?: boolean;
  /** 재료 킷 강제. 미지정이면 마을 킷 믹스가 고른다. */
  kitId?: string;
  /** 옥상 판자 데크 + 벽면 사다리(파랑 평지붕 전용). */
  roofDeck?: boolean;
  /** 원점 기준 날개. 선언 순서가 문 판정에 영향을 준다. */
  wings: VillageTemplateWing[];
  /** 어느 내장 형태를 복제했나 — 계보 표시용. 편집 가능 판정에는 쓰지 않는다. */
  clonedFrom?: string;
  /** AI 컨텍스트에 실리는 한 줄 설명. */
  note?: string;
}

/** 마을 배치 프리셋 — 예전엔 씨앗값으로 몰래 정해졌던 값들의 이름 붙은 묶음. */
export interface VillageLayoutPresetRecord {
  id: string;
  name: string;
  /** 기본 집 수(1~32). AI가 문장에서 집 수를 말하지 않았을 때 참고한다. */
  houseCount?: number;
  /** 길 재질 — sand | dirt | stone. */
  pathStyle?: string;
  /** 길 폭(2~3칸). */
  roadWidth?: number;
  /** 길 굽이 정도(0.35~1). 높을수록 구불구불하다. */
  roadNaturalness?: number;
  /** 마을 배치 — plaza-ring | street-grid | clusters. */
  settlementLayout?: string;
  /** 재료 믹스 — mixed 또는 킷 id 하나. */
  kitMix?: string;
  /** 마당 꾸밈 — mixed | garden | workshop | market | minimal. */
  yardStyle?: string;
  /** 광장 성격 — market | garden | empty. */
  plazaStyle?: string;
  /** 광장 위치 — center | north | south | west | east. */
  plazaLayout?: string;
  /** 바깥 나무 — conifer | dense | none. */
  edgeTrees?: string;
  /** 지면 프리셋 — grass | snow. */
  groundTheme?: string;
  /** NPC 수(0~512). */
  npcCount?: number;
  /** 이 프리셋이 쓸 집 형태 id 화이트리스트. 비었으면 카탈로그 전체를 쓴다. */
  templateIds?: string[];
  /** AI 컨텍스트에 실리는 한 줄 설명 — "언제 이 프리셋을 쓰라"를 사람 말로 적는다. */
  note?: string;
  /** 명시적으로 전환한 설계서. 생략한 기존 프리셋은 이전 우선순위를 유지한다. */
  design?: VillageDesign;
}

export type VillageDesignPolicy = "fixed" | "free";
export interface VillageDesign {
  version: 1;
  revision: number;
  policies: Record<"appearance" | "layout" | "nature" | "residents" | "interior", VillageDesignPolicy>;
  houseCount: { mode: "fixed" | "range" | "free"; min: number; max: number };
  stories: (1 | 2 | 3)[];
  interior: boolean;
  nature: {
    water: "none" | "river" | "lake" | "river-lake";
    waterSide: "north" | "south" | "east" | "west";
    forest: "none" | "sparse" | "normal" | "dense" | "impassable";
    forestSide: "north" | "south" | "east" | "west";
    riverWidthRatio: number;
    lakeSizeRatio: number;
    forestDepthRatio: number;
  };
}
