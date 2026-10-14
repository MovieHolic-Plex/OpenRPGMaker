# SF 정거장·네온 거리 번들 타일셋 (sf_station)

우주 정거장 실내, 연구 기지, 달·식민지 야외, 사이버펑크 네온 거리를 **코드 손 도트 조각**(16px, 3/4 탑뷰)으로 그렸다.
object-gate 영수증이 그림 화소 해시와 맞는 조각만 공용 번들로 굽는다.
새 프로젝트는 처음부터 이 타일셋을 갖고, 기존 프로젝트는 로드할 때 `ensureBundledTilesets` 가 심는다.
조수는 SF 낱말을 들으면 이 칩셋과 맵 구성기 `compose_sf_station_map` 으로 간다.

## 식별자

| 항목 | 값 |
|---|---|
| 타일셋 id | `sf_station` |
| 텍스처 키 | `tex_sf_station` |
| 계열 | `oprn-scifi` (라벨 "SF 정거장·네온 거리", `src/project/tilesetFamily.ts`) |
| 시트 | `public/assets/sf-station/sf-station-chipset.png`, 16px 칸, 48열 |
| 번들 소유 접두 | 키트·오토타일·참고문서 `sf-`, 타일 그룹 `sf:` |
| 기본 바닥 | 칸 60 (갑판, `defaultMaps.ts` BUNDLED_PLAIN_GROUND_TILES) |

## 현재 굽기 (2026-10-14)

- 조각은 172개다.
  - 정거장 실내 55
  - 정거장·식민지 야외 44
  - 네온 거리 44
  - 바닥·벽 29
- 172개 모두 Opus 가 다시 그렸다. 그 전의 Sonnet 초안은 「너무 거칠다」는 사용자 지적으로 전부 버렸다.
- 172/172 가 object-gate 를 통과했다. 판정자는 gemini-3.8-flash ×4 과반이고, 영수증은 `harness-data/object-gate/receipts/`.
- 굽기 결과는 다음과 같다.
  - 칸 1,169
  - 키트 165
  - 오토타일 8
  - 타일 그룹 38
- 움직이는 칸은 아직 없다.
- 참고문서는 6용도·문서 22·그림 43(경로만)이다. 완성 예제 6판과 변조 29건을 넣었고, 변조 29건은 모두 검사가 잡는다.

- **화풍 정렬 2026-10-14(버들항 기준):** 윤곽을 검정(#06070e)에서 맞닿은 재질 램프의 최암 톤으로 바꿨다(`sf_core.selout`, 금속은 #1c2230, 새 색 없음). 갑판 판·격벽 천장·연구실 타일·벽 앞면에 3단 잔결·윗면 빛 턱·모서리 그늘·리벳 그림자·긁힘을 넣었다. 다시 받은 영수증은 PASS 138 / FAIL 6. FAIL 6조각(호버카 시안·화물 드론·상자 더미·함장 의자·화물 팔레트·엘리베이터 문)은 옛 검정 윤곽 그림으로 되돌렸다(`KEEP_OL`). 지표는 칸당 고유색 10/16→10/15, 어두운 5% V 14→32다. 남은 이질감은 넷이다. 검은 장비(cable 램프: 서버 랙·화면 바탕)가 아직 거의 검정이다. 같은 판 반복은 변형 4개 안에 머문다. 기물 앞면은 2~3단이다. 야외(레골리스·아스팔트)는 손대지 않았다.

관문에서 자주 떨어진 형태는 「정면 입면도 · 윗면 0행」이었다. 고친 방법은 아래와 같다.

- 윗면을 5~8행 이상의 밝은 판으로 그린다.
- 지붕을 사다리꼴로 그린다.
- 윗면 위에 물건을 얹는다(루프랙·택시 등·태양광판).
- 둥근 몸체는 타원 윗면을 보이게 한다.

종류는 정직하게 바꿨다. 호버바이크는 `other`, 가로등은 `column`, 이층 침대·냉동 포드는 `tall_furniture` 다.
점수나 기준을 낮춘 곳은 없다.

## 맵 구성기 — `compose_sf_station_map`

정본 코드는 `src/project/sfStationComposer.ts`(순수 함수)와 `src/editor/tools/sfStationTools.ts`(도구) 두 파일이다.
견본을 붙이지 않고 규칙과 씨앗으로 짠다. 같은 인자는 같은 맵이 나오고, 씨앗이 다르면 다른 맵이 나온다.

| kind | 구성 | 권장 | 하한 |
|---|---|---|---|
| station | 위 로비(전망창 벽·홀로 테이블·벤치 무리·엘리베이터/에어록 문), 5줄 복도, 아래 선실(2칸 이상)·식당·위생실 | 44×32 | 34×26 |
| lab | 실험실, 복도, 의무실·냉동 수면실·서버실·수경 재배실·창고 | 40×30 | 32×24 |
| street | 북쪽 고층·가게 줄(골목 1~2), 2줄 보도, 4줄 도로·횡단보도·호버카, 광장 노점, 남쪽 가게 줄 | 48×30 | 36×26 |
| moonbase | 레골리스, 다져진 길, 북쪽 건물 줄(가지 길), 착륙장·셔틀, 비콘·장비, 바위·크레이터 | 48×32 | 36×26 |

계약은 다음과 같다.

- 실내는 맵 전체를 벽 천장 오토타일(`sf-at-wall-hull`/`-white`)로 채운 뒤 방을 판다.
- 방 북쪽 아래 2줄에는 벽 앞면(`wall-face-*`)을 깐다.
- 문은 2칸 폭 남북 통로이고 바닥은 `deck-hazard` 다.
- 기물은 `stampSafe` 로 찍는다. 찍을 때마다 출발 칸에서 모든 문·접근칸에 닿는지 BFS 로 확인하고, 막으면 되돌린다.
- 투명 덧그림 칸은 2층, 몸체는 3층에 둔다.
- 도구는 복제본에서 짠 뒤 반영한다(중간 실패 시 맵 무변경).
- 짠 뒤 `compactMapLayers` 를 부르고, 구역 이름표를 태그 `sf-area` 로 단다(`labelSfAreas`).
- 막힌 칸 위의 이벤트는 가까운 통행 칸으로 옮긴다.
- 손댄 맵은 `replace:true` 를 줘야 다시 짠다.

시험 출력은 테스트 러너 없이 vite-node 로 낸다. 워크트리 루트에서 다음을 실행한다.

```
SPECS="station:1,street:2" OUT=/tmp/sfc/out.json node_modules/.bin/vite-node scripts/content/sf-station/compose_probe.ts
```

## 조수 연결 — `src/ai/sfStationPolicy.ts`

- **낱말:** 우주 정거장, 우주선, 함교, 콜로니, 달·월면·화성·행성·궤도·연구 기지, 사이버펑크, 네온 거리·도시·골목, 미래 도시, SF, space station, cyberpunk, moon base, sci-fi 를 SF 낱말로 본다.
  - 「네온사인 가게」「학교 과학실」「일본 상가 거리」는 SF 로 잡지 않는다.
  - 탐침은 `scripts/content/sf-station/route_probe.ts` 다.
- **순서:** `plainTurn.ts` 에서 jp_city 보다 먼저 본다(「네온 거리」가 일본 도시로 새지 않게). SF 대상이 잡히면 jp_city·고딕·버들항 노트는 붙지 않는다.
- **노출 도구:** `SF_STATION_EXPOSED_TOOLS` — compose_sf_station_map, create_map, resize_map, show_map_region, list_map_locations, 참고문서 둘, stamp_object, fill_region, paint_tiles, check_reachability, ask_tileset_change, create_transfer_pair, link_maps.
- **글이 들어가는 자리:**
  - 노트는 `formatSfStationNote`(`executionRoute.ts`)다.
  - 시스템 프롬프트 포인터·상세 줄은 `sfStationPromptLines`(`systemPrompt.ts`)다.
  - 시작 구상 줄은 `startVariety.ts` KIT_BUILD_LINES 다.
- **컨셉 피드:** `src/concepts/format.ts` BUILDABLE_CONCEPT_TILESETS 에 `sf_station` 을 넣었다. `harness-data/game-concepts/seed.json` tilesetHints 에도 SF 줄을 더했다.
- **문장 규칙:** 노트·문장에 PAW 게이트 낱말(현대·모던·modern)을 쓰지 않는다.

## 참고문서 — `scripts/content/sf-station/sf_refs.py`

용도는 다음 여섯이다.

- `sf-start` — 읽는 순서·층·실행 순서·그룹/오토타일 사전·시트
- `sf-interior`
- `sf-outdoor`
- `sf-street`
- `sf-terrain`
- `sf-check`

묶음 용도마다 조각 사전(정확한 1층/위층 배열·통행 글자·문 접근칸), 키트 그림, 완성 예제, 정상/오류 그림을 둔다.

- **완성 예제:** 구성기 실제 출력이다. 원본은 `tiledata/sf-station/examples/*.json` 이고, 1·2·3층 전체 배열과 원본 해상도 그림을 담는다.
- **정상/오류:** 한 가지만 바꾼 실제 변조를 같은 검사(`SF-LAYER`·`SF-CUT`·`SF-OVERLAP`·`SF-ISLAND`·`SF-DOOR-BLOCKED`)로 돌렸다.
- **그림:** `public/assets/sf-station-references/` 에 두고 JSON 에는 경로만 넣는다.

## 다시 굽기

모든 명령은 `scripts/content/sf-station/` 에서 실행한다.

1. `python3 sf_all.py status` — 조각 등록·관문 상태(영수증 해시 일치)를 본다.
2. 조각을 고쳤으면 그 조각만 다시 `object-gate review` 한다. 그림이 한 화소라도 바뀌면 영수증이 무효다.
3. `python3 sf_bake.py` — 시트·정의 JSON·핀을 쓴다. 핀(`tiledata/sf-station/pins.json`)은 덧붙이기 전용이라 칸 번호가 유지된다.
4. 구성기를 바꿨으면 `compose_probe.ts` 로 예제를 다시 낸다(위 SPECS 예).
5. `python3 sf_refs.py`

조각 모듈은 `sf2_interior.py`·`sf2_outdoor.py`·`sf2_street.py`·`sf2_terrain.py`(v2, Opus)다.
도우미는 `sf_core.py`·`sf_kit.py` 이고, 옛 v1 모듈은 v2 가 같은 id 로 덮어쓴다(`sf_all.py` MODS 순서).

## 알려진 한계

- 움직이는 칸(네온 깜빡임·홀로그램)이 없다.
- 층 이동 칸(계단)이 없다. 엘리베이터 문에 이동 이벤트를 단다.
- 사람·로봇 칩이 없다. 공용 Actor 칩을 쓴다.
- 구성기는 한 맵 안의 방 배치만 한다. 맵 사이 연결(moonbase 문 ↔ lab 복도)은 조수가 `create_transfer_pair` 로 한다.
