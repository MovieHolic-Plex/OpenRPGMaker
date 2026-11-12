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

- **화풍 정렬 2026-10-14**(버들항 수준): 섬 밑면을 세로 기둥 판(D8)에서 층리·바위 덩이·처마 밑 그늘로 다시 그림 + 옆이 하늘에 드러나는 열은 깎은 몸통/끝(`face-mid-ol·or·olr`, `tip-ol·or·olr`, 구성기가 이웃 깊이로 고름), 끝 칸은 양 끝 높이 9 로 맞춘 뾰족 끝. 풀 바탕은 고른 4단+알갱이, 넓은 명암은 `grass-b`(밝은 얼룩)·`grass-shade-a/b`(짙은 덩이, 구성기가 노이즈로 몰아 깖)·`grass-tuft-a/b`(D9). 맞배지붕은 줄마다 한 단 램프·막새 용마루·처마 밑 4단 그늘, 활엽수·덤불은 잎 뭉치 결, 침엽수는 바늘 획. 영수증 85장(PASS 85/FAIL 0). **2차(감독 판정 뒤)**: 밝은 풀 얼룩을 칸 경계 4화소 안쪽의 작은 불규칙 얼룩 셋(`grass-b`·`b2`·`b3`, 빈도 낮춤), 길은 포석 큰길 `road`(+`road-b`)·`road-<nswe>` 이웃 마스크 16칸(풀과 닿는 쪽만 연석, 구성기가 길 칸마다 고름 — 옛 `path-1~3` 은 남겨 두고 폴백), 큰 활엽수 `tree-big`(3×4, 마을 숲 기본 — 안 들어가면 같은 자리에 `tree-round`), 탑 원뿔·신전 지붕에 줄마다 램프. 영수증 23장(PASS 23/FAIL 0). 합계 108장 PASS·FAIL 0, 프로필 미보정 = 잠정. 남은 이질감: 벽 재질, 물·소품, 섬 밑면 몸통이 깊이로 어두워지지 않음.

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

## 직각 지붕·천문대 돔 다시 그리기 (2026-11-12, 오너 지시)

오너 2026-11-12: «이 에디터는 시야각이 직교해야하므로 sengoku_edo se-machiya-a 이런 식의 직각 지붕이어야하는데 … sky_island si-observatory 이건 또 뭘 그린건지도 모르겠고 … Fable 5.2 Medium 으로 1번만 시도».

- `si-observatory`: 옆에서 본 반구(초록 달걀)를 지우고, 옥상 마당(코드 그림 그대로) 위에 **위에서 본 둥근 돔**(관측 틈 + 놋쇠 망원경)을 얹었다. 돔 그림은 Claude Fable 5.2 medium 이 그린 44×42 PNG `scripts/content/sky-island/art/fable/si-observatory-dome.png` 이고 `art/buildings.py` 가 `px.paste_png` 로 붙인다(잠긴 팔레트 밖 색이면 오류). 첫 호출(옥상+돔 72×56 통째)은 출력 20,000 토큰을 추론에 다 쓰고 그림 없이 끝났다 — 돔만 떼어 한 번 더 불렀다. **아직 약하다**: 돔이 작고 어둡게 읽힌다(테두리 하이라이트·돔 밑 그늘·틈 밖으로 나온 망원경 통이 약함). 세 번째 호출은 하지 않았다.
- `si-shrine`: 사다리꼴 동판 지붕을 직사각형으로(지붕만, Fable 한 방). 덮어쓰기 `tiledata/sky-island/fable-roofs/si-shrine.png` + `index.json` → `art/kit.py` 내보내기가 `scripts/content/lib/fable_roofs.py` 로 덮는다.
- 관문: **3/4 관문 미통과 — 오너 면제** 묶음 `fable-redraw-roofs-sky-island-2026-11-12`(bundle·shared, 스토어 제외). `si_bake_lib.gate_status` 가 면제된 그림을 받는다. 통과가 아니다.
- 칸 번호(jp_city 와 같은 규칙, #4668 뒤 고침): **옛 칸은 #4668 전의 그림 그대로, 다시 그린 신전 지붕·천문대 돔은 시트 끝의 새 칸**(668 → 691)이고 `si-shrine`·`si-observatory` 두 키트만 새 칸을 가리킨다. #4668 은 옛 칸을 제자리에서 덮어써서, 이미 깔린 신전이 새 지붕에 한 칸(167번 — 다른 조각과 나눠 쓰던 칸)만 옛 그림인 채로 보였다. `si_bake_lib.Outdoor.keep_old_cells(옛 시트)` + `put`: 번호를 받은 자리 키의 그림이 옛 시트의 그 칸과 다르면 옛 칸에 옛 그림을 남기고 `키@r<그림 해시>` 로 새 번호를 받는다. 검사(모델 없음, `~/z-project/assistant-fable-runs/redraw/roofs/laid_check.py`, 옛 = #4668 직전): 옛 칸 667개 중 화소가 달라진 칸 0 · 통행/우선순위 변화 0 · 옛 건물 키트 11채 맵의 다른 화소 0 · 새로 찍는 키트 86개의 그림은 #4668 뒤 main 과 화소 동일 · #4668 이 붙인 667번 칸 그대로 · 두 번 구워 해시 동일.
- 남은 것: `si-tower-house`(뾰족 지붕 탑 — 박공 정면/첨탑, 그대로) · 등대·풍차·풍력기·비공정은 예외. 표·전후 그림 http://mdc-server:18301/roof-orthogonal.html

## 이야기 기물 1종 (2026-11-12) — 3/4 관문 미통과 · 오너 면제

게임이 바랐는데 그림이 없던 **봉인 제단**을 시트 끝(691~694, 칸 695 · 키트 87)에 덧붙였다. **이 그림은 3/4 관문을 통과하지 않았다** — 오너 면제 묶음 `fable-oneshot-2026-11-12`(`harness-data/object-gate/waivers/`)가 그림 화소 해시·종류에 묶여 번들 출구만 연다. 스토어로는 나가지 않는다.

| 키트 | 무엇 | 크기 · 놓는 법 | 칸 | 막힌 칸 | 관문 종류 |
|---|---|---|---|---|---|
| `si-seal-altar` | 봉인 제단(대리석 제단·봉인) | 2×2 · tall | 691~694 | (0,1) (1,1) | box |

- 목록·그림: `tiledata/sky-island/objects/spec.json`(이름·크기·막힌 칸·찾는 낱말·놓는 규칙) · `pieces/si-seal-altar.png`. **그림은 한 화소도 바꾸지 않는다** — 한 화소라도 바뀌면 면제가 풀려 굽기가 그 조각을 막는다(검사 `test/skyIslandStoryObjects.test.ts` 가 시트 칸과 원본을 대조한다).
- 굽기는 같은 `bake_si.py`: 등록부 조각 뒤에 이 목록을 덧붙인다(핀 덧붙이기 전용, 묶음 `si:si-objects`). 조각이 칸마다 통행을 직접 선언한다(`cells_pc`), 놓는 법 태그(`stamp`)도 목록에서 온다.
- 출구 검사는 관문 자신의 규칙이다: `si_bake_lib.gate_status` 가 오너 면제가 있는 그림을 `object_gate.refusal(context='bundle')` 에 묻는다(직각 지붕 때 넣은 그 줄 그대로 — 새 규칙 없음). 보고 `bake-report.json` 의 `gate.owner_waiver`(이 묶음) · `gate.owner_waived_files`(어느 면제 묶음으로든 지난 그림 — 천문대 돔·신전 지붕 포함).
- 조수가 찾는 길: 키트 이름·태그(`words` — 봉인 제단·봉인·제단·대리석 제단). «제단» 한 낱말은 같은 태그를 가진 실내 `si-altar`(신전 제단)가 먼저고 이 키트가 둘째다. v2 코드에 낱말 목록은 없다.
- 참고문서: 문서 `si-outdoor/si-objects`(사전·순서·6×5 조립 예제 전체 배열·정상/오류 그림) — `bake_refs_si.py` 가 칩셋 공용 틀 `scripts/content/story-objects/refs_lib.py` 로 만든다.
- 탐침(모델 없음): `bun scripts/content/story-objects/probe.mts sky_island <out> --base-sheet <고치기 전 시트>`. 화면 증거 `verify-shots/sky-island-story-objects/`.
- 기존 저장본: 이 칩셋 끝에 다른 칩셋 그림을 붙여 쓴 프로젝트는 `settleThemeBundleTail`(`openwiki/runtime-project-schema.md` 「시트 끝에 칸을 끼운 번들」)이 이식 꼬리를 새 번들 끝 뒤로 밀고 키트를 채운다.

## 함정
- 접근칸 예약이 문 바로 아래 칸까지라 그 칸을 덮는 포석(신전 앞 광장)은 `patch` 가 거절한다 — 구성기에서 잠깐 풀었다 다시 예약한다.
- 1×1 소품(꽃·방석·밧줄 뭉치)은 키트가 아니라 그룹(`si:si-<id>`)이다. 팔레트가 tileMeta `defaultLayer` 로 1×1 키트를 합성한다.
- 빈 시작 맵(blank start)은 계열 기준선이 없으므로 새 프로젝트에서 sky_island 맵을 만드는 것은 계열 가드가 막지 않는다.
- 참고 스크린샷(`.herdr-web-ui/paste-*.png`)은 분위기 참고뿐 — 베끼거나 커밋하지 않는다. 사람은 Actor1 캐릭터 이벤트.
