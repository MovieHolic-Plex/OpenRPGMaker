# 장르별 상호작용 오브젝트 대표 ID 치트시트 (`interactive-props`)

실제 배치 전에는 항상 `list_interactive_props`로 최신 목록(156종+)을 확인한다. 아래는 자주 쓰는 대표 ID 요약이다.

## 1. 공포·미스터리·폐가 (`genre: "horror"`)
- **저택·고딕 실내**: `horror-mansion-portrait`(초상화·wall), `horror-pipe-organ`(오르간), `horror-gothic-chandelier`(샹들리에·wall), `horror-knight-statue`(기사 석상), `horror-standing-mirror`(전신 거울·유령/균열), `door-push-confessional`(고해실·hide)
- **납골당·지하 던전**: `horror-weeping-angel`(피눈물 천사), `horror-crypt-candelabra`(푸른 도깨비불 촛대), `horror-crypt-altar`(저주 제단), `horror-skull-niche`(벽 해골 감실·wall), `horror-tomb-slab`(밀리는 묘비 석판·passage), `horror-ossuary-wall`(해골 벽·wall), `horror-torture-cage`(철창 우리·hide)
- **야외 공포**: `horror-cemetery-arch`(공동묘지 안개 아치), `horror-scarecrow-twitch`(허수아비), `horror-gothic-lamp`(깜빡이는 철제 가로등)
- **폐병원·폐건물(현대)**: `horror-clinic-wheelchair`(굴러가는 휠체어), `horror-clinic-stretcher`(이동 들것), `horror-clinic-medbin`(의료 폐기물함), `horror-tailor-mannequin`(고개 돌리는 마네킹), `horror-worklamp-flicker`(작업등 점멸)
- **숨기(`role: "hide"`) 대표**: `beodeul-wardrobe`, `interior-wardrobe`, `door-push-confessional`, `modern-lockers`, `modern-phone-booth`, `door-push-photo-curtain`, `door-push-tent-canvas`, `joseon-pal-jangnong`, `scifi-cryo-pod`

## 2. 밀고 들어가는 문 · 커튼 · 게이트 (`category: "door-pass"`)
- **안쪽 밀기문**: `door-push-house-oak`(참나무), `door-push-desert-arch`(사막 아치), `door-push-dungeon-cell`(감옥 철격자), `door-push-paddock-gate`(목장), `door-push-picket-gate`(하얀 울타리), `door-push-iron-garden`(저택 철제 양문), `door-push-hedge-rustic`(시골 판자), `door-push-lock-sluice`(수로 수문)
- **헤치고 들어가는 커튼·천막**: `door-push-curtain-booth`(입구 커튼), `door-push-izakaya-noren`(선술집 노렌), `door-push-photo-curtain`(포토부스), `door-push-tent-canvas`(모험가 천막), `door-push-dome-tent`(캠핑 돔텐트)
- **현대 통과 게이트**: `door-push-subway-gate`(지하철 개찰구), `door-push-parking-barrier`(주차장 차단바)
- **바깥 여닫이·미닫이**: `door-wooden-gate`, `door-ruin-sealed`, `door-joseon-hanji`, `door-joseon-palace`, `scifi-airlock`, `scifi-elevator-door`

## 3. 파괴·채집 (`category: "breakable"`, 파괴 후 통과 가능)
- **판타지·던전**: `water-jug-smash`, `clay-pots-smash`, `storage-jars-smash`, `terracotta-pot-smash`, `dungeon-amphora-smash`, `dungeon-crate-smash`, `dungeon-barrel-smash`, `dungeon-crystal-smash`, `dungeon-ice-crystal-smash`
- **조선·무림**: `joseon-hangari-smash`, `joseon-jangdok-smash`, `joseon-onggi-smash`, `murim-suldok-smash`
- **뒤지기**: `sack-pile-search`, `hay-stack-search`, `dungeon-skulls-scatter`

## 4. 일상·현대·도시 (`genre: "romance-daily"` / `"monster-collect"`)
- **기계·가전**: `modern-vending`, `modern-arcade`, `modern-claw-machine`, `modern-ticket-machine`, `modern-coin-changer`, `modern-charging-kiosk`, `modern-parcel-locker`, `modern-phone-booth`
- **야시장·요리·환경**: `env-fishcake-cart`, `env-ramen-pot`, `env-grill-cart`, `env-wind-turbine`

## 5. 판타지·조선·무림·SF 환경 & 수납
- **판타지 수납·환경**: `treasure-chest`, `beodeul-wardrobe`, `beodeul-drawers`, `beodeul-bookshelf`(비밀통로), `fireplace-stone`, `env-campfire`, `env-anvil-forge`, `env-wall-fountain`, `env-wall-clock`
- **조선·무림**: `joseon-pal-jangnong`, `joseon-bandaji`, `joseon-dwiju`, `joseon-yakjang`, `joseon-stove-pot`, `env-yeonja-mill`, `murim-seoga-secret`, `murim-temple-bell`, `murim-war-drum`
- **SF·스팀펑크**: `scifi-cryo-pod`, `scifi-terminal`, `scifi-holo-table`, `scifi-reactor`, `steampunk-regulator`, `steampunk-alarm`, `steampunk-gas-lamp`
