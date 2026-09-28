# 포켓몬풍 완결 게임 「몬스터 테이머」 (2026-09-28)

`createScarloxyPokemonDemoProject()` 는 스타터부터 챔피언 엔딩까지 끝까지 플레이되는 19맵 게임이다.
맵은 네 몬스터 칩셋(마을 부품·실내·체육관/해변·동굴 — `teaching-assistant-tilesets.md` 「몬스터 …」 절)으로 그렸다.

## 진행

새싹 마을(집·연구소·센터, 스타터 3택) → 1번 도로 → 이끼 마을 + 풀 체육관(배지 1) → 바위굴 1·2층
→ 파도 마을 + 해변·부두(라이벌 2) + 물 체육관(배지 2) → 3번 도로 → 잿불 마을 + 불 체육관(배지 3)
→ 챔피언 로드(라이벌 3) → 챔피언의 탑(챔피언 세라) → `ending_pkmn_champion`.

관문 경비원 셋(배지 1·2·3)과 챔피언 로드 끝 라이벌이 길을 막고, 체육관마다 바닥 스위치 → 차단기 퍼즐이 관장 앞을 막는다.
라이벌 무리는 `var_pkmn_starter`(1 불·2 물·3 풀, 박사가 스타터를 줄 때 설정)로 상성 스타터를 고른다.

## 파일

| 파일 | 소유 |
|---|---|
| `scarloxyPokemonWorld.ts` | 계약: 맵 id·크기·연결 좌표(`PKMN_LINKS`)·스위치(`PKMN_FLAGS`)·관문·파일 소유 |
| `scarloxyPokemonDemoGame.ts` | 코어: 시스템 설정, 새싹 마을·1번 도로, 종·기술·상태, 스위치 정의, 지역 설치 호출 |
| `scarloxyPokemonInteriors.ts` | 새싹 마을 실내 3종(기존 `easyrpg_chipset_interior`) |
| `scarloxyPokemonRegionA.ts` | 이끼 마을·센터·풀 체육관·바위굴 1/2층 (`installPkmnRegionA`) |
| `scarloxyPokemonRegionB.ts` | 파도 마을·센터·물 체육관·3번 도로, 라이벌 2 (`installPkmnRegionB`) |
| `scarloxyPokemonRegionC.ts` | 잿불 마을·센터·불 체육관·챔피언 로드·챔피언의 탑, 라이벌 3, 엔딩 정의 (`installPkmnRegionC`) |
| `scarloxyPokemonRegions.ts` | A→B→C 설치 후 관문 출구 잠금·체육관 퍼즐 순서(아래) |
| `scarloxyCast.ts` · `scarloxyCastEvents.ts` | 배역 → 걷기 그림·얼굴, `castGraphic` / `castFace` / `castLines` |
| `scarloxyExtraSpecies.ts` | 추가 11종·뒷모습 30종·울음소리 |

id 접두어: 지역 A `*_pkmn_a_*`, B `*_pkmn_b_*`, C `*_pkmn_c_*`. 지역 파일은 서로를 모르고 계약만 본다.
지역 설치 함수는 같은 id 가 있으면 건너뛴다(기존 테스트가 참조하는 `map_pkmn_town`·`map_pkmn_route`·`troop_pkmn_*` 는 그대로).

## 진행을 데이터로 드러내는 두 보정 (`scarloxyPokemonRegions.ts`)

플레이는 경비원·차단기 그림만으로도 맞지만, 오프라인 검사기는 **이벤트 조건**만 읽는다. 그래서:

- **관문 출구 잠금**: 관문 출구 칸의 이동 페이지에 배지 스위치 조건을 건다(챔피언 로드 → 탑은 `sw_pkmn_rival_3`).
- **체육관 퍼즐 순서**: 바닥 스위치가 `sw_pkmn_gym_<속성>_open` 도 켜고, 관장 전투 페이지가 그것을 조건으로 삼는다.
  스위치 전 관장은 힌트 페이지만 말한다(차단기 때문에 원래 닿지 않는 칸).

챔피언 전투 직전에는 `recoverAll` 로 전회복한다(원작 리그 관례).

## 검증

```bash
node_modules/.bin/vite-node --root . scripts/qa/runtime/pkmn-game-dump.mts qa-runs/pkmn-game-l99/project.json --starter-level 99
bun scripts/qa-game/check.mts qa-runs/pkmn-game-l99 --budget-ms 240000   # 막힘 0, 자동 플레이가 엔딩 도달
node_modules/.bin/vite-node --root . scripts/qa/runtime/pkmn-full-game-fixture.mts
npm run qa:runtime -- --scenario pkmn-full-game                          # 출하 player 에서 지역 맵 14비트
```

`--starter-level` 은 검사 전용 사본이다. 자동 플레이는 야생에서 레벨을 올리지도 포획하지도 않고 관장에게 곧장 걷기 때문에,
5레벨 스타터 그대로 돌리면 첫 관장에서 진다(그 결과 자체가 「진행 사슬은 맞고 레벨이 모자라다」는 뜻이다).
전투 밸런스는 지역마다 `simulateBattle` 로 확인했다: 관장 A Lv12 98–100%, 라이벌 3 Lv28 85–100%, 챔피언 5마리 Lv28 93–98%(3마리면 3–13%).

## 알려진 한계

- 울음소리(`scarloxy-cry-*`)는 전투에서 자동 재생되지 않고 편집기 효과음 목록에도 없다.
- 새 얼굴(`scarloxy-face-*`)은 이벤트 명령으로만 쓰이고 편집기 얼굴 선택기 목록에는 아직 없다.
- 전투 화면에 트레이너 그림 자리가 없어 트레이너전은 인트로 문구로만 표시된다.
- 이미 저장된 프로젝트의 데모 맵은 바꾸지 않는다(저작 콘텐츠). 새 게임은 편집기 메뉴의 포켓몬풍 데모로 만든다.

