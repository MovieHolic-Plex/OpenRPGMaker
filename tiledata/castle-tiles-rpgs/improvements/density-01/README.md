# 밀도 개선 01 — 비교 증거를 적용한 첫 수정

이전 `audit/` 판정과 이미지는 그대로 보존했다. 이번 결과도 참고와 동등하다는 판정은 아니다.

## 바꾼 것

- 앞마당의 황색 흙 텍스처를 Castle2 석재 무늬로 교체. 원본 `(200,4,16,16)`를 재배열한 **대체 포장**이며 참고의 정확한 바닥 소재를 찾았다고 주장하지 않는다. 바깥길은 흙 재료를 유지해 구별했다.
- 고목 녹지 섬에 기존 포장 테두리를 네 방향으로 둘렀다.
- 노점 뒤 재고 상자, 분수 주변 작은 화분, 앞마당 벤치 주변 식재와 화물 구역을 추가했다.
- 크기가 다른 수관을 연결하도록 중간 크기 녹색 나무와 관목 군집을 추가. 강변 나무 뿌리는 물 칸을 피해 육지로 이동한다.
- 새로운 소재의 원본·사각형·SHA는 `source-parts.json`. Hyptosis batch4/5 및 Castle2를 사용했고 참고 스크린샷에서 추출하지 않았다.

## 수치의 범위

같은 명목 앞마당 `(28,98,58,16)`에서 비건축 소품은 6→23개.
배치 사각형 합은 60→136칸. 투명 픽셀 포함, 실제 시각 점유율이 아니다.
전체 262개 배치 수는 품질 점수가 아니며 참고의 밀도와 수치 비교하지 않는다.
`measurements.json`에 소품별 좌표를 남겼다.

## 아직 미달

- 앞마당 대체 포장은 원본 참고보다 반복 줄무늬가 강하다. 정확한 원본 작은 돌 포장 확인이 계속 필요하다.
- 잔디 색과 물가 전이, 바깥길의 각진 경계는 그대로 남는다.
- 중간 수관을 보강했지만 같은 녹색 나무의 반복과 기존 나무와의 색 차이가 보인다.
- 외부 관리소/담장/휴식 장면은 아직 참고 수준이 아니다. 비교 증거 `approach.png`를 다음 수정의 기준으로 삼는다.
- 중앙 녹지 테두리는 생겼지만 참고의 더 자연스러운 식재 형태와 흙 전이는 덜 구현됐다.

## 재현과 저장

저장소 루트에서 `npx vite-node --script scripts/improve-castle-density.mts <프로젝트 export JSON>`으로 생성한다.
입력에는 기존 `castle-study` 및 현재 성채 프로젝트 구조가 있어야 하며 작성 맵 id는 `grand-river-fortress`다.
출력은 `output/castle-density-improvement/`. 빌더 자체는 DB를 수정하지 않는다.

SQLite project id `b4706a77-9a38-4dcc-a89d-36244da53967`, revision10.
원격 project id `castle-fortress-city-20260921`. 양쪽 저장 후 재로드 동등성은 `persistence-proof.json`.
실제 에디터 URL: `http://mdc-server:9888/?hostProject=castle-fortress-city-20260921&map=grand-river-fortress`.

학습/기본 칩셋 작업은 PR #1055, merge `977ef5467c46188f4dbafa27e49d64be1f149591`로 main에 반영됨.

## 확인 결과

- 실제 호스팅 에디터 1x 화면: `editor.png`, pageerror0 (`editor-proof.json`).
- 전용 player.html 이동·대화19단계, 실패0/런타임 오류0. `runtime-summary.md`, `runtime-result.json`.
- 작은 `castle-study` 맵과 타일셋 보존을 빌더에서 동등성 확인.
- 일반 gates/vitest/typecheck는 실행하지 않았다.
