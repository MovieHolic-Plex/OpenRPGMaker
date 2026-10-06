# wizarding_world 조각 계약 (`scripts/content/wizarding/`)

공용 번들 타일셋 **`wizarding_world`**(텍스처 `tex_wizarding_world`, 계열 `oprn-wizard`, 16px 칸, 48열)와
공용 캐릭터 시트 `Wizarding1..N`(24×32, 8명/장)은 **조각 모듈** `pieces/<모듈>.py` 들을 `bake_wz.py` 가 모아 굽는다.
그림은 전부 **코드 손 도트**(python3 + numpy/PIL, `wzlib.py` 의 캔버스)로 그린다. 생성 이미지·남의 칩셋 그림·옛 실내 v5·modern 팔레트 사용 금지.

## 0. 먼저 읽을 것
- `wzlib.py` (팔레트 램프 `K(재질, 단)`, 캔버스 `Cv`, 등록 `REG`, 검사·검수 시트) · `pieces/_example.py` (API 견본 — 그림 수준의 견본은 아니다).
- 미술 기획: `~/.local/share/oprn/super-harness/keyword-seeds/3e7ac64c5cf1d943e08a/theme/brief.json` 의 `artDirection`·`families`·`spaces`.
- 콘셉트 그림(통과): `~/.local/share/oprn/super-harness/keyword-seeds/3e7ac64c5cf1d943e08a/theme/concept-art/799b64d9f4821fa5a33d44bc3133108d458b2d9d45933d7facd1c2485a5ecb63.png` (마법약 교실·숲 마차·눈 우체국).
- **승인된 같은 화풍 native 조각**: `tiledata/wizarding/native/` (지팡이 가게·마법약 교실, 사람 걷기 시트 `*/actors/*/walk.png`). 새 조각은 이것들 옆에 놓아도 같은 게임으로 보여야 한다.
- 도트 방법 스킬: `~/.claude/skills/pixel-object-authoring/SKILL.md` 와 그 `refs/rejected/*.png` (사용자가 반려한 사례와 이유).

## 1. 화풍 규칙 (사용자·기획 판정 — 어기면 반려)
1. **팔레트 42색만**(`wzlib.PAL`). 알파 0/255 만. 안티앨리어싱·흐림·자동 그라데이션·촘촘한 잡음 금지.
2. **직교 3/4 탑뷰, 정면 고정, 좌우 대칭(지은 것)**. 위가 북쪽. 윗면과 남쪽 정면을 함께 보인다. 윗면 깊이 = 전체 높이의 25~35%, 가구 윗면 최소 3px. 비스듬히 돌린 물체·측면도·아이소메트릭 금지.
3. **빛은 왼쪽 위**: 윗면 밝게, 정면 한 단 어둡게, 오른쪽 모서리 더 어둡게. 키 큰 물체는 오른쪽 아래로 접지 그림자(바닥 위에 겹칠 때만).
4. **유색 윤곽 1px**: 재질의 가장 어두운 단(`Cv.outline()`). 모든 칸을 검은 선으로 두르지 않는다. 면당 3~4단 명암.
5. **재질 구분**: 돌=큰 비정형 블록·드문 마모점, 나무=긴 결·둥근 모서리, 금속=좁은 고명도 반사, 유리=짧은 1px 반사선과 뒤가 보이는 빈 면, 천=넓은 면과 2단 주름.
6. **축척**: 1칸=16px. 사람 24×32 프레임(어른 몸 28~30px, 학생 24~27px). 문 폭 16~32·높이 32~40px. 탁자 상판 높이 14~16px, 의자 좌면 8~10px. 계단 디딤판 8px×2단/칸. 병상 2×3칸, 보트 2×4칸, 세스트랄 3×3칸(몸 2×3), 마차 3×5칸, 골대 기둥 4~6칸+링 2×2.
7. **큰 구조물은 키트**(벽·아치·지붕을 칸 단위 조각으로, 여러 폭으로 조립 가능). 한 장 그림을 통째로 칸으로 자르기만 하지 않는다 — 단, 가구·기물(서가, 침대, 마차)은 한 덩이 다칸 조각이 맞다.
8. **사람이 서는 자리**: 위층 몸체는 `S`(막힘), 사람 머리 위로 지나가는 윗부분(처마·수관·서가 윗단)은 `C`(★ 통행·사람 위), 바닥은 `F`.
9. 정체성: 색만 바꾼 범용 기물 금지. 도구의 사용 면(솥 안의 약, 열린 책장, 저울 접시)을 보이게 한다. 현대 물건 금지.
10. 상태가 있는 물건(문 닫힘/열림/잠김, 커튼, 비밀 패널, 화분 속/뽑힘)은 **같은 크기·같은 피벗**으로 상태마다 조각을 따로 등록하고 `states='<묶음 이름>'` 를 준다. 열린 문 칸은 통행(`C` 또는 `F`)이어야 한다.

## 2. 등록 (wzlib.REG)
- `@REG.piece(id, 이름, w, h, walk, family, space, desc=, rules=, tags=, role=, frames=1, fps=6, repeat=False, states=None)` → `fn(c)` (frames>1 이면 `fn(c, f)`)가 `w*16 × h*16` 캔버스에 그린다.
  - `id` 는 `wz-<space약어>-<이름>` 영문 소문자·하이픈. **한 번 정하면 바꾸지 않는다**(번호 핀 키).
  - `walk` = 행마다 w 글자: `S` 막힘(위층) · `C` ★통행(위층, 사람 위) · `F` 걷는 땅(아래층, 칸 불투명) · `X` 막힌 땅(아래층 불투명: 물) · `f` 투명 바닥 덧그림(통행, 사람 밑) · `.` 빈칸.
  - `family` ∈ architecture surfaces furniture nature characters creatures vehicles effects. `space` ∈ `wzlib.SPACES` 키. `role` ∈ building castle fence roof terrain water wall prop.
  - `repeat=True`: 1×1 바닥·벽처럼 이어 칠하는 조각(16 주기로 이음새 없게: `Cv.tile`).
  - 애니메이션 `frames=N`: 칸마다 N 개의 가로 연속 칸이 되어 `animationStrips` 로 굽힌다. 프레임마다 모양이 실제로 바뀌어야 한다(단순 이동·확대 금지). 효과가 얼굴·문·핵심 도구를 덮지 않게.
- `@REG.autotile(id, 이름, family, space, desc=, rules=, layer='lower', pc='floor'|'solidfloor'|'flat')` → `fn()` 이 `(patch 48×48 Cv, icorner 16×16 Cv)` 반환.
  patch = 3×3 칸 견본(가운데 칸=속, 둘레 8칸=변·바깥 모서리, **바깥 지형까지 구워 넣는다**), icorner = 속으로 꽉 차고 네 모서리만 안쪽으로 파인 칸.
  47종 블롭은 8×8 사분면으로 합성된다(`wzlib.blob_tile`). 속 질감은 16 주기 하나(`Cv.tile`)로 칠해야 이음새가 없다. pc floor/solidfloor 는 모든 칸이 불투명이어야 한다.
- `@REG.character(id, 이름, space, desc=, tags=)` → `fn(c, d, f)` 가 24×32 캔버스에 방향 `d`('up','right','down','left'), 걷기 프레임 `f`(0,1,2; 1=선 자세)를 그린다. 시트 행 순서는 위·오른쪽·아래·왼쪽(EasyRPG). 발은 프레임 아래 가운데.
  native `walk.png`(72×128) 들이 축척·명암 기준이다. 3/4 시점(머리 윗면·어깨가 보임), 오른쪽 방향은 왼쪽의 단순 좌우 반전 금지까지는 요구하지 않는다(반전 허용, 단 비대칭 소품 위치 확인).
- `REG.example(id, 이름, space, w, h, floor, place, desc=)` → 그 공간 한 장 예제. `floor` = 1×1 반복 바닥 조각 id 또는 오토타일 id. `place` = `[(조각 id, x, y), ...]` 그리는 순서(뒤가 위). **다른 모듈의 조각 id 도 쓸 수 있다**(아래 4절 공용 id).

## 3. 자기 검사 루프 (완료 조건)
1. `python3 scripts/content/wizarding/pieces/<모듈>.py` → 오류 0 (팔레트·알파·walk 와 그림 일치·빈 프레임).
2. 생성된 `tiledata/wizarding/review/<모듈>.png`(4배, 칸 격자, 사람 표본·native 비교)를 **Read 로 직접 열어 본다**. 조각마다 한 줄 판정을 `tiledata/wizarding/review/<모듈>.notes.md` 에 쓴다:
   `- wz-...: 무엇으로 읽히나 / 윗면 비율 / 사람 대비 크기 / native 와 같은 화풍인가 / 고친 점`.
   다른 것으로 읽히면(공→구슬, 의자→상자 …) 실루엣부터 다시. 큰 조각은 1배로도 본다.
3. 예제 맵은 굽기 전이라도 `python3 scripts/content/wizarding/preview_example.py <모듈>` 로 그려 본다(같은 폴더 `review/<모듈>-example-*.png`).
4. 끝나면 마지막 메시지에 조각 수·남은 약점만 짧게. **git 명령(커밋·stash 등)·테스트·게이트·npm 실행 금지**. 자기 모듈 파일과 `tiledata/wizarding/review/<모듈>*` 외에는 쓰지 않는다.

## 4. 공용 id (다른 모듈 예제가 기대는 이름 — castle_kit 이 반드시 만든다)
| id | 크기 | 뜻 |
|---|---|---|
| `wz-castle-wall-n` | 1×4 | 북쪽 벽: 0행 벽 윗면(두께), 1~3행 실내 정면. 가로로 이어 칠한다(repeat) |
| `wz-castle-wall-n-window` | 1×4 | 납살 첨두 창 + 깊은 창턱 |
| `wz-castle-wall-n-pillar` | 1×4 | 버트레스/벽기둥 |
| `wz-castle-wall-nw` `wz-castle-wall-ne` | 1×4 | 북쪽 바깥 모서리(서·동) |
| `wz-castle-wall-w` `wz-castle-wall-e` | 1×1 | 서·동 벽 윗면 띠(세로로 이어 칠함) |
| `wz-castle-wall-s` | 1×2 | 남쪽 낮춘 절단벽(0행 윗면, 1행 낮은 정면) |
| `wz-castle-wall-sw` `wz-castle-wall-se` | 1×2 | 남쪽 모서리 |
| `wz-castle-wall-n-end-l` `wz-castle-wall-n-end-r` `wz-castle-wall-t-w` `wz-castle-wall-t-e` | 1×4 | 끝마감·T접합 |
| `wz-castle-door1-closed` `-open` `-locked` | 1×4 | 북벽에 끼우는 1칸 오크 문 3상태(첨두 문틀) |
| `wz-castle-door2-closed` `-open` `-locked` | 2×4 | 2칸 오크 문 3상태 |
| `wz-castle-door-s` | 1×2 | 남벽 출입구(문턱, 통행) |
| `wz-castle-stair-down` `wz-castle-stair-up` | 2×2 | 계단 |
| `wz-castle-flag` | 오토타일 | 마른 석재 포석(바깥 = 어두운 틈) |
| `wz-castle-floor-flag` `wz-castle-floor-flag-worn` `wz-castle-floor-oak` | 1×1 | 반복 바닥(F) |

모든 실내 예제: 북쪽 0~3행에 `wz-castle-wall-n…`, 서·동 가장자리 열에 `-w`/`-e`, 남쪽 마지막 2행에 `-s`. 성 밖 공간(숲·호수·경기장·호그스미드 거리)은 자기 바닥을 쓴다.

## 5. 굽기
`python3 scripts/content/wizarding/bake_wz.py` 가 **검수 통과(verdict PASS, 해시 일치)** 조각만 모아 시트·정의·키트·그룹·애니메이션·캐릭터 시트·참고문서를 쓴다.
검수 판정은 `tiledata/wizarding/review/<모듈>.verdict.json`(독립 검수자 작성) — 작업자는 쓰지 않는다.
