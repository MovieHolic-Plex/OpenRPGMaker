# Castle2 성채 칩셋 — 다음 에이전트의 시작점

사용자 요구: 이 칩셋으로 참고처럼 자연스러운 성을 만들 것. 정사각형 외벽 안에 시설을
나열한 이전 대형 맵은 사용자가 거절했다. 타일 수·NPC 수·통행 성공은 미술적 합격이 아니다.

**현재 수정본도 바닥·밀도 기준 미달이다.** 먼저 [적대적 재검토](ADVERSARIAL_REVIEW.md)와 `audit/` 비교 이미지를 본다.

## 읽을 순서

1. `reference/user-castle.png` 원본과 `reference/rejected-layout.png` 실패작을 나란히 본다.
2. `ART_DIRECTION.md`: 16구역 비교, 전체 구도, 작은 재료 차이, 제작/판정 순서.
3. `ASSEMBLY.md`: 좌표 단위, 완성 부품, 반복, 받침, 높이, 통행 및 렌더 함정.
4. `parts.json`: Castle2 실측 부품. `harbor-parts.json`: 배/부두/수목. `supplement-parts.json`: 수정 때 추가한 고목/작은 나무/지형.
   `regions.json`: 이미지 관찰 범위(타일 좌표 아님).
5. `REVISION.md`: 이번 수정에서 실제 적용한 것, 저장 위치, 확인 결과와 남은 차이.

## 첫 화면에서 기억할 다섯 가지

- 큰 본성이 중하부에서 화면의 무게를 잡고, 뒤뜰과 후문 건물이 그 뒤에 이어진다.
- 오른쪽 강은 남는 여백이 아니다. 넓은 수면·상류 절벽·하류가 주 건물과 균형을 잡는다.
- 나무 중심의 비대칭 뜰, 건물 옆 작은 정원, 외부의 흙길/생활 장면을 구별한다.
- 한 종류의 잔디·나무·포장과 같은 간격의 반복 배치로 자연스러움을 만들 수 없다.
- 큰 면→지형→건축 접합→길→중심 물체→작은 군집 순서로 만든다.

## 자료 사용 경계

`reference/`는 학습/비교 전용이다. public/assets, 업로드 타일셋, 프로젝트 에셋에 넣지 않는다.
특히 사용자 참고에는 제거 요청한 큰 돌다리가 남아 있다. 이미지 분석이 재사용 승인은 아니다.
화면 잘라 붙이기로 “타일 조립”을 증명하지 않는다. 참고 이미지의 실제 통행/층수는 알 수 없다.

원본 Castle2는 `../../public/assets/opengameart-castle-tiles.png`.
저작자/출처는 `CASTLE-CREDITS.txt`, 수변 보조 소재는 `SURROUNDINGS-CREDITS.txt` 참조.
원본이 확인되지 않은 소재는 ART_DIRECTION의 미확인 표에 남긴다.

## 실행 경로

- 학습 비교 뷰어: `node scripts/analyze-castle-reference.mjs` (저장소 루트에서).
- 이전 반려 맵 빌더: `scripts/build-grand-castle.mts` — 성공한 스타일 예제로 재사용하지 말 것.
- 수정 맵 빌더: `scripts/revise-reference-castle.mts`.
- 저장은 SQLite 정본 경로와 저장소의 원격 저장 규칙을 함께 따른다. 환경값은 이 폴더에 기록하지 않는다.
- 일반 테스트/게이트는 이 문서가 실행을 허가하지 않는다. 루트 AGENTS.md를 따른다.

이 폴더가 칩셋 학습 자료의 정본이다. OpenWiki는 여기로 연결한다.
