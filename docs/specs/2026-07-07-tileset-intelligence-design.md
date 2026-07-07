# 2026-07-07 타일셋 지능 시스템 설계 — 반입·이해·배치 통합

> 사용자 브레인스토밍 합의 (2026-07-07). 배경: 부품(tileMeta, tileGroups/patternGrammar,
> autotileGroups, tilesetAi* 셋업 파이프라인, 클러스터, 자연산포)은 있으나 일관된 수명주기가 없다.
> 반입은 수동, AI 타일 어휘는 단조롭고, "잘 깔렸는가"의 실측 기준이 없다.

## 합의된 축 (사용자 확정)
1. **범위**: 전부 — 반입→이해→배치 통합 재설계 (웨이브 분할)
2. **반입**: 비전 AI 전자동 + 사용자 승인 (세계관/클러스터와 같은 'AI 자동 + 승인' 패턴)
3. **배치 품질**: 팔레트 프리셋 + 타일 사전 검색 강화 + 측정 가능 eval 게이트 (비전 자기검증 루프는 채택 안 함 — 턴 비용)
4. **우선순위**: 이해(T1) 먼저 → 배치(T2) → 반입(T3) → 오토타일(T4)
5. **오인식 수정**: 비전이 잘못 인식한 경우의 사람 수정 경로를 1급 설계 대상으로 (사용자 강조)

## 1. 데이터 모델

### 1.1 PalettePreset (TilesetDef에 추가)
```ts
// src/project/types/base.ts TilesetDef에:
palettePresets?: PalettePreset[];

export type PaletteSlotRole =
  "ground" | "path" | "wall" | "water" | "decor" | "boundary" | "roof" | "furniture";

export interface PaletteSlot {
  role: PaletteSlotRole;
  tileIds: number[];          // 이 역할로 쓸 타일 (변형/군집 포함)
  weight?: number;            // 산포 선택 가중치 (자연산포와 합성, 기본 1)
}

export interface PalettePreset {
  id: string;                 // "pp_" prefix, genId("pp")
  name: string;               // "숲속 마을", "동굴", "실내"
  slots: PaletteSlot[];
  origin: "user" | "ai";
  locked?: boolean;           // 사용자 잠금 — AI 재감사/재생성이 덮어쓰기 금지
}
```
배치 툴의 기본 어휘는 개별 타일 id가 아니라 **"프리셋 X의 role"** 이다.

### 1.2 tileMeta 신뢰도·출처 확장 (TileAiMetadata에 추가)
```ts
confidence?: number;   // 0~1. 비전 분류 신뢰도. 사람이 확정하면 1
origin?: "user" | "ai";// 기본 "ai". 사람 수정 시 "user"
locked?: boolean;      // true면 AI 재감사가 덮어쓰기 금지 (거부 사유 반환)
```
기존 shape guard가 미지 필드를 보존/정규화하는 방식을 따르고, 부재 시 기본값으로 무손상 마이그레이션.

## 2. 오인식 수정 — 사람의 교정 경로 (1급 설계)

비전이 틀리는 것은 전제다. 설계 원칙: **틀린 것을 찾기 쉽게, 고치기 빠르게, 고친 것은 다시 안 틀리게.**

### 2.1 찾기 쉽게 — 검토 위저드
- 재감사/반입 결과는 일반 프로포절 카드가 아니라 **전용 검토 위저드**로 제시:
  타일셋 그리드 전체에 분류 오버레이(통행=색상, role=아이콘, 그룹=테두리).
- **신뢰도 오름차순 검토 큐**: confidence 낮은 타일부터 카드로 보여주고
  [맞음 / 고치기 / 건너뛰기] 3버튼. '맞음'은 confidence=1로 승격.
- 전체 일괄 승인도 가능하되, confidence < 0.5 타일 수를 승인 버튼에 명시
  ("낮은 신뢰 12칸 포함 승인").

### 2.2 고치기 빠르게 — 인라인 교정
- 팔레트/검토 그리드에서 타일 우클릭 → "타일 정보 수정" (기존 `tilesetTileContext` 확장):
  의미 라벨, role, 통행, 그룹 소속을 한 팝오버에서 수정. 수정 즉시 `origin:"user"`,
  `confidence:1`, `locked:true` 자동 마킹.
- 배치 결과에서의 사후 신고: 캔버스에서 셀 우클릭 → "이 타일 잘못 쓰임" → 해당 타일의
  교정 팝오버로 직행 (오인식 발견은 대개 배치 결과에서 일어난다).

### 2.3 다시 안 틀리게 — 잠금 규약
- `locked:true` tileMeta/프리셋은 AI 재감사·재생성 upsert에서 **거부 + 사유 반환**
  (세계관 locked와 동일 규약, 같은 문구 톤).
- 재감사 프로포절 diff에는 "잠긴 항목 N개 보존됨"을 표기.
- 사람 교정 이력은 tileMeta에 남으므로(origin/confidence) 이후 프리셋 자동 생성이
  사용자 확정 데이터를 우선 신뢰한다.

## 3. eval 게이트 3종 (run_lint 3단계 문법 합류 + evals 수치 기준선)
| 지표 | 판정 | 심각도 |
|---|---|---|
| 타일 다양성 | 맵에서 쓰인 고유 타일 수, 활성 프리셋 slot 커버리지 비율(사용 slot/전체 slot) | info (수치 보고) |
| 경계 어색도 | 인접 셀 이질 카테고리 쌍(tileMeta 카테고리/role 기반, 예: 물↔실내바닥 직접 인접) | warning |
| 통행 일관성 | path role인데 통행 불가, wall role인데 통행 가능인 셀 | warning |

## 4. AX — 에이전트 경로
- contextBuilder에 **타일 어휘 다이제스트**: 활성 타일셋의 프리셋 목록(이름+slot role별 대표 타일 수) + 저신뢰 경고 요약. 토큰 상한제(세계관 다이제스트와 같은 프레임).
- `query_tiles` 강화(기존 rangeClassify/visionQuery 계열에 편승): role/카테고리/프리셋 필터로 타일 상세 조회.
- 배치 툴(paint_road/scatter_object/build_house/stamp_structure/generate_map)에
  `presetId?`/`paletteRole?` 파라미터 — slot의 tileIds+weight로 자연산포와 합성.
- 프리셋 자동 생성: `upsert_palette_preset` 툴(프로포절 경유, locked 거부).
- 세계관 guideline이 프로젝트 기본 프리셋 지정 가능("이 마을은 '숲속 마을'").

## 5. 웨이브
| 웨이브 | 범위 |
|---|---|
| **T1a 기반** | §1 데이터 모델+shape 배선, §3 eval 3종(lint 합류+단위 테스트), §4 다이제스트+query_tiles+프리셋 툴, 배치 툴 preset 파라미터 (UI 없음 — 전부 유닛 테스트 가능) |
| **T1b 이해 UI** | §2 검토 위저드+인라인 교정+잠금 규약, 재감사 파이프라인(기존 tilesetAi* 재사용, vision client는 mock 주입 가능 구조), 프리셋 편집기 |
| **T2 배치 실측** | 에이전트 도그푸딩 재평가 — eval 3종 before/after (감독자 실행) |
| **T3 반입** | 이미지 드롭→슬라이스→비전 전자동(의미/통행/그룹/오토타일 후보/프리셋 초안)→§2 위저드 재사용. RM2003 규격 감지 시 좌표 규약 결정론 프리패스 |
| **T4 오토타일** | variantMap 커버리지 자동 생성+경계 셰이핑 개선+어색도 회귀 |

## 진행 기록
- 2026-07-07: 설계 합의·문서화 (오인식 수정 UX를 1급 설계로 — 사용자 강조 반영). T1a 착수.
- 2026-07-07: **T1a 완료·머지** (codex xhigh, 신규 테스트 28, 2050 passed). 모델/왕복,
  lint 3종 run_lint 합류, query_tiles/upsert_palette_preset/다이제스트, 배치 4툴 preset 파라미터.
  카테고리 비호환 행렬: water↔furniture·roof·wall, path↔furniture·roof. 다음: T1b (교정 UI).
- 2026-07-07: **T1b 완료·머지 — T1 이해 웨이브 완결** (codex xhigh, 신규 27, 2168 passed).
  검토 위저드/인라인 교정/캔버스 신고/locked 보존(tileMetaLocked로 기존 userLocked 통합)/
  mock 주입형 재감사(TilesetVisionClient)/프리셋 편집기. T3는 TilesetReviewCandidate[] →
  openTilesetReviewWizard로 같은 검토 UX 재사용. 다음: T2 배치 실측(감독자 도그푸딩).
