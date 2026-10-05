# modern-chipset — 현대(modern4) 칩셋 도트 하네스

타일셋 종류마다 하네스를 따로 둔다(조선·포켓몬풍 야외 등은 별도). 이 하네스는 modern4 현대 거리 칩셋 전용 — 목표 도시 그림 톤(채도 55%), 위에서 내려다본 시점이고, 기물 종류(kind)는 이 안에서 늘린다. 지금은 `vehicle` 만 있다.

modern4 팔레트 거리 칩셋(도쿄 지구 맵용 `jp_shopstreet16`)의 자동차·버스·트럭·열차를 **3/4 시점**으로 찍는다.
생성 이미지가 아니라 pxgrid 로 한 글자씩 놓는 손 도트다(`monster-collect-species` 와 다르다).

## 왜 만들었나 (2026-10-01)
- 지금 탈것은 순수 옆모습 + 윗띠 4px 였다. 당시 QA 규칙이 「윗띠가 있으면 통과」라 전부 통과했다.
- 이 프로젝트에서 받아들여진 기준은 `public/assets/modern-exteriors/modern-city-atlas.png` 의 경찰차(픽셀 박스 383,104–466,146):
  옆면 위에 지붕·보닛·트렁크 윗면이 큰 면으로 보이고, 앞·뒤 유리는 윗면 사이 기울어진 띠다. 색도 단계만 쓰지 않는다.
- 감독이 직접 그리면 윗면이 각진 상자가 된다. 취향 판단은 사람이 한다 — 후보 5장을 사람이 고른다.

## 흐름
```
draw car side ─► 판 v<MMDD-HHMMSS> (qa-runs/harnesses/modern-chipset/<판>/)
   Sonnet 5.5 high × 5 (방향 A 기준 충실 · B 지금 차에서 출발 · C 둥근 차체 · D 낮고 날렵 · E 자유)
   → check.py (캔버스·투명 귀퉁이·# 잔존·윤곽 90%·접지·바퀴·한 덩어리·앞/뒤 대칭)  불합격이면 이유 들고 다시 그림
   → 독립 검수자(review.md): ref|old|후보 8배 + 3배 길 위 그림, 윗면 행 수를 세어 PASS/FAIL  FAIL 이면 다시 그림(최대 3번)
sheet ─► ~/claude-viz/veh-<판>.html (자체완결)   사용자가 고른다
pick ─► harness-data/modern-chipset/picked/<탈것>-<시점>.pxg|png + ledger.json (다음 판의 화풍 기준)
```

## 파일
| 경로 | 역할 |
|---|---|
| `src/harnesses/modern-chipset/harness.py` | 명령줄 본체 |
| `palette.py` | modern4 램프 → 글자 팔레트(`palette.pal` 생성). 이 밖의 색은 못 쓴다 |
| `check.py` | 기계 검사(시점은 수치로 대신하지 않는다) |
| `prompt.md` · `review.md` | 작업자·검수자 지시문 |
| `harness-data/modern-chipset/seed.json` | 기준 그림 위치·계약·탈것/시점 정의 |
| `harness-data/modern-chipset/old/` | 지금 쓰던 그림(비교용) |

## 함정
- 검수 ✓ 는 보증이 아니다 — 사용자가 고른 것만 정본. 통과율 숫자를 근거로 쓰지 마라.
- 차체는 `conc` 회색 램프로 찍고 색 변형(빨강·택시·흰색)은 램프 교체로 만든다(아직 미구현 — bake 단계 예정).
- 앞/뒤 시점은 프로젝트 안에 기준이 없다. 옆면 시점이 골라진 뒤 그 그림(anchors)을 화풍 기준으로 쓴다.

## 도시 조립 (2026-10-03)
`compose_town.py` + `town_lib.py` 가 60×60칸(960×960px) 도시를 조립한다. 에셋은 `harness-data/modern-chipset/town_assets.json` + `town_assets_a1.json`(건물·옥상 설비·간판) + `town_assets_a2.json`(거리 소품·나무·차량) 을 병합해 읽는다. 슬롯 `[x,폭,높이]` 는 시트 PNG 에서 **측정한 값**이며 코드에 크기를 박지 않는다. 새 슬롯 이름을 만들면 코드가 그 이름을 실제로 쓰는지 확인하라(2026-10-03: v2 옥상 설비가 이름 불일치로 한 라운드 동안 안 쓰였다).
- 실행: `bash /tmp/city/run2.sh <seed>` 대신 `compose_town.py --out … --ground … --props … --car … --assets harness-data/modern-chipset/town_assets.json --seed N`, 여러 시드 검사는 `--check 3,5,8`(audit 70항목, 위반 있으면 종료코드 1).
- 규칙: 같은 건물 도시당 2회 상한, 지붕색 변형(벽색과 독립), 구워진 옥상 설비를 지우고 15~25% 재배치, 도로 표시, 접지 그림자, 돌출 간판은 창을 가리지 않는다, 노변 주차는 연석 쪽 한 줄에만, 공사 구역은 도시당 1곳.
- 알려진 약점: 건물 수 시드 평균 약 20(목표 28) — 상한·뒷줄 노출 규칙이 겹침, 차종 다양성 부족, 주유소 캐노피 판.
- 검수 방식: 독립 적대적 시각 QA(읽기 전용, 확대 크롭 ≥18/시드) → 지적 → 에셋 재생성(하네스)·코드 수정 → 반복. 검수자 보고서는 파일을 못 쓰므로 최종 답에서 받는다.
- 보고서 페이지: http://mdc-server:18301/town-60-report.html

## 굽기 `bake` → 번들 타일셋 modern_city (2026-10-03)
합격 에셋 → 에디터 타일셋. 문서 `openwiki/modern-city.md`.
- `python3 src/harnesses/modern-chipset/harness.py bake [--dry]` = `bake_tileset.py`: 시트(`public/assets/modern-city/`), `src/assets/modernCity{Sheet,Tileset}.json`, `tiledata/modern-city/{pins,bake-report,kit-index}.json`. 번호는 `pins.json` 으로 고정(새 칸은 끝에 덧붙임) — **pins.json 을 지우지 말 것**.
- `bake_map.py [--publish]` 예제 도시 맵(60×60, 지역 `modern-city-60x60`), `bake_refs.py` 참고문서(`src/assets/modernCityReferences.json`).
- 합격 후보 PNG 는 `tiledata/modern-city/sources/<판>_<글자>.png` 에 커밋돼 있어 `qa-runs` 없이 재현된다(`run_town.sh <seed>`).
- 한계: 건물 색 변형은 벽색/지붕색 따로(조합 없음), 색 변형 칸은 modern4 밖 색, T자·곡선 도로 없음, 주차 표시 칸 없음, 조수는 `modernTilesetPolicy` 에 막힌다.

## 승인 주차장 두 면 공용 등록 (2026-10-05)

`npm run harness -- modern-chipset publish-parking`은 super-harness의 **현재 해시 선택**,
부품 receipt PASS, 최종 9축·고정 7조건 PASS를 재확인한다. `parking_bundle.py`가 승인 PNG와
환경/차량 원본·계약·선택 근거를 `tiledata/modern-city/parking-approved/`에 보존한다.
환경은 아래층, 원본차는 위층(솟은 줄 ★, 발 줄 막힘)인 `mc-parking-two-bays`를 굽는다.
그룹은 mixed이며 개별 칸의 홈 층·통행·우선순위는 각각 유지한다. 새 칸은 끝에 붙고 기존 번호/그림은 보존한다.
전체 키트 재조립·정의 검사를 쓰기 전에 실행한다. `mc-parking` 공용 참고문서는 전체 배열·원본 좌표 사전·정상/위층 누락 오류 그림을 포함한다.

`npm run harness -- modern-chipset save-parking-project --project-dir <새 폴더> --evidence <증거 폴더>`로
실제 SQLite 프로젝트를 만들고 닫은 뒤 다시 연다. 증거 폴더에는 등록 전 `previous-tileset.json`을 두며,
새 프로젝트/기존 번들 갱신, 엔진 보행 연결·벽/차량 막힘을 함께 확인한다. 기존 프로젝트 폴더는 덮어쓰지 않는다.
재로드한 JSON에 `npm run qa:runtime -- --scenario parking-approved --project <reloaded-project.json>`을 적용하면
출하 플레이어 경로의 보행·차량 앞뒤 가림을 확인할 수 있다.

범위는 14×7칸/224×112px, 차량 1대·주차면 2개의 고정 구역이다. 경사로·차단기·방화문을 갖춘
12면 전체 시설의 재료 조사/개념 카드 완료와 구별한다. 문 개폐나 차량 운전은 구현하지 않는다.

혼합 그룹은 `defaultLayer: mixed`, `layerHome: perCell`로 직렬화한다. `layerHome: mixed`는
프로젝트 스키마가 거부한다. bake 정의 검사에 이 enum을 추가했고, 정본 생성기는 폴더를 만들기 전에
직렬화/역직렬화 검증을 한다. 실제 정본 revision 4에서 다시 열어 확인했다.

## 기존 칩 확장 실험 (2026-10-05)

`harness-data/modern-chipset/parking-wide/plan.md`를 독립적으로 검수한 뒤
`npm run harness -- modern-chipset parking-wide --review <plan-review.json>`으로 조립한다.
검수 요청 시 같은 이름의 `.input.json`에 planSha256/sheetSha256를 고정한다. 실행기는 현재 입력과 일치하지 않으면 거부한다.
북벽은 한 번, 주차열 단면만 반복한다. 원본 차량·그림·칩 수는 바꾸지 않는다.
결과 `tiledata/modern-city/parking-wide/recipe.json`은 26×18칸, 12면/차량6대다.
`save-parking-project`에 `--recipe <recipe.json>`을 추가하면 새 정본으로 저장·재로드한다.
실제 보행 확인은 `qa:runtime -- --scenario parking-wide --project <reloaded-project.json>`.

이 표본은 조립/보행 PASS지만 **완성 시설 판정은 INCOMPLETE**다. 기둥·천장등·외곽 벽/출입 시설이 부족하여
큰 회색 바닥과 반복 차량이 드러난다. 같은 칩의 확장 결과와 부족 소재를 보여주는 실험으로 공용 참고문서에 함께 싣고,
두 면 표본의 합격을 12면 시설 전체의 합격으로 재사용하지 않는다. 전후 원본/플레이 화면과 독립 판정은 함께 보존한다.

### 미완성 판정의 후속 처리

`npm run harness -- modern-chipset parking-followup harness-data/modern-chipset/parking-wide/followup.json`
은 위 확장 검수의 실제 scene/plan 해시와 네 지적의 수정 주문을 확인하고 super-harness art 큐에 넣는다.
전역 pause와 해당 개념의 실행 작업 없음이 전제다. 같은 입력은 한 번만 회차를 소비한다.
기존 작은 표본의 승인·선택·설치·피드백은 scene-followup-history에 보존하고,
`parking-facility-v1`의 구조·조명·출입 연결·차량 다양성·공간 구성 조건으로 별도 범위를 연다.
원래 assembly PASS/facility INCOMPLETE 기록을 FAIL로 위조하지 않는다.
현재 누적 회차에서 한 번 증가하며 10회를 초기화하지 않는다. 상한이면 blocked이고 제작을 시작하지 않는다.
수정 결과는 기존 도면→native 제작→독립 전체 조립 검수 경로로 돌아온다. 필수 결함을 모두 해결하기 전
선택/시설 완료를 승인하지 않는다. 공용 게시/정본 저장은 그 뒤의 별도 작업이다.

### 공급자 오류 재개 (2026-10-05)

Super-harness의 기술 재시도는 queued 후보만 `_run`하며 이미 끝난 후보/품질 판정은 보존한다.
`resumePhase`가 review이면 원래 attempt에서 기계 검사와 독립 검수만 다시 수행한다.
429 등 실제 공급자 오류는 native 품질 수정 회차를 소비하지 않고 감독의 지속 예약으로 넘긴다.
오래된 verdict.json은 새 검수 전에 제거하고, 문맥 예산은 파일 절 단위 읽기로 제한한다.

Codex뿐 아니라 Claude도 `VEH_HARNESS_WORK`의 외부 작업 폴더에서 실행한다.
Claude는 같은 native interior-props 실행기의 최소 도구/MCP 설정을 사용하고 저장소는
`--add-dir`로 제공한다. 모델/노력 수준/그림 계약은 바꾸지 않고 불필요한 저장소 문맥만 제거한다.
