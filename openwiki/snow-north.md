# snow_north — 북방 설원 칩셋 (2026-10-14)

눈 덮인 북방(노르딕·시베리아풍) 세계를 짓는 칩셋이다.

- **야외:** 통나무 오두막 넷(작은·중간·촌장·뗏장 지붕), 씨족 긴 집, 벌꿀술 회관, 통널 교회, 사우나, 훈제막, 얼음 낚시 오두막, 얼음집, 망루, 다리 창고, 물레방아간, 헛간, 대장간, 목책 문루, 얼음 동굴 입구, 얼어붙은 폭포.
- **소품:** 가문비·자작·바위·눈더미, 장작더미·덕장·가죽 틀·화로·모닥불·굴뚝 연기·썰매·스키 걸이·통·상자·자루·우물·불바구니 기둥, 노점 셋, 추상 무늬 오로라 깃발(벽걸이), 얼음 담·목책·울타리, 얼음 낚시 자리, 뒤집힌 배, 천막.
- **바닥:** 오토타일 6(다진 눈길·얼음·툰드라·서리 풀·진창·열린 물).
- **실내 다섯:** 통나무 오두막·씨족 긴 회관·선술집·사우나·얼음 동굴.

16px · 3/4 탑뷰 · 코드 손 도트 · 잠금 팔레트(차가운 파랑·흰색 + 따뜻한 창불)로 그렸다. 사람·글자·상표·**눈사람은 없다**. 문은 사람 크기다(폭 약 16px, 높이 24px 이상).
버들항(beodeul_city)·마법 학교(wizarding_world)의 눈 조각은 다시 쓰지 않았다.

## 한 줄 지도

| 무엇 | 어디 |
|---|---|
| 그림(코드 손 도트) | `scripts/content/snow-north/art/` — `terrain.py`(바닥 낱칸 22 + 오토타일 6, 47 모양 + 속 변형 2), `buildings.py` 19, `props.py` 58(프레임 포함), `interior.py` 48. 그리개 `px.py`(`MI`·`cut_face`)·`kit.py`·`bparts.py`·`autotile.py`, 잠금 팔레트 `palette.py` |
| 관문 내보내기 | `tiledata/snow-north/<묶음>/_gate/sn-<id>.png` + `items.jsonl`. 조립 그림(목책 벽·울타리 마당·굴뚝 연기 얹은 오두막)은 `art/gate_assembled.py` → `tiledata/snow-north/_assembled/` + `manifest.json`(부품 좌표). 오토타일 칸은 견본 `terrain/_gate/sn-at-<id>.png` 의 칸 바이트로 덮는다 |
| 굽기 | `python3 scripts/content/snow-north/bake_sn.py [--dry]` → `public/assets/snow-north/snow-north-chipset.png`(975칸, 48열) · `src/assets/snowNorth{Tileset,Sheet}.json` · `tiledata/snow-north/bake-{pins,report}.json`(핀은 덧붙이기 전용) |
| 참고문서 | `python3 scripts/content/snow-north/bake_refs_sn.py` → `src/assets/snowNorthReferences.json`(이미지 바이트 없음, 문서 10·그림 11) + `public/assets/snow-north-references/*.png`. 예제 7장은 구성기의 실제 출력이다. 변조 5종(문 앞 막힘·집 겹침·길 끊김·문 칸 열림·오토타일 모양 어긋남)이 모두 잡히는지 굽기 때 단언한다 |
| 타일셋 정의·기존 프로젝트 심기 | `src/project/defaults/snowNorth.ts`, `defaultAssets.ts` 의 `ensureBundledTilesets`, 계열 `oprn-snow` = 「북방 설원(도트)」(`tilesetFamily.ts`), 기본 바닥 1번 = 눈밭(`defaultMaps.ts`) |
| 구성기(순수 함수) | `src/project/snowNorthComposer.ts` `composeSnowNorth(spec, pal)` — 야외 village·lake·cave·market, 실내 cabin·longhall·tavern·sauna·ice-cave |
| 조수 도구 | `src/editor/tools/snowNorthTools.ts` — `compose_snow_north_map`, `link_snow_north_interior`. 구역에 `COMPOSED_LAYOUT_TAG` 가 붙어 빈 바닥 수리 권고에서 빠진다 |
| 조수 길잡이 | `src/ai/snowNorthPolicy.ts`. plainTurn 의 첫 판정 사슬 sengoku → steampunk → sf → prehistoric → **snowNorth** → jpCity → … → beodeul 에 들어 있다. 같이 묶인 것: 컨셉 힌트 「북방 설원·눈 덮인 북쪽 마을」, `BUILDABLE_CONCEPT_TILESETS`, startVariety, startRoutePaint(길 재료·시작 맵 46×36), 월드맵 테마 `snow-north` 의 마을 칩셋(`worldTerrainTools.ts`, 옛 `forest_harmony_snow` 대신) |
| 장면 QA | `node_modules/.bin/vite-node scripts/content/snow-north/qa/compose-scene.mts -- out.json <style> W H seed` → `python3 scripts/content/snow-north/qa/render_scene.py out.json out.png 1`(렌더 + MZ 통행 검증) |

## 버들항 눈 기후와의 경계 (결정)

| 요청 | 가는 곳 |
|---|---|
| 북방 낱말(북방·북쪽 마을·바이킹·노르딕·시베리아·툰드라·오로라·통널 교회 …) | 언제나 snow_north |
| 일반 눈 낱말(설원·눈 마을·눈 덮인·겨울 마을·얼어붙은 호수·얼음 낚시·얼음 동굴 입구) | snow_north. 단 문장이 **버들항**을 말하거나, 지금 맵이 버들항이고 **마을**을 말하면 가로채지 않는다(`author_beodeul_town theme:"snow"` 몫) |
| 버들항 맵 위의 «얼어붙은 호수 낚시터»·«얼음 동굴 입구»·«겨울 장터» | snow_north 새 맵. 버들항 마을 도구로는 짓지 못하는 장소다 |
| 「얼음 동굴」 + 던전·미궁·광산 | 잡지 않는다(던전 칩셋 몫) |

모든 경우 프로젝트에 snow_north 칩셋이 있을 때만 잡는다. 새 프로젝트는 번들로 이 칩셋을 갖는다.

## 오토타일

엔진 `autotileGroups`(8이웃, 47 모양, 비트 N1 E2 S4 W8 NE16 SE32 SW64 NW128)를 쓴다. 그룹마다 속 변형이 둘이다(`interiorVariants`).
얼음 그룹은 열린 물 칸을 이어진 이웃으로 본다(`connectTileIds`). 그래서 얼음 구멍 둘레에는 눈 둑이 생기지 않는다.
구성기는 칸마다 땅 이름(snow · pack/ice/tundra/frost/slush/water · tile:<조각>)을 들고 있다가 `resolve()` 에서 모양을 고른다. 맵 밖은 같은 덩이로 센다.

## 칸 통행 (bake_sn.py)

MZ 규칙을 따른다. 맨 위 칸이 ★ 가 아니면 그 칸이 통행을 정한다.
- 키 큰 키트(`FOOT`: 이정표·불바구니 기둥·화로·덕장·노점·목책·망루 …)는 밑 N줄만 막힌다.
- 목책 문루는 `SOLID_CELLS` 로 문기둥만 막힌다.
- 벽걸이(오로라 깃발·선반·등 …)와 굴뚝 연기는 ★ 다.
- 열린 물·벽면·천장은 아래층이지만 막힘이다(문 벽면 아랫칸 `wall-door-d` 는 예외).

## 3/4 관문 (object-gate)

낱 조각은 그림 화소 해시 영수증으로 관문을 통과한다. 부품(목책·울타리·굴뚝 연기)은 조립 그림 영수증(`sn_bake_lib.covered_status`, 화소 일치)으로, 오토타일 칸은 견본 영수증으로 덮는다.
**프로필이 미보정이라 통과는 「provisional」이다** — 「관문 합격」이라고 쓰지 말 것.
- 굽기 결과: 조각 131(야외 91 · 실내 40), 조립 그림으로 덮은 부품 8, 막힘 0. 실내 `barrel-in` 은 떨어져 뺐다.
- 다시 그려 붙은 것(판정자 버릇):
  - 정면 입면도(세운 틀·가는 테)는 떨어진다.
  - 넓은 윗면, 자른 면 타원(`post_top`·`beam`), 둥근 테(통·솥), 위에서 본 썰매 바닥은 붙는다.
  - 오로라 깃발은 기둥·틀로 세 번 떨어져 벽걸이(`wall_mounted`)로 바꿨다.
  - 등 기둥은 불바구니 기둥으로 다시 그려 붙었다.

## 적대적 시각 QA (한 번, 2026-10-14)

원본 해상도로 5장면(마을·호수·동굴 입구·장터·오두막 실내, seed 2)을 봤다. 결함 24건을 찾았고 한 번 고쳤다. 다시 돌리지 않았다.
- **고친 것:**
  - 맨 눈밭 위 상자 무더기 → 일터 마당을 다진 눈에 깔고 가까운 길에 이었다.
  - 마을 안 갈색 툰드라 덩이 → 들판에만 둔다.
  - 한 덩이를 같은 점박이 변주로 채우던 눈 → 칸마다 섞는다.
  - 네모 연못 → 작은 연못을 더 흔든다.
  - 일렬 갈대 → 덩이로 둔다.
  - 1칸 얼음 구멍 → 2×2 구멍, 낚시 자리는 구멍 곁에만.
  - 너무 큰 호수 → 줄였다.
  - 좌우 거울 노점 격자 → 엇갈림·빈 자리.
  - 탁자 없는 오두막 → 식탁 + 걸상, 깔개는 벽난로 앞.
  - 목책 밖 빈 띠 → 숲 덩이.
  - 폭포와 끊긴 개울 → 폭포 밑에서 바로 시작.
- **고치다 생긴 것:** 진창 마당이 점박이 양탄자로 보였다. 같은 패스 안에서 다진 눈으로 되돌렸다.
- **남은 약점:**
  - 진창·서리 풀 오토타일 속 무늬가 반복 무늬(점박이·이끼 양탄자)로 읽힌다(그림 문제).
  - 얼음 구멍은 네모로 자른 구멍이다.
  - 동굴 입구 양옆에 절벽 조각이 없어 바위·나무 띠로 능선을 대신한다.
  - 마을의 헛간·가축 우리는 자리가 없어 대개 빠진다.
  - 동굴 장면 일터 마당 잇기가 긴 직선 길을 낸다.

## 조수 실제 실행

(아래 절은 실행 결과로 채운다.)
