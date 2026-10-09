# 버들항 화풍 웨이브 2 — 추가 지침 (WAVE-BRIEF.md 위에 얹는다, 2026-10-08)

`WAVE-BRIEF.md`·`SPEC.md`·`variants/BRIEF.md` 를 먼저 읽고 그대로 따른다. 이 문서는 **웨이브 1 에서 사용자에게 반려된 이유**를 막기 위한 추가 조건이다.

## 웨이브 1 에서 틀어진 것 (되풀이 금지)
1. 바닥을 자체 노이즈로 새로 발명했다 → 납작한 얼룩(위장무늬). **버들항 파이프라인의 풀·흙·돌·나무·석벽 그리기 함수와 7단 팔레트를 재사용**한다. 새 재질(눈·용암·모래·늪물·화강암 등)만 같은 7단 램프 규칙으로 추가하고, 칸 안에 점·결·잔 풀/잔돌을 찍어 손 도트 질감을 낸다.
2. 유적이 「윤곽 직사각형 + 평면 바닥」 상자였다 → 정체를 알 수 없었다. **랜드마크(앵커)는 3/4 시점 건물·구조물로 알아볼 수 있어야 한다**(윗면+앞면, 줄눈, 갓돌, 입구, 계단, 무너진 윗부분 등). 평판·상자·떠 있는 벽 토막 금지. 벽은 반드시 어딘가에 이어지거나 돌무더기로 끝난다.
3. 숫자 QA(빈칸 %, BFS)만 보고 통과시켰다 → **버들항 옆에 놓고 눈으로 비교**하지 않았다.

## 합격선 (기준작: 초원 하이로드의 「무너진 망루」, 고대 숲의 「옛 제단」)
- 둘 다 `plains-highroad/compare-ref.png`, `ancient-forest/compare-ref.png` 를 열어 눈높이를 맞춘다.
- 한 장소에 **알아볼 수 있는 앵커 3개 이상**(예: 사막 = 피라미드·오아시스 우물·상인 천막). 이름 붙일 수 없는 물체는 지운다.
- 장소의 「성격」이 한눈에 읽혀야 한다(5초 안에 「아, 늪 던전」).
- 조각은 같은 이름이 반복돼도 변형(좌우·크기·망가짐 정도)을 둔다. 일렬 배치·박스 배치 금지.

## 필수 QA (보고 전, 생략 불가)
1. **비교 시트** `<slug>/compare-ref.png`: 같은 배율(2x)로 [버들항 기준 크롭 | 네 크롭]을 나란히. 석재·건물은 `tiledata/beodeul-city/render/city6_base.png`, 숲·풀은 `deep-forest-path/render-1x.png`, 다른 재질은 가장 가까운 기존 장소(snowfield·volcano-cave·castle-catacombs …)와 비교. 질감(점·결·명암 단 수)·윤곽 굵기·채도가 같은 게임 그림으로 보여야 한다. 다르면 고치고 **최소 2회** 반복.
2. 원 해상도 사분면 4장 + 앵커 2x 크롭 직접 열람. 위장무늬 얼룩·뭉툭한 덩이·상자·잘린 물체·떠 있는 벽·길 끊김을 찾아 고친다.
3. 통행 BFS(입구→주요 지점 전부) + 키 큰 물체 걷기 규약 확인.

## 이 웨이브에서 지킬 파일 규칙 (동시에 여러 에이전트가 같은 워킹트리를 쓴다)
- **너의 `tiledata/beodeul-variants/<slug>/` 폴더 안에서만 쓴다.** 공용 라이브러리(`varlib/vprops/dprops/mprops/place/bdv/wavekit.py`, `_lib3/`)는 읽기만. 고쳐야 하면 네 폴더에 복사본/확장 모듈을 둔다.
- `waves.json`·`partmeta` 이외 공용 파일, `src/`, `public/`, 시트·tileset JSON 수정 금지. `bake_picks.py` 실행 금지(감독자가 굽고 `waves.json` 에 등록한다).
- 커밋은 네 폴더만: `git add tiledata/beodeul-variants/<slug> && git commit -m "..." -- tiledata/beodeul-variants/<slug>`. 다른 사람의 파일을 스테이징하지 않는다. push·stash·테스트·게이트 금지.
- 커밋 끝줄: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- 시각 페이지는 만들지 않아도 된다(감독자가 모은다). `render-1x/2x.png`, `compare-ref.png`, `plan.md`, `parts.md`, `partmeta.json`, `grid.json`, `make_<slug>.py` 가 산출물.

## 보고(짧게)
앵커 목록, 조각 수(물체/바닥/벽/오토타일), 커밋 해시, 비교 시트에서 **아직 다른 점**(솔직하게).
