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

## 서버 확정 → 공용 SQLite 자동 등록 (2026-10-04)

화면 `/harness`에서 후보를 확정하면 `picks.sqlite` 커밋·파생 자식 저장 뒤
`shared_publish.py`의 내구성 있는 대기열에 넣는다. 옛 `/api/pick`의 선택/변형 변경과
`/api/revert`도 같은 길로 보낸다. 서버 시작 때 현재 선택을 대조하여 누락을 소급 반영한다.
에디터 공방의 IndexedDB 저장은 별도 경로이며 이 자동 등록의 대상이 아니다.

- 대기열/로그: `$PROP_HARNESS_DATA/shared-publish.sqlite`, `shared-publish.log` (기본 `~/.local/share/oprn/prop-harness`).
- 3초 동안 들어온 확정을 합쳐 최신 선택판을 격리 폴더에서 굽는다. 후보를 대신 고르지 않는다.
- `build_tileset.py` → 예제 맵 픽셀/통행 검사 → `prepare-references.mts` → `publish_shared.mjs`.
  선택된 단품/파생 자식/함께 쓰기 변형 누락은 실패다. 묶음 자체는 제외한다. 그림·지침·참고 이미지를 함께 등록한다.
- 저장 대상: `$OPRN_SHARED_CONTENT_SQLITE` 또는 `$XDG_DATA_HOME/oprn/shared-content.sqlite`.
  라이브러리 `oprn-hand-interior-harness`, 타일셋 `shared_hand_interior_harness`.
  `projectDefaults:true`라 같은 호스트의 새/기존 프로젝트가 공용 목록을 로드할 때 자동 설치한다.
  이미 열린 편집기는 다시 열어 최신 공용 목록을 읽는다.
- 이전 공용 판본의 사양/시트/예제 칸을 `baselines/<revision>/`에 **게시 전에** 보존한다.
  다음 굽기는 공용 DB의 실제 판본에 해당하는 자료로 번호를 고정한다. 새 칸은 뒤에 붙인다.
  필요한 이전 자료가 없으면 게시를 중단한다(번호를 임의로 재배치하지 않는다).
- 라이브러리 CAS 트랜잭션 저장 뒤 같은 행을 다시 열어 해시를 확인한다.
  전체 수 GB DB를 재로드하지 않는다. 성공 전에는 이전 공용판이 유지된다.
- 화면에 대기/반영 중/완료/실패를 표시한다. 실패는 선택을 취소하지 않으며 60초 뒤 자동 재시도한다.
  실패 화면의 「지금 다시 시도」는 `POST /api/harness/publish`로 강제 재등록한다.
  서버가 30초마다 미완료 작업을 확인해 꺼진 일꾼을 다시 띄운다. 서버 재시작 후에도 대기열을 다시 읽는다. 빌드 도중 들어온 확정은 다음 게시판에 반영한다.
- 공용 팩의 기물은 `list_spatial_designs(kind:object)` → `stamp_object(kit:shared_hand_interior_harness/...)`로 쓴다.
  기존 번들의 `build_hand_interior_room` 고정 사양과 번호를 혼용하지 않는다.
  자료집 공용 분류도 설치된 공용 타일셋의 실제 킷 신원을 확인한다.

수동 재등록: `python3 src/harnesses/interior-props/shared_publish.py --force`.
이 경로는 호스트 DB 게시이며 git 커밋/PR이나 앱 번들 릴리스는 자동으로 하지 않는다.
