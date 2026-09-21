# 강변 성채의 공용 구역

공용 장소 `강변 성채`의 확정본에서 다음 구역을 분리했다. 프로젝트 전용 library가 아니라 `CASTLE_PLACE_REFERENCES`에 등록하여 빈 프로젝트에서도 표시된다.

| 장소 | 원본 좌표 x,y,w,h | 공용 id / 맵 id | Supabase 독립 저장본 |
|---|---|---|---|
| 고목·분수 뒤뜰 | 28,28,64,36 | castle-courtyard | oprn-place-castle-courtyard-v1 |
| 나룻배 두 척과 작은 선착장 | 90,42,36,22 | castle-small-harbor | oprn-place-castle-small-harbor-v1 |
| 석조 관리소와 진입길 | 26,124,46,20 | castle-stone-lodge | oprn-place-castle-stone-lodge-v1 |

원본 `oprn-place-river-fortress-v1`의 셀을 그대로 잘라낸 장소이며 원본은 수정하지 않았다. 주변 배·수목이 잘리지 않도록 구역 여백을 포함했다. 관리소는 사용자가 선택한 개선1의 석조 건물이다. GPL 큰 돌다리는 추가하지 않았다.

- 다운로드: `public/assets/region-references/<id>.oprn.json`. 칩셋 이미지와 통행 메타데이터 포함.
- NPC는 구역 안의 이벤트만 남기고 좌표를 이동했다. 관리소 안내는 독립 구역에 맞게 수정했다.
- 구역 밖 이동, 실내 및 승선 기능은 없다. 현재 맵에 바로 붙이는 오브젝트 템플릿이 아닌 기존 공용 장소의 열람·다운로드 방식이다.
- `publication-proof.json`: 세 독립 저장본 저장 후 재로드 동등성 및 원본 미변경.
- `catalog-proof.json`, `*-catalog.png`: 빈 프로젝트에서 세 카드, 미리보기, 다운로드의 원본 동등성 확인.
- `scripts/capture-castle-scenes-runtime.mjs`: player.html 전용 하네스로 세 장소 시작 위치·플레이어 스프라이트 및 뒤뜰/나루 NPC 대화 확인. 결과는 `output/castle-scenes/runtime/`.
- 원본 디자인 학습과 한계는 상위 디렉토리의 비교 자료를 함께 읽는다. 전체 성채의 개선 과제를 이 등록만으로 해결했다고 간주하지 않는다.
