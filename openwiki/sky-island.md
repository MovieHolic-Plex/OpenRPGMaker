# sky_island — 하늘섬 번들 칩셋 (손 도트 · 구성기 · 조수)

떠 있는 풀 섬·구름 섬, 섬 밑면 바위, 밧줄/돌 다리, 잔교·비공정 부두, 신전 섬, 섬 사슬, 실내 넷(오두막·신전·비공정 선실·천문대).
계열 `oprn-sky` — 다른 번들 칩셋과 칸 번호를 섞지 않는다. 시점 3/4 탑뷰(윗면 + 남쪽 앞면), 16px, 빛 왼쪽 위, 팔레트 잠금.

## 파일
| 무엇 | 어디 |
|---|---|
| 그림(코드 손 도트) | `scripts/content/sky-island/art/`(`px.py` 팔레트·도구, `terrain.py`·`buildings.py`·`props.py`·`interior.py`, `si_gate_kinds.py` 관문 종류) |
| 관문 입력 | `tiledata/sky-island/<묶음>/_gate/items.jsonl` — `npm run harness -- object-gate review --batch …` |
| 굽기 | `scripts/content/sky-island/bake_si.py`(+ `si_bake_lib.py`) → `public/assets/sky-island/sky-island-chipset.png` · `src/assets/skyIslandTileset.json` · `skyIslandSheet.json` · 핀 `tiledata/sky-island/bake-pins.json`(덧붙이기 전용) |
| 참고문서 | `scripts/content/sky-island/bake_refs_si.py` → `src/assets/skyIslandReferences.json`(용도 `si-outdoor`·`si-interior`, 문서 13·그림 13, 그림은 `public/assets/sky-island-references/` 경로만) |
| 번들 정의 | `src/project/defaults/skyIsland.ts`(`createSkyIslandTileset`·`ensureSkyIslandTileset`·`ensureSkyIslandReferences`, 소유 머리 `si-`) |
| 구성기(순수) | `src/project/skyIslandComposer.ts` — `composeSkyIsland(spec, palette)`·`skyPaletteFromTileset`·`SKY_MIN_SIZE` |
| 조수 도구 | `src/editor/tools/skyIslandTools.ts` — `compose_sky_island_map`·`link_sky_island_interior` |
| 조수 길 | `src/ai/skyIslandPolicy.ts`(낱말·구성 종류·노트·프롬프트 줄) ← `plainTurn.ts`(고딕 다음, 버들항 앞)·`executionRoute.ts`·`systemPrompt.ts` |
| QA | `scripts/content/sky-island/qa/compose-scene.mts`(배열 JSON) + `render_scene.py`(원 해상도 PNG) |

배선: `bundled.ts`·`bundledChipsetGeometry.ts`·`defaultAssets.ts`(ensure/create)·`defaultMaps.ts`·`tilesetFamily.ts`(`oprn-sky`)·`combinedTown.ts`(면제)·
`concepts/format.ts`(BUILDABLE)·`harness-data/game-concepts/seed.json`(`하늘섬·비공정`)·`startRoutePaint.ts`·`startVariety.ts`·`toolRegistry.ts`.

## 수치 (2026-10-14)
- 조각 219 → 칸 626 · 키트 85 · 움직이는 칸 묶음 35. object-gate 영수증 233장 전부 PASS — **판정 프로필 미보정이라 잠정 통과**다(`object-gate status`).
- 관문에서 떨어졌다 고친 것: 풍향 자루·바닥 등롱(윗면 깊게 다시 그림), 풍력 날개 애니메이션 칸(뺐다 — 한 칸 그림만).

- **화풍 정렬 2026-10-14**(버들항 수준): 섬 밑면을 세로 기둥 판(D8)에서 층리·바위 덩이·처마 밑 그늘로 다시 그림 + 옆이 하늘에 드러나는 열은 깎은 몸통/끝(`face-mid-ol·or·olr`, `tip-ol·or·olr`, 구성기가 이웃 깊이로 고름), 끝 칸은 양 끝 높이 9 로 맞춘 뾰족 끝. 풀 바탕은 고른 4단+알갱이, 넓은 명암은 `grass-b`(밝은 얼룩)·`grass-shade-a/b`(짙은 덩이, 구성기가 노이즈로 몰아 깖)·`grass-tuft-a/b`(D9). 맞배지붕은 줄마다 한 단 램프·막새 용마루·처마 밑 4단 그늘, 활엽수·덤불은 잎 뭉치 결, 침엽수는 바늘 획. 영수증 85장 새로 받음(PASS 85/FAIL 0, 프로필 미보정 = 잠정). 남은 이질감: 판석 길(가늘다 — 다시 그린 판이 칸 경계 사각형으로 보여 되돌림), 신전·탑 지붕, 벽 재질, 물·소품, 밝은 풀 얼룩 반복이 눈에 띔.

## 구성기 계약
- 스타일 8: `village`(44×32↑) · `shrine`(44×40↑) · `dock`(50×30↑) · `archipelago`(48×40↑) · `room-cottage`(11×11) · `room-shrine`(13×14) · `room-cabin`(11×10) · `room-observatory`(13×12). 작으면 던진다.
- 판(Board) = 아래층·위층·쓰임(use)·예약(reserved). 건물은 문 앞 접근칸 2줄과 서·동·남 둘레 1칸을 예약한다 — 소품이 벽·문에 붙지 않는다. 걷는 깔개(꽃·깔개·다리 상판)는 칸을 예약해 두 번 놓이지 않는다.
- 끝에 4방 BFS: 모든 목표(문 접근칸·다리 양 끝·잔교·비공정 건널판·실내 출구)에 닿지 않으면 던진다. 실내는 닿지 않는 걷는 칸이 있어도 던지고, 야외는 노트만 남긴다.
- 도구는 결과를 맵에 쓴 사본에서 **엔진 isPassable** 로 다시 BFS 하고, 실패하면 맵을 바꾸지 않는다. 손대지 않은 빈 맵은 자동 크기(마을 50×34 · 신전 46×40 · 부두 52×30 · 섬 사슬 54×42 · 방은 최소 크기)로 늘린다.
- 통행은 MZ 규칙: 위층 칸이 있으면 위층이 정하고 ★ 이면 아래층. 섬 테두리 풀(`gs-*`)은 걷고, 하늘·밑면은 막힘. 다리·잔교·꽃밭·깔개는 홈 위층 + 우선순위 lower(걷는 깔개, 25칸).

## QA (한 번의 개선 판, 2026-10-14)
- 개선 전 적대 검수 5장면(원 해상도) 결함 40건(높음 15), 점수 마을 4 · 부두 3 · 신전 4 · 섬 사슬 3 · 실내 5.
- 한 판에서 고친 것: 남쪽 빈 띠(섬을 내용 크기로), 엇갈린 집 줄, 테두리 없는 우물 광장, 문 하나 울타리 밭, 풍차 문 칸(entrance [1,2]), 망루 섬 돌탑, 잔교를 가장자리 줄에서, 비공정 건널판, 짐 마당 광장, 가게 섬 노점,
  신전 앞 광장·돌다리 착지, 참배 섬 깃발·등불, 정원 섬 새 물그릇, 섬 사슬 다리 착지 예약, 오두막 벽난로 벽에 붙임, 선실 조타륜 앞벽, 천문대 마루 바닥.
- 남은 것(그림 일): 밑면이 세로 기둥 판(D8), 풀 결 단조(D9), 도리이·문루 키트 없음(D19), 굽은 시내 칸 없음(D21), 세로 밧줄 다리 깊이 단서(D23), 조타륜·천체 모형 그림(D35·D38), 방 옆벽 두께(D39), 바닥 등롱 빛(D40), 풍차 날개.

## 함정
- 접근칸 예약이 문 바로 아래 칸까지라 그 칸을 덮는 포석(신전 앞 광장)은 `patch` 가 거절한다 — 구성기에서 잠깐 풀었다 다시 예약한다.
- 1×1 소품(꽃·방석·밧줄 뭉치)은 키트가 아니라 그룹(`si:si-<id>`)이다. 팔레트가 tileMeta `defaultLayer` 로 1×1 키트를 합성한다.
- 빈 시작 맵(blank start)은 계열 기준선이 없으므로 새 프로젝트에서 sky_island 맵을 만드는 것은 계열 가드가 막지 않는다.
- 참고 스크린샷(`.herdr-web-ui/paste-*.png`)은 분위기 참고뿐 — 베끼거나 커밋하지 않는다. 사람은 Actor1 캐릭터 이벤트.
