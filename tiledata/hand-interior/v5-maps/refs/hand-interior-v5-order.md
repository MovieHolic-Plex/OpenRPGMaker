# 손 도트 실내 (atlas_biome_interior) — 읽는 순서

실내(집·가게·여관·저택·교회·성 방·지하)는 이 칩셋 하나로만 짓는다. 옛 실내 칩셋(easyrpg_chipset_interior · tibo_interior_expanded · LPC 가구)은 폐기됐다.
칩셋: `atlas_biome_interior`, 계열 `oprn-atlas`, 16px, 시트 가로 48칸, 칸 6268개(그림 public/assets/atlas-interior/interior-chipset.png).
원본: tiledata/hand-interior/v5(손 도트 Python, 건물 25동 26맵). 칸은 scripts/content/hand-interior/build_tileset.py 가 잘랐다.

## 읽는 순서
1. 이 문서 → 2. `hand-interior-v5-rules`(구조 규칙·사용자 판정) → 3. `hand-interior-v5-dictionary`(바닥·벽면·천장·탁자·줄·단 칸 번호) →
4. 짓는 건물과 가장 가까운 예제(`hand-interior-v5-map-*`: 입력 인자 + 네 층 정답 배열 + 그림) → 5. `hand-interior-v5-errors`(오류 그림과 코드).
가구는 `list_hand_interior_parts({room:"빵집"})`(방 종류·건물 → 예제에 쓰인 가구를 종류별로)와 `{query:"여관 벽"}`(설명·쓰는 방·놓는 곳·짝 소품까지)으로 찾는다.
`hand-interior-v5-objects-*`(가구 사전, 칸 번호 포함)는 도구 결과로 모자랄 때만 한 분류씩 읽는다.

## 짓는 순서 (한 번의 도구 호출)
1. 방 목록을 글로 먼저 정한다: 방마다 용도·앵커 가구·드나드는 문·손님/주인 동선. 공간이 남으면 맵을 줄인다.
2. `plan` 을 쓴다: '#' 막힘, '.' 실내. 외벽 한 칸 두께, 방 사이는 '#' 칸막이. 맨 아래 줄의 '.' 틈 = 거리 출입구.
3. `floor`·`wall` 기본값, 방마다 다르면 `zones`(칸막이 뒤 방 단위로만 벽 재질을 바꾼다).
4. 가구: `objects`(v5 가구 id, 좌표 = 발밑 왼쪽 위), 탁자·카운터 = `tables`(자동 타일, 아무 W×H), 깔개·울타리·창살 = `lines`, 단 = `daises`, 탁상 물건 = `goods`(윗면 가구 칸 위).
5. `build_hand_interior_room` 을 부른다. 벽면(막힌 칸 바로 아래 두 줄)·천장 띠·바닥 그림자는 도구가 plan 에서 만든다 — 손으로 칠하지 않는다.
6. 결과의 오류(error)는 맵을 만들지 않는다: 메시지의 좌표를 고쳐 다시 부른다. 경고(unreached-floor·unreachable-piece)는 가구가 길을 막은 것 — 고친다.
7. 층이 여럿이면 층마다 한 맵. 위로 가는 계단(`stairs up wood/stone`, 북쪽 벽 앞 3칸) 칸에 `links` 로 위층 도착 칸을, 위층의 `stairwell down` 칸에 아래층 도착 칸을 단다(도착 칸은 계단 바로 아래 바닥).
8. `show_map_region` 으로 그림을 확인하고, 이상한 곳을 고쳐 `replace:true` 로 다시 짓는다.

## 부품 id 찾기
`list_hand_interior_parts` — 인자 없이 = 바닥·벽면·천장·탁자·줄·단·탁상 물건 목록 + 가구 분류 + 방 종류·건물 id.
`{room:"빵집"}`·`{room:"여관 객실"}`·`{room:"부엌"}` = 예제 26맵을 방 단위로 나눠 그 방에 쓰인 가구를 종류(floor·wall·hang·flat·table·line·dais)별로, 쓰인 방 수·개수와 함께.
`{query:"여관 벽"}` = id·이름·분류·태그·설명을 모두 찾고 모든 낱말이 맞는 것만 준다. 12종 이하면 행마다 desc·tags·place·pair, 많으면 desc 한 줄.
`{category}` = 한 분류의 가구 행.
가구 분류(28): veg 채소 23 · fish 생선가게 26 · bake 빵집 24 · pharm 약국 28 · misc 잡화 22 · butcher 정육점 7 · home 가구·살림 98 · smith 대장간 12 · tavern 선술집 5 · church 예배당 22 · study 서재 9 · kitchen 부엌 12 · magic 마법 4 · decor 장식 35 · tailor 재단사 5 · shop 상점 10 · hobbit 호빗 굴 5 · mine 광산 8 · elf 엘프 궁정 5 · hall 연회장·알현실 6 · tower 마법사의 탑 4 · dungeon 지하 감옥 6 · magitek 마도 기관 6 · opera 극장 12 · casino 카지노 7 · stable 마구간 6 · ship 배 선실 4 · crypt 지하묘지 3.

## 층과 통행 (엔진 판정)
- 1층 = 구조: 바닥(밟음 o) · 벽면(막힘 x) · 천장 띠·공허(막힘 x).
- 2층 = 바닥 무늬: 깔개·선로·단·배수 창살·아래로 가는 계단 구멍(밟음 o, 캐릭터 밑).
- 3·4층 = 가구 조각: 발밑 칸 = 막힘 x(캐릭터와 줄 순서로 겹침), 솟은 칸(발밑 위로 튀어나온 그림)·벽 걸이 = ★(캐릭터 위에 그리고 통행은 아래 층), 위로 가는 계단 발밑 = o.
- 탁상 물건 = 4층, 막힘 x(가구 칸 위에만).
