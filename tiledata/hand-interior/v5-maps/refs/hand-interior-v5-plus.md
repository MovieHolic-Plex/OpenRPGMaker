# 박물관·미술관 · 배 안 · 투기장 (interior-plus, 2026-10-14)

손 도트 v5 시트 끝에 덧붙인 조각(같은 팔레트 v6·같은 6단 명암)과 방 종류. 칸 번호는 덧붙이기만 한다(기존 칸 불변, ensureAtlasBiomeInteriorCurrent 가 기존 프로젝트 정의를 새로 고친다).

## 어느 도구로 (경계)
- 판타지·중세 박물관·미술관 전시실 → 이 칩셋 `build_hand_interior_room({layout:{program:"museum"}})`. 호러·고딕·흉가·저택 미술관 → gothic_manor `build_gothic_place({place:"gallery"})`(조수 라우팅이 호러 낱말로 나눈다).
- 배 안(선장실·조타실·배 주방·선원 숙소) → program `ship`, 아래 갑판(포 갑판·화물칸·배 감방) → `ship_hold`. 해적 항구·섬·난파선 바깥은 pirate_isles. 보고 있는 맵이 pirate_isles 면 그 칩셋의 배 안(compose_pirate_isles_map kind ship)을 쓴다.
- 투기장·콜로세움·검투사 방 → program `arena`(관중석과 모래 마당은 칸막이 없이 트인다).

## 예제(방 구성)
| program | 이름 | 방(id=종류) | 크기 |
|---|---|---|---|
| `arena` | 검투사 투기장 | stands=arena_stands · floor=arena_floor · cell1=gladiator_cell · armory=arena_armory · cell2=gladiator_cell | 24×28 |
| `museum` | 왕립 박물관 | gallery=museum_gallery · relics=museum_relics · sculpture=museum_sculpture · lobby=museum_lobby · natural=museum_natural | 31×19 |
| `ship` | 범선 갑판 아래(선장실·조타실·주방·선원 선실) | cabin=ship_cabin · helm=ship_helm · galley=ship_galley · crew=ship_crew | 25×20 |
| `ship_hold` | 범선 아래 갑판(포 갑판·화물칸·감방) | gundeck=ship_gundeck · cargo=ship_cargo · brig=ship_brig | 22×20 |

## 방 종류
museum_lobby 입구 홀 · museum_gallery 미술 전시실 · museum_relics 유물실 · museum_sculpture 조각실 · museum_natural 자연사실 ·
ship_cabin 선장실 · ship_helm 조타실 · ship_galley 배 주방 · ship_crew 선원 숙소 · ship_gundeck 포 갑판 · ship_cargo 화물칸 · ship_brig 배 감방 ·
arena_stands 관중석 · arena_floor 모래 마당 · gladiator_cell 검투사 방 · arena_armory 무기고.

## 바닥·벽면
바닥 deck(갑판 판자) · hold(짐칸 판자) · parquet(쪽모이 마루) · sand(투기장 모래) · sandstone(사암 포석). 벽면 hull(선체 늑골 판자) · cabin(선장실 판벽) · gallery(미술관 벽지) · arenawall(사암 벽).

## 가구(분류별 id)
- museum(29): plinth, plinth amphora, plinth helmet, plinth fossil, case gem, case crown, case sword, case scroll, relic cabinet, wide cabinet, painting landscape, painting sea, painting still life, painting grand, bronze warrior, stone sphere, lion statue, rope barrier 2, rope barrier 3, rope post, bench museum, skylight light, dragon skull, plaque stand, geode stand, shield display, mosaic panel, painted sarcophagus, map case
- ship(36): airship helm, anchor, cargo netted, chart table, hammock, rope coil, sea chest, ship bell, ship cannon, ship wheel, porthole, stern windows, captain bed, captain desk, barrel stack, cask rack, crate stack, sack pile, galley stove, pot rack, dice barrel, cannon east, cannon west, cannonball pile, powder keg, gunport, mast, capstan, ship ladder, deck grate, binnacle, instrument shelf, rope pin rail, life ring, anchor chain, ship bunk
- arena(19): tier seat 3, tier back 3, arena fence 3, portcullis, portcullis open, gate winch, gladiator rack, shield rack, arena banner, training dummy, archery target, armor bench, stone bench, water bucket, beast cage, arena emblem, war drum, laurel trophy, curule seat

## 배치 규칙
- 그림·명판·깃발에는 글자가 없다. 그림(hang)은 벽면 윗줄, 두 칸 이상 띄워 같은 높이로 건다. 진열장·받침대는 관람 통로(2칸 이상)를 남기고 줄을 맞춘다. 줄 기둥(rope barrier)은 귀한 전시물 앞 한 줄.
- 배 안: 대포는 옆벽(서쪽 cannon west · 동쪽 cannon east)에 붙여 포문(gunport)과 같은 줄, 포탄·화약통은 대포 곁. 해먹·침상은 벽 쪽, 가운데는 통로. 돛대(mast)는 방 가운데 한 개. 배 감방은 창살 줄(bars)로 나누고 문 칸을 비운다.
- 투기장: 관중석 의자(tier seat)는 줄마다 같은 간격, 사이 통로를 남긴다. 모래 마당은 비워 둔다(문장 emblem 하나·과녁·허수아비 정도). 철창문(portcullis)은 북쪽 벽 앞.
