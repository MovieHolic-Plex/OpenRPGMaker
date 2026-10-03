# 세계 지도 지형 편집 — 조수가 대륙·바다·섬·산맥을 바꾼다 (2026-10-03)

세계 지도(월드맵 키트, 96×72칸·16px)는 타일을 찍어 만들지 않는다. **지형 작업(ops)** 목록을 키트가 다시 그린다.
조수는 `read_world_terrain` 으로 칸 좌표를 보고 `edit_world_terrain` 으로 작업을 얹는다.
대륙을 해협으로 가르기, 섬, 산줄기·고개, 강, 숲, 바닥(사막·설원·늪…), 고원, 장소 옮기기까지 된다.

## 흐름

```
조수 ── edit_world_terrain(ops) ─▶ prepare: buildWorldmap(테마, 쌓인 ops + 새 ops)
                                    ├ 편집기: POST /v1/worldmap/build (동반 앱, scripts/lib/ohMyPiHttp.mjs)
                                    └ Bun 일꾼·헤드리스: scripts/lib/worldmapBuild.mjs 를 프로세스 안에서(setWorldmapBuilder)
                                         └ python3 tiledata/worldmap-kit/kit/build_world.py --theme T --terrain <json> [--preview]
        run: 결과 PNG → assets.uploaded["worldmap_<mapId>_image"]
             tilesets["worldmap_<mapId>"]  칸마다 한 타일(tilesPerRow 96, 6912칸), 통행 = 키트 걷기 표(world.walk)
             maps[mapId]  lowerTiles 0..6911, locations = 여정 장소, worldmapSource = {theme, ops, terrainId, palette}
```

| 파일 | 역할 |
|---|---|
| `src/editor/tools/worldTerrainTools.ts` | 두 도구. 스키마는 `kit_terrain.py` 의 거울 — 자유 키 객체 금지(Gemini 400) |
| `src/editor/worldmap/worldmapBuild.ts` | 빌드 요청·결과 타입, 기본 빌더(fetch), `setWorldmapBuilder` |
| `scripts/lib/worldmapBuild.mjs` | python 키트 실행 → `{imageDataUrl, world, ascii, journeyCheck, warnings}` |
| `tiledata/worldmap-kit/kit/lib/kit_terrain.py` | ops 검사·적용(make_map_v4 목록에 다각형을 얹는다), `coverage` 경고 |
| `tiledata/worldmap-kit/terrains/<id>.json` | 이름 붙은 지형(예: `archipelago` — 군도 테마가 쓴다) |
| `scripts/qa-game/worldmap-terrain-offline.mts` | 모델 없이 도구 사슬 끝까지(읽기 → 틀린 작업 → 새 지도 → 작업 누적) |
| `scripts/qa/runtime/worldmap-terrain.scenario.mjs` | 출하 플레이어로 걷기(절벽은 막히고 평지는 걸어진다) |

## 계약

- **작업은 쌓인다.** 맵의 `worldmapSource.ops` 뒤에 새 ops 를 잇는다. `replace:true` 면 갈아 끼운다.
  테마 자체 지형(`themes/<id>.json` 의 `terrain`)은 그 아래 깔리고 저장 ops 에는 들어가지 않는다.
- **미리보기**(`preview:true`)는 픽셀 렌더 없이 칸 배열·도식 PNG·여정 검사만(1~3초). 저장하지 않는다.
  실제 빌드는 지형이 바뀌면 약 2분. 지형 서명별 캐시(`~/.cache/oprn/worldmap-kit/terrain-<sig12>`).
- **실패는 문장으로 돌려준다.** 장소 발자국이 물 위, 길을 낼 수 없음, 바다 장벽이 너무 좁음, 여정 검사 불일치 —
  `ToolError(code: worldmap-build-failed | journey-check-failed)`. 조수는 그 문장대로 고친다.
- **경고**(`ops[i]` 번호 + note): 숲·바닥이 덜 먹으면 이유별 칸 수, 사구는 서남 대사막 안에만 남는다, 섬이 다른 땅에 붙음·지도 끝,
  화산 고리가 작음. 경사로 면 없음도 경고.
- **장소 여정 규칙**: `places` 줄 끝에 「n막에 무엇으로 처음 닿는다 · 열쇠 장소 · 장벽 뒤 · 길: …」(`kit_terrain.place_rules`).
  여정 실패 문장도 그 말로 풀어 준다(`kit_terrain.explain`). 막힌 길은 모두 한 번에, 어디까지 가서 무엇에 막혔는지 좌표로.
- **지역 팔레트**(desert-east 등)는 편집으로 정한 바닥을 덮지 않는다. `themeNote` 가 테마의 칠 방식·자기 지형을 알려 준다.
- 키트 지도가 아닌 맵(`worldmapSource` 없음)에 덮어쓰지 않는다(`not-worldmap`). 새 id 가 남의 맵이면 `map-id-taken`.
- 기존 이벤트는 유지하고, 걸을 수 없게 된 칸에 놓인 이벤트를 경고로 알린다.
- `preservesAuthoredRaster: true` — 지도 그림이 곧 타일이므로 타일 보정 루프가 손대지 않는다.

## 글자 지도

`read_world_terrain`/`edit_world_terrain` 결과의 `ascii` 첫 줄이 범례다.
`~ 바다 r 강 . 초원 s 사막 d 모래언덕 n 설원 … ^ 산 M 메사 V 화산 * 숲 = 길 / 경사로 @ 장소`.
둘째 줄은 x 의 10 자리, 줄 머리는 y. 좌표는 모두 칸(x 오른쪽, y 아래).

## 조수 역할 적대 시험 (2026-10-03)

에이전트에게 조수 역할로 실제 요청(해협+산맥, 설원 호수+화산섬, 사막을 정글로+강+신전 이동, 군도에 섬·산맥)을 도구만으로 풀게 했다.
1차: 요청당 미리보기 3~6번, 실패 문장(「막 불일치 … BFS … R2」)으로는 못 고쳤다. 고친 뒤 2차: 1~4번, 12개 결함 중 8 해결·4 부분.
2차에서 나온 것(지역 팔레트가 정글을 모래빛으로, 섬 붙음 무경고, 화산 봉우리 없음, density 0.9 로도 숲이 안 남)도 고쳤다.
증거: `verify-shots/worldmap-terrain/qa-assist-r1/REPORT.md`, `qa-assist-r2/REPORT.md`.

## 함정

- 숲은 sand·dune·물·길·장소 둘레에 안 자란다 → 먼저 `biome` 으로 바닥을 바꿔라.
- 사막 신전 같은 열쇠 장소는 자기 막의 장벽 안에서만 옮길 수 있다 — 규칙상 안 되는 요청은 조수가 사용자에게 이유를 설명해야 한다.
- 원래 화산(77,16)의 원뿔은 장소 아이콘이다. 편집 화산의 원뿔은 `kit_world._paint_volcano_peaks` 가 지형 그림에 직접 그린다.
- 바다로 자를 때 섬 사이 바다가 좁으면(배가 필요한 여정 장벽) 「바다 장벽이 너무 좁다」. 작은 섬을 장벽 바다 안에 두면 장벽이 좁아진다.
- Pi 조수 도구는 Bun 일꾼(`scripts/lib/piAgentRuntime.ts`) 안에서 돈다. 편집기 기본 빌더(상대 `/v1` fetch)는 거기서 닿지 않으므로
  일꾼이 시작할 때 `setWorldmapBuilder(buildWorldmap)` 를 건다. 새 실행 경로를 만들면 같은 줄이 필요하다.
- 도구 준비 단계 `prepare(args, project)` 가 프로젝트를 받는다(2026-10-03 확장). 쌓인 ops 를 합치려면 맵을 봐야 해서다.
