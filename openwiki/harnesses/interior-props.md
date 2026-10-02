# interior-props — 손 도트 실내 기물 (16px)

- 매니페스트: `src/harnesses/interior-props/harness.ts`. 들어오는 길: 에디터 「공방」(왼쪽 막대). CLI·조수 도구 없음.
- 이 서버의 작업자용 파이썬 하네스는 같은 폴더의 `harness.py`·`web/`(README.md). 에디터 실행기는 `editor/`.
- 흐름: 후보 5장(방향 A~E) → 깨짐 검사(크기·투명 배경·위 패딩·접지선) → 고치기 ≤2 → 자기 점검 1 → 독립 검수(vision) → 꼭대기 면 판정(가구 윗면 3행 미만 = FRONT) → 다시 그리기(시도 ≤3) → 사람이 고른다.
- 팔레트: `editor/v5Palette.json`(v5.pal 램프 29개에서 생성) + 그림자 2색 + 지금 그림에만 있는 색(own:N).
- 기준 그림: 이 프로젝트에서 고른 같은 분류 후보 → 닮은 기물(refs) → 같은 분류 원본(`editor/viewFail.json` 의 3/4 위반 원본·벽면 걸이·바닥 무늬 제외).
- 예시: `public/assets/harnesses/interior-props/examples/`(good-*·bad-*, 원본은 `examples/`).
- 저장: 이 기기 IndexedDB `oprn-workshop`. 칩셋에 굽기는 2단계(`docs/superpowers/specs/2026-10-02-workshop-editor-design.md`).
- 데이터 다시 만들기: `docs/superpowers/plans/2026-10-02-workshop-editor.md` Task 5 Step 1.
