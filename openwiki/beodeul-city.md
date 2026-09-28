# 버들항 v6 — 로마풍 항구 도시를 편집기 맵·공용 타일셋으로 (beodeul_city)

2026-09-28. Python 손 도트 합성 그림이던 버들항 v6(100×100, 16px, 세 단)을 **그림 그대로** 편집 가능한 맵과 공용 번들 타일셋으로 옮겼다.
조수(에디터 AI)가 이 타일셋의 참고문서만 보고 「버들항 비슷한 도시」를 깔 수 있는지도 실제 모델로 시험했다(아래 「조수 시험」).

## 무엇이 어디에 있나

| 무엇 | 위치 |
|---|---|
| 그리기 파이프라인 (Python) | `scripts/content/lib/city_v6/` — 입구 `city6.py`, 키트 `city6_kits.py`, 소품 `city6_props.py`, 렌더 `city6_render.py`, 움직임 `city6_anim.py`, 메타 `meta.json`, QA `qa-v6.json`. 출력 폴더는 `CITY6_OUT`(기본 `/tmp/j8city6`). 바탕 칩셋 사본 `assets/jungle-chipset-v6.png`(v6 를 그릴 때의 정글 시트, 뒤에 바뀐 번들 시트와 달라 고정), 잔디·물 견본 `assets/lawn16.png`·`water16.png` — **이제 `/tmp`·홈 폴더를 읽지 않는다**(옛 `addons2.py` 가 `/tmp/j8city` 를 경로 맨 앞에 넣어 모듈 13개가 거기서 읽혔다) |
| 편집기 쪽 추가 출력 | `city6_render.py` 가 같은 실행에서 `city6_ground.png`(물체 전 땅), `city6_grid.json`(점유·단·절벽·물·문·계단·다리·잔교), `city6_objects.json`+`objects/*.png`(물체마다 투명 그림), `city6_houses.json`, `city6_people.json`(주민) 을 더 쓴다. `CITY6_NO_PEOPLE=1` 이면 주민 그림만 빼고 그린다(주민은 이벤트가 된다) |
| 칸 자르기 | `python3 scripts/content/build-beodeul-city.py` (`--no-render` = 렌더 다시 안 함) → `public/assets/beodeul-city/beodeul-city-chipset.png`(2048×2848, 128열, 22,784칸), `src/assets/beodeulCityTileset.json`, `src/assets/beodeulCitySheet.json`, `tiledata/beodeul-city/map.json` |
| 원본 렌더 사본 | `tiledata/beodeul-city/render/`(주민 없음, 칸을 자른 원본) · `render-full/`(주민 포함 = `/tmp/j8city6/city6.png` 와 화소 0 차이) |
| 타일셋 정의 | `src/project/defaults/beodeulCity.ts` `createBeodeulCityTileset` / `ensureBeodeulCityReferences` |
| 공용 배포 | `src/assets/bundled.ts` 한 줄(`tex_beodeul_city`) + `bundledChipsetGeometry.ts`(128열) → `defaultAssets.ts` `ensureBundledTilesets` 가 새 프로젝트·기존 프로젝트 모두에 만든다. `tilesetHarness/combinedTown.ts` 의 RM2k3 투명 칩 표에서 뺐다(칸 층은 렌더에서 잘랐다) |
| AI 참고문서 | `python3 scripts/content/prepare-beodeul-city-references.py` → `src/assets/beodeulCityReferences.json`(용도 4 · MD 17 · 그림 21, 그림은 `/assets/beodeul-city/references/*.png` 경로 — 바이트 없음) + MD 사본 `tiledata/beodeul-city/references/*.md` + 변조 검사 결과 `tiledata/beodeul-city/qa-tamper-checks.json` |
| 정본 저장 | `node scripts/content/save-beodeul-city.mjs` → `.oprn-projects/beodeul-city-20260928`(git 밖), 증거 `tiledata/beodeul-city/storage-proof.json` |
| 재로드 렌더·화소 비교 | `bun scripts/content/render-beodeul-city.mts` → `verify-shots/beodeul-assistant/reloaded-render.png`, `pixel-diff.json`, `diff-*.png` |
| 조수 시험 | `bun scripts/qa/beodeul-assistant-run.mts --project <폴더> --label fresh|existing --map <id> --new 100x100` → `verify-shots/beodeul-assistant/<label>/` |
| 증거 페이지 | `~/claude-viz/beodeul-assistant-proof.html` (http://mdc-server:18301/beodeul-assistant-proof.html) |

## 칸 자르기 규칙

- 칸마다 **아래층 = 땅 렌더**(포석·판석·물면·절벽·다리 상판·바닥 키트), **윗층 = 최종 그림이 땅과 다른 화소**(집·성·나무·소품·처마·연기·날개·배)를 불투명으로.
- 원본 한 바퀴 24장면(물 8·풍차 8·연기 12·배/분수/깃발 4)을 칸마다 계산해 주기 p(1·2·3·4·6·8·12·24)로 줄이고, p>1 이면 p칸을 이어 붙여 `animationStrips {baseTile, frames:p, fps:8}` 한 줄. 1,699줄. 한 줄은 시트의 한 행 안에 둔다.
- 같은 그림(같은 장면열)·같은 층·같은 통행은 한 칸을 같이 쓴다. 통행은 칸마다 다를 수 있어 키에 넣었다.
- 통행은 Python 점유 격자에서: 길·광장·성벽길·성문·다리·계단·잔교·풀밭(절벽 가장자리 포함) = 걸음, 물·절벽면·담·건물·소품·나무 = 막힘.
  계단은 절벽면 위, 다리는 물 위에 있으므로 계단·다리·성문·성벽길은 먼저 걸음으로 판정한다(이걸 빠뜨려 처음엔 문 앞 72곳 중 다수가 끊겼다).
  윗층 칸은 그 칸이 걸음이면 ★(사람 위에 그려짐, 처마·굴뚝·나무 윗부분), 막힘이면 y 정렬되는 막힌 물체.
- 시트는 오토타일이 없다(원본 자리에서 잘린 칸). 그래서 조수용 재료는 **키트**다: 구역 8(왕성·저택·포룸·성당 언덕·풍차 들·강/다리·서쪽 항구·항구, 두 층 채움), 건물 70(이름 있는 건물 12 포함)·소품 34·나무 8 조각(물체의 투명 그림을 원래 칸 오프셋 그대로 잘라 새 칸으로, 아래층 -1).
  `stamp_object({objectId:'kit:beodeul_city/<id>'})` 로 찍힌다(`sharedDesignCatalog.ts` `kitObjects`). 땅 재료 네 가지(`버들항 풀밭`·`길 포석`·`광장 판석`·`물`)는 오토타일 아닌 면 채우기 그룹이다.
- tileMeta 는 칸 22,784개가 모든 프로젝트에 실리므로 짧게(이름표·한 줄 설명·층·통행) 했다. 번들 JSON 6.5MB.

## 정본 저장·재로드 (2026-09-28)

- project id `ad468208-0287-4f27-a50e-20d10536a0cd`, `.oprn-projects/beodeul-city-20260928`, revision 1. 맵 `beodeul_v6` 100×100, 주민 이벤트 122.
- 재로드 `isDeepStrictEqual` 프로젝트·맵·타일셋 모두 true. 편집기 통행(`isPassable`) 대 Python 점유 격자 10,000칸 중 불일치 0(걸음 2,907칸).
- 재로드 맵을 저장소 렌더러(`scripts/qa-game/render.mts` → `editor/mapTileDraw`, 각 띠 0번 장면)로 그려 비교:
  주민 없는 원본과 **0화소 차이**, 주민 포함 `city6.png` 와 29,508화소(1.15%) 차이 — **전부 주민 122명 그림 상자 안**(상자 밖 0). 주민은 타일이 아니라 NPC 이벤트로 옮겼기 때문이다.
- 기존 프로젝트: 저장된 `saltflat-fields-20260928` 를 읽어 `ensureBundledTilesets` 를 돌리면 `beodeul_city` 와 참고문서 4용도가 생기고, 참고문서를 지운 사본은 4용도가 다시 채워진다.

## 조수 시험 — 「버들항 비슷한 로마풍 항구 도시를 깔아줘」

`scripts/qa/beodeul-assistant-run.mts`: 정본 SQLite 프로젝트를 읽고(편집기 로드처럼 `ensureBundledTilesets`), 100×100 `beodeul_city` 맵을 만든 뒤
Pi 런타임(`runPiAgent`, 채팅 패널과 같은 도구·참고문서 읽기 게이트)을 실제 모델로 한 번 돌리고, 결과를 같은 저장소에 저장·재로드·렌더한다.

- 모델: `klb/claude-opus-5.5`(생각 high). klb 는 번들 모델 목록에 없어 `~/.omp/agent/models.yml` 의 공급자 정의로 모델 객체를 만든다 —
  `piAgentRuntime.ts` `RunPiAgentOptions.model` 을 더했다(없으면 예전처럼 목록에서 정확히 찾는다). 키는 증거에 남기지 않는다.
- 도구 노출: 채팅 패널은 의도 선언(LLM)으로 쓸 만한 도구를 고른 뒤 core + 발견 도구 + 그 도구를 보낸다(`plainTurn.ts` → `buildSessionRegistryTools`).
  헤드리스에서는 선언을 지도 시공용으로 고정했다(33개). 전체 275개(약 600KB)를 매 호출 싣지 않기 위해서다. `find_tools` 로 넓힐 수 있다.
- 결과·도구 호출·판정은 `verify-shots/beodeul-assistant/{fresh,existing}/summary.json`·`trace.json`·`render.png` 와 증거 페이지에 있다.

### 결과 (2026-09-28, 두 번)

| | 새 프로젝트 | 기존 프로젝트(소금 평원 필드 사본) |
|---|---|---|
| project id / 폴더 | `2b631748-…` `.oprn-projects/beodeul-assistant-fresh-20260928` | `dc69bd7c-…` `.oprn-projects/beodeul-assistant-existing-20260928` |
| 시간 · 턴 · 도구 호출(실패) | 24분 · 40 · 178(2) | 24분 · 43 · 171(2) |
| 참고문서 | list 5 · read 27, 4용도 모두(문서·그림 22종) | list 5 · read 23, 4용도 모두(20종) |
| 구역 키트 | 8/8, 모두 원본 원점 | 8/8, 모두 원본 원점 |
| 새로 찍은 건물 · 소품 · 나무 | 23 · 10 · 31 | 27 · 16 · 33 |
| 문 앞 도달(큰길 62,33 에서) | 23/23 | 27/27 |
| 원본과 같은 칸 | 65.1% | 64.8% |
| 구역 밖 물체 칸(원본 1,855) | 1,069 | 1,232 |
| 저장 후 재로드 동일 | true | true (로드 때 `beodeul_city` 가 새로 생김, 기존 맵 5장 그대로) |

판정: 조수는 도구로 참고문서를 읽고 **버들항과 비슷한 도시를 깔았다.** 그러나 절반 이상은 구역 키트를 원본 좌표에 찍은 복사이고,
스스로 설계한 가운데 마을은 원본보다 성기고(물체 칸 58~66%), 길은 오토타일이 없어 포석 대표 칸 사각형이다.
강 윗줄기(33~36열 0~23행, 74칸)는 어느 구역 키트에도 없어 두 결과 모두 빠졌고, 기존 프로젝트 결과는 가운데 운하 72칸을 덮었다.
실패 2회는 두 번 모두 첫 `fill_region` 이 `layer is not defined` 로 죽은 편집기 버그(`constructionTools.ts` 결과 data 의 없는 변수)였다 — 고쳤다.
다음에 고칠 것: 강 전체를 한 키트로, 길 포석·물가에 오토타일, 문서의 「원본 좌표 = 정답」을 「원본은 예시, 새 배치 규칙」으로.

## 다음 방향 (보류 — 이번에는 다시 그리지 않음)

사용자가 다음 판 참고로 준 그림 세 장. 저장소에 두었다.

1. `tiledata/city-refs/noble-manor-forest-house-rmxp.jpg` — **귀족 저택**: 반목조 흰 벽, 붉은 비늘 기와 지붕과 지붕창, 창가 꽃상자,
   좌우 대칭 정형 정원과 자갈 십자 길, 화분 속 사이프러스, 가로등.
2. `tiledata/city-refs/outskirts-wooden-houses.png` — **성 밖 외곽 나무집**: 통나무·널판 집, 가파른 나무 너와 지붕, 모랫길, 우물 있는 자갈 광장.
3. `tiledata/city-refs/itch-structure-ref.jpg` — **조립 구조 참고**(화풍이 아니라 짜임): 저택·빅토리아풍 집을 재사용 부품의 쌓음으로 본다.
   - 부품: 지붕(가파른 모임·망사드 + 평평한 머리, 너와 줄, 밝은 용마루·어두운 처마) / 박공·지붕창 / 층 띠(처마돌림 선반으로 나뉨) /
     모서리·칸 사이 붙임기둥 / 되풀이되는 아치 창 칸 / 기단(주춧돌 줄).
   - 변형은 같은 부품에서: 민짜 / 덩굴(이끼·담쟁이가 지붕 끝·기둥을 타고 흘러내림, 밑동 덤불) / 부서짐.
   - 옆 탑: 둥근·팔각 탑에 원뿔 지붕, 본채에 붙는다.
   - 입구는 따로: 기둥 박공 현관, 꼭지 장식 기둥 사이 앞으로 나온 계단(계단은 걸음, 기둥은 막힘).
   - 낱개 소품: 담쟁이 아치, 낮은 돌 난간·담, 산울타리 덩이, 돌 사당·묘비.
   - 1px 어두운 외곽선, 왼쪽 밝은 면·오른쪽 그늘 면, 지붕 처마·선반 그림자로 깊이.
   → **버들항의 저택·귀족 구역을 이 부품 조립(지붕/박공/층 띠/붙임기둥/창 칸/탑/현관/계단)으로 옮기고 부품마다 덩굴 변형을 둔다.**
   지금 저택은 한 장짜리 그림(`bd-house-manor` 13×11)이라 부품으로 나뉘어 있지 않다.

## 남은 것

- 시트는 원본을 자른 칸이라 한 칸이 한 자리에서만 맞는다. 조수가 원본과 다른 배치를 만들려면 조각 키트와 땅 재료로 짓게 되고,
  땅 재료는 가장자리 오토타일이 없어 연석·물가가 끊긴다(원본의 연석은 구역 키트 안에만 있다).
- 16구역 QA 가 남긴 결함(막다른 길 다섯, 성 북쪽 물 띠 줄무늬, 일렬 반복)은 그림 그대로 옮겼다(「그대로 저장」 요청).
- 22,784칸 tileMeta 가 프로젝트마다 실린다(프로젝트 JSON 이 약 6MB 커진다). 칸 수를 줄이려면 땅 칸을 오토타일로 다시 그려야 한다.
