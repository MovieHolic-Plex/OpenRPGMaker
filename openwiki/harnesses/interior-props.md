# interior-props — 손 도트 실내 기물 (16px)

- 매니페스트: `src/harnesses/interior-props/harness.ts`. 들어오는 길: 에디터 「공방」(왼쪽 막대). CLI·조수 도구 없음.
- 이 서버의 작업자용 파이썬 하네스는 같은 폴더의 `harness.py`·`web/`(README.md). 에디터 실행기는 `editor/`.
- 흐름: 후보 5장(방향 A~E) → 깨짐 검사(크기·투명 배경·위 패딩·접지선) → 고치기 ≤2 → 자기 점검 1 → 독립 검수(vision) → 꼭대기 면 판정(가구 윗면 3행 미만 = FRONT) → 다시 그리기(시도 ≤3) → 사람이 고른다.
- 팔레트: `editor/v5Palette.json`(v5.pal 램프 29개에서 생성) + 그림자 2색 + 지금 그림에만 있는 색(own:N).
- 기준 그림: 이 프로젝트에서 고른 같은 분류 후보 → 닮은 기물(refs) → 같은 분류 원본(`editor/viewFail.json` 의 3/4 위반 원본·벽면 걸이·바닥 무늬 제외).
- 예시: `public/assets/harnesses/interior-props/examples/`(good-*·bad-*, 원본은 `examples/`).
- 저장: 이 기기 IndexedDB `oprn-workshop`. 칩셋에 굽기는 2단계(`docs/superpowers/specs/2026-10-02-workshop-editor-design.md`).
- 데이터 다시 만들기: `docs/superpowers/plans/2026-10-02-workshop-editor.md` Task 5 Step 1.

## 서버 하네스의 파생 (2026-10-04)

`derive.py`·`api.py`·`web/index.html`은 기존 후보를 원본으로 방향·상태·움직임 묶음과 크기 자식을 만든다.
후보는 사람이 고른다. 자세한 사용법은 같은 폴더의 `README.md` 「파생」 절.

움직임 묶음을 고르면 `<원본> ~motion` 자식을 등록하고 첫 프레임 PNG/pxgrid와 전체 `.loop.png`·`.loop.json`을 함께 저장한다.
`picks.sqlite` 선택을 내보내고 다시 읽어 `install_picks.py` → `new_items.register` → `build_tileset.py`로 굽는다.
모션은 4프레임·150ms이며 `animationStrips.fps=1000/150`을 그대로 쓴다. 기존 12프레임·10fps 규칙으로 바꾸지 않는다.
칸 중 모든 프레임이 같은 곳은 정지 칸으로 합친다. 움직이는 칸의 중복 판정은 프레임 화소·통행·속도를 함께 비교한다.
저장된 띠의 크기·화소 해시·첫 프레임·명세가 맞지 않으면 굽기 보고서에 이유를 남기고 그 자식을 건너뛴다.
`handInteriorSpec.json`에 자식의 `parent/derive/setId/slot/animation`과 고른 묶음의 `derivationSets`를 싣는다.
방향 파생에서 이미 존재하던 의자 동·북·서에도 이 관계를 남긴다. 원본 자리를 다른 기물로 바꾸지 않는다.
자식 저장에 실패하면 API는 부모 판을 확정 기록하지 않아 같은 요청으로 다시 시도할 수 있다.
