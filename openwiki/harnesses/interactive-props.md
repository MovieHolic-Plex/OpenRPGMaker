# `interactive-props` 하네스 — 5축 분류 시대·장르별 상호작용 오브젝트 멀티프레임 PNG (현재 156종 / 목표 300·500종)

## 목적
기존 `openStatePixels` 코드 화소 자르기(닫힌 타일 상단을 임의로 잘라 위로 띄움)와 `Graphics.fillRect` 대체 그림을 없애고, **저장소의 기존 고퀄리티 원본 PNG(`beodeul-objects`, `beodeul-interiors`, `beodeul-door`, `beodeul-dungeon`, `sf-station`, `joseon-baram`, `steampunk-city`, `desert-east`, `sky-island`)를 0번 프레임 그대로 보존**한 5프레임 가로 PNG 스트립(`public/assets/harnesses/interactive-props/<id>.png`)과 5축 분류 카탈로그(`src/assets/interactivePropsCatalog.json`) · 쿼터 원장(`harness-data/interactive-props/quotas.json`)을 관리한다.

## 5축 마스터 분류 체계 (`taxonomy.py`)
1. **`world` (세계관·시대, 단일)**: `fantasy` · `modern` · `joseon` · `murim` · `desert` · `snow` · `pirate` · `wasteland` · `dungeon` · `scifi` · `steampunk`
2. **`genres[]` (장르·무드, 다중)**: `horror` · `puzzle-escape` · `adventure` · `romance-daily` · `monster-collect` · `life-survival` · `eastern` · `cyber-scifi`
3. **`category` (기능 카테고리, 단일)**: `door-pass` · `container` · `breakable` · `machine` · `light-fire` · `water-env` · `gimmick` · `outdoor-ride`
4. **`zone` + `mount` (배치 공간·부착면)**: `indoor|outdoor|both` × `floor|wall|doorway|counter`
5. **`roles[]` (게임플레이 역할, 다중)**: `loot` · `passage` · `hide` · `puzzle-clue` · `ambient-light` · `hazard-trap`

## 8개 웨이브 · 현재 156종 구성

| 웨이브 | 수량 | 시대 분포 | 주요 오브젝트 |
|---|---:|---|---|
| `wave1-fantasy` | 20 | `fantasy` 20 | 보물상자(페어), 양문 옷장 2종, 서랍장·협탁·화장대·책상, 비밀 책장, 철제 금고·돈통, 식기 찬장·장식장, 지하실 해치, 은행 금고문, 감옥 철창문, 벽난로 2종·빵화덕, 도르래 우물 |
| `wave2-smash-dungeon` | 20 | `fantasy` 5 · `dungeon` 15 | **항아리/도자기/암포라 파괴 7종**, 나무상자·오크통·상자더미 파괴, 곡식자루·건초 탐색, 석관(페어), 화로·벽횃불 점화, 수정·얼음수정·해골 파괴, 하수구 밸브·철창 수문 |
| `wave3-modern` | 20 | `modern` 20 | 음료·마스크·식권 자판기, 동전교환기, 빈병회수기, 학교 사물함, 택배 보관함·상자, 공구함, 아이스박스, 쓰레기통·분리수거함, 소화전함, 신호제어함, 배터리교환함, 충전 키오스크, 공중전화 부스, 리듬 오락기, 인형뽑기, 사무실 철제 캐비닛 |
| `wave4-joseon-murim` | 20 | `joseon` 13 · `murim` 7 | 궁중 자개장롱, 반닫이, 뒤주, 약장, 안방 나무농, 사랑방 문갑, 궁중 경대, 가마솥, 숯불 화로, 부엌 화덕, **조선 항아리·김장 물독·장독대 옹기·객잔 술독 파괴 4종**, 청동 향로, 비급 문서함, 비밀 서가, 사찰 대종, 전고 대북, 궁중 홍등롱 |
| `wave5-scifi-steampunk` | 20 | `scifi` 12 · `steampunk` 5 · `dungeon` 3 | 냉동 캡슐, 화물 상자, 단말기, 서버 랙, 로커, 우주 냉장고, 보급 캡슐, 대형 에어록, 엘리베이터 문, 갑판 해치, 홀로 테이블, 원자로, 증기 밸브·경보벨·제어반·가스등·광장등, 사막·하늘섬 봉인 제단, 마법 보주 받침대 |
| `wave6-doors-env` | 20 | `fantasy` 11 · `modern` 5 · `joseon` 3 · `dungeon` 1 | **출입문·대문 8종** + **환경 모션 12종**(괘종시계·대장간 모루불꽃·모닥불·촛대·걸이솥·돌벽 분수대·풍향계·연자방아·어묵 포장마차·라멘솥·숯불구이 수레·풍력 발전기) |
| `wave7-push-doors` | 16 | `fantasy` 9 · `modern` 6 · `dungeon` 1 | **밀고 들어가는 문·커튼·통과 게이트 16종**(버들항 참나무 밀기문·사막 아치형 밀기문·던전 철격자 감옥 밀기문·성당 고해실·울타리/수문 밀기문·천막/돔텐트·커튼/노렌/포토부스·개찰구·차단바) |
| `wave8-horror` | 20 | `fantasy` 8 · `dungeon` 7 · `modern` 5 | **공포·폐가·병원·납골당 전용 팩 20종**(저주받은 초상화·유령 파이프 오르간·고딕 샹들리에·움직이는 갑옷 석상·귀신 스치는 전신 거울·피눈물 천사 석상·푸른 도깨비불 촛대·저주 제단·해골 감실·밀리는 묘비 석판·납골당 해골 벽·철창 우리·공동묘지 안개 아치·허수아비·고딕 가로등·폐병원 휠체어·이동 들것·의료 폐기물함·고개 돌리는 마네킹·작업등 점멸) |

## 실행 명령

```bash
# 전체 100종 재생성 + 검증 + 픽 + 게이트 + 빌드
python3 src/harnesses/interactive-props/build_all.py

# 하네스 개별 단계
npm run harness -- interactive-props validate
npm run harness -- interactive-props list --wave wave2-smash-dungeon
npm run harness -- interactive-props gate
npm run harness -- interactive-props sheet --wave wave1-fantasy
npm run harness -- interactive-props build
npm run harness -- interactive-props status
```

## 런타임·에디터·조수·내보내기 연동
- **카탈로그·SE·광원**: `src/project/interactiveProps.ts` (`interactivePropById`, `interactivePropForContainer`, `searchInteractiveProps`, `resolveInteractivePropSe`, `interactivePropGlowColor`, `inferInteractivePropEra`)
- **효과 키 & 재생기**: `fx:prop:<id>` (열기/작동/파괴), `fx:prop:<id>:close` (닫기), 이벤트 필드 `interaction.propId` → `src/player/playSceneFieldFx.ts` (`oneshot` / `toggle` / `break` / `loopAfterOpen`, 0번 원본 프레임 대기 렌더, `loopAfterOpen` 주변 광원 글로우, `wardrobe`·타일 미지정 수납 자동 업그레이드)
- **조수 도구**: `src/editor/tools/searchContainerTools.ts` (`list_interactive_props`, `place_interactive_props`, `place_search_containers` 의 `propId` 지원 — `break` 계열은 파괴 후 `priority: "below", through: true` 로 통과 가능)
- **이벤트 편집기 UI**: `src/editor/panels/eventEditor/interactivePropPicker.ts` + `commandBodyPage3Native.ts` (`showAnimation` 「오브젝트 연출 (100종)」 시대별 피커 & 실시간 스트립 미리보기) + `commandSummary.ts`
- **게임 내보내기**: `src/project/webExportAssets.ts` (`interactivePropStripPaths` 가 사용된 스트립 PNG 를 출하 번들에 자동 포함)
