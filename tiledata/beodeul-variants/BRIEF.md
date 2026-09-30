# 버들항 기준 장소 20종 — 공통 지침 (감독자, 2026-09-30 밤)

사용자: 「'버들항'의 맵 및 도트를 기준으로 다양한 마을, 던전, 필드들 만들어봐. 한 20종류쯤.」 사용자는 자는 중 — 묻지 말고 판단해서 끝까지 간다.

## 기준
- 버들항 = 로마풍 항구 도시 v6~v8, 16px 손 도트, 3/4 시점. 먼저 읽을 것(너의 워크트리 안):
  `openwiki/beodeul-city.md`(줄 좌표로 필요한 절만), `tiledata/beodeul-city/tile-laying-theory.md`,
  `scripts/content/lib/city_v6/`(city6.py·city6_kits.py·city6_props.py·city6_render.py·terrain7.py·kits7_*.py), `tiledata/beodeul-city/kits7/`, `blocks-v8.json`,
  렌더 `tiledata/beodeul-city/render/`. 큰 파일은 grep -n + 범위로만 읽는다.
- **화풍·팔레트·명암 단계·윤곽 결·3/4 규칙은 버들항과 같게.** 버들항 파이프라인의 그리기 함수·키트·소품·땅 오토타일을 재사용하고, 없는 것(동굴 벽, 용암, 눈, 늪, 던전 바닥 등)은 **같은 결로 손 도트**(Python/Pillow 좌표·pxgrid). 
- **생성 이미지·트레이싱 금지.** 외부 게임 그림 픽셀 복사 금지(보고 재는 것만).
- 3/4: 바닥 위에서 본 1:1, 물체 = 윗면+앞면, 옆면 없음, 빛 왼쪽 위. 1칸 = 16px = 1m.

## 맵 규칙 (메모리 규칙 요약 — 어기면 불합격)
- 목적 먼저: 맵마다 plan.md 에 용도·구역·앵커(랜드마크)·동선을 적고 깐다. 빈 바닥을 소품으로 메우지 말고 맵을 줄인다. 자연 덩어리로 배치(일렬 금지).
- 한 화면(20×15칸) 안 빈 바닥 ≤ 40%. 마을 빈칸 ≤ 4칸 덩이.
- 실내·던전: 천장 밑에 벽면(앞면)이 반드시 있다. ㅁ자 고립 방 금지. 계단은 바닥 위, 시트 모양 그대로.
- 집: 박공·단층·2층, 벽 폭 ≥3칸, 창은 벽 가운데, 사선 뒤 빈칸 금지.
- 나무 줄기는 밑변과 같은 폭, 수관이 잘리지 않게.
- 크기: 마을 48×40~80×64, 던전 방 묶음 40×30~64×48, 필드 64×48~96×64. 목적에 맞게.

## 산출 (맵 하나마다)
`tiledata/beodeul-variants/<slug>/`: `plan.md`, 생성 스크립트(`make_<slug>.py` 등 — 다시 돌리면 같은 그림), `render-1x.png`, `render-2x.png`, 통행 격자 `grid.json`(걸음/막힘), 새로 찍은 조각 `parts/*.png` + `parts.md`(무엇·몇 칸).
- 너의 담당 4곳을 한 페이지에: `~/claude-viz/beodeul-var-<n>.html` (1x 전체, 2x 확대 구역 2~3곳, 새 조각 시트, plan 요약). 자체완결(data URI 또는 같은 폴더 사본). curl 200 확인.
- 적대적 QA: Playwright(또는 PIL 크롭 확대)로 원 해상도 사분면·2x 를 직접 보고, 박스 모양·반복 무늬·어색한 경계·잘린 물체·길 끊김·통행 막힘(입구→주요 지점 도달 BFS)을 찾아 고친다. 맵마다 QA 기록을 plan.md 끝에.

## 규칙
- 너의 워크트리에서만. `npm run wt -- adopt beodeul-var<n> --path <경로>` 는 node 도구가 필요할 때만.
- src/·public/ 는 건드리지 않는다(타일셋 시트에 칸을 추가하지 않는다 — 데모 렌더다). 테스트·게이트·stash 금지. dev 서버 불필요.
- 파이프라인 출력은 `/tmp` 대신 워크트리 안 `tiledata/beodeul-variants/_out-<n>/`(gitignore 되면 이름 바꿔라; `scratch` 같은 이름 금지). /tmp 는 사라진다.
- 맵 하나 끝날 때마다 로컬 커밋: `feat(content): 버들항 변형 — <이름>`. 끝줄 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. push 금지.
- 컨텍스트 관리: 이미지는 필요할 때만 Read(크롭해서), 명령 출력은 head 로 자른다. 긴 로그 금지.

## 보고 (짧게, 텍스트)
맵 4곳 이름·크기·목적 한 줄씩, 새 조각 수, 커밋 해시, 페이지 주소, 스스로 보기에 어색한 곳.
