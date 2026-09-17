# 계단 2종 버그 수정 증거 (SUMMARY)

## 수정 1 — 가로 3칸 계단 전이 누락
- 파일: `src/editor/interiorConceptEvents.ts` (`buildConceptEvents`)
- 원인: placement당 앵커 1곳에만 이벤트 1개 생성 → 3칸 계단도 전이 1개.
- 수정: behavior=transfer + 하단 행 셀 2개 이상이면 하단 행 전 셀에 각각 전이 이벤트 생성.
  다른 behavior(가구 조사·숙박·노획)는 단일 앵커 유지. 미연결 경고는 placement당 1회로 중복 제거.
- 회귀 테스트: `test/stairTransferDepth.test.ts` — 3칸 전이 좌표·transfer 커맨드 전수 확인.
- 픽스처 실측: `scripts/qa/runtime/stair-qa-fixture.mts` → `3-wide transfers=3`.

## 수정 2 — 1칸 계단 칩 부상
- 파일: `src/player/characterDepth.ts` (`mapUpperTileDepth`, `isAlwaysAboveCharacterUpperTile`)
- 원인: 1칸 계단(444/445/474/475)이 upper+통행 가능 → ★ 판정 → depth 250,000 고정으로
  same 캐릭터(200,000) 위에 항상 렌더.
- 수정: tileMeta tags에 stair/계단/사다리 포함 ★ 타일은 밟는 면(○)으로 취급해 캐릭터 아래 렌더.
  칩셋 독립적(타일 ID 하드코딩 없음). 1칸 계단 "stairs"뿐 아니라 3칸 돌계단 "stone stairs"/"돌계단"까지 커버. 수관 등 다른 ★는 기존 동작 유지.
- 회귀 테스트: `test/stairTransferDepth.test.ts` — 1칸 4종 전부 below/same/above 캐릭터보다 아래 + upper 배치 3칸 돌계단(111/141/171)도 아래.

## 검증
- 신규 4 + 관련 기존(`interiorEventApproach`, `characterDepthYSort`, `conceptFacilityLevels`) 14건 전부 통과.
- `test/placeConceptTool.test.ts` 2건 실패는 기준선(HEAD)에서도 동일 — 본 변경과 무관한 기존 결함(책장 배치).

- 결과: `verify-shots/runtime-qa/stair-qa/SUMMARY.md` — 비트 4개 전부 통과.
- 샷(추적 디렉토리에 보존 — `verify-shots/runtime-qa/`는 gitignored라 원본은 미추적):
  - `R-3wide-front.png` — 3칸 계단(141/111/171)이 게임 화면에 정상 렌더.
  - `R-transfer-arrival.png` — 가운데 칸 조사 → 대사 → 전이 발동 후 1칸 맵 도착.
  - `R-1wide-closeup.png` — 1칸 계단(474) 앞에 선 캐릭터.
  - `R-1wide-stand.png` — 1칸 계단 칸 위에 직접 선 캐릭터. 칩이 캐릭터 얼굴 위로 뜨지 않고 뒤에 그려짐.
  - `A-3wide-transfers.png` / `B-1wide-depth.png`는 실물 타일셋 PNG로 합성한 설명용 도식.
