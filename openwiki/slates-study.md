> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# Slates 시각 도감과 조합 연구실

다음 마을 저작은 [성곽 구조 교정 기록](slates-structure-learning.md) → [AI 조립 매뉴얼](slates-village-authoring.md) 순서로 읽는다.

## 산출물과 근거

- 사람용 단일 파일 도감: `reports/slates-study/index.html` (그림·데이터 포함, 오프라인).
- 저작 원본: `reports/slates-study/report.template.html`, 생성기 `scripts/content/build-slates-study-report.mjs`.
- 시각 분류 원본: `scripts/content/slates-study-catalog.mjs`. 46개 구역, 개별 16칸, 14개 블록.
- 픽셀 알파와 분류/스탬프를 담은 결과: `public/assets/slates/slates-study-catalog.json`.
- 맵/메타 생성: `scripts/content/build-slates-study.mjs`.
- 저장: `scripts/content/save-slates-study.mjs` (읽기 시점 SHA 조건 PATCH, 미러 저장과 재로드 비교).
- 근거: `verify-shots/slates-study/persistence.json`, `local-persistence.json`, `editor-observation.json`, `html-observation.json`.

v2는 56열×22행의 1232개 32px 슬롯이다. 완전 불투명 494칸, 투명/반투명을 포함한
738칸을 픽셀로 측정했다. 1232개 모두에 개별 의미를 확정했다는 뜻은 아니다.
`scope`를 개별 확인/블록 확인/구역 분류로 나누고, 불확실한 혼합 구역에는 중간/낮음
판단을 유지한다. 기존 사용자 잠금 메타는 보존하며, 추가 분류는 `origin: ai`다.
그림의 알파만으로 원래 타일셋의 통행/레이어를 일괄 변경하지 않았다.

## 확인한 조립 규칙

- 잔디 중심 57 / 모래 61 / 흙 65 / 석재 69: 9분할의 모서리와 변을 유지하고 중심 반복.
- 모래섬: (16,4)부터 3×3. 중심 297은 모래, 외부 물은 243. 노란 물결 무늬를 물로 오인하지 않는다.
- 작은 집: 꼭짓점 150·151 → 박공 204·205 → 창 644·647 → 문/벽.
  폭 2칸으로 검토했으며 세로 증가 때 몸통 196·199만 삽입한다. 임의 폭 지붕 확장은 미검증.
- 침엽수 (8,18) 2×3 / 활엽수 (12,18) 2×3: 마지막 줄 밑동과 수관의 충돌을 구분.
- **죽은 나무는 (14,19) 2×2**. 바로 위 1022·1023은 독립 덤불이다.
  같은 열의 3행을 잘라 쓰면 공중에 덤불이 뜬다. 초기 연구실에서 발견해 수정했다.
- 3×3 목재 격자는 빈틈으로 물이 보인다. 보행용 세로 판자 23·79·135와 구분한다.
- 물레방아: (48,10), (48,13), (48,16), (48,19)의 각 2×3이 한 자세다.
  그래픽 분류만 완료했으며 애니메이션 스트립/이벤트는 등록하지 않았다.

## 받침과 AI 메타의 함정

`userTileBackingOverride`는 사용자 확정 또는 잠긴 메타만 받침으로 사용한다.
AI 분류에 `layerBacking`만 써서는 렌더러에 적용되지 않는다. 연구실의 다리에서는
이 조건을 우회하려고 사용자 확정으로 위장하지 않았다. 물 243 + 원본 23·79·135를
합성한 불투명 32px 세 칸을 `slates_study_32`의 1232–1234에 만들었다.

`public/assets/slates/slates-study-32px.png`는 원본 v2 1232칸 + 이 받침 세 칸이며,
연구실 프로젝트에 이미지 데이터를 넣어 업로드 자산으로 저장한다. 도감에서 세 칸의
두 원본 사각형을 추적할 수 있다. 원본 그림을 색상 변경하거나 참조 PNG를 잘라 쓰지 않는다.

## 저장된 연구실

- 프로젝트: `rpg-zzu-slates32-38e6`.
- 맵: `slates_study`, 30×23, 32px. 기존 네 맵은 보존.
- 칩셋: `slates_study_32`, 1235칸. 원본 칩셋과 분리해 실습 통행을 저작.
- 구조 스탬프 7개: 집 2종, 세로 다리, 가로 흉벽, 침엽수, 활엽수, 죽은 나무.
- 연구실은 조립 예시다. 집 진입/맵 간 전이/성벽 출입 계단은 없음.
- 타일 통행 표시가 전체 경로 탐색·이벤트 충돌 검증을 대신하지 않는다.
- 성 예시 왼쪽 그늘에는 초기 재현의 갈색 질감 오차가 남아 있으며 도감에 원본과 비교 표시했다.

## 재현 순서

1. LegacyDb 프로젝트를 읽어 `output/slates-study/source-project.json`과 SHA 포함 `source-row.json` 저장.
2. `node scripts/content/build-slates-study.mjs`.
3. `node scripts/content/save-slates-study.mjs` (다른 SHA이면 중단).
4. `node scripts/qa/capture-slates-study.mjs verify-shots/slates-study/reloaded-project.json`.
5. `node scripts/content/build-slates-study-report.mjs`.
6. 로컬 SQLite에 원격 재로드 문서를 import 후 export 비교.

반복 생성의 입력 스냅샷과 원격 SHA는 별개다. 다른 세션 변경을 덮기 위해 SHA만 갱신하면
안 된다. 기존 내용의 동일성/병합 여부를 확인한 뒤 다음 저장 기준점을 정한다.
전체 gates/vitest/typecheck는 이번 세션에서 실행하지 않았다.
